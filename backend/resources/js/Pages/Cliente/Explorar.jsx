import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import {
    Search, MapPin, Calendar, Star, ArrowRight, ImageOff, Layers,
    Scissors, Home, Car, Laptop, PartyPopper, Store, Briefcase,
    Tag, ChevronDown, ChevronLeft, ChevronRight, Heart, ShoppingCart, Check,
    HeartPulse, Plane, GraduationCap, Dog, Wrench, UserRound, Lock,
    BedDouble, UtensilsCrossed, Mountain, Sparkles, Dumbbell, Camera, Hammer, ShoppingBag, DoorOpen, Flower2,
    List, Map as MapIcon, Truck,
} from 'lucide-react';
import MapaExplorar from '@/Components/Explorar/MapaExplorar';
import { useIdioma } from '@/i18n';
import { SelosAtendimento } from '@/Components/Servicos/InfoAtendimento';

// Ícone de cada grupo (o backend manda o nome do MaterialIcons usado no app).
const ICONES_CATEGORIA = {
    hotel: BedDouble, restaurant: UtensilsCrossed, hiking: Mountain, 'directions-car': Car, 'content-cut': Scissors,
    storefront: Store, spa: Flower2, 'local-hospital': HeartPulse, 'fitness-center': Dumbbell, pets: Dog, 'car-repair': Wrench,
    celebration: PartyPopper, 'photo-camera': Camera, handyman: Hammer, 'shopping-bag': ShoppingBag, school: GraduationCap,
    build: Wrench, 'meeting-room': DoorOpen, 'business-center': Briefcase, 'local-shipping': Truck,
};

const ESTADOS_BR = [
    ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
    ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
    ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
    ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'],
    ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];

export default function Explorar({ auth, estabelecimentos, itens_aluguel, promocoesDestaque = [], filtros = {}, categoriasExplorar = [] }) {
    // 💡 IMPORTANTE: Pegamos o ID do usuário logado para saber de quem são os favoritos
    const user = usePage().props.auth.user;
    const { t, locale } = useIdioma();
    const userId = user?.id;

    const [tipoBusca, setTipoBusca] = useState(filtros.tipo_busca || 'servicos');
    const [busca, setBusca] = useState(filtros.busca || '');
    const [enderecoManual, setEnderecoManual] = useState(filtros.endereco_manual || '');
    const [dataDesejada, setDataDesejada] = useState(filtros.data || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || 'todas');
    const [ordenarPor, setOrdenarPor] = useState(filtros.ordem || 'relevancia');
    const [apenasPromocoes, setApenasPromocoes] = useState(!!filtros.apenas_promocoes);
    const [estado, setEstado] = useState(filtros.estado || '');
    const [carregando, setCarregando] = useState(false);
    // Lista ou mapa (lembra a escolha neste navegador).
    const [modoVisao, setModoVisao] = useState(() => {
        try { return localStorage.getItem('explorar_visao') === 'mapa' ? 'mapa' : 'lista'; } catch { return 'lista'; }
    });
    const trocarVisao = (modo) => {
        setModoVisao(modo);
        try { localStorage.setItem('explorar_visao', modo); } catch { /* sem armazenamento */ }
    };
    const [imageErrors, setImageErrors] = useState({});
    
    // Estado local para otimizar a interface ao favoritar
    const [favoritosLocais, setFavoritosLocais] = useState({});

    // Estado local para marcar quais serviços já foram adicionados ao carrinho nesta sessão
    const [carrinhoAdicionados, setCarrinhoAdicionados] = useState({});

    // Estado para exibir a mensagem na tela (Toast)
    const [toast, setToast] = useState({ show: false, message: '' });

    // Mapeamento EXATO com o banco de dados
    // Cada categoria com sua própria cor (a ativa usa esse tom, não sempre o laranja da marca) —
    // mesmas cores usadas nas categorias de serviço do painel do lojista e no app do cliente.
    // Categorias vindas do backend (mesma lista do app e dos formulários do sócio). Cada uma junta
    // tipos de serviço, ramos de local e categorias de reserva; as vazias vão para o fim.
    const categorias = [
        { nome: 'todas', label: 'Todos', icon: Layers, cor: '#282828' },
        ...[...categoriasExplorar]
            .sort((a, b) => (b.total > 0) - (a.total > 0))
            .map((c) => ({ nome: c.slug, label: c.nome, icon: ICONES_CATEGORIA[c.icone] || Sparkles, cor: c.cor, total: c.total })),
    ];

    // 👇 ESTA FUNÇÃO É A MÁGICA QUE VERIFICA SE JÁ VEIO FAVORITADO DO BANCO 👇
    const checarSeEhFavorito = (item, tipoItem) => {
        const key = `${tipoItem}-${item.id}`;
        
        // 1. Se a pessoa acabou de clicar na tela, o estado local (React) manda!
        if (favoritosLocais[key] !== undefined) {
            return favoritosLocais[key];
        }

        // 2. Se o backend mandou um campo booleano 'is_favorito' explícito
        if (item.is_favorito !== undefined) {
            return !!item.is_favorito;
        }

        // 3. Se o backend mandou os favoritos num array (Padrão do Laravel com ->with('favoritos'))
        if (item.favoritos && Array.isArray(item.favoritos)) {
            // Verifica se no array de favoritos tem algum que pertença ao usuário logado
            return item.favoritos.some(fav => fav.usuario_id === userId);
        }

        return false;
    };

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
            estado: novosFiltros.estado ?? estado,
            page: novosFiltros.page || 1,
        };

        if (params.categoria === 'todas') delete params.categoria;
        if (!params.busca) delete params.busca;
        if (!params.endereco_manual) delete params.endereco_manual;
        if (!params.data) delete params.data;
        if (params.ordem === 'relevancia') delete params.ordem;
        if (!params.apenas_promocoes) delete params.apenas_promocoes;
        if (!params.estado) delete params.estado;
        if (params.page === 1) delete params.page;

        router.get(route('cliente.explorar'), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['estabelecimentos', 'itens_aluguel', 'filtros'],
            onFinish: () => setCarregando(false),
        });
    }, [tipoBusca, busca, enderecoManual, dataDesejada, categoriaAtiva, ordenarPor, apenasPromocoes, estado]);

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

    const handleEstadoChange = (uf) => {
        setEstado(uf);
        atualizarResultados({ estado: uf, page: 1 });
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

    const showToast = (mensagem) => {
        setToast({ show: true, message: mensagem });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const handleToggleFavorito = async (e, id, tipo, isAtualmenteFavorito) => {
        e.preventDefault();
        e.stopPropagation();

        const chave = `${tipo}-${id}`;
        
        // 1. Atualiza interface (inverte o valor que está agora)
        setFavoritosLocais(prev => ({
            ...prev,
            [chave]: !isAtualmenteFavorito
        }));

        try {
            // 2. Dispara pro backend
            const response = await axios.post('/favoritos/toggle', { tipo, id });
            showToast(response.data.message);
        } catch (error) {
            console.error("Erro ao alterar favoritos:", error);
            
            // 3. Se der erro, desfaz (volta ao que era antes do clique)
            setFavoritosLocais(prev => ({
                ...prev,
                [chave]: isAtualmenteFavorito
            }));
            showToast("Ocorreu um erro ao atualizar.");
        }
    };

    const handleAdicionarCarrinho = (e, item) => {
        e.preventDefault();
        e.stopPropagation();

        if (carrinhoAdicionados[item.id]) return;
        setCarrinhoAdicionados(prev => ({ ...prev, [item.id]: true }));

        router.post('/carrinho/adicionar', {
            servico_id: item.id,
            estabelecimento_id: item.estabelecimento_id || item.estabelecimento?.id,
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => showToast('Serviço adicionado ao carrinho!'),
            onError: () => {
                setCarrinhoAdicionados(prev => ({ ...prev, [item.id]: false }));
                showToast('Ocorreu um erro ao adicionar ao carrinho.');
            },
        });
    };

    const isEstabelecimentos = tipoBusca === 'estabelecimentos';
    const dadosPaginados = isEstabelecimentos ? estabelecimentos : itens_aluguel;
    const listaResultados = dadosPaginados?.data || [];
    const linksPaginacao = dadosPaginados?.links || [];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 70, damping: 20 } }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={t('Explorar')} />

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

                {/* HERO: banner da Lokyva (o texto e o botão fazem parte da imagem) */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="relative overflow-hidden rounded-3xl shadow-xl"
                    >
                        <img
                            src="/images/explorar_banner.png"
                            alt="Sua próxima experiência começa aqui. Hospedagens, aluguel de veículos e serviços em um só lugar."
                            className="block h-auto w-full min-h-[150px] object-cover object-left"
                        />
                        {/* Área clicável sobre o botão "Explorar opções" desenhado na imagem */}
                        <button
                            type="button"
                            onClick={() => {
                                const campo = document.querySelector('#busca-explorar input');
                                campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => campo?.focus(), 400);
                            }}
                            aria-label="Explorar opções"
                            className="absolute rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
                            style={{ left: '5.3%', top: '80%', width: '14%', height: '15%' }}
                        />
                    </motion.div>
                </div>

                {/* SEARCH BAR */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 relative z-10">
                    <motion.form
                        id="busca-explorar"
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
                                placeholder={t('O que você está procurando?')}
                                className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 outline-none text-sm placeholder-zinc-500"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-[#FF5A00]/30 transition-all">
                            <MapPin className="w-5 h-5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder={t('Onde?')}
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
                            {t('Buscar')}
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
                                { id: 'estabelecimentos', label: 'Lojas', icon: Store },
                                { id: 'servicos', label: 'Serviços', icon: Briefcase },
                                { id: 'reservas', label: 'Reservas', icon: Calendar },
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
                                    {t(label)}
                                </motion.button>
                            ))}
                        </motion.div>

                        {/* Promo + Estado + Ordenação */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <select
                                    value={estado}
                                    onChange={(e) => handleEstadoChange(e.target.value)}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-2.5 pl-4 pr-10 text-sm font-medium focus:ring-2 focus:ring-[#FF5A00] appearance-none cursor-pointer"
                                    aria-label="Filtrar por estado"
                                >
                                    <option value="">{t('Todos os estados')}</option>
                                    {ESTADOS_BR.map(([uf, nome]) => (
                                        <option key={uf} value={uf}>{nome} ({uf})</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                            </div>

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
                                {t('Apenas Promoções')}
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
                                    <option value="relevancia">{t('Relevância')}</option>
                                    <option value="menor_preco">{t('Menor preço')}</option>
                                    <option value="maior_preco">{t('Maior preço')}</option>
                                    <option value="maior_desconto">{t('Maior desconto')}</option>
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
                                    style={active ? { backgroundColor: cat.cor, boxShadow: `0 10px 20px -8px ${cat.cor}80` } : undefined}
                                    className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                                        active
                                            ? 'text-white'
                                            : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                                    }`}
                                >
                                    <IconComponent className="w-4 h-4" style={{ color: active ? '#fff' : cat.cor }} />
                                    {t(cat.label)}
                                    {cat.total > 0 && <span className={`text-[11px] font-bold ${active ? 'text-white/80' : 'text-zinc-400'}`}>{cat.total}</span>}
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    {estado && (
                        <div className="mb-6 flex items-center gap-3 text-sm">
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF5A00]/10 text-[#FF5A00] font-bold">
                                <MapPin className="w-4 h-4" /> {ESTADOS_BR.find(([uf]) => uf === estado)?.[1] || estado}
                            </span>
                            <button type="button" onClick={() => handleEstadoChange('')} className="text-zinc-500 hover:text-zinc-900 font-semibold underline">{t('Ver todos os estados')}</button>
                        </div>
                    )}

                    {/* Promoções soltas pelo admin para serviços/itens em destaque — mesmo destino de um card normal */}
                    {promocoesDestaque.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-[#FF5A00]" /> {t('Promoções em destaque')}
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                                {promocoesDestaque.map((promo) => {
                                    const href = promo.vinculo.tipo === 'servico'
                                        ? route('cliente.agendar', { estabelecimento: promo.vinculo.estabelecimento_id, servico_id: promo.vinculo.id })
                                        : route('itens.detalhes', promo.vinculo.id);
                                    return (
                                        <Link
                                            key={promo.id}
                                            href={href}
                                            className="flex-shrink-0 w-64 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-[#FF5A00] transition group"
                                        >
                                            {promo.vinculo.foto ? (
                                                <img src={promo.vinculo.foto} alt={promo.vinculo.nome} className="w-full h-32 object-cover" />
                                            ) : (
                                                <div className="w-full h-32 bg-[#FFF3EC] flex items-center justify-center">
                                                    <Tag className="w-8 h-8 text-[#FF5A00]" />
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <p className="font-black text-sm text-zinc-900 dark:text-white truncate">{promo.nome}</p>
                                                <p className="text-xs text-zinc-500 truncate">{promo.vinculo.nome}</p>
                                                <div className="flex items-center gap-1.5 mt-2 text-[#FF5A00] text-xs font-bold group-hover:gap-2.5 transition-all">
                                                    {t('Ver oferta')} <ArrowRight className="w-3.5 h-3.5" />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lista ou mapa */}
                    {!carregando && listaResultados.length > 0 && (
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-zinc-500">
                                {dadosPaginados?.total ?? listaResultados.length} {t((dadosPaginados?.total ?? listaResultados.length) === 1 ? 'resultado' : 'resultados')}
                            </p>
                            <div className="inline-flex rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800" role="tablist" aria-label="Ver resultados como">
                                {[['lista', 'Lista', List], ['mapa', 'Mapa', MapIcon]].map(([id, rotulo, Icone]) => (
                                    <button key={id} type="button" role="tab" aria-selected={modoVisao === id} onClick={() => trocarVisao(id)}
                                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${modoVisao === id ? 'bg-white text-zinc-900 shadow dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                                        <Icone className="h-4 w-4" /> {t(rotulo)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {modoVisao === 'mapa' && !carregando && listaResultados.length > 0 ? (
                        <MapaExplorar
                            itens={listaResultados.map((item) => {
                                const tipoItem = isEstabelecimentos ? 'estabelecimento' : (item.valor_diaria !== undefined ? 'item_aluguel' : 'servico');
                                const preco = isEstabelecimentos ? item.preco_minimo : (item.preco_final_cliente ?? item.valor_final ?? item.valor_diaria ?? item.valor);
                                return {
                                    id: `${tipoItem}-${item.id}`,
                                    nome: item.nome || item.name,
                                    subtitulo: isEstabelecimentos ? [item.cidade, item.estado].filter(Boolean).join(' - ') : (item.estabelecimento?.name || item.estabelecimento?.nome || ''),
                                    preco: preco != null && Number(preco) > 0 ? `${isEstabelecimentos ? t('a partir de ') : ''}${Number(preco).toLocaleString(locale, { style: 'currency', currency: 'BRL' })}` : null,
                                    foto: isEstabelecimentos ? item.foto_perfil : (item.fotos?.[0] || item.estabelecimento?.foto_perfil),
                                    latitude: item.latitude,
                                    longitude: item.longitude,
                                    link: item.bloqueado ? route('assinatura.status')
                                        : isEstabelecimentos ? route('estabelecimentos.loja', item.id)
                                        : tipoItem === 'servico' ? route('cliente.servicos.show', item.id) : route('itens.detalhes', item.id),
                                };
                            })}
                        />
                    ) : (
                    /* Resultados com Animação de Stagger */
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
                                        <h3 className="text-2xl font-semibold mb-2">{t('Nada encontrado')}</h3>
                                        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
                                            {t('Tente ajustar os filtros ou buscar por outros termos na sua região.')}
                                        </p>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                setBusca(''); setEnderecoManual(''); setDataDesejada('');
                                                setCategoriaAtiva('todas'); setApenasPromocoes(false); setEstado('');
                                                atualizarResultados({ busca: '', endereco_manual: '', data: '', categoria: 'todas', apenas_promocoes: false, estado: '', page: 1 });
                                            }}
                                            className="px-8 py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-black dark:hover:bg-white transition-colors font-medium shadow-sm"
                                        >
                                            {t('Limpar Filtros')}
                                        </motion.button>
                                    </motion.div>
                                ) : (
                                    listaResultados.map((item) => {
                                        const tipoItem = isEstabelecimentos
                                            ? 'estabelecimento'
                                            : (item.valor_diaria !== undefined ? 'item_aluguel' : 'servico');
                                        
                                        const key = `${tipoItem}-${item.id}`;
                                        
                                        const linkRoute = item.bloqueado
                                            ? route('assinatura.status')
                                            : (isEstabelecimentos
                                                ? route('estabelecimentos.loja', item.id)
                                                : tipoItem === 'servico'
                                                    ? route('cliente.servicos.show', item.id)
                                                    : route('itens.detalhes', item.id));

                                        // ✅ AQUI LIGAMOS AS AVALIAÇÕES PARA SEREM VISTAS DO EXPLORAR!
                                        const routeAvaliacoes = route('explorar.avaliacoes', { id: item.id, tipo: tipoItem });

                                        const fotoUrl = isEstabelecimentos
                                            ? item.foto_perfil
                                            : (item.fotos?.[0] || item.estabelecimento?.foto_perfil);

                                        const temPromo = !isEstabelecimentos && item.tem_promocao && Number(item.valor_desconto) > 0;
                                        
                                        const isFavoritado = checarSeEhFavorito(item, tipoItem);
                                        const notaExibir = Number(item.avaliacao_media || 0).toFixed(1);
                                        const temAvaliacoes = item.total_avaliacoes > 0;

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

                                                        <button
                                                            onClick={(e) => handleToggleFavorito(e, item.id, tipoItem, isFavoritado)}
                                                            className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-sm hover:scale-110 transition-all"
                                                        >
                                                            <Heart className={`w-4 h-4 transition-colors ${
                                                                isFavoritado
                                                                    ? 'fill-red-500 text-red-500'
                                                                    : 'text-zinc-400 dark:text-zinc-500 hover:text-red-500'
                                                            }`} />
                                                        </button>

                                                        {/* TAG DE AVALIAÇÃO CLICÁVEL */}
                                                        {temAvaliacoes && (
                                                            <Link 
                                                                href={routeAvaliacoes}
                                                                onClick={(e) => e.stopPropagation()} // Impede o clique de abrir o card inteiro
                                                                className="absolute top-4 left-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-zinc-100 hover:scale-105 transition-all"
                                                            >
                                                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                                {notaExibir}
                                                                <span className="text-[10px] text-zinc-400 ml-0.5">({item.total_avaliacoes})</span>
                                                            </Link>
                                                        )}

                                                        {temPromo && (
                                                            <div className="absolute bottom-4 left-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-2xl tracking-wider shadow-sm z-10">
                                                                PROMO
                                                            </div>
                                                        )}

                                                        {tipoItem === 'item_aluguel' && item.direto_dono && (
                                                            <div className="absolute bottom-4 right-4 bg-zinc-900/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-2xl tracking-wider shadow-sm z-10 flex items-center gap-1.5">
                                                                <UserRound className="w-3.5 h-3.5" /> DIRETO COM O DONO
                                                            </div>
                                                        )}

                                                        {item.vagas_status && (
                                                            <div className={`absolute top-14 left-4 z-20 text-xs font-bold px-3 py-1.5 rounded-2xl shadow-sm ${item.vagas_status === 'esgotado' ? 'bg-red-600 text-white' : 'bg-amber-400 text-zinc-900'}`}>
                                                                {item.vagas_status === 'esgotado' ? t('Esgotado hoje') : t('Últimas vagas hoje ({n})', { n: item.vagas_restantes })}
                                                            </div>
                                                        )}

                                                        {item.bloqueado && (
                                                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4 z-10">
                                                                <Lock className="w-7 h-7 mb-2" />
                                                                <span className="text-xs font-black uppercase tracking-wider">{t('Exclusivo Premium')}</span>
                                                                <span className="text-[10px] text-white/80 mt-1">{t('Toque para assinar')}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-6">
                                                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                                                            {isEstabelecimentos
                                                                ? item.ramo_atuacao
                                                                : (item.direto_dono ? `Com ${item.estabelecimento?.name || 'o dono'}` : item.estabelecimento?.name)}
                                                        </p>
                                                        
                                                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-white leading-tight mb-3 line-clamp-2 group-hover:text-[#FF5A00] transition-colors">
                                                            {item.nome}
                                                        </h3>

                                                        {isEstabelecimentos && item.status_funcionamento && (
                                                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${
                                                                item.status_funcionamento.aberto
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : item.status_funcionamento.aberto === false
                                                                        ? 'bg-red-50 text-red-600'
                                                                        : 'bg-zinc-100 text-zinc-500'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${item.status_funcionamento.aberto ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                                                                {item.status_funcionamento.texto}
                                                            </span>
                                                        )}

                                                        {tipoItem === 'servico' && <SelosAtendimento atendimento={item.atendimento} max={2} className="-mt-1 mb-3" />}

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
                                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tipoItem === 'servico' && item.atendimento?.sob_orcamento ? 'Sob orçamento · a partir de' : tipoItem === 'servico' && item.atendimento?.preco_sufixo ? item.atendimento.tipo_preco_rotulo : t('A partir de')}</span>
                                                                <div className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5">
                                                                    <span className="text-sm font-bold mr-1 text-zinc-400">R$</span>
                                                                    {Number(isEstabelecimentos ? item.preco_minimo : item.preco_final_cliente || item.valor_diaria).toFixed(2).replace('.', ',')}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2">
                                                                {tipoItem === 'servico' && (
                                                                    <button
                                                                        onClick={(e) => handleAdicionarCarrinho(e, item)}
                                                                        title={t(carrinhoAdicionados[item.id] ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho')}
                                                                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                                                                            carrinhoAdicionados[item.id]
                                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400 hover:bg-[#FF5A00] hover:border-[#FF5A00] hover:text-white'
                                                                        }`}
                                                                    >
                                                                        {carrinhoAdicionados[item.id] ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                                                                    </button>
                                                                )}
                                                                <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-[#FF5A00] group-hover:border-[#FF5A00] group-hover:text-white transition-all shadow-sm">
                                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                                                                </div>
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
                    )}

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