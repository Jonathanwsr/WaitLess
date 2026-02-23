import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import TextInput from '@/Components/TextInput';

export default function ClienteDashboard({ auth, agendamentos = [], usuario }) {
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');
    
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
            agendamento.status_pagamento === 'pago' || agendamento.status_pagamento === 'presencial' || agendamento.status === 'cancelado' || agendamento.status_pagamento === 'estornado') {
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

    // 👉 NOVA FUNÇÃO DE CANCELAR VAGA
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

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">Olá, {primeiroNome} 👋</h2>}>
            <Head title="Meu Painel - WaitLess" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
                
                {flash?.success && <div className="p-4 text-green-800 bg-green-100 border border-green-200 rounded-xl shadow-sm animate-in fade-in"><strong>✅ Sucesso:</strong> {flash.success}</div>}
                {flash?.warning && <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-xl shadow-sm animate-in fade-in"><strong>⚠️ Atenção:</strong> {flash.warning}</div>}
                {flash?.error && <div className="p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl shadow-sm animate-in fade-in"><strong>❌ Oops:</strong> {flash.error}</div>}

                <div className="bg-indigo-600 rounded-3xl p-8 shadow-lg relative">
                    <h3 className="text-2xl font-extrabold text-white mb-2">Encontre e agende um serviço</h3>
                    <form onSubmit={fazerBusca} className="mt-4 flex flex-col md:flex-row gap-3">
                        <TextInput type="text" className="w-full py-3 px-6 rounded-xl border-0" placeholder="Ex: Barbearia do João..." value={busca} onChange={e => setBusca(e.target.value)} />
                        <select className="w-full md:w-64 py-3 px-4 border-0 rounded-xl" value={categoria} onChange={e => setCategoria(e.target.value)}>
                            <option value="">Todas as Categorias</option>
                            <option value="Beleza e Estética">Beleza e Estética</option>
                        </select>
                        <button type="submit" className="bg-gray-900 text-white px-8 py-3 font-bold rounded-xl shadow-md hover:bg-gray-800 transition">Procurar</button>
                    </form>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">📅 Meus Agendamentos</h3>

                    {!agendamentos || agendamentos.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm">
                            <h4 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Você não possui agendamentos!</h4>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {agendamentos.map((agendamento) => {
                                const statusTempo = verificarExpiracao(agendamento);
                                const isPago = agendamento.status_pagamento === 'pago';
                                const isEstornado = agendamento.status_pagamento === 'estornado';
                                const isPresencial = agendamento.status_pagamento === 'presencial';
                                const isConfirmado = isPago || isPresencial;
                                const isCanceladoDefinitivo = statusTempo.cancelado || isEstornado || (statusTempo.expirou && !isConfirmado);
                                const isAguardandoPagamento = agendamento.status === 'aguardando_pagamento' && !isCanceladoDefinitivo && !isConfirmado;

                                const isCarregandoPagamento = loadingPagar === agendamento.id;
                                const isCarregandoCancelamento = loadingCancelar === agendamento.id;

                                return (
                                    <div key={agendamento.id} className={`rounded-2xl overflow-hidden border shadow-sm flex flex-col transition-all ${isCanceladoDefinitivo ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700 opacity-80' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                        
                                        <div className={`p-5 border-b ${isCanceladoDefinitivo ? 'bg-gray-200 dark:bg-gray-700' : (isAguardandoPagamento ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-500 border-green-600 text-white')}`}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className={`text-sm font-medium ${isCanceladoDefinitivo ? 'text-gray-600 dark:text-gray-400' : (isAguardandoPagamento ? 'text-yellow-700 dark:text-yellow-500' : 'text-green-100')}`}>Status do Agendamento</p>
                                                    <h4 className={`text-xl font-extrabold ${isCanceladoDefinitivo ? (isEstornado ? '❌ Cancelado & Estornado' : '❌ Cancelado') : (isAguardandoPagamento ? '⚠️ Pagamento Online Pendente' : (isPresencial ? '✅ Pagar no Local' : '✅ Confirmado (Pago)'))}`}>
                                                        {isCanceladoDefinitivo ? (isEstornado ? '❌ Reembolsado' : '❌ Cancelado') : (isAguardandoPagamento ? '⚠️ Pendente' : (isPresencial ? '✅ Pagar no Local' : '✅ Confirmado'))}
                                                    </h4>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xl font-bold py-1 px-3 rounded-lg ${isConfirmado ? 'bg-white/20 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'}`}>
                                                        {agendamento?.hora_agendamento ? agendamento.hora_agendamento.substring(0, 5) : '--:--'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{agendamento?.estabelecimento?.nome || 'Loja Indisponível'}</h4>
                                            
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 my-4 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{agendamento?.servico?.nome || 'Serviço Indisponível'}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Data: {formatarData(agendamento?.data_agendamento)}</p>
                                                </div>
                                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatarMoeda(agendamento?.valor_final)}</p>
                                            </div>

                                            {isConfirmado && !isCanceladoDefinitivo && agendamento?.codigo_verificacao && (
                                                <div className="mb-4 p-4 border border-dashed border-green-300 bg-green-50 dark:bg-green-900/20 rounded-xl flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">PIN de Liberação</p>
                                                    </div>
                                                    <div className="text-3xl font-black text-green-700 dark:text-green-400 tracking-widest">{agendamento.codigo_verificacao}</div>
                                                </div>
                                            )}

                                            <div className="mt-auto space-y-3">
                                                {/* Botão de Pagar (Se estiver pendente) */}
                                                {isAguardandoPagamento && (
                                                    <button type="button" onClick={() => pagarNovamente(agendamento.id)} disabled={isCarregandoPagamento || isCarregandoCancelamento} className="w-full py-3 text-white font-bold rounded-xl shadow-sm transition bg-yellow-500 hover:bg-yellow-600">
                                                        {isCarregandoPagamento ? '⏳ A gerar link...' : '💳 Pagar Agora'}
                                                    </button>
                                                )}

                                                {/* Botão de Cancelar (Apenas se não estiver já cancelado) */}
                                                {!isCanceladoDefinitivo && (
                                                    <button type="button" onClick={() => cancelarVaga(agendamento.id, isPago)} disabled={isCarregandoCancelamento || isCarregandoPagamento} className="w-full py-3 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-xl shadow-sm transition border border-red-200">
                                                        {isCarregandoCancelamento ? '⏳ A cancelar...' : '❌ Cancelar Reserva'}
                                                    </button>
                                                )}

                                                {/* Botão de Agendar Novamente (Se estiver cancelado) */}
                                                {isCanceladoDefinitivo && route().has('cliente.agendar') && agendamento?.estabelecimento_id && (
                                                    <Link href={route('cliente.agendar', agendamento.estabelecimento_id)} className="block text-center w-full py-3 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-xl shadow-sm transition">
                                                        🔄 Agendar em outro horário
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
        </AuthenticatedLayout>
    );
}