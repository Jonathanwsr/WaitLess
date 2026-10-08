import { useState } from 'react';
import axios from 'axios';

const FREQUENCIAS = [
    { dias: 7, rotulo: 'Toda semana' },
    { dias: 14, rotulo: 'A cada 2 semanas' },
    { dias: 30, rotulo: 'Todo mês' },
];

const amanha = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
};

/** Assinatura de entrega recorrente: o cliente escolhe frequência, quantidade e como recebe. */
export default function AssinarEntregaModal({ produto, onFechar, onCriada }) {
    const [frequencia, setFrequencia] = useState(30);
    const [quantidade, setQuantidade] = useState(produto.quantidade_minima || 1);
    const [inicio, setInicio] = useState(amanha());
    const [recebimento, setRecebimento] = useState(produto.aceita_retirada ? 'retirada' : 'entrega');
    const [pagamento, setPagamento] = useState('local');
    const [endereco, setEndereco] = useState({ cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', observacoes: '' });
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    const set = (campo, valor) => setEndereco((e) => ({ ...e, [campo]: valor }));

    const enviar = async () => {
        setEnviando(true);
        setErro(null);
        try {
            const { data } = await axios.post(route('entregas.assinaturas.store'), {
                produto_entrega_id: produto.id,
                quantidade,
                frequencia_dias: frequencia,
                modo_recebimento: recebimento,
                modo_pagamento: pagamento,
                proxima_entrega_em: inicio,
                endereco: recebimento === 'entrega' ? endereco : null,
            });
            onCriada?.(data.assinatura);
        } catch (e) {
            const campos = e.response?.data?.errors;
            setErro(e.response?.data?.message || (campos && Object.values(campos)[0]?.[0]) || e.response?.data?.error || 'Não foi possível criar a assinatura.');
        } finally {
            setEnviando(false);
        }
    };

    const campo = 'w-full rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]';

    return (
        <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 my-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900">Assinar entrega</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{produto.nome} · você pode pausar ou cancelar quando quiser</p>
                    </div>
                    <button onClick={onFechar} className="text-zinc-400 hover:text-zinc-700 text-sm font-bold">Fechar</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-600">Frequência</span>
                        <select value={frequencia} onChange={(e) => setFrequencia(Number(e.target.value))} className={campo}>
                            {FREQUENCIAS.map((f) => <option key={f.dias} value={f.dias}>{f.rotulo}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-600">Quantidade</span>
                        <input type="number" min={1} max={20} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className={campo} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-600">Primeira entrega</span>
                        <input type="date" min={amanha()} value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-bold text-zinc-600">Pagamento</span>
                        <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className={campo}>
                            <option value="local">No local</option>
                            <option value="direto_vendedor">Direto com o vendedor</option>
                        </select>
                    </label>
                </div>

                <div className="flex gap-2">
                    {produto.aceita_retirada && (
                        <button type="button" onClick={() => setRecebimento('retirada')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${recebimento === 'retirada' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>Buscar no local</button>
                    )}
                    {produto.aceita_entrega && (
                        <button type="button" onClick={() => setRecebimento('entrega')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${recebimento === 'entrega' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>Entregar em casa</button>
                    )}
                </div>

                {recebimento === 'entrega' && (
                    <div className="grid grid-cols-6 gap-2">
                        <input className={`${campo} col-span-2`} placeholder="CEP" value={endereco.cep} onChange={(e) => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8))} />
                        <input className={`${campo} col-span-4`} placeholder="Rua" value={endereco.rua} onChange={(e) => set('rua', e.target.value)} />
                        <input className={`${campo} col-span-2`} placeholder="Número" value={endereco.numero} onChange={(e) => set('numero', e.target.value)} />
                        <input className={`${campo} col-span-4`} placeholder="Complemento" value={endereco.complemento} onChange={(e) => set('complemento', e.target.value)} />
                        <input className={`${campo} col-span-3`} placeholder="Bairro" value={endereco.bairro} onChange={(e) => set('bairro', e.target.value)} />
                        <input className={`${campo} col-span-2`} placeholder="Cidade" value={endereco.cidade} onChange={(e) => set('cidade', e.target.value)} />
                        <input className={`${campo} col-span-1`} placeholder="UF" maxLength={2} value={endereco.estado} onChange={(e) => set('estado', e.target.value.toUpperCase())} />
                        <textarea className={`${campo} col-span-6`} rows={2} placeholder="Detalhes do local" value={endereco.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
                    </div>
                )}

                {erro && <p className="text-sm text-red-600 font-semibold">{erro}</p>}

                <button
                    onClick={enviar}
                    disabled={enviando}
                    className="w-full bg-[#FF5A00] text-white font-black py-3 rounded-2xl disabled:opacity-40"
                >
                    {enviando ? 'Criando...' : 'Criar assinatura'}
                </button>
            </div>
        </div>
    );
}
