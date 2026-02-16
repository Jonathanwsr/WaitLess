import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

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
                
                {/* --- SEÇÃO 1: Métricas Globais (KPIs) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1 */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl">
                            👥
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
                        <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 text-2xl">
                            💰
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
                        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl">
                            🏢
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
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20"
                        >
                            + Novo Local
                        </Link>
                    </div>

                    <div className="p-6">
                        {estabelecimentos.length === 0 ? (
                            // EMPTY STATE: Se o usuário acabou de criar a conta e não tem empresa
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🏪</div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum estabelecimento encontrado</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                                    Parece que você ainda não cadastrou nenhuma clínica, barbearia ou loja. Comece agora para gerenciar suas filas.
                                </p>
                                <Link 
                                    href={route('estabelecimentos.create')}
                                    className="inline-block px-6 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-lg"
                                >
                                    Criar Meu Primeiro Estabelecimento
                                </Link>
                            </div>
                        ) : (
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {estabelecimentos.map((local) => (
                                    <div key={local.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-indigo-300 transition group relative">
                                        
                                        {/* Status Tag */}
                                        <div className="absolute top-4 right-4 flex items-center gap-3">
                                            {/* Botão de Configurações (Engrenagem) no topo direito, ao lado do status */}
                                            <Link 
                                                href={route('estabelecimentos.configuracoes', local.id)}
                                                className="text-gray-400 hover:text-indigo-600 transition"
                                                title="Configurações e Serviços"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
                                                </svg>
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
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl font-bold text-gray-500">
                                                {local.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate pr-6">{local.nome}</h4>
                                                
                                                {/* Adicionado o número de funcionários ao lado das estrelas */}
                                                <div className="flex items-center gap-3 text-sm mt-1">
                                                    <div className="text-yellow-500 font-medium">
                                                        ⭐ {local.avaliacao_media}
                                                    </div>
                                                    <span className="text-gray-300 dark:text-gray-600">•</span>
                                                    <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5" title="Funcionários cadastrados">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                            <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                                                        </svg>
                                                        {local.funcionarios_count || 0} Equipe
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        {/* A área da contagem agora é um bloco clicável (Link) que leva para a fila */}
                                        <Link 
                                            href={route('estabelecimentos.fila', local.id)}
                                            className="group/fila bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-4 flex justify-between items-center border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all cursor-pointer block"
                                        >
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover/fila:text-indigo-700 dark:group-hover/fila:text-indigo-300 transition-colors">
                                                Na Fila Agora:
                                            </span>
                                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                                {local.fila_agora || 0}
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-0 group-hover/fila:opacity-100 transition-opacity -mr-1">
                                                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        </Link>

                                        {/* Botões de Ação Principais */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Link 
                                                href={route('estabelecimentos.fila', local.id)} 
                                                className="text-center py-2.5 bg-indigo-600 border border-transparent rounded-lg text-sm font-bold text-white hover:bg-indigo-700 transition shadow-sm"
                                            >
                                                Ver Fila
                                            </Link>
                                            <Link 
                                                href={route('estabelecimentos.configuracoes', local.id)} 
                                                className="text-center py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
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