import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

export default function Fila({ auth, estabelecimento, agendamentos, filtros }) {
   
    const [params, setParams] = useState({
        ordem: filtros.ordem || 'asc',
        status: filtros.status || 'todos',
        status_pagamento: filtros.status_pagamento || 'todos',
        per_page: filtros.per_page || '10',
    });

    // Dispara a busca sempre que um filtro mudar
    const updateFiltros = (key, value) => {
        const newParams = { ...params, [key]: value };
        setParams(newParams);
        
        router.get(route('estabelecimentos.fila', estabelecimento.id), newParams, {
            preserveState: true,
            preserveScroll: true,
            only: ['agendamentos', 'filtros'] // Otimização: só recarrega a tabela
        });
    };

    // Atualiza o status do agendamento sem recarregar a página ou perder os filtros
    const atualizarStatus = (id, novoStatus) => {
        router.put(route('agendamentos.status.update', id), {
            status: novoStatus
        }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    // Função para formatar moeda
    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                            Fila de Atendimento
                        </h2>
                        <p className="text-sm text-gray-500">{estabelecimento.nome} - Fila de Hoje</p>
                    </div>
                </div>
            }
        >
            <Head title={`Fila - ${estabelecimento.nome}`} />

            <div className="max-w-7xl mx-auto mt-6 space-y-6 pb-12">
                
                {/* --- BARRA DE FILTROS --- */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                        
                        {/* Filtro: Status do Atendimento */}
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Atendimento</label>
                            <select 
                                value={params.status} 
                                onChange={(e) => updateFiltros('status', e.target.value)}
                                className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500 min-w-[160px]"
                            >
                                <option value="todos">Todos</option>
                                <option value="pendente">Aguardando (Pendentes)</option>
                                <option value="confirmado">Em Atendimento</option>
                                <option value="finalizado">Finalizados</option>
                            </select>
                        </div>

                        {/* Filtro: Status de Pagamento */}
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pagamento</label>
                            <select 
                                value={params.status_pagamento} 
                                onChange={(e) => updateFiltros('status_pagamento', e.target.value)}
                                className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500 min-w-[140px]"
                            >
                                <option value="todos">Todos</option>
                                <option value="pago">Já Pagos</option>
                                <option value="pendente">Pagamento Pendente</option>
                            </select>
                        </div>

                        {/* Filtro: Ordem de Chegada */}
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ordem da Fila</label>
                            <select 
                                value={params.ordem} 
                                onChange={(e) => updateFiltros('ordem', e.target.value)}
                                className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500 min-w-[200px]"
                            >
                                <option value="asc">Mais Antigos Primeiro</option>
                                <option value="desc">Mais Recentes Primeiro</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtro: Paginação */}
                    <div className="flex flex-col w-full md:w-auto mt-4 md:mt-0">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mostrar</label>
                        <select 
                            value={params.per_page} 
                            onChange={(e) => updateFiltros('per_page', e.target.value)}
                            className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500"
                        >
                            <option value="10">10 por página</option>
                            <option value="15">15 por página</option>
                            <option value="20">20 por página</option>
                        </select>
                    </div>
                </div>

                {/* --- TABELA / A FILA --- */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Horário</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Serviço & Valor</th>
                                    <th className="px-6 py-4 text-center">Pagamento</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {agendamentos.data.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                            Nenhum cliente encontrado na fila com estes filtros.
                                        </td>
                                    </tr>
                                ) : (
                                    agendamentos.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-150">
                                            
                                            {/* Horário e Data */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-900 dark:text-white text-lg">
                                                    {item.hora_agendamento.substring(0, 5)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(item.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                </div>
                                            </td>

                                            {/* Nome do Cliente */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase">
                                                        {item.usuario.name.charAt(0)}
                                                    </div>
                                                    <div className="font-semibold text-gray-900 dark:text-white">
                                                        {item.usuario.name}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Serviço e Valor */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {item.servico.nome}
                                                </div>
                                                <div className="text-gray-500 text-sm font-semibold">
                                                    {formatarMoeda(item.valor_final || item.servico.valor)}
                                                </div>
                                            </td>

                                            {/* Status de Pagamento */}
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                {item.pagamento?.status === 'pago' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        Pago
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                                        Pendente
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status do Atendimento */}
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                {item.status === 'pendente' && (
                                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Aguardando</span>
                                                )}
                                                {item.status === 'confirmado' && (
                                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse">Em Atendimento</span>
                                                )}
                                                {item.status === 'finalizado' && (
                                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 border border-green-200">Finalizado</span>
                                                )}
                                                {item.status === 'cancelado' && (
                                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">Cancelado</span>
                                                )}
                                            </td>

                                            {/* Ações Dinâmicas */}
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex justify-end gap-2 items-center">
                                                    {item.status === 'pendente' ? (
                                                        <>
                                                            <button 
                                                                onClick={() => atualizarStatus(item.id, 'confirmado')}
                                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition"
                                                            >
                                                                Chamar
                                                            </button>
                                                            <button 
                                                                onClick={() => atualizarStatus(item.id, 'cancelado')}
                                                                className="px-3 py-2 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-400 text-sm font-bold rounded-lg transition"
                                                                title="Cancelar ou Não Compareceu"
                                                            >
                                                                ✕
                                                            </button>
                                                        </>
                                                    ) : item.status === 'confirmado' ? (
                                                        <button 
                                                            onClick={() => atualizarStatus(item.id, 'finalizado')}
                                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2"
                                                        >
                                                            <span>Finalizar</span>
                                                        </button>
                                                    ) : item.status === 'finalizado' ? (
                                                        <span className="px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-600 text-sm font-bold rounded-lg cursor-not-allowed">
                                                            Concluído
                                                        </span>
                                                    ) : (
                                                        <span className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-400 dark:text-red-400 border border-red-100 dark:border-red-800 text-sm font-bold rounded-lg cursor-not-allowed">
                                                            Cancelado
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* --- PAGINAÇÃO NATIVA --- */}
                    {agendamentos.links && agendamentos.data.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                            <div className="flex flex-wrap gap-1">
                                {agendamentos.links.map((link, key) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (link.url) router.visit(link.url, { preserveScroll: true });
                                        }}
                                        disabled={!link.url}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                            link.active 
                                            ? 'bg-indigo-600 text-white shadow' 
                                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                                        } ${!link.url && 'opacity-50 cursor-not-allowed'}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}