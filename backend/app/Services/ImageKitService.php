<?php

namespace App\Services;

use ImageKit\ImageKit;
use Exception;
use Illuminate\Support\Facades\Log;

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
}