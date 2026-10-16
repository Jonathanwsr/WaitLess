<?php

namespace Tests\Feature;

use App\Models\Aluguel;
use App\Models\Contrato;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContratoClienteTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user', array $extra = []): User
    {
        return User::create(array_merge([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ], $extra));
    }

    /** Reserva do local (item com local_id) ou avulsa (sem local), já com contrato gerado. */
    private function reservaComContrato(bool $doLocal): array
    {
        Storage::fake('public');
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $doLocal ? $local->id : null, 'nome' => 'Chalé', 'categoria' => 'chalé', 'valor_diaria' => 300, 'ativo' => true]);
        $cliente = $this->usuario();
        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria', 'quantidade_periodos' => 2,
            'data_inicio' => now()->addDays(5)->toDateString(), 'data_fim' => now()->addDays(7)->toDateString(),
            'valor_unitario' => 300, 'valor_total' => 600, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);
        Storage::disk('public')->put('contratos/teste.pdf', '%PDF-1.4 teste');
        $contrato = Contrato::create([
            'aluguel_id' => $aluguel->id, 'numero_contrato' => 'CTR-' . strtoupper(uniqid()), 'titulo' => 'Contrato do chalé',
            'descricao' => '<h1>CONTRATO</h1><p>Locatário: Maria</p><p>Proibido &amp; fumar<br>no chalé.</p><script>alert(1)</script>',
            'arquivo_pdf' => 'contratos/teste.pdf', 'hash_documento' => 'x', 'plataforma_assinatura' => 'Nenhuma', 'assinado' => false,
        ]);
        $aluguel->update(['contrato_id' => $contrato->id]);

        return compact('socio', 'local', 'cliente', 'aluguel', 'contrato');
    }

    public function test_cliente_le_e_baixa_o_contrato_da_reserva_avulsa_e_do_local_no_web_e_no_app(): void
    {
        foreach ([false, true] as $doLocal) {
            ['cliente' => $cliente, 'aluguel' => $aluguel, 'contrato' => $contrato] = $this->reservaComContrato($doLocal);

            $this->actingAs($cliente)->get(route('alugueis.detalhes', $aluguel->id))->assertOk()
                ->assertInertia(fn ($p) => $p->where('dados.contrato.numero', $contrato->numero_contrato)
                    ->where('dados.contrato.texto', fn ($t) => str_contains($t, 'Locatário: Maria') && str_contains($t, 'Proibido & fumar') && !str_contains($t, '<')));

            Sanctum::actingAs($cliente);
            $json = $this->getJson("/api/mobile/alugueis/{$aluguel->id}")->assertOk()->json('contrato');
            $this->assertSame($contrato->numero_contrato, $json['numero']);

            // O link assinado abre o PDF sem precisar de login (o app abre no navegador).
            auth()->forgetGuards();
            $this->get($json['pdf_url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
        }
    }

    public function test_link_do_contrato_sem_assinatura_e_outro_usuario_sao_bloqueados(): void
    {
        ['contrato' => $contrato] = $this->reservaComContrato(false);

        $this->get("/contratos/{$contrato->id}/arquivo/pdf")->assertForbidden();

        $estranho = $this->usuario();
        $this->actingAs($estranho)->getJson("/contratos/{$contrato->id}/ver")->assertForbidden();
        Sanctum::actingAs($estranho);
        $this->getJson("/api/mobile/contratos/{$contrato->id}")->assertForbidden();
    }

    public function test_socio_do_mesmo_local_pode_ver_e_gerenciar_o_contrato_da_reserva_do_outro_socio(): void
    {
        ['local' => $local, 'contrato' => $contrato, 'aluguel' => $aluguel] = $this->reservaComContrato(true);
        $outroSocio = $this->usuario('socio');
        $local->proprietarios()->attach($outroSocio->id, ['tipo' => 'socio']);

        $this->actingAs($outroSocio)->getJson("/contratos/{$contrato->id}/ver")->assertOk()->assertJsonPath('contrato.id', $contrato->id);
        $this->assertTrue(app(\App\Services\Locacao\ContratoReservaService::class)->podeGerenciar($aluguel, $outroSocio));
        $this->assertFalse(app(\App\Services\Locacao\ContratoReservaService::class)->podeGerenciar($aluguel, $this->usuario('socio')));
    }

    public function test_sem_contrato_a_reserva_que_exige_contrato_avisa_o_cliente(): void
    {
        ['cliente' => $cliente, 'aluguel' => $aluguel] = $this->reservaComContrato(false);
        $aluguel->update(['contrato_id' => null]);
        $aluguel->item->update(['exige_contrato' => true]);

        Sanctum::actingAs($cliente);
        $this->getJson("/api/mobile/alugueis/{$aluguel->id}")->assertOk()
            ->assertJsonPath('contrato', null)->assertJsonPath('exige_contrato', true);
    }

    public function test_tela_de_contratos_explica_o_recurso_para_quem_nao_e_premium(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Loja', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $this->actingAs($socio)->get(route('estabelecimentos.contratos', $local->id))->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/Contratos')->where('premiumNecessario', true));
    }

    public function test_planos_listam_os_beneficios_reais_de_cada_um(): void
    {
        $titulos = fn (string $plano, string $papel) => collect(\App\Support\BeneficiosPlanos::de($plano, $papel))->pluck('titulo');

        $this->assertContains('Indicações valem o dobro', $titulos('premium', 'user'));
        $this->assertContains('Pontos em dobro no dia a dia', $titulos('premium', 'user'));
        $this->assertContains('Contratos de locação', $titulos('premium', 'socio'));
        $this->assertContains('Tudo do Premium de cliente', $titulos('premium', 'socio'));
        $this->assertContains('Cobrança parcelada para clientes', $titulos('premium-socio', 'socio'));
        $this->assertNotContains('Cobrança parcelada para clientes', $titulos('premium', 'socio'));
    }
}
