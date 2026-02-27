import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
// 👉 Importando todos os ícones do Heroicons (Solid e Outline)
import { 
    UsersIcon, 
    CurrencyDollarIcon, 
    BuildingOfficeIcon, 
    PlusIcon, 
    StarIcon, 
    UserGroupIcon, 
    Cog6ToothIcon, 
    ArrowRightIcon,
    ShoppingBagIcon 
} from '@heroicons/react/24/solid';

export default function Dashboard({ auth, estabelecimentos, metricas }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                    Visão Geral
                </h2>
            }
        >
            <Head title="Dashboard - WaitLess" />

            <div className="space-y-8">
                
                {/* --- SEÇÃO 1: Métricas Principais --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1 */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <UsersIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pessoas na Fila (Agora)</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                {metricas.total_fila || 0}
                            </p>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
                            <CurrencyDollarIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Arrecadação Total</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricas.total_arrecadado)}
                            </p>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <BuildingOfficeIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Locais Ativos</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                {metricas.ativos || 0}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- SEÇÃO 2: Meus Estabelecimentos --- */}
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Meus Estabelecimentos</h3>
                        <Link 
                            href={route('estabelecimentos.create')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Novo Local
                        </Link>
                    </div>

                    <div className="p-6">
                        {estabelecimentos.length === 0 ? (
                            // EMPTY STATE
                            <div className="text-center py-12">
                                <BuildingOfficeIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum estabelecimento encontrado</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                                    Parece que você ainda não cadastrou nenhuma clínica, barbearia ou loja. Comece agora para gerenciar suas filas.
                                </p>
                                <Link 
                                    href={route('estabelecimentos.create')}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-lg"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Criar Meu Primeiro Estabelecimento
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {estabelecimentos.map((local) => (
                                    <div key={local.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-indigo-300 transition group relative">
                                        
                                        {/* Status Tag & Settings Icon */}
                                        <div className="absolute top-4 right-4 flex items-center gap-3">
                                            <Link 
                                                href={route('estabelecimentos.configuracoes', local.id)}
                                                className="text-gray-400 hover:text-indigo-600 transition"
                                                title="Configurações e Serviços"
                                            >
                                                <Cog6ToothIcon className="w-5 h-5" />
                                            </Link>

                                            {local.ativo ? (
                                                <span className="flex h-3 w-3 relative" title="Aberto">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                </span>
                                            ) : (
                                                <span className="h-3 w-3 rounded-full bg-red-500 inline-block" title="Fechado"></span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 mb-4">
                                            {/* 👉 FOTO DE PERFIL / LOGO DO ESTABELECIMENTO */}
                                            <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 shadow-sm">
                                                {local.foto_perfil ? (
                                                    <img 
                                                        src={local.foto_perfil} 
                                                        alt={`Logo ${local.nome}`} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xl font-bold text-gray-500 uppercase">
                                                        {local.nome.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate pr-6">{local.nome}</h4>
                                                
                                                {/* Avaliação e Funcionários */}
                                                <div className="flex items-center gap-3 text-sm mt-1">
                                                    <div className="text-yellow-500 font-medium flex items-center gap-1">
                                                        <StarIcon className="w-4 h-4" /> 
                                                        {local.avaliacao_media}
                                                    </div>
                                                    <span className="text-gray-300 dark:text-gray-600">•</span>
                                                    <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5" title="Funcionários cadastrados">
                                                        <UserGroupIcon className="w-4 h-4" />
                                                        {local.funcionarios_count || 0} Equipe
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fila Block */}
                                        <Link 
                                            href={route('estabelecimentos.fila', local.id)}
                                            className="group/fila bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-4 flex justify-between items-center border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all cursor-pointer block"
                                        >
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover/fila:text-indigo-700 dark:group-hover/fila:text-indigo-300 transition-colors">
                                                Na Fila Agora:
                                            </span>
                                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                                {local.fila_agora || 0}
                                                <ArrowRightIcon className="w-4 h-4 opacity-0 group-hover/fila:opacity-100 transition-opacity -mr-1" />
                                            </span>
                                        </Link>

                                        {/* Botões de Ação Principais */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <Link 
                                                href={route('estabelecimentos.fila', local.id)} 
                                                className="text-center py-2.5 bg-indigo-600 border border-transparent rounded-lg text-xs sm:text-sm font-bold text-white hover:bg-indigo-700 transition shadow-sm"
                                            >
                                                Ver Fila
                                            </Link>
                                            <Link 
                                                href={route('estabelecimentos.loja', local.id)} 
                                                className="flex justify-center items-center gap-1 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition shadow-sm"
                                            >
                                                Vitrine
                                            </Link>
                                            <Link 
                                                href={route('estabelecimentos.configuracoes', local.id)} 
                                                className="text-center py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                            >
                                                Configurações
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}