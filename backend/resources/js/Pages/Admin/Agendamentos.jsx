import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    ClipboardDocumentListIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ClockIcon,
    CreditCardIcon,
    MapPinIcon,
    UserIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const STATUS_ESTILO = {
    pendente: 'bg-yellow-100 text-yellow-800',
    confirmado: 'bg-blue-100 text-blue-800',
    em_atendimento: 'bg-teal-100 text-teal-800',
    finalizado: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800',
    aguardando_pagamento: 'bg-gray-100 text-gray-700',
};

function badgeStatus(status) {
    return STATUS_ESTILO[status] || 'bg-gray-100 text-gray-700';
}

export default function AdminAgendamentos({ agendamentos, filtros = {} }) {
    const [busca, setBusca] = useState(filtros.busca || '');
    const [status, setStatus] = useState(filtros.status || '');
    const [detalhe, setDetalhe] = useState(null);
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

    const aplicarFiltros = (e) => {
        e?.preventDefault();
        router.get(route('admin.agendamentos.index'), { busca, status }, { preserveState: true, preserveScroll: true });
    };

    const abrirDetalhe = async (id) => {
        setCarregandoDetalhe(true);
        setDetalhe({ loading: true });
        try {
            const res = await fetch(route('admin.agendamentos.show', id));
            const json = await res.json();
            setDetalhe(json);
        } catch (e) {
            setDetalhe({ erro: 'Não foi possível carregar os detalhes deste agendamento.' });
        } finally {
            setCarregandoDetalhe(false);
        }
    };

    const fecharDetalhe = () => setDetalhe(null);

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ClipboardDocumentListIcon className="w-7 h-7 text-indigo-600" />
                    Painel Admin: Auditoria de Agendamentos
                </h2>
            }
        >
            <Head title="Admin - Agendamentos" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20">

                <form onSubmit={aplicarFiltros} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[220px]">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cliente, estabelecimento ou código PIN..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-gray-200"
                        />
                    </div>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm rounded-xl border-gray-200 py-2">
                        <option value="">Todos os status</option>
                        <option value="pendente">Pendente</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="em_atendimento">Em atendimento</option>
                        <option value="finalizado">Finalizado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                    <button type="submit" className="px-5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition">
                        Filtrar
                    </button>
                </form>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Todos os Agendamentos</h3>
                            <p className="text-sm text-gray-500">Clique em uma linha para ver o log completo, pagamento e estorno.</p>
                        </div>
                        <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm">
                            Total: {agendamentos.total}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="py-4 px-6 font-bold">Cliente</th>
                                    <th className="py-4 px-6 font-bold">Local / Serviço</th>
                                    <th className="py-4 px-6 font-bold text-center">Data</th>
                                    <th className="py-4 px-6 font-bold text-center">Status</th>
                                    <th className="py-4 px-6 font-bold text-center">Pagamento</th>
                                    <th className="py-4 px-6 font-bold text-center">Estorno</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {agendamentos.data.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-gray-400">
                                            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            Nenhum agendamento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    agendamentos.data.map((ag) => (
                                        <tr key={ag.id} onClick={() => abrirDetalhe(ag.id)} className="hover:bg-gray-50/50 transition cursor-pointer">
                                            <td className="py-4 px-6">
                                                <p className="font-bold text-gray-900">{ag.usuario?.name || 'Cliente removido'}</p>
                                                <p className="text-xs text-gray-500">{ag.usuario?.email}</p>
                                            </td>
                                            <td className="py-4 px-6">
                                                <p className="font-semibold text-gray-800">{ag.estabelecimento?.nome}</p>
                                                <p className="text-xs text-gray-500">{ag.servico?.nome || 'Sem serviço vinculado'}</p>
                                            </td>
                                            <td className="py-4 px-6 text-center text-gray-500">
                                                {ag.data_agendamento ? new Date(ag.data_agendamento).toLocaleDateString('pt-BR') : '-'}
                                                {ag.hora_agendamento && <span className="block text-xs">{ag.hora_agendamento.substring(0, 5)}</span>}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeStatus(ag.status)}`}>
                                                    {ag.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase">
                                                {ag.status_pagamento?.replace('_', ' ') || '-'}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {ag.estorno_status ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                                                        <ExclamationTriangleIcon className="w-3 h-3" /> {ag.estorno_status}
                                                    </span>
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

                    {agendamentos.last_page > 1 && (
                        <div className="p-6 border-t border-gray-100 flex justify-center gap-2 bg-gray-50 flex-wrap">
                            {agendamentos.links.map((link, index) => (
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

            {/* MODAL DE DETALHES / LOG */}
            {detalhe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl p-6 sm:p-8 relative">
                        <button onClick={fecharDetalhe} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700">
                            <XMarkIcon className="w-6 h-6" />
                        </button>

                        {carregandoDetalhe || detalhe.loading ? (
                            <div className="py-20 text-center text-gray-400">Carregando...</div>
                        ) : detalhe.erro ? (
                            <div className="py-20 text-center text-rose-500">{detalhe.erro}</div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">Agendamento #{detalhe.agendamento.id}</h3>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 ${badgeStatus(detalhe.agendamento.status)}`}>
                                    {detalhe.agendamento.status?.replace('_', ' ')}
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1"><UserIcon className="w-3.5 h-3.5" /> Cliente (quem fez)</p>
                                        <p className="font-bold text-gray-900">{detalhe.agendamento.usuario?.name || 'Removido'}</p>
                                        <p className="text-xs text-gray-500">{detalhe.agendamento.usuario?.email}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1"><MapPinIcon className="w-3.5 h-3.5" /> Local</p>
                                        <p className="font-bold text-gray-900">{detalhe.agendamento.estabelecimento?.nome}</p>
                                        <p className="text-xs text-gray-500">
                                            {[detalhe.agendamento.estabelecimento?.rua, detalhe.agendamento.estabelecimento?.bairro, detalhe.agendamento.estabelecimento?.cidade].filter(Boolean).join(', ') || 'Endereço não informado'}
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1"><CreditCardIcon className="w-3.5 h-3.5" /> Pagamento</p>
                                        <p className="font-bold text-gray-900 capitalize">{detalhe.pagamento?.metodo_pagamento || detalhe.agendamento.status_pagamento || 'Não informado'}</p>
                                        <p className="text-xs text-gray-500">
                                            {detalhe.pagamento ? `R$ ${Number(detalhe.pagamento.valor || 0).toFixed(2).replace('.', ',')} • local: ${detalhe.pagamento.status}` : 'Sem registro de pagamento vinculado'}
                                        </p>
                                        {detalhe.pagamento_asaas ? (
                                            <p className="text-xs text-indigo-600 font-bold mt-1">Status real no Asaas: {detalhe.pagamento_asaas.status}</p>
                                        ) : detalhe.pagamento?.id_transacao_gateway ? (
                                            <p className="text-xs text-gray-400 mt-1">Status no Asaas indisponível agora.</p>
                                        ) : null}
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1"><UserIcon className="w-3.5 h-3.5" /> Quem finalizou/assinou</p>
                                        <p className="font-bold text-gray-900">{detalhe.agendamento.finalizado_por?.name || detalhe.agendamento.finalizadoPor?.name || (detalhe.agendamento.status === 'finalizado' ? 'Não identificado' : '—')}</p>
                                    </div>
                                </div>

                                {detalhe.estorno && (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 mb-6">
                                        <p className="text-[11px] font-bold text-rose-500 uppercase flex items-center gap-1 mb-1">
                                            <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Estorno solicitado
                                        </p>
                                        <p className="font-bold text-rose-700">Status: {detalhe.estorno.status}</p>
                                        <p className="text-xs text-rose-600 mt-1">{detalhe.estorno.motivo}</p>
                                        <p className="text-xs text-rose-500 mt-1">
                                            Valor: R$ {Number(detalhe.estorno.valor_estornado || detalhe.estorno.valor_pago || 0).toFixed(2).replace('.', ',')}
                                        </p>
                                    </div>
                                )}

                                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-indigo-500" /> Histórico de mudanças de status
                                </h4>
                                <div className="space-y-3">
                                    {(!detalhe.historico || detalhe.historico.length === 0) && (
                                        <p className="text-sm text-gray-400">Nenhuma mudança de status registrada ainda.</p>
                                    )}
                                    {detalhe.historico?.map((log) => (
                                        <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-indigo-100 pl-4">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800">
                                                    {log.status_anterior ? `${log.status_anterior} → ${log.status_novo}` : `Criado como ${log.status_novo}`}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(log.created_at).toLocaleString('pt-BR')} • por {log.alterado_por?.name || log.alterado_por_nome || 'Sistema'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
