<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Conversa;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\ItemAluguel;
use App\Models\ProdutoEntrega;
use App\Models\Servico;
use App\Models\User;
use App\Services\DestaquePremiumService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConversaEDestaqueTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user', ?string $plano = null): User
    {
        return User::create([
            'name' => 'Pessoa ' . uniqid(), 'email' => 'p' . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito',
            'plano_expira_em' => $plano ? now()->addMonth() : null,
        ]);
    }

    private function local(?User $dono = null): array
    {
        $dono ??= $this->usuario('socio');
        $estab = Estabelecimento::create(['nome' => 'Local ' . uniqid(), 'cidade' => 'São Paulo', 'estado' => 'SP']);
        $estab->proprietarios()->attach($dono->id, ['tipo' => 'socio']);

        return [$dono, $estab];
    }

    private function servico(Estabelecimento $estab, bool $aceitaPontos = false): Servico
    {
        return Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'Serviço ' . uniqid(), 'tipo_servico' => 'Outro', 'valor' => 50,
            'duracao_minutos' => 30, 'ativo' => true, 'aceita_pontos' => $aceitaPontos,
        ]);
    }

    private function agendamento(User $cliente, Estabelecimento $estab): Agendamento
    {
        $servico = $this->servico($estab);

        return Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDay()->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 50,
        ]);
    }

    // ------------------------------------------------------------ conversa

    public function test_cliente_nao_abre_conversa_em_nome_de_outra_pessoa(): void
    {
        [, $estab] = $this->local();
        $cliente = $this->usuario();
        $vitima = $this->usuario();

        $this->actingAs($cliente)->post('/mensagens/iniciar', ['usuario_id' => $vitima->id, 'estabelecimento_id' => $estab->id])->assertForbidden();
        $this->assertSame(0, Conversa::where('usuario_id', $vitima->id)->count());
    }

    public function test_cliente_nao_usa_agendamento_de_outra_pessoa(): void
    {
        [, $estab] = $this->local();
        $cliente = $this->usuario();
        $agendamentoAlheio = $this->agendamento($this->usuario(), $estab);

        $this->actingAs($cliente)->post('/mensagens/iniciar', [
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'agendamento_id' => $agendamentoAlheio->id,
        ])->assertForbidden();
    }

    public function test_agendamento_precisa_ser_do_local_informado(): void
    {
        [, $estab] = $this->local();
        [, $outroLocal] = $this->local();
        $cliente = $this->usuario();
        $agendamento = $this->agendamento($cliente, $estab);

        $this->actingAs($cliente)->post('/mensagens/iniciar', [
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $outroLocal->id, 'agendamento_id' => $agendamento->id,
        ])->assertForbidden();
    }

    public function test_profissional_precisa_ser_do_local(): void
    {
        [, $estab] = $this->local();
        [, $outroLocal] = $this->local();
        $funcionarioAlheio = Funcionario::create(['estabelecimento_id' => $outroLocal->id, 'nome' => 'Fulano', 'ativo' => true]);
        $cliente = $this->usuario();

        Sanctum::actingAs($cliente);
        $this->postJson('/api/mobile/mensagens/iniciar', ['estabelecimento_id' => $estab->id, 'funcionario_id' => $funcionarioAlheio->id])->assertForbidden();
    }

    public function test_equipe_do_local_abre_conversa_com_cliente(): void
    {
        [$dono, $estab] = $this->local();
        $cliente = $this->usuario();

        $this->actingAs($dono)->post('/mensagens/iniciar', ['usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id])->assertRedirect();
        $this->assertSame(1, Conversa::where('usuario_id', $cliente->id)->where('estabelecimento_id', $estab->id)->count());
    }

    public function test_cliente_abre_conversa_do_proprio_agendamento_na_web_e_no_app(): void
    {
        [, $estab] = $this->local();
        $cliente = $this->usuario();
        $agendamento = $this->agendamento($cliente, $estab);

        $this->actingAs($cliente)->post('/mensagens/iniciar', [
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'agendamento_id' => $agendamento->id,
        ])->assertRedirect();

        Sanctum::actingAs($cliente);
        $this->postJson('/api/mobile/mensagens/iniciar', ['estabelecimento_id' => $estab->id, 'agendamento_id' => $agendamento->id])->assertOk();

        $this->assertSame(1, Conversa::where('usuario_id', $cliente->id)->where('agendamento_id', $agendamento->id)->count());
    }

    // ------------------------------------------------------------ destaque

    public function test_ordem_premium_depois_quem_aceita_pontos_depois_os_demais(): void
    {
        [, $comum] = $this->local();
        [, $comPontos] = $this->local();
        [, $comMaisPontos] = $this->local();
        [, $premium] = $this->local($this->usuario('socio', 'premium-socio'));

        $this->servico($comum);
        $this->servico($comPontos, true);
        $this->servico($comMaisPontos, true);
        $this->servico($comMaisPontos, true);
        $this->servico($premium);

        $ids = [$comum->id, $comPontos->id, $comMaisPontos->id, $premium->id];
        $query = Estabelecimento::whereIn('id', $ids);
        app(DestaquePremiumService::class)->ordenarPorDestaque($query, 'estabelecimentos.id');

        $this->assertSame([$premium->id, $comMaisPontos->id, $comPontos->id, $comum->id], $query->pluck('id')->all());
    }

    public function test_reservas_com_pontos_contam_para_o_dono(): void
    {
        $dono = $this->usuario('socio');
        ItemAluguel::create([
            'estabelecimento_id' => $dono->id, 'nome' => 'Quadra', 'categoria' => 'quadra',
            'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 80, 'quantidade' => 1,
            'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true, 'aceita_pontos' => true,
        ]);

        $servico = app(DestaquePremiumService::class);

        $this->assertSame(1, $servico->nivelDeDestaque($dono->id, 'usuario'));
        $this->assertSame(1, $servico->itensComPontos($dono->id, 'usuario'));
    }

    public function test_catalogo_de_produtos_poe_vendedor_que_aceita_pontos_antes(): void
    {
        [$donoComum, $estabComum] = $this->local();
        [$donoPontos, $estabPontos] = $this->local();
        $this->servico($estabPontos, true);

        $produto = fn (User $dono, Estabelecimento $estab, string $nome) => ProdutoEntrega::create([
            'usuario_id' => $dono->id, 'estabelecimento_id' => $estab->id, 'nome' => $nome, 'categoria' => 'Outros',
            'valor' => 10, 'estoque_disponivel' => 5, 'ativo' => true, 'taxa_entrega' => 0,
            'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'SP', 'endereco_estado' => 'SP',
        ]);
        $produto($donoPontos, $estabPontos, 'Produto destaque ' . uniqid());
        $produto($donoComum, $estabComum, 'Produto comum ' . uniqid()); // mais recente, mas sem pontos

        $nomes = collect($this->actingAs($this->usuario())->getJson('/entregas/catalogo?busca=produto&estado=SP')->json('data'))
            ->pluck('nome')
            ->filter(fn ($n) => str_starts_with($n, 'Produto destaque') || str_starts_with($n, 'Produto comum'))
            ->values();

        $this->assertStringStartsWith('Produto destaque', $nomes[0]);
    }
}
