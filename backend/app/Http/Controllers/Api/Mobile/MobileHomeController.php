<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\Estabelecimento; 
use App\Models\User;
// Assumindo que você tenha esses models, caso contrário, comente-os e use DB::table
use App\Models\Servico; 
use App\Models\Agendamento; 

class MobileHomeController extends Controller
{
    /**
     * Busca os estabelecimentos próximos.
     */
    public function getEstabelecimentosProximos(Request $request)
    {
        $radius = $request->input('radius', 15);
        $lat = $request->input('lat');
        $lng = $request->input('lng');
        $cidadeUf = $request->input('cidadeUf');

        // MOCK PARA TESTE MÓVEL
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

    /**
     * Busca o saldo e o histórico de pontos do usuário logado.
     */
    public function getHistoricoPontos(Request $request)
    {
        $user = $request->user();

        // 1. Busca o saldo total e nível do usuário por estabelecimento
        $saldos = DB::table('pontos_usuario_estabelecimento')
            ->join('estabelecimentos', 'pontos_usuario_estabelecimento.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('pontos_usuario_estabelecimento.usuario_id', $user->id)
            ->select(
                'pontos_usuario_estabelecimento.id',
                'pontos_usuario_estabelecimento.total_pontos',
                'pontos_usuario_estabelecimento.nivel',
                'estabelecimentos.nome as estabelecimento_nome',
                'estabelecimentos.id as estabelecimento_id'
            )
            ->get();

        // 2. Busca o histórico detalhado de ganhos e usos de pontos
        $historico = DB::table('historico_pontos')
            ->join('estabelecimentos', 'historico_pontos.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('historico_pontos.usuario_id', $user->id)
            ->select(
                'historico_pontos.id',
                'historico_pontos.tipo',
                'historico_pontos.descricao',
                'historico_pontos.quantidade',
                'historico_pontos.created_at',
                'estabelecimentos.nome as estabelecimento_nome'
            )
            ->orderBy('historico_pontos.created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'saldos' => $saldos,
            'historico' => $historico
        ], 200);
    }

    /**
     * Busca os serviços/imóveis disponíveis
     * (Com base nos casts enviados: valor_diaria, possui_wifi, etc)
     */
    public function getServicos(Request $request)
    {
        // Se você tiver um Model "Servico", "Imovel" ou "Espaco"
        // Certifique-se de que o array de casts que você enviou está no Model correspondente.
        
        $servicos = Servico::where('ativo', true)
            ->where('disponivel', true)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $servicos
        ], 200);
    }

    /**
     * Busca as reservas/agendamentos do usuário logado
     */
    public function getReservas(Request $request)
    {
        $user = $request->user();

        // Busca os agendamentos do usuário. 
        // Adapte as relações (com 'servico' ou 'estabelecimento') conforme o seu banco.
        $reservas = Agendamento::where('usuario_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $reservas
        ], 200);
    }
}