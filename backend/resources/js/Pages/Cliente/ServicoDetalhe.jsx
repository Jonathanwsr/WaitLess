import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InfoAtendimento, { SelosAtendimento } from '@/Components/Servicos/InfoAtendimento';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    ClockIcon, ChatBubbleLeftRightIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon,
    QrCodeIcon, CreditCardIcon, BuildingStorefrontIcon, DocumentTextIcon, UserIcon,
    SparklesIcon, MapPinIcon, InformationCircleIcon, HeartIcon, ShoppingCartIcon, CheckIcon,
    ExclamationTriangleIcon, LockClosedIcon, CalendarDaysIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid, HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

const COR = '#FF5A00';
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DIAS_CURTOS = { domingo: 'Dom', segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const img = (u) => (!u ? null : u.startsWith('http') || u.startsWith('/') || u.startsWith('data:') ? u : `/storage/${u}`);
const diaBr = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');
const SEM_FOTO = 'https://placehold.co/900x1100/f3f4f6/9ca3af?text=Servi%C3%A7o';

const FORMAS = {
    online: [{ icone: QrCodeIcon, rotulo: 'Pix' }, { icone: CreditCardIcon, rotulo: 'Cartão' }, { icone: DocumentTextIcon, rotulo: 'Boleto' }],
    presencial: [{ icone: BuildingStorefrontIcon, rotulo: 'No local' }],
};

function Estrelas({ nota, tamanho = 'h-4 w-4' }) {
    return (
        <span className="inline-flex">
            {[1, 2, 3, 4, 5].map((n) => <StarSolid key={n} className={`${tamanho} ${n <= Math.round(nota) ? 'text-amber-400' : 'text-gray-200'}`} />)}
        </span>
    );
}

function Galeria({ fotos, nome, favorito, onFavoritar }) {
    const [i, setI] = useState(0);
    const lista = fotos.length ? fotos.map(img) : [SEM_FOTO];
    const ir = (d) => setI((i + d + lista.length) % lista.length);

    return (
        <div className="relative h-[360px] overflow-hidden rounded-3xl bg-gray-100 sm:h-[480px] lg:h-[calc(100vh-7.5rem)] lg:min-h-[560px]">
            <img src={lista[i]} alt={nome} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />

            <button type="button" onClick={onFavoritar} aria-label={favorito ? 'Tirar dos favoritos' : 'Salvar nos favoritos'}
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg transition hover:scale-105">
                {favorito ? <HeartSolid className="h-6 w-6 text-red-500" /> : <HeartIcon className="h-6 w-6 text-gray-700" />}
            </button>

            {lista.length > 1 && (
                <>
                    <button type="button" onClick={() => ir(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg hover:bg-white" aria-label="Foto anterior">
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => ir(1)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg hover:bg-white" aria-label="Próxima foto">
                        <ChevronRightIcon className="h-5 w-5" />
                    </button>
                    <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                        <div className="flex gap-2 overflow-x-auto">
                            {lista.map((f, k) => (
                                <button key={k} type="button" onClick={() => setI(k)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-16 sm:w-16 ${k === i ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                                    <img src={f} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                        <span className="shrink-0 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{i + 1}/{lista.length}</span>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ServicoDetalhe({
    servico, estabelecimento, profissionais = [], outrosServicos = [], ocupados = {}, avaliacoes = null,
    favorito: favoritoInicial = false, noCarrinho = false, pontosPorReal = 1000, donoId = null,
}) {
    const { auth, pontosPremium = {} } = usePage().props;
    const saldo = Number(auth?.user?.pontos_saldo || 0);
    const premium = Boolean(pontosPremium?.ativo);
    const [favorito, setFavorito] = useState(favoritoInicial);
    const [aviso, setAviso] = useState(null);

    // Próximos dias em que o serviço atende.
    const dias = useMemo(() => {
        const lista = [];
        const d = new Date();
        for (let i = 0; i < 15 && lista.length < 10; i += 1) {
            const nome = DIAS[d.getDay()];
            if (!servico.dias_disponiveis.length || servico.dias_disponiveis.includes(nome)) {
                lista.push({ iso: isoLocal(d), semana: DIAS_CURTOS[nome], dia: d.getDate(), mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
            }
            d.setDate(d.getDate() + 1);
        }
        return lista;
    }, [servico.dias_disponiveis]);

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const [dia, setDia] = useState(dias.some((d) => d.iso === params.get('data')) ? params.get('data') : dias[0]?.iso || '');
    const [hora, setHora] = useState('');
    const [conflito, setConflito] = useState(null); // { hora, motivo, sugestoes }
    const [verificando, setVerificando] = useState(false);

    const agora = new Date();
    const hojeIso = isoLocal(agora);
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const passou = (h) => dia === hojeIso && h <= horaAtual;
    const lotado = (h) => (ocupados[dia] || []).includes(h);
    const livresDoDia = servico.horarios.filter((h) => !passou(h) && !lotado(h));

    const escolherHora = (h) => {
        if (passou(h)) return;
        if (lotado(h)) {
            setHora('');
            setConflito({ hora: h, motivo: 'Já tem alguém agendado nesse horário. Escolha outro.', sugestoes: livresDoDia.filter((x) => x > h).slice(0, 4) });
            return;
        }
        setConflito(null);
        setHora(h);
    };

    // Vindo de "Outros serviços" com um horário já clicado.
    useEffect(() => {
        const h = params.get('hora');
        if (h && servico.horarios.includes(h)) escolherHora(h);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pontos: Premium usa em qualquer serviço; os demais só onde o serviço aceita (e até o limite dele).
    const podeUsarPontos = premium || servico.aceita_pontos;
    const pontosPeloPremium = premium && !servico.aceita_pontos;
    const limitePeloValor = Math.floor(servico.valor_com_promocao * pontosPorReal);
    const limiteDoServico = !premium && servico.maximo_pontos_permitidos ? servico.maximo_pontos_permitidos : Infinity;
    const maxPontos = podeUsarPontos ? Math.max(0, Math.min(saldo, limitePeloValor, limiteDoServico)) : 0;
    const passo = Math.max(1, Math.round(pontosPorReal / 100));
    const [pontos, setPontos] = useState(0);
    const descontoPontos = pontos / pontosPorReal;
    const descontoPromocao = servico.valor - servico.valor_com_promocao;
    // Serviço que só acontece onde o cliente está: a taxa de deslocamento entra no total.
    const taxaDeslocamento = servico.atendimento?.modalidade === 'a_domicilio' ? Number(servico.atendimento.taxa_deslocamento || 0) : 0;
    const valorFinal = Math.max(0, servico.valor_com_promocao - descontoPontos) + taxaDeslocamento;

    const formas = servico.tipo_pagamento === 'online' ? FORMAS.online
        : servico.tipo_pagamento === 'presencial' ? FORMAS.presencial
            : [...FORMAS.online, ...FORMAS.presencial];
    const textoPagamento = servico.tipo_pagamento === 'online' ? 'Pagamento online' : servico.tipo_pagamento === 'presencial' ? 'Pagamento no local' : 'Online ou no local';
    const precisaHorario = servico.horarios.length > 0;
    // Sem horários fixos: o cliente combina o horário direto com o proprietário (chat ou telefone).
    const aCombinar = !!servico.horario_a_combinar;
    const telefoneLocal = String(estabelecimento.telefone || '').replace(/\D/g, '');

    const favoritar = async () => {
        const antes = favorito;
        setFavorito(!antes);
        try {
            const { data } = await axios.post('/favoritos/toggle', { tipo: 'servico', id: servico.id });
            setFavorito(Boolean(data.is_favorito));
            setAviso({ tipo: 'ok', texto: data.is_favorito ? 'Salvo nos seus favoritos.' : 'Removido dos favoritos.' });
        } catch {
            setFavorito(antes);
            setAviso({ tipo: 'erro', texto: 'Não foi possível atualizar os favoritos agora.' });
        }
    };

    const porNoCarrinho = () => {
        router.post('/carrinho/adicionar', { servico_id: servico.id, estabelecimento_id: estabelecimento.id, quantidade: 1 }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setAviso({ tipo: 'ok', texto: 'Serviço no carrinho. Você pode finalizar junto com outros itens.' }),
            onError: () => setAviso({ tipo: 'erro', texto: 'Não foi possível adicionar ao carrinho.' }),
        });
    };

    const agendar = async () => {
        if (precisaHorario && !hora) {
            setConflito({ hora: null, motivo: 'Escolha um dia e um horário para continuar.', sugestoes: livresDoDia.slice(0, 4) });
            document.getElementById('horarios')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        // Confere na hora: alguém pode ter acabado de reservar o mesmo horário.
        if (hora) {
            setVerificando(true);
            try {
                const { data } = await axios.get(route('cliente.servicos.disponibilidade', servico.id), { params: { data: dia, hora } });
                if (!data.livre) {
                    setHora('');
                    setConflito({ hora, motivo: data.motivo, sugestoes: data.sugestoes || [] });
                    setVerificando(false);
                    return;
                }
            } catch {
                // Sem resposta: o checkout confere de novo antes de cobrar.
            }
        }
        router.visit(route('cliente.agendar', {
            estabelecimento: estabelecimento.id,
            servico_id: servico.id,
            data: dia,
            ...(hora ? { hora } : {}),
            ...(pontos > 0 ? { usar_pontos: 1, pontos } : {}),
        }));
    };

    const conversar = () => {
        if (!donoId) return;
        router.post(route('mensagens.iniciar'), { usuario_id: donoId, estabelecimento_id: estabelecimento.id });
    };

    const nomesDias = servico.dias_disponiveis.map((d) => DIAS_CURTOS[d]).filter(Boolean);
    const nota = avaliacoes?.media || servico.avaliacao_media;
    const totalAval = avaliacoes?.total || servico.total_avaliacoes;

    return (
        <AuthenticatedLayout>
            <Head title={servico.nome} />

            <div className="mx-auto max-w-7xl space-y-6">
                <nav className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                    <Link href={route('home')} className="hover:text-gray-800">Início</Link>
                    <ChevronRightIcon className="h-3 w-3" />
                    {route().has('cliente.explorar') ? <Link href={route('cliente.explorar')} className="hover:text-gray-800">Explorar</Link> : <span>Explorar</span>}
                    <ChevronRightIcon className="h-3 w-3" />
                    <span>{estabelecimento.nome}</span>
                    <ChevronRightIcon className="h-3 w-3" />
                    <span className="font-semibold text-gray-800">{servico.nome}</span>
                </nav>

                {aviso && (
                    <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                        <span>{aviso.texto}</span>
                        <button type="button" onClick={() => setAviso(null)} className="text-xs underline">fechar</button>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* ===== ESQUERDA: FOTO GRANDE ===== */}
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <Galeria fotos={servico.fotos} nome={servico.nome} favorito={favorito} onFavoritar={favoritar} />
                    </div>

                    {/* ===== DIREITA: INFORMAÇÕES E RESERVA ===== */}
                    <div className="space-y-4">
                        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{servico.tipo_servico || estabelecimento.ramo_atuacao}</p>
                                    <h1 className="mt-1 text-2xl font-black leading-tight text-gray-900 sm:text-3xl">{servico.nome}</h1>
                                    <p className="mt-1 text-sm text-gray-500">em <b className="text-gray-700">{estabelecimento.nome}</b></p>
                                    <SelosAtendimento atendimento={servico.atendimento} max={4} className="mt-2" />
                                </div>
                                {servico.somente_premium && <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-[11px] font-black uppercase text-white">Só Premium</span>}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                                <a href="#avaliacoes" className="inline-flex items-center gap-1 hover:underline">
                                    <StarSolid className="h-4 w-4 text-amber-400" />
                                    <b className="text-gray-900">{nota ? Number(nota).toFixed(1).replace('.', ',') : 'Novo'}</b>
                                    {totalAval > 0 && <span className="text-gray-400">({totalAval} {totalAval === 1 ? 'avaliação' : 'avaliações'})</span>}
                                </a>
                                <span className="inline-flex items-center gap-1"><ClockIcon className="h-4 w-4 text-gray-400" /> {servico.duracao_minutos} min</span>
                                {estabelecimento.cidade && <span className="inline-flex items-center gap-1"><MapPinIcon className="h-4 w-4 text-gray-400" /> {[estabelecimento.bairro, estabelecimento.cidade].filter(Boolean).join(', ')}</span>}
                            </div>

                            <div className="mt-4 flex items-end gap-2">
                                <span className="text-3xl font-black text-gray-900">{brl(servico.valor_com_promocao)}</span>
                                {servico.tem_promocao && <span className="pb-1 text-sm text-gray-400 line-through">{brl(servico.valor)}</span>}
                                {servico.tem_promocao && <span className="mb-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-black text-red-600">-{Math.round((descontoPromocao / servico.valor) * 100)}%</span>}
                            </div>
                            <p className="text-xs text-gray-500">{textoPagamento}</p>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                                <button type="button" onClick={favoritar} className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-bold transition ${favorito ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    {favorito ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />} {favorito ? 'Favoritado' : 'Favoritar'}
                                </button>
                                <button type="button" onClick={porNoCarrinho} disabled={noCarrinho} className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-bold transition ${noCarrinho ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    {noCarrinho ? <CheckIcon className="h-5 w-5" /> : <ShoppingCartIcon className="h-5 w-5" />} {noCarrinho ? 'No carrinho' : 'Carrinho'}
                                </button>
                                <button type="button" onClick={conversar} disabled={!donoId} className="flex flex-col items-center gap-1 rounded-2xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                                    <ChatBubbleLeftRightIcon className="h-5 w-5" /> Conversar
                                </button>
                            </div>
                            {noCarrinho && <Link href={route('cliente.carrinho')} className="mt-2 block text-center text-xs font-bold text-[#FF5A00] hover:underline">Ver meu carrinho →</Link>}
                        </section>

                        {/* HORÁRIO A COMBINAR: o cliente fala com o proprietário para marcar */}
                        {aCombinar && (
                            <section id="horarios" className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm sm:p-6">
                                <h2 className="flex items-center gap-2 font-black text-gray-900"><ClockIcon className="h-5 w-5 text-[#FF5A00]" /> Horário a combinar</h2>
                                <p className="mt-2 text-sm text-gray-700">
                                    Este serviço não tem horários fixos. <b>Combine o horário com o proprietário:</b> entre em contato pelo chat ou pelo telefone e marquem o melhor dia e hora.
                                </p>
                                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                    <button type="button" onClick={conversar} disabled={!donoId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5A00] px-4 py-3 text-sm font-black text-white hover:bg-[#E8590C] disabled:opacity-50">
                                        <ChatBubbleLeftRightIcon className="h-5 w-5" /> Conversar
                                    </button>
                                    {telefoneLocal && (
                                        <a href={`https://wa.me/55${telefoneLocal.replace(/^55/, '')}?text=${encodeURIComponent(`Olá! Vi o serviço "${servico.nome}" na Lokyva e quero combinar um horário.`)}`} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-800 hover:bg-gray-50">
                                            WhatsApp
                                        </a>
                                    )}
                                    {telefoneLocal && (
                                        <a href={`tel:${telefoneLocal}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-800 hover:bg-gray-50">
                                            Ligar · {estabelecimento.telefone}
                                        </a>
                                    )}
                                </div>
                                <p className="mt-3 text-xs text-gray-500">Atende: {nomesDias.length ? nomesDias.join(', ') : 'todos os dias'}</p>
                            </section>
                        )}

                        {/* HORÁRIOS */}
                        {!aCombinar && (
                        <section id="horarios" className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="flex items-center gap-2 font-black text-gray-900"><CalendarDaysIcon className="h-5 w-5 text-[#FF5A00]" /> Escolha o dia e o horário</h2>
                            {dias.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-500">Sem dias abertos para agendamento nos próximos dias.</p>
                            ) : (
                                <>
                                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                        {dias.map((d) => (
                                            <button key={d.iso} type="button" onClick={() => { setDia(d.iso); setHora(''); setConflito(null); }}
                                                className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs transition ${dia === d.iso ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                                <span className="uppercase">{d.semana}</span>
                                                <span className="text-lg font-black">{d.dia}</span>
                                                <span className="uppercase">{d.mes}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {servico.horarios.length === 0 ? (
                                            <p className="text-sm text-gray-500">O horário é combinado no próximo passo.</p>
                                        ) : servico.horarios.map((h) => {
                                            const ocupado = lotado(h);
                                            const jaPassou = passou(h);
                                            return (
                                                <button key={h} type="button" disabled={jaPassou} onClick={() => escolherHora(h)}
                                                    title={ocupado ? 'Horário ocupado' : jaPassou ? 'Horário já passou' : 'Escolher'}
                                                    className={`rounded-full border px-4 py-1.5 text-sm font-bold transition ${hora === h ? 'border-gray-900 bg-gray-900 text-white'
                                                        : ocupado ? 'border-red-100 bg-red-50 text-red-300 line-through'
                                                            : jaPassou ? 'cursor-not-allowed border-gray-100 text-gray-300 line-through'
                                                                : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                                                    {h}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {servico.horarios.length > 0 && (
                                        <p className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-gray-300" /> Livre</span>
                                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-200" /> Ocupado</span>
                                            {servico.vagas_por_horario > 1 && <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {servico.vagas_por_horario} vagas por horário</span>}
                                        </p>
                                    )}
                                </>
                            )}

                            {conflito && (
                                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                    <p className="flex items-start gap-2 font-semibold">
                                        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                                        {conflito.hora ? `${conflito.hora} — ${conflito.motivo}` : conflito.motivo}
                                    </p>
                                    {conflito.sugestoes?.length > 0 && (
                                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                                            <span className="text-xs">Livres:</span>
                                            {conflito.sugestoes.map((h) => (
                                                <button key={h} type="button" onClick={() => escolherHora(h)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50">{h}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="mt-3 text-xs text-gray-400">Atende: {nomesDias.length ? nomesDias.join(', ') : 'todos os dias'}</p>
                        </section>
                        )}

                        {/* PONTOS */}
                        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="flex items-center gap-2 font-black text-gray-900"><SparklesIcon className="h-5 w-5 text-indigo-600" /> Desconto com pontos</h2>
                                    <p className="text-xs text-gray-500">Seu saldo: <b>{saldo.toLocaleString('pt-BR')} pontos</b> ({brl(saldo / pontosPorReal)})</p>
                                </div>
                                {pontosPeloPremium && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">Vantagem Premium</span>}
                            </div>

                            {!podeUsarPontos ? (
                                <div className="mt-3 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                                    <p className="flex items-center gap-2 font-semibold text-gray-800"><LockClosedIcon className="h-4 w-4" /> Este serviço não aceita pontos.</p>
                                    <p className="mt-1">Assinantes Premium usam pontos em qualquer serviço. <Link href={route('assinatura.status')} className="font-bold text-[#FF5A00] hover:underline">Conhecer o Premium</Link></p>
                                </div>
                            ) : maxPontos <= 0 ? (
                                <p className="mt-3 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">Você ainda não tem pontos. Ganhe pontos a cada agendamento concluído.</p>
                            ) : (
                                <div className="mt-4">
                                    <div className="flex items-end justify-between">
                                        <span className="text-sm text-gray-600">Usar <b className="text-gray-900">{pontos.toLocaleString('pt-BR')}</b> pontos</span>
                                        <span className="text-lg font-black text-emerald-700">- {brl(descontoPontos)}</span>
                                    </div>
                                    <input type="range" min="0" max={maxPontos} step={passo} value={pontos} onChange={(e) => setPontos(Number(e.target.value))}
                                        className="mt-2 w-full accent-[#FF5A00]" aria-label="Quantidade de pontos" />
                                    <div className="mt-2 flex gap-2">
                                        {[0, 0.5, 1].map((f) => {
                                            const v = Math.floor((maxPontos * f) / passo) * passo;
                                            return (
                                                <button key={f} type="button" onClick={() => setPontos(f === 1 ? maxPontos : v)}
                                                    className={`flex-1 rounded-xl border py-1.5 text-xs font-bold ${pontos === (f === 1 ? maxPontos : v) ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                    {f === 0 ? 'Não usar' : f === 1 ? 'Máximo' : 'Metade'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!premium && servico.maximo_pontos_permitidos && <p className="mt-2 text-[11px] text-gray-400">Este serviço aceita até {servico.maximo_pontos_permitidos.toLocaleString('pt-BR')} pontos por agendamento.</p>}
                                </div>
                            )}
                        </section>

                        {/* RESUMO E AGENDAR */}
                        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                            <dl className="space-y-1.5 text-sm">
                                <div className="flex justify-between text-gray-500"><dt>{servico.atendimento?.tipo_preco && servico.atendimento.tipo_preco !== 'fixo' ? `Valor do serviço (${servico.atendimento.tipo_preco_rotulo.toLowerCase()})` : 'Valor do serviço'}</dt><dd>{brl(servico.valor)}</dd></div>
                                {servico.atendimento?.taxa_deslocamento > 0 && (
                                    <div className="flex justify-between text-gray-500"><dt>Taxa de deslocamento{servico.atendimento.modalidade === 'ambos' ? ' (se for até você)' : ''}</dt><dd>+ {brl(servico.atendimento.taxa_deslocamento)}</dd></div>
                                )}
                                {descontoPromocao > 0 && <div className="flex justify-between text-emerald-700"><dt>Promoção</dt><dd>- {brl(descontoPromocao)}</dd></div>}
                                {descontoPontos > 0 && <div className="flex justify-between text-emerald-700"><dt>Pontos ({pontos.toLocaleString('pt-BR')})</dt><dd>- {brl(descontoPontos)}</dd></div>}
                                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                                    <dt className="font-bold text-gray-800">Você paga</dt>
                                    <dd className="text-2xl font-black text-gray-900">{brl(valorFinal)}</dd>
                                </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {formas.map((f) => (
                                    <span key={f.rotulo} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600"><f.icone className="h-3.5 w-3.5" /> {f.rotulo}</span>
                                ))}
                            </div>
                            {aCombinar ? (
                                <>
                                    <button type="button" onClick={conversar} disabled={!donoId}
                                        className="mt-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                                        style={{ backgroundColor: COR }}>
                                        <span>Falar com o proprietário</span>
                                        <ChatBubbleLeftRightIcon className="h-5 w-5" />
                                    </button>
                                    <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-gray-400">
                                        <InformationCircleIcon className="h-4 w-4" /> Horário a combinar: vocês marcam o dia e a hora pelo chat ou telefone.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={agendar} disabled={verificando}
                                        className="mt-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:opacity-70"
                                        style={{ backgroundColor: COR }}>
                                        <span>{verificando ? 'Conferindo o horário…' : hora ? `Agendar ${diaBr(dia)} às ${hora}` : precisaHorario ? 'Escolha um horário' : 'Agendar'}</span>
                                        <ArrowRightIcon className="h-5 w-5" />
                                    </button>
                                    <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-gray-400">
                                        <InformationCircleIcon className="h-4 w-4" /> No próximo passo você confirma e escolhe como pagar.
                                    </p>
                                </>
                            )}
                        </section>
                    </div>
                </div>

                <InfoAtendimento atendimento={servico.atendimento} />

                {/* SOBRE */}
                <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="font-black text-gray-900">Sobre o serviço</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{servico.descricao || 'O estabelecimento ainda não escreveu uma descrição para este serviço.'}</p>
                    {profissionais.length > 0 && (
                        <div className="mt-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Profissionais</p>
                            <div className="flex flex-wrap gap-2">
                                {profissionais.map((p) => (
                                    <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                        <UserIcon className="h-4 w-4 text-gray-400" /> {p.nome}{p.cargo ? <span className="font-normal text-gray-400">· {p.cargo}</span> : null}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* AVALIAÇÕES */}
                <section id="avaliacoes" className="scroll-mt-24 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="font-black text-gray-900">Avaliações</h2>
                    {!avaliacoes || avaliacoes.total === 0 ? (
                        <div className="mt-3 rounded-2xl bg-gray-50 p-6 text-center">
                            <StarSolid className="mx-auto h-8 w-8 text-gray-200" />
                            <p className="mt-2 font-bold text-gray-700">Ainda sem avaliações</p>
                            <p className="text-sm text-gray-500">Depois do atendimento, quem agendou pode avaliar. Seja o primeiro!</p>
                        </div>
                    ) : (
                        <>
                            {avaliacoes.escopo === 'estabelecimento' && <p className="text-xs text-gray-400">Este serviço ainda não tem avaliações próprias; mostrando as de {estabelecimento.nome}.</p>}
                            <div className="mt-4 grid gap-6 md:grid-cols-[220px_1fr]">
                                <div>
                                    <p className="text-5xl font-black text-gray-900">{Number(avaliacoes.media).toFixed(1).replace('.', ',')}</p>
                                    <Estrelas nota={avaliacoes.media} tamanho="h-5 w-5" />
                                    <p className="mt-1 text-sm text-gray-500">{avaliacoes.total} {avaliacoes.total === 1 ? 'avaliação' : 'avaliações'}</p>
                                    <div className="mt-4 space-y-1.5">
                                        {[5, 4, 3, 2, 1].map((n) => {
                                            const qtd = avaliacoes.distribuicao[n] || 0;
                                            return (
                                                <div key={n} className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span className="w-3">{n}</span>
                                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(qtd / avaliacoes.total) * 100}%` }} /></div>
                                                    <span className="w-6 text-right">{qtd}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {avaliacoes.lista.map((a) => (
                                        <li key={a.id} className="rounded-2xl border border-gray-100 p-4">
                                            <div className="flex items-center gap-3">
                                                {img(a.foto) ? <img src={img(a.foto)} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-sm font-black text-[#FF5A00]">{a.nome.charAt(0)}</span>}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-gray-900">{a.nome}</p>
                                                    <div className="flex items-center gap-2"><Estrelas nota={a.nota} tamanho="h-3.5 w-3.5" /><span className="text-[11px] text-gray-400">{a.data ? new Date(`${a.data}T12:00:00`).toLocaleDateString('pt-BR') : ''}</span></div>
                                                </div>
                                            </div>
                                            {a.comentario && <p className="mt-2 text-sm text-gray-600">{a.comentario}</p>}
                                            {a.fotos.length > 0 && (
                                                <div className="mt-2 flex gap-2">{a.fotos.slice(0, 4).map((f) => <img key={f} src={img(f)} alt="" className="h-14 w-14 rounded-lg object-cover" />)}</div>
                                            )}
                                            {a.resposta && <p className="mt-2 rounded-xl bg-gray-50 p-2.5 text-xs text-gray-600"><b>Resposta do local:</b> {a.resposta}</p>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </section>

                {/* OUTROS SERVIÇOS */}
                {outrosServicos.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="font-black text-gray-900">Outros serviços de {estabelecimento.nome}</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {outrosServicos.map((o) => (
                                <article key={o.id} className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
                                    <Link href={route('cliente.servicos.show', o.id)} className="relative block aspect-[16/10] bg-gray-100">
                                        {img(o.foto) ? <img src={img(o.foto)} alt={o.nome} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-sm text-gray-400">Sem foto</span>}
                                        {o.valor_com_promocao < o.valor && <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">PROMOÇÃO</span>}
                                    </Link>
                                    <div className="flex flex-1 flex-col p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <Link href={route('cliente.servicos.show', o.id)} className="font-bold text-gray-900 hover:underline">{o.nome}</Link>
                                            <span className="shrink-0 text-sm font-black text-gray-900">{brl(o.valor_com_promocao)}</span>
                                        </div>
                                        <p className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                                            <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {o.duracao_minutos} min</span>
                                            {o.avaliacao_media > 0 && <span className="inline-flex items-center gap-0.5"><StarSolid className="h-3.5 w-3.5 text-amber-400" /> {o.avaliacao_media.toFixed(1).replace('.', ',')}</span>}
                                        </p>
                                        {o.horario_a_combinar ? (
                                            <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#E8590C]"><ClockIcon className="h-3.5 w-3.5" /> Horário a combinar</p>
                                        ) : o.horarios.length > 0 ? (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {o.horarios.map((h) => (
                                                    <Link key={h} href={route('cliente.servicos.show', { servico: o.id, hora: h })} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 hover:border-[#FF5A00] hover:text-[#FF5A00]">{h}</Link>
                                                ))}
                                            </div>
                                        ) : <p className="mt-3 text-xs text-gray-400">Horário combinado no agendamento.</p>}
                                        <Link href={route('cliente.servicos.show', o.id)} className="mt-auto pt-3 text-xs font-bold text-[#FF5A00] hover:underline">Ver detalhes →</Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
