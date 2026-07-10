import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';

// Importando os ícones profissionais do React (Lucide)
import { 
    Search, 
    Star, 
    MapPin, 
    ArrowRight, 
    ImageOff, 
    Layers, 
    Stethoscope, 
    Scissors, 
    Home, 
    Car, 
    Laptop, 
    BookOpen, 
    Smile, 
    PartyPopper, 
    Building2, 
    Percent, 
    ChevronDown,
    Calendar,
    Tag,
    Store,
    Briefcase
} from 'lucide-react';

export default function Explorar({ auth, estabelecimentos, itens_aluguel, filtros = {} }) {
    // --- ESTADOS DE FILTROS E BUSCA ---
    const [tipoBusca, setTipoBusca] = useState(filtros.tipo_busca || 'servicos');
    const [busca, setBusca] = useState(filtros.busca || '');
    const [enderecoManual, setEnderecoManual] = useState(filtros.endereco_manual || '');
    const [dataDesejada, setDataDesejada] = useState(filtros.data || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || 'todas');
    const [ordenarPor, setOrdenarPor] = useState(filtros.ordem || 'relevancia');
    const [apenasPromocoes, setApenasPromocoes] = useState(
        filtros.apenas_promocoes === 'true' || filtros.apenas_promocoes === true
    );
    const [carregando, setCarregando] = useState(false);
    
    // --- CONTROLE DE ERRO AMIGÁVEL PARA IMAGENS ---
    const [imageErrors, setImageErrors] = useState({});

    // Mapeamento de categorias com ícones profissionais
    const categorias = [
        { nome: 'todas', label: 'Todos', icon: Layers },
        { nome: 'saude', label: 'Saúde', icon: Stethoscope },
        { nome: 'beleza', label: 'Beleza', icon: Scissors },
        { nome: 'casa', label: 'Casa', icon: Home },
        { nome: 'automotivo', label: 'Automotivo', icon: Car },
        { nome: 'tecnologia', label: 'Tecnologia', icon: Laptop },
        { nome: 'cursos', label: 'Cursos', icon: BookOpen },
        { nome: 'bem-estar', label: 'Bem-estar', icon: Smile },
        { nome: 'eventos', label: 'Eventos', icon: PartyPopper },
    ];

    // --- EXECUÇÃO SPA (Atualiza sem piscar a tela) ---
    const atualizarResultados = (novosFiltros) => {
        setCarregando(true);
        
        const params = {
            tipo_busca: novosFiltros.tipo_busca !== undefined ? novosFiltros.tipo_busca : tipoBusca,
            busca: novosFiltros.busca !== undefined ? novosFiltros.busca : busca,
            endereco_manual: novosFiltros.endereco_manual !== undefined ? novosFiltros.endereco_manual : enderecoManual,
            data: novosFiltros.data !== undefined ? novosFiltros.data : dataDesejada,
            categoria: novosFiltros.categoria !== undefined ? novosFiltros.categoria : categoriaAtiva,
            ordem: novosFiltros.ordem !== undefined ? novosFiltros.ordem : ordenarPor,
            apenas_promocoes: novosFiltros.apenas_promocoes !== undefined ? novosFiltros.apenas_promocoes : apenasPromocoes,
        };

        // Limpa os parâmetros vazios para deixar a URL limpa
        if (params.categoria === 'todas') delete params.categoria;
        if (!params.busca) delete params.busca;
        if (!params.endereco_manual) delete params.endereco_manual;
        if (!params.data) delete params.data;
        if (params.ordem === 'relevancia') delete params.ordem;
        if (!params.apenas_promocoes) delete params.apenas_promocoes;

        router.get(route('cliente.explorar'), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['estabelecimentos', 'itens_aluguel', 'filtros'],
            onFinish: () => setCarregando(false)
        });
    };

    const handleBuscaSubmit = (e) => {
        e?.preventDefault();
        atualizarResultados({ busca, endereco_manual: enderecoManual, data: dataDesejada });
    };

    const handleCategoriaClick = (catNome) => {
        setCategoriaAtiva(catNome);
        atualizarResultados({ categoria: catNome });
    };

    const handleTipoBuscaClick = (tipo) => {
        setTipoBusca(tipo);
        atualizarResultados({ tipo_busca: tipo });
    };

    const handlePromocoesToggle = () => {
        const novoValor = !apenasPromocoes;
        setApenasPromocoes(novoValor);
        atualizarResultados({ apenas_promocoes: novoValor });
    };

    const handleOrdemChange = (e) => {
        const novaOrdem = e.target.value;
        setOrdenarPor(novaOrdem);
        atualizarResultados({ ordem: novaOrdem });
    };

    const handleImageError = (id) => {
        setImageErrors((prev) => ({ ...prev, [id]: true }));
    };

    // Identifica qual lista usar baseado no tipo de busca selecionado
    const isEstabelecimentos = tipoBusca === 'estabelecimentos';
    const listaResultados = isEstabelecimentos 
        ? (estabelecimentos?.data || []) 
        : (itens_aluguel?.data || []);

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                    Descubra Serviços e Locações
                </h2>
            }
        >
            <Head title="Explorar - WaitLess" />

            <div className="bg-[#FBF9F9] min-h-screen pb-20 transition-colors duration-300">
                
                {/* --- SEÇÃO HERO DE BUSCA AVANÇADA --- */}
                <div className="max-w-7xl mx-auto pt-10 pb-8 px-4 sm:px-6 lg:px-8">
                    
                    <div className="mb-6">
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-2">
                            O que você procura hoje?
                        </h1>
                        <p className="text-sm md:text-base text-gray-400 font-medium">
                            Encontre profissionais, reserve horários e alugue serviços na sua região.
                        </p>
                    </div>

                    {/* Caixa de busca Multifiltro estilo Airbnb/Marketplace */}
                    <form onSubmit={handleBuscaSubmit} className="w-full bg-white rounded-3xl p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/80 focus-within:border-gray-300 transition-all flex flex-col md:flex-row gap-2">
                        
                        {/* Input O que */}
                        <div className="flex-1 flex items-center bg-gray-50/50 rounded-2xl px-4 py-1">
                            <Search className="w-5 h-5 text-gray-400 stroke-[2]" />
                            <input 
                                type="text" 
                                className="w-full py-2.5 px-3 bg-transparent border-0 ring-0 focus:ring-0 text-gray-800 placeholder-gray-400 text-sm font-medium outline-none" 
                                placeholder="Nome, categoria ou serviço..." 
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                        </div>

                        {/* Input Onde */}
                        <div className="flex-1 flex items-center bg-gray-50/50 rounded-2xl px-4 py-1">
                            <MapPin className="w-5 h-5 text-gray-400 stroke-[2]" />
                            <input 
                                type="text" 
                                className="w-full py-2.5 px-3 bg-transparent border-0 ring-0 focus:ring-0 text-gray-800 placeholder-gray-400 text-sm font-medium outline-none" 
                                placeholder="Bairro, Rua ou Cidade..." 
                                value={enderecoManual}
                                onChange={e => setEnderecoManual(e.target.value)}
                            />
                        </div>

                        {/* Input Quando (Data) */}
                        <div className="md:w-48 flex items-center bg-gray-50/50 rounded-2xl px-4 py-1">
                            <Calendar className="w-5 h-5 text-gray-400 stroke-[2]" />
                            <input 
                                type="date" 
                                className="w-full py-2.5 px-3 bg-transparent border-0 ring-0 focus:ring-0 text-gray-800 text-sm font-medium outline-none" 
                                value={dataDesejada}
                                onChange={e => setDataDesejada(e.target.value)}
                            />
                        </div>

                        <button type="submit" className="bg-[#FF5A00] hover:bg-[#E04F00] text-white px-8 py-3 md:py-2.5 text-sm font-bold rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                            <Search className="w-4 h-4" /> Buscar
                        </button>
                    </form>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* --- FILTROS DE SELEÇÃO E ORDENAÇÃO --- */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200/50">
                        
                        {/* Pílulas de Tipo de Busca */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 bg-white p-1 rounded-full border border-gray-200 shadow-3xs w-fit">
                            <button 
                                onClick={() => handleTipoBuscaClick('servicos')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors ${tipoBusca === 'servicos' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}
                            >
                                <Briefcase className="w-3.5 h-3.5" /> Serviços
                            </button>
                            <button 
                                onClick={() => handleTipoBuscaClick('reservas')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors ${tipoBusca === 'reservas' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}
                            >
                                <Calendar className="w-3.5 h-3.5" /> Reservas
                            </button>
                            <button 
                                onClick={() => handleTipoBuscaClick('estabelecimentos')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors ${tipoBusca === 'estabelecimentos' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}
                            >
                                <Store className="w-3.5 h-3.5" /> Locais
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={handlePromocoesToggle}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-3xs transition-all ${
                                    apenasPromocoes 
                                    ? 'bg-[#024E47] text-white border border-[#024E47]' 
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Tag className={`w-3.5 h-3.5 ${apenasPromocoes ? 'text-white' : 'text-gray-400'}`} />
                                Apenas Promoções
                            </button>

                            {/* Ordenação */}
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400 font-bold hidden sm:block">Ordenar:</span>
                                <div className="relative">
                                    <select 
                                        value={ordenarPor} 
                                        onChange={handleOrdemChange}
                                        className="bg-white border border-gray-200 text-gray-800 rounded-xl py-2 pl-3 pr-8 font-extrabold text-xs focus:ring-1 focus:ring-[#FF5A00] focus:border-[#FF5A00] cursor-pointer shadow-3xs appearance-none"
                                    >
                                        <option value="relevancia">Relevância</option>
                                        <option value="menor_preco">Menor Preço</option>
                                        <option value="maior_preco">Maior Preço</option>
                                        <option value="maior_desconto">Maior Desconto</option>
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- ROLAGEM HORIZONTAL DE CATEGORIAS --- */}
                    <div className="mb-8">
                        <div className="flex gap-2.5 overflow-x-auto pb-3 scrollbar-hide items-center">
                            {categorias.map(cat => {
                                const IconComponent = cat.icon;
                                const active = categoriaAtiva === cat.nome;
                                return (
                                    <button
                                        key={cat.nome}
                                        onClick={() => handleCategoriaClick(cat.nome)}
                                        className={`flex items-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                                            active
                                            ? 'bg-[#FF5A00] text-white shadow-xs scale-[1.02]'
                                            : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200/60 shadow-3xs'
                                        }`}
                                    >
                                        <IconComponent className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- ÁREA DINÂMICA DOS CARDS --- */}
                    <div className={`transition-opacity duration-200 ${carregando ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        {listaResultados.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-gray-200/50 shadow-3xs">
                                <ImageOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-gray-900 mb-1">Nenhum resultado encontrado</h3>
                                <p className="text-gray-400 text-xs max-w-xs mx-auto mb-6">Tente reformular os termos ou desative os filtros atuais.</p>
                                <button 
                                    onClick={() => { 
                                        setBusca(''); 
                                        setEnderecoManual('');
                                        setDataDesejada('');
                                        setCategoriaAtiva('todas'); 
                                        setApenasPromocoes(false); 
                                        atualizarResultados({ busca: '', endereco_manual: '', data: '', categoria: 'todas', apenas_promocoes: false }); 
                                    }}
                                    className="px-5 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    Limpar Filtros
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {listaResultados.map((item, idx) => {
                                    // Normalização de dados (Trata diferença entre Estabelecimento e ItemAluguel)
                                    const key = isEstabelecimentos ? `est-${item.id}` : `item-${item.id}-${idx}`;
                                    
                                    // 🚀 ROTA CORRIGIDA PARA IR PARA O DETALHE DO ITEM SE NÃO FOR ESTABELECIMENTO
                                    const linkRoute = isEstabelecimentos 
                                        ? route('estabelecimentos.loja', item.id) 
                                        : route('itens.detalhes', item.id);
                                    
                                    const fotoUrl = isEstabelecimentos 
                                        ? item.foto_perfil 
                                        : (item.fotos?.[0] || item.estabelecimento?.foto_perfil);
                                        
                                    const titulo = item.nome;
                                    const subTitulo = isEstabelecimentos 
                                        ? (item.ramo_atuacao || 'Especialidades') 
                                        : (item.estabelecimento?.nome || 'Serviço');
                                        
                                    const localizacao = isEstabelecimentos 
                                        ? `${item.bairro ? item.bairro + ', ' : ''}${item.cidade}`
                                        : `${item.estabelecimento?.cidade || 'Local não informado'}`;
                                        
                                    const valor = isEstabelecimentos 
                                        ? (item.preco_minimo || 0) 
                                        : (item.preco_final_cliente || item.valor_diaria);
                                        
                                    const temPromo = isEstabelecimentos 
                                        ? false
                                        : (item.tem_promocao && Number(item.valor_desconto) > 0);

                                    return (
                                        <Link 
                                            href={linkRoute} 
                                            key={key}
                                            className="bg-white rounded-[2rem] overflow-hidden shadow-3xs hover:shadow-md transition-all duration-300 flex flex-col h-full border border-gray-200/50 group relative"
                                        >
                                            {/* ÁREA DA FOTO */}
                                            <div className="h-44 w-full bg-gray-50 relative overflow-hidden">
                                                {fotoUrl && !imageErrors[key] ? (
                                                    <img 
                                                        src={fotoUrl} 
                                                        alt={titulo} 
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                                        onError={() => handleImageError(key)}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100/60 font-bold text-[11px] p-4 text-center select-none">
                                                        <ImageOff className="w-6 h-6 mb-1 text-gray-300" />
                                                        <span>Sem imagem</span>
                                                    </div>
                                                )}

                                                {/* Badge Avaliação (apenas se existir avaliação no objeto) */}
                                                {(item.avaliacao_media || isEstabelecimentos) && (
                                                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2 py-1 rounded-lg text-[11px] font-black shadow-3xs flex items-center gap-1 text-gray-900">
                                                        <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                                                        {item.avaliacao_media ? Number(item.avaliacao_media).toFixed(1) : '4.8'}
                                                    </div>
                                                )}

                                                {/* Badge Promocional */}
                                                {temPromo && (
                                                    <div className="absolute top-3 right-3 bg-[#024E47] text-white px-2 py-0.5 rounded text-[9px] font-black tracking-wider shadow-sm">
                                                        PROMOÇÃO
                                                    </div>
                                                )}
                                            </div>

                                            {/* CORPO DO CARD */}
                                            <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                                        {subTitulo}
                                                    </span>

                                                    <h4 className="font-bold text-base text-gray-900 leading-tight mb-1.5 group-hover:text-[#FF5A00] transition-colors line-clamp-1">
                                                        {titulo}
                                                    </h4>

                                                    {/* 🚀 EXIBIÇÃO EXCLUSIVA PARA SERVIÇOS/RESERVAS */}
                                                    {!isEstabelecimentos && (
                                                        <p className="text-[11px] text-gray-500 mb-2 font-medium bg-gray-50 inline-block px-2 py-0.5 rounded-md">
                                                            {item.duracao_minima_horas ? `Duração mín: ${item.duracao_minima_horas}h` : item.categoria} 
                                                            {item.horario_inicio ? ` • ${item.horario_inicio}` : ''}
                                                        </p>
                                                    )}

                                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{localizacao}</span>
                                                    </p>
                                                </div>

                                                {/* FOOTER DO CARD */}
                                                <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between mt-auto">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-bold">
                                                            {isEstabelecimentos ? 'A partir de' : 'Valor'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-base font-black text-gray-900">
                                                                R$ {Number(valor).toFixed(2)}
                                                            </span>
                                                            {temPromo && !isEstabelecimentos && (
                                                                <span className="text-xs text-gray-400 line-through">
                                                                    R$ {Number(item.valor_diaria).toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="w-9 h-9 rounded-full bg-[#FFF0E5] flex items-center justify-center text-[#FF5A00] group-hover:bg-[#FF5A00] group-hover:text-white transition-all duration-300 shrink-0">
                                                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}