<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Api\Concerns\GerenciaProdutoEntrega;
use App\Http\Controllers\Controller;
use App\Models\ProdutoEntrega;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Espelha ProdutoEntregaController (web) — mesma regra, só que devolvendo
 * JSON em vez de Inertia.
 */
class ProdutoEntregaMobileController extends Controller
{
    use GerenciaProdutoEntrega;

    public function index(Request $request)
    {
        $this->garantirPapelPermitidoEntrega();

        $produtos = ProdutoEntrega::with('estabelecimento:id,nome')
            ->where('usuario_id', Auth::id())
            ->orderByDesc('created_at')
            ->get();

        $estabelecimentos = DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimentos.id', '=', 'estabelecimento_usuario.estabelecimento_id')
            ->where('estabelecimento_usuario.usuario_id', Auth::id())
            ->select('estabelecimentos.id', 'estabelecimentos.nome')
            ->get();

        return response()->json([
            'produtos' => $produtos,
            'estabelecimentos' => $estabelecimentos,
            'categorias' => config('produtos.categorias_entrega'),
            'unidades' => config('produtos.unidades_medida'),
        ]);
    }

    public function vincularLocal(Request $request, ProdutoEntrega $produtoEntrega)
    {
        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        $validated = $request->validate(['estabelecimento_id' => 'nullable|integer|exists:estabelecimentos,id']);
        $this->garantirEstabelecimentoPertenceAoUsuario($validated['estabelecimento_id'] ?? null);

        $produtoEntrega->update(['estabelecimento_id' => $validated['estabelecimento_id'] ?? null]);

        return response()->json(['message' => $produtoEntrega->estabelecimento_id ? 'Produto vinculado ao local.' : 'Produto agora é avulso.', 'produto' => $produtoEntrega->fresh()]);
    }

    public function store(Request $request)
    {
        $this->garantirPapelPermitidoEntrega();

        $dados = $this->normalizarCamposProdutoEntrega($this->validarDadosProdutoEntrega($request));
        $this->garantirEstabelecimentoPertenceAoUsuario($dados['estabelecimento_id'] ?? null);

        $dados['fotos'] = $this->processarFotosProdutoEntrega($request, []);
        $dados['usuario_id'] = Auth::id();

        $produto = ProdutoEntrega::create($dados);

        return response()->json(['message' => 'Produto para entrega cadastrado com sucesso!', 'produto' => $produto], 201);
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

        return response()->json(['message' => 'Produto atualizado com sucesso!', 'produto' => $produtoEntrega->fresh()]);
    }

    public function toggleAtivo(ProdutoEntrega $produtoEntrega)
    {
        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        $produtoEntrega->update(['ativo' => !$produtoEntrega->ativo]);

        return response()->json(['message' => $produtoEntrega->ativo ? 'Produto ativado!' : 'Produto desativado!', 'produto' => $produtoEntrega]);
    }

    public function destroy(ProdutoEntrega $produtoEntrega)
    {
        if ((int) $produtoEntrega->usuario_id !== (int) Auth::id()) {
            abort(403, 'Este produto não pertence a você.');
        }

        if ($produtoEntrega->pedidos()->whereNotIn('status', ['cancelado', 'estornado'])->exists()) {
            return response()->json(['error' => 'Este produto tem pedidos em andamento e não pode ser removido. Desative-o em vez de excluir.'], 422);
        }

        ImageKitService::deleteMany($produtoEntrega->fotos ?? []);
        $produtoEntrega->delete();

        return response()->json(['message' => 'Produto removido.']);
    }
}
