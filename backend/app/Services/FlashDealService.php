<?php

namespace App\Services;

use App\Models\Estabelecimento;
use App\Models\FlashDeal;
use App\Models\FlashDealAviso;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Flash Deals: o sócio/gerente transforma vagas ociosas (quartos, carros, mesas, horários) em
 * receita na hora. Ele escolhe o item/serviço, o desconto, quantas vagas e por quanto tempo.
 *
 * - O desconto entra no campo de promoção do item/serviço, que toda a cobrança (web, app e cotação)
 *   já usa; a promoção anterior é guardada e volta sozinha quando o deal acaba ou esgota.
 * - Só quem está na cidade agora (localização enviada pelo app nas últimas horas, dentro do raio)
 *   recebe o push. Cada cliente recebe no máximo MAX_AVISOS_DIA deals por dia.
 * - Cada reserva/agendamento feito durante o deal consome uma vaga; acabou, o deal encerra.
 */
class FlashDealService
{
    public const PERCENTUAL_MIN = 10;
    public const PERCENTUAL_MAX = 70;
    public const QUANTIDADE_MAX = 50;
    public const DURACAO_MIN = 30;
    public const DURACAO_MAX = 360;
    public const DURACAO_PADRAO = 120;
    public const RAIO_PADRAO_KM = 30;
    public const LOCALIZACAO_VALE_HORAS = 6;
    public const MAX_DEALS_POR_DIA = 5;
    public const MAX_AVISOS_DIA = 3;
    private const MAX_DESTINATARIOS = 5000;

    private const PAPEIS_GESTAO = ['socio', 'proprietario', 'gerente'];

    // ------------------------------------------------------------------ localização do cliente

    /** Guarda onde o cliente está (enviado pelo app). */
    public function registrarLocalizacao(User $user, float $lat, float $lng, ?string $cidade): void
    {
        $user->forceFill([
            'ultima_latitude' => $lat,
            'ultima_longitude' => $lng,
            'ultima_cidade' => $cidade ? mb_substr(trim($cidade), 0, 120) : $user->ultima_cidade,
            'ultima_localizacao_em' => now(),
        ])->saveQuietly();
    }

    // ------------------------------------------------------------------ painel do sócio

    /** Itens e serviços que este usuário pode colocar em Flash Deal. */
    public function opcoesDoDono(User $user): array
    {
        $locais = $this->locaisDeGestao($user);

        $itens = ItemAluguel::catalogo()
            ->where('estabelecimento_id', $user->id)
            ->where('ativo', true)
            ->orderBy('nome')
            ->get(['id', 'nome', 'categoria', 'cidade', 'valor_diaria', 'valor'])
            ->map(fn ($i) => ['tipo' => 'item_aluguel', 'id' => $i->id, 'nome' => $i->nome, 'categoria' => $i->categoria, 'cidade' => $i->cidade, 'valor' => (float) ($i->valor_diaria ?: $i->valor)]);

        $servicos = Servico::with('estabelecimento:id,nome,cidade')
            ->whereIn('estabelecimento_id', $locais)
            ->where('ativo', true)
            ->orderBy('nome')
            ->get(['id', 'nome', 'valor', 'estabelecimento_id'])
            ->map(fn ($s) => ['tipo' => 'servico', 'id' => $s->id, 'nome' => $s->nome, 'categoria' => $s->estabelecimento?->nome, 'cidade' => $s->estabelecimento?->cidade, 'valor' => (float) $s->valor]);

        return ['itens' => $itens->values(), 'servicos' => $servicos->values()];
    }

    public function dealsDoDono(User $user, int $limite = 30): Collection
    {
        $this->encerrarVencidos();

        return FlashDeal::where('criado_por', $user->id)
            ->withCount(['avisos as clicados' => fn ($q) => $q->whereNotNull('clicado_em')])
            ->latest()
            ->limit($limite)
            ->get()
            ->map(fn (FlashDeal $d) => $this->paraPainel($d));
    }

    /**
     * @param array{alvo_tipo:string, alvo_id:int, percentual:int, quantidade:int, duracao_minutos?:int, raio_km?:int} $dados
     */
    public function criar(User $user, array $dados): FlashDeal
    {
        [$alvo, $local] = $this->alvoAutorizado($user, $dados['alvo_tipo'], (int) $dados['alvo_id']);

        $percentual = (int) $dados['percentual'];
        $quantidade = (int) $dados['quantidade'];
        $duracao = (int) ($dados['duracao_minutos'] ?? self::DURACAO_PADRAO);
        $raio = (int) ($dados['raio_km'] ?? self::RAIO_PADRAO_KM);

        if ($percentual < self::PERCENTUAL_MIN || $percentual > self::PERCENTUAL_MAX) {
            throw ValidationException::withMessages(['percentual' => 'O desconto deve ficar entre ' . self::PERCENTUAL_MIN . '% e ' . self::PERCENTUAL_MAX . '%.']);
        }
        if ($quantidade < 1 || $quantidade > self::QUANTIDADE_MAX) {
            throw ValidationException::withMessages(['quantidade' => 'Informe de 1 a ' . self::QUANTIDADE_MAX . ' vagas.']);
        }
        if ($duracao < self::DURACAO_MIN || $duracao > self::DURACAO_MAX) {
            throw ValidationException::withMessages(['duracao_minutos' => 'A oferta deve durar de 30 minutos a 6 horas.']);
        }
        if (!$local['cidade'] && ($local['latitude'] === null || $local['longitude'] === null)) {
            throw ValidationException::withMessages(['alvo_id' => 'Cadastre o endereço deste item/local para saber quem está por perto.']);
        }

        $this->encerrarVencidos();

        $deal = DB::transaction(function () use ($user, $dados, $alvo, $local, $percentual, $quantidade, $duracao, $raio) {
            // Trava o alvo para dois cliques simultâneos não criarem dois deals sobre o mesmo item.
            $alvo->newQuery()->whereKey($alvo->id)->lockForUpdate()->first();

            $jaAtivo = FlashDeal::where('alvo_tipo', $dados['alvo_tipo'])->where('alvo_id', $alvo->id)->where('status', 'ativo')->exists();
            if ($jaAtivo) {
                throw ValidationException::withMessages(['alvo_id' => 'Já existe um Flash Deal ativo para este item. Encerre-o antes de criar outro.']);
            }
            $hoje = FlashDeal::where('criado_por', $user->id)->where('created_at', '>=', now()->subDay())->count();
            if ($hoje >= self::MAX_DEALS_POR_DIA) {
                throw ValidationException::withMessages(['alvo_id' => 'Limite de ' . self::MAX_DEALS_POR_DIA . ' Flash Deals por dia atingido.']);
            }

            $deal = FlashDeal::create([
                'criado_por' => $user->id,
                'alvo_tipo' => $dados['alvo_tipo'],
                'alvo_id' => $alvo->id,
                'alvo_nome' => mb_substr((string) $alvo->nome, 0, 150),
                'estabelecimento_id' => $alvo instanceof Servico ? $alvo->estabelecimento_id : null,
                'percentual' => $percentual,
                'quantidade' => $quantidade,
                'cidade' => $local['cidade'],
                'estado' => $local['estado'],
                'latitude' => $local['latitude'],
                'longitude' => $local['longitude'],
                'raio_km' => max(1, min(100, $raio)),
                'inicia_em' => now(),
                'expira_em' => now()->addMinutes($duracao),
                'status' => 'ativo',
                'promocao_anterior' => [
                    'tem_promocao' => (bool) $alvo->tem_promocao,
                    'tipo_desconto' => $alvo->tipo_desconto,
                    'valor_desconto' => $alvo->valor_desconto,
                ],
            ]);

            $alvo->forceFill(['tem_promocao' => true, 'tipo_desconto' => 'percentual', 'valor_desconto' => $percentual])->save();

            return $deal;
        });

        // Fora da transação: o envio dos pushes não deve segurar o lock do item.
        $this->avisarQuemEstaPerto($deal);

        return $deal->fresh();
    }

    public function cancelar(User $user, FlashDeal $deal): void
    {
        abort_unless((int) $deal->criado_por === (int) $user->id || strtolower((string) $user->papel) === 'admin', 403, 'Este Flash Deal não é seu.');
        if ($deal->status === 'ativo') {
            $this->encerrar($deal, 'cancelado');
        }
    }

    // ------------------------------------------------------------------ ciclo de vida

    /** Encerra os deals vencidos e devolve a promoção original dos itens. Retorna quantos encerrou. */
    public function encerrarVencidos(): int
    {
        $vencidos = FlashDeal::where('status', 'ativo')->where('expira_em', '<=', now())->get();
        $vencidos->each(fn (FlashDeal $d) => $this->encerrar($d, 'encerrado'));

        return $vencidos->count();
    }

    /** Uma reserva/agendamento novo: consome uma vaga do deal ativo daquele alvo e marca a conversão. */
    public function registrarUso(string $alvoTipo, int $alvoId, int $usuarioId): void
    {
        DB::transaction(function () use ($alvoTipo, $alvoId, $usuarioId) {
            $deal = FlashDeal::where('alvo_tipo', $alvoTipo)->where('alvo_id', $alvoId)
                ->where('status', 'ativo')->where('expira_em', '>', now())
                ->lockForUpdate()->first();
            if (!$deal || (int) $deal->criado_por === $usuarioId) {
                return;
            }

            $deal->increment('usados');
            FlashDealAviso::where('flash_deal_id', $deal->id)->where('usuario_id', $usuarioId)->whereNull('convertido_em')
                ->update(['convertido_em' => now()]);

            if ($deal->usados >= $deal->quantidade) {
                $this->encerrar($deal, 'esgotado');
            }
        });
    }

    private function encerrar(FlashDeal $deal, string $status): void
    {
        DB::transaction(function () use ($deal, $status) {
            $alvo = $this->modeloDoAlvo($deal->alvo_tipo, $deal->alvo_id);
            $anterior = $deal->promocao_anterior ?? [];

            // Só devolve a promoção se o item ainda estiver com o desconto do deal (o dono pode ter mudado no meio).
            if ($alvo && (bool) $alvo->tem_promocao && $alvo->tipo_desconto === 'percentual' && (float) $alvo->valor_desconto === (float) $deal->percentual) {
                $alvo->forceFill([
                    'tem_promocao' => (bool) ($anterior['tem_promocao'] ?? false),
                    'tipo_desconto' => $anterior['tipo_desconto'] ?? null,
                    'valor_desconto' => $anterior['valor_desconto'] ?? null,
                ])->save();
            }

            $deal->update(['status' => $status]);
        });
    }

    // ------------------------------------------------------------------ cliente

    /** Deals ativos perto do cliente (para a "caça ao tesouro" no app). */
    public function ativosParaCliente(User $user, ?float $lat = null, ?float $lng = null, ?string $cidade = null): Collection
    {
        $lat ??= $user->ultima_latitude !== null ? (float) $user->ultima_latitude : null;
        $lng ??= $user->ultima_longitude !== null ? (float) $user->ultima_longitude : null;
        $cidade ??= $user->ultima_cidade;

        if ($lat === null && !$cidade) {
            return collect();
        }

        return FlashDeal::where('status', 'ativo')
            ->where('expira_em', '>', now())
            ->whereColumn('usados', '<', 'quantidade')
            ->where('criado_por', '!=', $user->id)
            ->orderBy('expira_em')
            ->limit(100)
            ->get()
            ->filter(fn (FlashDeal $d) => $this->estaPerto($d, $lat, $lng, $cidade))
            ->take(20)
            ->map(fn (FlashDeal $d) => $this->paraCliente($d, $lat, $lng))
            ->values();
    }

    public function registrarClique(User $user, FlashDeal $deal): void
    {
        $aviso = FlashDealAviso::firstOrCreate(['flash_deal_id' => $deal->id, 'usuario_id' => $user->id]);
        if (!$aviso->clicado_em) {
            $aviso->update(['clicado_em' => now()]);
        }
    }

    // ------------------------------------------------------------------ admin

    public function metricas(?\Carbon\Carbon $desde = null): array
    {
        $deals = FlashDeal::when($desde, fn ($q) => $q->where('created_at', '>=', $desde));
        $avisos = FlashDealAviso::when($desde, fn ($q) => $q->where('created_at', '>=', $desde));

        $total = (clone $deals)->count();
        $notificados = (int) (clone $deals)->sum('notificados');
        $vendidas = (int) (clone $deals)->sum('usados');

        return [
            'deals' => $total,
            'ativos' => FlashDeal::where('status', 'ativo')->where('expira_em', '>', now())->count(),
            'esgotados' => (clone $deals)->where('status', 'esgotado')->count(),
            'notificados' => $notificados,
            'clicados' => (clone $avisos)->whereNotNull('clicado_em')->count(),
            'vagas_vendidas' => $vendidas,
            'vagas_ofertadas' => (int) (clone $deals)->sum('quantidade'),
            'taxa_ocupacao' => ($o = (int) (clone $deals)->sum('quantidade')) ? round($vendidas / $o * 100, 1) : 0.0,
        ];
    }

    // ------------------------------------------------------------------ apoio

    /** Push só para quem está na cidade agora, respeitando o limite diário de avisos por cliente. */
    private function avisarQuemEstaPerto(FlashDeal $deal): void
    {
        try {
            $candidatos = User::query()
                ->where('id', '!=', $deal->criado_por)
                ->where('ultima_localizacao_em', '>=', now()->subHours(self::LOCALIZACAO_VALE_HORAS))
                ->when($deal->latitude !== null && $deal->longitude !== null, function ($q) use ($deal) {
                    // Pré-filtro por "caixa" em volta do local; a distância exata é conferida abaixo.
                    $dLat = $deal->raio_km / 111;
                    $dLng = $deal->raio_km / (111 * max(0.1, cos(deg2rad($deal->latitude))));
                    $q->where(fn ($q2) => $q2
                        ->whereBetween('ultima_latitude', [$deal->latitude - $dLat, $deal->latitude + $dLat])
                        ->whereBetween('ultima_longitude', [$deal->longitude - $dLng, $deal->longitude + $dLng])
                        ->orWhereRaw('lower(ultima_cidade) = ?', [mb_strtolower((string) $deal->cidade)]));
                }, fn ($q) => $q->whereRaw('lower(ultima_cidade) = ?', [mb_strtolower((string) $deal->cidade)]))
                ->whereNotIn('id', FlashDealAviso::select('usuario_id')
                    ->where('created_at', '>=', now()->subDay())
                    ->groupBy('usuario_id')
                    ->havingRaw('COUNT(*) >= ?', [self::MAX_AVISOS_DIA]))
                ->limit(self::MAX_DESTINATARIOS)
                ->get(['id', 'expo_push_token', 'ultima_latitude', 'ultima_longitude', 'ultima_cidade'])
                ->filter(fn (User $u) => $this->estaPerto($deal, $u->ultima_latitude !== null ? (float) $u->ultima_latitude : null, $u->ultima_longitude !== null ? (float) $u->ultima_longitude : null, $u->ultima_cidade));

            if ($candidatos->isEmpty()) {
                return;
            }

            $agora = now();
            FlashDealAviso::insertOrIgnore($candidatos->map(fn (User $u) => [
                'flash_deal_id' => $deal->id, 'usuario_id' => $u->id, 'created_at' => $agora, 'updated_at' => $agora,
            ])->values()->all());
            $deal->update(['notificados' => $candidatos->count()]);

            $minutos = max(1, (int) round(now()->diffInMinutes($deal->expira_em)));
            $titulo = "⚡ {$deal->percentual}% OFF por tempo limitado";
            $mensagem = "{$deal->alvo_nome}" . ($deal->cidade ? " em {$deal->cidade}" : '') . ": só {$deal->quantidade} vaga(s) e a oferta acaba em " . $this->tempoLegivel($minutos) . '.';
            $dados = $deal->alvo_tipo === 'servico'
                ? ['rota' => '/src/screens/ExplorarDetalhes', 'id' => (string) $deal->alvo_id, 'tipo' => 'servicos', 'flash_deal_id' => $deal->id]
                : ['rota' => '/src/screens/ExplorarDetalhes', 'id' => (string) $deal->alvo_id, 'tipo' => 'reservas', 'flash_deal_id' => $deal->id];

            // Expo aceita até 100 mensagens por requisição.
            $candidatos->filter(fn (User $u) => !empty($u->expo_push_token))->chunk(100)->each(function ($lote) use ($titulo, $mensagem, $dados) {
                Http::timeout(10)->post('https://exp.host/--/api/v2/push/send', $lote->map(fn (User $u) => [
                    'to' => $u->expo_push_token, 'sound' => 'default', 'title' => $titulo, 'body' => $mensagem,
                    'data' => $dados, 'priority' => 'high',
                ])->values()->all());
            });
        } catch (\Throwable $e) {
            // O deal continua valendo mesmo se o envio falhar; o cliente ainda o encontra no app.
            Log::warning('Flash Deal: falha ao avisar clientes: ' . $e->getMessage());
        }
    }

    /** @return array{0: ItemAluguel|Servico, 1: array} */
    private function alvoAutorizado(User $user, string $tipo, int $id): array
    {
        $admin = strtolower((string) $user->papel) === 'admin';

        if ($tipo === 'item_aluguel') {
            $item = ItemAluguel::catalogo()->find($id);
            abort_unless($item && ($admin || (int) $item->estabelecimento_id === (int) $user->id), 404, 'Item não encontrado.');

            return [$item, ['cidade' => $item->cidade, 'estado' => $this->uf($item->estado), 'latitude' => $this->num($item->latitude), 'longitude' => $this->num($item->longitude)]];
        }

        if ($tipo === 'servico') {
            $servico = Servico::find($id);
            abort_unless($servico && ($admin || $this->locaisDeGestao($user)->contains((int) $servico->estabelecimento_id)), 404, 'Serviço não encontrado.');
            $local = Estabelecimento::find($servico->estabelecimento_id);

            return [$servico, ['cidade' => $local?->cidade, 'estado' => $this->uf($local?->estado), 'latitude' => $this->num($local?->latitude), 'longitude' => $this->num($local?->longitude)]];
        }

        throw ValidationException::withMessages(['alvo_tipo' => 'Escolha um item de reserva ou um serviço.']);
    }

    private function modeloDoAlvo(string $tipo, int $id): ItemAluguel|Servico|null
    {
        return $tipo === 'servico' ? Servico::find($id) : ItemAluguel::find($id);
    }

    private function locaisDeGestao(User $user): Collection
    {
        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->whereIn('tipo', self::PAPEIS_GESTAO)
            ->pluck('estabelecimento_id')
            ->map(fn ($id) => (int) $id);
    }

    private function estaPerto(FlashDeal $deal, ?float $lat, ?float $lng, ?string $cidade): bool
    {
        if ($deal->latitude !== null && $deal->longitude !== null && $lat !== null && $lng !== null) {
            return $this->distanciaKm($lat, $lng, $deal->latitude, $deal->longitude) <= $deal->raio_km;
        }

        return $deal->cidade && $cidade && $this->normalizar($deal->cidade) === $this->normalizar($cidade);
    }

    private function paraPainel(FlashDeal $d): array
    {
        return [
            'id' => $d->id,
            'alvo_tipo' => $d->alvo_tipo,
            'alvo_id' => $d->alvo_id,
            'alvo_nome' => $d->alvo_nome,
            'percentual' => $d->percentual,
            'quantidade' => $d->quantidade,
            'usados' => $d->usados,
            'cidade' => $d->cidade,
            'status' => $d->status,
            'inicia_em' => $d->inicia_em?->toIso8601String(),
            'expira_em' => $d->expira_em?->toIso8601String(),
            'notificados' => $d->notificados,
            'clicados' => (int) ($d->clicados ?? 0),
        ];
    }

    private function paraCliente(FlashDeal $d, ?float $lat, ?float $lng): array
    {
        $alvo = $this->modeloDoAlvo($d->alvo_tipo, $d->alvo_id);
        $original = $alvo instanceof ItemAluguel ? (float) ($alvo->valor_diaria ?: $alvo->valor) : (float) ($alvo?->valor ?? 0);

        return [
            'id' => $d->id,
            'alvo_tipo' => $d->alvo_tipo,
            'alvo_id' => $d->alvo_id,
            'nome' => $d->alvo_nome,
            'percentual' => $d->percentual,
            'valor_original' => round($original, 2),
            'valor_com_desconto' => round($original * (1 - $d->percentual / 100), 2),
            'restantes' => max(0, $d->quantidade - $d->usados),
            'cidade' => $d->cidade,
            'expira_em' => $d->expira_em->toIso8601String(),
            'distancia_km' => ($lat !== null && $lng !== null && $d->latitude !== null && $d->longitude !== null)
                ? round($this->distanciaKm($lat, $lng, $d->latitude, $d->longitude), 1) : null,
            'foto' => $this->foto($alvo),
        ];
    }

    private function foto(ItemAluguel|Servico|null $alvo): ?string
    {
        $fotos = $alvo?->fotos;
        $lista = is_array($fotos) ? $fotos : (json_decode((string) $fotos, true) ?: []);
        $primeira = $lista[0] ?? null;
        if (!is_string($primeira) || $primeira === '') {
            return null;
        }

        return str_starts_with($primeira, 'http') ? $primeira : asset('storage/' . ltrim($primeira, '/'));
    }

    private function tempoLegivel(int $minutos): string
    {
        if ($minutos < 60) {
            return "{$minutos} min";
        }
        $h = intdiv($minutos, 60);
        $m = $minutos % 60;

        return $m ? "{$h}h{$m}" : "{$h}h";
    }

    private function uf(?string $estado): ?string
    {
        return $estado ? mb_substr(strtoupper(trim($estado)), 0, 2) : null;
    }

    private function num($valor): ?float
    {
        return $valor !== null && $valor !== '' ? (float) $valor : null;
    }

    private function normalizar(string $texto): string
    {
        return strtr(mb_strtolower(trim($texto)), ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c']);
    }

    private function distanciaKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
