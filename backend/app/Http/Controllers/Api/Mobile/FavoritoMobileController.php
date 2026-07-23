<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Favorito;
use App\Models\Agendamento;
use Illuminate\Support\Facades\Auth;

class FavoritoMobileController extends Controller
{
    /**
     * Alterna o status de favorito (Adiciona se não existir, remove se existir)
     */
    public function toggleFavorito(Request $request)
    {
        $request->validate([
            'tipo' => 'required|in:estabelecimento,servico',
            'id'   => 'required|integer'
        ]);

        $userId = Auth::id();
        $coluna = $request->tipo === 'estabelecimento' ? 'estabelecimento_id' : 'servico_id';

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
     * Retorna a lista completa para a tela (Favoritos + Reservas)
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

        // 3. Reservas (Separadas por status conforme solicitado)
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

        return response()->json([
            'estabelecimentos' => $estabelecimentos,
            'servicos'         => $servicos,
            'reservas'         => $reservas
        ], 200);
    }
}