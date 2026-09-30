<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Nota, critérios e avaliações REAIS de um anfitrião (mesma regra da página do item no site).
 * Superanfitrião: nota média >= 4,8 com pelo menos 10 avaliações públicas.
 */
class ReputacaoAnfitriaoService
{
    public function resumo(int $estabelecimentoId): array
    {
        $base = DB::table('avaliacoes')->where('estabelecimento_id', $estabelecimentoId)->where('publica', true);

        $stats = (clone $base)->selectRaw(
            'COUNT(*) as total, AVG(nota) as media, AVG(nota_limpeza) as limpeza, AVG(nota_localizacao) as localizacao, '
            . 'AVG(nota_precisao) as precisao, AVG(nota_custo_beneficio) as custo_beneficio, AVG(nota_comunicacao) as comunicacao, AVG(nota_checkin) as checkin'
        )->first();

        $total = (int) ($stats->total ?? 0);
        $arred = fn ($v) => $v === null ? null : round((float) $v, 1);
        $media = $total > 0 ? $arred($stats->media) : null;

        $previa = (clone $base)
            ->join('users', 'users.id', '=', 'avaliacoes.usuario_id')
            ->orderByDesc('avaliacoes.created_at')
            ->limit(3)
            ->get(['users.name as autor', 'users.foto_perfil as foto', 'avaliacoes.nota', 'avaliacoes.comentario', 'avaliacoes.created_at'])
            ->map(fn ($a) => [
                'autor' => $a->autor,
                'foto' => $a->foto,
                'nota' => (float) $a->nota,
                'comentario' => $a->comentario,
                'data' => Carbon::parse($a->created_at)->locale('pt_BR')->translatedFormat('F \\d\\e Y'),
            ])->all();

        $dono = User::find($estabelecimentoId);

        return [
            'avaliacoes' => [
                'total' => $total,
                'media' => $media,
                'criterios' => array_filter([
                    'Limpeza' => $arred($stats->limpeza ?? null),
                    'Localização' => $arred($stats->localizacao ?? null),
                    'Precisão' => $arred($stats->precisao ?? null),
                    'Custo-benefício' => $arred($stats->custo_beneficio ?? null),
                    'Comunicação' => $arred($stats->comunicacao ?? null),
                    'Check-in' => $arred($stats->checkin ?? null),
                ], fn ($v) => $v !== null),
                'previa' => $previa,
            ],
            'anfitriao' => [
                'nome' => $dono?->name,
                'foto' => $dono?->foto_perfil,
                'desde' => $dono?->created_at?->locale('pt_BR')->translatedFormat('F \\d\\e Y'),
                'superanfitriao' => $total >= 10 && $media !== null && $media >= 4.8,
            ],
        ];
    }
}
