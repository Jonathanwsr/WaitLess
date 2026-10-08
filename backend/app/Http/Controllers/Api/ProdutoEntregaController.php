<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\GerenciaProdutoEntrega;
use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * CRUD do sócio para "Produtos para Entrega" — um módulo novo e independente
 * dos Produtos já existentes (que só servem de extra vinculado a um
 * agendamento/aluguel). Um produto de entrega é vendido à parte, pode ou não
 * estar vinculado a um Estabelecimento já cadastrado (opcional, à escolha do
 * sócio), e sempre tem seu próprio endereço de origem.
 */
class ProdutoEntregaController extends Controller
{
    use GerenciaProdutoEntrega;

    /** A gestão de produtos para entrega agora fica na tela única "Meus produtos", aba Entrega. */
    public function index()
    {
        $this->garantirPapelPermitidoEntrega();

        return redirect()->route('produtos.meus', ['aba' => 'entrega']);
    }

    /** Dados da aba "Entrega e retirada" da tela única de produtos. */
    public function dadosDaTela(): array
    {
        $produtos = ProdutoEntrega::with('estabelecimento:id,nome')
            ->where('usuario_id', Auth::id())
            ->orderByDesc('created_at')
            ->get();

        $estabelecimentos = DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimentos.id', '=', 'estabelecimento_usuario.estabelecimento_id')
            ->where('estabelecimento_usuario.usuario_id', Auth::id())
            ->select('estabelecimentos.id', 'estabelecimentos.nome')
            ->get();

        $funcionarios = Funcionario::whereIn('estabelecimento_id', $estabelecimentos->pluck('id'))
            ->where('ativo', true)
            ->select('id', 'estabelecimento_id', 'nome')
            ->get();

        $pedidosRecebidos = PedidoEntrega::with(['produto:id,nome,fotos', 'cliente:id,name,mobile_phone', 'estabelecimento:id,nome', 'funcionario:id,nome'])
            ->where('vendedor_id', Auth::id())
            ->orderByDesc('created_at')
            ->get();

        return [
            'produtos' => $produtos,
            'estabelecimentos' => $estabelecimentos,
            'funcionarios' => $funcionarios,
            'pedidosRecebidos' => $pedidosRecebidos,
        ];
    }

    public function store(Request $request)
    {
        $this->garantirPapelPermitidoEntrega();

        $dados = $this->normalizarCamposProdutoEntrega($this->validarDadosProdutoEntrega($request));
        $this->garantirEstabelecimentoPertenceAoUsuario($dados['estabelecimento_id'] ?? null);

        $dados['fotos'] = $this->processarFotosProdutoEntrega($request, []);
        $dados['usuario_id'] = Auth::id();

        ProdutoEntrega::create($dados);

        return back()->with('success', 'Produto para entrega cadastrado com sucesso!');
    }

    public function update(Request $request, ProdutoEntrega $produtoEntrega)
    {
        $this->garantirPapelPermitidoEntrega();

        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        $dados = $this->normalizarCamposProdutoEntrega($this->validarDadosProdutoEntrega($request));
        $this->garantirEstabelecimentoPertenceAoUsuario($dados['estabelecimento_id'] ?? null);

        $dados['fotos'] = $this->processarFotosProdutoEntrega($request, $produtoEntrega->fotos ?? []);

        $produtoEntrega->update($dados);

        return back()->with('success', 'Produto atualizado com sucesso!');
    }

    /** Vincula o produto a um local do próprio sócio, ou o deixa avulso (estabelecimento_id nulo). */
    public function vincularLocal(Request $request, ProdutoEntrega $produtoEntrega)
    {
        $this->garantirPapelPermitidoEntrega();

        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        $validated = $request->validate(['estabelecimento_id' => 'nullable|integer|exists:estabelecimentos,id']);
        $this->garantirEstabelecimentoPertenceAoUsuario($validated['estabelecimento_id'] ?? null);

        $produtoEntrega->update(['estabelecimento_id' => $validated['estabelecimento_id'] ?? null]);

        return back()->with('success', $produtoEntrega->estabelecimento_id ? 'Produto vinculado ao local.' : 'Produto agora é avulso.');
    }

    public function toggleAtivo(ProdutoEntrega $produtoEntrega)
    {
        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        $produtoEntrega->update(['ativo' => !$produtoEntrega->ativo]);

        return back()->with('success', $produtoEntrega->ativo ? 'Produto ativado!' : 'Produto desativado!');
    }

    public function destroy(ProdutoEntrega $produtoEntrega)
    {
        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        if ($produtoEntrega->pedidos()->whereNotIn('status', ['cancelado', 'estornado'])->exists()) {
            return back()->with('error', 'Este produto tem pedidos em andamento e não pode ser removido. Desative-o em vez de excluir.');
        }

        \App\Services\ImageKitService::deleteMany($produtoEntrega->fotos ?? []);
        $produtoEntrega->delete();

        return back()->with('success', 'Produto removido.');
    }
}
