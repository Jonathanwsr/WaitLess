<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Favorito;
use App\Models\Agendamento;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia; // <-- IMPORTANTE: Importar o Inertia

class FavoritoController extends Controller
{
    /**
     * Alterna o status de favorito (Adiciona se não existir, remove se existir)
     */
   public function toggleFavorito(Request $request)
    {
        // 1. Atualizamos a validação para aceitar o item_aluguel
        $request->validate([
            'tipo' => 'required|in:estabelecimento,servico,item_aluguel',
            'id'   => 'required|integer'
        ]);

        $userId = Auth::id();
        
        // 2. Descobrimos qual coluna usar baseada no tipo
        if ($request->tipo === 'estabelecimento') {
            $coluna = 'estabelecimento_id';
        } elseif ($request->tipo === 'item_aluguel') {
            $coluna = 'item_aluguel_id';
        } else {
            $coluna = 'servico_id';
        }

        $favorito = Favorito::where('usuario_id', $userId)->where($coluna, $request->id)->first();

        if ($favorito) {
            $favorito->delete();
            return response()->json(['message' => 'Removido dos favoritos', 'is_favorito' => false]);
        } else {
            Favorito::create([
                'usuario_id' => $userId,
                $coluna      => $request->id
            ]);
            return response()->json(['message' => 'Adicionado aos favoritos', 'is_favorito' => true]);
        }
    }

    /**
     * Retorna a lista completa para a tela do React (Favoritos + Reservas)
     */
    public function index(Request $request)
    {
        $userId = Auth::id();

        // 1. Estabelecimentos Favoritos
        $estabelecimentos = Favorito::with('estabelecimento')
            ->where('usuario_id', $userId)
            ->whereNotNull('estabelecimento_id')
            ->get()
            ->map(function ($fav) {
                return $fav->estabelecimento;
            });

        // 2. Serviços Favoritos
        $servicos = Favorito::with('servico.estabelecimento')
            ->where('usuario_id', $userId)
            ->whereNotNull('servico_id')
            ->get()
            ->map(function ($fav) {
                return $fav->servico;
            });

        // 3. Reservas (Separadas por status)
        $agendamentos = Agendamento::with(['servico', 'estabelecimento'])
            ->where('usuario_id', $userId)
            ->orderBy('data_agendamento', 'desc')
            ->get();

        $reservas = [
            'proximas'     => $agendamentos->whereIn('status', ['pendente', 'confirmado'])->values(),
            'em_andamento' => $agendamentos->where('status', 'em_atendimento')->values(),
            'concluidas'   => $agendamentos->where('status', 'finalizado')->values(),
            'canceladas'   => $agendamentos->whereIn('status', ['cancelado', 'estornado'])->values(),
        ];

        // MUDANÇA AQUI: Retorna a tela React (Favoritos.jsx) com os dados
        return Inertia::render('Cliente/Favoritos', [
            'estabelecimentos' => $estabelecimentos,
            'servicos'         => $servicos,
            'reservas'         => $reservas
        ]);
    }
}