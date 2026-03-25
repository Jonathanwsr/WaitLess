import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import { 
    CurrencyDollarIcon, ClockIcon, CheckCircleIcon, 
    XMarkIcon, ExclamationTriangleIcon, MegaphoneIcon, 
    CreditCardIcon, ChevronDoubleRightIcon, ListBulletIcon, 
    BriefcaseIcon, BuildingStorefrontIcon, UserIcon,
    QueueListIcon, MagnifyingGlassIcon, XCircleIcon,
    DocumentArrowDownIcon, PencilSquareIcon, ArrowPathIcon,
    PauseCircleIcon, PlayCircleIcon, SparklesIcon, CalendarDaysIcon
} from '@heroicons/react/24/solid';

export default function FuncionarioDashboard({ auth, funcionarios, emAtendimento, proximo, filaEspera, historico, ganhosHoje, filtros, now }) {
    const { flash = {}, errors = {} } = usePage().props;

    // ESTADOS DE NAVEGAÇÃO
    const [abaAtiva, setAbaAtiva] = useState(funcionarios[0]?.id);
    const [subTela, setSubTela] = useState('operacao'); 

    const [pinDigitado, setPinDigitado] = useState('');
    const [processandoPin, setProcessandoPin] = useState(false);
    const [periodo, setPeriodo] = useState(filtros?.periodo || 'hoje');
    
    const [horaAtual, setHoraAtual] = useState(new Date(now || new Date()));

    useEffect(() => {
        const timer = setInterval(() => setHoraAtual(new Date(horaAtual.getTime() + 60000)), 60000);
        return () => clearInterval(timer);
    }, [horaAtual]);

    // LÓGICA DE DADOS (MEMÓRIA BLINDADA NO FRONTEND)
    const funcionarioAtual = funcionarios.find(f => f.id === abaAtiva);
    const filaLocal = useMemo(() => filaEspera.filter(ag => ag.funcionario_id === abaAtiva), [filaEspera, abaAtiva]);
    const proximoLocal = filaLocal.length > 0 ? filaLocal[0] : null;
    const emAtendimentoLocal = emAtendimento?.funcionario_id === abaAtiva ? emAtendimento : null;

    const atendimentoPendenteNoutraLoja = emAtendimento && emAtendimento.funcionario_id !== abaAtiva 
        ? funcionarios.find(f => f.id === emAtendimento.funcionario_id)?.estabelecimento?.nome 
        : null;

    const esperaPorServicoLocal = useMemo(() => {
        return filaLocal.reduce((acc, ag) => {
            const nome = ag.servico?.nome || 'Outro';
            acc[nome] = (acc[nome] || 0) + 1;
            return acc;
        }, {});
    }, [filaLocal]);

    const historicoLocal = historico?.data?.filter(ag => ag.funcionario_id === abaAtiva) || [];

    // ==========================================
    // ⚡ AÇÕES SEGURAS (CHAMADAS AO BACKEND)
    // ==========================================
    const mudarPeriodo = (novoPeriodo) => {
        setPeriodo(novoPeriodo);
        router.get(route('funcionario.dashboard'), { periodo: novoPeriodo }, { preserveState: true, preserveScroll: true });
    };

    const alternarPausa = () => {
        router.post(route('funcionario.pausa', funcionarioAtual.id), {}, { preserveScroll: true });
    };

    const chamarProximo = (id) => {
        if (emAtendimento) return alert("Finalize o cliente atual antes de chamar o próximo.");
        router.patch(route('funcionario.chamar', id), {}, { preserveScroll: true });
    };

    const pularCliente = (id) => {
        if(window.confirm('Colocar cliente como ATRASADO e enviá-lo para o fim da fila?')) {
            router.patch(route('funcionario.pular', id), {}, { preserveScroll: true });
        }
    };

    const cancelarAtendimento = (id, horaMarcada, dataMarcada, isPago) => {
        const dataAgendamento = dataMarcada.split('T')[0];
        const horaLimite = new Date(new Date(dataAgendamento + 'T' + horaMarcada).getTime() + 30 * 60000);
        
        if (horaAtual < horaLimite) {
            return alert(`Bloqueado pelo Sistema: Cancelamento permitido apenas após 30 min de atraso (${horaLimite.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}).`);
        }

        const msg = isPago 
            ? 'O cliente pagou via App. O cancelamento irá processar o ESTORNO automático. Confirmar ação?' 
            : 'Confirmar cancelamento por atraso do cliente?';
            
        if(window.confirm(msg)) router.patch(route('funcionario.cancelar', id), {}, { preserveScroll: true });
    };

    const editarServico = (id) => {
        alert("Módulo de Edição: Aqui abrirá um modal para alterar o serviço, preço ou adicionar taxas extras antes de finalizar.");
    };

    const confirmarComPin = (id) => {
        if (pinDigitado.length !== 4) return alert('O PIN requer 4 dígitos.');
        setProcessandoPin(true);
        router.post(route('lojista.agendamento.finalizarPin', id), { codigo_pin: pinDigitado }, {
            preserveScroll: true,
            onSuccess: () => { setPinDigitado(''); setProcessandoPin(false); },
            onError: () => setProcessandoPin(false)
        });
    };

    // ==========================================
    // 📊 RELATÓRIOS (GERAÇÃO PDF NATIVA)
    // ==========================================
    const gerarRelatorioPDF = () => {
        if (historicoLocal.length === 0) return alert("Sem dados para exportar neste período.");
        
        const printWindow = window.open('', '_blank');
        const conteudo = `
            <html>
                <head>
                    <title>Relatório Operacional - ${funcionarioAtual.estabelecimento.nome}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; padding: 40px; }
                        h1 { color: #111827; font-size: 24px; margin-bottom: 5px; }
                        .meta { color: #6b7280; font-size: 12px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
                        th { background-color: #f9fafb; color: #374151; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                        .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
                        .bg-green { background: #dcfce7; color: #065f46; }
                        .bg-red { background: #fee2e2; color: #991b1b; }
                        .bg-gray { background: #f3f4f6; color: #374151; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Operações: ${funcionarioAtual.estabelecimento.nome}</h1>
                    <div class="meta">
                        Profissional: <b>${funcionarioAtual.nome}</b> | Período: <b>${periodo.toUpperCase()}</b><br/>
                        Total de Registros: ${historicoLocal.length} | Gerado em: ${new Date().toLocaleString('pt-BR')}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Cliente</th>
                                <th>Serviço</th>
                                <th>Valor</th>
                                <th>Pagamento</th>
                                <th>Status Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historicoLocal.map(ag => `
                                <tr>
                                    <td>${new Date(ag.data_agendamento).toLocaleDateString('pt-BR')} ${ag.hora_agendamento?.substring(0,5)}</td>
                                    <td>${ag.usuario?.name || 'N/A'}</td>
                                    <td>${ag.servico?.nome}</td>
                                    <td><strong>${formatarMoeda(ag.valor_final)}</strong></td>
                                    <td>${ag.status_pagamento === 'pago_online' ? 'App' : ag.status_pagamento === 'estornado' ? 'Estornado' : 'Local'}</td>
                                    <td><span class="badge ${['concluido','finalizado'].includes(ag.status) ? 'bg-green' : ag.status === 'cancelado' ? 'bg-red' : 'bg-gray'}">${ag.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        printWindow.document.write(conteudo);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    const isHoraDoCliente = (horaAgendamento, dataAgendamento) => {
        if (!horaAgendamento || !dataAgendamento) return false;
        const dataAlvo = new Date(dataAgendamento.split('T')[0] + 'T' + horaAgendamento);
        return horaAtual >= dataAlvo;
    };

    // ==========================================
    // 🎨 COMPONENTES VISUAIS (DESIGN SYSTEM)
    // ==========================================
    const BadgeStatus = ({ status }) => {
        switch(status) {
            case 'confirmado': return <span className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><UserIcon className="w-3 h-3"/> Na Cadeira</span>;
            case 'pendente': return <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ClockIcon className="w-3 h-3"/> Aguardando</span>;
            case 'atrasado': return <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ExclamationTriangleIcon className="w-3 h-3"/> Atrasado</span>;
            case 'concluido': 
            case 'finalizado': return <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CheckCircleIcon className="w-3 h-3"/> Concluído</span>;
            case 'cancelado': return <span className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><XCircleIcon className="w-3 h-3"/> Cancelado</span>;
            default: return <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">{status}</span>;
        }
    };

    const BadgePagamento = ({ status }) => {
        if (status === 'pago_online') return <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CheckCircleIcon className="w-3 h-3"/> Pago (App)</span>;
        if (status === 'estornado') return <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ArrowPathIcon className="w-3 h-3"/> Estornado</span>;
        return <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CreditCardIcon className="w-3 h-3"/> Local / Pendente</span>;
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black text-gray-900 tracking-tight">Painel Operacional</h2>}>
            <Head title="Operação - WaitLess" />

            <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-24 mt-6 font-sans">
                
                {/* --- MENSAGENS E ALERTAS --- */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in fade-in">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{flash.success}</span>
                    </div>
                )}
                {errors?.error && (
                    <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in shake">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{errors.error}</span>
                    </div>
                )}
                {atendimentoPendenteNoutraLoja && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-pulse">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">Atenção: Atendimento pendente na unidade <b>{atendimentoPendenteNoutraLoja}</b>. Finalize-o antes de operar aqui.</span>
                    </div>
                )}

                {/* --- NAVEGAÇÃO DE UNIDADES --- */}
                {funcionarios.length > 1 && (
                    <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex overflow-x-auto hide-scrollbar gap-2">
                        {funcionarios.map(func => (
                            <button
                                key={func.id} onClick={() => { setAbaAtiva(func.id); setSubTela('operacao'); }}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                                    abaAtiva === func.id ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <BuildingStorefrontIcon className={`w-5 h-5 ${abaAtiva === func.id ? 'text-gray-300' : 'text-gray-400'}`} />
                                {func.estabelecimento?.nome}
                            </button>
                        ))}
                    </div>
                )}

                {/* --- CABEÇALHO DO LOCAL ATIVO (PAUSA E RESUMO) --- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                        <button 
                            onClick={alternarPausa}
                            className={`w-full h-full p-6 rounded-2xl shadow-sm border transition-all flex flex-col items-center justify-center gap-3 group ${
                                funcionarioAtual?.ativo ? 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md' : 'bg-gray-900 border-gray-800 text-white scale-[0.98]'
                            }`}
                        >
                            {funcionarioAtual?.ativo ? (
                                <PlayCircleIcon className="w-10 h-10 text-emerald-500 group-hover:scale-110 transition-transform" />
                            ) : (
                                <PauseCircleIcon className="w-10 h-10 text-gray-400" />
                            )}
                            <span className="font-black text-sm tracking-widest uppercase">{funcionarioAtual?.ativo ? 'Turno Ativo' : 'Em Pausa'}</span>
                        </button>
                    </div>

                    <div className="md:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col justify-center">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <ListBulletIcon className="w-4 h-4 text-indigo-500"/> Fila Atual: {filaLocal.length} Aguardando
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(esperaPorServicoLocal).length === 0 ? (
                                <span className="text-sm font-bold text-gray-400">Ninguém na espera.</span>
                            ) : (
                                Object.keys(esperaPorServicoLocal).map(servico => (
                                    <span key={servico} className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-black tracking-tight shadow-sm">
                                        {esperaPorServicoLocal[servico]}x {servico}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-6 shadow-md text-white flex flex-col justify-center relative overflow-hidden">
                        <CurrencyDollarIcon className="absolute -right-4 -bottom-4 w-28 h-28 text-emerald-700/20" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-50 mb-1 z-10">Faturamento Hoje</span>
                        <span className="text-3xl font-black z-10 tracking-tighter text-white">{formatarMoeda(ganhosHoje)}</span>
                    </div>
                </div>

                {/* 👉 ACESSO RÁPIDO PARA AS OUTRAS TELAS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <Link href={route('funcionario.carteira')} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <CurrencyDollarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 leading-tight">Minha Produção</h4>
                            <p className="text-xs text-gray-500 font-bold mt-0.5">Metas e Fechamento</p>
                        </div>
                    </Link>

                    <Link href={route('funcionario.catalogo')} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 leading-tight">Catálogo</h4>
                            <p className="text-xs text-gray-500 font-bold mt-0.5">Serviços e Preços</p>
                        </div>
                    </Link>

                    <Link href={route('funcionario.ausencias')} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <CalendarDaysIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 leading-tight">Ausências</h4>
                            <p className="text-xs text-gray-500 font-bold mt-0.5">Gerir Faltas e Folgas</p>
                        </div>
                    </Link>
                </div>

                {/* --- MENU DAS SUB-TELAS INTERNAS --- */}
                <div className="flex bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto hide-scrollbar gap-1 mt-8">
                    <button onClick={() => setSubTela('operacao')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'operacao' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <MegaphoneIcon className="w-5 h-5" /> Mesa de Operação
                    </button>
                    <button onClick={() => setSubTela('fila_completa')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'fila_completa' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <QueueListIcon className="w-5 h-5" /> Monitor de Fila
                    </button>
                    <button onClick={() => setSubTela('historico')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'historico' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <BriefcaseIcon className="w-5 h-5" /> Relatórios e Extrato
                    </button>
                </div>

                {/* ========================================================= */}
                {/* 🪑 SUB-TELA 1: MESA DE OPERAÇÃO (CAIXA / CADEIRA) */}
                {/* ========================================================= */}
                {subTela === 'operacao' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        
                        {/* CADEIRA ATUAL */}
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm"></div> Estação Principal
                            </h3>
                            
                            {emAtendimentoLocal ? (
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xl relative overflow-hidden flex-1 flex flex-col">
                                    <div className="absolute top-0 right-0 p-6 opacity-5"><UserIcon className="w-32 h-32" /></div>
                                    
                                    <div className="relative z-10 flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <BadgeStatus status={emAtendimentoLocal.status} />
                                            <span className="text-xs font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200">
                                                Início: {emAtendimentoLocal.hora_agendamento?.substring(0,5)}
                                            </span>
                                        </div>
                                        
                                        <h4 className="text-2xl font-black mb-1 tracking-tight text-gray-900 truncate">{emAtendimentoLocal.usuario?.name}</h4>
                                        <p className="text-gray-500 font-bold mb-6 text-sm">{emAtendimentoLocal.servico?.nome} • {formatarMoeda(emAtendimentoLocal.valor_final)}</p>

                                        {/* Detalhes do Pagamento */}
                                        <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-200">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-black">Cobrança e Valores</p>
                                            <div className="flex items-center">
                                                {emAtendimentoLocal.status_pagamento === 'pago_online' ? (
                                                    <span className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2.5 rounded-xl text-sm font-black w-full border border-emerald-200 shadow-sm">
                                                        <CheckCircleIcon className="w-5 h-5" /> Liquidado via App
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-black w-full border border-amber-200 shadow-sm">
                                                        <CreditCardIcon className="w-5 h-5" /> Cobrar {formatarMoeda(emAtendimentoLocal.valor_final)} no Balcão
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Finalização por PIN */}
                                    <div className="bg-gray-900 rounded-2xl p-5 relative z-10 mt-auto">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-3">Validação do Cliente (PIN)</p>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder="0000" maxLength={4}
                                                value={pinDigitado} onChange={e => setPinDigitado(e.target.value.replace(/\D/g, ''))}
                                                className="flex-1 text-center text-3xl tracking-[0.4em] font-black border-gray-700 bg-gray-800 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 shadow-inner"
                                            />
                                            <button 
                                                onClick={() => confirmarComPin(emAtendimentoLocal.id)} 
                                                disabled={processandoPin || pinDigitado.length !== 4}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 rounded-xl shadow-md transition-all disabled:opacity-40"
                                            >
                                                {processandoPin ? '...' : 'FINALIZAR'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 h-full min-h-[400px]">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-200">
                                        <UserIcon className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h4 className="font-bold text-gray-500 text-lg tracking-tight">Estação Livre</h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-[250px]">O seu posto está vazio. Chame o próximo cliente para iniciar.</p>
                                </div>
                            )}
                        </div>

                        {/* PRÓXIMO DA FILA */}
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">Próximo Chamado</h3>
                                {proximoLocal && isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) && (
                                    <span className="bg-red-100 text-red-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider animate-pulse border border-red-200 shadow-sm">Atraso / Chegou a Hora</span>
                                )}
                            </div>

                            {proximoLocal ? (
                                <div className={`bg-white rounded-3xl border p-6 shadow-xl flex-1 flex flex-col transition-all ${isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) ? 'border-red-300 shadow-red-50' : 'border-gray-200'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-700 text-xl border border-gray-200 shadow-sm">
                                            {proximoLocal.usuario?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-base font-black text-gray-800 bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg shadow-sm">
                                            {proximoLocal.hora_agendamento?.substring(0, 5)}
                                        </span>
                                    </div>
                                    
                                    <h4 className="font-black text-gray-900 text-xl truncate mb-1 tracking-tight">{proximoLocal.usuario?.name}</h4>
                                    <p className="text-gray-600 font-bold mb-4 text-sm flex items-center gap-2">
                                        {proximoLocal.servico?.nome} • <span className="text-gray-900">{formatarMoeda(proximoLocal.valor_final)}</span>
                                    </p>

                                    <div className="mb-6 flex flex-wrap gap-2">
                                        <BadgePagamento status={proximoLocal.status_pagamento} />
                                        <BadgeStatus status={proximoLocal.status} />
                                    </div>

                                    {/* AÇÕES */}
                                    <div className="mt-auto pt-4 space-y-3">
                                        <button 
                                            onClick={() => chamarProximo(proximoLocal.id)} disabled={!!emAtendimento} 
                                            className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
                                        >
                                            <MegaphoneIcon className="w-5 h-5" /> {emAtendimento ? 'Posto Ocupado' : 'Iniciar Atendimento'}
                                        </button>

                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={() => editarServico(proximoLocal.id)} className="py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-gray-200 transition flex flex-col justify-center items-center gap-1 shadow-sm">
                                                <PencilSquareIcon className="w-4 h-4"/> Editar
                                            </button>
                                            <button onClick={() => pularCliente(proximoLocal.id)} className="py-2.5 bg-white hover:bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-gray-200 hover:border-amber-200 transition flex flex-col justify-center items-center gap-1 shadow-sm">
                                                <ChevronDoubleRightIcon className="w-4 h-4"/> Pular
                                            </button>
                                            <button onClick={() => cancelarAtendimento(proximoLocal.id, proximoLocal.hora_agendamento, proximoLocal.data_agendamento, proximoLocal.status_pagamento === 'pago_online')} className="py-2.5 bg-white hover:bg-red-50 text-red-600 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-gray-200 hover:border-red-200 transition flex flex-col justify-center items-center gap-1 shadow-sm">
                                                <XMarkIcon className="w-4 h-4"/> Estornar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 border border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 h-full min-h-[380px] shadow-sm">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-gray-200"><QueueListIcon className="w-8 h-8 text-gray-300" /></div>
                                    <h4 className="font-bold text-gray-400 text-lg tracking-tight">Fila Limpa</h4>
                                    <p className="text-sm text-gray-400 mt-1">Não há clientes a aguardar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* 👥 SUB-TELA 2: MONITOR DE FILA COMPLETA */}
                {/* ========================================================= */}
                {subTela === 'fila_completa' && (
                    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Monitor de Fila</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Ordem rigorosa de chegada e agendamento.</p>
                            </div>
                            <span className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-sm font-black border border-gray-200 shadow-sm">
                                Total: {filaLocal.length}
                            </span>
                        </div>

                        {filaLocal.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <MagnifyingGlassIcon className="w-12 h-12 mb-4 text-gray-200" />
                                <p className="font-bold text-lg">A fila está vazia no momento.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-gray-100 ml-4 md:ml-8 space-y-8 pb-4">
                                {filaLocal.map((ag, index) => (
                                    <div key={ag.id} className="relative pl-8 md:pl-12 group">
                                        <div className={`absolute -left-[17px] top-4 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center font-black text-[10px] shadow-sm transition-colors ${index === 0 ? 'bg-indigo-600 text-white w-10 h-10 -left-[21px] top-3 shadow-indigo-200' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                                            {index + 1}º
                                        </div>
                                        
                                        <div className={`bg-white border rounded-2xl p-5 transition-all ${index === 0 ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-gray-200 shadow-sm hover:border-gray-300'}`}>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center font-black text-gray-600 border border-gray-200">
                                                        {ag.usuario?.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-gray-900 text-lg tracking-tight">{ag.usuario?.name}</h4>
                                                        <p className="text-sm font-bold text-gray-500">{ag.servico?.nome}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                                                    <span className="bg-gray-50 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border border-gray-200">
                                                        <ClockIcon className="w-4 h-4 text-gray-400"/> {ag.hora_agendamento?.substring(0,5)}
                                                    </span>
                                                    <BadgeStatus status={ag.status} />
                                                    <BadgePagamento status={ag.status_pagamento} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================= */}
                {/* 📁 SUB-TELA 3: RELATÓRIOS E EXTRATOS */}
                {/* ========================================================= */}
                {subTela === 'historico' && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        
                        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Extrato e Relatórios</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Visualize ou exporte os dados da operação.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                    {['hoje', 'mes', 'ano', 'todos'].map((opt) => (
                                        <button 
                                            key={opt} onClick={() => mudarPeriodo(opt)}
                                            className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${periodo === opt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                        >
                                            {opt === 'hoje' ? 'Hoje' : opt === 'mes' ? 'Mês' : opt === 'ano' ? 'Ano' : 'Tudo'}
                                        </button>
                                    ))}
                                </div>
                                
                                <button onClick={gerarRelatorioPDF} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-colors">
                                    <DocumentArrowDownIcon className="w-4 h-4" /> Baixar PDF
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                            {historicoLocal.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <BriefcaseIcon className="w-12 h-12 mb-3 text-gray-200" />
                                    <p className="font-bold text-lg">Nenhum registo financeiro/operacional encontrado.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {historicoLocal.map(ag => (
                                        <div key={ag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border ${ag.status === 'concluido' || ag.status === 'finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ag.status === 'cancelado' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                    {ag.usuario?.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-base tracking-tight">{ag.usuario?.name || 'Cliente'}</p>
                                                    <p className="text-xs font-medium text-gray-500 mt-0.5">{new Date(ag.data_agendamento).toLocaleDateString('pt-BR')} • {ag.hora_agendamento?.substring(0,5)} • {ag.servico?.nome}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                                                <p className="font-black text-gray-900 text-lg">{formatarMoeda(ag.valor_final)}</p>
                                                <div className="flex items-center gap-2">
                                                    <BadgePagamento status={ag.status_pagamento} />
                                                    <BadgeStatus status={ag.status} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {historico?.links && historico.data.length > 0 && (
                            <div className="mt-6 flex justify-center gap-1 overflow-x-auto pb-4">
                                {historico.links.map((link, key) => (
                                    <button
                                        key={key} onClick={() => link.url && router.get(link.url, { periodo }, { preserveScroll: true, preserveState: true })}
                                        disabled={!link.url}
                                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${link.active ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'} ${!link.url && 'opacity-40 cursor-not-allowed'}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}