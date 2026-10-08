import { useState } from 'react';
import axios from 'axios';
import Estrelas from './Estrelas';

export default function AvaliarPedidoModal({ pedido, onFechar, onSalvo }) {
    const [notaProduto, setNotaProduto] = useState(0);
    const [notaVendedor, setNotaVendedor] = useState(0);
    const [comentario, setComentario] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    const enviar = async () => {
        setEnviando(true);
        setErro(null);
        try {
            await axios.post(route('entregas.pedidos.avaliar', pedido.id), {
                nota_produto: notaProduto, nota_vendedor: notaVendedor, comentario,
            });
            onSalvo?.();
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível enviar sua avaliação.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900">Como foi sua compra?</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{pedido.produto?.nome}</p>
                    </div>
                    <button onClick={onFechar} className="text-zinc-400 hover:text-zinc-700 text-sm font-bold">Fechar</button>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-bold text-zinc-800">O produto</p>
                    <Estrelas valor={notaProduto} onChange={setNotaProduto} />
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-bold text-zinc-800">O vendedor</p>
                    <Estrelas valor={notaVendedor} onChange={setNotaVendedor} />
                </div>
                <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={3}
                    placeholder="Conte como foi (opcional)"
                    className="w-full rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]"
                />

                {erro && <p className="text-sm text-red-600 font-semibold">{erro}</p>}

                <button
                    onClick={enviar}
                    disabled={enviando || !notaProduto || !notaVendedor}
                    className="w-full bg-[#FF5A00] text-white font-black py-3 rounded-2xl disabled:opacity-40"
                >
                    {enviando ? 'Enviando...' : 'Enviar avaliação'}
                </button>
            </div>
        </div>
    );
}
