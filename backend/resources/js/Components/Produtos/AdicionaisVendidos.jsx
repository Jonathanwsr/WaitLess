import { useEffect, useState } from 'react';
import axios from 'axios';
import { ChartBarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PERIODOS = [7, 30, 90];

/** Quanto os produtos adicionais renderam junto com serviços e reservas (sócio). */
export default function AdicionaisVendidos() {
    const [dias, setDias] = useState(30);
    const [dados, setDados] = useState(null);
    const [aberto, setAberto] = useState(true);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        let vivo = true;
        setErro(false);
        axios.get('/produtos/adicionais-vendidos', { params: { dias } })
            .then(({ data }) => vivo && setDados(data))
            .catch(() => vivo && setErro(true));
        return () => { vivo = false; };
    }, [dias]);

    if (erro || !dados) return null;
    const maior = Math.max(1, ...dados.produtos.map((p) => p.receita));

    return (
        <section className="mx-4 mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-sm sm:mx-0 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 text-left" aria-expanded={aberto}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ChartBarIcon className="h-5 w-5" /></span>
                    <span>
                        <span className="block font-black text-gray-900">Adicionais vendidos</span>
                        <span className="block text-xs text-gray-500">Produtos escolhidos junto com serviços e reservas</span>
                    </span>
                    <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition ${aberto ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex rounded-xl bg-gray-100 p-1" role="tablist">
                    {PERIODOS.map((p) => (
                        <button key={p} type="button" onClick={() => setDias(p)} className={`min-h-[36px] rounded-lg px-3 text-xs font-bold transition ${dias === p ? 'bg-white text-emerald-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                            {p} dias
                        </button>
                    ))}
                </div>
            </div>

            {aberto && (
                dados.unidades === 0 ? (
                    <p className="mt-4 rounded-xl bg-white p-4 text-sm text-gray-500">
                        Nenhum adicional vendido nos últimos {dias} dias. Vincule produtos a um serviço ou reserva para o cliente poder escolher na hora de agendar.
                    </p>
                ) : (
                    <>
                        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                            {[
                                ['Receita', brl(dados.receita)],
                                ['Unidades', dados.unidades],
                                ['Pedidos com adicional', dados.pedidos_com_adicional],
                                ['Média por pedido', brl(dados.ticket_medio_adicionais)],
                            ].map(([rotulo, valor]) => (
                                <div key={rotulo} className="rounded-xl bg-white p-3 shadow-sm">
                                    <p className="text-lg font-black text-gray-900">{valor}</p>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Em serviços: {brl(dados.em_servicos)} · Em reservas: {brl(dados.em_reservas)}</p>
                        <ul className="mt-3 space-y-2">
                            {dados.produtos.map((p) => (
                                <li key={p.produto_id} className="rounded-xl bg-white p-3 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="truncate font-semibold text-gray-800">{p.nome}</span>
                                        <span className="shrink-0 font-bold text-gray-900">{brl(p.receita)}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.receita / maior) * 100}%` }} />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{p.quantidade} un. em {p.pedidos} {p.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
                                </li>
                            ))}
                        </ul>
                    </>
                )
            )}
        </section>
    );
}
