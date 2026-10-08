<?php

namespace Tests\Feature;

use App\Services\HiveAiService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HiveAiServiceTest extends TestCase
{
    private function imagem(): UploadedFile
    {
        return UploadedFile::fake()->image('foto.jpg');
    }

    public function test_imagem_reprovada_pela_hive_e_bloqueada(): void
    {
        Http::fake(['*thehive.ai*' => Http::response([
            'status' => [['response' => ['output' => [['classes' => [['class' => 'yes_nsfw', 'score' => 0.9]]]]]]],
        ], 200)]);

        $this->assertFalse(HiveAiService::isSafe($this->imagem()));
    }

    public function test_imagem_aprovada_pela_hive_passa(): void
    {
        Http::fake(['*thehive.ai*' => Http::response([
            'status' => [['response' => ['output' => [['classes' => [['class' => 'yes_nsfw', 'score' => 0.01]]]]]]],
        ], 200)]);

        $this->assertTrue(HiveAiService::isSafe($this->imagem()));
    }

    public function test_falha_de_autenticacao_da_hive_libera_a_imagem(): void
    {
        Http::fake(['*thehive.ai*' => Http::response(['message' => 'Invalid Auth Token'], 403)]);

        $this->assertTrue(HiveAiService::isSafe($this->imagem()));
    }

    public function test_erro_de_rede_libera_a_imagem(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('timeout');
        });

        $this->assertTrue(HiveAiService::isSafe($this->imagem()));
    }
}
