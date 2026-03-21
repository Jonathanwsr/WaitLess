import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import { 
    CurrencyDollarIcon, ClockIcon, CheckCircleIcon, 
    XMarkIcon, ExclamationTriangleIcon, MegaphoneIcon, 
    CreditCardIcon, ChevronDoubleRightIcon, ListBulletIcon, 
    BriefcaseIcon, BuildingStorefrontIcon, UserIcon,
    QueueListIcon, MagnifyingGlassIcon, XCircleIcon
} from '@heroicons/react/24/solid';

export default function FuncionarioDashboard({ auth, funcionarios, emAtendimento, proximo, filaEspera, historico, ganhosHoje, filtros, now }) {
    const { flash = {}, errors = {} } = usePage().props;

    // 👉 ESTADOS DE NAVEGAÇÃO (As suas subtelas!)
    const [abaAtiva, setAbaAtiva] = useState(funcionarios[0]?.id);
    const [subTela, setSubTela] = useState('operacao'); // 'operacao', 'fila_completa', 'historico'

    const [pinDigitado, setPinDigitado] = useState('');
    const [processandoPin, setProcessandoPin] = useState(false);
    const [periodo, setPeriodo] = useState(filtros?.periodo || 'hoje');
    
    const [horaAtual, setHoraAtual] = useState(new Date(now || new Date()));

    useEffect(() => {
        const timer = setInterval(() => setHoraAtual(new Date(horaAtual.getTime() + 60000)), 60000);
        return () => clearInterval(timer);
    }, [horaAtual]);

    // ==========================================
    // 🧠 LÓGICA DE FILTRAGEM POR ABA (LOCAL)
    // ==========================================
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
    // ⚡ AÇÕES DO SISTEMA
    // ==========================================
    const mudarPeriodo = (novoPeriodo) => {
        setPeriodo(novoPeriodo);
        router.get(route('funcionario.dashboard'), { periodo: novoPeriodo }, { preserveState: true, preserveScroll: true });
    };

    const alternarPausa = () => {
        router.post(route('funcionario.pausa', funcionarioAtual.id), {}, { preserveScroll: true });
    };

    const chamarProximo = (id) => {
        if (emAtendimento) return alert("Finalize o cliente atual (em qualquer loja) antes de chamar o próximo!");
        router.patch(route('funcionario.chamar', id), {}, { preserveScroll: true });
    };

    const pularCliente = (id) => {
        if(window.confirm('Isto colocará o cliente como ATRASADO e ele irá para o fim da fila. Continuar?')) {
            router.patch(route('funcionario.pular', id), {}, { preserveScroll: true });
        }
    };

    const cancelarAtendimento = (id, horaMarcada, dataMarcada, isPago) => {
        const dataAgendamento = dataMarcada.split('T')[0];
        const horaLimite = new Date(new Date(dataAgendamento + 'T' + horaMarcada).getTime() + 30 * 60000);
        
        if (horaAtual < horaLimite) {
            return alert(`Bloqueado: Só pode cancelar após 30 minutos de atraso (A partir das ${horaLimite.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}).`);
        }

        const msg = isPago 
            ? 'O cliente pagou no App. Cancelar agora vai gerar um ESTORNO AUTOMÁTICO. Confirmar?' 
            : 'Cancelar este atendimento por atraso do cliente?';
            
        if(window.confirm(msg)) router.patch(route('funcionario.cancelar', id), {}, { preserveScroll: true });
    };

    const confirmarComPin = (id) => {
        if (pinDigitado.length !== 4) return alert('O PIN deve ter 4 dígitos.');
        setProcessandoPin(true);
        router.post(route('lojista.agendamento.finalizarPin', id), { codigo_pin: pinDigitado }, {
            preserveScroll: true,
            onSuccess: () => { setPinDigitado(''); setProcessandoPin(false); },
            onError: () => setProcessandoPin(false)
        });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    const isHoraDoCliente = (horaAgendamento, dataAgendamento) => {
        if (!horaAgendamento || !dataAgendamento) return false;
        const dataAlvo = new Date(dataAgendamento.split('T')[0] + 'T' + horaAgendamento);
        return horaAtual >= dataAlvo;
    };

    // ==========================================
    // 🎨 COMPONENTES VISUAIS (STATUS E PAGAMENTO)
    // ==========================================
    const BadgeStatus = ({ status }) => {
        switch(status) {
            case 'confirmado': return <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-black uppercase"><UserIcon className="w-3 h-3"/> Na Cadeira</span>;
            case 'pendente': return <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black uppercase"><ClockIcon className="w-3 h-3"/> Aguardando</span>;
            case 'atrasado': return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase"><ExclamationTriangleIcon className="w-3 h-3"/> Atrasado</span>;
            case 'concluido': 
            case 'finalizado': return <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black uppercase"><CheckCircleIcon className="w-3 h-3"/> Concluído</span>;
            case 'cancelado': return <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded text-[10px] font-black uppercase"><XCircleIcon className="w-3 h-3"/> Cancelado</span>;
            default: return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-black uppercase">{status}</span>;
        }
    };

    const BadgePagamento = ({ status }) => {
        if (status === 'pago_online') return <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded text-[10px] font-black uppercase"><CheckCircleIcon className="w-3 h-3"/> Pago (App)</span>;
        if (status === 'estornado') return <span className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase"><XMarkIcon className="w-3 h-3"/> Estornado</span>;
        return <span className="flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded text-[10px] font-black uppercase"><CreditCardIcon className="w-3 h-3"/> Local / Pendente</span>;
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-black text-gray-800 dark:text-gray-200 tracking-tight">Painel de Operações</h2>}>
            <Head title="Meu Turno - WaitLess" />

            <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 pb-24 mt-6">
                
                {/* --- MENSAGENS E ALERTAS --- */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl shadow-sm flex items-center gap-3 animate-in fade-in">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                        <span className="font-bold text-sm">{flash.success}</span>
                    </div>
                )}
                {errors?.error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl shadow-sm flex items-center gap-3 animate-in shake">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
                        <span className="font-black text-sm">{errors.error}</span>
                    </div>
                )}
                {atendimentoPendenteNoutraLoja && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl shadow-sm flex items-center gap-3 animate-pulse">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 shrink-0" />
                        <span className="font-bold text-sm">Atenção: Você tem um atendimento em andamento na loja <b>{atendimentoPendenteNoutraLoja}</b>. Finalize-o antes de chamar clientes aqui.</span>
                    </div>
                )}

                {/* --- NAVEGAÇÃO DE ESTABELECIMENTOS --- */}
                {funcionarios.length > 1 && (
                    <div className="bg-white/60 backdrop-blur-xl p-2 rounded-3xl shadow-sm border border-white flex overflow-x-auto hide-scrollbar gap-2">
                        {funcionarios.map(func => (
                            <button
                                key={func.id} onClick={() => { setAbaAtiva(func.id); setSubTela('operacao'); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
                                    abaAtiva === func.id ? 'bg-gray-900 text-white shadow-md' : 'bg-transparent text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <BuildingStorefrontIcon className={`w-5 h-5 ${abaAtiva === func.id ? 'text-indigo-400' : 'text-gray-400'}`} />
                                {func.estabelecimento?.nome}
                            </button>
                        ))}
                    </div>
                )}

                {/* --- CABEÇALHO DO LOCAL ATIVO (PAUSA E RESUMO) --- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                        <button 
                            onClick={alternarPausa}
                            className={`w-full h-full p-5 rounded-3xl shadow-sm border-2 transition-all flex flex-col items-center justify-center gap-2 group ${
                                funcionarioAtual?.ativo ? 'bg-white border-gray-100 hover:border-indigo-200' : 'bg-amber-50 border-amber-400 text-amber-800 scale-95 opacity-90'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${funcionarioAtual?.ativo ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-200 text-amber-900'}`}>
                                {funcionarioAtual?.ativo ? <CheckCircleIcon className="w-6 h-6" /> : <span className="text-2xl">☕</span>}
                            </div>
                            <span className="font-black text-sm tracking-tight">{funcionarioAtual?.ativo ? 'Recebendo Clientes' : 'Em Pausa'}</span>
                        </button>
                    </div>

                    <div className="md:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <ListBulletIcon className="w-4 h-4 text-indigo-400"/> Fila Atual ({filaLocal.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(esperaPorServicoLocal).length === 0 ? (
                                <span className="text-sm font-bold text-gray-300">Ninguém na espera</span>
                            ) : (
                                Object.keys(esperaPorServicoLocal).map(servico => (
                                    <span key={servico} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                                        {esperaPorServicoLocal[servico]}x {servico}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 shadow-sm text-white flex flex-col justify-center relative overflow-hidden">
                        <CurrencyDollarIcon className="absolute -right-6 -bottom-6 w-32 h-32 opacity-20" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-100 mb-1 z-10">Comissões (Hoje)</span>
                        <span className="text-3xl font-black z-10 tracking-tighter">{formatarMoeda(ganhosHoje)}</span>
                    </div>
                </div>

                {/* --- MENU DAS SUB-TELAS (A MÁGICA ACONTECE AQUI) --- */}
                <div className="flex bg-gray-200/50 p-1.5 rounded-2xl overflow-x-auto hide-scrollbar gap-1 border border-gray-200 shadow-inner mt-8">
                    <button onClick={() => setSubTela('operacao')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${subTela === 'operacao' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
                        <MegaphoneIcon className="w-5 h-5" /> Atendimento (Kanban)
                    </button>
                    <button onClick={() => setSubTela('fila_completa')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${subTela === 'fila_completa' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
                        <QueueListIcon className="w-5 h-5" /> Visão da Fila Completa
                    </button>
                    <button onClick={() => setSubTela('historico')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${subTela === 'historico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
                        <BriefcaseIcon className="w-5 h-5" /> Histórico da Loja
                    </button>
                </div>

                {/* ========================================================= */}
                {/* 🪑 SUB-TELA 1: KANBAN DE OPERAÇÃO */}
                {/* ========================================================= */}
                {subTela === 'operacao' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* CADEIRA ATUAL */}
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 ml-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-sm"></div> Na Cadeira
                            </h3>
                            {emAtendimentoLocal ? (
                                <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-2xl shadow-gray-900/20 relative overflow-hidden flex-1 flex flex-col border border-gray-800">
                                    <div className="absolute top-0 right-0 p-4 opacity-5"><UserIcon className="w-40 h-40" /></div>
                                    <div className="relative z-10 flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <BadgeStatus status={emAtendimentoLocal.status} />
                                            <span className="text-sm font-black bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">{emAtendimentoLocal.hora_agendamento?.substring(0,5)}</span>
                                        </div>
                                        <h4 className="text-3xl font-black mb-1 tracking-tight truncate">{emAtendimentoLocal.usuario?.name}</h4>
                                        <p className="text-gray-400 font-bold mb-6">{emAtendimentoLocal.servico?.nome} • {formatarMoeda(emAtendimentoLocal.valor_final)}</p>
                                        <div className="bg-gray-800/80 rounded-2xl p-4 mb-6 backdrop-blur-sm border border-gray-700">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">Cobrança</p>
                                            <div className="flex items-center">
                                                {emAtendimentoLocal.status_pagamento === 'pago_online' ? (
                                                    <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-xl text-sm font-black w-full"><CheckCircleIcon className="w-5 h-5" /> Já Pago no App</span>
                                                ) : (
                                                    <span className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-2 rounded-xl text-sm font-black w-full"><CreditCardIcon className="w-5 h-5" /> Receber {formatarMoeda(emAtendimentoLocal.valor_final)} no Local</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-2xl p-5 relative z-10 mt-auto shadow-inner">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-3">Digite o PIN do Cliente para Concluir</p>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder="0000" maxLength={4} value={pinDigitado} onChange={e => setPinDigitado(e.target.value.replace(/\D/g, ''))}
                                                className="flex-1 text-center text-3xl tracking-[0.3em] font-black border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-900"
                                            />
                                            <button 
                                                onClick={() => confirmarComPin(emAtendimentoLocal.id)} disabled={processandoPin || pinDigitado.length !== 4}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 rounded-xl shadow-md transition-all disabled:opacity-40 disabled:scale-100 hover:scale-105"
                                            >
                                                {processandoPin ? '...' : 'OK'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 h-full min-h-[380px] shadow-sm">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><span className="text-4xl opacity-50">🪑</span></div>
                                    <h4 className="font-bold text-gray-400 text-xl">Cadeira Vazia</h4>
                                    <p className="text-sm text-gray-400 mt-2 max-w-[250px]">Chame o próximo cliente da fila de espera para iniciar.</p>
                                </div>
                            )}
                        </div>

                        {/* PRÓXIMO DA FILA */}
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-3 ml-2">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">Próximo da Fila</h3>
                                {proximoLocal && isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) && (
                                    <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider animate-pulse shadow-sm">Hora do Cliente!</span>
                                )}
                            </div>

                            {proximoLocal ? (
                                <div className={`bg-white rounded-3xl border-2 p-6 shadow-sm flex-1 flex flex-col transition-all ${isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) ? 'border-yellow-400 shadow-yellow-100' : 'border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center font-black text-indigo-700 text-2xl border border-indigo-50 shadow-sm">
                                            {proximoLocal.usuario?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-lg font-black text-gray-900 bg-gray-50 px-4 py-1.5 rounded-xl border border-gray-100">{proximoLocal.hora_agendamento?.substring(0, 5)}</span>
                                    </div>
                                    
                                    <h4 className="font-black text-gray-900 text-2xl truncate mb-1 tracking-tight">{proximoLocal.usuario?.name}</h4>
                                    <p className="text-gray-500 font-bold mb-4 flex items-center gap-2">{proximoLocal.servico?.nome} • <span className="text-indigo-600">{formatarMoeda(proximoLocal.valor_final)}</span></p>

                                    <div className="mb-6 flex gap-2">
                                        <BadgePagamento status={proximoLocal.status_pagamento} />
                                        <BadgeStatus status={proximoLocal.status} />
                                    </div>

                                    <div className="mt-auto pt-4 space-y-3">
                                        <button 
                                            onClick={() => chamarProximo(proximoLocal.id)} disabled={!!emAtendimento} 
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed group"
                                        >
                                            <MegaphoneIcon className="w-5 h-5 group-hover:scale-110 transition-transform" /> 
                                            {emAtendimento ? 'Finalize a cadeira atual' : 'Chamar para a Cadeira'}
                                        </button>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => pularCliente(proximoLocal.id)} className="py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl transition flex justify-center items-center gap-1.5 border border-amber-200">
                                                <ChevronDoubleRightIcon className="w-4 h-4"/> Pular (Atraso)
                                            </button>
                                            <button onClick={() => cancelarAtendimento(proximoLocal.id, proximoLocal.hora_agendamento, proximoLocal.data_agendamento, proximoLocal.status_pagamento === 'pago_online')} className="py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition flex justify-center items-center gap-1.5 border border-red-200">
                                                <XMarkIcon className="w-4 h-4"/> Cancelar (&gt;30m)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 h-full min-h-[380px] shadow-sm">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-gray-200 shadow-sm"><ClockIcon className="w-8 h-8 text-gray-300" /></div>
                                    <h4 className="font-bold text-gray-400 text-lg">Sem Próximo</h4>
                                    <p className="text-sm text-gray-400 mt-1">A fila de espera nesta loja acabou.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* 👥 SUB-TELA 2: VISÃO DA FILA COMPLETA */}
                {/* ========================================================= */}
                {subTela === 'fila_completa' && (
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <QueueListIcon className="w-6 h-6 text-indigo-600" /> Fila Completa de Espera
                            </h3>
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-100">
                                Total: {filaLocal.length}
                            </span>
                        </div>

                        {filaLocal.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                                <MagnifyingGlassIcon className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="font-bold text-lg">A fila está vazia no momento.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-indigo-100 ml-4 md:ml-8 space-y-8 pb-4">
                                {filaLocal.map((ag, index) => (
                                    <div key={ag.id} className="relative pl-8 md:pl-12 group">
                                        {/* Bolinha da Linha do Tempo */}
                                        <div className={`absolute -left-[17px] top-4 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center font-black text-[10px] shadow-sm transition-colors ${index === 0 ? 'bg-indigo-600 text-white w-10 h-10 -left-[21px] top-3' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                            {index + 1}º
                                        </div>
                                        
                                        <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${index === 0 ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center font-black text-gray-600 border border-gray-200">
                                                        {ag.usuario?.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-gray-900 text-lg tracking-tight">{ag.usuario?.name}</h4>
                                                        <p className="text-sm font-bold text-indigo-600">{ag.servico?.nome}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                                                    <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border border-gray-200">
                                                        <ClockIcon className="w-4 h-4"/> {ag.hora_agendamento?.substring(0,5)}
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
                {/* 📁 SUB-TELA 3: HISTÓRICO DA LOJA */}
                {/* ========================================================= */}
                {subTela === 'historico' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                                <BriefcaseIcon className="w-6 h-6 text-indigo-600" /> Histórico desta Loja
                            </h3>
                            <div className="flex bg-gray-100/80 p-1 rounded-xl shadow-inner border border-gray-200 overflow-x-auto hide-scrollbar">
                                {['hoje', 'mes', 'ano', 'todos'].map((opt) => (
                                    <button 
                                        key={opt} onClick={() => mudarPeriodo(opt)}
                                        className={`px-5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${periodo === opt ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {opt === 'hoje' ? 'Hoje' : opt === 'mes' ? 'Este Mês' : opt === 'ano' ? 'Este Ano' : 'Histórico Completo'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                            {historicoLocal.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                                    <BriefcaseIcon className="w-12 h-12 mb-3 text-gray-200" />
                                    <p className="font-bold">Nenhum atendimento registado neste período.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {historicoLocal.map(ag => (
                                        <div key={ag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border ${ag.status === 'concluido' || ag.status === 'finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ag.status === 'cancelado' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                    {ag.usuario?.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-base tracking-tight">{ag.usuario?.name || 'Cliente'}</p>
                                                    <p className="text-xs font-medium text-gray-500 mt-0.5">{new Date(ag.data_agendamento).toLocaleDateString('pt-BR')} às {ag.hora_agendamento?.substring(0,5)} • {ag.servico?.nome}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                                                <p className="font-black text-gray-900">{formatarMoeda(ag.valor_final)}</p>
                                                <BadgeStatus status={ag.status} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {historico?.links && historico.data.length > 0 && (
                            <div className="mt-8 flex justify-center gap-2 overflow-x-auto pb-4">
                                {historico.links.map((link, key) => (
                                    <button
                                        key={key} onClick={() => link.url && router.get(link.url, { periodo }, { preserveScroll: true, preserveState: true })}
                                        disabled={!link.url}
                                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${link.active ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'} ${!link.url && 'opacity-40 cursor-not-allowed'}`}
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