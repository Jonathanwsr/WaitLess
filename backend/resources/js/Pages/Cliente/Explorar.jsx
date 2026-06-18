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
    ChevronDown 
} from 'lucide-react';

export default function Explorar({ auth, estabelecimentos, filtros = {} }) {
    // --- ESTADOS DE FILTROS E BUSCA ---
    const [busca, setBusca] = useState(filtros.busca || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || 'Todos');
    const [ordenarPor, setOrdenarPor] = useState(filtros.ordem || 'Relevância');
    const [filtroPontos, setFiltroPontos] = useState(filtros.pontos === 'true');
    const [carregando, setCarregando] = useState(false);
    
    // --- CONTROLE DE ERRO AMIGÁVEL PARA IMAGENS ---
    const [imageErrors, setImageErrors] = useState({});

    // Mapeamento de categorias com ícones profissionais do React
    const categorias = [
        { nome: 'Todos', icon: Layers },
        { nome: 'Saúde', icon: Stethoscope },
        { nome: 'Beleza', icon: Scissors },
        { nome: 'Casa', icon: Home },
        { nome: 'Automotivo', icon: Car },
        { nome: 'Tecnologia', icon: Laptop },
        { nome: 'Cursos', icon: BookOpen },
        { nome: 'Bem-estar', icon: Smile },
        { nome: 'Eventos', icon: PartyPopper },
        { nome: 'Outros', icon: Layers },
    ];

    // --- EXECUÇÃO SPA (Muda os cards sem piscar ou dar refresh na página inteira) ---
    const atualizarResultados = (novosFiltros) => {
        setCarregando(true);
        
        const params = {
            busca: novosFiltros.busca !== undefined ? novosFiltros.busca : busca,
            categoria: novosFiltros.categoria !== undefined ? novosFiltros.categoria : categoriaAtiva,
            ordem: novosFiltros.ordem !== undefined ? novosFiltros.ordem : ordenarPor,
            pontos: novosFiltros.pontos !== undefined ? novosFiltros.pontos : filtroPontos,
        };

        if (params.categoria === 'Todos') delete params.categoria;
        if (!params.busca) delete params.busca;
        if (params.ordem === 'Relevância') delete params.ordem;
        if (!params.pontos) delete params.pontos;

        router.get(route('cliente.explorar'), params, {
            preserveState: true,   // Preserva o estado interno do React
            preserveScroll: true,  // Não altera o scroll do usuário abruptamente
            only: ['estabelecimentos', 'filtros'], // Solicita ao Laravel apenas o fragmento dos cards
            onFinish: () => setCarregando(false)
        });
    };

    const handleBuscaSubmit = (e) => {
        e?.preventDefault();
        atualizarResultados({ busca });
    };

    const handleCategoriaClick = (nomeCat) => {
        setCategoriaAtiva(nomeCat);
        atualizarResultados({ categoria: nomeCat });
    };

    const handlePontosToggle = () => {
        const novoValor = !filtroPontos;
        setFiltroPontos(novoValor);
        atualizarResultados({ pontos: novoValor });
    };

    const handleOrdemChange = (e) => {
        const novaOrdem = e.target.value;
        setOrdenarPor(novaOrdem);
        atualizarResultados({ ordem: novaOrdem });
    };

    const handleImageError = (id) => {
        setImageErrors((prev) => ({ ...prev, [id]: true }));
    };

    const listaLojas = estabelecimentos?.data || [];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                    Descubra Serviços
                </h2>
            }
        >
            <Head title="Explorar Serviços - WaitLess" />

            {/* Fundo Premium FBF9F9 */}
            <div className="bg-[#FBF9F9] min-h-screen pb-20 transition-colors duration-300">
                
                {/* --- SEÇÃO HERO ALTERNATIVA MODERNA (Sem barra roxa pesada) --- */}
                <div className="max-w-7xl mx-auto pt-14 pb-10 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-2">
                            Serviços para o seu dia a dia
                        </h1>
                        <p className="text-sm md:text-base text-gray-400 font-medium">
                            Encontre e agende os melhores profissionais especializados perto de você.
                        </p>
                    </div>

                    {/* Caixa de busca minimalista flutuante estilo Marketplace de Luxo */}
                    <form onSubmit={handleBuscaSubmit} className="w-full lg:max-w-md flex items-center bg-white rounded-2xl p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-200/80 focus-within:border-gray-300 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all">
                        <div className="pl-4 text-gray-400">
                            <Search className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <input 
                            type="text" 
                            className="w-full py-2.5 px-3 bg-transparent border-0 ring-0 focus:ring-0 text-gray-800 placeholder-gray-400 text-sm font-medium outline-none" 
                            placeholder="Buscar por nome, categoria ou cidade..." 
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                        />
                        <button type="submit" className="bg-gray-950 hover:bg-black text-white px-6 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-98 shadow-xs">
                            Buscar
                        </button>
                    </form>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* --- FILTROS DE SELEÇÃO AVANÇADOS (image_1c6c21.png) --- */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200/50">
                        
                        {/* Pílulas de Controle com Ícones Dinâmicos */}
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-700">
                            <button className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-gray-200 font-bold shadow-3xs hover:bg-gray-50 transition-colors">
                                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                Estabelecimentos
                            </button>
                            
                            <button className="flex items-center gap-1.5 bg-white px-4 py-2.5 rounded-full border border-gray-200 font-bold shadow-3xs hover:bg-gray-50 transition-colors">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                Distância 
                                <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                            </button>
                            
                            <button 
                                onClick={handlePontosToggle}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold shadow-3xs transition-all ${
                                    filtroPontos 
                                    ? 'bg-[#C8826B] text-white border border-[#C8826B]' 
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Percent className={`w-3.5 h-3.5 ${filtroPontos ? 'text-white' : 'text-gray-400'}`} />
                                Descontos com Pontos
                            </button>
                        </div>

                        {/* Ordenação */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-bold">Ordenar por:</span>
                            <div className="relative">
                                <select 
                                    value={ordenarPor} 
                                    onChange={handleOrdemChange}
                                    className="bg-white border border-gray-200 text-gray-800 rounded-xl py-2 pl-3 pr-8 font-extrabold text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-3xs appearance-none"
                                >
                                    <option value="Relevância">Relevância</option>
                                    <option value="Melhor Avaliados">Melhor Avaliados</option>
                                    <option value="Menor Preço">Menor Preço</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* --- ROLAGEM HORIZONTAL DE CATEGORIAS COM RE-ICONS --- */}
                    <div className="mb-10">
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
                                            ? 'bg-[#C8826B] text-white shadow-xs scale-[1.01]'
                                            : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200/60 shadow-3xs'
                                        }`}
                                    >
                                        <IconComponent className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                                        {cat.nome}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- ÁREA DINÂMICA DOS CARDS (ZONA SPA COM OPACIDADE DE CARREGAMENTO) --- */}
                    <div className={`transition-opacity duration-200 ${carregando ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        {listaLojas.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-gray-200/50 shadow-3xs">
                                <ImageOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-gray-900 mb-1">Nenhum serviço disponível</h3>
                                <p className="text-gray-400 text-xs max-w-xs mx-auto mb-6">Tente reformular os termos ou desative os filtros atuais.</p>
                                <button 
                                    onClick={() => { setBusca(''); setCategoriaAtiva('Todos'); setFiltroPontos(false); atualizarResultados({ busca: '', categoria: 'Todos', pontos: false }); }}
                                    className="px-5 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    Redefinir Filtros
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {listaLojas.map(local => (
                                    <Link 
                                        href={route('estabelecimentos.loja', local.id)} 
                                        key={local.id}
                                        className="bg-white rounded-[2rem] overflow-hidden shadow-3xs hover:shadow-md transition-all duration-300 flex flex-col h-full border border-gray-200/50 group relative"
                                    >
                                        {/* ÁREA DA FOTO */}
                                        <div className="h-44 w-full bg-gray-50 relative overflow-hidden">
                                            
                                            {/* Fallback contra links corrompidos ou sem fotos */}
                                            {local.foto_perfil && !imageErrors[local.id] ? (
                                                <img 
                                                    src={local.foto_perfil} 
                                                    alt={local.nome} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                                    onError={() => handleImageError(local.id)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100/60 font-bold text-[11px] p-4 text-center select-none">
                                                    <ImageOff className="w-6 h-6 mb-1 text-gray-300" />
                                                    <span>Não há imagem</span>
                                                </div>
                                            )}

                                            {/* Badge Superior Esquerdo (Avaliação) */}
                                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2 py-1 rounded-lg text-[11px] font-black shadow-3xs flex items-center gap-1 text-gray-900">
                                                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                                                {local.avaliacao_media ? Number(local.avaliacao_media).toFixed(1) : '4.8'}
                                            </div>

                                            {/* Badge Promocional */}
                                            <div className="absolute top-3 right-3 bg-[#024E47] text-white px-2 py-0.5 rounded text-[9px] font-black tracking-wider">
                                                PROMOÇÃO
                                            </div>
                                        </div>

                                        {/* CORPO DO CARD */}
                                        <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                                    {local.ramo_atuacao || 'Especialidades'}
                                                </span>

                                                <h4 className="font-bold text-base text-gray-900 leading-tight mb-1.5 group-hover:text-[#C8826B] transition-colors line-clamp-1">
                                                    {local.nome}
                                                </h4>

                                                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                                                    {local.bairro ? `${local.bairro}, ` : ''}{local.cidade} • Atendimento agendado sem filas.
                                                </p>
                                            </div>

                                            {/* FOOTER DO CARD */}
                                            <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between mt-auto">
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block font-bold">A partir de</span>
                                                    <span className="text-base font-black text-gray-900">
                                                        R$ {local.preco_minimo ? Number(local.preco_minimo).toFixed(2) : '120,00'}
                                                    </span>
                                                </div>

                                                {/* Botão de seta redondo estilo image_1c7760.png */}
                                                <div className="w-9 h-9 rounded-full bg-[#FFF3EE] flex items-center justify-center text-[#C8826B] group-hover:bg-[#C8826B] group-hover:text-white transition-all duration-300">
                                                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}