import { useState } from 'react';
import axios from 'axios';
import { brl } from '@/lib/produtosEntrega';

const ROTULO_STATUS = {
    solicitado: { texto: 'Em análise', classe: 'bg-amber-50 text-amber-700' },
    aprovado: { texto: 'Aprovado', classe: 'bg-emerald-50 text-emerald-700' },
    reprovado: { texto: 'Não aprovado', classe: 'bg-red-50 text-red-700' },
};

export default function EstornosProdutos({ pedidos = [] }) {
    const [modal, setModal] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [mensagem, setMensagem] = useState(null);

    const enviar = async () => {
        setEnviando(true);
        setMensagem(null);
        try {
            const { data } = await axios.post(route('entregas.pedidos.estorno', modal.id), { motivo, descricao });
            setMensagem({ tipo: 'ok', texto: data.message });
            setModal(null);
        } catch (e) {
            setMensagem({ tipo: 'erro', texto: e.response?.data?.error || 'Não foi possível enviar a solicitação.' });
        } finally {
            setEnviando(false);
        }
    };

    const situacao = (pedido) => {
        const status = pedido.disputa_status || pedido.estorno_status?.toLowerCase();
        if (status && ROTULO_STATUS[status]) return ROTULO_STATUS[status];
        if (pedido.estorno_status) return { texto: pedido.estorno_status, classe: 'bg-zinc-100 text-zinc-600' };
        return null;
    };

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-black text-slate-900">Estorno de produtos</h3>
                <p className="text-sm text-slate-500">Pedidos já entregues que deram problema. Você pode pedir estorno até 4 dias depois da entrega.</p>
            </div>

            {mensagem && (
                <div className={`px-4 py-3 rounded-2xl text-sm font-semibold ${mensagem.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {mensagem.texto}
                </div>
            )}

            {pedidos.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
                    <p className="text-sm font-semibold text-slate-400">Nenhum produto entregue para pedir estorno.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pedidos.map((pedido) => {
                        const status = situacao(pedido);
                        const podePedir = !status;
                        return (
                            <div key={pedido.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex gap-4">
                                <img src={pedido.produto?.fotos?.[0] || 'https://placehold.co/160x160/f4f4f5/a1a1aa?text=Produto'} alt="" className="w-16 h-16 rounded-2xl object-cover bg-slate-100" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{pedido.produto?.nome || 'Produto removido'}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{pedido.codigo_pedido} · {brl(pedido.valor_total)}</p>
                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                        {status && <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${status.classe}`}>{status.texto}</span>}
                                        {podePedir && (
                                            <button
                                                onClick={() => { setModal(pedido); setMotivo(''); setDescricao(''); }}
                                                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700"
                                            >
                                                Solicitar estorno
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-3">
                        <h4 className="text-lg font-black text-slate-900">Solicitar estorno</h4>
                        <p className="text-xs text-slate-500">{modal.produto?.nome} · {modal.codigo_pedido}</p>
                        <input className="w-full rounded-2xl border-slate-200 px-4 py-3 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Motivo (ex.: produto veio danificado)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                        <textarea className="w-full rounded-2xl border-slate-200 px-4 py-3 text-sm focus:ring-blue-500 focus:border-blue-500" rows={4} placeholder="Descreva o que aconteceu (mínimo de 10 caracteres)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold">Cancelar</button>
                            <button onClick={enviar} disabled={enviando || motivo.trim() === '' || descricao.trim().length < 10} className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black disabled:opacity-50">Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
