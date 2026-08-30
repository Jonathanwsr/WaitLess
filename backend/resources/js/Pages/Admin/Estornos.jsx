import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';

export default function Estornos({ auth }) {
    // =========================================================================
    // 1. ESTADOS DA APLICAÇÃO
    // =========================================================================
    const [estornos, setEstornos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Modal de Detalhes
    const [detalhesEstorno, setDetalhesEstorno] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    
    // Lightbox Moderno para Fotos
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });
    
    // Formulários de Ação
    const [motivoReprovacao, setMotivoReprovacao] = useState('');
    const [contestacaoDescricao, setContestacaoDescricao] = useState('');
    const [contestacaoImagens, setContestacaoImagens] = useState([]);
    const [processandoAcao, setProcessandoAcao] = useState(false);

    // =========================================================================
    // 2. IDENTIFICAÇÃO DE PAPÉIS
    // =========================================================================
    const papel = auth.user?.papel?.toLowerCase() || 'cliente';
    const isAdmin = ['admin', 'superadmin', 'administrador'].includes(papel);
    const isPrestador = ['socio', 'proprietario'].includes(papel);
    const isCliente = papel === 'cliente';

    // =========================================================================
    // 3. BUSCA INICIAL DE DADOS
    // =========================================================================
    useEffect(() => {
        fetchEstornos();
    }, []);

    const fetchEstornos = async () => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = isAdmin ? '/api/admin/estornos' : '/api/estornos';
            const response = await axios.get(endpoint);
            
            // O admin retorna paginação (data.data), usuário normal retorna array (data)
            const dados = isAdmin ? response.data.data.data : response.data.data;
            setEstornos(dados || []);
        } catch (err) {
            console.error("Erro ao buscar estornos:", err);
            setError("Não foi possível carregar os estornos. Tente novamente mais tarde.");
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // 4. AÇÕES PRINCIPAIS
    // =========================================================================
    
    // 4.1. Abrir modal e buscar detalhes
    const abrirDetalhes = async (id) => {
        try {
            setDetalhesEstorno(null);
            setModalOpen(true);
            const response = await axios.get(`/api/estornos/${id}/detalhes`);
            setDetalhesEstorno(response.data.data);
        } catch (err) {
            alert("Erro ao carregar detalhes da solicitação.");
            setModalOpen(false);
        }
    };

    // 4.2. Ações do Administrador
    const aprovarEstorno = async (id) => {
        if (!confirm("Atenção! Você está APROVANDO este estorno. O dinheiro será devolvido ao cliente e retirado da carteira do prestador. Deseja continuar?")) return;
        
        setProcessandoAcao(true);
        try {
            const res = await axios.post(`/api/admin/estornos/${id}/aprovar`);
            alert(res.data.message || "Estorno aprovado com sucesso!");
            fecharModal();
            fetchEstornos();
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao aprovar estorno.");
        } finally {
            setProcessandoAcao(false);
        }
    };

    const reprovarEstorno = async (id) => {
        if (!motivoReprovacao) return alert("Digite o motivo detalhado da reprovação.");
        if (!confirm("Atenção! Você está REPROVANDO este estorno. O dinheiro será liberado para o prestador. Deseja continuar?")) return;
        
        setProcessandoAcao(true);
        try {
            const res = await axios.post(`/api/admin/estornos/${id}/reprovar`, {
                motivo_reprovacao: motivoReprovacao
            });
            alert(res.data.message || "Estorno reprovado.");
            fecharModal();
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao reprovar estorno.");
        } finally {
            setProcessandoAcao(false);
        }
    };

    // 4.3. Ações do Prestador
    const enviarContestacao = async (e, id) => {
        e.preventDefault();
        if (contestacaoDescricao.length < 10) {
            return alert("Sua defesa precisa ter pelo menos 10 caracteres explicando a situação.");
        }

        setProcessandoAcao(true);
        try {
            const formData = new FormData();
            formData.append('descricao', contestacaoDescricao);
            
            if (contestacaoImagens.length > 5) {
                setProcessandoAcao(false);
                return alert("Você só pode enviar no máximo 5 fotos de evidência.");
            }

            Array.from(contestacaoImagens).forEach(img => {
                formData.append('imagens[]', img);
            });

            const res = await axios.post(`/api/estornos/${id}/contestar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert(res.data.message || "Sua contestação foi enviada com sucesso!");
            fecharModal();
        } catch (err) {
            alert(err.response?.data?.error || "Ocorreu um erro ao enviar sua contestação.");
        } finally {
            setProcessandoAcao(false);
        }
    };

    const fecharModal = () => {
        setModalOpen(false);
        setDetalhesEstorno(null);
        setMotivoReprovacao('');
        setContestacaoDescricao('');
        setContestacaoImagens([]);
        fetchEstornos();
    };

    // =========================================================================
    // 5. SISTEMA LIGHTBOX (GALERIA DE FOTOS MODERNA)
    // =========================================================================
    const openLightbox = (imagesArray, index) => {
        setLightbox({ isOpen: true, images: imagesArray, currentIndex: index });
    };

    const closeLightbox = () => {
        setLightbox({ isOpen: false, images: [], currentIndex: 0 });
    };

    const nextImage = (e) => {
        e.stopPropagation();
        setLightbox(prev => ({ 
            ...prev, 
            currentIndex: (prev.currentIndex + 1) % prev.images.length 
        }));
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setLightbox(prev => ({ 
            ...prev, 
            currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length 
        }));
    };

    // =========================================================================
    // 6. COMPONENTES VISUAIS E FORMATADORES
    // =========================================================================
    const badgeStatus = (status) => {
        const cores = {
            PENDENTE: 'bg-yellow-100 text-yellow-800',
            EM_ANALISE: 'bg-blue-100 text-blue-800',
            AGUARDANDO_DOCUMENTOS: 'bg-orange-100 text-orange-800',
            APROVADO: 'bg-green-100 text-green-800',
            ESTORNADO: 'bg-green-100 text-green-800',
            REPROVADO: 'bg-red-100 text-red-800',
            CANCELADO: 'bg-gray-100 text-gray-800',
            ERRO_ASAAS: 'bg-red-600 text-white',
        };
        const cor = cores[status] || 'bg-gray-100 text-gray-800';
        return <span className={`px-2 py-1 text-xs font-bold rounded-md ${cor}`}>{status?.replace('_', ' ')}</span>;
    };

    const formatarDinheiro = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    const formatarData = (dataStr) => {
        return new Date(dataStr).toLocaleString('pt-BR');
    };

    // Filtros de Documentos Ativos no Modal
    const clientDocs = detalhesEstorno?.documentos?.filter(d => d.usuario_id === detalhesEstorno.usuario_id) || [];
    const clientDocUrls = clientDocs.map(d => d.arquivo);

    const providerDocs = detalhesEstorno?.documentos?.filter(d => d.usuario_id === detalhesEstorno.prestador_id) || [];
    const providerDocUrls = providerDocs.map(d => d.arquivo);

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Gestão de Estornos e Disputas</h2>}
        >
            <Head title="Estornos" />

            <div className="py-12 font-sans">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {error && (
                        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                            {error}
                        </div>
                    )}

                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {isAdmin ? 'Todos os Estornos do Sistema' : 'Minhas Solicitações e Disputas'}
                                </h3>
                                <button onClick={fetchEstornos} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded border border-gray-300">
                                    Atualizar Lista
                                </button>
                            </div>

                            {/* ESTADO: CARREGANDO */}
                            {loading && (
                                <div className="flex justify-center items-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    <span className="ml-2 text-gray-500">Buscando processos...</span>
                                </div>
                            )}

                            {/* ESTADO: VAZIO */}
                            {!loading && estornos.length === 0 && !error && (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="text-sm font-bold text-gray-900">Nenhum processo encontrado</h3>
                                    <p className="mt-1 text-sm text-gray-500">Sua caixa de disputas e estornos está limpa.</p>
                                </div>
                            )}

                            {/* ESTADO: LISTAGEM */}
                            {!loading && estornos.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Protocolo / Data</th>
                                                {isAdmin && <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Envolvidos</th>}
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo / Valor</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {estornos.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <span className="font-bold text-indigo-700">{item.codigo_estorno}</span> <br/>
                                                        <span className="text-gray-500 text-xs">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            <div title="Cliente Solicitante">C: {item.cliente?.name || 'N/A'}</div>
                                                            <div title="Dono do Estabelecimento" className="text-gray-500 text-xs">P: {item.prestador?.name || 'N/A'}</div>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <div className="font-semibold">{item.categoria}</div>
                                                        <div className="text-gray-600">{formatarDinheiro(item.valor_pago)}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {badgeStatus(item.status)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center">
                                                        <button 
                                                            onClick={() => abrirDetalhes(item.id)}
                                                            className="text-white hover:bg-indigo-700 bg-indigo-600 px-4 py-2 rounded-md font-semibold transition-colors shadow-sm"
                                                        >
                                                            Detalhes
                                                        </button>

                                                        {/* BOTÃO DE BAIXAR O COMPROVANTE */}
                                                        {item.status === 'ESTORNADO' && (
                                                            <a 
                                                                href={`/estornos/${item.id}/comprovante`}
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-green-800 hover:text-green-900 font-semibold border border-green-300 bg-green-100 hover:bg-green-200 px-4 py-2 rounded-md transition-colors shadow-sm inline-flex items-center"
                                                            >
                                                                Baixar PDF
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE DETALHES GIGANTE E BEM ESTRUTURADO */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4 font-sans">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">Processo de Estorno</h3>
                                {detalhesEstorno && (
                                    <p className="text-sm text-gray-500 font-mono mt-1">{detalhesEstorno.codigo_estorno}</p>
                                )}
                            </div>
                            <button onClick={fecharModal} className="text-gray-400 hover:text-gray-800 transition-colors p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 bg-white">
                            
                            {!detalhesEstorno ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    
                                    {/* 1. Header de Status */}
                                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status Atual</span>
                                            {badgeStatus(detalhesEstorno.status)}
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valor Original</span>
                                            <span className="text-xl font-black text-gray-800">{formatarDinheiro(detalhesEstorno.valor_pago)}</span>
                                        </div>
                                    </div>

                                    {/* 2. Envolvidos */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="border border-gray-200 p-4 rounded-lg">
                                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Solicitante (Cliente)</h4>
                                            <p className="font-bold text-gray-800">{detalhesEstorno.cliente?.name}</p>
                                            <p className="text-sm text-gray-600">{detalhesEstorno.cliente?.email}</p>
                                        </div>
                                        <div className="border border-gray-200 p-4 rounded-lg">
                                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Reclamado (Prestador)</h4>
                                            <p className="font-bold text-gray-800">{detalhesEstorno.estabelecimento?.nome || detalhesEstorno.prestador?.name}</p>
                                            <p className="text-sm text-gray-600">{detalhesEstorno.prestador?.email}</p>
                                        </div>
                                    </div>

                                    {/* 3. O Problema (Cliente) */}
                                    <div className="bg-red-50 border border-red-100 p-5 rounded-lg">
                                        <h4 className="font-bold text-red-800 flex items-center gap-2 mb-3">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Relato do Cliente
                                        </h4>
                                        <div className="mb-2">
                                            <span className="font-semibold text-red-900">Motivo:</span> <span className="text-red-700">{detalhesEstorno.motivo}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-red-900 block mb-1">Descrição:</span>
                                            <p className="text-sm text-red-800 bg-white p-3 rounded border border-red-100 whitespace-pre-wrap">
                                                {detalhesEstorno.descricao_cliente}
                                            </p>
                                        </div>

                                        {/* Fotos do Cliente Modernizadas */}
                                        {clientDocs.length > 0 && (
                                            <div className="mt-4">
                                                <span className="font-semibold text-red-900 block mb-2 text-sm">Evidências Anexadas:</span>
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {clientDocs.map((doc, index) => (
                                                        <button 
                                                            key={doc.id} 
                                                            onClick={() => openLightbox(clientDocUrls, index)} 
                                                            type="button"
                                                            className="block w-24 h-24 rounded-lg overflow-hidden border border-red-200 flex-shrink-0 relative group"
                                                        >
                                                            <img src={doc.arquivo} alt="Evidência" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                                </svg>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Defesa do Prestador (Se existir) */}
                                    {detalhesEstorno.mensagens && detalhesEstorno.mensagens.length > 0 && (
                                        <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-lg">
                                            <h4 className="font-bold text-indigo-800 flex items-center gap-2 mb-3">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                                Contestação do Estabelecimento
                                            </h4>
                                            
                                            {detalhesEstorno.mensagens.map(msg => (
                                                <div key={msg.id} className="mb-4 last:mb-0">
                                                    <span className="text-xs text-indigo-500 mb-1 block">Enviado em {formatarData(msg.created_at)}</span>
                                                    <p className="text-sm text-indigo-900 bg-white p-3 rounded border border-indigo-100 whitespace-pre-wrap">
                                                        {msg.mensagem}
                                                    </p>
                                                </div>
                                            ))}

                                            {/* Fotos do Prestador Modernizadas */}
                                            {providerDocs.length > 0 && (
                                                <div className="mt-4">
                                                    <span className="font-semibold text-indigo-900 block mb-2 text-sm">Provas da Defesa:</span>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {providerDocs.map((doc, index) => (
                                                            <button 
                                                                key={doc.id} 
                                                                onClick={() => openLightbox(providerDocUrls, index)} 
                                                                type="button"
                                                                className="block w-24 h-24 rounded-lg overflow-hidden border border-indigo-200 flex-shrink-0 relative group"
                                                            >
                                                                <img src={doc.arquivo} alt="Defesa" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                    <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                                    </svg>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 5. Linha do Tempo (Para todos verem) */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">Histórico do Processo</h4>
                                        <div className="space-y-4 ml-2">
                                            {detalhesEstorno.historicos?.map((hist) => (
                                                <div key={hist.id} className="relative pl-6 border-l-2 border-gray-200">
                                                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1"></div>
                                                    <p className="text-xs text-gray-500">{formatarData(hist.created_at)}</p>
                                                    <p className="text-sm font-semibold text-gray-800">{hist.novo_status}</p>
                                                    <p className="text-sm text-gray-600">{hist.descricao}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-gray-200" />

                                    {/* 🪪 AÇÃO DO PRESTADOR (CONTESTAR) */}
                                    {isPrestador && detalhesEstorno.status === 'PENDENTE' && !detalhesEstorno.prestador_respondeu && (
                                        <div className="bg-orange-50 p-5 rounded-lg border border-orange-200 shadow-inner">
                                            <h4 className="font-black text-orange-800 mb-2 text-lg">Apresentar Defesa (Contestação)</h4>
                                            <p className="text-sm text-orange-700 mb-4">Você tem o direito de contestar este pedido. Explique sua versão dos fatos e anexe provas (fotos/prints) para evitar o estorno.</p>
                                            
                                            <form onSubmit={(e) => enviarContestacao(e, detalhesEstorno.id)} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-orange-900 mb-1">Sua Versão dos Fatos *</label>
                                                    <textarea 
                                                        required
                                                        rows="4"
                                                        className="w-full rounded-md border-orange-300 shadow-sm focus:border-orange-500 focus:ring focus:ring-orange-200 focus:ring-opacity-50 text-sm"
                                                        placeholder="Descreva detalhadamente porque o serviço/aluguel foi prestado corretamente..."
                                                        value={contestacaoDescricao}
                                                        onChange={(e) => setContestacaoDescricao(e.target.value)}
                                                    ></textarea>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-orange-900 mb-1">Anexar Provas (Até 5 fotos)</label>
                                                    <input 
                                                        type="file" 
                                                        multiple 
                                                        accept="image/*"
                                                        onChange={(e) => setContestacaoImagens(e.target.files)}
                                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 cursor-pointer border border-orange-200 rounded-md bg-white p-2"
                                                    />
                                                </div>

                                                <button 
                                                    type="submit"
                                                    disabled={processandoAcao}
                                                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors flex justify-center items-center"
                                                >
                                                    {processandoAcao ? (
                                                        <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Enviando...</>
                                                    ) : "Enviar Contestação"}
                                                </button>
                                            </form>
                                        </div>
                                    )}

                                    {/* 👑 AÇÃO DO ADMINISTRADOR (JULGAR) */}
                                    {isAdmin && (detalhesEstorno.status === 'PENDENTE' || detalhesEstorno.status === 'EM_ANALISE') && (
                                        <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-lg">
                                            <h4 className="font-black text-white mb-2 text-lg">Painel de Julgamento Administrativo</h4>
                                            <p className="text-sm text-gray-300 mb-5">Analise as evidências de ambas as partes. Esta ação é irreversível e movimentará dinheiro real através da API do Asaas.</p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Botão Aprovar (Devolve pro Cliente) */}
                                                <div className="border border-gray-600 p-4 rounded-lg bg-gray-900 flex flex-col justify-between">
                                                    <div>
                                                        <h5 className="font-bold text-green-400 mb-1">Dar Razão ao Cliente</h5>
                                                        <p className="text-xs text-gray-400 mb-4">O valor de {formatarDinheiro(detalhesEstorno.valor_pago)} será devolvido ao cliente via PIX/Cartão.</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => aprovarEstorno(detalhesEstorno.id)}
                                                        disabled={processandoAcao}
                                                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-900 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center"
                                                    >
                                                        {processandoAcao ? "Processando..." : "Aprovar Estorno"}
                                                    </button>
                                                </div>

                                                {/* Botão Reprovar (Repassa pro Prestador) */}
                                                <div className="border border-gray-600 p-4 rounded-lg bg-gray-900 flex flex-col justify-between">
                                                    <div>
                                                        <h5 className="font-bold text-red-400 mb-1">Dar Razão ao Prestador</h5>
                                                        <p className="text-xs text-gray-400 mb-2">A solicitação será negada e o dinheiro será liberado na carteira do prestador.</p>
                                                        
                                                        <textarea 
                                                            required
                                                            rows="2"
                                                            className="w-full rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 shadow-sm focus:border-red-500 focus:ring focus:ring-red-500 focus:ring-opacity-50 text-sm mb-3"
                                                            placeholder="Motivo da reprovação..."
                                                            value={motivoReprovacao}
                                                            onChange={(e) => setMotivoReprovacao(e.target.value)}
                                                        ></textarea>
                                                    </div>
                                                    <button 
                                                        onClick={() => reprovarEstorno(detalhesEstorno.id)}
                                                        disabled={processandoAcao}
                                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center"
                                                    >
                                                        {processandoAcao ? "Processando..." : "Reprovar Estorno"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX MODERNO (GALERIA FULLSCREEN) */}
            {lightbox.isOpen && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
                    onClick={closeLightbox}
                >
                    {/* Botão Fechar */}
                    <button 
                        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[110]" 
                        onClick={closeLightbox}
                    >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    {/* Botão Anterior */}
                    {lightbox.images.length > 1 && (
                        <button 
                            className="absolute left-4 md:left-10 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full z-[110] transition-all" 
                            onClick={prevImage}
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                    )}

                    {/* Imagem Atual */}
                    <img 
                        src={lightbox.images[lightbox.currentIndex]} 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-300" 
                        alt="Visualização" 
                        onClick={(e) => e.stopPropagation()} 
                    />

                    {/* Botão Próximo */}
                    {lightbox.images.length > 1 && (
                        <button 
                            className="absolute right-4 md:right-10 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full z-[110] transition-all" 
                            onClick={nextImage}
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    )}

                    {/* Indicador Numérico */}
                    {lightbox.images.length > 1 && (
                        <div className="absolute bottom-8 text-white font-medium bg-black/60 px-5 py-2 rounded-full tracking-widest text-sm backdrop-blur">
                            {lightbox.currentIndex + 1} / {lightbox.images.length}
                        </div>
                    )}
                </div>
            )}

        </AuthenticatedLayout>
    );
}