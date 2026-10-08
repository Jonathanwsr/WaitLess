<?php

namespace Tests\Feature;

use App\Models\Provider;
use App\Models\TransferenciaCarteira;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CarteiraHistoricoTest extends TestCase
{
    use DatabaseTransactions;

    private function criarProvider(User $socio): Provider
    {
        $documento = (string) random_int(10000000000, 99999999999);

        return Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => $documento, 'pix_key_type' => 'CPF', 'pix_key' => $documento,
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888',
            'postal_code' => '01000000', 'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
        ]);
    }

    public function test_usuario_sem_provider_recebe_lista_vazia(): void
    {
        $socio = User::create(['name' => 'Socio Sem Provider', 'email' => 'carth1' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);

        $response = $this->actingAs($socio)->getJson('/api/mobile/proprietario/carteira/historico');

        $response->assertOk();
        $this->assertSame([], $response->json('data'));
    }

    public function test_lista_apenas_os_repasses_do_proprio_provider(): void
    {
        $socio = User::create(['name' => 'Socio A', 'email' => 'carth2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $outroSocio = User::create(['name' => 'Socio B', 'email' => 'carth3' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $provider = $this->criarProvider($socio);
        $outroProvider = $this->criarProvider($outroSocio);

        TransferenciaCarteira::create(['provider_id' => $provider->id, 'user_id' => $socio->id, 'tipo' => 'repasse', 'nome' => 'Repasse semanal', 'valor_bruto' => 100, 'valor_liquido' => 100, 'status' => 'concluida', 'external_reference' => 'ref-' . uniqid()]);
        TransferenciaCarteira::create(['provider_id' => $outroProvider->id, 'user_id' => $outroSocio->id, 'tipo' => 'repasse', 'nome' => 'Repasse semanal', 'valor_bruto' => 200, 'valor_liquido' => 200, 'status' => 'concluida', 'external_reference' => 'ref-' . uniqid()]);

        $response = $this->actingAs($socio)->getJson('/api/mobile/proprietario/carteira/historico');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame(100.0, (float) $response->json('data.0.valor_liquido'));
    }

    public function test_filtra_por_tipo_e_status(): void
    {
        $socio = User::create(['name' => 'Socio Filtro', 'email' => 'carth4' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $provider = $this->criarProvider($socio);

        TransferenciaCarteira::create(['provider_id' => $provider->id, 'user_id' => $socio->id, 'tipo' => 'repasse', 'nome' => 'Repasse semanal', 'valor_bruto' => 100, 'valor_liquido' => 100, 'status' => 'concluida', 'external_reference' => 'ref-' . uniqid()]);
        TransferenciaCarteira::create(['provider_id' => $provider->id, 'user_id' => $socio->id, 'tipo' => 'antecipacao', 'nome' => 'Repasse antecipado', 'valor_bruto' => 50, 'valor_liquido' => 45, 'taxa_plataforma' => 5, 'status' => 'falhou', 'erro_mensagem' => 'Saldo insuficiente', 'external_reference' => 'ref-' . uniqid()]);
        // Nunca deve aparecer: é a transferência de validação da conta, não um repasse.
        TransferenciaCarteira::create(['provider_id' => $provider->id, 'user_id' => $socio->id, 'tipo' => 'validacao', 'nome' => 'Validação de conta', 'valor_bruto' => 0.01, 'valor_liquido' => 0.01, 'status' => 'concluida', 'external_reference' => 'ref-' . uniqid()]);

        $response = $this->actingAs($socio)->getJson('/api/mobile/proprietario/carteira/historico?tipo=antecipacao');
        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $response->assertJsonPath('data.0.tipo', 'antecipacao');
        $response->assertJsonPath('data.0.erro', 'Saldo insuficiente');

        $response2 = $this->actingAs($socio)->getJson('/api/mobile/proprietario/carteira/historico');
        $response2->assertOk();
        $this->assertCount(2, $response2->json('data'), 'Validação de conta não deveria aparecer no histórico de repasses.');
    }

    public function test_usuario_de_outro_papel_nao_consegue_ver_historico_de_terceiro(): void
    {
        // Mesmo autenticado, o endpoint só resolve o provider do próprio usuário
        // logado (Provider::where('user_id', $request->user()->id)) — não há
        // parâmetro de id na rota, então não há como pedir o de outra pessoa.
        $estranho = User::create(['name' => 'Estranho', 'email' => 'carth5' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $response = $this->actingAs($estranho)->getJson('/api/mobile/proprietario/carteira/historico');

        $response->assertOk();
        $this->assertSame([], $response->json('data'));
    }
}
