import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    MagnifyingGlassIcon, MapPinIcon, CalendarDaysIcon, UsersIcon, SparklesIcon, ArrowRightIcon, StarIcon,
    BuildingStorefrontIcon, KeyIcon, WalletIcon, BookmarkIcon, UserPlusIcon, GlobeAmericasIcon, CheckCircleIcon,
    ExclamationCircleIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const CORES = ['bg-orange-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500'];

function Aviso({ aviso, aoFechar }) {
    if (!aviso) return null;
    const ok = aviso.tipo === 'ok';
    return (
        <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="flex items-center gap-2">{ok ? <CheckCircleIcon className="h-5 w-5" /> : <ExclamationCircleIcon className="h-5 w-5" />}{aviso.texto}</span>
            <button type="button" onClick={aoFechar} className="text-xs opacity-70 hover:opacity-100">Fechar</button>
        </div>
    );
}

export default function TravelAssistant() {
    const [busca, setBusca] = useState('');
    const [dias, setDias] = useState(5);
    const [pessoas, setPessoas] = useState(2);
    const [carregando, setCarregando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [fotoAtiva, setFotoAtiva] = useState(0);
    const [aviso, setAviso] = useState(null);

    const [tituloViagem, setTituloViagem] = useState('');
    const [orcamentoLimite, setOrcamentoLimite] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [minhasViagens, setMinhasViagens] = useState([]);
    const [convites, setConvites] = useState({});

    const [estados, setEstados] = useState([]);
    const [carregandoEstados, setCarregandoEstados] = useState(true);

    useEffect(() => {
        carregarMinhasViagens();
        axios.get(route('explorar.estados'))
            .then(({ data }) => setEstados(Array.isArray(data) ? data : []))
            .catch(() => setEstados([]))
            .finally(() => setCarregandoEstados(false));
    }, []);

    const estadosOrdenados = [...estados].sort((a, b) => (b.total - a.total) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const sugestoes = estadosOrdenados.filter((e) => e.total > 0).slice(0, 5);
    const urlExplorar = (uf, tipo) => route('cliente.explorar', { estado: uf, tipo_busca: tipo });

    const carregarMinhasViagens = async () => {
        try {
            const { data } = await axios.get('/api/viagens', { params: { _t: Date.now() } });
            setMinhasViagens(Array.isArray(data) ? data : []);
        } catch {
            setMinhasViagens([]);
        }
    };

    const buscar = async (params) => {
        setCarregando(true);
        setAviso(null);
        try {
            const { data } = await axios.get('/api/travel-assistant/search', { params: { ...params, dias, pessoas }, headers: { Accept: 'application/json' } });
            setResultado(data && typeof data === 'object' ? data : null);
            setFotoAtiva(0);
            if (!tituloViagem && data?.destino_detectado) setTituloViagem(`Viagem para ${data.destino_detectado}`);
        } catch {
            setAviso({ tipo: 'erro', texto: 'Não foi possível montar o guia agora. Tente outro destino.' });
        } finally {
            setCarregando(false);
        }
    };

    const buscarTexto = (e) => {
        e.preventDefault();
        if (busca.trim()) buscar({ busca: busca.trim() });
    };

    const usarGps = () => {
        if (!navigator.geolocation) {
            setAviso({ tipo: 'erro', texto: 'Seu navegador não permite usar a localização. Digite o destino.' });
            return;
        }
        setCarregando(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => buscar({ latitude: coords.latitude, longitude: coords.longitude }),
            () => {
                setCarregando(false);
                setAviso({ tipo: 'erro', texto: 'Não conseguimos sua localização. Digite o destino.' });
            },
            { enableHighAccuracy: true, timeout: 8000 },
        );
    };

    const salvarViagem = async (e) => {
        e.preventDefault();
        if (!tituloViagem.trim()) return;
        setSalvando(true);
        try {
            await axios.post('/api/viagens', {
                titulo: tituloViagem.trim(),
                destino: resultado?.destino_detectado || busca || 'Destino',
                data_inicio: new Date().toISOString().split('T')[0],
                data_fim: new Date(Date.now() + dias * 86400000).toISOString().split('T')[0],
                orcamento_limite: orcamentoLimite || resultado?.orcamento_estimado?.total_estimado || 0,
                quantidade_pessoas: pessoas,
                gastos_planejados: resultado?.orcamento_estimado?.itens_orcamento?.map((i) => ({ item: i.categoria, valor: i.valor_total })) || [],
            });
            setAviso({ tipo: 'ok', texto: 'Viagem salva! Ela aparece em "Meus roteiros".' });
            setOrcamentoLimite('');
            carregarMinhasViagens();
        } catch {
            setAviso({ tipo: 'erro', texto: 'Não foi possível salvar a viagem.' });
        } finally {
            setSalvando(false);
        }
    };

    const convidar = async (e, viagemId) => {
        e.preventDefault();
        const email = (convites[viagemId] || '').trim();
        if (!email) return;
        try {
            await axios.post(`/api/viagens/${viagemId}/adicionar-amigo`, { email });
            setConvites((c) => ({ ...c, [viagemId]: '' }));
            setAviso({ tipo: 'ok', texto: 'Amigo adicionado à viagem!' });
            carregarMinhasViagens();
        } catch (err) {
            setAviso({ tipo: 'erro', texto: err.response?.data?.message || 'Não foi possível convidar.' });
        }
    };

    const fotos = (resultado?.galeria_unsplash || []).filter((f) => f?.url);
    const orc = resultado?.orcamento_estimado;
    const maiorItem = Math.max(1, ...(orc?.itens_orcamento || []).map((i) => Number(i.valor_total) || 0));
    const locais = resultado?.estabelecimentos_locais || [];
    const itens = resultado?.recomendacoes_locais || [];
    const campo = 'w-full rounded-xl border-0 bg-gray-50 py-3 text-sm font-medium text-gray-900 ring-1 ring-gray-200 focus:bg-white focus:ring-2 focus:ring-orange-500';

    return (
        <AuthenticatedLayout>
            <Head title="Assistente de viagens" />

            <div className="mx-auto max-w-7xl space-y-6">
                {/* ===== HERO + BUSCA ===== */}
                <section className="relative overflow-hidden rounded-3xl bg-gray-900">
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-transparent" />
                    <div className="relative px-5 py-8 sm:px-10 sm:py-12">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                            <SparklesIcon className="h-4 w-4" /> Assistente de viagens Lokyva
                        </span>
                        <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">Planeje sua viagem em minutos</h1>
                        <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">Descubra o destino, veja lugares e reservas disponíveis, estime o orçamento e salve tudo para dividir com quem vai junto.</p>

                        <form onSubmit={buscarTexto} className="mt-6 grid gap-2 rounded-2xl bg-white p-3 shadow-2xl sm:grid-cols-12">
                            <label className="relative sm:col-span-5">
                                <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Para onde você vai? Cidade, estado ou lugar" className={`${campo} pl-10 pr-3`} />
                            </label>
                            <label className="relative sm:col-span-2">
                                <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input type="number" min="1" max="60" value={dias} onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))} className={`${campo} pl-10 pr-2`} aria-label="Dias" />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">dias</span>
                            </label>
                            <label className="relative sm:col-span-2">
                                <UsersIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input type="number" min="1" max="30" value={pessoas} onChange={(e) => setPessoas(Math.max(1, Number(e.target.value) || 1))} className={`${campo} pl-10 pr-2`} aria-label="Pessoas" />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">pessoas</span>
                            </label>
                            <div className="flex gap-2 sm:col-span-3">
                                <button type="submit" disabled={carregando} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
                                    <MagnifyingGlassIcon className="h-5 w-5" /> Buscar
                                </button>
                                <button type="button" onClick={usarGps} disabled={carregando} className="rounded-xl bg-gray-100 px-3 text-gray-700 hover:bg-gray-200" title="Usar minha localização" aria-label="Usar minha localização">
                                    <MapPinIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </form>

                        {sugestoes.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
                                <span>Com mais opções:</span>
                                {sugestoes.map((e) => (
                                    <button key={e.uf} type="button" onClick={() => { setBusca(e.nome); buscar({ busca: e.nome }); }} className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white backdrop-blur hover:bg-white/25">
                                        {e.nome}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />

                {carregando && (
                    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white py-16 text-center shadow-sm">
                        <span className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
                        <p className="text-sm font-semibold text-gray-500">Montando o seu guia de viagem…</p>
                    </div>
                )}

                {/* ===== RESULTADO ===== */}
                {!carregando && resultado && (
                    <div className="space-y-6">
                        <section className="grid gap-5 lg:grid-cols-5">
                            <div className="overflow-hidden rounded-3xl bg-white shadow-sm lg:col-span-3">
                                <div className="relative aspect-[16/9] bg-gray-100">
                                    {fotos[fotoAtiva] && <img src={fotos[fotoAtiva].url} alt={fotos[fotoAtiva].descricao} className="h-full w-full object-cover" />}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
                                        <p className="text-xs font-bold uppercase tracking-wider text-white/80">Seu destino</p>
                                        <h2 className="text-2xl font-black text-white sm:text-3xl">{resultado.destino_detectado}</h2>
                                    </div>
                                </div>
                                {fotos.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto p-3">
                                        {fotos.map((f, i) => (
                                            <button key={f.url} type="button" onClick={() => setFotoAtiva(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${i === fotoAtiva ? 'ring-orange-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                                                <img src={f.url} alt="" className="h-full w-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
                                <h3 className="flex items-center gap-2 font-bold text-gray-900"><GlobeAmericasIcon className="h-5 w-5 text-orange-500" /> Sobre o destino</h3>
                                <p className="mt-2 line-clamp-[9] text-sm leading-relaxed text-gray-600">{resultado.resumo_wikipedia?.resumo}</p>
                                {resultado.resumo_wikipedia?.link && (
                                    <a href={resultado.resumo_wikipedia.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline">
                                        Ler mais na Wikipédia <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                    </a>
                                )}
                                <Link href={route('viagens.nova', { cidade: resultado.destino_detectado })} className="mt-auto inline-flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-black">
                                    <span className="flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-orange-400" /> Montar roteiro inteligente</span>
                                    <ArrowRightIcon className="h-5 w-5" />
                                </Link>
                            </div>
                        </section>

                        {/* LUGARES E RESERVAS NO DESTINO */}
                        {(locais.length > 0 || itens.length > 0) ? (
                            <section className="grid gap-5 lg:grid-cols-2">
                                {locais.length > 0 && (
                                    <div className="rounded-3xl bg-white p-5 shadow-sm">
                                        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><BuildingStorefrontIcon className="h-5 w-5 text-orange-500" /> Lugares no destino</h3>
                                        <ul className="divide-y divide-gray-100">
                                            {locais.map((l) => (
                                                <li key={l.id}>
                                                    <Link href={route('estabelecimentos.loja', l.id)} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                                                        {l.foto ? <img src={l.foto} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 font-black text-orange-500">{l.nome.charAt(0)}</span>}
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-bold text-gray-900">{l.nome}</span>
                                                            <span className="block truncate text-xs text-gray-500">{[l.ramo, l.bairro, l.distancia !== null ? `${String(l.distancia).replace('.', ',')} km` : null].filter(Boolean).join(' · ')}</span>
                                                        </span>
                                                        {l.avaliacao && <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700"><StarIcon className="h-4 w-4 fill-amber-400 text-amber-400" />{String(l.avaliacao).replace('.', ',')}</span>}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {itens.length > 0 && (
                                    <div className="rounded-3xl bg-white p-5 shadow-sm">
                                        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><KeyIcon className="h-5 w-5 text-orange-500" /> Reservas e aluguéis</h3>
                                        <ul className="divide-y divide-gray-100">
                                            {itens.slice(0, 10).map((i) => (
                                                <li key={i.id}>
                                                    <Link href={route('itens.detalhes', i.id)} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                                                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><KeyIcon className="h-5 w-5" /></span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-bold text-gray-900">{i.nome}</span>
                                                            <span className="block truncate text-xs capitalize text-gray-500">{[String(i.categoria || '').replace(/_/g, ' '), i.cidade].filter(Boolean).join(' · ')}</span>
                                                        </span>
                                                        {Number(i.valor_diaria) > 0 && <span className="text-sm font-bold text-gray-900">{brl(i.valor_diaria)}<span className="text-xs font-normal text-gray-400">/dia</span></span>}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </section>
                        ) : (
                            <div className="rounded-3xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                                Ainda não há lugares cadastrados neste destino. Veja o <Link href={route('cliente.explorar')} className="font-bold text-orange-600">Explorar</Link> para outras opções.
                            </div>
                        )}

                        {/* ORÇAMENTO + SALVAR */}
                        <section className="grid gap-5 lg:grid-cols-2">
                            <div className="rounded-3xl bg-white p-5 shadow-sm">
                                <h3 className="flex items-center gap-2 font-bold text-gray-900"><WalletIcon className="h-5 w-5 text-orange-500" /> Orçamento estimado</h3>
                                <p className="text-xs text-gray-400">{dias} dias · {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'} · valores de referência</p>
                                <ul className="mt-4 space-y-3">
                                    {(orc?.itens_orcamento || []).map((i, idx) => (
                                        <li key={i.categoria}>
                                            <div className="mb-1 flex justify-between text-sm"><span className="text-gray-700">{i.categoria}</span><span className="font-bold text-gray-900">{brl(i.valor_total)}</span></div>
                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${CORES[idx % CORES.length]}`} style={{ width: `${Math.max(4, (Number(i.valor_total) / maiorItem) * 100)}%` }} /></div>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                                    <span className="text-sm font-semibold text-gray-500">Total estimado</span>
                                    <span className="text-2xl font-black text-orange-600">{brl(orc?.total_estimado)}</span>
                                </div>
                            </div>

                            <form onSubmit={salvarViagem} className="flex flex-col rounded-3xl bg-white p-5 shadow-sm">
                                <h3 className="flex items-center gap-2 font-bold text-gray-900"><BookmarkIcon className="h-5 w-5 text-orange-500" /> Salvar esta viagem</h3>
                                <p className="text-xs text-gray-400">Guarde o plano para convidar amigos e controlar os gastos reais.</p>
                                <label className="mt-4 text-xs font-semibold text-gray-600">Nome da viagem
                                    <input value={tituloViagem} onChange={(e) => setTituloViagem(e.target.value)} placeholder="Ex.: Férias em família" className={`mt-1 ${campo} px-4`} required />
                                </label>
                                <label className="mt-3 text-xs font-semibold text-gray-600">Limite de gastos <span className="font-normal text-gray-400">(opcional)</span>
                                    <input type="number" min="0" value={orcamentoLimite} onChange={(e) => setOrcamentoLimite(e.target.value)} placeholder={orc?.total_estimado ? `Sugestão: ${brl(orc.total_estimado)}` : 'R$'} className={`mt-1 ${campo} px-4`} />
                                </label>
                                <button type="submit" disabled={salvando} className="mt-auto rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60 sm:mt-5">
                                    {salvando ? 'Salvando…' : 'Salvar viagem'}
                                </button>
                            </form>
                        </section>
                    </div>
                )}

                {/* ===== EXPLORAR POR ESTADO ===== */}
                {!carregando && !resultado && (
                    <section>
                        <h2 className="text-lg font-black text-gray-900">Explore por estado</h2>
                        <p className="mb-3 text-sm text-gray-500">Toque em um estado para ver lojas, serviços e reservas disponíveis.</p>
                        {carregandoEstados ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                {estadosOrdenados.map((e) => (
                                    <div key={e.uf} className={`flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${e.total > 0 ? '' : 'opacity-60'}`}>
                                        <button type="button" onClick={() => { setBusca(e.nome); buscar({ busca: e.nome }); }} className="flex items-center gap-2 text-left">
                                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${e.total > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>{e.uf}</span>
                                            <span className="text-sm font-bold leading-tight text-gray-900">{e.nome}</span>
                                        </button>
                                        <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                                            <a href={urlExplorar(e.uf, 'estabelecimentos')} className={`rounded px-1.5 py-0.5 ${e.lojas > 0 ? 'bg-gray-900 text-white' : 'pointer-events-none bg-gray-100 text-gray-400'}`}>{e.lojas} lojas</a>
                                            <a href={urlExplorar(e.uf, 'servicos')} className={`rounded px-1.5 py-0.5 ${e.servicos > 0 ? 'bg-orange-500 text-white' : 'pointer-events-none bg-gray-100 text-gray-400'}`}>{e.servicos} serv.</a>
                                            <a href={urlExplorar(e.uf, 'reservas')} className={`rounded px-1.5 py-0.5 ${e.reservas > 0 ? 'bg-emerald-600 text-white' : 'pointer-events-none bg-gray-100 text-gray-400'}`}>{e.reservas} res.</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* ===== MEUS ROTEIROS ===== */}
                <section className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-black text-gray-900">Meus roteiros</h2>
                        {route().has('viagens.index') && <Link href={route('viagens.index')} className="text-sm font-bold text-orange-600 hover:underline">Ver todos</Link>}
                    </div>
                    {minhasViagens.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-400">Você ainda não salvou nenhuma viagem. Busque um destino acima para começar.</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {minhasViagens.map((v) => (
                                <div key={v.id} className="rounded-2xl border border-gray-100 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-gray-900">{v.titulo}</p>
                                            <p className="flex items-center gap-1 text-xs text-gray-500"><MapPinIcon className="h-3.5 w-3.5" /> {v.destino}</p>
                                        </div>
                                        {Number(v.orcamento_limite) > 0 && <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">Limite {brl(v.orcamento_limite)}</span>}
                                    </div>
                                    <form onSubmit={(e) => convidar(e, v.id)} className="mt-3 flex gap-2">
                                        <input type="email" value={convites[v.id] || ''} onChange={(e) => setConvites((c) => ({ ...c, [v.id]: e.target.value }))} placeholder="E-mail de quem vai junto" className="min-w-0 flex-1 rounded-xl border-gray-200 text-xs focus:border-orange-500 focus:ring-orange-500" required />
                                        <button type="submit" className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 text-xs font-bold text-white hover:bg-black"><UserPlusIcon className="h-4 w-4" /> Convidar</button>
                                    </form>
                                    {route().has('viagens.show') && (
                                        <Link href={route('viagens.show', v.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:underline">Abrir viagem <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
