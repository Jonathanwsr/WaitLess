<?php

namespace App\Services\Viagem;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\NotificacaoUsuario;
use App\Models\OfertaViagem;
use App\Models\Servico;
use App\Models\User;
use App\Services\DestaquePremiumService;
use App\Services\NotificacaoService;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Venda cruzada preditiva de viagem.
 *
 * Quando o cliente reserva uma hospedagem, o sistema agenda gatilhos:
 * - 2 dias antes do check-in: push oferecendo um veículo na cidade da hospedagem;
 * - na chegada (o app manda a localização): oferece o melhor restaurante e um spa/estética da cidade.
 * As ofertas priorizam premium, depois quem aceita pontos, depois a avaliação (mesma regra do Explorar).
 * Clique e conversão (o cliente reservou o que foi oferecido) são medidos para o admin.
 */
class CrossSellViagemService
{
    public const FUSO = 'America/Sao_Paulo';
    public const DIAS_ANTES_VEICULO = 2;
    public const RAIO_CHEGADA_KM = 40;
    public const DIAS_PARA_CONVERSAO = 7;

    public const CATEGORIAS_HOSPEDAGEM = [
        'hotel', 'pousada', 'hostel', 'casa', 'apartamento', 'casa_praia', 'flat', 'chalé', 'cabana', 'loft',
        'kitnet', 'cobertura', 'sitio', 'chacara', 'fazenda',
    ];

    public const CATEGORIAS_VEICULO = [
        'carro', 'moto', 'van', 'motorhome', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico',
        'jet_ski', 'barco', 'lancha',
    ];

    private const RAMOS_RESTAURANTE = ['restaurante', 'lanchonete', 'bar', 'pizzaria', 'hamburgueria', 'cafeteria'];
    private const RAMOS_SPA = ['spa', 'estetica', 'estética', 'massagem', 'beleza', 'bem-estar'];

    public function __construct(private DestaquePremiumService $destaque, private NotificacaoService $notificacoes)
    {
    }

    public static function ehHospedagem(?string $categoria): bool
    {
        return $categoria !== null && in_array($categoria, self::CATEGORIAS_HOSPEDAGEM, true);
    }

    // ------------------------------------------------------------------ agendamento

    /** Ao reservar uma hospedagem: agenda a oferta de veículo (2 dias antes) e o gatilho de chegada. */
    public function agendarParaReserva(Aluguel $aluguel): void
    {
        $aluguel->loadMissing('item');
        $item = $aluguel->item;
        if (!$item || !self::ehHospedagem($item->categoria) || $aluguel->status === 'cancelado') {
            return;
        }

        $checkin = Carbon::parse(Carbon::parse($aluguel->data_inicio)->format('Y-m-d') . ' 10:00', self::FUSO);
        if ($checkin->copy()->endOfDay()->isPast()) {
            return;
        }

        $local = ['cidade' => $item->cidade, 'estado' => $item->estado ? strtoupper($item->estado) : null];
        // Converte para o fuso do app antes de gravar (o banco guarda a hora sem fuso).
        $quando = $checkin->copy()->subDays(self::DIAS_ANTES_VEICULO)->setTimezone(config('app.timezone'));

        OfertaViagem::firstOrCreate(
            ['aluguel_id' => $aluguel->id, 'tipo' => 'veiculo_pre_checkin'],
            $local + ['usuario_id' => $aluguel->locatario_id, 'status' => 'agendada', 'disparar_em' => $quando->isPast() ? now() : $quando]
        );

        OfertaViagem::firstOrCreate(
            ['aluguel_id' => $aluguel->id, 'tipo' => 'chegada'],
            $local + ['usuario_id' => $aluguel->locatario_id, 'status' => 'aguardando_chegada']
        );
    }

    /** Reserva cancelada: nada mais é oferecido sobre ela. */
    public function cancelarParaReserva(Aluguel $aluguel): void
    {
        OfertaViagem::where('aluguel_id', $aluguel->id)
            ->whereIn('status', ['agendada', 'aguardando_chegada'])
            ->update(['status' => 'cancelada']);
    }

    // ------------------------------------------------------------------ disparo

    /** Dispara as ofertas de veículo que chegaram na hora. Devolve quantas foram enviadas. */
    public function dispararVencidas(): int
    {
        $enviadas = 0;

        OfertaViagem::with('aluguel.item', 'usuario')
            ->where('status', 'agendada')
            ->where('tipo', 'veiculo_pre_checkin')
            ->where('disparar_em', '<=', now())
            ->limit(200)
            ->get()
            ->each(function (OfertaViagem $oferta) use (&$enviadas) {
                if (!$this->reservaSegueValida($oferta->aluguel)) {
                    $oferta->update(['status' => 'cancelada']);
                    return;
                }

                $veiculo = $this->melhorVeiculo($oferta->cidade, $oferta->estado, $oferta->aluguel->item?->estabelecimento_id);
                if (!$veiculo) {
                    $oferta->update(['status' => 'sem_oferta']);
                    return;
                }

                $this->enviar(
                    $oferta,
                    'item_aluguel',
                    $veiculo->id,
                    'Vai precisar de transporte em ' . ($oferta->cidade ?: 'sua viagem') . '?',
                    "Seu check-in é em 2 dias. Que tal já garantir {$veiculo->nome} para se deslocar com tranquilidade?",
                    ['rota' => '/src/screens/ExplorarDetalhes', 'id' => (string) $veiculo->id, 'tipo' => 'reservas']
                );
                $enviadas++;
            });

        // Ofertas de chegada que nunca dispararam ficam expiradas depois do fim da hospedagem.
        OfertaViagem::where('status', 'aguardando_chegada')
            ->whereHas('aluguel', fn ($q) => $q->where('data_fim', '<', now(self::FUSO)->toDateString()))
            ->update(['status' => 'expirada']);

        return $enviadas;
    }

    /**
     * O app avisa onde o cliente está. Se ele chegou à cidade de uma hospedagem com check-in por estes
     * dias, oferece o melhor restaurante e um spa/estética de lá (uma única vez por reserva).
     *
     * @return Collection<int, OfertaViagem> ofertas criadas agora
     */
    public function registrarChegada(User $user, float $lat, float $lng, ?string $cidadeDoApp = null): Collection
    {
        $hoje = now(self::FUSO)->startOfDay();
        $criadas = collect();

        $gatilhos = OfertaViagem::with('aluguel.item')
            ->where('usuario_id', $user->id)
            ->where('tipo', 'chegada')
            ->where('status', 'aguardando_chegada')
            ->get();

        foreach ($gatilhos as $gatilho) {
            $aluguel = $gatilho->aluguel;
            if (!$this->reservaSegueValida($aluguel)) {
                $gatilho->update(['status' => 'cancelada']);
                continue;
            }

            // Janela da chegada: da véspera do check-in até o fim da hospedagem.
            $inicio = Carbon::parse($aluguel->data_inicio, self::FUSO)->startOfDay()->subDay();
            $fim = Carbon::parse($aluguel->data_fim, self::FUSO)->endOfDay();
            if ($hoje->lt($inicio) || $hoje->gt($fim)) {
                continue;
            }

            if (!$this->chegouAoDestino($aluguel->item, $gatilho->cidade, $lat, $lng, $cidadeDoApp)) {
                continue;
            }

            $gatilho->update(['status' => 'enviada', 'enviada_em' => now()]);
            $excluirLocal = $aluguel->item?->estabelecimento_id;

            $restaurante = $this->melhorEstabelecimento(self::RAMOS_RESTAURANTE, $gatilho->cidade, $gatilho->estado);
            if ($restaurante) {
                $criadas->push($this->criarOfertaDeChegada(
                    $gatilho, 'chegada_restaurante', 'estabelecimento', $restaurante->id,
                    'Bem-vindo a ' . ($gatilho->cidade ?: 'seu destino') . '!',
                    "{$restaurante->nome} é um dos mais bem avaliados da cidade. Entre na fila pelo app e evite a espera.",
                    ['rota' => '/src/screens/EstabelecimentoDetalhes', 'id' => (string) $restaurante->id]
                ));
            }

            $spa = $this->melhorServicoDeSpa($gatilho->cidade, $gatilho->estado, $excluirLocal);
            if ($spa) {
                $criadas->push($this->criarOfertaDeChegada(
                    $gatilho, 'chegada_spa', 'servico', $spa->id,
                    'Um momento para você',
                    "Relaxe depois da viagem: {$spa->nome} em {$spa->estabelecimento?->nome}.",
                    ['rota' => '/src/screens/ExplorarDetalhes', 'id' => (string) $spa->id, 'tipo' => 'servicos']
                ));
            }
        }

        // Um único push com o resumo da chegada, para não incomodar com várias notificações.
        if ($criadas->isNotEmpty()) {
            $primeira = $criadas->first();
            $this->notificacoes->enviarPush($user, $primeira->titulo, $criadas->pluck('mensagem')->implode(' '), [
                'oferta_id' => $primeira->id,
                'rota' => '/src/screens/Home',
            ]);
        }

        return $criadas;
    }

    // ------------------------------------------------------------------ medição

    public function registrarClique(OfertaViagem $oferta): void
    {
        if (!$oferta->clicada_em) {
            $oferta->update([
                'clicada_em' => now(),
                'status' => $oferta->status === 'convertida' ? 'convertida' : 'clicada',
            ]);
        }
    }

    /** Uma reserva ou agendamento novo do cliente converte a oferta correspondente (até 7 dias depois). */
    public function registrarConversao(int $usuarioId, string $alvoTipo, int $alvoId): void
    {
        OfertaViagem::where('usuario_id', $usuarioId)
            ->where('alvo_tipo', $alvoTipo)
            ->where('alvo_id', $alvoId)
            ->whereIn('status', ['enviada', 'clicada'])
            ->where('enviada_em', '>=', now()->subDays(self::DIAS_PARA_CONVERSAO))
            ->update(['status' => 'convertida', 'convertida_em' => now()]);
    }

    public function conversaoDeAgendamento(Agendamento $agendamento): void
    {
        $this->registrarConversao((int) $agendamento->usuario_id, 'servico', (int) $agendamento->servico_id);
        $this->registrarConversao((int) $agendamento->usuario_id, 'estabelecimento', (int) $agendamento->estabelecimento_id);
    }

    /** Ofertas ativas para mostrar no app (card "Para sua viagem"). */
    public function ofertasAtivas(User $user): Collection
    {
        return OfertaViagem::where('usuario_id', $user->id)
            ->whereIn('status', ['enviada', 'clicada'])
            ->whereNotNull('alvo_id')
            ->where('enviada_em', '>=', now()->subDays(self::DIAS_PARA_CONVERSAO))
            ->orderByDesc('enviada_em')
            ->limit(6)
            ->get()
            ->map(fn (OfertaViagem $o) => [
                'id' => $o->id,
                'tipo' => $o->tipo,
                'titulo' => $o->titulo,
                'mensagem' => $o->mensagem,
                'cidade' => $o->cidade,
                'alvo_tipo' => $o->alvo_tipo,
                'alvo_id' => $o->alvo_id,
                'foto' => $this->fotoDoAlvo($o->alvo_tipo, $o->alvo_id),
            ])
            ->values();
    }

    /** Números para o admin: quantas ofertas saíram, foram abertas e viraram reserva. */
    public function metricas(?Carbon $desde = null): array
    {
        $base = OfertaViagem::whereNotNull('enviada_em')->whereNotNull('alvo_id')
            ->when($desde, fn ($q) => $q->where('enviada_em', '>=', $desde));

        $enviadas = (clone $base)->count();
        $clicadas = (clone $base)->whereNotNull('clicada_em')->count();
        $convertidas = (clone $base)->where('status', 'convertida')->count();

        $porTipo = (clone $base)->selectRaw('tipo, COUNT(*) as enviadas, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as convertidas', ['convertida'])
            ->groupBy('tipo')->get()
            ->mapWithKeys(fn ($l) => [$l->tipo => ['enviadas' => (int) $l->enviadas, 'convertidas' => (int) $l->convertidas]]);

        return [
            'enviadas' => $enviadas,
            'clicadas' => $clicadas,
            'convertidas' => $convertidas,
            'taxa_clique' => $enviadas ? round($clicadas / $enviadas * 100, 1) : 0.0,
            'taxa_conversao' => $enviadas ? round($convertidas / $enviadas * 100, 1) : 0.0,
            'por_tipo' => $porTipo,
            'agendadas' => OfertaViagem::whereIn('status', ['agendada', 'aguardando_chegada'])->count(),
        ];
    }

    // ------------------------------------------------------------------ escolha das ofertas

    private function melhorVeiculo(?string $cidade, ?string $estado, ?int $excluirDono): ?ItemAluguel
    {
        if (!$cidade) {
            return null;
        }

        $candidatos = ItemAluguel::catalogo()
            ->whereIn('categoria', self::CATEGORIAS_VEICULO)
            ->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('somente_premium')->orWhere('somente_premium', false))
            ->whereRaw('lower(cidade) = ?', [mb_strtolower($cidade)])
            ->when($estado, fn ($q) => $q->where(fn ($q2) => $q2->whereNull('estado')->orWhereRaw('upper(estado) = ?', [$estado])))
            ->when($excluirDono, fn ($q) => $q->where('estabelecimento_id', '!=', $excluirDono))
            ->limit(50)
            ->get();

        return $candidatos->sortBy(fn (ItemAluguel $i) => [
            $this->destaque->nivelDeDestaque((int) $i->estabelecimento_id, 'usuario'),
            -(float) $i->avaliacao_media,
        ])->first();
    }

    private function melhorEstabelecimento(array $ramos, ?string $cidade, ?string $estado): ?Estabelecimento
    {
        if (!$cidade) {
            return null;
        }

        $candidatos = Estabelecimento::query()
            ->where('ativo', true)
            ->whereRaw('lower(cidade) = ?', [mb_strtolower($cidade)])
            ->when($estado, fn ($q) => $q->whereRaw('upper(estado) = ?', [$estado]))
            ->where(function ($q) use ($ramos) {
                foreach ($ramos as $ramo) {
                    $q->orWhereRaw('lower(ramo_atuacao) like ?', ['%' . mb_strtolower($ramo) . '%']);
                }
            })
            ->limit(50)
            ->get();

        return $candidatos->sortBy(fn (Estabelecimento $e) => [
            $this->destaque->nivelDeDestaque((int) $e->id),
            -(float) $e->avaliacao_media,
        ])->first();
    }

    private function melhorServicoDeSpa(?string $cidade, ?string $estado, ?int $excluirLocal): ?Servico
    {
        $local = $this->melhorEstabelecimento(self::RAMOS_SPA, $cidade, $estado);
        if (!$local || (int) $local->id === (int) $excluirLocal) {
            return null;
        }

        return Servico::with('estabelecimento:id,nome')
            ->where('estabelecimento_id', $local->id)
            ->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('somente_premium')->orWhere('somente_premium', false))
            ->orderByDesc('avaliacao_media')
            ->orderByDesc('valor')
            ->first();
    }

    // ------------------------------------------------------------------ apoio

    private function reservaSegueValida(?Aluguel $aluguel): bool
    {
        return $aluguel !== null && !in_array($aluguel->status, ['cancelado', 'finalizado'], true);
    }

    private function chegouAoDestino(?ItemAluguel $item, ?string $cidade, float $lat, float $lng, ?string $cidadeDoApp): bool
    {
        if ($item && $item->latitude && $item->longitude) {
            return $this->distanciaKm($lat, $lng, (float) $item->latitude, (float) $item->longitude) <= self::RAIO_CHEGADA_KM;
        }

        return $cidade && $cidadeDoApp && $this->normalizar($cidade) === $this->normalizar($cidadeDoApp);
    }

    private function enviar(OfertaViagem $oferta, string $alvoTipo, int $alvoId, string $titulo, string $mensagem, array $dados): void
    {
        $oferta->update([
            'alvo_tipo' => $alvoTipo, 'alvo_id' => $alvoId, 'titulo' => $titulo, 'mensagem' => $mensagem,
            'status' => 'enviada', 'enviada_em' => now(),
        ]);

        NotificacaoUsuario::avisar($oferta->usuario_id, $titulo, $mensagem);
        if ($oferta->usuario) {
            $this->notificacoes->enviarPush($oferta->usuario, $titulo, $mensagem, $dados + ['oferta_id' => $oferta->id]);
        }
    }

    private function criarOfertaDeChegada(OfertaViagem $gatilho, string $tipo, string $alvoTipo, int $alvoId, string $titulo, string $mensagem, array $dados): OfertaViagem
    {
        $oferta = OfertaViagem::firstOrCreate(
            ['aluguel_id' => $gatilho->aluguel_id, 'tipo' => $tipo],
            [
                'usuario_id' => $gatilho->usuario_id, 'cidade' => $gatilho->cidade, 'estado' => $gatilho->estado,
                'alvo_tipo' => $alvoTipo, 'alvo_id' => $alvoId, 'titulo' => $titulo, 'mensagem' => $mensagem,
                'status' => 'enviada', 'enviada_em' => now(),
            ]
        );
        NotificacaoUsuario::avisar($gatilho->usuario_id, $titulo, $mensagem);

        return $oferta;
    }

    private function fotoDoAlvo(?string $tipo, ?int $id): ?string
    {
        $fotos = match ($tipo) {
            'item_aluguel' => ItemAluguel::whereKey($id)->value('fotos'),
            'servico' => Servico::whereKey($id)->value('fotos'),
            'estabelecimento' => Estabelecimento::whereKey($id)->value('foto_banner') ?: Estabelecimento::whereKey($id)->value('foto_perfil'),
            default => null,
        };

        if (is_string($fotos) && str_starts_with($fotos, 'http')) {
            return $fotos;
        }
        $lista = is_array($fotos) ? $fotos : (json_decode((string) $fotos, true) ?: []);

        $primeira = $lista[0] ?? null;
        if (!is_string($primeira) || $primeira === '') {
            return null;
        }

        return str_starts_with($primeira, 'http') ? $primeira : asset('storage/' . ltrim($primeira, '/'));
    }

    private function normalizar(string $texto): string
    {
        $texto = mb_strtolower(trim($texto));

        return strtr($texto, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c']);
    }

    private function distanciaKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
