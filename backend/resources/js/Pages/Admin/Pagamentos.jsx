import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { BanknotesIcon, MagnifyingGlassIcon, XMarkIcon, SignalIcon } from '@heroicons/react/24/outline';

const STATUS_ESTILO = {
    pago: 'bg-green-100 text-green-700',
    pendente: 'bg-yellow-100 text-yellow-700',
    cancelado: 'bg-gray-100 text-gray-700',
    estornado: 'bg-rose-100 text-rose-700',
};

export default function AdminPagamentos({ pagamentos, filtros = {}, resumo = {} }) {
    const [busca, setBusca] = useState(filtros.busca || '');
    const [status, setStatus] = useState(filtros.status || '');
    const [metodo, setMetodo] = useState(filtros.metodo || '');
    const [consultaAsaas, setConsultaAsaas] = useState(null);

    const verStatusAsaas = async (pagamentoId) => {
        setConsultaAsaas({ loading: true });
        try {
            const res = await fetch(route('admin.financeiro.pagamentos.asaas', pagamentoId));
            const json = await res.json();
            setConsultaAsaas(json);
        } catch (e) {
            setConsultaAsaas({ erro: true });
        }
    };

    const aplicarFiltros = (e) => {
        e?.preventDefault();
        router.get(route('admin.financeiro.pagamentos'), { busca, status, metodo }, { preserveState: true, preserveScroll: true });
    };

    const formatarValor = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <BanknotesIcon className="w-7 h-7 text-indigo-600" />
                    Todos os Pagamentos da Plataforma
                </h2>
            }
        >
            <Head title="Admin - Pagamentos" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Pago</p>
                        <p className="text-2xl font-black text-green-600">{formatarValor(resumo.total_pago)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Pendente</p>
                        <p className="text-2xl font-black text-yellow-600">{formatarValor(resumo.total_pendente)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Estornado</p>
                        <p className="text-2xl font-black text-rose-600">{formatarValor(resumo.total_estornado)}</p>
                    </div>
                </div>

                <form onSubmit={aplicarFiltros} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[220px]">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cliente, estabelecimento ou ID da transação Asaas..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-gray-200"
                        />
                    </div>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm rounded-xl border-gray-200 py-2">
                        <option value="">Todos os status</option>
                        <option value="pago">Pago</option>
                        <option value="pendente">Pendente</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="estornado">Estornado</option>
                    </select>
                    <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="text-sm rounded-xl border-gray-200 py-2">
                        <option value="">Todos os métodos</option>
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                        <option value="boleto">Boleto</option>
                    </select>
                    <button type="submit" className="px-5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition">
                        Filtrar
                    </button>
                </form>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="py-4 px-6 font-bold">Cliente</th>
                                    <th className="py-4 px-6 font-bold">Estabelecimento</th>
                                    <th className="py-4 px-6 font-bold">Método</th>
                                    <th className="py-4 px-6 font-bold text-center">Status</th>
                                    <th className="py-4 px-6 font-bold text-right">Valor</th>
                                    <th className="py-4 px-6 font-bold text-right">Data</th>
                                    <th className="py-4 px-6 font-bold text-center">Asaas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagamentos.data.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-12 text-gray-400">Nenhum pagamento encontrado.</td></tr>
                                ) : (
                                    pagamentos.data.map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition">
                                            <td className="py-4 px-6">
                                                <p className="font-bold text-gray-900">{p.usuario?.name || 'Removido'}</p>
                                                <p className="text-xs text-gray-500">{p.usuario?.email}</p>
                                            </td>
                                            <td className="py-4 px-6 text-gray-700">{p.estabelecimento?.nome}</td>
                                            <td className="py-4 px-6 uppercase text-xs font-bold text-gray-500">{p.metodo_pagamento}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_ESTILO[p.status] || 'bg-gray-100 text-gray-700'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-gray-900">{formatarValor(p.valor)}</td>
                                            <td className="py-4 px-6 text-right text-gray-500 text-xs">{new Date(p.created_at).toLocaleString('pt-BR')}</td>
                                            <td className="py-4 px-6 text-center">
                                                {p.id_transacao_gateway ? (
                                                    <button
                                                        onClick={() => verStatusAsaas(p.id)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition"
                                                    >
                                                        <SignalIcon className="w-3.5 h-3.5" /> Ver ao vivo
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagamentos.last_page > 1 && (
                        <div className="p-6 border-t border-gray-100 flex justify-center gap-2 bg-gray-50 flex-wrap">
                            {pagamentos.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url || '#'}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${link.active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE STATUS AO VIVO NO ASAAS */}
            {consultaAsaas && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                        <button onClick={() => setConsultaAsaas(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <SignalIcon className="w-5 h-5 text-indigo-600" /> Status ao vivo no Asaas
                        </h3>

                        {consultaAsaas.loading ? (
                            <p className="text-sm text-gray-400 py-8 text-center">Consultando a API do Asaas...</p>
                        ) : consultaAsaas.erro || !consultaAsaas.encontrado ? (
                            <p className="text-sm text-rose-500 py-8 text-center">Não foi possível consultar este pagamento no Asaas agora.</p>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-400 font-semibold">Status no gateway</span>
                                    <span className="font-bold text-gray-900">{consultaAsaas.asaas.status}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-400 font-semibold">Valor</span>
                                    <span className="font-bold text-gray-900">R$ {Number(consultaAsaas.asaas.value || 0).toFixed(2).replace('.', ',')}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-400 font-semibold">Forma de cobrança</span>
                                    <span className="font-bold text-gray-900">{consultaAsaas.asaas.billingType}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 font-semibold">Data de pagamento</span>
                                    <span className="font-bold text-gray-900">{consultaAsaas.asaas.paymentDate || 'Ainda não pago'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
