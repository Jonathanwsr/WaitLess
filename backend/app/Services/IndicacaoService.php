<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Indicacao;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * "Convide um amigo": código de cada usuário, vínculo no cadastro e recompensa em pontos quando
 * o amigo conclui a primeira reserva. A recompensa só sai depois do atendimento realizado (não no
 * cadastro nem no pagamento), o que dificulta contas falsas.
 */
class IndicacaoService
{
    /** Código do usuário (criado na primeira vez que é pedido). */
    public function codigoDe(User $user): string
    {
        if ($user->codigo_indicacao) {
            return $user->codigo_indicacao;
        }

        $prefixo = substr(preg_replace('/[^A-Z]/', '', strtoupper(Str::ascii((string) $user->name))), 0, 3) ?: 'LKV';

        do {
            // Sem letras/números que se confundem (0/O, 1/I).
            $codigo = $prefixo . substr(str_shuffle('23456789ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 4);
        } while (User::where('codigo_indicacao', $codigo)->exists());

        $user->forceFill(['codigo_indicacao' => $codigo])->save();

        return $codigo;
    }

    /**
     * Liga o novo usuário a quem o convidou. Nunca falha o cadastro: código inválido é ignorado.
     *
     * @return string|null mensagem para mostrar ao usuário quando o código não pôde ser usado
     */
    public function registrar(User $novo, ?string $codigo): ?string
    {
        $codigo = strtoupper(trim((string) $codigo));
        if ($codigo === '') {
            return null;
        }

        $indicador = User::where('codigo_indicacao', $codigo)->first();
        if (!$indicador) {
            return 'Código de indicação não encontrado.';
        }
        if ($indicador->id === $novo->id) {
            return 'Você não pode usar o seu próprio código.';
        }
        if ($novo->indicado_por_id || Indicacao::where('indicado_id', $novo->id)->exists()) {
            return 'Você já usou um código de indicação.';
        }
        if (Agendamento::where('usuario_id', $novo->id)->where('status', 'finalizado')->exists()) {
            return 'O código de indicação só vale para quem ainda não concluiu uma reserva.';
        }

        DB::transaction(function () use ($novo, $indicador) {
            $novo->forceFill(['indicado_por_id' => $indicador->id])->save();
            Indicacao::create(['indicador_id' => $indicador->id, 'indicado_id' => $novo->id, 'status' => 'pendente']);
        });

        return null;
    }

    /** Chamado quando um atendimento é finalizado: se for a 1ª reserva de alguém indicado, paga os dois. */
    public function aoFinalizar(Agendamento $agendamento): void
    {
        try {
            DB::transaction(function () use ($agendamento) {
                $indicacao = Indicacao::where('indicado_id', $agendamento->usuario_id)
                    ->where('status', 'pendente')
                    ->lockForUpdate()
                    ->first();
                if (!$indicacao) {
                    return;
                }

                // Só a PRIMEIRA reserva concluída conta.
                $finalizadas = Agendamento::where('usuario_id', $agendamento->usuario_id)->where('status', 'finalizado')->count();
                if ($finalizadas !== 1) {
                    return;
                }

                $indicador = User::find($indicacao->indicador_id);
                $indicado = User::find($indicacao->indicado_id);
                if (!$indicador || !$indicado) {
                    return;
                }

                // Mesma pessoa com duas contas (mesmo CPF/CNPJ) não gera prêmio.
                if ($indicador->cpf_cnpj && $indicador->cpf_cnpj === $indicado->cpf_cnpj) {
                    return;
                }

                $limite = (int) config('indicacao.limite_por_indicador');
                if (Indicacao::where('indicador_id', $indicador->id)->where('status', 'recompensada')->count() >= $limite) {
                    return;
                }

                $pontosIndicadorBase = (int) config('indicacao.pontos_indicador');
                $pontosIndicadoBase = (int) config('indicacao.pontos_indicado');

                // Pontos de indicação são dobrados para quem já é premium (mesma
                // regra do resto do programa de gamificação), avaliado por pessoa.
                $pontosIndicadorPago = $indicador->isPremium() ? $pontosIndicadorBase * 2 : $pontosIndicadorBase;
                $pontosIndicadoPago = $indicado->isPremium() ? $pontosIndicadoBase * 2 : $pontosIndicadoBase;

                $this->creditar($indicador, $pontosIndicadorPago, "Indicação: {$indicado->name} concluiu a primeira reserva" . ($indicador->isPremium() ? ' (dobrado – Premium)' : ''), $agendamento->id);
                $this->creditar($indicado, $pontosIndicadoPago, 'Bônus de boas-vindas: sua primeira reserva concluída' . ($indicado->isPremium() ? ' (dobrado – Premium)' : ''), $agendamento->id);

                $indicacao->update([
                    'status' => 'recompensada',
                    'pontos_indicador' => $pontosIndicadorPago,
                    'pontos_indicado' => $pontosIndicadoPago,
                    'agendamento_id' => $agendamento->id,
                    'recompensada_em' => now(),
                ]);
            });
        } catch (\Throwable $e) {
            // A recompensa nunca pode atrapalhar a finalização do atendimento.
            Log::error('Indicação: falha ao recompensar. ' . $e->getMessage(), ['agendamento' => $agendamento->id]);
        }
    }

    private function creditar(User $user, int $pontos, string $descricao, int $agendamentoId): void
    {
        if ($pontos <= 0) {
            return;
        }

        DB::table('historico_pontos')->insert([
            'usuario_id' => $user->id,
            'estabelecimento_id' => null,
            'agendamento_id' => $agendamentoId,
            'tipo' => 'ganho',
            'descricao' => $descricao,
            'quantidade' => $pontos,
            'created_at' => now(),
        ]);
        $user->increment('pontos_saldo', $pontos);
    }

    /** Dados da tela "Convide amigos". */
    public function resumo(User $user): array
    {
        $indicacoes = Indicacao::with('indicado:id,name')->where('indicador_id', $user->id)->latest()->limit(30)->get();

        // Se quem está vendo já é premium, mostramos o valor que ele de fato vai
        // receber (dobrado) — o valor do amigo convidado fica na base, já que o
        // status premium dele só é conhecido depois que a conta existir.
        $pontosIndicadorBase = (int) config('indicacao.pontos_indicador');

        return [
            'codigo' => $this->codigoDe($user),
            'pontos_por_indicacao' => $user->isPremium() ? $pontosIndicadorBase * 2 : $pontosIndicadorBase,
            'pontos_para_o_amigo' => (int) config('indicacao.pontos_indicado'),
            'reais_por_indicacao' => PontosService::pontosParaValor((int) config('indicacao.pontos_indicador')),
            'convidados' => $indicacoes->count(),
            'recompensadas' => $indicacoes->where('status', 'recompensada')->count(),
            'pontos_ganhos' => (int) $indicacoes->sum('pontos_indicador'),
            'ja_indicado' => (bool) $user->indicado_por_id,
            'lista' => $indicacoes->map(fn ($i) => [
                'nome' => $i->indicado?->name,
                'status' => $i->status,
                'pontos' => (int) $i->pontos_indicador,
            ])->values(),
        ];
    }
}
