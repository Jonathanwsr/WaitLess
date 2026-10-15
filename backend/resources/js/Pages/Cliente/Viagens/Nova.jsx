import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    ArrowLeftIcon, MapPinIcon, CalendarDaysIcon, UsersIcon, WalletIcon, SparklesIcon, LockClosedIcon,
    HomeModernIcon, MapIcon, TruckIcon, ShoppingBagIcon, PencilSquareIcon, MagnifyingGlassIcon, PlusIcon,
    MinusIcon, TrashIcon, StarIcon, CheckIcon, ChevronUpIcon, BriefcaseIcon, ArrowRightIcon,
    Squares2X2Icon, TagIcon, TicketIcon, BoltIcon, XMarkIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { Aviso, erroDe, fmt, fmtDia } from '@/Components/Viagem/util';

const ABAS = [
    { id: 'tudo', nome: 'Tudo', icone: Squares2X2Icon, dica: 'Busque de uma vez em hospedagem, passeios, transporte e produtos' },
    { id: 'hospedagem', nome: 'Hospedagem', icone: HomeModernIcon, dica: 'Hotéis, pousadas, casas e apartamentos' },
    { id: 'passeios', nome: 'Passeios e serviços', icone: MapIcon, dica: 'Passeios, restaurantes, spa, beleza e mais' },
    { id: 'transporte', nome: 'Transporte', icone: TruckIcon, dica: 'Carros, motos, barcos e bicicletas' },
    { id: 'produtos', nome: 'Produtos', icone: ShoppingBagIcon, dica: 'O que você quer receber ou retirar lá' },
    { id: 'meu', nome: 'Algo seu', icone: PencilSquareIcon, dica: 'Passagem, restaurante, ingresso…' },
];

const GRUPOS = [
    { tipos: ['hospedagem'], nome: 'Hospedagem', icone: HomeModernIcon, cor: 'text-indigo-600 bg-indigo-50' },
    { tipos: ['transporte'], nome: 'Transporte', icone: TruckIcon, cor: 'text-sky-600 bg-sky-50' },
    { tipos: ['atracao', 'servico'], nome: 'Passeios e serviços', icone: MapIcon, cor: 'text-emerald-600 bg-emerald-50' },
    { tipos: ['produto'], nome: 'Produtos', icone: ShoppingBagIcon, cor: 'text-pink-600 bg-pink-50' },
    { tipos: ['personalizado', 'livre'], nome: 'Seus itens', icone: PencilSquareIcon, cor: 'text-amber-600 bg-amber-50' },
];

const FILTROS = [
    { id: 'premium', nome: 'Premium', icone: SparklesIcon, ativo: 'bg-gray-900 text-white border-gray-900' },
    { id: 'promocao', nome: 'Em promoção', icone: TagIcon, ativo: 'bg-red-500 text-white border-red-500' },
    { id: 'cupom', nome: 'Com cupom', icone: TicketIcon, ativo: 'bg-violet-600 text-white border-violet-600' },
    { id: 'relampago', nome: 'Oferta relâmpago', icone: BoltIcon, ativo: 'bg-amber-500 text-white border-amber-500' },
];

const ORDENS = [
    { id: 'relevancia', nome: 'Mais relevantes' },
    { id: 'menor_preco', nome: 'Menor preço' },
    { id: 'maior_preco', nome: 'Maior preço' },
    { id: 'avaliacao', nome: 'Mais bem avaliados' },
];

const SUGESTOES = {
    tudo: ['Hotel', 'Passeio', 'Carro', 'Restaurante', 'Spa'],
    hospedagem: ['Pousada', 'Hotel', 'Casa', 'Apartamento'],
    passeios: ['Passeio de barco', 'Restaurante', 'Spa', 'Trilha'],
    transporte: ['Carro', 'Moto', 'Bicicleta', 'Barco'],
    produtos: ['Protetor solar', 'Bebidas', 'Lanches'],
};

const ICONE_TIPO = { hospedagem: HomeModernIcon, transporte: TruckIcon, servico: MapIcon, atracao: MapIcon, produto: ShoppingBagIcon };
const NOME_TIPO = { hospedagem: 'Hospedagem', transporte: 'Transporte', servico: 'Serviço', atracao: 'Passeio', produto: 'Produto' };

// "1h20" que faltam para a oferta relâmpago acabar.
const faltaPara = (iso) => {
    const min = Math.max(0, Math.round((new Date(iso) - new Date()) / 60000));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return min % 60 ? `${h}h${String(min % 60).padStart(2, '0')}` : `${h}h`;
};

const hojeIso = () => new Date().toISOString().slice(0, 10);
const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
const campo = 'w-full rounded-xl border-0 bg-gray-50 py-2.5 text-sm text-gray-900 ring-1 ring-gray-200 focus:bg-white focus:ring-2 focus:ring-[#FF5A00]';

function Passos({ etapa }) {
    const passos = ['Destino e datas', 'Monte sua mala', 'Pronto'];
    return (
        <ol className="flex items-center gap-2 text-xs font-bold sm:text-sm">
            {passos.map((p, i) => {
                const n = i + 1;
                const feito = etapa > n;
                const atual = etapa === n;
                return (
                    <li key={p} className="flex items-center gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${feito || atual ? 'bg-[#FF5A00] text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {feito ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : n}
                        </span>
                        <span className={atual ? 'text-gray-900' : 'text-gray-400'}>{p}</span>
                        {i < passos.length - 1 && <span className="mx-1 h-px w-6 bg-gray-300 sm:w-10" />}
                    </li>
                );
            })}
        </ol>
    );
}

export default function Nova({ premium, cidadeInicial }) {
    const [etapa, setEtapa] = useState(1);
    const [f, setF] = useState({ cidade: cidadeInicial || '', data_inicio: '', data_fim: '', pessoas: 2, orcamento: '', titulo: '' });
    const [aviso, setAviso] = useState(null);

    const [aba, setAba] = useState('tudo');
    const [busca, setBusca] = useState('');
    const [filtros, setFiltros] = useState([]);
    const [ordem, setOrdem] = useState('relevancia');
    const [precoMax, setPrecoMax] = useState('');
    const [maisFiltros, setMaisFiltros] = useState(false);
    const [catalogo, setCatalogo] = useState([]);
    const [contagem, setContagem] = useState({});
    const [carregando, setCarregando] = useState(false);
    const [mala, setMala] = useState([]);
    const [malaAberta, setMalaAberta] = useState(false);
    const [enchendo, setEnchendo] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [meu, setMeu] = useState({ titulo: '', tipo: 'personalizado', dia: '', valor: '' });

    const noites = f.data_inicio && f.data_fim ? Math.max(1, diasEntre(f.data_inicio, f.data_fim)) : 1;
    const totalDias = f.data_inicio && f.data_fim ? diasEntre(f.data_inicio, f.data_fim) + 1 : 1;
    const diasDaViagem = useMemo(() => (f.data_inicio ? Array.from({ length: totalDias }, (_, i) => somarDias(f.data_inicio, i)) : []), [f.data_inicio, totalDias]);

    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    // ---------- etapa 1
    const irParaMala = (e) => {
        e.preventDefault();
        if (!f.cidade.trim()) return setAviso({ tipo: 'erro', texto: 'Diga a cidade de destino.' });
        if (!f.data_inicio || !f.data_fim) return setAviso({ tipo: 'erro', texto: 'Escolha a data de ida e de volta.' });
        if (f.data_fim < f.data_inicio) return setAviso({ tipo: 'erro', texto: 'A volta precisa ser depois da ida.' });
        if (diasEntre(f.data_inicio, f.data_fim) > 30) return setAviso({ tipo: 'erro', texto: 'A viagem pode ter até 31 dias.' });
        setAviso(null);
        setEtapa(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ---------- catálogo
    useEffect(() => {
        if (etapa !== 2 || aba === 'meu') return undefined;
        const t = setTimeout(async () => {
            setCarregando(true);
            try {
                const { data } = await axios.get(route('viagens.mala.catalogo'), {
                    params: { categoria: aba, cidade: f.cidade, busca: busca || undefined, filtros: filtros.length ? filtros : undefined, ordem, preco_max: precoMax || undefined },
                });
                setCatalogo(data.itens || []);
                setContagem(data.contagem || {});
            } catch {
                setCatalogo([]);
                setContagem({});
            } finally {
                setCarregando(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [etapa, aba, busca, filtros, ordem, precoMax, f.cidade]);

    const alternarFiltro = (id) => setFiltros((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
    const temFiltro = filtros.length > 0 || precoMax !== '' || ordem !== 'relevancia';
    const limparFiltros = () => { setFiltros([]); setPrecoMax(''); setOrdem('relevancia'); };

    // ---------- mala
    const naMala = (chave) => mala.some((m) => m.chave === chave);
    const quantidadePadrao = (tipo) => (tipo === 'hospedagem' ? noites : tipo === 'transporte' ? totalDias : ['servico', 'atracao'].includes(tipo) ? Number(f.pessoas) || 1 : 1);

    const porNaMala = (item) => {
        if (naMala(item.chave)) {
            setMala((m) => m.filter((x) => x.chave !== item.chave));
            return;
        }
        const longo = ['hospedagem', 'transporte'].includes(item.tipo);
        setMala((m) => [...m, {
            ...item,
            qtd: quantidadePadrao(item.tipo),
            dia: f.data_inicio,
            data_fim: longo ? f.data_fim : null,
            origem: 'manual',
        }]);
    };

    const mudarQtd = (chave, delta) => setMala((m) => m.map((x) => (x.chave === chave ? { ...x, qtd: Math.max(1, x.qtd + delta) } : x)));
    const mudarDia = (chave, dia) => setMala((m) => m.map((x) => (x.chave === chave ? { ...x, dia } : x)));
    const tirar = (chave) => setMala((m) => m.filter((x) => x.chave !== chave));
    const custo = (x) => (x.preco_fixo !== undefined ? x.preco_fixo : x.preco * x.qtd);
    const total = mala.reduce((s, x) => s + custo(x), 0);
    const orc = f.orcamento ? Number(f.orcamento) : null;

    const adicionarMeu = (e) => {
        e.preventDefault();
        if (!meu.titulo.trim()) return;
        setMala((m) => [...m, {
            chave: `meu-${Date.now()}`, tipo: meu.tipo, titulo: meu.titulo.trim(), subtitulo: 'Adicionado por você',
            preco: 0, preco_fixo: Number(meu.valor) || 0, qtd: 1, unidade: '', dia: meu.dia || f.data_inicio, data_fim: null, origem: 'manual',
        }]);
        setMeu({ titulo: '', tipo: 'personalizado', dia: '', valor: '' });
    };

    // Premium: o roteiro inteligente sugere a mala inteira.
    const encherAutomatico = async () => {
        setEnchendo(true);
        setAviso(null);
        try {
            const { data } = await axios.post(route('viagens.previa'), {
                cidade: f.cidade, data_inicio: f.data_inicio, data_fim: f.data_fim, pessoas: Number(f.pessoas),
                orcamento: orc || undefined, preferencias: { ritmo: 'moderado', precisa_hospedagem: !mala.some((x) => x.tipo === 'hospedagem'), precisa_veiculo: false, interesses: [] },
            });
            const sugeridos = (data.itens || [])
                .filter((i) => !mala.some((x) => (i.servico_id && x.servico_id === i.servico_id) || (i.item_aluguel_id && x.item_aluguel_id === i.item_aluguel_id)))
                .map((i, k) => ({ ...i, chave: `auto-${Date.now()}-${k}`, subtitulo: i.descricao || 'Sugestão do roteiro inteligente', preco: 0, preco_fixo: Number(i.custo_estimado) || 0, qtd: 1, unidade: '', origem: 'auto' }));
            setMala((m) => [...m, ...sugeridos]);
            setAviso({ tipo: 'ok', texto: sugeridos.length ? `${sugeridos.length} sugestões foram para a sua mala. Tire o que não quiser.` : 'Não encontramos novas sugestões para este destino.' });
            if (data.avisos?.length) setAviso({ tipo: 'erro', texto: data.avisos.join(' ') });
        } catch (err) {
            setAviso({ tipo: 'erro', texto: erroDe(err) });
        } finally {
            setEnchendo(false);
        }
    };

    const criarViagem = async () => {
        setSalvando(true);
        setAviso(null);
        try {
            const itens = mala.map((x, ordem) => ({
                tipo: x.tipo,
                titulo: x.titulo,
                descricao: [x.subtitulo, x.qtd > 1 && x.unidade ? `${x.qtd} × ${fmt(x.preco)} ${x.unidade}` : null, x.produto_id ? `Produto #${x.produto_id}` : null, x.cupom ? `Cupom ${x.cupom.codigo} (${x.cupom.rotulo})` : null].filter(Boolean).join(' · ') || null,
                dia: x.dia || f.data_inicio,
                data_fim: x.data_fim || null,
                hora_inicio: x.hora_inicio || null,
                custo_estimado: custo(x),
                servico_id: x.servico_id || null,
                item_aluguel_id: x.item_aluguel_id || null,
                estabelecimento_id: x.estabelecimento_id || null,
                endereco: x.endereco || null,
                latitude: x.latitude || null,
                longitude: x.longitude || null,
                destaque_premium: Boolean(x.premium || x.destaque_premium),
                origem: x.origem,
                ordem,
            }));
            const { data } = await axios.post(route('viagens.store'), {
                cidade: f.cidade.trim(), data_inicio: f.data_inicio, data_fim: f.data_fim, pessoas: Number(f.pessoas),
                orcamento: orc || undefined, titulo: f.titulo.trim() || `Viagem para ${f.cidade.trim()}`, itens,
            });
            setEtapa(3);
            router.visit(data.url);
        } catch (err) {
            setAviso({ tipo: 'erro', texto: erroDe(err) });
            setSalvando(false);
        }
    };

    const abaAtual = ABAS.find((a) => a.id === aba);

    // ---------- painel da mala (lateral no computador, gaveta no celular)
    const PainelMala = (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-black text-gray-900"><BriefcaseIcon className="h-5 w-5 text-[#FF5A00]" /> Sua mala</h3>
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-[#FF5A00]">{mala.length} {mala.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{f.cidade} · {fmtDia(f.data_inicio)} a {fmtDia(f.data_fim)} · {f.pessoas} {Number(f.pessoas) === 1 ? 'pessoa' : 'pessoas'}</p>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                {mala.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                        <BriefcaseIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                        Sua mala está vazia. Escolha a hospedagem, os passeios, o transporte e os produtos ao lado.
                    </div>
                )}
                {GRUPOS.map((g) => {
                    const doGrupo = mala.filter((x) => g.tipos.includes(x.tipo));
                    if (!doGrupo.length) return null;
                    return (
                        <div key={g.nome}>
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-400"><g.icone className="h-4 w-4" /> {g.nome}</p>
                            <ul className="space-y-2">
                                {doGrupo.map((x) => (
                                    <li key={x.chave} className="rounded-2xl border border-gray-100 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-gray-900">{x.titulo}</p>
                                                <p className="truncate text-xs text-gray-400">{x.subtitulo}</p>
                                            </div>
                                            <button type="button" onClick={() => tirar(x.chave)} className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500" aria-label="Tirar da mala"><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            {x.data_fim ? (
                                                <span className="text-xs text-gray-500">{fmtDia(x.dia)} → {fmtDia(x.data_fim)}</span>
                                            ) : (
                                                <select value={x.dia} onChange={(e) => mudarDia(x.chave, e.target.value)} className="rounded-lg border-gray-200 py-1 pl-2 pr-7 text-xs focus:border-[#FF5A00] focus:ring-[#FF5A00]" aria-label="Dia">
                                                    {diasDaViagem.map((d) => <option key={d} value={d}>{fmtDia(d)}</option>)}
                                                </select>
                                            )}
                                            {x.preco_fixo === undefined ? (
                                                <div className="flex items-center gap-1">
                                                    <button type="button" onClick={() => mudarQtd(x.chave, -1)} className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50" aria-label="Menos"><MinusIcon className="h-3.5 w-3.5" /></button>
                                                    <span className="w-14 text-center text-xs font-bold text-gray-700">{x.qtd} {x.unidade === '/noite' ? (x.qtd === 1 ? 'noite' : 'noites') : x.unidade === '/dia' ? (x.qtd === 1 ? 'dia' : 'dias') : x.unidade === '/pessoa' ? (x.qtd === 1 ? 'pessoa' : 'pessoas') : 'un.'}</span>
                                                    <button type="button" onClick={() => mudarQtd(x.chave, 1)} className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50" aria-label="Mais"><PlusIcon className="h-3.5 w-3.5" /></button>
                                                </div>
                                            ) : null}
                                            <span className="text-sm font-black text-gray-900">{fmt(custo(x))}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-end justify-between">
                    <span className="text-sm text-gray-500">Total estimado</span>
                    <span className="text-2xl font-black text-gray-900">{fmt(total)}</span>
                </div>
                <p className="text-xs text-gray-400">{fmt(total / Math.max(Number(f.pessoas) || 1, 1))} por pessoa</p>
                {orc ? (
                    <div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${total > orc ? 'bg-red-500' : 'bg-[#FF5A00]'}`} style={{ width: `${Math.min(100, (total / orc) * 100)}%` }} />
                        </div>
                        <p className={`mt-1 text-xs font-semibold ${total > orc ? 'text-red-600' : 'text-emerald-600'}`}>
                            {total > orc ? `Passa ${fmt(total - orc)} do orçamento` : `Sobram ${fmt(orc - total)} do orçamento`}
                        </p>
                    </div>
                ) : null}
                <button type="button" onClick={criarViagem} disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A00] py-3 text-sm font-black text-white hover:bg-[#E85200] disabled:opacity-60">
                    {salvando ? 'Criando…' : <>Criar viagem <ArrowRightIcon className="h-4 w-4" /></>}
                </button>
                <p className="text-center text-[11px] text-gray-400">Depois você reserva cada item, convida o grupo e divide os gastos.</p>
            </div>
        </div>
    );

    return (
        <AuthenticatedLayout>
            <Head title="Nova viagem" />

            <div className="mx-auto max-w-7xl space-y-5 pb-24 lg:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href={route('viagens.index')} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-800"><ArrowLeftIcon className="h-4 w-4" /> Minhas viagens</Link>
                        <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Nova viagem</h1>
                    </div>
                    <Passos etapa={etapa} />
                </div>

                <Aviso aviso={aviso} onFechar={() => setAviso(null)} />

                {/* ===== ETAPA 1: DESTINO E DATAS ===== */}
                {etapa === 1 && (
                    <form onSubmit={irParaMala} className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Para onde você vai?</h2>
                            <p className="text-sm text-gray-500">Depois é só escolher o que vai na mala: hospedagem, passeios, transporte e produtos.</p>
                        </div>
                        <label className="block text-xs font-semibold text-gray-600">Cidade de destino
                            <div className="relative mt-1">
                                <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input value={f.cidade} onChange={set('cidade')} placeholder="Ex.: Porto de Galinhas" className={`${campo} pl-10 pr-3`} autoFocus required />
                            </div>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-gray-600">Ida
                                <div className="relative mt-1">
                                    <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input type="date" min={hojeIso()} value={f.data_inicio} onChange={set('data_inicio')} className={`${campo} pl-10 pr-3`} required />
                                </div>
                            </label>
                            <label className="block text-xs font-semibold text-gray-600">Volta
                                <div className="relative mt-1">
                                    <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input type="date" min={f.data_inicio || hojeIso()} value={f.data_fim} onChange={set('data_fim')} className={`${campo} pl-10 pr-3`} required />
                                </div>
                            </label>
                            <label className="block text-xs font-semibold text-gray-600">Quantas pessoas
                                <div className="relative mt-1">
                                    <UsersIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input type="number" min="1" max="50" value={f.pessoas} onChange={set('pessoas')} className={`${campo} pl-10 pr-3`} required />
                                </div>
                            </label>
                            <label className="block text-xs font-semibold text-gray-600">Orçamento total <span className="font-normal text-gray-400">(opcional)</span>
                                <div className="relative mt-1">
                                    <WalletIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input type="number" min="0" step="50" value={f.orcamento} onChange={set('orcamento')} placeholder="R$" className={`${campo} pl-10 pr-3`} />
                                </div>
                            </label>
                        </div>
                        <label className="block text-xs font-semibold text-gray-600">Nome da viagem <span className="font-normal text-gray-400">(opcional)</span>
                            <input value={f.titulo} onChange={set('titulo')} maxLength={200} placeholder={f.cidade ? `Férias em ${f.cidade}` : 'Ex.: Férias em família'} className={`mt-1 ${campo} px-4`} />
                        </label>
                        {f.data_inicio && f.data_fim && f.data_fim >= f.data_inicio && (
                            <p className="rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-gray-700">
                                <b>{totalDias} {totalDias === 1 ? 'dia' : 'dias'}</b> e <b>{noites} {noites === 1 ? 'noite' : 'noites'}</b> em {f.cidade || 'seu destino'}.
                            </p>
                        )}
                        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A00] py-3.5 text-sm font-black text-white hover:bg-[#E85200]">
                            Montar minha mala <ArrowRightIcon className="h-4 w-4" />
                        </button>
                    </form>
                )}

                {/* ===== ETAPA 2: MALA ===== */}
                {etapa === 2 && (
                    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">Destino</p>
                                    <p className="font-black text-gray-900">{f.cidade} <span className="font-normal text-gray-400">· {fmtDia(f.data_inicio)} a {fmtDia(f.data_fim)}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setEtapa(1)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Alterar</button>
                                    {premium ? (
                                        <button type="button" onClick={encherAutomatico} disabled={enchendo} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-60">
                                            <SparklesIcon className="h-4 w-4 text-orange-400" /> {enchendo ? 'Montando…' : 'Encher a mala automaticamente'}
                                        </button>
                                    ) : (
                                        <Link href={route('assinatura.status')} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200" title="Recurso Premium">
                                            <LockClosedIcon className="h-4 w-4" /> Encher automaticamente (Premium)
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* ABAS */}
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {ABAS.map((a) => (
                                    <button key={a.id} type="button" onClick={() => setAba(a.id)}
                                        className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${aba === a.id ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                                        <a.icone className="h-5 w-5" /> {a.nome}
                                        {!['meu', 'tudo'].includes(a.id) && mala.some((x) => (a.id === 'passeios' ? ['servico', 'atracao'].includes(x.tipo) : a.id === 'produtos' ? x.tipo === 'produto' : x.tipo === a.id)) && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                                    </button>
                                ))}
                            </div>
                            <p className="text-sm text-gray-500">{abaAtual?.dica}</p>

                            {aba === 'meu' ? (
                                <form onSubmit={adicionarMeu} className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-6">
                                    <label className="text-xs font-semibold text-gray-600 sm:col-span-6">O que é
                                        <input value={meu.titulo} onChange={(e) => setMeu({ ...meu, titulo: e.target.value })} maxLength={200} placeholder="Ex.: Passagem de avião, jantar no restaurante X" className={`mt-1 ${campo} px-4`} required />
                                    </label>
                                    <label className="text-xs font-semibold text-gray-600 sm:col-span-2">Tipo
                                        <select value={meu.tipo} onChange={(e) => setMeu({ ...meu, tipo: e.target.value })} className={`mt-1 ${campo} px-3`}>
                                            <option value="personalizado">Compromisso</option>
                                            <option value="transporte">Transporte / passagem</option>
                                            <option value="hospedagem">Hospedagem</option>
                                            <option value="atracao">Passeio</option>
                                            <option value="produto">Produto</option>
                                        </select>
                                    </label>
                                    <label className="text-xs font-semibold text-gray-600 sm:col-span-2">Dia
                                        <select value={meu.dia || f.data_inicio} onChange={(e) => setMeu({ ...meu, dia: e.target.value })} className={`mt-1 ${campo} px-3`}>
                                            {diasDaViagem.map((d) => <option key={d} value={d}>{fmtDia(d)}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-xs font-semibold text-gray-600 sm:col-span-2">Valor <span className="font-normal text-gray-400">(R$)</span>
                                        <input type="number" min="0" step="0.01" value={meu.valor} onChange={(e) => setMeu({ ...meu, valor: e.target.value })} className={`mt-1 ${campo} px-3`} />
                                    </label>
                                    <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5A00] py-2.5 text-sm font-bold text-white hover:bg-[#E85200] sm:col-span-6">
                                        <PlusIcon className="h-4 w-4" /> Pôr na mala
                                    </button>
                                </form>
                            ) : (
                                <>
                                    <div className="space-y-3 rounded-3xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
                                        <div className="flex gap-2">
                                            <label className="relative block flex-1">
                                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                                                    placeholder={aba === 'tudo' ? `Hotel, passeio, carro, produto… em ${f.cidade}` : `Buscar em ${abaAtual?.nome.toLowerCase()} em ${f.cidade}`}
                                                    className="w-full rounded-2xl border-0 bg-gray-50 py-3 pl-11 pr-10 text-sm text-gray-900 ring-1 ring-gray-200 focus:bg-white focus:ring-2 focus:ring-[#FF5A00]" />
                                                {busca && (
                                                    <button type="button" onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700" aria-label="Limpar busca"><XMarkIcon className="h-4 w-4" /></button>
                                                )}
                                            </label>
                                            <button type="button" onClick={() => setMaisFiltros((v) => !v)}
                                                className={`relative inline-flex items-center gap-1.5 rounded-2xl border px-3 text-sm font-bold transition ${maisFiltros ? 'border-[#FF5A00] bg-orange-50 text-[#FF5A00]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                <AdjustmentsHorizontalIcon className="h-5 w-5" /> <span className="hidden sm:inline">Filtros</span>
                                                {(precoMax !== '' || ordem !== 'relevancia') && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#FF5A00]" />}
                                            </button>
                                        </div>

                                        {/* Selos: Premium, promoção, cupom e relâmpago, com quantos existem na busca atual */}
                                        <div className="flex gap-2 overflow-x-auto pb-0.5">
                                            {FILTROS.map((fi) => {
                                                const ligado = filtros.includes(fi.id);
                                                const qtd = contagem[fi.id];
                                                return (
                                                    <button key={fi.id} type="button" onClick={() => alternarFiltro(fi.id)}
                                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${ligado ? fi.ativo : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                                                        <fi.icone className="h-4 w-4" /> {fi.nome}
                                                        {qtd !== undefined && !ligado && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">{qtd}</span>}
                                                        {ligado && <XMarkIcon className="h-3.5 w-3.5" />}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {maisFiltros && (
                                            <div className="grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-3">
                                                <label className="text-xs font-semibold text-gray-600">Ordenar por
                                                    <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className={`mt-1 ${campo} px-3`}>
                                                        {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-xs font-semibold text-gray-600">Preço até <span className="font-normal text-gray-400">(R$)</span>
                                                    <input type="number" min="0" step="10" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Sem limite" className={`mt-1 ${campo} px-3`} />
                                                </label>
                                                <div className="flex items-end">
                                                    <button type="button" onClick={limparFiltros} disabled={!temFiltro} className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">Limpar filtros</button>
                                                </div>
                                            </div>
                                        )}

                                        {!busca && SUGESTOES[aba] && (
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                <span className="text-gray-400">Experimente:</span>
                                                {SUGESTOES[aba].map((sug) => (
                                                    <button key={sug} type="button" onClick={() => setBusca(sug)} className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600 hover:bg-orange-50 hover:text-[#FF5A00]">{sug}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {!carregando && (
                                        <p className="text-sm text-gray-500">
                                            <b className="text-gray-900">{catalogo.length}</b> {catalogo.length === 1 ? 'resultado' : 'resultados'}
                                            {busca ? <> para “{busca}”</> : null} em {f.cidade}
                                            {temFiltro && <> · <button type="button" onClick={limparFiltros} className="font-bold text-[#FF5A00] hover:underline">limpar filtros</button></>}
                                        </p>
                                    )}

                                    {carregando ? (
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />)}
                                        </div>
                                    ) : catalogo.length === 0 ? (
                                        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                                            <abaAtual.icone className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            {busca || filtros.length || precoMax ? (
                                                <>
                                                    <p className="font-bold text-gray-800">Nada encontrado com essa busca.</p>
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Tente outra palavra{temFiltro && <>, <button type="button" onClick={limparFiltros} className="font-bold text-[#FF5A00] hover:underline">limpe os filtros</button></>}
                                                        {aba !== 'tudo' && <> ou busque em <button type="button" onClick={() => setAba('tudo')} className="font-bold text-[#FF5A00] hover:underline">Tudo</button></>}.
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-bold text-gray-800">Nada {aba === 'tudo' ? 'cadastrado' : `de ${abaAtual?.nome.toLowerCase()}`} em {f.cidade} ainda.</p>
                                                    <p className="mt-1 text-sm text-gray-500">Você pode adicionar por conta própria em <button type="button" onClick={() => setAba('meu')} className="font-bold text-[#FF5A00] hover:underline">"Algo seu"</button>.</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {catalogo.map((item) => {
                                                const dentro = naMala(item.chave);
                                                const Icone = ICONE_TIPO[item.tipo] || abaAtual.icone;
                                                return (
                                                    <article key={item.chave} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${dentro ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-gray-100 hover:shadow-md'}`}>
                                                        <div className="relative aspect-[16/10] bg-gray-100">
                                                            {item.foto ? <img src={item.foto} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Icone className="h-10 w-10 text-gray-300" /></span>}
                                                            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                                                                {item.relampago && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-white"><BoltIcon className="h-3 w-3" /> -{item.relampago.percentual}% · {faltaPara(item.relampago.expira_em)}</span>}
                                                                {!item.relampago && item.promocao && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">-{item.promocao.percentual}%</span>}
                                                                {item.premium && <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FF5A00] px-2 py-0.5 text-[10px] font-black uppercase text-white"><SparklesIcon className="h-3 w-3" /> Destaque</span>}
                                                                {item.so_premium && <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black uppercase text-white"><LockClosedIcon className="h-3 w-3" /> Só Premium</span>}
                                                            </div>
                                                            {aba === 'tudo' && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 backdrop-blur"><Icone className="h-3 w-3" /> {NOME_TIPO[item.tipo]}</span>}
                                                            {dentro && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white"><CheckIcon className="h-3 w-3" strokeWidth={3} /> Na mala</span>}
                                                        </div>
                                                        <div className="flex flex-1 flex-col p-3">
                                                            <p className="line-clamp-1 text-sm font-bold text-gray-900">{item.titulo}</p>
                                                            <p className="line-clamp-1 text-xs capitalize text-gray-500">{item.subtitulo}</p>
                                                            {item.cupom && (
                                                                <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700" title={item.cupom.titulo}>
                                                                    <TicketIcon className="h-3.5 w-3.5" /> {item.cupom.rotulo} · {item.cupom.codigo}{item.cupom.apenas_plus ? ' · Premium' : ''}
                                                                </p>
                                                            )}
                                                            <div className="mt-auto flex items-end justify-between pt-2">
                                                                <span className="text-sm font-black text-gray-900">
                                                                    {item.promocao && <span className="mr-1 text-xs font-normal text-gray-400 line-through">{fmt(item.promocao.de)}</span>}
                                                                    <span className={item.promocao ? 'text-red-600' : ''}>{item.preco > 0 ? fmt(item.preco) : 'Consultar'}</span>
                                                                    <span className="text-xs font-normal text-gray-400"> {item.preco > 0 ? item.unidade : ''}</span>
                                                                </span>
                                                                {item.avaliacao && <span className="inline-flex items-center gap-0.5 text-xs font-bold text-gray-600"><StarIcon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{String(item.avaliacao).replace('.', ',')}</span>}
                                                            </div>
                                                            <button type="button" onClick={() => porNaMala(item)}
                                                                className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${dentro ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-[#FF5A00] text-white hover:bg-[#E85200]'}`}>
                                                                {dentro ? <><CheckIcon className="h-4 w-4" /> Na mala · tirar</> : <><PlusIcon className="h-4 w-4" /> Pôr na mala</>}
                                                            </button>
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Mala: lateral fixa no computador */}
                        <aside className="hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start">
                            {PainelMala}
                        </aside>
                    </div>
                )}
            </div>

            {/* Mala no celular: barra fixa que abre a gaveta */}
            {etapa === 2 && (
                <>
                    <button type="button" onClick={() => setMalaAberta(true)} className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-2xl lg:hidden">
                        <span className="flex items-center gap-2 text-sm font-bold"><BriefcaseIcon className="h-5 w-5 text-orange-400" /> Sua mala ({mala.length})</span>
                        <span className="flex items-center gap-2 text-sm font-black">{fmt(total)} <ChevronUpIcon className="h-4 w-4" /></span>
                    </button>
                    {malaAberta && (
                        <div className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden" onClick={() => setMalaAberta(false)}>
                            <div className="max-h-[85vh] w-full overflow-hidden rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
                                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />
                                <div className="max-h-[calc(85vh-3rem)]">{PainelMala}</div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AuthenticatedLayout>
    );
}
