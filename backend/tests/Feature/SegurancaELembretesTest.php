<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Contrato;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\User;
use App\Services\LembretesService;
use App\Services\Locacao\ContratoReservaService;
use App\Services\NotificacaoService;
use App\Support\AlertaDeErros;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Contratos privados + "Li e aceito", alerta de erros, lembretes e resultados do sócio. */
class SegurancaELembretesTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user', array $extra = []): User
    {
        return User::create(array_merge([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ], $extra));
    }

    private function reserva(array $extra = []): array
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'Chalé', 'categoria' => 'chalé', 'valor_diaria' => 300, 'ativo' => true]);
        $cliente = $this->usuario();
        $aluguel = Aluguel::create(array_merge([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria', 'quantidade_periodos' => 2,
            'data_inicio' => now()->addDays(5), 'data_fim' => now()->addDays(7),
            'valor_unitario' => 300, 'valor_total' => 600, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ], $extra));

        return compact('socio', 'local', 'item', 'cliente', 'aluguel');
    }

    private function contrato(Aluguel $aluguel, string $disco = 'local'): Contrato
    {
        Storage::disk($disco)->put('contratos/t.pdf', '%PDF-1.4 teste');

        return Contrato::create([
            'aluguel_id' => $aluguel->id, 'numero_contrato' => 'CTR-' . strtoupper(uniqid()), 'titulo' => 'Contrato',
            'descricao' => '<p>Regras</p>', 'arquivo_pdf' => 'contratos/t.pdf', 'hash_documento' => 'x', 'plataforma_assinatura' => 'Nenhuma', 'assinado' => false,
        ]);
    }

    public function test_contrato_fica_no_disco_privado_e_sai_so_por_link_assinado(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        ['aluguel' => $aluguel] = $this->reserva();
        $contrato = $this->contrato($aluguel);
        $servico = app(ContratoReservaService::class);

        $this->assertSame('local', ContratoReservaService::discoDo($contrato->arquivo_pdf));
        $this->get($servico->link($contrato, 'pdf'))->assertOk();
        $this->get(route('contratos.arquivo', ['contrato' => $contrato->id, 'formato' => 'pdf']))->assertForbidden(); // sem assinatura

        // Contrato antigo (pasta pública) continua abrindo e o comando o move para o privado.
        Storage::disk('local')->delete('contratos/t.pdf');
        Storage::disk('public')->put('contratos/t.pdf', '%PDF antigo');
        $this->assertSame('public', ContratoReservaService::discoDo($contrato->arquivo_pdf));
        $this->artisan('contratos:privatizar')->assertSuccessful();
        Storage::disk('public')->assertMissing('contratos/t.pdf');
        $this->assertSame('%PDF antigo', Storage::disk('local')->get('contratos/t.pdf'));

        ContratoReservaService::apagarArquivos($contrato);
        Storage::disk('local')->assertMissing('contratos/t.pdf');
    }

    public function test_cliente_le_e_aceita_o_contrato_e_fica_registrado(): void
    {
        Storage::fake('local');
        ['aluguel' => $aluguel, 'cliente' => $cliente, 'socio' => $socio] = $this->reserva();
        $contrato = $this->contrato($aluguel);

        // Dono não pode aceitar pelo cliente.
        $this->actingAs($socio)->postJson(route('contratos.aceitar', $contrato), ['aceito' => true])->assertForbidden();
        // Sem marcar "Li e aceito".
        $this->actingAs($cliente)->postJson(route('contratos.aceitar', $contrato), [])->assertStatus(422);

        $this->actingAs($cliente)->getJson(route('contratos.ver', $contrato))->assertOk()->assertJsonPath('contrato.pode_aceitar', true);

        Sanctum::actingAs($cliente);
        $r = $this->withHeaders(['X-Aparelho' => 'LOKYVA-App · Android'])
            ->postJson("/api/mobile/contratos/{$contrato->id}/aceitar", ['aceito' => true])->assertOk();
        $r->assertJsonPath('contrato.assinado', true)->assertJsonPath('contrato.pode_aceitar', false)
            ->assertJsonPath('contrato.aceite.aparelho', 'App LOKYVA · Android');

        $contrato->refresh();
        $this->assertTrue($contrato->assinado);
        $this->assertNotNull($contrato->data_assinatura);
        $this->assertSame(64, strlen($contrato->hash_assinatura));
        $this->assertNotNull($contrato->ip_assinatura);
        $this->assertTrue((bool) $aluguel->fresh()->contrato_assinado);

        // Só uma vez.
        $this->postJson("/api/mobile/contratos/{$contrato->id}/aceitar", ['aceito' => true])->assertStatus(422);
    }

    public function test_alerta_de_erros_ignora_erros_esperados_e_avisa_erro_500(): void
    {
        config(['monitoramento.alerta_erros_email' => 'dev@lokyva.test']);
        // Nos testes o alerta fica desligado (não manda e-mail durante a suíte).
        $this->assertFalse(AlertaDeErros::deveAvisar(new \RuntimeException('x')));

        $this->app->detectEnvironment(fn () => 'production');
        $this->app->instance('runningUnitTests', false);
        $texto = AlertaDeErros::texto(new \RuntimeException('Falhou geral'));
        $this->assertStringContainsString('Falhou geral', $texto);
        $this->assertStringContainsString('RuntimeException', $texto);
    }

    public function test_lembrete_de_vespera_vai_uma_vez_para_reserva_e_agendamento(): void
    {
        $push = [];
        $this->app->instance(NotificacaoService::class, new class($push) extends NotificacaoService {
            public function __construct(private array &$enviados) {}
            public function enviarPush(User $user, $titulo, $mensagem, $dadosExtras = []) { $this->enviados[] = [$user->id, $titulo, $mensagem, $dadosExtras]; }
            public function enviarEmailBrevo(User $user, $assunto, $htmlContent) {}
        });

        ['aluguel' => $amanha, 'cliente' => $cliente, 'local' => $local] = $this->reserva(['data_inicio' => now()->addHours(20), 'data_fim' => now()->addDays(3)]);
        $amanha->forceFill(['created_at' => now()->subDays(3)])->save();
        $cliente->forceFill(['expo_push_token' => 'ExponentPushToken[x]'])->save();
        $this->contrato($amanha);
        ['aluguel' => $longe] = $this->reserva(['data_inicio' => now()->addDays(4)]);
        ['aluguel' => $cancelada] = $this->reserva(['data_inicio' => now()->addHours(10), 'status' => 'cancelado']);

        $servico = DB::table('servicos')->insertGetId(['estabelecimento_id' => $local->id, 'nome' => 'Massagem', 'valor' => 100, 'duracao_minutos' => 60, 'ativo' => true, 'created_at' => now(), 'updated_at' => now()]);
        $ag = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico,
            'data_agendamento' => now()->addHours(22)->toDateString(), 'hora_agendamento' => now()->addHours(22)->format('H:i:s'),
            'status' => 'confirmado', 'status_pagamento' => 'local',
        ]);
        $ag->forceFill(['created_at' => now()->subDay()])->save();

        $total = app(LembretesService::class)->enviarPendentes();
        $this->assertSame(['agendamentos' => 1, 'reservas' => 1], $total);
        $this->assertNotNull($amanha->fresh()->lembrete_enviado_em);
        $this->assertNull($longe->fresh()->lembrete_enviado_em);
        $this->assertNull($cancelada->fresh()->lembrete_enviado_em);

        $textos = collect($push)->pluck(2)->implode(' | ');
        $this->assertStringContainsString('leia e aceite o contrato', $textos);
        $this->assertStringContainsString('pagamento é feito no local', $textos);
        $this->assertSame('/agendamentos/detalhes', $push[0][3]['rota']);

        // Rodar de novo não repete.
        $this->assertSame(['agendamentos' => 0, 'reservas' => 0], app(LembretesService::class)->enviarPendentes());
    }

    public function test_resultados_da_oferta_e_adicionais_vendidos(): void
    {
        ['socio' => $socio, 'local' => $local, 'item' => $item] = $this->reserva();
        $cliente = $this->usuario();
        \App\Models\Favorito::create(['usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id]);

        $oferta = app(\App\Services\OfertaFavoritosService::class)->enviar($socio, $local, ['titulo' => 'Só hoje', 'mensagem' => '10% para quem segue']);
        DB::table('mensagens')->where('oferta_id', $oferta->id)->update(['lida_em' => now()]);

        // Cliente reservou depois da oferta.
        Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => now()->addDays(9), 'data_fim' => now()->addDays(10),
            'valor_unitario' => 300, 'valor_total' => 300, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);

        $this->actingAs($socio)->getJson(route('ofertas-favoritos.painel', $local))->assertOk()
            ->assertJsonPath('resultados.leram', 1)
            ->assertJsonPath('resultados.reservaram', 1)
            ->assertJsonPath('historico.0.resultado.receita', 300);

        // Adicional vendido junto com a reserva.
        $produto = DB::table('produtos')->insertGetId(['usuario_id' => $socio->id, 'estabelecimento_id' => $local->id, 'nome' => 'Kit café', 'valor_normal' => 20, 'valor_final' => 20, 'estoque_disponivel' => 5, 'created_at' => now(), 'updated_at' => now()]);
        $res = Aluguel::where('locatario_id', $cliente->id)->first();
        DB::table('itens_aluguel')->insert(['nome' => 'Kit café', 'categoria' => 'produto_extra', 'quantidade' => 2, 'valor_diaria' => 20, 'produto_id' => $produto,
            'estabelecimento_id' => $socio->id, 'aluguel_id' => $res->id, 'ativo' => false, 'created_at' => now(), 'updated_at' => now()]);

        Sanctum::actingAs($socio);
        $this->getJson('/api/mobile/produtos/adicionais-vendidos?dias=30')->assertOk()
            ->assertJsonPath('unidades', 2)
            ->assertJsonPath('receita', 40)
            ->assertJsonPath('em_reservas', 40)
            ->assertJsonPath('produtos.0.nome', 'Kit café');
    }
}
