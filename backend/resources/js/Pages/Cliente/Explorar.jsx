import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Explorar({ auth, estabelecimentos, filtros = {} }) {
    const [busca, setBusca] = useState(filtros.busca || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || '');
    
    // --- ESTADO DO CARROSSEL ---
    const [slideAtivo, setSlideAtivo] = useState(0);

    const imagensCarrossel = [
        '/images/banner01.png',
        '/images/banner02.png',
        '/images/banner03.png',
        '/images/banner04.png',
        '/images/banner05.png',
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setSlideAtivo((atual) => (atual === imagensCarrossel.length - 1 ? 0 : atual + 1));
        }, 5000);
        return () => clearInterval(interval);
    }, [imagensCarrossel.length]);

    const proximoSlide = () => setSlideAtivo(atual => (atual === imagensCarrossel.length - 1 ? 0 : atual + 1));
    const slideAnterior = () => setSlideAtivo(atual => (atual === 0 ? imagensCarrossel.length - 1 : atual - 1));

    const categorias = [
        { nome: 'Beleza e Estética', emoji: '✂️' },
        { nome: 'Saúde e Bem-Estar', emoji: '⚕️' },
        { nome: 'Serviços Automotivos', emoji: '🚗' },
        { nome: 'Serviços para Pets', emoji: '🐾' },
        { nome: 'Gastronomia e Reservas', emoji: '🍽️' },
        { nome: 'Assistência Técnica e Manutenção', emoji: '🔧' },
    ];

    const fazerBusca = (e) => {
        e?.preventDefault();
        router.get(route('cliente.explorar'), { busca, categoria: categoriaAtiva }, { preserveState: true });
    };

    const filtrarCategoria = (cat) => {
        const novaCategoria = categoriaAtiva === cat ? '' : cat; 
        setCategoriaAtiva(novaCategoria);
        router.get(route('cliente.explorar'), { busca, categoria: novaCategoria }, { preserveState: true });
    };

    const listaLojas = estabelecimentos?.data || [];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                    Encontrar Serviços
                </h2>
            }
        >
            <Head title="Explorar - WaitLess" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12">
                
                {/* --- HEADER E BARRA DE PESQUISA (MODERNO) --- */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-[2rem] p-10 md:p-14 mb-10 text-center shadow-2xl overflow-hidden">
                    {/* Círculos decorativos de fundo para dar um toque moderno */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight drop-shadow-md">
                            Do que você precisa hoje?
                        </h1>
                        <p className="text-indigo-100 mb-10 text-lg md:text-xl font-medium max-w-2xl mx-auto drop-shadow-sm">
                            Encontre os melhores profissionais, agende seu horário e evite filas.
                        </p>
                        
                        <form onSubmit={fazerBusca} className="max-w-2xl mx-auto flex items-center bg-white dark:bg-gray-900 rounded-full p-1.5 shadow-xl border border-gray-100 dark:border-gray-700 transition-all focus-within:ring-4 focus-within:ring-indigo-500/30">
                            <div className="pl-6 text-gray-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                            <input 
                                type="text" 
                                className="w-full py-4 px-4 bg-transparent border-0 ring-0 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 text-lg outline-none" 
                                placeholder="Buscar por nome, loja ou cidade..." 
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                            <button type="submit" className="bg-gray-900 dark:bg-indigo-600 text-white px-8 py-4 font-bold text-lg rounded-full shadow-md hover:bg-gray-800 dark:hover:bg-indigo-500 transition-transform hover:scale-105 active:scale-95">
                                Buscar
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- FILTRO DE CATEGORIAS --- */}
                <div className="mb-10">
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide items-center px-1">
                        {categorias.map(cat => (
                            <button
                                key={cat.nome}
                                onClick={() => filtrarCategoria(cat.nome)}
                                className={`flex items-center gap-2.5 whitespace-nowrap px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                                    categoriaAtiva === cat.nome
                                    ? 'bg-gray-900 text-white shadow-lg dark:bg-white dark:text-gray-900 scale-105 transform'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1'
                                }`}
                            >
                                <span className="text-xl">{cat.emoji}</span>
                                {cat.nome}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- CARROSSEL MODERNO --- */}
                <div className="relative w-full h-56 md:h-80 lg:h-96 bg-gray-100 dark:bg-gray-800 rounded-[2rem] mb-14 overflow-hidden group shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                    {imagensCarrossel.map((img, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${slideAtivo === index ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'}`}
                        >
                            <img 
                                src={img} 
                                alt={`Banner Promocional ${index + 1}`} 
                                className="w-full h-full object-cover" 
                                onError={(e) => { 
                                    e.target.style.display = 'none'; 
                                    e.target.nextSibling.style.display = 'flex'; 
                                }} 
                            />
                            <div className="hidden w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex-col items-center justify-center rounded-[2rem]">
                                <span className="text-5xl mb-4 drop-shadow-sm">✨</span>
                                <span className="text-indigo-800 dark:text-indigo-200 font-black text-2xl tracking-wide">Espaço para Banner {index + 1}</span>
                            </div>
                        </div>
                    ))}

                    {/* Controles Glassmorphism */}
                    <button 
                        onClick={slideAnterior} 
                        className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center bg-white/30 hover:bg-white/50 dark:bg-black/30 dark:hover:bg-black/50 backdrop-blur-md text-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:outline-none focus:opacity-100 transform hover:scale-110"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button 
                        onClick={proximoSlide} 
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center bg-white/30 hover:bg-white/50 dark:bg-black/30 dark:hover:bg-black/50 backdrop-blur-md text-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:outline-none focus:opacity-100 transform hover:scale-110"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                    </button>

                    {/* Indicadores Modernos */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2.5 bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full">
                        {imagensCarrossel.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setSlideAtivo(index)}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    slideAtivo === index 
                                    ? 'bg-white w-8 shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
                                    : 'bg-white/50 hover:bg-white/80 w-2'
                                }`}
                            ></button>
                        ))}
                    </div>
                </div>

                {/* --- GRID DE ESTABELECIMENTOS EM CARDS QUADRADOS MODERNO --- */}
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                        {categoriaAtiva ? `Resultados em ${categoriaAtiva}` : 'Locais em Destaque'}
                    </h3>

                    {listaLojas.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                            <span className="text-5xl mb-4 block opacity-50">🧭</span>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Poxa, não encontramos nada!</h3>
                            <p className="text-gray-500 max-w-md mx-auto">Tente buscar por outras palavras-chave ou remova o filtro de categoria para ver mais opções.</p>
                            
                            {(busca || categoriaAtiva) && (
                                <button 
                                    onClick={() => { setBusca(''); setCategoriaAtiva(''); router.get(route('cliente.explorar')); }}
                                    className="mt-6 px-6 py-2.5 bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-full hover:bg-indigo-100 dark:hover:bg-gray-600 transition-colors inline-block"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {listaLojas.map(local => (
                                <Link 
                                    href={route('estabelecimentos.loja', local.id)} 
                                    key={local.id}
                                    className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group border border-gray-100 dark:border-gray-700 flex flex-col h-full"
                                >
                                    {/* CABEÇALHO DO CARD (Padrão visual ou Cor) */}
                                    <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 relative group-hover:from-indigo-100 group-hover:to-purple-100 dark:group-hover:from-indigo-900/50 dark:group-hover:to-purple-900/50 transition-colors duration-500">
                                        
                                        {/* Tag de Avaliação Flutuante Top-Right */}
                                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                                            <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                            {local.avaliacao_media ? Number(local.avaliacao_media).toFixed(1) : 'Novo'}
                                        </div>

                                        {/* Logo Flutuante (Overlapping border) */}
                                        <div className="absolute -bottom-8 left-6 w-16 h-16 bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-md border border-gray-50 dark:border-gray-700 z-10">
                                            <div className="w-full h-full bg-indigo-50 dark:bg-gray-700 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 font-black text-2xl uppercase overflow-hidden">
                                                {local.foto_perfil ? (
                                                    <img 
                                                        src={local.foto_perfil} 
                                                        alt={`Logo ${local.nome}`} 
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.parentElement.innerText = local.nome.charAt(0);
                                                        }}
                                                    />
                                                ) : (
                                                    local.nome.charAt(0)
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* CORPO DO CARD */}
                                    <div className="pt-11 pb-6 px-6 flex-1 flex flex-col">
                                        <h4 className="font-extrabold text-xl text-gray-900 dark:text-white leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                                            {local.nome}
                                        </h4>
                                        <p className="text-sm font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-4">
                                            {local.ramo_atuacao || 'Diversos'}
                                        </p>
                                        
                                        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                <svg className="w-4 h-4 mr-2 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 3 3 0 016 0z"></path></svg>
                                                <span className="truncate">{local.bairro ? `${local.bairro}, ` : ''}{local.cidade}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                <svg className="w-4 h-4 mr-2 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                                <span className="truncate">{local.telefone ? 'Com Contato' : 'Sem Contato'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </AuthenticatedLayout>
    );
}