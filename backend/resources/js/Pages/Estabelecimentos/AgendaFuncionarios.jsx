import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import { 
    CalendarIcon, UserIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon, 
    ArrowLeftIcon, UserGroupIcon, ArrowDownTrayIcon, XMarkIcon, DocumentTextIcon, 
    TableCellsIcon, ViewColumnsIcon, CurrencyDollarIcon, CreditCardIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/solid';

export default function AgendaFuncionarios({ auth, estabelecimento, funcionarios = [], semFuncionario = [], agendamentosPaginados, filtros, datasProcessadas }) {
    const { flash = {} } = usePage().props;

    // Estado para alternar entre Mesa de Operação e Relatório
    const [modoVisao, setModoVisao] = useState('operacao'); 

    const dataHoje = new Date().toISOString().split('T')[0];

    const [params, setParams] = useState({
        periodo: filtros?.periodo || 'hoje',
        data_inicio: filtros?.data_inicio || dataHoje,
        data_fim: filtros?.data_fim || dataHoje,
        per_page: filtros?.per_page || '15',
    });

    // --- PROTEÇÃO DE ARRAYS ---
    const safeFuncionarios = funcionarios || [];
    const safeSemFuncionario = semFuncionario || [];
    const safeAgendamentosPaginados = agendamentosPaginados?.data || [];

    // 👉 AGRUPAMENTO DE FUNCIONÁRIOS POR LOJA
    const funcionariosPorLoja = useMemo(() => {
        return safeFuncionarios.reduce((acc, func) => {
            const lojaNome = func.estabelecimento?.nome || 'Outras Unidades';
            if (!acc[lojaNome]) acc[lojaNome] = [];
            acc[lojaNome].push(func);
            return acc;
        }, {});
    }, [safeFuncionarios]);

    // --- FUNÇÕES DE AÇÃO ---
    const aplicarFiltros = (novosParams) => {
        setParams(novosParams);
        router.post(route('estabelecimentos.agenda-equipe', estabelecimento.id), novosParams, {
            preserveState: true, preserveScroll: true, replace: true,
            only: ['funcionarios', 'semFuncionario', 'agendamentosPaginados', 'filtros', 'datasProcessadas']
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        aplicarFiltros({ ...params, [name]: value });
    };

    const atribuirFuncionario = (agendamentoId, funcionarioId) => {
        router.patch(route('agendamentos.update-funcionario', agendamentoId), { 
            funcionario_id: funcionarioId || null 
        }, { preserveScroll: true, preserveState: true });
    };

    const puxarTodosParaFuncionario = (funcionarioId, nome) => {
        if (!window.confirm(`Atribuir TODOS os ${safeSemFuncionario.length} clientes em espera neste período para ${nome}?`)) return;
        
        const dInicio = datasProcessadas?.inicio || params.data_inicio;
        const dFim = datasProcessadas?.fim || params.data_fim;

        router.post(route('estabelecimentos.atribuir-todos', estabelecimento.id), {
            funcionario_id: funcionarioId, data_inicio: dInicio, data_fim: dFim
        }, { preserveScroll: true, preserveState: true });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    // --- GERADOR DE RELATÓRIOS ---
    const imprimirRelatorio = () => {
        if (safeAgendamentosPaginados.length === 0) return alert('Não há dados para imprimir neste período.');

        const dataInic = datasProcessadas?.inicio || params.data_inicio;
        const dataFinal = datasProcessadas?.fim || params.data_fim;

        const printWindow = window.open('', '_blank');
        const conteudoHtml = `
            <html>
                <head>
                    <title>Relatório de Operações - ${estabelecimento.nome}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1f2937; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
                        h1 { color: #4f46e5; margin: 0 0 10px 0; font-size: 24px; }
                        .meta { color: #6b7280; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
                        th { background-color: #f3f4f6; color: #374151; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                        tr:nth-child(even) { background-color: #f9fafb; }
                        .footer { margin-top: 40px; font-size: 10px; text-align: center; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px;}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${estabelecimento.nome} - Relatório de Agendamentos</h1>
                        <div class="meta">
                            Período Filtrado: <strong>${params.periodo.toUpperCase()}</strong> <br/>
                            De ${new Date(dataInic).toLocaleDateString('pt-BR')} até ${new Date(dataFinal).toLocaleDateString('pt-BR')} <br/>
                            Total exibido: ${safeAgendamentosPaginados.length} registros (Pág ${agendamentosPaginados?.current_page || 1})
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Data e Hora</th>
                                <th>Cliente</th>
                                <th>Serviço</th>
                                <th>Valor</th>
                                <th>Pagamento</th>
                                <th>Profissional</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${safeAgendamentosPaginados.map(ag => `
                                <tr>
                                    <td><strong>${new Date(ag.data_agendamento).toLocaleDateString('pt-BR')}</strong> às ${ag.hora_agendamento?.substring(0,5) || '--:--'}</td>
                                    <td>${ag.usuario?.name || 'Cliente Excluído'}</td>
                                    <td>${ag.servico?.nome || 'N/A'}</td>
                                    <td><strong>${formatarMoeda(ag.valor_final)}</strong></td>
                                    <td>${ag.status_pagamento === 'pago_online' ? 'App' : ag.status_pagamento === 'presencial' ? 'Local' : 'Pendente'}</td>
                                    <td>${ag.funcionario?.nome || 'Sem profissional'}</td>
                                    <td>${ag.status.toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="footer">Gerado pelo sistema WaitLess em ${new Date().toLocaleString('pt-BR')}</div>
                </body>
            </html>
        `;
        printWindow.document.write(conteudoHtml);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500); 
    };

    // --- COMPONENTE DO CARTÃO DE AGENDAMENTO ---
    const CardAgendamento = ({ ag, tipo }) => {
        const isConcluido = ag.status === 'concluido' || ag.status === 'finalizado';
        const isAtendimento = ag.status === 'confirmado';

        return (
            <div className={`p-5 rounded-2xl border mb-4 relative overflow-hidden transition-all shadow-sm hover:shadow-md ${
                isConcluido ? 'bg-gray-50 border-emerald-200 opacity-80' : 
                isAtendimento ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'
            }`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 uppercase tracking-widest ${
                            isConcluido ? 'bg-emerald-100 text-emerald-700' : 
                            isAtendimento ? 'bg-indigo-600 text-white animate-pulse' : 'bg-gray-100 text-gray-800'
                        }`}>
                            <ClockIcon className="w-3 h-3"/> {ag.hora_agendamento ? ag.hora_agendamento.substring(0, 5) : '--:--'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1.5 ml-1">
                            {ag.data_agendamento ? new Date(ag.data_agendamento).toLocaleDateString('pt-BR') : ''}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {isConcluido ? 'Concluído' : isAtendimento ? 'Na Cadeira' : 'À Espera'}
                    </span>
                </div>

                <h4 className="font-black text-gray-900 text-base leading-tight mb-3 truncate">{ag.servico?.nome || 'Serviço Padrão'}</h4>
                
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                    <span className="text-indigo-600 font-black text-lg">{formatarMoeda(ag.valor_final || ag.servico?.valor)}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
                        <CreditCardIcon className="w-3 h-3 text-gray-400" />
                        {ag.status_pagamento === 'pago_online' ? 'Pago (App)' : ag.status_pagamento === 'presencial' ? 'Pagar (Local)' : 'Pendente'}
                    </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-700 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-black text-gray-500 shadow-inner">
                        {ag.usuario?.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-bold truncate">{ag.usuario?.name || 'Cliente não identificado'}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                    {tipo === 'unassigned' && (
                        <select 
                            className="w-full text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl py-2 focus:ring-indigo-500 transition-colors"
                            onChange={(e) => atribuirFuncionario(ag.id, e.target.value)}
                            value=""
                        >
                            <option value="" disabled>Atribuir a um profissional...</option>
                            {safeFuncionarios.map(f => (
                                <option key={f.id} value={f.id}>{f.nome.split(' ')[0]} ({f.estabelecimento?.nome})</option>
                            ))}
                        </select>
                    )}
                    {tipo === 'assigned' && !isConcluido && (
                        <button 
                            onClick={() => atribuirFuncionario(ag.id, null)}
                            className="w-full flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-red-500 hover:bg-red-50 hover:text-red-700 py-2 rounded-xl transition-colors border border-transparent hover:border-red-200"
                        >
                            <XMarkIcon className="w-4 h-4" /> Desvincular Profissional
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href={route('estabelecimentos.fila', estabelecimento.id)} className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl flex items-center justify-center text-gray-700 transition shadow-sm">
                            <ArrowLeftIcon className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                                <UserGroupIcon className="w-6 h-6 text-indigo-600" /> Operações da Equipe
                            </h2>
                            <p className="text-sm font-medium text-gray-500 mt-0.5">Gestão de fila, atribuições e relatórios financeiros.</p>
                        </div>
                    </div>

                    {/* 👉 TOGGLE DE VISÃO: OPERAÇÃO VS RELATÓRIO */}
                    <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-inner">
                        <button 
                            onClick={() => setModoVisao('operacao')} 
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${modoVisao === 'operacao' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ViewColumnsIcon className="w-5 h-5" /> Mesa de Operação
                        </button>
                        <button 
                            onClick={() => setModoVisao('relatorio')} 
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${modoVisao === 'relatorio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <TableCellsIcon className="w-5 h-5" /> Extrato Financeiro
                        </button>
                    </div>
                </div>
            }
        >
            <Head title={`Operações - ${estabelecimento.nome}`} />

            <div className="max-w-[1600px] mx-auto mt-6 px-4 pb-12 font-sans">
                
                {flash?.success && (
                    <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in fade-in max-w-max">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                        <span className="font-bold tracking-tight">{flash.success}</span>
                    </div>
                )}

                {/* --- BARRA DE FILTROS GLOBAL --- */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end justify-between mb-8">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Período de Análise</label>
                            <select name="periodo" value={params.periodo} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-inner focus:ring-indigo-500 min-w-[160px] py-2.5">
                                <option value="hoje">Apenas Hoje</option>
                                <option value="mes">Neste Mês</option>
                                <option value="ano">Neste Ano</option>
                                <option value="todos">Todo o Histórico</option>
                                <option value="custom">Período Específico...</option>
                            </select>
                        </div>
                        
                        {params.periodo === 'custom' && (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Inicial</label>
                                    <input type="date" name="data_inicio" value={params.data_inicio} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold shadow-inner focus:ring-indigo-500 py-2.5" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Final</label>
                                    <input type="date" name="data_fim" value={params.data_fim} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold shadow-inner focus:ring-indigo-500 py-2.5" />
                                </div>
                            </>
                        )}
                    </div>

                    {modoVisao === 'relatorio' && (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Resultados por Página</label>
                                <select name="per_page" value={params.per_page} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-inner focus:ring-indigo-500 py-2.5">
                                    <option value="15">15 Registos</option>
                                    <option value="50">50 Registos</option>
                                    <option value="100">100 Registos</option>
                                </select>
                            </div>
                            <button 
                                onClick={imprimirRelatorio}
                                disabled={safeAgendamentosPaginados.length === 0}
                                className="bg-gray-900 hover:bg-black text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 h-[46px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <DocumentTextIcon className="w-5 h-5 text-gray-300" /> Exportar PDF
                            </button>
                        </div>
                    )}
                </div>

                {/* ========================================== */}
                {/* 1. VISÃO: MESA DE OPERAÇÃO (COM DIVISÃO POR LOJAS) */}
                {/* ========================================== */}
                {modoVisao === 'operacao' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        
                        {/* NOVO: RESUMO GERAL DA EQUIPE ESCALADA */}
                        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm mb-8">
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <UserGroupIcon className="w-5 h-5 text-indigo-500" /> Equipe Escalada
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {Object.entries(funcionariosPorLoja).map(([loja, funcs]) => (
                                    <div key={`resumo-${loja}`} className="bg-gray-50 border border-gray-100 p-3 rounded-2xl">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <BuildingStorefrontIcon className="w-3 h-3" /> {loja}
                                        </p>
                                        <div className="flex -space-x-3 overflow-hidden">
                                            {funcs.map((f, i) => (
                                                <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs" title={f.nome}>
                                                    {f.nome.charAt(0)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ÁREA DAS COLUNAS */}
                        <div className="flex gap-8 min-w-max pb-8 items-start overflow-x-auto hide-scrollbar">
                            
                            {/* COLUNA 1: SEM ATRIBUIÇÃO (Fixa à esquerda) */}
                            <div className="w-80 flex-shrink-0 flex flex-col bg-amber-50/30 rounded-3xl p-5 border-2 border-amber-200 border-dashed h-max max-h-[75vh]">
                                <div className="flex items-center justify-between mb-5 bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm tracking-tight">
                                        <ExclamationCircleIcon className="w-5 h-5 text-amber-500" /> Pendentes
                                    </h3>
                                    <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest">{safeSemFuncionario.length}</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto pr-1 pb-4">
                                    {safeSemFuncionario.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400">
                                            <CheckCircleIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-wider mb-1">Tudo organizado!</p>
                                        </div>
                                    ) : (
                                        safeSemFuncionario.map(ag => <CardAgendamento key={ag.id} ag={ag} tipo="unassigned" />)
                                    )}
                                </div>
                            </div>

                            {/* AGRUPAMENTO VISUAL: COLUNAS DOS FUNCIONÁRIOS SEPARADAS POR LOJA */}
                            {Object.entries(funcionariosPorLoja).map(([loja, funcs]) => (
                                <div key={loja} className="flex gap-6 items-start">
                                    
                                    {/* Divisor Vertical Elegante para identificar a Loja */}
                                    <div className="flex-shrink-0 flex items-center justify-center w-12 bg-gray-900 rounded-full py-8 shadow-md">
                                        <span className="[writing-mode:vertical-rl] text-center font-black text-white tracking-[0.2em] uppercase text-xs rotate-180 flex items-center gap-2">
                                            {loja} <BuildingStorefrontIcon className="w-4 h-4 text-gray-400 rotate-90" />
                                        </span>
                                    </div>

                                    {/* Colunas dos Funcionários desta Loja */}
                                    {funcs.map((func) => (
                                        <div key={func.id} className="w-[340px] flex-shrink-0 flex flex-col bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow h-max max-h-[75vh]">
                                            <div className="flex flex-col mb-5 border-b border-gray-100 pb-4">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-indigo-700 font-black text-xl shadow-inner border border-indigo-50">
                                                            {func.nome.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-gray-900 text-lg tracking-tight leading-tight">{func.nome.split(' ')[0]}</h3>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{func.cargo || 'Profissional'}</p>
                                                        </div>
                                                    </div>
                                                    <span className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                        {func.agendamentos?.length || 0} Atend.
                                                    </span>
                                                </div>

                                                <button 
                                                    onClick={() => puxarTodosParaFuncionario(func.id, func.nome.split(' ')[0])}
                                                    disabled={safeSemFuncionario.length === 0}
                                                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-widest font-black py-3 rounded-xl transition shadow-sm border border-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <ArrowDownTrayIcon className="w-4 h-4" /> Puxar Fila ({safeSemFuncionario.length})
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto pr-1 pb-4 min-h-[150px]">
                                                {!func.agendamentos || func.agendamentos.length === 0 ? (
                                                    <div className="text-center py-10 text-gray-400">
                                                        <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                        <p className="text-xs font-bold uppercase tracking-widest">Estação Livre</p>
                                                    </div>
                                                ) : (
                                                    func.agendamentos.map(ag => <CardAgendamento key={ag.id} ag={ag} tipo="assigned" />)
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* 2. VISÃO RELATÓRIO (TABELA + PDF) */}
                {/* ========================================================= */}
                {modoVisao === 'relatorio' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-5">Data e Hora</th>
                                        <th className="px-6 py-5">Cliente</th>
                                        <th className="px-6 py-5">Serviço</th>
                                        <th className="px-6 py-5">Preço Base</th>
                                        <th className="px-6 py-5 text-center">Forma Pagto.</th>
                                        <th className="px-6 py-5 text-center">Atendido Por</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {safeAgendamentosPaginados.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-20 text-center">
                                                <DocumentTextIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                                <p className="font-bold text-gray-500 text-base">Nenhum registo de faturação.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        safeAgendamentosPaginados.map(ag => (
                                            <tr key={ag.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <p className="font-black text-gray-900">{new Date(ag.data_agendamento).toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-xs text-gray-500 font-bold">{ag.hora_agendamento?.substring(0,5)}</p>
                                                </td>
                                                <td className="px-6 py-5 font-black text-gray-800">{ag.usuario?.name || 'N/A'}</td>
                                                <td className="px-6 py-5 font-medium">{ag.servico?.nome || 'N/A'}</td>
                                                <td className="px-6 py-5 font-black text-indigo-600 text-lg">{formatarMoeda(ag.valor_final)}</td>
                                                <td className="px-6 py-5 text-center">
                                                    {ag.status_pagamento === 'pago_online' ? (
                                                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">No App</span>
                                                    ) : ag.status_pagamento === 'presencial' ? (
                                                        <span className="bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Local</span>
                                                    ) : (
                                                        <span className="bg-gray-100 border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Pendente</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-center font-bold text-gray-700">
                                                    {ag.funcionario?.nome ? ag.funcionario.nome.split(' ')[0] : '-'}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${ag.status === 'concluido' || ag.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ag.status === 'cancelado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                        {ag.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {agendamentosPaginados?.links && safeAgendamentosPaginados.length > 0 && (
                            <div className="bg-gray-50 px-6 py-5 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
                                    Pág {agendamentosPaginados.current_page} de {agendamentosPaginados.last_page}
                                </span>
                                <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                                    {agendamentosPaginados.links.map((link, key) => (
                                        <button
                                            key={key}
                                            onClick={() => { if (link.url) router.post(link.url, params, { preserveScroll: true, preserveState: true }); }}
                                            disabled={!link.url}
                                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                                                link.active ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                                            } ${!link.url && 'opacity-40 cursor-not-allowed'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}