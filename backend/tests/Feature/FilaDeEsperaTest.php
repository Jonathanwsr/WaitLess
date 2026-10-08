<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FilaDeEsperaTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocioComLocal(): array
    {
        $socio = User::create(['name' => 'Socio Fila', 'email' => 'fila' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Fila ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        return [$socio, $estabelecimento];
    }

    /**
     * Regressão de um bug crítico: /fila e /estabelecimentos/{id}/fila
     * apontavam pro MESMO método index(), que ignora o {estabelecimento} da
     * URL e redireciona pra si mesma sempre que o usuário tem 1 único local
     * — loop infinito de redirecionamento. A Fila de Espera nunca abria para
     * ninguém com apenas um estabelecimento (o caso mais comum da plataforma).
     */
    public function test_socio_com_um_unico_local_acessa_a_fila_sem_loop_de_redirecionamento(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComLocal();

        $respostaAgregada = $this->actingAs($socio)->get('/fila');
        $respostaAgregada->assertRedirect("/estabelecimentos/{$estabelecimento->id}/fila");

        $respostaDireta = $this->actingAs($socio)->get("/estabelecimentos/{$estabelecimento->id}/fila");
        $respostaDireta->assertOk();
        $respostaDireta->assertInertia(fn ($page) => $page
            ->component('Estabelecimentos/Fila')
            ->where('estabelecimento.id', $estabelecimento->id));
    }

    public function test_quem_nao_administra_o_local_nao_ve_a_fila_dele(): void
    {
        [, $estabelecimento] = $this->criarSocioComLocal();
        $outro = User::create(['name' => 'Outro Socio Fila', 'email' => 'outrofila' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);

        $response = $this->actingAs($outro)->get("/estabelecimentos/{$estabelecimento->id}/fila");

        $response->assertForbidden();
    }

    public function test_painel_de_tv_mostra_quem_esta_sendo_atendido_e_os_proximos(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComLocal();
        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);

        $clienteAtual = User::create(['name' => 'Cliente Atual', 'email' => 'atual' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $clienteProximo = User::create(['name' => 'Cliente Proximo', 'email' => 'proximo' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        Agendamento::create([
            'usuario_id' => $clienteAtual->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '09:00',
            'status' => 'em_atendimento', 'status_pagamento' => 'pago_online', 'valor_final' => 50,
        ]);
        Agendamento::create([
            'usuario_id' => $clienteProximo->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '09:30',
            'status' => 'confirmado', 'status_pagamento' => 'pago_online', 'valor_final' => 50,
        ]);

        $respostaPainel = $this->actingAs($socio)->get("/estabelecimentos/{$estabelecimento->id}/fila/painel");
        $respostaPainel->assertOk();
        $respostaPainel->assertInertia(fn ($page) => $page->component('Estabelecimentos/FilaPainel'));

        $respostaDados = $this->actingAs($socio)->getJson("/estabelecimentos/{$estabelecimento->id}/fila/painel/dados");
        $respostaDados->assertOk();
        $respostaDados->assertJsonPath('atual.usuario.name', 'Cliente Atual');
        $respostaDados->assertJsonCount(1, 'proximos');
        $respostaDados->assertJsonPath('proximos.0.usuario.name', 'Cliente Proximo');
    }
}
