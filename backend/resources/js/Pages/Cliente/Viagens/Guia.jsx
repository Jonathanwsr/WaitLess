import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
    MagnifyingGlassIcon, MapPinIcon, ChevronDownIcon, ArrowTopRightOnSquareIcon, ClockIcon, UsersIcon,
    GlobeAmericasIcon, ArrowTrendingUpIcon, MapIcon, SparklesIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { AbasPlanejamento, CATEGORIAS, CartaoLocacao, Skeleton, erroAmigavel, linkLocacao, pedirLocalizacao } from '@/Components/Viagem/Roteiro/comum';
import MapaRoteiro from '@/Components/Viagem/Roteiro/MapaRoteiro';

const SUGESTOES = ['Recife', 'Olinda', 'Porto de Galinhas', 'Gramado', 'Salvador', 'Rio de Janeiro'];

const ICONES_SECAO = {
    'Sobre o destino': '🧭', 'Como chegar': '✈️', 'Como circular': '🚌', 'O que ver': '👀', 'O que fazer': '🎒',
    'Onde comer': '🍽️', 'Onde beber': '🍹', 'Onde dormir': '🛏️', Segurança: '🛡️',
};

export default function Guia({ termoInicial = '' }) {
    const [termo, setTermo] = useState(termoInicial);
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);
    const [explicarLocal, setExplicarLocal] = useState(false);
    const [descricaoAberta, setDescricaoAberta] = useState(false);
    const [secaoAberta, setSecaoAberta] = useState(0);
    const [categoria, setCategoria] = useState(null);

    const buscar = async (params) => {
        setCarregando(true);
        setErro(null);
        setDescricaoAberta(false);
        setSecaoAberta(0);
        try {
            const { data } = await axios.get(route('viagens.api.guia'), { params });
            setDados(data);
            setCategoria(Object.keys(data.locacoes_proximas || {})[0] || null);
            if (params.termo) window.history.replaceState({}, '', `${window.location.pathname}?termo=${encodeURIComponent(params.termo)}`);
        } catch (e) {
            setDados(null);
            setErro(erroAmigavel(e));
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => { if (termoInicial) buscar({ termo: termoInicial }); }, []);

    const enviar = (e) => {
        e?.preventDefault();
        if (termo.trim().length >= 2) buscar({ termo: termo.trim() });
    };

    const pertoDeMim = async () => {
        setExplicarLocal(false);
        try {
            const p = await pedirLocalizacao();
            setTermo('');
            buscar({ lat: p.lat, lng: p.lng });
        } catch (e) {
            setErro(e.message);
        }
    };

    const local = dados?.local;
    const categorias = Object.entries(dados?.locacoes_proximas || {});
    const nomeDestino = local?.titulo || termo || 'aqui';
    const pontosMapa = useMemo(() => (dados?.pontos_turisticos || []).slice(0, 12).map((p, i) => ({
        numero: i + 1, titulo: p.titulo, latitude: p.coordenadas.lat, longitude: p.coordenadas.lng, tipo: 'ponto_turistico',
    })), [dados]);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-black text-gray-800">Planejamento de viagem</h2>}>
            <Head title="Guia do Local" />
            <div className="mx-auto max-w-6xl space-y-6 pb-16">
                <AbasPlanejamento ativa="guia" />

                {/* BUSCA */}
                <section className="rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-[#7C2D12] p-5 text-white shadow-lg sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Guia do Local</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Conheça o destino antes de chegar</h1>
                    <p className="mt-1 max-w-2xl text-sm text-white/70">Descrição, dicas de viagem, pontos turísticos e o que o Lokyva tem por perto.</p>

                    <form onSubmit={enviar} className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
                        <label className="flex min-h-[48px] flex-1 items-center gap-2 rounded-2xl bg-white px-4 text-gray-900">
                            <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-400" />
                            <span className="sr-only">Cidade ou ponto turístico</span>
                            <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Cidade ou ponto turístico (ex.: Olinda)" className="w-full border-0 bg-transparent p-0 text-[15px] focus:ring-0" maxLength={120} />
                        </label>
                        <div className="flex gap-2">
                            <button type="submit" disabled={carregando || termo.trim().length < 2} className="min-h-[48px] flex-1 rounded-2xl bg-[#FF7A00] px-6 font-black text-white transition hover:bg-[#E8590C] disabled:opacity-50 sm:flex-none">Buscar</button>
                            <button type="button" onClick={() => setExplicarLocal(true)} className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 sm:flex-none">
                                <MapPinIcon className="h-5 w-5" /> Perto de mim
                            </button>
                        </div>
                    </form>

                    <AnimatePresence>
                        {explicarLocal && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex flex-col gap-3 rounded-2xl bg-white/10 p-4 text-sm sm:flex-row sm:items-center">
                                <p className="flex-1 text-white/90">Usamos a sua localização só para mostrar o que há por perto agora. Ela não fica salva.</p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={pertoDeMim} className="min-h-[44px] rounded-xl bg-white px-4 font-black text-gray-900">Usar minha localização</button>
                                    <button type="button" onClick={() => setExplicarLocal(false)} className="min-h-[44px] rounded-xl px-4 font-bold text-white/80 hover:text-white">Agora não</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!dados && !carregando && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {SUGESTOES.map((s) => (
                                <button key={s} type="button" onClick={() => { setTermo(s); buscar({ termo: s }); }} className="min-h-[36px] rounded-full bg-white/10 px-3 text-xs font-bold text-white/90 ring-1 ring-white/15 hover:bg-white/20">{s}</button>
                            ))}
                        </div>
                    )}
                </section>

                {erro && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
                        <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-500" /> <span>{erro}</span>
                    </div>
                )}

                {carregando && (
                    <div className="space-y-4" aria-busy="true" aria-label="Carregando o guia">
                        <Skeleton className="h-64 sm:h-80" />
                        <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
                        <div className="flex gap-3 overflow-hidden"><Skeleton className="h-48 w-56 shrink-0" /><Skeleton className="h-48 w-56 shrink-0" /><Skeleton className="h-48 w-56 shrink-0" /></div>
                    </div>
                )}

                {!carregando && dados && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        {dados.mensagem && (
                            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{dados.mensagem}</div>
                        )}

                        {/* CAPA */}
                        {local && (
                            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
                                <div className="relative h-64 bg-gray-200 sm:h-96">
                                    {local.imagem && <img src={local.imagem} alt={`Foto de ${local.titulo}`} className="h-full w-full object-cover" />}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-8">
                                        <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{local.titulo}</h2>
                                        {local.subtitulo && <p className="mt-1 text-sm capitalize text-white/80 sm:text-base">{local.subtitulo}</p>}
                                    </div>
                                </div>
                                <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-3">
                                    <div className="lg:col-span-2">
                                        <p className={`whitespace-pre-line leading-relaxed text-gray-700 ${descricaoAberta ? '' : 'line-clamp-5'}`}>{local.descricao}</p>
                                        {local.descricao?.length > 380 && (
                                            <button type="button" onClick={() => setDescricaoAberta((a) => !a)} className="mt-2 min-h-[44px] text-sm font-black text-[#E8590C]">{descricaoAberta ? 'Mostrar menos' : 'Ler mais'}</button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 self-start">
                                        {local.dados?.populacao && <Dado icone={UsersIcon} rotulo="População" valor={Number(local.dados.populacao).toLocaleString('pt-BR')} />}
                                        {local.dados?.area_km2 && <Dado icone={GlobeAmericasIcon} rotulo="Área" valor={`${Number(local.dados.area_km2).toLocaleString('pt-BR')} km²`} />}
                                        {local.dados?.altitude_m != null && <Dado icone={ArrowTrendingUpIcon} rotulo="Altitude" valor={`${local.dados.altitude_m} m`} />}
                                        {local.dados?.estado && <Dado icone={MapIcon} rotulo="Fica em" valor={local.dados.estado} />}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* CTA ROTEIRO */}
                        <Link href={`${route('viagens.roteiros.novo')}?destino=${encodeURIComponent(local?.titulo || termo || '')}`} className="flex min-h-[64px] items-center gap-4 rounded-3xl bg-gradient-to-r from-[#FF9A3D] to-[#FF7A00] p-4 text-white shadow-lg transition hover:brightness-105 sm:p-5">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20"><SparklesIcon className="h-6 w-6" /></span>
                            <span className="flex-1">
                                <span className="block text-lg font-black">Montar roteiro para {nomeDestino}</span>
                                <span className="block text-sm text-white/90">Pontos turísticos + locações do Lokyva, organizados dia a dia.</span>
                            </span>
                        </Link>

                        {/* INFORMAÇÕES ÚTEIS */}
                        {local?.infos_uteis?.length > 0 && (
                            <section>
                                <h3 className="mb-3 text-xl font-black text-gray-900">Informações úteis</h3>
                                <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
                                    {local.infos_uteis.map((s, i) => (
                                        <div key={s.secao}>
                                            <button type="button" onClick={() => setSecaoAberta(secaoAberta === i ? null : i)} aria-expanded={secaoAberta === i} className="flex min-h-[56px] w-full items-center gap-3 px-5 text-left hover:bg-gray-50">
                                                <span className="text-xl" aria-hidden="true">{ICONES_SECAO[s.secao] || '📌'}</span>
                                                <span className="flex-1 font-bold text-gray-900">{s.secao}</span>
                                                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${secaoAberta === i ? 'rotate-180' : ''}`} />
                                            </button>
                                            {secaoAberta === i && <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-gray-600">{s.texto}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* PONTOS TURÍSTICOS */}
                        {dados.pontos_turisticos?.length > 0 && (
                            <section>
                                <div className="mb-3 flex items-end justify-between gap-3">
                                    <h3 className="text-xl font-black text-gray-900">Pontos turísticos próximos</h3>
                                    <span className="text-xs text-gray-500">{dados.pontos_turisticos.length} lugares</span>
                                </div>
                                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                                    {dados.pontos_turisticos.map((p) => (
                                        <article key={p.titulo} className="w-60 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                                            <div className="relative aspect-[4/3] bg-gray-100">
                                                {p.imagem ? <img src={p.imagem} alt={p.titulo} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-300"><MapPinIcon className="h-10 w-10" /></div>}
                                                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-gray-700 shadow">{Number(p.distancia_km).toLocaleString('pt-BR')} km</span>
                                            </div>
                                            <div className="p-3">
                                                <h4 className="line-clamp-2 text-sm font-black text-gray-900">{p.titulo}</h4>
                                                {p.resumo && <p className="mt-1 line-clamp-3 text-xs text-gray-500">{p.resumo}</p>}
                                                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700"><ClockIcon className="h-3.5 w-3.5" /> {p.aviso_horario}</p>
                                                <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-xs font-black text-[#E8590C]">Ver na Wikipédia <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /></a>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                <div className="mt-4"><MapaRoteiro pontos={pontosMapa} centro={dados.centro} altura="h-64 sm:h-80" ligarPontos={false} rotulo="Mapa dos pontos turísticos" /></div>
                            </section>
                        )}

                        {/* LOCAÇÕES PRÓXIMAS */}
                        <section>
                            <h3 className="text-xl font-black text-gray-900">No Lokyva, perto de {nomeDestino}</h3>
                            <p className="mb-3 text-sm text-gray-500">Até {dados.raio_km} km. Parceiros Premium e quem aceita pontos aparecem primeiro.</p>
                            {categorias.length === 0 ? (
                                <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm ring-1 ring-gray-100">Ainda não há locações do Lokyva nesse raio.</div>
                            ) : (
                                <>
                                    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
                                        {categorias.map(([cat, g]) => {
                                            const Icone = (CATEGORIAS[cat] || CATEGORIAS.servicos).icone;
                                            return (
                                                <button key={cat} type="button" role="tab" aria-selected={categoria === cat} onClick={() => setCategoria(cat)} className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${categoria === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                                                    <Icone className="h-4 w-4" /> {g.rotulo} <span className="opacity-60">{g.itens.length}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                                        {(dados.locacoes_proximas[categoria]?.itens || []).map((l) => (
                                            <CartaoLocacao key={l.chave} l={l} acao={<Link href={linkLocacao(l.tipo, l.id)} className="inline-flex min-h-[40px] items-center rounded-xl bg-[#FF7A00] px-3 text-xs font-black text-white hover:bg-[#E8590C]">Reservar</Link>} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>

                        {local && (
                            <footer className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500">
                                Fonte: <a href={local.link} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-700 underline">{local.fonte}</a>. Textos e imagens sob licença CC BY-SA; horários e preços dos pontos turísticos podem mudar.
                            </footer>
                        )}
                    </motion.div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function Dado({ icone: Icone, rotulo, valor }) {
    return (
        <div className="rounded-2xl bg-gray-50 p-3">
            <Icone className="h-5 w-5 text-[#FF7A00]" />
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{rotulo}</p>
            <p className="text-sm font-black text-gray-900">{valor}</p>
        </div>
    );
}
