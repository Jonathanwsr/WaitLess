import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import { 
    CurrencyDollarIcon, ClockIcon, CheckCircleIcon, 
    XMarkIcon, ExclamationTriangleIcon, MegaphoneIcon, 
    CreditCardIcon, ChevronDoubleRightIcon, ListBulletIcon, 
    BriefcaseIcon, BuildingStorefrontIcon, UserIcon,
    QueueListIcon, MagnifyingGlassIcon, XCircleIcon,
    DocumentArrowDownIcon, PencilSquareIcon, ArrowPathIcon,
    PauseCircleIcon, PlayCircleIcon, SparklesIcon, CalendarDaysIcon,
    ExclamationCircleIcon, UserGroupIcon
} from '@heroicons/react/24/solid';

export default function FuncionarioDashboard({ auth, funcionarios, emAtendimento, proximo, filaEspera, historico, ganhosHoje, filtros, now }) {
    const { flash = {}, errors = {} } = usePage().props;

    // ESTADOS DE NAVEGAÇÃO E OPERAÇÃO
    const [abaAtiva, setAbaAtiva] = useState(funcionarios && funcionarios.length > 0 ? funcionarios[0].id : null);
    const [subTela, setSubTela] = useState('operacao'); 

    const [pinDigitado, setPinDigitado] = useState('');
    const [processandoPin, setProcessandoPin] = useState(false);
    const [periodo, setPeriodo] = useState(filtros?.periodo || 'hoje');
    
    const [horaAtual, setHoraAtual] = useState(new Date(now || new Date()));

    useEffect(() => {
        const timer = setInterval(() => setHoraAtual(new Date(horaAtual.getTime() + 60000)), 60000);
        return () => clearInterval(timer);
    }, [horaAtual]);

    // PROTEÇÃO DE ACESSO INICIAL
    if (!funcionarios || funcionarios.length === 0) {
        return (
            <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black">Mesa de Operação</h2>}>
                <div className="p-8 text-center text-gray-500 font-bold">Nenhum estabelecimento ou perfil profissional associado à sua conta.</div>
            </AuthenticatedLayout>
        );
    }

    // EXTRAÇÃO E FILTRAGEM BLINDADA DE DADOS POR ABA DE PROFISSIONAL
    const funcionarioAtual = funcionarios.find(f => f.id === abaAtiva) || funcionarios[0];
    const safeFilaEspera = filaEspera || [];
    const filaLocal = useMemo(() => safeFilaEspera.filter(ag => ag.funcionario_id === abaAtiva), [safeFilaEspera, abaAtiva]);
    const proximoLocal = filaLocal.length > 0 ? filaLocal[0] : null;
    const emAtendimentoLocal = emAtendimento?.funcionario_id === abaAtiva ? emAtendimento : null;

    // Identificação de papel do usuário conectado
    const papelUsuario = auth?.user?.papel?.toLowerCase() || auth?.user?.role?.toLowerCase() || '';
    const temPoderDeCaixa = useMemo(() => {
        if (['admin', 'proprietario', 'socio', 'gerente'].includes(papelUsuario)) return true;
        return funcionarioAtual?.usuario_id === auth?.user?.id;
    }, [papelUsuario, funcionarioAtual, auth]);

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

    const historicoLocal = historico?.data || [];

    // ==========================================
    // ⚡ AÇÕES CONECTADAS AO BACKEND (ASAAS / DB)
    // ==========================================
    const mudarPeriodo = (novoPeriodo) => {
        setPeriodo(novoPeriodo);
        router.get(route('funcionario.dashboard'), { periodo: novoPeriodo }, { preserveState: true, preserveScroll: true });
    };

    const alternarPausa = () => {
        router.post(route('funcionario.pausa', funcionarioAtual.id), {}, { preserveScroll: true });
    };

    const handleChamarProximo = (id) => {
        if (emAtendimento) return alert("Finalize o atendimento atual na cadeira antes de chamar o próximo cliente.");
        router.patch(route('funcionario.chamar', id), {}, { preserveScroll: true });
    };

    const pularCliente = (id) => {
        if(window.confirm('Colocar este cliente como ATRASADO e enviá-lo para o fim da fila de prioridade?')) {
            router.patch(route('funcionario.pular', id), {}, { preserveScroll: true });
        }
    };

    const cancelarAtendimento = (id, horaMarcada, dataMarcada, isPago) => {
        const dataAgendamento = dataMarcada.split('T')[0];
        const horaLimite = new Date(new Date(dataAgendamento + 'T' + horaMarcada).getTime() + 30 * 60000);
        
        // Admins e Proprietários possuem passe livre para estornos emergenciais
        const canBypassTime = ['admin', 'proprietario'].includes(papelUsuario);

        if (!canBypassTime && horaAtual < horaLimite) {
            return alert(`Bloqueado pelo Sistema: Cancelamento por ausência permitido apenas após 30 min de atraso (${horaLimite.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}).`);
        }

        const msg = isPago 
            ? 'Atenção: O cliente realizou o pagamento online. Esta ação executará o ESTORNO definitivo no gateway Asaas e deduzirá o saldo. Confirmar transação?' 
            : 'Confirmar cancelamento deste agendamento no banco de dados?';
            
        if(window.confirm(msg)) {
            router.delete(route('funcionario.cancelar', id), { preserveScroll: true });
        }
    };

    const confirmarComPin = (id) => {
        if (pinDigitado.length !== 4) return alert('O código de verificação PIN requer exatamente 4 dígitos.');
        
        setProcessandoPin(true);
        router.post(route('funcionario.finalizar', id), { codigo_pin: pinDigitado }, {
            preserveScroll: true,
            onSuccess: () => { 
                setPinDigitado(''); 
            },
            onFinish: () => {
                setProcessandoPin(false);
            }
        });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    const isHoraDoCliente = (horaAgendamento, dataAgendamento) => {
        if (!horaAgendamento || !dataAgendamento) return false;
        const dataAlvo = new Date(dataAgendamento.split('T')[0] + 'T' + horaAgendamento);
        return horaAtual >= dataAlvo;
    };

    // ==========================================
    // 🎨 BADGES DO DESIGN SYSTEM
    // ==========================================
    const BadgeStatus = ({ status }) => {
        switch(status) {
            case 'confirmado': return <span className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><UserIcon className="w-3 h-3"/> Na Cadeira</span>;
            case 'pendente': return <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ClockIcon className="w-3 h-3"/> Aguardando</span>;
            case 'atrasado': return <span className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ExclamationTriangleIcon className="w-3 h-3"/> Atrasado</span>;
            case 'concluido': 
            case 'finalizado': return <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CheckCircleIcon className="w-3 h-3"/> Concluído</span>;
            case 'cancelado': return <span className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><XCircleIcon className="w-3 h-3"/> Cancelado</span>;
            default: return <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">{status}</span>;
        }
    };

    const BadgePagamento = ({ status }) => {
        if (status === 'pago_online' || status === 'pago') return <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CheckCircleIcon className="w-3 h-3"/> Asaas (Custódia)</span>;
        if (status === 'estornado') return <span className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><ArrowPathIcon className="w-3 h-3"/> Estornado</span>;
        return <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider"><CreditCardIcon className="w-3 h-3"/> Balcão</span>;
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black text-gray-900 tracking-tight">Mesa Operational Contábil</h2>}>
            <Head title="Painel de Operações - WaitLess" />

            <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-24 mt-6 font-sans">
                
                {/* NOTIFICAÇÕES E ALERTAS DE TRANSAÇÃO */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-fadeIn">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{flash.success}</span>
                    </div>
                )}
                {errors?.error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-bounce">
                        <ExclamationTriangleIcon className="w-6 h-6 text-rose-600 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{errors.error}</span>
                    </div>
                )}
                {atendimentoPendenteNoutraLoja && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-pulse">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">Bloqueio Provisório: Você possui atendimento em andamento na unidade <b>{atendimentoPendenteNoutraLoja}</b>.</span>
                    </div>
                )}

                {/* FILTRO DE ABAS PARA MULTI-UNIDADES */}
                {funcionarios.length > 1 && (
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto hide-scrollbar gap-2">
                        {funcionarios.map(func => (
                            <button
                                key={func.id} onClick={() => { setAbaAtiva(func.id); setSubTela('operacao'); }}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                                    abaAtiva === func.id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 font-medium'
                                }`}
                            >
                                <BuildingStorefrontIcon className="w-5 h-5 opacity-70" />
                                {func.estabelecimento?.nome} ({func.nome})
                            </button>
                        ))}
                    </div>
                )}

                {/* RESUMO DAS MÉTRICAS DO DIA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-3">
                        <button 
                            onClick={alternarPausa}
                            disabled={!temPoderDeCaixa}
                            className={`w-full h-full p-6 rounded-2xl shadow-sm border transition-all flex flex-col items-center justify-center gap-3 group ${
                                funcionarioAtual?.ativo ? 'bg-white border-gray-200 hover:border-indigo-300' : 'bg-gray-900 border-gray-800 text-white'
                            } disabled:opacity-40`}
                        >
                            {funcionarioAtual?.ativo ? (
                                <PlayCircleIcon className="w-10 h-10 text-emerald-500 group-hover:scale-110 transition-transform" />
                            ) : (
                                <PauseCircleIcon className="w-10 h-10 text-gray-400" />
                            )}
                            <span className="font-black text-sm tracking-widest uppercase">{funcionarioAtual?.ativo ? 'Turno Ativo' : 'Em Pausa'}</span>
                        </button>
                    </div>

                    <div className="lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <ListBulletIcon className="w-4 h-4 text-indigo-500"/> Divisão de Serviços na Fila ({filaLocal.length} na espera)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(esperaPorServicoLocal).length === 0 ? (
                                <span className="text-sm font-bold text-gray-400">Nenhum cliente agendado para hoje.</span>
                            ) : (
                                Object.keys(esperaPorServicoLocal).map(servico => (
                                    <span key={servico} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs">
                                        {esperaPorServicoLocal[servico]}x {servico}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-md text-white flex flex-col justify-center relative overflow-hidden">
                        <CurrencyDollarIcon className="absolute -right-4 -bottom-4 w-28 h-28 text-emerald-700/20" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-50 mb-1 z-10">Produção Local Hoje</span>
                        <span className="text-3xl font-black z-10 tracking-tighter text-white">{formatarMoeda(ganhosHoje)}</span>
                    </div>
                </div>

                {/* BOTÕES DE ACESSO RÁPIDO PARCEIROS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link href={route('funcionario.carteira')} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xs transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform"><CurrencyDollarIcon className="w-6 h-6" /></div>
                        <div>
                            <h4 className="font-black text-gray-900 dark:text-white leading-tight">Extrato da Conta</h4>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">Metas e Repasses</p>
                        </div>
                    </Link>
                    <Link href={route('funcionario.catalogo')} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xs transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform"><SparklesIcon className="w-6 h-6" /></div>
                        <div>
                            <h4 className="font-black text-gray-900 dark:text-white leading-tight">Serviços Habilitados</h4>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">Tabela de Preços</p>
                        </div>
                    </Link>
                    <Link href={route('funcionario.ausencias')} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xs transition-all group">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform"><CalendarDaysIcon className="w-6 h-6" /></div>
                        <div>
                            <h4 className="font-black text-gray-900 dark:text-white leading-tight">Escala de Ausências</h4>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">Solicitar Folga</p>
                        </div>
                    </Link>
                </div>

                {/* ALTERNADOR DE SEÇÕES INTERNAS */}
                <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto gap-1">
                    <button onClick={() => setSubTela('operacao')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'operacao' ? 'bg-indigo-50 text-indigo-700 dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>Mesa de Operação</button>
                    <button onClick={() => setSubTela('fila_completa')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'fila_completa' ? 'bg-indigo-50 text-indigo-700 dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>Monitor de Fila</button>
                    <button onClick={() => setSubTela('historico')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${subTela === 'historico' ? 'bg-indigo-50 text-indigo-700 dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>Relatórios e Histórico</button>
                </div>

                {/* --- SEÇÃO: OPERAÇÃO DA CADEIRA PRINCIPAL --- */}
                {subTela === 'operacao' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                        
                        {/* ESTAÇÃO ATUAL / COMANDO DE CUSTÓDIA */}
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> Cadeira de Atendimento Ativa
                            </h3>
                            
                            {emAtendimentoLocal ? (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 shadow-xs flex-1 flex flex-col justify-between min-h-[400px]">
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <BadgeStatus status={emAtendimentoLocal.status} />
                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-900 dark:text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">Início: {emAtendimentoLocal.hora_agendamento?.substring(0,5)}</span>
                                        </div>
                                        <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{emAtendimentoLocal.usuario?.name}</h4>
                                        <p className="text-gray-500 dark:text-gray-400 font-semibold mb-6 text-sm">{emAtendimentoLocal.servico?.nome} • {formatarMoeda(emAtendimentoLocal.valor_final)}</p>

                                        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-200 dark:border-gray-700">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-black">Estado Financeiro do Atendimento</p>
                                            <BadgePagamento status={emAtendimentoLocal.status_pagamento} />
                                        </div>
                                    </div>

                                    {/* Validação de PIN de Segurança */}
                                    <div className="bg-gray-950 rounded-2xl p-5 mt-auto">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-3">Conclusão do Serviço (Digitar PIN do Cliente)</p>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder="0000" maxLength={4} disabled={!temPoderDeCaixa || processandoPin}
                                                value={pinDigitado} onChange={e => setPinDigitado(e.target.value.replace(/\D/g, ''))}
                                                className="flex-1 text-center text-2xl tracking-[0.4em] font-black border-gray-700 bg-gray-900 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                                            />
                                            <button 
                                                onClick={() => confirmarComPin(emAtendimentoLocal.id)} 
                                                disabled={!temPoderDeCaixa || processandoPin || pinDigitado.length !== 4}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 rounded-xl shadow-xs transition disabled:opacity-30"
                                            >
                                                {processandoPin ? '...' : 'FINALIZAR'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-800/40 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 min-h-[400px]">
                                    <UserIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                                    <h4 className="font-bold text-gray-400 text-lg">Posto Disponível</h4>
                                    <p className="text-sm text-gray-400 max-w-[240px] mt-1">Nenhum cliente em atendimento na sua cadeira. Chame o próximo.</p>
                                </div>
                            )}
                        </div>

                        {/* PRÓXIMO DA FILA DE ESPERA */}
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Próximo Cliente da Lista</h3>
                                {proximoLocal && isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) && (
                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider animate-pulse border border-rose-200">Horário Chegou</span>
                                )}
                            </div>

                            {proximoLocal ? (
                                <div className={`bg-white dark:bg-gray-800 rounded-3xl border p-6 shadow-sm flex-1 flex flex-col justify-between min-h-[400px] ${isHoraDoCliente(proximoLocal.hora_agendamento, proximoLocal.data_agendamento) ? 'border-rose-300' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center font-black text-gray-700 dark:text-gray-300 text-lg border border-gray-200 dark:border-gray-700">{proximoLocal.usuario?.name?.charAt(0) || '?'}</div>
                                            <span className="text-sm font-black text-gray-800 bg-gray-100 dark:bg-gray-900 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-lg">{proximoLocal.hora_agendamento?.substring(0, 5)}</span>
                                        </div>
                                        <h4 className="font-black text-gray-900 dark:text-white text-xl truncate mb-1 tracking-tight">{proximoLocal.usuario?.name}</h4>
                                        <p className="text-gray-500 dark:text-gray-400 font-bold mb-4 text-sm">{proximoLocal.servico?.nome} • {formatarMoeda(proximoLocal.valor_final)}</p>
                                        <div className="flex flex-wrap gap-1.5 mb-6">
                                            <BadgePagamento status={proximoLocal.status_pagamento} />
                                            <BadgeStatus status={proximoLocal.status} />
                                        </div>
                                    </div>

                                    {/* Ações Gerenciais e Contábeis do Próximo Cliente */}
                                    <div className="space-y-2 mt-auto">
                                        <button 
                                            onClick={() => handleChamarProximo(proximoLocal.id)} disabled={!!emAtendimentoLocal || !temPoderDeCaixa} 
                                            className="w-full py-4 bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-gray-900 font-black rounded-xl text-sm shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed"
                                        >
                                            <MegaphoneIcon className="w-4 h-4" /> Iniciar Atendimento
                                        </button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => pularCliente(proximoLocal.id)} disabled={!temPoderDeCaixa} className="py-2.5 bg-white hover:bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-wider rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:text-amber-400 transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-40">Pular Vez</button>
                                            <button 
                                                onClick={() => cancelarAtendimento(proximoLocal.id, proximoLocal.hora_agendamento, proximoLocal.data_agendamento, ['pago_online', 'pago'].includes(proximoLocal.status_pagamento))} 
                                                disabled={!temPoderDeCaixa} 
                                                className="py-2.5 bg-white hover:bg-rose-50 text-rose-600 font-bold text-[10px] uppercase tracking-wider rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:text-rose-400 transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-40"
                                            >
                                                {['pago_online', 'pago'].includes(proximoLocal.status_pagamento) ? 'Estornar Asaas' : 'Cancelar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-3xl p-10 flex flex-col items-center justify-center text-center flex-1 min-h-[400px] shadow-xs">
                                    <QueueListIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                                    <h4 className="font-bold text-gray-400 text-lg">Nenhum Próximo</h4>
                                    <p className="text-sm text-gray-400 mt-1">Fila limpa para este profissional.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MONITOR DE FILA COMPLETA --- */}
                {subTela === 'fila_completa' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Painel Cronológico de Chegada</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Listagem geral dos agendamentos de hoje na fila.</p>
                            </div>
                            <span className="bg-gray-100 dark:bg-gray-900 dark:text-gray-400 text-gray-800 px-4 py-2 rounded-xl text-sm font-black border border-gray-200 dark:border-gray-700">Total: {filaLocal.length}</span>
                        </div>

                        {filaLocal.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <MagnifyingGlassIcon className="w-12 h-12 mb-4 text-gray-200 dark:text-gray-700" />
                                <p className="font-bold text-lg">Nenhum cliente posicionado na fila.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-gray-100 dark:border-gray-700 ml-4 sm:ml-6 space-y-6 pb-4">
                                {filaLocal.map((ag, index) => (
                                    <div key={ag.id} className="relative pl-6 sm:pl-8 group">
                                        <div className={`absolute -left-[13px] top-4 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center font-black text-[9px] shadow-xs ${index === 0 ? 'bg-indigo-600 text-white w-8 h-8 -left-[17px] top-3' : 'bg-gray-200 text-gray-500'}`}>{index + 1}º</div>
                                        <div className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 transition-all ${index === 0 ? 'border-indigo-200 shadow-xs' : 'border-gray-200 dark:border-gray-700'}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center font-black text-gray-600 dark:text-gray-400 text-sm border border-gray-100 dark:border-gray-700">{ag.usuario?.name?.charAt(0) || '?'}</div>
                                                    <div>
                                                        <h4 className="font-black text-gray-900 dark:text-white tracking-tight">{ag.usuario?.name}</h4>
                                                        <p className="text-xs text-gray-400 font-bold">{ag.servico?.nome}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-md text-xs font-bold border border-gray-200 dark:border-gray-700">{ag.hora_agendamento?.substring(0,5)}</span>
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

                {/* --- TABELA DE HISTÓRICO E RELATÓRIOS --- */}
                {subTela === 'historico' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Fechamentos e Auditoria</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Filtros de faturamento real de atendimentos.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex bg-gray-100 dark:bg-gray-950 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                                    {['hoje', 'mes', 'ano', 'todos'].map((opt) => (
                                        <button 
                                            key={opt} onClick={() => mudarPeriodo(opt)}
                                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${periodo === opt ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                                        >
                                            {opt === 'hoje' ? 'Hoje' : opt === 'mes' ? 'Mês' : opt === 'ano' ? 'Ano' : 'Tudo'}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={gerarRelatorioPDF} className="flex items-center gap-2 bg-gray-900 text-white hover:bg-black px-5 py-2.5 rounded-xl text-xs font-black transition-colors"><DocumentArrowDownIcon className="w-4 h-4" /> Exportar PDF</button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden">
                            {historicoLocal.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <BriefcaseIcon className="w-12 h-12 mb-3 text-gray-200 dark:text-gray-700" />
                                    <p className="font-bold text-lg">Sem registros de caixa para o período filtrado.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {historicoLocal.map(ag => (
                                        <div key={ag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border ${['concluido','finalizado'].includes(ag.status) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{ag.usuario?.name?.charAt(0) || '?'}</div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-base tracking-tight">{ag.usuario?.name || 'Cliente'}</p>
                                                    <p className="text-xs text-gray-400 font-bold mt-0.5">{new Date(ag.data_agendamento).toLocaleDateString('pt-BR')} • {ag.hora_agendamento?.substring(0,5)} • {ag.servico?.nome}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2">
                                                <p className="font-black text-gray-900 dark:text-white text-base">{formatarMoeda(ag.valor_final)}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <BadgePagamento status={ag.status_pagamento} />
                                                    <BadgeStatus status={ag.status} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}