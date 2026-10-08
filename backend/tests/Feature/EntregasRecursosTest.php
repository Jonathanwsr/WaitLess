<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\AssinaturaEntrega;
use App\Models\Estabelecimento;
use App\Models\NotificacaoUsuario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\User;
use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EntregasRecursosTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome = 'Usuario'): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
        ]);
    }

    private function produto(User $vendedor, ?Estabelecimento $estab = null): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estab?->id, 'nome' => 'Gás P13',
            'categoria' => 'Gás e água', 'valor' => 100, 'estoque_disponivel' => 20, 'ativo' => true,
            'taxa_entrega' => 5, 'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua A', 'endereco_numero' => '1',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
    }

    private function pedido(User $cliente, ProdutoEntrega $produto, array $extra = []): PedidoEntrega
    {
        return PedidoEntrega::create(array_merge([
            'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '123456', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $produto->usuario_id,
            'estabelecimento_id' => $produto->estabelecimento_id, 'quantidade' => 1, 'valor_unitario' => 100,
            'valor_total' => 100, 'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local',
            'status' => 'concluido', 'data_conclusao' => now('America/Sao_Paulo'),
        ], $extra));
    }

    public function test_recompra_sugere_produto_comprado_com_regularidade(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');

        $this->pedido($cliente, $produto, ['data_conclusao' => now('America/Sao_Paulo')->subDays(40)]);
        $this->pedido($cliente, $produto, ['data_conclusao' => now('America/Sao_Paulo')->subDays(10)]);

        $sugestoes = app(EntregasRecursosService::class)->sugestoesDeRecompra($cliente);

        $this->assertCount(1, $sugestoes);
        $this->assertSame(30, $sugestoes[0]['intervalo_dias']);
        $this->assertFalse($sugestoes[0]['pronta_para_repetir']);
    }

    public function test_lembrete_de_recompra_avisa_so_uma_vez_por_dia(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        $this->pedido($cliente, $produto, ['data_conclusao' => now('America/Sao_Paulo')->subDays(20)]);
        $this->pedido($cliente, $produto, ['data_conclusao' => now('America/Sao_Paulo')->subDays(10)]);

        $servico = app(EntregasRecursosService::class);
        $this->assertSame(1, $servico->enviarLembretesDeRecompra());
        $this->assertSame(0, $servico->enviarLembretesDeRecompra());
        $this->assertTrue(NotificacaoUsuario::where('usuario_id', $cliente->id)->where('titulo', 'Hora de repor')->exists());
    }

    public function test_pontos_sao_concedidos_uma_unica_vez_por_entrega(): void
    {
        $vendedor = $this->usuario('socio');
        $estab = Estabelecimento::create(['nome' => 'Loja Pontos ' . uniqid()]);
        $produto = $this->produto($vendedor, $estab);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto, ['valor_total' => 135.90]);

        $servico = app(EntregasRecursosService::class);
        $this->assertSame(67, $servico->concederPontos($pedido));
        $this->assertSame(0, $servico->concederPontos($pedido->fresh()));

        $this->assertSame(67, (int) \DB::table('pontos_usuario_estabelecimento')
            ->where('usuario_id', $cliente->id)->where('estabelecimento_id', $estab->id)->value('total_pontos'));
    }

    public function test_avaliacao_so_depois_da_entrega_e_uma_vez(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        $entregue = $this->pedido($cliente, $produto);
        $pendente = $this->pedido($cliente, $produto, ['status' => 'aguardando_confirmacao', 'data_conclusao' => null]);

        $dados = ['nota_produto' => 5, 'nota_vendedor' => 4, 'comentario' => 'Muito bom'];

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pendente->id}/avaliar", $dados)->assertStatus(409);
        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$entregue->id}/avaliar", $dados)->assertCreated();
        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$entregue->id}/avaliar", $dados)->assertStatus(409);
    }

    public function test_painel_de_vendas_soma_faturamento_e_produtos_mais_vendidos(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        $this->pedido($cliente, $produto, ['valor_total' => 100, 'quantidade' => 1]);
        $this->pedido($cliente, $produto, ['valor_total' => 300, 'quantidade' => 3]);

        $painel = app(EntregasRecursosService::class)->painelDeVendas($vendedor, 30);

        $this->assertSame(400.0, $painel['faturamento']);
        $this->assertSame(2, $painel['pedidos']);
        $this->assertSame(200.0, $painel['ticket_medio']);
        $this->assertSame(4, $painel['top_produtos'][0]['unidades']);
    }

    public function test_vendedor_envia_posicao_e_cliente_acompanha(): void
    {
        $vendedor = User::create([
            'name' => 'Socio Premium', 'email' => 'sp' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => 'socio', 'plano_assinatura' => 'premium-socio', 'plano_expira_em' => now('America/Sao_Paulo')->addMonth(),
        ]);
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto, ['status' => 'aguardando_confirmacao', 'data_conclusao' => null, 'modo_recebimento' => 'entrega']);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/posicao", ['lat' => -23.55, 'lng' => -46.63])->assertOk();

        $this->actingAs($cliente)->getJson("/entregas/pedidos/{$pedido->id}/posicao")
            ->assertOk()
            ->assertJsonPath('em_rota', true);
    }

    public function test_assinatura_gera_entrega_vencida_e_avanca_a_proxima_data(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');

        $this->actingAs($cliente)->postJson('/entregas/assinaturas', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'frequencia_dias' => 30,
            'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local',
            'proxima_entrega_em' => now('America/Sao_Paulo')->toDateString(),
        ])->assertCreated();

        $assinatura = AssinaturaEntrega::where('cliente_id', $cliente->id)->firstOrFail();
        $geradas = app(EntregasRecursosService::class)->processarAssinaturasVencidas();

        $this->assertSame(1, $geradas);
        $this->assertTrue(PedidoEntrega::where('cliente_id', $cliente->id)->where('status', 'aguardando_confirmacao')->exists());
        $this->assertSame(now('America/Sao_Paulo')->addDays(30)->toDateString(), $assinatura->fresh()->proxima_entrega_em->toDateString());
    }

    public function test_assinatura_pausada_nao_gera_entrega(): void
    {
        $vendedor = $this->usuario('socio');
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        $assinatura = AssinaturaEntrega::create([
            'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id, 'quantidade' => 1,
            'frequencia_dias' => 7, 'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local',
            'proxima_entrega_em' => now('America/Sao_Paulo')->toDateString(), 'status' => 'pausada',
        ]);

        $this->assertSame(0, app(EntregasRecursosService::class)->processarAssinaturasVencidas());
        $this->assertSame('pausada', $assinatura->fresh()->status);
    }

    public function test_avisa_cliente_quando_faltam_dois_atendimentos_ou_menos(): void
    {
        $socio = $this->usuario('socio');
        $estab = Estabelecimento::create(['nome' => 'Barbearia Fila ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $clientes = [];
        foreach (['08:00:00', '08:20:00', '08:40:00', '09:00:00'] as $i => $hora) {
            $clientes[$i] = $this->usuario('user', "Cliente {$i}");
            Agendamento::create([
                'usuario_id' => $clientes[$i]->id, 'estabelecimento_id' => $estab->id,
                'data_agendamento' => now('America/Sao_Paulo')->toDateString(), 'hora_agendamento' => $hora,
                'status' => 'pendente', 'status_pagamento' => 'pendente', 'valor_final' => 30,
            ]);
        }

        $enviados = app(EntregasRecursosService::class)->avisarVezNaFila();

        $this->assertSame(3, $enviados); // posições 0, 1 e 2 na frente; a 4ª (3 na frente) ainda não
        $this->assertFalse(NotificacaoUsuario::where('usuario_id', $clientes[3]->id)->exists());
        $this->assertTrue(NotificacaoUsuario::where('usuario_id', $clientes[2]->id)->exists());
    }
}
