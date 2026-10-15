<?php

namespace App\Services\Locacao;

use App\Models\Aluguel;
use Carbon\Carbon;

/**
 * Política de cancelamento de reservas, no modelo do Airbnb.
 *
 * O dono escolhe a política do item (flexível, moderada, firme ou rigorosa). Reservas de 28 dias ou
 * mais usam sempre a política de longa duração. A caução volta sempre inteira. Quando quem cancela é o
 * dono, o cliente recebe 100% de volta, sem precisar pedir estorno.
 */
class PoliticaCancelamentoService
{
    public const FUSO = 'America/Sao_Paulo';
    public const DIAS_LONGA_DURACAO = 28;

    public const POLITICAS = [
        'flexivel' => [
            'nome' => 'Flexível',
            'resumo' => 'Reembolso total até 24 horas antes do início. Depois disso, o primeiro dia não é reembolsado e o restante volta.',
        ],
        'moderada' => [
            'nome' => 'Moderada',
            'resumo' => 'Reembolso total até 5 dias antes do início. Depois disso, volta 50% do valor.',
        ],
        'firme' => [
            'nome' => 'Firme',
            'resumo' => 'Reembolso total até 30 dias antes do início. Entre 30 e 7 dias antes, volta 50%. A menos de 7 dias, não há reembolso.',
        ],
        'rigorosa' => [
            'nome' => 'Rigorosa',
            'resumo' => 'Reembolso total se cancelar em até 48 horas depois de reservar, faltando 14 dias ou mais. Até 7 dias antes, volta 50%. Depois disso, não há reembolso.',
        ],
        'longa_duracao' => [
            'nome' => 'Longa duração',
            'resumo' => 'Para reservas de 28 dias ou mais: reembolso total até 30 dias antes do início. Depois disso, os primeiros 30 dias não são reembolsados e o restante volta.',
        ],
    ];

    /** Políticas que o dono pode escolher (longa duração é automática). */
    public static function opcoes(): array
    {
        return collect(self::POLITICAS)->except('longa_duracao')
            ->map(fn ($p, $id) => ['id' => $id] + $p)->values()->all();
    }

    public static function valida(?string $politica): string
    {
        return $politica && isset(self::POLITICAS[$politica]) && $politica !== 'longa_duracao' ? $politica : 'moderada';
    }

    /** Política de um item para mostrar antes de reservar. */
    public static function infoDoItem(?string $politica): array
    {
        $id = self::valida($politica);

        return [
            'id' => $id,
            'nome' => self::POLITICAS[$id]['nome'],
            'resumo' => self::POLITICAS[$id]['resumo'],
            'longa_duracao' => self::POLITICAS['longa_duracao']['resumo'],
        ];
    }

    /**
     * Para a tela da reserva: qual política vale e, se já foi paga e ainda pode ser cancelada,
     * quanto o cliente recebe se cancelar agora.
     */
    public function resumoParaCliente(Aluguel $aluguel): array
    {
        $aluguel->loadMissing('item');
        $politica = $this->politicaDa($aluguel);
        $pagamento = \App\Models\Pagamento::where('aluguel_id', $aluguel->id)->where('status', 'pago')->first();
        $cancelavel = !in_array($aluguel->status, ['cancelado', 'finalizado', 'concluido'], true);

        return [
            'politica' => $politica,
            'nome' => self::POLITICAS[$politica]['nome'],
            'resumo' => self::POLITICAS[$politica]['resumo'],
            'se_cancelar_agora' => $pagamento && $cancelavel
                ? $this->calcular($aluguel, (float) ($pagamento->valor_total ?? $pagamento->valor))
                : null,
            'valor_reembolsado' => $aluguel->valor_reembolsado !== null ? (float) $aluguel->valor_reembolsado : null,
        ];
    }

    public function momentoDeChegada(Aluguel $aluguel): Carbon
    {
        $hora = $aluguel->item?->horario_retirada ? substr((string) $aluguel->item->horario_retirada, 0, 5) : '14:00';

        return Carbon::parse(Carbon::parse($aluguel->data_inicio)->format('Y-m-d') . ' ' . $hora, self::FUSO);
    }

    /** Dias da reserva (mínimo 1). */
    public function duracaoEmDias(Aluguel $aluguel): int
    {
        $inicio = Carbon::parse($aluguel->data_inicio, self::FUSO)->startOfDay();
        $fim = Carbon::parse($aluguel->data_fim, self::FUSO)->startOfDay();

        return max(1, (int) $inicio->diffInDays($fim));
    }

    /** Política que vale para esta reserva: longa duração (28+ dias) ou a do item. */
    public function politicaDa(Aluguel $aluguel): string
    {
        if ($this->duracaoEmDias($aluguel) >= self::DIAS_LONGA_DURACAO) {
            return 'longa_duracao';
        }

        return self::valida($aluguel->item?->politica_cancelamento);
    }

    /**
     * Quanto volta se a reserva for cancelada agora.
     *
     * @param float $valorPago valor efetivamente pago (inclui a caução)
     * @return array{politica: string, politica_nome: string, percentual: int, valor_reembolso: float, valor_retido: float, caucao: float, explicacao: string, pelo_dono: bool}
     */
    public function calcular(Aluguel $aluguel, float $valorPago, bool $peloDono = false, ?Carbon $agora = null): array
    {
        $agora ??= now(self::FUSO);
        $politica = $this->politicaDa($aluguel);
        $caucao = min($valorPago, max(0.0, (float) $aluguel->valor_caucao));
        $base = max(0.0, $valorPago - $caucao);

        if ($peloDono) {
            return $this->resultado($politica, $base, $base, $caucao, 'O responsável cancelou a reserva: o valor pago volta inteiro.', true);
        }

        // Como no Airbnb, a antecedência conta até o horário de chegada (horário de retirada do item, ou 14h).
        $inicio = $this->momentoDeChegada($aluguel);
        $horasAteInicio = $agora->diffInHours($inicio, false);
        $diasAteInicio = $horasAteInicio / 24;
        $dias = $this->duracaoEmDias($aluguel);
        $valorPorDia = $base / $dias;

        [$reembolso, $explicacao] = match ($politica) {
            'flexivel' => $horasAteInicio >= 24
                ? [$base, 'Cancelado com mais de 24 horas de antecedência: reembolso total.']
                : [max(0, $base - $valorPorDia), 'Cancelado com menos de 24 horas: o primeiro dia não é reembolsado.'],

            'moderada' => $diasAteInicio >= 5
                ? [$base, 'Cancelado com 5 dias ou mais de antecedência: reembolso total.']
                : [$base * 0.5, 'Cancelado com menos de 5 dias: volta 50% do valor.'],

            'firme' => match (true) {
                $diasAteInicio >= 30 => [$base, 'Cancelado com 30 dias ou mais de antecedência: reembolso total.'],
                $diasAteInicio >= 7 => [$base * 0.5, 'Cancelado entre 30 e 7 dias antes: volta 50% do valor.'],
                default => [0.0, 'Cancelado com menos de 7 dias: sem reembolso (exceto a caução).'],
            },

            'rigorosa' => match (true) {
                $diasAteInicio >= 14 && Carbon::parse($aluguel->created_at)->diffInHours($agora) <= 48
                    => [$base, 'Cancelado em até 48 horas depois de reservar, faltando 14 dias ou mais: reembolso total.'],
                $diasAteInicio >= 7 => [$base * 0.5, 'Cancelado com 7 dias ou mais de antecedência: volta 50% do valor.'],
                default => [0.0, 'Cancelado com menos de 7 dias: sem reembolso (exceto a caução).'],
            },

            default => $diasAteInicio >= 30 // longa duração
                ? [$base, 'Reserva longa cancelada com 30 dias ou mais de antecedência: reembolso total.']
                : [max(0, $base - $valorPorDia * min(30, $dias)), 'Reserva longa cancelada com menos de 30 dias: os primeiros 30 dias não são reembolsados.'],
        };

        return $this->resultado($politica, $base, (float) $reembolso, $caucao, $explicacao, false);
    }

    private function resultado(string $politica, float $base, float $reembolsoBase, float $caucao, string $explicacao, bool $peloDono): array
    {
        $reembolsoBase = round(min($base, max(0, $reembolsoBase)), 2);
        $total = round($reembolsoBase + $caucao, 2);

        return [
            'politica' => $politica,
            'politica_nome' => self::POLITICAS[$politica]['nome'],
            'percentual' => $base > 0 ? (int) round($reembolsoBase / $base * 100) : 100,
            'valor_reembolso' => $total,
            'valor_retido' => round($base - $reembolsoBase, 2),
            'caucao' => round($caucao, 2),
            'explicacao' => $explicacao . ($caucao > 0 ? ' A caução volta inteira.' : ''),
            'pelo_dono' => $peloDono,
        ];
    }
}
