import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
// Importação do Layout Anticare adicionada aqui
import AnticareLayout from '@/Layouts/AnticareLayout'; 
import { 
    ArrowLeftIcon, 
    CalendarIcon, 
    ChatBubbleLeftEllipsisIcon,
    DocumentTextIcon,
    BanknotesIcon,
    ClockIcon,
    XMarkIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    PhoneIcon,
    EnvelopeIcon,
    UserIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

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

    const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
    const [carregandoHorarios, setCarregandoHorarios] = useState(false);

    // Formatação de Moeda Nativa (Substitui number_format legado)
    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

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
            setHoraSelecionada(null);
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
    // SUBMITS
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
        <AnticareLayout user={auth.user}>
            <Head title={`Detalhes - ${paciente?.nome || 'Cliente'}`} />

            <div className="min-h-screen bg-slate-50/60 font-sans pb-16">
                {/* BARRA SUPERIOR DE NAVEGAÇÃO E IDENTIFICAÇÃO */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3 transition-all">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <Link 
                            href="/clientes" 
                            className="inline-flex items-center gap-2 text-slate-600 hover:text-emerald-700 font-semibold text-xs sm:text-sm transition-colors py-1.5 px-3 rounded-xl hover:bg-slate-100"
                        >
                            <ArrowLeftIcon className="w-4 h-4 stroke-[2.5]" /> 
                            <span>Voltar para Clientes</span>
                        </Link>

                        <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-100/80 px-3 py-1.5 rounded-2xl">
                            <div className="w-7 h-7 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                {estabelecimento?.nome ? estabelecimento.nome.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider leading-none">
                                    {estabelecimento?.nome || 'Estabelecimento'}
                                </p>
                                <p className="text-xs font-semibold text-slate-700 leading-tight">Painel do Cliente</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6">
                    {/* CABEÇALHO DO PERFIL DO CLIENTE */}
                    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-5 text-center sm:text-left">
                            <div className="relative group shrink-0">
                                {paciente?.foto ? (
                                    <img 
                                        src={paciente?.foto} 
                                        alt={paciente?.nome} 
                                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white shadow-md ring-4 ring-slate-100" 
                                    />
                                ) : (
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 border-2 border-white shadow-md ring-4 ring-slate-100 flex items-center justify-center text-emerald-700 font-bold text-2xl">
                                        {paciente?.nome ? paciente.nome.substring(0, 2).toUpperCase() : <UserIcon className="w-10 h-10 text-emerald-600" />}
                                    </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm" title="Cliente Ativo">
                                    <CheckSolid className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    {paciente?.nome || 'Paciente sem nome'}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100/80 text-emerald-800 uppercase tracking-wider">
                                        {paciente?.status || 'Ativo'}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
                                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                                        Cliente desde {paciente?.desde || 'Data não inf.'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-auto">
                            <Link 
                                href={route('mensagens.iniciar')} 
                                method="post"
                                data={{ 
                                    usuario_id: paciente?.id, 
                                    estabelecimento_id: estabelecimento?.id 
                                }}
                                as="button"
                                className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm hover:shadow-emerald-700/20"
                            >
                                <ChatBubbleLeftEllipsisIcon className="w-5 h-5" /> 
                                <span>Iniciar Conversa</span>
                            </Link>
                        </div>
                    </section>

                    {/* GRID DE CONTEÚDO PRINCIPAL */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* COLUNA ESQUERDA - CONTEÚDO PRINCIPAL (2 Colunas no Desktop) */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* CARD: PRÓXIMO AGENDAMENTO / DESTAQUE (FUNDO PRETO REMOVIDO) */}
                            <div className="relative overflow-hidden bg-white border border-emerald-100 rounded-3xl p-6 sm:p-8 text-slate-800 shadow-sm transition-all hover:shadow-md">
                                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-emerald-50 rounded-full blur-2xl pointer-events-none"></div>
                                
                                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    {proximoServico ? (
                                        <div className="flex items-start gap-4 sm:gap-5">
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0">
                                                <CalendarIcon className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
                                            </div>
                                            <div>
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 mb-2">
                                                    <SparklesIcon className="w-3 h-3 text-emerald-600" />
                                                    {proximoServico?.tipo === 'Triagem' ? 'Fila de Espera Atual' : 'Próximo Agendamento'}
                                                </span>
                                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                                    {proximoServico?.data_formatada}, às {proximoServico?.hora}
                                                </h2>
                                                <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
                                                    <span className="font-semibold text-slate-700">{proximoServico?.servico}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-emerald-700">{proximoServico?.profissional}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0">
                                                <CalendarIcon className="w-6 h-6 text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Agendamentos</p>
                                                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Sem horários futuros marcados</h2>
                                                <p className="text-xs text-slate-500 mt-1">Clique ao lado para agendar um procedimento.</p>
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => setModalRemarcarOpen(true)} 
                                        className="w-full sm:w-auto shrink-0 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-emerald-600/20 text-center"
                                    >
                                        Remarcar / Agendar
                                    </button>
                                </div>
                            </div>

                            {/* CARD: DADOS PESSOAIS */}
                            <div className="bg-white border border-slate-200/70 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-6">
                                    <DocumentTextIcon className="w-5 h-5 text-emerald-600" />
                                    <span>Informações de Contato</span>
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                                        <div className="p-2 bg-white rounded-xl text-slate-500 shadow-sm">
                                            <EnvelopeIcon className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail</p>
                                            <p className="text-sm font-semibold text-slate-800 truncate">{paciente?.email || 'Não informado'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                                        <div className="p-2 bg-white rounded-xl text-slate-500 shadow-sm">
                                            <PhoneIcon className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefone / WhatsApp</p>
                                            <p className="text-sm font-semibold text-slate-800">{paciente?.telefone || 'Não informado'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CARD: HISTÓRICO DE SERVIÇOS */}
                            <div className="bg-white border border-slate-200/70 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col h-[460px] hover:shadow-md transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                                        <ClockIcon className="w-5 h-5 text-emerald-600" />
                                        <span>Histórico de Atendimentos</span>
                                    </h3>
                                    
                                    <div className="inline-flex p-1 bg-slate-100/80 rounded-xl gap-1">
                                        {['todos', 'concluido', 'cancelado'].map((tab) => (
                                            <button 
                                                key={tab}
                                                onClick={() => setAbaHistorico(tab)} 
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                                                    abaHistorico === tab 
                                                        ? 'bg-white text-emerald-800 shadow-sm' 
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                {tab === 'concluido' ? 'Concluídos' : tab === 'cancelado' ? 'Cancelados' : 'Todos'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                                    {servicosFiltrados.length > 0 ? servicosFiltrados.map((item) => (
                                        <div key={item.id} className="relative pl-6 border-l-2 border-slate-100 hover:border-emerald-500 transition-colors py-1 group">
                                            <div className={`absolute -left-[9px] top-2.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                                                item.status === 'concluido' ? 'bg-emerald-500' : 'bg-rose-500'
                                            }`} />
                                            
                                            <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all group-hover:shadow-sm">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-sm">{item.servico}</h4>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">{item.profissional}</p>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-400 bg-white border border-slate-200/60 px-2 py-0.5 rounded-md shrink-0">
                                                        {item.data}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                            <ClockIcon className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
                                            <p className="text-sm font-medium">Nenhum histórico encontrado para o filtro selecionado.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUNA DIREITA - PAINEL FINANCEIRO E NOTAS */}
                        <div className="space-y-6">
                            
                            {/* CARD: FINANCEIRO */}
                            <div className="bg-white border border-slate-200/70 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-6">
                                    <BanknotesIcon className="w-5 h-5 text-emerald-600" />
                                    <span>Resumo Financeiro</span>
                                </h3>

                                <div className="space-y-4">
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Movimentado</p>
                                        <p className="text-2xl font-black text-slate-900">
                                            {formatarMoeda(financeiro?.total_gasto)}
                                        </p>
                                    </div>

                                    <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Valores em Aberto</p>
                                            <ExclamationTriangleIcon className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <p className="text-2xl font-black text-rose-600">
                                            {formatarMoeda(financeiro?.pendente)}
                                        </p>
                                        {financeiro?.referencia_pendente && (
                                            <p className="text-xs text-rose-600/80 font-medium mt-1 mb-3">
                                                {financeiro.referencia_pendente}
                                            </p>
                                        )}
                                        <button className="w-full mt-2 bg-white text-rose-600 font-bold text-xs py-2.5 rounded-xl border border-rose-200 shadow-sm hover:bg-rose-100/50 active:scale-[0.98] transition-all">
                                            Enviar Lembrete de Cobrança
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* CARD: NOTAS DA TRIAGEM */}
                            <div className="bg-white border border-slate-200/70 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-4">
                                    <DocumentTextIcon className="w-5 h-5 text-emerald-600" />
                                    <span>Anotações Clínicas</span>
                                </h3>

                                <form onSubmit={salvarNotaInterna} className="space-y-4">
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none placeholder:text-slate-400 transition-all h-36"
                                        placeholder="Adicione observações internas sobre a triagem ou o estado do paciente..."
                                        value={formNota.data.observacoes}
                                        onChange={(e) => formNota.setData('observacoes', e.target.value)}
                                        disabled={formNota.processing}
                                    />
                                    <div className="flex justify-end">
                                        <button 
                                            type="submit" 
                                            className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50" 
                                            disabled={formNota.processing}
                                        >
                                            {formNota.processing ? 'Gravando...' : 'Salvar Anotação'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </div>
                </main>

                {/* MODAL: REMARCAR / AGENDAR */}
                {modalRemarcarOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-500/40 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                            
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Agendar Procedimento</h3>
                                    <p className="text-xs text-slate-500 font-medium">Selecione o serviço e escolha um horário disponível</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setModalRemarcarOpen(false)} 
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={enviarNovoAgendamento} className="flex flex-col flex-1 overflow-hidden">
                                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                    
                                    {/* SELECT SERVIÇO */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Procedimento Desejado
                                        </label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                                            value={servicoSelecionado}
                                            required
                                            onChange={(e) => {
                                                setServicoSelecionado(e.target.value);
                                                formAgendamento.setData('servico_id', e.target.value);
                                            }}
                                        >
                                            <option value="">Selecione um serviço...</option>
                                            {servicos?.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.nome} — {formatarMoeda(s.valor)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* CALENDÁRIO */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Selecione o Dia
                                        </label>
                                        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <button type="button" onClick={() => navegarMes(-1)} className="p-1 hover:bg-white rounded-lg text-slate-600 shadow-xs"><ChevronLeftIcon className="w-4 h-4"/></button>
                                                <span className="font-bold text-slate-800 text-xs capitalize">{nomeDoMesAtual}</span>
                                                <button type="button" onClick={() => navegarMes(1)} className="p-1 hover:bg-white rounded-lg text-slate-600 shadow-xs"><ChevronRightIcon className="w-4 h-4"/></button>
                                            </div>
                                            
                                            <div className="grid grid-cols-7 gap-1 text-center">
                                                {['D','S','T','Q','Q','S','S'].map((dia, idx) => (
                                                    <div key={idx} className="text-[10px] font-bold text-slate-400 mb-1">{dia}</div>
                                                ))}
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
                                                            className={`w-8 h-8 mx-auto rounded-xl text-xs font-semibold flex items-center justify-center transition-all
                                                                ${isPast ? 'text-slate-300 cursor-not-allowed' : 
                                                                isSelected ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20' : 
                                                                'text-slate-700 hover:bg-emerald-100/60 hover:text-emerald-800'}`}
                                                        >
                                                            {diaNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* HORÁRIOS */}
                                    {servicoSelecionado && dataSelecionadaFormatada && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                Horários Livres
                                            </label>
                                            
                                            {carregandoHorarios ? (
                                                <div className="text-center py-6 text-xs font-medium text-slate-400 animate-pulse">
                                                    Consultando agenda disponível...
                                                </div>
                                            ) : horariosDisponiveis.length > 0 ? (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                    {horariosDisponiveis.map(hora => (
                                                        <button
                                                            type="button"
                                                            key={hora}
                                                            onClick={() => {
                                                                setHoraSelecionada(hora);
                                                                formAgendamento.setData('hora', hora);
                                                            }}
                                                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                                                                horaSelecionada === hora 
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
                                                            }`}
                                                        >
                                                            {hora}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs font-medium border border-amber-200/80">
                                                    Sem horários disponíveis para este dia. Escolha outra data.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setModalRemarcarOpen(false)} 
                                        className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200/60 text-xs transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={!dataSelecionadaFormatada || !horaSelecionada || !servicoSelecionado || formAgendamento.processing}
                                        className="px-5 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-xs hover:bg-emerald-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {formAgendamento.processing ? 'Agendando...' : 'Confirmar Agendamento'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AnticareLayout>
    );
}