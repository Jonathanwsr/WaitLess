<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\ItemAluguel;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Lógica compartilhada entre o controller web e o mobile de "Locações
 * Avulsas" (validação, upload/moderação/limite de fotos e limpeza no
 * ImageKit) para não duplicar as mesmas regras nos dois lugares.
 */
trait GerenciaLocacaoAvulsa
{
    private function garantirPapelPermitido(): void
    {
        $papel = mb_strtolower((string) Auth::user()->papel);
        if (!in_array($papel, ['socio', 'sócio', 'proprietario', 'proprietário', 'admin'], true)) {
            abort(403, 'Apenas sócios/proprietários podem gerenciar locações avulsas.');
        }
    }

    private function validarDadosLocacaoAvulsa(Request $request): array
    {
        $dados = $request->validate([
            'nome'                     => 'required|string|max:255',
            'categoria'                => 'required|string|max:100',
            'descricao'                => 'nullable|string',
            'valor_diaria'             => 'required|numeric|min:0',
            'valor_semanal'            => 'nullable|numeric|min:0',
            'valor_mensal'             => 'nullable|numeric|min:0',
            'valor_caucao'             => 'nullable|numeric|min:0',
            'quantidade'               => 'nullable|integer|min:1',
            'somente_premium'          => 'nullable|boolean',
            'tem_promocao'             => 'nullable|boolean',
            'tipo_desconto'            => 'nullable|string|in:percentual,fixo',
            'valor_desconto'           => 'nullable|numeric|min:0',
            'aceita_pontos'            => 'nullable|boolean',
            'maximo_pontos_permitidos' => 'nullable|integer|min:0',
            'ativo'                    => 'nullable|boolean',
            'local_retirada'           => 'nullable|string|max:500',
            'local_entrega'            => 'nullable|string|max:500',
            'horario_retirada'         => 'nullable|date_format:H:i',
            'horario_entrega'          => 'nullable|date_format:H:i',
            'informacoes_extras'       => 'nullable|string',
            'fotos_mantidas'           => 'nullable|array',
            'fotos_mantidas.*'         => 'string',

            // Capacidade e preço por pessoa (ver App\Services\PrecificacaoService)
            'capacidade_pessoas'       => 'nullable|integer|min:1|max:200',
            'modelo_precificacao'      => 'nullable|in:pacote,por_pessoa',
            'pessoas_incluidas'        => 'nullable|integer|min:1',
            'valor_pessoa_extra'       => 'nullable|numeric|min:0',

            // Comodidades: checklist fixo (booleans próprias) + itens digitados pelo dono
            'possui_wifi'              => 'nullable|boolean',
            'possui_ar_condicionado'   => 'nullable|boolean',
            'mobiliado'                => 'nullable|boolean',
            'aceita_pet'               => 'nullable|boolean',
            'piscina'                  => 'nullable|boolean',
            'churrasqueira'            => 'nullable|boolean',
            'comodidades_extra'        => 'nullable|array|max:20',
            'comodidades_extra.*'      => 'string|max:60',

            // Disponibilidade: quando o item NÃO pode ser reservado o tempo todo
            'sempre_disponivel'          => 'nullable|boolean',
            'data_inicio_disponibilidade' => 'nullable|date',
            'data_fim_disponibilidade'    => 'nullable|date|after_or_equal:data_inicio_disponibilidade',
            'dias_semana_disponiveis'     => 'nullable|array',
            'dias_semana_disponiveis.*'   => 'integer|min:0|max:6',
        ]);

        // "Comodidades" é a mesma lista (recursos_oferecidos) já exibida ao cliente — os
        // checkboxes fixos viram texto e entram junto com o que o dono digitou.
        $rotulos = [
            'possui_wifi' => 'Wi-Fi', 'possui_ar_condicionado' => 'Ar-condicionado', 'mobiliado' => 'Mobiliado',
            'aceita_pet' => 'Aceita pets', 'piscina' => 'Piscina', 'churrasqueira' => 'Churrasqueira',
        ];
        $comodidades = [];
        foreach ($rotulos as $campo => $rotulo) {
            if ($request->boolean($campo)) {
                $comodidades[] = $rotulo;
            }
        }
        foreach ($dados['comodidades_extra'] ?? [] as $extra) {
            $extra = trim(strip_tags($extra));
            if ($extra !== '') {
                $comodidades[] = $extra;
            }
        }
        $dados['recursos_oferecidos'] = array_values(array_unique($comodidades));
        unset($dados['comodidades_extra']);

        if (($dados['modelo_precificacao'] ?? 'pacote') === 'por_pessoa') {
            $dados['pessoas_incluidas'] = null;
            $dados['valor_pessoa_extra'] = null;
        }

        // Local de retirada/entrega só existe para bens móveis (veículos, equipamentos…).
        if (!\App\Models\ItemAluguel::categoriaPermiteEntrega($dados['categoria'] ?? null)) {
            $dados['local_retirada'] = null;
            $dados['local_entrega'] = null;
        }

        return $dados;
    }

    /**
     * Imóveis podem levar até 10 fotos; o resto (veículos, espaços,
     * equipamentos etc.) no máximo 5.
     */
    private function maxFotosParaCategoria(?string $categoria): int
    {
        $imoveis = ItemAluguel::CATEGORIAS_LOCACAO_AVULSA['Imóveis'] ?? [];
        return in_array($categoria, $imoveis, true) ? 10 : 5;
    }

    /**
     * Processa o upload de novas fotos e mescla com as fotos existentes que
     * o dono optou por manter (`fotos_mantidas`). Qualquer foto antiga que
     * não esteja em `fotos_mantidas` é apagada do ImageKit.
     */
    private function processarFotosLocacaoAvulsa(Request $request, array $fotosAtuais, ?string $categoria): array
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
        $limite = $this->maxFotosParaCategoria($categoria);

        if (count($fotosMantidas) + count($novasFotos) > $limite) {
            abort(400, "Você só pode ter no máximo {$limite} fotos para esta categoria.");
        }

        $caminhosNovos = [];
        foreach ($novasFotos as $foto) {
            if ($this->imagemContemConteudoInadequado($foto)) {
                abort(400, 'Uma das imagens enviadas violou nossos termos de uso (conteúdo inadequado detectado).');
            }
            $caminhosNovos[] = $this->uploadParaImageKit($foto);
        }

        return array_values(array_merge($fotosMantidas, $caminhosNovos));
    }

    private function imagemContemConteudoInadequado($foto): bool
    {
        try {
            $hiveKey = env('HIVE_API_KEY');
            if (!$hiveKey) return false;

            $response = Http::withHeaders([
                'authorization' => 'token ' . $hiveKey,
                'accept'        => 'application/json',
            ])->attach('media', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
              ->post('https://api.thehive.ai/api/v2/task/sync', ['classes' => 'nsfw']);

            if ($response->successful()) {
                $classes = $response->json()['status'][0]['response']['output'][0]['classes'] ?? [];
                foreach ($classes as $class) {
                    if (in_array($class['class'], ['yes_nsfw', 'pornography']) && $class['score'] > 0.70) {
                        return true;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Hive AI error (locação avulsa): ' . $e->getMessage());
        }
        return false;
    }

    private function uploadParaImageKit($foto): string
    {
        $privateKey = env('IMAGEKIT_PRIVATE_KEY');
        if (!$privateKey) throw new \Exception('Chave ImageKit ausente.');

        $response = Http::withBasicAuth($privateKey, '')
            ->attach('file', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
            ->post('https://upload.imagekit.io/api/v1/files/upload', [
                'fileName' => uniqid() . '_' . preg_replace('/[^A-Za-z0-9\-\.]/', '', $foto->getClientOriginalName()),
                'folder'   => '/locacoes_avulsas',
            ]);

        if ($response->successful()) {
            return $response->json('url');
        }

        throw new \Exception('Falha no upload para o ImageKit.');
    }
}
