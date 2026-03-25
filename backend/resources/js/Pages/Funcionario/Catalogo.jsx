import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { 
    ClockIcon, CurrencyDollarIcon, 
    XMarkIcon, InformationCircleIcon,
    BuildingStorefrontIcon, ScissorsIcon,
    ChevronLeftIcon, ChevronRightIcon,
    MagnifyingGlassIcon, FireIcon, SparklesIcon,
    PlayIcon, CalendarDaysIcon // Ícones que faltavam e causaram a tela branca!
} from '@heroicons/react/24/solid';

export default function CatalogoServicos({ auth, funcionarios }) {
    // 1. ESTADOS DE NAVEGAÇÃO E BUSCA
    const [abaAtiva, setAbaAtiva] = useState(funcionarios && funcionarios.length > 0 ? funcionarios[0].id : null);
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [busca, setBusca] = useState('');
    const carrosselRef = useRef(null);

    // 2. PROTEÇÃO DE DADOS
    if (!funcionarios || funcionarios.length === 0) {
        return (
            <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black">Catálogo</h2>}>
                <div className="p-8 text-center text-gray-500 font-bold">Nenhum estabelecimento vinculado à sua conta.</div>
            </AuthenticatedLayout>
        );
    }

    const funcionarioAtual = funcionarios.find(f => f.id === abaAtiva) || funcionarios[0];
    const servicosDaLoja = funcionarioAtual?.estabelecimento?.servicos || [];

    const servicosFiltrados = servicosDaLoja.filter(servico => 
        (servico?.nome || '').toLowerCase().includes(busca.toLowerCase())
    );

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    // 3. PALETA DE CORES SEGURA (Usa a posição na lista)
    const paletaCores = [
        { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', icon: 'text-indigo-400' },
        { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', icon: 'text-emerald-400' },
        { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: 'text-rose-400' },
        { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', icon: 'text-amber-400' },
        { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', icon: 'text-blue-400' }
    ];
    const getCor = (index) => paletaCores[index % paletaCores.length];

    // 4. CARROSSEL AUTOMÁTICO (Move a cada 4 segundos)
    const scrollCarrossel = (direcao) => {
        if (carrosselRef.current) {
            const scrollAmount = 260; 
            carrosselRef.current.scrollBy({ left: direcao === 'esq' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (carrosselRef.current && servicosDaLoja.length > 0) {
                const { scrollLeft, scrollWidth, clientWidth } = carrosselRef.current;
                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    carrosselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    carrosselRef.current.scrollBy({ left: 260, behavior: 'smooth' });
                }
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [abaAtiva, servicosDaLoja.length]);

    // 5. RENDERIZAÇÃO DA TELA
    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black text-gray-900 tracking-tight">Catálogo de Serviços</h2>}>
            <Head title="Catálogo - WaitLess" />

            <div className="bg-gray-50 min-h-screen pb-24 font-sans">
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">

                    {/* --- CABEÇALHO E PESQUISA --- */}
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Serviços da Loja</h1>
                            <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                                <BuildingStorefrontIcon className="w-5 h-5 text-indigo-500" />
                                <strong className="text-gray-800">{funcionarioAtual?.estabelecimento?.nome}</strong>
                            </p>
                        </div>

                        <div className="w-full md:w-auto relative">
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="text" placeholder="Buscar no catálogo..." value={busca} onChange={(e) => setBusca(e.target.value)}
                                className="pl-11 pr-4 py-3 bg-gray-50 border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-indigo-500 shadow-inner w-full md:w-72 transition-all"
                            />
                        </div>
                    </div>

                    {/* --- ABAS DE LOJAS --- */}
                    {funcionarios.length > 1 && (
                        <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-200 overflow-x-auto hide-scrollbar gap-2">
                            {funcionarios.map(func => (
                                <button
                                    key={`tab-${func.id}`} onClick={() => { setAbaAtiva(func.id); setBusca(''); }}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                                        abaAtiva === func.id ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    <BuildingStorefrontIcon className={`w-5 h-5 ${abaAtiva === func.id ? 'text-gray-300' : 'text-gray-400'}`} />
                                    {func.estabelecimento?.nome}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* --- CARROSSEL: EM DESTAQUE --- */}
                    {!busca && servicosDaLoja.length > 0 && (
                        <section className="relative pt-4">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                    <FireIcon className="w-6 h-6 text-red-500" /> Mais Solicitados
                                </h2>
                                <div className="hidden sm:flex gap-2">
                                    <button onClick={() => scrollCarrossel('esq')} className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => scrollCarrossel('dir')} className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="relative group">
                                <div ref={carrosselRef} className="flex overflow-x-auto gap-4 pb-6 pt-2 px-2 hide-scrollbar snap-x snap-mandatory scroll-smooth">
                                    {servicosDaLoja.slice(0, 6).map((servico, index) => {
                                        const cor = getCor(index);
                                        return (
                                            <div 
                                                key={`carrossel-${servico.id}`} 
                                                onClick={() => setServicoSelecionado({ ...servico, corIndex: index })}
                                                className={`relative w-[240px] h-[280px] rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-xl shrink-0 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 snap-start flex flex-col overflow-hidden group/card`}
                                            >
                                                {/* Cabeçalho do Card Destaque */}
                                                <div className={`h-32 w-full ${cor.bg} flex items-center justify-center border-b ${cor.border} relative overflow-hidden`}>
                                                    <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent`}></div>
                                                    <ScissorsIcon className={`w-14 h-14 ${cor.icon} group-hover/card:scale-110 transition-transform duration-500`} />
                                                    
                                                    {/* Ícone Play escondido (aparece no Hover) */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 bg-black/10">
                                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                                                            <PlayIcon className="w-5 h-5 text-gray-900 ml-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="p-5 flex-1 flex flex-col bg-white">
                                                    <h4 className="font-black text-gray-900 text-lg leading-tight tracking-tight line-clamp-2">
                                                        {servico.nome}
                                                    </h4>
                                                    
                                                    <div className="mt-auto pt-4 flex items-end justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Duração</p>
                                                            <p className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                                                <ClockIcon className="w-4 h-4 text-amber-500" /> {servico.duracao}m
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Preço</p>
                                                            <p className="text-lg font-black text-emerald-600">
                                                                {formatarMoeda(servico.valor || servico.preco)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* --- LISTA COMPLETA --- */}
                    <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                                <SparklesIcon className="w-6 h-6 text-indigo-500" /> Todos os Serviços
                            </h2>
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                                {servicosFiltrados.length} Itens
                            </span>
                        </div>

                        {servicosFiltrados.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                                <ScissorsIcon className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="font-bold text-lg">Nenhum serviço encontrado.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {servicosFiltrados.map((servico, index) => {
                                    const cor = getCor(index);
                                    return (
                                        <div 
                                            key={`lista-${servico.id}`} 
                                            onClick={() => setServicoSelecionado({ ...servico, corIndex: index })}
                                            className="bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all group"
                                        >
                                            <div className={`w-16 h-16 rounded-xl ${cor.bg} flex items-center justify-center shrink-0 border ${cor.border}`}>
                                                <ScissorsIcon className={`w-7 h-7 ${cor.icon}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 text-base truncate group-hover:text-indigo-700 transition-colors">{servico.nome}</h4>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-medium text-gray-500">
                                                    <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md text-gray-700 font-bold">
                                                        <ClockIcon className="w-3.5 h-3.5 text-gray-400"/> {servico.duracao} min
                                                    </span>
                                                    <span className="font-black text-emerald-600 text-sm">
                                                        {formatarMoeda(servico.valor || servico.preco)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                </div>

                {/* ========================================== */}
                {/* 📋 MODAL DE DETALHES DO SERVIÇO */}
                {/* ========================================== */}
                {servicoSelecionado && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                        {/* Overlay Escuro */}
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setServicoSelecionado(null)}></div>

                        {/* Cartão do Modal */}
                        <div className="bg-white w-full sm:w-[550px] sm:rounded-3xl rounded-t-3xl relative z-10 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                            
                            {/* Header Colorido do Modal */}
                            {(() => {
                                const corModal = getCor(servicoSelecionado.corIndex || 0);
                                return (
                                    <div className={`h-40 w-full relative ${corModal.bg} sm:rounded-t-3xl rounded-t-3xl flex items-center justify-center border-b ${corModal.border}`}>
                                        <button onClick={() => setServicoSelecionado(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/60 hover:bg-white text-gray-800 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-sm z-20">
                                            <XMarkIcon className="w-5 h-5" />
                                        </button>
                                        <ScissorsIcon className={`w-20 h-20 ${corModal.icon} opacity-80`} />
                                    </div>
                                );
                            })()}

                            {/* Conteúdo do Modal */}
                            <div className="p-6 sm:p-8 overflow-y-auto flex-1">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight mb-2">
                                    {servicoSelecionado.nome}
                                </h2>
                                <p className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg w-max uppercase tracking-widest mb-6 border border-indigo-100">
                                    Catálogo da Unidade
                                </p>

                                {/* Grid de Informações Financeiras e de Tempo */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                                        <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <CurrencyDollarIcon className="w-4 h-4"/> Valor Cobrado
                                        </p>
                                        <p className="text-2xl font-black text-emerald-700">{formatarMoeda(servicoSelecionado.valor || servicoSelecionado.preco)}</p>
                                    </div>
                                    <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl">
                                        <p className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <ClockIcon className="w-4 h-4"/> Tempo de Execução
                                        </p>
                                        <p className="text-2xl font-black text-amber-700">{servicoSelecionado.duracao} Minutos</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <InformationCircleIcon className="w-4 h-4"/> Descrição e Diretrizes
                                    </p>
                                    <p className="text-gray-600 text-sm leading-relaxed p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium">
                                        {servicoSelecionado.descricao || 'Serviço operacional padrão. Valide as preferências exatas com o cliente antes de iniciar o procedimento para garantir a satisfação.'}
                                    </p>
                                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-500 bg-white border border-gray-200 p-3 rounded-xl">
                                        <CalendarDaysIcon className="w-4 h-4 text-indigo-400" />
                                        Disponível no horário comercial: {funcionarioAtual?.estabelecimento?.nome}
                                    </div>
                                </div>
                            </div>

                            {/* Footer do Modal */}
                            <div className="p-5 border-t border-gray-100 bg-white sm:rounded-b-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                                <button onClick={() => setServicoSelecionado(null)} className="w-full bg-gray-900 text-white hover:bg-black font-black py-4 rounded-xl transition-colors shadow-md">
                                    Fechar Detalhes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}