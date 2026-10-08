<?php

namespace App\Support;

use App\Models\HorarioFuncionamento;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Diz se um estabelecimento está aberto agora, a partir dos horários por dia da
 * semana cadastrados pelo sócio. Fuso fixo de Brasília: o app guarda os horários
 * como o estabelecimento os informa, não como UTC.
 */
class StatusFuncionamento
{
    public const FUSO = 'America/Sao_Paulo';

    /**
     * @param  Collection<int, HorarioFuncionamento>  $horarios
     * @return array{aberto: ?bool, texto: string, semana: array<int, array<string, mixed>>}
     */
    public static function de(Collection $horarios, ?CarbonInterface $agora = null): array
    {
        $agora = $agora ? $agora->copy()->setTimezone(self::FUSO) : now(self::FUSO);

        $porDia = $horarios->keyBy('dia_semana');

        $semana = collect(HorarioFuncionamento::DIAS)->map(function (string $nome, int $dia) use ($porDia) {
            $h = $porDia->get($dia);

            return [
                'dia_semana' => $dia,
                'dia' => $nome,
                'fechado' => !$h || $h->fechado || !$h->hora_abertura || !$h->hora_fechamento,
                'abertura' => $h?->hora_abertura ? substr($h->hora_abertura, 0, 5) : null,
                'fechamento' => $h?->hora_fechamento ? substr($h->hora_fechamento, 0, 5) : null,
            ];
        })->values()->all();

        $hoje = collect($semana)->firstWhere('dia_semana', $agora->dayOfWeek);

        if ($horarios->isEmpty()) {
            return ['aberto' => null, 'texto' => 'Horário não informado', 'semana' => $semana];
        }

        if ($hoje['fechado']) {
            return ['aberto' => false, 'texto' => 'Fechado hoje', 'semana' => $semana];
        }

        $abertura = $agora->copy()->setTimeFromTimeString($hoje['abertura']);
        $fechamento = $agora->copy()->setTimeFromTimeString($hoje['fechamento']);
        $virouODia = $fechamento->lessThan($abertura);

        if ($virouODia) {
            $fechamento->addDay();
        }

        if ($agora->lessThan($abertura)) {
            return ['aberto' => false, 'texto' => "Abre às {$hoje['abertura']}", 'semana' => $semana];
        }

        if ($agora->lessThan($fechamento)) {
            return ['aberto' => true, 'texto' => "Aberto · fecha às {$hoje['fechamento']}", 'semana' => $semana];
        }

        return ['aberto' => false, 'texto' => 'Fechado agora', 'semana' => $semana];
    }
}
