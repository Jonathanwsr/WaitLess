import { useState, useEffect } from 'react';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage, router } from '@inertiajs/react';
import { ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/solid'; // Importando ícones úteis

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    
    // Controla a abertura e fecho do menu lateral
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Identifica se é dono de loja/admin ou cliente (Gestores em geral)
    const isGestor = ['admin', 'socio', 'gerente'].includes(user?.papel);
    
    // 👉 NOVA CONSTANTE: Identifica se é EXCLUSIVAMENTE o Admin do sistema
    const isAdminSupremo = user?.papel === 'admin';

    // Fecha o menu automaticamente quando a rota muda
    useEffect(() => {
        const removeListener = router.on('navigate', () => {
            setIsSidebarOpen(false);
        });
        return () => removeListener();
    }, []);

    // Bloqueia o scroll da página quando o menu mobile está aberto
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isSidebarOpen]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans flex flex-col relative">
            
            {/* BACKDROP (Fundo escuro ao abrir o menu) */}
            <div 
                onClick={() => setIsSidebarOpen(false)} 
                className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
            ></div>

            {/* MENU LATERAL RETRÁTIL (GAVETA) */}
            <aside 
                className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Cabeçalho do Menu Lateral */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            W
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 tracking-tight text-lg">
                            WaitLess
                        </span>
                    </div>
                    {/* Botão Fechar */}
                    <button 
                        onClick={() => setIsSidebarOpen(false)} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition focus:outline-none"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                {/* Links do Menu */}
                <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-2">
                    
                    <Link 
                        href={route('dashboard')} 
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('dashboard') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        Painel Geral
                    </Link>

                    {/* 👉 LINKS DE CLIENTES COMUNS */}
                    {!isGestor && (
                        <>
                            <Link 
                                href={route('cliente.explorar')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('cliente.explorar') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                Explorar Lojas
                            </Link>
                            <Link 
                                href={route('cliente.carrinho')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('cliente.carrinho') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                Carrinho / Pendentes
                            </Link>

                            <Link 
                                href={route('cliente.carteira')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('cliente.carteira') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                               Minha Carteira (Plus)
                            </Link>
                        </>
                    )}

                    {/* 👉 LINKS DE GESTORES (Dono da Loja, Gerente) */}
                    {isGestor && (
                        <>
                            <div className="pt-4 pb-2">
                                <p className="px-4 text-[10px] font-bold uppercase text-gray-400">Gestão da Loja</p>
                            </div>
                            <Link 
                                href={route('dashboard')} 
                                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                Minhas Lojas
                            </Link>

                            {/* TELA DE FUNCIONÁRIOS DE VOLTA! */}
                            <Link 
                                href={route('funcionarios.index')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('funcionarios.index') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                            >
                                <UsersIcon className="w-5 h-5" />
                                Equipe / Funcionários
                            </Link>

                            <Link 
                                href="#" 
                                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Extrato Financeiro
                            </Link>
                            <Link 
                                href={route('cliente.carteira')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${route().current('cliente.carteira') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                                Planos e Assinaturas
                            </Link>
                        </>
                    )}

                    {/* 👉 LINKS EXCLUSIVOS DO ADMIN SUPREMO (O DONO DA PLATAFORMA) */}
                    {isAdminSupremo && (
                        <>
                            <div className="pt-4 pb-2">
                                <p className="px-4 text-[10px] font-bold uppercase text-red-400">Administração</p>
                            </div>
                            <Link 
                                href={route('admin.assinaturas.index')} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${route().current('admin.assinaturas.index') ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <ShieldCheckIcon className="w-5 h-5 text-red-500" />
                                Todas as Assinaturas
                            </Link>
                        </>
                    )}

                </div>

                {/* Área de Perfil no Fundo do Menu (Ótimo para Mobile) */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase overflow-hidden shrink-0">
                            {user.foto_perfil ? <img src={user.foto_perfil} alt={user.name} className="h-full w-full object-cover" /> : user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href={route('profile.edit')} className="flex-1 text-center py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Perfil</Link>
                        <Link href={route('logout')} method="post" as="button" className="flex-1 text-center py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">Sair</Link>
                    </div>
                </div>
            </aside>

            {/* CONTAINER PRINCIPAL (TELA INTEIRA) */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* --- Navbar Principal (Sticky + Glass Effect) --- */}
                <nav className="sticky top-0 z-30 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md dark:border-gray-700 dark:bg-gray-800/90 transition-colors duration-300">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="flex h-16 justify-between items-center">
                            
                            {/* Lado Esquerdo: Menu Hamburguer + Logo */}
                            <div className="flex items-center gap-3 sm:gap-6">
                                {/* Botão Hambúrguer (Abre o Menu Lateral) */}
                                <button 
                                    onClick={() => setIsSidebarOpen(true)} 
                                    className="p-2 -ml-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition focus:outline-none"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                                </button>

                                {/* Logo */}
                                <div className="flex shrink-0 items-center">
                                    <Link href="/" className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                            W
                                        </div>
                                        <span className="hidden sm:block font-bold text-gray-800 dark:text-gray-200 tracking-tight text-lg">
                                            WaitLess
                                        </span>
                                    </Link>
                                </div>
                            </div>

                            {/* Lado Direito: Carrinho e Perfil Rápido (Desktop) */}
                            <div className="flex items-center gap-2 sm:gap-4">
                                
                                {/* Carrinho Rápido na Navbar */}
                                {!isGestor && (
                                    <Link href={route('cliente.carrinho')} className="relative p-2 text-gray-500 hover:text-indigo-600 transition rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {/* Bolinha vermelha de notificação */}
                                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                        </span>
                                    </Link>
                                )}

                                {/* Dropdown de Perfil Rápido */}
                                <div className="hidden sm:block relative">
                                    <Dropdown>
                                        <Dropdown.Trigger>
                                            <span className="inline-flex rounded-md">
                                                <button type="button" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm font-medium leading-4 text-gray-700 transition duration-150 ease-in-out hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase text-xs overflow-hidden">
                                                        {user.foto_perfil ? <img src={user.foto_perfil} alt={user.name} className="h-full w-full object-cover" /> : user.name.charAt(0)}
                                                    </div>
                                                    <span className="max-w-[100px] truncate">{user.name}</span>
                                                    <svg className="-me-0.5 ms-1 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </span>
                                        </Dropdown.Trigger>
                                        <Dropdown.Content width="48">
                                            <div className="px-4 py-3 text-sm text-gray-500 border-b border-gray-100 mb-1">
                                                <p>Logado como</p>
                                                <p className="font-medium text-gray-900 truncate">{user.email}</p>
                                            </div>
                                            <Dropdown.Link href={route('profile.edit')}>Perfil</Dropdown.Link>
                                            <Dropdown.Link href={route('logout')} method="post" as="button" className="text-red-600">Sair</Dropdown.Link>
                                        </Dropdown.Content>
                                    </Dropdown>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </nav>

                {header && (
                    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
                        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                            {header}
                        </div>
                    </header>
                )}

                <main className="flex-1 py-8 animate-in fade-in duration-500">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}