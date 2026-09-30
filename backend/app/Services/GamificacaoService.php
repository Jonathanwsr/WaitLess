<?php

namespace App\Services;

use App\Models\Estabelecimento;
use App\Models\Sugestao;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Programa de gamificação: check-in diário ("Estou usando"), sugestões
 * enviadas no app e bônus mensal automático por plano premium. Todo ponto
 * concedido por aqui passa por creditar(), que grava no ledger oficial
 * (historico_pontos) e soma o saldo do usuário — nunca via increment direto.
 */
class GamificacaoService
{
    // Tabela de Pontuação Padrão (mecânica legada, hoje sem chamador — mantida
    // por compatibilidade, mas o programa atual usa os métodos no fim da classe).
    const PONTOS_AGENDAMENTO_CONCLUIDO = 10;
    const PONTOS_PAGAMENTO_RAPIDO = 5;
    const PONTOS_AVALIACAO = 15;

    const MULTIPLICADOR_PREMIUM = 2; // Assinantes premium ganham o dobro de pontos.

    /** Verifica se o usuário tem uma assinatura premium ativa. */
    public function isUserPlus(User $user): bool
    {
        return $user->isPremium();
    }

    /**
     * Credita pontos ao usuário, dobrando automaticamente se ele for premium,
     * registrando a concessão no histórico oficial (historico_pontos).
     * Retorna a quantidade de pontos de fato concedida (já com o dobro, se houver).
     */
    public function creditar(User $user, int $pontosBase, string $descricao, ?int $estabelecimentoId = null, ?int $agendamentoId = null): int
    {
        if ($pontosBase <= 0) {
            return 0;
        }

        $premium = $user->isPremium();
        $pontos = $premium ? $pontosBase * self::MULTIPLICADOR_PREMIUM : $pontosBase;

        DB::transaction(function () use ($user, $pontos, $descricao, $estabelecimentoId, $agendamentoId, $premium) {
            DB::table('historico_pontos')->insert([
                'usuario_id' => $user->id,
                'estabelecimento_id' => $estabelecimentoId,
                'agendamento_id' => $agendamentoId,
                'tipo' => 'ganho',
                'descricao' => $descricao . ($premium ? ' (dobrado – Premium)' : ''),
                'quantidade' => $pontos,
                'created_at' => now(),
            ]);
            $user->increment('pontos_saldo', $pontos);
        });

        return $pontos;
    }

    /** Já fez o check-in diário hoje? */
    public function jaFezCheckinHoje(User $user): bool
    {
        return DB::table('checkins_gamificacao')
            ->where('usuario_id', $user->id)
            ->where('data', now()->toDateString())
            ->exists();
    }

    /**
     * Registra o clique em "Estou usando" (check-in diário). Só concede
     * pontos uma vez por dia por usuário — a constraint única na tabela
     * `checkins_gamificacao` é a última linha de defesa contra duplo clique.
     */
    public function registrarCheckin(User $user): array
    {
        if ($this->jaFezCheckinHoje($user)) {
            return ['ja_feito' => true, 'pontos' => 0];
        }

        $pontosBase = (int) config('gamificacao.checkin.pontos');
        $hoje = now()->toDateString();

        try {
            $pontosConcedidos = DB::transaction(function () use ($user, $pontosBase, $hoje) {
                // insert antes do creditar: se já existir (corrida entre requisições),
                // a constraint única derruba a transação e nada é concedido 2x.
                DB::table('checkins_gamificacao')->insert([
                    'usuario_id' => $user->id,
                    'data' => $hoje,
                    'pontos' => 0, // atualizado abaixo, depois de saber o valor (com dobro) já creditado
                    'created_at' => now(),
                ]);

                $pontos = $this->creditar($user, $pontosBase, 'Check-in diário: estou usando o app');

                DB::table('checkins_gamificacao')
                    ->where('usuario_id', $user->id)
                    ->where('data', $hoje)
                    ->update(['pontos' => $pontos]);

                return $pontos;
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Violação da constraint única (usuario_id, data): outro clique já processou hoje.
            return ['ja_feito' => true, 'pontos' => 0];
        }

        return ['ja_feito' => false, 'pontos' => $pontosConcedidos];
    }

    /**
     * Registra uma sugestão enviada no app. Só a primeira sugestão do dia
     * concede pontos (limite em config/gamificacao.php); as demais ficam
     * salvas e visíveis ao admin normalmente, só não pontuam.
     */
    public function registrarSugestao(User $user, string $texto, ?string $categoria = null): array
    {
        $limite = (int) config('gamificacao.sugestao.limite_pontuavel_por_dia');
        $jaEnviouHoje = Sugestao::where('usuario_id', $user->id)
            ->whereDate('created_at', now()->toDateString())
            ->count();

        $pontos = 0;

        $sugestao = DB::transaction(function () use ($user, $texto, $categoria, $jaEnviouHoje, $limite, &$pontos) {
            $sugestao = Sugestao::create([
                'usuario_id' => $user->id,
                'categoria' => $categoria,
                'texto' => $texto,
                'status' => 'pendente',
            ]);

            if ($jaEnviouHoje < $limite) {
                $pontosBase = (int) config('gamificacao.sugestao.pontos');
                $pontos = $this->creditar($user, $pontosBase, 'Sugestão enviada no app');
                $sugestao->update(['pontos_concedidos' => $pontos]);
            }

            return $sugestao;
        });

        return ['sugestao' => $sugestao, 'pontos' => $pontos];
    }

    /**
     * Roda mensalmente (comando `gamificacao:bonus-mensal`): credita o bônus
     * automático de pontos a cada usuário com assinatura premium ativa,
     * de acordo com o plano dele (config/gamificacao.php). Idempotente por
     * mês via a constraint única em `bonus_mensal_gamificacao`.
     */
    public function distribuirBonusMensal(): array
    {
        $anoMes = now()->format('Y-m');
        $catalogo = config('gamificacao.bonus_mensal_por_plano', []);

        $usuarios = User::where('plano_expira_em', '>', now())
            ->whereIn('plano_assinatura', array_keys($catalogo))
            ->get();

        $creditados = 0;
        $ignorados = 0;

        foreach ($usuarios as $user) {
            $pontos = $catalogo[$user->plano_assinatura] ?? 0;
            if ($pontos <= 0) {
                continue;
            }

            try {
                DB::transaction(function () use ($user, $anoMes, $pontos) {
                    DB::table('bonus_mensal_gamificacao')->insert([
                        'usuario_id' => $user->id,
                        'ano_mes' => $anoMes,
                        'plano' => $user->plano_assinatura,
                        'pontos' => $pontos,
                        'created_at' => now(),
                    ]);

                    DB::table('historico_pontos')->insert([
                        'usuario_id' => $user->id,
                        'estabelecimento_id' => null,
                        'agendamento_id' => null,
                        'tipo' => 'ganho',
                        'descricao' => "Bônus mensal do plano {$user->plano_assinatura}",
                        'quantidade' => $pontos,
                        'created_at' => now(),
                    ]);
                    $user->increment('pontos_saldo', $pontos);
                });
                $creditados++;
            } catch (\Illuminate\Database\QueryException $e) {
                // Já creditado nesse mês (unique ano_mes+usuario_id) — segue para o próximo.
                $ignorados++;
            }
        }

        Log::info("Gamificação: bônus mensal {$anoMes} — {$creditados} usuário(s) creditados, {$ignorados} já haviam recebido.");

        return ['ano_mes' => $anoMes, 'creditados' => $creditados, 'ja_creditados' => $ignorados];
    }

    /**
     * Resgata pontos por um desconto num estabelecimento (mecânica legada,
     * hoje sem chamador — mantida por compatibilidade).
     */
    public function usarPontos(User $user, Estabelecimento $estabelecimento, int $pontosCustos)
    {
        if ($user->pontos_saldo < $pontosCustos) {
            throw new \Exception("Pontos insuficientes.");
        }

        $podeUsar = true;

        if (!$this->isUserPlus($user)) {
            if (!$estabelecimento->aceita_pontos_gratuitos) {
                throw new \Exception("Apenas usuários premium podem usar pontos neste estabelecimento.");
            }
        }

        if ($podeUsar) {
            $user->decrement('pontos_saldo', $pontosCustos);
            return true;
        }

        return false;
    }
}
