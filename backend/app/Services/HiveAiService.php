<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Moderação de imagens (Hive AI): ponto ÚNICO de análise do conteúdo das fotos enviadas em serviços,
 * reservas/locações, produtos, estabelecimentos e estornos.
 *
 * DESLIGADA por padrão (config services.hive.ativo / HIVE_MODERACAO_ATIVA=false): nenhuma imagem é
 * enviada para análise e todas são aceitas. A estrutura continua pronta; para ligar no futuro basta
 * HIVE_MODERACAO_ATIVA=true e HIVE_API_KEY no .env, sem mexer no código das telas.
 */
class HiveAiService
{
    public static function ativo(): bool
    {
        return (bool) config('services.hive.ativo', false);
    }

    /** Atalho com a pergunta inversa, usado nos cadastros: a imagem deve ser recusada? */
    public static function bloqueada(UploadedFile $file): bool
    {
        return !self::isSafe($file);
    }

    /**
     * Retorna FALSE só quando a Hive classifica a imagem como nudez, drogas ou violência.
     * Se a própria Hive falhar (chave ausente, erro de rede ou resposta não-2xx), o erro
     * vai para o log e a imagem é liberada: a moderação externa não bloqueia o cadastro.
     */
    public static function isSafe(UploadedFile $file): bool
    {
        if (!self::ativo()) {
            return true; // Moderação desligada: nenhuma imagem sai do servidor para análise.
        }

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
