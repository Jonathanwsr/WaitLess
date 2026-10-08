import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { ClipboardDocumentListIcon, MagnifyingGlassIcon, ArrowPathIcon, UserIcon } from '@heroicons/react/24/outline';

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

const CLASSE_STATUS = {
    pendente_pagamento: 'bg-amber-50 text-amber-700',
    aguardando_confirmacao: 'bg-blue-50 text-blue-700',
    pago: 'bg-blue-50 text-blue-700',
    pendente: 'bg-amber-50 text-amber-700',
    confirmado: 'bg-blue-50 text-blue-700',
    concluido: 'bg-emerald-50 text-emerald-700',
    finalizado: 'bg-emerald-50 text-emerald-700',
    cancelado: 'bg-zinc-100 text-zinc-600',
    estornado: 'bg-zinc-100 text-zinc-600',
};

const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '-');

function Contador({ titulo, valor, cor = 'text-zinc-900' }) {
    return (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{titulo}</p>
            <p className={`text-2xl font-black ${cor}`}>{valor}</p>
        </div>
    );
}

export default function Pedidos({ pedidos = [], estabelecimentos = [], filtroEstabelecimento = null, resumo = {} }) {
    const { auth } = usePage().props;
    const [tipo, setTipo] = useState('todos');
    const [status, setStatus] = useState('');
    const [busca, setBusca] = useState('');
    const [local, setLocal] = useState(filtroEstabelecimento ?? '');
    const [atualizando, setAtualizando] = useState(false);

    const statusDisponiveis = useMemo(() => {
        const mapa = new Map();
        pedidos.forEach((p) => mapa.set(p.status, p.status_rotulo));
        return [...mapa.entries()];
    }, [pedidos]);

    const lista = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return pedidos.filter((p) => {
            if (tipo !== 'todos' && p.tipo !== tipo) return false;
            if (status && p.status !== status) return false;
            if (termo) {
                const texto = `${p.titulo} ${p.cliente ?? ''} ${p.quem_atende ?? ''} ${p.codigo}`.toLowerCase();
                if (!texto.includes(termo)) return false;
            }
            return true;
        });
    }, [pedidos, tipo, status, busca]);

    const trocarLocal = (valor) => {
        setLocal(valor);
        router.get(route('gestao.pedidos.index'), valor ? { estabelecimento_id: valor } : {}, { preserveState: true, replace: true });
    };

    const atualizar = () => {
        setAtualizando(true);
        router.reload({
            only: ['pedidos', 'resumo'],
            onFinish: () => setAtualizando(false),
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Pedidos da gestão" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#FF5A00]">Gestão</p>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                            <ClipboardDocumentListIcon className="w-8 h-8 text-[#FF5A00]" /> Pedidos
                        </h1>
                        <p className="text-sm text-zinc-500 mt-1">Todos os pedidos solicitados nos seus locais, com a situação de cada um e quem está atendendo.</p>
                    </div>
                    <button onClick={atualizar} disabled={atualizando} className="inline-flex items-center gap-2 bg-white border border-zinc-200 font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">
                        <ArrowPathIcon className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Contador titulo="Em aberto" valor={resumo.em_aberto ?? 0} cor="text-blue-600" />
                    <Contador titulo="Concluídos" valor={resumo.concluidos ?? 0} cor="text-emerald-600" />
                    <Contador titulo="Cancelados / estornados" valor={resumo.cancelados ?? 0} cor="text-zinc-500" />
                </div>

                <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex gap-2">
                            {[{ id: 'todos', rotulo: 'Todos' }, { id: 'produto', rotulo: 'Produtos' }, { id: 'reserva', rotulo: 'Reservas' }].map((t) => (
                                <button key={t.id} onClick={() => setTipo(t.id)} className={`px-4 py-2 rounded-full text-sm font-bold ${tipo === t.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                                    {t.rotulo}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, pedido ou quem atende" className="w-full pl-9 rounded-xl border-zinc-200 text-sm" />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {estabelecimentos.length > 1 && (
                            <select value={local} onChange={(e) => trocarLocal(e.target.value)} className="rounded-xl border-zinc-200 text-sm">
                                <option value="">Todos os locais</option>
                                {estabelecimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        )}
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border-zinc-200 text-sm">
                            <option value="">Qualquer situação</option>
                            {statusDisponiveis.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                        </select>
                    </div>
                </div>

                {lista.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
                        <ClipboardDocumentListIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">Nenhum pedido encontrado com esses filtros.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs uppercase font-bold text-zinc-400">
                                <tr>
                                    <th className="text-left px-4 py-3">Quando</th>
                                    <th className="text-left px-4 py-3">Pedido</th>
                                    <th className="text-left px-4 py-3">Cliente</th>
                                    <th className="text-left px-4 py-3">Situação</th>
                                    <th className="text-left px-4 py-3">Quem está atendendo</th>
                                    <th className="text-right px-4 py-3">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {lista.map((p) => (
                                    <tr key={`${p.tipo}-${p.id}`} className="hover:bg-zinc-50/60">
                                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{p.tipo === 'reserva' ? p.detalhe : quando(p.criado_em)}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-zinc-900">{p.titulo}{p.quantidade > 1 && <span className="text-zinc-500 font-normal"> × {p.quantidade}</span>}</p>
                                            <p className="text-xs text-zinc-500">
                                                <span className="font-bold">{p.tipo === 'produto' ? 'Produto' : 'Reserva'}</span> · {p.codigo} · {p.detalhe}{p.local ? ` · ${p.local}` : ''}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-700">{p.cliente || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${CLASSE_STATUS[p.status] || 'bg-zinc-100 text-zinc-600'}`}>{p.status_rotulo}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.quem_atende ? (
                                                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900"><UserIcon className="w-4 h-4 text-[#FF5A00]" /> {p.quem_atende}</span>
                                            ) : (
                                                <span className="text-zinc-400">Ninguém designado</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap">{brl(p.valor)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
