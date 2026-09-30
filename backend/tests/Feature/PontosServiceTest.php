<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\PontosService;
use Tests\TestCase;

/**
 * PontosService é a única fonte de verdade da taxa de conversão de pontos em
 * desconto (1000 pontos = R$1,00). Esses testes não tocam o banco — só
 * verificam a matemática, que é exatamente onde um erro de arredondamento ou
 * de "achei que era /100" vira dinheiro errado sendo descontado de verdade.
 */
class PontosServiceTest extends TestCase
{
    public function test_1000_pontos_equivalem_a_um_real(): void
    {
        $this->assertSame(1.0, PontosService::pontosParaValor(1000));
        $this->assertSame(1000, PontosService::valorParaPontos(1.00));
    }

    public function test_conversao_de_pontos_para_valor_arredonda_em_duas_casas(): void
    {
        // 999 pontos = R$ 0,999 -> arredonda pra R$ 1,00
        $this->assertSame(1.0, PontosService::pontosParaValor(999));
        // 1 ponto = R$ 0,001 -> arredonda pra R$ 0,00 (não gera desconto de fração de centavo)
        $this->assertSame(0.0, PontosService::pontosParaValor(1));
        $this->assertSame(0.5, PontosService::pontosParaValor(500));
    }

    public function test_conversao_de_valor_para_pontos_trunca_em_vez_de_arredondar_pra_cima(): void
    {
        // R$ 1,0009 só poderia gerar 1000 pontos "inteiros" — floor() garante que o
        // cliente nunca resgata mais pontos do que o valor realmente pago cobre.
        $this->assertSame(1000, PontosService::valorParaPontos(1.0009));
        $this->assertSame(1999, PontosService::valorParaPontos(1.999));
    }

    public function test_pontos_aplicaveis_trava_pelo_saldo_do_usuario(): void
    {
        $user = new User(['pontos_saldo' => 500]);

        // Pediu 5000 pontos de desconto (R$5) mas só tem 500 no saldo.
        $aplicaveis = PontosService::pontosAplicaveis($user, 5000, 100.00);

        $this->assertSame(500, $aplicaveis);
    }

    public function test_pontos_aplicaveis_trava_pelo_subtotal_mesmo_com_saldo_de_sobra(): void
    {
        $user = new User(['pontos_saldo' => 1_000_000]);

        // Saldo gigante, mas o subtotal é só R$ 0,50 (500 pontos) — não pode
        // descontar mais do que o próprio valor da compra.
        $aplicaveis = PontosService::pontosAplicaveis($user, 5000, 0.50);

        $this->assertSame(500, $aplicaveis);
    }

    public function test_pontos_aplicaveis_ignora_pedido_zero_ou_negativo(): void
    {
        $user = new User(['pontos_saldo' => 1000]);

        $this->assertSame(0, PontosService::pontosAplicaveis($user, 0, 100.00));
        $this->assertSame(0, PontosService::pontosAplicaveis($user, -50, 100.00));
    }

    public function test_pontos_aplicaveis_ignora_subtotal_zero_ou_negativo(): void
    {
        // Subtotal zerado (ex.: serviço gratuito) não deve permitir "sobrar"
        // desconto de pontos em cima de algo que já não custa nada.
        $user = new User(['pontos_saldo' => 1000]);

        $this->assertSame(0, PontosService::pontosAplicaveis($user, 500, 0));
        $this->assertSame(0, PontosService::pontosAplicaveis($user, 500, -10));
    }
}
