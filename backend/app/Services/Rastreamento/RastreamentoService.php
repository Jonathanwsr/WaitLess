<?php

namespace App\Services\Rastreamento;

use App\Events\LocationUpdated;
use App\Models\Agendamento;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * "Clientes a caminho" (web e mobile): quem tem agendamento hoje nos locais do usuário e a última
 * posição que o cliente transmitiu. A posição fica salva no agendamento, então o mapa funciona
 * por consulta periódica mesmo sem WebSocket; quando o Reverb está no ar, o movimento chega na hora.
 */
class RastreamentoService
{
    public const FUSO = 'America/Sao_Paulo';
    public const STATUS_ATIVOS = ['pendente', 'confirmado', 'aguardando_pagamento'];

    /** Recurso Premium: o admin sempre vê; gerente/atendente vê se o dono do local for Premium. */
    public function podeVer(User $user): bool
    {
        if ($user->papel === 'admin' || $user->isPremium()) {
            return true;
        }

        $locais = $user->estabelecimentos()->pluck('estabelecimentos.id');
        if ($locais->isEmpty()) {
            return false;
        }

        $donos = DB::table('estabelecimento_usuario')
            ->whereIn('estabelecimento_id', $locais)
            ->whereIn('tipo', ['socio', 'proprietario'])
            ->pluck('usuario_id');

        return User::whereIn('id', $donos)->get()->contains(fn (User $dono) => $dono->isPremium());
    }

    /** Agendamentos de hoje (horário de Brasília) nos locais do usuário, no formato do mapa. */
    public function ativosDeHoje(User $user): Collection
    {
        $locais = $user->papel === 'admin' && $user->estabelecimentos()->doesntExist()
            ? null
            : $user->estabelecimentos()->pluck('estabelecimentos.id');

        return Agendamento::with(['usuario:id,name,foto_perfil,telefone', 'estabelecimento:id,nome,latitude,longitude', 'servico:id,nome'])
            ->when($locais !== null, fn ($q) => $q->whereIn('estabelecimento_id', $locais))
            ->whereDate('data_agendamento', now(self::FUSO)->toDateString())
            ->whereIn('status', self::STATUS_ATIVOS)
            ->orderBy('hora_agendamento')
            ->limit(200)
            ->get()
            ->map(fn (Agendamento $a) => $this->formatar($a))
            ->values();
    }

    public function formatar(Agendamento $a): array
    {
        $hora = substr((string) $a->hora_agendamento, 0, 5);

        return [
            'id' => $a->id,
            'status' => $a->status,
            'hora_agendamento' => $a->hora_agendamento,
            'horario' => $hora,
            'titulo' => $a->servico?->nome ?? 'Agendamento',
            'servico' => $a->servico?->nome,
            'usuario' => [
                'name' => $a->usuario?->name ?? 'Cliente',
                'foto_perfil' => $a->usuario?->foto_perfil,
                'telefone' => $a->usuario?->telefone,
            ],
            'estabelecimento' => [
                'id' => $a->estabelecimento?->id,
                'nome' => $a->estabelecimento?->nome,
                'latitude' => $a->estabelecimento?->latitude !== null ? (float) $a->estabelecimento->latitude : null,
                'longitude' => $a->estabelecimento?->longitude !== null ? (float) $a->estabelecimento->longitude : null,
            ],
            'ultima_localizacao' => $a->ultima_localizacao_em ? [
                'latitude' => (float) $a->ultima_latitude,
                'longitude' => (float) $a->ultima_longitude,
                'heading' => $a->ultimo_heading !== null ? (float) $a->ultimo_heading : null,
                'velocidade' => $a->ultima_velocidade !== null ? (float) $a->ultima_velocidade : null,
                'atualizado_em' => $a->ultima_localizacao_em->toIso8601String(),
            ] : null,
        ];
    }

    /** Salva a posição do cliente e avisa em tempo real (se o WebSocket estiver fora, a posição já ficou salva). */
    public function registrar(Agendamento $a, float $lat, float $lng, ?float $heading = null, ?float $velocidade = null): void
    {
        $a->forceFill([
            'ultima_latitude' => $lat,
            'ultima_longitude' => $lng,
            'ultimo_heading' => $heading,
            'ultima_velocidade' => $velocidade,
            'ultima_localizacao_em' => now(),
        ])->save();

        try {
            broadcast(new LocationUpdated($a->id, $lat, $lng, $heading, $velocidade));
        } catch (\Throwable $e) {
            Log::warning('Rastreamento: posição salva, mas o WebSocket não respondeu: ' . $e->getMessage());
        }
    }
}
