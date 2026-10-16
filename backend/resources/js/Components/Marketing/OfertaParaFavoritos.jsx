import { useEffect, useState } from 'react';
import axios from 'axios';
import { ChatBubbleLeftRightIcon, HeartIcon, PaperAirplaneIcon, TicketIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Ofertas Exclusivas via Mensagem: o sócio escreve um comunicado (com ou sem cupom) e ele chega
 * na conversa de cada cliente que favoritou o local, um serviço ou uma reserva dele.
 */
export default function OfertaParaFavoritos({ estabelecimentoId }) {
    const [painel, setPainel] = useState(null);
    const [aberto, setAberto] = useState(false);
    const [form, setForm] = useState({ titulo: '', mensagem: '', cupom_id: '' });
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState(null);

    const carregar = () => axios.get(route('ofertas-favoritos.painel', estabelecimentoId)).then(({ data }) => setPainel(data)).catch(() => setPainel(null));
    useEffect(() => { carregar(); }, [estabelecimentoId]);

    const cupom = painel?.cupons?.find((c) => String(c.id) === String(form.cupom_id));
    const restantes = painel ? Math.max(0, painel.limite_por_dia - painel.enviadas_hoje) : 0;
    const podeEnviar = painel && painel.publico > 0 && restantes > 0 && form.titulo.trim().length >= 3 && form.mensagem.trim().length >= 5;

    const enviar = async (e) => {
        e.preventDefault();
        if (!podeEnviar || !window.confirm(`Enviar esta oferta para ${painel.publico} ${painel.publico === 1 ? 'cliente' : 'clientes'}?`)) return;
        setEnviando(true);
        setAviso(null);
        try {
            const { data } = await axios.post(route('ofertas-favoritos.enviar', estabelecimentoId), { ...form, cupom_id: form.cupom_id || null });
            setAviso({ ok: true, texto: data.mensagem });
            setForm({ titulo: '', mensagem: '', cupom_id: '' });
            carregar();
        } catch (err) {
            setAviso({ ok: false, texto: Object.values(err?.response?.data?.errors || {})[0]?.[0] || err?.response?.data?.message || 'Não foi possível enviar agora. Tente de novo.' });
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center gap-4 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white"><ChatBubbleLeftRightIcon className="h-6 w-6" /></span>
                <span className="flex-1">
                    <span className="block text-lg font-bold text-gray-900">Ofertas exclusivas por mensagem</span>
                    <span className="block text-sm text-gray-500">
                        Mande um cupom ou um aviso direto no chat de quem favoritou o seu local.{' '}
                        {painel && <b className="text-gray-800"><HeartIcon className="inline h-4 w-4 text-rose-500" /> {painel.publico} {painel.publico === 1 ? 'cliente favoritou' : 'clientes favoritaram'}</b>}
                    </span>
                </span>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && painel && (
                <form onSubmit={enviar} className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-gray-700">Título
                            <input value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: 20% de desconto para quem nos segue" className="mt-1 w-full rounded-xl border-gray-300 focus:border-[#FF5A00] focus:ring-[#FF5A00]" />
                        </label>
                        <label className="block text-sm font-bold text-gray-700">Mensagem
                            <textarea value={form.mensagem} maxLength={1000} rows={4} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Ex.: Nesta semana, quem favoritou o salão ganha desconto em qualquer serviço. Agende pelo app!" className="mt-1 w-full rounded-xl border-gray-300 focus:border-[#FF5A00] focus:ring-[#FF5A00]" />
                            <span className="text-xs font-normal text-gray-400">{form.mensagem.length}/1000</span>
                        </label>
                        <label className="block text-sm font-bold text-gray-700">Cupom (opcional)
                            <select value={form.cupom_id} onChange={(e) => setForm({ ...form, cupom_id: e.target.value })} className="mt-1 w-full rounded-xl border-gray-300 focus:border-[#FF5A00] focus:ring-[#FF5A00]">
                                <option value="">Só o comunicado, sem cupom</option>
                                {painel.cupons.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.titulo}</option>)}
                            </select>
                            {painel.cupons.length === 0 && <span className="mt-1 block text-xs font-normal text-gray-400">Crie um cupom abaixo para enviá-lo junto.</span>}
                        </label>
                        <p className="text-xs text-gray-500">O cupom já entra na carteira de cada cliente, sem custar pontos. Você pode enviar até {painel.limite_por_dia} ofertas por dia ({restantes} {restantes === 1 ? 'restante' : 'restantes'} hoje).</p>
                        {aviso && <p className={`rounded-xl p-3 text-sm font-bold ${aviso.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</p>}
                        <button type="submit" disabled={!podeEnviar || enviando} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FF5A00] px-5 font-bold text-white transition hover:bg-[#C74B27] disabled:opacity-50">
                            <PaperAirplaneIcon className="h-5 w-5" /> {enviando ? 'Enviando…' : `Enviar para ${painel.publico} ${painel.publico === 1 ? 'cliente' : 'clientes'}`}
                        </button>
                        {painel.publico === 0 && <p className="text-sm text-gray-500">Ninguém favoritou ainda. Divulgue o link do seu local para ganhar seguidores.</p>}
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-bold text-gray-700">Como o cliente vai ver</p>
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <div className="max-w-sm rounded-2xl rounded-tl-none border border-rose-100 bg-white p-4 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-rose-500">Oferta exclusiva · {painel.estabelecimento.nome}</p>
                                <p className="mt-1 font-bold text-gray-900">{form.titulo || 'Título da oferta'}</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{form.mensagem || 'Sua mensagem aparece aqui.'}</p>
                                {cupom && (
                                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-green-300 bg-green-50 p-3">
                                        <TicketIcon className="h-5 w-5 text-green-600" />
                                        <span className="font-mono font-bold text-green-800">{cupom.codigo}</span>
                                        <span className="text-xs text-green-700">{cupom.titulo}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {painel.resultados?.ofertas > 0 && (
                            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                                <p className="text-sm font-bold text-gray-800">Resultado das ofertas · últimos {painel.resultados.dias} dias</p>
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {[
                                        ['Receberam', painel.resultados.destinatarios],
                                        ['Leram', painel.resultados.leram],
                                        ['Reservaram', `${painel.resultados.reservaram} · ${String(painel.resultados.conversao).replace('.', ',')}%`],
                                        ['Gerou', brl(painel.resultados.receita)],
                                    ].map(([rotulo, valor]) => (
                                        <div key={rotulo} className="rounded-xl bg-white p-3 shadow-sm">
                                            <p className="text-lg font-black text-gray-900">{valor}</p>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">Conta quem reservou neste local em até 14 dias depois de receber a oferta. Cupons usados: {painel.resultados.usaram_cupom}.</p>
                            </div>
                        )}
                        {painel.historico.length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-sm font-bold text-gray-700">Últimos envios</p>
                                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 text-sm">
                                    {painel.historico.map((h) => (
                                        <li key={h.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                            <span className="truncate font-semibold text-gray-800">{h.titulo}{h.cupom ? ` · ${h.cupom.codigo}` : ''}</span>
                                            <span className="shrink-0 text-xs text-gray-500">
                                                {new Date(h.created_at).toLocaleDateString('pt-BR')} · {h.destinatarios} receberam
                                                {h.resultado && <> · {h.resultado.leram} leram · <strong className="text-emerald-700">{h.resultado.reservaram} reservaram</strong>{h.resultado.receita > 0 ? ` (${brl(h.resultado.receita)})` : ''}</>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
}
