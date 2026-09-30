import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '-');

const STATUS = {
    concluida: ['Concluída', 'bg-green-50 text-green-700 border-green-200'],
    processando: ['Processando', 'bg-amber-50 text-amber-700 border-amber-200'],
    pendente: ['Pendente', 'bg-amber-50 text-amber-700 border-amber-200'],
    falhou: ['Falhou', 'bg-red-50 text-red-700 border-red-200'],
    cancelada: ['Cancelada', 'bg-gray-100 text-gray-600 border-gray-200'],
};
const STATUS_CONTA = {
    validada: ['Validada', 'bg-green-50 text-green-700 border-green-200'],
    validando: ['Validando', 'bg-amber-50 text-amber-700 border-amber-200'],
    pendente: ['Pendente', 'bg-amber-50 text-amber-700 border-amber-200'],
    falhou: ['Falhou', 'bg-red-50 text-red-700 border-red-200'],
};
const TIPOS = { repasse: 'Repasse semanal', antecipacao: 'Repasse antecipado', validacao: 'Validação de conta' };
const TAXA = { cobrada: 'cobrada', pendente: 'pendente', falhou: 'NÃO cobrada', devolvida: 'devolvida', devolucao_falhou: 'devolução falhou' };

const Selo = ({ par }) => <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${par[1]}`}>{par[0]}</span>;

function Card({ titulo, valor, cor = 'text-gray-900' }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">{titulo}</p>
            <p className={`text-2xl font-black ${cor}`}>{valor}</p>
        </div>
    );
}

function LinhaTransferencia({ t }) {
    const [aberto, setAberto] = useState(false);
    const consultar = () => router.post(route('admin.repasses.consultar', t.id), {}, { preserveScroll: true });

    return (
        <>
            <tr className={`border-t border-gray-100 ${t.status === 'falhou' ? 'bg-red-50/40' : ''}`}>
                <td className="px-3 py-3 font-mono text-xs text-gray-500">#{t.id}</td>
                <td className="px-3 py-3">
                    <p className="font-bold text-gray-900">{t.nome}</p>
                    <p className="text-xs text-gray-400">{t.origem}</p>
                </td>
                <td className="px-3 py-3">
                    <p className="font-semibold text-gray-800">{t.proprietario || '—'}</p>
                    <p className="text-xs text-gray-400">{t.destino || 'Chave do cadastro'}</p>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                    <p className="font-black text-gray-900">{fmt(t.valor_liquido)}</p>
                    {t.tipo !== 'validacao' && <p className="text-xs text-gray-400">bruto {fmt(t.valor_bruto)}</p>}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                    {t.taxa_plataforma > 0 ? (
                        <>
                            <p className="font-bold text-gray-800">{fmt(t.taxa_plataforma)}</p>
                            <p className={`text-xs ${['falhou', 'devolucao_falhou'].includes(t.taxa_status) ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{TAXA[t.taxa_status]}</p>
                        </>
                    ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3"><Selo par={STATUS[t.status] || STATUS.pendente} /></td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDataHora(t.criado_em)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                    {['pendente', 'processando'].includes(t.status) && (
                        <button onClick={consultar} title="Consultar no Asaas" className="p-1.5 text-gray-400 hover:text-[#FF5A00]"><ArrowPathIcon className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => setAberto(!aberto)} className="p-1.5 text-gray-400 hover:text-gray-700">{aberto ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}</button>
                </td>
            </tr>
            {aberto && (
                <tr className="bg-gray-50 border-t border-gray-100">
                    <td colSpan={8} className="px-4 py-4 text-xs space-y-2">
                        <div className="grid sm:grid-cols-3 gap-3">
                            <p><b>Referência:</b> <span className="font-mono">{t.referencia}</span></p>
                            <p><b>ID no Asaas:</b> <span className="font-mono">{t.asaas_transfer_id || '—'}</span></p>
                            <p><b>Status no Asaas:</b> {t.asaas_status || '—'} · tentativas: {t.tentativas}</p>
                            <p><b>Taxa Asaas:</b> {fmt(t.taxa_asaas)}</p>
                            <p><b>Processada em:</b> {fmtDataHora(t.processado_em)}</p>
                            <p><b>E-mail:</b> {t.proprietario_email || '—'}</p>
                        </div>
                        {t.erro_mensagem && <p className="text-red-700"><b>Mensagem ao usuário:</b> {t.erro_mensagem} {t.erro_codigo && <span className="font-mono">[{t.erro_codigo}]</span>}</p>}
                        {t.erro_detalhe && <p className="text-red-700 break-words"><b>Detalhe técnico:</b> {t.erro_detalhe}</p>}
                        <details><summary className="cursor-pointer font-bold text-gray-600">Enviado ao Asaas</summary><pre className="mt-1 bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(t.payload, null, 2)}</pre></details>
                        <details><summary className="cursor-pointer font-bold text-gray-600">Resposta do Asaas</summary><pre className="mt-1 bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(t.resposta, null, 2)}</pre></details>
                    </td>
                </tr>
            )}
        </>
    );
}

export default function Repasses({ transferencias, contas, resumo, filtros }) {
    const { flash = {}, errors = {} } = usePage().props;
    const [aba, setAba] = useState(filtros.aba === 'contas' ? 'contas' : 'transferencias');
    const [f, setF] = useState({ tipo: filtros.tipo || '', status: filtros.status || '', busca: filtros.busca || '', de: filtros.de || '', ate: filtros.ate || '' });

    const filtrar = (e) => {
        e?.preventDefault();
        router.get(route('admin.repasses.index'), Object.fromEntries(Object.entries(f).filter(([, v]) => v)), { preserveState: true, preserveScroll: true });
    };
    const input = 'rounded-xl border-gray-200 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]';

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">Repasses e antecipações</h2>}>
            <Head title="Repasses" />
            <div className="max-w-7xl mx-auto space-y-5">
                {flash?.success && <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold px-4 py-3">{flash.success}</div>}
                {errors?.error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold px-4 py-3">{errors.error}</div>}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card titulo="Total repassado" valor={fmt(resumo.repassado)} />
                    <Card titulo="Taxas de antecipação" valor={fmt(resumo.taxas_antecipacao)} cor="text-green-600" />
                    <Card titulo="Em andamento" valor={resumo.em_andamento} cor="text-amber-600" />
                    <Card titulo="Falhas" valor={resumo.falhas} cor={resumo.falhas ? 'text-red-600' : 'text-gray-900'} />
                    <Card titulo="Contas validadas" valor={resumo.contas_validadas} />
                    <Card titulo="Contas com problema" valor={resumo.contas_com_problema} cor={resumo.contas_com_problema ? 'text-red-600' : 'text-gray-900'} />
                    <Card titulo="Taxas com problema" valor={resumo.taxas_pendentes} cor={resumo.taxas_pendentes ? 'text-red-600' : 'text-gray-900'} />
                    <button
                        onClick={() => router.post(route('admin.financeiro.robos.rodar', 'sincronizar-carteira'), {}, { preserveScroll: true })}
                        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left hover:border-[#FF5A00]/40 transition">
                        <p className="text-xs font-bold text-gray-400 uppercase">Sincronizar agora</p>
                        <p className="text-sm font-bold text-[#FF5A00] flex items-center gap-1 mt-1"><ArrowPathIcon className="w-4 h-4" /> Consultar Asaas</p>
                    </button>
                </div>

                <div className="flex gap-2">
                    {[['transferencias', 'Transações'], ['contas', 'Contas validadas']].map(([id, l]) => (
                        <button key={id} onClick={() => setAba(id)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${aba === id ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                    ))}
                </div>

                {aba === 'transferencias' && (
                    <>
                        <form onSubmit={filtrar} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <input className={`${input} lg:col-span-2`} placeholder="Nº, referência, ID Asaas, nome…" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
                            <select className={input} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                                <option value="">Todos os tipos</option>
                                {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                                <option value="">Todos os status</option>
                                {Object.entries(STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <input type="date" className={input} value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
                            <input type="date" className={input} value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
                            <button className="sm:col-span-3 lg:col-span-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-black">Filtrar</button>
                        </form>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-gray-400 text-left">
                                    <tr><th className="px-3 py-3">ID</th><th className="px-3">Nome</th><th className="px-3">Proprietário</th><th className="px-3 text-right">Valor líquido</th><th className="px-3 text-right">Taxa Lokyva</th><th className="px-3">Status</th><th className="px-3">Data</th><th /></tr>
                                </thead>
                                <tbody>
                                    {transferencias.data.map((t) => <LinhaTransferencia key={t.id} t={t} />)}
                                    {transferencias.data.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhuma transação encontrada.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap gap-1 justify-center">
                            {transferencias.links.map((l, i) => (
                                <Link key={i} href={l.url || '#'} preserveScroll preserveState
                                    className={`px-3 py-1.5 rounded-lg text-sm ${l.active ? 'bg-[#FF5A00] text-white font-bold' : 'bg-white text-gray-600 border border-gray-200'} ${!l.url ? 'opacity-40 pointer-events-none' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: l.label }} />
                            ))}
                        </div>
                    </>
                )}

                {aba === 'contas' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase text-gray-400 text-left">
                                <tr><th className="px-3 py-3">Proprietário</th><th className="px-3">Conta</th><th className="px-3">Titular</th><th className="px-3">Validação (Pix R$ 0,01)</th><th className="px-3">Tentativas</th><th /></tr>
                            </thead>
                            <tbody>
                                {contas.map((c) => (
                                    <tr key={c.id} className="border-t border-gray-100">
                                        <td className="px-3 py-3"><p className="font-semibold text-gray-800">{c.proprietario}</p><p className="text-xs text-gray-400">{c.proprietario_email}</p></td>
                                        <td className="px-3 py-3"><p className="font-bold text-gray-900">{c.apelido}{c.padrao && ' ★'}</p><p className="text-xs text-gray-500">{c.destino}</p></td>
                                        <td className="px-3 py-3 text-gray-700">{c.titular_nome}</td>
                                        <td className="px-3 py-3">
                                            <Selo par={STATUS_CONTA[c.status_validacao] || STATUS_CONTA.pendente} />
                                            {c.validada_em && <p className="text-xs text-gray-400 mt-1">{fmtDataHora(c.validada_em)}{c.validacao_transferencia_id && ` · op. #${c.validacao_transferencia_id}`}</p>}
                                            {c.erro && <p className="text-xs text-red-600 mt-1 max-w-xs">{c.erro} {c.erro_codigo && <span className="font-mono">[{c.erro_codigo}]</span>}</p>}
                                        </td>
                                        <td className="px-3 py-3 text-gray-500">{c.tentativas}</td>
                                        <td className="px-3 py-3 text-right">
                                            {c.status_validacao !== 'validada' && (
                                                <button onClick={() => router.post(route('admin.repasses.contas.validar', c.id), {}, { preserveScroll: true })} className="text-xs font-bold text-[#FF5A00]">Enviar Pix de validação</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {contas.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Nenhuma conta cadastrada.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
