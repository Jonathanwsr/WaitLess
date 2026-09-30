<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Services\CupomService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ClienteCupomController extends Controller
{
    /**
     * MÁGICA 1: TELA DE RECOMPENSAS E SUGESTÕES DO CLIENTE
     */
    public function recompensas()
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

        return Inertia::render('Cliente/Recompensas', [
            'meusCupons' => $meusCupons,
            'sugestoesLojas' => $sugestoesLojas,
            'pontosAtuais' => $user->pontos_saldo,
            'indicacao' => app(\App\Services\IndicacaoService::class)->resumo($user),
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

        if ($cupom->apenas_plus && !$user->isPremium()) {
            return back()->with('error', 'Este cupom é exclusivo para assinantes premium.');
        }

        if ($mensagem = app(\App\Services\CupomService::class)->motivoDeInelegibilidade($cupom, $user)) {
            return back()->with('error', $mensagem);
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

    /**
     * Valida (sem consumir) um código de cupom digitado no checkout — usado
     * pela tela de "Agendar" pra mostrar o desconto antes de confirmar a
     * reserva. O cupom só é de fato marcado como usado quando a reserva é
     * criada (ClienteAgendamentoController::store / AgendamentoController::storeAluguel).
     */
    public function validar(Request $request, CupomService $cupomService)
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:60',
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id',
            'servico_id' => 'nullable|integer',
            'item_aluguel_id' => 'nullable|integer',
        ]);

        try {
            $cupom = $cupomService->buscarValidoParaUsuario($validated['codigo'], Auth::user(), $validated['estabelecimento_id'] ?? null, $validated['servico_id'] ?? null, $validated['item_aluguel_id'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->collapse()->first() ?? 'Cupom inválido.'], 422);
        }

        return response()->json([
            'cupom' => [
                'codigo' => $cupom->codigo,
                'titulo' => $cupom->titulo,
                'tipo_desconto' => $cupom->tipo_desconto,
                'valor_desconto' => $cupom->valor_desconto,
            ],
        ]);
    }
}