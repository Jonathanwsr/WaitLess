<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EntregasRecursosPaginasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome = 'Usuario'): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
        ]);
    }

    public function test_paginas_web_dos_recursos_carregam(): void
    {
        $socio = $this->usuario('socio', 'Socio');
        $cliente = $this->usuario('user', 'Cliente');

        $this->actingAs($socio)->get('/entregas/painel-de-vendas')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/PainelVendasEntregas'));

        $this->actingAs($cliente)->get('/entregas/minhas-assinaturas')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Entregas/Assinaturas'));
    }

    public function test_pedido_concluido_informa_pontos_e_avaliacao_para_a_tela(): void
    {
        $socio = $this->usuario('socio', 'Vendedor');
        $estab = Estabelecimento::create(['nome' => 'Loja Tela ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Água',
            'categoria' => 'Alimentos', 'valor' => 50, 'estoque_disponivel' => 5, 'ativo' => true,
            'taxa_entrega' => 0, 'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'SP', 'endereco_estado' => 'SP',
        ]);
        $cliente = $this->usuario('user', 'Cliente');
        PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TELA-' . uniqid(), 'codigo_confirmacao' => '000111', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $socio->id, 'estabelecimento_id' => $estab->id,
            'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'local', 'status' => 'concluido', 'data_conclusao' => now(),
        ]);

        $this->actingAs($cliente)->get('/entregas/meus-pedidos')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Entregas/MeusPedidos')
                ->where('pedidos.0.pontos_ganhos', 25)
                ->where('pedidos.0.avaliado', false)
                ->where('pedidos.0.em_rota', false));
    }
}
