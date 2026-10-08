<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\NotificacaoUsuario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MobileEntregasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome = 'Usuario'): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
        ]);
    }

    private function vendedor(bool $comCarteira): array
    {
        $socio = $this->usuario('socio', 'Vendedor');
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_api_key' => 'k_' . uniqid(), 'asaas_wallet_id' => $comCarteira ? 'wal_' . uniqid() : null,
        ]);

        return [$socio, $estabelecimento];
    }

    private function produto(User $vendedor, ?Estabelecimento $estabelecimento = null): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estabelecimento?->id,
            'nome' => 'Água 20L', 'categoria' => 'Alimentos', 'valor' => 30, 'estoque_disponivel' => 10,
            'ativo' => true, 'taxa_entrega' => 5, 'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua da Água', 'endereco_numero' => '5',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
    }

    public function test_catalogo_mobile_filtra_por_categoria_e_informa_pagamento_online(): void
    {
        [$comCarteira] = $this->vendedor(true);
        $this->produto($comCarteira);
        [$semCarteira] = $this->vendedor(false);
        $this->produto($semCarteira);

        Sanctum::actingAs($this->usuario('user', 'Cliente'));

        $itens = collect($this->getJson('/api/mobile/entregas/catalogo?categoria=Alimentos')->assertOk()->json('data'))
            ->keyBy('usuario_id');

        $this->assertCount(2, $itens);
        $this->assertTrue((bool) $itens[$comCarteira->id]['aceita_pagamento_online']);
        $this->assertFalse((bool) $itens[$semCarteira->id]['aceita_pagamento_online']);
    }

    public function test_carrinho_de_produto_pelo_mobile_aparece_na_lista(): void
    {
        [$vendedor] = $this->vendedor(false);
        $produto = $this->produto($vendedor);
        $cliente = $this->usuario('user', 'Cliente');
        Sanctum::actingAs($cliente);

        $this->postJson('/api/mobile/entregas/carrinho', ['produto_entrega_id' => $produto->id, 'quantidade' => 2])
            ->assertCreated();

        $this->getJson('/api/mobile/carrinho')->assertOk()
            ->assertJsonPath('produtos_entrega.0.quantidade', 2);
    }

    public function test_favoritar_produto_pelo_mobile_aparece_em_favoritos(): void
    {
        [$vendedor] = $this->vendedor(false);
        $produto = $this->produto($vendedor);
        Sanctum::actingAs($this->usuario('user', 'Cliente'));

        $this->postJson('/api/mobile/favoritos/toggle', ['tipo' => 'produto_entrega', 'id' => $produto->id])
            ->assertOk()->assertJsonPath('is_favorito', true);

        $this->getJson('/api/mobile/favoritos')->assertOk()
            ->assertJsonPath('produtos_entrega.0.id', $produto->id);
    }

    public function test_pagamento_online_sem_carteira_retorna_erro_em_json_sem_criar_pedido(): void
    {
        [$semCarteira] = $this->vendedor(false);
        $produto = $this->produto($semCarteira);
        Sanctum::actingAs($this->usuario('user', 'Cliente'));

        $this->postJson('/api/mobile/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'online', 'metodo_pagamento' => 'pix',
        ])->assertStatus(422)->assertJsonPath('error', fn ($m) => str_contains($m, 'pagamentos online'));

        $this->assertDatabaseCount('pedidos_entrega', 0);
    }

    public function test_vendedor_confirma_entrega_pelo_mobile_e_soma_produtos_vendidos(): void
    {
        [$vendedor, $estabelecimento] = $this->vendedor(false);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-M-' . uniqid(), 'codigo_confirmacao' => '271828', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $vendedor->id, 'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 3, 'valor_unitario' => 30, 'valor_total' => 90, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'local', 'status' => 'aguardando_confirmacao',
        ]);

        Sanctum::actingAs($vendedor);
        $this->postJson("/api/mobile/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '271828'])->assertOk();

        $this->assertSame(3, (int) $vendedor->fresh()->produtos_vendidos);
        Sanctum::actingAs($vendedor->fresh());
        $this->getJson('/api/mobile/perfil/produtos-vendidos')->assertOk()
            ->assertJsonPath('produtos_vendidos', 3);
    }

    public function test_avisos_mobile_listam_e_marcam_como_lidos(): void
    {
        $dono = $this->usuario('socio', 'Dono');
        NotificacaoUsuario::avisar($dono->id, 'Produto removido pela Lokyva', 'Motivo de teste.');
        Sanctum::actingAs($dono);

        $aviso = $this->getJson('/api/mobile/avisos')->assertOk()->json('avisos.0');
        $this->assertSame('Produto removido pela Lokyva', $aviso['titulo']);

        $this->postJson("/api/mobile/avisos/{$aviso['id']}/lido")->assertOk();
        $this->getJson('/api/mobile/avisos')->assertOk()->assertJsonCount(0, 'avisos');
    }

    public function test_vendedor_vincula_produto_a_um_local_e_volta_para_avulso(): void
    {
        [$vendedor, $estabelecimento] = $this->vendedor(false);
        $produto = $this->produto($vendedor);
        Sanctum::actingAs($vendedor);

        $this->postJson("/api/mobile/produtos-entrega/{$produto->id}/vincular-local", ['estabelecimento_id' => $estabelecimento->id])
            ->assertOk();
        $this->assertSame($estabelecimento->id, $produto->fresh()->estabelecimento_id);

        $this->postJson("/api/mobile/produtos-entrega/{$produto->id}/vincular-local", ['estabelecimento_id' => null])
            ->assertOk();
        $this->assertNull($produto->fresh()->estabelecimento_id);
    }
}
