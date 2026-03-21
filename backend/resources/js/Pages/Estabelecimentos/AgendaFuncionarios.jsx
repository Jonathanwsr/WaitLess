import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { 
    CalendarIcon, UserIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon, 
    ArrowLeftIcon, UserGroupIcon, ArrowDownTrayIcon, XMarkIcon, DocumentTextIcon, 
    TableCellsIcon, ViewColumnsIcon, CurrencyDollarIcon, CreditCardIcon
} from '@heroicons/react/24/solid';

export default function AgendaFuncionarios({ auth, estabelecimento, funcionarios = [], semFuncionario = [], agendamentosPaginados, filtros, datasProcessadas }) {
    const { flash = {} } = usePage().props;

    // Estado para alternar entre Kanban e Relatório
    const [modoVisao, setModoVisao] = useState('kanban'); // 'kanban' ou 'relatorio'

    const dataHoje = new Date().toISOString().split('T')[0];

    const [params, setParams] = useState({
        periodo: filtros?.periodo || 'hoje',
        data_inicio: filtros?.data_inicio || dataHoje,
        data_fim: filtros?.data_fim || dataHoje,
        per_page: filtros?.per_page || '15',
    });

    const aplicarFiltros = (novosParams) => {
        setParams(novosParams);
        router.post(route('estabelecimentos.agenda-equipe', estabelecimento.id), novosParams, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
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
        if (!window.confirm(`Atribuir TODOS os ${semFuncionario?.length || 0} clientes em espera neste período para ${nome}?`)) return;
        
        // Usa a data processada se existir, senão usa a do filtro
        const dInicio = datasProcessadas?.inicio || params.data_inicio;
        const dFim = datasProcessadas?.fim || params.data_fim;

        router.post(route('estabelecimentos.atribuir-todos', estabelecimento.id), {
            funcionario_id: funcionarioId,
            data_inicio: dInicio,
            data_fim: dFim
        }, { preserveScroll: true, preserveState: true });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    // 👉 FUNÇÃO MÁGICA: GERAR RELATÓRIO PDF (Sem precisar de instalar nada!)
    const imprimirRelatorio = () => {
        const listaAgendamentos = agendamentosPaginados?.data || [];
        
        if (listaAgendamentos.length === 0) return alert('Não há dados para imprimir neste período.');

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
                            Total exibido: ${listaAgendamentos.length} registros (Pág ${agendamentosPaginados?.current_page || 1})
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
                            ${listaAgendamentos.map(ag => `
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

    // Componente interno para os Cartões do Kanban
    const CardAgendamento = ({ ag, tipo }) => {
        const isConcluido = ag.status === 'concluido' || ag.status === 'finalizado';
        const isAtendimento = ag.status === 'confirmado';

        return (
            <div className={`p-4 rounded-2xl border shadow-sm mb-4 relative overflow-hidden transition-all hover:shadow-md ${
                isConcluido ? 'bg-gray-50 border-emerald-200 opacity-80' : 
                isAtendimento ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'
            }`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                        <span className={`text-[11px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${
                            isConcluido ? 'bg-emerald-100 text-emerald-700' : 
                            isAtendimento ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-gray-100 text-gray-800'
                        }`}>
                            <ClockIcon className="w-3 h-3"/> {ag.hora_agendamento ? ag.hora_agendamento.substring(0, 5) : '--:--'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1 ml-1">
                            {ag.data_agendamento ? new Date(ag.data_agendamento).toLocaleDateString('pt-BR').substring(0,5) : ''}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {isConcluido ? 'Concluído' : isAtendimento ? 'Na Cadeira' : 'À Espera'}
                    </span>
                </div>

                <h4 className="font-bold text-gray-900 text-sm leading-tight mb-2 truncate">{ag.servico?.nome || 'Serviço'}</h4>
                
                {/* Detalhes: Preço e Pagamento */}
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <span className="text-indigo-600 font-black text-sm">{formatarMoeda(ag.valor_final || ag.servico?.valor)}</span>
                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded">
                        <CreditCardIcon className="w-3 h-3" />
                        {ag.status_pagamento === 'pago_online' ? 'Pago no App' : ag.status_pagamento === 'presencial' ? 'Pagar no Local' : 'Pendente'}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold">
                        {ag.usuario?.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-bold truncate">{ag.usuario?.name || 'Cliente'}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {tipo === 'unassigned' && (
                        <select 
                            className="w-full text-[11px] font-bold text-gray-600 bg-white border border-gray-200 rounded-lg py-1.5 focus:ring-indigo-500 shadow-sm"
                            onChange={(e) => atribuirFuncionario(ag.id, e.target.value)}
                            value=""
                        >
                            <option value="" disabled>➕ Atribuir a...</option>
                            {funcionarios?.map(f => (
                                <option key={f.id} value={f.id}>{f.nome.split(' ')[0]}</option>
                            ))}
                        </select>
                    )}
                    {tipo === 'assigned' && !isConcluido && (
                        <button 
                            onClick={() => atribuirFuncionario(ag.id, null)}
                            className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-red-500 hover:bg-red-50 hover:text-red-700 py-1.5 rounded-lg transition"
                        >
                            <XMarkIcon className="w-3 h-3" /> Remover Atribuição
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // Arrays de segurança para o map não quebrar
    const safeFuncionarios = funcionarios || [];
    const safeSemFuncionario = semFuncionario || [];
    const safeAgendamentosPaginados = agendamentosPaginados?.data || [];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href={route('estabelecimentos.fila', estabelecimento.id)} className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-full flex items-center justify-center text-gray-700 transition shadow-sm">
                            <ArrowLeftIcon className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                                <UserGroupIcon className="w-6 h-6 text-indigo-600" /> Visão Operacional
                            </h2>
                            <p className="text-sm font-medium text-gray-500 mt-0.5">Acompanhe e gira a sua equipa e os relatórios financeiros.</p>
                        </div>
                    </div>

                    {/* 👉 TOGGLE DE VISÃO: KANBAN VS RELATÓRIO */}
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                        <button 
                            onClick={() => setModoVisao('kanban')} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${modoVisao === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" /> Quadro Kanban
                        </button>
                        <button 
                            onClick={() => setModoVisao('relatorio')} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${modoVisao === 'relatorio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <TableCellsIcon className="w-4 h-4" /> Relatórios (Tabela)
                        </button>
                    </div>
                </div>
            }
        >
            <Head title={`Operações - ${estabelecimento.nome}`} />

            <div className="max-w-[1600px] mx-auto mt-6 px-4 pb-12">
                
                {flash?.success && (
                    <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in fade-in max-w-max">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                        <span className="font-bold">{flash.success}</span>
                    </div>
                )}

                {/* BARRA DE FILTROS GLOBAL */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end justify-between mb-8">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Período</label>
                            <select name="periodo" value={params.periodo} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-sm focus:ring-indigo-500 min-w-[140px]">
                                <option value="hoje">Apenas Hoje</option>
                                <option value="mes">Este Mês</option>
                                <option value="ano">Este Ano</option>
                                <option value="todos">Todo o Histórico</option>
                                <option value="custom">Datas Específicas...</option>
                            </select>
                        </div>
                        
                        {params.periodo === 'custom' && (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Inicial</label>
                                    <input type="date" name="data_inicio" value={params.data_inicio} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold shadow-sm focus:ring-indigo-500" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Final</label>
                                    <input type="date" name="data_fim" value={params.data_fim} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold shadow-sm focus:ring-indigo-500" />
                                </div>
                            </>
                        )}
                    </div>

                    {modoVisao === 'relatorio' && (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Resultados</label>
                                <select name="per_page" value={params.per_page} onChange={handleChange} className="border-gray-200 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 shadow-sm focus:ring-indigo-500">
                                    <option value="15">15 itens</option>
                                    <option value="50">50 itens</option>
                                    <option value="100">100 itens</option>
                                </select>
                            </div>
                            <button 
                                onClick={imprimirRelatorio}
                                disabled={safeAgendamentosPaginados.length === 0}
                                className="bg-gray-900 hover:bg-black text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <DocumentTextIcon className="w-5 h-5 text-gray-300" /> Baixar PDF
                            </button>
                        </div>
                    )}
                </div>

                {/* 1. VISÃO KANBAN */}
                {modoVisao === 'kanban' && (
                    <div className="flex gap-6 min-w-max pb-8 items-start overflow-x-auto animate-in fade-in">
                        {/* COLUNA 1: SEM ATRIBUIÇÃO */}
                        <div className="w-80 flex-shrink-0 flex flex-col bg-gray-100/80 rounded-3xl p-5 border border-gray-200 border-dashed h-max max-h-[75vh]">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" /> Sem Atribuição
                                </h3>
                                <span className="bg-white text-gray-800 border border-gray-200 px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm">{safeSemFuncionario.length}</span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto pr-1 pb-4">
                                {safeSemFuncionario.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <p className="text-xs font-bold uppercase tracking-wider mb-1">Tudo organizado!</p>
                                        <p className="text-xs">Nenhum cliente pendente neste período.</p>
                                    </div>
                                ) : (
                                    safeSemFuncionario.map(ag => <CardAgendamento key={ag.id} ag={ag} tipo="unassigned" />)
                                )}
                            </div>
                        </div>

                        {/* COLUNAS DOS FUNCIONÁRIOS */}
                        {safeFuncionarios.map((func) => (
                            <div key={func.id} className="w-80 flex-shrink-0 flex flex-col bg-white rounded-3xl p-5 border border-gray-100 shadow-sm h-max max-h-[75vh]">
                                <div className="flex flex-col mb-5 border-b border-gray-100 pb-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-black shadow-sm border border-indigo-50">
                                                {func.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-base">{func.nome.split(' ')[0]}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{func.cargo || 'Profissional'}</p>
                                            </div>
                                        </div>
                                        <span className="bg-gray-900 text-white px-2.5 py-1 rounded-full text-xs font-black shadow-sm">
                                            {func.agendamentos?.length || 0}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={() => puxarTodosParaFuncionario(func.id, func.nome.split(' ')[0])}
                                        disabled={safeSemFuncionario.length === 0}
                                        className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2.5 rounded-xl transition shadow-sm border border-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ArrowDownTrayIcon className="w-4 h-4" /> Puxar Fila ({safeSemFuncionario.length})
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 pb-4 min-h-[150px]">
                                    {!func.agendamentos || func.agendamentos.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400">
                                            <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                            <p className="text-xs">Agenda livre.</p>
                                        </div>
                                    ) : (
                                        func.agendamentos.map(ag => <CardAgendamento key={ag.id} ag={ag} tipo="assigned" />)
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. VISÃO RELATÓRIO (TABELA + PDF) */}
                {modoVisao === 'relatorio' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4">Data e Hora</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Serviço</th>
                                        <th className="px-6 py-4">Preço Base</th>
                                        <th className="px-6 py-4 text-center">Pagamento</th>
                                        <th className="px-6 py-4 text-center">Atendido Por</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {safeAgendamentosPaginados.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-20 text-center">
                                                <DocumentTextIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                                <p className="font-bold text-gray-500">Nenhum registo no período selecionado.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        safeAgendamentosPaginados.map(ag => (
                                            <tr key={ag.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <p className="font-bold text-gray-900">{new Date(ag.data_agendamento).toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-xs text-gray-400">{ag.hora_agendamento?.substring(0,5)}</p>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-800">{ag.usuario?.name || 'N/A'}</td>
                                                <td className="px-6 py-4">{ag.servico?.nome || 'N/A'}</td>
                                                <td className="px-6 py-4 font-black text-indigo-600">{formatarMoeda(ag.valor_final)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {ag.status_pagamento === 'pago_online' ? (
                                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs font-bold">No App</span>
                                                    ) : ag.status_pagamento === 'presencial' ? (
                                                        <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded text-xs font-bold">Local</span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs font-bold">Pendente</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center font-medium">
                                                    {ag.funcionario?.nome ? ag.funcionario.nome.split(' ')[0] : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${ag.status === 'concluido' || ag.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700' : ag.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
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
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
                                    Pág {agendamentosPaginados.current_page} de {agendamentosPaginados.last_page}
                                </span>
                                <div className="flex gap-1">
                                    {agendamentosPaginados.links.map((link, key) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (link.url) router.post(link.url, params, { preserveScroll: true, preserveState: true });
                                            }}
                                            disabled={!link.url}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                link.active ? 'bg-gray-900 text-white shadow' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                                            } ${!link.url && 'opacity-50 cursor-not-allowed'}`}
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