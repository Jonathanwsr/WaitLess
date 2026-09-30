<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\ContaPagamentoEstabelecimento;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Testes de regressão pras falhas de autorização mais graves encontradas e
 * corrigidas numa auditoria de segurança: pontos, contas bancárias, pagamento
 * de agendamento de terceiro e aprovação de estorno. O objetivo aqui não é
 * cobertura ampla — é garantir que essas brechas específicas (que permitiam
 * fraude financeira real) nunca voltem a existir sem que um teste quebre.
 */
class AutorizacaoFluxosFinanceirosTest extends TestCase
{
    use DatabaseTransactions;

    private function criarUsuario(array $dados = []): User
    {
        return User::create(array_merge([
            'name' => 'Usuário Teste ' . uniqid(),
            'email' => 'teste' . uniqid() . '@example.com',
            'password' => Hash::make('senha-teste-123'),
            'papel' => 'user',
        ], $dados));
    }

    private function criarEstabelecimentoComDono(User $dono): Estabelecimento
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Estabelecimento Teste ' . uniqid()]);

        DB::table('estabelecimento_usuario')->insert([
            'usuario_id' => $dono->id,
            'estabelecimento_id' => $estabelecimento->id,
            'tipo' => 'socio',
        ]);

        return $estabelecimento;
    }

    // -------------------------------------------------------------------
    // HistoricoPontoController::store — auto-crédito de pontos
    // -------------------------------------------------------------------

    public function test_usuario_sem_vinculo_nao_consegue_creditar_pontos_em_estabelecimento_alheio(): void
    {
        $dono = $this->criarUsuario();
        $estabelecimento = $this->criarEstabelecimentoComDono($dono);
        $intruso = $this->criarUsuario();

        $response = $this->actingAs($intruso)->postJson('/api/historico-pontos', [
            'usuario_id' => $intruso->id,
            'estabelecimento_id' => $estabelecimento->id,
            'tipo' => 'ganho',
            'descricao' => 'tentativa de fraude',
            'quantidade' => 999999,
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseMissing('historico_pontos', [
            'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 999999,
        ]);
    }

    public function test_dono_do_estabelecimento_consegue_ajustar_pontos_de_um_cliente(): void
    {
        $dono = $this->criarUsuario(['papel' => 'socio']);
        $estabelecimento = $this->criarEstabelecimentoComDono($dono);
        $cliente = $this->criarUsuario();

        $response = $this->actingAs($dono)->postJson('/api/historico-pontos', [
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estabelecimento->id,
            'tipo' => 'ganho',
            'descricao' => 'ajuste manual de teste',
            'quantidade' => 50,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('historico_pontos', [
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 50,
        ]);
    }

    // -------------------------------------------------------------------
    // ContaPagamentoEstabelecimentoController::store — sequestro de recebimento
    // -------------------------------------------------------------------

    public function test_usuario_sem_vinculo_nao_consegue_cadastrar_conta_bancaria_em_estabelecimento_alheio(): void
    {
        $dono = $this->criarUsuario();
        $estabelecimento = $this->criarEstabelecimentoComDono($dono);
        $intruso = $this->criarUsuario();

        $response = $this->actingAs($intruso)->postJson('/api/contas-bancarias', [
            'estabelecimento_id' => $estabelecimento->id,
            'gateway' => 'pix_direto',
            'chave_pix' => 'atacante@example.com',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseMissing('contas_pagamento_estabelecimento', [
            'estabelecimento_id' => $estabelecimento->id,
            'chave_pix' => 'atacante@example.com',
        ]);
    }

    // -------------------------------------------------------------------
    // PagamentoController::processar — pagar/confirmar agendamento de terceiro
    // -------------------------------------------------------------------

    public function test_usuario_nao_consegue_processar_pagamento_de_agendamento_de_outra_pessoa(): void
    {
        $dono = $this->criarUsuario();
        $estabelecimento = $this->criarEstabelecimentoComDono($dono);
        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Serviço Teste',
            'tipo_servico' => 'Outro',
            'valor' => 100,
            'duracao_minutos' => 30,
            'ativo' => true,
        ]);

        $donoDoAgendamento = $this->criarUsuario();
        $agendamento = Agendamento::create([
            'usuario_id' => $donoDoAgendamento->id,
            'estabelecimento_id' => $estabelecimento->id,
            'servico_id' => $servico->id,
            'data_agendamento' => now()->addDay()->toDateString(),
            'hora_agendamento' => '10:00',
            'status' => 'aguardando_pagamento',
            'status_pagamento' => 'pendente',
            'valor_final' => 100,
        ]);

        $intruso = $this->criarUsuario();

        $response = $this->actingAs($intruso)->postJson('/pagamento/processar', [
            'agendamento_id' => $agendamento->id,
            'metodo_pagamento' => 'local',
        ]);

        $response->assertStatus(404);

        $agendamento->refresh();
        $this->assertSame('aguardando_pagamento', $agendamento->status, 'O agendamento de outra pessoa não pode ter sido confirmado pelo intruso.');
    }

    // -------------------------------------------------------------------
    // EstornoController::adminAprovar — aprovar reembolso sem ser admin
    // -------------------------------------------------------------------

    public function test_usuario_comum_nao_consegue_aprovar_estorno(): void
    {
        $clienteComum = $this->criarUsuario(['papel' => 'user']);

        // Mesmo com um id que não existe, o middleware CheckAdmin tem que
        // barrar ANTES de qualquer lógica de estorno rodar.
        $response = $this->actingAs($clienteComum)->post('/admin/estornos/999999/aprovar');

        $response->assertStatus(403);
    }

    public function test_socio_de_estabelecimento_tambem_nao_consegue_aprovar_estorno(): void
    {
        // Ser dono de um negócio não dá acesso ao painel de admin da plataforma.
        $socio = $this->criarUsuario(['papel' => 'socio']);

        $response = $this->actingAs($socio)->post('/admin/estornos/999999/aprovar');

        $response->assertStatus(403);
    }

    public function test_admin_de_verdade_passa_pela_checagem_de_acesso(): void
    {
        $admin = $this->criarUsuario(['papel' => 'admin']);

        $response = $this->actingAs($admin)->post('/admin/estornos/999999/aprovar');

        // Passa pelo CheckAdmin; o 404/erro que sobra é só por causa do id
        // inexistente — o ponto aqui é confirmar que não foi um 403.
        $response->assertStatus(404);
    }
}
