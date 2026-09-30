import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ChartBarIcon, BanknotesIcon, ArrowUpTrayIcon, ArrowUturnLeftIcon,
    UsersIcon, CpuChipIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/solid';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');

const ABAS = [
    { id: 'geral', label: 'Visão Geral', icon: ChartBarIcon },
    { id: 'repasses', label: 'Repasses', icon: ArrowUpTrayIcon },
    { id: 'estornos', label: 'Estornos', icon: ArrowUturnLeftIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'custos', label: 'Custos operacionais', icon: CpuChipIcon },
];

function CardMetrica({ titulo, valor, cor = 'text-gray-900', destaque = false }) {
    return (
        <div className={`bg-white rounded-2xl border p-5 shadow-sm ${destaque ? 'border-[#FF5A00]/30 ring-1 ring-[#FF5A00]/10' : 'border-gray-100'}`}>
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">{titulo}</p>
            <p className={`text-2xl font-black ${cor}`}>{valor}</p>
        </div>
    );
}

function ModalCusto({ custo, categorias, onClose }) {
    const editando = !!custo;
    const [form, setForm] = useState({
        categoria: custo?.categoria || Object.keys(categorias)[0],
        descricao: custo?.descricao || '',
        valor: custo?.valor || '',
        competencia: custo?.competencia ? String(custo.competencia).slice(0, 7) : new Date().toISOString().slice(0, 7),
        recorrente: custo?.recorrente || false,
    });
    const [enviando, setEnviando] = useState(false);
    const [erros, setErros] = useState({});

    const submeter = (e) => {
        e.preventDefault();
        setEnviando(true);
        const payload = { ...form, competencia: `${form.competencia}-01` };
        const acao = editando
            ? router.put(route('admin.relatorios.custos.update', custo.id), payload, {
                preserveScroll: true, onError: setErros, onFinish: () => setEnviando(false), onSuccess: onClose,
            })
            : router.post(route('admin.relatorios.custos.store'), payload, {
                preserveScroll: true, onError: setErros, onFinish: () => setEnviando(false), onSuccess: onClose,
            });
        return acao;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <form onSubmit={submeter} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <h3 className="font-black text-gray-900 mb-5">{editando ? 'Editar custo' : 'Novo custo operacional'}</h3>

                <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                <select
                    value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className="block w-full mt-1 mb-4 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                >
                    {Object.entries(categorias).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>

                <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                <input
                    type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex: OpenAI API, SendGrid, AWS S3..."
                    className="block w-full mt-1 mb-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                    required
                />
                {erros.descricao && <p className="text-xs text-red-600 mb-2">{erros.descricao}</p>}

                <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Valor (R$)</label>
                        <input
                            type="number" step="0.01" min="0.01" value={form.valor}
                            onChange={(e) => setForm({ ...form, valor: e.target.value })}
                            className="block w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Competência</label>
                        <input
                            type="month" value={form.competencia}
                            onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                            className="block w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                            required
                        />
                    </div>
                </div>

                <label className="flex items-center gap-2 mt-4 mb-5 text-sm text-gray-600">
                    <input
                        type="checkbox" checked={form.recorrente}
                        onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
                        className="rounded text-[#FF5A00] focus:ring-[#FF5A00]"
                    />
                    Gasto recorrente (mensal)
                </label>

                <button
                    type="submit" disabled={enviando}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                    {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Lançar custo'}
                </button>
            </form>
        </div>
    );
}

export default function Relatorios({ mes, resumo, evolucaoMensal, repasses, estornos, clientes, custos, custosPorCategoria, categoriasCusto }) {
    const { flash = {} } = usePage().props;
    const [aba, setAba] = useState('geral');
    const [mesFiltro, setMesFiltro] = useState(mes || '');
    const [modalCusto, setModalCusto] = useState(false);
    const [custoEditando, setCustoEditando] = useState(null);

    const aplicarFiltro = () => {
        router.get(route('admin.relatorios.index'), mesFiltro ? { mes: mesFiltro } : {}, { preserveState: true });
    };

    const apagarCusto = (custo) => {
        if (!window.confirm(`Remover o custo "${custo.descricao}" (${fmt(custo.valor)})?`)) return;
        router.delete(route('admin.relatorios.custos.destroy', custo.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-2">
                    <ChartBarIcon className="w-7 h-7 text-[#FF5A00]" />
                    Relatórios da Plataforma
                </h2>
            }
        >
            <Head title="Admin - Relatórios" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
                    {flash?.success && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl text-sm font-semibold">
                            {flash.success}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm">
                            {ABAS.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setAba(id)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition ${aba === id ? 'bg-[#FF5A00] text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <Icon className="w-4 h-4" /> {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                            />
                            <button onClick={aplicarFiltro} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800">
                                Filtrar
                            </button>
                            {mes && (
                                <button onClick={() => { setMesFiltro(''); router.get(route('admin.relatorios.index')); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">
                                    Limpar
                                </button>
                            )}
                        </div>
                    </div>

                    {aba === 'geral' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <CardMetrica titulo="Volume transacionado" valor={fmt(resumo.volume_total_transacionado)} />
                                <CardMetrica titulo="Receita da plataforma" valor={fmt(resumo.receita_plataforma)} cor="text-emerald-600" destaque />
                                <CardMetrica titulo="Repassado a donos" valor={fmt(resumo.valor_repassado_proprietarios)} />
                                <CardMetrica titulo="Saiu em estornos" valor={fmt(resumo.total_estornado)} cor="text-red-600" />
                                <CardMetrica titulo="Custos operacionais" valor={fmt(resumo.total_custos_operacionais)} cor="text-red-600" />
                                <CardMetrica titulo="Lucro líquido real" valor={fmt(resumo.lucro_liquido_real)} cor={resumo.lucro_liquido_real >= 0 ? 'text-emerald-600' : 'text-red-600'} destaque />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CardMetrica titulo="Volume em serviços" valor={fmt(resumo.volume_servicos)} />
                                <CardMetrica titulo="Volume em aluguéis" valor={fmt(resumo.volume_alugueis)} />
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Evolução mensal (últimos 6 meses)</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="text-left px-5 py-3">Mês</th>
                                                <th className="text-right px-5 py-3">Volume</th>
                                                <th className="text-right px-5 py-3">Receita</th>
                                                <th className="text-right px-5 py-3">Repassado</th>
                                                <th className="text-right px-5 py-3">Estornado</th>
                                                <th className="text-right px-5 py-3">Custos</th>
                                                <th className="text-right px-5 py-3">Lucro</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {evolucaoMensal.map((m) => (
                                                <tr key={m.mes} className="hover:bg-gray-50/50">
                                                    <td className="px-5 py-3 font-semibold text-gray-900">{m.label}</td>
                                                    <td className="px-5 py-3 text-right text-gray-600">{fmt(m.volume)}</td>
                                                    <td className="px-5 py-3 text-right text-emerald-700 font-semibold">{fmt(m.receita_plataforma)}</td>
                                                    <td className="px-5 py-3 text-right text-gray-600">{fmt(m.repassado)}</td>
                                                    <td className="px-5 py-3 text-right text-red-600">{fmt(m.estornado)}</td>
                                                    <td className="px-5 py-3 text-right text-red-600">{fmt(m.custos)}</td>
                                                    <td className={`px-5 py-3 text-right font-bold ${m.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(m.lucro)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {aba === 'repasses' && (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Repasses por proprietário</div>
                            {repasses.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <ArrowUpTrayIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-semibold">Nenhum repasse registrado ainda.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="text-left px-5 py-3">Proprietário</th>
                                                <th className="text-right px-5 py-3">Qtd. repasses</th>
                                                <th className="text-right px-5 py-3">Total repassado</th>
                                                <th className="text-right px-5 py-3">Último repasse</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {repasses.map((r) => (
                                                <tr key={r.usuario_id} className="hover:bg-gray-50/50">
                                                    <td className="px-5 py-3">
                                                        <p className="font-semibold text-gray-900">{r.proprietario_nome}</p>
                                                        <p className="text-xs text-gray-400">{r.proprietario_email}</p>
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-gray-600">{r.total_repasses}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(r.total_repassado)}</td>
                                                    <td className="px-5 py-3 text-right text-gray-500">{fmtData(r.ultimo_repasse)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {aba === 'estornos' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {estornos.por_status.length === 0 && (
                                    <p className="text-sm text-gray-400 col-span-full">Nenhum estorno registrado ainda.</p>
                                )}
                                {estornos.por_status.map((s) => (
                                    <CardMetrica key={s.status} titulo={s.status} valor={`${s.total} · ${fmt(s.valor)}`} />
                                ))}
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Estornos concluídos recentes</div>
                                {estornos.recentes.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400">
                                        <ArrowUturnLeftIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="text-sm font-semibold">Nenhum estorno concluído ainda.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                                <tr>
                                                    <th className="text-left px-5 py-3">Código</th>
                                                    <th className="text-left px-5 py-3">Cliente</th>
                                                    <th className="text-left px-5 py-3">Prestador</th>
                                                    <th className="text-left px-5 py-3">Motivo</th>
                                                    <th className="text-right px-5 py-3">Valor</th>
                                                    <th className="text-right px-5 py-3">Data</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {estornos.recentes.map((e) => (
                                                    <tr key={e.id} className="hover:bg-gray-50/50">
                                                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{e.codigo_estorno}</td>
                                                        <td className="px-5 py-3 text-gray-900">{e.cliente_nome}</td>
                                                        <td className="px-5 py-3 text-gray-600">{e.prestador_nome}</td>
                                                        <td className="px-5 py-3 text-gray-500">{e.motivo}</td>
                                                        <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(e.valor_estornado)}</td>
                                                        <td className="px-5 py-3 text-right text-gray-500">{fmtData(e.data_estorno)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {aba === 'clientes' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <CardMetrica titulo="Total de clientes" valor={clientes.total_clientes} />
                                <CardMetrica titulo="Clientes premium" valor={clientes.clientes_premium} cor="text-emerald-600" />
                                <CardMetrica titulo="Pontos distribuídos" valor={clientes.pontos_distribuidos.toLocaleString('pt-BR')} />
                                <CardMetrica titulo="Pontos gastos" valor={clientes.pontos_gastos.toLocaleString('pt-BR')} />
                                <CardMetrica titulo="Saldo de pontos em aberto" valor={clientes.saldo_pontos_em_aberto.toLocaleString('pt-BR')} />
                                <CardMetrica titulo="Descontado em pontos" valor={fmt(clientes.valor_descontado_em_pontos)} />
                                <CardMetrica titulo="Descontado em cupons" valor={fmt(clientes.valor_descontado_em_cupons)} />
                                <CardMetrica titulo="Cupons resgatados" valor={clientes.cupons_usados} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Clientes por plano ativo</div>
                                    {clientes.por_plano.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-10">Nenhum plano ativo no momento.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <tbody className="divide-y divide-gray-100">
                                                {clientes.por_plano.map((p) => (
                                                    <tr key={p.plano_assinatura}>
                                                        <td className="px-5 py-3 text-gray-900 font-semibold">{p.plano_assinatura}</td>
                                                        <td className="px-5 py-3 text-right text-gray-600">{p.total}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Promoções</div>
                                    {clientes.promocoes.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-10">Nenhuma promoção cadastrada.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                                    <tr>
                                                        <th className="text-left px-5 py-3">Nome</th>
                                                        <th className="text-right px-5 py-3">Usos</th>
                                                        <th className="text-right px-5 py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {clientes.promocoes.map((p) => (
                                                        <tr key={p.id}>
                                                            <td className="px-5 py-3 text-gray-900">{p.nome}</td>
                                                            <td className="px-5 py-3 text-right text-gray-600">{p.utilizacoes_atuais}{p.limite_utilizacao ? `/${p.limite_utilizacao}` : ''}</td>
                                                            <td className="px-5 py-3 text-right">
                                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${p.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {p.ativo ? 'Ativa' : 'Inativa'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {aba === 'custos' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-3">
                                    {custosPorCategoria.map((c) => (
                                        <div key={c.categoria} className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">{categoriasCusto[c.categoria] || c.categoria}</p>
                                            <p className="text-sm font-black text-gray-900">{fmt(c.total)}</p>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => { setCustoEditando(null); setModalCusto(true); }}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF5A00] hover:bg-orange-600 text-white rounded-xl text-sm font-bold"
                                >
                                    <PlusIcon className="w-4 h-4" /> Novo custo
                                </button>
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                {custos.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400">
                                        <CpuChipIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="text-sm font-semibold">Nenhum custo operacional lançado{mes ? ' neste mês' : ''}.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                                <tr>
                                                    <th className="text-left px-5 py-3">Descrição</th>
                                                    <th className="text-left px-5 py-3">Categoria</th>
                                                    <th className="text-left px-5 py-3">Competência</th>
                                                    <th className="text-right px-5 py-3">Valor</th>
                                                    <th className="text-right px-5 py-3">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {custos.map((c) => (
                                                    <tr key={c.id} className="hover:bg-gray-50/50">
                                                        <td className="px-5 py-3">
                                                            <p className="font-semibold text-gray-900">{c.descricao}</p>
                                                            {c.recorrente && <span className="text-[10px] font-bold text-[#FF5A00]">Recorrente</span>}
                                                        </td>
                                                        <td className="px-5 py-3 text-gray-600">{categoriasCusto[c.categoria] || c.categoria}</td>
                                                        <td className="px-5 py-3 text-gray-500">{new Date(c.competencia).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</td>
                                                        <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(c.valor)}</td>
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button onClick={() => { setCustoEditando(c); setModalCusto(true); }} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                                    <PencilSquareIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => apagarCusto(c)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modalCusto && (
                <ModalCusto custo={custoEditando} categorias={categoriasCusto} onClose={() => setModalCusto(false)} />
            )}
        </AuthenticatedLayout>
    );
}
