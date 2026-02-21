import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import TextInput from '@/Components/TextInput';

export default function Explorar({ auth, estabelecimentos, filtros = {} }) {
    const [busca, setBusca] = useState(filtros.busca || '');
    const [categoriaAtiva, setCategoriaAtiva] = useState(filtros.categoria || '');
    
    // --- ESTADO DO CARROSSEL ---
    const [slideAtivo, setSlideAtivo] = useState(0);

    // As 5 imagens que você vai colocar na pasta public/images/
    const imagensCarrossel = [
        '/images/banner01.png',
        '/images/banner02.png',
        '/images/banner03.png',
        '/images/banner04.png',
        '/images/banner05.png',
    ];

    // Faz o carrossel passar automaticamente a cada 5 segundos
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
                
                {/* --- HEADER E BARRA DE PESQUISA --- */}
                <div className="bg-indigo-600 rounded-3xl p-8 mb-6 text-center shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                            Do que você precisa hoje?
                        </h1>
                        <p className="text-indigo-100 mb-8 max-w-2xl mx-auto">
                            Encontre os melhores profissionais, agende o seu horário e evite filas de espera.
                        </p>
                        
                        <form onSubmit={fazerBusca} className="max-w-xl mx-auto flex gap-2">
                            <TextInput 
                                type="text" 
                                className="w-full py-3 px-6 rounded-full border-0 shadow-lg text-gray-900 focus:ring-2 focus:ring-indigo-300" 
                                placeholder="Buscar por nome, loja ou cidade..." 
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                            <button type="submit" className="bg-gray-900 text-white px-8 font-bold rounded-full shadow-lg hover:bg-gray-800 transition">
                                Buscar
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- FILTRO DE CATEGORIAS ESTILO OLX --- */}
                <div className="mb-8">
                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide items-center">
                        {categorias.map(cat => (
                            <button
                                key={cat.nome}
                                onClick={() => filtrarCategoria(cat.nome)}
                                className={`flex items-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-full font-medium text-sm transition-all border ${
                                    categoriaAtiva === cat.nome
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold'
                                    : 'border-gray-200 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                                }`}
                            >
                                <span className="text-base">{cat.emoji}</span>
                                {cat.nome}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- CARROSSEL EXATAMENTE ESTILO OLX --- */}
                <div className="relative w-full h-48 md:h-72 lg:h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-12 overflow-hidden group shadow-sm">
                    {imagensCarrossel.map((img, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${slideAtivo === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
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
                         
                            <div className="hidden w-full h-full bg-indigo-100/50 dark:bg-indigo-900/30 flex-col items-center justify-center border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl">
                                <span className="text-4xl mb-2">🖼️</span>
                                <span className="text-indigo-500 font-bold">Banner {index + 1}</span>
                                <span className="text-indigo-400 text-sm">Salve em public/images/banner0{index + 1}.png</span>
                            </div>
                        </div>
                    ))}

                    {/* Controles do Carrossel (Setas estilo OLX) */}
                    <button 
                        onClick={slideAnterior} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white border border-gray-200 text-gray-800 rounded-full shadow-md hover:bg-gray-50 transition-all focus:outline-none"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button 
                        onClick={proximoSlide} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white border border-gray-200 text-gray-800 rounded-full shadow-md hover:bg-gray-50 transition-all focus:outline-none"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>

                    {/* Indicadores (Barras horizontais estilo OLX) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                        {imagensCarrossel.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setSlideAtivo(index)}
                                className={`h-1 rounded-full transition-all shadow-sm ${
                                    slideAtivo === index 
                                    ? 'bg-orange-500 w-8 md:w-12' // Cor Laranja inspirada na OLX para dar destaque
                                    : 'bg-white/60 hover:bg-white/90 w-8 md:w-12'
                                }`}
                            ></button>
                        ))}
                    </div>
                </div>

                {/* --- GRID DE ESTABELECIMENTOS --- */}
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                        {categoriaAtiva ? `Lojas de ${categoriaAtiva}` : 'Locais Disponíveis'}
                    </h3>

                    {listaLojas.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <span className="text-4xl mb-4 block">🔍</span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Nenhum local encontrado</h3>
                            <p className="text-gray-500">Tente ajustar a sua pesquisa ou remover o filtro de categoria.</p>
                            
                            {(busca || categoriaAtiva) && (
                                <button 
                                    onClick={() => { setBusca(''); setCategoriaAtiva(''); router.get(route('cliente.explorar')); }}
                                    className="mt-4 text-indigo-600 font-bold hover:underline"
                                >
                                    Limpar todos os filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {listaLojas.map(local => (
                                <Link 
                                    href={route('cliente.agendar', local.id)} 
                                    key={local.id}
                                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col h-full"
                                >
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-2xl uppercase shrink-0 shadow-inner">
                                            {local.nome.charAt(0)}
                                        </div>
                                        <div className="overflow-hidden flex-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate group-hover:text-indigo-600 transition-colors">
                                                {local.nome}
                                            </h4>
                                            <p className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 inline-block px-2.5 py-1 rounded-md uppercase mt-1 truncate max-w-full">
                                                {local.ramo_atuacao || 'Diversos'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* DADOS DO ESTABELECIMENTO */}
                                    <div className="flex flex-col gap-2 mb-6 mt-auto bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                                        
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <span className="text-yellow-400 mr-2 text-base">★</span>
                                            <span className="font-bold text-gray-900 dark:text-white mr-1">
                                                {local.avaliacao_media ? Number(local.avaliacao_media).toFixed(1) : 'Novo'}
                                            </span>
                                            <span className="text-gray-400 text-xs ml-1">(Avaliação)</span>
                                        </div>

                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <svg className="w-4 h-4 mr-2 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            <span className="truncate">{local.telefone || 'Sem contato cadastrado'}</span>
                                        </div>

                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <svg className="w-4 h-4 mr-2 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                            <span className="truncate">{local.bairro ? `${local.bairro}, ` : ''}{local.cidade} - {local.estado}</span>
                                        </div>
                                    </div>

                                    <div className="w-full text-center py-3 bg-indigo-50 dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 font-bold text-sm rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        Ver Serviços e Agendar
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