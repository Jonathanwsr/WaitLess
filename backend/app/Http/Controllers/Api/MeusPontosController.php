<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PontosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/** Tela "Meus pontos" do cliente: saldo, quanto vale, histórico, pontos por local e regras de uso. */
class MeusPontosController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $saldo = (int) $user->pontos_saldo;

        $historico = DB::table('historico_pontos')
            ->leftJoin('estabelecimentos', 'estabelecimentos.id', '=', 'historico_pontos.estabelecimento_id')
            ->where('historico_pontos.usuario_id', $user->id)
            ->orderByDesc('historico_pontos.created_at')
            ->limit(100)
            ->get([
                'historico_pontos.id', 'historico_pontos.tipo', 'historico_pontos.descricao',
                'historico_pontos.quantidade', 'historico_pontos.created_at', 'estabelecimentos.nome as local',
            ])
            ->map(fn ($h) => [
                'id' => $h->id,
                'entrada' => $h->tipo === 'ganho',
                'descricao' => $h->descricao,
                'quantidade' => (int) $h->quantidade,
                'local' => $h->local,
                'data' => $h->created_at,
            ]);

        $inicioMes = now('America/Sao_Paulo')->startOfMonth();
        $ganhosNoMes = (int) DB::table('historico_pontos')
            ->where('usuario_id', $user->id)
            ->where('tipo', 'ganho')
            ->where('created_at', '>=', $inicioMes)
            ->sum('quantidade');

        $porLocal = DB::table('pontos_usuario_estabelecimento')
            ->join('estabelecimentos', 'estabelecimentos.id', '=', 'pontos_usuario_estabelecimento.estabelecimento_id')
            ->where('pontos_usuario_estabelecimento.usuario_id', $user->id)
            ->where('pontos_usuario_estabelecimento.total_pontos', '>', 0)
            ->orderByDesc('pontos_usuario_estabelecimento.total_pontos')
            ->limit(12)
            ->get(['estabelecimentos.id', 'estabelecimentos.nome', 'estabelecimentos.foto_perfil', 'pontos_usuario_estabelecimento.total_pontos', 'pontos_usuario_estabelecimento.nivel']);

        $premium = $user->isPremium();

        return Inertia::render('Cliente/MeusPontos', [
            'saldo' => $saldo,
            'valorEmReais' => PontosService::pontosParaValor($saldo),
            'pontosPorReal' => PontosService::PONTOS_POR_REAL,
            'ganhosNoMes' => $ganhosNoMes,
            'historico' => $historico,
            'porLocal' => $porLocal,
            'premium' => [
                'ativo' => $premium,
                'plano' => $user->plano_assinatura,
            ],
        ]);
    }
}
