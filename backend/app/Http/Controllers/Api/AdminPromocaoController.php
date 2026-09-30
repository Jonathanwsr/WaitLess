<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promocao;
use App\Models\User;
use App\Services\ImageKitService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AdminPromocaoController extends Controller
{
    /** Planos válidos para "plano_necessario", combinando os catálogos de sócio e cliente. */
    private function planosValidos(): array
    {
        return array_unique(array_merge(
            array_keys(PlanoService::PLANOS_PREMIUM['socio']),
            array_keys(PlanoService::PLANOS_PREMIUM['user'])
        ));
    }

    public function index()
    {
        $promocoes = Promocao::with('criador:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($p) {
                $p->status_calculado = $p->status_calculado;
                return $p;
            });

        return Inertia::render('Admin/Promocoes', [
            'promocoes' => $promocoes,
            'planosValidos' => $this->planosValidos(),
        ]);
    }

    private function regrasValidacao(): array
    {
        return [
            'nome' => 'required|string|max:255',
            'descricao' => 'nullable|string|max:2000',
            'tipo' => 'required|in:pontos_todos,pontos_plano,oferta_assinantes,cupom',
            'quantidade_pontos' => 'nullable|integer|min:1|max:1000000',
            'cupom_id' => 'nullable|exists:cupons,id',
            'desconto_percentual' => 'nullable|numeric|min:0|max:100',
            'desconto_valor' => 'nullable|numeric|min:0',
            'publico_alvo' => 'required|in:todos,clientes,proprietarios',
            'plano_necessario' => 'nullable|string|in:' . implode(',', $this->planosValidos()),
            'data_inicio' => 'required|date',
            'data_fim' => 'nullable|date|after_or_equal:data_inicio',
            'limite_utilizacao' => 'nullable|integer|min:1',
            'ativo' => 'nullable|boolean',
            'condicoes' => 'nullable|string|max:2000',
            'imagem' => 'nullable|image|max:4096',
        ];
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->regrasValidacao());

        if ($request->hasFile('imagem')) {
            $validated['imagem'] = ImageKitService::upload($request->file('imagem'), '/waitless/promocoes');
        }

        $validated['criado_por'] = Auth::id();

        $promocao = Promocao::create($validated);

        return back()->with('success', "Promoção \"{$promocao->nome}\" criada com sucesso!");
    }

    public function update(Request $request, Promocao $promocao)
    {
        $validated = $request->validate($this->regrasValidacao());

        if ($request->hasFile('imagem')) {
            if ($promocao->imagem) {
                ImageKitService::delete($promocao->imagem);
            }
            $validated['imagem'] = ImageKitService::upload($request->file('imagem'), '/waitless/promocoes');
        }

        $promocao->update($validated);

        return back()->with('success', 'Promoção atualizada com sucesso!');
    }

    public function toggleAtivo(Promocao $promocao)
    {
        $promocao->update(['ativo' => !$promocao->ativo]);

        return back()->with('success', $promocao->ativo ? 'Promoção ativada!' : 'Promoção desativada!');
    }

    public function destroy(Promocao $promocao)
    {
        if ($promocao->imagem) {
            ImageKitService::delete($promocao->imagem);
        }
        $promocao->delete();

        return back()->with('success', 'Promoção removida.');
    }

    /**
     * Executa uma campanha de pontos ("pontos_todos" ou "pontos_plano"),
     * concedendo os pontos a cada usuário elegível e registrando cada
     * concessão no ledger (historico_pontos), vinculada à campanha. Só pode
     * rodar uma vez por campanha — a segunda tentativa é bloqueada pelo
     * campo executada_em, evitando duplicar pontos se o admin clicar de novo.
     */
    public function executar(Promocao $promocao)
    {
        if (!in_array($promocao->tipo, ['pontos_todos', 'pontos_plano'])) {
            return back()->with('error', 'Esse tipo de promoção não concede pontos automaticamente.');
        }

        if ($promocao->executada_em) {
            return back()->with('error', 'Esta campanha já foi executada em ' . $promocao->executada_em->format('d/m/Y H:i') . ' e não pode ser repetida.');
        }

        if (!$promocao->quantidade_pontos) {
            return back()->with('error', 'Defina a quantidade de pontos antes de executar a campanha.');
        }

        $query = User::query();

        if ($promocao->tipo === 'pontos_plano') {
            if (!$promocao->plano_necessario) {
                return back()->with('error', 'Defina o plano necessário para uma campanha de pontos por plano.');
            }
            $query->where('plano_assinatura', $promocao->plano_necessario);
        }

        if ($promocao->publico_alvo === 'clientes') {
            $query->where('papel', 'user');
        } elseif ($promocao->publico_alvo === 'proprietarios') {
            $query->whereIn('papel', ['socio', 'proprietario']);
        }

        $usuarios = $query->pluck('id');

        if ($usuarios->isEmpty()) {
            return back()->with('error', 'Nenhum usuário elegível foi encontrado para esta campanha.');
        }

        DB::transaction(function () use ($usuarios, $promocao) {
            $agora = now();
            $linhas = $usuarios->map(fn ($usuarioId) => [
                'usuario_id' => $usuarioId,
                'estabelecimento_id' => null,
                'agendamento_id' => null,
                'promocao_id' => $promocao->id,
                'tipo' => 'ganho',
                'descricao' => 'Campanha promocional: ' . $promocao->nome,
                'quantidade' => $promocao->quantidade_pontos,
                'created_at' => $agora,
            ])->all();

            // Insere o ledger em lote e só então soma o saldo de cada usuário
            // — evita 1 UPDATE por usuário numa campanha que pode alcançar
            // toda a base de clientes.
            foreach (array_chunk($linhas, 500) as $lote) {
                DB::table('historico_pontos')->insert($lote);
            }

            User::whereIn('id', $usuarios)->increment('pontos_saldo', $promocao->quantidade_pontos);

            $promocao->update([
                'executada_em' => $agora,
                'utilizacoes_atuais' => $usuarios->count(),
            ]);
        });

        return back()->with('success', "Campanha executada! {$usuarios->count()} usuário(s) receberam {$promocao->quantidade_pontos} pontos.");
    }
}
