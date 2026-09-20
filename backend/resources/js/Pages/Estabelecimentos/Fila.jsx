import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
    CalendarIcon, 
    FunnelIcon, 
    AdjustmentsHorizontalIcon, 
    CheckCircleIcon,
    UserIcon,
    XMarkIcon,
    EllipsisVerticalIcon,
    ClockIcon,
    CreditCardIcon,
    UserGroupIcon,
    ChevronDownIcon,
    DocumentArrowDownIcon,
    ArrowPathIcon,
    BellIcon,
    TrashIcon,
    ShieldCheckIcon,
    ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid, UserCircleIcon, MegaphoneIcon } from '@heroicons/react/24/solid';

// ==============================================================================
// SUB-COMPONENTE: Linha da Tabela
// ==============================================================================
const LinhaAgendamento = ({ item, index, currentPage, perPage, funcionarios, atribuirFuncionario, atualizarStatus, abrirModalFinalizar, abrirModalCancelar, chamarCliente, adiarCliente }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    
    const page = currentPage || 1;
    const itemsPerPage = perPage || 10;
    const posicao = (page - 1) * itemsPerPage + index + 1;

    const isPago = item.status_pagamento === 'pago_online' || item.status_pagamento === 'pago_presencial';
    const isPresencial = item.status_pagamento === 'presencial';

    const getColors = () => {
        if (isPago) return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: <CheckCircleIcon className="w-4 h-4" /> };
        if (isPresencial) return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: <CreditCardIcon className="w-4 h-4" /> };
        return { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', icon: <ClockIcon className="w-4 h-4" /> };
    };

    const colors = getColors();

    const renderPaymentBadge = () => {
        let label = 'Pendente';
        if (isPago) label = 'Pago';
        if (isPresencial) label = 'Pag. no Local';

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} ${colors.border} border whitespace-nowrap`}>
                {colors.icon} {label}
            </span>
        );
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

    // Garantia de segurança para a lista de produtos extras (array ou object values)
    const produtosExtras = Array.isArray(item.produtos_extras) ? item.produtos_extras : (item.produtos_extras ? Object.values(item.produtos_extras) : []);

    return (
        <tr className="group hover:bg-gray-50/50 transition-colors duration-200 border-b border-gray-100 last:border-0 relative">
            <td className="px-4 py-4 whitespace-nowrap text-center align-top pt-5">
                <div className={`mx-auto flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold bg-white border shadow-sm ${colors.text} border-gray-100`}>
                    {posicao}
                </div>
            </td>

            {/* CÉLULA DO PACIENTE */}
            <td className="px-4 py-4 whitespace-nowrap align-top pt-5">
                {item?.usuario?.id ? (
                    <Link 
                        href={route('clientes.detalhes', item.usuario.id)} 
                        className="flex items-center gap-3 group/link hover:opacity-80 transition-opacity"
                        title="Ver histórico e serviços do cliente"
                    >
                        {item.usuario?.foto_perfil ? (
                            <img 
                                src={item.usuario.foto_perfil.startsWith('http') ? item.usuario.foto_perfil : `/storage/${item.usuario.foto_perfil}`} 
                                alt={item.usuario.name || 'Cliente'} 
                                className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-200 group-hover/link:border-indigo-300 transition-colors"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm group-hover/link:bg-indigo-100 transition-colors">
                                <UserIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div className="font-bold text-gray-900 text-sm group-hover/link:text-indigo-600 transition-colors">
                                {item.usuario?.name || 'Cliente'}
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">
                                {item.usuario?.telefone || (item.usuario?.cpf ? `CPF ${item.usuario.cpf}` : 'S/ Contato')}
                            </span>
                        </div>
                    </Link>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                            <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <div className="font-bold text-gray-900 text-sm">Cliente Excluído</div>
                        </div>
                    </div>
                )}
            </td>

            <td className="px-4 py-4 whitespace-nowrap align-top pt-5">
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

            <td className="px-4 py-4 align-top pt-4">
                <div className="flex flex-col items-start gap-1 w-full max-w-[320px]">
                    <span className="font-bold text-gray-900 text-sm">
                        {item.servico?.nome || 'Serviço Excluído'}
                    </span>
                    
                    {/* 👇 NOVO BLOCO: PRODUTOS EXTRAS */}
                    {produtosExtras.length > 0 && (
                        <div className="flex flex-col gap-2 mt-3 w-full bg-gray-50/80 border border-gray-200 p-3 rounded-xl">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                <ShoppingBagIcon className="w-3.5 h-3.5" /> Produtos Adicionais ({produtosExtras.length})
                            </span>
                            {produtosExtras.map(extra => (
                                <div key={extra.id} className="flex items-center justify-between gap-3 bg-white border border-gray-100 p-2.5 rounded-lg w-full shadow-sm">
                                    <div className="flex items-center gap-3 truncate">
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                            <ShoppingBagIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[13px] font-bold text-gray-800 truncate leading-tight">
                                                {extra.quantidade}x {extra.nome}
                                            </span>
                                            <span className="text-[10px] text-gray-500 truncate leading-none mt-1">
                                                {extra.categoria || 'Produto Avulso'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[13px] font-black text-gray-700 shrink-0">
                                        {formatarMoeda(Number(extra.valor_diaria) * extra.quantidade)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* FIM PRODUTOS EXTRAS */}

                    {item.status === 'finalizado' ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border bg-emerald-50 border-emerald-100 text-emerald-700 w-full mt-3">
                            <CheckSolid className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                                Finalizado por {item.finalizado_por?.name || 'usuário removido'} às {item.hora_finalizacao?.substring(0, 5)}
                            </span>
                        </div>
                    ) : (
                        <div className="relative group/select w-full mt-3">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                item.funcionario_id
                                    ? 'bg-gray-100 border-gray-200 text-gray-600'
                                    : 'bg-indigo-50 border-indigo-200 border-dashed text-indigo-700 hover:bg-indigo-100'
                            }`}>
                                <UserCircleIcon className="w-4 h-4" />
                                <select
                                    className="bg-transparent border-none p-0 text-[11px] font-bold focus:ring-0 outline-none cursor-pointer appearance-none !bg-none w-full truncate pr-4"
                                    style={{ backgroundImage: 'none' }}
                                    value={item.funcionario_id || ''}
                                    onChange={(e) => atribuirFuncionario(item.id, e.target.value)}
                                    disabled={item.status === 'cancelado'}
                                >
                                    <option value="" disabled className="text-gray-400">Delegar Profissional...</option>
                                    {funcionarios?.map(f => (
                                        <option key={f.id} value={f.id} className="text-gray-700">{f.nome}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="w-3 h-3 opacity-50 absolute right-2 pointer-events-none" />
                            </div>
                        </div>
                    )}
                </div>
            </td>

            <td className="px-4 py-4 text-center whitespace-nowrap align-top pt-5">
                <div className="flex flex-col items-center gap-2">
                    {renderPaymentBadge()}
                    <span className="text-base font-black text-gray-900 mt-1">
                        {formatarMoeda(item.valor_final)}
                    </span>
                    {Number(item.valor_total_extras) > 0 && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Inclui {formatarMoeda(item.valor_total_extras)} extra
                        </span>
                    )}
                </div>
            </td>

            <td className="px-4 py-4 text-center whitespace-nowrap align-top pt-5">
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition shadow-sm border border-transparent hover:border-gray-200 relative z-10">
                    <EllipsisVerticalIcon className="w-6 h-6" />
                </button>

                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-[40]" onClick={() => setMenuOpen(false)}></div>
                        <div className="absolute right-6 top-12 w-64 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-[50] overflow-hidden animate-fadeIn">
                            
                            {item?.usuario?.id && (
                                <Link 
                                    href={route('clientes.detalhes', item.usuario.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 font-medium border-b border-gray-50 transition"
                                >
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    Histórico do Cliente
                                </Link>
                            )}

                            {/* BOTÃO DE DOWNLOAD DO COMPROVANTE PDF */}
                            {['confirmado', 'concluido', 'finalizado'].includes(item.status) && (
                                <a 
                                    href={`/agendamentos/${item.id}/comprovante-pdf`} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 font-medium border-b border-gray-50 transition"
                                >
                                    <DocumentArrowDownIcon className="w-4 h-4 text-indigo-500" />
                                    Baixar Comprovante
                                </a>
                            )}

                            {/* Ações Inteligentes de Fila (Chamar e Adiar) */}
                            {item.status === 'pendente' && (
                                <>
                                    <button onClick={() => { chamarCliente(item.id); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 font-semibold flex items-center gap-3 transition">
                                        <BellIcon className="w-4 h-4" /> Chamar (Avisar Cliente)
                                    </button>
                                    <button onClick={() => { adiarCliente(item.id); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 font-semibold flex items-center gap-3 border-b border-gray-50 transition">
                                        <ClockIcon className="w-4 h-4" /> Adiar (10 min)
                                    </button>
                                </>
                            )}
                            
                            {/* Finalizar Atendimento e Chamar o Modal com o PIN */}
                            {item.status === 'confirmado' && (
                                <button onClick={() => { abrirModalFinalizar(item); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-emerald-600 hover:bg-emerald-50 font-bold border-b border-gray-50 flex items-center gap-3 transition">
                                    <CheckSolid className="w-4 h-4" /> Concluir com PIN
                                </button>
                            )}
                            
                            {/* Botão para Abrir Modal de Cancelamento */}
                            {['pendente', 'confirmado'].includes(item.status) && (
                                <button onClick={() => { abrirModalCancelar(item); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 font-medium mt-1 flex items-center gap-3 transition">
                                    <TrashIcon className="w-4 h-4" /> Cancelar Agendamento
                                </button>
                            )}
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
    
    // Estado do Modal de Finalização (PIN)
    const [modalFinalizar, setModalFinalizar] = useState({ 
        isOpen: false, 
        agendamento: null, 
        desconto: 0, 
        formaPagamento: 'pix', 
        codigo_pin: '', 
        processando: false,
        error: null
    });

    // Estado do Modal de Cancelamento
    const [modalCancelar, setModalCancelar] = useState({
        isOpen: false,
        agendamento: null
    });

    // Estado da Animação de Chamada
    const [alertaChamar, setAlertaChamar] = useState(false);

    const handleTrocaFila = (e) => {
        const valor = e.target.value;
        if (valor === 'todos') {
            router.get(route('fila.index'));
        } else {
            router.get(route('estabelecimentos.fila', valor));
        }
    };

    // Auto Refresh Suave (Apenas Tabela)
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

    const limparFiltros = () => {
        const resetParams = { data_inicio: dataHoje, data_fim: dataHoje, ordem: 'asc', status: 'todos', status_pagamento: 'todos', per_page: '10' };
        aplicarFiltros(resetParams);
    };

    const atualizarStatus = (id, novoStatus) => {
        router.post(route('agendamentos.update-status', id), { 
            _method: 'patch',
            status: novoStatus 
        }, { preserveScroll: true, preserveState: true });
    };

    const atribuirFuncionario = (agendamentoId, funcionarioId) => {
        router.post(route('agendamentos.update-funcionario', agendamentoId), { 
            _method: 'patch',
            funcionario_id: funcionarioId 
        }, { preserveScroll: true, preserveState: true });
    };

    // LÓGICA DE CHAMAR ATUALIZADA COM ANIMAÇÃO GIGANTE E MODERNA
    const chamarCliente = (id) => {
        setAlertaChamar(true); 
        setTimeout(() => setAlertaChamar(false), 6000); 

        router.post(route('agendamentos.chamar', id), {}, { preserveScroll: true, preserveState: true });
    };

    const adiarCliente = (id) => {
        router.post(route('agendamentos.adiar', id), {}, { preserveScroll: true, preserveState: true });
    };

    const errorMsg = flash?.error || (Object.keys(errors).length > 0 ? Object.values(errors)[0] : null);

    const abrirModalFinalizar = (item) => {
        setModalFinalizar({ 
            isOpen: true, 
            agendamento: item, 
            desconto: 0, 
            formaPagamento: 'pix', 
            codigo_pin: '', 
            processando: false,
            error: null
        });
    };
    const fecharModalFinalizar = () => setModalFinalizar(prev => ({ ...prev, isOpen: false, error: null }));
    
    // Funções do Modal de Cancelamento
    const abrirModalCancelar = (item) => {
        setModalCancelar({ isOpen: true, agendamento: item });
    };
    const fecharModalCancelar = () => {
        setModalCancelar({ isOpen: false, agendamento: null });
    };
    const confirmarCancelamento = () => {
        if (modalCancelar.agendamento) {
            atualizarStatus(modalCancelar.agendamento.id, 'cancelado');
            fecharModalCancelar();
        }
    };

    const confirmarFinalizacao = (e) => {
        e.preventDefault();
        
        if (modalFinalizar.codigo_pin.length !== 4) {
            setModalFinalizar(prev => ({ ...prev, error: "O PIN deve conter exatamente 4 dígitos." }));
            return;
        }

        setModalFinalizar(prev => ({ ...prev, processando: true, error: null }));
        
        router.post(route('agendamentos.finalizar', modalFinalizar.agendamento.id), {
            codigo_pin: modalFinalizar.codigo_pin,
            desconto: modalFinalizar.desconto, 
            forma_pagamento: modalFinalizar.formaPagamento
        }, { 
            preserveScroll: true, 
            onSuccess: () => fecharModalFinalizar(), 
            onError: (errors) => {
                const msg = errors.error || Object.values(errors)[0] || "Erro desconhecido ao tentar finalizar.";
                setModalFinalizar(prev => ({ ...prev, processando: false, error: msg }));
            } 
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

            <div className="min-h-screen bg-[#FBF9F9] pb-12 pt-6 relative">
                
                {/* --- ALERTA DE CHAMADA GIGANTE E MODERNO NO CENTRO/TOPO DA TELA --- */}
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 pointer-events-none flex flex-col gap-3">
                    <AnimatePresence>
                        {alertaChamar && (
                            <motion.div 
                                initial={{ opacity: 0, y: -50, scale: 0.9 }} 
                                animate={{ opacity: 1, y: 0, scale: 1 }} 
                                exit={{ opacity: 0, y: -30, scale: 0.9 }} 
                                className="bg-indigo-600 border border-indigo-700 p-6 rounded-3xl flex items-center gap-6 shadow-2xl pointer-events-auto relative overflow-hidden w-full"
                            >
                                {/* Efeito de Brilho no Fundo */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 animate-pulse"></div>
                                
                                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0 relative z-10 border border-white/30">
                                    <MegaphoneIcon className="w-8 h-8 text-white animate-bounce" />
                                </div>
                                
                                <div className="relative z-10 flex-1">
                                    <h4 className="text-white font-black text-2xl tracking-tight mb-1">Cliente Chamado!</h4>
                                    <p className="text-indigo-100 text-base font-medium leading-tight">
                                        Uma notificação e um e-mail acabam de ser enviados solicitando a presença no balcão.
                                    </p>
                                </div>
                                
                                <button 
                                    onClick={() => setAlertaChamar(false)} 
                                    className="relative z-10 p-2 bg-indigo-700/50 hover:bg-indigo-700 text-white rounded-full transition"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}

                        {/* Alerta Nativo de Sucesso (se houver outro flash.success que não seja a chamada) */}
                        {flash?.success && !alertaChamar && (
                            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border-2 border-emerald-500 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <CheckSolid className="w-6 h-6 text-emerald-600" />
                                </div>
                                <p className="text-sm font-bold">{flash.success}</p>
                            </motion.div>
                        )}

                        {/* Alerta de Erro Geral */}
                        {errorMsg && !modalFinalizar.isOpen && (
                            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border-2 border-red-500 text-red-800 p-4 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                    <XMarkIcon className="w-6 h-6 text-red-600" />
                                </div>
                                <p className="text-sm font-bold">{errorMsg}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>


                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    {/* --- HEADER SUPERIOR --- */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fila de atendimento</h1>
                            <p className="text-sm text-gray-500 mt-1">Visualize e gerencie a fila de agendamentos e faturamentos.</p>
                        </div>

                        {/* BARRA DE FILTROS */}
                        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
                            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 border border-gray-200 rounded-xl bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                <input type="date" name="data_inicio" value={params.data_inicio} onChange={handleChange} className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 outline-none w-auto cursor-pointer" />
                                <span className="text-gray-300 text-xs font-bold">até</span>
                                <input type="date" name="data_fim" value={params.data_fim} onChange={handleChange} className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 outline-none w-auto cursor-pointer" />
                            </div>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)} 
                                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 border rounded-xl text-sm font-semibold shadow-sm transition ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                            >
                                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                                Filtros Adicionais
                            </button>
                        </div>
                    </div>

                    {/* --- FILTROS ADICIONAIS --- */}
                    <AnimatePresence>
                    {showFilters && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative mt-4 overflow-hidden">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <FunnelIcon className="w-4 h-4 text-indigo-500" />
                                    Refinar Busca
                                </h3>
                                <button onClick={limparFiltros} className="text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition">
                                    <ArrowPathIcon className="w-3.5 h-3.5" /> Limpar Tudo
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status Atendimento</label>
                                    <div className="relative">
                                        <select 
                                            name="status" 
                                            value={params.status} 
                                            onChange={handleChange} 
                                            style={{ backgroundImage: 'none' }}
                                            className="w-full appearance-none !bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                                        >
                                            <option value="todos">Todos os status</option>
                                            <option value="pendente">Aguardando (Pendente)</option>
                                            <option value="confirmado">Em Atendimento</option>
                                            <option value="finalizado">Finalizados</option>
                                            <option value="cancelado">Cancelados</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status do Pagamento</label>
                                    <div className="relative">
                                        <select 
                                            name="status_pagamento" 
                                            value={params.status_pagamento} 
                                            onChange={handleChange} 
                                            style={{ backgroundImage: 'none' }}
                                            className="w-full appearance-none !bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                                        >
                                            <option value="todos">Todos os pagamentos</option>
                                            <option value="pago_online">Pago Online (App)</option>
                                            <option value="presencial">Pagar no Local</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ordem de Exibição</label>
                                    <div className="relative">
                                        <select 
                                            name="ordem" 
                                            value={params.ordem} 
                                            onChange={handleChange} 
                                            style={{ backgroundImage: 'none' }}
                                            className="w-full appearance-none !bg-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                                        >
                                            <option value="asc">Mais Antigos primeiro</option>
                                            <option value="desc">Mais Recentes primeiro</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    </AnimatePresence>

                    {/* --- CARDS METRICAS & SELETOR DE ESTABELECIMENTOS --- */}
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                        
                        <div className="relative bg-white border border-gray-200 rounded-2xl shadow-sm p-4 w-full lg:w-72 flex flex-col justify-center cursor-pointer hover:border-gray-300 transition">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Visão do Estabelecimento</label>
                            <select 
                                className="w-full bg-transparent border-none p-0 text-base font-bold text-gray-900 focus:ring-0 outline-none cursor-pointer appearance-none !bg-none pr-8"
                                style={{ backgroundImage: 'none' }}
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
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                                    <UserGroupIcon className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.total}</p>
                                    <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold leading-tight">Total na Fila</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                                    <CheckSolid className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.pagos}</p>
                                    <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold leading-tight">Já Pagos</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                                    <ClockIcon className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.pendentes}</p>
                                    <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold leading-tight">Aguardando</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                                    <CreditCardIcon className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900">{metricas.presencial}</p>
                                    <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold leading-tight">Pag. Presencial</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- TABELA DE AGENDAMENTOS --- */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse relative min-w-[800px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                                        <th className="px-4 py-4 text-center w-16">Pos</th>
                                        <th className="px-4 py-4">Cliente</th>
                                        <th className="px-4 py-4">Horário</th>
                                        <th className="px-4 py-4">Serviço / Extras / Delegação</th>
                                        <th className="px-4 py-4 text-center">Pagamento / Total</th>
                                        <th className="px-4 py-4 text-center w-16">Ações</th>
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
                                                abrirModalFinalizar={abrirModalFinalizar}
                                                abrirModalCancelar={abrirModalCancelar}
                                                chamarCliente={chamarCliente}
                                                adiarCliente={adiarCliente}
                                            />
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
                                                    <p className="text-base font-bold text-gray-700">Nenhum agendamento encontrado.</p>
                                                    <p className="text-sm mt-1">Altere os filtros de data ou status para buscar mais resultados.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- MODAL FINALIZAR ATENDIMENTO (COM CÓDIGO PIN) --- */}
            <AnimatePresence>
                {modalFinalizar.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                            className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative"
                        >
                            <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Finalizar Serviço</h3>
                                    <p className="text-sm text-gray-500 mt-1">Conclua o atendimento com o PIN do cliente.</p>
                                </div>
                                <button onClick={fecharModalFinalizar} className="p-2 bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Exibir erro do Backend ou Validação */}
                            {modalFinalizar.error && (
                                <div className="mb-5 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-start gap-2">
                                    <span>⚠️</span>
                                    {modalFinalizar.error}
                                </div>
                            )}

                            <form onSubmit={confirmarFinalizacao} className="space-y-5">
                                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <ShieldCheckIcon className="w-16 h-16 text-indigo-900" />
                                    </div>
                                    <label className="block text-xs font-bold text-indigo-800 uppercase tracking-widest mb-3 text-center relative z-10">
                                        Código de Segurança (PIN)
                                    </label>
                                    <input 
                                        type="text" 
                                        maxLength="4"
                                        required
                                        className="w-full text-center text-4xl font-black tracking-[0.5em] text-gray-900 bg-white border-2 border-indigo-200 rounded-xl px-4 py-4 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition shadow-sm relative z-10"
                                        value={modalFinalizar.codigo_pin}
                                        onChange={(e) => setModalFinalizar({...modalFinalizar, codigo_pin: e.target.value.replace(/\D/g, '')})}
                                        placeholder="0000"
                                    />
                                    <p className="text-center text-[11px] text-indigo-600/80 mt-3 font-semibold relative z-10">
                                        Solicite ao cliente o código gerado no APP dele.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Desconto R$ (Opcional)</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition shadow-sm bg-gray-50 hover:bg-white focus:bg-white"
                                            value={modalFinalizar.desconto}
                                            onChange={(e) => setModalFinalizar({...modalFinalizar, desconto: e.target.value})}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Forma Pagamento</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition cursor-pointer shadow-sm appearance-none !bg-none bg-gray-50 hover:bg-white focus:bg-white"
                                                style={{ backgroundImage: 'none' }}
                                                value={modalFinalizar.formaPagamento}
                                                onChange={(e) => setModalFinalizar({...modalFinalizar, formaPagamento: e.target.value})}
                                            >
                                                {modalFinalizar.agendamento?.status_pagamento === 'pago_online' ? (
                                                    <option value="online">Pago Online (Asaas)</option>
                                                ) : (
                                                    <>
                                                        <option value="pix">Via PIX (Local)</option>
                                                        <option value="dinheiro">Em Dinheiro</option>
                                                        <option value="cartao_credito">Cartão Crédito</option>
                                                        <option value="cartao_debito">Cartão Débito</option>
                                                    </>
                                                )}
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                    <button 
                                        type="button"
                                        onClick={fecharModalFinalizar} 
                                        className="px-6 py-3.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm w-full sm:w-auto"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={modalFinalizar.processando || modalFinalizar.codigo_pin.length !== 4} 
                                        className="px-6 py-3.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm w-full sm:w-auto flex justify-center items-center gap-2"
                                    >
                                        {modalFinalizar.processando ? 'Autenticando...' : 'Autenticar PIN'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- MODAL CONFIRMAR CANCELAMENTO --- */}
            <AnimatePresence>
                {modalCancelar.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                            className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative text-center"
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-[0_0_0_4px_rgba(255,228,230,1)]">
                                    <TrashIcon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                                    Cancelar Agendamento?
                                </h3>
                                <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                                    Tem certeza que deseja cancelar o agendamento de <strong className="text-gray-800">{modalCancelar.agendamento?.usuario?.name || 'este cliente'}</strong>? <br className="hidden sm:block" />Esta ação notificará o cliente e os valores (se pagos) serão estornados.
                                </p>
                            </div>
                            
                            <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 w-full">
                                <button 
                                    type="button"
                                    onClick={fecharModalCancelar} 
                                    className="px-6 py-3.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm w-full sm:w-auto"
                                >
                                    Não, Voltar
                                </button>
                                <button 
                                    type="button"
                                    onClick={confirmarCancelamento} 
                                    className="px-6 py-3.5 text-sm font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-sm w-full sm:w-auto flex justify-center items-center gap-2"
                                >
                                    Sim, Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </AuthenticatedLayout>
    );
}