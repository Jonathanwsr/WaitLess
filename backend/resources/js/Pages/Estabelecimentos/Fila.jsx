import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { StarIcon, CalendarIcon, UserGroupIcon, FunnelIcon, AdjustmentsHorizontalIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

// ==============================================================================
// SUB-COMPONENTE: Linha da Tabela
// ==============================================================================
const LinhaAgendamento = ({ item, funcionarios, atribuirFuncionario, atualizarStatus, formatarMoeda }) => {
    const [pedindoPin, setPedindoPin] = useState(false);
    const [pinDigitado, setPinDigitado] = useState('');
    const [processandoPin, setProcessandoPin] = useState(false);

    const confirmarComPin = () => {
        if (pinDigitado.length !== 4) return alert('O código deve ter 4 números.');
        
        setProcessandoPin(true);
        
        router.post(route('lojista.agendamento.finalizarPin', item.id), { 
            codigo_pin: pinDigitado 
        }, {
            preserveScroll: true,
            onSuccess: () => { 
                setPedindoPin(false); 
                setPinDigitado(''); 
                setProcessandoPin(false);
            },
            onError: () => { 
                setPinDigitado(''); 
                setProcessandoPin(false);
            }
        });
    };

    return (
        <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
            
            {/* 1. DATA E HORA */}
            <td className="px-6 py-5 whitespace-nowrap">
                <div className="flex flex-col">
                    <span className="font-black text-gray-900 dark:text-white text-lg tracking-tight">
                        {item.hora_agendamento ? item.hora_agendamento.substring(0, 5) : '--:--'}
                    </span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                        {item.data_agendamento ? new Date(item.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                    </span>
                </div>
            </td>

            {/* 2. CLIENTE */}
            <td className="px-6 py-5 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black shadow-sm">
                        {item.usuario?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex flex-col">
                        <div className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            {item.usuario?.name || 'Cliente'}
                            {item.usuario?.plano_assinatura === 'plus' && (
                                <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest shadow-sm">VIP</span>
                            )}
                        </div>
                        <span className="text-xs text-gray-500 mt-0.5 font-medium">
                            {item.usuario?.telefone || 'S/ telefone'}
                        </span>
                    </div>
                </div>
            </td>

            {/* 3. SERVIÇO */}
            <td className="px-6 py-5 whitespace-nowrap">
                <div className="flex flex-col">
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate max-w-[180px]">
                        {item.servico?.nome || 'Serviço Excluído'}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 text-xs font-black mt-0.5">
                        {formatarMoeda(item.valor_final || item.servico?.valor || 0)}
                    </span>
                </div>
            </td>

            {/* 4. FUNCIONÁRIO (AGORA COM NOME E CARGO) */}
            <td className="px-6 py-5 text-center whitespace-nowrap">
                <select 
                    className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 hover:border-indigo-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-700 dark:text-gray-300 transition-colors py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    value={item.funcionario_id || ''}
                    onChange={(e) => atribuirFuncionario(item.id, e.target.value)}
                    disabled={item.status === 'finalizado'}
                >
                    <option value="">Atribuir Profissional...</option>
                    {funcionarios?.map(f => (
                        <option key={f.id} value={f.id}>
                            {f.nome.split(' ')[0]} {f.cargo ? `(${f.cargo})` : ''}
                        </option>
                    ))}
                </select>
            </td>

            {/* 5. PAGAMENTO */}
            <td className="px-6 py-5 text-center whitespace-nowrap">
                {item.status_pagamento === 'pago_online' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"></span> Pago no App
                    </span>
                ) : item.status_pagamento === 'presencial' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm"></span> Receber no Local
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Pendente
                    </span>
                )}
            </td>

            {/* 6. STATUS DO ATENDIMENTO */}
            <td className="px-6 py-5 text-center whitespace-nowrap">
                {item.status === 'pendente' && <span className="inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">Aguardando</span>}
                {item.status === 'confirmado' && <span className="inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 animate-pulse">Em Atendimento</span>}
                {(item.status === 'concluido' || item.status === 'finalizado') && <span className="inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">Finalizado</span>}
                {item.status === 'cancelado' && <span className="inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200/60">Cancelado</span>}
            </td>

            {/* 7. AÇÕES */}
            <td className="px-6 py-5 text-right whitespace-nowrap">
                {pedindoPin ? (
                    <div className="flex justify-end gap-2 items-center animate-in fade-in slide-in-from-right-2">
                        <input 
                            type="text" 
                            placeholder="PIN" 
                            className="w-24 px-3 py-2 text-center tracking-[0.3em] font-black border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm shadow-sm"
                            maxLength={4}
                            value={pinDigitado}
                            onChange={e => setPinDigitado(e.target.value.replace(/\D/g, ''))}
                            autoFocus
                        />
                        <button onClick={confirmarComPin} disabled={processandoPin} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50">
                            {processandoPin ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setPedindoPin(false)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition">
                            ✕
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-end gap-2 items-center">
                        {item.status === 'pendente' ? (
                            <>
                                <button onClick={() => atualizarStatus(item.id, 'confirmado')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition transform hover:-translate-y-0.5">
                                    Chamar
                                </button>
                                <button onClick={() => { if(window.confirm('Cancelar este agendamento?')) atualizarStatus(item.id, 'cancelado') }} className="px-3 py-2 bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-gray-400 text-sm font-bold rounded-xl transition">
                                    ✕
                                </button>
                            </>
                        ) : item.status === 'confirmado' ? (
                            <button onClick={() => setPedindoPin(true)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2 transform hover:-translate-y-0.5">
                                <CheckCircleIcon className="w-4 h-4" /> Finalizar c/ PIN
                            </button>
                        ) : (item.status === 'concluido' || item.status === 'finalizado') ? (
                            <span className="px-4 py-2 text-slate-400 text-sm font-bold rounded-xl flex items-center justify-end gap-1">
                                <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> Finalizado
                            </span>
                        ) : (
                            <span className="px-4 py-2 text-red-400 text-sm font-bold rounded-xl flex items-center justify-end gap-1">✕ Cancelado</span>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
};

// ==============================================================================
// COMPONENTE PRINCIPAL (FILA)
// ==============================================================================
export default function Fila({ auth, estabelecimento, agendamentos, filtros, funcionarios = [] }) {
    
    const { flash = {}, errors } = usePage().props;

    // Define 'Hoje' para o padrão inicial
    const dataHoje = new Date().toISOString().split('T')[0];

    const [params, setParams] = useState({
        data_inicio: filtros?.data_inicio || dataHoje,
        data_fim: filtros?.data_fim || dataHoje,
        ordem: filtros?.ordem || 'asc',
        status: filtros?.status || 'todos',
        status_pagamento: filtros?.status_pagamento || 'todos',
        per_page: filtros?.per_page || '10',
    });

    // Auto-refresh da fila (POST para esconder parâmetros)
    useEffect(() => {
        const interval = setInterval(() => {
            router.post(route('estabelecimentos.fila', estabelecimento.id), params, {
                preserveScroll: true,
                preserveState: true,
                replace: true, 
                only: ['agendamentos']
            });
        }, 30000); 
        return () => clearInterval(interval);
    }, [params, estabelecimento.id]);

    const aplicarFiltros = (novosParametros) => {
        setParams(novosParametros);
        
        router.post(route('estabelecimentos.fila', estabelecimento.id), novosParametros, {
            preserveState: true,
            preserveScroll: true,
            replace: true, 
            only: ['agendamentos', 'filtros']
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        aplicarFiltros({ ...params, [name]: value });
    };

    const definirParaHoje = () => {
        aplicarFiltros({ ...params, data_inicio: dataHoje, data_fim: dataHoje });
    };

    const atualizarStatus = (id, novoStatus) => {
        router.patch(route('agendamentos.update-status', id), { status: novoStatus }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const atribuirFuncionario = (agendamentoId, funcionarioId) => {
        router.patch(route('agendamentos.update-funcionario', agendamentoId), { funcionario_id: funcionarioId }, { 
            preserveScroll: true,
            preserveState: true,
        });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    const errorMsg = flash?.error || (Object.keys(errors).length > 0 ? Object.values(errors)[0] : null);

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            Fila de Atendimento
                        </h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">{estabelecimento.nome}</p>
                    </div>
                    <Link 
                        href={route('estabelecimentos.agenda-equipe', estabelecimento.id)} 
                        className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-gray-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                        <UserGroupIcon className="w-5 h-5 text-gray-300" /> Visão da Equipa (Kanban)
                    </Link>
                </div>
            }
        >
            <Head title={`Fila - ${estabelecimento.nome}`} />

            <div className="max-w-[1400px] mx-auto mt-6 space-y-6 pb-12 px-4 sm:px-6 lg:px-8">
                
                {/* AVISOS GLOBAIS */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <div className="bg-emerald-100 p-2 rounded-full shrink-0">
                            <StarIcon className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-base">Sucesso!</p>
                            <p className="text-sm font-medium opacity-90">{flash.success}</p>
                        </div>
                    </div>
                )}

                {errorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 font-bold animate-in fade-in slide-in-from-top-4">
                        <div className="bg-red-100 p-2 rounded-full shrink-0">❌</div>
                        {errorMsg}
                    </div>
                )}

                {/* --- BARRA DE FILTROS SUPERIOR (MODERNA) --- */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-end relative overflow-hidden">
                    
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50 pointer-events-none"></div>

                    {/* FILTROS DE DATA */}
                    <div className="flex flex-wrap items-end gap-4 w-full xl:w-auto">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5" /> Data Início
                            </label>
                            <input 
                                type="date" 
                                name="data_inicio"
                                value={params.data_inicio} 
                                onChange={handleChange}
                                className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5" /> Data Fim
                            </label>
                            <input 
                                type="date" 
                                name="data_fim"
                                value={params.data_fim} 
                                onChange={handleChange}
                                className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button 
                            type="button" 
                            onClick={definirParaHoje}
                            className="bg-white hover:bg-indigo-50 text-indigo-600 font-bold px-5 py-2.5 rounded-xl text-sm border border-indigo-100 shadow-sm transition-all h-[42px] mb-px"
                        >
                            Ver Apenas Hoje
                        </button>
                    </div>

                    {/* FILTROS DE STATUS E PAGAMENTO */}
                    <div className="flex flex-wrap items-end gap-4 w-full xl:w-auto bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2 w-full lg:hidden">
                            <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-400"/>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtros</span>
                        </div>

                        <div className="flex flex-col flex-1 sm:flex-none">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                            <select name="status" value={params.status} onChange={handleChange} className="border-gray-200 bg-white rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:w-[150px]">
                                <option value="todos">Todos</option>
                                <option value="pendente">Aguardando</option>
                                <option value="confirmado">Em Atendimento</option>
                                <option value="concluido">Finalizados</option>
                            </select>
                        </div>

                        <div className="flex flex-col flex-1 sm:flex-none">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Pagamento</label>
                            <select name="status_pagamento" value={params.status_pagamento} onChange={handleChange} className="border-gray-200 bg-white rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:w-[150px]">
                                <option value="todos">Todos</option>
                                <option value="pago_online">Online (App)</option>
                                <option value="presencial">No Local</option>
                            </select>
                        </div>

                        <div className="flex flex-col flex-1 sm:flex-none">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ordem</label>
                            <select name="ordem" value={params.ordem} onChange={handleChange} className="border-gray-200 bg-white rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:w-[160px]">
                                <option value="asc">Antigos Primeiro</option>
                                <option value="desc">Recentes Primeiro</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* --- TABELA / A FILA --- */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                            <thead className="bg-slate-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-widest border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-5">Data / Hora</th>
                                    <th className="px-6 py-5">Cliente</th>
                                    <th className="px-6 py-5">Serviço</th>
                                    <th className="px-6 py-5 text-center">Profissional Responsável</th>
                                    <th className="px-6 py-5 text-center">Forma de Pagamento</th>
                                    <th className="px-6 py-5 text-center">Status</th>
                                    <th className="px-6 py-5 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800">
                                {!agendamentos || !agendamentos.data || agendamentos.data.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-28 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                                    <FunnelIcon className="w-10 h-10 text-gray-300" />
                                                </div>
                                                <p className="font-black text-xl text-gray-800 mb-1">Nenhum resultado encontrado</p>
                                                <p className="text-sm text-gray-500">Tente ajustar as datas ou remover alguns filtros.</p>
                                            </div>
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
                    
                    {/* --- PAGINAÇÃO --- */}
                    {agendamentos?.links && agendamentos.data.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-5 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest hidden sm:block">
                                Mostrando pág {agendamentos.current_page} de {agendamentos.last_page}
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {agendamentos.links.map((link, key) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (link.url) router.post(link.url, params, { preserveScroll: true, preserveState: true });
                                        }}
                                        disabled={!link.url}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                                            link.active 
                                            ? 'bg-gray-900 text-white shadow-md' 
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
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