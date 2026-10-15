<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Models\Provider;
use App\Models\Servico;
use App\Models\User;
use App\Services\ComprovantePagamentoService;
use App\Services\DestaquePremiumService;
use App\Support\ContaFormal;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContaInformalComprovanteTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $documento = '52998224725'): User
    {
        return User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito', 'cpf_cnpj' => $documento,
        ]);
    }

    private function carteira(User $dono): Provider
    {
        return Provider::create([
            'user_id' => $dono->id, 'name' => 'Dono', 'email' => uniqid() . '@p.com', 'birth_date' => '1990-01-01',
            'document' => '11222333000181', 'pix_key_type' => 'CNPJ', 'pix_key' => '11222333000181',
            'person_type' => 'JURIDICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua A', 'address_number' => '1', 'province' => 'Centro', 'asaas_wallet_id' => 'wal_' . uniqid(),
        ]);
    }

    private function dadosCarteira(array $extra = []): array
    {
        return $extra + [
            'name' => 'Maria Silva', 'email' => uniqid() . '@p.com', 'person_type' => 'FISICA', 'document' => '52998224725',
            'birth_date' => '1990-01-01', 'income_value' => '3000', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua A', 'address_number' => '1', 'province' => 'Centro', 'pix_key_type' => 'CPF', 'pix_key' => '52998224725',
        ];
    }

    // ------------------------------------------------------------------ sócio informal

    public function test_valida_cnpj_pelos_digitos(): void
    {
        $this->assertTrue(ContaFormal::cnpjValido('11.222.333/0001-81'));
        $this->assertFalse(ContaFormal::cnpjValido('11.222.333/0001-80'));
        $this->assertFalse(ContaFormal::cnpjValido('11111111111111'));
        $this->assertFalse(ContaFormal::cnpjValido('52998224725'));
    }

    public function test_socio_sem_cnpj_nao_abre_carteira_no_web_nem_no_app(): void
    {
        Http::fake();
        $socio = $this->usuario('socio');
        Sanctum::actingAs($socio);

        $this->postJson('/api/provider', $this->dadosCarteira())->assertStatus(422)->assertJsonPath('codigo', ContaFormal::CODIGO);
        $this->postJson('/api/mobile/provider', $this->dadosCarteira())->assertStatus(422)->assertJsonPath('codigo', ContaFormal::CODIGO);
        // Pessoa jurídica com CNPJ inválido também não passa.
        $this->postJson('/api/provider', $this->dadosCarteira([
            'person_type' => 'JURIDICA', 'document' => '11222333000180', 'company_type' => 'MEI',
            'responsible_name' => 'Maria Silva', 'responsible_cpf' => '52998224725',
        ]))->assertStatus(422)->assertJsonPath('codigo', ContaFormal::CODIGO);

        Http::assertNothingSent();
        $this->assertFalse(Provider::where('user_id', $socio->id)->exists());
    }

    public function test_socio_informal_ve_aviso_proprio_no_painel(): void
    {
        $socio = $this->usuario('socio');
        Estabelecimento::create(['nome' => 'Barbearia ' . uniqid()])->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $this->assertTrue(ContaFormal::ehInformal($socio));

        $this->actingAs($socio)->get('/gestao/flash-deals')->assertOk()
            ->assertInertia(fn ($p) => $p->where('alertaCarteiraAsaas.informal', true));
    }

    // ------------------------------------------------------------------ ranking

    public function test_quem_aceita_pagamento_online_aparece_antes(): void
    {
        $comCarteira = $this->usuario('socio', '11222333000181');
        $this->carteira($comCarteira);
        $semCarteira = $this->usuario('socio');

        $online = Estabelecimento::create(['nome' => 'Online ' . uniqid(), 'ativo' => true]);
        $online->proprietarios()->attach($comCarteira->id, ['tipo' => 'socio']);
        $local = Estabelecimento::create(['nome' => 'Local ' . uniqid(), 'ativo' => true]);
        $local->proprietarios()->attach($semCarteira->id, ['tipo' => 'socio']);

        $destaque = app(DestaquePremiumService::class);
        $this->assertSame(2, $destaque->nivelDeDestaque($online->id));
        $this->assertSame(3, $destaque->nivelDeDestaque($local->id));

        $ordem = $destaque->ordenarPorDestaque(Estabelecimento::whereIn('id', [$local->id, $online->id]), 'estabelecimentos.id')
            ->orderBy('id')->pluck('id')->all();
        $this->assertSame([$online->id, $local->id], $ordem);
    }

    // ------------------------------------------------------------------ comprovante

    /** @return array{0: User, 1: User, 2: Pagamento, 3: Agendamento} cliente, sócio, pagamento, agendamento */
    private function pagamentoPago(string $status = 'pago'): array
    {
        $socio = $this->usuario('socio', '11222333000181');
        $local = Estabelecimento::create(['nome' => 'Studio Bela', 'cnpj' => '11222333000181', 'razao_social' => 'Studio Bela Ltda']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 600, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = $this->usuario('user', '52998224725');
        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '10:00', 'status' => 'confirmado', 'valor_final' => 600,
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'agendamento_id' => $agendamento->id,
            'gateway_pagamento' => 'Asaas', 'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 600, 'taxa' => 3,
            'valor_liquido' => 597, 'status' => $status, 'metodo_pagamento' => 'pix', 'data_pagamento' => now(),
        ]);

        return [$cliente, $socio, $pagamento, $agendamento];
    }

    public function test_cliente_e_socio_baixam_o_comprovante_e_estranho_nao(): void
    {
        [$cliente, $socio, $pagamento, $agendamento] = $this->pagamentoPago();

        $resposta = $this->actingAs($cliente)->get("/comprovante-pagamento?agendamento_id={$agendamento->id}")->assertOk();
        $this->assertSame('application/pdf', $resposta->headers->get('content-type'));
        $this->assertStringContainsString("Comprovante_pagamento_{$pagamento->id}.pdf", (string) $resposta->headers->get('content-disposition'));

        Sanctum::actingAs($socio);
        $this->get("/api/mobile/comprovante-pagamento?pagamento_id={$pagamento->id}")->assertOk();

        $this->actingAs($this->usuario('user'))->get("/comprovante-pagamento?pagamento_id={$pagamento->id}")->assertForbidden();
    }

    public function test_conteudo_do_comprovante_mascara_documentos_e_mostra_liquido_so_ao_recebedor(): void
    {
        [$cliente, $socio, $pagamento] = $this->pagamentoPago();
        $servico = app(ComprovantePagamentoService::class);

        $doCliente = $servico->dados($pagamento, $cliente);
        $this->assertSame('***.982.247-**', $doCliente['pagador']['documento']);
        $this->assertSame('11.***.***/****-81', $doCliente['recebedor']['documento']);
        $this->assertSame('STUDIO BELA LTDA', $doCliente['recebedor']['nome']);
        $this->assertSame('Pix', $doCliente['forma']);
        $this->assertNull($doCliente['detalhe_recebedor']);

        $doSocio = $servico->dados($pagamento, $socio);
        $this->assertEquals(597, $doSocio['detalhe_recebedor']['liquido']);
    }

    public function test_cada_um_recebe_so_a_sua_via(): void
    {
        [$cliente, $socio, $pagamento] = $this->pagamentoPago();
        $servico = app(ComprovantePagamentoService::class);

        $doCliente = $servico->dados($pagamento, $cliente, 'recebedor');
        $this->assertSame('pagador', $doCliente['via'], 'O cliente não consegue pedir a via do recebedor.');
        $this->assertSame('Comprovante do pagamento', $doCliente['titulo']);
        $this->assertNull($doCliente['detalhe_recebedor']);

        $doSocio = $servico->dados($pagamento, $socio, 'pagador');
        $this->assertSame('recebedor', $doSocio['via'], 'O sócio não consegue pedir a via do cliente.');
        $this->assertSame('Comprovante de recebimento', $doSocio['titulo']);

        Sanctum::actingAs($socio);
        $arquivo = (string) $this->get("/api/mobile/comprovante-pagamento?pagamento_id={$pagamento->id}&via=pagador")
            ->assertOk()->headers->get('content-disposition');
        $this->assertStringContainsString("Comprovante_recebimento_{$pagamento->id}.pdf", $arquivo);
    }

    public function test_socio_busca_por_periodo_agrupado_por_cliente(): void
    {
        [$cliente, $socio, $pagamento, $agendamento] = $this->pagamentoPago();
        $segundo = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $pagamento->estabelecimento_id, 'agendamento_id' => $agendamento->id,
            'gateway_pagamento' => 'Asaas', 'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 100, 'taxa' => 0.5,
            'valor_liquido' => 99.5, 'status' => 'pago', 'metodo_pagamento' => 'cartao', 'data_pagamento' => now(),
        ]);
        // Fora do período buscado: não aparece.
        Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $pagamento->estabelecimento_id, 'agendamento_id' => $agendamento->id,
            'gateway_pagamento' => 'Asaas', 'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 50, 'taxa' => 0,
            'valor_liquido' => 50, 'status' => 'pago', 'metodo_pagamento' => 'pix', 'data_pagamento' => now()->subMonths(3),
        ]);
        $hoje = now('America/Sao_Paulo')->toDateString();

        Sanctum::actingAs($socio);
        $this->getJson('/api/mobile/proprietario/pagamentos-recebidos')->assertStatus(422);

        $clientes = $this->getJson("/api/mobile/proprietario/pagamentos-recebidos?de={$hoje}&ate={$hoje}")->assertOk()->json('clientes');
        $this->assertCount(1, $clientes);
        $this->assertSame(2, $clientes[0]['quantidade']);
        $this->assertEquals(700, $clientes[0]['total']);
        $this->assertEqualsCanonicalizing([$pagamento->id, $segundo->id], array_column($clientes[0]['pagamentos'], 'id'));

        $nada = $this->getJson("/api/mobile/proprietario/pagamentos-recebidos?de={$hoje}&ate={$hoje}&busca=ninguem-com-esse-nome")->json('clientes');
        $this->assertSame([], $nada);

        $this->actingAs($cliente)->getJson("/api/pagamentos-recebidos?de={$hoje}&ate={$hoje}")->assertOk()->assertJsonCount(0, 'clientes');
    }

    public function test_baixar_todos_ou_os_escolhidos_num_pdf_so(): void
    {
        [$cliente, $socio, $pagamento, $agendamento] = $this->pagamentoPago();
        $segundo = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $pagamento->estabelecimento_id, 'agendamento_id' => $agendamento->id,
            'gateway_pagamento' => 'Asaas', 'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 100, 'taxa' => 0.5,
            'valor_liquido' => 99.5, 'status' => 'pago', 'metodo_pagamento' => 'pix', 'data_pagamento' => now(),
        ]);

        $pdf = $this->actingAs($socio)->get('/comprovantes-recebimento?' . http_build_query(['ids' => [$pagamento->id, $segundo->id]]));
        $pdf->assertOk();
        $this->assertStringContainsString('Comprovantes_recebimento_2.pdf', (string) $pdf->headers->get('content-disposition'));
        $this->assertGreaterThanOrEqual(2, preg_match_all('#/Type\s*/Page[^s]#', $pdf->getContent()), 'Um comprovante por página.');

        // Só o escolhido.
        $um = $this->actingAs($socio)->get('/comprovantes-recebimento?' . http_build_query(['ids' => [$segundo->id]]));
        $this->assertStringContainsString("Comprovante_recebimento_{$segundo->id}.pdf", (string) $um->headers->get('content-disposition'));

        // Pagamento de outro sócio no meio: recusa tudo.
        [, , $deOutro] = $this->pagamentoPago();
        $this->actingAs($socio)->get('/comprovantes-recebimento?' . http_build_query(['ids' => [$pagamento->id, $deOutro->id]]))->assertForbidden();
        // O cliente não usa o lote (é a via do recebedor).
        $this->actingAs($cliente)->get('/comprovantes-recebimento?' . http_build_query(['ids' => [$pagamento->id]]))->assertForbidden();
    }

    public function test_pagamento_nao_confirmado_nao_tem_comprovante(): void
    {
        [$cliente, , $pagamento] = $this->pagamentoPago('pendente');

        $this->actingAs($cliente)->get("/comprovante-pagamento?pagamento_id={$pagamento->id}")->assertNotFound();
    }

    public function test_codigo_de_autenticacao_e_conferido_publicamente(): void
    {
        [, , $pagamento] = $this->pagamentoPago();
        $codigo = app(ComprovantePagamentoService::class)->codigo($pagamento);

        $this->get('/comprovantes/verificar?codigo=' . $codigo)->assertOk()->assertSee('Comprovante autêntico')->assertSee('600,00');

        // Código adulterado (ou de outro valor) não confere.
        $falso = substr($codigo, 0, -1) . (str_ends_with($codigo, 'A') ? 'B' : 'A');
        $this->get('/comprovantes/verificar?codigo=' . $falso)->assertOk()->assertSee('Código não encontrado');

        $pagamento->update(['valor' => 1]);
        $this->get('/comprovantes/verificar?codigo=' . $codigo)->assertOk()->assertSee('Código não encontrado');
    }

    public function test_carteira_fica_aguardando_liberacao_e_abre_sozinha_quando_o_asaas_liberar(): void
    {
        $socio = $this->usuario('socio', '11222333000181');
        Sanctum::actingAs($socio);
        $dados = $this->dadosCarteira([
            'person_type' => 'JURIDICA', 'document' => '11222333000181', 'company_type' => 'MEI',
            'responsible_name' => 'Maria Silva', 'responsible_cpf' => '52998224725',
        ]);

        // Asaas recusa por limite de subcontas: o pedido fica salvo, sem quebrar o cadastro.
        $liberado = false;
        Http::fake(function () use (&$liberado) {
            return $liberado
                ? Http::response(['walletId' => 'wal_liberada', 'apiKey' => 'chave', 'status' => 'PENDING'], 200)
                : Http::response(['message' => 'limite', 'code' => 'baas_trial_limit_child_account_creation_reached'], 403);
        });
        $this->postJson('/api/provider', $dados)->assertStatus(202)->assertJsonPath('aguardando_liberacao', true);

        $provider = Provider::where('user_id', $socio->id)->firstOrFail();
        $this->assertSame('AGUARDANDO_LIBERACAO', $provider->asaas_status);
        $this->assertNull($provider->asaas_wallet_id);

        // Reenviar com o mesmo e-mail não dá "e-mail já usado" e não duplica.
        $this->postJson('/api/mobile/provider', $dados)->assertStatus(202);
        $this->assertSame(1, Provider::where('user_id', $socio->id)->count());

        // O Asaas libera: o comando abre a carteira sozinho.
        $liberado = true;
        \Illuminate\Support\Facades\Mail::fake();
        $this->artisan('carteira:abrir-pendentes')->assertSuccessful();

        $provider->refresh();
        $this->assertSame('wal_liberada', $provider->asaas_wallet_id);
        $this->assertSame('PENDING', $provider->asaas_status);
    }
}
