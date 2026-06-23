import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { 
    StarIcon, SparklesIcon, CheckBadgeIcon, TicketIcon, 
    BoltIcon, ShieldCheckIcon, DocumentTextIcon, LifebuoyIcon,
    QuestionMarkCircleIcon, ArrowRightIcon
} from '@heroicons/react/24/solid';
import { useState, useEffect } from 'react';

export default function Carteira({ auth, recompensas = [], meusCupons = [] }) {
    const user = auth.user;
    const { flash = {} } = usePage().props;
    
    const isGestor = ['admin', 'socio', 'gerente'].includes(user?.papel);

    const [retornoMp, setRetornoMp] = useState(null);

    const { post, processing } = useForm({});

    // 👉 LÊ A URL QUANDO VOLTA DO MERCADO PAGO
    useEffect(() => {
        const parametros = new URLSearchParams(window.location.search);
        const statusMp = parametros.get('status'); 
        const motivoMp = parametros.get('reason');

        if (statusMp) {
            if (statusMp === 'approved' || statusMp === 'authorized') {
                setRetornoMp({ tipo: 'success', texto: '🎉 Pagamento aprovado! Os seus benefícios VIP já estão a ser ativados pelo sistema.' });
            } else if (statusMp === 'pending' || statusMp === 'in_process') {
                setRetornoMp({ tipo: 'warning', texto: '⏳ O seu pagamento está em análise. O plano será ativado assim que o banco confirmar.' });
            } else {
                setRetornoMp({ tipo: 'error', texto: '❌ O pagamento não foi concluído ou foi recusado. Tente novamente.' });
            }
            
            // Limpa a URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

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
        <AuthenticatedLayout header={<></>}>
            <Head title={isGestor ? "Assinaturas - WaitLess" : "Minha Carteira - WaitLess"} />

            {/* Fundo aquecido off-white: #FCF9F6 */}
            <div className="min-h-screen bg-[#FCF9F6] font-sans pb-24">
                {/* CONTAINER AMPLIADO para preencher a tela toda lateralmente */}
                <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-12 pt-12">
                    
                    {/* CABEÇALHO */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6">
                        <div>
                            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                                Gerenciar Assinatura
                            </h2>
                            <p className="text-gray-500 mt-2 text-base font-medium">
                                Controle seu plano, benefícios e pagamentos.
                            </p>
                        </div>
                        
                        {!isGestor && (
                            <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm w-max">
                                <div className="w-10 h-10 bg-[#FFF2EE] rounded-full flex items-center justify-center">
                                    <StarIcon className="w-6 h-6 text-[#E05D36]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Saldo de Pontos</p>
                                    <p className="text-xl font-black text-gray-900 leading-tight">{user.pontos_saldo || 0}</p>
                                </div>
                                <button className="ml-4 bg-[#FFF2EE] text-[#E05D36] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#FADCD2] transition-colors">
                                    Resgatar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ALERTAS DO MERCADO PAGO E FLASH */}
                    {retornoMp && retornoMp.tipo === 'success' && (
                        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-2xl shadow-sm flex items-center gap-3">
                            <CheckBadgeIcon className="w-6 h-6" /> {retornoMp.texto}
                        </div>
                    )}
                    {retornoMp && retornoMp.tipo === 'warning' && (
                        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-2xl shadow-sm flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-6 h-6" /> {retornoMp.texto}
                        </div>
                    )}
                    {retornoMp && retornoMp.tipo === 'error' && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-800 font-bold rounded-2xl shadow-sm flex items-center gap-3">
                            <ShieldCheckIcon className="w-6 h-6" /> {retornoMp.texto}
                        </div>
                    )}
                    {flash?.success && !retornoMp && (
                        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-2xl shadow-sm flex items-center gap-3">
                            <CheckBadgeIcon className="w-6 h-6" /> {flash.success}
                        </div>
                    )}
                    {flash?.error && !retornoMp && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-800 font-bold rounded-2xl shadow-sm flex items-center gap-3">
                            <ShieldCheckIcon className="w-6 h-6" /> {flash.error}
                        </div>
                    )}

                    {/* GRID PRINCIPAL */}
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        
                        {/* ============================================================== */}
                        {/* LADO ESQUERDO: CARD DE ASSINATURA PRINCIPAL                    */}
                        {/* ============================================================== */}
                        {!isGestor && (
                            <div className="w-full lg:w-2/3 space-y-8 shrink-0">
                                
                                {/* CARD PRINCIPAL DE ASSINATURA */}
                                <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm border border-gray-100 relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-[#0F172A] rounded-2xl flex items-center justify-center shadow-md">
                                                <ShieldCheckIcon className="w-7 h-7 text-white" />
                                            </div>
                                            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                                                Plano {isPlus ? 'WaitLess Plus' : 'Gratuito'}
                                            </h3>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${temPlanoAtivo ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            ● {temPlanoAtivo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {/* Detalhes de Preço e Benefícios Solicitados */}
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valor Atual</p>
                                            <div className="flex items-baseline gap-1 mb-2">
                                                {/* Atualizado para 12 reais conforme solicitação */}
                                                <span className="text-5xl font-black text-[#0F172A]">{isPlus ? 'R$ 12,00' : 'R$ 0,00'}</span>
                                                <span className="text-base font-bold text-gray-500">/mês</span>
                                            </div>
                                            {isPlus && (
                                                <p className="text-sm font-semibold text-gray-500 mb-8">
                                                    Próxima renovação em <strong className="text-[#E05D36]">{proximaCobranca}</strong>
                                                </p>
                                            )}
                                            {!isPlus && <div className="mb-8"></div>}

                                            <div className="h-px w-full bg-gray-100 mb-8"></div>

                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Seus Benefícios Plus</p>
                                            <ul className="space-y-3.5">
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Descontos exclusivos em serviços
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Acúmulo de pontos para outros segmentos
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Preferência na fila de atendimento
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Promoções exclusivas e cupons especiais
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Notificações prioritárias e acesso antecipado
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Aumento no acúmulo (Ganhos triplicados 3x)
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Acesso a serviços VIPs exclusivos
                                                </li>
                                                <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                                                    <CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0" /> Estorno em até 2h se o serviço não for concluído
                                                </li>
                                            </ul>
                                        </div>

                                        {/* Caixa de Cancelamento Facilitado e Links */}
                                        <div className="flex flex-col">
                                            {isPlus ? (
                                                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200 mb-6">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <ShieldCheckIcon className="w-5 h-5 text-gray-500" />
                                                        <h4 className="font-bold text-gray-900">Cancelamento Facilitado</h4>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-500 mb-6 leading-relaxed">
                                                        O seu plano conta com cancelamento facilitado sem burocracias. Ao cancelar, os benefícios Plus permanecem ativos até o final do ciclo faturado.
                                                    </p>
                                                    <button 
                                                        onClick={cancelarAssinatura} 
                                                        disabled={processing}
                                                        className="w-full py-3.5 rounded-xl font-bold text-[#E05D36] border-2 border-[#E05D36] hover:bg-[#FFF2EE] transition-colors"
                                                    >
                                                        {processing ? 'Aguarde...' : 'Cancelar Assinatura'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200 mb-6 flex flex-col items-center justify-center text-center h-full min-h-[220px]">
                                                    <SparklesIcon className="w-10 h-10 text-gray-300 mb-3" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Você está no plano gratuito</h4>
                                                    <p className="text-sm font-medium text-gray-500">Faça o upgrade por apenas R$ 12,00/mês e libere todos os recursos VIP.</p>
                                                </div>
                                            )}

                                            <div className="space-y-2 mt-auto">
                                                <button className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                                                        <span className="font-bold text-gray-700 text-sm">Histórico de Faturas</span>
                                                    </div>
                                                    <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <button className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <LifebuoyIcon className="w-5 h-5 text-gray-400" />
                                                        <span className="font-bold text-gray-700 text-sm">Falar com Suporte</span>
                                                    </div>
                                                    <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Banner Inferior de Dúvidas */}
                                    <div className="mt-10 bg-gray-50 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between border border-gray-200 gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-[#E05D36]/10 rounded-full flex items-center justify-center shrink-0">
                                                <QuestionMarkCircleIcon className="w-6 h-6 text-[#E05D36]" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-gray-900">Dúvidas sobre o plano?</h5>
                                                <p className="text-sm text-gray-500 font-medium">Estamos disponíveis para ajudar com qualquer dúvida.</p>
                                            </div>
                                        </div>
                                        <button className="w-full sm:w-auto px-6 py-3 bg-[#0F172A] hover:bg-black text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0">
                                            Falar com Atendente <ArrowRightIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* MEUS CUPONS */}
                                {meusCupons && meusCupons.length > 0 && (
                                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 sm:p-10">
                                        <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
                                            <TicketIcon className="w-7 h-7 text-[#E05D36]" />
                                            Meu Inventário de Cupons
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {meusCupons.map(meuCupom => (
                                                <div key={meuCupom.id} className={`p-6 rounded-3xl border-2 border-dashed ${meuCupom.pivot.usado ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-[#FFF2EE] border-[#FADCD2] relative overflow-hidden'}`}>
                                                    {!meuCupom.pivot.usado && (
                                                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-bl-xl shadow-sm">
                                                            Pronto para uso
                                                        </div>
                                                    )}
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{meuCupom.estabelecimento?.nome}</p>
                                                    <h4 className="font-black text-gray-900 text-lg mb-4 leading-tight">{meuCupom.titulo}</h4>
                                                    
                                                    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                                                        <span className={`font-mono text-xl font-black tracking-[0.15em] ${meuCupom.pivot.usado ? 'text-gray-400 line-through' : 'text-[#0F172A]'}`}>
                                                            {meuCupom.codigo}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ============================================================== */}
                        {/* LADO DIREITO: PONTOS, UPGRADE E RECOMPENSAS                    */}
                        {/* ============================================================== */}
                        {!isGestor && (
                            <div className="flex-1 space-y-6 w-full lg:w-1/3">
                                
                                {/* CARD SALDO ATUAL */}
                                <div className="bg-gradient-to-br from-[#E05D36] to-[#b3401f] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                                    <SparklesIcon className="absolute -bottom-6 -right-6 w-40 h-40 text-white opacity-10" />
                                    <p className="text-white/80 font-black uppercase tracking-widest text-xs mb-3">Saldo Atual</p>
                                    <div className="flex items-baseline gap-2 relative z-10">
                                        <span className="text-6xl font-black tracking-tight">{user.pontos_saldo || 0}</span>
                                        <span className="text-2xl font-bold text-white/80">Pts</span>
                                    </div>
                                    <p className="text-sm text-white/90 mt-4 font-medium leading-relaxed relative z-10">
                                        Ganhe pontos avaliando locais, produtos e realizando agendamentos na plataforma!
                                    </p>
                                </div>

                                {/* CARD DE UPGRADE RÁPIDO */}
                                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-[#0F172A] p-2 rounded-xl">
                                            <StarIcon className="w-5 h-5 text-[#E05D36]" />
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">WaitLess <span className="text-[#E05D36]">Plus</span></h3>
                                    </div>
                                    
                                    <p className="text-sm font-medium text-gray-500 mb-6">
                                        {isPlus ? 'Você já possui a experiência VIP ativa.' : 'Vantagens exclusivas e ganhos triplicados nas lojas.'}
                                    </p>

                                    <ul className="space-y-4 mb-8">
                                        <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                                            <BoltIcon className="w-5 h-5 text-[#0F172A] shrink-0" /> Ganhos de pontos triplicados (3x)
                                        </li>
                                        <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                                            <StarIcon className="w-5 h-5 text-[#0F172A] shrink-0" /> Preferência total nas filas virtuais
                                        </li>
                                        <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                                            <TicketIcon className="w-5 h-5 text-[#0F172A] shrink-0" /> Cupons e promoções antecipadas
                                        </li>
                                    </ul>

                                    {!isPlus ? (
                                        <button onClick={() => assinarPlano('plus')} disabled={processing} className="w-full py-4 rounded-xl font-bold text-white bg-[#0F172A] hover:bg-black shadow-md transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                                            <StarIcon className="w-5 h-5 text-[#E05D36]" />
                                            {processing ? 'Processando...' : 'Fazer Upgrade'}
                                        </button>
                                    ) : (
                                        <div className="w-full py-3 rounded-xl font-bold text-emerald-800 bg-emerald-100 text-center border border-emerald-200">
                                            Membro VIP Ativo 👑
                                        </div>
                                    )}
                                </div>

                                {/* CARD LOJA / TROQUE SEUS PONTOS */}
                                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                                    <h3 className="text-xl font-black text-gray-900 mb-3">Troque seus pontos</h3>
                                    <p className="text-gray-500 font-medium text-sm mb-6 leading-relaxed">
                                        Use seu saldo acumulado em outros segmentos e estabelecimentos parceiros do marketplace.
                                    </p>
                                    <Link href={route('cliente.explorar')} className="text-[#E05D36] font-bold text-sm flex items-center gap-2 hover:underline">
                                        Ver locais disponíveis <ArrowRightIcon className="w-4 h-4" />
                                    </Link>

                                    {recompensas.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                                            {recompensas.map(rec => {
                                                const podeComprar = user.pontos_saldo >= rec.pontos_custo;
                                                const bloqueadoPlus = rec.apenas_plus && !isPlus;

                                                return (
                                                    <div key={rec.id} className="border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow bg-gray-50/50">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{rec.estabelecimento?.nome}</p>
                                                                <h4 className="font-bold text-gray-900 text-sm">{rec.titulo}</h4>
                                                            </div>
                                                            {rec.apenas_plus && <span className="bg-[#0F172A] text-[#E05D36] text-[9px] font-black uppercase px-2 py-1 rounded">Plus</span>}
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <div className="flex items-center gap-1 font-black text-[#E05D36]">
                                                                <StarIcon className="w-4 h-4" /> {rec.pontos_custo}
                                                            </div>
                                                            {bloqueadoPlus ? (
                                                                <button disabled className="px-3 py-1.5 bg-gray-200 text-gray-500 font-bold rounded-lg text-xs cursor-not-allowed">Apenas Plus</button>
                                                            ) : podeComprar ? (
                                                                <button onClick={() => resgatarCupom(rec)} className="px-4 py-1.5 bg-[#0F172A] hover:bg-black text-white font-bold rounded-lg text-xs shadow-sm transition">
                                                                    Resgatar
                                                                </button>
                                                            ) : (
                                                                <button disabled className="px-3 py-1.5 bg-gray-100 text-gray-400 font-bold rounded-lg text-xs cursor-not-allowed">Saldo Insuficiente</button>
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
                        {/* PLANOS PARA LOJISTAS                                           */}
                        {/* ============================================================== */}
                        {isGestor && (
                            <div className="w-full">
                                <div className="text-center max-w-2xl mx-auto mb-12">
                                    <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Escale o seu negócio com o plano certo</h3>
                                    <p className="text-gray-500 font-medium text-lg">Escolha o plano que melhor se adapta ao tamanho e às necessidades do seu estabelecimento.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                                    
                                    {/* PLANO BÁSICO */}
                                    <div className={`bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col h-full ${isBasico ? 'ring-2 ring-[#0F172A]' : ''}`}>
                                        <div className="mb-8">
                                            <span className="bg-gray-100 text-gray-700 font-black px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest">Básico</span>
                                            <h4 className="text-4xl font-black text-gray-900 mt-6">R$ 20<span className="text-lg text-gray-400 font-bold">/mês</span></h4>
                                            <p className="text-sm font-medium text-gray-500 mt-3">Ideal para profissionais autónomos e quem está a começar.</p>
                                        </div>
                                        <ul className="space-y-4 mb-8 flex-grow">
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Até 3 estabelecimentos</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Até 15 serviços por local</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Agendamento online e Fila em tempo real</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Recebimentos via plataforma (Mercado Pago)</li>
                                        </ul>
                                        <button onClick={() => assinarPlano('basico')} disabled={processing || isBasico} className={`w-full py-4 rounded-2xl font-bold transition-all ${isBasico ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-900'}`}>
                                            {isBasico ? 'Plano Atual' : 'Assinar Básico'}
                                        </button>
                                    </div>

                                    {/* PLANO PROFISSIONAL */}
                                    <div className={`bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl transform md:-translate-y-4 flex flex-col h-full relative ${isPro ? 'ring-2 ring-[#0F172A]' : ''}`}>
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-md">Mais Popular</div>
                                        <div className="mb-8">
                                            <span className="bg-[#FFF2EE] text-[#E05D36] font-black px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest">Profissional</span>
                                            <h4 className="text-4xl font-black text-gray-900 mt-6">R$ 49,90<span className="text-lg text-gray-400 font-bold">/mês</span></h4>
                                            <p className="text-sm font-medium text-gray-500 mt-3">Para clínicas, barbearias em crescimento e pequenas redes.</p>
                                        </div>
                                        <ul className="space-y-4 mb-8 flex-grow">
                                            <li className="flex items-start gap-3 text-sm font-black text-gray-900"><CheckBadgeIcon className="w-5 h-5 text-[#0F172A] shrink-0"/> Tudo do Básico +</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Até 15 estabelecimentos</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Até 60 serviços cadastrados</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Criação de Cupons e Marketing</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-700"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Destaque nas buscas e Visor de Fila</li>
                                        </ul>
                                        <button onClick={() => assinarPlano('profissional')} disabled={processing || isPro} className={`w-full py-4 rounded-2xl font-bold transition-all shadow-md ${isPro ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' : 'bg-[#E05D36] hover:bg-[#C74B27] text-white'}`}>
                                            {isPro ? 'Plano Atual' : 'Assinar Profissional'}
                                        </button>
                                    </div>

                                    {/* PLANO PREMIUM */}
                                    <div className={`bg-[#0F172A] rounded-[2rem] p-8 border border-[#0F172A] shadow-lg flex flex-col h-full text-white ${isPremium ? 'ring-2 ring-[#E05D36]' : ''}`}>
                                        <div className="mb-8">
                                            <span className="bg-white/10 text-white font-black px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest">Premium</span>
                                            <h4 className="text-4xl font-black text-white mt-6">R$ 99,90<span className="text-lg text-gray-400 font-bold">/mês</span></h4>
                                            <p className="text-sm font-medium text-gray-400 mt-3">Sem limites. Para grandes redes e negócios estruturados.</p>
                                        </div>
                                        <ul className="space-y-4 mb-8 flex-grow">
                                            <li className="flex items-start gap-3 text-sm font-black text-white"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Tudo do Profissional +</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Estabelecimentos e Serviços Ilimitados</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Dashboard avançado de métricas</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Integração com WhatsApp</li>
                                            <li className="flex items-start gap-3 text-sm font-bold text-gray-300"><CheckBadgeIcon className="w-5 h-5 text-[#E05D36] shrink-0"/> Campanhas patrocinadas internas</li>
                                        </ul>
                                        <button onClick={() => assinarPlano('premium')} disabled={processing || isPremium} className={`w-full py-4 rounded-2xl font-bold transition-all ${isPremium ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-white text-[#0F172A] hover:bg-gray-100'}`}>
                                            {isPremium ? 'Plano Atual' : 'Assinar Premium'}
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}