<?php

namespace Tests\Feature;

use App\Models\ItemAluguel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TravelAssistantBuscaTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocio(string $nome): User
    {
        return User::create(['name' => $nome, 'email' => strtolower(str_replace(' ', '', $nome)) . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
    }

    /**
     * Regressão de dois bugs encadeados na busca por GPS do travel-assistant
     * (ver laravel.log, protocolo 9PXEDVMQ):
     * 1) ->having('distancia', ...) referenciava um alias do SELECT sem GROUP BY
     *    — funciona no MySQL, mas o Postgres rejeita com "coluna distancia não existe".
     * 2) mesmo corrigindo isso, o código comparava itens_aluguel.estabelecimento_id
     *    (que referencia users.id, o sócio dono) com estabelecimentos.id — nunca
     *    batia. A distância agora é calculada com a lat/lng do próprio item.
     */
    public function test_busca_por_coordenadas_retorna_apenas_itens_proximos(): void
    {
        $cliente = User::create(['name' => 'Cliente Travel', 'email' => 'cliente-travel' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user', 'email_verified_at' => now()]);
        $socioProximo = $this->criarSocio('Socio Proximo');
        $socioLonge = $this->criarSocio('Socio Longe');

        ItemAluguel::create(['estabelecimento_id' => $socioProximo->id, 'nome' => 'Item perto', 'categoria' => 'equipamento', 'valor_diaria' => 50, 'ativo' => true, 'disponivel' => true, 'latitude' => -7.75, 'longitude' => -35.60, 'cidade' => 'Campina Grande']);
        ItemAluguel::create(['estabelecimento_id' => $socioLonge->id, 'nome' => 'Item longe', 'categoria' => 'equipamento', 'valor_diaria' => 50, 'ativo' => true, 'disponivel' => true, 'latitude' => -22.90, 'longitude' => -43.20, 'cidade' => 'Rio de Janeiro']);

        $response = $this->actingAs($cliente)->get('/api/travel-assistant/search?latitude=-7.749271714498118&longitude=-35.60678145818741&raio_km=20');

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $nomes = collect($page->toArray()['props']['recomendacoes_locais'] ?? [])->pluck('nome');
            $this->assertTrue($nomes->contains('Item perto'));
            $this->assertFalse($nomes->contains('Item longe'));
        });
    }

    public function test_busca_mobile_por_coordenadas_nao_quebra_no_postgres(): void
    {
        $viajante = User::create(['name' => 'Viajante', 'email' => 'viajante' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $token = $viajante->createToken('teste')->plainTextToken;

        $socio = $this->criarSocio('Socio Mobile');
        ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Item perto mobile', 'categoria' => 'equipamento', 'valor_diaria' => 50, 'ativo' => true, 'disponivel' => true, 'latitude' => -7.75, 'longitude' => -35.60, 'cidade' => 'Campina Grande']);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/mobile/travel-assistant/search?latitude=-7.749271714498118&longitude=-35.60678145818741&raio_km=20');

        $response->assertOk();
    }
}
