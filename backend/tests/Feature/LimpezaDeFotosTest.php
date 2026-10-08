<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LimpezaDeFotosTest extends TestCase
{
    use DatabaseTransactions;

    private function fakeImageKitBusca(array $arquivosEncontrados = []): void
    {
        Http::fake([
            'api.imagekit.io/v1/files*' => Http::response($arquivosEncontrados, 200),
            'api.imagekit.io/v1/files/*' => Http::response([], 204),
        ]);
    }

    public function test_remover_foto_de_servico_na_edicao_chama_a_exclusao_no_imagekit(): void
    {
        $this->fakeImageKitBusca([['fileId' => 'fk_123', 'name' => 'foto-antiga.jpg']]);

        $socio = User::create(['name' => 'Socio Foto', 'email' => 'fotos1' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Foto ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro',
            'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true,
            'fotos' => json_encode(['https://ik.imagekit.io/waitless/servicos/foto-antiga.jpg']),
        ]);

        $response = $this->actingAs($socio)->put("/servicos/{$servico->id}", [
            'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'tipo_pagamento' => 'hibrido',
            'fotos_existentes' => [], // o sócio removeu a única foto
        ]);

        $response->assertRedirect();
        $this->assertSame('[]', $servico->fresh()->fotos);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.imagekit.io/v1/files/fk_123') && $request->method() === 'DELETE');
    }

    public function test_apagar_servico_remove_as_fotos_do_imagekit(): void
    {
        $this->fakeImageKitBusca([['fileId' => 'fk_456', 'name' => 'foto-servico.jpg']]);

        $socio = User::create(['name' => 'Socio Foto2', 'email' => 'fotos2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Foto2 ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro',
            'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true,
            'fotos' => json_encode(['https://ik.imagekit.io/waitless/servicos/foto-servico.jpg']),
        ]);

        $response = $this->actingAs($socio)->delete("/servicos/{$servico->id}");

        $response->assertRedirect();
        $this->assertNull(Servico::find($servico->id));
        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.imagekit.io/v1/files/fk_456') && $request->method() === 'DELETE');
    }
}
