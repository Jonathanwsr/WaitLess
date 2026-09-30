import { useState } from 'react';
import axios from 'axios';
import { LinkIcon, UserPlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import { PRESENCA, erroDe, inputClasse } from './util';

export default function GrupoTab({ painel, recarregar, notificar }) {
    const { viagem, membros, eu } = painel;
    const [email, setEmail] = useState('');
    const [enviando, setEnviando] = useState(false);
    const link = viagem.codigo_convite ? `${window.location.origin}/viagens/convite/${viagem.codigo_convite}` : null;
    const meu = membros.find((m) => m.id === eu.id);

    const chamar = async (fn, sucesso) => {
        try {
            const { data } = await fn();
            notificar({ tipo: 'ok', texto: sucesso || data.mensagem });
            recarregar();
        } catch (e) { notificar({ tipo: 'erro', texto: erroDe(e) }); }
    };

    const convidar = async (e) => {
        e.preventDefault();
        setEnviando(true);
        await chamar(() => axios.post(route('viagens.convidar', viagem.id), { email }));
        setEmail('');
        setEnviando(false);
    };

    const copiar = async () => {
        try { await navigator.clipboard.writeText(link); notificar({ tipo: 'ok', texto: 'Link copiado! Envie para quem vai viajar com você.' }); }
        catch { notificar({ tipo: 'erro', texto: 'Não foi possível copiar. Selecione e copie o link manualmente.' }); }
    };

    return (
        <div className="grid lg:grid-cols-5 gap-5">
            <section className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-black text-gray-900 mb-1">Quem vai</h4>
                <p className="text-sm text-gray-500 mb-4">{membros.filter((m) => m.presenca === 'confirmado').length} de {membros.length} confirmaram presença.</p>

                {meu && meu.presenca !== 'confirmado' && (
                    <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-200 p-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">Você já confirmou sua presença?</p>
                        <button onClick={() => chamar(() => axios.post(route('viagens.presenca', viagem.id), { status: 'confirmado' }))} className="px-4 py-2 rounded-xl bg-[#FF5A00] text-white text-sm font-black">Confirmar presença</button>
                    </div>
                )}

                <ul className="divide-y divide-gray-100">
                    {membros.map((m) => (
                        <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-black flex items-center justify-center shrink-0">{m.nome.slice(0, 1).toUpperCase()}</div>
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{m.nome}{m.id === eu.id ? ' (você)' : ''}</p>
                                    <p className="text-xs text-gray-400 capitalize">{m.funcao === 'criador' ? 'Organizador' : m.funcao === 'editor' ? 'Pode editar' : 'Participante'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${(PRESENCA[m.presenca] || PRESENCA.pendente).classe}`}>{(PRESENCA[m.presenca] || PRESENCA.pendente).texto}</span>
                                {viagem.sou_criador && m.funcao !== 'criador' && (
                                    <button title="Remover" onClick={() => window.confirm(`Remover ${m.nome} da viagem?`) && chamar(() => axios.delete(route('viagens.membros.destroy', [viagem.id, m.id])))} className="text-gray-300 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="lg:col-span-2 space-y-4">
                {viagem.posso_editar && (
                    <>
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                            <h4 className="font-black text-gray-900 mb-1 flex items-center gap-2"><LinkIcon className="w-5 h-5 text-[#FF5A00]" /> Link de convite</h4>
                            <p className="text-sm text-gray-500 mb-3">Quem abrir o link entra no grupo — não precisa ser Premium.</p>
                            <input readOnly value={link} onFocus={(e) => e.target.select()} className={`${inputClasse} text-gray-500`} />
                            <button onClick={copiar} className="mt-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-black">Copiar link</button>
                        </div>

                        <form onSubmit={convidar} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                            <h4 className="font-black text-gray-900 mb-1 flex items-center gap-2"><UserPlusIcon className="w-5 h-5 text-[#FF5A00]" /> Convidar por e-mail</h4>
                            <p className="text-sm text-gray-500 mb-3">A pessoa precisa ter conta no Lokyva.</p>
                            <input type="email" required className={inputClasse} placeholder="amigo@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                            <button disabled={enviando} className="mt-2 w-full py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white text-sm font-black">{enviando ? 'Convidando…' : 'Convidar'}</button>
                        </form>
                    </>
                )}

                {!viagem.sou_criador && (
                    <button onClick={() => window.confirm('Sair do grupo desta viagem?') && chamar(() => axios.post(route('viagens.presenca', viagem.id), { status: 'recusado' })).then(() => { window.location.href = route('viagens.index'); })}
                        className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50">Não vou / sair do grupo</button>
                )}
            </section>
        </div>
    );
}
