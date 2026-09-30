<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\RespostaTriagem;
use App\Models\Triagem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Triagem = ficha que o cliente preenche ao reservar e que o responsável analisa.
 *  - RESERVA (aluguel): o proprietário aprova ou recusa antes de a reserva valer.
 *  - SERVIÇO: ficha de atendimento (alergias, observações...) que a equipe consulta ao atender.
 * Os dados ficam em triagens (a ficha) + respostas_triagem (pergunta/resposta).
 */
class TriagemService
{
    public const PERGUNTAS = [
        'reserva' => [
            ['id' => 'motivo', 'pergunta' => 'Motivo da reserva', 'tipo' => 'opcoes', 'opcoes' => ['Lazer', 'Trabalho', 'Evento', 'Outro'], 'obrigatoria' => true],
            ['id' => 'animais', 'pergunta' => 'Vai levar animais de estimação?', 'tipo' => 'sim_nao', 'opcoes' => ['Sim', 'Não'], 'obrigatoria' => true],
            ['id' => 'chegada', 'pergunta' => 'Horário previsto de chegada ou retirada', 'tipo' => 'texto', 'opcoes' => [], 'obrigatoria' => false],
            ['id' => 'observacoes', 'pergunta' => 'Algo que o proprietário deva saber?', 'tipo' => 'texto', 'opcoes' => [], 'obrigatoria' => false],
        ],
        'servico' => [
            ['id' => 'saude', 'pergunta' => 'Alergias, condições de saúde ou medicamentos em uso', 'tipo' => 'texto', 'opcoes' => [], 'obrigatoria' => false],
            ['id' => 'primeira_vez', 'pergunta' => 'É a sua primeira vez neste serviço?', 'tipo' => 'sim_nao', 'opcoes' => ['Sim', 'Não'], 'obrigatoria' => false],
            ['id' => 'observacoes', 'pergunta' => 'Observações para quem vai te atender', 'tipo' => 'texto', 'opcoes' => [], 'obrigatoria' => false],
        ],
    ];

    public function perguntas(string $tipo): array
    {
        return self::PERGUNTAS[$tipo] ?? [];
    }

    /**
     * Confere as respostas do app contra as perguntas oficiais (id => resposta).
     * Devolve [pergunta => resposta] só com o que foi respondido.
     *
     * @throws ValidationException
     */
    public function validar(string $tipo, ?array $respostas): array
    {
        $respostas = $respostas ?? [];
        $limpas = [];
        $erros = [];

        foreach ($this->perguntas($tipo) as $p) {
            $valor = trim((string) ($respostas[$p['id']] ?? ''));

            if ($valor === '') {
                if ($p['obrigatoria']) {
                    $erros["triagem.{$p['id']}"] = ["Responda: {$p['pergunta']}"];
                }
                continue;
            }

            if ($p['tipo'] !== 'texto' && !in_array($valor, $p['opcoes'], true)) {
                $erros["triagem.{$p['id']}"] = ["Resposta inválida para: {$p['pergunta']}"];
                continue;
            }

            $limpas[$p['pergunta']] = mb_substr(strip_tags($valor), 0, 1000);
        }

        if ($erros) {
            throw ValidationException::withMessages($erros);
        }

        return $limpas;
    }

    /** Ficha de uma reserva de aluguel. `$donoId` = users.id de quem analisa (dono do item). */
    public function abrirParaAluguel(int $usuarioId, int $aluguelId, int $donoId, ?int $estabelecimentoId, array $respostas, int $pessoas): Triagem
    {
        return DB::transaction(function () use ($usuarioId, $aluguelId, $donoId, $estabelecimentoId, $respostas, $pessoas) {
            $t = Triagem::create([
                'tipo' => 'reserva', 'usuario_id' => $usuarioId, 'aluguel_id' => $aluguelId,
                'dono_id' => $donoId, 'estabelecimento_id' => $estabelecimentoId, 'status' => 'pendente',
            ]);

            $this->gravarRespostas($t, ['Quantidade de pessoas' => (string) $pessoas] + $respostas);

            return $t;
        });
    }

    /** Ficha de atendimento de um agendamento — só é criada se o cliente respondeu algo. */
    public function abrirParaAgendamento(int $usuarioId, Agendamento $agendamento, ?int $donoId, array $respostas, int $pessoas): ?Triagem
    {
        if (!$respostas && $pessoas <= 1) {
            return null;
        }

        return DB::transaction(function () use ($usuarioId, $agendamento, $donoId, $respostas, $pessoas) {
            $t = Triagem::create([
                'tipo' => 'servico', 'usuario_id' => $usuarioId, 'agendamento_id' => $agendamento->id,
                'estabelecimento_id' => $agendamento->estabelecimento_id, 'dono_id' => $donoId, 'status' => 'pendente',
                'observacoes' => $respostas['Observações para quem vai te atender'] ?? null,
            ]);

            $this->gravarRespostas($t, ($pessoas > 1 ? ['Quantidade de pessoas' => (string) $pessoas] : []) + $respostas);

            return $t;
        });
    }

    private function gravarRespostas(Triagem $t, array $paresPerguntaResposta): void
    {
        foreach ($paresPerguntaResposta as $pergunta => $resposta) {
            RespostaTriagem::create(['triagem_id' => $t->id, 'pergunta' => $pergunta, 'resposta' => $resposta]);
        }
    }

    // ------------------------------------------------------------- permissões

    /** Quem pode analisar: o dono, a equipe do estabelecimento ou o admin. */
    public function podeAnalisar(User $user, Triagem $t): bool
    {
        if ($user->papel === 'admin' || (int) $t->dono_id === $user->id) {
            return true;
        }

        return $t->estabelecimento_id && DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)->where('estabelecimento_id', $t->estabelecimento_id)->exists();
    }

    public function podeVer(User $user, Triagem $t): bool
    {
        return (int) $t->usuario_id === $user->id || $this->podeAnalisar($user, $t);
    }

    /** Fichas que o usuário analisa (dono ou equipe). */
    public function queryParaAnalisar(User $user)
    {
        $estabIds = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->pluck('estabelecimento_id');

        return Triagem::query()->where(function ($q) use ($user, $estabIds) {
            $q->where('dono_id', $user->id)->orWhereIn('estabelecimento_id', $estabIds);
        });
    }

    // ------------------------------------------------------------- decisão

    /**
     * @throws ValidationException
     */
    public function decidir(Triagem $t, User $por, string $status, ?string $motivo): Triagem
    {
        if ($t->status !== 'pendente') {
            throw ValidationException::withMessages(['status' => ['Essa ficha já foi analisada.']]);
        }

        return DB::transaction(function () use ($t, $por, $status, $motivo) {
            if ($t->tipo === 'reserva' && $t->aluguel_id) {
                $aluguel = Aluguel::lockForUpdate()->find($t->aluguel_id);

                if ($status === 'recusado' && $aluguel) {
                    if ($aluguel->pagamento_confirmado) {
                        throw ValidationException::withMessages(['status' => ['Essa reserva já foi paga. Para recusar, o cliente precisa pedir estorno.']]);
                    }
                    $aluguel->update(['status' => 'cancelado', 'motivo_cancelamento' => $motivo ?: 'Recusada na triagem pelo proprietário.']);
                }

                if ($status === 'aprovado' && $aluguel && $aluguel->status === 'pendente') {
                    $aluguel->update(['status' => 'confirmado']);
                }
            }

            $t->update([
                'status' => $status, 'decidida_por_id' => $por->id, 'decidida_em' => now(), 'motivo_decisao' => $motivo,
            ]);

            return $t->fresh();
        });
    }

    /** Formato usado pelo app e pelo site. */
    public function paraTela(Triagem $t, bool $comCliente = true): array
    {
        $t->loadMissing('respostas', 'usuario:id,name,foto_perfil', 'aluguel.item:id,nome', 'agendamento.servico:id,nome');

        return [
            'id' => $t->id,
            'tipo' => $t->tipo,
            'status' => $t->status,
            'titulo' => $t->tipo === 'reserva'
                ? ($t->aluguel?->item?->nome ?? 'Reserva')
                : ($t->agendamento?->servico?->nome ?? 'Atendimento'),
            'aluguel_id' => $t->aluguel_id,
            'agendamento_id' => $t->agendamento_id,
            'cliente' => $comCliente ? ['id' => $t->usuario?->id, 'nome' => $t->usuario?->name, 'foto' => $t->usuario?->foto_perfil] : null,
            'periodo' => $t->aluguel ? trim(substr((string) $t->aluguel->data_inicio, 0, 10) . ' → ' . substr((string) $t->aluguel->data_fim, 0, 10)) : null,
            'quando' => $t->agendamento ? trim($t->agendamento->data_agendamento . ' ' . $t->agendamento->hora_agendamento) : null,
            'respostas' => $t->respostas->map(fn ($r) => ['pergunta' => $r->pergunta, 'resposta' => $r->resposta])->values(),
            'observacoes' => $t->observacoes,
            'motivo_decisao' => $t->motivo_decisao,
            'decidida_em' => optional($t->decidida_em)->toIso8601String(),
            'criada_em' => optional($t->created_at)->toIso8601String(),
        ];
    }
}
