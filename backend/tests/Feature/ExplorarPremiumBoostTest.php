<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExplorarPremiumBoostTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Regressão: o boost de visibilidade premium (DestaquePremiumService) já
     * existia no Explorar do mobile, mas nunca tinha sido trazido pro site —
     * donos premium não tinham nenhuma vantagem de posição na busca web.
     */
    public function test_estabelecimento_premium_aparece_primeiro_no_explorar_web(): void
    {
        $cliente = User::create(['name' => 'Cliente Boost', 'email' => 'boost' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $socioComum = User::create(['name' => 'Socio Comum', 'email' => 'comum' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estComum = Estabelecimento::create(['nome' => 'Salao Comum ' . uniqid(), 'ativo' => true]);
        $estComum->proprietarios()->attach($socioComum->id, ['tipo' => 'socio']);

        $socioPremium = User::create(['name' => 'Socio Premium', 'email' => 'premium' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio', 'plano_assinatura' => 'premium-socio', 'plano_expira_em' => now()->addMonth()]);
        $estPremium = Estabelecimento::create(['nome' => 'Salao Premium ' . uniqid(), 'ativo' => true]);
        $estPremium->proprietarios()->attach($socioPremium->id, ['tipo' => 'socio']);

        $response = $this->actingAs($cliente)->get('/explorar?tipo_busca=estabelecimentos');

        $response->assertOk();
        $response->assertInertia(function ($page) use ($estPremium, $estComum) {
            $ids = collect($page->toArray()['props']['estabelecimentos']['data'])->pluck('id')->values();
            $posPremium = $ids->search($estPremium->id);
            $posComum = $ids->search($estComum->id);
            $this->assertNotFalse($posPremium);
            $this->assertNotFalse($posComum);
            $this->assertLessThan($posComum, $posPremium, 'O estabelecimento premium deveria aparecer antes do comum.');
        });
    }

    public function test_servico_de_dono_premium_aparece_primeiro_no_explorar_web(): void
    {
        $cliente = User::create(['name' => 'Cliente Boost2', 'email' => 'boost2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $socioComum = User::create(['name' => 'Socio Comum2', 'email' => 'comum2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estComum = Estabelecimento::create(['nome' => 'Salao Comum2 ' . uniqid(), 'ativo' => true]);
        $estComum->proprietarios()->attach($socioComum->id, ['tipo' => 'socio']);
        $servicoComum = Servico::create(['estabelecimento_id' => $estComum->id, 'nome' => 'Corte Comum', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);

        $socioPremium = User::create(['name' => 'Socio Premium2', 'email' => 'premium2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio', 'plano_assinatura' => 'premium-anual', 'plano_expira_em' => now()->addMonth()]);
        $estPremium = Estabelecimento::create(['nome' => 'Salao Premium2 ' . uniqid(), 'ativo' => true]);
        $estPremium->proprietarios()->attach($socioPremium->id, ['tipo' => 'socio']);
        $servicoPremium = Servico::create(['estabelecimento_id' => $estPremium->id, 'nome' => 'Corte Premium', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);

        $response = $this->actingAs($cliente)->get('/explorar?tipo_busca=servicos');

        $response->assertOk();
        $response->assertInertia(function ($page) use ($servicoPremium, $servicoComum) {
            $ids = collect($page->toArray()['props']['itens_aluguel']['data'])->pluck('id')->values();
            $posPremium = $ids->search($servicoPremium->id);
            $posComum = $ids->search($servicoComum->id);
            $this->assertNotFalse($posPremium);
            $this->assertNotFalse($posComum);
            $this->assertLessThan($posComum, $posPremium);
        });
    }
}
