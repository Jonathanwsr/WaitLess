import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    TruckIcon, MapPinIcon, ChatBubbleLeftRightIcon, ArrowDownTrayIcon, XMarkIcon, ShieldCheckIcon,
    KeyIcon, ExclamationTriangleIcon, ArrowPathIcon, StarIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { brl, perguntarAoDono } from '@/lib/produtosEntrega';
import RastreioEntrega from '@/Components/Entregas/RastreioEntrega';
import AvaliarPedidoModal from '@/Components/Entregas/AvaliarPedidoModal';
import AbasCliente from '@/Components/Entregas/AbasCliente';

const STATUS = {
    pendente_pagamento: { label: 'Aguardando pagamento', classe: 'bg-amber-50 text-amber-700' },
    pago: { label: 'Pago · aguardando entrega', classe: 'bg-blue-50 text-blue-700' },
    aguardando_confirmacao: { label: 'Aguardando entrega', classe: 'bg-blue-50 text-blue-700' },
    concluido: { label: 'Entregue', classe: 'bg-emerald-50 text-emerald-700' },
    cancelado: { label: 'Cancelado', classe: 'bg-zinc-100 text-zinc-600' },
    estornado: { label: 'Estornado', classe: 'bg-zinc-100 text-zinc-600' },
};

// Comprador só cancela o que não foi pago online. Pedido pago é cancelado pelo vendedor, que devolve o valor.
const PODE_CANCELAR = ['pendente_pagamento', 'aguardando_confirmacao'];
const ABERTOS = ['pendente_pagamento', 'pago', 'aguardando_confirmacao'];

function Recompras() {
    const [sugestoes, setSugestoes] = useState(null);

    useEffect(() => {
        axios.get(route('entregas.recompras')).then((r) => setSugestoes(r.data.sugestoes)).catch(() => setSugestoes([]));
    }, []);

    if (!sugestoes || sugestoes.length === 0) return null;

    return (
        <section className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-1">
                <SparklesIcon className="w-5 h-5 text-[#FF5A00]" />
                <h2 className="font-black">Repor agora</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">Você costuma comprar estes produtos com regularidade.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sugestoes.map((s) => (
                    <div key={s.produto_entrega_id} className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
                        <img src={s.fotos?.[0] || 'https://placehold.co/120x120/27272a/a1a1aa?text=P'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{s.nome}</p>
                            <p className="text-[11px] text-zinc-400">
                                A cada ~{s.intervalo_dias} dias · {s.pronta_para_repetir ? 'hora de repor' : `próxima ~${new Date(`${s.proxima_prevista_em}T12:00:00`).toLocaleDateString('pt-BR')}`}
                            </p>
                        </div>
                        <Link href={route('entregas.produto', s.produto_entrega_id)} className={`text-xs font-black px-3 py-2 rounded-xl whitespace-nowrap ${s.pronta_para_repetir ? 'bg-[#FF5A00] text-white' : 'bg-white/10 text-white'}`}>
                            {s.pronta_para_repetir ? 'Repor' : 'Ver'}
                        </Link>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function MeusPedidos({ pedidos = [] }) {
    const [filtro, setFiltro] = useState('todos');
    const [modalEstorno, setModalEstorno] = useState(null);
    const [avaliando, setAvaliando] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [processando, setProcessando] = useState(null);
    const [mensagem, setMensagem] = useState(null);

    const filtrados = pedidos.filter((p) => {
        if (filtro === 'abertos') return ABERTOS.includes(p.status);
        if (filtro === 'entregues') return p.status === 'concluido';
        if (filtro === 'cancelados') return ['cancelado', 'estornado'].includes(p.status);
        return true;
    });

    const cancelarPedido = async (pedido) => {
        if (!confirm('Cancelar este pedido?')) return;
        setProcessando(pedido.id);
        setMensagem(null);
        try {
            const { data } = await axios.post(route('entregas.pedidos.cancelar', pedido.id));
            setMensagem({ tipo: 'ok', texto: data.message });
            window.location.reload();
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: e.response?.data?.error || 'Não foi possível cancelar o pedido.' });
        } finally {
            setProcessando(null);
        }
    };

    const enviarEstorno = async () => {
        if (!modalEstorno) return;
        setProcessando(modalEstorno.id);
        try {
            const { data } = await axios.post(route('entregas.pedidos.estorno', modalEstorno.id), { motivo, descricao });
            setModalEstorno(null);
            setMensagem({ tipo: 'ok', texto: data.message });
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: e.response?.data?.error || 'Não foi possível enviar a solicitação.' });
        } finally {
            setProcessando(null);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Meus pedidos" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6">
                <AbasCliente ativa="pedidos" />
                <header>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <TruckIcon className="w-8 h-8 text-[#FF5A00]" /> Meus pedidos
                    </h1>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        <p className="text-zinc-500">Endereço, pagamento, código de entrega e comprovante de cada pedido.</p>
                        <Link href={route('entregas.assinaturas.page')} className="font-bold text-[#FF5A00]">Minhas assinaturas</Link>
                    </div>
                </header>

                <Recompras />

                <div className="flex gap-2 overflow-x-auto pb-1">
                    {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'abertos', label: 'Em aberto' },
                        { id: 'entregues', label: 'Entregues' },
                        { id: 'cancelados', label: 'Cancelados' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFiltro(f.id)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${filtro === f.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {mensagem && (
                    <div className={`px-4 py-3 rounded-2xl text-sm font-semibold ${mensagem.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {mensagem.texto}
                    </div>
                )}

                {filtrados.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-zinc-100">
                        <TruckIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">Nenhum pedido por aqui ainda.</p>
                        <Link href={route('entregas.index')} className="inline-block mt-4 text-sm font-bold text-[#FF5A00]">Ver produtos</Link>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {filtrados.map((pedido) => {
                            const status = STATUS[pedido.status] || { label: pedido.status, classe: 'bg-zinc-100 text-zinc-600' };
                            const podeCancelar = PODE_CANCELAR.includes(pedido.status);
                            const podeEstornar = pedido.status === 'concluido' && !pedido.disputa_status;
                            const podeAvaliar = pedido.status === 'concluido' && !pedido.avaliado;

                            return (
                                <article key={pedido.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                                    <div className="p-5 sm:p-6 flex gap-4">
                                        <img
                                            src={pedido.produto?.fotos?.[0] || 'https://placehold.co/160x160/f4f4f5/a1a1aa?text=Produto'}
                                            alt={pedido.produto?.nome}
                                            className="w-20 h-20 rounded-2xl object-cover bg-zinc-100 flex-shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                <div className="min-w-0">
                                                    <p className="font-black text-zinc-900 truncate">{pedido.produto?.nome || 'Produto removido'}</p>
                                                    <p className="text-xs text-zinc-400 mt-0.5">{pedido.codigo_pedido} · {pedido.quantidade}x · {pedido.estabelecimento?.nome || pedido.vendedor?.name}</p>
                                                </div>
                                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${status.classe}`}>{status.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                <p className="text-lg font-black text-[#FF5A00]">{brl(pedido.valor_total)}</p>
                                                {pedido.pontos_ganhos > 0 && (
                                                    <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <StarIcon className="w-3.5 h-3.5" /> +{pedido.pontos_ganhos} pontos
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                                                <ShieldCheckIcon className="w-4 h-4 text-zinc-400" /> {pedido.forma_pagamento_label}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 sm:px-6 pb-5">
                                        <div className="bg-zinc-50 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                                <MapPinIcon className="w-3.5 h-3.5" />
                                                {pedido.modo_recebimento === 'entrega' ? 'Endereço de entrega' : 'Endereço para buscar'}
                                            </p>
                                            <p className="text-sm font-semibold text-zinc-800 mt-1.5">{pedido.endereco_recebimento}</p>
                                            {pedido.modo_recebimento === 'entrega' && pedido.entrega_observacoes && (
                                                <p className="text-xs text-zinc-500 mt-1">Detalhes: {pedido.entrega_observacoes}</p>
                                            )}
                                        </div>

                                        <div className={`rounded-2xl p-4 ${pedido.codigo_confirmacao_visivel ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-500'}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-zinc-400">
                                                <KeyIcon className="w-3.5 h-3.5" /> Código de entrega
                                            </p>
                                            {pedido.codigo_confirmacao_visivel ? (
                                                <>
                                                    <p className="text-3xl font-black tracking-[0.35em] mt-1.5 font-mono">{pedido.codigo_confirmacao_visivel}</p>
                                                    <p className="text-xs text-zinc-400 mt-1.5">Mostre este código ao vendedor. Só ele libera o pagamento.</p>
                                                </>
                                            ) : (
                                                <p className="text-sm mt-1.5">{pedido.status === 'concluido' ? 'Entrega confirmada.' : 'Disponível quando o pagamento for aprovado.'}</p>
                                            )}
                                        </div>
                                    </div>

                                    {pedido.em_rota && (
                                        <div className="px-5 sm:px-6 pb-5">
                                            <RastreioEntrega pedido={pedido} />
                                        </div>
                                    )}

                                    {pedido.disputa_status && (
                                        <div className="mx-5 sm:mx-6 mb-4 flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl p-3">
                                            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                                            <span>Estorno: {pedido.disputa_status === 'solicitado' ? 'em análise pela Lokyva.' : pedido.disputa_status === 'aprovado' ? 'aprovado.' : 'não aprovado.'}</span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 px-5 sm:px-6 pb-5 border-t border-zinc-100 pt-4">
                                        <button onClick={() => perguntarAoDono(pedido.produto_entrega_id)} className="flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                                            <ChatBubbleLeftRightIcon className="w-4 h-4" /> Falar com o vendedor
                                        </button>
                                        <a href={route('entregas.pedidos.comprovante', pedido.id)} className="flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                                            <ArrowDownTrayIcon className="w-4 h-4" /> Comprovante PDF
                                        </a>
                                        {podeAvaliar && (
                                            <button onClick={() => setAvaliando(pedido)} className="flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600">
                                                <StarIcon className="w-4 h-4" /> Avaliar
                                            </button>
                                        )}
                                        {podeCancelar && (
                                            <button onClick={() => cancelarPedido(pedido)} disabled={processando === pedido.id} className="text-xs font-bold px-3.5 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-60">
                                                Cancelar pedido
                                            </button>
                                        )}
                                        {podeEstornar && (
                                            <button onClick={() => { setModalEstorno(pedido); setMotivo(''); setDescricao(''); }} className="text-xs font-bold px-3.5 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200">
                                                Solicitar estorno
                                            </button>
                                        )}
                                        {processando === pedido.id && <ArrowPathIcon className="w-4 h-4 text-zinc-400 animate-spin self-center" />}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {avaliando && (
                <AvaliarPedidoModal
                    pedido={avaliando}
                    onFechar={() => setAvaliando(null)}
                    onSalvo={() => { setAvaliando(null); window.location.reload(); }}
                />
            )}

            {modalEstorno && (
                <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-zinc-900">Solicitar estorno</h3>
                            <button onClick={() => setModalEstorno(null)} className="text-zinc-400 hover:text-zinc-600" aria-label="Fechar">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input className="w-full rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Motivo (ex.: produto veio danificado)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                            <textarea className="w-full rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" rows={4} placeholder="Descreva o que aconteceu (mínimo de 10 caracteres)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>
                        <button
                            onClick={enviarEstorno}
                            disabled={processando === modalEstorno.id || motivo.trim() === '' || descricao.trim().length < 10}
                            className="w-full mt-5 bg-[#FF5A00] hover:bg-orange-600 text-white font-black py-3 rounded-2xl transition disabled:opacity-50"
                        >
                            Enviar solicitação
                        </button>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
