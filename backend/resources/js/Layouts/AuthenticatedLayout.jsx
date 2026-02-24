import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { 
    HiHome, HiOfficeBuilding, HiUsers, HiCalendar, HiChartBar, HiLogout, HiMenu, HiCreditCard, HiClock, HiSearch, HiX
} from 'react-icons/hi';
import Dropdown from '@/Components/Dropdown';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    
    // Inicia FALSE para ficar escondido. Só abre se clicar nos 3 tracinhos
    const [menuAberto, setMenuAberto] = useState(false);

    const isAdmin = user.papel === 'proprietario' || user.papel === 'admin' || user.papel === 'gerente';

    const menuAdmin = [
        { nome: 'Dashboard', icone: <HiHome className="w-5 h-5" />, rota: 'dashboard', ativo: route().current('dashboard') },
        { nome: 'Meus Locais', icone: <HiOfficeBuilding className="w-5 h-5" />, rota: 'estabelecimentos.create', ativo: route().current('estabelecimentos.*') && !route().current('estabelecimentos.funcionarios') },
        { nome: 'Funcionários', icone: <HiUsers className="w-5 h-5" />, rota: 'funcionarios.index', ativo: route().current('funcionarios.*') },
        { nome: 'Atendimentos', icone: <HiCalendar className="w-5 h-5" />, rota: 'dashboard', ativo: false },
        { nome: 'Relatórios', icone: <HiChartBar className="w-5 h-5" />, rota: 'dashboard', ativo: false },
    ];

    const menuCliente = [
        { nome: 'Explorar Serviços', icone: <HiSearch className="w-5 h-5" />, rota: 'cliente.explorar', ativo: route().current('cliente.explorar') },
        { nome: 'Meus Agendamentos', icone: <HiClock className="w-5 h-5" />, rota: 'dashboard', ativo: route().current('dashboard') },
        { nome: 'Mensalidade e Planos', icone: <HiCreditCard className="w-5 h-5" />, rota: 'dashboard', ativo: false },
    ];

    const menuItems = isAdmin ? menuAdmin : menuCliente;

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
            
            {/* Overlay Escuro quando o menu estiver aberto (Mobile/Desktop) */}
            {menuAberto && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity" onClick={() => setMenuAberto(false)}></div>
            )}
            
            {/* SIDEBAR CLEAN (Branca com Ícones Escuros/Roxos) */}
            <aside className={`fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out shadow-xl ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
                
                <div className="p-5 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-sm">W</div>
                        <span className="text-xl font-bold tracking-tight text-gray-900">
                            {isAdmin ? 'WaitLess Pro' : 'WaitLess'}
                        </span>
                    </div>
                    {/* Botão de Fechar o Menu (X) */}
                    <button onClick={() => setMenuAberto(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition">
                        <HiX className="w-6 h-6" />
                    </button>
                </div>
                
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {menuItems.map((item, index) => (
                        <Link key={index} href={route(item.rota)} onClick={() => setMenuAberto(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${item.ativo ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                            {item.icone} {item.nome}
                        </Link>
                    ))}
                </nav>
                
                <div className="p-4 border-t border-gray-100">
                    <Link href={route('logout')} method="post" as="button" className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <HiLogout className="w-5 h-5" /> Sair
                    </Link>
                </div>
            </aside>

            {/* --- ÁREA PRINCIPAL --- */}
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto w-full">
                
                <header className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        {/* Botão Hambúrguer sempre visível */}
                        <button onClick={() => setMenuAberto(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <HiMenu className="w-6 h-6" />
                        </button>
                        
                        <div className="hidden sm:block">{header}</div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button className="flex items-center gap-3 focus:outline-none hover:bg-gray-50 p-1.5 rounded-xl transition border border-transparent hover:border-gray-200">
                                    <div className="text-right hidden md:block">
                                        <p className="text-sm font-bold text-gray-900 leading-tight">{user.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">{user.papel || 'Cliente'}</p>
                                    </div>
                                    <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold uppercase border border-indigo-200">
                                        {user.name.charAt(0)}
                                    </div>
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                                <Dropdown.Link href={route('profile.edit')}>Perfil</Dropdown.Link>
                                <Dropdown.Link href={route('logout')} method="post" as="button" className="text-red-600 font-bold">Sair</Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1 animate-in fade-in duration-500 bg-gray-50/50">
                    <div className="max-w-7xl mx-auto w-full">
                        <div className="sm:hidden mb-6">{header}</div>
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}