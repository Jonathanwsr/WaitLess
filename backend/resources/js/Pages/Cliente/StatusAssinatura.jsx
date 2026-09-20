import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';

export default function StatusAssinatura({ auth, statusAssinatura }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [billingCycle, setBillingCycle] = useState('mensal'); // 'mensal' ou 'anual'
    const [showPlans, setShowPlans] = useState(false); // Controla se a lista de planos aparece para quem já assina
    const [modoMudanca, setModoMudanca] = useState(null); // 'migrar' (upgrade) | 'retroceder' (downgrade) | null (todos)

    const isSocio = auth.user.papel === 'socio';
    
    // Dados vindos do Backend
    const hasSubscription = ['ativo', 'em período de teste'].includes(statusAssinatura.status_acesso?.toLowerCase());
    const detalhes = statusAssinatura.detalhes_fatura;
    const dadosUser = statusAssinatura.dados_usuario || {}; // Novas informações do BD

    // Formatação de Moeda
    const valorPlanoFormatado = detalhes?.valor_mensal 
        ? `R$ ${Number(detalhes.valor_mensal).toFixed(2).replace('.', ',')}` 
        : 'R$ 0,00';

    // Definição dinâmica dos planos com as opções anuais
    const planos = isSocio 
        ? [
            {
                id: 'premium',
                nome: 'Premium',
                preco: '15,00',
                ciclo: 'mensal',
                desc: 'Ideal para iniciar e ganhar visibilidade na plataforma.',
                destaque: false,
                beneficios: ['Taxas reduzidas', 'Suporte padrão', 'Painel de métricas básico']
            },
            {
                id: 'premium-socio',
                nome: 'Premium Sócio',
                preco: '30,00',
                ciclo: 'mensal',
                desc: 'Destaque máximo e isenção de taxas presenciais.',
                destaque: true,
                tema: 'from-teal-500 to-emerald-600',
                badge: 'Máximo Retorno',
                beneficios: ['Isenção da taxa de 12% no balcão', 'Destaque no app', 'Suporte VIP 24/7', 'Métricas avançadas']
            },
            {
                id: 'premium-anual',
                nome: 'Premium Anual',
                preco: '126,00',
                precoOriginal: '180,00',
                ciclo: 'anual',
                desc: '1 ano inteiro de visibilidade com 30% de desconto.',
                destaque: false,
                badge: '30% OFF',
                beneficios: ['Equivale a apenas R$ 10,50/mês', 'Ganha 600 Pontos na hora', 'Taxas reduzidas', 'Suporte padrão']
            },
            {
                id: 'premium-socio-anual',
                nome: 'Sócio Anual',
                preco: '252,00',
                precoOriginal: '360,00',
                ciclo: 'anual',
                desc: 'O pacote definitivo de 1 ano com isenção total de taxas e 30% OFF.',
                destaque: true,
                tema: 'from-blue-600 to-indigo-700',
                badge: 'Melhor Custo-Benefício',
                beneficios: ['Equivale a apenas R$ 21,00/mês', 'Ganha 3600 Pontos na hora', 'Isenção da taxa de 12%', 'Suporte VIP 24/7']
            }
        ] 
        : [
            {
                id: 'premium',
                nome: 'Premium',
                preco: '8,00',
                ciclo: 'mensal',
                desc: 'Ideal para quem quer começar a economizar e pontuar.',
                destaque: false,
                beneficios: ['Ganhe 1 ponto a cada R$ 1', 'Acesso a promoções', 'Até 5% de desconto nas lojas']
            },
            {
                id: 'premium-plus',
                nome: 'Premium Plus',
                preco: '14,00',
                ciclo: 'mensal',
                desc: 'A experiência completa com atendimento VIP e retornos altos.',
                destaque: true,
                tema: 'from-fuchsia-600 to-purple-600',
                badge: 'Mais Vantagens',
                beneficios: ['Ganhe 3 pontos a cada R$ 1', 'Descontos de 15% a 30%', 'Promoções secretas', 'Consultoria personalizada']
            }
        ];

    // Valor mensal equivalente, para comparar planos anuais e mensais entre si
    const valorMensalPlano = (p) => Number(String(p.preco).replace('.', '').replace(',', '.')) / (p.ciclo === 'anual' ? 12 : 1);
    const valorMensalAtual = Number(detalhes?.valor_mensal) || 0;

    // Filtra os planos para exibir mensal ou anual (Apenas o sócio tem a aba Anual configurada)
    const planosCiclo = planos.filter(p => p.ciclo === billingCycle || !isSocio);
    const planosExibidos = !hasSubscription || !modoMudanca || !valorMensalAtual
        ? planosCiclo
        : planosCiclo.filter(p => modoMudanca === 'migrar'
            ? valorMensalPlano(p) > valorMensalAtual
            : valorMensalPlano(p) < valorMensalAtual);

    const abrirMudanca = (modo) => {
        setModoMudanca(modo);
        setShowPlans(true);
    };

    // Vindo de uma oferta bloqueada por plano (?mudar=1): já abre a lista de planos
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('mudar') && hasSubscription) {
            setShowPlans(true);
            setTimeout(() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, []);

    const handleConfirmar = async () => {
        if (!selectedPlan) return;
        setIsProcessing(true);

        // Se já tem assinatura, chama a rota de MUDAR PLANO. Se não, ASSINAR.
        const endpoint = hasSubscription ? '/minha-assinatura/mudar-plano' : '/minha-assinatura/assinar';
        
        const payload = {
            [hasSubscription ? 'novo_plano' : 'plano']: selectedPlan.id,
            metodo: paymentMethod
        };

        try {
            const response = await axios.post(endpoint, payload);
            
            if (response.data.gateway_link) {
                window.location.href = response.data.gateway_link;
            } else {
                alert(response.data.message || 'Operação realizada com sucesso!');
                setSelectedPlan(null);
                setShowPlans(false);
                router.reload();
            }
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao processar requisição.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelar = async () => {
        if (!confirm('Tem certeza que deseja cancelar sua assinatura? O acesso ficará disponível até o fim do ciclo vigente.')) return;
        
        setIsProcessing(true);
        try {
            const response = await axios.post('/minha-assinatura/cancelar');
            alert(response.data.message || 'Assinatura cancelada com sucesso.');
            router.reload();
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao tentar cancelar a assinatura.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-2xl text-gray-800 leading-tight">Minha Assinatura</h2>}
        >
            <Head title="Minha Assinatura" />

            <div className="py-12 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* Status da Assinatura Atual e Dados do BD */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-12 transition-all">
                        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-5 sm:px-8 flex justify-between items-center flex-wrap gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Resumo do seu Plano</h3>
                                <p className="text-sm text-gray-500 mt-1">Acompanhe o status e os dados financeiros da sua assinatura.</p>
                            </div>
                            
                            <div className="flex gap-3">
                                {hasSubscription && (
                                    <>
                                        <button 
                                            onClick={() => abrirMudanca('migrar')}
                                            className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 px-5 py-2.5 rounded-xl transition-colors"
                                        >
                                            Migrar de Plano
                                        </button>
                                        <button 
                                            onClick={() => abrirMudanca('retroceder')}
                                            className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-xl transition-colors"
                                        >
                                            Retroceder de Plano
                                        </button>
                                    </>
                                )}
                                {statusAssinatura.fatura_link && hasSubscription && (
                                    <a 
                                        href={statusAssinatura.fatura_link} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-colors"
                                    >
                                        Visualizar Fatura
                                    </a>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 sm:p-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                                    <p className="text-sm font-medium text-indigo-600 mb-1">Plano Atual</p>
                                    <p className="text-2xl font-bold text-gray-900 uppercase">{statusAssinatura.plano_atual}</p>
                                </div>
                                <div className="p-5 rounded-2xl border border-gray-100 bg-white">
                                    <p className="text-sm font-medium text-gray-500 mb-1">Status do Acesso</p>
                                    <p className="text-xl font-semibold flex items-center gap-2 capitalize text-gray-900">
                                        <span className={`w-2.5 h-2.5 rounded-full ${hasSubscription ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        {statusAssinatura.status_acesso}
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl border border-gray-100 bg-white">
                                    <p className="text-sm font-medium text-gray-500 mb-1">Valor Vigente</p>
                                    <p className="text-xl font-semibold text-gray-900">{valorPlanoFormatado}</p>
                                </div>
                                <div className="p-5 rounded-2xl border border-gray-100 bg-white">
                                    <p className="text-sm font-medium text-gray-500 mb-1">Próxima Ação Em</p>
                                    <p className="text-xl font-semibold text-gray-900">
                                        {statusAssinatura.expira_em} <span className="text-sm text-gray-500 font-normal">({statusAssinatura.dias_restantes} dias)</span>
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl border border-yellow-100 bg-yellow-50/50">
                                    <p className="text-sm font-medium text-yellow-700 mb-1">Saldo de Pontos</p>
                                    <p className="text-2xl font-bold text-gray-900">{dadosUser.pontos_saldo} <span className="text-sm text-yellow-600 font-normal">pts</span></p>
                                </div>
                            </div>

                            {/* Informações Extras do Banco */}
                            {hasSubscription && (
                                <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-400">
                                    <span>ID Integração: {dadosUser.asaas_subscription_id || 'Pendente'}</span>
                                    <span>•</span>
                                    <span>Status Gatway: {dadosUser.asaas_subscription_status || 'Aguardando'}</span>
                                </div>
                            )}

                            {hasSubscription && (
                                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                                    <button 
                                        onClick={handleCancelar}
                                        disabled={isProcessing}
                                        className="text-sm font-medium text-gray-400 hover:text-red-600 transition-colors underline decoration-transparent hover:decoration-red-600"
                                    >
                                        Cancelar assinatura atual
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Oferta de Planos (Aparece se não tem plano, ou se clicou em Mudar de Plano) */}
                    {(!hasSubscription || showPlans) && (
                        <div id="planos" className="mt-16 mb-16 animate-fade-in-up">
                            <div className="text-center max-w-2xl mx-auto mb-10">
                                <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
                                    {hasSubscription
                                        ? (modoMudanca === 'retroceder' ? 'Escolha o plano para retroceder' : modoMudanca === 'migrar' ? 'Escolha o plano para migrar' : 'Escolha o seu novo plano')
                                        : 'Evolua sua experiência'}
                                </h2>
                                <p className="mt-4 text-lg text-gray-500">
                                    {hasSubscription 
                                        ? 'A cobrança e a ativação do novo plano ocorrerão apenas no seu próximo ciclo de faturamento.' 
                                        : 'Assine agora e ganhe 7 dias grátis para testar todos os benefícios sem compromisso.'}
                                </p>
                            </div>

                            {/* Toggle Mensal / Anual (Apenas para Sócios) */}
                            {isSocio && (
                                <div className="flex justify-center mb-10">
                                    <div className="bg-gray-200 p-1 rounded-full flex shadow-inner">
                                        <button 
                                            onClick={() => setBillingCycle('mensal')}
                                            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${billingCycle === 'mensal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Mensal
                                        </button>
                                        <button 
                                            onClick={() => setBillingCycle('anual')}
                                            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${billingCycle === 'anual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Anual <span className="bg-green-400 text-white text-[10px] px-2 py-0.5 rounded-md">30% OFF</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {hasSubscription && planosExibidos.length === 0 && (
                                <div className="text-center text-gray-500 mb-8">
                                    <p className="font-medium">
                                        {modoMudanca === 'retroceder' ? 'Não há um plano inferior ao seu neste ciclo.' : 'Não há um plano superior ao seu neste ciclo.'}
                                    </p>
                                    <button onClick={() => setModoMudanca(null)} className="mt-2 text-indigo-600 font-bold hover:underline">
                                        Ver todos os planos
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col lg:flex-row justify-center items-stretch gap-8 px-4 sm:px-0 max-w-5xl mx-auto">
                                {planosExibidos.map((plano) => (
                                    <div 
                                        key={plano.id}
                                        className={`relative rounded-3xl p-8 flex-1 flex flex-col transition-all duration-300 ${
                                            plano.destaque 
                                            ? `bg-gradient-to-br ${plano.tema} shadow-xl transform lg:-translate-y-4 text-white` 
                                            : 'bg-white border border-gray-200 shadow-sm hover:shadow-lg text-gray-900 hover:border-indigo-300'
                                        }`}
                                    >
                                        {(plano.badge || plano.destaque) && (
                                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                                <span className={`${plano.destaque ? 'bg-white text-gray-900' : 'bg-indigo-600 text-white'} text-xs font-extrabold uppercase tracking-widest py-1.5 px-4 rounded-full shadow-md`}>
                                                    {plano.badge || 'Mais Vantagens'}
                                                </span>
                                            </div>
                                        )}

                                        <h3 className="text-2xl font-semibold mt-4">{plano.nome}</h3>
                                        <p className={`text-sm mt-2 ${plano.destaque ? 'text-white/80' : 'text-gray-500'}`}>
                                            {plano.desc}
                                        </p>
                                        
                                        <div className="mt-6 mb-2">
                                            {plano.precoOriginal && (
                                                <p className={`text-sm line-through decoration-red-500 ${plano.destaque ? 'text-white/60' : 'text-gray-400'}`}>
                                                    De R$ {plano.precoOriginal} por
                                                </p>
                                            )}
                                            <p className="flex items-baseline">
                                                <span className="text-5xl font-extrabold tracking-tight">R$ {plano.preco}</span>
                                                <span className={`ml-2 text-xl font-medium ${plano.destaque ? 'text-white/70' : 'text-gray-500'}`}>/{plano.ciclo === 'anual' ? 'ano' : 'mês'}</span>
                                            </p>
                                        </div>
                                        
                                        {/* Badge de 7 dias se não for mudança de plano */}
                                        {!hasSubscription && (
                                            <div className="mb-8 mt-2">
                                                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${plano.destaque ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                                                    + 7 dias grátis inclusos
                                                </span>
                                            </div>
                                        )}

                                        <ul role="list" className={`space-y-6 flex-1 ${!hasSubscription ? 'mt-0' : 'mt-8'} ${plano.destaque ? 'text-white/90' : 'text-gray-600'}`}>
                                            {plano.beneficios.map((beneficio, index) => (
                                                <li key={index} className="flex items-start">
                                                    <CheckIcon className={`flex-shrink-0 w-6 h-6 mr-3 ${plano.destaque ? 'text-white' : 'text-green-500'}`} />
                                                    <span className="font-medium text-sm mt-0.5">{beneficio}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <button 
                                            onClick={() => setSelectedPlan(plano)}
                                            disabled={isProcessing}
                                            className={`mt-8 block w-full font-bold text-center py-4 px-4 rounded-xl transition-all focus:ring-4 ${
                                                plano.destaque
                                                ? 'bg-white text-gray-900 hover:bg-gray-50 hover:shadow-lg focus:ring-white/50'
                                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus:ring-indigo-100'
                                            }`}
                                        >
                                            {hasSubscription ? `${modoMudanca === 'retroceder' ? 'Retroceder' : modoMudanca === 'migrar' ? 'Migrar' : 'Mudar'} para ${plano.nome}` : 'Iniciar 7 Dias Grátis'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            
                            {hasSubscription && (
                                <div className="text-center mt-8">
                                    <button onClick={() => { setShowPlans(false); setModoMudanca(null); }} className="text-gray-500 hover:text-gray-900 font-medium">
                                        Cancelar mudança e fechar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Seleção de Pagamento */}
            {selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-fade-in-up">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {hasSubscription ? 'Agendar Mudança de Plano' : 'Iniciar Período de Teste'}
                        </h3>
                        <p className="text-gray-500 mb-6 text-sm">
                            {hasSubscription 
                                ? `Você está mudando para o ${selectedPlan.nome}. A cobrança de R$ ${selectedPlan.preco} acontecerá apenas quando seu ciclo atual vencer. Como deseja pagar o novo plano?` 
                                : `Você está prestes a ativar o ${selectedPlan.nome}. A primeira cobrança de R$ ${selectedPlan.preco} ocorrerá somente após 7 dias. Como deseja pagar?`
                            }
                        </p>
                        
                        <div className="space-y-3 mb-8">
                            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'pix' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="payment" value="pix" checked={paymentMethod === 'pix'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                <span className="ml-3 font-medium text-gray-900">PIX {hasSubscription ? '(Envio automático por e-mail)' : '(Cobrança após 7 dias)'}</span>
                            </label>
                            
                            <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="payment" value="credit_card" checked={paymentMethod === 'credit_card'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                <span className="ml-3 font-medium text-gray-900">Cartão de Crédito Automático</span>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setSelectedPlan(null)}
                                disabled={isProcessing}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                            >
                                Voltar
                            </button>
                            <button 
                                onClick={handleConfirmar}
                                disabled={isProcessing}
                                className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex justify-center items-center shadow-lg shadow-indigo-600/30"
                            >
                                {isProcessing ? 'Aguarde...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInline={{__html: `
                .animate-fade-in-up {
                    animation: fadeInUp 0.4s ease-out forwards;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </AuthenticatedLayout>
    );
}

function CheckIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}