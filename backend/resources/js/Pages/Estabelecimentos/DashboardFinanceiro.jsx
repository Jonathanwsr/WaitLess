import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AtalhoNotasFiscais from '@/Components/AtalhoNotasFiscais';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    CalendarIcon, ArrowDownTrayIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, CreditCardIcon, DevicePhoneMobileIcon,
    DocumentTextIcon, BanknotesIcon, ReceiptPercentIcon, ScaleIcon, ChevronLeftIcon, ChevronRightIcon, WalletIcon, FunnelIcon,
} from '@heroicons/react/24/outline';

const CORES = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280'];
const STATUS = {
    liberado: 'bg-emerald-50 text-emerald-700',
    pago: 'bg-emerald-50 text-emerald-700',
    concluido: 'bg-emerald-50 text-emerald-700',
    pendente: 'bg-amber-50 text-amber-700',
    retido: 'bg-amber-50 text-amber-700',
    estornado: 'bg-rose-50 text-rose-700',
    cancelado: 'bg-gray-100 text-gray-600',
};
const METODOS = { pix: 'Pix', cartao: 'Cartão', cartao_credito: 'Cartão de crédito', boleto: 'Boleto', presencial: 'No local' };
const reais = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Rosca com fatias proporcionais aos valores reais (sem biblioteca de gráficos). */
function Rosca({ itens, rotulo, valor }) {
    const total = itens.reduce((acc, i) => acc + Number(i.total || 0), 0);
    if (!total) return <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>;
    let acumulado = 0;
    const fatias = itens.map((i, idx) => {
        const ini = (acumulado / total) * 100;
        acumulado += Number(i.total || 0);
        return `${CORES[idx % CORES.length]} ${ini}% ${(acumulado / total) * 100}%`;
    });
    return (
        <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${fatias.join(', ')})` }}>
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white text-center">
                    <span className="text-[9px] text-gray-400">{rotulo}</span>
                    <span className="text-[11px] font-black text-gray-900">{valor}</span>
                </div>
            </div>
            <ul className="flex-1 space-y-2 text-xs">
                {itens.map((i, idx) => (
                    <li key={i.nome} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-gray-600">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CORES[idx % CORES.length] }} /> {i.nome}
                        </span>
                        <span className="font-bold text-gray-900">{Math.round((Number(i.total) / total) * 100)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Indicador({ icone: Icone, cor, rotulo, valor, sub }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cor}`}><Icone className="h-5 w-5" /></span>
            <div className="min-w-0">
                <p className="text-xs text-gray-500">{rotulo}</p>
                <p className="truncate text-lg font-black text-gray-900">{valor}</p>
                {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

export default function DashboardFinanceiro({ auth, extrato = {}, resumoCards = {}, filtrosDados = {}, filtrosAtuais = {}, dadosGraficos = {} }) {
    const { menuPremium } = usePage().props;
    const [filtros, setFiltros] = useState({
        data_inicio: filtrosAtuais.data_inicio || '',
        data_fim: filtrosAtuais.data_fim || '',
        estabelecimento_id: filtrosAtuais.estabelecimento_id || 'todos',
        tipo: filtrosAtuais.tipo || 'todos',
        metodo_pagamento: filtrosAtuais.metodo_pagamento || 'todos',
    });
    const primeira = useRef(true);

    const aplicar = (f = filtros) => router.get(route('provider.financeiro'), f, { preserveState: true, preserveScroll: true, replace: true });

    // Selects aplicam na hora; as datas aplicam quando as duas estiverem preenchidas.
    useEffect(() => {
        if (primeira.current) { primeira.current = false; return; }
        if ((filtros.data_inicio && !filtros.data_fim) || (!filtros.data_inicio && filtros.data_fim)) return;
        aplicar();
    }, [filtros]);

    const mudar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
    const exportar = () => window.open(route('provider.financeiro.export', filtros));
    const ehSocio = ['socio', 'sócio', 'proprietario', 'proprietário'].includes(String(auth?.user?.papel || '').toLowerCase());

    const porMetodo = (dadosGraficos.formas_pagamento || []).map((g) => ({ nome: METODOS[g.metodo_pagamento] || g.metodo_pagamento || 'Outro', total: g.total }));
    const porCategoria = (dadosGraficos.categorias || []).map((g) => ({ nome: g.categoria, total: g.total }));
    const select = 'rounded-xl border-gray-200 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:ring-emerald-500';

    return (
        <AuthenticatedLayout>
            <Head title="Extrato financeiro" />

            <div className="mx-auto max-w-[1400px] space-y-5">
                {/* CABEÇALHO */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-[28px]">Extrato Financeiro Geral</h1>
                        <p className="text-sm text-gray-500">Todas as entradas, taxas, estornos e repasses dos seus locais.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 shadow-sm">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            <input type="date" value={filtros.data_inicio} onChange={mudar('data_inicio')} className="w-[128px] border-0 text-sm text-gray-600 focus:ring-0" aria-label="Data inicial" />
                            <span className="text-gray-300">–</span>
                            <input type="date" value={filtros.data_fim} onChange={mudar('data_fim')} className="w-[128px] border-0 text-sm text-gray-600 focus:ring-0" aria-label="Data final" />
                        </div>
                        <button type="button" onClick={exportar} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
                            <ArrowDownTrayIcon className="h-4 w-4" /> Exportar
                        </button>
                        {ehSocio && route().has('carteira.asaas') && (
                            <Link href={route('carteira.asaas')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black">
                                <WalletIcon className="h-4 w-4" /> Carteira
                            </Link>
                        )}
                    </div>
                </div>

                <AtalhoNotasFiscais />

                {!menuPremium && (
                    <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-gray-900 p-4 sm:flex-row sm:items-center">
                        <p className="text-sm text-gray-300"><b className="text-white">Extrato básico.</b> No Premium você recebe também o resumo financeiro toda semana no e-mail.</p>
                        <button type="button" onClick={() => router.get(route('assinatura.status'))} className="shrink-0 rounded-xl bg-[#FF5A00] px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">Ver plano Premium</button>
                    </div>
                )}

                {/* INDICADORES */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Indicador icone={ArrowTrendingUpIcon} cor="bg-emerald-50 text-emerald-600" rotulo="Receita bruta" valor={`R$ ${resumoCards.receita_total || '0,00'}`} sub="entradas do período" />
                    <Indicador icone={ReceiptPercentIcon} cor="bg-amber-50 text-amber-600" rotulo="Taxas" valor={`R$ ${resumoCards.taxas || '0,00'}`} sub="taxa da plataforma" />
                    <Indicador icone={ArrowTrendingDownIcon} cor="bg-rose-50 text-rose-600" rotulo="Estornos" valor={`R$ ${resumoCards.estornos || '0,00'}`} sub="devolvido a clientes" />
                    <Indicador icone={BanknotesIcon} cor="bg-blue-50 text-blue-600" rotulo="Líquido" valor={`R$ ${resumoCards.lucro_liquido || '0,00'}`} sub="o que fica para você" />
                    <Indicador icone={ScaleIcon} cor="bg-purple-50 text-purple-600" rotulo="Ticket médio" valor={`R$ ${resumoCards.ticket_medio || '0,00'}`} sub={`${resumoCards.transacoes_count || 0} transações`} />
                </div>

                {/* FILTROS */}
                <div className="flex flex-wrap items-center gap-2">
                    <FunnelIcon className="h-4 w-4 text-gray-400" />
                    <select value={filtros.estabelecimento_id} onChange={mudar('estabelecimento_id')} className={select}>
                        <option value="todos">Todos os estabelecimentos</option>
                        {filtrosDados.estabelecimentos?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                    <select value={filtros.tipo} onChange={mudar('tipo')} className={select}>
                        <option value="todos">Todos os tipos</option>
                        <option value="credito">Entradas</option>
                        <option value="estorno">Estornos</option>
                        <option value="repasse">Repasses</option>
                    </select>
                    <select value={filtros.metodo_pagamento} onChange={mudar('metodo_pagamento')} className={select}>
                        <option value="todos">Todas as formas de pagamento</option>
                        <option value="pix">Pix</option>
                        <option value="cartao_credito">Cartão de crédito</option>
                        <option value="boleto">Boleto</option>
                    </select>
                </div>

                <div className="flex flex-col gap-5 xl:flex-row">
                    {/* MOVIMENTAÇÕES */}
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                            <h2 className="font-bold text-gray-900">Movimentações</h2>
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-500">{extrato.total || 0} registros</span>
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Descrição</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Forma</th>
                                        <th className="px-4 py-3 text-right">Líquido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {(extrato.data || []).map((item) => {
                                        const d = new Date(item.created_at);
                                        const entrada = item.tipo === 'credito' || item.tipo === 'repasse';
                                        const Metodo = item.metodo_pagamento === 'pix' ? DevicePhoneMobileIcon : item.metodo_pagamento === 'boleto' ? DocumentTextIcon : CreditCardIcon;
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/60">
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <p className="font-semibold text-gray-900">{d.toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-xs text-gray-400">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-gray-900">{item.descricao}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {item.tipo === 'estorno' ? 'Estorno' : item.tipo === 'repasse' ? 'Repasse' : item.origem_type?.includes('Aluguel') ? 'Reserva' : item.origem_type?.includes('Pedido') ? 'Produto' : 'Serviço'}
                                                        {item.origem_id ? ` · #${item.origem_id}` : ''}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{item.usuario?.name || 'Sistema'}</td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <span className="inline-flex items-center gap-1.5 text-gray-700"><Metodo className="h-4 w-4 text-gray-400" /> {METODOS[item.metodo_pagamento] || item.metodo_pagamento || '-'}</span>
                                                </td>
                                                <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${entrada ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {entrada ? '' : '- '}{reais(Math.abs(item.valor_liquido))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Celular: cartões */}
                        <ul className="divide-y divide-gray-50 md:hidden">
                            {(extrato.data || []).map((item) => {
                                const entrada = item.tipo === 'credito' || item.tipo === 'repasse';
                                return (
                                    <li key={item.id} className="flex items-start justify-between gap-3 p-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-gray-900">{item.descricao}</p>
                                            <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {item.usuario?.name || 'Sistema'}</p>
                                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                                        </div>
                                        <p className={`shrink-0 text-sm font-bold ${entrada ? 'text-emerald-600' : 'text-rose-600'}`}>{entrada ? '' : '- '}{reais(Math.abs(item.valor_liquido))}</p>
                                    </li>
                                );
                            })}
                        </ul>

                        {(extrato.data || []).length === 0 && <p className="px-5 py-16 text-center text-sm text-gray-400">Nenhuma movimentação para estes filtros.</p>}

                        <div className="mt-auto flex flex-col items-center justify-between gap-3 border-t border-gray-100 p-4 sm:flex-row">
                            <p className="text-xs text-gray-500">Mostrando {extrato.from || 0} a {extrato.to || 0} de {extrato.total || 0}</p>
                            {extrato.last_page > 1 && (
                                <div className="flex items-center gap-1.5">
                                    {(extrato.links || []).map((l, i) => {
                                        const primeiro = i === 0;
                                        const ultimo = i === extrato.links.length - 1;
                                        const conteudo = primeiro ? <ChevronLeftIcon className="h-4 w-4" /> : ultimo ? <ChevronRightIcon className="h-4 w-4" /> : l.label;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={!l.url}
                                                onClick={() => l.url && router.get(l.url, {}, { preserveScroll: true, preserveState: true })}
                                                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold ${l.active ? 'bg-emerald-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'} disabled:opacity-40`}
                                            >
                                                {conteudo}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LATERAL */}
                    <aside className="flex w-full flex-col gap-4 xl:w-[340px]">
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 font-bold text-gray-900">Resumo do período</h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between"><dt className="text-gray-500">Receita bruta</dt><dd className="font-bold text-emerald-600">R$ {resumoCards.receita_total || '0,00'}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Taxas</dt><dd className="font-bold text-amber-600">- R$ {resumoCards.taxas || '0,00'}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Estornos</dt><dd className="font-bold text-rose-600">- R$ {resumoCards.estornos || '0,00'}</dd></div>
                                <div className="flex justify-between border-t border-gray-100 pt-2.5"><dt className="font-bold text-gray-900">Líquido</dt><dd className="font-black text-gray-900">R$ {resumoCards.lucro_liquido || '0,00'}</dd></div>
                                <div className="flex justify-between"><dt className="text-gray-500">Transações</dt><dd className="font-bold text-gray-900">{resumoCards.transacoes_count || 0}</dd></div>
                            </dl>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 font-bold text-gray-900">Receita por forma de pagamento</h3>
                            <Rosca itens={porMetodo} rotulo="Total" valor={`R$ ${resumoCards.receita_total || '0'}`} />
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 font-bold text-gray-900">Receita por categoria</h3>
                            <Rosca itens={porCategoria} rotulo="Total" valor={`R$ ${resumoCards.receita_total || '0'}`} />
                        </div>
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
