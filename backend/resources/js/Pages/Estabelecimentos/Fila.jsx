import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';

// ==============================================================================
// SUB-COMPONENTE: Linha da Tabela (Gerencia o estado do PIN para cada linha)
// ==============================================================================
const LinhaAgendamento = ({ item, funcionarios, atribuirFuncionario, atualizarStatus, formatarMoeda }) => {
    const [pedindoPin, setPedindoPin] = useState(false);
    const [pinDigitado, setPinDigitado] = useState('');

    const confirmarComPin = () => {
        if (pinDigitado.length !== 4) return alert('O código deve ter 4 números.');
        
        router.post(route('agendamentos.finalizar', item.id), { codigo: pinDigitado }, {
            preserveScroll: true,
            onSuccess: () => { setPedindoPin(false); setPinDigitado(''); },
            onError: (err) => { alert(err.codigo || 'Código incorreto!'); setPinDigitado(''); }
        });
    };

    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-150">
            {/* 1. DATA E HORA */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-bold text-gray-900 dark:text-white text-lg">
                    {item.hora_agendamento.substring(0, 5)}
                </div>
                <div className="text-xs text-gray-500">
                    {new Date(item.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </div>
            </td>

            {/* 2. CLIENTE */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase">
                        {item.usuario?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                            {item.usuario?.name || 'Cliente'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {item.usuario?.telefone || 'S/ telefone'}
                        </div>
                    </div>
                </div>
            </td>

            {/* 3. SERVIÇO */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900 dark:text-white">
                    {item.servico?.nome}
                </div>
                <div className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                    {formatarMoeda(item.valor_final || item.servico?.valor)}
                </div>
            </td>

            {/* 4. FUNCIONÁRIO (COM SELECT) */}
            <td className="px-6 py-4 text-center whitespace-nowrap">
                <select 
                    className="w-full text-xs border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg shadow-sm focus:border-indigo-500 text-gray-700 dark:text-gray-300"
                    value={item.funcionario_id || ''}
                    onChange={(e) => atribuirFuncionario(item.id, e.target.value)}
                >
                    <option value="">Qualquer um</option>
                    {funcionarios.map(f => (
                        <option key={f.id} value={f.id}>{f.nome.split(' ')[0]}</option>
                    ))}
                </select>
            </td>

            {/* 5. PAGAMENTO */}
            <td className="px-6 py-4 text-center whitespace-nowrap">
                {item.pagamento?.status === 'pago' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Pago
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Pendente
                    </span>
                )}
            </td>

            {/* 6. STATUS */}
            <td className="px-6 py-4 text-center whitespace-nowrap">
                {item.status === 'pendente' && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Aguardando</span>}
                {item.status === 'confirmado' && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse">Em Atendimento</span>}
                {item.status === 'finalizado' && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 border border-green-200">Finalizado</span>}
                {item.status === 'cancelado' && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">Cancelado</span>}
            </td>

            {/* 7. AÇÕES (COM LÓGICA DE PIN) */}
            <td className="px-6 py-4 text-right whitespace-nowrap">
                {pedindoPin ? (
                    // CAIXINHA DO PIN
                    <div className="flex justify-end gap-1 items-center animate-in fade-in slide-in-from-right-2">
                        <input 
                            type="text" 
                            placeholder="PIN" 
                            className="w-20 px-2 py-1.5 text-center tracking-widest font-bold border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm"
                            maxLength={4}
                            value={pinDigitado}
                            onChange={e => setPinDigitado(e.target.value.replace(/\D/g, ''))}
                        />
                        <button onClick={confirmarComPin} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm transition">
                            OK
                        </button>
                        <button onClick={() => setPedindoPin(false)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold rounded-lg transition">
                            ✕
                        </button>
                    </div>
                ) : (
                    // BOTÕES PADRÃO
                    <div className="flex justify-end gap-2 items-center">
                        {item.status === 'pendente' ? (
                            <>
                                <button onClick={() => atualizarStatus(item.id, 'confirmado')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition">
                                    Chamar
                                </button>
                                <button onClick={() => { if(confirm('Cancelar este agendamento?')) atualizarStatus(item.id, 'cancelado') }} className="px-3 py-2 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-400 text-sm font-bold rounded-lg transition">
                                    ✕
                                </button>
                            </>
                        ) : item.status === 'confirmado' ? (
                            <button onClick={() => setPedindoPin(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2">
                                ✔️ Finalizar
                            </button>
                        ) : item.status === 'finalizado' ? (
                            <span className="px-4 py-2 text-gray-400 text-sm font-bold rounded-lg">✔️ Concluído</span>
                        ) : (
                            <span className="px-4 py-2 text-red-400 text-sm font-bold rounded-lg">✕ Cancelado</span>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
};


// ==============================================================================
// COMPONENTE PRINCIPAL
// ==============================================================================
export default function Fila({ auth, estabelecimento, agendamentos, filtros, funcionarios = [] }) {
    
    const [params, setParams] = useState({
        periodo: filtros?.periodo || 'hoje',
        ordem: filtros?.ordem || 'asc',
        status: filtros?.status || 'todos',
        status_pagamento: filtros?.status_pagamento || 'todos',
        per_page: filtros?.per_page || '10',
    });

    // Auto-refresh silencioso
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['agendamentos'] });
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    // Dispara a busca sempre que um filtro ou ABA mudar
    const updateFiltros = (key, value) => {
        const newParams = { ...params, [key]: value };
        setParams(newParams);
        
        router.get(route('estabelecimentos.fila', estabelecimento.id), newParams, {
            preserveState: true,
            preserveScroll: true,
            only: ['agendamentos', 'filtros']
        });
    };

    // Atualiza o status
    const atualizarStatus = (id, novoStatus) => {
        router.patch(route('agendamentos.update-status', id), { status: novoStatus }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    // Atribui funcionário
    const atribuirFuncionario = (agendamentoId, funcionarioId) => {
        router.patch(route('agendamentos.update-funcionario', agendamentoId), { funcionario_id: funcionarioId }, { 
            preserveScroll: true,
            preserveState: true,
        });
    };

    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                            Fila de Atendimento
                        </h2>
                        <p className="text-sm text-gray-500">{estabelecimento.nome}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Fila - ${estabelecimento.nome}`} />

            <div className="max-w-7xl mx-auto mt-6 space-y-6 pb-12 px-4 sm:px-6 lg:px-8">
                
                
                <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700 pt-2">
                    <button 
                        onClick={() => updateFiltros('periodo', 'hoje')}
                        className={`pb-4 px-2 text-sm font-bold transition-all border-b-4 ${
                            params.periodo === 'hoje' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        🚨 Fila de Hoje
                    </button>
                    <button 
                        onClick={() => updateFiltros('periodo', 'futuro')}
                        className={`pb-4 px-2 text-sm font-bold transition-all border-b-4 ${
                            params.periodo === 'futuro' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        📅 Programados
                    </button>
                </div> 

                {/* --- BARRA DE FILTROS --- */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                        
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Atendimento</label>
                            <select 
                                value={params.status} 
                                onChange={(e) => updateFiltros('status', e.target.value)}
                                className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500 min-w-[160px]"
                            >
                                <option value="todos">Todos</option>
                                <option value="pendente">Aguardando</option>
                                <option value="confirmado">Em Atendimento</option>
                                <option value="finalizado">Finalizados</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pagamento</label>
                            <select 
                                value={params.status_pagamento} 
                                onChange={(e) => updateFiltros('status_pagamento', e.target.value)}
                                className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm shadow-sm focus:ring-indigo-500 min-w-[140px]"
                            >
                                <option value="todos">Todos</option>
                                <option value="pago">Já Pagos</option>
                                <option value="pendente">Pendente</option>
                            </select>
                        </div>

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
                                    <th className="px-6 py-4">Data / Hora</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Serviço</th>
                                    <th className="px-6 py-4 text-center">Profissional</th>
                                    <th className="px-6 py-4 text-center">Pagamento</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {!agendamentos || !agendamentos.data || agendamentos.data.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                            <div className="text-4xl mb-3">👻</div>
                                            Nenhum agendamento encontrado nesta aba.
                                        </td>
                                    </tr>
                                ) : (
                                    agendamentos.data.map((item) => (
                                        <LinhaAgendamento 
                                            key={item.id} 
                                            item={item} 
                                            funcionarios={funcionarios}
                                            atribuirFuncionario={atribuirFuncionario}
                                            atualizarStatus={atualizarStatus}
                                            formatarMoeda={formatarMoeda}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* --- PAGINAÇÃO NATIVA --- */}
                    {agendamentos?.links && agendamentos.data.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                            <div className="flex flex-wrap gap-1">
                                {agendamentos.links.map((link, key) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (link.url) router.visit(link.url, { preserveScroll: true, preserveState: true });
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