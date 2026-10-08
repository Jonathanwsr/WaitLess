<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Conversa;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DetalhePedidoClienteTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    /** Agendamento de um cliente num local sem rua cadastrada (caso que gerava ", - , São Paulo - SP"). */
    private function cenario(): array
    {
        $dono = $this->usuario('socio', 'Dono');
        $estab = Estabelecimento::create(['nome' => 'Clínica Bem Estar', 'cidade' => 'São Paulo', 'estado' => 'SP', 'telefone' => '(11) 98888-7777']);
        $estab->proprietarios()->attach($dono->id, ['tipo' => 'socio']);
        $servico = Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Avaliação Gratuita', 'descricao' => 'Primeira consulta para conhecer você.',
            'tipo_servico' => 'Outro', 'valor' => 0, 'duracao_minutos' => 20, 'ativo' => true,
        ]);
        $funcionario = Funcionario::create(['estabelecimento_id' => $estab->id, 'nome' => 'Dra. Ana', 'ativo' => true]);
        $cliente = $this->usuario('user', 'Cliente');
        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'funcionario_id' => $funcionario->id, 'data_agendamento' => now('America/Sao_Paulo')->addDays(3)->toDateString(),
            'hora_agendamento' => '13:00', 'status' => 'confirmado', 'status_pagamento' => 'pago', 'valor_final' => 0,
            'codigo_verificacao' => '6209',
        ]);

        return [$cliente, $estab, $agendamento];
    }

    public function test_detalhe_do_agendamento_traz_servico_contato_e_mensagem(): void
    {
        [$cliente, $estab, $agendamento] = $this->cenario();

        $resposta = $this->actingAs($cliente)->get("/meus-pedidos/agendamento/{$agendamento->id}");

        $resposta->assertOk();
        $dados = $resposta->viewData('page')['props']['dados'];

        $this->assertSame('São Paulo - SP', $dados['estabelecimento']['endereco_completo']);
        $this->assertSame('Primeira consulta para conhecer você.', $dados['descricao']);
        $this->assertSame('Clínica Bem Estar', $dados['contato']['nome']);
        $this->assertSame('(11) 98888-7777', $dados['contato']['telefone']);
        $this->assertSame(['usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'agendamento_id' => $agendamento->id], $dados['mensagem']);
        $rotulos = collect($dados['detalhes'])->pluck('valor', 'rotulo');
        $this->assertSame('Dra. Ana', $rotulos['Profissional']);
        $this->assertSame('20 minutos', $rotulos['Duração']);
        $this->assertSame('Pago', $rotulos['Pagamento']);
        $this->assertNull($dados['cobranca']);
    }

    public function test_botao_de_mensagem_abre_conversa_com_o_local_sobre_o_agendamento(): void
    {
        [$cliente, $estab, $agendamento] = $this->cenario();

        $resposta = $this->actingAs($cliente)->post('/mensagens/iniciar', [
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'agendamento_id' => $agendamento->id,
        ]);

        $conversa = Conversa::where('usuario_id', $cliente->id)->where('agendamento_id', $agendamento->id)->first();
        $this->assertNotNull($conversa);
        $this->assertSame($estab->id, (int) $conversa->estabelecimento_id);
        $resposta->assertRedirect(route('mensagens.show', ['id' => $conversa->id]));
    }

    public function test_outro_cliente_nao_ve_o_detalhe(): void
    {
        [, , $agendamento] = $this->cenario();
        $estranho = $this->usuario('user', 'Estranho');

        $this->actingAs($estranho)->get("/meus-pedidos/agendamento/{$agendamento->id}")->assertForbidden();
    }

    public function test_paginas_do_cliente_renderizam_com_as_abas(): void
    {
        $cliente = $this->usuario('user', 'Cliente');

        $this->actingAs($cliente)->get('/minhas-cobrancas')->assertOk();
        $this->actingAs($cliente)->get('/entregas')->assertOk();
        $this->actingAs($cliente)->get('/entregas/meus-pedidos')->assertOk();
        $this->actingAs($cliente)->get('/entregas/minhas-assinaturas')->assertOk();
    }
}
