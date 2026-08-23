import { useState, useEffect } from 'react';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage, router } from '@inertiajs/react';
import { ShieldCheckIcon, UsersIcon, UserGroupIcon, MapIcon } from '@heroicons/react/24/solid';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    
    // O estado do Menu Lateral no PC agora usa localStorage para "lembrar" se estava fechado ou aberto
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem('waitless_sidebar_expanded');
            if (savedState !== null) {
                return JSON.parse(savedState);
            }
        }
        return true; // Padrão é aberto na primeira vez
    });

    // Salva no localStorage toda vez que o botão do hamburger for clicado
    useEffect(() => {
        localStorage.setItem('waitless_sidebar_expanded', JSON.stringify(isSidebarExpanded));
    }, [isSidebarExpanded]);
    
    // Controle extra para mobile (onde ele esconde a tela inteira em vez de recolher)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Identificadores de Papéis (Agora insensível a maiúsculas/minúsculas e acentos)
    const papelUsuario = String(user?.papel || '').toLowerCase();
    const isGestor = ['admin', 'socio', 'sócio', 'gerente', 'proprietario', 'proprietário'].includes(papelUsuario);
    const isAdminSupremo = papelUsuario === 'admin';
    const isFuncionario = ['funcionario', 'funcionário', 'atendente', 'profissional'].includes(papelUsuario);

    // Formata o nome do papel para ser exibido dinamicamente no Dropdown
    const getRoleLabel = (role) => {
        if (!role) return 'CLIENTE';
        const roleLower = String(role).toLowerCase();
        if (roleLower === 'admin') return 'ADMINISTRADOR';
        if (roleLower.includes('funcionar') || roleLower === 'atendente') return 'FUNCIONÁRIO';
        if (roleLower === 'gerente') return 'GERENTE';
        if (roleLower.includes('socio') || roleLower.includes('proprietar')) return 'PROPRIETÁRIO';
        if (roleLower === 'cliente') return 'CLIENTE';
        return role.toUpperCase();
    };

    // Fecha o menu mobile automaticamente ao mudar de página
    useEffect(() => {
        const removeListener = router.on('navigate', () => {
            setIsMobileMenuOpen(false);
        });
        return () => removeListener();
    }, []);

    // Trava rolagem só no mobile quando o menu está aberto
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isMobileMenuOpen]);

    // LÓGICA DE CLASSES CSS DINÂMICAS:
    const sidebarWidthClass = isSidebarExpanded ? "w-[280px]" : "w-[80px]";
    
    const textVisibilityClass = isSidebarExpanded 
        ? "opacity-100 translate-x-0 w-auto ml-3 delay-100 block" 
        : "opacity-0 -translate-x-4 w-0 ml-0 overflow-hidden hidden absolute"; 

    const baseLinkClass = `group flex items-center ${isSidebarExpanded ? 'px-4 justify-start' : 'px-0 justify-center'} py-3 mx-2 rounded-xl font-semibold transition-all duration-300 ease-out relative cursor-pointer`;
    
    // 👇 ESTA É A CLASSE QUE DEIXA BRANCO COM LETRA PRETA QUANDO ATIVO
    const activeLinkClass = "bg-white text-gray-900 shadow-lg scale-105";
    const inactiveLinkClass = "text-gray-900 hover:text-white hover:bg-white/20 hover:scale-105";

    // COMPONENTE DO TÍTULO DE SEÇÃO
    const SectionTitle = ({ title }) => (
        <div className={`pt-6 pb-2 w-full text-center transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 block' : 'opacity-0 h-0 hidden overflow-hidden'}`}>
            <span className="text-xs font-extrabold uppercase text-gray-900 tracking-widest inline-block">
                {title}
            </span>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans flex flex-col relative">
            
            {/* BACKDROP MOBILE */}
            <div
                onClick={() => setIsMobileMenuOpen(false)}
                className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-all duration-300 sm:hidden ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
            ></div>

            {/* === MENU LATERAL (SIDEBAR) === */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-[#FF5A00] shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${sidebarWidthClass} ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full'} sm:translate-x-0`}
            >
                {/* CABEÇALHO DO MENU LATERAL */}
                <div className={`flex items-center h-20 shrink-0 border-b border-orange-600 transition-all duration-300 ${isSidebarExpanded ? 'px-4 justify-between' : 'px-0 justify-center'}`}>
                    
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                        <span className="font-extrabold text-white tracking-tight text-3xl whitespace-nowrap ml-2">
                            Lokyva
                        </span>
                    </div>

                    <button
                        onClick={() => {
                            if (window.innerWidth < 640) {
                                setIsMobileMenuOpen(false);
                            } else {
                                setIsSidebarExpanded(!isSidebarExpanded);
                            }
                        }}
                        className="p-2 text-gray-900 hover:text-white hover:bg-white/20 rounded-lg transition focus:outline-none shrink-0"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>
                </div>
                
                {/* ÁREA DOS LINKS */}
                <div className="flex flex-col flex-1 overflow-y-auto space-y-2 pb-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    
                    {/* LINKS DE GESTORES (Dono da Loja, Gerente) */}
                    {isGestor && (
                        <>
                            <SectionTitle title="Admin Marketplace" />
                            
                            <Link href={route('dashboard')} title="Dashboard" className={`${baseLinkClass} ${route().current('dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Dashboard</span>
                            </Link>

                            <Link href={route('cliente.estornos')} title="Estornos" className={`${baseLinkClass} ${route().current('cliente.estornos') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                                </svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Meus Estornos</span>
                            </Link>

                            <Link href={route('estabelecimentos.index')} title="Estabelecimentos" className={`${baseLinkClass} ${route().current('estabelecimentos.index') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V10l-9-4-9 4v11m18 0h-4v-5H9v5H5m14 0H5"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Estabelecimentos</span>
                            </Link>

                            <Link href={route('mensagens.index')}  title="Agendamentos" className={`${baseLinkClass} ${route().current('mensagens.index') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Agendamentos | Histórico</span>
                            </Link>
{/* 👇 LINK DE RASTREAMENTO CORRIGIDO 👇 */}
                            <Link 
                                href={route('proprietario.rastreamento')} 
                                title="Rastreamento" 
                                className={`${baseLinkClass} ${route().current('proprietario.rastreamento') ? activeLinkClass : inactiveLinkClass}`}
                            >
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                                </svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Ver deslocamento</span>
                            </Link>

                            <Link href="#" title="Clientes" className={`${baseLinkClass} ${inactiveLinkClass}`}>
                                <UsersIcon className="w-6 h-6 shrink-0" />
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Clientes</span>
                            </Link>

                            <Link href={route('funcionarios.index')} title="Equipe" className={`${baseLinkClass} ${route().current('funcionarios.index') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Equipe</span>
                            </Link>

                            <Link href="/financeiro/conta" title="Financeiro" className={`${baseLinkClass} ${window.location.pathname.includes('/financeiro/conta') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Financeiro</span>
                            </Link>

                            <Link href="#" title="Promoções" className={`${baseLinkClass} ${inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Promoções</span>
                            </Link>

                            <Link href="#" title="Relatórios" className={`${baseLinkClass} ${inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Relatórios</span>
                            </Link>

                            <div className={`my-2 mx-4 border-t border-white/30 transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden'}`}></div>

                            <Link href="#" title="Suporte" className={`${baseLinkClass} ${inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2a8 8 0 00-8 8v4a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a10 10 0 0114 0h-1a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2v-4a8 8 0 00-8-8z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Suporte</span>
                            </Link>
                        </>
                    )}

                    {/* LINKS DE CLIENTES COMUNS */}
                    {!isGestor && !isFuncionario && (
                        <>
                            <SectionTitle title="Área do Cliente" />
                            
                            <Link href={route('home')} title="Home" className={`${baseLinkClass} ${route().current('home') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Home</span>
                            </Link>

                            <Link href={route('cliente.explorar')} title="Explorar Lojas" className={`${baseLinkClass} ${route().current('cliente.explorar') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Explorar Lojas</span>
                            </Link>

                            {/* 👇 NOVO BOTÃO: MEUS FAVORITOS 👇 
                            <Link href={route('cliente.favoritos')} title="Meus Favoritos" className={`${baseLinkClass} ${route().current('cliente.favoritos') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Meus Favoritos</span>
                            </Link>*/}
                            
                            <Link href={route('cliente.carrinho')} title="Carrinho" className={`${baseLinkClass} ${route().current('cliente.carrinho') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Carrinho / Pendentes</span>
                            </Link>

                            <Link href={route('dashboard')} title="Agendamentos" className={`${baseLinkClass} ${route().current('dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Agendamentos</span>
                            </Link>

                            <Link href={route('travel-assistant.index')} title="Assistente de Viagens" className={`${baseLinkClass} ${route().current('travel-assistant.index') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                                </svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>
                                    Assistente de Viagens
                                </span>
                            </Link>

                            <Link href={route('cliente.estornos')} title="Estornos" className={`${baseLinkClass} ${route().current('cliente.estornos') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                                </svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Meus Estornos</span>
                            </Link>
                            
                            <Link href={route('cliente.carteira')} title="Carteira" className={`${baseLinkClass} ${route().current('cliente.carteira') ? activeLinkClass : inactiveLinkClass}`}>
                               <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                               <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Minha Carteira (Plus)</span>
                            </Link>
                            
                            <Link href="/financeiro/conta" title="Conta" className={`${baseLinkClass} ${window.location.pathname.includes('/financeiro/conta') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Conta (Recebimentos)</span>
                            </Link>
                        </>
                    )}

                    {/* LINKS DE FUNCIONÁRIOS */}
                    {isFuncionario && (
                        <>
                            <SectionTitle title="Área do Profissional" />
                            
                            <Link href={route('funcionario.dashboard')} title="Meu Turno" className={`${baseLinkClass} ${route().current('funcionario.dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Meu Turno (Operação)</span>
                            </Link>
                            
                            <Link href={route('funcionario.carteira')} title="Produção" className={`${baseLinkClass} ${route().current('funcionario.carteira') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Minha Produção</span>
                            </Link>
                            
                            <Link href={route('funcionario.catalogo')} title="Catálogo" className={`${baseLinkClass} ${route().current('funcionario.catalogo') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Catálogo de Serviços</span>
                            </Link>
                            
                            <Link href={route('funcionario.ausencias')} title="Ausências" className={`${baseLinkClass} ${route().current('funcionario.ausencias') ? activeLinkClass : inactiveLinkClass}`}>
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Faltas e Ausências</span>
                            </Link>
                        </>
                    )}

                    {/* LINKS EXCLUSIVOS DO ADMIN SUPREMO */}
                    {isAdminSupremo && (
                        <>
                            <SectionTitle title="Administração" />

                            <Link href={route('admin.assinaturas.index')} title="Assinaturas Gerais" className={`${baseLinkClass} ${route().current('admin.assinaturas.index') ? activeLinkClass : inactiveLinkClass}`}>
                                <ShieldCheckIcon className="w-6 h-6 shrink-0" />
                                <span className={`transition-all duration-300 whitespace-nowrap ${textVisibilityClass}`}>Todas as Assinaturas</span>
                            </Link>
                        </>
                    )}
                </div>
            </aside>

            {/* CONTAINER PRINCIPAL */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out sm:ml-[${isSidebarExpanded ? '280px' : '80px'}]`}
                 style={{ marginLeft: window.innerWidth >= 640 ? (isSidebarExpanded ? '280px' : '80px') : '0px' }}>
                
                {/* --- Navbar Superior --- */}
                <nav className="sticky top-0 z-30 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md dark:border-gray-700 dark:bg-gray-800/90 transition-colors duration-300">
                    <div className="mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex h-16 justify-between items-center">
                            
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="p-2 -ml-2 text-gray-900 hover:bg-gray-100 rounded-lg transition focus:outline-none sm:hidden"
                                >
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"></path>
                                    </svg>
                                </button>
                                
                                <div className="sm:hidden font-extrabold text-gray-800 dark:text-gray-200 text-xl">
                                    Lokyva
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
                                {!isGestor && !isFuncionario && (
                                    <Link href={route('cliente.carrinho')} className="relative p-2 text-gray-500 hover:text-indigo-600 transition rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                        </span>
                                    </Link>
                                )}

                                {/* Sino de Notificação */}
                                <button className="relative p-2 text-[#4F5B67] hover:text-gray-900 transition rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#9A423D]"></span>
                                    </span>
                                </button>

                                {/* Divisória Vertical (Só no PC) */}
                                <div className="h-8 w-[1px] bg-gray-300 dark:bg-gray-600 hidden sm:block mx-1"></div>

                                {/* Menu Dropdown do Usuário */}
                                <div className="relative">
                                    <Dropdown>
                                        <Dropdown.Trigger>
                                            <button type="button" className="flex items-center gap-2 focus:outline-none hover:opacity-80 transition-opacity">
                                                
                                                {/* VISUAL DESKTOP: Nome e Foto */}
                                                <div className="hidden sm:flex items-center gap-3">
                                                    <div className="text-right flex flex-col justify-center">
                                                        <span className="text-[15px] font-bold text-[#202B36] dark:text-gray-200 leading-tight">
                                                            {user.name}
                                                        </span>
                                                        <span className="text-[11px] font-semibold text-[#637381] dark:text-gray-400 uppercase tracking-widest">
                                                            {getRoleLabel(user.papel)}
                                                        </span>
                                                    </div>
                                                    <div className="h-[42px] w-[42px] rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-700 font-bold uppercase text-sm overflow-hidden shadow-sm">
                                                        {user.foto_perfil ? <img src={user.foto_perfil} alt={user.name} className="h-full w-full object-cover" /> : user.name.charAt(0)}
                                                    </div>
                                                </div>

                                                {/* VISUAL MOBILE: Três Pontinhos */}
                                                <div className="sm:hidden p-2 text-[#4F5B67] hover:text-gray-900 transition rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                                                    </svg>
                                                </div>

                                            </button>
                                        </Dropdown.Trigger>

                                        {/* Conteúdo do Dropdown */}
                                        <Dropdown.Content align="right" width="48" contentClasses="!bg-[#FCFAF8] !border !border-[#DCD5CF] shadow-xl rounded-xl mt-3 pb-1 pt-1 z-50">
                                            
                                            {/* Info de Usuário no Mobile */}
                                            <div className="block sm:hidden px-4 py-3 border-b border-[#EAE3DE] mb-1">
                                                <p className="text-sm font-bold text-[#202B36]">{user.name}</p>
                                                <p className="text-xs font-semibold text-[#637381] uppercase mt-0.5">{getRoleLabel(user.papel)}</p>
                                            </div>

                                            {/* Meus Planos */}
                                            <Dropdown.Link href="#" className="hover:bg-[#f3ede8] transition-colors duration-150">
                                                <div className="flex items-center gap-3 font-semibold text-[#202B36] py-1">
                                                    <svg className="w-[22px] h-[22px] text-[#1E5F42]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                    Meus Planos
                                                </div>
                                            </Dropdown.Link>
                                            
                                            {/* Editar Perfil */}
                                            <Dropdown.Link href={route('profile.edit')} className="hover:bg-[#f3ede8] transition-colors duration-150">
                                                <div className="flex items-center gap-3 font-semibold text-[#202B36] py-1">
                                                    <svg className="w-[22px] h-[22px] text-[#4F5B67]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Editar Perfil
                                                </div>
                                            </Dropdown.Link>
                                            
                                            {/* Divisória Interna Suave */}
                                            <div className="border-t border-[#EAE3DE] my-1.5 mx-2"></div>
                                            
                                            {/* Sair */}
                                            <Dropdown.Link href={route('logout')} method="post" as="button" className="w-full text-left hover:bg-[#f3ede8] transition-colors duration-150">
                                                <div className="flex items-center gap-3 font-semibold text-[#9A423D] py-1">
                                                    <svg className="w-[22px] h-[22px] text-[#9A423D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                    </svg>
                                                    Sair
                                                </div>
                                            </Dropdown.Link>
                                            
                                        </Dropdown.Content>
                                    </Dropdown>
                                </div>

                            </div>
                        </div>
                    </div>
                </nav>

                {header && (
                    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
                        <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
                            {header}
                        </div>
                    </header>
                )}

                <main className="flex-1 py-8 animate-in fade-in duration-500">
                    <div className="mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}