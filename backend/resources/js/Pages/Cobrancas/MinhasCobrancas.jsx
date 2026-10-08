import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import axios from 'axios';
import {
    BanknotesIcon, CheckCircleIcon, XCircleIcon, ArrowTopRightOnSquareIcon, UserIcon, DocumentArrowDownIcon,
    MapPinIcon, CalendarDaysIcon, CreditCardIcon, BuildingStorefrontIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import AbasCliente from '@/Components/Entregas/AbasCliente';

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const dataBR = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-');

const STATUS_COBRANCA = {
    aguardando_aceite: { rotulo: 'Aguardando sua resposta', classe: 'bg-amber-100 text-amber-800' },
    aceita: { rotulo: 'Em andamento', classe: 'bg-blue-100 text-blue-800' },
    quitada: { rotulo: 'Quitada', classe: 'bg-emerald-100 text-emerald-800' },
    recusada: { rotulo: 'Recusada', classe: 'bg-red-100 text-red-700' },
    cancelada: { rotulo: 'Cancelada', classe: 'bg-zinc-200 text-zinc-700' },
};

const STATUS_PARCELA = {
    pendente: { rotulo: 'A pagar', classe: 'text-zinc-700' },
    atrasado: { rotulo: 'Atrasada', classe: 'text-red-600 font-bold' },
    pago: { rotulo: 'Paga', classe: 'text-emerald-700 font-bold' },
    cancelado: { rotulo: 'Cancelada', classe: 'text-zinc-400' },
    estornado: { rotulo: 'Estornada', classe: 'text-zinc-500' },
};

const FILTROS = [
    { id: 'andamento', rotulo: 'Em andamento', inclui: ['aceita'] },
    { id: 'resposta', rotulo: 'Aguardando resposta', inclui: ['aguardando_aceite'] },
    { id: 'encerradas', rotulo: 'Encerradas', inclui: ['quitada', 'recusada', 'cancelada'] },
    { id: 'todas', rotulo: 'Todas', inclui: null },
];

const primeiraFoto = (fotos) => {
    let lista = fotos;
    if (typeof lista === 'string') {
        try { lista = JSON.parse(lista); } catch { lista = [lista]; }
    }
    return Array.isArray(lista) && lista[0] ? lista[0] : null;
};

const emAberto = (p) => p.status === 'pendente' || p.status === 'atrasado';

function Resumo({ cobrancas }) {
    const ativas = cobrancas.filter((c) => c.status === 'aceita');
    const parcelasAbertas = ativas.flatMap((c) => c.parcelas.filter(emAberto).map((p) => ({ ...p, cobranca: c })));
    const totalAberto = parcelasAbertas.reduce((s, p) => s + Number(p.valor), 0);
    const proxima = [...parcelasAbertas].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];
    const atrasadas = parcelasAbertas.filter((p) => p.status === 'atrasado').length;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-3xl bg-zinc-900 text-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Próximo pagamento</p>
                {proxima ? (
                    <>
                        <p className="text-2xl font-black mt-1">{brl(proxima.valor)}</p>
                        <p className="text-sm text-zinc-300 mt-0.5">vence em {dataBR(proxima.vencimento)} · {proxima.cobranca.estabelecimento?.nome}</p>
                    </>
                ) : (
                    <p className="text-lg font-bold mt-1">Nada para pagar agora</p>
                )}
            </div>
            <div className="rounded-3xl bg-white border border-zinc-100 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total em aberto</p>
                <p className="text-2xl font-black text-zinc-900 mt-1">{brl(totalAberto)}</p>
                <p className="text-sm text-zinc-500 mt-0.5">{parcelasAbertas.length} parcela(s){atrasadas > 0 ? ` · ${atrasadas} atrasada(s)` : ''}</p>
            </div>
            <div className="rounded-3xl bg-white border border-zinc-100 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Em andamento</p>
                <p className="text-2xl font-black text-zinc-900 mt-1">{ativas.length}</p>
                <p className="text-sm text-zinc-500 mt-0.5">serviço(s) ou reserva(s) pagos por mês</p>
            </div>
        </div>
    );
}

function Cobranca({ cobranca, aoAtualizar, mostrarMensagem }) {
    const [ocupado, setOcupado] = useState(false);
    const [verParcelas, setVerParcelas] = useState(cobranca.status === 'aceita');
    const status = STATUS_COBRANCA[cobranca.status] || { rotulo: cobranca.status, classe: 'bg-zinc-100 text-zinc-600' };
    const total = cobranca.parcelas.length;
    const pagas = cobranca.parcelas.filter((p) => p.status === 'pago').length;
    const pagoValor = cobranca.parcelas.filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.valor), 0);
    const proxima = cobranca.parcelas.find(emAberto);
    const local = cobranca.estabelecimento || {};
    const capa = local.foto_banner || primeiraFoto(cobranca.itens.find((i) => i.servico)?.servico?.fotos) || local.foto_perfil;
    const online = cobranca.modo === 'online';

    const responder = async (acao) => {
        setOcupado(true);
        try {
            const { data } = await axios.post(route(acao === 'aceitar' ? 'cobrancas.aceitar' : 'cobrancas.recusar', cobranca.id));
            mostrarMensagem(data.message, 'ok');
            aoAtualizar();
        } catch (e) {
            mostrarMensagem(e.response?.data?.error || 'Não foi possível responder agora.', 'erro');
        } finally {
            setOcupado(false);
        }
    };

    const aceitar = () => {
        if (!window.confirm(`Aceitar a cobrança de ${brl(cobranca.valor_total)} em ${total}x?`)) return;
        responder('aceitar');
    };

    const recusar = () => {
        if (!window.confirm('Recusar esta cobrança? Nenhum pagamento será gerado.')) return;
        responder('recusar');
    };

    return (
        <article className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            {/* CAPA COM FOTO DO LOCAL */}
            <div className="relative h-32 sm:h-40 bg-gradient-to-br from-zinc-800 to-[#FF5A00]">
                {capa && <img src={capa} alt={local.nome} className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute left-4 right-4 bottom-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {local.foto_perfil ? (
                            <img src={local.foto_perfil} alt="" className="w-11 h-11 rounded-2xl object-cover border-2 border-white shadow" />
                        ) : (
                            <div className="w-11 h-11 rounded-2xl bg-white/90 flex items-center justify-center"><BuildingStorefrontIcon className="w-6 h-6 text-zinc-700" /></div>
                        )}
                        <div className="min-w-0">
                            <p className="font-black text-white truncate">{local.nome || 'Estabelecimento'}</p>
                            {(local.cidade || local.estado) && (
                                <p className="text-xs text-white/80 flex items-center gap-1"><MapPinIcon className="w-3.5 h-3.5" /> {[local.cidade, local.estado].filter(Boolean).join(' - ')}</p>
                            )}
                        </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${status.classe}`}>{status.rotulo}</span>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* O QUE É */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-black text-zinc-900 text-lg">{cobranca.descricao || cobranca.itens.map((i) => i.descricao).join(' + ')}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Enviada por {cobranca.criador?.name || 'o estabelecimento'} · {cobranca.codigo}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                        <p className="text-2xl font-black text-zinc-900">{brl(cobranca.valor_total)}</p>
                        <p className="text-xs text-zinc-500">{total}x de {brl(cobranca.parcelas[0]?.valor)}</p>
                    </div>
                </div>

                {/* INFORMAÇÕES RÁPIDAS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><CreditCardIcon className="w-3.5 h-3.5" /> Pagamento</p>
                        <p className="text-sm font-bold text-zinc-900 mt-0.5">{online ? 'Online (PIX, boleto ou cartão)' : 'Presencial, no local'}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><CalendarDaysIcon className="w-3.5 h-3.5" /> Parcelas</p>
                        <p className="text-sm font-bold text-zinc-900 mt-0.5">{pagas} de {total} pagas</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> Próxima</p>
                        <p className="text-sm font-bold text-zinc-900 mt-0.5">{proxima ? `${brl(proxima.valor)} · ${dataBR(proxima.vencimento)}` : '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Já pago</p>
                        <p className="text-sm font-bold text-emerald-700 mt-0.5">{brl(pagoValor)}</p>
                    </div>
                </div>

                {/* PROGRESSO */}
                {cobranca.status !== 'aguardando_aceite' && total > 0 && (
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden" role="progressbar" aria-valuenow={pagas} aria-valuemin={0} aria-valuemax={total}>
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(pagas / total) * 100}%` }} />
                    </div>
                )}

                {/* O QUE FOI COMBINADO */}
                <div className="rounded-2xl border border-zinc-100 divide-y divide-zinc-100">
                    {cobranca.itens.map((i) => (
                        <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 py-3 text-sm">
                            <div className="min-w-0">
                                <p className="font-semibold text-zinc-900">{i.descricao}</p>
                                <p className="text-xs text-zinc-500 flex flex-wrap gap-x-3">
                                    {i.funcionario?.nome && <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Quem atende: {i.funcionario.nome}</span>}
                                    {i.agendamento?.data_agendamento && <span>Reserva em {dataBR(i.agendamento.data_agendamento)} às {String(i.agendamento.hora_agendamento || '').slice(0, 5)}</span>}
                                </p>
                            </div>
                            <span className="font-bold text-zinc-900">{brl(i.valor)}</span>
                        </div>
                    ))}
                </div>

                {/* RESPOSTA */}
                {cobranca.status === 'aguardando_aceite' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <p className="text-sm text-amber-900">
                            Confira tudo acima. Ao aceitar, {online ? 'cada parcela recebe um link de pagamento' : 'você paga cada parcela direto no local'}. Nada é cobrado antes do seu aceite.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button onClick={aceitar} disabled={ocupado} className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl disabled:opacity-40">
                                <CheckCircleIcon className="w-5 h-5" /> {ocupado ? 'Aguarde...' : 'Aceitar'}
                            </button>
                            <button onClick={recusar} disabled={ocupado} className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-700 font-bold py-2.5 rounded-xl disabled:opacity-40">
                                <XCircleIcon className="w-5 h-5" /> Recusar
                            </button>
                        </div>
                    </div>
                )}

                {/* PARCELAS */}
                {['aceita', 'quitada'].includes(cobranca.status) && (
                    <div>
                        <button type="button" onClick={() => setVerParcelas((v) => !v)} className="text-sm font-bold text-zinc-700 hover:text-zinc-900">
                            {verParcelas ? 'Ocultar parcelas' : `Ver as ${total} parcelas`}
                        </button>
                        {verParcelas && (
                            <ul className="mt-3 space-y-2">
                                {cobranca.parcelas.map((p) => {
                                    const st = STATUS_PARCELA[p.status] || STATUS_PARCELA.pendente;
                                    const podePagar = emAberto(p) && p.invoice_url;
                                    return (
                                        <li key={p.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${p.status === 'atrasado' ? 'border-red-200 bg-red-50/50' : 'border-zinc-100'}`}>
                                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${p.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                                {p.status === 'pago' ? <CheckCircleIcon className="w-5 h-5" /> : p.numero}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-zinc-900">{brl(p.valor)}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {p.status === 'pago' ? `Paga em ${dataBR(p.pago_em)}` : `Vence em ${dataBR(p.vencimento)}`} · <span className={st.classe}>{st.rotulo}</span>
                                                </p>
                                            </div>
                                            {podePagar ? (
                                                <a href={p.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 text-white">
                                                    Pagar <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                                </a>
                                            ) : emAberto(p) && !online ? (
                                                <span className="text-xs font-semibold text-zinc-500">Pague no local</span>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                <div className="flex justify-end">
                    <a href={route('cobrancas.minhas.comprovante', cobranca.id)} className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-700 hover:text-zinc-900">
                        <DocumentArrowDownIcon className="w-4 h-4" /> Comprovante PDF
                    </a>
                </div>
            </div>
        </article>
    );
}

export default function MinhasCobrancas({ cobrancas = [] }) {
    const { auth } = usePage().props;
    const [aviso, setAviso] = useState(null);
    const pendentes = cobrancas.filter((c) => c.status === 'aguardando_aceite').length;
    const [filtro, setFiltro] = useState(pendentes > 0 ? 'resposta' : 'andamento');

    const mostrarMensagem = (texto, tipo) => {
        setAviso({ texto, tipo });
        setTimeout(() => setAviso(null), 5000);
    };

    const atualizar = () => router.reload({ only: ['cobrancas'] });

    const lista = useMemo(() => {
        const f = FILTROS.find((x) => x.id === filtro);
        return f?.inclui ? cobrancas.filter((c) => f.inclui.includes(c.status)) : cobrancas;
    }, [cobrancas, filtro]);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Pagamentos mensais" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <AbasCliente ativa="parcelas" />

                <header>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <BanknotesIcon className="w-8 h-8 text-[#FF5A00]" /> Pagamentos mensais
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Serviços e reservas que você paga em parcelas: valor de cada uma, forma de pagamento, vencimentos e quem atende.
                    </p>
                </header>

                <Resumo cobrancas={cobrancas} />

                {aviso && (
                    <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {aviso.texto}
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-1">
                    {FILTROS.map((f) => {
                        const qtd = f.inclui ? cobrancas.filter((c) => f.inclui.includes(c.status)).length : cobrancas.length;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setFiltro(f.id)}
                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${filtro === f.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600'}`}
                            >
                                {f.rotulo} <span className="opacity-60">({qtd})</span>
                            </button>
                        );
                    })}
                </div>

                {lista.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
                        <BanknotesIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-500">
                            {cobrancas.length === 0
                                ? 'Quando um estabelecimento enviar um serviço ou reserva para pagar em parcelas, ele aparece aqui.'
                                : 'Nada nesta lista.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {lista.map((c) => <Cobranca key={c.id} cobranca={c} aoAtualizar={atualizar} mostrarMensagem={mostrarMensagem} />)}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
