import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { 
    ArrowLeftIcon, 
    CalendarIcon, 
    ChatBubbleLeftEllipsisIcon,
    DocumentTextIcon,
    BanknotesIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    XMarkIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid } from '@heroicons/react/24/solid';

export default function DetalheCliente({ auth, estabelecimento, paciente, triagem, proximoServico, servicos, financeiro, historicoServicos }) {
    // ==========================================
    // ESTADOS GERAIS E CALENDÁRIO
    // ==========================================
    const [abaHistorico, setAbaHistorico] = useState('todos');
    const [modalRemarcarOpen, setModalRemarcarOpen] = useState(false);
    
    const [dataFoco, setDataFoco] = useState(new Date()); 
    const [dataSelecionadaFormatada, setDataSelecionadaFormatada] = useState('');
    const [horaSelecionada, setHoraSelecionada] = useState(null);
    const [servicoSelecionado, setServicoSelecionado] = useState('');

    // Estados para carregar horários vindos da API real
    const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
    const [carregandoHorarios, setCarregandoHorarios] = useState(false);

    // Formulários controlados do Inertia
    const formNota = useForm({
        observacoes: triagem?.observacoes || ''
    });

    const formAgendamento = useForm({
        cliente_id: paciente?.id || '',
        estabelecimento_id: estabelecimento?.id || '',
        servico_id: '',
        data: '',
        hora: ''
    });

    // ==========================================
    // EFEITO: BUSCA HORÁRIOS REAIS DA API
    // ==========================================
    useEffect(() => {
        if (servicoSelecionado && dataSelecionadaFormatada) {
            setCarregandoHorarios(true);
            setHoraSelecionada(null); // Reseta hora anterior escolhida
            formAgendamento.setData('hora', '');

            fetch(`/api/servicos/${servicoSelecionado}/horarios-disponiveis?data=${dataSelecionadaFormatada}`)
                .then(res => res.json())
                .then(dados => {
                    setHorariosDisponiveis(dados || []);
                    setCarregandoHorarios(false);
                })
                .catch(err => {
                    console.error("Erro ao buscar horários reais:", err);
                    setHorariosDisponiveis([]);
                    setCarregandoHorarios(false);
                });
        } else {
            setHorariosDisponiveis([]);
        }
    }, [servicoSelecionado, dataSelecionadaFormatada]);

    // ==========================================
    // LÓGICA AUXILIAR DO CALENDÁRIO NATIVO
    // ==========================================
    const navegarMes = (direcao) => {
        const novoMes = new Date(dataFoco.setMonth(dataFoco.getMonth() + direcao));
        setDataFoco(new Date(novoMes));
    };

    const obterDiasDoMes = () => {
        const ano = dataFoco.getFullYear();
        const mes = dataFoco.getMonth();
        const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
        const totalDias = new Date(ano, mes + 1, 0).getDate();
        
        const matrizDias = [];
        for (let i = 0; i < primeiroDiaSemana; i++) matrizDias.push(null);
        for (let dia = 1; dia <= totalDias; dia++) matrizDias.push(new Date(ano, mes, dia));
        return matrizDias;
    };

    const nomeDoMesAtual = dataFoco.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const listaDias = obterDiasDoMes();

    const selecionarDia = (dataObjeto) => {
        const dataFormatadaBanco = dataObjeto.toISOString().split('T')[0];
        setDataSelecionadaFormatada(dataFormatadaBanco);
        formAgendamento.setData('data', dataFormatadaBanco);
    };

    // ==========================================
    // EVENTOS DE ENVIO (SUBMIT)
    // ==========================================
    const salvarNotaInterna = (e) => {
        e.preventDefault();
        if(!triagem?.id) {
            alert('Este paciente não possui um registro de triagem aberto para vincular notas no momento.');
            return;
        }
        formNota.post(route('triagens.salvarNota', triagem.id), { preserveScroll: true });
    };

    const enviarNovoAgendamento = (e) => {
        e.preventDefault();
        formAgendamento.post(route('agendamentos.remarcar'), {
            onSuccess: () => {
                setModalRemarcarOpen(false);
                setHoraSelecionada(null);
                setDataSelecionadaFormatada('');
                setServicoSelecionado('');
            }
        });
    };

    const servicosFiltrados = historicoServicos?.filter(item => {
        if (abaHistorico === 'todos') return true;
        return item.status === abaHistorico;
    }) || [];

    return (
        <AuthenticatedLayout user={auth.user}>
            <div className="min-h-screen bg-[#F9F9F9] font-sans pb-12">
                <Head title={`Detalhes - ${paciente?.nome || 'Cliente'}`} />

                {/* HEADER COM TITULO DO ESTABELECIMENTO */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/clientes" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition">
                            <ArrowLeftIcon className="w-4 h-4" /> Voltar
                        </Link>
                        <div className="h-6 w-px bg-gray-200"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold">
                                {estabelecimento?.nome ? estabelecimento.nome.charAt(0) : 'E'}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase leading-tight">{estabelecimento?.nome || 'Estabelecimento'}</p>
                                <p className="text-sm font-bold text-gray-900 leading-tight">Painel de Atendimento</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
                    {/* CABEÇALHO DO PERFIL */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <img src={paciente?.foto} alt={paciente?.nome} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm bg-gray-100" />
                                <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-400 border-2 border-white rounded-full flex items-center justify-center">
                                    <CheckSolid className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{paciente?.nome || 'Paciente'}</h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                                        {paciente?.status}
                                    </span>
                                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                        <ClockIcon className="w-4 h-4" /> Desde {paciente?.desde}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 👉 BOTAO DE INICIAR CHAT AJUSTADO AQUI */}
                        <Link 
                            href={route('mensagens.iniciar')} 
                            method="post"
                            data={{ 
                                usuario_id: paciente?.id, 
                                estabelecimento_id: estabelecimento?.id 
                            }}
                            as="button"
                            className="bg-[#006B4D] hover:bg-[#00553D] text-white px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" /> Enviar Mensagem
                        </Link>
                    </div>

                    {/* GRID PRINCIPAL */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                    
                            <div className="bg-gradient-to-r from-white to-emerald-50 border border-gray-100 rounded-3xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6">
                                {proximoServico ? (
                                    <div className="flex items-start gap-5">
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100 shrink-0">
                                            <CalendarIcon className="w-7 h-7 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                {proximoServico?.tipo === 'Triagem' ? 'Fila de Espera Atual' : 'Status da Consulta'}
                                            </p>
                                            <h2 className="text-2xl font-black text-gray-900">{proximoServico?.data_formatada}, {proximoServico?.hora}</h2>
                                            <p className="text-sm text-gray-600 mt-1 font-medium flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                {proximoServico?.servico} — <span className="text-gray-400">{proximoServico?.profissional}</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-5">
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 shrink-0">
                                            <CalendarIcon className="w-7 h-7 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Próximo Serviço</p>
                                            <h2 className="text-xl font-bold text-gray-400 mt-1">Sem agendamentos futuros</h2>
                                        </div>
                                    </div>
                                )}
                                <button onClick={() => setModalRemarcarOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-colors shadow-sm">
                                    Remarcar / Agendar
                                </button>
                            </div>

                            {/* CARD: DADOS PESSOAIS */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
                                    <DocumentTextIcon className="w-5 h-5 text-emerald-600" /> Dados Pessoais
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">E-mail</p>
                                        <p className="text-gray-900 font-medium">{paciente?.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Telefone</p>
                                        <p className="text-gray-900 font-medium">{paciente?.telefone}</p>
                                    </div>
                                </div>
                            </div>

                            {/* CARD: HISTORICO */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col h-[400px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <ClockIcon className="w-5 h-5 text-emerald-600" /> Histórico de Serviços
                                    </h3>
                                    <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100">
                                        <button onClick={() => setAbaHistorico('todos')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${abaHistorico === 'todos' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Todos</button>
                                        <button onClick={() => setAbaHistorico('concluido')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${abaHistorico === 'concluido' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>Concluídos</button>
                                        <button onClick={() => setAbaHistorico('cancelado')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${abaHistorico === 'cancelado' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500'}`}>Cancelados</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative">
                                    <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-100"></div>
                                    <div className="space-y-6 relative">
                                        {servicosFiltrados.length > 0 ? servicosFiltrados.map((item) => (
                                            <div key={item.id} className="relative pl-16">
                                                <div className={`absolute left-[11px] top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white z-10 ${item.status === 'concluido' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                    {item.status === 'concluido' ? <CheckSolid className="w-4 h-4 text-emerald-500" /> : <XMarkIcon className="w-4 h-4 text-gray-400" />}
                                                </div>
                                                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-gray-900">{item.servico}</h4>
                                                            <p className="text-sm text-gray-500 mt-0.5">{item.profissional}</p>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-400">{item.data}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-gray-500 text-center py-10">Nenhum registro encontrado nesta categoria.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                      
                        <div className="space-y-6">
                            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
                                    <BanknotesIcon className="w-5 h-5 text-emerald-600" /> Histórico Financeiro
                                </h3>
                                <div className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-100">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Movimentado</p>
                                    <p className="text-2xl font-black text-gray-900">R$ {financeiro?.total_gasto || '0,00'}</p>
                                </div>
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                                    <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-1">Valores em Aberto</p>
                                    <p className="text-2xl font-black text-red-600 mb-2">R$ {financeiro?.pendente || '0,00'}</p>
                                    <p className="text-xs text-red-500/80 font-medium mb-4">{financeiro?.referencia_pendente}</p>
                                    <button className="w-full bg-white text-red-600 font-bold text-sm py-2.5 rounded-xl border border-red-100 shadow-sm hover:bg-red-50 transition-colors">
                                        Enviar Cobrança
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                    <DocumentTextIcon className="w-5 h-5 text-emerald-600" /> Notas da Triagem
                                </h3>
                                <form onSubmit={salvarNotaInterna}>
                                    <textarea 
                                        className="w-full bg-[#E5E9EC] border-none rounded-2xl p-4 text-sm text-gray-700 font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none placeholder-gray-400 mb-4 h-32"
                                        placeholder="Adicionar observações clínicas sobre o paciente..."
                                        value={formNota.data.observacoes}
                                        onChange={(e) => formNota.setData('observacoes', e.target.value)}
                                        disabled={formNota.processing}
                                    ></textarea>
                                    <div className="flex justify-end">
                                        <button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-colors shadow-sm disabled:opacity-50" disabled={formNota.processing}>
                                            {formNota.processing ? 'Gravando...' : 'Salvar Nota'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

              
                {modalRemarcarOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fadeIn">
                        <form onSubmit={enviarNovoAgendamento} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                            
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Agendar Procedimento</h3>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Selecione o serviço e verifique a disponibilidade real do banco</p>
                                </div>
                                <button type="button" onClick={() => setModalRemarcarOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 bg-gray-50 overflow-y-auto max-h-[70vh] space-y-5">
                                
                                {/* 1. SELECT DO SERVIÇO */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Procedimento Desejado</label>
                                    <select 
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none shadow-sm"
                                        value={servicoSelecionado}
                                        required
                                        onChange={(e) => {
                                            setServicoSelecionado(e.target.value);
                                            formAgendamento.setData('servico_id', e.target.value);
                                        }}
                                    >
                                        <option value="">Selecione um serviço cadastrado...</option>
                                        {servicos?.map(s => (
                                            <option key={s.id} value={s.id}>{s.nome} — R$ {number_format(s.valor, 2, ',', '.')}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 2. CALENDÁRIO INTERATIVO */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Selecione o Dia</label>
                                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <button type="button" onClick={() => navegarMes(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeftIcon className="w-5 h-5"/></button>
                                            <span className="font-bold text-gray-900 text-sm capitalize">{nomeDoMesAtual}</span>
                                            <button type="button" onClick={() => navegarMes(1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRightIcon className="w-5 h-5"/></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-2 text-center">
                                            {['D','S','T','Q','Q','S','S'].map((dia, idx) => <div key={idx} className="text-[10px] font-bold text-gray-400 mb-2">{dia}</div>)}
                                            {listaDias.map((dataInstancia, i) => {
                                                if (!dataInstancia) return <div key={`empty-${i}`} />;
                                                
                                                const diaNum = dataInstancia.getDate();
                                                const stringBanco = dataInstancia.toISOString().split('T')[0];
                                                const isSelected = dataSelecionadaFormatada === stringBanco;
                                                const isPast = dataInstancia < new Date().setHours(0,0,0,0);

                                                return (
                                                    <button 
                                                        type="button"
                                                        key={stringBanco}
                                                        disabled={isPast}
                                                        onClick={() => selecionarDia(dataInstancia)}
                                                        className={`w-8 h-8 mx-auto rounded-full text-sm font-semibold flex items-center justify-center transition-all
                                                            ${isPast ? 'text-gray-200 cursor-not-allowed' : 
                                                            isSelected ? 'bg-emerald-600 text-white shadow-md' : 
                                                            'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
                                                    >
                                                        {diaNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                              
                                {servicoSelecionado && dataSelecionadaFormatada && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Horários Disponíveis no Banco</label>
                                        
                                        {carregandoHorarios ? (
                                            <div className="text-center py-4 text-xs font-semibold text-gray-500">
                                                Consultando agenda no banco de dados...
                                            </div>
                                        ) : horariosDisponiveis.length > 0 ? (
                                            <div className="grid grid-cols-4 gap-3">
                                                {horariosDisponiveis.map(hora => (
                                                    <button
                                                        type="button"
                                                        key={hora}
                                                        onClick={() => {
                                                            setHoraSelecionada(hora);
                                                            formAgendamento.setData('hora', hora);
                                                        }}
                                                        className={`py-2 rounded-xl text-sm font-bold border transition-all
                                                            ${horaSelecionada === hora 
                                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700'}`}
                                                    >
                                                        {hora}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-xs font-medium border border-amber-100">
                                                Nenhum horário livre encontrado para este serviço no dia selecionado. Tente outro dia.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setModalRemarcarOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-50 text-sm transition">
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!dataSelecionadaFormatada || !horaSelecionada || !servicoSelecionado || formAgendamento.processing}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {formAgendamento.processing ? 'Agendando...' : 'Confirmar Agendamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                
                <style dangerouslySetInnerHTML={{__html: `
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #E5E7EB; border-radius: 10px; }
                    .animate-fadeIn { animation: fadeIn 0.2s ease-in-out; }
                    @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                `}} />
            </div>
        </AuthenticatedLayout>
    );
}

function number_format(number, decimals, dec_point, thousands_sep) {
    if (number === null || number === undefined) return '0,00';
    number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
    var n = !isFinite(+number) ? 0 : +number,
        prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
        sep = (typeof thousands_sep === 'undefined') ? '.' : thousands_sep,
        dec = (typeof dec_point === 'undefined') ? ',' : dec_point,
        s = '',
        toFixedFix = function (n, prec) {
            var k = Math.pow(10, prec);
            return '' + Math.round(n * k) / k;
        };
    s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join(' ');
    }
    return s.join(dec);
}