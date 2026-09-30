import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    ArrowLeftIcon, MapPinIcon, CalendarDaysIcon, ArrowPathIcon, PlusIcon, TicketIcon, UsersIcon,
    CurrencyDollarIcon, ChatBubbleLeftRightIcon, MapIcon, TrashIcon,
} from '@heroicons/react/24/solid';
import ItemCard from '@/Components/Viagem/ItemCard';
import GastosTab from '@/Components/Viagem/GastosTab';
import ChatTab from '@/Components/Viagem/ChatTab';
import GrupoTab from '@/Components/Viagem/GrupoTab';
import { Aviso, agruparPorDia, erroDe, fmt, fmtDia, fmtDiaLongo, inputClasse, STATUS_ITEM } from '@/Components/Viagem/util';

const ABAS = [
    ['roteiro', 'Roteiro', MapIcon],
    ['reservas', 'Reservas', TicketIcon],
    ['gastos', 'Gastos', CurrencyDollarIcon],
    ['chat', 'Chat', ChatBubbleLeftRightIcon],
    ['grupo', 'Grupo', UsersIcon],
];

function FormItem({ viagem, onSalvo, onCancelar, notificar }) {
    const [f, setF] = useState({ titulo: '', tipo: 'personalizado', dia: viagem.data_inicio, hora_inicio: '', custo_estimado: '' });
    const [enviando, setEnviando] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setEnviando(true);
        try {
            const dados = { ...f, hora_inicio: f.hora_inicio || undefined, custo_estimado: f.custo_estimado || undefined };
            await axios.post(route('viagens.itens.store', viagem.id), dados);
            onSalvo();
        } catch (err) { notificar({ tipo: 'erro', texto: erroDe(err) }); } finally { setEnviando(false); }
    };

    return (
        <form onSubmit={enviar} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 grid sm:grid-cols-5 gap-3">
            <input className={`${inputClasse} sm:col-span-2`} placeholder="Ex.: Almoço no mercado" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required maxLength={250} />
            <input type="date" className={inputClasse} min={viagem.data_inicio} max={viagem.data_fim} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} required />
            <input type="time" className={inputClasse} value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} />
            <input type="number" min="0" step="0.01" className={inputClasse} placeholder="Custo (R$)" value={f.custo_estimado} onChange={(e) => setF({ ...f, custo_estimado: e.target.value })} />
            <div className="sm:col-span-5 flex gap-2">
                <button disabled={enviando} className="px-6 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white font-black">{enviando ? 'Salvando…' : 'Adicionar'}</button>
                <button type="button" onClick={onCancelar} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold">Cancelar</button>
            </div>
        </form>
    );
}

export default function Show({ painelInicial }) {
    const [painel, setPainel] = useState(painelInicial);
    const [aba, setAba] = useState(() => (typeof window !== 'undefined' && window.location.hash.slice(1)) || 'roteiro');
    const [aviso, setAviso] = useState(null);
    const [novoItem, setNovoItem] = useState(false);
    const [atualizando, setAtualizando] = useState(false);
    const { viagem, itens, eu } = painel;

    const recarregar = useCallback(async () => {
        try {
            const { data } = await axios.get(route('viagens.painel', viagem.id));
            setPainel((atual) => ({ ...data, mensagens: atual.mensagens }));
        } catch { /* mantém o que já está na tela */ }
    }, [viagem.id]);

    useEffect(() => { window.location.hash = aba; }, [aba]);

    const acao = async (fn, sucesso) => {
        try {
            const { data } = await fn();
            if (sucesso !== false) setAviso({ tipo: 'ok', texto: sucesso || data.mensagem });
            await recarregar();
            return data;
        } catch (e) { setAviso({ tipo: 'erro', texto: erroDe(e) }); return null; }
    };

    const presenca = (item, status) => acao(() => axios.post(route('viagens.itens.presenca', [viagem.id, item.id]), { status }), false);
    const removerItem = (item) => window.confirm(`Remover "${item.titulo}" da agenda?`) && acao(() => axios.delete(route('viagens.itens.destroy', [viagem.id, item.id])));
    const regenerar = async () => {
        if (!window.confirm('Refazer as sugestões ainda não reservadas? O que o grupo já reservou ou adicionou é mantido.')) return;
        setAtualizando(true);
        const data = await acao(() => axios.post(route('viagens.regenerar', viagem.id)));
        if (data?.avisos?.length) setAviso({ tipo: 'erro', texto: data.avisos.join(' ') });
        setAtualizando(false);
    };
    const excluir = async () => {
        if (!window.confirm('Excluir esta viagem para todo o grupo? Isso apaga agenda, gastos e chat.')) return;
        try { await axios.delete(route('viagens.destroy', viagem.id)); router.visit(route('viagens.index')); } catch (e) { setAviso({ tipo: 'erro', texto: erroDe(e) }); }
    };
    const compartilhar = (r) => acao(() => axios.post(route('viagens.reservas.store', viagem.id), { tipo: r.tipo, id: r.id }));

    const agrupado = useMemo(() => agruparPorDia(itens), [itens]);
    const comReserva = itens.filter((i) => i.reserva);
    const semReserva = itens.filter((i) => !i.reserva && ['hospedagem', 'transporte', 'servico', 'atracao'].includes(i.tipo));
    const confirmados = painel.membros.filter((m) => m.presenca === 'confirmado').length;
    const orc = viagem.orcamento_limite;
    const usoOrc = orc ? Math.min(100, (painel.custos.estimado / orc) * 100) : null;

    const itemProps = { onPresenca: presenca, euId: eu.id, onRemover: viagem.posso_editar ? removerItem : undefined };

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">{viagem.titulo}</h2>}>
            <Head title={viagem.titulo} />
            <div className="max-w-5xl mx-auto space-y-5">
                <Link href={route('viagens.index')} className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-800"><ArrowLeftIcon className="w-4 h-4" /> Minhas viagens</Link>

                <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl p-6 shadow-lg">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="flex items-center gap-1.5 text-white/60 text-sm"><MapPinIcon className="w-4 h-4" /> {viagem.destino}</p>
                            <h3 className="text-2xl sm:text-3xl font-black mt-1">{viagem.titulo}</h3>
                            <p className="flex items-center gap-1.5 text-white/70 text-sm mt-2"><CalendarDaysIcon className="w-4 h-4" /> {fmtDia(viagem.data_inicio)} a {fmtDia(viagem.data_fim)} · {viagem.total_dias} {viagem.total_dias === 1 ? 'dia' : 'dias'} · {confirmados}/{painel.membros.length} confirmados</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase font-bold">Previsto</p>
                            <p className="text-3xl font-black">{fmt(painel.custos.estimado)}</p>
                            {orc != null && <p className="text-xs text-white/60">de {fmt(orc)} de orçamento</p>}
                        </div>
                    </div>
                    {usoOrc != null && (
                        <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden"><div className={`h-full rounded-full ${painel.custos.estimado > orc ? 'bg-red-400' : 'bg-[#FF5A00]'}`} style={{ width: `${usoOrc}%` }} /></div>
                    )}
                </div>

                <Aviso aviso={aviso} onFechar={() => setAviso(null)} />

                <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
                    {ABAS.map(([id, nome, Icone]) => (
                        <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition -mb-px ${aba === id ? 'border-[#FF5A00] text-[#FF5A00]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                            <Icone className="w-4 h-4" /> {nome}
                        </button>
                    ))}
                </div>

                {aba === 'roteiro' && (
                    <div className="space-y-4">
                        {viagem.posso_editar && (
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setNovoItem(!novoItem)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#FF5A00] text-sm font-bold text-gray-700"><PlusIcon className="w-4 h-4" /> Adicionar à agenda</button>
                                <button onClick={regenerar} disabled={atualizando} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#FF5A00] text-sm font-bold text-gray-700 disabled:opacity-60"><ArrowPathIcon className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} /> Refazer sugestões</button>
                                {viagem.sou_criador && <button onClick={excluir} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50"><TrashIcon className="w-4 h-4" /> Excluir viagem</button>}
                            </div>
                        )}
                        {novoItem && <FormItem viagem={viagem} notificar={setAviso} onCancelar={() => setNovoItem(false)} onSalvo={() => { setNovoItem(false); recarregar(); }} />}

                        {itens.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum item ainda. Adicione compromissos ou refaça as sugestões.</p>}

                        <div className="bg-gray-50 rounded-3xl p-5 space-y-2">
                            {agrupado.fixos.length > 0 && <p className="text-xs font-black text-gray-400 uppercase pl-1">Durante toda a viagem</p>}
                            {agrupado.fixos.map((i) => <ItemCard key={i.id} item={i} {...itemProps} />)}
                            {agrupado.dias.map(({ dia, itens: lista }) => (
                                <div key={dia}>
                                    <p className="text-sm font-black text-gray-800 capitalize mt-3 mb-2 pl-1">{dia === 'sem-data' ? 'Sem data' : fmtDiaLongo(dia)}</p>
                                    {lista.map((i) => <ItemCard key={i.id} item={i} {...itemProps} />)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {aba === 'reservas' && (
                    <div className="space-y-5">
                        {painel.minhas_reservas.length > 0 && (
                            <section className="bg-orange-50 border border-orange-200 rounded-3xl p-5">
                                <h4 className="font-black text-gray-900">Suas reservas nesta viagem</h4>
                                <p className="text-sm text-gray-600 mb-3">Encontramos reservas suas na cidade e nas datas. Compartilhe para o grupo enxergar.</p>
                                <ul className="space-y-2">
                                    {painel.minhas_reservas.map((r) => (
                                        <li key={`${r.tipo}${r.id}`} className="bg-white rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                                            <div><p className="font-bold text-gray-900">{r.titulo}</p><p className="text-xs text-gray-500">{[r.local, r.quando].filter(Boolean).join(' · ')} · {fmt(r.valor)}</p></div>
                                            <button onClick={() => compartilhar(r)} className="px-4 py-2 rounded-xl bg-[#FF5A00] text-white text-sm font-black">Compartilhar com o grupo</button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                            <h4 className="font-black text-gray-900 mb-3">Reservas do grupo</h4>
                            {comReserva.length === 0 && <p className="text-sm text-gray-500">Nenhuma reserva compartilhada ainda. Reserve os itens sugeridos e eles aparecem aqui para todos.</p>}
                            <ul className="divide-y divide-gray-100">
                                {comReserva.map((i) => (
                                    <li key={i.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-gray-900">{i.titulo}</p>
                                            <p className="text-xs text-gray-500">{i.reserva.por} · {i.reserva.quando}{i.reserva.codigo ? ` · cód. ${i.reserva.codigo}` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900">{fmt(i.reserva.valor || i.custo_estimado)}</p>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(STATUS_ITEM[i.status] || STATUS_ITEM.reservado).classe}`}>{(STATUS_ITEM[i.status] || STATUS_ITEM.reservado).texto}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {semReserva.length > 0 && (
                            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                                <h4 className="font-black text-gray-900 mb-1">Ainda sem reserva</h4>
                                <p className="text-sm text-gray-500 mb-3">{semReserva.length} itens do roteiro ainda não foram reservados.</p>
                                <ul className="divide-y divide-gray-100">
                                    {semReserva.map((i) => (
                                        <li key={i.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                                            <div><p className="font-bold text-gray-900">{i.titulo}</p><p className="text-xs text-gray-500">{i.dia ? fmtDia(i.dia) : ''} {i.hora_inicio || ''} · {fmt(i.custo_estimado)}</p></div>
                                            {i.servico_id && i.estabelecimento_id && <Link href={route('cliente.agendar', i.estabelecimento_id)} className="text-sm font-black text-[#FF5A00] hover:underline">Reservar</Link>}
                                            {i.item_aluguel_id && <Link href={route('itens.detalhes', i.item_aluguel_id)} className="text-sm font-black text-[#FF5A00] hover:underline">Reservar</Link>}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                )}

                {aba === 'gastos' && <GastosTab painel={painel} recarregar={recarregar} notificar={setAviso} />}
                {aba === 'chat' && <ChatTab painel={painel} notificar={setAviso} />}
                {aba === 'grupo' && <GrupoTab painel={painel} recarregar={recarregar} notificar={setAviso} />}
            </div>
        </AuthenticatedLayout>
    );
}
