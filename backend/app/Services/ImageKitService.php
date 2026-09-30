<?php

namespace App\Services;

use ImageKit\ImageKit;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class ImageKitService
{
    /**
     * Faz o upload da imagem e retorna a URL pública.
     */
    public static function upload($file, $folder = '/waitless/geral')
    {
        if (!$file) return null;

        try {
            // 1. Pega as chaves e remove espaços em branco acidentais (trim)
            $publicKey = trim(env('IMAGEKIT_PUBLIC_KEY'));
            $privateKey = trim(env('IMAGEKIT_PRIVATE_KEY'));
            $urlEndpoint = trim(env('IMAGEKIT_URL_ENDPOINT'));

            // 2. Garante que a URL comece com https://
            if (!empty($urlEndpoint) && !preg_match('/^https?:\/\//', $urlEndpoint)) {
                $urlEndpoint = 'https://' . $urlEndpoint;
            }

            // 3. Verifica se as chaves existem antes de tentar conectar
            if (empty($publicKey) || empty($privateKey) || empty($urlEndpoint)) {
                throw new Exception("As chaves do ImageKit não estão configuradas no arquivo .env");
            }

            $imageKit = new ImageKit(
                $publicKey,
                $privateKey,
                $urlEndpoint
            );

            // Limpa caracteres especiais do nome do arquivo
            $nomeArquivoSeguro = preg_replace('/[^A-Za-z0-9\-\.]/', '_', $file->getClientOriginalName());

            $upload = $imageKit->uploadFile([
                'file' => base64_encode(file_get_contents($file->getRealPath())),
                'fileName' => time() . '_' . $nomeArquivoSeguro,
                'folder' => $folder
            ]);

            // Tratamento de erro robusto
            if (isset($upload->error)) {
                $msgErro = is_string($upload->error) 
                    ? $upload->error 
                    : ($upload->error->message ?? json_encode($upload->error));
                
                throw new Exception("ImageKit recusou o envio: " . $msgErro);
            }

            if (isset($upload->result) && isset($upload->result->url)) {
                return $upload->result->url;
            }

            throw new Exception("A API não retornou uma URL válida.");

        } catch (Exception $e) {
            Log::error("Erro no Upload ImageKit: " . $e->getMessage());
            // Lança o erro para aparecer na tela do usuário (Inertia)
            throw $e;
        }
    }

    /**
     * Remove um arquivo do ImageKit a partir da URL pública salva no banco.
     * O SDK do ImageKit não tem um endpoint "delete por URL", então a busca
     * é feita pelo nome do arquivo (via Media API) para achar o fileId.
     */
    public static function delete(?string $url): void
    {
        if (!$url) return;

        $privateKey = trim(env('IMAGEKIT_PRIVATE_KEY'));
        if (empty($privateKey)) return;

        try {
            $nomeArquivo = basename(parse_url($url, PHP_URL_PATH));

            $busca = Http::withBasicAuth($privateKey, '')
                ->get('https://api.imagekit.io/v1/files', [
                    'searchQuery' => 'name="' . $nomeArquivo . '"',
                ]);

            if ($busca->successful() && !empty($busca->json())) {
                $fileId = $busca->json()[0]['fileId'] ?? null;
                if ($fileId) {
                    Http::withBasicAuth($privateKey, '')
                        ->delete('https://api.imagekit.io/v1/files/' . $fileId);
                }
            }
        } catch (Exception $e) {
            Log::error('Erro ao apagar arquivo do ImageKit: ' . $e->getMessage());
        }
    }

    /**
     * Remove vários arquivos do ImageKit de uma vez (ver delete()).
     */
    public static function deleteMany(?array $urls): void
    {
        foreach (($urls ?? []) as $url) {
            self::delete($url);
        }
    }
}