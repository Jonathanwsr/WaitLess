import { useState } from 'react';
import axios from 'axios';
import { PlusIcon, TrashIcon, BanknotesIcon } from '@heroicons/react/24/solid';
import { erroDe, fmt, fmtDia, inputClasse } from './util';

const CATEGORIAS = [['hospedagem', 'Hospedagem'], ['alimentacao', 'Alimentação'], ['transporte', 'Transporte'], ['passeio', 'Passeio'], ['outros', 'Outros']];

function FormDespesa({ painel, onSalvo, onCancelar, notificar }) {
    const { membros, itens, eu } = painel;
    const [f, setF] = useState({ descricao: '', valor: '', pagador_id: eu.id, categoria: 'alimentacao', data_despesa: new Date().toISOString().slice(0, 10), viagem_item_id: '' });
    const [modo, setModo] = useState('igual');
    const [participantes, setParticipantes] = useState(membros.filter((m) => m.presenca !== 'recusado').map((m) => m.id));
    const [partes, setPartes] = useState({});
    const [enviando, setEnviando] = useState(false);

    const total = Number(f.valor) || 0;
    const somaPartes = Object.values(partes).reduce((s, v) => s + (Number(v) || 0), 0);
    const aoAlternar = (id) => setParticipantes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const porPessoa = participantes.length ? total / participantes.length : 0;

    const enviar = async (e) => {
        e.preventDefault();
        setEnviando(true);
        try {
            const payload = { ...f, valor: total, viagem_item_id: f.viagem_item_id || undefined };
            if (modo === 'igual') payload.participantes = participantes;
            else payload.partes = Object.fromEntries(Object.entries(partes).filter(([, v]) => Number(v) > 0));
            const { data } = await axios.post(route('viagens.despesas.store', painel.viagem.id), payload);
            notificar({ tipo: 'ok', texto: data.mensagem });
            onSalvo();
        } catch (err) {
            notificar({ tipo: 'erro', texto: erroDe(err) });
        } finally { setEnviando(false); }
    };

    return (
        <form onSubmit={enviar} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h4 className="font-black text-gray-900">Novo gasto</h4>
            <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputClasse} placeholder="O que foi? (ex.: Jantar)" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} required maxLength={255} />
                <div className="flex items-center rounded-xl border border-gray-200 px-3 focus-within:border-[#FF5A00]">
                    <span className="text-gray-400 font-bold text-sm">R$</span>
                    <input type="number" step="0.01" min="0.01" className="flex-1 border-0 focus:ring-0 text-sm" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Quem pagou</label>
                    <select className={`${inputClasse} mt-1`} value={f.pagador_id} onChange={(e) => setF({ ...f, pagador_id: Number(e.target.value) })}>
                        {membros.filter((m) => m.presenca !== 'recusado').map((m) => <option key={m.id} value={m.id}>{m.id === eu.id ? 'Eu' : m.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
                    <input type="date" className={`${inputClasse} mt-1`} value={f.data_despesa} onChange={(e) => setF({ ...f, data_despesa: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                    <select className={`${inputClasse} mt-1`} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
                        {CATEGORIAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Ligado a um item da agenda</label>
                    <select className={`${inputClasse} mt-1`} value={f.viagem_item_id} onChange={(e) => setF({ ...f, viagem_item_id: e.target.value })}>
                        <option value="">Nenhum</option>
                        {itens.map((i) => <option key={i.id} value={i.id}>{i.titulo}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <div className="flex gap-2 mb-3">
                    {[['igual', 'Dividir igualmente'], ['personalizada', 'Valores diferentes']].map(([v, n]) => (
                        <button type="button" key={v} onClick={() => setModo(v)} className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${modo === v ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>{n}</button>
                    ))}
                </div>

                {modo === 'igual' ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                        {membros.filter((m) => m.presenca !== 'recusado').map((m) => (
                            <label key={m.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 cursor-pointer ${participantes.includes(m.id) ? 'border-[#FF5A00] bg-orange-50' : 'border-gray-200'}`}>
                                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <input type="checkbox" className="rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" checked={participantes.includes(m.id)} onChange={() => aoAlternar(m.id)} />
                                    {m.id === eu.id ? 'Eu' : m.nome}
                                </span>
                                {participantes.includes(m.id) && total > 0 && <span className="text-sm font-black text-gray-700">{fmt(porPessoa)}</span>}
                            </label>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {membros.filter((m) => m.presenca !== 'recusado').map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-gray-800">{m.id === eu.id ? 'Eu' : m.nome}</span>
                                <input type="number" step="0.01" min="0" className="w-32 rounded-xl border-gray-200 text-sm text-right" placeholder="0,00" value={partes[m.id] ?? ''} onChange={(e) => setPartes({ ...partes, [m.id]: e.target.value })} />
                            </div>
                        ))}
                        <p className={`text-sm font-bold ${Math.abs(somaPartes - total) < 0.005 ? 'text-green-600' : 'text-amber-600'}`}>
                            Soma das partes: {fmt(somaPartes)} de {fmt(total)}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button disabled={enviando} className="px-6 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white font-black transition">{enviando ? 'Salvando…' : 'Lançar gasto'}</button>
                <button type="button" onClick={onCancelar} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold">Cancelar</button>
            </div>
        </form>
    );
}

export default function GastosTab({ painel, recarregar, notificar }) {
    const [novo, setNovo] = useState(false);
    const { despesas, saldos, acertos, custos, eu, viagem } = painel;
    const meuSaldo = saldos.find((s) => s.usuario_id === eu.id)?.saldo ?? 0;

    const apagar = async (d) => {
        if (!window.confirm(`Apagar o gasto "${d.descricao}"?`)) return;
        try { await axios.delete(route('viagens.despesas.destroy', [viagem.id, d.id])); recarregar(); } catch (e) { notificar({ tipo: 'erro', texto: erroDe(e) }); }
    };

    const acertar = async (a) => {
        if (!window.confirm(`Registrar que ${a.de_nome} pagou ${fmt(a.valor)} a ${a.para_nome}?`)) return;
        try {
            await axios.post(route('viagens.pagamentos.store', viagem.id), { de_id: a.de, para_id: a.para, valor: a.valor });
            notificar({ tipo: 'ok', texto: 'Acerto registrado.' });
            recarregar();
        } catch (e) { notificar({ tipo: 'erro', texto: erroDe(e) }); }
    };

    return (
        <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Gasto real</p><p className="text-2xl font-black text-gray-900">{fmt(custos.gasto_real)}</p></div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"><p className="text-xs font-bold text-gray-400 uppercase">Previsto no roteiro</p><p className="text-2xl font-black text-gray-900">{fmt(custos.estimado)}</p></div>
                <div className={`rounded-2xl border p-4 shadow-sm ${meuSaldo > 0.004 ? 'bg-green-50 border-green-200' : meuSaldo < -0.004 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                    <p className="text-xs font-bold text-gray-500 uppercase">Meu saldo</p>
                    <p className={`text-2xl font-black ${meuSaldo > 0.004 ? 'text-green-700' : meuSaldo < -0.004 ? 'text-red-700' : 'text-gray-900'}`}>{fmt(Math.abs(meuSaldo))}</p>
                    <p className="text-xs text-gray-500">{meuSaldo > 0.004 ? 'você tem a receber' : meuSaldo < -0.004 ? 'você deve' : 'tudo certo por aqui'}</p>
                </div>
            </div>

            {acertos.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                    <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2"><BanknotesIcon className="w-5 h-5 text-[#FF5A00]" /> Como acertar as contas</h4>
                    <ul className="divide-y divide-gray-100">
                        {acertos.map((a, i) => (
                            <li key={i} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-gray-700"><b>{a.de === eu.id ? 'Você' : a.de_nome}</b> paga <b>{fmt(a.valor)}</b> a <b>{a.para === eu.id ? 'você' : a.para_nome}</b></p>
                                {(a.de === eu.id || a.para === eu.id || viagem.sou_criador) && <button onClick={() => acertar(a)} className="text-xs font-bold text-[#FF5A00] hover:underline">Marcar como pago</button>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {novo ? (
                <FormDespesa painel={painel} notificar={notificar} onCancelar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />
            ) : (
                <button onClick={() => setNovo(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] text-white font-black transition"><PlusIcon className="w-5 h-5" /> Lançar gasto</button>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-black text-gray-900 mb-3">Quanto cada um pagou e deve</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-gray-400 text-left"><tr><th className="py-2">Pessoa</th><th className="text-right">Pagou</th><th className="text-right">Deve</th><th className="text-right">Saldo</th></tr></thead>
                        <tbody>
                            {saldos.map((s) => (
                                <tr key={s.usuario_id} className="border-t border-gray-100">
                                    <td className="py-2 font-semibold text-gray-800">{s.usuario_id === eu.id ? 'Você' : s.nome}</td>
                                    <td className="text-right">{fmt(s.pago)}</td><td className="text-right">{fmt(s.devido)}</td>
                                    <td className={`text-right font-black ${s.saldo > 0.004 ? 'text-green-600' : s.saldo < -0.004 ? 'text-red-600' : 'text-gray-400'}`}>{s.saldo > 0.004 ? '+' : s.saldo < -0.004 ? '-' : ''}{fmt(Math.abs(s.saldo))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-black text-gray-900 mb-3">Gastos lançados</h4>
                {despesas.length === 0 && <p className="text-sm text-gray-500">Nenhum gasto ainda. Lance o primeiro e o Lokyva divide para todo mundo.</p>}
                <ul className="divide-y divide-gray-100">
                    {despesas.map((d) => (
                        <li key={d.id} className="py-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-bold text-gray-900">{d.descricao}</p>
                                <p className="text-xs text-gray-500">{fmtDia(d.data)} · pago por {d.pagador_id === eu.id ? 'você' : d.pagador}{d.item ? ` · ${d.item}` : ''}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{d.partes.map((p) => `${p.usuario_id === eu.id ? 'Você' : p.nome.split(' ')[0]} ${fmt(p.valor)}`).join(' · ')}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-black text-gray-900">{fmt(d.valor)}</p>
                                {d.pode_apagar && <button onClick={() => apagar(d)} className="text-gray-300 hover:text-red-600 mt-1" title="Apagar"><TrashIcon className="w-4 h-4 inline" /></button>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
