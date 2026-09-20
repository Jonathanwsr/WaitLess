import { useEffect, useState } from 'react';
import { Link, Head } from '@inertiajs/react';
import {
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
    HiOutlineViewGrid,
    HiGlobeAlt,
    HiChevronDown,
    HiOutlineSparkles,
    HiOutlineOfficeBuilding,
    HiOutlineKey,
    HiArrowRight,
    HiOutlineLocationMarker,
    HiOutlineDeviceMobile,
    HiOutlineHeart,
    HiOutlineMap,
    HiOutlineClock,
    HiOutlineTag,
    HiOutlineUserAdd,
    HiOutlineCursorClick,
    HiOutlineShieldCheck,
    HiOutlineFire,
    HiOutlineGift,
    HiOutlineTicket
} from 'react-icons/hi';

const ICONES_CATEGORIA_ALUGUEL = {
    casa: HiOutlineOfficeBuilding,
    apartamento: HiOutlineOfficeBuilding,
    casa_praia: HiOutlineOfficeBuilding,
    flat: HiOutlineOfficeBuilding,
    chacara: HiOutlineOfficeBuilding,
    sitio: HiOutlineOfficeBuilding,
    galpao: HiOutlineOfficeBuilding,
    sala: HiOutlineOfficeBuilding,
    quadra: HiOutlineMap,
    carro: HiOutlineKey,
    moto: HiOutlineKey,
    van: HiOutlineKey,
    caminhao: HiOutlineKey,
    barco: HiOutlineKey,
    bicicleta: HiOutlineKey,
    patinete: HiOutlineKey,
};

function formatarPreco(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function CardDestaque({ item }) {
    const Icone = item.tipo === 'aluguel'
        ? (ICONES_CATEGORIA_ALUGUEL[item.categoria] || HiOutlineSparkles)
        : HiOutlineSparkles;

    return (
        <Link
            href={route('vitrine.detalhe', { tipo: item.tipo, id: item.id })}
            className="group relative bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(242,101,34,0.15)] hover:border-orange-200 hover:-translate-y-1 transition-all duration-500 flex flex-col"
        >
            <div className="relative h-48 w-full bg-gradient-to-br from-gray-50 to-orange-50/50 flex items-center justify-center overflow-hidden">
                {item.foto ? (
                    <>
                        <div className="absolute inset-0 bg-gray-900/10 group-hover:bg-transparent transition-colors duration-500 z-10" />
                        <img
                            src={item.foto}
                            alt={item.nome}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                    </>
                ) : (
                    <div className="relative z-10 p-4 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/50">
                        <Icone className="w-10 h-10 text-orange-400" />
                    </div>
                )}
                
                {/* Badges Flutuantes Modernas */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <span className="bg-white/90 backdrop-blur-md text-[#F26522] text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-sm border border-white/20">
                        {item.tipo === 'aluguel' ? 'Aluguel' : 'Serviço'}
                    </span>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-1 bg-white relative">
                {/* Preço em destaque sobrepondo a imagem */}
                <div className="absolute -top-6 right-4 z-20 bg-[#F26522] text-white px-4 py-2 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center gap-1 border-2 border-white">
                    <span className="font-extrabold">{formatarPreco(item.valor)}</span>
                    {item.periodo && <span className="text-xs text-orange-100 font-medium">/{item.periodo}</span>}
                </div>

                <div className="mt-2">
                    <h4 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-[#F26522] transition-colors">{item.nome}</h4>

                    {item.descricao && (
                        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-5">{item.descricao}</p>
                    )}
                </div>

                <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                        {item.duracao_minutos && (
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg">
                                <HiOutlineClock className="w-4 h-4 text-[#F26522]" />
                                {item.duracao_minutos} min
                            </div>
                        )}
                        {(item.estabelecimento || item.endereco) && (
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg truncate">
                                <HiOutlineLocationMarker className="w-4 h-4 text-[#F26522] flex-shrink-0" />
                                <span className="truncate">
                                    {[item.estabelecimento, item.endereco].filter(Boolean).join(' • ')}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-400 group-hover:text-gray-900 transition-colors">Mais informações</span>
                        <div className="w-8 h-8 rounded-full bg-orange-50 text-[#F26522] flex items-center justify-center group-hover:bg-[#F26522] group-hover:text-white transition-all duration-300">
                            <HiArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function VitrinePremium({ itens }) {
    const [indice, setIndice] = useState(0);
    const [pausado, setPausado] = useState(false);

    useEffect(() => {
        if (itens.length <= 1 || pausado) return undefined;

        const intervalo = setInterval(() => {
            setIndice((atual) => (atual + 1) % itens.length);
        }, 5000);

        return () => clearInterval(intervalo);
    }, [itens.length, pausado]);

    if (itens.length === 0) return null;

    const item = itens[Math.min(indice, itens.length - 1)];
    const linkDetalhe = route('vitrine.detalhe', { tipo: item.tipo, id: item.id });

    return (
        <section className="relative z-20 bg-[#09090b] py-24 px-6 md:px-12 overflow-hidden">
            {/* Efeitos de Luz Modernos (Glows) */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

            <div className="max-w-6xl mx-auto relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <div className="inline-flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase mb-4">
                        <HiOutlineFire className="w-4 h-4 animate-pulse" />
                        Em alta agora
                    </div>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight">
                        Seleção Exclusiva
                    </h2>
                </div>

                <div 
                    className="group relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 md:p-8 flex flex-col md:flex-row items-center gap-8 md:gap-12 transition-all duration-500 hover:bg-white/[0.07] hover:border-orange-500/30"
                    onMouseEnter={() => setPausado(true)}
                    onMouseLeave={() => setPausado(false)}
                >
                    {/* Lado da Imagem */}
                    <Link href={linkDetalhe} className="w-full md:w-1/2 relative h-72 md:h-[450px] rounded-[2rem] overflow-hidden block">
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent z-10" />
                        {item.foto ? (
                            <img
                                key={item.foto}
                                src={item.foto}
                                alt={item.nome}
                                className="w-full h-full object-cover animate-[fadeIn_0.8s_ease-out] group-hover:scale-105 transition-transform duration-700"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <HiOutlineSparkles className="w-20 h-20 text-gray-600" />
                            </div>
                        )}
                        <span className="absolute top-6 left-6 z-20 bg-orange-500 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 shadow-xl shadow-orange-500/20">
                            <HiOutlineFire className="w-4 h-4" />
                            Destaque
                        </span>
                    </Link>

                    {/* Lado do Conteúdo */}
                    <div className="w-full md:w-1/2 flex flex-col justify-center px-2 pb-4 md:px-4 md:pb-0">
                        <div key={item.id} className="animate-[fadeIn_0.5s_ease-out]">
                            <span className="text-sm font-bold uppercase tracking-widest text-orange-500 mb-3 block">
                                {item.tipo === 'aluguel' ? 'Categoria: Aluguel' : 'Categoria: Serviço'}
                            </span>
                            <Link href={linkDetalhe} className="block group/title">
                                <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight group-hover/title:text-orange-400 transition-colors">
                                    {item.nome}
                                </h3>
                            </Link>

                            {item.descricao && (
                                <p className="text-gray-400 text-lg leading-relaxed line-clamp-3 mb-8">
                                    {item.descricao}
                                </p>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10">
                                <div className="bg-white/10 border border-white/5 px-6 py-4 rounded-2xl backdrop-blur-md">
                                    <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">A partir de</span>
                                    <span className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                                        {formatarPreco(item.valor)}
                                        {item.periodo && <span className="text-sm text-gray-400 font-medium">/{item.periodo}</span>}
                                    </span>
                                </div>
                                {item.endereco && (
                                    <div className="flex items-center gap-2 text-gray-400 bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                                        <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                                            <HiOutlineLocationMarker className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-medium">{item.endereco}</span>
                                    </div>
                                )}
                            </div>

                            <Link 
                                href={linkDetalhe}
                                className="inline-flex items-center justify-center gap-3 bg-[#F26522] hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(242,101,34,0.5)] hover:shadow-[0_0_60px_-15px_rgba(242,101,34,0.7)] hover:-translate-y-1 w-full sm:w-auto"
                            >
                                Agendar agora
                                <HiArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Indicadores Modernos */}
                {itens.length > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-12">
                        {itens.map((destaque, i) => (
                            <button
                                key={destaque.tipo + destaque.id}
                                type="button"
                                onClick={() => setIndice(i)}
                                aria-label={`Ir para o destaque ${i + 1}`}
                                className="group relative h-2 rounded-full overflow-hidden transition-all duration-300 focus:outline-none"
                                style={{ width: i === indice ? '48px' : '12px' }}
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:bg-white/40 transition-colors" />
                                {i === indice && (
                                    <div 
                                        className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full origin-left"
                                        style={{
                                            animation: pausado ? 'none' : 'progress 5s linear infinite'
                                        }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <style jsx>{`
                @keyframes progress {
                    0% { transform: scaleX(0); }
                    100% { transform: scaleX(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </section>
    );
}

export default function Welcome({
    auth,
    canLogin,
    canRegister,
    servicosDestaque = [],
    itensAluguelDestaque = [],
    destaquesPremium = [],
    estatisticas = {},
}) {
    const [abaAtiva, setAbaAtiva] = useState('servicos');

    const itensExibidos = abaAtiva === 'servicos' ? servicosDestaque : itensAluguelDestaque;

    return (
        <>
            <Head title="Lokyva - Hotéis, Carros e Serviços Integrados" />

            <div className="relative min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
                
                {/* ================= HERO SECTION ================= */}
                <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#FFF9F5]">
                    
                    {/* Imagem de Fundo e Gradientes */}
                    <div className="absolute top-0 right-0 w-full lg:w-[55%] h-full z-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF9F5] via-[#FFF9F5]/90 to-transparent z-10 hidden lg:block" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#FFF9F5] via-[#FFF9F5]/80 to-transparent z-10 lg:hidden" />
                        
                        <img
                            src="/images/imagem-carro.png"
                            alt="Reserva de hotéis, carros e serviços Lokyva"
                            className="w-full h-full object-cover object-center lg:object-right"
                        />
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="relative z-20 w-full flex flex-col flex-1">
                        
                        {/* NAVBAR */}
                        <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
                            <div className="flex items-center gap-3 group cursor-pointer flex-shrink-0">
                                <img 
                                    src="/images/logo_lokyva.png" 
                                    alt="Logo Lokyva" 
                                    className="h-10 w-auto object-contain transform group-hover:scale-105 transition"
                                />
                                <span className="text-xl font-bold text-gray-900 tracking-tight">Lokyva</span>
                            </div>

                            <div className="hidden lg:flex items-center gap-8 ml-8 flex-1 justify-start">
                                <a href="#ecossistema" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Nosso Ecossistema</a>
                                <a href="#destaques" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Serviços e Aluguéis</a>
                                <a href="#servicos" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Catálogo</a>
                                <a href="#beneficios" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Vantagens</a>
                            </div>

                            <div className="flex items-center gap-4 ml-auto flex-shrink-0">
                                <div className="hidden md:flex items-center gap-1 text-gray-700 cursor-pointer hover:text-orange-500 transition mr-2">
                                    <HiGlobeAlt className="w-5 h-5" />
                                    <HiChevronDown className="w-4 h-4" />
                                </div>

                                {auth?.user ? (
                                    <Link href={route('dashboard')} className="font-semibold text-orange-500 border border-orange-500 px-6 py-2.5 rounded-xl hover:bg-orange-50 transition shadow-sm">
                                        Painel
                                    </Link>
                                ) : (
                                    <>
                                        <Link href={route('login')} className="font-semibold text-gray-700 hover:text-orange-600 px-4 py-2.5 transition">
                                            Login
                                        </Link>
                                        {canRegister && (
                                            <Link href={route('register')} className="bg-[#F26522] hover:bg-[#d95a1e] hover:shadow-lg hover:shadow-orange-500/20 transition duration-300 text-white px-6 py-2.5 rounded-xl font-semibold whitespace-nowrap">
                                                Crie conta
                                            </Link>
                                        )}
                                    </>
                                )}
                            </div>
                        </nav>

                        {/* HERO CONTENT */}
                        <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-40 flex flex-col justify-center">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-[#F26522] px-4 py-1.5 rounded-full text-sm font-semibold mb-6 shadow-sm shadow-orange-500/5">
                                    <HiOutlineSparkles className="w-4 h-4" />
                                    Bem-vindo à Lokyva
                                </div>

                                <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6 drop-shadow-sm">
                                    Você viaja, <br />
                                    a gente conecta <br />
                                    <span className="text-[#F26522] relative inline-block">
                                        o resto
                                        <span className="absolute bottom-1 left-0 w-full h-3 bg-orange-200/60 -z-10 rounded-full" />
                                    </span>
                                </h1>

                                <p className="text-gray-700 font-medium text-lg max-w-md leading-relaxed mb-10 drop-shadow-sm">
                                    Chegou a hora de vivenciar suas viagens com liberdade absoluta, máxima praticidade e zero preocupação. Conectamos você a absolutamente tudo o que é necessário durante a sua jornada.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <a href="#ecossistema" className="w-full sm:w-auto bg-[#F26522] hover:bg-[#d95a1e] shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:-translate-y-0.5 text-white font-medium rounded-xl px-8 py-4 flex items-center justify-center gap-2 group">
                                        Descubra a Lokyva
                                        <HiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </a>
                                </div>
                            </div>
                        </main>

                        {/* Bottom Banner */}
                        <div className="w-full px-6 md:px-12 pb-12 flex justify-center z-20">
                            <div className="w-full max-w-5xl bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3.5 bg-orange-50 rounded-2xl shadow-sm border border-orange-100/50">
                                        <HiOutlineLocationMarker className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-base">Onde você estiver</h4>
                                        <p className="text-sm text-gray-500 mt-0.5">Geolocalização inteligente</p>
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-12 bg-gray-200" />

                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3.5 bg-orange-50 rounded-2xl shadow-sm border border-orange-100/50">
                                        <HiOutlineCalendar className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-base">Total flexibilidade</h4>
                                        <p className="text-sm text-gray-500 mt-0.5">Reserve com antecedência</p>
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-12 bg-gray-200" />

                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3.5 bg-orange-50 rounded-2xl shadow-sm border border-orange-100/50">
                                        <HiOutlineDeviceMobile className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-base">Tudo pelo celular</h4>
                                        <p className="text-sm text-gray-500 mt-0.5">Gestão na palma da mão</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= SEÇÃO: NÚMEROS DA PLATAFORMA ================= */}
                <section className="relative z-20 bg-gray-900 py-16 px-6 md:px-12">
                    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center divide-x divide-gray-800">
                        <div className="px-4">
                            <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">{estatisticas.estabelecimentos ?? 0}+</p>
                            <p className="text-sm md:text-base font-medium text-gray-400 mt-2">Parceiros locais</p>
                        </div>
                        <div className="px-4">
                            <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">{estatisticas.cidades ?? 0}+</p>
                            <p className="text-sm md:text-base font-medium text-gray-400 mt-2">Cidades atendidas</p>
                        </div>
                        <div className="px-4 border-t border-gray-800 md:border-t-0 pt-8 md:pt-0">
                            <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">{estatisticas.servicos ?? 0}+</p>
                            <p className="text-sm md:text-base font-medium text-gray-400 mt-2">Serviços prontos</p>
                        </div>
                        <div className="px-4 border-t border-gray-800 md:border-t-0 pt-8 md:pt-0">
                            <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">{estatisticas.itensAluguel ?? 0}+</p>
                            <p className="text-sm md:text-base font-medium text-gray-400 mt-2">Itens para locação</p>
                        </div>
                    </div>
                </section>

                <VitrinePremium itens={destaquesPremium} />

                {/* ================= SEÇÃO: DESTAQUES REAIS (VITRINE GRID) ================= */}
                <section id="destaques" className="relative z-20 bg-[#FAFAFA] py-28 px-6 md:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
                            <div className="max-w-2xl">
                                <span className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-[#F26522] mb-3">
                                    <span className="w-8 h-1 bg-[#F26522] rounded-full"></span>
                                    Catálogo Aberto
                                </span>
                                <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                                    Explore o que há de melhor
                                </h2>
                                <p className="text-gray-500 mt-4 text-lg">
                                    Conheça as opções mais buscadas na sua região. 
                                    Reserve, pague e gerencie sem sair da tela.
                                </p>
                            </div>

                            {/* Abas Modernas (Segmented Control Apple-style) */}
                            <div className="flex bg-gray-200/60 p-1.5 rounded-2xl w-full md:w-auto self-start md:self-end">
                                <button
                                    type="button"
                                    onClick={() => setAbaAtiva('servicos')}
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                        abaAtiva === 'servicos'
                                            ? 'bg-white text-[#F26522] shadow-[0_2px_10px_rgb(0,0,0,0.05)]'
                                            : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Serviços
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAbaAtiva('alugueis')}
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                        abaAtiva === 'alugueis'
                                            ? 'bg-white text-[#F26522] shadow-[0_2px_10px_rgb(0,0,0,0.05)]'
                                            : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Aluguéis
                                </button>
                            </div>
                        </div>

                        {/* Grid de Cards Moderno */}
                        {itensExibidos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                                {itensExibidos.map((item, idx) => (
                                    <div key={`${item.tipo}-${item.id}`} className="animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
                                        <CardDestaque item={item} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <HiOutlineSparkles className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Novidades em breve</h3>
                                <p className="text-gray-500">
                                    Estamos cadastrando novos parceiros para esta categoria.
                                </p>
                            </div>
                        )}

                        <div className="text-center mt-16">
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-2xl font-bold transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    Ver catálogo completo
                                    <HiArrowRight className="w-5 h-5" />
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                {/* ================= SEÇÃO: COMO FUNCIONA ================= */}
                <section className="relative z-20 bg-white py-24 px-6 md:px-12 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <span className="text-sm font-bold tracking-widest uppercase text-[#F26522]">
                                Simples assim
                            </span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mt-2 tracking-tight">
                                Como a Lokyva funciona
                            </h2>
                            <p className="text-gray-500 mt-4 text-lg">
                                Sem burocracia: em poucos minutos você já está agendando ou reservando o que precisa.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="relative bg-[#FAFAFA] border border-gray-100 rounded-3xl p-10 text-center hover:border-orange-200 transition-colors">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 text-[#F26522] flex items-center justify-center text-2xl mb-6 shadow-sm border border-orange-100">
                                    <HiOutlineViewGrid className="w-8 h-8" />
                                </div>
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">1</span>
                                <h4 className="text-xl font-bold text-gray-900 mb-3">Explore o catálogo</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Navegue por serviços e itens de aluguel de parceiros verificados, filtrando por cidade, categoria e preço.
                                </p>
                            </div>

                            <div className="relative bg-[#FAFAFA] border border-gray-100 rounded-3xl p-10 text-center hover:border-orange-200 transition-colors">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 text-[#F26522] flex items-center justify-center text-2xl mb-6 shadow-sm border border-orange-100">
                                    <HiOutlineUserAdd className="w-8 h-8" />
                                </div>
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">2</span>
                                <h4 className="text-xl font-bold text-gray-900 mb-3">Crie sua conta grátis</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    O cadastro leva menos de um minuto e não exige nenhum pagamento para começar a usar a plataforma.
                                </p>
                            </div>

                            <div className="relative bg-[#FAFAFA] border border-gray-100 rounded-3xl p-10 text-center hover:border-orange-200 transition-colors">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 text-[#F26522] flex items-center justify-center text-2xl mb-6 shadow-sm border border-orange-100">
                                    <HiOutlineCursorClick className="w-8 h-8" />
                                </div>
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">3</span>
                                <h4 className="text-xl font-bold text-gray-900 mb-3">Agende ou reserve</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Escolha o horário, pague com segurança dentro do app e acompanhe tudo pelo status em tempo real.
                                </p>
                            </div>
                        </div>

                        <div className="mt-16 inline-flex items-center justify-center gap-3 w-full text-sm font-medium text-gray-500 bg-gray-50 py-4 rounded-2xl border border-gray-100">
                            <HiOutlineShieldCheck className="w-6 h-6 text-green-500" />
                            Ambiente seguro. Pagamentos processados com criptografia de ponta a ponta.
                        </div>
                    </div>
                </section>

                {/* ================= SEÇÃO: VANTAGENS (PONTOS E DESCONTOS) ================= */}
                <section className="relative z-20 bg-[#FFF9F5] py-24 px-6 md:px-12 border-t border-orange-100">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-sm font-bold tracking-widest uppercase text-[#F26522] mb-4 block">
                                Vantagens Lokyva
                            </span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
                                Quanto mais você usa, mais você economiza
                            </h2>
                            <p className="text-lg text-gray-600 mb-10 leading-relaxed">
                                Todo cliente acumula pontos automaticamente e pode trocá-los por descontos reais nos estabelecimentos parceiros. Sem pegadinha: você usa a Lokyva no dia a dia e o desconto vem sozinho.
                            </p>

                            <div className="space-y-8">
                                <div className="flex gap-5">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-orange-100 flex items-center justify-center text-[#F26522]">
                                            <HiOutlineGift className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900 mb-2">Ganhe pontos sem esforço</h4>
                                        <p className="text-gray-500 leading-relaxed text-sm">
                                            A cada agendamento concluído, pagamento feito e avaliação enviada, você acumula pontos automaticamente na sua carteira Lokyva.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-5">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-orange-100 flex items-center justify-center text-[#F26522]">
                                            <HiOutlineTicket className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900 mb-2">Troque por descontos reais</h4>
                                        <p className="text-gray-500 leading-relaxed text-sm">
                                            Use os pontos acumulados para resgatar cupons de desconto direto nos estabelecimentos parceiros, sem precisar sacar nada.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-5">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-[#F26522] shadow-sm shadow-orange-500/20 flex items-center justify-center text-white">
                                            <HiOutlineSparkles className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900 mb-2">Assinantes Plus pontuam em dobro</h4>
                                        <p className="text-gray-500 leading-relaxed text-sm">
                                            Quem assina o plano Lokyva Plus ganha o dobro de pontos em cada ação, além de prioridade na fila e acesso antecipado a novidades.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-orange-500/5 border border-orange-50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full opacity-10 blur-3xl -mr-20 -mt-20"></div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-8 relative z-10">Simples de entender, fácil de aproveitar</h3>
                            <ul className="space-y-6 relative z-10">
                                <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-2xl">
                                    <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[#F26522] flex-shrink-0 shadow-sm" />
                                    <span className="text-gray-600 text-sm leading-relaxed font-medium">Pontos caem automaticamente na sua conta após cada serviço ou reserva concluída.</span>
                                </li>
                                <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-2xl">
                                    <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[#F26522] flex-shrink-0 shadow-sm" />
                                    <span className="text-gray-600 text-sm leading-relaxed font-medium">O extrato completo fica disponível na sua carteira, com histórico de ganhos e resgates.</span>
                                </li>
                                <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-2xl">
                                    <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[#F26522] flex-shrink-0 shadow-sm" />
                                    <span className="text-gray-600 text-sm leading-relaxed font-medium">Cada estabelecimento parceiro define seus próprios cupons e regras de resgate.</span>
                                </li>
                                <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-2xl">
                                    <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[#F26522] flex-shrink-0 shadow-sm" />
                                    <span className="text-gray-600 text-sm leading-relaxed font-medium">Não tem pegadinha: pontos não expiram por uso, só ficam parados até você resgatar.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ================= SEÇÃO: NOSSO ECOSSISTEMA ================= */}
                <section id="ecossistema" className="relative z-20 bg-white py-24 px-6 md:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="order-2 lg:order-1 bg-[#FAFAFA] p-8 md:p-12 rounded-[2.5rem] border border-gray-100 relative">
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500 rounded-full opacity-5 blur-2xl"></div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Conectamos você à essência do destino</h3>
                                <p className="text-gray-600 leading-relaxed mb-6">
                                    Não importa se você está na fase de planejamento, no aeroporto prestes a embarcar, ou se já chegou ao seu destino final e precisa de uma solução de última hora.
                                </p>
                                <div className="h-px w-12 bg-gray-300 mb-6"></div>
                                <p className="text-gray-900 leading-relaxed font-bold">
                                    Mais do que um simples aplicativo de reservas, a Lokyva é uma ponte direta entre viajantes exigentes e os melhores prestadores de serviço do mercado. Nossa missão é cuidar de toda a burocracia para que o seu único trabalho seja aproveitar o momento.
                                </p>
                            </div>

                            <div className="order-1 lg:order-2">
                                <span className="text-sm font-bold tracking-widest uppercase text-[#F26522] mb-4 block">
                                    Sua jornada redefinida
                                </span>
                                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
                                    Tudo o que o nosso ecossistema oferece a você
                                </h2>
                                <p className="text-lg text-gray-500 mb-10 leading-relaxed">
                                    Sabemos que planejar uma viagem ou lidar com imprevistos no meio do caminho pode ser cansativo. É exatamente por isso que a Lokyva foi criada: para ser o seu ecossistema definitivo de turismo e comodidade.
                                </p>
                                
                                <div className="space-y-8">
                                    <div className="flex gap-5">
                                        <div className="flex-shrink-0">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F26522]">
                                                <HiGlobeAlt className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">Descubra o mundo</h4>
                                            <p className="text-gray-500 leading-relaxed text-sm">
                                                O aplicativo reconhece instantaneamente onde você está e filtra os melhores serviços em um raio de proximidade. Tenha acesso a um catálogo verificado de parceiros locais.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-5">
                                        <div className="flex-shrink-0">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F26522]">
                                                <HiOutlineCurrencyDollar className="w-6 h-6" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">Sem surpresas no orçamento</h4>
                                            <p className="text-gray-500 leading-relaxed text-sm">
                                                Consulte valores com transparência, analise condições e realize pagamentos em um ambiente criptografado e 100% seguro.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================= SEÇÃO DE CATÁLOGO / SERVIÇOS ================= */}
                <section id="servicos" className="relative z-20 bg-[#FAFAFA] py-24 px-6 md:px-12 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <span className="text-sm font-bold tracking-widest uppercase text-[#F26522]">
                                Um catálogo completo
                            </span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mt-2 tracking-tight">
                                Para você e toda a sua família
                            </h2>
                            <p className="text-gray-500 mt-4 text-lg">
                                Centralizamos os pilares fundamentais de qualquer viagem em uma única interface.
                            </p>
                        </div>

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            {/* Hospedagens */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-[2rem] hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-2xl mb-6 group-hover:bg-[#F26522] group-hover:text-white transition-colors duration-300">
                                        <HiOutlineOfficeBuilding className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Hospedagens</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        De resorts de luxo a pousadas boutiques e quartos práticos para viagens de negócios, garantimos as melhores tarifas.
                                    </p>
                                </div>
                            </div>

                            {/* Carros */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-[2rem] hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-2xl mb-6 group-hover:bg-[#F26522] group-hover:text-white transition-colors duration-300">
                                        <HiOutlineKey className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Mobilidade</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        Aluguel de veículos de diversas categorias, desde compactos econômicos até SUVs familiares, para garantir sua autonomia.
                                    </p>
                                </div>
                            </div>

                            {/* Gastronomia e Lazer */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-[2rem] hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-2xl mb-6 group-hover:bg-[#F26522] group-hover:text-white transition-colors duration-300">
                                        <HiOutlineMap className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Gastronomia e Lazer</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        Acesso direto aos melhores restaurantes locais, roteiros gastronômicos e experiências turísticas exclusivas.
                                    </p>
                                </div>
                            </div>

                            {/* Serviços */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-[2rem] hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-2xl mb-6 group-hover:bg-[#F26522] group-hover:text-white transition-colors duration-300">
                                        <HiOutlineSparkles className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Serviços e Bem-estar</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        Agendamentos que facilitam o seu dia a dia longe de casa. Traslados privativos, guias locais e concierge.
                                    </p>
                                </div>
                            </div>

                            {/* Pet-Friendly */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-[2rem] hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between md:col-span-2 lg:col-span-1">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-2xl mb-6 group-hover:bg-[#F26522] group-hover:text-white transition-colors duration-300">
                                        <HiOutlineHeart className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Universo Pet-Friendly</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        Filtros dedicados para encontrar hotéis, restaurantes e parques que receberão seus animais de estimação com total conforto.
                                    </p>
                                </div>
                            </div>

                            {/* Call to Action Final no Grid */}
                            <div className="group bg-gray-900 p-8 rounded-[2rem] shadow-xl flex flex-col justify-center items-center text-center md:col-span-2 lg:col-span-1 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#F26522]/20 to-transparent z-0"></div>
                                <div className="relative z-10 w-full">
                                    <h3 className="text-2xl font-bold text-white mb-6">Sua próxima grande viagem começa aqui.</h3>
                                    <Link href={route('register')} className="bg-[#F26522] text-white font-bold py-4 px-6 rounded-xl hover:bg-orange-600 transition-colors w-full inline-block">
                                        Começar Agora
                                    </Link>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ================= RODAPÉ ================= */}
                <footer className="bg-gray-950 text-gray-400 py-16 px-6 md:px-12 relative z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex flex-col items-center md:items-start gap-3">
                            <div className="flex items-center gap-3">
                                <img 
                                    src="/images/logo_lokyva.png" 
                                    alt="Logo Lokyva" 
                                    className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                                />
                                <span className="text-xl font-extrabold text-white tracking-tight">Lokyva</span>
                            </div>
                            <span className="text-sm text-gray-500">
                                Orgulhosamente desenvolvido por{' '}
                                <a
                                    href="https://site-innovate-solutions.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-500 font-medium hover:text-orange-400 transition-colors"
                                >
                                    INNOVATE SOLUTIONS
                                </a>
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center md:items-end gap-3">
                            <p className="text-sm text-center md:text-right font-medium text-gray-500">
                                &copy; 2026 Lokyva Tecnologia S.A. Todos os direitos reservados.
                            </p>
                            
                            <a 
                                href="/documentos/Termo-decompromisso.pdf" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-gray-600 hover:text-white transition-colors underline decoration-gray-800 underline-offset-4"
                            >
                                Termo de Compromisso
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}