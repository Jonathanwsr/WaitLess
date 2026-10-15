import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
    UserGroupIcon, CurrencyDollarIcon, CalendarDaysIcon, StarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    TrophyIcon, FireIcon, LockClosedIcon, XCircleIcon,
} from '@heroicons/react/24/outline';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const brlCurto = (v) => (v >= 1000 ? `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k` : `R$${Math.round(v)}`);
const CORES_BARRAS = ['#8B5CF6', '#F97316', '#10B981', '#3B82F6', '#F59E0B', '#EC4899'];

function Dica({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-lg">
            <p className="text-gray-300">{label}</p>
            <p>{brl(payload[0].value)}</p>
        </div>
    );
}

function Indicador({ icone: Icone, cor, rotulo, valor, sub, destaque }) {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cor}`}><Icone className="h-5 w-5" /></span>
                <p className="text-sm text-gray-500">{rotulo}</p>
                {destaque && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{destaque}</span>}
            </div>
            <p className="mt-3 text-2xl font-black text-gray-900">{valor}</p>
            {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
        </div>
    );
}

function Cartao({ titulo, icone: Icone, children, className = '' }) {
    return (
        <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">{Icone && <Icone className="h-4 w-4 text-gray-400" />}{titulo}</h3>
            {children}
        </section>
    );
}

export default function RelatorioAvancado({
    bloqueado, semDados, faturamento_por_mes = [], resumo = {}, ranking_funcionarios = [], servicos_mais_vendidos = [],
    receita_por_estabelecimento = [], receita_por_hora = [], receita_por_dia_semana = [], desempenho_estabelecimentos = [],
}) {
    if (bloqueado) {
        return (
            <AuthenticatedLayout>
                <Head title="Relatórios" />
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="max-w-md rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
                        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-[#FF5A00]"><LockClosedIcon className="h-8 w-8" /></span>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Exclusivo para planos Premium</h3>
                        <p className="mb-6 text-sm text-gray-500">Assine o Premium de sócio para ver faturamento histórico, receita por local, horário e dia, produtividade da equipe e retenção de clientes.</p>
                        <Link href={route('assinatura.status')} className="inline-flex items-center gap-2 rounded-xl bg-[#FF5A00] px-5 py-2.5 font-semibold text-white hover:bg-orange-600">Ver planos Premium</Link>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    const clientes = (resumo.clientes_novos || 0) + (resumo.clientes_recorrentes || 0);
    const crescimento = resumo.crescimento_percentual;
    const maiorLocal = Math.max(1, ...receita_por_estabelecimento.map((l) => l.valor));
    const maiorRanking = Math.max(1, ...ranking_funcionarios.map((f) => f.faturamento));
    const maiorServico = Math.max(1, ...servicos_mais_vendidos.map((s) => s.quantidade));
    const eixo = { tickLine: false, axisLine: false, tick: { fill: '#9CA3AF', fontSize: 11 } };

    return (
        <AuthenticatedLayout>
            <Head title="Relatórios" />

            <div className="mx-auto max-w-[1400px] space-y-5">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-[28px]">Relatórios</h1>
                    <p className="text-sm text-gray-500">Desempenho do seu negócio neste mês, com comparação ao mês anterior.</p>
                </div>

                {semDados ? (
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-16 text-center shadow-sm">
                        <p className="text-gray-500">Cadastre um estabelecimento para começar a ver seus relatórios.</p>
                    </div>
                ) : (
                    <>
                        {/* INDICADORES */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Indicador icone={UserGroupIcon} cor="bg-violet-50 text-violet-600" rotulo="Clientes" valor={clientes.toLocaleString('pt-BR')}
                                sub={`${resumo.clientes_novos || 0} novos · ${resumo.clientes_recorrentes || 0} voltaram`} />
                            <Indicador icone={CurrencyDollarIcon} cor="bg-emerald-50 text-emerald-600" rotulo="Receita" valor={brl(resumo.faturamento_mes_atual)}
                                sub={crescimento === null || crescimento === undefined ? 'primeiro mês com receita' : (
                                    <span className={`inline-flex items-center gap-1 font-semibold ${crescimento >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {crescimento >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
                                        {String(crescimento).replace('.', ',')}% vs mês anterior
                                    </span>
                                )} />
                            <Indicador icone={CalendarDaysIcon} cor="bg-blue-50 text-blue-600" rotulo="Agendamentos" valor={(resumo.agendamentos_mes || 0).toLocaleString('pt-BR')}
                                sub={<span className="inline-flex items-center gap-1"><XCircleIcon className="h-3.5 w-3.5" /> {String(resumo.taxa_cancelamento || 0).replace('.', ',')}% cancelados · ticket {brl(resumo.ticket_medio)}</span>} />
                            <Indicador icone={StarIcon} cor="bg-amber-50 text-amber-500" rotulo="Avaliação" valor={resumo.avaliacao_media ? String(resumo.avaliacao_media).replace('.', ',') : '—'}
                                sub={`${resumo.avaliacoes_mes || 0} avaliações no mês`} destaque={resumo.avaliacao_media >= 4.5 ? 'Top' : null} />
                        </div>

                        {/* EVOLUÇÃO + RECEITA POR LOCAL */}
                        <div className="grid gap-5 lg:grid-cols-3">
                            <Cartao titulo="Faturamento nos últimos 6 meses" className="lg:col-span-2">
                                <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={faturamento_por_mes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="#F0F0F2" />
                                            <XAxis dataKey="mes" {...eixo} />
                                            <YAxis {...eixo} tickFormatter={brlCurto} width={56} />
                                            <Tooltip content={<Dica />} />
                                            <Area type="monotone" dataKey="valor" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#gradReceita)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Cartao>

                            <Cartao titulo="Receita por estabelecimento">
                                {receita_por_estabelecimento.length === 0 ? (
                                    <p className="text-sm text-gray-400">Nenhum atendimento concluído neste mês.</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {receita_por_estabelecimento.map((l, i) => (
                                            <li key={l.nome}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="truncate font-semibold text-gray-800">{l.nome}</span>
                                                    <span className="ml-2 shrink-0 text-gray-500">{brl(l.valor)} · {String(l.percentual).replace('.', ',')}%</span>
                                                </div>
                                                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (l.valor / maiorLocal) * 100)}%`, backgroundColor: CORES_BARRAS[i % CORES_BARRAS.length] }} />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Cartao>
                        </div>

                        {/* POR HORA E POR DIA */}
                        <div className="grid gap-5 lg:grid-cols-2">
                            <Cartao titulo="Receita por horário">
                                {receita_por_hora.length === 0 ? <p className="text-sm text-gray-400">Sem movimento neste mês.</p> : (
                                    <div style={{ width: '100%', height: 220 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={receita_por_hora} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                                <CartesianGrid vertical={false} stroke="#F0F0F2" />
                                                <XAxis dataKey="hora" {...eixo} />
                                                <YAxis {...eixo} tickFormatter={brlCurto} width={52} />
                                                <Tooltip cursor={{ fill: '#F5F5F7' }} content={<Dica />} />
                                                <Bar dataKey="valor" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </Cartao>
                            <Cartao titulo="Receita por dia da semana">
                                <div style={{ width: '100%', height: 220 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={receita_por_dia_semana} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid vertical={false} stroke="#F0F0F2" />
                                            <XAxis dataKey="dia" {...eixo} />
                                            <YAxis {...eixo} tickFormatter={brlCurto} width={52} />
                                            <Tooltip cursor={{ fill: '#F5F5F7' }} content={<Dica />} />
                                            <Bar dataKey="valor" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Cartao>
                        </div>

                        {/* EQUIPE E SERVIÇOS */}
                        <div className="grid gap-5 lg:grid-cols-2">
                            <Cartao titulo="Produtividade da equipe" icone={TrophyIcon}>
                                {ranking_funcionarios.length === 0 ? <p className="text-sm text-gray-400">Nenhum atendimento finalizado neste mês.</p> : (
                                    <ul className="space-y-3">
                                        {ranking_funcionarios.map((f) => (
                                            <li key={f.nome}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="truncate font-semibold text-gray-800">{f.nome}</span>
                                                    <span className="ml-2 shrink-0 text-gray-500">{f.atendimentos}x · {brl(f.faturamento)}</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(4, (f.faturamento / maiorRanking) * 100)}%` }} /></div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Cartao>
                            <Cartao titulo="Serviços mais vendidos" icone={FireIcon}>
                                {servicos_mais_vendidos.length === 0 ? <p className="text-sm text-gray-400">Nenhum serviço finalizado neste mês.</p> : (
                                    <ul className="space-y-3">
                                        {servicos_mais_vendidos.map((s) => (
                                            <li key={s.nome}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="truncate font-semibold text-gray-800">{s.nome}</span>
                                                    <span className="ml-2 shrink-0 text-gray-500">{s.quantidade}x · {brl(s.faturamento)}</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (s.quantidade / maiorServico) * 100)}%` }} /></div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Cartao>
                        </div>

                        {/* DESEMPENHO POR ESTABELECIMENTO */}
                        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <h3 className="border-b border-gray-100 p-5 font-bold text-gray-900">Desempenho por estabelecimento</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                            <th className="px-5 py-3">Estabelecimento</th>
                                            <th className="px-4 py-3 text-right">Atendimentos</th>
                                            <th className="px-4 py-3 text-right">Receita</th>
                                            <th className="px-4 py-3 text-right">Ticket médio</th>
                                            <th className="px-4 py-3 text-right">Clientes</th>
                                            <th className="px-4 py-3 text-right">Cancelamento</th>
                                            <th className="px-5 py-3 text-right">Avaliação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {desempenho_estabelecimentos.map((l) => (
                                            <tr key={l.nome} className="hover:bg-gray-50/60">
                                                <td className="px-5 py-3 font-semibold text-gray-900">{l.nome}</td>
                                                <td className="px-4 py-3 text-right">{l.atendimentos}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">{brl(l.receita)}</td>
                                                <td className="px-4 py-3 text-right">{brl(l.ticket_medio)}</td>
                                                <td className="px-4 py-3 text-right">{l.clientes}</td>
                                                <td className={`px-4 py-3 text-right ${l.cancelamento > 15 ? 'font-bold text-rose-600' : ''}`}>{String(l.cancelamento).replace('.', ',')}%</td>
                                                <td className="px-5 py-3 text-right">{l.avaliacao ? <span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{String(l.avaliacao).replace('.', ',')}</span> : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
