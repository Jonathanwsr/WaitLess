<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Promocao;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PromocaoVinculadaTest extends TestCase
{
    use DatabaseTransactions;

    private function criarAdmin(): User
    {
        return User::create(['name' => 'Admin Promo', 'email' => 'admin-promo' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'admin']);
    }

    private function criarCliente(): User
    {
        return User::create(['name' => 'Cliente Promo', 'email' => 'cliente-promo' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
    }

    private function criarServico(): Servico
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Promo ' . uniqid()]);

        return Servico::create([
            'estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte Premium', 'tipo_servico' => 'Outro',
            'valor' => 80, 'duracao_minutos' => 40, 'ativo' => true,
        ]);
    }

    public function test_admin_pode_criar_promocao_vinculada_a_um_servico(): void
    {
        $admin = $this->criarAdmin();
        $servico = $this->criarServico();

        $response = $this->actingAs($admin)->post('/admin/promocoes', [
            'nome' => 'Corte com desconto', 'tipo' => 'oferta_assinantes', 'publico_alvo' => 'todos',
            'data_inicio' => now()->toDateString(), 'ativo' => true,
            'servico_id' => $servico->id,
        ]);

        $response->assertRedirect();
        $promo = Promocao::where('nome', 'Corte com desconto')->first();
        $this->assertNotNull($promo);
        $this->assertSame($servico->id, $promo->servico_id);
        $this->assertNull($promo->item_aluguel_id);
    }

    public function test_promocao_nao_aceita_vinculo_a_servico_e_item_aluguel_ao_mesmo_tempo(): void
    {
        $admin = $this->criarAdmin();
        $servico = $this->criarServico();
        $estabelecimento = Estabelecimento::create(['nome' => 'Loc Promo ' . uniqid()]);
        $item = ItemAluguel::create(['estabelecimento_id' => $admin->id, 'nome' => 'Bicicleta', 'categoria' => 'equipamento', 'valor_diaria' => 50, 'ativo' => true, 'disponivel' => true]);

        $response = $this->actingAs($admin)->post('/admin/promocoes', [
            'nome' => 'Promo invalida', 'tipo' => 'oferta_assinantes', 'publico_alvo' => 'todos',
            'data_inicio' => now()->toDateString(), 'ativo' => true,
            'servico_id' => $servico->id, 'item_aluguel_id' => $item->id,
        ]);

        $response->assertSessionHasErrors(['servico_id', 'item_aluguel_id']);
    }

    public function test_cliente_ve_vinculo_com_estabelecimento_correto_para_promocao_de_servico(): void
    {
        $admin = $this->criarAdmin();
        $cliente = $this->criarCliente();
        $servico = $this->criarServico();

        Promocao::create([
            'nome' => 'Oferta do mes', 'tipo' => 'oferta_assinantes', 'publico_alvo' => 'todos',
            'data_inicio' => now()->subDay()->toDateString(), 'ativo' => true,
            'servico_id' => $servico->id, 'criado_por' => $admin->id,
        ]);

        $response = $this->actingAs($cliente)->get('/mobile/promocoes');
        // rota web espelhada pela mesma lógica: usamos a tela do cliente diretamente
        $dados = \App\Http\Controllers\Api\ClientePromocaoController::montarLista($cliente);

        $promo = collect($dados)->firstWhere('nome', 'Oferta do mes');
        $this->assertNotNull($promo);
        $this->assertSame('servico', $promo['vinculo']['tipo']);
        $this->assertSame($servico->id, $promo['vinculo']['id']);
        $this->assertSame($servico->estabelecimento_id, $promo['vinculo']['estabelecimento_id']);
    }

    public function test_vinculo_fica_nulo_quando_servico_vinculado_esta_inativo(): void
    {
        $admin = $this->criarAdmin();
        $cliente = $this->criarCliente();
        $servico = $this->criarServico();
        $servico->update(['ativo' => false]);

        Promocao::create([
            'nome' => 'Oferta expirada de item', 'tipo' => 'oferta_assinantes', 'publico_alvo' => 'todos',
            'data_inicio' => now()->subDay()->toDateString(), 'ativo' => true,
            'servico_id' => $servico->id, 'criado_por' => $admin->id,
        ]);

        $dados = \App\Http\Controllers\Api\ClientePromocaoController::montarLista($cliente);
        $promo = collect($dados)->firstWhere('nome', 'Oferta expirada de item');

        $this->assertNotNull($promo);
        $this->assertNull($promo['vinculo']);
    }

    public function test_admin_busca_itens_por_nome_para_vincular(): void
    {
        $admin = $this->criarAdmin();
        $this->criarServico(); // "Corte Premium"

        $response = $this->actingAs($admin)->get('/admin/promocoes/buscar-itens?q=Corte');

        $response->assertOk();
        $response->assertJsonFragment(['tipo' => 'servico', 'nome' => 'Corte Premium']);
    }

    public function test_explorar_so_mostra_promocao_vinculada_compativel_com_a_aba_ativa(): void
    {
        $admin = $this->criarAdmin();
        $cliente = $this->criarCliente();
        $servico = $this->criarServico();

        Promocao::create([
            'nome' => 'Oferta de servico no explorar', 'tipo' => 'oferta_assinantes', 'publico_alvo' => 'todos',
            'data_inicio' => now()->subDay()->toDateString(), 'ativo' => true,
            'servico_id' => $servico->id, 'criado_por' => $admin->id,
        ]);

        $respostaServicos = $this->actingAs($cliente)->get('/explorar?tipo_busca=servicos');
        $respostaServicos->assertInertia(fn ($page) => $page->has('promocoesDestaque', 1));

        $respostaReservas = $this->actingAs($cliente)->get('/explorar?tipo_busca=reservas');
        $respostaReservas->assertInertia(fn ($page) => $page->has('promocoesDestaque', 0));
    }
}
