<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Números simples para saber se a plataforma está crescendo: os mesmos que definem se o
 * marketplace "pega" (locais que realmente recebem reservas e clientes que voltam).
 */
class MetricasCrescimentoService
{
    private const STATUS_VALIDOS = ['pendente', 'confirmado', 'em_atendimento', 'finalizado'];

    public function gerar(int $dias = 30): array
    {
        $desde = now()->subDays($dias);

        $locaisAtivos = (int) DB::table('estabelecimentos')->where('ativo', true)->count();

        $locaisComReserva = (int) DB::table('agendamentos')
            ->whereIn('status', self::STATUS_VALIDOS)
            ->where('created_at', '>=', $desde)
            ->distinct()->count('estabelecimento_id');

        $reservas = (int) DB::table('agendamentos')->whereIn('status', self::STATUS_VALIDOS)->where('created_at', '>=', $desde)->count();
        $semanas = max($dias / 7, 1);

        $clientesNovos = (int) DB::table('users')->where('papel', 'user')->where('created_at', '>=', $desde)->count();

        // Retenção: dos clientes que fizeram a 1ª reserva na janela, quantos já têm a 2ª.
        $primeiraNaJanela = DB::table('agendamentos')
            ->select('usuario_id', DB::raw('MIN(created_at) as primeira'))
            ->whereIn('status', self::STATUS_VALIDOS)
            ->groupBy('usuario_id')
            ->havingRaw('MIN(created_at) >= ?', [$desde]);
        $compraramNaJanela = DB::query()->fromSub($primeiraNaJanela, 'p')->count();
        $voltaram = DB::query()->fromSub($primeiraNaJanela, 'p')
            ->whereRaw('(SELECT COUNT(*) FROM agendamentos a WHERE a.usuario_id = p.usuario_id AND a.status IN (\'pendente\',\'confirmado\',\'em_atendimento\',\'finalizado\')) >= 2')
            ->count();

        $indicados = (int) DB::table('users')->where('created_at', '>=', $desde)->whereNotNull('indicado_por_id')->count();

        return [
            'periodo_dias' => $dias,
            'locais_ativos' => $locaisAtivos,
            'locais_com_reserva' => $locaisComReserva,
            'percentual_locais_com_reserva' => $locaisAtivos > 0 ? round($locaisComReserva / $locaisAtivos * 100, 1) : 0,
            'reservas' => $reservas,
            'reservas_por_local_por_semana' => $locaisComReserva > 0 ? round($reservas / $locaisComReserva / $semanas, 2) : 0,
            'clientes_novos' => $clientesNovos,
            'clientes_novos_que_reservaram' => $compraramNaJanela,
            'clientes_que_voltaram' => $voltaram,
            'percentual_que_voltou' => $compraramNaJanela > 0 ? round($voltaram / $compraramNaJanela * 100, 1) : 0,
            'cadastros_por_indicacao' => $indicados,
            'cadastros_organicos' => max(0, $clientesNovos - $indicados),
        ];
    }
}
