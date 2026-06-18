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
    
    // Cálculo seguro para a posição caso a paginação não envie esses dados
    const page = currentPage || 1;
    const itemsPerPage = perPage || 10;
    const posicao = (page - 1) * itemsPerPage + index + 1;

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

            {/* CÉLULA DO PACIENTE: Transformada em Link para a tela DetalheCliente */}
            <td className="px-6 py-4 whitespace-nowrap align-middle">
                {item.usuario?.id ? (
                    <Link 
                        href={route('clientes.detalhes', item.usuario.id)} 
                        className="flex items-center gap-3 group/link hover:opacity-80 transition-opacity"
                        title="Ver histórico e serviços do cliente"
                    >
                        {item.usuario?.foto_perfil ? (
                            <img 
                                src={`/storage/${item.usuario.foto_perfil}`} 
                                alt={item.usuario.name} 
                                className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-100 group-hover/link:border-emerald-300 transition-colors"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm group-hover/link:bg-emerald-50 group-hover/link:text-emerald-500 transition-colors">
                                <UserIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div className="font-bold text-gray-900 text-sm group-hover/link:text-emerald-700 transition-colors">
                                {item.usuario?.name || 'Cliente'}
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">
                                {item.usuario?.idade ? `${item.usuario.idade} anos • ` : ''} 
                                {item.usuario?.cpf ? `CPF ${item.usuario.cpf}` : (item.usuario?.telefone || 'S/ Contato')}
                            </span>
                        </div>
                    </Link>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                            <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <div className="font-bold text-gray-900 text-sm">Cliente Excluído</div>
                        </div>
                    </div>
                )}
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
                            
                            {/* LINK NOVO: Ver Detalhes / Serviços */}
                            {item.usuario?.id && (
                                <Link 
                                    href={route('clientes.detalhes', item.usuario.id)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium border-b border-gray-50"
                                >
                                    Ver Histórico do Cliente
                                </Link>
                            )}

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
            desconto: modalFinalizar.desconto, 
            forma_pagamento: modalFinalizar.formaPagamento
        }, { 
            preserveScroll: true, 
            onSuccess: () => fecharModalFinalizar(), 
            onError: () => setModalFinalizar(prev => ({ ...prev, processando: false })) 
        });
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

                    {/* --- FILTROS ADICIONAIS (MODERNIZADOS) --- */}
                    {showFilters && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fadeIn relative mt-4">
                            <div className="flex items-center mb-5">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <FunnelIcon className="w-4 h-4 text-indigo-500" />
                                    Refinar Busca
                                </h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Filtro: Status */}
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status Atendimento</label>
                                    <div className="relative">
                                        <select name="status" value={params.status} onChange={handleChange} className="w-full appearance-none bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none pr-10 cursor-pointer shadow-sm">
                                            <option value="todos">Todos os status</option>
                                            <option value="pendente">Aguardando</option>
                                            <option value="confirmado">Em Atendimento</option>
                                            <option value="concluido">Finalizados</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Filtro: Pagamento */}
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pagamento</label>
                                    <div className="relative">
                                        <select name="status_pagamento" value={params.status_pagamento} onChange={handleChange} className="w-full appearance-none bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none pr-10 cursor-pointer shadow-sm">
                                            <option value="todos">Todos os pagamentos</option>
                                            <option value="pago_online">Online (App)</option>
                                            <option value="presencial">No Local</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Filtro: Ordenação */}
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ordenação</label>
                                    <div className="relative">
                                        <select name="ordem" value={params.ordem} onChange={handleChange} className="w-full appearance-none bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none pr-10 cursor-pointer shadow-sm">
                                            <option value="asc">Mais Antigos primeiro</option>
                                            <option value="desc">Mais Recentes primeiro</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CARDS METRICAS & SELETOR DE ESTABELECIMENTOS --- */}
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                        
                        {/* Seletor Customizado sem Duplicação de Seta (bg-none resolve o problema) */}
                        <div className="relative bg-white border border-gray-200 rounded-2xl shadow-sm p-4 w-full lg:w-72 flex flex-col justify-center cursor-pointer hover:border-gray-300 transition">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Estabelecimento</label>
                            <select 
                                className="w-full bg-transparent border-none p-0 text-base font-bold text-gray-900 focus:ring-0 outline-none cursor-pointer appearance-none bg-none pr-8"
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
                                    <p className="text-[11px] text-gray-400 font-semibold leading-tight">Pag. no Local</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- TABELA DE AGENDAMENTOS --- */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                        <th className="px-6 py-4 text-center w-16">Pos</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Horário</th>
                                        <th className="px-6 py-4">Serviço / Profissional</th>
                                        <th className="px-6 py-4 text-center">Pagamento</th>
                                        <th className="px-6 py-4 text-center w-16">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {agendamentos?.data?.length > 0 ? (
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
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-gray-500 text-sm">
                                                Nenhum agendamento encontrado para os filtros selecionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- MODAL FINALIZAR ATENDIMENTO --- */}
            {modalFinalizar.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Finalizar Atendimento</h3>
                            <button onClick={fecharModalFinalizar} className="text-gray-400 hover:text-gray-600 transition">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Desconto (R$)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                    value={modalFinalizar.desconto}
                                    onChange={(e) => setModalFinalizar({...modalFinalizar, desconto: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Forma de Pagamento</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition cursor-pointer"
                                    value={modalFinalizar.formaPagamento}
                                    onChange={(e) => setModalFinalizar({...modalFinalizar, formaPagamento: e.target.value})}
                                >
                                    <option value="pix">PIX</option>
                                    <option value="dinheiro">Dinheiro</option>
                                    <option value="cartao_credito">Cartão de Crédito</option>
                                    <option value="cartao_debito">Cartão de Débito</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button 
                                onClick={fecharModalFinalizar} 
                                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmarFinalizacao} 
                                disabled={modalFinalizar.processando} 
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                                {modalFinalizar.processando ? 'Processando...' : 'Confirmar e Finalizar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}