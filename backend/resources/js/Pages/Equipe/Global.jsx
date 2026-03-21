import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { 
    UserCircleIcon, 
    BuildingStorefrontIcon, 
    CalendarDaysIcon, 
    BriefcaseIcon, 
    CheckBadgeIcon, 
    XCircleIcon,
    ArrowLeftIcon
} from '@heroicons/react/24/solid';

export default function EquipeGlobal({ auth, funcionarios }) {
    
    // Função para deixar a data bonita (Ex: 10/03/2026)
    const formatarData = (dataStr) => {
        if (!dataStr) return '--';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex items-center gap-4">
                    <Link 
                        href={route('dashboard')} 
                        className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-full flex items-center justify-center text-gray-600 transition shadow-sm"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            Gestão Global da Equipa
                        </h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Todos os profissionais cadastrados nos seus estabelecimentos.</p>
                    </div>
                </div>
            }
        >
            <Head title="Minha Equipa Global - WaitLess" />

            <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 pb-12">
                
                {funcionarios.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                        <UserCircleIcon className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">A sua equipa está vazia</h3>
                        <p className="text-gray-500">Você ainda não tem nenhum funcionário cadastrado nos seus estabelecimentos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {funcionarios.map((func) => (
                            <div key={func.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden flex flex-col">
                                
                                {/* Decoração de fundo */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent dark:from-indigo-900/20 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>

                                {/* Status (Ativo/Inativo) */}
                                <div className="absolute top-5 right-5">
                                    {func.ativo ? (
                                        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Inativo
                                        </span>
                                    )}
                                </div>

                                {/* Avatar e Nome */}
                                <div className="flex flex-col items-center mt-2 mb-6">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-indigo-700 font-black text-2xl uppercase mb-3">
                                        {func.nome.charAt(0)}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg text-center truncate w-full px-2">
                                        {func.nome}
                                    </h3>
                                    
                                    {/* Média de Avaliação do Profissional (Opcional, se existir na tabela) */}
                                    {func.avaliacao_media > 0 && (
                                        <div className="flex items-center gap-1 mt-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-md text-xs font-bold border border-yellow-200">
                                            ⭐ {Number(func.avaliacao_media).toFixed(1)}
                                        </div>
                                    )}
                                </div>

                                {/* Informações */}
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl flex-1 flex flex-col justify-center border border-gray-100 dark:border-gray-700">
                                    
                                    <div className="flex items-start gap-3">
                                        <BriefcaseIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Cargo / Função</p>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{func.cargo || 'Não definido'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <BuildingStorefrontIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Local de Trabalho</p>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                                                {func.estabelecimento?.nome || 'Estabelecimento Excluído'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <CalendarDaysIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Membro desde</p>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                {formatarData(func.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}