import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { 
    TicketIcon, StarIcon, ExclamationTriangleIcon, CheckCircleIcon, 
    XCircleIcon, ClockIcon, CalendarIcon, BellAlertIcon, 
    ChatBubbleBottomCenterTextIcon, MagnifyingGlassIcon 
} from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'; 

export default function ClienteDashboard({ auth, agendamentos = [], usuario }) {
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');
    
    // Controle das Abas de Agendamentos
    const [abaAtiva, setAbaAtiva] = useState('proximos'); 

    // Estados de loading para os botões não travarem
    const [loadingPagar, setLoadingPagar] = useState(null); 
    const [loadingCancelar, setLoadingCancelar] = useState(null); 

    // Estados do Pop-up de Avaliação
    const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false);
    const [agendamentoParaAvaliar, setAgendamentoParaAvaliar] = useState(null);
    const [nota, setNota] = useState(5);
    const [comentario, setComentario] = useState('');
    const [hoverNota, setHoverNota] = useState(0);
    const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
    
    const { flash = {} } = usePage().props;

    const fazerBusca = (e) => {
        e.preventDefault();
        if (route().has('cliente.explorar')) {
            router.get(route('cliente.explorar'), { busca, categoria });
        }
    };

    const formatarMoeda = (valor) => valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : 'R$ 0,00';

    const formatarData = (dataStr) => {
        if (!dataStr) return '';
        const partes = dataStr.split(' ')[0].split('-'); 
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataStr;
    };

    const verificarExpiracao = (agendamento) => {
        if (!agendamento || !agendamento.data_agendamento || !agendamento.hora_agendamento || 
            agendamento.status_pagamento === 'pago_online' || agendamento.status_pagamento === 'presencial' || agendamento.status === 'cancelado' || agendamento.status_pagamento === 'estornado') {
            return { expirou: false, cancelado: agendamento?.status === 'cancelado' };
        }

        try {
            const dataAgendamento = new Date(`${agendamento.data_agendamento}T${agendamento.hora_agendamento}`);
            const diferencaHoras = (dataAgendamento - new Date(agendamento.created_at)) / (1000 * 60 * 60);
            const dataLimite = diferencaHoras > 2 ? new Date(dataAgendamento.getTime() - (2 * 60 * 60 * 1000)) : dataAgendamento;
            return { expirou: new Date() > dataLimite, cancelado: false };
        } catch (e) {
            return { expirou: false, cancelado: false };
        }
    };

    const pagarNovamente = (agendamentoId) => {
        router.post(route('pagamento.tentar_novamente', { agendamento: agendamentoId }), {}, {
            preserveScroll: true, 
            onStart: () => setLoadingPagar(agendamentoId), 
            onFinish: () => setLoadingPagar(null),
        });
    };

    const cancelarVaga = (agendamentoId, isPago) => {
        const mensagem = isPago 
            ? 'Tem certeza que deseja cancelar? O valor será estornado para a sua conta.' 
            : 'Tem certeza que deseja cancelar esta reserva?';
            
        if (window.confirm(mensagem)) {
            router.post(route('cliente.agendamento.cancelar', { id: agendamentoId }), {}, {
                preserveScroll: true,
                onStart: () => setLoadingCancelar(agendamentoId),
                onFinish: () => setLoadingCancelar(null),
            });
        }
    };

    // Funções de Avaliação
    const abrirModalAvaliacao = (agendamento) => {
        setAgendamentoParaAvaliar(agendamento);
        setNota(5);
        setComentario('');
        setModalAvaliacaoOpen(true);
    };

    const fecharModalAvaliacao = () => {
        setModalAvaliacaoOpen(false);
        setTimeout(() => setAgendamentoParaAvaliar(null), 300);
    };

    const submitAvaliacao = (e) => {
        e.preventDefault();
        setEnviandoAvaliacao(true);
        router.post(route('cliente.agendamento.avaliar', agendamentoParaAvaliar.id), {
            nota: nota, comentario: comentario
        }, {
            preserveScroll: true, onSuccess: () => fecharModalAvaliacao(), onFinish: () => setEnviandoAvaliacao(false)
        });
    };

    const primeiroNome = (usuario?.name || auth?.user?.name || 'Cliente').split(' ')[0];

    // Separa os agendamentos nas abas correspondentes
    const agsProximos = [];
    const agsPendentes = [];
    const agsConcluidos = [];
    const agsCancelados = [];

    // 👉 CORREÇÃO DO HISTÓRICO (AGORA FUNCIONA E MOSTRA OS CONCLUÍDOS!)
    agendamentos.forEach(ag => {
        const statusTempo = verificarExpiracao(ag);
        const isCancelado = statusTempo.cancelado || ag.status_pagamento === 'estornado' || (statusTempo.expirou && ag.status_pagamento !== 'pago_online' && ag.status_pagamento !== 'presencial');
        
        if (isCancelado) {
            agsCancelados.push(ag);
        } else if (ag.status === 'concluido' || ag.status === 'finalizado') {
            agsConcluidos.push(ag); // <-- Vai certinho para o Histórico
        } else if (ag.status === 'aguardando_pagamento' && ag.status_pagamento === 'pendente') {
            agsPendentes.push(ag);
        } else {
            agsProximos.push(ag);
        }
    });

    const agendamentosExibidos = 
        abaAtiva === 'proximos' ? agsProximos :
        abaAtiva === 'pendentes' ? agsPendentes :
        abaAtiva === 'concluidos' ? agsConcluidos : agsCancelados;

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">Olá, {primeiroNome} 👋</h2>}>
            <Head title="Meu Painel - WaitLess" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
                
                {flash?.success && <div className="p-4 text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-xl shadow-sm animate-in fade-in flex items-center gap-2"><CheckCircleIcon className="w-6 h-6"/> {flash.success}</div>}
                {flash?.warning && <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-xl shadow-sm animate-in fade-in flex items-center gap-2"><ExclamationTriangleIcon className="w-6 h-6"/> {flash.warning}</div>}
                {flash?.error && <div className="p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl shadow-sm animate-in fade-in flex items-center gap-2"><XCircleIcon className="w-6 h-6"/> {flash.error}</div>}

                {/* BOTÃO DE RECOMPENSAS MODERNIZADO */}
                <div className="flex justify-end animate-in fade-in slide-in-from-top-4">
                    <Link 
                        href={route('cliente.mensagens')} 
                        className="flex items-center gap-3 bg-white border border-gray-200 hover:border-emerald-300 text-gray-800 font-black py-3 px-6 rounded-2xl shadow-sm transition-all hover:shadow-md group"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BellAlertIcon className="w-5 h-5 group-hover:animate-swing" />
                        </div>
                        Mensagens & Recompensas
                    </Link>
                </div>

                {/* PESQUISA MODERNIZADA (VERDE CLARO) */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] p-8 sm:p-12 shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black text-white mb-3 tracking-tight">O que você precisa hoje?</h3>
                        <p className="text-emerald-100 font-medium mb-6 max-w-md">Encontre os melhores profissionais e agende o seu horário sem filas.</p>
                        
                        <form onSubmit={fazerBusca} className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                                <input 
                                    type="text" 
                                    className="w-full py-4 pl-12 pr-6 rounded-2xl border-0 shadow-sm focus:ring-4 focus:ring-emerald-300 transition-all font-medium text-gray-800" 
                                    placeholder="Buscar por nome do salão, barbearia..." 
                                    value={busca} onChange={e => setBusca(e.target.value)} 
                                />
                            </div>
                            <select className="w-full md:w-64 py-4 px-6 border-0 rounded-2xl text-gray-700 shadow-sm focus:ring-4 focus:ring-emerald-300 transition-all font-medium font-sans" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                <option value="">Qualquer Categoria</option>
                                <option value="Beleza e Estética">Beleza e Estética</option>
                            </select>
                            <button type="submit" className="bg-gray-900 text-white px-8 py-4 font-black rounded-2xl shadow-md hover:bg-black hover:scale-105 transition-all">Buscar</button>
                        </form>
                    </div>
                    <TicketIcon className="absolute -right-10 -top-10 w-64 h-64 text-emerald-400 opacity-30 transform rotate-12 pointer-events-none" />
                </div>

                {/* ABAS MODERNIZADAS */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <CalendarIcon className="w-6 h-6 text-emerald-500" /> Meus Agendamentos
                        </h3>
                        
                        <div className="flex overflow-x-auto gap-3 scrollbar-hide pb-2">
                            <button onClick={() => setAbaAtiva('proximos')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'proximos' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                                <ClockIcon className="w-5 h-5" /> Próximos 
                                {agsProximos.length > 0 && <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs ml-1 shadow-sm">{agsProximos.length}</span>}
                            </button>
                            
                            <button onClick={() => setAbaAtiva('pendentes')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'pendentes' ? 'bg-yellow-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                                <ExclamationTriangleIcon className="w-5 h-5" /> Faltam Pagar
                                {agsPendentes.length > 0 && <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs animate-pulse ml-1 shadow-sm">{agsPendentes.length}</span>}
                            </button>

                            <button onClick={() => setAbaAtiva('concluidos')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'concluidos' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                                <CheckCircleIcon className="w-5 h-5" /> Histórico
                                {agsConcluidos.length > 0 && <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs ml-1 shadow-sm">{agsConcluidos.length}</span>}
                            </button>

                            <button onClick={() => setAbaAtiva('cancelados')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'cancelados' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                                <XCircleIcon className="w-5 h-5" /> Cancelados
                            </button>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50/30 dark:bg-gray-900/20 min-h-[300px]">
                        {agendamentosExibidos.length === 0 ? (
                            <div className="text-center py-16">
                                <span className="text-6xl mb-4 block opacity-30">✨</span>
                                <h4 className="text-xl font-bold mb-2 text-gray-700 dark:text-gray-300">Nenhum agendamento nesta aba</h4>
                                <p className="text-gray-500 text-sm">Clique nas abas acima para ver o seu histórico.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {agendamentosExibidos.map((agendamento) => {
                                    const statusTempo = verificarExpiracao(agendamento);
                                    const isPago = agendamento.status_pagamento === 'pago_online';
                                    const isEstornado = agendamento.status_pagamento === 'estornado';
                                    const isPresencial = agendamento.status_pagamento === 'presencial';
                                    
                                    const isConcluido = agendamento.status === 'concluido' || agendamento.status === 'finalizado';
                                    
                                    const isConfirmado = (isPago || isPresencial || agendamento.status === 'confirmado') && !statusTempo.cancelado && !isConcluido;
                                    const isCanceladoDefinitivo = statusTempo.cancelado || isEstornado || (statusTempo.expirou && !isConfirmado);
                                    const isAguardandoPagamento = agendamento.status === 'aguardando_pagamento' && !isCanceladoDefinitivo && !isConfirmado;

                                    return (
                                        <div key={agendamento.id} className={`rounded-2xl overflow-hidden border shadow-sm flex flex-col transition-all ${isCanceladoDefinitivo ? 'bg-gray-100 border-gray-200 opacity-70 grayscale' : 'bg-white border-gray-200 hover:shadow-md'}`}>
                                            
                                            <div className={`p-5 border-b flex justify-between items-center ${
                                                isCanceladoDefinitivo ? 'bg-gray-200 text-gray-600' : 
                                                isConcluido ? 'bg-gray-900 text-white' :
                                                isAguardandoPagamento ? 'bg-yellow-400 text-yellow-900' : 
                                                'bg-emerald-500 text-white'
                                            }`}>
                                                <div>
                                                    <p className="text-sm font-bold opacity-80 uppercase tracking-wider mb-1">Status</p>
                                                    <h4 className="text-xl font-black flex items-center gap-2">
                                                        {isCanceladoDefinitivo ? (isEstornado ? 'Reembolsado' : 'Cancelado') : 
                                                         isConcluido ? <><CheckCircleIcon className="w-6 h-6"/> Concluído</> :
                                                         isAguardandoPagamento ? <><ExclamationTriangleIcon className="w-6 h-6"/> Pagar no App</> : 
                                                         <><ClockIcon className="w-6 h-6"/> Confirmado</>}
                                                    </h4>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xl font-bold py-1.5 px-4 rounded-xl shadow-inner ${isCanceladoDefinitivo ? 'bg-gray-300 text-gray-500' : 'bg-white/20 text-inherit backdrop-blur-sm'}`}>
                                                        {agendamento?.hora_agendamento ? agendamento.hora_agendamento.substring(0, 5) : '--:--'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-6 flex-1 flex flex-col">
                                                <h4 className="font-black text-gray-900 text-xl mb-1">{agendamento?.estabelecimento?.nome || 'Loja Indisponível'}</h4>
                                                
                                                <div className="bg-gray-50 rounded-xl p-4 my-4 flex justify-between items-center border border-gray-100">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{agendamento?.servico?.nome || 'Serviço Indisponível'}</p>
                                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                            <CalendarIcon className="w-3 h-3" /> {formatarData(agendamento?.data_agendamento)}
                                                        </p>
                                                    </div>
                                                    <p className="text-lg font-black text-emerald-600">{formatarMoeda(agendamento?.valor_final)}</p>
                                                </div>

                                                {/* 👉 GAMIFICAÇÃO: CÓDIGO PIN MÁGICO */}
                                                {isConfirmado && agendamento?.codigo_verificacao && !isConcluido && (
                                                    <div className="mb-6 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-xl p-5 border-2 border-yellow-400 border-dashed text-center relative overflow-hidden group">
                                                        <StarIcon className="absolute -left-4 -top-4 w-16 h-16 text-yellow-300/50 group-hover:rotate-12 transition-transform duration-500" />
                                                        <StarIcon className="absolute -right-4 -bottom-4 w-16 h-16 text-yellow-300/50 group-hover:-rotate-12 transition-transform duration-500" />
                                                        
                                                        {/* Se for pagamento local, avisa para pagar na loja */}
                                                        {isPresencial && (
                                                            <div className="bg-yellow-200 text-yellow-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 w-max mx-auto rounded-lg mb-3">
                                                                💰 Pagar no Local
                                                            </div>
                                                        )}

                                                        <p className="text-xs font-bold text-yellow-800 uppercase tracking-widest mb-2">Seu PIN de Atendimento</p>
                                                        <div className="text-5xl font-black text-gray-900 tracking-[0.2em] font-mono drop-shadow-sm">
                                                            {agendamento.codigo_verificacao} {/* <--- Corrigido para codigo_verificacao! */}
                                                        </div>
                                                        <p className="text-xs text-yellow-700 mt-3 font-medium flex items-center justify-center gap-1">
                                                            <StarIcon className="w-4 h-4 text-yellow-500" /> Forneça este PIN ao funcionário na loja!
                                                        </p>
                                                    </div>
                                                )}

                                                {/* AVALIAÇÃO DE 5 ESTRELAS */}
                                                {isConcluido && (
                                                    <div className="mt-2 mb-4">
                                                        {!agendamento.nota ? (
                                                            <button 
                                                                onClick={() => abrirModalAvaliacao(agendamento)} 
                                                                className="w-full py-4 px-4 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-black rounded-xl shadow-md transition transform hover:-translate-y-0.5 flex flex-col sm:flex-row items-center justify-center gap-2 animate-bounce hover:animate-none"
                                                            >
                                                                <div className="flex gap-1">
                                                                    <StarIcon className="w-5 h-5 text-yellow-200" />
                                                                    <StarIcon className="w-5 h-5 text-yellow-200" />
                                                                    <StarIcon className="w-5 h-5 text-yellow-200" />
                                                                </div>
                                                                Avaliar e Ganhar 50 Pontos
                                                            </button>
                                                        ) : (
                                                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-lg">Avaliado</div>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Sua Experiência</p>
                                                                <div className="flex items-center gap-1 mb-3">
                                                                    {[1, 2, 3, 4, 5].map((estrela) => (
                                                                        agendamento.nota >= estrela 
                                                                        ? <StarIcon key={estrela} className="w-6 h-6 text-yellow-400 drop-shadow-sm" /> 
                                                                        : <StarOutlineIcon key={estrela} className="w-6 h-6 text-gray-300" />
                                                                    ))}
                                                                    <span className="ml-2 font-black text-gray-900 text-lg">{agendamento.nota}.0</span>
                                                                </div>
                                                                {agendamento.comentario_avaliacao ? (
                                                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                                        <p className="text-sm text-gray-600 italic">"{agendamento.comentario_avaliacao}"</p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 italic">Nenhum comentário deixado.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-auto space-y-3 pt-4 border-t border-gray-100">
                                                    {isAguardandoPagamento && (
                                                        <button type="button" onClick={() => pagarNovamente(agendamento.id)} disabled={loadingPagar === agendamento.id || loadingCancelar === agendamento.id} className="w-full py-3.5 text-white font-bold rounded-xl shadow-md transition bg-gray-900 hover:bg-black">
                                                            {loadingPagar === agendamento.id ? '⏳ A gerar link...' : '💳 Pagar Agora'}
                                                        </button>
                                                    )}

                                                    {!isCanceladoDefinitivo && !isConcluido && (
                                                        <button type="button" onClick={() => cancelarVaga(agendamento.id, isPago)} disabled={loadingCancelar === agendamento.id || loadingPagar === agendamento.id} className="w-full py-3 text-red-500 bg-white hover:bg-red-50 font-bold rounded-xl transition border border-red-100">
                                                            {loadingCancelar === agendamento.id ? '⏳ A cancelar...' : 'Cancelar Agendamento'}
                                                        </button>
                                                    )}

                                                    {(isCanceladoDefinitivo || isConcluido) && route().has('cliente.agendar') && agendamento?.estabelecimento_id && (
                                                        <Link href={route('cliente.agendar', agendamento.estabelecimento_id)} className="flex items-center justify-center gap-2 w-full py-3.5 bg-white border-2 border-emerald-100 hover:border-emerald-500 text-emerald-600 font-black rounded-xl transition">
                                                            <ClockIcon className="w-5 h-5" /> Agendar Novamente
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 👉 MODAL DE AVALIAÇÃO */}
            {modalAvaliacaoOpen && agendamentoParaAvaliar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center relative overflow-hidden">
                            <StarIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-md" />
                            <h3 className="text-2xl font-black text-white">Como foi o serviço?</h3>
                            <p className="text-emerald-100 font-medium text-sm mt-2">Avalie o atendimento e ganhe <strong>50 pontos</strong> na hora!</p>
                        </div>
                        
                        <form onSubmit={submitAvaliacao} className="p-8">
                            <div className="flex justify-center gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((estrela) => (
                                    <button 
                                        type="button" 
                                        key={estrela}
                                        onClick={() => setNota(estrela)}
                                        onMouseEnter={() => setHoverNota(estrela)}
                                        onMouseLeave={() => setHoverNota(0)}
                                        className="transition-transform hover:scale-110 focus:outline-none"
                                    >
                                        {(hoverNota || nota) >= estrela ? (
                                            <StarIcon className="w-12 h-12 text-yellow-400 drop-shadow" />
                                        ) : (
                                            <StarOutlineIcon className="w-12 h-12 text-gray-300" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-gray-400" />
                                    Deixe um elogio (Opcional)
                                </label>
                                <textarea 
                                    className="w-full rounded-2xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm font-medium"
                                    rows="3"
                                    placeholder="O serviço foi incrível..."
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    maxLength={500}
                                ></textarea>
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={fecharModalAvaliacao} className="px-5 py-3.5 font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition w-1/3">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={enviandoAvaliacao} className="px-5 py-3.5 font-black text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-md transition w-2/3 disabled:opacity-50 flex justify-center items-center gap-2">
                                    {enviandoAvaliacao ? 'A enviar...' : 'Enviar Avaliação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}