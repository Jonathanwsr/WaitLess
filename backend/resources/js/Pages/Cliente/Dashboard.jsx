import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import TextInput from '@/Components/TextInput';
import { TicketIcon, StarIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, ClockIcon, CalendarIcon, BellAlertIcon } from '@heroicons/react/24/solid';

export default function ClienteDashboard({ auth, agendamentos = [], usuario }) {
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');
    
    // Controle das Abas de Agendamentos
    const [abaAtiva, setAbaAtiva] = useState('proximos'); // proximos, pendentes, concluidos, cancelados

    // Estados de loading para os botões não travarem
    const [loadingPagar, setLoadingPagar] = useState(null); 
    const [loadingCancelar, setLoadingCancelar] = useState(null); 
    
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

    const primeiroNome = (usuario?.name || auth?.user?.name || 'Cliente').split(' ')[0];

    // LÓGICA DE FILTRAGEM PARA AS ABAS
    const agsProximos = [];
    const agsPendentes = [];
    const agsConcluidos = [];
    const agsCancelados = [];

    agendamentos.forEach(ag => {
        const statusTempo = verificarExpiracao(ag);
        const isCancelado = statusTempo.cancelado || ag.status_pagamento === 'estornado' || (statusTempo.expirou && ag.status_pagamento !== 'pago_online' && ag.status_pagamento !== 'presencial');
        
        if (isCancelado) {
            agsCancelados.push(ag);
        } else if (ag.status === 'concluido' || ag.status === 'finalizado') {
            agsConcluidos.push(ag);
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
                
                {flash?.success && <div className="p-4 text-green-800 bg-green-100 border border-green-200 rounded-xl shadow-sm animate-in fade-in"><strong>✅ Sucesso:</strong> {flash.success}</div>}
                {flash?.warning && <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-xl shadow-sm animate-in fade-in"><strong>⚠️ Atenção:</strong> {flash.warning}</div>}
                {flash?.error && <div className="p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl shadow-sm animate-in fade-in"><strong>❌ Oops:</strong> {flash.error}</div>}

                {/* 👉 BOTÃO DE ATALHO PARA MENSAGENS E SUGESTÕES */}
                <div className="flex justify-end animate-in fade-in slide-in-from-top-4">
                    <Link 
                        href={route('cliente.mensagens')} 
                        className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 group"
                    >
                        <BellAlertIcon className="w-5 h-5 group-hover:animate-bounce" />
                        Mensagens & Recompensas
                    </Link>
                </div>

                {/* CAIXA DE BUSCA HERO */}
                <div className="bg-indigo-600 rounded-3xl p-8 shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-extrabold text-white mb-2">Encontre e agende um serviço</h3>
                        <form onSubmit={fazerBusca} className="mt-4 flex flex-col md:flex-row gap-3">
                            <TextInput type="text" className="w-full py-3 px-6 rounded-xl border-0" placeholder="Ex: Barbearia do João..." value={busca} onChange={e => setBusca(e.target.value)} />
                            <select className="w-full md:w-64 py-3 px-4 border-0 rounded-xl text-gray-700" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                <option value="">Todas as Categorias</option>
                                <option value="Beleza e Estética">Beleza e Estética</option>
                            </select>
                            <button type="submit" className="bg-gray-900 text-white px-8 py-3 font-bold rounded-xl shadow-md hover:bg-gray-800 transition">Procurar</button>
                        </form>
                    </div>
                    {/* Elemento de decoração */}
                    <TicketIcon className="absolute -right-6 -top-6 w-48 h-48 text-indigo-500 opacity-50 transform rotate-12 pointer-events-none" />
                </div>

                {/* SEÇÃO DE AGENDAMENTOS */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    
                    {/* CABEÇALHO E ABAS */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">📅 Meus Agendamentos</h3>
                        
                        <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-2">
                            <button 
                                onClick={() => setAbaAtiva('proximos')} 
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${abaAtiva === 'proximos' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                            >
                                <ClockIcon className="w-5 h-5" /> Próximos 
                                <span className="bg-white/20 text-inherit px-2 py-0.5 rounded-full text-xs">{agsProximos.length}</span>
                            </button>
                            <button 
                                onClick={() => setAbaAtiva('pendentes')} 
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${abaAtiva === 'pendentes' ? 'bg-yellow-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                            >
                                <ExclamationTriangleIcon className="w-5 h-5" /> Faltam Pagar
                                {agsPendentes.length > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">{agsPendentes.length}</span>}
                            </button>
                            <button 
                                onClick={() => setAbaAtiva('concluidos')} 
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${abaAtiva === 'concluidos' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                            >
                                <CheckCircleIcon className="w-5 h-5" /> Histórico
                            </button>
                            <button 
                                onClick={() => setAbaAtiva('cancelados')} 
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${abaAtiva === 'cancelados' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                            >
                                <XCircleIcon className="w-5 h-5" /> Cancelados
                            </button>
                        </div>
                    </div>

                    {/* LISTA DE AGENDAMENTOS */}
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/20 min-h-[300px]">
                        {agendamentosExibidos.length === 0 ? (
                            <div className="text-center py-16">
                                <span className="text-6xl mb-4 block opacity-30">👻</span>
                                <h4 className="text-xl font-bold mb-2 text-gray-700 dark:text-gray-300">Nenhum agendamento nesta aba</h4>
                                <p className="text-gray-500 text-sm">Que tal explorar lojas e marcar um horário?</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {agendamentosExibidos.map((agendamento) => {
                                    const statusTempo = verificarExpiracao(agendamento);
                                    const isPago = agendamento.status_pagamento === 'pago_online';
                                    const isEstornado = agendamento.status_pagamento === 'estornado';
                                    const isPresencial = agendamento.status_pagamento === 'presencial';
                                    const isConfirmado = (isPago || isPresencial || agendamento.status === 'confirmado') && !statusTempo.cancelado && agendamento.status !== 'concluido';
                                    const isCanceladoDefinitivo = statusTempo.cancelado || isEstornado || (statusTempo.expirou && !isConfirmado);
                                    const isAguardandoPagamento = agendamento.status === 'aguardando_pagamento' && !isCanceladoDefinitivo && !isConfirmado;
                                    const isConcluido = agendamento.status === 'concluido';

                                    const isCarregandoPagamento = loadingPagar === agendamento.id;
                                    const isCarregandoCancelamento = loadingCancelar === agendamento.id;

                                    return (
                                        <div key={agendamento.id} className={`rounded-2xl overflow-hidden border shadow-sm flex flex-col transition-all ${isCanceladoDefinitivo ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-70 grayscale' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'}`}>
                                            
                                            {/* CABEÇALHO DO CARD (CORES DINÂMICAS) */}
                                            <div className={`p-5 border-b ${
                                                isCanceladoDefinitivo ? 'bg-gray-200 dark:bg-gray-700' : 
                                                isConcluido ? 'bg-gray-900 text-white' :
                                                isAguardandoPagamento ? 'bg-yellow-400 text-yellow-900' : 
                                                'bg-indigo-600 text-white'
                                            }`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-sm font-bold opacity-80 uppercase tracking-wider mb-1">Status</p>
                                                        <h4 className="text-xl font-black">
                                                            {isCanceladoDefinitivo ? (isEstornado ? '❌ Reembolsado' : '❌ Cancelado') : 
                                                             isConcluido ? '✅ Concluído' :
                                                             isAguardandoPagamento ? '⚠️ Pagar no App' : 
                                                             (isPresencial ? '✔️ Pagar no Local' : '🚀 Confirmado')}
                                                        </h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-xl font-bold py-1.5 px-4 rounded-xl shadow-inner ${isCanceladoDefinitivo ? 'bg-gray-300 text-gray-500' : 'bg-white/20 text-inherit backdrop-blur-sm'}`}>
                                                            {agendamento?.hora_agendamento ? agendamento.hora_agendamento.substring(0, 5) : '--:--'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 flex-1 flex flex-col">
                                                <h4 className="font-black text-gray-900 dark:text-white text-xl mb-1">{agendamento?.estabelecimento?.nome || 'Loja Indisponível'}</h4>
                                                
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 my-4 flex justify-between items-center border border-gray-100 dark:border-gray-600">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{agendamento?.servico?.nome || 'Serviço Indisponível'}</p>
                                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                            <CalendarIcon className="w-3 h-3" /> {formatarData(agendamento?.data_agendamento)}
                                                        </p>
                                                    </div>
                                                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatarMoeda(agendamento?.valor_final)}</p>
                                                </div>

                                                {/* 👉 A MÁGICA DA GAMIFICAÇÃO: O CÓDIGO PIN GIGANTE AQUI! */}
                                                {isConfirmado && agendamento?.codigo_confirmacao && (
                                                    <div className="mb-6 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-xl p-5 border-2 border-yellow-400 border-dashed text-center relative overflow-hidden group">
                                                        <StarIcon className="absolute -left-4 -top-4 w-16 h-16 text-yellow-300/50 group-hover:rotate-12 transition-transform duration-500" />
                                                        <StarIcon className="absolute -right-4 -bottom-4 w-16 h-16 text-yellow-300/50 group-hover:-rotate-12 transition-transform duration-500" />
                                                        
                                                        <p className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-widest mb-2">Seu PIN de Atendimento</p>
                                                        <div className="text-5xl font-black text-gray-900 dark:text-white tracking-[0.2em] font-mono">
                                                            {agendamento.codigo_confirmacao}
                                                        </div>
                                                        <p className="text-xs text-yellow-700 dark:text-yellow-600 mt-3 font-medium flex items-center justify-center gap-1">
                                                            <StarIcon className="w-4 h-4 text-yellow-500" />
                                                            Mostre ao profissional para ganhar pontos!
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="mt-auto space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                    
                                                    {/* Botão de Pagar (Se estiver pendente online) */}
                                                    {isAguardandoPagamento && (
                                                        <button type="button" onClick={() => pagarNovamente(agendamento.id)} disabled={isCarregandoPagamento || isCarregandoCancelamento} className="w-full py-3 text-white font-bold rounded-xl shadow-md transition bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 transform hover:-translate-y-0.5">
                                                            {isCarregandoPagamento ? '⏳ A gerar link seguro...' : '💳 Pagar Agora (Mercado Pago)'}
                                                        </button>
                                                    )}

                                                    {/* Botão de Cancelar (Apenas se não estiver cancelado ou concluído) */}
                                                    {!isCanceladoDefinitivo && !isConcluido && (
                                                        <button type="button" onClick={() => cancelarVaga(agendamento.id, isPago)} disabled={isCarregandoCancelamento || isCarregandoPagamento} className="w-full py-3 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 font-bold rounded-xl transition border border-red-100 dark:border-red-800/50">
                                                            {isCarregandoCancelamento ? '⏳ A cancelar...' : 'Cancelar Agendamento'}
                                                        </button>
                                                    )}

                                                    {/* Botão de Agendar Novamente (Se estiver cancelado/concluído) */}
                                                    {(isCanceladoDefinitivo || isConcluido) && route().has('cliente.agendar') && agendamento?.estabelecimento_id && (
                                                        <Link href={route('cliente.agendar', agendamento.estabelecimento_id)} className="flex items-center justify-center gap-2 w-full py-3 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-600 hover:border-indigo-600 dark:hover:border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl transition">
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
        </AuthenticatedLayout>
    );
}