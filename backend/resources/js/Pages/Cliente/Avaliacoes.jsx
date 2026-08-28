import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { 
    Star, ChevronRight, CheckCircle2, ImageOff, MapPin, 
    MessageSquare, Camera, XCircle, Loader2, Store, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Componente para limitar o texto e adicionar "Ver mais"
const ExpandableText = ({ text, maxLength = 150 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!text) return null;
    if (text.length <= maxLength) return <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-4">{text}</p>;

    return (
        <div className="mb-4">
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed inline">
                {isExpanded ? text : `${text.substring(0, maxLength)}... `}
            </p>
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="text-[#FF5A00] font-bold text-sm hover:underline ml-1 focus:outline-none"
            >
                {isExpanded ? 'Ver menos' : 'Ler mais'}
            </button>
        </div>
    );
};

export default function Avaliacoes({ auth, item, avaliacoes, estatisticas, itemNaoEncontrado, tipo }) {
    const { url, errors, flash } = usePage().props;
    const searchParams = new URLSearchParams(window.location.search);
    const agendamentoId = searchParams.get('agendamento');
    const aluguelId = searchParams.get('aluguel');

    // Estado da Tela e Filtros
    const [filtroEstrela, setFiltroEstrela] = useState('Todas');
    const [mostrarFormulario, setMostrarFormulario] = useState(!!agendamentoId || !!aluguelId);
    
    // Controle de Passos (Wizard de Avaliação)
    const [passoFormulario, setPassoFormulario] = useState(1); // 1 = Local, 2 = Serviço/Reserva

    // Estados do Formulário de Avaliação
    const [notaLocal, setNotaLocal] = useState(5);
    const [notaServico, setNotaServico] = useState(5);
    const [comentario, setComentario] = useState('');
    const [fotos, setFotos] = useState([]);
    const [fotosPreviews, setFotosPreviews] = useState([]);
    const [enviando, setEnviando] = useState(false);
    
    if (itemNaoEncontrado || !item) {
        return (
            <AuthenticatedLayout user={auth?.user}>
                <Head title="Não Encontrado" />
                <div className="bg-[#FBF9F9] min-h-screen flex flex-col items-center justify-center font-sans p-4 text-center">
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-200 max-w-md w-full flex flex-col items-center">
                        <ImageOff className="w-20 h-20 text-gray-300 mb-4" />
                        <h1 className="text-2xl font-black text-gray-900 mb-2">Página não encontrada</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed text-sm sm:text-base">
                            Não foi possível encontrar as avaliações deste serviço ou espaço. Ele pode ter sido removido.
                        </p>
                        <Link href={route('cliente.explorar')} className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                            Voltar para Explorar
                        </Link>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    // ----------------------------------------------------------------------
    // LÓGICA DE UPLOAD DE FOTOS NO FRONT (Com limite de 2MB)
    // ----------------------------------------------------------------------
    const handleAddFoto = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + fotos.length > 4) {
            alert('Você pode enviar no máximo 4 fotos.');
            return;
        }

        const validFiles = files.filter(file => file.size <= 2 * 1024 * 1024); // Máximo 2MB
        if (validFiles.length < files.length) {
            alert('Atenção: Algumas fotos são maiores que 2MB e não foram adicionadas.');
        }

        const newFotos = [...fotos, ...validFiles];
        setFotos(newFotos);

        const newPreviews = validFiles.map(file => URL.createObjectURL(file));
        setFotosPreviews([...fotosPreviews, ...newPreviews]);
    };

    const removerFoto = (index) => {
        const novasFotos = [...fotos];
        novasFotos.splice(index, 1);
        setFotos(novasFotos);

        const novasPreviews = [...fotosPreviews];
        URL.revokeObjectURL(novasPreviews[index]);
        novasPreviews.splice(index, 1);
        setFotosPreviews(novasPreviews);
    };

    // ----------------------------------------------------------------------
    // SUBMISSÃO DA AVALIAÇÃO (Agendamento/Aluguel)
    // ----------------------------------------------------------------------
    const submitAvaliacao = (e) => {
        e.preventDefault();
        setEnviando(true);

        const formData = new FormData();
        formData.append('estabelecimento_id', tipo === 'estabelecimento' ? item.id : item.estabelecimento_id);
        
        if (agendamentoId) formData.append('agendamento_id', agendamentoId);
        if (aluguelId) formData.append('aluguel_id', aluguelId);
        
        // Mapeando a "Nota Servico" como nota geral e "Nota Local" como nota de localização
        formData.append('nota', notaServico);
        formData.append('nota_localizacao', notaLocal);
        formData.append('comentario', comentario);
        formData.append('publica', 1);

        fotos.forEach((foto, i) => {
            formData.append(`fotos[${i}]`, foto);
        });

        router.post('/api/avaliacoes', formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setMostrarFormulario(false);
                setPassoFormulario(1);
                setComentario('');
                setFotos([]);
                setFotosPreviews([]);
            },
            onFinish: () => setEnviando(false)
        });
    };

    // ----------------------------------------------------------------------
    // FUNÇÕES AUXILIARES
    // ----------------------------------------------------------------------
    const calcularPorcentagem = (quantidade) => {
        if (!estatisticas.total || estatisticas.total === 0) return 0;
        return (quantidade / estatisticas.total) * 100;
    };

    const parseFotosSeguro = (fotosData) => {
        if (!fotosData) return [];
        if (typeof fotosData === 'string') {
            try { return JSON.parse(fotosData); } catch (e) { return []; }
        }
        return Array.isArray(fotosData) ? fotosData : [];
    };

    const ProgressBar = ({ label, quantidade }) => (
        <div className="flex items-center gap-2 sm:gap-4 text-sm mb-2 w-full">
            <span className="w-16 text-gray-600 shrink-0 text-xs sm:text-sm">{label} estrelas</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#FF5A00] rounded-full transition-all duration-1000" 
                    style={{ width: `${calcularPorcentagem(quantidade)}%` }}
                ></div>
            </div>
            <span className="w-8 text-right text-gray-600 font-medium shrink-0 text-xs sm:text-sm">{quantidade}</span>
        </div>
    );

    const CategoryScore = ({ icon: Icon, label, score }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5A00]" />
                <span className="text-gray-800 font-medium text-sm sm:text-base">{label}</span>
            </div>
            <span className="font-bold text-gray-900">{Number(score || 0).toFixed(1)}</span>
        </div>
    );

    const labelContexto = aluguelId || tipo === 'aluguel' ? 'reserva/espaço' : 'serviço';

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`Avaliações de ${item.nome}`} />

            <div className="bg-[#FBF9F9] min-h-screen pb-24 font-sans">
                
                {/* BREADCRUMB RESPONSIVO */}
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4">
                    <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-500 font-medium gap-y-1">
                        <Link href={route('dashboard')} className="hover:underline">Início</Link>
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 mx-1 sm:mx-2" />
                        <Link href={route('cliente.explorar')} className="hover:underline">Destinos</Link>
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 mx-1 sm:mx-2" />
                        <span className="hover:underline cursor-pointer truncate">{item.cidade || 'Localidade'}</span>
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 mx-1 sm:mx-2" />
                        <span className="text-gray-900 font-bold truncate">Avaliações</span>
                    </div>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* ALERTAS */}
                    <AnimatePresence>
                        {flash?.success && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
                                <CheckCircle2 className="w-5 h-5 shrink-0"/> {flash.success}
                            </motion.div>
                        )}
                        {errors?.error && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 text-red-800 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
                                <XCircle className="w-5 h-5 shrink-0"/> {errors.error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CABEÇALHO */}
                    <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-1 sm:mb-2 tracking-tight">Avaliações: {item.nome}</h1>
                            <p className="text-sm sm:text-base text-gray-500 font-medium">Veja o que os clientes que já utilizaram têm a dizer.</p>
                        </div>
                        {(!mostrarFormulario && (agendamentoId || aluguelId)) && (
                            <button onClick={() => setMostrarFormulario(true)} className="bg-[#FF5A00] hover:bg-[#E04F00] text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm sm:text-base">
                                <Star className="w-5 h-5 fill-current" /> Deixar minha Avaliação
                            </button>
                        )}
                    </div>

                    {/* WIZARD DE AVALIAÇÃO EM 2 PASSOS */}
                    <AnimatePresence>
                        {mostrarFormulario && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }} 
                                exit={{ opacity: 0, height: 0 }} 
                                className="overflow-hidden mb-8"
                            >
                                <div className="bg-white rounded-3xl p-5 sm:p-8 border border-gray-200 shadow-sm">
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 border-b border-gray-100 pb-4">
                                        <div>
                                            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                                                {passoFormulario === 1 ? '1. Como estava o Local?' : `2. Como foi o ${labelContexto}?`}
                                            </h3>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Passo {passoFormulario} de 2</p>
                                        </div>
                                        <button onClick={() => setMostrarFormulario(false)} className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors self-start sm:self-auto">Cancelar e fechar</button>
                                    </div>

                                    {/* PASSO 1: AVALIAÇÃO DO LOCAL */}
                                    {passoFormulario === 1 ? (
                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                            <div className="flex flex-col items-center bg-gray-50 py-8 rounded-2xl border border-gray-100">
                                                <Store className="w-8 h-8 text-gray-400 mb-2" />
                                                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-4 uppercase tracking-widest text-center">Nota para o Espaço Físico / Estrutura</p>
                                                <div className="flex gap-1 sm:gap-2">
                                                    {[1, 2, 3, 4, 5].map((estrela) => (
                                                        <button 
                                                            type="button" 
                                                            key={`local-${estrela}`}
                                                            onClick={() => setNotaLocal(estrela)}
                                                            className="focus:outline-none transition-transform hover:scale-110 active:scale-95 p-1"
                                                        >
                                                            <Star className={`w-12 h-12 sm:w-14 sm:h-14 transition-colors ${notaLocal >= estrela ? 'fill-[#FF5A00] text-[#FF5A00]' : 'text-gray-300'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-sm font-bold mt-4 text-gray-700">
                                                    {notaLocal === 5 ? 'Excelente' : notaLocal === 4 ? 'Muito Bom' : notaLocal === 3 ? 'Bom' : notaLocal === 2 ? 'Ruim' : 'Péssimo'}
                                                </p>
                                            </div>

                                            <button 
                                                type="button" 
                                                onClick={() => setPassoFormulario(2)}
                                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-base sm:text-lg transition-all hover:bg-black active:scale-[0.98]"
                                            >
                                                Avançar para Avaliar o {labelContexto === 'serviço' ? 'Serviço' : 'Item'}
                                            </button>
                                        </motion.div>
                                    ) : (
                                        /* PASSO 2: AVALIAÇÃO DO SERVIÇO/RESERVA + FOTOS + TEXTO */
                                        <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={submitAvaliacao} className="space-y-6">
                                            
                                            <div className="flex flex-col items-center bg-[#FFF0E5]/50 py-6 rounded-2xl border border-[#FF5A00]/20">
                                                <Wrench className="w-6 h-6 text-[#FF5A00] mb-2" />
                                                <p className="text-xs sm:text-sm font-bold text-[#FF5A00] mb-3 uppercase tracking-widest text-center">Nota Geral do {labelContexto}</p>
                                                <div className="flex gap-1 sm:gap-2">
                                                    {[1, 2, 3, 4, 5].map((estrela) => (
                                                        <button 
                                                            type="button" 
                                                            key={`servico-${estrela}`}
                                                            onClick={() => setNotaServico(estrela)}
                                                            className="focus:outline-none transition-transform hover:scale-110 active:scale-95 p-1"
                                                        >
                                                            <Star className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors ${notaServico >= estrela ? 'fill-[#FF5A00] text-[#FF5A00]' : 'text-[#FF5A00]/20'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Comentário Escrito</label>
                                                <textarea 
                                                    className="w-full rounded-[1.25rem] border-gray-200 focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm font-medium p-4 bg-gray-50 resize-none transition-colors text-sm"
                                                    rows="4"
                                                    placeholder={`Conte detalhes sobre o atendimento, espaço, limpeza ou recepção...`}
                                                    value={comentario}
                                                    onChange={(e) => setComentario(e.target.value)}
                                                    maxLength={1000}
                                                    required
                                                ></textarea>
                                            </div>

                                            {/* UPLOAD FOTOS COM LIMITE DE TAMANHO/QUANTIDADE */}
                                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1">
                                                    <label className="block text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest">
                                                        Fotos do Local ou Serviço
                                                    </label>
                                                    <span className="text-[#FF5A00] bg-[#FFF0E5] px-2 py-0.5 rounded-md text-[10px] font-bold w-fit border border-[#FF5A00]/20">+ Pontos Bônus</span>
                                                </div>
                                                
                                                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                                    {fotosPreviews.map((preview, index) => (
                                                        <div key={index} className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 group">
                                                            <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removerFoto(index)}
                                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                            >
                                                                <XCircle className="w-8 h-8 text-white" />
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {fotos.length < 4 && (
                                                        <label className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm">
                                                            <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mb-1" />
                                                            <span className="text-[10px] font-bold text-gray-500">{fotos.length}/4 max</span>
                                                            <input type="file" multiple accept="image/jpeg, image/png, image/webp" className="hidden" onChange={handleAddFoto} />
                                                        </label>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-2 font-medium leading-tight">Ajude a comunidade compartilhando fotos. Max 2MB por foto.</p>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setPassoFormulario(1)}
                                                    className="w-full sm:w-1/3 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm sm:text-base transition-all hover:bg-gray-200"
                                                >
                                                    Voltar ao Passo 1
                                                </button>
                                                <button 
                                                    type="submit" 
                                                    disabled={enviando} 
                                                    className="w-full sm:w-2/3 py-4 bg-[#FF5A00] text-white rounded-2xl font-black text-base sm:text-lg transition-all hover:bg-[#E04F00] shadow-[0_4px_15px_rgba(255,90,0,0.3)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {enviando ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                                                    {enviando ? 'Enviando avaliação...' : 'Publicar Avaliação'}
                                                </button>
                                            </div>
                                        </motion.form>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ESTATÍSTICAS GERAIS */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-8 md:gap-12 mb-8">
                        <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto">
                            <span className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tighter mb-2">
                                {Number(estatisticas.media_geral || 0).toFixed(1).replace('.', ',')}
                            </span>
                            <div className="flex text-[#FF5A00] mb-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} className={`w-4 h-4 sm:w-5 sm:h-5 ${star <= Math.round(estatisticas.media_geral || 0) ? 'fill-current' : 'text-gray-300'}`} />
                                ))}
                            </div>
                            <span className="font-bold text-gray-900 mb-0.5">
                                {estatisticas.media_geral >= 4.5 ? 'Excelente' : estatisticas.media_geral >= 3.0 ? 'Bom' : 'Regular'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">Baseado em {estatisticas.total} avaliações</span>
                        </div>

                        <div className="flex-1 w-full max-w-md border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-12">
                            <ProgressBar label="5" quantidade={estatisticas.estrelas['5'] || 0} />
                            <ProgressBar label="4" quantidade={estatisticas.estrelas['4'] || 0} />
                            <ProgressBar label="3" quantidade={estatisticas.estrelas['3'] || 0} />
                            <ProgressBar label="2" quantidade={estatisticas.estrelas['2'] || 0} />
                            <ProgressBar label="1" quantidade={estatisticas.estrelas['1'] || 0} />
                        </div>

                        <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-12">
                            <div className="bg-emerald-100 w-10 h-10 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">Avaliações verificadas</h4>
                            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                                Todas as avaliações são de clientes que realmente utilizaram este {labelContexto} através da plataforma Lokyva.
                            </p>
                        </div>
                    </div>

                    {/* LISTA DE AVALIAÇÕES */}
                    <div className="flex flex-col-reverse lg:flex-row gap-8 lg:gap-10">
                        <div className="lg:w-[70%]">
                            
                            {/* Filtros Front-End */}
                            <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 overflow-x-auto no-scrollbar pb-2">
                                {['Todas', '5 estrelas', '4 estrelas', '3 estrelas', '2 estrelas', '1 estrela'].map(filtro => (
                                    <button 
                                        key={filtro} 
                                        onClick={() => setFiltroEstrela(filtro)} 
                                        className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm border transition-colors shrink-0 ${ filtroEstrela === filtro ? 'border-[#FF5A00] text-[#FF5A00] bg-[#FFF0E5]' : 'border-gray-300 text-gray-600 bg-white'}`}
                                    >
                                        {filtro} {filtro === 'Todas' ? `(${estatisticas.total})` : ''}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-6 sm:space-y-8 bg-white p-4 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
                                {!avaliacoes?.data || avaliacoes.data.length === 0 ? (
                                    <div className="text-center py-12">
                                        <h3 className="text-gray-900 font-bold text-base sm:text-lg mb-2">Ainda não há avaliações</h3>
                                        <p className="text-sm text-gray-500 px-4">Seja o primeiro a compartilhar sua experiência após utilizar o {labelContexto}.</p>
                                    </div>
                                ) : (
                                    avaliacoes.data.map(aval => {
                                        const fotosArray = parseFotosSeguro(aval.fotos);
                                        const nomeServico = aval.agendamento?.servico?.nome || aval.aluguel?.item_aluguel?.nome;
                                        const nomeLocal = aval.estabelecimento?.nome;
                                        
                                        // Filtro Simples
                                        if (filtroEstrela === '5 estrelas' && aval.nota !== 5) return null;
                                        if (filtroEstrela === '4 estrelas' && aval.nota !== 4) return null;
                                        if (filtroEstrela === '3 estrelas' && aval.nota !== 3) return null;
                                        if (filtroEstrela === '2 estrelas' && aval.nota !== 2) return null;
                                        if (filtroEstrela === '1 estrela' && aval.nota !== 1) return null;

                                        return (
                                            <div key={aval.id} className="border-b border-gray-100 pb-6 sm:pb-8 last:border-0 last:pb-0">
                                                <div className="flex items-start justify-between mb-3 sm:mb-4">
                                                    <div className="flex items-center gap-3 sm:gap-4">
                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shadow-sm shrink-0">
                                                            {aval.usuario?.foto_perfil ? (
                                                                <img src={aval.usuario.foto_perfil.startsWith('http') ? aval.usuario.foto_perfil : `/storage/${aval.usuario.foto_perfil}`} alt={aval.usuario.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center font-black text-gray-400 text-base sm:text-lg">
                                                                    {aval.usuario?.name?.charAt(0) || 'U'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-1 sm:gap-2">
                                                                {aval.usuario?.name}
                                                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" title="Verificado" />
                                                            </h5>
                                                            <div className="text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5 space-y-0.5">
                                                                <p>{new Date(aval.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                                                {nomeServico && (
                                                                    <p className="text-[#FF5A00]">Avaliou: {nomeServico} {nomeLocal ? `em ${nomeLocal}` : ''}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="flex text-[#FF5A00]">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${i < aval.nota ? 'fill-current' : 'text-gray-200'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="font-bold text-gray-900 text-sm">{aval.nota},0</span>
                                                </div>

                                                <ExpandableText text={aval.comentario} maxLength={180} />

                                                {/* GALERIA DE FOTOS RENDERIZADAS AQUI */}
                                                {fotosArray.length > 0 && (
                                                    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 no-scrollbar mt-4">
                                                        {fotosArray.map((fotoUrl, idx) => (
                                                            <div key={idx} className="w-24 h-20 sm:w-32 sm:h-24 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group">
                                                                <img 
                                                                    src={fotoUrl} 
                                                                    alt="Foto da experiência" 
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                                                />
                                                                <div 
                                                                    onClick={() => window.open(fotoUrl, '_blank')}
                                                                    className="absolute inset-0 bg-black/0 group-hover:bg-black/10 cursor-zoom-in transition-colors duration-300 flex items-center justify-center"
                                                                >
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}

                                {/* PAGINAÇÃO */}
                                {avaliacoes?.links && avaliacoes.links.length > 3 && (
                                    <div className="flex justify-center flex-wrap gap-1 mt-8 border-t border-gray-100 pt-6">
                                        {avaliacoes.links.map((link, idx) => (
                                            <Link
                                                key={idx}
                                                href={link.url || '#'}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                                    link.active ? 'bg-[#FF5A00] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                } ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BARRA LATERAL - CATEGORIAS */}
                        <div className="lg:w-[30%] space-y-6">
                            <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm sticky top-6">
                                <h3 className="text-base sm:text-lg font-black text-gray-900 mb-4 tracking-tight">Notas detalhadas</h3>
                                <div>
                                    <CategoryScore icon={Store} label="Espaço Físico / Estrutura" score={estatisticas.categorias.localizacao || estatisticas.media_geral} />
                                    <CategoryScore icon={Star} label="Limpeza do Local" score={estatisticas.categorias.limpeza || estatisticas.media_geral} />
                                    <CategoryScore icon={Wrench} label="Qualidade do Serviço" score={estatisticas.categorias.precisao || estatisticas.media_geral} />
                                    <CategoryScore icon={MessageSquare} label="Atendimento" score={estatisticas.categorias.comunicacao || estatisticas.media_geral} />
                                    <CategoryScore icon={CheckCircle2} label="Recepção / Check-in" score={estatisticas.categorias.checkin || estatisticas.media_geral} />
                                    <CategoryScore icon={Star} label="Custo-benefício" score={estatisticas.categorias.custo_beneficio || estatisticas.media_geral} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </AuthenticatedLayout>
    );
}