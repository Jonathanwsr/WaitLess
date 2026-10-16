import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ShoppingBagIcon, PlusIcon, MinusIcon, StarIcon, SparklesIcon, CheckIcon } from '@heroicons/react/24/solid';

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Produtos adicionais que o cliente pode levar junto com um serviço (servicoId) ou uma reserva (itemId).
 * O valor entra no mesmo pagamento; o backend confere tudo de novo ao confirmar.
 *
 * onChange({ selecao: {id: qtd}, itens: [{id, quantidade}], total, quantidade })
 */
export default function AdicionaisEscolha({ servicoId = null, itemId = null, inicial = '', onChange, contexto = 'serviço' }) {
    const [produtos, setProdutos] = useState(null);
    const [selecao, setSelecao] = useState({});

    useEffect(() => {
        if (!servicoId && !itemId) return;
        let ativo = true;
        setProdutos(null);
        axios.get(route('produtos.adicionais'), { params: servicoId ? { servico_id: servicoId } : { item_aluguel_id: itemId } })
            .then(({ data }) => {
                if (!ativo) return;
                const lista = data.produtos || [];
                setProdutos(lista);
                // Pré-seleção vinda da loja (?extras_ids=3,5,5): só o que continua disponível.
                const inicio = {};
                String(inicial || '').split(',').map(Number).filter(Boolean).forEach((id) => {
                    const p = lista.find((x) => x.id === id);
                    if (p) inicio[id] = Math.min((inicio[id] || 0) + 1, p.maximo);
                });
                setSelecao(inicio);
            })
            .catch(() => ativo && setProdutos([]));
        return () => { ativo = false; };
    }, [servicoId, itemId]);

    const resumo = useMemo(() => {
        const itens = Object.entries(selecao).filter(([, q]) => q > 0).map(([id, q]) => ({ id: Number(id), quantidade: q }));
        const total = itens.reduce((s, i) => s + (produtos?.find((p) => p.id === i.id)?.valor || 0) * i.quantidade, 0);
        return { selecao, itens, total: Math.round(total * 100) / 100, quantidade: itens.reduce((s, i) => s + i.quantidade, 0) };
    }, [selecao, produtos]);

    useEffect(() => { onChange?.(resumo); }, [resumo]);

    const mudar = (p, delta) => setSelecao((s) => {
        const q = Math.max(0, Math.min(p.maximo, (s[p.id] || 0) + delta));
        return { ...s, [p.id]: q };
    });

    if (produtos === null) {
        return (
            <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
                {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
            </div>
        );
    }
    if (produtos.length === 0) return null;

    return (
        <section className="mt-6 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-white p-4 sm:p-5" aria-label="Adicionais">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h4 className="flex items-center gap-2 text-base font-black text-gray-900"><ShoppingBagIcon className="h-5 w-5 text-[#FF5A00]" /> Leve junto com o seu {contexto}</h4>
                    <p className="text-sm text-gray-500">Opcional. O valor entra no mesmo pagamento e você retira no dia.</p>
                </div>
                {resumo.quantidade > 0 && (
                    <span className="rounded-full bg-[#FF5A00] px-3 py-1 text-xs font-black text-white">{resumo.quantidade} {resumo.quantidade === 1 ? 'item' : 'itens'} · + {moeda(resumo.total)}</span>
                )}
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {produtos.map((p) => {
                    const q = selecao[p.id] || 0;
                    const feitoPara = p.vinculo !== 'local';
                    return (
                        <li key={p.id} className={`flex gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${q > 0 ? 'border-[#FF5A00] ring-2 ring-orange-100' : 'border-gray-100'}`}>
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                {p.foto ? <img src={p.foto} alt={p.nome} loading="lazy" className="h-full w-full object-cover" /> : <ShoppingBagIcon className="m-auto mt-6 h-8 w-8 text-gray-300" />}
                                {q > 0 && <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF5A00] text-white"><CheckIcon className="h-4 w-4" /></span>}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex flex-wrap gap-1">
                                    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${feitoPara ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {feitoPara && <SparklesIcon className="h-3 w-3" />} {p.vinculo_texto}
                                    </span>
                                    {p.somente_premium && <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800"><StarIcon className="h-3 w-3" /> Premium</span>}
                                </div>
                                <p className="mt-1 truncate text-sm font-black text-gray-900">{p.nome}</p>
                                {(p.detalhes || p.descricao) && <p className="line-clamp-1 text-xs text-gray-500">{p.detalhes || p.descricao}</p>}
                                {p.ultimas_unidades && <p className="text-[11px] font-bold text-red-600">Últimas {p.estoque} unidades</p>}
                                <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                                    <div>
                                        {p.em_promocao && <span className="block text-[11px] text-gray-400 line-through">{moeda(p.valor_normal)}</span>}
                                        <span className="text-sm font-black text-[#FF5A00]">{moeda(p.valor)}</span>
                                    </div>
                                    {q === 0 ? (
                                        <button type="button" onClick={() => mudar(p, 1)} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-gray-900 px-3 text-xs font-black text-white hover:bg-black" aria-label={`Adicionar ${p.nome}`}>
                                            <PlusIcon className="h-4 w-4" /> Adicionar
                                        </button>
                                    ) : (
                                        <div className="flex items-center rounded-xl border border-gray-200 bg-white">
                                            <button type="button" onClick={() => mudar(p, -1)} className="flex h-10 w-10 items-center justify-center text-gray-600 hover:text-[#FF5A00]" aria-label={`Menos um ${p.nome}`}><MinusIcon className="h-4 w-4" /></button>
                                            <span className="w-6 text-center text-sm font-black" aria-live="polite">{q}</span>
                                            <button type="button" onClick={() => mudar(p, 1)} disabled={q >= p.maximo} className="flex h-10 w-10 items-center justify-center text-gray-600 hover:text-[#FF5A00] disabled:opacity-30" aria-label={`Mais um ${p.nome}`}><PlusIcon className="h-4 w-4" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
