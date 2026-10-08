import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    BanknotesIcon, PlusIcon, XMarkIcon, MagnifyingGlassIcon, CheckCircleIcon, ArrowPathIcon, NoSymbolIcon, InformationCircleIcon, DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

const STATUS_COBRANCA = {
    aguardando_aceite: { rotulo: 'Aguardando aceite', classe: 'bg-amber-50 text-amber-700' },
    aceita: { rotulo: 'Em andamento', classe: 'bg-blue-50 text-blue-700' },
    quitada: { rotulo: 'Quitada', classe: 'bg-emerald-50 text-emerald-700' },
    recusada: { rotulo: 'Recusada pelo cliente', classe: 'bg-red-50 text-red-600' },
    cancelada: { rotulo: 'Cancelada', classe: 'bg-zinc-100 text-zinc-600' },
};

const STATUS_PARCELA = {
    pendente: { rotulo: 'Pendente', classe: 'text-zinc-600' },
    atrasado: { rotulo: 'Atrasada', classe: 'text-red-600 font-bold' },
    pago: { rotulo: 'Paga', classe: 'text-emerald-700 font-bold' },
    cancelado: { rotulo: 'Cancelada', classe: 'text-zinc-400' },
    estornado: { rotulo: 'Estornada', classe: 'text-zinc-500' },
};

const pct = (v) => String(v).replace('.', ',');
const dataBR = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-');
const hojeISO = () => new Date().toISOString().slice(0, 10);

function Pilula({ status, mapa }) {
    const s = mapa[status] || { rotulo: status, classe: 'bg-zinc-100 text-zinc-600' };
    return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${s.classe}`}>{s.rotulo}</span>;
}

function ErroMensagem({ erro }) {
    if (!erro) return null;
    return <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>;
}

/** Explica, antes de enviar, quanto cada lado recebe e o que acontece em cada modo. */
function ComoFunciona({ taxa, parteDoSocio }) {
    return (
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900 space-y-2">
            <p className="font-bold flex items-center gap-2"><InformationCircleIcon className="w-5 h-5" /> Como funciona o dinheiro</p>
            <ul className="list-disc pl-5 space-y-1">
                <li><b>Online:</b> cada parcela vira um link de pagamento (PIX, boleto ou cartão). Você recebe <b>{pct(parteDoSocio)}%</b> de cada pagamento direto na sua carteira Asaas. A plataforma fica com <b>{pct(taxa)}%</b>.</li>
                <li><b>Presencial:</b> o cliente paga direto para você e você marca cada parcela como paga. A taxa de <b>{pct(taxa)}%</b> de cada parcela fica como saldo a acertar com a plataforma e é descontada do seu próximo repasse. O cliente não paga nada a mais.</li>
                <li>Se uma parcela online for paga em dinheiro e você marcar como paga, vale a mesma regra do presencial.</li>
                <li>O cliente precisa <b>aceitar</b> antes. Nada é cobrado no Asaas até ele aceitar.</li>
            </ul>
        </div>
    );
}

function Nova({ estabelecimentos, taxa, parteDoSocio, onFechar, onCriada }) {
    const [estabelecimentoId, setEstabelecimentoId] = useState(estabelecimentos[0]?.id ?? '');
    const [opcoes, setOpcoes] = useState(null);
    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [cliente, setCliente] = useState(null);
    const [selServicos, setSelServicos] = useState([]);
    const [selReservas, setSelReservas] = useState([]);
    const [funcionarioPorItem, setFuncionarioPorItem] = useState({});
    const [parcelas, setParcelas] = useState(1);
    const [vencimento, setVencimento] = useState(hojeISO());
    const [modo, setModo] = useState('online');
    const [descricao, setDescricao] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        if (!estabelecimentoId) return;
        setOpcoes(null);
        axios.get(route('cobrancas.opcoes'), { params: { estabelecimento_id: estabelecimentoId } })
            .then(({ data }) => setOpcoes(data))
            .catch((e) => setErro(e.response?.data?.error || 'Não foi possível carregar os serviços deste local.'));
    }, [estabelecimentoId]);

    useEffect(() => {
        if (termo.trim().length < 3) { setResultados([]); return; }
        const t = setTimeout(() => {
            axios.get(route('cobrancas.buscar-clientes'), { params: { q: termo } })
                .then(({ data }) => setResultados(data.clientes || []))
                .catch(() => setResultados([]));
        }, 300);
        return () => clearTimeout(t);
    }, [termo]);

    const reservasDoCliente = useMemo(() => {
        if (!opcoes || !cliente) return [];
        return opcoes.reservas.filter((r) => r.cliente_id === cliente.id);
    }, [opcoes, cliente]);

    const total = useMemo(() => {
        if (!opcoes) return 0;
        const servicos = opcoes.servicos.filter((s) => selServicos.includes(s.id)).reduce((soma, s) => soma + Number(s.valor), 0);
        const reservas = reservasDoCliente.filter((r) => selReservas.includes(r.id)).reduce((soma, r) => soma + Number(r.valor), 0);
        return Math.round((servicos + reservas) * 100) / 100;
    }, [opcoes, selServicos, selReservas, reservasDoCliente]);

    // Mesma regra do servidor: no máximo 12x e nenhuma parcela abaixo de R$ 20.
    const maximoParcelas = Math.max(1, Math.min(12, Math.floor(total / 20)));
    const valorParcela = total > 0 ? Math.floor((total / parcelas) * 100) / 100 : 0;
    const ultimaParcela = Math.round((total - valorParcela * (parcelas - 1)) * 100) / 100;

    useEffect(() => {
        if (parcelas > maximoParcelas) setParcelas(maximoParcelas);
    }, [maximoParcelas]);

    const alternar = (lista, setLista, id) => setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

    const enviar = async () => {
        setErro(null);
        const itens = [
            ...selServicos.map((id) => ({ tipo: 'servico', id, funcionario_id: funcionarioPorItem[`s${id}`] || null })),
            ...selReservas.map((id) => ({ tipo: 'reserva', id })),
        ];
        setOcupado(true);
        try {
            const { data } = await axios.post(route('cobrancas.store'), {
                estabelecimento_id: Number(estabelecimentoId),
                cliente_id: cliente?.id,
                modo,
                parcelas,
                primeiro_vencimento: vencimento,
                descricao: descricao || null,
                itens,
            });
            onCriada(data.message);
        } catch (e) {
            const validacao = e.response?.data?.errors;
            setErro(validacao ? Object.values(validacao)[0][0] : (e.response?.data?.error || 'Não foi possível enviar a cobrança.'));
        } finally {
            setOcupado(false);
        }
    };

    const podeEnviar = cliente && total > 0 && (selServicos.length + selReservas.length) > 0 && !ocupado;

    return (
        <div className="fixed inset-0 z-50 bg-zinc-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="sticky top-0 bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
                    <h2 className="font-black text-zinc-900 text-lg">Nova cobrança</h2>
                    <button onClick={onFechar} className="p-2 rounded-full hover:bg-zinc-100"><XMarkIcon className="w-5 h-5" /></button>
                </div>

                <div className="p-5 space-y-6">
                    <ComoFunciona taxa={taxa} parteDoSocio={parteDoSocio} />

                    <section className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">1. Local</label>
                        <select value={estabelecimentoId} onChange={(e) => { setEstabelecimentoId(e.target.value); setSelServicos([]); setSelReservas([]); }} className="w-full rounded-xl border-zinc-200">
                            {estabelecimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </section>

                    <section className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">2. Cliente</label>
                        {cliente ? (
                            <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                                <div>
                                    <p className="font-bold text-zinc-900">{cliente.name}</p>
                                    <p className="text-xs text-zinc-500">{cliente.email}</p>
                                </div>
                                <button onClick={() => { setCliente(null); setSelReservas([]); }} className="text-xs font-bold text-zinc-500 hover:text-zinc-900">Trocar</button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar pelo nome ou e-mail (mín. 3 letras)" className="w-full pl-9 rounded-xl border-zinc-200" />
                                </div>
                                {resultados.length > 0 && (
                                    <ul className="border border-zinc-100 rounded-xl divide-y divide-zinc-100">
                                        {resultados.map((c) => (
                                            <li key={c.id}>
                                                <button onClick={() => { setCliente(c); setTermo(''); setResultados([]); }} className="w-full text-left px-4 py-3 hover:bg-zinc-50">
                                                    <p className="font-bold text-sm text-zinc-900">{c.name}</p>
                                                    <p className="text-xs text-zinc-500">{c.email}</p>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </section>

                    {cliente && opcoes && (
                        <section className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">3. O que será cobrado</label>

                            <p className="text-xs font-bold text-zinc-500">Serviços</p>
                            {opcoes.servicos.length === 0 && <p className="text-sm text-zinc-400">Nenhum serviço cadastrado neste local.</p>}
                            {opcoes.servicos.map((s) => (
                                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3">
                                    <input type="checkbox" checked={selServicos.includes(s.id)} onChange={() => alternar(selServicos, setSelServicos, s.id)} className="rounded text-[#FF5A00]" />
                                    <span className="flex-1 font-semibold text-sm text-zinc-900">{s.nome}</span>
                                    <span className="text-sm font-bold text-zinc-700">{brl(s.valor)}</span>
                                    {selServicos.includes(s.id) && opcoes.funcionarios.length > 0 && (
                                        <select value={funcionarioPorItem[`s${s.id}`] || ''} onChange={(e) => setFuncionarioPorItem({ ...funcionarioPorItem, [`s${s.id}`]: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border-zinc-200 text-xs">
                                            <option value="">Quem faz?</option>
                                            {opcoes.funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                        </select>
                                    )}
                                </div>
                            ))}

                            <p className="text-xs font-bold text-zinc-500 pt-2">Reservas deste cliente (últimos 30 dias)</p>
                            {reservasDoCliente.length === 0 && <p className="text-sm text-zinc-400">Este cliente não tem reservas recentes.</p>}
                            {reservasDoCliente.map((r) => (
                                <label key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3 cursor-pointer">
                                    <input type="checkbox" checked={selReservas.includes(r.id)} onChange={() => alternar(selReservas, setSelReservas, r.id)} className="rounded text-[#FF5A00]" />
                                    <span className="flex-1 text-sm text-zinc-900">
                                        <b>{r.servico_nome || 'Atendimento'}</b> · {r.data} às {r.hora}
                                        {r.funcionario_nome && <span className="block text-xs text-zinc-500">Com {r.funcionario_nome}</span>}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-700">{brl(r.valor)}</span>
                                </label>
                            ))}
                        </section>
                    )}

                    {total > 0 && (
                        <section className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">4. Parcelas e vencimento</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">Quantidade</p>
                                    <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="w-full rounded-xl border-zinc-200">
                                        {Array.from({ length: maximoParcelas }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1">1º vencimento</p>
                                    <input type="date" min={hojeISO()} value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="w-full rounded-xl border-zinc-200" />
                                </div>
                            </div>
                            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                                <p>Total: <b>{brl(total)}</b></p>
                                <p>{parcelas}x de <b>{brl(valorParcela)}</b>{parcelas > 1 && <> (a última é {brl(ultimaParcela)})</>}</p>
                                <p className="text-xs text-zinc-500 mt-1">Parcelas mensais, uma a cada mês a partir do 1º vencimento.</p>
                            </div>
                        </section>
                    )}

                    {total > 0 && (
                        <section className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">5. Como o cliente vai pagar</label>
                            <div className="grid sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'online', titulo: 'Online (link de pagamento)', texto: 'PIX, boleto ou cartão pelo link de cada parcela.' },
                                    { id: 'presencial', titulo: 'Presencial', texto: 'O cliente paga direto com você. Você marca como paga; a taxa sai do seu próximo repasse.' },
                                ].map((m) => (
                                    <button key={m.id} onClick={() => setModo(m.id)} className={`text-left rounded-2xl border p-4 ${modo === m.id ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20' : 'border-zinc-200'}`}>
                                        <p className="font-bold text-sm text-zinc-900">{m.titulo}</p>
                                        <p className="text-xs text-zinc-500 mt-1">{m.texto}</p>
                                    </button>
                                ))}
                            </div>
                            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} placeholder="Observação para o cliente (opcional)" className="w-full rounded-xl border-zinc-200 text-sm" />
                        </section>
                    )}

                    <ErroMensagem erro={erro} />
                </div>

                <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-5 py-4">
                    <button onClick={enviar} disabled={!podeEnviar} className="w-full bg-zinc-900 text-white font-black py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                        <BanknotesIcon className="w-5 h-5" /> {ocupado ? 'Enviando...' : 'Enviar cobrança para o cliente'}
                    </button>
                    <p className="text-[11px] text-zinc-500 text-center mt-2">O cliente recebe um aviso e precisa aceitar antes de qualquer pagamento.</p>
                </div>
            </div>
        </div>
    );
}

function Cobranca({ cobranca, aoAtualizar, mostrarMensagem }) {
    const [ocupado, setOcupado] = useState(false);

    const acao = async (fn, sucesso) => {
        setOcupado(true);
        try {
            const { data } = await fn();
            mostrarMensagem(data.message || sucesso, 'ok');
            aoAtualizar();
        } catch (e) {
            mostrarMensagem(e.response?.data?.error || 'Não foi possível concluir esta ação.', 'erro');
        } finally {
            setOcupado(false);
        }
    };

    const darBaixa = (parcela) => {
        if (!window.confirm(`Marcar a parcela ${parcela.numero} de ${brl(parcela.valor)} como paga?`)) return;
        acao(() => axios.post(route('cobrancas.parcelas.baixa', parcela.id), {}), 'Parcela marcada como paga.');
    };

    const sincronizar = (parcela) => acao(() => axios.post(route('cobrancas.parcelas.sincronizar', parcela.id)), 'Parcela atualizada com o Asaas.');

    const cancelar = () => {
        if (!window.confirm('Cancelar esta cobrança? As parcelas em aberto deixam de ser cobradas.')) return;
        acao(() => axios.post(route('cobrancas.cancelar', cobranca.id)), 'Cobrança cancelada.');
    };

    const podeCancelar = ['aguardando_aceite', 'aceita'].includes(cobranca.status) && !cobranca.parcelas.some((p) => p.status === 'pago');

    return (
        <article className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-zinc-900">{cobranca.cliente?.name || 'Cliente'}</p>
                        <Pilula status={cobranca.status} mapa={STATUS_COBRANCA} />
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-600">{cobranca.modo === 'online' ? 'Online' : 'Presencial'}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{cobranca.codigo} · {cobranca.estabelecimento?.nome} · {cobranca.parcelas.length}x · {cobranca.modo === 'online' ? 'pagamento online (taxa por split)' : 'pagamento presencial (taxa descontada do repasse)'}</p>
                    <p className="text-sm text-zinc-600 mt-2">Cobrança de {cobranca.itens.map((i) => i.descricao).join(', ')}, em {cobranca.parcelas.length}x para {cobranca.cliente?.name || 'o cliente'}.</p>
                    <ul className="text-sm text-zinc-700 mt-2 space-y-0.5">
                        {cobranca.itens.map((i) => (
                            <li key={i.id}>• {i.descricao}{i.funcionario?.nome && <span className="text-zinc-500"> · com {i.funcionario.nome}</span>}</li>
                        ))}
                    </ul>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-500">Total</p>
                    <p className="text-xl font-black text-zinc-900">{brl(cobranca.valor_total)}</p>
                    <a href={route('cobrancas.comprovante', cobranca.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-zinc-700 hover:underline">
                        <DocumentArrowDownIcon className="w-4 h-4" /> Comprovante PDF
                    </a>
                    {podeCancelar && (
                        <button onClick={cancelar} disabled={ocupado} className="mt-2 block ml-auto inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline disabled:opacity-40">
                            <NoSymbolIcon className="w-4 h-4" /> Cancelar cobrança
                        </button>
                    )}
                </div>
            </div>

            {cobranca.parcelas.length > 0 && (
                <div className="border-t border-zinc-100 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs uppercase font-bold text-zinc-400">
                            <tr>
                                <th className="text-left px-5 py-2">Parcela</th>
                                <th className="text-left px-5 py-2">Vencimento</th>
                                <th className="text-right px-5 py-2">Valor</th>
                                <th className="text-left px-5 py-2">Situação</th>
                                <th className="text-right px-5 py-2">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {cobranca.parcelas.map((p) => {
                                const emAberto = ['pendente', 'atrasado'].includes(p.status) && cobranca.status === 'aceita';
                                return (
                                    <tr key={p.id}>
                                        <td className="px-5 py-2.5">{p.numero}/{cobranca.parcelas.length}</td>
                                        <td className="px-5 py-2.5">{dataBR(p.vencimento)}</td>
                                        <td className="px-5 py-2.5 text-right font-bold">{brl(p.valor)}</td>
                                        <td className={`px-5 py-2.5 ${STATUS_PARCELA[p.status]?.classe || ''}`}>
                                            {STATUS_PARCELA[p.status]?.rotulo || p.status}
                                            {p.baixa_manual && <span className="block text-[11px] font-normal text-zinc-500">baixa manual</span>}
                                        </td>
                                        <td className="px-5 py-2.5 text-right">
                                            {emAberto && (
                                                <div className="flex justify-end gap-2 flex-wrap">
                                                    {p.forma_pagamento === 'online' && (
                                                        <button onClick={() => sincronizar(p)} disabled={ocupado} title="Conferir no Asaas" className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40">
                                                            <ArrowPathIcon className="w-3.5 h-3.5" /> Atualizar
                                                        </button>
                                                    )}
                                                    <button onClick={() => darBaixa(p)} disabled={ocupado} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" /> Marcar como paga
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </article>
    );
}

export default function Socio({ cobrancas = [], estabelecimentos = [], podeCriar = false, taxaPercentual = 0.5, parteDoSocioPercentual = 99.5 }) {
    const { auth } = usePage().props;
    const [criando, setCriando] = useState(false);
    const [aviso, setAviso] = useState(null);

    const mostrarMensagem = (texto, tipo) => {
        setAviso({ texto, tipo });
        setTimeout(() => setAviso(null), 5000);
    };

    const atualizar = () => router.reload({ only: ['cobrancas'] });

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Cobranças" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#FF5A00]">Cobranças parceladas</p>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                            <BanknotesIcon className="w-8 h-8 text-[#FF5A00]" /> Cobranças
                        </h1>
                        <p className="text-sm text-zinc-500 mt-1">Cobre serviços ou uma reserva em parcelas e acompanhe cada pagamento.</p>
                    </div>
                    <button
                        onClick={() => setCriando(true)}
                        disabled={!podeCriar || estabelecimentos.length === 0}
                        className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white font-black px-5 py-3 rounded-xl disabled:opacity-40"
                    >
                        <PlusIcon className="w-5 h-5" /> Nova cobrança
                    </button>
                </header>

                {!podeCriar && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
                        Cobranças parceladas são exclusivas de sócios com o <b>plano premium de sócio</b>. Você ainda pode acompanhar as que já existem.
                    </div>
                )}

                {aviso && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {aviso.texto}
                    </div>
                )}

                <ComoFunciona taxa={taxaPercentual} parteDoSocio={parteDoSocioPercentual} />

                {cobrancas.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
                        <BanknotesIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">Nenhuma cobrança enviada ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cobrancas.map((c) => <Cobranca key={c.id} cobranca={c} aoAtualizar={atualizar} mostrarMensagem={mostrarMensagem} />)}
                    </div>
                )}
            </div>

            {criando && (
                <Nova
                    estabelecimentos={estabelecimentos}
                    taxa={taxaPercentual}
                    parteDoSocio={parteDoSocioPercentual}
                    onFechar={() => setCriando(false)}
                    onCriada={(texto) => { setCriando(false); mostrarMensagem(texto, 'ok'); atualizar(); }}
                />
            )}
        </AuthenticatedLayout>
    );
}
