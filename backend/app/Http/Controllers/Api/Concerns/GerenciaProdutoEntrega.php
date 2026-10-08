<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Services\HiveAiService;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Lógica compartilhada entre o controller web e o mobile de "Produtos para
 * Entrega" (validação, limite de 3 fotos com moderação/upload e limpeza no
 * ImageKit) — mesma ideia da trait GerenciaLocacaoAvulsa, pra não duplicar
 * regra nos dois lugares.
 */
trait GerenciaProdutoEntrega
{
    private function garantirPapelPermitidoEntrega(): void
    {
        $papel = mb_strtolower((string) Auth::user()->papel);
        if (!in_array($papel, ['socio', 'sócio', 'proprietario', 'proprietário', 'admin'], true)) {
            abort(403, 'Apenas sócios/proprietários podem cadastrar produtos para entrega.');
        }
    }

    private function validarDadosProdutoEntrega(Request $request): array
    {
        return $request->validate([
            'nome' => 'required|string|max:255',
            'descricao' => 'nullable|string|max:2000',
            'categoria' => 'required|string|in:' . implode(',', config('produtos.categorias_entrega')),
            'marca' => 'nullable|string|max:80',
            'unidade_medida' => 'nullable|string|in:' . implode(',', config('produtos.unidades_medida')),
            'peso_volume' => 'nullable|string|max:40',
            'sku' => 'nullable|string|max:60',
            'tags' => 'nullable|string|max:300',
            'quantidade_minima' => 'nullable|integer|min:1|max:50',
            'aceita_entrega' => 'nullable|boolean',
            'aceita_retirada' => 'nullable|boolean',
            'valor' => 'required|numeric|min:0',
            'tem_promocao' => 'nullable|boolean',
            'valor_promocional' => 'nullable|numeric|min:0|lt:valor',
            'taxa_entrega' => 'nullable|numeric|min:0',
            'estoque_disponivel' => 'nullable|integer|min:0',
            'ativo' => 'nullable|boolean',
            'estabelecimento_id' => 'nullable|integer|exists:estabelecimentos,id',

            'endereco_cep' => 'required|string|max:10',
            'endereco_rua' => 'required|string|max:255',
            'endereco_numero' => 'required|string|max:20',
            'endereco_complemento' => 'nullable|string|max:100',
            'endereco_bairro' => 'required|string|max:100',
            'endereco_cidade' => 'required|string|max:100',
            'endereco_estado' => 'required|string|size:2',
            'endereco_latitude' => 'nullable|numeric',
            'endereco_longitude' => 'nullable|numeric',

            'fotos_mantidas' => 'nullable|array|max:3',
            'fotos_mantidas.*' => 'string',
        ]);
    }

    private function normalizarCamposProdutoEntrega(array $dados): array
    {
        if (array_key_exists('tags', $dados)) {
            $dados['tags'] = array_values(array_filter(array_map('trim', explode(',', (string) $dados['tags']))));
        }

        foreach (['aceita_entrega', 'aceita_retirada', 'tem_promocao', 'ativo'] as $flag) {
            if (array_key_exists($flag, $dados)) {
                $dados[$flag] = (bool) $dados[$flag];
            }
        }

        if (($dados['aceita_entrega'] ?? true) === false && ($dados['aceita_retirada'] ?? true) === false) {
            abort(422, 'Escolha pelo menos uma forma de recebimento: entrega ou retirada.');
        }

        return $dados;
    }

    /**
     * Garante que, se um `estabelecimento_id` foi informado, ele realmente
     * pertence ao sócio autenticado — nunca vincula a produto a um local de
     * outra pessoa.
     */
    private function garantirEstabelecimentoPertenceAoUsuario(?int $estabelecimentoId): void
    {
        if (!$estabelecimentoId) {
            return;
        }

        $pertence = \DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $estabelecimentoId)
            ->where('usuario_id', Auth::id())
            ->exists();

        if (!$pertence) {
            abort(403, 'Este local não pertence a você.');
        }
    }

    /**
     * Processa o upload de novas fotos (até 3) e mescla com as fotos
     * existentes que o sócio optou por manter. Fotos antigas removidas são
     * apagadas do ImageKit.
     */
    private function processarFotosProdutoEntrega(Request $request, array $fotosAtuais): array
    {
        $fotosMantidas = $request->input('fotos_mantidas');
        if (is_string($fotosMantidas)) {
            $fotosMantidas = json_decode($fotosMantidas, true) ?? [];
        }
        $fotosMantidas = array_values(array_intersect($fotosAtuais, $fotosMantidas ?? $fotosAtuais));

        $fotosRemovidas = array_diff($fotosAtuais, $fotosMantidas);
        if (!empty($fotosRemovidas)) {
            ImageKitService::deleteMany(array_values($fotosRemovidas));
        }

        $novasFotos = $request->hasFile('fotos') ? $request->file('fotos') : [];

        if (count($fotosMantidas) + count($novasFotos) > 3) {
            abort(400, 'Você pode ter no máximo 3 fotos por produto.');
        }

        $caminhosNovos = [];
        foreach ($novasFotos as $foto) {
            if (!HiveAiService::isSafe($foto)) {
                abort(400, 'Uma das imagens enviadas violou nossos termos de uso (conteúdo inadequado detectado).');
            }
            $caminhosNovos[] = ImageKitService::upload($foto, '/produtos_entrega');
        }

        return array_values(array_merge($fotosMantidas, $caminhosNovos));
    }
}
