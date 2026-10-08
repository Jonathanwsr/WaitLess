<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class HiveAiService
{
    /**
     * Retorna FALSE só quando a Hive classifica a imagem como nudez, drogas ou violência.
     * Se a própria Hive falhar (chave ausente, erro de rede ou resposta não-2xx), o erro
     * vai para o log e a imagem é liberada: a moderação externa não bloqueia o cadastro.
     */
    public static function isSafe(UploadedFile $file): bool
    {
        $apiKey = config('services.hive.key');

        if (empty($apiKey)) {
            Log::error('Hive API: chave não configurada (HIVE_API_KEY). Imagem liberada sem moderação.');
            return true;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'token ' . $apiKey,
                'accept' => 'application/json',
            ])->attach(
                'media',
                file_get_contents($file->getRealPath()),
                $file->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync', []);

            if (!$response->successful()) {
                Log::error('Erro na API Hive (liberado sem moderação): HTTP ' . $response->status() . ' ' . $response->body());
                return true;
            }

            $classes = $response->json('status.0.response.output.0.classes') ?? [];

            foreach ($classes as $class) {
                if (in_array($class['class'] ?? null, ['yes_nsfw', 'yes_violence', 'yes_drugs'], true) && ($class['score'] ?? 0) > 0.5) {
                    return false;
                }
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Falha na conexão com Hive AI (liberado sem moderação): ' . $e->getMessage());
            return true;
        }
    }
}
