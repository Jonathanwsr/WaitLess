<?php

namespace Tests\Feature;

use App\Events\FilaAtualizada;
use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * O webhook do Asaas é o único lugar que confirma (ou estorna, ou vence) um
 * pagamento PIX/boleto de verdade — ele roda sozinho, sem ninguém olhando, e
 * se quebrar silenciosamente uma reserva fica presa em "aguardando
 * pagamento" pra sempre mesmo já tendo sido paga. Esses testes cobrem os 3
 * eventos que esse endpoint trata.
 */
class WebhookAsaasTest extends TestCase
{
    use DatabaseTransactions;

    private function criarPagamentoPendente(): array
    {
        $cliente = User::create([
            'name' => 'Cliente Webhook',
            'email' => 'webhook' . uniqid() . '@example.com',
            'password' => Hash::make('senha-teste-123'),
            'papel' => 'user',
        ]);

        $estabelecimento = Estabelecimento::create(['nome' => 'Estabelecimento Webhook ' . uniqid()]);

        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Serviço Webhook',
            'tipo_servico' => 'Outro',
            'valor' => 80,
            'duracao_minutos' => 30,
            'ativo' => true,
        ]);

        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estabelecimento->id,
            'servico_id' => $servico->id,
            'data_agendamento' => now()->addDay()->toDateString(),
            'hora_agendamento' => '10:00',
            'status' => 'aguardando_pagamento',
            'status_pagamento' => 'pendente',
            'valor_final' => 80,
        ]);

        $idTransacao = 'pay_teste_' . uniqid();

        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estabelecimento->id,
            'agendamento_id' => $agendamento->id,
            'gateway_pagamento' => 'Asaas',
            'id_transacao_gateway' => $idTransacao,
            'valor' => 80,
            'taxa' => 4,
            'valor_liquido' => 76,
            'status' => 'pendente',
            'metodo_pagamento' => 'pix',
        ]);

        return compact('cliente', 'estabelecimento', 'agendamento', 'pagamento', 'idTransacao');
    }

    public function test_payment_received_confirma_pagamento_e_agendamento_e_avisa_em_tempo_real(): void
    {
        Event::fake([FilaAtualizada::class]);
        ['estabelecimento' => $estabelecimento, 'agendamento' => $agendamento, 'pagamento' => $pagamento, 'idTransacao' => $idTransacao] = $this->criarPagamentoPendente();

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_RECEIVED',
            'payment' => ['id' => $idTransacao],
        ]);

        $response->assertOk();

        $pagamento->refresh();
        $agendamento->refresh();

        $this->assertSame('pago', $pagamento->status);
        $this->assertSame('pago_online', $agendamento->status_pagamento);
        $this->assertSame('confirmado', $agendamento->status);

        Event::assertDispatched(FilaAtualizada::class, fn ($e) => $e->estabelecimentoId === $estabelecimento->id);
    }

    public function test_payment_received_e_idempotente_nao_credita_pontos_duas_vezes(): void
    {
        ['agendamento' => $agendamento, 'pagamento' => $pagamento, 'idTransacao' => $idTransacao, 'cliente' => $cliente] = $this->criarPagamentoPendente();

        // O Asaas pode reenviar o mesmo evento mais de uma vez (retry de rede, etc.).
        $this->postJson('/api/webhook/asaas', ['event' => 'PAYMENT_RECEIVED', 'payment' => ['id' => $idTransacao]])->assertOk();
        $this->postJson('/api/webhook/asaas', ['event' => 'PAYMENT_RECEIVED', 'payment' => ['id' => $idTransacao]])->assertOk();

        $pontosGanhos = \Illuminate\Support\Facades\DB::table('historico_pontos')
            ->where('usuario_id', $cliente->id)
            ->where('agendamento_id', $agendamento->id)
            ->sum('quantidade');

        // floor(80) = 80 pontos — se tivesse creditado duas vezes, seria 160.
        $this->assertSame(80, (int) $pontosGanhos);
    }

    public function test_payment_overdue_cancela_agendamento(): void
    {
        ['agendamento' => $agendamento, 'pagamento' => $pagamento, 'idTransacao' => $idTransacao] = $this->criarPagamentoPendente();

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_OVERDUE',
            'payment' => ['id' => $idTransacao],
        ]);

        $response->assertOk();

        $pagamento->refresh();
        $agendamento->refresh();

        // pagamentos.status só aceita pendente/pago/cancelado/estornado.
        $this->assertSame('cancelado', $pagamento->status);
        $this->assertSame('cancelado', $agendamento->status);
        $this->assertSame('cancelado', $agendamento->status_pagamento);
    }

    public function test_payment_refunded_estorna_e_reverte_os_pontos_ganhos(): void
    {
        ['agendamento' => $agendamento, 'pagamento' => $pagamento, 'idTransacao' => $idTransacao, 'cliente' => $cliente, 'estabelecimento' => $estabelecimento] = $this->criarPagamentoPendente();

        // Primeiro confirma o pagamento (credita pontos), depois estorna.
        $this->postJson('/api/webhook/asaas', ['event' => 'PAYMENT_RECEIVED', 'payment' => ['id' => $idTransacao]])->assertOk();

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_REFUNDED',
            'payment' => ['id' => $idTransacao],
        ]);

        $response->assertOk();

        $pagamento->refresh();
        $agendamento->refresh();

        $this->assertSame('estornado', $pagamento->status);
        $this->assertSame('cancelado', $agendamento->status);
        $this->assertSame('estornado', $agendamento->status_pagamento);

        $saldoPontosLiquido = \Illuminate\Support\Facades\DB::table('historico_pontos')
            ->where('usuario_id', $cliente->id)
            ->where('agendamento_id', $agendamento->id)
            ->sum('quantidade');
        // 80 ganhos - 80 perdidos no estorno = líquido 0 no extrato dessa transação.
        // (A tabela guarda os dois lançamentos; o que importa é a soma zerar.)
        // historico_pontos.tipo só aceita 'ganho'/'uso' — a reversão usa 'uso',
        // mesmo "balde" usado quando o cliente resgata pontos por conta própria.
        $ganhos = \Illuminate\Support\Facades\DB::table('historico_pontos')
            ->where('usuario_id', $cliente->id)->where('agendamento_id', $agendamento->id)->where('tipo', 'ganho')->sum('quantidade');
        $usados = \Illuminate\Support\Facades\DB::table('historico_pontos')
            ->where('usuario_id', $cliente->id)->where('agendamento_id', $agendamento->id)->where('tipo', 'uso')->sum('quantidade');
        $this->assertSame($ganhos, $usados, 'Os pontos ganhos no pagamento devem ser totalmente revertidos no estorno.');
    }

    public function test_webhook_com_id_de_transacao_desconhecido_nao_quebra(): void
    {
        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_RECEIVED',
            'payment' => ['id' => 'pay_que_nao_existe_' . uniqid()],
        ]);

        // Nunca pode devolver erro pro Asaas por um evento que não reconhece
        // (senão ele fica retentando e penalizando o endpoint).
        $response->assertOk();
    }
}
