import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ComoFunciona from '@/Components/ComoFunciona';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    DocumentTextIcon, ArrowPathIcon, ExclamationTriangleIcon, ReceiptPercentIcon, BanknotesIcon,
    Cog6ToothIcon, ChevronDownIcon, ArrowDownTrayIcon, CheckBadgeIcon, SparklesIcon, ArrowRightIcon,
    Bars3Icon, EnvelopeIcon, WalletIcon,
} from '@heroicons/react/24/outline';

const STATUS = {
    AGENDADA: { nome: 'Agendada', cor: 'bg-blue-50 text-blue-700' },
    SINCRONIZADA: { nome: 'Em processamento', cor: 'bg-blue-50 text-blue-700' },
    AUTORIZADA: { nome: 'Autorizada', cor: 'bg-emerald-50 text-emerald-700' },
    CANCELADA: { nome: 'Cancelada', cor: 'bg-gray-100 text-gray-500' },
    ERRO: { nome: 'Erro', cor: 'bg-red-50 text-red-700' },
    NAO_CONFIGURADO: { nome: 'Falta configurar', cor: 'bg-amber-50 text-amber-700' },
};

const TIPOS = {
    venda: { nome: 'Venda', explicacao: 'Sua nota para o cliente', cor: 'bg-indigo-50 text-indigo-700' },
    comissao: { nome: 'Comissão Lokyva', explicacao: 'Nota da Lokyva para você', cor: 'bg-orange-50 text-[#E8590C]' },
    assinatura: { nome: 'Assinatura', explicacao: 'Plano Lokyva', cor: 'bg-violet-50 text-violet-700' },
};

const ABAS = [
    { id: null, nome: 'Todas' },
    { id: 'venda', nome: 'Vendas' },
    { id: 'comissao', nome: 'Comissões Lokyva' },
    { id: 'assinatura', nome: 'Assinatura' },
];

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const campo = 'mt-1 w-full rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 ring-1 ring-gray-200 focus:bg-white focus:ring-2 focus:ring-[#FF5A00]';

function Status({ nota }) {
    const s = STATUS[nota.status] || { nome: nota.status, cor: 'bg-gray-100 text-gray-600' };
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${s.cor}`}>{s.nome}</span>;
}

function Acoes({ nota }) {
    const { post, processing } = useForm();
    const podeTentar = ['ERRO', 'NAO_CONFIGURADO'].includes(nota.status);

    return (
        <div className="flex flex-wrap items-center gap-3">
            {nota.pdf_url && (
                <a href={nota.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-[#FF5A00] hover:underline">
                    <ArrowDownTrayIcon className="h-4 w-4" /> PDF
                </a>
            )}
            {nota.xml_url && (
                <a href={nota.xml_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:underline">
                    <ArrowDownTrayIcon className="h-4 w-4" /> XML
                </a>
            )}
            {podeTentar && (
                <button type="button" onClick={() => post(route('notas-fiscais.tentar-novamente', nota.id), { preserveScroll: true })} disabled={processing}
                    className="inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-[#FF5A00] disabled:opacity-50">
                    <ArrowPathIcon className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} /> Tentar novamente
                </button>
            )}
        </div>
    );
}

function Descricao({ nota }) {
    const t = TIPOS[nota.tipo] || TIPOS.venda;
    return (
        <div className="min-w-0">
            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${t.cor}`}>{t.nome}</span>
            <p className="mt-1 text-sm font-semibold text-gray-800">{nota.descricao_servico}</p>
            <p className="text-xs text-gray-400">
                {t.explicacao}
                {nota.numero ? ` · Nº ${nota.numero}` : ''}
                {nota.tipo === 'comissao' && nota.valor_operacao ? ` · ${pct(nota.percentual)} de ${brl(nota.valor_operacao)}` : ''}
            </p>
            {nota.mensagem_erro && <p className="mt-1 max-w-md text-xs text-red-600">{nota.mensagem_erro}</p>}
        </div>
    );
}

function Kpi({ icone: Icone, titulo, valor, detalhe, destaque }) {
    return (
        <div className={`rounded-2xl border p-4 ${destaque ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white shadow-sm'}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                <Icone className="h-4 w-4" /> {titulo}
            </div>
            <p className="mt-2 text-2xl font-black text-gray-900">{valor}</p>
            {detalhe && <p className="mt-0.5 text-xs text-gray-500">{detalhe}</p>}
        </div>
    );
}

function OndeFicam({ onVerComissoes }) {
    const lugares = [
        { icone: Bars3Icon, titulo: 'Aqui, nesta tela', texto: 'Menu lateral → Gestão → Notas fiscais. A aba "Comissões Lokyva" tem só as notas que a Lokyva emitiu para você.' },
        { icone: EnvelopeIcon, titulo: 'No seu e-mail', texto: 'Quando a prefeitura autoriza a nota, ela chega no e-mail da sua carteira, com o PDF e o XML.' },
        { icone: WalletIcon, titulo: 'No Extrato e na Carteira', texto: 'Tem um atalho "Suas notas fiscais" nas telas de dinheiro, para achar rápido.' },
    ];
    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-gray-900">Onde ficam as notas que a Lokyva emite para você</h2>
                <button type="button" onClick={onVerComissoes} className="rounded-xl bg-[#FF5A00] px-4 py-2 text-sm font-black text-white hover:bg-[#E8590C]">Ver minhas notas de comissão</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {lugares.map((l, i) => (
                    <div key={l.titulo} className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-[#FF5A00] shadow-sm">{i + 1}</span>
                            <l.icone className="h-5 w-5 text-gray-500" />
                        </div>
                        <p className="mt-2 text-sm font-bold text-gray-900">{l.titulo}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{l.texto}</p>
                    </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
                <b>Para que serve:</b> a nota da comissão comprova quanto você pagou à Lokyva. Entregue ao seu contador todo mês junto com as notas das suas vendas.
            </p>
        </section>
    );
}

function ComoEhTributado({ taxas }) {
    const venda = 100;
    const comissao = (venda * taxas.reservas) / 100;
    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-black text-gray-900">Quem emite cada nota</h2>
            <p className="mt-1 text-sm text-gray-500">
                O dinheiro da venda vai direto para a sua carteira pelo split do pagamento. A Lokyva só fica com a comissão de intermediação, e é só sobre ela que emite nota para você.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs font-bold uppercase text-gray-400">Cliente paga</p>
                    <p className="text-xl font-black text-gray-900">{brl(venda)}</p>
                    <p className="text-xs text-gray-500">Você emite a nota da venda para ele</p>
                </div>
                <ArrowRightIcon className="mx-auto hidden h-5 w-5 text-gray-300 sm:block" />
                <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase text-emerald-700">Vai para a sua carteira</p>
                    <p className="text-xl font-black text-emerald-800">{brl(venda - comissao)}</p>
                    <p className="text-xs text-emerald-700">Direto, sem passar pela Lokyva</p>
                </div>
                <ArrowRightIcon className="mx-auto hidden h-5 w-5 text-gray-300 sm:block" />
                <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-bold uppercase text-[#E8590C]">Comissão Lokyva</p>
                    <p className="text-xl font-black text-[#E8590C]">{brl(comissao)}</p>
                    <p className="text-xs text-[#E8590C]">A Lokyva emite a nota disso para você</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
                Comissão: {pct(taxas.reservas)} em reservas e serviços, {pct(taxas.produtos)} em produtos e {pct(taxas.cobrancas)} em cobranças parceladas.
                Use as notas de comissão como despesa da sua empresa. Mostre ao seu contador.
            </p>
        </section>
    );
}

function ConfiguracaoFiscal({ configuracao, elegivel }) {
    const [aberto, setAberto] = useState(elegivel && !configuracao.configurada);
    const { data: f, setData, post, processing, errors, recentlySuccessful } = useForm({
        nfse_servico_id: configuracao.nfse_servico_id || '',
        nfse_servico_codigo: configuracao.nfse_servico_codigo || '',
        nfse_servico_nome: configuracao.nfse_servico_nome || '',
        nfse_iss: configuracao.nfse_iss ?? 0,
        nfse_retem_iss: configuracao.nfse_retem_iss ?? false,
        nfse_pis: configuracao.nfse_pis ?? 0,
        nfse_cofins: configuracao.nfse_cofins ?? 0,
        nfse_csll: configuracao.nfse_csll ?? 0,
        nfse_ir: configuracao.nfse_ir ?? 0,
        nfse_inss: configuracao.nfse_inss ?? 0,
        nfse_observacoes: configuracao.nfse_observacoes || '',
    });

    const salvar = (e) => {
        e.preventDefault();
        post(route('notas-fiscais.configuracao'), { preserveScroll: true });
    };

    const num = (k, rotulo) => (
        <label className="text-xs font-semibold text-gray-600">{rotulo}
            <input type="number" min="0" max="100" step="0.01" value={f[k]} onChange={(e) => setData(k, e.target.value)} className={campo} />
            {errors[k] && <span className="text-xs text-red-600">{errors[k]}</span>}
        </label>
    );

    return (
        <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
            <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Cog6ToothIcon className="h-5 w-5 text-gray-600" /></span>
                    <div>
                        <h2 className="text-base font-black text-gray-900">Configuração fiscal das suas notas de venda</h2>
                        <p className="text-sm text-gray-500">
                            {configuracao.configurada
                                ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckBadgeIcon className="h-4 w-4" /> Configurada</span>
                                : 'Peça estes dados ao seu contador. Sem eles, a nota de venda não sai.'}
                        </p>
                    </div>
                </div>
                <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <form onSubmit={salvar} className="space-y-5 border-t border-gray-100 p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-6">
                        <label className="text-xs font-semibold text-gray-600 sm:col-span-2">Código do serviço
                            <input value={f.nfse_servico_codigo} onChange={(e) => setData('nfse_servico_codigo', e.target.value)} placeholder="Ex.: 06.01.01" className={campo} />
                            {errors.nfse_servico_codigo && <span className="text-xs text-red-600">{errors.nfse_servico_codigo}</span>}
                        </label>
                        <label className="text-xs font-semibold text-gray-600 sm:col-span-4">Descrição do serviço
                            <input value={f.nfse_servico_nome} onChange={(e) => setData('nfse_servico_nome', e.target.value)} placeholder="Ex.: Barbearia, cabeleireiros, manicuros e congêneres" className={campo} />
                            {errors.nfse_servico_nome && <span className="text-xs text-red-600">{errors.nfse_servico_nome}</span>}
                        </label>
                        <label className="text-xs font-semibold text-gray-600 sm:col-span-3">ID do serviço no Asaas <span className="font-normal text-gray-400">(só para emissão pela prefeitura; no Portal Nacional deixe vazio)</span>
                            <input value={f.nfse_servico_id} onChange={(e) => setData('nfse_servico_id', e.target.value)} className={campo} />
                        </label>
                        <label className="text-xs font-semibold text-gray-600 sm:col-span-2">ISS (%)
                            <input type="number" min="0" max="10" step="0.01" value={f.nfse_iss} onChange={(e) => setData('nfse_iss', e.target.value)} className={campo} />
                            {errors.nfse_iss && <span className="text-xs text-red-600">{errors.nfse_iss}</span>}
                        </label>
                        <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold text-gray-700 sm:col-span-1">
                            <input type="checkbox" checked={f.nfse_retem_iss} onChange={(e) => setData('nfse_retem_iss', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" />
                            Reter ISS
                        </label>
                    </div>

                    <details className="rounded-2xl bg-gray-50 p-4">
                        <summary className="cursor-pointer text-sm font-bold text-gray-700">Retenções federais (normalmente zero no Simples Nacional e no MEI)</summary>
                        <div className="mt-3 grid gap-4 sm:grid-cols-5">
                            {num('nfse_pis', 'PIS (%)')}
                            {num('nfse_cofins', 'COFINS (%)')}
                            {num('nfse_csll', 'CSLL (%)')}
                            {num('nfse_ir', 'IR (%)')}
                            {num('nfse_inss', 'INSS (%)')}
                        </div>
                    </details>

                    <label className="block text-xs font-semibold text-gray-600">Observações na nota <span className="font-normal text-gray-400">(opcional)</span>
                        <textarea rows={2} maxLength={500} value={f.nfse_observacoes} onChange={(e) => setData('nfse_observacoes', e.target.value)} className={campo} />
                    </label>

                    <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                        <p><b>Sua cidade já emite pela NFS-e Nacional?</b> (ex.: Vitória de Santo Antão) Use no código o <b>código de tributação nacional</b> do serviço, no formato do Portal Nacional (ex.: 06.01.01), e deixe o "ID do serviço no Asaas" vazio. Na sua conta Asaas, em <i>Notas fiscais → Configurações</i>, escolha emitir pelo <b>Portal Nacional</b>.</p>
                        <p><b>Também é preciso no Asaas:</b> cadastrar a inscrição municipal, o regime tributário e o acesso de emissão (certificado digital ou a senha do Portal Nacional/da prefeitura). Sem isso a nota não é autorizada.</p>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        {recentlySuccessful && <span className="text-sm font-semibold text-emerald-600">Salvo!</span>}
                        <button type="submit" disabled={processing} className="rounded-xl bg-[#FF5A00] px-5 py-2.5 text-sm font-black text-white hover:bg-[#E8590C] disabled:opacity-60">
                            {processing ? 'Salvando…' : 'Salvar configuração'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}

export default function NotasFiscais({ notas, filtro, elegivel, ehSocio, resumo, configuracao, taxas }) {
    const { auth } = usePage().props;
    const filtrar = (tipo) => router.get(route('notas-fiscais.index'), tipo ? { tipo } : {}, { preserveScroll: true, preserveState: true });

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Notas fiscais" />

            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50"><DocumentTextIcon className="h-6 w-6 text-[#FF5A00]" /></span>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">Notas fiscais</h1>
                    </div>
                    <p className="text-sm text-gray-500">
                        {ehSocio
                            ? 'As notas das suas vendas, as notas da comissão Lokyva e as da sua assinatura, em um só lugar. Cada nota autorizada também vai para o e-mail.'
                            : 'As notas das suas compras e da sua assinatura Lokyva. Cada nota autorizada também vai para o seu e-mail.'}
                    </p>
                </div>

                <ComoFunciona
                    chave="notas_fiscais"
                    titulo="Como funcionam as notas fiscais"
                    passos={ehSocio ? [
                        { titulo: 'Venda online', texto: 'O cliente paga e o valor da venda vai direto para a sua carteira.' },
                        { titulo: 'Nota da comissão', texto: 'A Lokyva emite para você a nota da comissão, que é a despesa da sua empresa com a plataforma.' },
                        { titulo: 'Nota da venda', texto: 'No Sócio Premium, a sua nota para o cliente sai sozinha, com a sua configuração fiscal.' },
                    ] : [
                        { titulo: 'Quando é emitida', texto: 'Depois que o pagamento é confirmado.' },
                        { titulo: 'Onde chega', texto: 'Fica aqui e também vai para o seu e-mail.' },
                        { titulo: 'Confira os dados', texto: 'O CPF ou CNPJ da nota vem do seu cadastro. Mantenha atualizado.' },
                    ]}
                    dicas={[
                        'A nota primeiro fica "Agendada" e muda para "Autorizada" quando a prefeitura aprova.',
                        'Se um pagamento for estornado, as notas dele são canceladas automaticamente.',
                        'Baixe o PDF e o XML de cada nota para enviar ao seu contador.',
                    ]}
                />

                {ehSocio && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Kpi icone={BanknotesIcon} titulo="Vendas com nota no mês" valor={brl(resumo.vendas_mes)} detalhe="Notas que você emitiu para clientes" />
                        <Kpi icone={ReceiptPercentIcon} titulo="Comissões Lokyva no mês" valor={brl(resumo.comissoes_mes)} detalhe={`Sobre ${brl(resumo.vendas_intermediadas_mes)} em vendas online`} />
                        <Kpi icone={ExclamationTriangleIcon} titulo="Precisam de atenção" valor={resumo.pendencias} detalhe={resumo.pendencias ? 'Notas com erro ou falta de configuração' : 'Tudo certo'} destaque={resumo.pendencias > 0} />
                    </div>
                )}

                {ehSocio && <OndeFicam onVerComissoes={() => { filtrar('comissao'); setTimeout(() => document.getElementById('lista-notas')?.scrollIntoView({ behavior: 'smooth' }), 300); }} />}

                {ehSocio && taxas && <ComoEhTributado taxas={taxas} />}

                {ehSocio && !elegivel && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3 text-sm text-gray-800">
                            <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A00]" />
                            <p>A <b>nota da comissão Lokyva</b> já sai para você em toda venda online. A <b>emissão automática das suas notas de venda</b> para os clientes faz parte do plano <b>Sócio Premium</b>. Sem ele, emita as notas de venda pelo seu sistema ou pela prefeitura.</p>
                        </div>
                        <Link href={route('assinatura.status')} className="shrink-0 rounded-xl bg-[#FF5A00] px-4 py-2 text-center text-sm font-black text-white hover:bg-[#E8590C]">Conhecer o Sócio Premium</Link>
                    </div>
                )}

                {ehSocio && configuracao && <ConfiguracaoFiscal configuracao={configuracao} elegivel={elegivel} />}

                <section id="lista-notas" className="scroll-mt-24 rounded-3xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex gap-2 overflow-x-auto border-b border-gray-100 p-3">
                        {ABAS.filter((a) => ehSocio || a.id !== 'comissao').map((a) => (
                            <button key={a.nome} type="button" onClick={() => filtrar(a.id)}
                                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${filtro === a.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {a.nome}
                            </button>
                        ))}
                    </div>

                    {/* Computador: tabela */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left">
                            <thead className="text-xs uppercase tracking-wide text-gray-400">
                                <tr>
                                    <th className="px-5 py-3">Nota</th>
                                    <th className="px-5 py-3 text-right">Valor</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Data</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {notas.data.map((nota) => (
                                    <tr key={nota.id} className="border-t border-gray-100 align-top">
                                        <td className="px-5 py-4"><Descricao nota={nota} /></td>
                                        <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-black text-gray-900">{brl(nota.valor)}</td>
                                        <td className="px-5 py-4"><Status nota={nota} /></td>
                                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{data(nota.emitida_em || nota.created_at)}</td>
                                        <td className="px-5 py-4"><Acoes nota={nota} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Celular: cartões */}
                    <ul className="divide-y divide-gray-100 md:hidden">
                        {notas.data.map((nota) => (
                            <li key={nota.id} className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <Descricao nota={nota} />
                                    <p className="whitespace-nowrap text-sm font-black text-gray-900">{brl(nota.valor)}</p>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2"><Status nota={nota} /><span className="text-xs text-gray-400">{data(nota.emitida_em || nota.created_at)}</span></div>
                                    <Acoes nota={nota} />
                                </div>
                            </li>
                        ))}
                    </ul>

                    {notas.data.length === 0 && (
                        <div className="px-5 py-12 text-center">
                            <DocumentTextIcon className="mx-auto h-10 w-10 text-gray-300" />
                            <p className="mt-2 font-bold text-gray-700">Nenhuma nota por aqui ainda.</p>
                            <p className="text-sm text-gray-500">As notas aparecem assim que um pagamento online é confirmado.</p>
                        </div>
                    )}
                </section>

                {notas.links?.length > 3 && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {notas.links.map((l, i) => (
                            <Link key={i} href={l.url || '#'} preserveScroll preserveState
                                className={`rounded-lg px-3 py-1.5 text-sm ${l.active ? 'bg-[#FF5A00] font-bold text-white' : 'border border-gray-200 bg-white text-gray-600'} ${!l.url ? 'pointer-events-none opacity-40' : ''}`}
                                dangerouslySetInnerHTML={{ __html: l.label }} />
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
