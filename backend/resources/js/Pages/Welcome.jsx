import { Link, Head } from '@inertiajs/react';
import { 
    HiSearch, HiLocationMarker, HiShoppingBag, 
    HiLightningBolt, HiCheckCircle, HiTag, HiStar,
    HiSparkles, HiTruck, HiCog, HiUser,
    HiHeart, HiViewGrid, HiClock, HiBadgeCheck,
    HiSupport
} from 'react-icons/hi';

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="WaitLess - O seu marketplace de serviços" />
            
            <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-emerald-500 selection:text-white pb-20 overflow-x-hidden">
                
                {/* --- NAVBAR --- */}
                <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto relative z-30">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img 
                            src="/images/logo-waitlles.jpeg.png" 
                            alt="Logo WaitLess" 
                            className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover shadow-sm"
                            onError={(e) => {
                                e.target.outerHTML = '<div class="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xl">W</div>'
                            }}
                        />
                        <div className="hidden md:flex flex-col leading-none">
                            <span className="text-xl font-black text-emerald-500 tracking-tighter uppercase">WAITLESS</span>
                            <span className="text-[9px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-0.5">Marketplace</span>
                        </div>
                    </div>

                    {/* Links Centrais */}
                    <div className="hidden lg:flex items-center gap-8">
                        <a href="#" className="text-emerald-500 font-bold text-sm border-b-2 border-emerald-500 pb-1">Encontre serviços</a>
                        <a href="#" className="text-gray-500 font-medium text-sm hover:text-emerald-500 transition">Como funciona</a>
                        <a href="#" className="text-gray-500 font-medium text-sm hover:text-emerald-500 transition">Para prestadores</a>
                        <a href="#" className="text-gray-500 font-medium text-sm hover:text-emerald-500 transition">Sobre nós</a>
                    </div>

                    {/* Botões da Direita */}
                    <div className="flex items-center gap-4 md:gap-6">
                        <button className="text-gray-800 hover:text-emerald-500 transition">
                            <HiShoppingBag className="w-6 h-6" />
                        </button>
                        
                        {auth?.user ? (
                            <Link href={route('dashboard')} className="font-bold text-gray-800 text-sm hover:text-emerald-500 transition">
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href={route('login')} className="font-bold text-gray-800 text-sm hover:text-emerald-500 transition hidden sm:block">
                                    Login
                                </Link>
                                {canRegister && (
                                    <Link href={route('register')} className="bg-emerald-500 hover:bg-emerald-600 transition text-white px-6 py-2 md:py-2.5 rounded-full font-bold text-xs md:text-sm shadow-md whitespace-nowrap">
                                        Sign up
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                </nav>

                {/* --- HERO SECTION --- */}
                <main className="max-w-7xl mx-auto px-6 md:px-12 pt-6 md:pt-10 pb-16 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    
                    {/* Esquerda: Texto e Pesquisa */}
                    <div className="z-10 relative">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight text-center lg:text-left">
                            Serviços rápidos,<br/>
                            <span className="text-emerald-500">em um só lugar..</span>
                        </h1>
                        <p className="mt-4 md:mt-6 text-gray-500 text-base md:text-xl max-w-md mx-auto lg:mx-0 leading-relaxed font-medium text-center lg:text-left">
                            Encontre profissionais de confiança para qualquer serviço que você precise. Agende em minutos .
                        </p>

                        {/* Barra de Pesquisa */}
                        <div className="mt-8 md:mt-10 bg-white rounded-[2rem] md:rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 p-2 flex flex-col md:flex-row items-center gap-2 max-w-2xl mx-auto lg:mx-0">
                            <div className="flex-1 flex items-center gap-3 px-4 border-b md:border-b-0 md:border-r border-gray-100 py-3 w-full">
                                <HiSearch className="w-5 h-5 text-gray-400 shrink-0" />
                                <input 
                                    type="text" 
                                    placeholder="De que serviço você precisa?" 
                                    className="w-full border-0 focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 p-0" 
                                />
                            </div>
                            <div className="flex-1 flex items-center gap-3 px-4 py-3 w-full">
                                <HiLocationMarker className="w-5 h-5 text-gray-400 shrink-0" />
                                <input 
                                    type="text" 
                                    placeholder="Sua localização" 
                                    className="w-full border-0 focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 p-0" 
                                />
                            </div>
                            <button className="bg-emerald-500 hover:bg-emerald-600 transition text-white font-bold rounded-full px-8 py-3.5 md:py-4 w-full md:w-auto text-sm shadow-md mt-2 md:mt-0">
                                Procurar
                            </button>
                        </div>

                        {/* Badges de Confiança */}
                        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl mx-auto lg:mx-0">
                            <div className="flex items-center sm:items-start gap-3 justify-center sm:justify-start">
                                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <HiLightningBolt className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-500" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm sm:text-xs font-black text-gray-900">Rápido e fácil</h4>
                                    <p className="text-xs sm:text-[10px] text-gray-400 font-medium leading-tight mt-0.5">Book in<br className="hidden sm:block"/>minutes</p>
                                </div>
                            </div>
                            <div className="flex items-center sm:items-start gap-3 justify-center sm:justify-start">
                                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <HiCheckCircle className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-500" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm sm:text-xs font-black text-gray-900">Profissionais confiáveis</h4>
                                    <p className="text-xs sm:text-[10px] text-gray-400 font-medium leading-tight mt-0.5">Verificado e<br className="hidden sm:block"/>avaliado</p>
                                </div>
                            </div>
                            <div className="flex items-center sm:items-start gap-3 justify-center sm:justify-start">
                                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <HiTag className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-500" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm sm:text-xs font-black text-gray-900">Melhores preços</h4>
                                    <p className="text-xs sm:text-[10px] text-gray-400 font-medium leading-tight mt-0.5">Ofertas com 60% Off*</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Direita: Imagem e Cartões Flutuantes (Responsivo usando scale) */}
                    <div className="relative w-full h-[350px] sm:h-[450px] lg:h-[550px] mt-8 lg:mt-0 flex justify-center lg:block overflow-visible">
                        
                        {/* Wrapper de Escala para Mobile */}
                        <div className="absolute top-0 transform scale-[0.65] sm:scale-[0.8] lg:scale-100 origin-top flex justify-center w-full z-0">
                            
                            <div className="relative w-[480px] h-[550px]">
                                {/* Fundo Verde Abstrato */}
                                <div className="absolute right-[-15%] top-[-5%] w-[40rem] h-[40rem] bg-emerald-50 rounded-full -z-10"></div>
                                
                                {/* Imagem Principal */}
                                <div className="absolute right-0 lg:right-10 top-10 w-[480px] h-[380px] rounded-[2.5rem] overflow-hidden shadow-2xl z-0">
                                    <img 
                                        src="/images/Mulher-no-celular-png.png" 
                                        alt="Mulher usando celular" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Cartões Flutuantes */}
                                {/* 1. Clínicas */}
                                <div className="absolute top-0 left-[-2rem] lg:left-0 bg-white p-2.5 rounded-2xl shadow-xl flex items-center gap-3 pr-6 z-10 animate-bounce-slow">
                                    <img src="/images/Clinica.png" className="w-12 h-12 rounded-xl object-cover" alt="Clínicas" />
                                    <div>
                                        <p className="text-sm font-black text-gray-900 leading-none">Clínicas</p>
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium">Por R$ 250</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                            <span className="text-[10px] font-bold text-gray-700">4.9</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Corte de Cabelo */}
                                <div className="absolute top-16 right-[-2rem] bg-white p-2.5 rounded-2xl shadow-xl flex items-center gap-3 pr-6 z-10 animate-bounce-slow" style={{ animationDelay: '1s' }}>
                                    <img src="/images/Corte-de-cabelo.png" className="w-12 h-12 rounded-xl object-cover" alt="Corte de cabelo" />
                                    <div>
                                        <p className="text-sm font-black text-gray-900 leading-none">Corte de cabelo</p>
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium">A partir de R$ 20</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                            <span className="text-[10px] font-bold text-gray-700">4.9</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Encanador */}
                                <div className="absolute bottom-44 left-[-3rem] lg:left-[-2rem] bg-white p-2.5 rounded-2xl shadow-xl flex items-center gap-3 pr-6 z-10 animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
                                    <img src="/images/Encanador.png" className="w-12 h-12 rounded-xl object-cover" alt="Encanador" />
                                    <div>
                                        <p className="text-sm font-black text-gray-900 leading-none">Encanador</p>
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium">Por R$ 50</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                            <span className="text-[10px] font-bold text-gray-700">4.8</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Eletricista */}
                                <div className="absolute bottom-4 right-0 lg:right-2 bg-white p-2.5 rounded-2xl shadow-xl flex items-center gap-3 pr-6 z-10 animate-bounce-slow" style={{ animationDelay: '1.5s' }}>
                                    <img src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=100&h=100&q=80" className="w-12 h-12 rounded-xl object-cover" alt="Eletricista" />
                                    <div>
                                        <p className="text-sm font-black text-gray-900 leading-none">Eletricista</p>
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium">A partir de R$ 100</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                            <span className="text-[10px] font-bold text-gray-700">4.9</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bolha Verde "100+ SERVIÇOS" */}
                                <div className="absolute bottom-[4.5rem] left-[5%] lg:left-[10%] bg-emerald-500 rounded-full w-24 h-24 flex items-center justify-center shadow-xl border-4 border-white z-20">
                                    <span className="text-white font-black text-center text-xs leading-tight uppercase">100+<br/>Serviços</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* --- SERVIÇOS POPULARES --- */}
                <section className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16">
                    <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 mb-8 md:mb-10">
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight text-center sm:text-left">Serviços populares</h2>
                        <a href="#" className="text-emerald-500 font-bold hover:text-emerald-600 transition flex items-center gap-1">
                            Ver todos os serviços <span className="text-lg leading-none">&rsaquo;</span>
                        </a>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
                        {/* Card 1 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiSparkles className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Limpeza</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">CASA, ESCRITÓRIO,<br/>LIMPEZA PREDIAL,<br/>CARRO</p>
                        </div>
                        
                        {/* Card 2 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiSupport className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Encanamento</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">CONSERTAR,<br/>INSTALAR, REPARAR</p>
                        </div>

                        {/* Card 3 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiLightningBolt className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Elétricos</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">INSTALAÇÃO E<br/>REPAROS</p>
                        </div>

                        {/* Card 4 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiUser className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Cabelo e beleza</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">SALÃO, CORTE<br/>DE CABELO,<br/>MAQUIAGEM</p>
                        </div>

                        {/* Card 5 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiTruck className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Mudanças</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">CASA, ESCRITÓRIO,<br/>ENTREGA</p>
                        </div>

                        {/* Card 6 */}
                        <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-4 md:p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 md:mb-5">
                                <HiCog className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm md:text-[15px] mb-1.5">Faz-tudo</h4>
                            <p className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-widest leading-relaxed">REPAROS, INSTALAÇÃO,<br/>CONSERTOS</p>
                        </div>
                    </div>
                </section>

                {/* --- BOTTOM GREEN BANNER --- */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-10">
                    <div className="bg-emerald-50 rounded-3xl md:rounded-[2.5rem] p-6 sm:p-8 lg:p-12 flex flex-col xl:flex-row items-center justify-between gap-8 lg:gap-10 shadow-sm border border-emerald-100">
                        
                        {/* Esquerda */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 max-w-lg">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/30">
                                <HiHeart className="w-7 h-7 sm:w-8 sm:h-8" />
                            </div>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-tight">
                                Todos os serviços que você precisa, exatamente quando você precisa deles.
                            </h3>
                        </div>

                        {/* Direita */}
                        <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start text-center sm:text-left gap-6 lg:gap-12 w-full xl:w-auto mt-4 xl:mt-0">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3">
                                <HiViewGrid className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-black text-gray-900 text-sm">Um lugar</h4>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wide">Tudo em um aplicativo</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3">
                                <HiClock className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-black text-gray-900 text-sm">Economize tempo</h4>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wide">Reserva rápida</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3">
                                <HiBadgeCheck className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-black text-gray-900 text-sm">Profissionais confiáveis</h4>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wide">Qualidade em que você pode confiar</p>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                </section>

                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes bounce-slow {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-10px); }
                    }
                    .animate-bounce-slow {
                        animation: bounce-slow 4s ease-in-out infinite;
                    }
                `}} />

            </div>
        </>
    );
}