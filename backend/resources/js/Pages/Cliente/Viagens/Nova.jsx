import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import axios from 'axios';
import { SparklesIcon, MapPinIcon, LockClosedIcon, StarIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import ItemCard from '@/Components/Viagem/ItemCard';
import { Aviso, agruparPorDia, erroDe, fmt, fmtDiaLongo, inputClasse } from '@/Components/Viagem/util';

const INTERESSES = ['praia', 'gastronomia', 'aventura', 'cultura', 'bem-estar', 'família', 'vida noturna', 'natureza'];
const RITMOS = [['leve', 'Leve', '2 paradas por dia'], ['moderado', 'Moderado', '3 paradas por dia'], ['intenso', 'Intenso', '4 paradas por dia']];

export default function Nova({ premium, cidadeInicial }) {
    const hoje = new Date().toISOString().slice(0, 10);
    const [f, setF] = useState({
        cidade: cidadeInicial || '', data_inicio: '', data_fim: '', pessoas: 2, orcamento: '', titulo: '',
        ritmo: 'moderado', precisa_hospedagem: true, precisa_veiculo: false, interesses: [],
    });
    const [coords, setCoords] = useState(null);
    const [previa, setPrevia] = useState(null);
    const [itens, setItens] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [aviso, setAviso] = useState(null);

    const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const alternarInteresse = (i) => setF({ ...f, interesses: f.interesses.includes(i) ? f.interesses.filter((x) => x !== i) : [...f.interesses, i] });

    const pedido = () => ({
        cidade: f.cidade || undefined,
        latitude: !f.cidade && coords ? coords.lat : undefined,
        longitude: !f.cidade && coords ? coords.lng : undefined,
        data_inicio: f.data_inicio, data_fim: f.data_fim, pessoas: Number(f.pessoas),
        orcamento: f.orcamento ? Number(f.orcamento) : undefined,
        preferencias: { ritmo: f.ritmo, precisa_hospedagem: f.precisa_hospedagem, precisa_veiculo: f.precisa_veiculo, interesses: f.interesses },
    });

    const usarLocalizacao = () => {
        if (!navigator.geolocation) return setAviso({ tipo: 'erro', texto: 'Seu navegador não permite localização.' });
        navigator.geolocation.getCurrentPosition(
            (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setF((x) => ({ ...x, cidade: '' })); setAviso({ tipo: 'ok', texto: 'Localização captada. Vamos montar o roteiro na cidade mais próxima com serviços do Lokyva.' }); },
            () => setAviso({ tipo: 'erro', texto: 'Não foi possível obter sua localização. Digite a cidade.' }),
            { timeout: 8000 },
        );
    };

    const gerar = async (e) => {
        e.preventDefault();
        setCarregando(true); setAviso(null);
        try {
            const { data } = await axios.post(route('viagens.previa'), pedido());
            setPrevia(data); setItens(data.itens);
            setTimeout(() => document.getElementById('previa')?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) {
            setAviso({ tipo: 'erro', texto: erroDe(err) });
        } finally { setCarregando(false); }
    };

    const salvar = async () => {
        setSalvando(true);
        try {
            const { data } = await axios.post(route('viagens.store'), { ...pedido(), cidade: previa?.cidade || f.cidade, estado: previa?.estado || undefined, latitude: undefined, longitude: undefined, titulo: f.titulo, itens });
            router.visit(data.url);
        } catch (err) {
            setAviso({ tipo: 'erro', texto: erroDe(err) });
            setSalvando(false);
        }
    };

    const agrupado = useMemo(() => agruparPorDia(itens), [itens]);
    const total = itens.reduce((s, i) => s + Number(i.custo_estimado || 0), 0);
    const orc = f.orcamento ? Number(f.orcamento) : null;

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">Roteiro inteligente</h2>}>
            <Head title="Nova viagem" />
            <div className="max-w-5xl mx-auto space-y-6">
                <Link href={route('viagens.index')} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-800"><ArrowLeftIcon className="w-4 h-4" /> Minhas viagens</Link>

                {!premium && (
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl p-8 shadow-lg">
                        <LockClosedIcon className="w-10 h-10 text-[#FF5A00] mb-3" />
                        <h3 className="text-2xl font-black">Roteiro inteligente é para assinantes Premium</h3>
                        <p className="text-white/70 mt-2 max-w-xl">Informe cidade, datas e orçamento e o Lokyva monta hospedagem, passeios e serviços com o tempo de deslocamento entre cada parada — e você divide tudo com o grupo.</p>
                        <Link href={route('assinatura.status')} className="inline-block mt-5 px-6 py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] font-black transition">Conhecer os planos</Link>
                    </div>
                )}

                <form onSubmit={gerar} className={`bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5 ${!premium ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                    <div className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-[#FF5A00]" /><h3 className="font-black text-gray-900">Para onde você vai?</h3></div>

                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                            <div className="flex gap-2 mt-1">
                                <input className={inputClasse} placeholder={coords ? 'Usando sua localização' : 'Ex.: Maceió'} value={f.cidade} onChange={(e) => { setF({ ...f, cidade: e.target.value }); setCoords(null); }} />
                                <button type="button" onClick={usarLocalizacao} title="Usar minha localização" className="shrink-0 px-3 rounded-xl border border-gray-200 hover:border-[#FF5A00] text-gray-500 hover:text-[#FF5A00]"><MapPinIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Pessoas</label>
                            <input type="number" min="1" max="50" className={`${inputClasse} mt-1`} value={f.pessoas} onChange={set('pessoas')} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Ida</label>
                            <input type="date" min={hoje} className={`${inputClasse} mt-1`} value={f.data_inicio} onChange={set('data_inicio')} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Volta</label>
                            <input type="date" min={f.data_inicio || hoje} className={`${inputClasse} mt-1`} value={f.data_fim} onChange={set('data_fim')} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Orçamento total (R$)</label>
                            <input type="number" min="0" step="50" placeholder="Opcional" className={`${inputClasse} mt-1`} value={f.orcamento} onChange={set('orcamento')} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Ritmo da viagem</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            {RITMOS.map(([v, n, d]) => (
                                <button type="button" key={v} onClick={() => setF({ ...f, ritmo: v })}
                                    className={`text-left rounded-xl border px-3 py-2 transition ${f.ritmo === v ? 'border-[#FF5A00] bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <p className="font-black text-sm text-gray-900">{n}</p><p className="text-xs text-gray-500">{d}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Interesses (opcional)</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {INTERESSES.map((i) => (
                                <button type="button" key={i} onClick={() => alternarInteresse(i)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${f.interesses.includes(i) ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{i}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm font-semibold text-gray-700">
                        <label className="flex items-center gap-2"><input type="checkbox" className="rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" checked={f.precisa_hospedagem} onChange={set('precisa_hospedagem')} /> Incluir hospedagem</label>
                        <label className="flex items-center gap-2"><input type="checkbox" className="rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" checked={f.precisa_veiculo} onChange={set('precisa_veiculo')} /> Incluir aluguel de veículo</label>
                    </div>

                    <Aviso aviso={aviso} onFechar={() => setAviso(null)} />

                    <button disabled={carregando} className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white font-black transition">
                        {carregando ? 'Montando seu roteiro…' : 'Montar roteiro'}
                    </button>
                </form>

                {previa && (
                    <section id="previa" className="space-y-4">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Seu roteiro</p>
                                    <h3 className="text-2xl font-black text-gray-900">{previa.cidade} · {previa.dias} {previa.dias === 1 ? 'dia' : 'dias'}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-gray-900">{fmt(total)}</p>
                                    <p className="text-xs text-gray-500">
                                        {fmt(total / Math.max(Number(f.pessoas), 1))} por pessoa{orc ? ` · ${total <= orc ? `sobram ${fmt(orc - total)}` : `passa ${fmt(total - orc)} do orçamento`}` : ''}
                                    </p>
                                </div>
                            </div>
                            {previa.resumo.itens_premium > 0 && (
                                <p className="mt-3 text-sm text-amber-700 flex items-center gap-1"><StarIcon className="w-4 h-4" /> {previa.resumo.itens_premium} recomendações de parceiros Premium neste roteiro.</p>
                            )}
                            {previa.avisos.map((a, i) => <p key={i} className="mt-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{a}</p>)}
                        </div>

                        {itens.length > 0 && (
                            <div className="bg-gray-50 rounded-3xl p-5 space-y-2">
                                {agrupado.fixos.length > 0 && <p className="text-xs font-black text-gray-400 uppercase pl-1">Durante toda a viagem</p>}
                                {agrupado.fixos.map((i, k) => <ItemCard key={`f${k}`} item={i} previa onRemover={(x) => setItens(itens.filter((y) => y !== x))} />)}
                                {agrupado.dias.map(({ dia, itens: lista }) => (
                                    <div key={dia}>
                                        <p className="text-sm font-black text-gray-800 capitalize mt-3 mb-2 pl-1">{fmtDiaLongo(dia)}</p>
                                        {lista.map((i, k) => <ItemCard key={`${dia}${k}`} item={i} previa onRemover={(x) => setItens(itens.filter((y) => y !== x))} />)}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-3">
                            <input className={`${inputClasse} sm:flex-1`} placeholder={`Nome da viagem (ex.: Férias em ${previa.cidade})`} value={f.titulo} onChange={set('titulo')} maxLength={200} />
                            <button onClick={salvar} disabled={salvando} className="px-8 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black transition">{salvando ? 'Salvando…' : 'Salvar e convidar o grupo'}</button>
                        </div>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
