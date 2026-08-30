import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function EstornosEstabelecimento({ auth }) {
    const [estornos, setEstornos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('');

    // Estados do Modal e Contestação
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEstorno, setSelectedEstorno] = useState(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);
    
    // Lightbox Moderno para Fotos
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });
    
    const [contestacaoDescricao, setContestacaoDescricao] = useState('');
    const [contestacaoImagens, setContestacaoImagens] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // =========================================================================
    // CONTROLE DE ACESSO
    // =========================================================================
    const papel = auth.user?.papel?.toLowerCase() || '';
    const isAuthorized = ['socio', 'proprietario', 'gerente'].includes(papel);

    useEffect(() => {
        if (isAuthorized) {
            carregarEstornos();
        }
    }, [filtroStatus, isAuthorized]);

    // Limpa a memória das imagens quando fechar
    useEffect(() => {
        return () => previews.forEach((url) => URL.revokeObjectURL(url));
    }, [previews]);

    const carregarEstornos = async () => {
        setLoading(true);
        try {
            const url = filtroStatus 
                ? `/api/estornos/lista?status=${filtroStatus}` 
                : '/api/estornos/lista';
            
            const response = await axios.get(url);
            setEstornos(response.data.data || response.data);
        } catch (error) {
            console.error("Erro ao buscar estornos do estabelecimento:", error);
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // AÇÕES DO MODAL E CONTESTAÇÃO
    // =========================================================================
    const abrirDetalhes = async (id) => {
        setIsModalOpen(true);
        setLoadingDetalhes(true);
        setSelectedEstorno(null);
        setContestacaoDescricao('');
        setContestacaoImagens([]);
        setPreviews([]);
        
        try {
            const response = await axios.get(`/api/estornos/${id}/detalhes`);
            setSelectedEstorno(response.data.data);
        } catch (err) {
            alert("Erro ao carregar detalhes da solicitação.");
            setIsModalOpen(false);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    const fecharModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedEstorno(null), 200);
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files).slice(0, 5);
        previews.forEach((url) => URL.revokeObjectURL(url));
        setContestacaoImagens(files);
        setPreviews(files.map((file) => URL.createObjectURL(file)));
    };

    const removerImagem = (index) => {
        URL.revokeObjectURL(previews[index]);
        setContestacaoImagens((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const enviarContestacao = async (e) => {
        e.preventDefault();
        if (contestacaoDescricao.length < 10) {
            return alert("Sua defesa precisa ter pelo menos 10 caracteres explicando a situação.");
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('descricao', contestacaoDescricao);
            
            contestacaoImagens.forEach(img => {
                formData.append('imagens[]', img);
            });

            const res = await axios.post(`/api/estornos/${selectedEstorno.id}/contestar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert(res.data.message || "Sua contestação foi enviada com sucesso!");
            fecharModal();
            carregarEstornos();
        } catch (err) {
            alert(err.response?.data?.error || "Ocorreu um erro ao enviar sua contestação.");
        } finally {
            setSubmitting(false);
        }
    };

    // =========================================================================
    // SISTEMA LIGHTBOX (GALERIA DE FOTOS MODERNA)
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
    // UTILITÁRIOS DE TELA
    // =========================================================================
    const formatarMoeda = (valor) => valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : 'R$ 0,00';
    const formatarData = (dataStr) => new Date(dataStr).toLocaleString('pt-BR');

    const renderStatusBadge = (status) => {
        const cores = {
            PENDENTE: 'bg-amber-100 text-amber-800 border-amber-200',
            EM_ANALISE: 'bg-blue-100 text-blue-800 border-blue-200',
            APROVADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            ESTORNADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            REPROVADO: 'bg-rose-100 text-rose-800 border-rose-200',
            CONTESTADO: 'bg-orange-100 text-orange-800 border-orange-200'
        };
        const cor = cores[status?.toUpperCase()] || 'bg-slate-100 text-slate-800 border-slate-200';
        
        return (
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${cor}`}>
                {status}
            </span>
        );
    };

    // Filtros de Documentos Ativos no Modal
    const clientDocs = selectedEstorno?.documentos?.filter(d => d.usuario_id === selectedEstorno.usuario_id) || [];
    const clientDocUrls = clientDocs.map(d => d.arquivo);

    const providerDocs = selectedEstorno?.documentos?.filter(d => d.usuario_id === selectedEstorno.prestador_id) || [];
    const providerDocUrls = providerDocs.map(d => d.arquivo);

    if (!isAuthorized) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
                    <Head title="Acesso Negado" />
                    <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                        <h2 className="text-2xl font-black text-slate-900 mb-3">Acesso Restrito</h2>
                        <p className="text-slate-500 font-medium">Você não tem permissão para acessar o painel de disputas e estornos do estabelecimento.</p>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout user={auth.user}>
            <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
                <Head title="Gestão de Estornos" />

                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Cabeçalho e Filtro */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Gestão de Estornos</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">Solicitações de reembolso feitas por seus clientes.</p>
                        </div>
                        
                        <div className="w-full md:w-auto">
                            <select 
                                className="w-full md:w-64 bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer"
                                value={filtroStatus}
                                onChange={(e) => setFiltroStatus(e.target.value)}
                            >
                                <option value="">Todos os status</option>
                                <option value="PENDENTE">Aguardando sua ação</option>
                                <option value="EM_ANALISE">Em Análise pela Plataforma</option>
                                <option value="ESTORNADO">Devolvidos ao Cliente</option>
                                <option value="REPROVADO">A seu favor (Reprovados)</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabela de Dados */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        {loading ? (
                            <div className="p-16 text-center text-slate-400 font-bold animate-pulse">
                                Buscando solicitações...
                            </div>
                        ) : estornos.length === 0 ? (
                            <div className="p-16 text-center">
                                <h3 className="text-lg font-bold text-slate-800 mb-1">Nenhum registro encontrado</h3>
                                <p className="text-slate-500 text-sm font-medium">Nenhum estorno atende aos critérios no momento.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-left">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data do Pedido</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente / Referência</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo Alegado</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {estornos.map((estorno) => (
                                            <tr key={estorno.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600">
                                                    {new Date(estorno.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                                
                                                <td className="px-6 py-4 min-w-[250px]">
                                                    <div className="text-sm font-black text-slate-900 mb-0.5">
                                                        {estorno.cliente?.name || 'Cliente'} 
                                                        <span className="text-slate-400 font-medium ml-2 font-mono text-xs">#{estorno.pagamento_id}</span>
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-500">
                                                        {estorno.categoria === 'SERVICO' 
                                                            ? (estorno.servico?.nome || 'Serviço') 
                                                            : (estorno.item_aluguel?.nome || 'Aluguel')}
                                                    </div>
                                                </td>
                                                
                                                <td className="px-6 py-4 min-w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-semibold text-slate-700 truncate max-w-xs" title={estorno.motivo}>
                                                            {estorno.motivo}
                                                        </div>
                                                        {!estorno.prestador_visualizou && estorno.status === 'PENDENTE' && (
                                                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                                                Novo
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {renderStatusBadge(estorno.status)}
                                                </td>
                                                
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-3">
                                                    
                                                    <button 
                                                        onClick={() => abrirDetalhes(estorno.id)}
                                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                                            estorno.status === 'PENDENTE' 
                                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent focus:ring-orange-500 shadow-orange-500/30' 
                                                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 focus:ring-slate-200 shadow-slate-200/50'
                                                        }`}
                                                    >
                                                        {estorno.status === 'PENDENTE' ? (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                Analisar Defesa
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                Ver Detalhes
                                                            </>
                                                        )}
                                                    </button>

                                                    {estorno.status === 'ESTORNADO' && (
                                                        <a 
                                                            href={`/estornos/${estorno.id}/comprovante`}
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-all duration-200 shadow-sm hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 shadow-slate-200/50"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            Comprovante
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

            {/* MODAL DE DETALHES / CONTESTAÇÃO */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Processo de Estorno</h3>
                                {selectedEstorno && (
                                    <p className="text-xs font-mono text-slate-500 mt-1">{selectedEstorno.codigo_estorno}</p>
                                )}
                            </div>
                            <button onClick={fecharModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors focus:outline-none">
                                <span className="font-bold">✕</span>
                            </button>
                        </div>

                        <div className="p-6 flex-1 bg-white">
                            {loadingDetalhes || !selectedEstorno ? (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    
                                    {/* Cabecalho Info */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <div>
                                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Status do Processo</span>
                                            {renderStatusBadge(selectedEstorno.status)}
                                        </div>
                                        <div className="sm:text-right">
                                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Valor em Disputa</span>
                                            <span className="text-xl font-black text-slate-800">{formatarMoeda(selectedEstorno.valor_pago)}</span>
                                        </div>
                                    </div>

                                    {/* Reclamação do Cliente */}
                                    <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl">
                                        <h4 className="font-bold text-rose-800 mb-3 flex items-center gap-2">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Alegação do Cliente ({selectedEstorno.cliente?.name})
                                        </h4>
                                        <div className="mb-3">
                                            <span className="text-xs font-black uppercase tracking-wider text-rose-900/60 block mb-0.5">Motivo</span>
                                            <span className="font-bold text-rose-900">{selectedEstorno.motivo}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-black uppercase tracking-wider text-rose-900/60 block mb-1">Detalhes Informados</span>
                                            <p className="text-sm text-rose-800 bg-white p-3 rounded-xl border border-rose-100/50 whitespace-pre-wrap">
                                                {selectedEstorno.descricao_cliente || selectedEstorno.descricao}
                                            </p>
                                        </div>

                                        {clientDocs.length > 0 && (
                                            <div className="mt-4">
                                                <span className="text-xs font-black uppercase tracking-wider text-rose-900/60 block mb-2">Evidências Anexadas</span>
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {clientDocs.map((doc, index) => (
                                                        <button 
                                                            key={doc.id} 
                                                            onClick={() => openLightbox(clientDocUrls, index)} 
                                                            type="button"
                                                            className="block w-20 h-20 rounded-xl overflow-hidden border border-rose-200 shrink-0 relative group"
                                                        >
                                                            <img src={doc.arquivo} alt="Evidência Cliente" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
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

                                    {/* Formulário de Defesa SE pendente */}
                                    {selectedEstorno.status === 'PENDENTE' && !selectedEstorno.prestador_respondeu ? (
                                        <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl shadow-inner">
                                            <h4 className="font-black text-orange-800 text-lg mb-2">Sua Defesa (Contestação)</h4>
                                            <p className="text-sm text-orange-700 mb-5">
                                                O valor de {formatarMoeda(selectedEstorno.valor_pago)} foi temporariamente retido da sua carteira. 
                                                Envie sua versão dos fatos e evidências (fotos do serviço concluído, conversas, etc) para contestar esta devolução.
                                            </p>
                                            
                                            <form onSubmit={enviarContestacao} className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-wider text-orange-900 mb-2">Detalhes da sua Defesa *</label>
                                                    <textarea 
                                                        required
                                                        rows="4"
                                                        className="w-full rounded-xl border-orange-300 bg-white shadow-sm focus:border-orange-500 focus:ring focus:ring-orange-200 text-sm p-3 resize-none outline-none"
                                                        placeholder="Explique porque o estorno não é devido..."
                                                        value={contestacaoDescricao}
                                                        onChange={(e) => setContestacaoDescricao(e.target.value)}
                                                    ></textarea>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-wider text-orange-900 mb-2">Anexar Provas (Opcional, máx 5)</label>
                                                    <input 
                                                        type="file" 
                                                        multiple 
                                                        accept="image/*"
                                                        onChange={handleFileChange}
                                                        className="block w-full text-sm text-orange-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-orange-700 hover:file:bg-orange-100 cursor-pointer border border-orange-300 rounded-xl bg-orange-100/50 p-1.5 transition-colors"
                                                    />
                                                </div>

                                                {previews.length > 0 && (
                                                    <div className="flex flex-wrap gap-3 mt-3">
                                                        {previews.map((src, index) => (
                                                            <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-orange-300 group shadow-sm">
                                                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removerImagem(index)}
                                                                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-500 transition-colors z-10 text-[10px]"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="pt-2">
                                                    <button 
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center gap-2"
                                                    >
                                                        {submitting ? (
                                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Enviando...</>
                                                        ) : (
                                                            "Enviar Defesa para Administração"
                                                        )}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        // Visualização da Defesa se já foi enviada
                                        selectedEstorno.mensagens?.length > 0 && (
                                            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                                                <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                    Sua Contestação
                                                </h4>
                                                
                                                {selectedEstorno.mensagens.map(msg => (
                                                    <div key={msg.id} className="mb-4">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-900/60 block mb-1">
                                                            Enviado em {formatarData(msg.created_at)}
                                                        </span>
                                                        <p className="text-sm text-blue-900 bg-white p-3 rounded-xl border border-blue-100/50 whitespace-pre-wrap">
                                                            {msg.mensagem}
                                                        </p>
                                                    </div>
                                                ))}

                                                {providerDocs.length > 0 && (
                                                    <div className="mt-4">
                                                        <span className="text-xs font-black uppercase tracking-wider text-blue-900/60 block mb-2">Suas Evidências</span>
                                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                                            {providerDocs.map((doc, index) => (
                                                                <button 
                                                                    key={doc.id} 
                                                                    onClick={() => openLightbox(providerDocUrls, index)} 
                                                                    type="button"
                                                                    className="block w-20 h-20 rounded-xl overflow-hidden border border-blue-200 shrink-0 relative group"
                                                                >
                                                                    <img src={doc.arquivo} alt="Sua Evidência" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
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
                                        )
                                    )}

                                    {/* Linha do Tempo */}
                                    <div className="pt-2">
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                                            Histórico do Processo
                                        </h4>
                                        <div className="space-y-4 ml-1.5">
                                            {selectedEstorno.historicos?.map((hist) => (
                                                <div key={hist.id} className="relative pl-5 border-l-2 border-slate-200">
                                                    <div className="absolute w-2.5 h-2.5 bg-slate-300 rounded-full -left-[5.5px] top-1.5 ring-4 ring-white"></div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatarData(hist.created_at)}</p>
                                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{hist.novo_status}</p>
                                                    <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{hist.descricao}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

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