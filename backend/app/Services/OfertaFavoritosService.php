<?php

namespace App\Services;

use App\Events\MensagemEnviada;
use App\Models\Conversa;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use App\Models\Mensagem;
use App\Models\OfertaFavoritos;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Ofertas Exclusivas via Mensagem: o local envia um comunicado (com ou sem cupom) para quem favoritou
 * o local, um serviço dele ou uma reserva dele. Cada cliente recebe na conversa com o local, o cupom já
 * fica liberado na carteira dele (sem gastar pontos) e chega um aviso no celular.
 */
class OfertaFavoritosService
{
    /** Evita que a oferta vire spam para quem favoritou. */
    public const LIMITE_POR_DIA = 3;
    public const MAX_DESTINATARIOS = 2000;

    public function __construct(private NotificacaoService $notificacoes) {}

    /** Quem pode enviar: sócio, proprietário, gerente ou admin do local (e o admin da plataforma). */
    public function podeEnviar(User $user, Estabelecimento $local): bool
    {
        return $user->papel === 'admin' || DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $local->id)
            ->where('usuario_id', $user->id)
            ->whereIn('tipo', ['socio', 'sócio', 'proprietario', 'proprietário', 'gerente', 'admin'])
            ->exists();
    }

    /** Clientes que favoritaram o local, um serviço dele ou uma reserva dele (sem a própria equipe). */
    public function publico(Estabelecimento $local): Collection
    {
        $servicos = DB::table('servicos')->where('estabelecimento_id', $local->id)->pluck('id');
        $equipe = DB::table('estabelecimento_usuario')->where('estabelecimento_id', $local->id)->pluck('usuario_id');
        $donos = DB::table('estabelecimento_usuario')->where('estabelecimento_id', $local->id)->whereIn('tipo', ['socio', 'proprietario'])->pluck('usuario_id');
        $itens = DB::table('itens_aluguel')->whereNull('deleted_at')
            ->where(fn ($q) => $q->where('local_id', $local->id)->orWhere(fn ($q) => $q->whereNull('local_id')->whereIn('estabelecimento_id', $donos)))
            ->pluck('id');

        return DB::table('favoritos')
            ->where(fn ($q) => $q->where('estabelecimento_id', $local->id)
                ->orWhereIn('servico_id', $servicos)
                ->orWhereIn('item_aluguel_id', $itens))
            ->whereNotIn('usuario_id', $equipe)
            ->distinct()
            ->pluck('usuario_id');
    }

    /** Cupons do local que ainda podem ser enviados. */
    public function cuponsDisponiveis(Estabelecimento $local): Collection
    {
        return Cupom::where('estabelecimento_id', $local->id)
            ->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('data_validade')->orWhereDate('data_validade', '>=', now()->toDateString()))
            ->latest()
            ->get(['id', 'codigo', 'titulo', 'tipo_desconto', 'valor_desconto', 'data_validade', 'apenas_plus']);
    }

    public function enviadasHoje(Estabelecimento $local): int
    {
        return OfertaFavoritos::where('estabelecimento_id', $local->id)->where('created_at', '>=', now()->startOfDay())->count();
    }

    /** @param array{titulo:string, mensagem:string, cupom_id?:?int} $dados */
    public function enviar(User $remetente, Estabelecimento $local, array $dados): OfertaFavoritos
    {
        if (!$this->podeEnviar($remetente, $local)) {
            abort(403, 'Só a equipe responsável pelo local pode enviar ofertas.');
        }
        if ($this->enviadasHoje($local) >= self::LIMITE_POR_DIA) {
            throw ValidationException::withMessages(['mensagem' => 'Você já enviou ' . self::LIMITE_POR_DIA . ' ofertas hoje para quem favoritou este local. Tente de novo amanhã — assim seus clientes não se cansam das mensagens.']);
        }

        $cupom = null;
        if (!empty($dados['cupom_id'])) {
            $cupom = $this->cuponsDisponiveis($local)->firstWhere('id', (int) $dados['cupom_id']);
            if (!$cupom) {
                throw ValidationException::withMessages(['cupom_id' => 'Escolha um cupom ativo deste local.']);
            }
        }

        $clientes = $this->publico($local)->take(self::MAX_DESTINATARIOS);
        if ($clientes->isEmpty()) {
            throw ValidationException::withMessages(['mensagem' => 'Ninguém favoritou este local ainda. Divulgue o seu link para ganhar seguidores.']);
        }

        $texto = trim($dados['titulo']) . "\n\n" . trim($dados['mensagem']) . ($cupom ? "\n\nCupom: {$cupom->codigo}" : '');

        $mensagens = [];
        $oferta = DB::transaction(function () use ($remetente, $local, $dados, $cupom, $clientes, $texto, &$mensagens) {
            $oferta = OfertaFavoritos::create([
                'estabelecimento_id' => $local->id,
                'enviada_por' => $remetente->id,
                'cupom_id' => $cupom?->id,
                'titulo' => trim($dados['titulo']),
                'mensagem' => trim($dados['mensagem']),
                'destinatarios' => $clientes->count(),
            ]);

            foreach ($clientes as $clienteId) {
                $conversa = Conversa::firstOrCreate([
                    'usuario_id' => $clienteId, 'estabelecimento_id' => $local->id,
                    'funcionario_id' => null, 'agendamento_id' => null, 'aluguel_id' => null,
                ]);
                $conversa->touch();
                $mensagens[] = Mensagem::create([
                    'conversa_id' => $conversa->id,
                    'remetente_id' => $remetente->id,
                    'tipo_remetente' => 'estabelecimento',
                    'tipo' => 'oferta',
                    'cupom_id' => $cupom?->id,
                    'oferta_id' => $oferta->id,
                    'conteudo' => $texto,
                ]);

                // Oferta exclusiva: o cupom já fica na carteira do cliente, sem custar pontos.
                if ($cupom) {
                    $jaTem = DB::table('cupom_user')->where('user_id', $clienteId)->where('cupom_id', $cupom->id)->exists();
                    if (!$jaTem) {
                        DB::table('cupom_user')->insert(['user_id' => $clienteId, 'cupom_id' => $cupom->id, 'usado' => false, 'created_at' => now(), 'updated_at' => now()]);
                    }
                }
            }

            return $oferta;
        });

        // Depois de gravar: tempo real e aviso no celular (falha aqui não desfaz o envio).
        foreach ($mensagens as $m) {
            try {
                event(new MensagemEnviada($m));
            } catch (\Throwable $e) {
                Log::info('Oferta: tempo real indisponível: ' . $e->getMessage());
            }
        }
        foreach (User::whereIn('id', $clientes)->whereNotNull('expo_push_token')->get() as $cliente) {
            try {
                $this->notificacoes->enviarPush($cliente, "Oferta exclusiva de {$local->nome}", trim($dados['titulo']) . ($cupom ? ' · cupom ' . $cupom->codigo : ''), ['tipo' => 'oferta_favoritos', 'rota' => '/mensagens']);
            } catch (\Throwable $e) {
                Log::info('Oferta: push não enviado: ' . $e->getMessage());
            }
        }

        return $oferta;
    }

    /** Cartão da oferta para o chat (web e app). Null para mensagens comuns. */
    public static function cartao(Mensagem $m, ?int $usuarioId = null): ?array
    {
        if ($m->tipo !== 'oferta') {
            return null;
        }
        $oferta = $m->relationLoaded('oferta') ? $m->oferta : $m->oferta()->first();
        $cupom = $m->relationLoaded('cupom') ? $m->cupom : $m->cupom()->first();
        $local = $oferta ? Estabelecimento::find($oferta->estabelecimento_id, ['id', 'nome']) : null;
        $valido = $cupom && $cupom->ativo && (!$cupom->data_validade || \Carbon\Carbon::parse($cupom->data_validade)->endOfDay()->isFuture());
        $usado = $cupom && $usuarioId ? (bool) DB::table('cupom_user')->where('user_id', $usuarioId)->where('cupom_id', $cupom->id)->value('usado') : false;

        return [
            'titulo' => $oferta?->titulo,
            'texto' => $oferta?->mensagem ?? $m->conteudo,
            'local' => $local ? ['id' => $local->id, 'nome' => $local->nome] : null,
            'cupom' => $cupom ? [
                'id' => $cupom->id,
                'codigo' => $cupom->codigo,
                'titulo' => $cupom->titulo,
                'desconto' => $cupom->tipo_desconto === 'percentual'
                    ? rtrim(rtrim(number_format((float) $cupom->valor_desconto, 2, ',', ''), '0'), ',') . '% de desconto'
                    : 'R$ ' . number_format((float) $cupom->valor_desconto, 2, ',', '.') . ' de desconto',
                'validade' => $cupom->data_validade ? \Carbon\Carbon::parse($cupom->data_validade)->format('d/m/Y') : null,
                'valido' => $valido,
                'usado' => $usado,
                'apenas_premium' => (bool) $cupom->apenas_plus,
            ] : null,
        ];
    }
}
