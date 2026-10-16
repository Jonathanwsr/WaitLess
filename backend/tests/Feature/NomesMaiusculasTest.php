<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class NomesMaiusculasTest extends TestCase
{
    use DatabaseTransactions;

    public function test_nomes_de_servico_reserva_e_produto_ficam_em_maiusculas_ao_criar_e_editar(): void
    {
        $dono = User::create(['name' => 'Dono', 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $local = Estabelecimento::create(['nome' => 'Pousada', 'ativo' => true]);

        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => '  corte   de cabelo ', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);
        $this->assertSame('CORTE DE CABELO', $servico->fresh()->nome);

        $item = ItemAluguel::create(['estabelecimento_id' => $dono->id, 'local_id' => $local->id, 'nome' => 'chalé da praia', 'categoria' => 'chalé', 'valor_diaria' => 300, 'ativo' => true]);
        $this->assertSame('CHALÉ DA PRAIA', $item->fresh()->nome);
        $item->update(['nome' => 'suíte açaí']);
        $this->assertSame('SUÍTE AÇAÍ', $item->fresh()->nome);

        $produto = Produto::create(['usuario_id' => $dono->id, 'estabelecimento_id' => $local->id, 'nome' => 'kit café', 'valor_normal' => 20, 'valor_final' => 20, 'estoque_disponivel' => 5]);
        $this->assertSame('KIT CAFÉ', $produto->fresh()->nome);
    }
}
