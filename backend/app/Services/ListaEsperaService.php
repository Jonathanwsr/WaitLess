<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Servico;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Lista de espera de vagas. Quando alguém cancela, os primeiros da fila (por ordem de entrada)
 * recebem um aviso; quem entrar primeiro no app garante a vaga — o aviso não reserva nada.
 */
class ListaEsperaService
{
    /** Quantas pessoas são avisadas por vaga aberta (mais de uma, porque nem todos respondem a tempo). */
    private const AVISADOS_POR_VAGA = 3;

    public function entrar(User $user, Servico $servico, string $data, ?string $hora): array
    {
        $dia = Carbon::parse($data)->startOfDay();
        if ($dia->lt(now()->startOfDay())) {
            throw new \InvalidArgumentException('Escolha uma data de hoje em diante.');
        }
        if ($hora !== null && Carbon::parse("{$dia->toDateString()} {$hora}")->isPast()) {
            throw new \InvalidArgumentException('Esse horário já passou.');
        }

        // Já reservou esse serviço nessa data? Então não precisa de fila.
        $jaTem = Agendamento::where('usuario_id', $user->id)->where('servico_id', $servico->id)
            ->whereDate('data_agendamento', $dia->toDateString())
            ->whereNotIn('status', ['cancelado', 'recusado'])->exists();
        if ($jaTem) {
            throw new \InvalidArgumentException('Você já tem uma reserva deste serviço nesta data.');
        }

        $linha = DB::table('lista_espera')->where([
            'usuario_id' => $user->id, 'servico_id' => $servico->id, 'data' => $dia->toDateString(), 'hora' => $hora,
        ])->first();

        if ($linha) {
            DB::table('lista_espera')->where('id', $linha->id)->update(['status' => 'aguardando', 'avisado_em' => null, 'updated_at' => now()]);
            $id = $linha->id;
        } else {
            $id = DB::table('lista_espera')->insertGetId([
                'usuario_id' => $user->id,
                'servico_id' => $servico->id,
                'estabelecimento_id' => $servico->estabelecimento_id,
                'data' => $dia->toDateString(),
                'hora' => $hora,
                'status' => 'aguardando',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return ['id' => $id];
    }

    public function sair(User $user, int $id): bool
    {
        return DB::table('lista_espera')->where('id', $id)->where('usuario_id', $user->id)->update(['status' => 'cancelado', 'updated_at' => now()]) > 0;
    }

    public function minhas(User $user): array
    {
        return DB::table('lista_espera')
            ->join('servicos', 'lista_espera.servico_id', '=', 'servicos.id')
            ->join('estabelecimentos', 'lista_espera.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('lista_espera.usuario_id', $user->id)
            ->whereIn('lista_espera.status', ['aguardando', 'avisado'])
            ->where('lista_espera.data', '>=', now()->toDateString())
            ->orderBy('lista_espera.data')
            ->get(['lista_espera.id', 'lista_espera.data', 'lista_espera.hora', 'lista_espera.status', 'servicos.nome as servico', 'estabelecimentos.nome as local', 'lista_espera.servico_id'])
            ->all();
    }

    /** Uma reserva foi cancelada: avisa quem estava esperando por aquele dia/horário. */
    public function avisarVaga(Agendamento $cancelado): void
    {
        try {
            $data = Carbon::parse($cancelado->data_agendamento)->toDateString();
            $hora = $cancelado->hora_agendamento ? substr((string) $cancelado->hora_agendamento, 0, 5) : null;

            $fila = DB::table('lista_espera')
                ->where('servico_id', $cancelado->servico_id)
                ->where('data', $data)
                ->where('status', 'aguardando')
                ->where('usuario_id', '!=', $cancelado->usuario_id)
                ->where(fn ($q) => $q->whereNull('hora')->orWhere('hora', $hora))
                ->orderBy('created_at')
                ->limit(self::AVISADOS_POR_VAGA)
                ->get();

            if ($fila->isEmpty()) {
                return;
            }

            $servico = Servico::with('estabelecimento:id,nome')->find($cancelado->servico_id);
            $quando = Carbon::parse($data)->locale('pt_BR')->translatedFormat('d/m') . ($hora ? " às {$hora}" : '');
            $mensagem = 'Abriu uma vaga em ' . ($servico?->nome ?? 'um serviço') . ($servico?->estabelecimento ? ' (' . $servico->estabelecimento->nome . ')' : '') . " para {$quando}. Reserve agora antes que acabe!";

            foreach ($fila as $linha) {
                $usuario = User::find($linha->usuario_id);
                if ($usuario && !$usuario->notification_disabled) {
                    app(NotificacaoService::class)->enviarPush($usuario, 'Abriu uma vaga! 🎉', $mensagem, [
                        'rota' => 'ExplorarDetalhes', 'servico_id' => $cancelado->servico_id, 'data' => $data,
                    ]);
                }
                DB::table('lista_espera')->where('id', $linha->id)->update(['status' => 'avisado', 'avisado_em' => now(), 'updated_at' => now()]);
            }
        } catch (\Throwable $e) {
            // O aviso nunca pode atrapalhar o cancelamento.
            Log::error('Lista de espera: falha ao avisar vaga. ' . $e->getMessage(), ['agendamento' => $cancelado->id]);
        }
    }
}
