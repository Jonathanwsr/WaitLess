import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, useForm } from '@inertiajs/react';
import { 
    BanknotesIcon, CheckCircleIcon, 
    LockClosedIcon, ExclamationTriangleIcon, 
    ListBulletIcon, BuildingOfficeIcon, GlobeAltIcon,
    WalletIcon, ArrowDownRightIcon, UserIcon, EnvelopeIcon, PlusCircleIcon, ChartBarIcon
} from '@heroicons/react/24/solid';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

export default function Carteira({ papel, dadosFuncionario, dadosProprietario, dadosAdmin }) {
    const { auth, flash, errors } = usePage().props;

    return (
        <AuthenticatedLayout 
            user={auth?.user} 
            header={<h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Financeiro / Carteira</h2>}
        >
            <Head title="Carteira - WaitLess" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 mt-6 sm:mt-8 font-sans animate-in fade-in duration-500">
                
                {/* Alertas Globais Modernizados */}
                {flash?.success && (
                    <div className="bg-emerald-50/80 backdrop-blur-md border border-emerald-200 text-emerald-800 p-4 rounded-2xl mb-8 shadow-sm flex items-start sm:items-center gap-3 animate-in slide-in-from-top-4">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-500 mt-0.5 sm:mt-0 shrink-0" />
                        <span className="font-semibold text-sm">{flash.success}</span>
                    </div>
                )}
                {errors?.error && (
                    <div className="bg-red-50/80 backdrop-blur-md border border-red-200 text-red-800 p-4 rounded-2xl mb-8 shadow-sm flex items-start sm:items-center gap-3 animate-in slide-in-from-top-4">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5 sm:mt-0 shrink-0" />
                        <span className="font-semibold text-sm">{errors.error}</span>
                    </div>
                )}

                {/* Renderização Condicional */}
                <div className="space-y-6 sm:space-y-8">
                    {(papel === 'gerente' || papel === 'atendente') && <ViewFuncionario data={dadosFuncionario || {}} />}
                    {papel === 'socio' && <ViewProprietario data={dadosProprietario || {}} />}
                    {papel === 'admin' && <ViewAdmin data={dadosAdmin || {}} />}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// ==========================================
// VISÃO DO FUNCIONÁRIO (Gerente / Atendente)
// ==========================================
function ViewFuncionario({ data }) {
    const { post, processing } = useForm();
    const { 
        valorHoje = 0, 
        qtdHoje = 0, 
        ganhosMes = 0, 
        metaMensal = 1, 
        mesAtual = 'Mês Atual', 
        jaFechouHoje = false 
    } = data;
    
    const progressoMeta = metaMensal > 0 ? Math.min((ganhosMes / metaMensal) * 100, 100) : 0;

    const encerrarExpediente = (e) => {
        e.preventDefault();
        if (jaFechouHoje) return alert('O expediente já foi encerrado.');
        if (window.confirm(`Deseja encerrar o dia de hoje?\n\nTotal de Serviços: ${qtdHoje}\nProdução: ${formatarMoeda(valorHoje)}`)) {
            post(route('funcionario.fechar_dia'));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Card Principal - Estilo Cartão de Crédito/Bento */}
            <div className={`lg:col-span-7 xl:col-span-8 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg relative overflow-hidden flex flex-col justify-between transition-colors duration-700 ${jaFechouHoje ? 'bg-gradient-to-br from-emerald-800 to-teal-950' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-black'}`}>
                
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Produção de Hoje</p>
                    </div>
                    <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-sm">
                        {formatarMoeda(valorHoje)}
                    </h2>
                    
                    <div className="mt-6 flex flex-wrap gap-3">
                        <span className="text-sm font-medium text-slate-200 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-md">
                            <ListBulletIcon className="w-5 h-5 text-indigo-400" /> 
                            {qtdHoje} {qtdHoje === 1 ? 'serviço' : 'serviços'} hoje
                        </span>
                    </div>
                </div>
                
                <div className="mt-10 sm:mt-12 relative z-10">
                    <button 
                        onClick={encerrarExpediente} 
                        disabled={processing || jaFechouHoje} 
                        className={`w-full sm:w-auto font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                            jaFechouHoje 
                            ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 cursor-not-allowed' 
                            : 'bg-white text-slate-900 hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                    >
                        {processing ? 'Processando...' : jaFechouHoje ? <><CheckCircleIcon className="w-5 h-5"/> Expediente Encerrado</> : 'Encerrar Expediente'}
                    </button>
                </div>
            </div>

            {/* Card de Progresso */}
            <div className="lg:col-span-5 xl:col-span-4 bg-white ring-1 ring-gray-900/5 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110 pointer-events-none"></div>
                
                <div className="flex items-center gap-2 mb-6 relative z-10">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <ChartBarIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Progresso • {mesAtual}
                    </h3>
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tighter">{progressoMeta.toFixed(0)}</span>
                        <span className="text-2xl font-bold text-gray-400">%</span>
                    </div>
                    
                    <div className="w-full bg-gray-100 rounded-full h-3 mt-4 mb-3 overflow-hidden shadow-inner">
                        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressoMeta}%` }}>
                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide mt-4">
                        <div className="flex flex-col">
                            <span className="text-gray-400 mb-0.5">Alcançado</span>
                            <span className="text-indigo-600 text-sm">{formatarMoeda(ganhosMes)}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-gray-400 mb-0.5">Meta</span>
                            <span className="text-gray-900 text-sm">{formatarMoeda(metaMensal)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// VISÃO DO PROPRIETÁRIO (Sócio)
// ==========================================
function ViewProprietario({ data }) {
    const { post, processing } = useForm();
    const { 
        saldo_disponivel = 0, 
        pode_sacar = false, 
        data_proximo_saque = null, 
        extrato = [],
        asaas_status = null
    } = data;

    if (!asaas_status || asaas_status !== 'APPROVED') {
        return (
            <div className="bg-white ring-1 ring-gray-900/5 rounded-3xl p-8 sm:p-16 text-center max-w-2xl mx-auto shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
                
                <div className="relative z-10">
                    <div className="w-20 h-20 bg-indigo-50/80 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
                        <WalletIcon className="w-10 h-10 text-indigo-600 -rotate-3" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-4">
                        Ative sua Carteira Digital
                    </h2>
                    <p className="text-gray-500 font-medium mb-8 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
                        Para receber os repasses dos seus agendamentos diretamente na sua conta bancária via Pix, configure sua carteira agora.
                    </p>
                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-semibold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 mx-auto w-full sm:w-auto">
                        <PlusCircleIcon className="w-5 h-5" /> Configurar Carteira
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-black rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xl text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-indigo-600/20 to-transparent pointer-events-none"></div>
                <WalletIcon className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 pointer-events-none rotate-12" />

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-sm">
                                <BanknotesIcon className="w-5 h-5 text-indigo-300" />
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-indigo-200 uppercase tracking-widest">Saldo Disponível</p>
                        </div>
                        <span className="inline-flex w-max px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            Carteira Ativa
                        </span>
                    </div>
                    
                    <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                        {formatarMoeda(saldo_disponivel)}
                    </h2>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <button 
                            onClick={() => post(route('proprietario.sacar'))} 
                            disabled={!pode_sacar || processing || saldo_disponivel <= 0}
                            className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold transition-all duration-200 active:scale-95 flex justify-center items-center gap-2 ${
                                pode_sacar && saldo_disponivel > 0 
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg hover:shadow-emerald-500/25' 
                                : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                            }`}
                        >
                            {processing ? 'Processando...' : 'Sacar via Pix'}
                        </button>
                        
                        {!pode_sacar && data_proximo_saque && (
                            <div className="flex items-center justify-center sm:justify-start gap-2 bg-black/40 px-4 py-3 sm:py-4 rounded-xl border border-white/5 backdrop-blur-md flex-1 sm:flex-none">
                                <LockClosedIcon className="w-4 h-4 text-indigo-300 shrink-0"/> 
                                <span className="text-xs sm:text-sm font-medium text-slate-300">
                                    Liberação: <strong className="text-white ml-1">{new Date(data_proximo_saque).toLocaleDateString('pt-BR')}</strong>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Extrato Recente */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 ring-1 ring-gray-900/5 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <ArrowDownRightIcon className="w-5 h-5 text-gray-900" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                        Últimos Repasses
                    </h3>
                </div>
                
                {extrato.length > 0 ? (
                    <div className="space-y-3">
                        {extrato.map((item) => (
                            <div key={item.id} className="group flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-2xl bg-white hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 gap-3 sm:gap-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100/50 group-hover:scale-105 transition-transform">
                                        <BanknotesIcon className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm sm:text-base">Repasse de Serviço</p>
                                        <p className="text-xs font-medium text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="ml-14 sm:ml-0 flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0">
                                    <p className="font-black text-emerald-600 text-base sm:text-lg">
                                        + {formatarMoeda(item.valor_prestador)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <BanknotesIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">Nenhum repasse registrado ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ==========================================
// VISÃO DO ADMIN (Global)
// ==========================================
function ViewAdmin({ data }) {
    const { 
        lucro_plataforma = 0, 
        carteiras_asaas = [], 
        estabelecimentos = [] 
    } = data;

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Card Lucro */}
            <div className="bg-slate-900 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/40 via-transparent to-transparent pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col items-start">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                        <GlobeAltIcon className="w-4 h-4 text-teal-400"/>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-widest">Lucro da Plataforma (12%)</p>
                    </div>
                    <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-200 tracking-tighter">
                        {formatarMoeda(lucro_plataforma)}
                    </h2>
                </div>
            </div>

            {/* Grid de Carteiras */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 ring-1 ring-gray-900/5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                            <WalletIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                            Carteiras dos Parceiros
                        </h3>
                    </div>
                    <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                        Total: {carteiras_asaas.length}
                    </span>
                </div>
                
                {carteiras_asaas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {carteiras_asaas.map((carteira, idx) => {
                            const isAtiva = carteira.asaas_status === 'APPROVED' && carteira.asaas_wallet_id;
                            return (
                                <div key={idx} className="p-5 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
                                    <div>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:scale-110 transition-transform">
                                                <UserIcon className="w-5 h-5 text-slate-500"/>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isAtiva ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {isAtiva ? 'Ativa' : 'Pendente'}
                                            </span>
                                        </div>
                                        
                                        <h4 className="font-bold text-gray-900 text-base truncate" title={carteira.nome_usuario}>
                                            {carteira.nome_usuario}
                                        </h4>
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1.5 truncate">
                                            <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {carteira.email}
                                        </p>
                                        
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ID da Wallet</p>
                                            <p className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                                                {carteira.asaas_wallet_id || 'Não gerado ainda'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Saldo Retido</span>
                                        <span className="text-sm font-black text-teal-700">
                                            {formatarMoeda(carteira.saldo_atual)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <WalletIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-700 mb-1">Nenhuma carteira configurada</h4>
                        <p className="text-slate-500 text-sm">Os parceiros precisam criar suas carteiras para receberem ganhos.</p>
                    </div>
                )}
            </div>

            {/* Estabelecimentos */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 ring-1 ring-gray-900/5 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                        <BuildingOfficeIcon className="w-5 h-5 text-rose-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                        Estabelecimentos Cadastrados
                    </h3>
                </div>
                
                {estabelecimentos.length > 0 ? (
                    <div className="overflow-x-auto pb-2">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                                    <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chave Pix</th>
                                    <th className="py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Agendamentos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {estabelecimentos.map(est => (
                                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="py-3.5 px-4 font-semibold text-gray-900">{est.nome}</td>
                                        <td className="py-3.5 px-4 text-sm text-slate-500 font-mono">{est.chave_pix || 'Não informada'}</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 group-hover:bg-rose-50 group-hover:text-rose-700 group-hover:border-rose-100 transition-colors">
                                                {est.agendamentos_count}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-sm font-medium">Nenhum estabelecimento encontrado.</p>
                    </div>
                )}
            </div>
        </div>
    );
}