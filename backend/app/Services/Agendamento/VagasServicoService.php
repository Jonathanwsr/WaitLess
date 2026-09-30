<?php

namespace App\Services\Agendamento;

use App\Models\Agendamento;
use App\Models\Servico;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Controle de vagas por horário de um serviço (ex.: aula em grupo com 10 vagas às 09h).
 * `servicos.vagas_por_horario` vale para TODOS os horários configurados do serviço; cada
 * combinação dia+horário tem sua própria contagem, que vai diminuindo conforme os clientes
 * agendam, até esgotar — sem depender de profissional ou estabelecimento específico.
 */
class VagasServicoService
{
    public const STATUS_LIVRES = ['cancelado', 'estornado'];

    /** Nomes usados em `servicos.configuracoes.dias_disponiveis` / `carbon->dayOfWeek` (0=domingo). */
    private const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

    public function capacidade(object $servico): int
    {
        return max(1, (int) ($servico->vagas_por_horario ?: 1));
    }

    public function ocupadas(object $servico, string $data, string $hora): int
    {
        return Agendamento::where('servico_id', $servico->id)
            ->whereDate('data_agendamento', $data)
            ->where('hora_agendamento', $hora)
            ->whereNotIn('status', self::STATUS_LIVRES)
            ->count();
    }

    public function vagasLivres(object $servico, string $data, string $hora): int
    {
        return max(0, $this->capacidade($servico) - $this->ocupadas($servico, $data, $hora));
    }

    /**
     * @throws ValidationException
     */
    public function verificar(object $servico, string $data, string $hora): void
    {
        if ($this->vagasLivres($servico, $data, $hora) > 0) {
            return;
        }

        $dataFormatada = Carbon::parse($data)->format('d/m/Y');
        $horaFormatada = substr($hora, 0, 5);

        throw ValidationException::withMessages([
            'hora_agendamento' => ["Esgotado: não há mais vagas para {$servico->nome} às {$horaFormatada} do dia {$dataFormatada}. Escolha outro horário."],
        ]);
    }

    private function configuracoes(object $servico): array
    {
        $cfg = $servico->configuracoes;
        if (is_string($cfg)) {
            $cfg = json_decode($cfg, true);
        }

        return is_array($cfg) ? $cfg : [];
    }

    private function horariosDoServico(object $servico): array
    {
        $h = $servico->horarios_disponiveis;
        if (is_string($h)) {
            $h = json_decode($h, true);
        }

        return is_array($h) ? array_values(array_filter($h)) : [];
    }

    /** O serviço atende no dia da semana informado (0=domingo)? Sem `dias_disponiveis` configurado = atende todo dia. */
    private function atendeNoDia(object $servico, int $diaSemana): bool
    {
        $dias = $this->configuracoes($servico)['dias_disponiveis'] ?? [];

        return empty($dias) || in_array(self::DIAS_SEMANA[$diaSemana], $dias, true);
    }

    /**
     * Resumo de vagas de HOJE, para mostrar "Poucas vagas"/"Esgotado" nos cards de listagem.
     * Sem horários configurados, ou serviço fechado hoje: sem selo (não dá pra saber a agenda).
     *
     * @return array{status: string|null, restantes: int|null, capacidade_total: int|null}
     */
    public function resumoHoje(object $servico): array
    {
        $hoje = Carbon::today();
        $horarios = $this->horariosDoServico($servico);

        if (empty($horarios) || !$this->atendeNoDia($servico, (int) $hoje->dayOfWeek)) {
            return ['status' => null, 'restantes' => null, 'capacidade_total' => null];
        }

        $capacidadePorHorario = $this->capacidade($servico);
        $capacidadeTotal = $capacidadePorHorario * count($horarios);

        $ocupadasHoje = Agendamento::where('servico_id', $servico->id)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('hora_agendamento', $horarios)
            ->whereNotIn('status', self::STATUS_LIVRES)
            ->count();

        $restantes = max(0, $capacidadeTotal - $ocupadasHoje);
        $limiarPoucasVagas = max(1, (int) ceil($capacidadeTotal * 0.2));

        $status = match (true) {
            $restantes <= 0 => 'esgotado',
            $restantes <= $limiarPoucasVagas => 'poucas_vagas',
            default => null,
        };

        return ['status' => $status, 'restantes' => $restantes, 'capacidade_total' => $capacidadeTotal];
    }
}
