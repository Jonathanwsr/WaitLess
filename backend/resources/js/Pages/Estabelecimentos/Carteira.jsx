import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    WalletIcon, ArrowUpTrayIcon, CheckBadgeIcon, ClockIcon, ExclamationTriangleIcon, PlusIcon,
    TrashIcon, StarIcon, XMarkIcon, LockClosedIcon, BanknotesIcon, ArrowPathIcon, BuildingLibraryIcon,
    ShieldCheckIcon, IdentificationIcon, CalendarDaysIcon, ArrowUturnLeftIcon, ArrowDownTrayIcon, CheckCircleIcon,
} from '@heroicons/react/24/solid';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');

const BANCOS = [
    ['001', 'Banco do Brasil'], ['033', 'Santander'], ['104', 'Caixa'], ['237', 'Bradesco'], ['260', 'Nubank'],
    ['341', 'Itaú'], ['077', 'Inter'], ['336', 'C6 Bank'], ['212', 'Banco Original'], ['756', 'Sicoob'], ['748', 'Sicredi'], ['380', 'PicPay'],
];

const STATUS_TRANSFERENCIA = {
    concluida: { texto: 'Concluído', classe: 'bg-green-50 text-green-700 border-green-200' },
    processando: { texto: 'Em processamento', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    pendente: { texto: 'Enviando', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    falhou: { texto: 'Não concluído', classe: 'bg-red-50 text-red-700 border-red-200' },
    cancelada: { texto: 'Cancelado', classe: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const STATUS_CONTA = {
    validada: { texto: 'Validada', classe: 'bg-green-50 text-green-700', icone: CheckBadgeIcon },
    validando: { texto: 'Validando…', classe: 'bg-amber-50 text-amber-700', icone: ClockIcon },
    pendente: { texto: 'Aguardando validação', classe: 'bg-amber-50 text-amber-700', icone: ClockIcon },
    falhou: { texto: 'Não validada', classe: 'bg-red-50 text-red-700', icone: ExclamationTriangleIcon },
};

const STATUS_ESTORNO = {
    PENDENTE: { texto: 'Aguardando', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    EM_ANALISE: { texto: 'Em análise', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    ESTORNADO: { texto: 'Estornado', classe: 'bg-red-50 text-red-700 border-red-200' },
    REPROVADO: { texto: 'Negado', classe: 'bg-gray-100 text-gray-600 border-gray-200' },
    CANCELADO: { texto: 'Cancelado', classe: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const fmtData = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');

/** Diz, em português, em que pé está cada movimentação e quando o dinheiro entra. */
function situacaoMovimento(m, proximoRepasse) {
    if (m.tipo === 'estorno' || m.status === 'estornado') return { texto: 'Estornado', classe: 'bg-red-50 text-red-700 border-red-200' };
    if (m.data_liberacao && new Date(m.data_liberacao) > new Date()) return { texto: `Libera em ${fmtData(m.data_liberacao)}`, classe: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (['pendente', 'aguardando', 'a_liberar'].includes(m.status)) return { texto: `Entra no repasse de ${proximoRepasse}`, classe: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { texto: 'Recebido', classe: 'bg-green-50 text-green-700 border-green-200' };
}

const mensagemDeErro = (e) =>
    e?.response?.data?.erro
    || Object.values(e?.response?.data?.errors || {})[0]?.[0]
    || 'Não conseguimos concluir agora. Tente novamente em instantes.';

function taxaPara(valor, regras) {
    const v = Number(valor) || 0;
    if (v <= 0) return 0;
    return Math.max(v * (regras.taxa_percentual / 100), regras.taxa_minima);
}

function ModalConta({ onClose, onSalvo }) {
    const [form, setForm] = useState({
        apelido: '', tipo: 'PIX', pix_key_type: 'CPF', pix_key: '',
        banco_codigo: '260', agencia: '', conta: '', conta_digito: '', tipo_conta: 'CONTA_CORRENTE',
        titular_nome: '', titular_documento: '',
    });
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState('');
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const enviar = async (e) => {
        e.preventDefault();
        setEnviando(true);
        setErro('');
        try {
            const banco = BANCOS.find(([c]) => c === form.banco_codigo);
            const { data } = await axios.post(route('carteira.asaas.contas.store'), {
                ...form,
                banco_nome: form.tipo === 'CONTA' ? banco?.[1] : null,
            });
            onSalvo(data.mensagem);
        } catch (err) {
            setErro(mensagemDeErro(err));
        } finally {
            setEnviando(false);
        }
    };

    const campo = 'w-full rounded-xl border-gray-200 focus:border-[#FF5A00] focus:ring-[#FF5A00] text-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <form onSubmit={enviar} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><XMarkIcon className="w-5 h-5" /></button>
                <h3 className="text-lg font-black text-gray-900">Nova conta de destino</h3>
                <p className="text-sm text-gray-500 mb-4">Vamos enviar <b>R$ 0,01 por Pix</b> para confirmar que a conta é sua. A conta precisa estar no seu CPF/CNPJ.</p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    {[['PIX', 'Chave Pix'], ['CONTA', 'Conta bancária']].map(([v, l]) => (
                        <button type="button" key={v} onClick={() => setForm({ ...form, tipo: v })}
                            className={`py-2.5 rounded-xl text-sm font-bold border transition ${form.tipo === v ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                    ))}
                </div>

                <div className="space-y-3">
                    <input className={campo} placeholder="Apelido (ex.: Conta pessoal)" value={form.apelido} onChange={set('apelido')} required maxLength={60} />

                    {form.tipo === 'PIX' ? (
                        <div className="grid grid-cols-3 gap-2">
                            <select className={campo} value={form.pix_key_type} onChange={set('pix_key_type')}>
                                <option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option>
                                <option value="PHONE">Celular</option><option value="RANDOM">Aleatória</option>
                            </select>
                            <input className={`${campo} col-span-2`} placeholder="Chave Pix" value={form.pix_key} onChange={set('pix_key')} required />
                        </div>
                    ) : (
                        <>
                            <select className={campo} value={form.banco_codigo} onChange={set('banco_codigo')}>
                                {BANCOS.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
                            </select>
                            <div className="grid grid-cols-3 gap-2">
                                <input className={campo} placeholder="Agência" value={form.agencia} onChange={set('agencia')} required />
                                <input className={campo} placeholder="Conta" value={form.conta} onChange={set('conta')} required />
                                <input className={campo} placeholder="Dígito" value={form.conta_digito} onChange={set('conta_digito')} required maxLength={3} />
                            </div>
                            <select className={campo} value={form.tipo_conta} onChange={set('tipo_conta')}>
                                <option value="CONTA_CORRENTE">Conta corrente</option><option value="CONTA_POUPANCA">Conta poupança</option>
                            </select>
                        </>
                    )}

                    <input className={campo} placeholder="Nome completo do titular" value={form.titular_nome} onChange={set('titular_nome')} required />
                    <input className={campo} placeholder="CPF/CNPJ do titular" value={form.titular_documento} onChange={set('titular_documento')} required />
                </div>

                {erro && <p className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

                <button disabled={enviando} className="mt-5 w-full py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white font-black transition">
                    {enviando ? 'Salvando…' : 'Cadastrar e validar'}
                </button>
            </form>
        </div>
    );
}

export default function Carteira({ painelInicial }) {
    const [painel, setPainel] = useState(painelInicial);
    const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'erro', texto }
    const [modalConta, setModalConta] = useState(false);
    const [valor, setValor] = useState('');
    const [contaId, setContaId] = useState(() => (painelInicial.contas.find((c) => c.padrao && c.status_validacao === 'validada') || painelInicial.contas.find((c) => c.status_validacao === 'validada'))?.id || '');
    const [sacando, setSacando] = useState(false);

    const recarregar = useCallback(async () => {
        try {
            const { data } = await axios.get(route('carteira.asaas.painel'));
            setPainel(data);
        } catch { /* mantém o que já está na tela */ }
    }, []);

    // Enquanto houver conta sendo validada ou saque em andamento, confere a cada 8s.
    const temPendencia = useMemo(
        () => painel.contas.some((c) => ['pendente', 'validando'].includes(c.status_validacao))
            || painel.historico.some((h) => ['pendente', 'processando'].includes(h.status)),
        [painel],
    );
    useEffect(() => {
        if (!temPendencia) return undefined;
        const t = setInterval(recarregar, 8000);
        return () => clearInterval(t);
    }, [temPendencia, recarregar]);

    useEffect(() => {
        if (!contaId) {
            const ok = painel.contas.find((c) => c.status_validacao === 'validada');
            if (ok) setContaId(ok.id);
        }
    }, [painel.contas, contaId]);

    const acao = async (fn) => {
        setAviso(null);
        try {
            const { data } = await fn();
            setAviso({ tipo: 'ok', texto: data.mensagem });
        } catch (e) {
            setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
        }
        recarregar();
    };

    const sacar = async (e) => {
        e.preventDefault();
        setSacando(true);
        setAviso(null);
        try {
            const { data } = await axios.post(route('carteira.asaas.sacar'), { conta_id: contaId, valor: Number(valor) });
            setAviso({ tipo: 'ok', texto: data.mensagem });
            setValor('');
        } catch (err) {
            setAviso({ tipo: 'erro', texto: mensagemDeErro(err) });
        } finally {
            setSacando(false);
            recarregar();
        }
    };

    const { regras, plano_libera_saque: liberado } = painel;
    const taxa = taxaPara(valor, regras);
    const receber = Math.max((Number(valor) || 0) - taxa, 0);
    const contasValidadas = painel.contas.filter((c) => c.status_validacao === 'validada');
    const valorNum = Number(valor) || 0;
    const podeSacar = liberado && contaId && valorNum >= regras.saque_minimo && receber >= 1 && painel.saldo_asaas !== null && valorNum <= painel.saldo_asaas && painel.divida <= 0;

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">Carteira</h2>}>
            <Head title="Carteira" />

            <div className="max-w-6xl mx-auto space-y-6">
                {aviso && (
                    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold flex items-start justify-between gap-3 ${aviso.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <span>{aviso.texto}</span>
                        <button onClick={() => setAviso(null)}><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                )}

                {!painel.tem_conta_asaas && (
                    <>
                        <div className="bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFF0E5] flex items-center justify-center shrink-0"><WalletIcon className="w-7 h-7 text-[#FF5A00]" /></div>
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-900">Ative sua carteira para receber pagamentos online</h3>
                                    <p className="text-gray-500 mt-1">Falta um passo: informar seus dados de recebimento. Enquanto isso não for feito, seus clientes não conseguem pagar online e a carteira fica desativada.</p>
                                </div>
                            </div>

                            <h4 className="mt-7 font-black text-gray-900">Por que preciso informar meus dados de novo?</h4>
                            <p className="text-sm text-gray-500 mt-1">Seu cadastro no app serve para você entrar na conta. Para receber dinheiro, abrimos uma conta de recebimento em seu nome numa processadora de pagamentos externa e regulamentada, e ela exige os dados completos de quem vai receber.</p>

                            <div className="grid sm:grid-cols-3 gap-4 mt-4">
                                {[
                                    [IdentificationIcon, 'É uma exigência para receber', 'Quem recebe pagamentos precisa ser identificado (nome, CPF/CNPJ, data de nascimento ou tipo de empresa, endereço e telefone). É uma regra do sistema financeiro para evitar fraudes e lavagem de dinheiro.'],
                                    [ShieldCheckIcon, 'O dinheiro só vai para você', 'A conta é aberta no seu CPF/CNPJ e os repasses só saem para contas do mesmo titular. Ninguém consegue desviar o seu dinheiro.'],
                                    [CheckCircleIcon, 'Você faz isso uma vez só', 'Depois de enviar, os dados ficam salvos. Você só volta aqui para atualizar algo ou cadastrar outra conta de destino.'],
                                ].map(([Icone, titulo, texto]) => (
                                    <div key={titulo} className="rounded-2xl bg-gray-50 p-4">
                                        <Icone className="w-6 h-6 text-[#FF5A00]" />
                                        <p className="font-bold text-gray-900 mt-2">{titulo}</p>
                                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{texto}</p>
                                    </div>
                                ))}
                            </div>

                            <h4 className="mt-8 font-black text-gray-900">O que acontece depois que você enviar</h4>
                            <ol className="mt-3 space-y-3">
                                {[
                                    ['Sua conta de recebimento é criada', 'Seus clientes já podem pagar online (Pix, cartão e boleto) nas suas reservas.'],
                                    ['Você cadastra a conta ou chave Pix de destino', 'Enviamos R$ 0,01 por Pix para confirmar que a conta é sua. Leva poucos instantes.'],
                                    ['Sua carteira funciona por completo', 'Você passa a ver o dia e o valor do próximo repasse, o que já entrou, as taxas, os valores estornados e cada movimentação.'],
                                ].map(([titulo, texto], i) => (
                                    <li key={titulo} className="flex gap-3">
                                        <span className="w-7 h-7 rounded-full bg-[#FF5A00] text-white text-sm font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                        <div>
                                            <p className="font-bold text-gray-900">{titulo}</p>
                                            <p className="text-sm text-gray-500">{texto}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            <div className="mt-8 flex flex-wrap items-center gap-4">
                                <Link href={route('financeiro.conta')} className="inline-block px-6 py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] text-white font-black transition">Informar meus dados agora</Link>
                                <p className="text-xs text-gray-400 max-w-md">Seus dados são usados só para abrir e manter a sua conta de recebimento.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                            <h4 className="font-black text-gray-900">O que você vai acompanhar aqui</h4>
                            <ul className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
                                <li className="flex gap-2"><CalendarDaysIcon className="w-5 h-5 text-[#FF5A00] shrink-0" /> O dia em que cada repasse cai na sua conta</li>
                                <li className="flex gap-2"><BanknotesIcon className="w-5 h-5 text-[#FF5A00] shrink-0" /> O valor que você tem a receber e o que já recebeu</li>
                                <li className="flex gap-2"><WalletIcon className="w-5 h-5 text-[#FF5A00] shrink-0" /> Cada venda, com a taxa da plataforma e o valor líquido</li>
                                <li className="flex gap-2"><ArrowUturnLeftIcon className="w-5 h-5 text-[#FF5A00] shrink-0" /> Os valores estornados e os estornos em análise</li>
                            </ul>
                        </div>
                    </>
                )}

                {painel.tem_conta_asaas && (
                    <div className="mb-6 bg-white rounded-3xl border border-emerald-100 p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                        <div>
                            <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Próximo repasse</p>
                            <p className="text-3xl sm:text-4xl font-black text-emerald-700 mt-1">{fmt(painel.a_repassar)}</p>
                            <p className="text-sm text-gray-500 mt-1">Cai na sua conta na <b className="text-gray-900 capitalize">{painel.proximo_repasse_rotulo}</b></p>
                        </div>
                        <div className="text-sm text-gray-500 max-w-xs">
                            Todo o valor que você tem a receber na semana é repassado automaticamente toda segunda-feira. Quer antes? Use o repasse antecipado abaixo.
                        </div>
                    </div>
                )}

                {painel.tem_conta_asaas && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            ['Recebido em 30 dias', fmt(painel.resumo.recebido_30_dias), 'já descontada a taxa', 'text-emerald-700', BanknotesIcon],
                            ['Taxa da plataforma', fmt(painel.resumo.taxas_30_dias), 'nos últimos 30 dias', 'text-gray-900', WalletIcon],
                            ['Estornado em 30 dias', fmt(painel.resumo.estornado_30_dias), `${fmt(painel.resumo.estornado_total)} no total`, painel.resumo.estornado_30_dias > 0 ? 'text-red-600' : 'text-gray-900', ArrowUturnLeftIcon],
                            ['Estornos em análise', String(painel.resumo.estornos_em_analise), painel.resumo.estornos_em_analise > 0 ? 'aguardando decisão' : 'nenhum no momento', painel.resumo.estornos_em_analise > 0 ? 'text-amber-600' : 'text-gray-900', ClockIcon],
                        ].map(([titulo, valor, sub, cor, Icone]) => (
                            <div key={titulo} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide"><Icone className="w-4 h-4" />{titulo}</div>
                                <p className={`text-2xl font-black mt-2 ${cor}`}>{valor}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                            </div>
                        ))}
                    </div>
                )}

                {painel.tem_conta_asaas && (
                    <div className="grid lg:grid-cols-5 gap-6">
                        {/* SALDO + SAQUE */}
                        <section className="lg:col-span-3 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white/60 uppercase tracking-wide">Saldo na carteira</p>
                                <button onClick={recarregar} title="Atualizar" className="p-2 rounded-lg hover:bg-white/10"><ArrowPathIcon className="w-4 h-4" /></button>
                            </div>

                            {liberado ? (
                                <>
                                    <p className="text-4xl sm:text-5xl font-black mt-1">{painel.saldo_asaas === null ? '—' : fmt(painel.saldo_asaas)}</p>
                                    {painel.saldo_indisponivel && <p className="text-sm text-amber-300 mt-1">Não conseguimos consultar o saldo agora. Atualize em instantes.</p>}
                                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
                                        <span>Repasse semanal previsto: <b className="text-white">{fmt(painel.a_repassar)}</b></span>
                                        {painel.divida > 0 && <span className="text-amber-300">Pendências com a plataforma: <b>{fmt(painel.divida)}</b></span>}
                                    </div>

                                    <form onSubmit={sacar} className="mt-6 bg-white/10 rounded-2xl p-4 space-y-3">
                                        <p className="font-black flex items-center gap-2"><ArrowUpTrayIcon className="w-5 h-5" /> Repasse antecipado</p>
                                        {contasValidadas.length === 0 ? (
                                            <p className="text-sm text-white/70">Cadastre e valide uma conta de destino para poder sacar.</p>
                                        ) : (
                                            <>
                                                <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full rounded-xl bg-white text-gray-900 border-0 text-sm">
                                                    {contasValidadas.map((c) => <option key={c.id} value={c.id}>{c.apelido} — {c.destino}</option>)}
                                                </select>
                                                <div className="flex items-center bg-white rounded-xl px-3">
                                                    <span className="text-gray-400 font-bold">R$</span>
                                                    <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00"
                                                        className="flex-1 border-0 focus:ring-0 text-gray-900 text-xl font-black bg-transparent" />
                                                    {painel.saldo_asaas > 0 && (
                                                        <button type="button" onClick={() => setValor(String(painel.saldo_asaas))} className="text-xs font-black text-[#FF5A00]">TUDO</button>
                                                    )}
                                                </div>
                                                <div className="text-sm space-y-1 text-white/80">
                                                    <div className="flex justify-between"><span>Taxa de antecipação ({regras.taxa_percentual}%, mín. {fmt(regras.taxa_minima)})</span><b>{valorNum > 0 ? `- ${fmt(taxa)}` : '—'}</b></div>
                                                    <div className="flex justify-between text-base text-white"><span>Você recebe</span><b>{valorNum > 0 ? fmt(receber) : '—'}</b></div>
                                                </div>
                                                <button disabled={!podeSacar || sacando} className="w-full py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-40 disabled:cursor-not-allowed font-black transition">
                                                    {sacando ? 'Enviando…' : 'Sacar agora'}
                                                </button>
                                                <p className="text-xs text-white/50">Mínimo de {fmt(regras.saque_minimo)}. Sem a antecipação, o saldo é repassado automaticamente toda segunda-feira, sem taxa.</p>
                                            </>
                                        )}
                                    </form>
                                </>
                            ) : (
                                <div className="mt-3">
                                    <p className="text-3xl font-black flex items-center gap-2"><LockClosedIcon className="w-7 h-7 text-white/60" /> Saldo bloqueado</p>
                                    <p className="text-white/70 mt-2">Seu próximo repasse semanal previsto é de <b className="text-white">{fmt(painel.a_repassar)}</b>, enviado toda segunda-feira sem taxa.</p>
                                    <div className="mt-5 bg-white/10 rounded-2xl p-4">
                                        <p className="font-black">Veja o saldo completo e saque quando quiser</p>
                                        <p className="text-sm text-white/70 mb-3">O plano Premium Sócio Anual libera a carteira completa e o repasse antecipado para a conta que você escolher.</p>
                                        <Link href={route('assinatura.status')} className="inline-block px-5 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] font-black text-sm transition">Ver planos</Link>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* CONTAS */}
                        <section className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-gray-900 flex items-center gap-2"><BuildingLibraryIcon className="w-5 h-5 text-[#FF5A00]" /> Contas de destino</h3>
                            <Link href={route('financeiro.conta')} className="text-xs font-bold text-gray-500 hover:text-[#FF5A00]">Dados da conta</Link>
                                <button onClick={() => setModalConta(true)} className="text-sm font-bold text-[#FF5A00] flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Nova</button>
                            </div>
                            {painel.contas.length === 0 && <p className="text-sm text-gray-500">Nenhuma conta ainda. Cadastre uma para receber seus repasses.</p>}
                            <ul className="space-y-3">
                                {painel.contas.map((c) => {
                                    const st = STATUS_CONTA[c.status_validacao] || STATUS_CONTA.pendente;
                                    const Icone = st.icone;
                                    return (
                                        <li key={c.id} className="border border-gray-100 rounded-2xl p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-gray-900 truncate">{c.apelido} {c.padrao && <StarIcon className="inline w-4 h-4 text-amber-400 -mt-1" title="Conta padrão do repasse semanal" />}</p>
                                                    <p className="text-xs text-gray-500 truncate">{c.destino}</p>
                                                </div>
                                                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${st.classe}`}><Icone className="w-3.5 h-3.5" />{st.texto}</span>
                                            </div>
                                            {c.erro && <p className="text-xs text-red-600 mt-2">{c.erro}</p>}
                                            <div className="flex gap-3 mt-2 text-xs font-bold">
                                                {c.status_validacao === 'falhou' && <button className="text-[#FF5A00]" onClick={() => acao(() => axios.post(route('carteira.asaas.contas.validar', c.id)))}>Tentar validar de novo</button>}
                                                {c.status_validacao === 'validada' && !c.padrao && <button className="text-gray-600" onClick={() => acao(() => axios.post(route('carteira.asaas.contas.padrao', c.id)))}>Usar no repasse semanal</button>}
                                                <button className="text-gray-400 hover:text-red-600 ml-auto" title="Remover" onClick={() => window.confirm('Remover esta conta?') && acao(() => axios.delete(route('carteira.asaas.contas.destroy', c.id)))}><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    </div>
                )}

                {/* VENDAS E MOVIMENTAÇÕES */}
                {painel.tem_conta_asaas && (
                    <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h3 className="font-black text-gray-900 flex items-center gap-2"><CalendarDaysIcon className="w-5 h-5 text-[#FF5A00]" /> Vendas e previsão de recebimento</h3>
                            <a href={route('provider.financeiro.export')} className="text-sm font-bold text-[#FF5A00] flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> Exportar planilha</a>
                        </div>
                        {painel.movimentos.length === 0 ? (
                            <p className="text-sm text-gray-500">Quando seus clientes pagarem online, cada venda aparece aqui com o valor, a taxa e o dia em que o dinheiro cai na sua conta.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {painel.movimentos.map((m) => {
                                    const st = situacaoMovimento(m, painel.proximo_repasse_rotulo);
                                    return (
                                        <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{m.descricao || (m.tipo === 'estorno' ? 'Estorno' : 'Venda online')}</p>
                                                <p className="text-xs text-gray-500">{fmtDataHora(m.data)}{m.metodo ? ` · ${String(m.metodo).replace('_', ' ')}` : ''}</p>
                                                {m.tipo !== 'estorno' && m.taxa > 0 && <p className="text-xs text-gray-400">Total {fmt(m.valor_bruto)} − taxa {fmt(m.taxa)}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-black ${m.valor_liquido < 0 ? 'text-red-600' : 'text-gray-900'}`}>{m.valor_liquido < 0 ? '−' : '+'} {fmt(Math.abs(m.valor_liquido))}</p>
                                                <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full border ${st.classe}`}>{st.texto}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                )}

                {/* ESTORNOS */}
                {painel.tem_conta_asaas && (
                    <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h3 className="font-black text-gray-900 flex items-center gap-2"><ArrowUturnLeftIcon className="w-5 h-5 text-[#FF5A00]" /> Estornos</h3>
                            {route().has('estornos.index') && <Link href={route('estornos.index')} className="text-sm font-bold text-[#FF5A00]">Ver e contestar</Link>}
                        </div>
                        {painel.estornos.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhum estorno até agora. Quando um cliente pedir a devolução de um pagamento, você acompanha o valor e a decisão aqui. O valor devolvido é descontado do seu saldo ou dos próximos repasses.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {painel.estornos.map((e) => {
                                    const st = STATUS_ESTORNO[e.status] || STATUS_ESTORNO.PENDENTE;
                                    return (
                                        <li key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-gray-900">{e.cliente || 'Cliente'} <span className="text-xs font-normal text-gray-400">{e.codigo}</span></p>
                                                <p className="text-xs text-gray-500">{fmtData(e.data)}{e.motivo ? ` · ${e.motivo}` : ''}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-gray-900">{fmt(e.valor_estornado || e.valor_pago)}</p>
                                                <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full border ${st.classe}`}>{st.texto}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                )}

                {/* HISTÓRICO */}
                <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2"><BanknotesIcon className="w-5 h-5 text-[#FF5A00]" /> Repasses</h3>
                    {painel.historico.length === 0 ? <p className="text-sm text-gray-500">Seus repasses semanais e antecipados aparecem aqui.</p> : (
                        <ul className="divide-y divide-gray-100">
                            {painel.historico.map((h) => {
                                const st = STATUS_TRANSFERENCIA[h.status] || STATUS_TRANSFERENCIA.pendente;
                                return (
                                    <li key={h.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-gray-900">{h.nome} <span className="text-xs font-normal text-gray-400">#{h.id}</span></p>
                                            <p className="text-xs text-gray-500">{fmtDataHora(h.criado_em)}{h.destino ? ` · ${h.destino}` : ''}</p>
                                            {h.erro && <p className="text-xs text-red-600 mt-1 max-w-xl">{h.erro}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900">{fmt(h.valor_liquido)}</p>
                                            {h.taxa_plataforma > 0 && <p className="text-xs text-gray-400">taxa {fmt(h.taxa_plataforma)}</p>}
                                            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full border ${st.classe}`}>{st.texto}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {/* EXTRATO ASAAS */}
                {liberado && painel.extrato_asaas.length > 0 && (
                    <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-black text-gray-900 mb-4">Movimentações da carteira</h3>
                        <ul className="divide-y divide-gray-100">
                            {painel.extrato_asaas.map((m, i) => (
                                <li key={m.id || i} className="py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{m.descricao || m.tipo}</p>
                                        <p className="text-xs text-gray-400">{m.data ? new Date(`${m.data}T12:00:00`).toLocaleDateString('pt-BR') : ''}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`font-black ${m.valor < 0 ? 'text-red-600' : 'text-green-600'}`}>{m.valor < 0 ? '-' : '+'} {fmt(Math.abs(m.valor))}</p>
                                        {m.saldo !== null && <p className="text-xs text-gray-400">saldo {fmt(m.saldo)}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {modalConta && (
                <ModalConta
                    onClose={() => setModalConta(false)}
                    onSalvo={(msg) => { setModalConta(false); setAviso({ tipo: 'ok', texto: msg }); recarregar(); }}
                />
            )}
        </AuthenticatedLayout>
    );
}
