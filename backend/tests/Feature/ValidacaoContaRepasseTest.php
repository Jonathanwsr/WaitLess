<?php

namespace Tests\Feature;

use App\Models\ContaBancariaRepasse;
use App\Models\Provider;
use App\Models\TransferenciaCarteira;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ValidacaoContaRepasseTest extends TestCase
{
    use DatabaseTransactions;

    public function test_cadastro_da_chave_pix_dispara_transferencia_de_um_centavo_da_plataforma(): void
    {
        Http::fake(['*/transfers' => Http::response(['id' => 'tr_val_1', 'status' => 'PENDING'], 200)]);

        $socio = User::create(['name' => 'Socio Validacao', 'email' => 'val' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $provider = Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => '12345678909', 'person_type' => 'FISICA', 'pix_key_type' => 'CPF', 'pix_key' => '12345678909',
            'mobile_phone' => '11999998888', 'postal_code' => '01000000', 'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_wallet_id' => 'wal_' . uniqid(), 'asaas_api_key' => 'k_' . uniqid(),
        ]);

        $this->actingAs($socio)->putJson('/api/provider', [
            'pix_key_type' => 'EMAIL', 'pix_key' => 'repasse' . uniqid() . '@x.com',
        ])->assertOk();

        $conta = ContaBancariaRepasse::where('provider_id', $provider->id)->first();
        $this->assertNotNull($conta, 'A chave Pix do cadastro deveria virar uma conta de repasse.');

        $transferencia = TransferenciaCarteira::where('conta_bancaria_id', $conta->id)
            ->where('tipo', TransferenciaCarteira::TIPO_VALIDACAO)->first();
        $this->assertNotNull($transferencia, 'Deveria existir uma transferência de validação.');
        $this->assertSame(0.01, (float) $transferencia->valor_bruto);

        Http::assertSent(function ($request) use ($conta) {
            return str_contains($request->url(), '/transfers')
                && $request['value'] === 0.01
                && $request['operationType'] === 'PIX'
                && $request['pixAddressKey'] === $conta->pix_key
                && $request->header('access_token')[0] === config('services.asaas.key');
        });
    }
}
