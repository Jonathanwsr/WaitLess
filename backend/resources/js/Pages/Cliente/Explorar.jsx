import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import { 
    Search, MapPin, Calendar, Star, ArrowRight, ImageOff, Layers,
    Scissors, Home, Car, Laptop, PartyPopper, Store, Briefcase, 
    Tag, ChevronDown, ChevronLeft, ChevronRight, Heart,
    HeartPulse, Plane, GraduationCap, Dog, Wrench
} from 'lucide-react';

export default function Explorar({ auth, estabelecimentos, itens_aluguel, filtros = {} }) {
    const [tipoBusca, setTipoBusca] = useState(filtros.tipo_busca || 'servicos');
    const [busca, setBusca] = useState(filtros.busca || '');
    const [enderecoManual, setEnderecoManual] = useState(filtros.endereco_manual || '');
    const [dataDesejada, setDataDesejada] = useState(filtros.data || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || 'todas');
    const [ordenarPor, setOrdenarPor] = useState(filtros.ordem || 'relevancia');
    const [apenasPromocoes, setApenasPromocoes] = useState(!!filtros.apenas_promocoes);
    const [carregando, setCarregando] = useState(false);
    const [imageErrors, setImageErrors] = useState({});
    
    // Estado local para otimizar a interface ao favoritar
    const [favoritosLocais, setFavoritosLocais] = useState({});
    
    // Estado para exibir a mensagem na tela (Toast)
    const [toast, setToast] = useState({ show: false, message: '' });

    // Mapeamento EXATO com o banco de dados para os filtros funcionarem
    const categorias = [
        { nome: 'todas', label: 'Todos', icon: Layers },
        
        // --- Categorias de Locações / Aluguéis ---
        { nome: 'casa', label: 'Imóveis & Espaços', icon: Home },
        { nome: 'carro', label: 'Aluguel de Veículos', icon: Car },
        { nome: 'equipamento', label: 'Equipamentos', icon: Wrench },

        // --- Categorias de Serviços / Estabelecimentos ---
        { nome: 'Saúde e Bem-Estar', label: 'Saúde & Bem-Estar', icon: HeartPulse },
        { nome: 'Beleza e Estética', label: 'Beleza', icon: Scissors },
        { nome: 'Turismo e Viagens', label: 'Turismo', icon: Plane },
        { nome: 'Tecnologia', label: 'Tecnologia', icon: Laptop },
        { nome: 'Educação e Cursos', label: 'Educação', icon: GraduationCap },
        { nome: 'Eventos e Entretenimento', label: 'Eventos', icon: PartyPopper },
        { nome: 'Pets e Animais', label: 'Pets', icon: Dog },
        { nome: 'Serviços Profissionais', label: 'Profissionais', icon: Briefcase },
        { nome: 'Automotivo', label: 'Oficinas', icon: Car },
    ];

    const atualizarResultados = useCallback((novosFiltros = {}) => {
        setCarregando(true);

        const params = {
            tipo_busca: novosFiltros.tipo_busca ?? tipoBusca,
            busca: novosFiltros.busca ?? busca,
            endereco_manual: novosFiltros.endereco_manual ?? enderecoManual,
            data: novosFiltros.data ?? dataDesejada,
            categoria: novosFiltros.categoria ?? categoriaAtiva,
            ordem: novosFiltros.ordem ?? ordenarPor,
            apenas_promocoes: novosFiltros.apenas_promocoes ?? apenasPromocoes,
            page: novosFiltros.page || 1, 
        };

        if (params.categoria === 'todas') delete params.categoria;
        if (!params.busca) delete params.busca;
        if (!params.endereco_manual) delete params.endereco_manual;
        if (!params.data) delete params.data;
        if (params.ordem === 'relevancia') delete params.ordem;
        if (!params.apenas_promocoes) delete params.apenas_promocoes;
        if (params.page === 1) delete params.page;

        router.get(route('cliente.explorar'), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['estabelecimentos', 'itens_aluguel', 'filtros'],
            onFinish: () => setCarregando(false),
        });
    }, [tipoBusca, busca, enderecoManual, dataDesejada, categoriaAtiva, ordenarPor, apenasPromocoes]);

    const handleBuscaSubmit = (e) => {
        e?.preventDefault();
        atualizarResultados({ page: 1 });
    };

    const handleCategoriaClick = (catNome) => {
        setCategoriaAtiva(catNome);
        atualizarResultados({ categoria: catNome, page: 1 });
    };

    const handleTipoBuscaClick = (tipo) => {
        setTipoBusca(tipo);
        atualizarResultados({ tipo_busca: tipo, page: 1 });
    };

    const handlePromocoesToggle = () => {
        const novoValor = !apenasPromocoes;
        setApenasPromocoes(novoValor);
        atualizarResultados({ apenas_promocoes: novoValor, page: 1 });
    };

    const handleMudancaPagina = (url) => {
        if (!url) return;
        const urlParams = new URL(url);
        const page = urlParams.searchParams.get('page');
        if (page) {
            atualizarResultados({ page: parseInt(page) });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleImageError = (id) => {
        setImageErrors(prev => ({ ...prev, [id]: true }));
    };

    // Função para mostrar a mensagem na tela
    const showToast = (mensagem) => {
        setToast({ show: true, message: mensagem });
        setTimeout(() => setToast({ show: false, message: '' }), 3000); // Esconde depois de 3 segundos
    };

    // Função para favoritar/desfavoritar via API (Axios)
    const handleToggleFavorito = async (e, id, tipo) => {
        e.preventDefault(); 
        e.stopPropagation();

        const chave = `${tipo}-${id}`;
        
        // 1. Atualiza interface instantaneamente (Optimistic UI) para não haver delay
        setFavoritosLocais(prev => ({
            ...prev,
            [chave]: !prev[chave]
        }));

        try {
            // 2. Dispara para o backend via axios
            const response = await axios.post('/favoritos/toggle', { tipo, id });
            
            // 3. Mostra a mensagem de sucesso que veio do seu Controller
            showToast(response.data.message);
            
        } catch (error) {
            console.error("Erro ao alterar favoritos:", error);
            
            // Se der erro, desfaz a alteração visual
            setFavoritosLocais(prev => ({
                ...prev,
                [chave]: !prev[chave]
            }));
            
            showToast("Ocorreu um erro ao atualizar.");
        }
    };

    const isEstabelecimentos = tipoBusca === 'estabelecimentos';
    const dadosPaginados = isEstabelecimentos ? estabelecimentos : itens_aluguel;
    const listaResultados = dadosPaginados?.data || [];
    const linksPaginacao = dadosPaginados?.links || [];

    // Animações
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
            }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: "spring", stiffness: 70, damping: 20 }
        }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Explorar - Lokyva" />

            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative">
                
                {/* TOAST NOTIFICATION FLUTUANTE */}
                <AnimatePresence>
                    {toast.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, x: '-50%' }}
                            animate={{ opacity: 1, y: 0, x: '-50%' }}
                            exit={{ opacity: 0, y: 50, x: '-50%' }}
                            className="fixed bottom-10 left-1/2 z-50 flex items-center gap-2 px-6 py-3 rounded-full shadow-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium text-sm"
                        >
                            <Heart className={`w-4 h-4 ${toast.message.includes('Adicionado') ? 'fill-red-500 text-red-500' : ''}`} />
                            {toast.message}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* HERO */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white pt-16 pb-12"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div 
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.6 }}
                            className="max-w-2xl"
                        >
                            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-4">
                                Encontre o que<br />você precisa<span className="text-[#FF5A00]">.</span>
                            </h1>
                            <p className="text-zinc-400 text-lg">
                                Profissionais, serviços e aluguéis com agendamento rápido na sua região.
                            </p>
                        </motion.div>
                    </div>
                </motion.div>

                {/* SEARCH BAR */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <motion.form 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        onSubmit={handleBuscaSubmit}
                        className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-2 flex flex-col md:flex-row gap-2"
                    >
                        <div className="flex-1 flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-[#FF5A00]/30 transition-all">
                            <Search className="w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="O que você está procurando?"
                                className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 outline-none text-sm placeholder-zinc-500"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-[#FF5A00]/30 transition-all">
                            <MapPin className="w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Onde?"
                                className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 outline-none text-sm placeholder-zinc-500"
                                value={enderecoManual}
                                onChange={(e) => setEnderecoManual(e.target.value)}
                            />
                        </div>

                        <div className="md:w-52 flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-[#FF5A00]/30 transition-all">
                            <Calendar className="w-5 h-5 text-zinc-400" />
                            <input
                                type="date"
                                className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 outline-none text-sm"
                                value={dataDesejada}
                                onChange={(e) => setDataDesejada(e.target.value)}
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            type="submit"
                            className="bg-[#FF5A00] hover:bg-[#E04F00] transition-colors text-white font-semibold px-10 py-4 md:py-3 rounded-2xl flex items-center justify-center gap-2 text-sm"
                        >
                            <Search className="w-5 h-5" />
                            Buscar
                        </motion.button>
                    </motion.form>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
                    {/* Filtros e Categorias */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                        {/* Tipo de Busca */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm border border-zinc-200 dark:border-zinc-800"
                        >
                            {[
                                { id: 'servicos', label: 'Serviços', icon: Briefcase },
                                { id: 'reservas', label: 'Reservas', icon: Calendar },
                                { id: 'estabelecimentos', label: 'Locais', icon: Store },
                            ].map(({ id, label, icon: Icon }) => (
                                <motion.button
                                    key={id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleTipoBuscaClick(id)}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                                        tipoBusca === id 
                                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' 
                                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </motion.button>
                            ))}
                        </motion.div>

                        {/* Promo + Ordenação */}
                        <div className="flex items-center gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handlePromocoesToggle}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                                    apenasPromocoes 
                                        ? 'bg-emerald-600 text-white border-emerald-600' 
                                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                                }`}
                            >
                                <Tag className="w-4 h-4" />
                                Apenas Promoções
                            </motion.button>

                            <div className="relative">
                                <select
                                    value={ordenarPor}
                                    onChange={(e) => {
                                        setOrdenarPor(e.target.value);
                                        atualizarResultados({ ordem: e.target.value, page: 1 });
                                    }}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-2.5 pl-4 pr-10 text-sm font-medium focus:ring-2 focus:ring-[#FF5A00] appearance-none cursor-pointer"
                                >
                                    <option value="relevancia">Relevância</option>
                                    <option value="menor_preco">Menor preço</option>
                                    <option value="maior_preco">Maior preço</option>
                                    <option value="maior_desconto">Maior desconto</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Categorias */}
                    <motion.div 
                        className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide mb-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {categorias.map((cat, index) => {
                            const IconComponent = cat.icon;
                            const active = categoriaAtiva === cat.nome;
                            return (
                                <motion.button
                                    key={cat.nome}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    whileHover={{ scale: 1.08, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleCategoriaClick(cat.nome)}
                                    className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                                        active 
                                            ? 'bg-[#FF5A00] text-white shadow-lg shadow-orange-500/30' 
                                            : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                                    }`}
                                >
                                    <IconComponent className={`w-4 h-4 ${active ? 'text-white' : 'text-zinc-400'}`} />
                                    {cat.label}
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    {/* Resultados com Animação de Stagger */}
                    <AnimatePresence mode="wait">
                        {carregando ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl h-96 animate-pulse border border-zinc-100 dark:border-zinc-800" />
                                ))}
                            </div>
                        ) : (
                            <motion.div
                                key="results"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            >
                                {listaResultados.length === 0 ? (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="col-span-full text-center py-24 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800"
                                    >
                                        <div className="mx-auto w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                            <ImageOff className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                                        </div>
                                        <h3 className="text-2xl font-semibold mb-2">Nada encontrado</h3>
                                        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
                                            Tente ajustar os filtros ou buscar por outros termos na sua região.
                                        </p>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                setBusca(''); setEnderecoManual(''); setDataDesejada('');
                                                setCategoriaAtiva('todas'); setApenasPromocoes(false);
                                                atualizarResultados({ busca: '', endereco_manual: '', data: '', categoria: 'todas', apenas_promocoes: false, page: 1 });
                                            }}
                                            className="px-8 py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-black dark:hover:bg-white transition-colors font-medium shadow-sm"
                                        >
                                            Limpar Filtros
                                        </motion.button>
                                    </motion.div>
                                ) : (
                                    listaResultados.map((item) => {
                                        const tipoItem = isEstabelecimentos 
    ? 'estabelecimento' 
    : (item.valor_diaria !== undefined ? 'item_aluguel' : 'servico');
                                        const key = `${tipoItem}-${item.id}`;
                                        const linkRoute = isEstabelecimentos 
                                            ? route('estabelecimentos.loja', item.id) 
                                            : route('itens.detalhes', item.id);

                                        const fotoUrl = isEstabelecimentos 
                                            ? item.foto_perfil 
                                            : (item.fotos?.[0] || item.estabelecimento?.foto_perfil);

                                        const temPromo = !isEstabelecimentos && item.tem_promocao && Number(item.valor_desconto) > 0;
                                        
                                        // Verifica se está favoritado (baseado na propriedade do backend OU no estado local)
                                        const isFavoritado = favoritosLocais[key] !== undefined ? favoritosLocais[key] : !!item.is_favorito;

                                        return (
                                            <motion.div
                                                key={key}
                                                variants={cardVariants}
                                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                                className="group relative"
                                            >
                                                <Link
                                                    href={linkRoute}
                                                    className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 block h-full shadow-sm hover:shadow-xl hover:shadow-zinc-200/40 dark:hover:shadow-black/40 transition-all"
                                                >
                                                    <div className="relative h-56 overflow-hidden">
                                                        {fotoUrl && !imageErrors[key] ? (
                                                            <img
                                                                src={fotoUrl}
                                                                alt={item.nome}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                onError={() => handleImageError(key)}
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                                                                <ImageOff className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                                                            </div>
                                                        )}

                                                        {/* Botão de Favoritar */}
                                                        <button
                                                            onClick={(e) => handleToggleFavorito(e, item.id, tipoItem)}
                                                            className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-sm hover:scale-110 transition-all"
                                                        >
                                                            <Heart className={`w-4 h-4 transition-colors ${
                                                                isFavoritado 
                                                                    ? 'fill-red-500 text-red-500' 
                                                                    : 'text-zinc-400 dark:text-zinc-500 hover:text-red-500'
                                                            }`} />
                                                        </button>

                                                        {(item.avaliacao_media || isEstabelecimentos) && (
                                                            <div className="absolute top-4 left-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-sm">
                                                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                                {item.avaliacao_media ? Number(item.avaliacao_media).toFixed(1) : '4.9'}
                                                            </div>
                                                        )}

                                                        {temPromo && (
                                                            <div className="absolute bottom-4 left-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-2xl tracking-wider shadow-sm z-10">
                                                                PROMO
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-6">
                                                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                                                            {isEstabelecimentos ? item.ramo_atuacao : item.estabelecimento?.nome}
                                                        </p>
                                                        
                                                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-white leading-tight mb-3 line-clamp-2 group-hover:text-[#FF5A00] transition-colors">
                                                            {item.nome}
                                                        </h3>

                                                        <div className="flex items-center gap-1.5 text-sm text-zinc-500 mb-6">
                                                            <MapPin className="w-4 h-4" />
                                                            <span className="line-clamp-1">
                                                                {isEstabelecimentos 
                                                                    ? `${item.bairro ? item.bairro + ', ' : ''}${item.cidade}`
                                                                    : item.estabelecimento?.cidade}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-end justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                                            <div>
                                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">A partir de</span>
                                                                <div className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5">
                                                                    <span className="text-sm font-bold mr-1 text-zinc-400">R$</span>
                                                                    {Number(isEstabelecimentos ? item.preco_minimo : item.preco_final_cliente || item.valor_diaria).toFixed(2).replace('.', ',')}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-[#FF5A00] group-hover:border-[#FF5A00] group-hover:text-white transition-all shadow-sm">
                                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Controles de Paginação */}
                    {linksPaginacao.length > 3 && !carregando && (
                        <div className="mt-14 flex items-center justify-center flex-wrap gap-2">
                            {linksPaginacao.map((link, idx) => {
                                const isPrevious = link.label.includes('Previous');
                                const isNext = link.label.includes('Next');
                                const isAtivo = link.active;
                                const isDesabilitado = !link.url;

                                let labelContent = link.label;
                                if (isPrevious) labelContent = <ChevronLeft className="w-5 h-5" />;
                                if (isNext) labelContent = <ChevronRight className="w-5 h-5" />;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleMudancaPagina(link.url)}
                                        disabled={isDesabilitado}
                                        className={`min-w-[40px] h-10 px-3 flex items-center justify-center rounded-xl text-sm font-bold transition-all border ${
                                            isAtivo 
                                                ? 'bg-[#FF5A00] text-white border-[#FF5A00] shadow-md shadow-orange-500/20' 
                                                : isDesabilitado
                                                    ? 'bg-transparent text-zinc-300 dark:text-zinc-700 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00]'
                                        }`}
                                    >
                                        {labelContent}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}