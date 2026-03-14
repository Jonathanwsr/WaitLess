<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ClienteCupomController extends Controller
{
    /**
     * MÁGICA 1: TELA DE MENSAGENS E SUGESTÕES DO CLIENTE
     */
    public function mensagens()
    {
        $user = Auth::user();

        // 1. Puxa os cupons que o cliente já resgatou e ainda não usou
        $meusCupons = $user->cupons()->wherePivot('usado', false)->with('estabelecimento')->get();

        // 2. Lógica de Sugestões baseada no Histórico
        // Pega os IDs dos serviços que ele mais agendou no passado (para recomendar de novo)
        // 👉 CORREÇÃO AQUI: Mudamos 'user_id' para 'usuario_id' para bater com a sua tabela!
        $servicosFrequentesIds = Agendamento::where('usuario_id', $user->id)
            ->where('status', 'concluido')
            ->select('servico_id')
            ->groupBy('servico_id')
            ->orderByRaw('COUNT(*) DESC')
            ->take(3)
            ->pluck('servico_id');

        // Busca estabelecimentos que têm cupons ativos e que o cliente tem pontos para comprar
        $sugestoesLojas = Estabelecimento::whereHas('cupons', function($query) use ($user) {
            $query->where('ativo', true)
                  ->where('pontos_custo', '<=', $user->pontos_saldo);
        })->with(['cupons' => function($q) {
            $q->where('ativo', true);
        }])->take(4)->get();

        return Inertia::render('Cliente/Mensagens', [
            'meusCupons' => $meusCupons,
            'sugestoesLojas' => $sugestoesLojas,
            'pontosAtuais' => $user->pontos_saldo
        ]);
    }

    /**
     * MÁGICA 2: O RESGATE DO CUPOM (Deduz pontos e guarda na carteira)
     */
    public function resgatar(Request $request, $id)
    {
        $user = Auth::user();
        $cupom = Cupom::findOrFail($id);

        // 1. Verificações de Segurança
        if (!$cupom->ativo) {
            return back()->with('error', 'Este cupom não está mais ativo.');
        }

        if ($cupom->apenas_plus && $user->plano_assinatura !== 'plus') {
            return back()->with('error', 'Este cupom é exclusivo para assinantes WaitLess Plus.');
        }

        if ($user->pontos_saldo < $cupom->pontos_custo) {
            return back()->with('error', 'Você não tem pontos suficientes para resgatar este cupom.');
        }

        // Verifica se o cliente já tem este cupom na carteira e ainda não o usou (evita acumular o mesmo cupom)
        $jaPossui = $user->cupons()->where('cupom_id', $cupom->id)->wherePivot('usado', false)->exists();
        if ($jaPossui) {
            return back()->with('warning', 'Você já tem este cupom no seu inventário! Use-o primeiro antes de resgatar outro igual.');
        }

        try {
            // 2. Cobra os pontos do cliente (Apenas se não for grátis)
            if ($cupom->pontos_custo > 0) {
                $user->decrement('pontos_saldo', $cupom->pontos_custo);
            }

            // 3. Adiciona o cupom à tabela cupom_user (Inventário)
            $user->cupons()->attach($cupom->id, ['usado' => false]);

            return back()->with('success', 'Cupom resgatado com sucesso! Ele já está no seu inventário pronto para uso.');

        } catch (\Exception $e) {
            return back()->with('error', 'Erro ao processar o resgate. Tente novamente.');
        }
    }
}