<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Cobranca;
use App\Models\CobrancaParcela;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ComprovanteEGestaoPedidosTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome, ?string $plano = null): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito',
            'plano_expira_em' => $plano ? now('America/Sao_Paulo')->addMonth() : null,
            'asaas_customer_id' => 'cus_' . uniqid(),
        ]);
    }

    private function socio(): array
    {
        $socio = $this->usuario('socio', 'Socio', 'premium-socio');
        $estab = Estabelecimento::create(['nome' => 'Barbearia ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
            'asaas_api_key' => 'k_' . uniqid(), 'asaas_wallet_id' => 'wal_' . uniqid(),
        ]);

        return [$socio, $estab];
    }

    /** Cobrança presencial aceita, com uma parcela paga e outra em aberto. */
    private function cobrancaAceita(User $socio, Estabelecimento $estab, User $cliente): Cobranca
    {
        $servico = Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro',
            'valor' => 90, 'duracao_minutos' => 30, 'ativo' => true,
        ]);
        $funcionario = Funcionario::create(['estabelecimento_id' => $estab->id, 'nome' => 'Carlos', 'ativo' => true]);

        $cobranca = Cobranca::create([
            'codigo' => 'COB-' . strtoupper(substr(uniqid(), -8)), 'estabelecimento_id' => $estab->id, 'criado_por_usuario_id' => $socio->id,
            'cliente_id' => $cliente->id, 'modo' => 'presencial', 'valor_total' => 90, 'taxa_percentual' => 0,
            'status' => 'aceita', 'aceita_em' => now(),
        ]);
        $cobranca->itens()->create(['servico_id' => $servico->id, 'funcionario_id' => $funcionario->id, 'descricao' => 'Corte', 'valor' => 90]);
        $cobranca->parcelas()->create(['numero' => 1, 'valor' => 45, 'vencimento' => now()->toDateString(), 'status' => 'pago', 'forma_pagamento' => 'presencial', 'pago_em' => now(), 'baixa_manual' => true]);
        $cobranca->parcelas()->create(['numero' => 2, 'valor' => 45, 'vencimento' => now()->addMonth()->toDateString(), 'status' => 'pendente', 'forma_pagamento' => 'presencial']);

        return $cobranca;
    }

    public function test_comprovante_em_pdf_para_socio_e_para_cliente(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $cobranca = $this->cobrancaAceita($socio, $estab, $cliente);

        $pdfSocio = $this->actingAs($socio)->get("/cobrancas/{$cobranca->id}/comprovante-pdf");
        $pdfSocio->assertOk();
        $this->assertSame('application/pdf', $pdfSocio->headers->get('content-type'));

        $pdfCliente = $this->actingAs($cliente)->get("/minhas-cobrancas/{$cobranca->id}/comprovante-pdf");
        $pdfCliente->assertOk();
        $this->assertSame('application/pdf', $pdfCliente->headers->get('content-type'));
    }

    public function test_comprovante_nao_aparece_para_terceiros(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $outro = $this->usuario('cliente', 'Outro');
        $cobranca = $this->cobrancaAceita($socio, $estab, $cliente);

        $this->actingAs($outro)->get("/minhas-cobrancas/{$cobranca->id}/comprovante-pdf")->assertForbidden();
        $this->actingAs($outro)->get("/cobrancas/{$cobranca->id}/comprovante-pdf")->assertForbidden();
        $this->actingAs($cliente)->get("/cobrancas/{$cobranca->id}/comprovante-pdf")->assertForbidden();
    }

    public function test_descricao_da_fatura_diz_do_que_se_trata(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $cobranca = $this->cobrancaAceita($socio, $estab, $cliente)->load(['itens', 'estabelecimento']);

        $descricao = app(\App\Services\CobrancaParceladaService::class)->descricaoParaFatura($cobranca);

        $this->assertStringContainsString($estab->nome, $descricao);
        $this->assertStringContainsString('Corte', $descricao);
    }

    public function test_painel_de_pedidos_mostra_produtos_e_reservas_com_quem_atende(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $funcionario = Funcionario::create(['estabelecimento_id' => $estab->id, 'nome' => 'Ana', 'ativo' => true]);
        $servico = Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Barba', 'tipo_servico' => 'Outro',
            'valor' => 40, 'duracao_minutos' => 30, 'ativo' => true,
        ]);
        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Pomada', 'categoria' => 'Outros',
            'valor' => 30, 'estoque_disponivel' => 5, 'ativo' => true, 'taxa_entrega' => 0,
            'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'SP', 'endereco_estado' => 'SP',
        ]);
        PedidoEntrega::create([
            'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '123456', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $socio->id, 'estabelecimento_id' => $estab->id,
            'quantidade' => 1, 'valor_unitario' => 30, 'valor_total' => 30, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'local', 'status' => 'aguardando_confirmacao', 'funcionario_id' => $funcionario->id,
        ]);
        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'funcionario_id' => $funcionario->id, 'data_agendamento' => now('America/Sao_Paulo')->addDay()->toDateString(),
            'hora_agendamento' => '10:00', 'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 40,
        ]);

        $resposta = $this->actingAs($socio)->getJson('/gestao/pedidos');

        $resposta->assertOk();
        $tipos = collect($resposta->json('pedidos'))->pluck('tipo')->sort()->values()->all();
        $this->assertSame(['produto', 'reserva'], $tipos);
        $this->assertTrue(collect($resposta->json('pedidos'))->every(fn ($p) => $p['quem_atende'] === 'Ana'));
        $this->assertSame(2, $resposta->json('resumo.em_aberto'));
    }

    public function test_painel_de_pedidos_e_negado_a_funcionario_e_cliente(): void
    {
        [$socio, $estab] = $this->socio();
        $funcionario = $this->usuario('funcionario', 'Atendente');
        $estab->proprietarios()->attach($funcionario->id, ['tipo' => 'funcionario']);
        $cliente = $this->usuario('cliente', 'Cliente');

        $this->actingAs($cliente)->getJson('/gestao/pedidos')->assertForbidden();
        $this->actingAs($funcionario)->getJson('/gestao/pedidos')->assertForbidden();
        $this->actingAs($socio)->get('/gestao/pedidos')->assertOk();
    }

    public function test_rotas_do_app_para_cobrancas_pedidos_e_comprovante(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $outro = $this->usuario('cliente', 'Outro');
        $cobranca = $this->cobrancaAceita($socio, $estab, $cliente);

        \Laravel\Sanctum\Sanctum::actingAs($socio);
        $this->getJson('/api/mobile/cobrancas')->assertOk()->assertJsonPath('cobrancas.0.id', $cobranca->id)->assertJsonPath('podeCriar', true);
        $this->getJson('/api/mobile/cobrancas/opcoes?estabelecimento_id=' . $estab->id)->assertOk()->assertJsonStructure(['servicos', 'reservas', 'funcionarios']);
        $this->getJson('/api/mobile/gestao/pedidos')->assertOk()->assertJsonStructure(['pedidos', 'resumo', 'estabelecimentos']);
        $pdf = $this->get('/api/mobile/cobrancas/' . $cobranca->id . '/comprovante-pdf');
        $pdf->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('content-type'));

        \Laravel\Sanctum\Sanctum::actingAs($cliente);
        $this->getJson('/api/mobile/minhas-cobrancas')->assertOk()->assertJsonPath('cobrancas.0.itens.0.funcionario.nome', 'Carlos');
        $this->get('/api/mobile/minhas-cobrancas/' . $cobranca->id . '/comprovante-pdf')->assertOk();
        $this->getJson('/api/mobile/gestao/pedidos')->assertForbidden();

        \Laravel\Sanctum\Sanctum::actingAs($outro);
        $this->get('/api/mobile/minhas-cobrancas/' . $cobranca->id . '/comprovante-pdf')->assertForbidden();
    }

    public function test_rotas_do_app_exigem_login(): void
    {
        $this->getJson('/api/mobile/minhas-cobrancas')->assertUnauthorized();
        $this->getJson('/api/mobile/cobrancas')->assertUnauthorized();
        $this->getJson('/api/mobile/gestao/pedidos')->assertUnauthorized();
    }

    public function test_tutoriais_incluem_produto_e_marcam_progresso(): void
    {
        [$socio, $estab] = $this->socio();

        $antes = $this->actingAs($socio)->get('/tutoriais?fluxo=produto');
        $antes->assertOk();
        $props = $antes->viewData('page')['props'];
        $this->assertSame('produto', $props['fluxoInicial']);
        $this->assertFalse($props['progresso']['produto']);

        ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Água 20L', 'categoria' => 'Gás e água',
            'valor' => 15, 'estoque_disponivel' => 5, 'ativo' => true, 'taxa_entrega' => 0,
            'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'SP', 'endereco_estado' => 'SP',
        ]);

        $this->assertTrue($this->actingAs($socio)->get('/tutoriais')->viewData('page')['props']['progresso']['produto']);
    }

    public function test_app_gerencia_produtos_com_servico_ou_reserva(): void
    {
        [$socio, $estab] = $this->socio();
        $servico = Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro',
            'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true,
        ]);
        \Laravel\Sanctum\Sanctum::actingAs($socio);

        $id = $this->postJson('/api/mobile/produtos', [
            'estabelecimento_id' => $estab->id, 'nome' => 'Pomada', 'valor_normal' => 30, 'estoque_disponivel' => 4,
            'servico_id' => $servico->id, 'is_promocao' => 0,
        ])->assertCreated()->json('id');

        $this->getJson('/api/mobile/meus-produtos')->assertOk()
            ->assertJsonPath('produtos.0.servico_nome', 'Corte')
            ->assertJsonPath('servicos.0.nome', 'Corte');

        $this->postJson("/api/mobile/produtos/{$id}", ['nome' => 'Pomada modeladora', 'valor_normal' => 35])->assertOk();
        $this->assertSame('Pomada modeladora', \App\Models\Produto::find($id)->nome);
        $this->assertEquals(35, (float) \App\Models\Produto::find($id)->valor_final);

        \Laravel\Sanctum\Sanctum::actingAs($this->usuario('socio', 'Outro'));
        $this->postJson("/api/mobile/produtos/{$id}", ['nome' => 'Invadido'])->assertForbidden();
        $this->deleteJson("/api/mobile/produtos/{$id}")->assertForbidden();

        \Laravel\Sanctum\Sanctum::actingAs($socio);
        $this->deleteJson("/api/mobile/produtos/{$id}")->assertOk();
        $this->assertNull(\App\Models\Produto::withTrashed()->find($id));
    }
}
