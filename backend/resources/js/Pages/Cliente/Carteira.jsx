import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { StarIcon, SparklesIcon, CheckBadgeIcon, TicketIcon, BoltIcon } from '@heroicons/react/24/solid';

export default function Carteira({ auth, recompensas = [], meusCupons = [] }) {
    const user = auth.user;
    const { flash = {} } = usePage().props;
    
    // Identifica se é dono de loja/admin ou cliente
    const isGestor = ['admin', 'socio', 'gerente'].includes(user?.papel);

    const { post, processing } = useForm({});

    const assinarPlano = (nomeDoPlano) => {
        post(route('assinatura.nova', { plano: nomeDoPlano }), {
            preserveScroll: true
        });
    };

    const cancelarAssinatura = () => {
        const diaAtual = new Date().getDate();
        if (diaAtual > 15) {
            alert('Atenção: O cancelamento só terá efeito no próximo ciclo, pois já passamos do dia 15 deste mês.');
        } else {
            if(window.confirm('Tem certeza que deseja cancelar sua assinatura atual? Você perderá todos os benefícios premium imediatamente.')){
                post(route('assinatura.cancelar'), {
                    preserveScroll: true
                });
            }
        }
    };

    // 👉 NOVA FUNÇÃO: Resgatar o cupom com pontos
    const resgatarCupom = (cupom) => {
        if (window.confirm(`Deseja gastar ${cupom.pontos_custo} pontos para resgatar "${cupom.titulo}"?`)) {
            router.post(route('cliente.resgatar.cupom', cupom.id), {}, {
                preserveScroll: true
            });
        }
    };

    const planoAtualSeguro = user?.plano_assinatura || 'gratuito';

    const isPlus = planoAtualSeguro === 'plus';
    const isBasico = planoAtualSeguro === 'basico';
    const isPro = planoAtualSeguro === 'profissional';
    const isPremium = planoAtualSeguro === 'premium';
    
    const temPlanoAtivo = isPlus || isBasico || isPro || isPremium;

    const hoje = new Date();
    const proximaCobranca = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10).toLocaleDateString('pt-BR');

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {isGestor ? 'Gestão de Assinaturas' : 'Minha Carteira & Benefícios'}
                </h2>
            }
        >
            <Head title={isGestor ? "Assinaturas - WaitLess" : "Minha Carteira - WaitLess"} />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20">
                
                {flash?.success && (
                    <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-800 font-bold rounded-xl shadow-sm animate-in fade-in flex items-center gap-2">
                        <span>✨</span> {flash.success}
                    </div>
                )}
                {flash?.warning && (
                    <div className="mb-6 p-4 bg-yellow-100 border border-yellow-200 text-yellow-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ⚠️ {flash.warning}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ❌ {flash.error}
                    </div>
                )}

                {temPlanoAtivo && (
                    <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                <CheckBadgeIcon className="w-5 h-5 text-green-500"/> Assinatura Ativa: WaitLess {planoAtualSeguro.toUpperCase()}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">Próxima cobrança programada para o dia <strong>{proximaCobranca}</strong>.</p>
                            <p className="text-xs text-gray-400 mt-1">Lembrete: O cancelamento deve ser feito até o dia 15 de cada mês.</p>
                        </div>
                        <button onClick={cancelarAssinatura} disabled={processing} className="text-sm font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition whitespace-nowrap disabled:opacity-50">
                            {processing ? 'Aguarde...' : 'Cancelar Plano'}
                        </button>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    
                    {/* ============================================================== */}
                    {/* LADO ESQUERDO: PONTOS E PLANO PLUS (SÓ PARA CLIENTES)          */}
                    {/* ============================================================== */}
                    {!isGestor && (
                        <div className="w-full lg:w-1/3 space-y-6 shrink-0">
                            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                                <SparklesIcon className="absolute -top-6 -right-6 w-32 h-32 text-white/20" />
                                <p className="text-orange-100 font-bold uppercase tracking-wider text-sm mb-2">Saldo Atual</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black">{user.pontos_saldo || 0}</span>
                                    <span className="text-xl font-medium text-orange-100">Pts</span>
                                </div>
                                <p className="text-sm text-orange-100 mt-4 leading-snug">
                                    Ganhe pontos avaliando locais, pagando online ou agendando serviços!
                                </p>
                            </div>

                            <div className={`rounded-3xl p-1 border-2 shadow-lg transition-all ${isPlus ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 border-transparent' : 'bg-white border-gray-200'}`}>
                                <div className={`rounded-[22px] p-6 sm:p-8 h-full ${isPlus ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-2xl font-black font-serif italic tracking-tight flex items-center gap-2">
                                                WaitLess <span className={isPlus ? "text-yellow-400" : "text-indigo-600"}>Plus</span>
                                            </h3>
                                            <p className={`text-sm mt-1 ${isPlus ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {isPlus ? 'O seu plano VIP está ativo!' : 'A experiência VIP por R$ 9,90/mês'}
                                            </p>
                                        </div>
                                        {isPlus && <CheckBadgeIcon className="w-10 h-10 text-yellow-400" />}
                                    </div>

                                    <ul className="space-y-4 mb-8">
                                        <li className="flex items-center gap-3 text-sm font-medium"><BoltIcon className={`w-5 h-5 ${isPlus ? 'text-yellow-400' : 'text-indigo-500'}`} /> Acúmulo de pontos a dobrar (2x)</li>
                                        <li className="flex items-center gap-3 text-sm font-medium"><StarIcon className={`w-5 h-5 ${isPlus ? 'text-yellow-400' : 'text-indigo-500'}`} /> Precedência VIP nas filas</li>
                                        <li className="flex items-center gap-3 text-sm font-medium"><TicketIcon className={`w-5 h-5 ${isPlus ? 'text-yellow-400' : 'text-indigo-500'}`} /> Cupons Exclusivos (Lojas parceiras)</li>
                                        <li className="flex items-center gap-3 text-sm font-medium"><SparklesIcon className={`w-5 h-5 ${isPlus ? 'text-yellow-400' : 'text-indigo-500'}`} /> Estorno em até 2h se cancelado</li>
                                    </ul>

                                    {!isPlus ? (
                                        <button onClick={() => assinarPlano('plus')} disabled={processing} className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50">
                                            {processing ? 'A processar...' : 'Assinar (Mercado Pago)'}
                                        </button>
                                    ) : (
                                        <div className="w-full py-3 rounded-xl font-bold text-gray-900 bg-yellow-400 text-center shadow-md">Membro VIP 👑</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* LADO DIREITO: LOJA E INVENTÁRIO (SÓ PARA CLIENTES)             */}
                    {/* ============================================================== */}
                    {!isGestor && (
                        <div className="flex-1 space-y-8">
                            
                            {/* 👉 NOVO: INVENTÁRIO DE CUPONS (Meus Cupons) */}
                            {meusCupons && meusCupons.length > 0 && (
                                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <TicketIcon className="w-6 h-6 text-indigo-500" />
                                        Meu Inventário de Cupons
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {meusCupons.map(meuCupom => (
                                            <div key={meuCupom.id} className={`p-5 rounded-2xl border-2 border-dashed ${meuCupom.pivot.usado ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-indigo-50/50 border-indigo-300 relative overflow-hidden'}`}>
                                                {!meuCupom.pivot.usado && (
                                                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg shadow-sm">
                                                        Pronto para uso
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{meuCupom.estabelecimento?.nome}</p>
                                                <h4 className="font-bold text-gray-900 mb-2 leading-tight">{meuCupom.titulo}</h4>
                                                
                                                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-2 text-center">
                                                    <span className={`font-mono text-xl font-black tracking-widest ${meuCupom.pivot.usado ? 'text-gray-400 line-through' : 'text-indigo-700'}`}>
                                                        {meuCupom.codigo}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* LOJA DE RECOMPENSAS */}
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 h-full">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Troque seus pontos</h3>
                                <p className="text-gray-500 text-sm mb-8 pb-6 border-b border-gray-100">
                                    Use o seu saldo para resgatar descontos incríveis nos seus estabelecimentos favoritos.
                                </p>

                                {recompensas.length === 0 ? (
                                    <div className="text-center py-12">
                                        <span className="text-5xl opacity-50 block mb-4">🎁</span>
                                        <h4 className="text-lg font-bold text-gray-700">Nenhuma recompensa ativa no momento</h4>
                                        <p className="text-sm text-gray-500 mt-1">Os estabelecimentos ainda não criaram cupons de pontos.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {recompensas.map(rec => {
                                            const podeComprar = user.pontos_saldo >= rec.pontos_custo;
                                            const bloqueadoPlus = rec.apenas_plus && !isPlus;

                                            return (
                                                <div key={rec.id} className="border border-gray-200 rounded-2xl p-5 hover:border-orange-300 hover:shadow-md transition group flex flex-col h-full relative overflow-hidden">
                                                    {rec.apenas_plus && (
                                                        <div className="absolute top-0 right-0 bg-gray-900 text-yellow-400 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg z-10 shadow-sm">Exclusivo Plus</div>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-gray-200">
                                                            {rec.estabelecimento?.foto_perfil ? (
                                                                <img src={rec.estabelecimento.foto_perfil} alt={rec.estabelecimento.nome} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="font-bold text-gray-500 text-xs">
                                                                    {rec.estabelecimento?.nome?.substring(0, 2).toUpperCase() || 'LO'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate">{rec.estabelecimento?.nome}</p>
                                                            <h4 className="font-black text-gray-900 text-lg leading-tight truncate">{rec.titulo}</h4>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-6 flex-grow">
                                                        {rec.descricao || `Desconto de ${rec.tipo_desconto === 'percentual' ? Number(rec.valor_desconto) + '%' : 'R$ ' + Number(rec.valor_desconto).toFixed(2)}.`}
                                                    </p>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-1 font-black text-orange-600 text-lg">
                                                            <StarIcon className="w-5 h-5" />
                                                            {rec.pontos_custo} <span className="text-xs text-orange-400 font-bold uppercase tracking-wider mt-1">Pts</span>
                                                        </div>
                                                        {bloqueadoPlus ? (
                                                            <button disabled className="px-4 py-2 bg-gray-100 text-gray-400 font-bold rounded-lg text-sm cursor-not-allowed">Apenas Plus</button>
                                                        ) : podeComprar ? (
                                                            <button 
                                                                onClick={() => resgatarCupom(rec)} 
                                                                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-sm shadow-md transition transform hover:scale-[1.05]"
                                                            >
                                                                Resgatar
                                                            </button>
                                                        ) : (
                                                            <button disabled className="px-4 py-2 bg-gray-100 text-gray-400 font-bold rounded-lg text-sm cursor-not-allowed">Pontos Insuficientes</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* PLANOS PARA LOJISTAS (SÓ PARA ADMIN/SÓCIO/GERENTE)             */}
                    {/* ============================================================== */}
                    {isGestor && (
                        <div className="w-full">
                            <div className="text-center max-w-2xl mx-auto mb-12">
                                <h3 className="text-3xl font-black text-gray-900 mb-4">Escale o seu negócio com o plano certo</h3>
                                <p className="text-gray-500">Escolha o plano que melhor se adapta ao tamanho e às necessidades do seu estabelecimento.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                                
                                {/* PLANO BÁSICO */}
                                <div className={`bg-white rounded-3xl p-8 border-2 shadow-sm transition flex flex-col h-full ${isBasico ? 'border-green-500 ring-4 ring-green-50' : 'border-gray-200'}`}>
                                    <div className="mb-6">
                                        <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">🟢 Básico</span>
                                        <h4 className="text-4xl font-black text-gray-900 mt-4">R$ 20<span className="text-lg text-gray-500 font-medium">/mês</span></h4>
                                        <p className="text-sm text-gray-500 mt-2">Ideal para profissionais autónomos e quem está a começar.</p>
                                    </div>
                                    <ul className="space-y-3 mb-8 flex-grow">
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-green-500 shrink-0"/> Até 3 estabelecimentos</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-green-500 shrink-0"/> Até 15 serviços por local</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-green-500 shrink-0"/> Agendamento online e Fila em tempo real</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-green-500 shrink-0"/> Recebimentos via plataforma (Mercado Pago)</li>
                                    </ul>
                                    <button onClick={() => assinarPlano('basico')} disabled={processing || isBasico} className={`w-full py-4 rounded-xl font-bold transition ${isBasico ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black text-white shadow-md'}`}>
                                        {isBasico ? 'Plano Atual' : 'Assinar Básico'}
                                    </button>
                                </div>

                                {/* PLANO PROFISSIONAL */}
                                <div className={`bg-white rounded-3xl p-8 border-2 shadow-xl transform lg:scale-105 transition flex flex-col h-full relative ${isPro ? 'border-blue-500 ring-4 ring-blue-50' : 'border-blue-200'}`}>
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow-md">Mais Popular</div>
                                    <div className="mb-6">
                                        <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">🔵 Profissional</span>
                                        <h4 className="text-4xl font-black text-gray-900 mt-4">R$ 49,90<span className="text-lg text-gray-500 font-medium">/mês</span></h4>
                                        <p className="text-sm text-gray-500 mt-2">Para clínicas, barbearias em crescimento e pequenas redes.</p>
                                    </div>
                                    <ul className="space-y-3 mb-8 flex-grow">
                                        <li className="flex items-start gap-2 text-sm text-gray-900 font-medium"><CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0"/> Tudo do Básico +</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0"/> Até 15 estabelecimentos</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0"/> Até 60 serviços cadastrados</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0"/> Criação de Cupons e Marketing</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0"/> Destaque nas buscas e Visor de Fila</li>
                                    </ul>
                                    <button onClick={() => assinarPlano('profissional')} disabled={processing || isPro} className={`w-full py-4 rounded-xl font-bold transition ${isPro ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}`}>
                                        {isPro ? 'Plano Atual' : 'Assinar Profissional'}
                                    </button>
                                </div>

                                {/* PLANO PREMIUM */}
                                <div className={`bg-gray-900 rounded-3xl p-8 border-2 shadow-sm transition flex flex-col h-full text-white ${isPremium ? 'border-red-500 ring-4 ring-red-900/50' : 'border-gray-800'}`}>
                                    <div className="mb-6">
                                        <span className="bg-red-500/20 text-red-400 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">🔴 Premium</span>
                                        <h4 className="text-4xl font-black text-white mt-4">R$ 99,90<span className="text-lg text-gray-400 font-medium">/mês</span></h4>
                                        <p className="text-sm text-gray-400 mt-2">Sem limites. Para grandes redes e negócios estruturados.</p>
                                    </div>
                                    <ul className="space-y-3 mb-8 flex-grow">
                                        <li className="flex items-start gap-2 text-sm text-white font-medium"><CheckBadgeIcon className="w-5 h-5 text-red-400 shrink-0"/> Tudo do Profissional +</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-red-400 shrink-0"/> Estabelecimentos e Serviços Ilimitados</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-red-400 shrink-0"/> Dashboard avançado de métricas</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-red-400 shrink-0"/> Integração com WhatsApp</li>
                                        <li className="flex items-start gap-2 text-sm text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-red-400 shrink-0"/> Campanhas patrocinadas internas</li>
                                    </ul>
                                    <button onClick={() => assinarPlano('premium')} disabled={processing || isPremium} className={`w-full py-4 rounded-xl font-bold transition ${isPremium ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white shadow-md'}`}>
                                        {isPremium ? 'Plano Atual' : 'Assinar Premium'}
                                    </button>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}