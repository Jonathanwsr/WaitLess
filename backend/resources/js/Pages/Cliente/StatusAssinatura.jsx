import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';

// Visual de cada plano (cores, selo e frase). Preço e benefícios vêm do servidor (BeneficiosPlanos).
const VISUAL_PLANOS = {
    'premium': { descSocio: 'Para começar a ganhar destaque e pagar menos taxa.', descCliente: 'Para economizar com pontos e ter acesso a ofertas exclusivas.' },
    'premium-plus': { desc: 'A experiência completa: mais pontos e as ofertas mais exclusivas.', destaque: true, tema: 'from-fuchsia-600 to-purple-600', badge: 'Mais vantagens' },
    'premium-socio': { desc: 'Destaque máximo, sem taxa no balcão e nota fiscal automática.', destaque: true, tema: 'from-teal-500 to-emerald-600', badge: 'Máximo retorno' },
    'premium-anual': { desc: '1 ano inteiro de Premium com 30% de desconto.', badge: '30% OFF', precoOriginal: '180,00' },
    'premium-socio-anual': { desc: 'O Sócio Premium por 1 ano, com 30% de desconto.', destaque: true, tema: 'from-blue-600 to-indigo-700', badge: 'Melhor custo-benefício', precoOriginal: '360,00' },
};

const CARTAO_VAZIO = { numero: '', titular: '', validade: '', cvv: '' };
const mascararNumero = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
const mascararValidade = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
const bandeira = (numero) => {
    const n = numero.replace(/\D/g, '');
    if (/^4/.test(n)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'MASTERCARD';
    if (/^3[47]/.test(n)) return 'AMEX';
    if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(n)) return 'ELO';
    if (/^(606282|3841)/.test(n)) return 'HIPERCARD';
    return '';
};

function CartaoVisual({ cartao, virado }) {
    const numero = mascararNumero(cartao.numero).padEnd(19, '•').replace(/ /g, ' ');
    return (
        <div className="relative h-44 w-full [perspective:1000px]">
            <div className={`absolute inset-0 rounded-2xl p-5 text-white shadow-xl transition-transform duration-500 [transform-style:preserve-3d] ${virado ? '[transform:rotateY(180deg)]' : ''}`} style={{ background: 'linear-gradient(135deg,#1f2937,#4338ca)' }}>
                <div className="absolute inset-0 rounded-2xl p-5 [backface-visibility:hidden] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
                        <span className="text-sm font-black tracking-wider">{bandeira(cartao.numero) || 'CARTÃO'}</span>
                    </div>
                    <p className="font-mono text-xl tracking-widest">{numero}</p>
                    <div className="flex items-end justify-between text-xs">
                        <div><p className="text-white/60">Titular</p><p className="font-bold uppercase tracking-wide">{cartao.titular || 'NOME COMO NO CARTÃO'}</p></div>
                        <div className="text-right"><p className="text-white/60">Validade</p><p className="font-bold">{cartao.validade || 'MM/AA'}</p></div>
                    </div>
                </div>
                <div className="absolute inset-0 rounded-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="mt-6 h-10 bg-black/70" />
                    <div className="mx-5 mt-4 flex items-center justify-end gap-2 rounded bg-white/90 px-3 py-2 text-gray-900">
                        <span className="text-xs text-gray-500">CVV</span><span className="font-mono font-bold">{cartao.cvv || '•••'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function StatusAssinatura({ auth, statusAssinatura, planos: planosServidor = [] }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [billingCycle, setBillingCycle] = useState('mensal'); // 'mensal' ou 'anual'
    const [showPlans, setShowPlans] = useState(false); // Controla se a lista de planos aparece para quem já assina
    const [modoMudanca, setModoMudanca] = useState(null); // 'migrar' (upgrade) | 'retroceder' (downgrade) | null (todos)
    const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
    const [resultadoCancelamento, setResultadoCancelamento] = useState(null);

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
    // Planos e benefícios vêm do servidor: a mesma lista, verdadeira, no web e no app.
    const planos = planosServidor.map((p) => {
        const v = VISUAL_PLANOS[p.id] || {};
        return {
            ...p,
            preco: Number(p.valor).toFixed(2).replace('.', ','),
            desc: v.desc || (isSocio ? v.descSocio : v.descCliente) || '',
            destaque: !!v.destaque,
            tema: v.tema,
            badge: v.badge,
            precoOriginal: v.precoOriginal,
        };
    });

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

    // Cartão digitado na tela (vai direto para o Asaas; nada é salvo no Lokyva)
    const [cartao, setCartao] = useState(CARTAO_VAZIO);
    const [titularCartao, setTitularCartao] = useState({ cpf_cnpj: dadosUser.cpf_cnpj || '', cep: '', numero: '' });
    const [cvvEmFoco, setCvvEmFoco] = useState(false);
    const [erroPagamento, setErroPagamento] = useState(null);

    // Cobrança Pix da assinatura perto de vencer: mostra o QR code aqui (o Asaas também manda por e-mail).
    const [cobranca, setCobranca] = useState(null);
    const [copiado, setCopiado] = useState(false);
    useEffect(() => {
        axios.get('/minha-assinatura/cobranca').then(({ data }) => setCobranca(data?.cobranca || null)).catch(() => {});
    }, []);
    const copiarPix = async () => {
        try { await navigator.clipboard.writeText(cobranca.pix.copia_e_cola); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch {}
    };

    const handleConfirmar = async () => {
        if (!selectedPlan) return;
        setErroPagamento(null);

        let dadosCartao = {};
        if (paymentMethod === 'credit_card') {
            const [mes, ano] = cartao.validade.split('/');
            const numero = cartao.numero.replace(/\D/g, '');
            if (numero.length < 13 || !cartao.titular.trim() || !mes || !ano || cartao.cvv.length < 3) {
                setErroPagamento('Preencha número, nome, validade e CVV do cartão.');
                return;
            }
            if (titularCartao.cpf_cnpj.replace(/\D/g, '').length < 11 || titularCartao.cep.replace(/\D/g, '').length < 8 || !titularCartao.numero) {
                setErroPagamento('Informe o CPF/CNPJ, o CEP e o número do endereço do titular do cartão.');
                return;
            }
            dadosCartao = {
                cartao: { numero, titular: cartao.titular.trim(), mes: Number(mes), ano: Number(ano), cvv: cartao.cvv },
                titular: { cpf_cnpj: titularCartao.cpf_cnpj, cep: titularCartao.cep, numero: titularCartao.numero },
            };
        }

        setIsProcessing(true);

        // Se já tem assinatura, chama a rota de MUDAR PLANO. Se não, ASSINAR.
        const endpoint = hasSubscription ? '/minha-assinatura/mudar-plano' : '/minha-assinatura/assinar';

        const payload = {
            [hasSubscription ? 'novo_plano' : 'plano']: selectedPlan.id,
            metodo: paymentMethod,
            ...dadosCartao,
        };

        try {
            const response = await axios.post(endpoint, payload);

            if (response.data.gateway_link) {
                window.location.href = response.data.gateway_link;
            } else {
                alert(response.data.message || 'Operação realizada com sucesso!');
                setSelectedPlan(null);
                setShowPlans(false);
                setCartao(CARTAO_VAZIO);
                router.reload();
            }
        } catch (error) {
            const erros = error.response?.data?.errors;
            setErroPagamento(error.response?.data?.error || (erros ? Object.values(erros)[0]?.[0] : null) || 'Erro ao processar requisição.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Cancelar = voltar para o plano Grátis (sem plano). A confirmação explica o que muda.
    const handleCancelar = () => setConfirmandoCancelamento(true);

    const confirmarCancelamento = async () => {
        setIsProcessing(true);
        try {
            const response = await axios.post('/minha-assinatura/cancelar');
            setResultadoCancelamento({ ok: true, texto: response.data.message || 'Assinatura cancelada.' });
            setShowPlans(false);
            setModoMudanca(null);
            router.reload({ only: ['statusAssinatura'] });
        } catch (error) {
            setResultadoCancelamento({ ok: false, texto: error.response?.data?.error || 'Erro ao tentar cancelar a assinatura.' });
        } finally {
            setIsProcessing(false);
            setConfirmandoCancelamento(false);
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

                    {resultadoCancelamento && (
                        <div className={`mb-6 flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${resultadoCancelamento.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                            <span>{resultadoCancelamento.texto}</span>
                            <button type="button" onClick={() => setResultadoCancelamento(null)} className="text-xs underline">fechar</button>
                        </div>
                    )}

                    {statusAssinatura.volta_gratuito_em && (
                        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <p className="font-bold text-amber-900">Sua assinatura foi cancelada.</p>
                            <p className="mt-1 text-sm text-amber-800">
                                Você não será mais cobrado. Os benefícios do plano <b className="uppercase">{statusAssinatura.plano_atual}</b> continuam até <b>{statusAssinatura.volta_gratuito_em}</b>.
                                Depois disso sua conta volta sozinha para o <b>plano Grátis</b> (sem plano). Mudou de ideia? É só assinar de novo abaixo.
                            </p>
                        </div>
                    )}

                    {cobranca?.mostrar && (
                        <div className={`mb-6 overflow-hidden rounded-3xl border ${cobranca.vencida ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
                                {cobranca.pix?.imagem && (
                                    <img src={`data:image/png;base64,${cobranca.pix.imagem}`} alt="QR code Pix da assinatura" className="mx-auto h-44 w-44 shrink-0 rounded-2xl bg-white p-2 shadow-sm sm:mx-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-lg font-black ${cobranca.vencida ? 'text-red-800' : 'text-amber-900'}`}>
                                        {cobranca.vencida ? 'Sua assinatura está com o pagamento atrasado' : cobranca.dias_para_vencer <= 0 ? 'Sua assinatura vence hoje' : `Sua assinatura vence em ${cobranca.dias_para_vencer} ${cobranca.dias_para_vencer === 1 ? 'dia' : 'dias'}`}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                        Valor: <b>R$ {Number(cobranca.valor).toFixed(2).replace('.', ',')}</b>
                                        {cobranca.vencimento && <> · vencimento {cobranca.vencimento.split('-').reverse().join('/')}</>}
                                    </p>
                                    {cobranca.pix ? (
                                        <>
                                            <p className="mt-2 text-sm text-gray-600">Aponte a câmera do app do seu banco para o QR code ou use o Pix copia e cola. O Asaas também enviou esta cobrança para o seu e-mail.</p>
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                <input readOnly value={cobranca.pix.copia_e_cola || ''} className="min-w-0 flex-1 rounded-xl border-gray-200 bg-white text-xs text-gray-600" onFocus={(e) => e.target.select()} />
                                                <button type="button" onClick={copiarPix} className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black">{copiado ? 'Copiado!' : 'Copiar código Pix'}</button>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-600">O Asaas enviou esta cobrança para o seu e-mail.</p>
                                    )}
                                    {cobranca.link && <a href={cobranca.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-indigo-700 hover:underline">Abrir a fatura completa</a>}
                                </div>
                            </div>
                        </div>
                    )}

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
                                        Cancelar assinatura e voltar para o plano Grátis
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

                            {hasSubscription && modoMudanca === 'retroceder' && (
                                <div className="mx-auto mb-8 flex max-w-5xl flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Sem plano</p>
                                        <h3 className="text-2xl font-semibold text-gray-900">Grátis <span className="text-base font-medium text-gray-500">R$ 0/mês</span></h3>
                                        <p className="mt-1 text-sm text-gray-500">Continue usando a Lokyva sem pagar nada: agendar, reservar, comprar e acumular pontos. Você só perde os benefícios do plano.</p>
                                    </div>
                                    <button onClick={handleCancelar} disabled={isProcessing} className="shrink-0 rounded-xl border-2 border-gray-900 px-5 py-3 font-bold text-gray-900 transition hover:bg-gray-900 hover:text-white">
                                        Voltar para o Grátis
                                    </button>
                                </div>
                            )}

                            {hasSubscription && planosExibidos.length === 0 && modoMudanca !== 'retroceder' && (
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

                                        <p className={`text-[11px] font-black uppercase tracking-wider mb-3 ${plano.destaque ? 'text-white/70' : 'text-gray-400'}`}>O que você ganha</p>
                                        <ul role="list" className={`space-y-4 flex-1 ${plano.destaque ? 'text-white/90' : 'text-gray-600'}`}>
                                            {plano.beneficios.map((beneficio, index) => (
                                                <li key={index} className="flex items-start">
                                                    <CheckIcon className={`flex-shrink-0 w-5 h-5 mr-3 mt-0.5 ${plano.destaque ? 'text-white' : 'text-green-500'}`} />
                                                    <span>
                                                        <span className={`block text-sm font-bold ${plano.destaque ? 'text-white' : 'text-gray-900'}`}>{beneficio.titulo}</span>
                                                        <span className={`block text-xs leading-relaxed mt-0.5 ${plano.destaque ? 'text-white/75' : 'text-gray-500'}`}>{beneficio.texto}</span>
                                                    </span>
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

            {confirmandoCancelamento && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm" onClick={() => !isProcessing && setConfirmandoCancelamento(false)}>
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-gray-900">Voltar para o plano Grátis?</h3>
                        <ul className="mt-4 space-y-2 text-sm text-gray-600">
                            <li>• A cobrança recorrente é cancelada: <b>você não paga mais nada</b>.</li>
                            <li>• {detalhes?.status === 'ativa'
                                ? <>Os benefícios continuam até <b>{statusAssinatura.expira_em}</b>, que é o fim do período já pago.</>
                                : <>Como o período ainda não foi pago, a conta volta para o <b>Grátis agora</b>.</>}</li>
                            <li>• Seus pontos, agendamentos e histórico continuam na conta.</li>
                            <li>• Você pode assinar de novo quando quiser.</li>
                        </ul>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setConfirmandoCancelamento(false)} disabled={isProcessing} className="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-bold text-gray-700 transition hover:bg-gray-200">Manter plano</button>
                            <button onClick={confirmarCancelamento} disabled={isProcessing} className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-700">
                                {isProcessing ? 'Cancelando…' : 'Sim, voltar ao Grátis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                <span className="ml-3 font-medium text-gray-900">Cartão de crédito <span className="text-xs font-normal text-gray-500">(cobrado sozinho a cada ciclo)</span></span>
                            </label>
                        </div>

                        {paymentMethod === 'credit_card' && (
                            <div className="mb-6 space-y-3">
                                <CartaoVisual cartao={cartao} virado={cvvEmFoco} />
                                <input inputMode="numeric" autoComplete="cc-number" placeholder="Número do cartão" value={cartao.numero}
                                    onChange={(e) => setCartao({ ...cartao, numero: mascararNumero(e.target.value) })}
                                    className="w-full rounded-xl border-gray-300 text-sm tracking-wider focus:border-indigo-500 focus:ring-indigo-500" />
                                <input autoComplete="cc-name" placeholder="Nome impresso no cartão" value={cartao.titular}
                                    onChange={(e) => setCartao({ ...cartao, titular: e.target.value.toUpperCase() })}
                                    className="w-full rounded-xl border-gray-300 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input inputMode="numeric" autoComplete="cc-exp" placeholder="Validade (MM/AA)" value={cartao.validade}
                                        onChange={(e) => setCartao({ ...cartao, validade: mascararValidade(e.target.value) })}
                                        className="rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                    <input inputMode="numeric" type="password" autoComplete="cc-csc" placeholder="CVV" maxLength={4} value={cartao.cvv}
                                        onFocus={() => setCvvEmFoco(true)} onBlur={() => setCvvEmFoco(false)}
                                        onChange={(e) => setCartao({ ...cartao, cvv: e.target.value.replace(/\D/g, '') })}
                                        className="rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                                <p className="pt-1 text-xs font-bold uppercase tracking-wide text-gray-400">Dados do titular (exigidos pelo banco)</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <input placeholder="CPF/CNPJ" value={titularCartao.cpf_cnpj} onChange={(e) => setTitularCartao({ ...titularCartao, cpf_cnpj: e.target.value })}
                                        className="col-span-3 rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                    <input inputMode="numeric" placeholder="CEP" value={titularCartao.cep} onChange={(e) => setTitularCartao({ ...titularCartao, cep: e.target.value })}
                                        className="col-span-2 rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                    <input placeholder="Nº" value={titularCartao.numero} onChange={(e) => setTitularCartao({ ...titularCartao, numero: e.target.value })}
                                        className="rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                                <p className="text-[11px] text-gray-400">Pagamento processado pelo Asaas. Os dados do cartão não ficam salvos na Lokyva.{!hasSubscription && ' Nada é cobrado nos 7 dias grátis.'}</p>
                            </div>
                        )}

                        {erroPagamento && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erroPagamento}</p>}

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
                                {isProcessing ? 'Aguarde...' : paymentMethod === 'credit_card' ? 'Confirmar com cartão' : 'Confirmar'}
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