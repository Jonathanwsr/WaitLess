import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage, Link } from '@inertiajs/react';
import { 
    ArrowTrendingUpIcon, BanknotesIcon, CheckCircleIcon, 
    ArrowLeftIcon, ChartBarIcon, LockClosedIcon,
    BriefcaseIcon, ExclamationTriangleIcon, ClipboardDocumentCheckIcon,
    ListBulletIcon, CalendarDaysIcon // Ícone que estava a faltar e causou a tela branca!
} from '@heroicons/react/24/solid';

export default function ProducaoFuncionario({ auth, valorHoje, qtdHoje, ganhosMes, metaMensal, historicoFechamentos, mesAtual, jaFechouHoje }) {
    const { flash = {}, errors = {} } = usePage().props;
    const { post, processing } = useForm();

    const progressoMeta = Math.min((ganhosMes / metaMensal) * 100, 100);
    const faltamParaMeta = Math.max(metaMensal - ganhosMes, 0);

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    const encerrarExpediente = (e) => {
        e.preventDefault();
        if (jaFechouHoje) return alert('O expediente já foi encerrado.');
        
        if (window.confirm(`Deseja encerrar o dia de hoje?\n\nTotal de Serviços: ${qtdHoje}\nProdução: ${formatarMoeda(valorHoje)}\n\nEsta ação enviará o relatório ao gerente e fechará a sua agenda para hoje.`)) {
            post(route('funcionario.fechar_dia'));
        }
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black text-gray-900 tracking-tight">Minha Produção</h2>}>
            <Head title="Produção - WaitLess" />

            <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 pb-24 mt-6 font-sans">
                
                {/* --- CABEÇALHO SUPERIOR --- */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href={route('funcionario.dashboard')} className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl flex items-center justify-center text-gray-700 transition shadow-sm hover:shadow-md">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Desempenho</h3>
                        <p className="text-sm text-gray-500 font-medium mt-0.5">Acompanhe as suas metas mensais e feche o seu caixa.</p>
                    </div>
                </div>

                {/* --- ALERTAS E SUCESSO --- */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in fade-in">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{flash.success}</span>
                    </div>
                )}
                {errors?.error && (
                    <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in shake">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{errors.error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* ========================================== */}
                    {/* 1. PAINEL DE HOJE E BOTÃO DE ENCERRAMENTO */}
                    {/* ========================================== */}
                    <div className={`md:col-span-8 rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col justify-between transition-colors duration-500 ${jaFechouHoje ? 'bg-gradient-to-br from-emerald-800 to-emerald-950' : 'bg-gradient-to-br from-gray-900 to-black'}`}>
                        {/* Detalhe de fundo */}
                        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                        
                        {jaFechouHoje ? (
                            <LockClosedIcon className="absolute -right-8 -bottom-8 w-56 h-56 text-emerald-500/20 pointer-events-none transform rotate-12" />
                        ) : (
                            <BanknotesIcon className="absolute -right-8 -bottom-8 w-56 h-56 text-white/5 pointer-events-none transform -rotate-12" />
                        )}
                        
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <BriefcaseIcon className="w-4 h-4 text-gray-400" /> Produzido Hoje
                                </p>
                                {jaFechouHoje && (
                                    <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                        <CheckCircleIcon className="w-3 h-3"/> Expediente Encerrado
                                    </span>
                                )}
                            </div>
                            
                            <h2 className="text-5xl sm:text-7xl font-black text-white tracking-tighter drop-shadow-md">
                                {formatarMoeda(valorHoje)}
                            </h2>
                            <p className="text-sm font-bold text-gray-400 mt-4 flex items-center gap-2 bg-white/10 w-max px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
                                <ListBulletIcon className="w-4 h-4" /> {qtdHoje} serviços executados
                            </p>
                        </div>

                        <div className="mt-10 relative z-10">
                            <button 
                                onClick={encerrarExpediente}
                                disabled={processing || jaFechouHoje}
                                className={`w-full sm:w-max font-black px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-3 ${
                                    jaFechouHoje 
                                    ? 'bg-emerald-700/50 text-emerald-300 border border-emerald-600/50 cursor-not-allowed opacity-80' 
                                    : 'bg-white text-gray-900 hover:bg-gray-100 hover:scale-[1.02] shadow-xl hover:shadow-2xl'
                                }`}
                            >
                                {processing ? 'A Processar...' : jaFechouHoje ? <><CheckCircleIcon className="w-5 h-5"/> Resumo Enviado ao Gerente</> : <><LockClosedIcon className="w-5 h-5"/> Encerrar o Meu Expediente</>}
                            </button>
                            {!jaFechouHoje && (
                                <p className="text-[10px] text-gray-500 font-bold mt-3 max-w-sm uppercase tracking-widest leading-relaxed">
                                    Atenção: Ao encerrar, o seu relatório é enviado à gerência e não poderá receber mais clientes hoje.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ========================================== */}
                    {/* 2. METAS DO MÊS */}
                    {/* ========================================== */}
                    <div className="md:col-span-4 bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col relative overflow-hidden group">
                        {/* Brilho no hover */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <ChartBarIcon className="w-4 h-4 text-indigo-600" />
                                </div>
                                Meta de {mesAtual}
                            </h3>
                        </div>

                        <div className="text-center mb-8 relative z-10">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alcançado</p>
                            <p className="text-5xl font-black text-gray-900 mt-1 tracking-tighter">
                                {progressoMeta.toFixed(0)}<span className="text-2xl text-gray-400">%</span>
                            </p>
                        </div>

                        <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden border border-gray-200 relative z-10">
                            <div 
                                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-1000 ease-out relative" 
                                style={{ width: `${progressoMeta}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>

                        <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest relative z-10">
                            <span>{formatarMoeda(ganhosMes)}</span>
                            <span>{formatarMoeda(metaMensal)}</span>
                        </div>

                        <div className="mt-auto pt-6 border-t border-gray-100 text-center relative z-10">
                            {faltamParaMeta > 0 ? (
                                <p className="text-xs font-bold text-gray-500 flex items-center justify-center gap-1.5 bg-gray-50 py-2 rounded-lg border border-gray-100">
                                    <ArrowTrendingUpIcon className="w-4 h-4 text-indigo-500" /> Faltam <span className="text-indigo-700 font-black">{formatarMoeda(faltamParaMeta)}</span>
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-100 py-2 rounded-lg">
                                    <CheckCircleIcon className="w-5 h-5" /> Meta do mês atingida!
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ========================================== */}
                {/* 3. HISTÓRICO DE FECHAMENTOS (ÚLTIMOS DIAS) */}
                {/* ========================================== */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm mt-8">
                    <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2 tracking-tight border-b border-gray-100 pb-4">
                        <ClipboardDocumentCheckIcon className="w-6 h-6 text-indigo-500" /> Histórico de Expedientes Encerrados
                    </h3>

                    {historicoFechamentos.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                            <CalendarDaysIcon className="w-16 h-16 mb-4 text-gray-200" />
                            <p className="font-bold text-lg">Sem histórico.</p>
                            <p className="text-sm mt-1">Nenhum fechamento registado até ao momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {historicoFechamentos.map((fechamento, idx) => (
                                <div key={idx} className="flex flex-col gap-3 p-6 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group cursor-default">
                                    <div className="flex items-center justify-between">
                                        <span className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            {new Date(fechamento.data_fechamento).toLocaleDateString('pt-BR')}
                                        </span>
                                        <CheckCircleIcon className="w-6 h-6 text-emerald-400 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    <p className="text-3xl font-black text-gray-900 tracking-tighter mt-2">{formatarMoeda(fechamento.valor_total)}</p>
                                    <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                        <ListBulletIcon className="w-4 h-4 text-indigo-400" /> {fechamento.qtd_servicos} serviços prestados
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}