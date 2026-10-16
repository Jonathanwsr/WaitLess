import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdicionaisEscolha from '@/Components/Produtos/AdicionaisEscolha';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
    Share, Heart, Users, BedDouble, Bath, Wifi, Wind, MapPin,
    ImageOff, ChevronRight, CheckCircle2, ChevronDown, Calendar,
    Award, ShieldCheck, Map, Clock, Ban, Dog, Star, Car, Tv,
    Coffee, Flame, Fan, CreditCard, QrCode, FileText, Store,
    Tag, X, Gauge, Fuel, Settings2, Ruler, Package, Info, ScrollText, Phone, Building2
} from 'lucide-react';

const ICONES_REGRA = { clock: Clock, calendar: Calendar, users: Users, doc: ScrollText, shield: ShieldCheck, pet: Dog, star: Award };

/** Ficha técnica: tudo o que o sócio preencheu (marca, ano, quartos, voltagem...), em grade. */
function FichaTecnica({ itens, titulo }) {
    if (!itens?.length) return null;
    return (
        <div className="py-8 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{titulo}</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {itens.map((e) => (
                    <div key={e.rotulo} className="rounded-2xl bg-gray-50 px-4 py-3">
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{e.rotulo}</dt>
                        <dd className="mt-0.5 text-sm font-bold text-gray-900">{e.valor}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function PoliticaCancelamentoCard({ politica }) {
    if (!politica) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h4 className="font-bold text-gray-900 text-sm">Política de cancelamento: {politica.nome}</h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{politica.resumo}</p>
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{politica.longa_duracao}</p>
            <p className="text-[11px] text-gray-500 mt-2">A caução sempre volta inteira. Se o responsável cancelar, você recebe tudo de volta, sem pedir estorno.</p>
        </div>
    );
}

export default function DetalhesItem({ auth, item, ficha = null, avaliacoes = { total: 0, media: null, criterios: {}, previa: [] }, anfitriao = {}, cuponsRecomendados = [], politicaCancelamento = null }) {
    // Textos certos para cada tipo: "noite/hóspedes" numa pousada, "dia/passageiros" num carro.
    const T = ficha?.textos || { unidade: 'dia', unidades: 'dias', inicio: 'Início', fim: 'Fim', pessoa: 'pessoa', pessoas: 'pessoas', sobre: 'Sobre', quem: 'Responsável' };
    const enderecoFicha = ficha?.endereco || null;
    const cidadeTitulo = enderecoFicha?.cidade || item.cidade || null;
    const [isSaved, setIsSaved] = useState(false);
    const [descricaoExpandida, setDescricaoExpandida] = useState(false);
    const descricaoLonga = (item.descricao || '').length > 320;

    // --- FORM INERTIA (Para enviar a reserva) ---
    // Define hoje e amanhã para os valores padrão dos inputs de data
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const aceitaOnline = item.permitir_pagamento !== 'presencial';
    const aceitaPresencial = item.permitir_pagamento !== 'online';

    const { data, setData, post, processing, errors, transform } = useForm({
        data_inicio: today,
        data_fim: tomorrow,
        pessoas: 1,
        quantidade: 1, // sempre 1 unidade deste item — quem varia é o nº de pessoas
        forma_pagamento: aceitaOnline ? 'online' : 'presencial', // Default
        metodo_pagamento: aceitaOnline ? 'pix' : '',
        pontos_utilizados: 0,
        cupom_codigo: '',
        parcelas: 1,
        viagem_id: '',
        extras: [],
    });

    // Adicionais (produtos) escolhidos para esta reserva: { itens: [{id, quantidade}], total, quantidade }.
    const [adicionais, setAdicionais] = useState({ itens: [], total: 0, quantidade: 0 });
    useEffect(() => { setData('extras', adicionais.itens); }, [adicionais]);

    // Veio do "Reservar" da agenda de uma viagem colaborativa — se outro
    // membro do grupo já reservou este mesmo item, sai com desconto de grupo.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlViagemId = params.get('viagem_id');
        if (urlViagemId) setData('viagem_id', urlViagemId);
    }, []);

    // --- CUPOM DE DESCONTO ---
    const [cupomAtivo, setCupomAtivo] = useState(null);
    const [cupomInput, setCupomInput] = useState('');
    const [validandoCupom, setValidandoCupom] = useState(false);
    const [erroCupom, setErroCupom] = useState(null);

    // --- CARTÃO + PARCELAMENTO (valor e parcelas calculados no servidor) ---
    const [cartao, setCartao] = useState({ numero: '', titular: '', mes: '', ano: '', cvv: '' });
    const [cotacao, setCotacao] = useState(null);
    const [erroCotacao, setErroCotacao] = useState(null);
    const pagandoNoCartao = data.forma_pagamento === 'online' && data.metodo_pagamento === 'cartao';
    const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

    const mascararNumeroCartao = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

    useEffect(() => {
        if (!pagandoNoCartao || !data.data_inicio || !data.data_fim || data.data_fim <= data.data_inicio) {
            setCotacao(null);
            return;
        }
        let cancelado = false;
        const timer = setTimeout(async () => {
            try {
                const { data: resposta } = await axios.post(route('itens.cotacao', item.id), {
                    data_inicio: data.data_inicio,
                    data_fim: data.data_fim,
                    pessoas: data.pessoas,
                    quantidade: 1,
                    cupom_codigo: data.cupom_codigo || null,
                    extras: adicionais.itens,
                });
                if (cancelado) return;
                setCotacao(resposta);
                setErroCotacao(null);
                const maximo = resposta.parcelamento?.length || 1;
                if (data.parcelas > maximo) setData('parcelas', maximo);
            } catch (e) {
                if (cancelado) return;
                setCotacao(null);
                setErroCotacao(e.response?.data?.message || 'Não foi possível calcular o parcelamento agora.');
            }
        }, 350);
        return () => { cancelado = true; clearTimeout(timer); };
    }, [pagandoNoCartao, data.data_inicio, data.data_fim, data.pessoas, data.cupom_codigo, adicionais.total]);

    // --- LÓGICA DE CÁLCULO DINÂMICO DE DATAS E PREÇO ---
    const checkIn = new Date(data.data_inicio);
    const checkOut = new Date(data.data_fim);
    const diffTime = checkOut - checkIn;
    const totalDiasCalculado = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 1;

    // Mesma regra do backend (App\Services\PrecificacaoService): "pacote" só cobra quem passa
    // da franquia de pessoas incluídas na diária; "por_pessoa" multiplica o valor cheio pelas pessoas.
    const capacidadePessoas = Number(item.capacidade_pessoas) || 5;
    const valorDiaria = Number(item.valor_diaria || 0);
    const ehPorPessoa = item.modelo_precificacao === 'por_pessoa';
    const pessoasIncluidas = Number(item.pessoas_incluidas) || capacidadePessoas;
    const valorPessoaExtra = Number(item.valor_pessoa_extra) || 0;
    const pessoasExtras = ehPorPessoa ? 0 : Math.max(0, data.pessoas - pessoasIncluidas);
    const valorDiariaComPessoas = ehPorPessoa ? valorDiaria * data.pessoas : valorDiaria + (pessoasExtras * valorPessoaExtra);
    const precoSubtotal = valorDiariaComPessoas * totalDiasCalculado;

    // Datas já esgotadas (ver ItemAluguelController::show / DisponibilidadeService): se algum
    // dia da estadia escolhida cair numa delas, o servidor vai recusar — avisamos antes de tentar.
    const datasIndisponiveis = Array.isArray(item.datas_indisponiveis) ? item.datas_indisponiveis : [];
    const periodoEsgotado = useMemo(() => {
        if (!datasIndisponiveis.length) return false;
        const cursor = new Date(checkIn);
        while (cursor < checkOut) {
            if (datasIndisponiveis.includes(cursor.toISOString().slice(0, 10))) return true;
            cursor.setDate(cursor.getDate() + 1);
        }
        return false;
    }, [data.data_inicio, data.data_fim, datasIndisponiveis.join(',')]);

    // Lógica para mostrar desconto com pontos (Exemplo: Sugere abater 10% se tiver saldo)
    const desconto10Porcento = precoSubtotal * 0.10;
    // 1000 pontos = R$ 1,00 (mesma taxa do servidor, PontosService::PONTOS_POR_REAL).
    const pontosNecessarios10Porcento = Math.floor(desconto10Porcento * 1000);
    const pontosUsuario = auth.user?.pontos_saldo || 0;
    // Pontos liberados quando o item aceita (sugestão de 10%), ou para cliente premium,
    // que usa todo o saldo que quiser, até o valor da reserva.
    const { pontosPremium = {} } = usePage().props;
    const pontosPeloPremium = !!pontosPremium.ativo;
    const itemAceitaPontos = !!item.aceita_pontos || pontosPeloPremium;
    const pontosDoPremium = Math.min(pontosUsuario, Math.floor(precoSubtotal * 1000));
    const pontosParaUsar = pontosPeloPremium ? pontosDoPremium : pontosNecessarios10Porcento;
    const descontoComPontos = pontosParaUsar / 1000;
    const podeUsarPontos = itemAceitaPontos && (pontosPeloPremium ? pontosDoPremium > 0 : pontosUsuario >= pontosNecessarios10Porcento);

    // Prévia do desconto do cupom — o valor final e autoritativo é sempre
    // recalculado no servidor em AgendamentoController::storeAluguel.
    const descontoCupomPreview = cupomAtivo
        ? Math.min(precoSubtotal, cupomAtivo.tipo === 'percentual' ? precoSubtotal * (Number(cupomAtivo.valor) / 100) : Number(cupomAtivo.valor))
        : 0;
    const precoComCupom = Math.max(0, precoSubtotal - descontoCupomPreview);

    // --- FORMATAÇÃO DE DADOS ---
    const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorDiaria);
    const precoTotalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoSubtotal);
    const descontoCupomFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(descontoCupomPreview);
    const precoComCupomFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoComCupom);
    // --- LÓGICA DO MAPA (endereço do item ou, sem ele, do local onde é alugado) ---
    const googleMapsUrl = enderecoFicha?.mapa || null;

    // --- LÓGICA DE FOTOS (FALLBACK PARA SEM IMAGEM) ---
    const fotos = item.fotos && item.fotos.length > 0 ? item.fotos : [];
    const imagensExibicao = Array.from({ length: 6 }).map((_, index) => {
        return fotos[index] || null;
    });

    // --- FUNÇÕES DE SUBMIT DA RESERVA ---
    const realizarReserva = (usarPontos = false) => {
        // `quantidade` (unidades deste item, sempre 1 aqui) e `pessoas` (quantas vão) já vêm de `data`
        // separados — é o que o servidor usa pra calcular o preço e checar a capacidade/disponibilidade.
        const online = data.forma_pagamento === 'online';
        const cartaoPayload = online && data.metodo_pagamento === 'cartao' ? {
            numero: cartao.numero.replace(/\D/g, ''),
            titular: cartao.titular.trim(),
            mes: Number(cartao.mes),
            ano: Number(cartao.ano),
            cvv: cartao.cvv,
        } : undefined;

        transform((d) => ({
            ...d,
            metodo_pagamento: online ? d.metodo_pagamento : null,
            pontos_utilizados: usarPontos && podeUsarPontos ? pontosParaUsar : 0,
            // Com pontos o total muda: o servidor recalcula, então volta pra 1x.
            parcelas: cartaoPayload && !usarPontos ? d.parcelas : 1,
            cartao: cartaoPayload,
        }));

        post(route('itens.reservar', item.id), {
            preserveScroll: true,
            onFinish: () => setCartao((c) => ({ ...c, cvv: '' })),
        });
    };

    const aplicarCupom = () => aplicarCupomCodigo(cupomInput);

    const aplicarCupomCodigo = async (codigoBruto) => {
        const codigo = String(codigoBruto || '').trim();
        if (!codigo) return;
        setErroCupom(null);
        setValidandoCupom(true);
        try {
            const { data: resposta } = await axios.post(route('cupons.validar'), {
                codigo,
                estabelecimento_id: item.estabelecimento_id,
                item_aluguel_id: item.id,
            });
            setCupomAtivo({
                codigo: resposta.cupom.codigo,
                valor: resposta.cupom.valor_desconto,
                tipo: resposta.cupom.tipo_desconto,
            });
            setData('cupom_codigo', resposta.cupom.codigo);
        } catch (e) {
            setErroCupom(e.response?.data?.error || 'Não foi possível validar este cupom.');
            setCupomAtivo(null);
            setData('cupom_codigo', '');
        } finally {
            setValidandoCupom(false);
        }
    };

    const removerCupom = () => {
        setCupomAtivo(null);
        setCupomInput('');
        setErroCupom(null);
        setData('cupom_codigo', '');
    };

    // --- MAPEAMENTO DE ÍCONES PARA COMODIDADES ---
    const getIconForComodidade = (nome) => {
        const n = nome.toLowerCase();
        if (n.includes('wifi') || n.includes('wi-fi')) return <Wifi className="w-5 h-5" />;
        if (n.includes('ar')) return <Wind className="w-5 h-5" />;
        if (n.includes('tv')) return <Tv className="w-5 h-5" />;
        if (n.includes('vaga') || n.includes('estacionamento') || n.includes('garagem')) return <Car className="w-5 h-5" />;
        if (n.includes('pet')) return <Dog className="w-5 h-5" />;
        if (n.includes('churrasqueira')) return <Flame className="w-5 h-5" />;
        if (n.includes('cama')) return <BedDouble className="w-5 h-5" />;
        return <CheckCircle2 className="w-5 h-5" />;
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={cidadeTitulo ? `${item.nome} em ${cidadeTitulo}` : item.nome} />

            <div className="bg-white min-h-screen pb-24 font-sans text-gray-900">

                {/* --- BREADCRUMBS --- */}
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                    <div className="flex items-center text-sm text-gray-500 font-medium">
                        <Link href={route('dashboard')} className="hover:underline">Início</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <Link href={route('cliente.explorar')} className="hover:underline">Destinos</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        {cidadeTitulo && <><span className="hover:underline cursor-pointer">{cidadeTitulo}</span><ChevronRight className="w-4 h-4 mx-2" /></>}
                        <span className="text-gray-900">{item.nome}</span>
                    </div>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">

                    {/* --- GALERIA DE FOTOS --- */}
                    <div className="relative mb-8">
                        {/* Imagem Principal (Topo) */}
                        <div className="w-full h-[400px] md:h-[500px] rounded-t-3xl overflow-hidden bg-gray-100 relative mb-2">
                            {imagensExibicao[0] ? (
                                <img src={imagensExibicao[0]} alt={item.nome} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200/60">
                                    <ImageOff className="w-12 h-12 mb-3 text-gray-300" />
                                    <span className="font-bold text-lg">Sem imagem</span>
                                </div>
                            )}

                            {/* Badges Flutuantes na Imagem Principal (dados reais) */}
                            <div className="absolute top-4 left-4 flex gap-2">
                                {anfitriao?.superanfitriao && (
                                    <div className="bg-[#00A699] text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5">
                                        <Award className="w-3.5 h-3.5" /> Superanfitrião
                                    </div>
                                )}
                                {avaliacoes?.total > 0 ? (
                                    <div className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5">
                                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                        {String(avaliacoes.media).replace('.', ',')} <span className="text-gray-500 font-medium">({avaliacoes.total} {avaliacoes.total === 1 ? 'avaliação' : 'avaliações'})</span>
                                    </div>
                                ) : (
                                    <div className="bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md">Novo no Lokyva</div>
                                )}
                            </div>

                            <button
                                onClick={() => setIsSaved(!isSaved)}
                                className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                            >
                                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                            </button>
                        </div>

                        {/* Grade de 5 Imagens Menores (Embaixo) */}
                        <div className="grid grid-cols-5 gap-2 h-28 md:h-36">
                            {[1, 2, 3, 4, 5].map((index) => (
                                <div key={index} className={`relative bg-gray-100 overflow-hidden ${index === 1 ? 'rounded-bl-3xl' : ''} ${index === 5 ? 'rounded-br-3xl' : ''}`}>
                                    {imagensExibicao[index] ? (
                                        <img src={imagensExibicao[index]} alt={`Foto ${index}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200/60 border border-white/50">
                                            <ImageOff className="w-5 h-5 mb-1 text-gray-300" />
                                            <span className="font-bold text-[10px]">Sem foto</span>
                                        </div>
                                    )}
                                    {/* Overlay com o total real de fotos que não cabem na grade */}
                                    {index === 5 && fotos.length > 6 && (
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white">
                                            <span className="font-bold text-lg">+{fotos.length - 6}</span>
                                            <span className="text-xs font-medium">fotos</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- CONTEÚDO PRINCIPAL (SPLIT LAYOUT) --- */}
                    <div className="flex flex-col lg:flex-row gap-12">

                        {/* LADO ESQUERDO (Detalhes do Local) - 65% */}
                        <div className="lg:w-[65%]">

                            {/* Título e Botões de Ação */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
                                        {item.nome}{cidadeTitulo ? ` em ${cidadeTitulo}` : ''}
                                    </h1>
                                    <p className="text-gray-600 font-medium">
                                        {[ficha?.local?.nome, [enderecoFicha?.cidade, enderecoFicha?.estado].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Endereço combinado com o responsável'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors">
                                        <Share className="w-4 h-4" /> Compartilhar
                                    </button>
                                    <button
                                        onClick={() => setIsSaved(!isSaved)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors"
                                    >
                                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} /> Salvar
                                    </button>
                                </div>
                            </div>

                            {/* Anfitrião (real) */}
                            {anfitriao?.nome && (
                                <div className="flex items-center gap-4 pb-6 mb-6 border-b border-gray-200">
                                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                        {anfitriao.foto ? (
                                            <img src={anfitriao.foto} alt={anfitriao.nome} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-black text-gray-500">{anfitriao.nome.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{T.quem}: {ficha?.local?.nome || anfitriao.nome}</p>
                                        {ficha?.local?.nome && ficha.local.nome !== anfitriao.nome && <p className="text-xs text-gray-500">Responsável: {anfitriao.nome}</p>}
                                        <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                                            {anfitriao.superanfitriao && <span className="inline-flex items-center gap-1 text-[#00A699] font-bold"><Award className="w-4 h-4" /> Superanfitrião</span>}
                                            {anfitriao.desde && <span>No Lokyva desde {anfitriao.desde}</span>}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Ficha Rápida — só o que o anfitrião realmente cadastrou */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700 font-medium pb-8 border-b border-gray-200">
                                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Até {item.capacidade_pessoas || item.lugares || 1} {(item.capacidade_pessoas || item.lugares || 1) === 1 ? T.pessoa : T.pessoas}</span>
                                {(ficha?.especificacoes || []).slice(0, 3).map((e) => <span key={e.rotulo} className="flex items-center gap-1.5"><span>•</span>{e.valor}</span>)}
                                {item.numero_quartos > 0 && <><span>•</span><span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {item.numero_quartos} {item.numero_quartos === 1 ? 'quarto' : 'quartos'}</span></>}
                                {item.numero_banheiros > 0 && <><span>•</span><span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {item.numero_banheiros} {item.numero_banheiros === 1 ? 'banheiro' : 'banheiros'}</span></>}
                                {item.possui_wifi && <><span>•</span><span className="flex items-center gap-1.5"><Wifi className="w-4 h-4" /> Wi-Fi</span></>}
                                {item.possui_ar_condicionado && <><span>•</span><span className="flex items-center gap-1.5"><Wind className="w-4 h-4" /> Ar-condicionado</span></>}
                            </div>

                            {/* Sobre o espaço */}
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">{T.sobre}</h3>
                                <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-line">
                                    {descricaoExpandida || !descricaoLonga ? item.descricao || 'O responsável ainda não escreveu uma descrição. Veja abaixo a ficha com os detalhes cadastrados.' : `${item.descricao.slice(0, 280)}…`}
                                </p>
                                {descricaoLonga && (
                                    <button type="button" onClick={() => setDescricaoExpandida(!descricaoExpandida)} className="text-[#FF5A00] font-bold text-sm hover:underline flex items-center gap-1">
                                        {descricaoExpandida ? 'Mostrar menos' : 'Mostrar mais'} <ChevronRight className={`w-4 h-4 transition-transform ${descricaoExpandida ? '-rotate-90' : ''}`} />
                                    </button>
                                )}

                                {item.numero_vagas > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                                        <div className="border border-gray-200 rounded-2xl p-4 flex items-start gap-4">
                                            <Car className="w-6 h-6 text-gray-700 shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-sm">Estacionamento</h4>
                                                <p className="text-xs text-gray-500">{item.numero_vagas} {item.numero_vagas === 1 ? 'vaga' : 'vagas'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <FichaTecnica titulo={ficha?.perfil === 'veiculo' ? 'Ficha do veículo' : ficha?.perfil === 'hospedagem' ? 'Detalhes da hospedagem' : 'Ficha técnica'} itens={ficha?.especificacoes} />

                            {(ficha?.especificacoes_texto || ficha?.acessorios?.length > 0 || ficha?.observacoes || ficha?.observacoes_disponibilidade) && (
                                <div className="py-8 border-b border-gray-200 space-y-6">
                                    {ficha.especificacoes_texto && (
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Settings2 className="w-5 h-5 text-gray-500" /> Especificações</h4>
                                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{ficha.especificacoes_texto}</p>
                                        </div>
                                    )}
                                    {ficha.acessorios?.length > 0 && (
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Package className="w-5 h-5 text-gray-500" /> O que vem junto</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ficha.acessorios.map((a) => <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {a}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {(ficha.observacoes || ficha.observacoes_disponibilidade) && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                            <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-2"><Info className="w-5 h-5" /> Informações importantes</h4>
                                            {ficha.observacoes && <p className="text-sm text-amber-900 whitespace-pre-line">{ficha.observacoes}</p>}
                                            {ficha.observacoes_disponibilidade && <p className="text-sm text-amber-900 whitespace-pre-line mt-2">{ficha.observacoes_disponibilidade}</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Localização com Mapa */}
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Localização</h3>
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        {enderecoFicha ? (
                                            <>
                                                {enderecoFicha.linha1 && <p className="text-gray-800 font-medium">{enderecoFicha.linha1}</p>}
                                                <p className="text-gray-500 text-sm">{[enderecoFicha.linha2, enderecoFicha.cep ? `CEP ${enderecoFicha.cep}` : null].filter(Boolean).join(' · ')}</p>
                                                {enderecoFicha.do_local && ficha?.local?.nome && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Endereço de {ficha.local.nome}</p>}
                                            </>
                                        ) : (
                                            <p className="text-gray-500 text-sm">O endereço é combinado com o responsável depois da reserva.</p>
                                        )}
                                        {ficha?.local?.telefone && <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5"><Phone className="w-4 h-4" /> {ficha.local.telefone}</p>}
                                        <div className="mb-4" />

                                        {/* Redirecionamento Dinâmico para Maps/Waze */}
                                        {googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="block relative w-full h-48 bg-blue-50 rounded-2xl overflow-hidden border border-gray-200 group">
                                            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <MapPin className="w-10 h-10 text-[#FF5A00] drop-shadow-md group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div className="absolute bottom-3 left-3">
                                                <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-gray-50">
                                                    <Map className="w-4 h-4" /> Ver no mapa
                                                </button>
                                            </div>
                                        </a>}
                                    </div>

                                </div>
                            </div>

                            {/* Comodidades */}
                            {(ficha?.perfil === 'hospedagem' || ficha?.perfil === 'espaco' || item.recursos_oferecidos?.length > 0) && (
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">{ficha?.perfil === 'hospedagem' || ficha?.perfil === 'espaco' ? 'Comodidades' : 'Recursos'}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                                    {item.recursos_oferecidos && item.recursos_oferecidos.length > 0 ? (
                                        item.recursos_oferecidos.map((recurso, idx) => (
                                            <div key={idx} className="flex items-center gap-3 text-gray-700 border border-gray-100 p-3 rounded-xl">
                                                {getIconForComodidade(recurso)}
                                                <span className="text-sm font-medium">{recurso}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-3 text-gray-500 text-sm">Nenhuma comodidade específica listada.</div>
                                    )}
                                </div>
                            </div>
                            )}

                            {/* Avaliações (reais) */}
                            <div className="py-8">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{ficha?.perfil === 'hospedagem' ? 'Avaliações dos hóspedes' : 'Avaliações dos clientes'}</h3>
                                        {avaliacoes?.total > 0 ? (
                                            <div className="flex items-end gap-3">
                                                <span className="text-5xl font-black text-gray-900 tracking-tighter">{String(avaliacoes.media).replace('.', ',')}</span>
                                                <div className="pb-1">
                                                    <div className="flex text-yellow-400 mb-0.5">
                                                        {[1, 2, 3, 4, 5].map((n) => (
                                                            <Star key={n} className={`w-4 h-4 ${n <= Math.round(avaliacoes.media) ? 'fill-current' : 'text-gray-300'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="text-sm text-gray-500 font-medium">{avaliacoes.total} {avaliacoes.total === 1 ? 'avaliação' : 'avaliações'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">Ainda sem avaliações. Seja o primeiro a reservar e avaliar.</p>
                                        )}
                                    </div>
                                    {avaliacoes?.total > 0 && (
                                        <Link
                                            href={route('avaliacoes.pagina', item.estabelecimento_id || item.id)}
                                            className="text-[#FF5A00] font-bold text-sm hover:underline"
                                        >
                                            Ver todas as avaliações
                                        </Link>
                                    )}
                                </div>

                                {Object.keys(avaliacoes?.criterios || {}).length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3 mb-8">
                                        {Object.entries(avaliacoes.criterios).map(([nome, nota]) => (
                                            <div key={nome} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-700">{nome}</span>
                                                <div className="flex items-center gap-3 w-1/2">
                                                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-900" style={{ width: `${(nota / 5) * 100}%` }}></div></div>
                                                    <span className="font-bold text-gray-900">{String(nota).replace('.', ',')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {(avaliacoes?.previa || []).map((a, i) => (
                                        <div key={i} className="bg-gray-50 p-5 rounded-2xl">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
                                                        {a.foto ? <img src={a.foto} alt={a.autor} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-gray-500" />}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-bold text-gray-900 text-sm">{a.autor}</h5>
                                                        <p className="text-xs text-gray-500 capitalize">{a.data}</p>
                                                    </div>
                                                </div>
                                                <span className="flex items-center gap-1 text-sm font-bold text-gray-900"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {String(a.nota).replace('.', ',')}</span>
                                            </div>
                                            {a.comentario && <p className="text-gray-700 text-sm leading-relaxed">{a.comentario}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ============================================================== */}
                        {/* LADO DIREITO (Sidebar Sticky - Formulário de Reserva) - 35% */}
                        {/* ============================================================== */}
                        <div className="lg:w-[35%]">
                            <div className="sticky top-8 space-y-6">

                                {/* CAIXA DE RESERVA PRINCIPAL (O FORMULÁRIO) */}
                                <div className="bg-white border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl p-6">
                                    <div className="mb-6">
                                        <span className="text-2xl font-black text-gray-900">{precoFormatado}</span>
                                        <span className="text-gray-500 font-medium"> / {T.unidade}</span>
                                        {(ficha?.precos || []).filter((p) => p.rotulo !== 'Diária').length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {ficha.precos.filter((p) => p.rotulo !== 'Diária').map((p) => (
                                                    <span key={p.rotulo} className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600"><b className="text-gray-900">{brl(p.valor)}</b> · {p.rotulo}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Banner de Desconto com Pontos dinâmico */}
                                    {itemAceitaPontos && (
                                        <div className="bg-[#FFF5F0] border border-[#FFE4D6] rounded-xl p-4 flex items-start gap-3 mb-6">
                                            <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                                <Award className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-[#D04A02]">{pontosPeloPremium ? 'Premium: use seus pontos à vontade' : '10% de desconto com pontos'}</h4>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    Use {pontosParaUsar.toLocaleString('pt-BR')} pts e economize R$ {descontoComPontos.toFixed(2).replace('.', ',')}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- INPUTS REAIS DO INERTIA MAS COM O DESIGN DA IMAGEM --- */}
                                    <div className="border border-gray-300 rounded-xl overflow-hidden mb-4 focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-all">
                                        <div className="flex border-b border-gray-300">
                                            <div className="flex-1 p-3 border-r border-gray-300 bg-white hover:bg-gray-50 transition-colors relative">
                                                <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">{T.inicio}</label>
                                                <input
                                                    type="date"
                                                    value={data.data_inicio}
                                                    min={today}
                                                    onChange={e => setData('data_inicio', e.target.value)}
                                                    className="w-full border-0 p-0 text-sm text-gray-900 font-medium focus:ring-0 cursor-pointer bg-transparent"
                                                />
                                                {errors.data_inicio && <span className="text-red-500 text-xs">{errors.data_inicio}</span>}
                                            </div>
                                            <div className="flex-1 p-3 bg-white hover:bg-gray-50 transition-colors relative">
                                                <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">{T.fim}</label>
                                                <input
                                                    type="date"
                                                    value={data.data_fim}
                                                    min={data.data_inicio}
                                                    onChange={e => setData('data_fim', e.target.value)}
                                                    className="w-full border-0 p-0 text-sm text-gray-900 font-medium focus:ring-0 cursor-pointer bg-transparent"
                                                />
                                                {errors.data_fim && <span className="text-red-500 text-xs">{errors.data_fim}</span>}
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white hover:bg-gray-50 transition-colors relative">
                                            <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">{T.pessoas.charAt(0).toUpperCase() + T.pessoas.slice(1)}</label>
                                            <div className="flex justify-between items-center text-sm text-gray-900 font-medium">
                                                <select
                                                    value={data.pessoas}
                                                    onChange={e => setData('pessoas', Number(e.target.value))}
                                                    className="w-full border-0 p-0 focus:ring-0 cursor-pointer bg-transparent appearance-none"
                                                >
                                                    {[...Array(item.capacidade_pessoas || item.lugares || 5)].map((_, i) => (
                                                        <option key={i+1} value={i+1}>{i+1} {i > 0 ? T.pessoas : T.pessoa}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none absolute right-3" />
                                            </div>
                                            {errors.pessoas && <span className="text-red-500 text-xs">{errors.pessoas}</span>}
                                        </div>
                                    </div>

                                    {!!data.viagem_id && (
                                        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mb-4 text-sm text-gray-700">
                                            Reservando com o grupo da sua viagem. Se outra pessoa do grupo já reservou este item, vocês ganham desconto e pontos de bônus.
                                        </div>
                                    )}

                                    {/* --- FORMA DE PAGAMENTO --- */}
                                    {(aceitaOnline || aceitaPresencial) && (
                                        <div className="mb-4">
                                            <label className="block text-[10px] font-bold text-gray-800 uppercase mb-2">Forma de pagamento</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {aceitaOnline && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setData('forma_pagamento', 'online'); setData('metodo_pagamento', 'pix'); }}
                                                            className={`flex items-center gap-2 border rounded-lg p-2.5 text-xs font-bold transition ${data.forma_pagamento === 'online' && data.metodo_pagamento === 'pix' ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                        >
                                                            <QrCode className="w-4 h-4" /> Pix
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setData('forma_pagamento', 'online'); setData('metodo_pagamento', 'cartao'); }}
                                                            className={`flex items-center gap-2 border rounded-lg p-2.5 text-xs font-bold transition ${data.forma_pagamento === 'online' && data.metodo_pagamento === 'cartao' ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                        >
                                                            <CreditCard className="w-4 h-4" /> Cartão
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setData('forma_pagamento', 'online'); setData('metodo_pagamento', 'boleto'); }}
                                                            className={`flex items-center gap-2 border rounded-lg p-2.5 text-xs font-bold transition ${data.forma_pagamento === 'online' && data.metodo_pagamento === 'boleto' ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                        >
                                                            <FileText className="w-4 h-4" /> Boleto
                                                        </button>
                                                    </>
                                                )}
                                                {aceitaPresencial && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setData('forma_pagamento', 'presencial'); setData('metodo_pagamento', ''); }}
                                                        className={`flex items-center gap-2 border rounded-lg p-2.5 text-xs font-bold transition ${data.forma_pagamento === 'presencial' ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                    >
                                                        <Store className="w-4 h-4" /> No local
                                                    </button>
                                                )}
                                            </div>
                                            {errors.metodo_pagamento && <span className="text-red-500 text-xs block mt-1">{errors.metodo_pagamento}</span>}
                                            {errors.forma_pagamento && <span className="text-red-500 text-xs block mt-1">{errors.forma_pagamento}</span>}
                                        </div>
                                    )}

                                    {/* --- DADOS DO CARTÃO + PARCELAS (cobrança real via Asaas) --- */}
                                    {pagandoNoCartao && (
                                        <div className="mb-4 border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                                            <label className="block text-[10px] font-bold text-gray-800 uppercase">Dados do cartão</label>
                                            <input
                                                type="text" inputMode="numeric" autoComplete="cc-number" placeholder="Número do cartão"
                                                value={cartao.numero} onChange={(e) => setCartao({ ...cartao, numero: mascararNumeroCartao(e.target.value) })}
                                                className="w-full rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                            />
                                            {errors['cartao.numero'] && <p className="text-red-500 text-xs">{errors['cartao.numero']}</p>}
                                            <input
                                                type="text" autoComplete="cc-name" placeholder="Nome impresso no cartão"
                                                value={cartao.titular} onChange={(e) => setCartao({ ...cartao, titular: e.target.value.toUpperCase() })}
                                                className="w-full rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                            />
                                            {errors['cartao.titular'] && <p className="text-red-500 text-xs">{errors['cartao.titular']}</p>}
                                            <div className="grid grid-cols-3 gap-2">
                                                <input
                                                    type="text" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2}
                                                    value={cartao.mes} onChange={(e) => setCartao({ ...cartao, mes: e.target.value.replace(/\D/g, '') })}
                                                    className="rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                />
                                                <input
                                                    type="text" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AA" maxLength={4}
                                                    value={cartao.ano} onChange={(e) => setCartao({ ...cartao, ano: e.target.value.replace(/\D/g, '') })}
                                                    className="rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                />
                                                <input
                                                    type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" maxLength={4}
                                                    value={cartao.cvv} onChange={(e) => setCartao({ ...cartao, cvv: e.target.value.replace(/\D/g, '') })}
                                                    className="rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                />
                                            </div>
                                            {(errors['cartao.mes'] || errors['cartao.ano'] || errors['cartao.cvv']) && (
                                                <p className="text-red-500 text-xs">{errors['cartao.mes'] || errors['cartao.ano'] || errors['cartao.cvv']}</p>
                                            )}

                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-800 uppercase mb-1">Parcelas</label>
                                                {cotacao ? (
                                                    <select
                                                        value={data.parcelas}
                                                        onChange={(e) => setData('parcelas', Number(e.target.value))}
                                                        className="w-full rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                    >
                                                        {cotacao.parcelamento.map((o) => (
                                                            <option key={o.parcelas} value={o.parcelas}>
                                                                {o.parcelas === 1 ? `À vista — ${brl(o.total)}` : `${o.parcelas}x de ${brl(o.valor_parcela)} sem juros`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-xs text-gray-500">{erroCotacao || 'Calculando parcelas…'}</p>
                                                )}
                                                {cotacao && (
                                                    <p className="text-xs text-gray-500 mt-1.5">
                                                        Total a pagar: <strong className="text-gray-900">{brl(cotacao.total)}</strong>
                                                        {cotacao.caucao > 0 && <> (inclui caução de {brl(cotacao.caucao)})</>}
                                                    </p>
                                                )}
                                            </div>

                                            {errors.cartao && typeof errors.cartao === 'string' && <p className="text-red-600 text-xs font-bold">{errors.cartao}</p>}
                                            <p className="text-[10px] text-gray-400 leading-snug">Pagamento processado com segurança pelo Asaas. Os dados do cartão não ficam salvos no Lokyva.</p>
                                        </div>
                                    )}
                                    {errors.error && <p className="text-red-600 text-xs font-bold mb-3">{errors.error}</p>}


                                    {/* --- CUPONS RECOMENDADOS PARA ESTE ITEM --- */}
                                    {cuponsRecomendados.length > 0 && (
                                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                                            <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Cupons para você</p>
                                            <div className="space-y-2">
                                                {cuponsRecomendados.map((c) => (
                                                    <div key={c.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-emerald-100">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{c.titulo}</p>
                                                            <p className="text-[11px] text-gray-500">
                                                                {c.tipo_desconto === 'percentual' ? `${c.valor_desconto}% OFF` : `R$ ${Number(c.valor_desconto).toFixed(2).replace('.', ',')} OFF`}
                                                                {c.escopo !== 'local' && ' · exclusivo deste item'}
                                                                {c.apenas_plus && ' · Premium'}
                                                            </p>
                                                        </div>
                                                        {c.bloqueado ? (
                                                            <span className="text-[11px] font-bold text-gray-400 shrink-0">Premium</span>
                                                        ) : c.resgatado ? (
                                                            <button type="button" onClick={() => { setCupomInput(c.codigo); aplicarCupomCodigo(c.codigo); }} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shrink-0">Aplicar</button>
                                                        ) : (
                                                            <button type="button" onClick={() => router.post(route('cliente.resgatar.cupom', c.id), {}, { preserveScroll: true })} className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg shrink-0">
                                                                {c.pontos_custo > 0 ? `Resgatar (${c.pontos_custo} pts)` : 'Resgatar grátis'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* --- CUPOM DE DESCONTO --- */}
                                    <div className="mb-4">
                                        <label className="block text-[10px] font-bold text-gray-800 uppercase mb-2">Cupom de desconto</label>
                                        {cupomAtivo ? (
                                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                                                <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> {cupomAtivo.codigo} aplicado</span>
                                                <button type="button" onClick={removerCupom} className="text-emerald-600 hover:text-emerald-800">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={cupomInput}
                                                    onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
                                                    placeholder="Digite o código"
                                                    className="flex-1 rounded-lg border-gray-300 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                    disabled={validandoCupom || processing}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={aplicarCupom}
                                                    disabled={validandoCupom || processing || !cupomInput.trim()}
                                                    className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 shrink-0"
                                                >
                                                    {validandoCupom ? '...' : 'Aplicar'}
                                                </button>
                                            </div>
                                        )}
                                        {erroCupom && <p className="text-red-500 text-xs font-medium mt-1.5">{erroCupom}</p>}
                                    </div>

                                    {/* Resumo dinâmico do Total */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center text-gray-600 font-medium">
                                            <span className="underline cursor-help">
                                                {ehPorPessoa
                                                    ? `${precoFormatado} x ${data.pessoas} ${data.pessoas > 1 ? T.pessoas : T.pessoa} x ${totalDiasCalculado} ${totalDiasCalculado > 1 ? T.unidades : T.unidade}`
                                                    : `${precoFormatado} x ${totalDiasCalculado} ${totalDiasCalculado > 1 ? T.unidades : T.unidade}`}
                                            </span>
                                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorDiaria * (ehPorPessoa ? data.pessoas : 1) * totalDiasCalculado)}</span>
                                        </div>
                                        {!ehPorPessoa && pessoasExtras > 0 && (
                                            <div className="flex justify-between items-center text-gray-600 font-medium mt-2">
                                                <span>{pessoasExtras} pessoa{pessoasExtras > 1 ? 's' : ''} extra x R$ {valorPessoaExtra.toFixed(2).replace('.', ',')} x {totalDiasCalculado} {totalDiasCalculado > 1 ? T.unidades : T.unidade}</span>
                                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pessoasExtras * valorPessoaExtra * totalDiasCalculado)}</span>
                                            </div>
                                        )}
                                        {cupomAtivo && (
                                            <div className="flex justify-between items-center text-emerald-600 font-bold text-sm mt-2">
                                                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Cupom {cupomAtivo.codigo}</span>
                                                <span>- {descontoCupomFormatado}</span>
                                            </div>
                                        )}
                                        {cupomAtivo && (
                                            <div className="flex justify-between items-center text-gray-900 font-bold text-sm mt-2 pt-2 border-t border-gray-100">
                                                <span>Total com cupom</span>
                                                <span>{precoComCupomFormatado}</span>
                                            </div>
                                        )}
                                        {adicionais.quantidade > 0 && (
                                            <div className="flex justify-between items-center text-gray-600 font-medium mt-2">
                                                <span>Adicionais ({adicionais.quantidade})</span>
                                                <span>+ {brl(adicionais.total)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Produtos adicionais oferecidos para esta reserva */}
                                    <div className="mb-6 -mt-2">
                                        <AdicionaisEscolha itemId={item.id} onChange={setAdicionais} contexto="reserva" />
                                    </div>

                                    {periodoEsgotado && (
                                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl p-3 mb-3">
                                            <Ban className="w-4 h-4 shrink-0" /> Esgotado nessas datas. Escolha outro período.
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <button
                                            disabled={processing || periodoEsgotado}
                                            onClick={() => realizarReserva(false)}
                                            className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                        >
                                            {processing ? 'Processando...' : periodoEsgotado ? 'Esgotado nessas datas' : 'Fazer reserva'}
                                        </button>

                                        {itemAceitaPontos && (
                                            <button
                                                disabled={processing || periodoEsgotado || !podeUsarPontos}
                                                onClick={() => realizarReserva(true)}
                                                className="w-full bg-[#FFF0E5] hover:bg-[#FFE4D6] text-[#FF5A00] py-3.5 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                                                title={!podeUsarPontos ? "Saldo insuficiente" : "Usar pontos para desconto"}
                                            >
                                                Reservar com pontos
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-center text-xs text-gray-500 font-medium mt-4">
                                        Você tem <span className="text-[#FF5A00] font-bold">{pontosUsuario} pts</span> disponíveis
                                    </p>
                                </div>

                                <PoliticaCancelamentoCard politica={politicaCancelamento} />

                                {/* BOX: Acumule pontos */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1 text-sm">Acumule pontos nesta reserva</h4>
                                        <p className="font-black text-base text-gray-900">Você ganha {Math.floor(precoSubtotal)} pts</p>
                                        <p className="text-xs text-gray-500 mt-1">Ao concluir a reserva</p>
                                    </div>
                                    <div className="w-12 h-12 bg-[#FFF0E5] rounded-full flex items-center justify-center shrink-0">
                                        <Award className="w-6 h-6 text-[#FF5A00]" />
                                    </div>
                                </div>

                                {/* BOX: Destaques das avaliações (só com base nas notas reais) */}
                                {Object.entries(avaliacoes?.criterios || {}).filter(([, nota]) => nota >= 4.5).length > 0 && (
                                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                        <h4 className="font-bold text-gray-900 mb-5">Por que os clientes gostam</h4>
                                        <div className="space-y-4">
                                            {Object.entries(avaliacoes.criterios).filter(([, nota]) => nota >= 4.5).slice(0, 3).map(([nome, nota]) => (
                                                <div key={nome} className="flex gap-3">
                                                    <CheckCircle2 className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">{nome}</p>
                                                        <p className="text-xs text-gray-500">Nota {String(nota).replace('.', ',')} de 5 nas avaliações</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* BOX: Descontos e benefícios (só o que este item realmente oferece) */}
                                {(item.aceita_pontos || item.tem_promocao) && (
                                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                        <h4 className="font-bold text-gray-900 mb-5">Descontos e benefícios</h4>
                                        <div className="space-y-4">
                                            {item.aceita_pontos && (
                                                <div className="flex gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                        <Award className="w-4 h-4 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">Use seus pontos</p>
                                                        <p className="text-xs text-gray-500">Abata parte do valor com seus pontos acumulados</p>
                                                    </div>
                                                </div>
                                            )}
                                            {item.tem_promocao && item.valor_desconto > 0 && (
                                                <div className="flex gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                                        <Tag className="w-4 h-4 text-[#FF5A00]" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">Promoção do anfitrião</p>
                                                        <p className="text-xs text-gray-500">{item.tipo_desconto === 'percentual' ? `${Number(item.valor_desconto)}% de desconto` : `${brl(item.valor_desconto)} de desconto`} já aplicado no valor final</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* BOX: Políticas / Retirada e devolução (local de retirada e entrega só existe p/ itens e veículos) */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-5">{ficha?.retirada ? 'Retirada, devolução e regras' : 'Regras e horários'}</h4>
                                    <div className="space-y-3 text-sm text-gray-700 font-medium">
                                        {ficha?.retirada && (
                                            <>
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="w-4 h-4 text-[#FF5A00] shrink-0 mt-0.5" />
                                                    <span><b>Retirada:</b> {ficha.retirada.endereco || 'combinar com o responsável'}{ficha.retirada.horario ? ` · a partir das ${ficha.retirada.horario}` : ''}</span>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="w-4 h-4 text-[#FF5A00] shrink-0 mt-0.5" />
                                                    <span><b>Devolução:</b> {ficha.devolucao?.endereco || ficha.retirada.endereco || 'combinar com o responsável'}{ficha.devolucao?.horario ? ` · até ${ficha.devolucao.horario}` : ''}</span>
                                                </div>
                                            </>
                                        )}
                                        {(ficha?.regras || []).map((regra) => {
                                            const Icone = ICONES_REGRA[regra.icone] || CheckCircle2;
                                            return (
                                                <div key={regra.texto} className="flex items-start gap-3">
                                                    <Icone className="w-4 h-4 text-[#FF5A00] shrink-0 mt-0.5" />
                                                    <span>{regra.texto}</span>
                                                </div>
                                            );
                                        })}
                                        {!ficha && (item.permite_entrega ? null : (
                                            <>
                                                <div className="flex items-center gap-3">
                                                    <Clock className="w-4 h-4 text-[#FF5A00]" /> Chegada: {item.horario_retirada || '14h às 22h'}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Clock className="w-4 h-4 text-[#FF5A00]" /> Saída: até {item.horario_entrega || '11h'}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {item.aceita_pet ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Ban className="w-4 h-4 text-[#FF5A00]" />}
                                                    {item.aceita_pet ? 'Pets são bem-vindos' : 'Pets não permitidos'}
                                                </div>
                                            </>
                                        ))}
                                    </div>
                                    {item.informacoes_extras && (
                                        <p className="mt-4 text-sm text-gray-600 whitespace-pre-line border-t border-gray-100 pt-4">{item.informacoes_extras}</p>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}