import { Link, Head } from '@inertiajs/react';
import { 
    HiOutlineTag, 
    HiOutlineShieldCheck, 
    HiOutlineSupport,
    HiArrowRight,
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
    HiOutlineViewGrid,
    HiGlobeAlt,
    HiChevronDown,
    HiOutlineClock,
    HiOutlineHome,
    HiOutlineKey,
    HiOutlineSparkles,
    HiOutlineCheckCircle
} from 'react-icons/hi';

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="Waitless - Hotéis, Carros e Serviços Integrados" />
            
            {/* Container Principal */}
            <div className="relative min-h-screen bg-[#FFF9F5] text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
                
                {/* ================= HERO SECTION ================= */}
                <div className="relative min-h-screen flex flex-col justify-between overflow-hidden">
                    
                    {/* Imagem de Fundo (Lado Direito) */}
                    <div className="absolute top-0 right-0 w-full lg:w-[55%] h-full z-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF9F5] via-[#FFF9F5]/75 to-transparent z-10 hidden lg:block"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#FFF9F5] via-transparent to-transparent z-10 lg:hidden"></div>
                        
                        <img 
                            src="/images/imagem-carro.png" 
                            alt="Reserva de hotéis, carros e serviços Waitless" 
                            className="w-full h-full object-cover object-center lg:object-right"
                        />
                    </div>

                    {/* Conteúdo da Navbar e Hero */}
                    <div className="relative z-20 w-full flex flex-col flex-1">
                        
                        {/* --- NAVBAR --- */}
                        <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
                            {/* Lado Esquerdo: Logo */}
                            <div className="flex items-center gap-2 group cursor-pointer flex-shrink-0">
                                <div className="bg-[#F26522] text-white font-black text-2xl w-10 h-10 flex items-center justify-center rounded-xl shadow-md shadow-orange-500/20 transform group-hover:scale-105 transition">
                                    W
                                </div>
                                <span className="text-xl font-bold text-gray-900 tracking-tight">Waitless</span>
                            </div>

                            {/* Centro: Links de Navegação Unificados */}
                            <div className="hidden lg:flex items-center gap-8 ml-8 flex-1 justify-start">
                                <a href="#hospedagens" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Hospedagens</a>
                                <a href="#carros" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Carros</a>
                                <a href="#servicos" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Serviços</a>
                                <a href="#ofertas" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Ofertas</a>
                                <a href="#como-funciona" className="text-gray-700 font-medium text-sm hover:text-orange-500 transition-colors">Como funciona</a>
                            </div>

                            {/* Extrema Direita: Idioma + Autenticação */}
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

                        {/* --- HERO CONTENT --- */}
                        <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-40 flex flex-col justify-center">
                            <div className="max-w-2xl">
                                
                                {/* Badge de Ecossistema Tudo em Um */}
                                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-[#F26522] px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
                                    <HiOutlineSparkles className="w-4 h-4" /> Reservas integradas de hotéis, carros e serviços exclusivos.
                                </div>

                                {/* Headline Principal */}
                                <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
                                    Sua próxima <br />
                                    viagem começa <br />
                                    <span className="text-[#F26522] relative inline-block">
                                        aqui
                                        <span className="absolute bottom-1 left-0 w-full h-2 bg-orange-200 -z-10 rounded-full"></span>
                                    </span>
                                </h1>

                                {/* Subtítulo Unificado */}
                                <p className="text-gray-600 text-lg max-w-md leading-relaxed mb-10">
                                    Encontre as melhores hospedagens, reserve seu carro e agende serviços de viagem exclusivos com praticidade, rapidez e total segurança.
                                </p>

                                {/* CTAs */}
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <a href="#servicos" className="w-full sm:w-auto bg-[#F26522] hover:bg-[#d95a1e] shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all text-white font-medium rounded-xl px-8 py-3.5 flex items-center justify-center gap-2 group">
                                        Explorar Ecossistema <HiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </a>
                                    <Link href={route('register')} className="w-full sm:w-auto bg-white border border-orange-200 text-orange-600 hover:bg-orange-50/50 transition font-medium rounded-xl px-8 py-3.5 flex items-center justify-center">
                                        Começar Agora
                                    </Link>
                                </div>

                            </div>
                        </main>
                    </div>

                    {/* --- BOTTOM GLASS BANNER --- */}
                    <div className="w-full px-6 md:px-12 pb-12 flex justify-center z-20">
                        <div className="w-full max-w-5xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4 w-full md:w-1/3">
                                <div className="p-3 bg-white/80 rounded-xl shadow-sm"><HiOutlineCalendar className="w-6 h-6 text-[#F26522]" /></div>
                                <div>
                                    <h4 className="font-bold text-gray-900">Cancelamento grátis</h4>
                                    <p className="text-sm text-gray-600">Na maioria das opções</p>
                                </div>
                            </div>
                            <div className="hidden md:block w-px h-10 bg-gray-300/60"></div>
                            <div className="flex items-center gap-4 w-full md:w-1/3">
                                <div className="p-3 bg-white/80 rounded-xl shadow-sm"><HiOutlineCurrencyDollar className="w-6 h-6 text-[#F26522]" /></div>
                                <div>
                                    <h4 className="font-bold text-gray-900">Sem taxas escondidas</h4>
                                    <p className="text-sm text-gray-600">Transparência sempre</p>
                                </div>
                            </div>
                            <div className="hidden md:block w-px h-10 bg-gray-300/60"></div>
                            <div className="flex items-center gap-4 w-full md:w-1/3">
                                <div className="p-3 bg-white/80 rounded-xl shadow-sm"><HiOutlineViewGrid className="w-6 h-6 text-[#F26522]" /></div>
                                <div>
                                    <h4 className="font-bold text-gray-900">Parceiros confiáveis</h4>
                                    <p className="text-sm text-gray-600">As melhores marcas do mercado</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= SEÇÃO 2: GRID DE SOLUÇÕES INTEGRADAS ================= */}
                <section id="servicos" className="relative z-20 bg-white py-24 px-6 md:px-12 border-t border-orange-100">
                    <div className="max-w-7xl mx-auto">
                        
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <span className="text-sm font-bold tracking-widest uppercase text-[#F26522]">Tudo em um só lugar</span>
                            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-2 tracking-tight">
                                Simplifique seu planejamento de ponta a ponta
                            </h2>
                        </div>

                        {/* Cards Grid Combinando Hotéis, Carros e Serviços */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            
                            {/* Card 1: Hotéis */}
                            <div id="hospedagens" className="group bg-[#FFF9F5] border border-orange-100 p-8 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-xl font-bold mb-6 group-hover:scale-110 transition">
                                        🏨
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Hospedagens & Hotéis</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Reserve quartos em hotéis renomados, resorts de luxo ou pousadas aconchegantes com tarifas exclusivas.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[#F26522] font-semibold text-sm mt-6 group-hover:gap-2 transition-all">
                                    Ver hotéis <HiArrowRight className="w-4 h-4" />
                                </span>
                            </div>

                            {/* Card 2: Carros */}
                            <div id="carros" className="group bg-[#FFF9F5] border border-orange-100 p-8 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-xl font-bold mb-6 group-hover:scale-110 transition">
                                        🚗
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Aluguel de Carros</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Garanta mobilidade total com veículos executivos, SUVs ou compactos econômicos prontos para retirada rápida.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[#F26522] font-semibold text-sm mt-6 group-hover:gap-2 transition-all">
                                    Reservar veículo <HiArrowRight className="w-4 h-4" />
                                </span>
                            </div>

                            {/* Card 3: Serviços */}
                            <div className="group bg-[#FFF9F5] border border-orange-100 p-8 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-xl font-bold mb-6 group-hover:scale-110 transition">
                                        ✨
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Serviços Premium</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Adicione experiências sob demanda: traslados privativos, guias locais, concierge e agendamentos de bem-estar.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[#F26522] font-semibold text-sm mt-6 group-hover:gap-2 transition-all">
                                    Explorar serviços <HiArrowRight className="w-4 h-4" />
                                </span>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ================= RODAPÉ ================= */}
                <footer className="bg-gray-900 text-gray-400 py-12 px-6 md:px-12 border-t border-gray-800 relative z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center md:items-start gap-2">
                            <div className="flex items-center gap-2">
                                <div className="bg-[#F26522] text-white font-black text-xl w-8 h-8 flex items-center justify-center rounded-lg">W</div>
                                <span className="text-lg font-bold text-white tracking-tight">Waitless</span>
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
                        <p className="text-sm text-center md:text-right">&copy; 2026 Waitless Tecnologia S.A. Todos os direitos reservados.</p>
                    </div>
                </footer>

            </div>
        </>
    );
}