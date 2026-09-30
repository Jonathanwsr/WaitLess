<?php

namespace App\Console\Commands;

use App\Mail\RelatorioFinanceiroSemanalMail;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\RelatorioFinanceiroSemanal;
use App\Models\RoboExecucao;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EnviarRelatorioFinanceiroSemanal extends Command
{
    protected $signature = 'financeiro:relatorio-semanal {--manual : Marca esta execução como disparada manualmente}';

    protected $description = 'Envia por e-mail, toda semana, o resumo financeiro completo pra assinantes do plano Premium.';

    public function handle(): int
    {
        $execucao = RoboExecucao::iniciar('financeiro:relatorio-semanal', $this->option('manual') ? 'manual' : 'agendado');

        $semanaInicio = Carbon::now()->subWeek()->startOfWeek(Carbon::MONDAY);
        $semanaFim = Carbon::now()->subWeek()->endOfWeek(Carbon::SUNDAY);

        // Só quem é Premium DE VERDADE agora — plano_assinatura sozinho não
        // garante isso, porque não é rebaixado na hora do cancelamento (só no
        // fim do ciclo pago); asaas_subscription_status = CANCELLED é o sinal
        // imediato de que a pessoa já cancelou e não deve receber mais nada.
        $usuariosPremium = User::where('plano_assinatura', 'premium')
            ->where(function ($q) {
                $q->whereNull('asaas_subscription_status')
                    ->orWhere('asaas_subscription_status', '!=', 'CANCELLED');
            })
            ->get();

        $totalEnviados = 0;
        $totalFalhas = 0;

        foreach ($usuariosPremium as $usuario) {
            try {
                $relatorio = $this->montarRelatorio($usuario, $semanaInicio, $semanaFim);

                // Ninguém pra notificar (usuário sem nenhum estabelecimento
                // nem locação própria nessa semana) — não manda e-mail vazio.
                $totalTransacoes = $relatorio->total_agendamentos
                    + $relatorio->total_alugueis_estabelecimento
                    + $relatorio->total_locacoes_avulsas;

                if ($totalTransacoes === 0) {
                    continue;
                }

                $pdf = Pdf::loadView('pdfs.relatorio_semanal', [
                    'titulo' => 'Resumo Financeiro Semanal',
                    'usuario_nome' => explode(' ', $usuario->name)[0] ?? $usuario->name,
                    'data_inicio' => $semanaInicio->format('d/m/Y'),
                    'data_fim' => $semanaFim->format('d/m/Y'),
                    'relatorio' => $relatorio,
                ]);

                Mail::to($usuario->email)->send(
                    new RelatorioFinanceiroSemanalMail($relatorio, $pdf->output())
                );

                $relatorio->update(['enviado_em' => now()]);
                $totalEnviados++;
            } catch (\Throwable $e) {
                $totalFalhas++;
                Log::error("Falha ao enviar relatório financeiro semanal pro usuário #{$usuario->id}: " . $e->getMessage());
            }
        }

        $execucao->finalizar(
            $totalFalhas === 0,
            $totalEnviados,
            "Relatórios enviados: {$totalEnviados}. Falhas: {$totalFalhas}."
        );

        $this->info("Relatório financeiro semanal: {$totalEnviados} enviados, {$totalFalhas} falhas.");

        return self::SUCCESS;
    }

    private function montarRelatorio(User $usuario, Carbon $semanaInicio, Carbon $semanaFim): RelatorioFinanceiroSemanal
    {
        $estabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $usuario->id)
            ->pluck('estabelecimento_id')
            ->toArray();

        // AGENDAMENTOS (serviços concluídos/pagos na semana)
        $agendamentos = Agendamento::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->whereBetween('created_at', [$semanaInicio, $semanaFim])
            ->whereNotIn('status', ['cancelado'])
            ->get();
        $receitaAgendamentos = (float) $agendamentos->sum('valor_final');

        // LOCAÇÕES / ALUGUÉIS — tanto os itens de catálogo de um Estabelecimento
        // quanto as "Locações Avulsas" (dono direto, sem Estabelecimento) usam a
        // MESMA tabela `alugueis`, e `alugueis.estabelecimento_id` é sempre um
        // `users.id` direto (não existe FK real pra `estabelecimentos` nessa
        // coluna) — não há, hoje, uma marcação que separe uma origem da outra
        // no banco. Por isso todo o volume de aluguéis do usuário entra
        // consolidado aqui; as colunas específicas de "locação avulsa" ficam
        // reservadas pra quando existir essa distinção de verdade no schema.
        $alugueis = Aluguel::where('estabelecimento_id', $usuario->id)
            ->whereBetween('created_at', [$semanaInicio, $semanaFim])
            ->whereNotIn('status', ['cancelado'])
            ->get();

        $receitaAlugueis = (float) $alugueis->sum('valor_total');
        $taxaAlugueis = (float) $alugueis->sum('taxa_plataforma');

        $receitaBrutaTotal = $receitaAgendamentos + $receitaAlugueis;
        $taxaPlataformaTotal = $taxaAlugueis;
        $receitaLiquidaTotal = $receitaBrutaTotal - $taxaPlataformaTotal;

        return RelatorioFinanceiroSemanal::updateOrCreate(
            ['usuario_id' => $usuario->id, 'semana_inicio' => $semanaInicio->toDateString()],
            [
                'semana_fim' => $semanaFim->toDateString(),
                'total_agendamentos' => $agendamentos->count(),
                'receita_agendamentos' => $receitaAgendamentos,
                'total_alugueis_estabelecimento' => $alugueis->count(),
                'receita_alugueis_estabelecimento' => $receitaAlugueis,
                'total_locacoes_avulsas' => 0,
                'receita_locacoes_avulsas' => 0,
                'receita_bruta_total' => $receitaBrutaTotal,
                'taxa_plataforma_total' => $taxaPlataformaTotal,
                'receita_liquida_total' => $receitaLiquidaTotal,
            ]
        );
    }
}
