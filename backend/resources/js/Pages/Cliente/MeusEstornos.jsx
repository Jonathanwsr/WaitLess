import React, { useState, useEffect, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function MeusEstornos({ auth }) {
    // =========================================================================
    // ESTADOS DA APLICAÇÃO
    // =========================================================================
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
    const [abaAtiva, setAbaAtiva] = useState('elegiveis'); 
    
    // Dados
    const [estornos, setEstornos] = useState([]);
    const [pagamentosElegiveis, setPagamentosElegiveis] = useState([]);
    
    // Loadings
    const [loadingEstornos, setLoadingEstornos] = useState(true);
    const [loadingPagamentos, setLoadingPagamentos] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('');

    // Modais & Formulário
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedEstorno, setSelectedEstorno] = useState(null);
    const [itemParaEstorno, setItemParaEstorno] = useState(null); 

    const [submitting, setSubmitting] = useState(false);
    const [erroForm, setErroForm] = useState('');
    const [imagens, setImagens] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [formData, setFormData] = useState({
        pagamento_id: '',
        motivo: '',
        descricao: '',
        categoria: 'SERVICO',
    });

    // =========================================================================
    // REQUISIÇÕES DA API
    // =========================================================================
    const carregarEstornos = useCallback(async () => {
        if (!navigator.onLine) return;
        setLoadingEstornos(true);
        try {
            const url = filtroStatus ? `/api/estornos/lista?status=${filtroStatus}` : '/api/estornos/lista';
            const response = await axios.get(url);
            setEstornos(response.data?.data || response.data || []);
        } catch (error) {
            console.error("Erro ao buscar estornos:", error);
        } finally {
            setLoadingEstornos(false);
        }
    }, [filtroStatus]);

    const carregarPagamentosElegiveis = useCallback(async () => {
        if (!navigator.onLine) return;
        setLoadingPagamentos(true);
        try {
            const response = await axios.get('/pagamentos/elegiveis-estorno');
            setPagamentosElegiveis(response.data || []);
        } catch (error) {
            console.error("Erro ao carregar elegíveis:", error);
        } finally {
            setLoadingPagamentos(false);
        }
    }, []);

    // =========================================================================
    // EFFECTS
    // =========================================================================
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        carregarEstornos();
        carregarPagamentosElegiveis();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [carregarEstornos, carregarPagamentosElegiveis]);

    useEffect(() => {
        return () => previews.forEach((url) => URL.revokeObjectURL(url));
    }, [previews]);

    // =========================================================================
    // FUNÇÕES DO FORMULÁRIO E MODAIS
    // =========================================================================
    const formatarMoeda = (valor) => valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : 'R$ 0,00';

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files).slice(0, 5);
        previews.forEach((url) => URL.revokeObjectURL(url));
        setImagens(files);
        setPreviews(files.map((file) => URL.createObjectURL(file)));
    };

    // Função de remover imagem aprimorada
    const removerImagem = (index) => {
        URL.revokeObjectURL(previews[index]);
        setImagens((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const abrirModalComItem = (pagamento) => {
        previews.forEach((url) => URL.revokeObjectURL(url));
        const categoria = pagamento.servico ? 'SERVICO' : 'ALUGUEL';
        setItemParaEstorno(pagamento);
        setFormData({
            pagamento_id: pagamento.id,
            motivo: '',
            descricao: '',
            categoria: categoria,
        });
        setImagens([]);
        setPreviews([]);
        setErroForm('');
        setIsModalOpen(true);
    };

    const submitSolicitacao = async (e) => {
        e.preventDefault();
        if (!isOnline) {
            setErroForm('Você está offline.'); return;
        }

        setErroForm('');
        setSubmitting(true);

        try {
            const data = new FormData();
            data.append('motivo', formData.motivo);
            data.append('descricao', formData.descricao);
            data.append('categoria', formData.categoria);
            imagens.forEach((img) => data.append('imagens[]', img));

            await axios.post(`/api/estornos/${formData.pagamento_id}/solicitar`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIsModalOpen(false);
            alert('Solicitação de estorno enviada com sucesso!');
            carregarEstornos();
            carregarPagamentosElegiveis(); 
            setAbaAtiva('solicitacoes'); 
        } catch (error) {
            setErroForm(error.response?.data?.error || 'Erro ao enviar a solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    const abrirDetalhes = (estorno) => {
        setSelectedEstorno(estorno);
        setIsDetailsModalOpen(true);
    };

    const renderStatusBadge = (status) => {
        const cores = {
            PENDENTE: 'bg-amber-100 text-amber-800 border-amber-200',
            APROVADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            REPROVADO: 'bg-rose-100 text-rose-800 border-rose-200',
            CONTESTADO: 'bg-orange-100 text-orange-800 border-orange-200'
        };
        const cor = cores[status?.toUpperCase()] || 'bg-slate-100 text-slate-800 border-slate-200';
        return <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${cor}`}>{status}</span>;
    };

    const getFotoItem = (item) => {
        return item?.servico?.fotos?.[0]?.url || item?.item_aluguel?.fotos?.[0]?.url || item?.servico?.imagem || item?.item_aluguel?.imagem;
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Meus Estornos" />

            <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                
                {/* CABEÇALHO */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-6">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Meus Estornos</h2>
                        <p className="text-slate-500 mt-2 text-sm font-medium">Solicite e acompanhe reembolsos de pagamentos elegíveis.</p>
                    </div>
                </div>

                {/* ABAS */}
                <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-100 rounded-2xl w-max max-w-full no-scrollbar border border-slate-200/60 touch-pan-x">
                        <button onClick={() => setAbaAtiva('elegiveis')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${abaAtiva === 'elegiveis' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}>
                            Disponíveis para Estorno
                            {pagamentosElegiveis.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black border ${abaAtiva === 'elegiveis' ? 'bg-blue-600 text-white border-transparent' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                    {pagamentosElegiveis.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setAbaAtiva('solicitacoes')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${abaAtiva === 'solicitacoes' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}>
                            Minhas Solicitações
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO DA ABA 1: ELEGÍVEIS */}
                {abaAtiva === 'elegiveis' && (
                    <>
                        {loadingPagamentos ? (
                            <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Buscando serviços disponíveis...</div>
                        ) : pagamentosElegiveis.length === 0 ? (
                            <div className="text-center py-20 bg-white/50 rounded-[2rem] border border-slate-200 border-dashed">
                                <h4 className="text-xl font-bold text-slate-800">Nada por aqui</h4>
                                <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">Você não possui pagamentos recentes dentro do prazo (4 dias) para solicitar estorno.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {pagamentosElegiveis.map((pag) => {
                                    const nome = pag.servico?.nome || pag.item_aluguel?.nome || 'Serviço/Aluguel';
                                    const local = pag.estabelecimento?.nome || pag.agendamento?.estabelecimento?.nome;
                                    const fotoUrl = getFotoItem(pag);
                                    
                                    return (
                                        <div key={pag.id} className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-6 gap-2">
                                                    <div className="flex-shrink-0 mt-1">
                                                        <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-black rounded-lg border ${pag.servico ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                                                            {pag.servico ? 'Serviço' : 'Aluguel'}
                                                        </span>
                                                    </div>
                                                    <div className="text-right break-words">
                                                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                            {formatarMoeda(pag.valor_total)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mb-6 flex gap-4 items-center">
                                                    {fotoUrl ? (
                                                        <img src={fotoUrl} alt={nome} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-100 shrink-0" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-900 leading-tight mb-1 line-clamp-2">{nome}</h4>
                                                        <p className="text-sm font-semibold text-slate-500 truncate">{local}</p>
                                                    </div>
                                                </div>

                                                <div className="mb-6 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Prazo para solicitação</p>
                                                    <p className="text-sm font-bold text-rose-900">Expira em {pag.data_limite_formatada}</p>
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <button onClick={() => abrirModalComItem(pag)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm">
                                                    Solicitar Estorno
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* CONTEÚDO DA ABA 2: SOLICITAÇÕES */}
                {abaAtiva === 'solicitacoes' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            {loadingEstornos ? (
                                <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Carregando suas solicitações...</div>
                            ) : estornos.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-medium">
                                    Você não fez nenhuma solicitação de estorno ainda.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Data</th>
                                            <th className="px-6 py-4">Referência</th>
                                            <th className="px-6 py-4">Motivo</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {estornos.map((estorno) => {
                                            const foto = getFotoItem(estorno);
                                            return (
                                                <tr key={estorno.id} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                                                        {new Date(estorno.created_at).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-6 py-4 min-w-[250px]">
                                                        <div className="flex items-center gap-3">
                                                            {foto ? (
                                                                <img src={foto} alt="Capa" className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                                                                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                                                                        estorno.categoria === 'SERVICO' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                    }`}>
                                                                        {estorno.categoria}
                                                                    </span>
                                                                </div>
                                                                <div className="font-bold text-slate-900 leading-tight truncate max-w-[180px]">
                                                                    {estorno.categoria === 'SERVICO' 
                                                                        ? (estorno.servico?.nome || estorno.titulo || 'Serviço')
                                                                        : (estorno.item_aluguel?.nome || estorno.titulo || 'Item')}
                                                                </div>
                                                                <div className="text-xs text-slate-500 font-medium truncate max-w-[180px]">
                                                                    {estorno.estabelecimento?.nome}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 min-w-[200px]">
                                                        <p className="text-slate-600 truncate max-w-xs font-medium" title={estorno.motivo}>
                                                            {estorno.motivo}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {renderStatusBadge(estorno.status)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => abrirDetalhes(estorno)}
                                                                className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                                                            >
                                                                Detalhes
                                                            </button>

                                                            {/* BOTÃO DE BAIXAR ADICIONADO AQUI */}
                                                            {estorno.status === 'ESTORNADO' && (
                                                                <a 
                                                                    href={`/estornos/${estorno.id}/comprovante`}
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-emerald-700 hover:text-emerald-900 font-bold text-sm bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors"
                                                                >
                                                                    Baixar PDF
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE SOLICITAÇÃO */}
            {isModalOpen && itemParaEstorno && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
                            <h3 className="text-xl font-black text-slate-900">Confirmar Estorno</h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                <span className="font-bold">✕</span>
                            </button>
                        </div>

                        <form onSubmit={submitSolicitacao} className="p-6 space-y-5">
                            {erroForm && (
                                <div className="p-4 bg-rose-50 text-rose-700 text-sm font-medium rounded-xl border border-rose-200">
                                    {erroForm}
                                </div>
                            )}

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Solicitando estorno para:</p>
                                <p className="text-base font-bold text-slate-900">
                                    {itemParaEstorno.servico?.nome || itemParaEstorno.item_aluguel?.nome} - {formatarMoeda(itemParaEstorno.valor_total)}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wide text-slate-700 mb-2">Motivo Resumido</label>
                                <input 
                                    type="text" 
                                    name="motivo"
                                    required
                                    value={formData.motivo}
                                    onChange={handleInputChange}
                                    placeholder="Ex: Serviço não finalizado, cobrança indevida..."
                                    className="w-full border-slate-300 rounded-xl text-sm p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wide text-slate-700 mb-2">Descrição Detalhada</label>
                                <textarea 
                                    name="descricao"
                                    required
                                    rows="4"
                                    minLength={10}
                                    value={formData.descricao}
                                    onChange={handleInputChange}
                                    placeholder="Explique detalhadamente o ocorrido para que possamos analisar..."
                                    className="w-full border-slate-300 rounded-xl text-sm p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wide text-slate-700 mb-2">Evidências (Opcional)</label>
                                <input 
                                    type="file" 
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer"
                                />
                                <span className="text-[11px] font-medium text-slate-400 mt-2 block">Selecione até 5 fotos (JPG/PNG, máx 2MB cada).</span>

                                {previews.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        {previews.map((src, index) => (
                                            <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group shadow-sm">
                                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => removerImagem(index)}
                                                    className="absolute top-1 right-1 bg-black/60 backdrop-blur-md text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-rose-600 transition-colors z-10 shadow"
                                                    title="Remover imagem"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                    disabled={submitting}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-70 transition-colors flex items-center justify-center"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Enviando...' : 'Confirmar Solicitação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE DETALHES COMPLETO */}
            {isDetailsModalOpen && selectedEstorno && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Detalhes do Estorno</h3>
                                <p className="text-xs font-medium text-slate-500 mt-1">Solicitado em {new Date(selectedEstorno.created_at).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                <span className="font-bold">✕</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Status Atual</span>
                                {renderStatusBadge(selectedEstorno.status)}
                            </div>
                            
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Referência</label>
                                <p className="text-base font-bold text-slate-900">
                                    {selectedEstorno.categoria === 'SERVICO' ? (selectedEstorno.servico?.nome || selectedEstorno.titulo) : (selectedEstorno.item_aluguel?.nome || selectedEstorno.titulo)}
                                </p>
                                <p className="text-sm font-medium text-slate-500 mt-1">{selectedEstorno.estabelecimento?.nome}</p>
                            </div>
                            
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Motivo Informado</label>
                                <p className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedEstorno.motivo}</p>
                            </div>
                            
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Descrição Detalhada</label>
                                <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                                    {selectedEstorno.descricao}
                                </p>
                            </div>

                            {selectedEstorno.imagens && selectedEstorno.imagens.length > 0 && (
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Evidências Anexadas</label>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedEstorno.imagens.map((img, index) => (
                                            <a key={index} href={img.url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                                                <img src={img.url} alt={`Evidência ${index + 1}`} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                            <button 
                                onClick={() => setIsDetailsModalOpen(false)}
                                className="w-full py-3 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}