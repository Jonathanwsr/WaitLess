import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    StarIcon, ExclamationTriangleIcon, CheckCircleIcon, 
    XCircleIcon, CalendarIcon, BellAlertIcon, 
    MapPinIcon, ArrowPathIcon 
} from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'; 

export default function ClienteDashboard({ auth, agendamentos = [], usuario }) {
    // Controle das Abas de Agendamentos
    const [abaAtiva, setAbaAtiva] = useState('proximos'); 

    // Estados de loading
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

    const formatarMoeda = (valor) => valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : 'R$ 0,00';

    const formatarDataCompleta = (dataStr, horaStr) => {
        if (!dataStr) return '';
        try {
            const [ano, mes, dia] = dataStr.split(' ')[0].split('-');
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const nomeMes = meses[parseInt(mes, 10) - 1];
            const hora = horaStr ? horaStr.substring(0, 5) : '';
            return `${dia} de ${nomeMes}, ${ano} • ${hora}`;
        } catch (e) {
            return dataStr;
        }
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
        <AuthenticatedLayout user={auth.user} header={<></>}>
            <Head title="Minhas Reservas - Lokyva" />

            <div className="min-h-screen bg-[#FCF9F6] font-sans pb-24">
                <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-12 pt-8 md:pt-12">
                    
                    {/* Alertas Flutuantes */}
                    {flash?.success && <div className="mb-8 p-4 text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-sm font-medium w-full md:w-max mx-auto shadow-sm animate-in fade-in slide-in-from-top-4"><CheckCircleIcon className="w-5 h-5 shrink-0"/> {flash.success}</div>}
                    {flash?.warning && <div className="mb-8 p-4 text-[#E05D36] bg-[#FFF2EE] border border-[#FADCD2] rounded-2xl flex items-center gap-3 text-sm font-medium w-full md:w-max mx-auto shadow-sm animate-in fade-in slide-in-from-top-4"><ExclamationTriangleIcon className="w-5 h-5 shrink-0"/> {flash.warning}</div>}
                    {flash?.error && <div className="mb-8 p-4 text-red-800 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-sm font-medium w-full md:w-max mx-auto shadow-sm animate-in fade-in slide-in-from-top-4"><XCircleIcon className="w-5 h-5 shrink-0"/> {flash.error}</div>}

                    {/* CABEÇALHO RESPONSIVO */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-10 gap-6">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Minhas Reservas</h2>
                            <p className="text-gray-500 mt-2 text-sm font-medium">Gerencie seus agendamentos de forma inteligente.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Link 
                                href={route('cliente.estornos')} 
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-800 font-bold py-3.5 px-6 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:shadow-lg hover:border-gray-300 transition-all text-sm w-full sm:w-auto"
                            >
                                <ArrowPathIcon className="w-5 h-5 text-gray-400" />
                                <span>Meus Estornos</span>
                            </Link>

                            <Link 
                                href={route('cliente.mensagens')} 
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-800 font-bold py-3.5 px-6 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:shadow-lg hover:border-gray-300 transition-all text-sm w-full sm:w-auto"
                            >
                                <BellAlertIcon className="w-5 h-5 text-[#E05D36]" />
                                <span>Recompensas</span>
                            </Link>
                        </div>
                    </div>

                    {/* ABAS SEGMENTADAS (SCROLL NO MOBILE) */}
                    <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex overflow-x-auto gap-2 p-1.5 bg-gray-200/50 rounded-[1.25rem] w-max max-w-full no-scrollbar border border-gray-200/30 touch-pan-x">
                            <button onClick={() => setAbaAtiva('proximos')} className={`px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${abaAtiva === 'proximos' ? 'bg-white text-[#E05D36] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                                Próximos
                            </button>
                            <button onClick={() => setAbaAtiva('concluidos')} className={`px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${abaAtiva === 'concluidos' ? 'bg-white text-[#E05D36] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                                Histórico
                            </button>
                            <button onClick={() => setAbaAtiva('cancelados')} className={`px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${abaAtiva === 'cancelados' ? 'bg-white text-[#E05D36] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                                Cancelados
                            </button>
                            <button onClick={() => setAbaAtiva('pendentes')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap border-2 border-transparent ${abaAtiva === 'pendentes' ? 'border-[#E05D36]/20 bg-white text-[#E05D36] shadow-sm' : 'text-gray-900 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}`}>
                                Faltam Pagar
                                {agsPendentes.length > 0 && (
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black border ${abaAtiva === 'pendentes' ? 'bg-[#E05D36] text-white border-transparent' : 'bg-[#FFF2EE] text-[#E05D36] border-[#FADCD2]'}`}>
                                        {agsPendentes.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* GRID DE CARDS */}
                    {agendamentosExibidos.length === 0 ? (
                        <div className="text-center py-24 bg-white/50 rounded-[2rem] border border-gray-100 border-dashed">
                            <div className="bg-gray-100/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CalendarIcon className="w-10 h-10 text-gray-300" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-800">Nada por aqui</h4>
                            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">Não encontramos nenhum agendamento nesta categoria no momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {agendamentosExibidos.map((agendamento) => {
                                const statusTempo = verificarExpiracao(agendamento);
                                const isPago = agendamento.status_pagamento === 'pago_online';
                                const isEstornado = agendamento.status_pagamento === 'estornado';
                                const isConcluido = agendamento.status === 'concluido' || agendamento.status === 'finalizado';
                                const isConfirmado = (isPago || agendamento.status_pagamento === 'presencial' || agendamento.status === 'confirmado') && !statusTempo.cancelado && !isConcluido;
                                const isCanceladoDefinitivo = statusTempo.cancelado || isEstornado || (statusTempo.expirou && !isConfirmado);
                                const isAguardandoPagamento = agendamento.status === 'aguardando_pagamento' && !isCanceladoDefinitivo && !isConfirmado;
                                
                                const isEmAndamento = agendamento.status === 'em_andamento' || agendamento.em_andamento;

                                return (
                                    <div key={agendamento.id} className={`rounded-[2rem] bg-white border p-6 flex flex-col justify-between transition-all duration-300 ${isEmAndamento ? 'border-[#E05D36] shadow-[0_8px_30px_rgba(224,93,54,0.15)] ring-1 ring-[#E05D36]' : 'border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_35px_rgba(0,0,0,0.08)] hover:-translate-y-1'}`}>
                                        
                                        <div className="flex-1">
                                            {/* Status e Valor */}
                                            <div className="flex justify-between items-start mb-6 gap-2">
                                                <div className="flex-shrink-0 mt-1">
                                                    {isCanceladoDefinitivo ? (
                                                        <span className="bg-red-50 text-red-600 text-[10px] uppercase tracking-wider font-black px-3 py-1.5 rounded-lg border border-red-100">Cancelado</span>
                                                    ) : isConcluido ? (
                                                        <span className="bg-gray-100 text-gray-600 text-[10px] uppercase tracking-wider font-black px-3 py-1.5 rounded-lg border border-gray-200">Concluído</span>
                                                    ) : isEmAndamento ? (
                                                        <span className="bg-[#E05D36] text-white text-[10px] uppercase tracking-wider font-black px-3 py-1.5 rounded-lg shadow-sm">Em Atendimento</span>
                                                    ) : isAguardandoPagamento ? (
                                                        <span className="bg-[#FFF2EE] text-[#E05D36] text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-lg border border-[#FADCD2]">Pendente</span>
                                                    ) : (
                                                        <span className="bg-gray-50 text-gray-800 text-[10px] uppercase tracking-wider font-black px-3 py-1.5 rounded-lg border border-gray-200">Confirmado</span>
                                                    )}
                                                </div>

                                                <div className="text-right break-words">
                                                    <span className="text-2xl font-black text-gray-900 tracking-tight">
                                                        {formatarMoeda(agendamento?.valor_final)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Serviço e Local */}
                                            <div className="mb-6">
                                                <h4 className="text-lg font-bold text-gray-900 leading-tight mb-2">{agendamento?.servico?.nome || 'Serviço Agendado'}</h4>
                                                <p className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                                                    <MapPinIcon className="w-4 h-4 text-[#E05D36]" /> 
                                                    <span className="truncate">{agendamento?.estabelecimento?.nome || 'Local não informado'}</span>
                                                </p>
                                            </div>

                                            {/* Data */}
                                            <div className="mb-6 flex items-center gap-4 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                                                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm shrink-0">
                                                    <CalendarIcon className="w-5 h-5 text-gray-800" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Agendado para</p>
                                                    <p className={`text-sm font-bold truncate ${isCanceladoDefinitivo ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                        {formatarDataCompleta(agendamento?.data_agendamento, agendamento?.hora_agendamento)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* PIN Code */}
                                            {isConfirmado && agendamento?.codigo_verificacao && !isConcluido && !isEmAndamento && (
                                                <div className="mb-6 bg-gray-900 text-white rounded-[1.25rem] p-4 text-center shadow-md relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-full"></div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Código de Check-in</p>
                                                    <p className="text-2xl font-mono font-bold tracking-[0.25em] relative z-10">{agendamento.codigo_verificacao}</p>
                                                </div>
                                            )}
                                            
                                            {/* Status de Avaliação */}
                                            {isConcluido && agendamento.nota && (
                                                <div className="mb-6 flex items-center gap-2 bg-yellow-50/80 p-2.5 rounded-xl border border-yellow-100 w-max">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((estrela) => (
                                                            agendamento.nota >= estrela 
                                                            ? <StarIcon key={estrela} className="w-4 h-4 text-yellow-500" /> 
                                                            : <StarOutlineIcon key={estrela} className="w-4 h-4 text-gray-300" />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider pr-1">Avaliado</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* AÇÕES (Botões maiores p/ mobile) */}
                                        <div className="mt-4 space-y-3">
                                            {isEmAndamento ? (
                                                <button className="w-full py-4 bg-[#E05D36] text-white rounded-2xl text-sm font-bold hover:bg-[#C74B27] transition-all shadow-[0_4px_15px_rgba(224,93,54,0.3)]">
                                                    Acompanhar Atendimento
                                                </button>
                                            ) : isAguardandoPagamento ? (
                                                <>
                                                    <button onClick={() => pagarNovamente(agendamento.id)} disabled={loadingPagar === agendamento.id} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-[0_4px_15px_rgba(5,150,105,0.2)] disabled:opacity-70 flex justify-center items-center gap-2">
                                                        {loadingPagar === agendamento.id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
                                                        {loadingPagar === agendamento.id ? 'Processando...' : 'Finalizar Pagamento'}
                                                    </button>
                                                    <button onClick={() => cancelarVaga(agendamento.id, isPago)} disabled={loadingCancelar === agendamento.id} className="w-full text-xs font-bold text-gray-400 hover:text-red-500 py-3 transition-colors">
                                                        Cancelar Agendamento
                                                    </button>
                                                </>
                                            ) : isConcluido && !agendamento.nota ? (
                                                <button onClick={() => abrirModalAvaliacao(agendamento)} className="w-full py-4 bg-white border-2 border-[#E05D36] text-[#E05D36] rounded-2xl text-sm font-bold hover:bg-[#FFF2EE] transition-all shadow-sm">
                                                    Avaliar Experiência
                                                </button>
                                            ) : isConfirmado ? (
                                                <>
                                                    <button onClick={() => router.get(`/meus-pedidos/agendamento/${agendamento.id}`)} className="w-full py-4 bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl text-sm font-bold hover:border-gray-300 hover:bg-gray-100 transition-all">
                                                        Ver Detalhes
                                                    </button>
                                                    <button onClick={() => cancelarVaga(agendamento.id, isPago)} disabled={loadingCancelar === agendamento.id} className="w-full text-xs font-bold text-gray-400 hover:text-red-500 py-3 block text-center transition-colors">
                                                        Cancelar Agendamento
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => router.get(`/meus-pedidos/agendamento/${agendamento.id}`)} 
                                                    className="w-full py-4 bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl text-sm font-bold hover:border-gray-300 hover:bg-gray-100 transition-all"
                                                >
                                                    Ver Detalhes
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE AVALIAÇÃO REDESENHADO */}
            {modalAvaliacaoOpen && agendamentoParaAvaliar && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0">
                        <div className="p-8 pb-4 text-center">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Avaliar Serviço</h3>
                            <p className="text-gray-500 font-medium text-sm mt-2">Sua opinião ajuda outros clientes e melhora a qualidade do nosso app.</p>
                        </div>
                        
                        <form onSubmit={submitAvaliacao} className="p-8 pt-4 space-y-6">
                            <div className="flex justify-center gap-2 py-4">
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
                                            <StarIcon className="w-12 h-12 text-[#E05D36]" />
                                        ) : (
                                            <StarOutlineIcon className="w-12 h-12 text-gray-200" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                    Comentário (Opcional)
                                </label>
                                <textarea 
                                    className="w-full rounded-[1.25rem] border-gray-200 focus:border-[#E05D36] focus:ring-[#E05D36] shadow-sm font-medium text-sm p-4 bg-gray-50 resize-none transition-colors"
                                    rows="3"
                                    placeholder="Conte detalhes sobre o atendimento..."
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    maxLength={500}
                                ></textarea>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button type="button" onClick={fecharModalAvaliacao} className="order-2 sm:order-1 px-6 py-4 font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition w-full sm:w-1/3">
                                    Fechar
                                </button>
                                <button type="submit" disabled={enviandoAvaliacao} className="order-1 sm:order-2 px-6 py-4 font-bold text-sm text-white bg-[#E05D36] hover:bg-[#C74B27] rounded-2xl shadow-[0_4px_15px_rgba(224,93,54,0.3)] transition w-full sm:w-2/3 disabled:opacity-50 flex justify-center items-center gap-2">
                                    {enviandoAvaliacao && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                                    {enviandoAvaliacao ? 'Enviando...' : 'Confirmar Avaliação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Ocultar barra de rolagem (Adicione no seu CSS global se já não tiver) */}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </AuthenticatedLayout>
    );
}