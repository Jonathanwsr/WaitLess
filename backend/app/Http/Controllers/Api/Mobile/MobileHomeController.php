<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Estabelecimento; // Ajuste para o nome do seu Model
use App\Models\User;

class MobileHomeController extends Controller
{
    /**
     * Busca os estabelecimentos próximos.
     * Pode receber latitude/longitude ou os dados do endereço digitado.
     */
    public function getEstabelecimentosProximos(Request $request)
    {
        $radius = $request->input('radius', 15);
        $lat = $request->input('lat');
        $lng = $request->input('lng');

        // Se vier pelo endereço manual (logradouro, bairro, etc)
        $cidadeUf = $request->input('cidadeUf');

        // LÓGICA DE BUSCA REAL:
        // Aqui você faria a query no banco de dados calculando a distância (fórmula de Haversine)
        // ou filtrando pela cidade digitada.
        //
        // Exemplo simplificado caso use cidade:
        // $query = Estabelecimento::query();
        // if ($cidadeUf) { $query->where('cidade', 'like', "%{$cidadeUf}%"); }

        // MOCK PARA TESTE MÓVEL (Substitua pela sua query real):
        $estabelecimentos = [
            [
                'id' => 1,
                'nome' => 'Barbearia do João',
                'tipo' => 'barbearia',
                'foto_perfil' => 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=400&auto=format&fit=crop',
                'avaliacao_media' => 4.8,
                'distance' => 2.5,
                'fila_atual' => 3
            ],
            [
                'id' => 2,
                'nome' => 'Clínica Sorriso',
                'tipo' => 'dentista',
                'foto_perfil' => 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=400&auto=format&fit=crop',
                'avaliacao_media' => 5.0,
                'distance' => 5.1,
                'fila_atual' => 0
            ]
        ];

        return response()->json($estabelecimentos, 200);
    }

    /**
     * Atualiza o endereço do usuário autenticado e salva no banco.
     */
    public function updateAddress(Request $request)
    {
        $request->validate([
            'logradouro' => 'required|string|min:5|max:255',
            'numero' => 'required|string|max:20',
            'bairro' => 'nullable|string|max:100',
            'cidadeUf' => 'required|string|max:100',
        ]);

        $user = $request->user();

     
        if ($user) {
            $user->update([
                'endereco_logradouro' => $request->logradouro,
                'endereco_numero' => $request->numero,
                'endereco_bairro' => $request->bairro,
                'endereco_cidade_uf' => $request->cidadeUf,
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Endereço salvo com sucesso.'
        ], 200);
    }
}
