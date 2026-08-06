<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;

class HiveAiService
{
    /**
     * Verifica se a imagem é segura (SFW). 
     * Retorna TRUE se for segura, FALSE se contiver nudez, drogas, violência etc.
     */
    public static function isSafe(UploadedFile $file): bool
    {
        try {
            // Pegue sua API Key no painel da Hive
            $apiKey = env('HIVE_API_KEY', 'sua_chave_aqui');
            
            // Lendo o arquivo em memória para enviar via multipart
            $fileContent = file_get_contents($file->getRealPath());

            // Requisição para a API da Hive (Endpoint de moderação visual)
            $response = Http::withHeaders([
                'Authorization' => 'Token ' . $apiKey,
                'accept' => 'application/json'
            ])->attach(
                'media', // Nome do campo esperado pela Hive
                $fileContent,
                $file->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync', [
                // Dependendo do seu plano, o nome das classes muda, esse é um modelo geral.
            ]);

            if ($response->successful()) {
                $result = $response->json();
                
                // Analisa o retorno. A Hive devolve scores de 0 a 1.
                // Exemplo: Se o score de NSFW for maior que 0.5 (50%), barramos.
                $classes = $result['status'][0]['response']['output'][0]['classes'] ?? [];
                
                foreach ($classes as $class) {
                    // Nomes das classes dependem do modelo de projeto na Hive
                    $nomeDaClasse = $class['class'];
                    $score = $class['score'];

                    // Regra: se for yes_nsfw, yes_violence, yes_drugs e a confiança for alta (> 50%)
                    if (in_array($nomeDaClasse, ['yes_nsfw', 'yes_violence', 'yes_drugs'])) {
                        if ($score > 0.5) {
                            return false; // Imagem reprovada 🚫
                        }
                    }
                }
                
                return true; // Aprovada ✅
            }

            // Se der erro na API da Hive por algum motivo, você pode decidir 
            // aprovar por padrão (true) ou bloquear (false).
            // Para maior segurança, bloqueia se a API falhar.
            \Log::error('Erro na API Hive: ' . $response->body());
            return false;

        } catch (\Exception $e) {
            \Log::error('Falha na conexão com Hive AI: ' . $e->getMessage());
            return false; // Bloqueia upload se a validação falhar por erro de rede
        }
    }
}