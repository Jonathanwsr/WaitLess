<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use App\Models\Viagem;
use App\Services\Viagem\DescontoGrupoService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DescontoGrupoViagemTest extends TestCase
{
    use DatabaseTransactions;

    private function criarCenario(): array
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Estabelecimento Grupo ' . uniqid()]);
        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Passeio', 'tipo_servico' => 'Outro',
            'valor' => 100, 'duracao_minutos' => 60, 'ativo' => true,
        ]);

        $criador = User::create(['name' => 'Criador', 'email' => 'criador' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $membro = User::create(['name' => 'Membro', 'email' => 'membro' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $viagem = Viagem::create([
            'criador_id' => $criador->id, 'titulo' => 'Viagem Teste', 'destino' => 'Praia',
            'data_inicio' => now()->addDays(2)->toDateString(), 'data_fim' => now()->addDays(5)->toDateString(),
            'quantidade_pessoas' => 2, 'status' => 'planejando', 'codigo_convite' => 'TST' . rand(10000, 99999),
        ]);
        $viagem->membros()->attach($membro->id, ['funcao' => 'membro', 'presenca' => 'confirmado']);

        return compact('estabelecimento', 'servico', 'criador', 'membro', 'viagem');
    }

    public function test_primeira_pessoa_a_reservar_nao_tem_desconto_de_grupo(): void
    {
        ['servico' => $servico, 'criador' => $criador, 'viagem' => $viagem] = $this->criarCenario();

        $resultado = (new DescontoGrupoService())->calcular($viagem, (float) $servico->valor, $servico->id, null, $criador->id);

        $this->assertFalse($resultado['elegivel']);
        $this->assertSame(1, $resultado['participantes']);
        $this->assertSame(100.0, $resultado['valor_final']);
    }

    public function test_segunda_pessoa_do_grupo_ganha_desconto_quando_a_primeira_ja_reservou(): void
    {
        ['servico' => $servico, 'criador' => $criador, 'membro' => $membro, 'viagem' => $viagem, 'estabelecimento' => $estabelecimento] = $this->criarCenario();

        Agendamento::create([
            'usuario_id' => $criador->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(3)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 100,
        ]);

        $resultado = (new DescontoGrupoService())->calcular($viagem, (float) $servico->valor, $servico->id, null, $membro->id);

        $this->assertTrue($resultado['elegivel']);
        $this->assertSame(2, $resultado['participantes']);
        $this->assertSame(10.0, $resultado['desconto']);
        $this->assertSame(90.0, $resultado['valor_final']);
    }

    public function test_reserva_cancelada_do_outro_membro_nao_conta_para_o_grupo(): void
    {
        ['servico' => $servico, 'criador' => $criador, 'membro' => $membro, 'viagem' => $viagem, 'estabelecimento' => $estabelecimento] = $this->criarCenario();

        Agendamento::create([
            'usuario_id' => $criador->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(3)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'cancelado', 'status_pagamento' => 'cancelado', 'valor_final' => 100,
        ]);

        $resultado = (new DescontoGrupoService())->calcular($viagem, (float) $servico->valor, $servico->id, null, $membro->id);

        $this->assertFalse($resultado['elegivel'], 'Uma reserva cancelada não deve contar para o desconto de grupo.');
    }

    public function test_quem_nao_e_membro_da_viagem_nao_conta_para_o_grupo(): void
    {
        ['servico' => $servico, 'membro' => $membro, 'viagem' => $viagem, 'estabelecimento' => $estabelecimento] = $this->criarCenario();

        $estranho = User::create(['name' => 'Estranho', 'email' => 'estranho' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        Agendamento::create([
            'usuario_id' => $estranho->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(3)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 100,
        ]);

        $resultado = (new DescontoGrupoService())->calcular($viagem, (float) $servico->valor, $servico->id, null, $membro->id);

        $this->assertFalse($resultado['elegivel'], 'Reserva de quem não participa da viagem não pode contar como "grupo".');
    }

    public function test_usuario_consegue_reservar_em_grupo_via_endpoint_web_e_recebe_pontos_de_bonus(): void
    {
        ['servico' => $servico, 'criador' => $criador, 'membro' => $membro, 'viagem' => $viagem, 'estabelecimento' => $estabelecimento] = $this->criarCenario();

        Agendamento::create([
            'usuario_id' => $criador->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(3)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 100,
        ]);

        $saldoAntes = $membro->pontos_saldo ?? 0;

        $response = $this->actingAs($membro)->post("/agendar/{$estabelecimento->id}", [
            'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(3)->toDateString(),
            'hora_agendamento' => '11:00',
            'forma_pagamento' => 'presencial',
            'viagem_id' => $viagem->id,
        ]);

        $response->assertRedirect();

        $agendamento = Agendamento::where('usuario_id', $membro->id)->where('servico_id', $servico->id)->latest()->first();
        $this->assertNotNull($agendamento);
        $this->assertSame(90.0, (float) $agendamento->valor_final, 'Desconto de grupo de 10% deveria ter sido aplicado (R$100 -> R$90).');

        $membro->refresh();
        $this->assertSame($saldoAntes + DescontoGrupoService::PONTOS_BONUS, $membro->pontos_saldo, 'Pontos de bônus por reservar em grupo deveriam ter sido creditados.');
    }

    public function test_desconto_de_grupo_tambem_funciona_para_locacoes_aluguel(): void
    {
        // itens_aluguel.estabelecimento_id referencia a tabela "users" (o socio dono do item), não "estabelecimentos".
        $socio = User::create(['name' => 'Locadora', 'email' => 'locadora' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $item = ItemAluguel::create([
            'estabelecimento_id' => $socio->id,
            'nome' => 'Van 9 lugares', 'categoria' => 'van',
            'periodo_faturamento_padrao' => 'diaria',
            'valor_diaria' => 200, 'quantidade' => 5, 'disponivel' => true, 'ativo' => true,
            'sempre_disponivel' => true, 'tipo_disponibilidade' => 'todos',
        ]);

        $criador = User::create(['name' => 'Criador', 'email' => 'criadoral' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $membro = User::create(['name' => 'Membro', 'email' => 'membroal' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $viagem = Viagem::create([
            'criador_id' => $criador->id, 'titulo' => 'Viagem Aluguel', 'destino' => 'Serra',
            'data_inicio' => now()->addDays(2)->toDateString(), 'data_fim' => now()->addDays(10)->toDateString(),
            'quantidade_pessoas' => 2, 'status' => 'planejando', 'codigo_convite' => 'TSTAL' . rand(1000, 9999),
        ]);
        $viagem->membros()->attach($membro->id, ['funcao' => 'membro', 'presenca' => 'confirmado']);

        // O criador já alugou a mesma van (datas diferentes, sem conflito de disponibilidade).
        Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(),
            'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $criador->id,
            'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => now()->addDays(3)->toDateString(), 'data_fim' => now()->addDays(4)->toDateString(),
            'valor_unitario' => 200, 'valor_total' => 200, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);

        $response = $this->actingAs($membro)->postJson('/api/locacoes', [
            'item_aluguel_id' => $item->id,
            'data_inicio' => now()->addDays(6)->toDateString(),
            'data_fim' => now()->addDays(7)->toDateString(),
            'forma_pagamento' => 'presencial',
            'viagem_id' => $viagem->id,
        ]);

        $response->assertCreated();

        $reserva = Aluguel::where('locatario_id', $membro->id)->latest()->first();
        $this->assertNotNull($reserva);
        $this->assertSame(200.0, (float) $reserva->valor_bruto, 'Subtotal bruto (1 diária de R$200) não deveria mudar.');
        $this->assertSame(180.0, (float) $reserva->valor_total, 'Desconto de grupo de 10% deveria ter sido aplicado ao total (R$200 -> R$180).');
    }
}
