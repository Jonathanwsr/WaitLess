<?php

namespace App\Services;

use App\Models\Estabelecimento;
use App\Models\OfertaFavoritos;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Resultados para o sócio:
 * - ofertas enviadas por mensagem: quantos leram, usaram o cupom e reservaram depois (e quanto isso rendeu);
 * - produtos adicionais vendidos junto com serviços e reservas.
 */
class ResultadosSocioService
{
    /** Uma reserva conta como resultado da oferta se foi feita até N dias depois do envio. */
    public const JANELA_DIAS = 14;

    private const STATUS_IGNORADOS = ['cancelado', 'cancelada', 'recusado', 'estornado'];

    /** @return array{destinatarios:int, leram:int, usaram_cupom:int, reservaram:int, receita:float, conversao:float, janela_dias:int, encerrada:bool} */
    public function daOferta(OfertaFavoritos $oferta): array
    {
        $clientes = DB::table('mensagens')
            ->join('conversas', 'conversas.id', '=', 'mensagens.conversa_id')
            ->where('mensagens.oferta_id', $oferta->id)
            ->select('conversas.usuario_id', 'mensagens.lida_em')
            ->get();
        $ids = $clientes->pluck('usuario_id')->unique()->values();
        $inicio = Carbon::parse($oferta->created_at);
        $fim = $inicio->copy()->addDays(self::JANELA_DIAS);

        $reservas = $this->reservasNoLocal($oferta->estabelecimento_id, $ids, $inicio, $fim);
        $reservaram = $reservas->pluck('usuario_id')->unique();

        $usaramCupom = collect();
        if ($oferta->cupom_id && $ids->isNotEmpty()) {
            $usaramCupom = $reservas->where('cupom_id', $oferta->cupom_id)->pluck('usuario_id')
                ->merge(DB::table('cupom_user')->where('cupom_id', $oferta->cupom_id)->whereIn('user_id', $ids)->where('usado', true)
                    ->where('updated_at', '>=', $inicio)->pluck('user_id'))
                ->unique();
        }

        $destinatarios = max((int) $oferta->destinatarios, $ids->count());

        return [
            'destinatarios' => $destinatarios,
            'leram' => $clientes->whereNotNull('lida_em')->pluck('usuario_id')->unique()->count(),
            'usaram_cupom' => $usaramCupom->count(),
            'reservaram' => $reservaram->count(),
            'receita' => round((float) $reservas->sum('valor'), 2),
            'conversao' => $destinatarios ? round($reservaram->count() / $destinatarios * 100, 1) : 0.0,
            'janela_dias' => self::JANELA_DIAS,
            'encerrada' => now()->gt($fim),
        ];
    }

    /** Totais das ofertas do local nos últimos N dias. */
    public function resumoOfertas(Estabelecimento $local, int $dias = 90): array
    {
        $ofertas = OfertaFavoritos::where('estabelecimento_id', $local->id)->where('created_at', '>=', now()->subDays($dias))->get();
        $res = $ofertas->map(fn ($o) => $this->daOferta($o));
        $enviadas = (int) $res->sum('destinatarios');

        return [
            'dias' => $dias,
            'ofertas' => $ofertas->count(),
            'destinatarios' => $enviadas,
            'leram' => (int) $res->sum('leram'),
            'usaram_cupom' => (int) $res->sum('usaram_cupom'),
            'reservaram' => (int) $res->sum('reservaram'),
            'receita' => round((float) $res->sum('receita'), 2),
            'conversao' => $enviadas ? round($res->sum('reservaram') / $enviadas * 100, 1) : 0.0,
        ];
    }

    /** Agendamentos e reservas feitos no local pelos clientes informados, dentro do período. */
    private function reservasNoLocal(int $localId, Collection $clientes, Carbon $inicio, Carbon $fim): Collection
    {
        if ($clientes->isEmpty()) {
            return collect();
        }

        $agendamentos = DB::table('agendamentos')
            ->where('estabelecimento_id', $localId)
            ->whereIn('usuario_id', $clientes)
            ->whereBetween('created_at', [$inicio, $fim])
            ->whereNotIn('status', self::STATUS_IGNORADOS)
            ->get(['usuario_id', 'cupom_id', 'valor_final as valor']);

        // Reservas: itens do local ou reservas avulsas dos donos/sócios do local.
        $equipe = DB::table('estabelecimento_usuario')->where('estabelecimento_id', $localId)->pluck('usuario_id');
        $alugueis = DB::table('alugueis')
            ->leftJoin('itens_aluguel', 'itens_aluguel.id', '=', 'alugueis.item_aluguel_id')
            ->where(fn ($q) => $q->where('itens_aluguel.local_id', $localId)->orWhereIn('alugueis.estabelecimento_id', $equipe))
            ->whereIn('alugueis.locatario_id', $clientes)
            ->whereBetween('alugueis.created_at', [$inicio, $fim])
            ->whereNotIn('alugueis.status', self::STATUS_IGNORADOS)
            ->whereNull('alugueis.deleted_at')
            ->get(['alugueis.locatario_id as usuario_id', 'alugueis.cupom_id', 'alugueis.valor_total as valor']);

        return $agendamentos->concat($alugueis);
    }

    /**
     * Adicionais vendidos (produtos escolhidos junto com um serviço ou uma reserva) dos produtos que o usuário gerencia.
     * Pedidos cancelados não entram.
     */
    public function adicionaisVendidos(User $user, int $dias = 30): array
    {
        $locais = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->pluck('estabelecimento_id');
        $produtos = DB::table('produtos')
            ->where(fn ($q) => $q->whereIn('estabelecimento_id', $locais)->orWhere('usuario_id', $user->id))
            ->pluck('id');
        $desde = now()->subDays($dias)->startOfDay();

        $linhas = DB::table('itens_aluguel as v')
            ->leftJoin('agendamentos as ag', 'ag.id', '=', 'v.agendamento_id')
            ->leftJoin('alugueis as al', 'al.id', '=', 'v.aluguel_id')
            ->where('v.categoria', 'produto_extra')
            ->whereIn('v.produto_id', $produtos)
            ->where('v.created_at', '>=', $desde)
            ->where(fn ($q) => $q->whereNotNull('v.agendamento_id')->orWhereNotNull('v.aluguel_id'))
            ->where(fn ($q) => $q->whereNull('ag.id')->orWhereNotIn('ag.status', self::STATUS_IGNORADOS))
            ->where(fn ($q) => $q->whereNull('al.id')->orWhereNotIn('al.status', self::STATUS_IGNORADOS))
            ->get(['v.produto_id', 'v.nome', 'v.quantidade', 'v.valor_diaria', 'v.agendamento_id', 'v.aluguel_id', 'v.created_at']);

        $porProduto = $linhas->groupBy('produto_id')->map(function ($grupo) {
            return [
                'produto_id' => (int) $grupo->first()->produto_id,
                'nome' => $grupo->first()->nome,
                'quantidade' => (int) $grupo->sum('quantidade'),
                'receita' => round($grupo->sum(fn ($l) => (float) $l->valor_diaria * (int) $l->quantidade), 2),
                'pedidos' => $grupo->count(),
            ];
        })->sortByDesc('receita')->values();

        $receita = round($linhas->sum(fn ($l) => (float) $l->valor_diaria * (int) $l->quantidade), 2);
        $pedidos = $linhas->map(fn ($l) => $l->agendamento_id ? 'ag' . $l->agendamento_id : 'al' . $l->aluguel_id)->unique()->count();

        return [
            'dias' => $dias,
            'unidades' => (int) $linhas->sum('quantidade'),
            'receita' => $receita,
            'pedidos_com_adicional' => $pedidos,
            'ticket_medio_adicionais' => $pedidos ? round($receita / $pedidos, 2) : 0.0,
            'em_servicos' => round($linhas->whereNotNull('agendamento_id')->sum(fn ($l) => (float) $l->valor_diaria * (int) $l->quantidade), 2),
            'em_reservas' => round($linhas->whereNotNull('aluguel_id')->sum(fn ($l) => (float) $l->valor_diaria * (int) $l->quantidade), 2),
            'produtos' => $porProduto->take(10)->all(),
        ];
    }
}
