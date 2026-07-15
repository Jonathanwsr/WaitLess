import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { 
    UsersIcon, 
    CurrencyDollarIcon, 
    BuildingOfficeIcon, 
    PlusIcon, 
    StarIcon, 
    UserGroupIcon, 
    Cog6ToothIcon, 
    EllipsisVerticalIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChartBarIcon,
    CreditCardIcon,
    WalletIcon, 
    BanknotesIcon, 
    CommandLineIcon // <-- Ícone adicionado para o Painel Admin Master
} from '@heroicons/react/24/outline'; 

export default function Dashboard({ auth, estabelecimentos = [], metricas = {} }) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Visão Geral
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Acompanhe o desempenho dos seus estabelecimentos e resultados.
                    </p>
                </div>
            }
        >
            <Head title="Dashboard - WaitLess" />

            {/* Container Principal com a cor de fundo customizada FBF9F9 */}
            <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen -m-4 sm:-m-8 p-4 sm:p-8 space-y-8 animate-fadeIn">
                
                {/* --- SEÇÃO 1: Métricas Principais (4 Colunas) --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Card 1: Pessoas na fila */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">Pessoas na fila</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white my-0.5 truncate">
                                {metricas.total_fila || 0}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Em espera agora</p>
                        </div>
                    </div>

                    {/* Card 2: Faturamento */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                            <CurrencyDollarIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">Faturamento (Este mês)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white my-0.5 truncate">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricas.total_arrecadado || 0)}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Este mês</p>
                        </div>
                    </div>

                    {/* Card 3: Locais ativos */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                            <BuildingOfficeIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">Locais ativos</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white my-0.5 truncate">
                                {metricas.ativos || 0}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Estabelecimentos</p>
                        </div>
                    </div>

                    {/* Card 4: Lucro financeiro */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                            <ChartBarIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">Lucro financeiro (Este mês)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white my-0.5 truncate">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricas.lucro_liquido || 0)}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Lucro líquido</p>
                        </div>
                    </div>
                </div>

                {/* --- SEÇÃO 2: Cabeçalho da Listagem --- */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Meus Estabelecimentos
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        
                        {/* 👉 BOTÃO CONDICIONAL: APARECE APENAS SE FOR ADMIN */}
                        {(auth?.user?.papel === 'admin' || auth?.user?.role === 'admin') && (
                            <Link 
                                href={route('admin.financeiro.index')} 
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 border border-transparent text-sm font-semibold text-white rounded-xl hover:bg-indigo-700 transition shadow-sm"
                            >
                                <CommandLineIcon className="w-4 h-4 text-indigo-200" />
                                Painel Master
                            </Link>
                        )}

                        <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm">
                            <UserGroupIcon className="w-4 h-4 text-gray-500" />
                            Equipe
                        </button>

                        <Link 
                            href="/financeiro/conta" 
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
                        >
                            <CreditCardIcon className="w-4 h-4 text-gray-500" />
                            Contas
                        </Link>

                        <Link 
                            href="/carteira" 
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
                        >
                            <WalletIcon className="w-4 h-4 text-gray-500" />
                            Carteira
                        </Link>

                        <Link 
                            href={route('provider.financeiro')} 
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
                        >
                            <BanknotesIcon className="w-4 h-4 text-emerald-600" />
                            Extrato Geral
                        </Link>

                        <Link 
                            href={route('estabelecimentos.create')}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#006837] text-white text-sm font-semibold rounded-xl hover:bg-[#00522b] transition shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4 stroke-[3]" />
                            Novo Local
                        </Link>
                    </div>
                </div>

                {/* --- SEÇÃO 3: Grid de Estabelecimentos --- */}
                {estabelecimentos.length === 0 ? (
                    /* EMPTY STATE */
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 text-center py-16 px-4 shadow-sm">
                        <BuildingOfficeIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum estabelecimento encontrado</h4>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6 text-sm leading-relaxed">
                            Parece que você ainda não cadastrou nenhuma clínica, barbearia ou loja. Comece agora para gerenciar suas filas.
                        </p>
                        <Link 
                            href={route('estabelecimentos.create')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition shadow-md"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Criar Meu Primeiro Estabelecimento
                        </Link>
                    </div>
                ) : (
                    /* CARDS LIST */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {estabelecimentos.map((local) => (
                            <div 
                                key={local.id} 
                                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                            >
                                <div>
                                    {/* Topo do Card: Info Principal e Menu */}
                                    <div className="flex items-start justify-between gap-4 mb-5">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {/* Avatar/Logo com Letra Inicial */}
                                            <div className="w-12 h-12 shrink-0 rounded-xl bg-[#F8F9FA] dark:bg-gray-700 flex items-center justify-center border border-gray-100 dark:border-gray-600 shadow-xs">
                                                {local.foto_perfil ? (
                                                    <img 
                                                        src={local.foto_perfil} 
                                                        alt={`Logo ${local.nome}`} 
                                                        className="w-full h-full object-cover rounded-xl"
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300 uppercase">
                                                        {local.nome.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-base truncate mb-0.5">
                                                    {local.nome}
                                                </h4>
                                                
                                                {/* Avaliação e Total de Funcionários */}
                                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                                    <div className="text-amber-500 flex items-center gap-0.5 font-semibold">
                                                        <StarIcon className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> 
                                                        {Number(local.avaliacao_media || 0).toFixed(2)}
                                                    </div>
                                                    <span>•</span>
                                                    <div className="flex items-center gap-1">
                                                        <UserGroupIcon className="w-3.5 h-3.5" />
                                                        {local.funcionarios_count || 0} Equipe
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Dot e Menu Dropdown */}
                                        <div className="flex items-center gap-2 shrink-0 pt-1">
                                            <span 
                                                className={`h-2.5 w-2.5 rounded-full ${local.ativo ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                                title={local.ativo ? "Aberto" : "Fechado"}
                                            />
                                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                                                <EllipsisVerticalIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Container Fila Atual */}
                                    <div className="bg-[#F8F9FA] dark:bg-gray-900/60 rounded-xl p-4 flex justify-between items-center mb-5 border border-gray-50/50 dark:border-gray-800">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Na fila agora:
                                        </span>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {local.fila_agora || 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Botões de Ação do Card (3 botões perfeitamente alinhados) */}
                                <div className="grid grid-cols-3 gap-2">
                                    <Link 
                                        href={route('estabelecimentos.fila', local.id)} 
                                        className="flex flex-col items-center justify-center py-2 px-1 bg-[#F8F9FA] dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition border border-transparent"
                                    >
                                        <UserGroupIcon className="w-5 h-5 text-gray-900 dark:text-gray-300 mb-1" />
                                        <span className="text-[11px] font-bold text-gray-900 dark:text-gray-300">Ver fila</span>
                                    </Link>

                                    <Link 
                                        href={route('estabelecimentos.agenda-equipe', local.id)} 
                                        className="flex flex-col items-center justify-center py-2 px-1 bg-[#F8F9FA] dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition border border-transparent"
                                    >
                                        <UserGroupIcon className="w-5 h-5 text-gray-900 dark:text-gray-300 mb-1" />
                                        <span className="text-[11px] font-bold text-gray-900 dark:text-gray-300">Equipe</span>
                                    </Link>

                                    <Link 
                                        href={route('estabelecimentos.configuracoes', local.id)} 
                                        className="flex flex-col items-center justify-center py-2 px-1 bg-[#F8F9FA] dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition border border-transparent"
                                    >
                                        <Cog6ToothIcon className="w-5 h-5 text-gray-900 dark:text-gray-300 mb-1" />
                                        <span className="text-[11px] font-bold text-gray-900 dark:text-gray-300">Configurações</span>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- SEÇÃO 4: Componente de Paginação --- */}
                {estabelecimentos.length > 0 && (
                    <div className="flex items-center justify-center gap-1.5 pt-6 pb-4">
                        <button className="w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 transition shadow-xs">
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        
                        <button className="w-9 h-9 flex items-center justify-center bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-sm rounded-lg transition shadow-xs">
                            1
                        </button>
                        
                        <button className="w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-lg hover:bg-gray-50 transition shadow-xs">
                            2
                        </button>
                        
                        <button className="w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-lg hover:bg-gray-50 transition shadow-xs">
                            3
                        </button>
                        
                        <button className="w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 transition shadow-xs">
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}