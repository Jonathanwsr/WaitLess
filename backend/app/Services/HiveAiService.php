<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log; // Adicionado para usar logs

class HiveAiService
{
    /**
     * Verifica se a imagem é segura (SFW). 
     * Retorna TRUE se for segura, FALSE se contiver nudez, drogas, violência etc.
     */
    public static function isSafe(UploadedFile $file): bool
    {
        try {
            // 👉 Usar config() em vez de env()
            $apiKey = config('services.hive.key');
            
            // Proteção: Se a chave estiver vazia, grava no log para te avisar
            if (empty($apiKey)) {
                Log::error('Hive API: A chave da API não foi carregada. Verifique o .env e o cache.');
            }

            // 👉 LOG PARA DESCOBRIR A CHAVE EXATA QUE O LARAVEL ESTÁ ENVIANDO:
            Log::info('Testando Hive API. A chave exata enviada é: [' . $apiKey . ']');

            // Lendo o arquivo em memória para enviar via multipart
            $fileContent = file_get_contents($file->getRealPath());

            // Requisição para a API da Hive (Endpoint de moderação visual)
            $response = Http::withHeaders([
                'Authorization' => 'token ' . $apiKey, // 👉 ALTERADO DE 'Token' PARA 'token' (minúsculo)
                'accept' => 'application/json'
            ])->attach(
                'media', // Nome do campo esperado pela Hive
                $fileContent,
                $file->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync', [
                // Payload
            ]);

            if ($response->successful()) {
                $result = $response->json();
                
                $classes = $result['status'][0]['response']['output'][0]['classes'] ?? [];
                
                foreach ($classes as $class) {
                    $nomeDaClasse = $class['class'];
                    $score = $class['score'];

                    if (in_array($nomeDaClasse, ['yes_nsfw', 'yes_violence', 'yes_drugs'])) {
                        if ($score > 0.5) {
                            return false; // Imagem reprovada 🚫
                        }
                    }
                }
                
                return true; // Aprovada ✅
            }

            Log::error('Erro na API Hive: ' . $response->body());
            return false;

        } catch (\Exception $e) {
            Log::error('Falha na conexão com Hive AI: ' . $e->getMessage());
            return false; // Bloqueia upload se a validação falhar por erro de rede
        }
    }
}