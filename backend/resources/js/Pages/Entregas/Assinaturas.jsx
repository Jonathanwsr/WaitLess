import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowPathIcon, PauseIcon, PlayIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import AbasCliente from '@/Components/Entregas/AbasCliente';

const STATUS = {
    ativa: { rotulo: 'Ativa', classe: 'bg-emerald-50 text-emerald-700' },
    pausada: { rotulo: 'Pausada', classe: 'bg-amber-50 text-amber-700' },
    cancelada: { rotulo: 'Cancelada', classe: 'bg-zinc-100 text-zinc-500' },
};

const FREQ = { 7: 'Toda semana', 14: 'A cada 2 semanas', 30: 'Todo mês' };

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function Assinaturas() {
    const { auth } = usePage().props;
    const [assinaturas, setAssinaturas] = useState(null);
    const [ocupada, setOcupada] = useState(null);
    const [erro, setErro] = useState(null);

    const carregar = () => axios.get(route('entregas.assinaturas.index'))
        .then((r) => setAssinaturas(r.data.assinaturas))
        .catch(() => setAssinaturas([]));

    useEffect(() => { carregar(); }, []);

    const alterar = async (assinatura, acao) => {
        if (acao === 'cancelar' && !confirm('Cancelar esta assinatura? As próximas entregas param de ser geradas.')) return;
        setOcupada(assinatura.id);
        setErro(null);
        try {
            await axios.post(route('entregas.assinaturas.alterar', assinatura.id), { acao });
            await carregar();
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível atualizar a assinatura.');
        } finally {
            setOcupada(null);
        }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Assinaturas de entrega" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <AbasCliente ativa="assinaturas" />
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#FF5A00]">Entrega recorrente</p>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Minhas assinaturas</h1>
                        <p className="text-sm text-zinc-500 mt-1">Produtos que chegam no ciclo que você escolheu. Pause ou cancele quando quiser.</p>
                    </div>
                    <Link href={route('entregas.index')} className="text-sm font-bold text-[#FF5A00]">Ver produtos</Link>
                </header>

                {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-2xl">{erro}</div>}

                {assinaturas === null ? (
                    <div className="h-40 rounded-3xl bg-zinc-100 animate-pulse" />
                ) : assinaturas.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
                        <CalendarDaysIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">Você ainda não tem assinaturas.</p>
                        <p className="text-xs text-zinc-400 mt-1">Abra um produto e toque em "Assinar entrega".</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assinaturas.map((a) => {
                            const status = STATUS[a.status] || STATUS.ativa;
                            const ativa = a.status === 'ativa';
                            const pausada = a.status === 'pausada';
                            const cancelada = a.status === 'cancelada';
                            return (
                                <div key={a.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row gap-4">
                                    <img src={a.produto?.fotos?.[0] || 'https://placehold.co/200x200/f4f4f5/a1a1aa?text=Produto'} alt="" className="w-20 h-20 rounded-2xl object-cover bg-zinc-100" />
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-black text-zinc-900 truncate">{a.produto?.nome || 'Produto removido'}</p>
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${status.classe}`}>{status.rotulo}</span>
                                        </div>
                                        <p className="text-xs text-zinc-500">
                                            {a.quantidade}x · {FREQ[a.frequencia_dias] || `a cada ${a.frequencia_dias} dias`} · {a.modo_recebimento === 'entrega' ? 'entrega em casa' : 'retirada'} · {a.modo_pagamento === 'local' ? 'pago no local' : 'pago direto com o vendedor'}
                                        </p>
                                        {!cancelada && (
                                            <p className="text-sm font-semibold text-zinc-800">Próxima entrega: {new Date(`${a.proxima_entrega_em}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                                        )}
                                        <p className="text-xs text-zinc-400">{a.produto ? brl(a.produto.valor_final) + ' por unidade' : ''}</p>
                                    </div>
                                    {!cancelada && (
                                        <div className="flex sm:flex-col gap-2">
                                            {ativa && (
                                                <button disabled={ocupada === a.id} onClick={() => alterar(a, 'pausar')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50">
                                                    <PauseIcon className="w-4 h-4" /> Pausar
                                                </button>
                                            )}
                                            {pausada && (
                                                <button disabled={ocupada === a.id} onClick={() => alterar(a, 'retomar')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50">
                                                    <PlayIcon className="w-4 h-4" /> Retomar
                                                </button>
                                            )}
                                            <button disabled={ocupada === a.id} onClick={() => alterar(a, 'cancelar')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50">
                                                <XMarkIcon className="w-4 h-4" /> Cancelar
                                            </button>
                                        </div>
                                    )}
                                    {ocupada === a.id && <ArrowPathIcon className="w-4 h-4 text-zinc-400 animate-spin" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
