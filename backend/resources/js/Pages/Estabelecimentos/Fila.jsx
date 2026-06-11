import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    CalendarIcon, 
    FunnelIcon, 
    AdjustmentsHorizontalIcon, 
    CheckCircleIcon,
    ChevronLeftIcon,
    BellIcon,
    UserIcon,
    TrashIcon,
    PencilSquareIcon,
    PlusIcon,
    XMarkIcon,
    EllipsisVerticalIcon,
    ClockIcon,
    CreditCardIcon,
    UserGroupIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid } from '@heroicons/react/24/solid';

// ==============================================================================
// SUB-COMPONENTE: Linha da Tabela
// ==============================================================================
const LinhaAgendamento = ({ item, index, currentPage, perPage, funcionarios, atribuirFuncionario, atualizarStatus, formatarMoeda, abrirModalFinalizar }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const posicao = (currentPage - 1) * perPage + index + 1;

    const isPago = item.status_pagamento === 'pago_online' || item.status_pagamento === 'pago_presencial';
    const isPresencial = item.status_pagamento === 'presencial';

    const getColors = () => {
        if (isPago) return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: <CheckCircleIcon className="w-4 h-4" /> };
        if (isPresencial) return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: <CreditCardIcon className="w-4 h-4" /> };
        return { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-100', icon: <ClockIcon className="w-4 h-4" /> };
    };

    const colors = getColors();

    const renderPaymentBadge = () => {
        let label = 'Pendente';
        if (isPago) label = 'Pago';
        if (isPresencial) label = 'Pagamento presencial';

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} ${colors.border} border`}>
                {colors.icon} {label}
            </span>
        );
    };

    return (
        <tr className="group hover:bg-gray-50/50 transition-colors duration-200 border-b border-gray-100 last:border-0">
            <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                <div className={`mx-auto flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold bg-white border shadow-sm ${colors.text} border-gray-100`}>
                    {posicao}
                </div>
            </td>

            <td className="px-6 py-4 whitespace-nowrap align-middle">
                <div className="flex items-center gap-3">
                    {item.usuario?.foto_perfil ? (
                        <img 
                            src={`/storage/${item.usuario.foto_perfil}`} 
                            alt={item.usuario.name} 
                            className="w-9 h-9 rounded-full object-cover shadow-sm"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                            <UserIcon className="w-5 h-5" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <div className="font-bold text-gray-900 text-sm">{item.usuario?.name || 'Cliente'}</div>
                        <span className="text-xs text-gray-500 mt-0.5">
                            {item.usuario?.idade ? `${item.usuario.idade} anos • ` : ''} 
                            {item.usuario?.cpf ? `CPF ${item.usuario.cpf}` : (item.usuario?.telefone || 'S/ Contato')}
                        </span>
                    </div>
                </div>
            </td>

            <td className="px-6 py-4 whitespace-nowrap align-middle">
                <div className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-900 text-sm">
                            {item.hora_agendamento ? item.hora_agendamento.substring(0, 5) : '--:--'}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium mt-0.5">
                            {item.data_agendamento ? new Date(item.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                        </span>
                    </div>
                </div>
            </td>

            <td className="px-6 py-4 whitespace-nowrap align-middle">
                <div className="flex flex-col items-start">
                    <span className="font-semibold text-gray-900 text-sm truncate max-w-[180px]">
                        {item.servico?.nome || 'Serviço Excluído'}
                    </span>
                    <select 
                        className="bg-transparent border-none p-0 text-[11px] text-gray-500 font-medium focus:ring-0 outline-none cursor-pointer hover:text-gray-700 transition appearance-none"
                        value={item.funcionario_id || ''}
                        onChange={(e) => atribuirFuncionario(item.id, e.target.value)}
                        disabled={item.status === 'finalizado' || item.status === 'concluido'}
                    >
                        <option value="">Atribuir Profissional...</option>
                        {funcionarios?.map(f => (
                            <option key={f.id} value={f.id}>Dr. {f.nome.split(' ')[0]}</option>
                        ))}
                    </select>
                </div>
            </td>

            <td className="px-6 py-4 text-center whitespace-nowrap align-middle">
                {renderPaymentBadge()}
            </td>

            <td className="px-6 py-4 text-center whitespace-nowrap align-middle relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                    <EllipsisVerticalIcon className="w-5 h-5" />
                </button>

                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50 overflow-hidden">
                            {item.status === 'pendente' && (
                                <button onClick={() => { atualizarStatus(item.id, 'confirmado'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                                    Chamar Cliente
                                </button>
                            )}
                            {item.status === 'confirmado' && (
                                <button onClick={() => { abrirModalFinalizar(item); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 font-semibold">
                                    Finalizar Atendimento
                                </button>
                            )}
                            <button onClick={() => { if(window.confirm('Cancelar este agendamento?')) atualizarStatus(item.id, 'cancelado'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">
                                Cancelar Agendamento
                            </button>
                        </div>
                    </>
                )}
            </td>
        </tr>
    );
};

// ==============================================================================
// COMPONENTE PRINCIPAL (FILA)
// ==============================================================================
export default function Fila({ auth, estabelecimento, estabelecimentos = [], agendamentos, filtros, funcionarios = [] }) {
    const { flash = {}, errors } = usePage().props;
    const dataHoje = new Date().toISOString().split('T')[0];

    const atualEstabelecimentoId = estabelecimento?.id || '';
    const selectValue = atualEstabelecimentoId || 'todos';

    const [params, setParams] = useState({
        data_inicio: filtros?.data_inicio || dataHoje,
        data_fim: filtros?.data_fim || dataHoje,
        ordem: filtros?.ordem || 'asc',
        status: filtros?.status || 'todos',
        status_pagamento: filtros?.status_pagamento || 'todos',
        per_page: filtros?.per_page || '10',
    });

    const [showFilters, setShowFilters] = useState(false);
    const [modalFinalizar, setModalFinalizar] = useState({ isOpen: false, agendamento: null, desconto: 0, formaPagamento: 'pix', processando: false });

    const handleTrocaFila = (e) => {
        const valor = e.target.value;
        if (valor === 'todos') {
            router.get(route('fila.index'));
        } else {
            router.get(route('estabelecimentos.fila', valor));
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const URL_ROTA = atualEstabelecimentoId ? route('estabelecimentos.fila', atualEstabelecimentoId) : route('fila.index');
            router.get(URL_ROTA, params, { preserveScroll: true, preserveState: true, replace: true, only: ['agendamentos'] });
        }, 30000); 
        return () => clearInterval(interval);
    }, [params, atualEstabelecimentoId]);

    const aplicarFiltros = (novosParametros) => {
        setParams(novosParametros);
        const URL_ROTA = atualEstabelecimentoId ? route('estabelecimentos.fila', atualEstabelecimentoId) : route('fila.index');
        router.get(URL_ROTA, novosParametros, { preserveState: true, preserveScroll: true, replace: true, only: ['agendamentos', 'filtros'] });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        aplicarFiltros({ ...params, [name]: value });
    };

    const atualizarStatus = (id, novoStatus) => {
        router.patch(route('agendamentos.update-status', id), { status: novoStatus }, { preserveScroll: true, preserveState: true });
    };

    const atribuirFuncionario = (agendamentoId, funcionarioId) => {
        router.patch(route('agendamentos.update-funcionario', agendamentoId), { funcionario_id: funcionarioId }, { preserveScroll: true, preserveState: true });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    const errorMsg = flash?.error || (Object.keys(errors).length > 0 ? Object.values(errors)[0] : null);

    const abrirModalFinalizar = (item) => setModalFinalizar({ isOpen: true, agendamento: item, desconto: 0, formaPagamento: 'pix', processando: false });
    const fecharModalFinalizar = () => setModalFinalizar({ ...modalFinalizar, isOpen: false, agendamento: null });
    const confirmarFinalizacao = () => {
        setModalFinalizar(prev => ({ ...prev, processando: true }));
        router.post(route('lojista.agendamento.finalizar', modalFinalizar.agendamento.id), {
            desconto: modalFinalizar.desconto, forma_pagamento: modalFinalizar.formaPagamento
        }, { preserveScroll: true, onSuccess: () => fecharModalFinalizar(), onError: () => setModalFinalizar(prev => ({ ...prev, processando: false })) });
    };

    const metricas = {
        total: agendamentos?.total || 0,
        pagos: agendamentos?.data?.filter(a => a.status_pagamento === 'pago_online' || a.status_pagamento === 'pago_presencial').length || 0,
        pendentes: agendamentos?.data?.filter(a => a.status === 'pendente' || a.status_pagamento === 'pendente').length || 0,
        presencial: agendamentos?.data?.filter(a => a.status_pagamento === 'presencial').length || 0,
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Fila de Atendimento" />

            <div className="min-h-screen bg-[#FBF9F9] pb-12 pt-6">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    
                    {/* --- AVISOS --- */}
                    {flash?.success && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                            <CheckSolid className="w-5 h-5 text-emerald-500" />
                            <p className="text-sm font-semibold">{flash.success}</p>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                            <div className="font-bold">❌</div>
                            <p className="text-sm font-semibold">{errorMsg}</p>
                        </div>
                    )}

                    {/* --- HEADER SUPERIOR --- */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fila de atendimento</h1>
                            <p className="text-sm text-gray-500 mt-1">Visualize a fila de agendamentos do estabelecimento selecionado.</p>
                        </div>

                        {/* BARRA DE FILTROS COM DATA INÍCIO E FIM PERMANENTES LADO A LADO */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                <CalendarIcon className="w-4 h-4 text-gray-400" />
                                <input type="date" name="data_inicio" value={params.data_inicio} onChange={handleChange} className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 outline-none w-[115px]" />
                                <span className="text-gray-300 text-xs font-bold">até</span>
                                <input type="date" name="data_fim" value={params.data_fim} onChange={handleChange} className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 outline-none w-[115px]" />
                            </div>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)} 
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold shadow-sm transition ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                                Filtros
                            </button>
                        </div>
                    </div>

                    {/* --- FILTROS ADICIONAIS (MODAL EXPANDIDO) --- */}
                    {showFilters && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 animate-fadeIn">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Status Atendimento</label>
                                <select name="status" value={params.status} onChange={handleChange} className="border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm focus:border-gray-900 focus:ring-0">
                                    <option value="todos">Todos</option>
                                    <option value="pendente">Aguardando</option>
                                    <option value="confirmado">Em Atendimento</option>
                                    <option value="concluido">Finalizados</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pagamento</label>
                                <select name="status_pagamento" value={params.status_pagamento} onChange={handleChange} className="border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm focus:border-gray-900 focus:ring-0">
                                    <option value="todos">Todos</option>
                                    <option value="pago_online">Online (App)</option>
                                    <option value="presencial">No Local</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ordenação</label>
                                <select name="ordem" value={params.ordem} onChange={handleChange} className="border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm focus:border-gray-900 focus:ring-0">
                                    <option value="asc">Mais Antigos</option>
                                    <option value="desc">Mais Recentes</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* --- CARDS METRICAS & SELETOR DE ESTABELECIMENTOS CORRIGIDO --- */}
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                        
                        {/* Seletor Customizado sem Duplicação de Seta (appearance-none ativa) */}
                        <div className="relative bg-white border border-gray-200 rounded-2xl shadow-sm p-4 w-full lg:w-72 flex flex-col justify-center cursor-pointer hover:border-gray-300 transition">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Estabelecimento</label>
                            <select 
                                className="w-full bg-transparent border-none p-0 text-base font-bold text-gray-900 focus:ring-0 outline-none cursor-pointer appearance-none pr-8"
                                value={selectValue}
                                onChange={handleTrocaFila}
                            >
                                <option value="todos">Todos os locais</option>
                                {estabelecimentos && estabelecimentos.length > 0 && estabelecimentos.map(est => (
                                    <option key={est.id} value={est.id}>{est.nome}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Cards de Métricas */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                                    <UserGroupIcon className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.total}</p>
                                    <p className="text-[11px] text-gray-400 font-semibold leading-tight">Total de<br/>agendamentos</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                    <CheckSolid className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.pagos}</p>
                                    <p className="text-[11px] text-gray-400 font-semibold leading-tight">Pagos</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center border border-orange-100">
                                    <ClockIcon className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.pendentes}</p>
                                    <p className="text-[11px] text-gray-400 font-semibold leading-tight">Pendentes</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                                    <CreditCardIcon className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.presencial}</p>
                                    <p className="text-[11px] text-gray-400 font-semibold leading-tight">Pagamento<br/>presencial</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- TABELA PRINCIPAL --- */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-[#f8f9fa] text-gray-500 text-[11px] uppercase tracking-wider font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-center w-20">Posição</th>
                                        <th className="px-6 py-4">Paciente</th>
                                        <th className="px-6 py-4">Horário</th>
                                        <th className="px-6 py-4">Serviço</th>
                                        <th className="px-6 py-4 text-center">Status do pagamento</th>
                                        <th className="px-6 py-4 text-center w-24">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {!agendamentos || !agendamentos.data || agendamentos.data.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-24 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                                        <FunnelIcon className="w-8 h-8 text-gray-300" />
                                                    </div>
                                                    <p className="font-bold text-lg text-gray-700 mb-1">Nenhum agendamento encontrado</p>
                                                    <p className="text-sm text-gray-500">Altere a data ou limpe os filtros para listar dados.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        agendamentos.data.map((item, index) => (
                                            <LinhaAgendamento 
                                                key={item.id} 
                                                item={item} 
                                                index={index}
                                                currentPage={agendamentos.current_page}
                                                perPage={agendamentos.per_page}
                                                funcionarios={funcionarios}
                                                atribuirFuncionario={atribuirFuncionario}
                                                atualizarStatus={atualizarStatus}
                                                formatarMoeda={formatarMoeda}
                                                abrirModalFinalizar={abrirModalFinalizar}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* PAGINAÇÃO */}
                        {agendamentos?.links && agendamentos.data.length > 0 && (
                            <div className="bg-white px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <span className="text-xs font-semibold text-gray-500">
                                    Mostrando {agendamentos.from || 0} a {agendamentos.to || 0} de {agendamentos.total} agendamentos
                                </span>
                                <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                    {agendamentos.links.map((link, key) => {
                                        let label = link.label;
                                        if (label.includes('Previous')) label = '‹';
                                        if (label.includes('Next')) label = '›';

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => { if (link.url) router.get(link.url, params, { preserveScroll: true, preserveState: true }); }}
                                                disabled={!link.url}
                                                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                                                    link.active ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                                                } ${!link.url && 'opacity-30 cursor-not-allowed'}`}
                                                dangerouslySetInnerHTML={{ __html: label }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- MODAL DE FINALIZAR ATENDIMENTO --- */}
                {modalFinalizar.isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900">Finalizar Atendimento</h2>
                                <button onClick={fecharModalFinalizar} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium">Cliente</p>
                                        <p className="font-bold text-gray-900 text-sm mt-0.5">{modalFinalizar.agendamento?.usuario?.name || 'Cliente'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 font-medium">Serviço</p>
                                        <p className="font-bold text-gray-900 text-sm mt-0.5">{modalFinalizar.agendamento?.servico?.nome}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Desconto (R$)</label>
                                        <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition" placeholder="0,00" value={modalFinalizar.desconto} onChange={(e) => setModalFinalizar({...modalFinalizar, desconto: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Total a Pagar</label>
                                        <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-emerald-700 font-black text-lg text-right">
                                            {formatarMoeda((modalFinalizar.agendamento?.servico?.valor || 0) - (modalFinalizar.desconto || 0))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2">Forma de Pagamento</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['pix', 'credito', 'debito', 'dinheiro'].map(tipo => (
                                            <label key={tipo} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all ${modalFinalizar.formaPagamento === tipo ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                                <input type="radio" name="forma_pagamento" value={tipo} checked={modalFinalizar.formaPagamento === tipo} onChange={() => setModalFinalizar({...modalFinalizar, formaPagamento: tipo})} className="sr-only" />
                                                <span className="capitalize font-bold text-sm">{tipo}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button onClick={fecharModalFinalizar} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">Cancelar</button>
                                <button onClick={confirmarFinalizacao} disabled={modalFinalizar.processando} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50">
                                    {modalFinalizar.processando ? 'Processando...' : 'Confirmar e Finalizar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}