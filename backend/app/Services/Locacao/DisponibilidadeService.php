<?php

namespace App\Services\Locacao;

use App\Models\Aluguel;
use App\Models\ItemAluguel;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Validation\ValidationException;

/**
 * Evita reserva duplicada de um item de locação (imóvel, veículo, quarto...).
 * Cada item tem `quantidade` unidades idênticas (uma "Quarto 303" normalmente
 * tem quantidade=1; um item genérico como "Bicicleta" pode ter várias). Uma
 * data só está livre se a soma das unidades já reservadas nela for menor que
 * `quantidade`.
 */
class DisponibilidadeService
{
    /** Reservas nesses status não ocupam mais a agenda. */
    public const STATUS_LIVRES = ['cancelado', 'estornado', 'reprovada'];

    /**
     * Confere se dá pra reservar `$unidades` unidades do item no período. Lança
     * ValidationException com mensagem pronta para o cliente quando não dá.
     *
     * @throws ValidationException
     */
    public function verificar(ItemAluguel $item, Carbon $inicio, Carbon $fim, int $unidades = 1): void
    {
        if (!$item->ativo || $item->disponivel === false) {
            throw ValidationException::withMessages(['data_inicio' => ['Este item não está disponível para reservas no momento.']]);
        }

        if (!$item->sempre_disponivel) {
            if ($item->data_inicio_disponibilidade && $inicio->lt(Carbon::parse($item->data_inicio_disponibilidade))) {
                throw ValidationException::withMessages(['data_inicio' => ['Este item só pode ser reservado a partir de ' . Carbon::parse($item->data_inicio_disponibilidade)->format('d/m/Y') . '.']]);
            }
            if ($item->data_fim_disponibilidade && $fim->gt(Carbon::parse($item->data_fim_disponibilidade))) {
                throw ValidationException::withMessages(['data_fim' => ['Este item só pode ser reservado até ' . Carbon::parse($item->data_fim_disponibilidade)->format('d/m/Y') . '.']]);
            }

            $diasPermitidos = $item->dias_semana_disponiveis ?? [];
            if (!empty($diasPermitidos) && !in_array((string) $inicio->dayOfWeek, array_map('strval', $diasPermitidos), true)) {
                throw ValidationException::withMessages(['data_inicio' => ['A chegada só pode ser em: ' . $this->nomesDiasSemana($diasPermitidos) . '.']]);
            }

            $bloqueadas = $item->datas_bloqueadas ?? [];
            foreach (CarbonPeriod::create($inicio, $fim->copy()->subDay()->max($inicio)) as $dia) {
                if (in_array($dia->toDateString(), $bloqueadas, true)) {
                    throw ValidationException::withMessages(['data_inicio' => ['O dia ' . $dia->format('d/m/Y') . ' não está disponível para este item.']]);
                }
            }
        }

        $capacidadeTotal = max(1, (int) ($item->quantidade ?? 1));
        $ocupadas = $this->unidadesOcupadas($item, $inicio, $fim);

        if ($ocupadas + $unidades > $capacidadeTotal) {
            $livres = max(0, $capacidadeTotal - $ocupadas);
            $mensagem = $livres === 0
                ? 'Esgotado: não há unidades livres de "' . $item->nome . '" para esse período. Escolha outras datas.'
                : "Só restam {$livres} unidade(s) de \"{$item->nome}\" nesse período (você pediu {$unidades}).";

            throw ValidationException::withMessages(['data_inicio' => [$mensagem], 'esgotado' => [$mensagem]]);
        }
    }

    /** Quantas unidades do item já estão comprometidas em algum dia do período [inicio, fim). */
    public function unidadesOcupadas(ItemAluguel $item, Carbon $inicio, Carbon $fim, ?int $ignorarAluguelId = null): int
    {
        return (int) Aluguel::where('item_aluguel_id', $item->id)
            ->whereNotIn('status', self::STATUS_LIVRES)
            ->when($ignorarAluguelId, fn ($q) => $q->where('id', '!=', $ignorarAluguelId))
            // Sobreposição de intervalos: começa antes do fim do novo e termina depois do início do novo.
            ->where('data_inicio', '<', $fim)
            ->where('data_fim', '>', $inicio)
            ->sum('quantidade');
    }

    /**
     * Resumo de vagas de HOJE, para o selo "Poucas vagas"/"Esgotado" nos cards de listagem.
     * Só faz sentido para itens com mais de 1 unidade; com quantidade=1 é só disponível/esgotado
     * (sem "poucas vagas" — não existe "quase esgotado" quando só tem uma unidade).
     *
     * @return array{status: string|null, restantes: int, capacidade_total: int}
     */
    public function resumoHoje(ItemAluguel $item): array
    {
        $capacidadeTotal = max(1, (int) ($item->quantidade ?? 1));
        $hoje = Carbon::today();
        $ocupadas = $this->unidadesOcupadas($item, $hoje, $hoje->copy()->addDay());
        $restantes = max(0, $capacidadeTotal - $ocupadas);

        $status = match (true) {
            $restantes <= 0 => 'esgotado',
            $capacidadeTotal > 1 && $restantes <= max(1, (int) ceil($capacidadeTotal * 0.2)) => 'poucas_vagas',
            default => null,
        };

        return ['status' => $status, 'restantes' => $restantes, 'capacidade_total' => $capacidadeTotal];
    }

    /**
     * Datas (check-in) totalmente esgotadas nos próximos `$diasAFrente` dias — para o
     * calendário do cliente desabilitar e mostrar "Esgotado" sem precisar de outra chamada.
     */
    public function datasEsgotadas(ItemAluguel $item, int $diasAFrente = 180): array
    {
        $capacidadeTotal = max(1, (int) ($item->quantidade ?? 1));
        $inicio = Carbon::today();
        $fim = $inicio->copy()->addDays($diasAFrente);

        $reservas = Aluguel::where('item_aluguel_id', $item->id)
            ->whereNotIn('status', self::STATUS_LIVRES)
            ->where('data_fim', '>', $inicio)
            ->where('data_inicio', '<', $fim)
            ->get(['data_inicio', 'data_fim', 'quantidade']);

        if ($reservas->isEmpty()) {
            return [];
        }

        $ocupacaoPorDia = [];
        foreach ($reservas as $r) {
            $de = Carbon::parse($r->data_inicio)->max($inicio);
            $ate = Carbon::parse($r->data_fim)->min($fim);
            foreach (CarbonPeriod::create($de, $ate->copy()->subDay()->max($de)) as $dia) {
                $chave = $dia->toDateString();
                $ocupacaoPorDia[$chave] = ($ocupacaoPorDia[$chave] ?? 0) + (int) $r->quantidade;
            }
        }

        return collect($ocupacaoPorDia)->filter(fn ($qtd) => $qtd >= $capacidadeTotal)->keys()->sort()->values()->all();
    }

    private function nomesDiasSemana(array $dias): string
    {
        $nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        return collect($dias)->map(fn ($d) => $nomes[(int) $d] ?? $d)->implode(', ');
    }
}
