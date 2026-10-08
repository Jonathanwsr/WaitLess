import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ChartBarIcon, BanknotesIcon, ShoppingBagIcon, ReceiptPercentIcon, TruckIcon } from '@heroicons/react/24/outline';

const PERIODOS = [7, 30, 90];

const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Indicador({ icone: Icone, rotulo, valor }) {
    return (
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#FF5A00] flex items-center justify-center mb-3">
                <Icone className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-zinc-900">{valor}</p>
            <p className="text-xs font-semibold text-zinc-500 mt-1">{rotulo}</p>
        </div>
    );
}

export default function PainelVendasEntregas() {
    const { auth } = usePage().props;
    const [dias, setDias] = useState(30);
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        setCarregando(true);
        axios.get(route('entregas.painel-vendas'), { params: { dias } })
            .then((r) => setDados(r.data))
            .catch(() => setDados(null))
            .finally(() => setCarregando(false));
    }, [dias]);

    const pico = dados ? Array.from({ length: 24 }, (_, h) => dados.pico_por_hora.find((p) => p.hora === h)?.pedidos || 0) : [];
    const maxPico = Math.max(1, ...pico);
    const maxTop = Math.max(1, ...(dados?.top_produtos || []).map((p) => p.receita));

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Painel de vendas" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#FF5A00]">Produtos para entrega</p>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                            <ChartBarIcon className="w-8 h-8 text-[#FF5A00]" /> Painel de vendas
                        </h1>
                        <p className="text-sm text-zinc-500 mt-1">Quanto entrou, o que mais sai e em que horário os pedidos chegam.</p>
                    </div>
                    <div className="flex gap-2">
                        {PERIODOS.map((p) => (
                            <button
                                key={p}
                                onClick={() => setDias(p)}
                                className={`px-4 py-2 rounded-full text-sm font-bold transition ${dias === p ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                            >
                                Últimos {p} dias
                            </button>
                        ))}
                    </div>
                </header>

                {carregando || !dados ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-3xl bg-zinc-100 animate-pulse" />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Indicador icone={BanknotesIcon} rotulo="Faturamento" valor={brl(dados.faturamento)} />
                            <Indicador icone={TruckIcon} rotulo="Entregas concluídas" valor={dados.pedidos} />
                            <Indicador icone={ReceiptPercentIcon} rotulo="Ticket médio" valor={brl(dados.ticket_medio)} />
                            <Indicador icone={ShoppingBagIcon} rotulo="Produtos vendidos (total)" valor={dados.produtos_vendidos} />
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                            <section className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
                                <h2 className="font-black text-zinc-900 mb-4">Mais vendidos</h2>
                                {dados.top_produtos.length === 0 ? (
                                    <p className="text-sm text-zinc-400 py-8 text-center">Sem entregas concluídas neste período.</p>
                                ) : (
                                    <ul className="space-y-4">
                                        {dados.top_produtos.map((p) => (
                                            <li key={p.produto_entrega_id}>
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-semibold text-zinc-800 truncate pr-3">{p.nome}</span>
                                                    <span className="text-zinc-500 whitespace-nowrap">{p.unidades} un · {brl(p.receita)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-zinc-100 mt-2 overflow-hidden">
                                                    <div className="h-full rounded-full bg-[#FF5A00]" style={{ width: `${(p.receita / maxTop) * 100}%` }} />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6">
                                <h2 className="font-black text-zinc-900 mb-1">Horário de pico</h2>
                                <p className="text-xs text-zinc-500 mb-4">Pedidos concluídos por hora (horário de Brasília).</p>
                                <div className="flex items-end gap-1 h-40">
                                    {pico.map((n, h) => (
                                        <div key={h} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${h}h: ${n} pedido(s)`}>
                                            <div className={`w-full rounded-t ${n ? 'bg-zinc-900' : 'bg-zinc-100'}`} style={{ height: `${Math.max(4, (n / maxPico) * 100)}%` }} />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
                                    <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
