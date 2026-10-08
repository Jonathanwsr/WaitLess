import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
    SparklesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, UserGroupIcon,
    XCircleIcon, TrophyIcon, FireIcon, ClockIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';

const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function TooltipFaturamento({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-900 text-white text-xs font-semibold rounded-lg px-3 py-2 shadow-lg">
            <p className="text-gray-300 mb-0.5">{label}</p>
            <p>{formatarMoeda(payload[0].value)}</p>
        </div>
    );
}

export default function RelatorioAvancado({ bloqueado, semDados, faturamento_por_mes = [], resumo = {}, ranking_funcionarios = [], servicos_mais_vendidos = [], horarios_pico = [] }) {
    if (bloqueado) {
        return (
            <AuthenticatedLayout header={<h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Relatório Avançado</h2>}>
                <Head title="Relatório Avançado - WaitLess" />
                <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen -m-4 sm:-m-8 p-4 sm:p-8 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 max-w-md text-center shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-5">
                            <LockClosedIcon className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Exclusivo para planos Premium</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Assine um plano Premium de sócio para liberar o relatório avançado: faturamento histórico, produtividade da equipe, retenção de clientes e muito mais.
                        </p>
                        <Link href="/assinatura" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm">
                            Ver planos Premium
                        </Link>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    const maiorRanking = Math.max(1, ...ranking_funcionarios.map((f) => f.faturamento));
    const maiorServico = Math.max(1, ...servicos_mais_vendidos.map((s) => s.quantidade));

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-indigo-500" />
                        Relatório Avançado
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Visão completa do seu negócio — exclusivo Premium.</p>
                </div>
            }
        >
            <Head title="Relatório Avançado - WaitLess" />

            <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen -m-4 sm:-m-8 p-4 sm:p-8 space-y-8 animate-fadeIn">
                {semDados ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 text-center py-16 px-4 shadow-sm">
                        <p className="text-gray-500 dark:text-gray-400">Cadastre um estabelecimento para começar a ver seu relatório.</p>
                    </div>
                ) : (
                    <>
                        {/* RESUMO */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Faturamento (mês atual)</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatarMoeda(resumo.faturamento_mes_atual)}</p>
                                {resumo.crescimento_percentual !== null && (
                                    <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${resumo.crescimento_percentual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {resumo.crescimento_percentual >= 0 ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                                        {resumo.crescimento_percentual}% vs. mês anterior
                                    </p>
                                )}
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Ticket médio</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatarMoeda(resumo.ticket_medio)}</p>
                                <p className="text-xs text-gray-400 mt-2">{resumo.atendimentos_mes || 0} atendimentos no mês</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><XCircleIcon className="w-3.5 h-3.5" /> Taxa de cancelamento</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumo.taxa_cancelamento || 0}%</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><UserGroupIcon className="w-3.5 h-3.5" /> Clientes no mês</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(resumo.clientes_novos || 0) + (resumo.clientes_recorrentes || 0)}</p>
                                <p className="text-xs text-gray-400 mt-2">{resumo.clientes_novos || 0} novos · {resumo.clientes_recorrentes || 0} recorrentes</p>
                            </div>
                        </div>

                        {/* FATURAMENTO — GRÁFICO */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Faturamento nos últimos 6 meses</h3>
                            <div style={{ width: '100%', height: 260 }}>
                                <ResponsiveContainer>
                                    <BarChart data={faturamento_por_mes} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="#F0F0F2" />
                                        <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} width={48} />
                                        <Tooltip cursor={{ fill: '#F5F5F7' }} content={<TooltipFaturamento />} />
                                        <Bar dataKey="valor" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={48} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* RANKING DE FUNCIONÁRIOS */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <TrophyIcon className="w-4 h-4 text-amber-500" /> Produtividade da equipe (mês)
                                </h3>
                                {ranking_funcionarios.length === 0 ? (
                                    <p className="text-sm text-gray-400">Nenhum atendimento finalizado neste mês ainda.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {ranking_funcionarios.map((f, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{f.nome}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 shrink-0 ml-2">{f.atendimentos}x · {formatarMoeda(f.faturamento)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(4, (f.faturamento / maiorRanking) * 100)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SERVIÇOS MAIS VENDIDOS */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <FireIcon className="w-4 h-4 text-amber-500" /> Serviços mais vendidos (mês)
                                </h3>
                                {servicos_mais_vendidos.length === 0 ? (
                                    <p className="text-sm text-gray-400">Nenhum serviço finalizado neste mês ainda.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {servicos_mais_vendidos.map((s, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{s.nome}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 shrink-0 ml-2">{s.quantidade}x · {formatarMoeda(s.faturamento)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (s.quantidade / maiorServico) * 100)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* HORÁRIOS DE PICO */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <ClockIcon className="w-4 h-4 text-indigo-500" /> Horários de pico (mês)
                            </h3>
                            {horarios_pico.length === 0 ? (
                                <p className="text-sm text-gray-400">Sem movimento registrado neste mês ainda.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {horarios_pico.map((h, i) => (
                                        <span key={i} className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold px-3 py-1.5 rounded-lg">
                                            {h.hora}
                                            <span className="text-xs font-bold bg-indigo-600 text-white rounded-full px-1.5 py-0.5">{h.quantidade}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
