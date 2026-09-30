<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * Preço de serviços e reservas, com promoção e número de pessoas.
 *
 * - SERVIÇO: o valor é POR PESSOA. Quem aceita mais de uma pessoa por horário define
 *   `max_pessoas` em servicos.configuracoes; o total é valor (já com promoção) × pessoas.
 * - RESERVA (locação): a diária cobre `pessoas_incluidas` (padrão 1); cada pessoa a mais paga
 *   `valor_pessoa_extra` por dia, até a capacidade do local (`capacidade_pessoas`/`lugares`).
 *   Sem valor de pessoa extra configurado, o preço não muda com o número de pessoas.
 *
 * O app usa isto para mostrar a prévia e o servidor usa a mesma regra ao gravar a reserva.
 */
class PrecificacaoService
{
    public const DIAS_DO_PERIODO = ['diaria' => 1, 'semanal' => 7, 'mensal' => 30];

    public function comPromocao(float $valor, bool $temPromocao, ?string $tipoDesconto, mixed $valorDesconto): float
    {
        if (!$temPromocao || !$valorDesconto) {
            return round($valor, 2);
        }

        $desconto = (float) $valorDesconto;
        $final = $tipoDesconto === 'fixo' ? $valor - $desconto : $valor - ($valor * $desconto / 100);

        return round(max($final, 0), 2);
    }

    public function configuracoes(object $servico): array
    {
        $cfg = $servico->configuracoes ?? [];
        if (is_string($cfg)) {
            $cfg = json_decode($cfg, true) ?: [];
        }

        return (array) $cfg;
    }

    public function maxPessoasServico(object $servico): int
    {
        return max(1, (int) ($this->configuracoes($servico)['max_pessoas'] ?? 1));
    }

    public function capacidadeItem(object $item): int
    {
        return max(1, (int) ($item->capacidade_pessoas ?: $item->lugares ?: 1));
    }

    /** @return array{pessoas:int, max_pessoas:int, valor_base:float, valor_unitario:float, subtotal:float, linhas:array} */
    public function servico(object $servico, int $pessoas = 1): array
    {
        $max = $this->maxPessoasServico($servico);
        if ($pessoas < 1 || $pessoas > $max) {
            throw new InvalidArgumentException($max === 1
                ? 'Este serviço atende uma pessoa por horário.'
                : "Este serviço aceita de 1 a {$max} pessoas por horário.");
        }

        $base = (float) $servico->valor;
        $unitario = $this->comPromocao($base, (bool) ($servico->tem_promocao ?? false), $servico->tipo_desconto ?? null, $servico->valor_desconto ?? null);
        $subtotal = round($unitario * $pessoas, 2);

        $linhas = [['rotulo' => $pessoas > 1 ? "{$pessoas} pessoas × " . $this->reais($unitario) : 'Serviço', 'valor' => $subtotal]];
        if ($unitario < $base) {
            $linhas[] = ['rotulo' => 'Promoção já aplicada (de ' . $this->reais($base) . ' por pessoa)', 'valor' => null];
        }

        return ['pessoas' => $pessoas, 'max_pessoas' => $max, 'valor_base' => $base, 'valor_unitario' => $unitario, 'subtotal' => $subtotal, 'linhas' => $linhas];
    }

    /**
     * @return array{pessoas:int, capacidade:int, valor_unitario:float, extra_por_periodo:float, bruto:float, caucao:float, dias_periodo:int, linhas:array}
     */
    public function item(object $item, string $periodo, int $quantidade, int $pessoas = 1): array
    {
        if (!isset(self::DIAS_DO_PERIODO[$periodo])) {
            throw new InvalidArgumentException('Período inválido.');
        }

        $capacidade = $this->capacidadeItem($item);
        if ($pessoas < 1 || $pessoas > $capacidade) {
            throw new InvalidArgumentException($capacidade === 1
                ? 'Este item comporta uma pessoa.'
                : "Este local comporta de 1 a {$capacidade} pessoas.");
        }

        $diaria = (float) $item->valor_diaria;
        $base = match ($periodo) {
            'semanal' => (float) ($item->valor_semanal ?: $diaria * 7),
            'mensal' => (float) ($item->valor_mensal ?: $diaria * 30),
            default => $diaria,
        };
        if ($base <= 0) {
            throw new InvalidArgumentException('A precificação para esta modalidade de período não foi configurada.');
        }

        $unitario = $this->comPromocao($base, (bool) ($item->tem_promocao ?? false), $item->tipo_desconto ?? null, $item->valor_desconto ?? null);
        $rotuloPeriodo = ['diaria' => 'diária', 'semanal' => 'semana', 'mensal' => 'mês'][$periodo];
        $porPessoa = ($item->modelo_precificacao ?? 'pacote') === 'por_pessoa';

        if ($porPessoa) {
            // Cada pessoa paga o valor cheio da diária/semana/mês — sem "pessoas incluídas".
            $valorPorPeriodo = round($unitario * $pessoas, 2);
            $bruto = round($valorPorPeriodo * $quantidade, 2);
            $extras = 0;
            $extraPorPeriodo = 0.0;

            $linhas = [['rotulo' => "{$pessoas} pessoa" . ($pessoas > 1 ? 's' : '') . ' × ' . $this->reais($unitario) . " × {$quantidade} {$rotuloPeriodo}(s)", 'valor' => $bruto]];
        } else {
            $incluidas = max(1, (int) ($item->pessoas_incluidas ?: $capacidade));
            $extras = max(0, $pessoas - $incluidas);
            $dias = self::DIAS_DO_PERIODO[$periodo];
            $extraPorPeriodo = round($extras * (float) ($item->valor_pessoa_extra ?? 0) * $dias, 2);

            $bruto = round(($unitario + $extraPorPeriodo) * $quantidade, 2);

            $linhas = [['rotulo' => "{$quantidade} × " . $this->reais($unitario) . " ({$rotuloPeriodo})", 'valor' => round($unitario * $quantidade, 2)]];
            if ($extraPorPeriodo > 0) {
                $linhas[] = ['rotulo' => "{$extras} " . ($extras === 1 ? 'pessoa extra' : 'pessoas extras') . ' × ' . $this->reais((float) $item->valor_pessoa_extra) . '/dia', 'valor' => round($extraPorPeriodo * $quantidade, 2)];
            }
        }

        return [
            'pessoas' => $pessoas, 'capacidade' => $capacidade, 'valor_unitario' => $unitario,
            'modelo_precificacao' => $porPessoa ? 'por_pessoa' : 'pacote',
            'extra_por_periodo' => $extraPorPeriodo, 'bruto' => $bruto,
            'caucao' => (float) ($item->valor_caucao ?? 0), 'dias_periodo' => self::DIAS_DO_PERIODO[$periodo], 'linhas' => $linhas,
        ];
    }

    private function reais(float $v): string
    {
        return 'R$ ' . number_format($v, 2, ',', '.');
    }
}
