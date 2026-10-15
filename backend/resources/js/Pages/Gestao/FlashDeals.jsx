import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { BoltIcon, MapPinIcon, BellAlertIcon, CursorArrowRaysIcon, CheckBadgeIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

const DURACOES = [
    { valor: 30, rotulo: '30 min' },
    { valor: 60, rotulo: '1 hora' },
    { valor: 120, rotulo: '2 horas' },
    { valor: 180, rotulo: '3 horas' },
    { valor: 240, rotulo: '4 horas' },
    { valor: 360, rotulo: '6 horas' },
];

const STATUS = {
    ativo: { rotulo: 'No ar', classe: 'bg-emerald-50 text-emerald-700' },
    esgotado: { rotulo: 'Esgotado', classe: 'bg-orange-50 text-orange-700' },
    encerrado: { rotulo: 'Encerrado', classe: 'bg-zinc-100 text-zinc-600' },
    cancelado: { rotulo: 'Cancelado', classe: 'bg-zinc-100 text-zinc-600' },
};

/** Contagem regressiva até o fim do deal (atualiza a cada segundo). */
function Restante({ ate }) {
    const [agora, setAgora] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    const ms = Math.max(0, new Date(ate).getTime() - agora);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return <span className="tabular-nums">{h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</span>;
}

export default function FlashDeals({ opcoes, deals, limites }) {
    const { flash } = usePage().props;
    const [aba, setAba] = useState(opcoes.itens.length ? 'item_aluguel' : 'servico');
    const lista = aba === 'item_aluguel' ? opcoes.itens : opcoes.servicos;

    const { data, setData, post, processing, errors, reset } = useForm({
        alvo_tipo: aba,
        alvo_id: lista[0]?.id ?? '',
        percentual: 50,
        quantidade: 5,
        duracao_minutos: limites.duracao_padrao,
        raio_km: limites.raio_padrao,
    });

    const trocarAba = (nova) => {
        setAba(nova);
        const primeira = (nova === 'item_aluguel' ? opcoes.itens : opcoes.servicos)[0];
        setData((d) => ({ ...d, alvo_tipo: nova, alvo_id: primeira?.id ?? '' }));
    };

    const escolhido = useMemo(() => lista.find((o) => String(o.id) === String(data.alvo_id)), [lista, data.alvo_id]);
    const ativos = deals.filter((d) => d.status === 'ativo');

    const enviar = (e) => {
        e.preventDefault();
        post(route('gestao.flash-deals.store'), { preserveScroll: true, onSuccess: () => reset('quantidade') });
    };

    const cancelar = (deal) => {
        if (!confirm(`Encerrar o Flash Deal de "${deal.alvo_nome}" agora? O preço normal volta na hora.`)) return;
        router.post(route('gestao.flash-deals.cancelar', deal.id), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout header={<h2 className="font-semibold text-xl text-gray-800">Flash Deals</h2>}>
            <Head title="Flash Deals" />

            <div className="py-8">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    {flash?.success && <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm font-medium">{flash.success}</div>}
                    {flash?.error && <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-medium">{flash.error}</div>}

                    <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <BoltIcon className="w-8 h-8" />
                            <h1 className="text-2xl font-black">Transforme vaga ociosa em receita agora</h1>
                        </div>
                        <p className="mt-2 text-white/90 max-w-3xl text-sm leading-relaxed">
                            Sobrou quarto, carro parado ou mesa vazia? Crie um Flash Deal: o desconto vale por tempo curto e só para as vagas que você escolher.
                            Avisamos na hora, por notificação, apenas os clientes que estão na sua cidade. Quando o tempo acaba ou as vagas esgotam, o preço normal volta sozinho.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-5 gap-6">
                        <form onSubmit={enviar} className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <div className="flex gap-2 bg-gray-100 rounded-2xl p-1 w-fit">
                                {[['item_aluguel', `Reservas (${opcoes.itens.length})`], ['servico', `Serviços (${opcoes.servicos.length})`]].map(([valor, rotulo]) => (
                                    <button key={valor} type="button" onClick={() => trocarAba(valor)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition ${aba === valor ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                                        {rotulo}
                                    </button>
                                ))}
                            </div>

                            {lista.length === 0 ? (
                                <p className="text-sm text-gray-500">Nenhum {aba === 'item_aluguel' ? 'item de reserva' : 'serviço'} ativo para colocar em oferta.</p>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">O que está ocioso?</label>
                                        <select value={data.alvo_id} onChange={(e) => setData('alvo_id', e.target.value)}
                                            className="w-full rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500">
                                            {lista.map((o) => (
                                                <option key={o.id} value={o.id}>{o.nome}{o.cidade ? ` · ${o.cidade}` : ''} · {brl(o.valor)}</option>
                                            ))}
                                        </select>
                                        {errors.alvo_id && <p className="text-xs text-red-600 mt-1">{errors.alvo_id}</p>}
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <label className="text-sm font-bold text-gray-700">Desconto</label>
                                            <span className="text-2xl font-black text-orange-600">{data.percentual}%</span>
                                        </div>
                                        <input type="range" min={limites.percentual_min} max={limites.percentual_max} step={5} value={data.percentual}
                                            onChange={(e) => setData('percentual', Number(e.target.value))} className="w-full accent-orange-500" />
                                        {escolhido && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                <span className="line-through text-gray-400">{brl(escolhido.valor)}</span>{' '}
                                                <span className="font-bold text-gray-900">{brl(escolhido.valor * (1 - data.percentual / 100))}</span>
                                            </p>
                                        )}
                                        {errors.percentual && <p className="text-xs text-red-600 mt-1">{errors.percentual}</p>}
                                    </div>

                                    <div className="grid sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Vagas</label>
                                            <input type="number" min={1} max={limites.quantidade_max} value={data.quantidade}
                                                onChange={(e) => setData('quantidade', e.target.value)}
                                                className="w-full rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500" />
                                            {errors.quantidade && <p className="text-xs text-red-600 mt-1">{errors.quantidade}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Dura</label>
                                            <select value={data.duracao_minutos} onChange={(e) => setData('duracao_minutos', Number(e.target.value))}
                                                className="w-full rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500">
                                                {DURACOES.map((d) => <option key={d.valor} value={d.valor}>{d.rotulo}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Raio de aviso</label>
                                            <select value={data.raio_km} onChange={(e) => setData('raio_km', Number(e.target.value))}
                                                className="w-full rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500">
                                                {[5, 10, 30, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <button type="submit" disabled={processing || !data.alvo_id}
                                        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-3.5 transition">
                                        <BoltIcon className="w-5 h-5" /> {processing ? 'Lançando...' : 'Lançar Flash Deal e avisar quem está perto'}
                                    </button>
                                    <p className="text-xs text-gray-400 text-center">Até {limites.por_dia} Flash Deals por dia. O desconto vale para quem reservar dentro do prazo, até acabarem as vagas.</p>
                                </>
                            )}
                        </form>

                        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <p className="font-bold text-gray-900 mb-3">Como funciona</p>
                            <ol className="space-y-3 text-sm text-gray-600">
                                <li className="flex gap-3"><MapPinIcon className="w-5 h-5 text-orange-500 shrink-0" /> Só recebe o aviso quem abriu o app perto do seu local nas últimas horas.</li>
                                <li className="flex gap-3"><BellAlertIcon className="w-5 h-5 text-orange-500 shrink-0" /> Cada cliente recebe no máximo 3 ofertas relâmpago por dia, para o aviso continuar valendo a pena.</li>
                                <li className="flex gap-3"><ClockIcon className="w-5 h-5 text-orange-500 shrink-0" /> Acabou o tempo ou as vagas: o preço (e a promoção que você já tinha) voltam sozinhos.</li>
                                <li className="flex gap-3"><CheckBadgeIcon className="w-5 h-5 text-orange-500 shrink-0" /> O pagamento, a taxa e o cancelamento seguem as regras normais do item.</li>
                            </ol>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <p className="font-bold text-gray-900">Seus Flash Deals</p>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">{ativos.length} no ar</span>
                        </div>
                        {deals.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-gray-500 text-center">Nenhum Flash Deal ainda.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {deals.map((d) => {
                                    const st = STATUS[d.status] || STATUS.encerrado;
                                    return (
                                        <li key={d.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black text-lg shrink-0">-{d.percentual}%</div>
                                            <div className="flex-1 min-w-[180px]">
                                                <p className="font-bold text-gray-900">{d.alvo_nome}</p>
                                                <p className="text-xs text-gray-500">
                                                    {d.cidade || 'Sem cidade'} · {new Date(d.inicia_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                    {d.status === 'ativo' && <> · acaba em <Restante ate={d.expira_em} /></>}
                                                </p>
                                            </div>
                                            <div className="flex gap-5 text-center text-xs text-gray-500">
                                                <div><BellAlertIcon className="w-4 h-4 mx-auto text-gray-400" /><b className="block text-gray-900 text-sm">{d.notificados}</b>avisados</div>
                                                <div><CursorArrowRaysIcon className="w-4 h-4 mx-auto text-gray-400" /><b className="block text-gray-900 text-sm">{d.clicados}</b>abriram</div>
                                                <div><CheckBadgeIcon className="w-4 h-4 mx-auto text-gray-400" /><b className="block text-gray-900 text-sm">{d.usados}/{d.quantidade}</b>vendidas</div>
                                            </div>
                                            <span className={`text-xs font-bold rounded-full px-3 py-1 ${st.classe}`}>{st.rotulo}</span>
                                            {d.status === 'ativo' && (
                                                <button onClick={() => cancelar(d)} className="flex items-center gap-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl px-3 py-2">
                                                    <XMarkIcon className="w-4 h-4" /> Encerrar
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
