<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Lembretes automáticos para o cliente, uma vez por compromisso:
 * - agendamento de serviço: ~24h antes do horário;
 * - reserva (avulsa ou de local): na véspera do início/check-in.
 * Vai por push (app) e e-mail. Avisa também o que falta (pagar no local, aceitar o contrato).
 */
class LembretesService
{
    /** Antecedência do lembrete. */
    public const HORAS_ANTES = 24;

    /** Reservas feitas em cima da hora (menos que isso antes do início) não recebem lembrete. */
    public const MINUTOS_MINIMOS_APOS_RESERVA = 120;

    private const STATUS_ENCERRADOS = ['cancelado', 'cancelada', 'finalizado', 'concluido', 'concluído', 'recusado', 'nao_compareceu', 'no_show', 'em_andamento', 'expirado'];

    public function __construct(private NotificacaoService $notificacoes) {}

    /** @return array{agendamentos:int, reservas:int} */
    public function enviarPendentes(?Carbon $agora = null): array
    {
        $agora ??= now();

        return ['agendamentos' => $this->agendamentos($agora), 'reservas' => $this->reservas($agora)];
    }

    private function agendamentos(Carbon $agora): int
    {
        $limite = $agora->copy()->addHours(self::HORAS_ANTES);
        $enviados = 0;

        Agendamento::query()
            ->whereNull('lembrete_enviado_em')
            ->whereNotIn('status', self::STATUS_ENCERRADOS)
            ->whereBetween('data_agendamento', [$agora->toDateString(), $limite->toDateString()])
            ->with(['usuario', 'servico:id,nome', 'estabelecimento:id,nome'])
            ->orderBy('id')
            ->chunkById(200, function ($lote) use ($agora, $limite, &$enviados) {
                foreach ($lote as $ag) {
                    $quando = $this->dataHora($ag->data_agendamento, $ag->hora_agendamento);
                    if (!$quando || $quando->lte($agora) || $quando->gt($limite) || !$this->feitoComAntecedencia($ag->created_at, $quando)) {
                        continue;
                    }
                    if (!$ag->usuario) {
                        continue;
                    }

                    $local = $ag->estabelecimento?->nome ?: 'o estabelecimento';
                    $servico = $ag->servico?->nome ?: 'seu serviço';
                    $titulo = $quando->isTomorrow() ? 'Seu horário é amanhã' : 'Seu horário é hoje';
                    $texto = "{$servico} em {$local} · " . $this->quandoLegivel($quando) . '.';
                    if (in_array($ag->status_pagamento, ['local', 'presencial', 'pagar_no_local'], true)) {
                        $texto .= ' O pagamento é feito no local.';
                    }

                    $this->notificar($ag->usuario, $titulo, $texto, ['tipo' => 'lembrete', 'rota' => '/agendamentos/detalhes', 'id' => (string) $ag->id, 'tipo_item' => 'servico']);
                    $ag->forceFill(['lembrete_enviado_em' => now()])->saveQuietly();
                    $enviados++;
                }
            });

        return $enviados;
    }

    private function reservas(Carbon $agora): int
    {
        $limite = $agora->copy()->addHours(self::HORAS_ANTES);
        $enviados = 0;

        Aluguel::query()
            ->whereNull('lembrete_enviado_em')
            ->whereNotIn('status', self::STATUS_ENCERRADOS)
            ->where('data_inicio', '>', $agora)
            ->where('data_inicio', '<=', $limite)
            ->with(['locatario', 'item:id,nome', 'contratoDocumento'])
            ->orderBy('id')
            ->chunkById(200, function ($lote) use (&$enviados) {
                foreach ($lote as $al) {
                    if (!$al->locatario || !$this->feitoComAntecedencia($al->created_at, $al->data_inicio)) {
                        continue;
                    }

                    $item = $al->item?->nome ?: 'sua reserva';
                    $titulo = $al->data_inicio->isTomorrow() ? 'Sua reserva começa amanhã' : 'Sua reserva começa hoje';
                    $texto = "{$item} · " . $this->quandoLegivel($al->data_inicio) . '.';
                    $pendencias = [];
                    $contrato = $al->contratoDocumento ?? \App\Models\Contrato::where('aluguel_id', $al->id)->latest('id')->first();
                    if ($contrato && !$contrato->assinado) {
                        $pendencias[] = 'leia e aceite o contrato';
                    }
                    if (!$al->pagamento_confirmado && in_array($al->forma_pagamento, ['presencial', 'local', 'dinheiro', 'pagar_no_local'], true)) {
                        $pendencias[] = 'o pagamento é no local';
                    }
                    if ($pendencias) {
                        $texto .= ' Antes de ir: ' . implode('; ', $pendencias) . '.';
                    }

                    $this->notificar($al->locatario, $titulo, $texto, ['tipo' => 'lembrete', 'rota' => '/agendamentos/detalhes', 'id' => (string) $al->id, 'tipo_item' => 'aluguel']);
                    $al->forceFill(['lembrete_enviado_em' => now()])->saveQuietly();
                    $enviados++;
                }
            });

        return $enviados;
    }

    private function notificar(User $cliente, string $titulo, string $texto, array $dados): void
    {
        // A tela de detalhes lê "tipo" (servico/aluguel); o tipo da notificação vai separado.
        $dadosPush = ['tipo' => $dados['tipo_item'], 'id' => $dados['id'], 'rota' => $dados['rota'], 'categoria' => 'lembrete'];
        try {
            if ($cliente->expo_push_token) {
                $this->notificacoes->enviarPush($cliente, $titulo, $texto, $dadosPush);
            }
            if ($cliente->email) {
                $this->notificacoes->enviarEmailBrevo($cliente, $titulo, view('emails.lembrete', ['nome' => $cliente->name, 'titulo' => $titulo, 'texto' => $texto])->render());
            }
        } catch (\Throwable $e) {
            Log::info('Lembrete não enviado: ' . $e->getMessage());
        }
    }

    private function feitoComAntecedencia($criadoEm, Carbon $quando): bool
    {
        return !$criadoEm || Carbon::parse($criadoEm)->diffInMinutes($quando, false) >= self::MINUTOS_MINIMOS_APOS_RESERVA;
    }

    private function dataHora($data, $hora): ?Carbon
    {
        if (!$data) {
            return null;
        }
        try {
            $dia = Carbon::parse($data)->toDateString();

            return Carbon::parse($dia . ' ' . ($hora ? substr((string) $hora, 0, 8) : '00:00:00'));
        } catch (\Throwable) {
            return null;
        }
    }

    private function quandoLegivel(Carbon $quando): string
    {
        $dia = $quando->isToday() ? 'hoje' : ($quando->isTomorrow() ? 'amanhã' : $quando->format('d/m'));
        $hora = $quando->format('H:i') === '00:00' ? '' : ' às ' . $quando->format('H\hi');

        return $dia . $hora;
    }
}
