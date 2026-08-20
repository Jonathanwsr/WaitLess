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
    HiOutlineStar
} from 'react-icons/hi';

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="Lokyva - Hotéis, Carros e Serviços Integrados" />

            <div className="relative min-h-screen bg-[#FFF9F5] text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
                
                {/* ================= HERO SECTION ================= */}
                <div className="relative min-h-screen flex flex-col justify-between overflow-hidden">
                    
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
                                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-[#F26522] px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
                                    <HiOutlineSparkles className="w-4 h-4" />
                                    Bem-vindo à Lokyva
                                </div>

                                <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6 drop-shadow-sm">
                                    Você viaja, <br />
                                    a gente conecta <br />
                                    <span className="text-[#F26522] relative inline-block">
                                        o resto
                                        <span className="absolute bottom-1 left-0 w-full h-2 bg-orange-200 -z-10 rounded-full" />
                                    </span>
                                </h1>

                                <p className="text-gray-700 font-medium text-lg max-w-md leading-relaxed mb-10 drop-shadow-sm">
                                    Chegou a hora de vivenciar suas viagens com liberdade absoluta, máxima praticidade e zero preocupação. Conectamos você a absolutamente tudo o que é necessário durante a sua jornada.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <a href="#ecossistema" className="w-full sm:w-auto bg-[#F26522] hover:bg-[#d95a1e] shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all text-white font-medium rounded-xl px-8 py-3.5 flex items-center justify-center gap-2 group">
                                        Descubra a Lokyva
                                        <HiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </a>
                                </div>
                            </div>
                        </main>

                        {/* Bottom Banner */}
                        <div className="w-full px-6 md:px-12 pb-12 flex justify-center z-20">
                            <div className="w-full max-w-5xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-xl rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3 bg-white/90 rounded-xl shadow-sm">
                                        <HiOutlineLocationMarker className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Onde você estiver</h4>
                                        <p className="text-sm text-gray-700">Geolocalização inteligente</p>
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-10 bg-gray-300/60" />

                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3 bg-white/90 rounded-xl shadow-sm">
                                        <HiOutlineCalendar className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Total flexibilidade</h4>
                                        <p className="text-sm text-gray-700">Reserve com antecedência</p>
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-10 bg-gray-300/60" />

                                <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="p-3 bg-white/90 rounded-xl shadow-sm">
                                        <HiOutlineDeviceMobile className="w-6 h-6 text-[#F26522]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Tudo pelo celular</h4>
                                        <p className="text-sm text-gray-700">Gestão na palma da mão</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= SEÇÃO: NOSSO ECOSSISTEMA ================= */}
                <section id="ecossistema" className="relative z-20 bg-white py-24 px-6 md:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="text-sm font-bold tracking-widest uppercase text-[#F26522] mb-4 block">
                                    Sua jornada redefinida
                                </span>
                                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
                                    Tudo o que o nosso ecossistema oferece a você
                                </h2>
                                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                                    Sabemos que planejar uma viagem ou lidar com imprevistos no meio do caminho pode ser cansativo. É exatamente por isso que a Lokyva foi criada: para ser o seu ecossistema definitivo de turismo e comodidade.
                                </p>
                                
                                <div className="space-y-8">
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                                                <HiGlobeAlt className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">Descubra o mundo</h4>
                                            <p className="text-gray-600 leading-relaxed">
                                                O aplicativo reconhece instantaneamente onde você está e filtra os melhores serviços em um raio de proximidade. Tenha acesso a um catálogo verificado de parceiros locais.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                                                <HiOutlineCurrencyDollar className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">Sem surpresas no orçamento</h4>
                                            <p className="text-gray-600 leading-relaxed">
                                                Consulte valores com transparência, analise condições e realize pagamentos em um ambiente criptografado e 100% seguro.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-[#FFF9F5] p-8 md:p-12 rounded-3xl border border-orange-100 relative">
                                <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-orange-500 rounded-full opacity-10 blur-2xl"></div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Conectamos você à essência do destino</h3>
                                <p className="text-gray-600 leading-relaxed mb-6">
                                    Não importa se você está na fase de planejamento, no aeroporto prestes a embarcar, ou se já chegou ao seu destino final e precisa de uma solução de última hora.
                                </p>
                                <p className="text-gray-600 leading-relaxed font-medium">
                                    Mais do que um simples aplicativo de reservas, a Lokyva é uma ponte direta entre viajantes exigentes e os melhores prestadores de serviço do mercado. Nossa missão é cuidar de toda a burocracia para que o seu único trabalho seja aproveitar o momento.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================= SEÇÃO DE CATÁLOGO / SERVIÇOS ================= */}
                <section id="servicos" className="relative z-20 bg-[#FFF9F5] py-24 px-6 md:px-12 border-t border-orange-100">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <span className="text-sm font-bold tracking-widest uppercase text-[#F26522]">
                                Um catálogo completo
                            </span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mt-2 tracking-tight">
                                Para você e toda a sua família
                            </h2>
                            <p className="text-gray-600 mt-4 text-lg">
                                Centralizamos os pilares fundamentais de qualquer viagem em uma única interface.
                            </p>
                        </div>

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            
                            {/* Hospedagens */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-2xl hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition shadow-sm">
                                        <HiOutlineOfficeBuilding className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Hospedagens</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        De resorts de luxo a pousadas boutiques e quartos práticos para viagens de negócios, garantimos as melhores tarifas.
                                    </p>
                                </div>
                            </div>

                            {/* Carros */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-2xl hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition shadow-sm">
                                        <HiOutlineKey className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Mobilidade</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Aluguel de veículos de diversas categorias, desde compactos econômicos até SUVs familiares, para garantir sua autonomia.
                                    </p>
                                </div>
                            </div>

                            {/* Gastronomia e Lazer */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-2xl hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition shadow-sm">
                                        <HiOutlineMap className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Gastronomia e Lazer</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Acesso direto aos melhores restaurantes locais, roteiros gastronômicos e experiências turísticas exclusivas.
                                    </p>
                                </div>
                            </div>

                            {/* Serviços */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-2xl hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition shadow-sm">
                                        <HiOutlineSparkles className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Serviços e Bem-estar</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Agendamentos que facilitam o seu dia a dia longe de casa. Traslados privativos, guias locais e concierge.
                                    </p>
                                </div>
                            </div>

                            {/* Pet-Friendly */}
                            <div className="group bg-white border border-gray-100 p-8 rounded-2xl hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between md:col-span-2 lg:col-span-1">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition shadow-sm">
                                        <HiOutlineHeart className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Universo Pet-Friendly</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Filtros dedicados para encontrar hotéis, restaurantes e parques que receberão seus animais de estimação com total conforto.
                                    </p>
                                </div>
                            </div>

                            {/* Call to Action Final no Grid */}
                            <div className="group bg-gradient-to-br from-[#F26522] to-[#d95a1e] p-8 rounded-2xl shadow-lg flex flex-col justify-center items-center text-center md:col-span-2 lg:col-span-1">
                                <h3 className="text-2xl font-bold text-white mb-4">Sua próxima grande viagem começa aqui.</h3>
                                <Link href={route('register')} className="bg-white text-orange-600 font-bold py-3 px-6 rounded-xl hover:scale-105 transition-transform w-full">
                                    Começar Agora
                                </Link>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ================= RODAPÉ ================= */}
                <footer className="bg-gray-900 text-gray-400 py-12 px-6 md:px-12 border-t border-gray-800 relative z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center md:items-start gap-2">
                            <div className="flex items-center gap-3">
                                <img 
                                    src="/images/logo_lokyva.png" 
                                    alt="Logo Lokyva" 
                                    className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                                />
                                <span className="text-lg font-bold text-white tracking-tight">Lokyva</span>
                            </div>
                            <span className="text-xs text-gray-500">
                                Orgulhosamente desenvolvido por{' '}
                                <a
                                    href="https://site-innovate-solutions.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-400 hover:underline"
                                >
                                    INNOVATE SOLUTIONS
                                </a>
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center md:items-end gap-2">
                            <p className="text-sm text-center md:text-right">
                                &copy; 2026 Lokyva Tecnologia S.A. Todos os direitos reservados.
                            </p>
                            
                            <a 
                                href="/documentos/Termo-decompromisso.pdf" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-gray-500 hover:text-orange-400 transition-colors underline decoration-gray-700 underline-offset-4"
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