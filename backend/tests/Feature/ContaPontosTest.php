<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\Servico;
use App\Models\User;
use App\Services\PontosService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ContaPontosTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user', ?string $plano = null): User
    {
        return User::create([
            'name' => 'Pessoa', 'email' => 'p' . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito',
            'plano_expira_em' => $plano ? now()->addMonth() : null,
        ]);
    }

    private function servico(bool $aceitaPontos, ?int $maximo = null): Servico
    {
        $estab = Estabelecimento::create(['nome' => 'Local ' . uniqid()]);

        return Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 100,
            'duracao_minutos' => 30, 'ativo' => true, 'aceita_pontos' => $aceitaPontos, 'maximo_pontos_permitidos' => $maximo,
        ]);
    }

    // ---------------------------------------------------------------- exclusão

    public function test_conta_sem_pendencias_pode_ser_apagada(): void
    {
        $user = $this->usuario();

        $this->actingAs($user)->delete('/profile', ['password' => 'senha-teste-123'])->assertRedirect('/');

        $this->assertNull(User::find($user->id));
    }

    public function test_agendamento_marcado_bloqueia_a_exclusao(): void
    {
        $user = $this->usuario();
        $servico = $this->servico(false);
        Agendamento::create([
            'usuario_id' => $user->id, 'estabelecimento_id' => $servico->estabelecimento_id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 50,
        ]);

        $this->actingAs($user)->delete('/profile', ['password' => 'senha-teste-123'])->assertSessionHasErrors('password');

        $this->assertNotNull(User::find($user->id));
        $pendencias = $this->actingAs($user)->get('/profile')->viewData('page')['props']['pendenciasExclusao'];
        $this->assertSame('agendamentos', $pendencias[0]['chave']);
    }

    public function test_pagamento_pendente_e_estorno_aberto_bloqueiam_a_exclusao(): void
    {
        $user = $this->usuario();
        $servico = $this->servico(false);
        $pagamento = Pagamento::create([
            'usuario_id' => $user->id, 'estabelecimento_id' => $servico->estabelecimento_id, 'gateway_pagamento' => 'Asaas',
            'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 50, 'taxa' => 3, 'valor_liquido' => 47,
            'status' => 'pendente', 'metodo_pagamento' => 'pix',
        ]);

        $chaves = collect(app(\App\Services\ExclusaoContaService::class)->pendencias($user))->pluck('chave');
        $this->assertContains('pagamentos', $chaves);

        $pagamento->update(['status' => 'pago']);
        $dono = $this->usuario('socio');
        Estorno::create([
            'codigo_estorno' => 'EST-' . uniqid(), 'usuario_id' => $user->id, 'prestador_id' => $dono->id,
            'estabelecimento_id' => $servico->estabelecimento_id, 'pagamento_id' => $pagamento->id, 'categoria' => 'SERVICO',
            'valor_pago' => 50, 'valor_estornado' => 50, 'status' => 'EM_ANALISE', 'motivo' => 'OUTRO',
            'descricao_cliente' => 'Teste', 'forma_pagamento' => 'PIX', 'tipo_estorno' => 'TOTAL',
            'data_pagamento' => now(), 'data_solicitacao' => now(),
        ]);

        $chaves = collect(app(\App\Services\ExclusaoContaService::class)->pendencias($user))->pluck('chave');
        $this->assertNotContains('pagamentos', $chaves);
        $this->assertContains('estornos', $chaves);
    }

    public function test_senha_errada_ao_apagar_tem_mensagem_em_portugues(): void
    {
        $user = $this->usuario();

        $this->actingAs($user)->delete('/profile', ['password' => 'errada'])->assertSessionHasErrors(['password' => 'Senha incorreta.']);
    }

    public function test_troca_de_senha_valida_em_portugues(): void
    {
        $user = $this->usuario();

        $this->actingAs($user)->from('/profile')->put('/password', [
            'current_password' => 'errada', 'password' => 'novaSenha123', 'password_confirmation' => 'novaSenha123',
        ])->assertSessionHasErrors(['current_password' => 'A senha atual está incorreta.']);

        $this->actingAs($user)->from('/profile')->put('/password', [
            'current_password' => 'senha-teste-123', 'password' => 'somenteletras', 'password_confirmation' => 'somenteletras',
        ])->assertSessionHasErrors(['password' => 'A nova senha precisa ter pelo menos um número.']);
    }

    // ---------------------------------------------------------------- pontos

    public function test_local_que_aceita_pontos_usa_o_limite_dele(): void
    {
        $user = $this->usuario();

        $this->assertSame(5000, PontosService::limiteDePontos($user, $this->servico(true, 5000), 100));
        $this->assertSame(100000, PontosService::limiteDePontos($user, $this->servico(true), 100));
    }

    public function test_sem_aceite_so_premium_usa_pontos_com_limite_de_20_por_cento(): void
    {
        $servico = $this->servico(false);

        $this->assertNull(PontosService::limiteDePontos($this->usuario(), $servico, 100));
        // 20% de R$ 100 = R$ 20 = 20.000 pontos
        $this->assertSame(20000, PontosService::limiteDePontos($this->usuario('user', 'premium'), $servico, 100));
    }

    public function test_pontos_para_pedido_respeita_saldo_e_limite_premium(): void
    {
        $premium = $this->usuario('user', 'premium');
        $premium->update(['pontos_saldo' => 50000]);
        $servico = $this->servico(false);

        $this->assertSame(20000, PontosService::pontosParaPedido($premium->fresh(), $servico, 50000, 100));
        $this->assertSame(0, PontosService::pontosParaPedido($this->usuario(), $servico, 50000, 100));
    }

    public function test_tela_meus_pontos_mostra_saldo_valor_e_historico(): void
    {
        $user = $this->usuario();
        $user->update(['pontos_saldo' => 2500]);
        DB::table('historico_pontos')->insert(['usuario_id' => $user->id, 'tipo' => 'ganho', 'descricao' => 'Bônus', 'quantidade' => 2500, 'created_at' => now()]);

        $props = $this->actingAs($user->fresh())->get('/meus-pontos')->assertOk()->viewData('page')['props'];

        $this->assertSame(2500, $props['saldo']);
        $this->assertEquals(2.5, $props['valorEmReais']);
        $this->assertTrue($props['historico'][0]['entrada']);
        $this->assertSame(2500, $props['ganhosNoMes']);
    }

    // ---------------------------------------------------------------- app

    public function test_app_troca_senha_com_as_mesmas_regras(): void
    {
        $user = $this->usuario();
        \Laravel\Sanctum\Sanctum::actingAs($user);

        $this->postJson('/api/mobile/conta/senha', ['current_password' => 'senha-teste-123', 'password' => 'somenteletras', 'password_confirmation' => 'somenteletras'])
            ->assertStatus(422)->assertJsonFragment(['A nova senha precisa ter pelo menos um número.']);

        $this->postJson('/api/mobile/conta/senha', ['current_password' => 'senha-teste-123', 'password' => 'NovaSenha2026', 'password_confirmation' => 'NovaSenha2026'])
            ->assertOk();
        $this->assertTrue(Hash::check('NovaSenha2026', $user->fresh()->password));
    }

    public function test_app_bloqueia_exclusao_com_pendencia_e_apaga_sem_pendencia(): void
    {
        $user = $this->usuario();
        $servico = $this->servico(false);
        $agendamento = Agendamento::create([
            'usuario_id' => $user->id, 'estabelecimento_id' => $servico->estabelecimento_id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 50,
        ]);
        \Laravel\Sanctum\Sanctum::actingAs($user);

        $this->getJson('/api/mobile/conta/pendencias')->assertOk()->assertJsonPath('pendencias.0.chave', 'agendamentos');
        $this->deleteJson('/api/mobile/conta', ['password' => 'senha-teste-123'])->assertStatus(409)->assertJsonPath('pendencias.0.chave', 'agendamentos');

        $agendamento->update(['status' => 'cancelado']);
        $this->deleteJson('/api/mobile/conta', ['password' => 'errada'])->assertStatus(422);
        $this->deleteJson('/api/mobile/conta', ['password' => 'senha-teste-123'])->assertOk();
        $this->assertNull(User::find($user->id));
    }

    public function test_app_meus_pontos_traz_valor_e_ganhos_do_mes(): void
    {
        $user = $this->usuario('user', 'premium');
        $user->update(['pontos_saldo' => 3000]);
        DB::table('historico_pontos')->insert(['usuario_id' => $user->id, 'tipo' => 'ganho', 'descricao' => 'Bônus', 'quantidade' => 3000, 'created_at' => now()]);
        \Laravel\Sanctum\Sanctum::actingAs($user->fresh());

        $this->getJson('/api/mobile/meus-pontos')->assertOk()
            ->assertJsonPath('valor_em_reais', 3)
            ->assertJsonPath('ganhos_no_mes', 3000)
            ->assertJsonPath('pontos_premium.ativo', true);
    }
}
