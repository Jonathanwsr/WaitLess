import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    GiftIcon, PlusIcon, TrashIcon, PlayIcon, PencilIcon, XMarkIcon,
    CheckCircleIcon, PauseCircleIcon,
} from '@heroicons/react/24/solid';

const TIPOS = [
    { value: 'pontos_todos', label: 'Pontos para todos os usuários' },
    { value: 'pontos_plano', label: 'Pontos para assinantes de um plano' },
    { value: 'oferta_assinantes', label: 'Oferta exclusiva para assinantes' },
    { value: 'cupom', label: 'Vinculada a um cupom existente' },
];

const STATUS_ESTILO = {
    ativa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inativa: 'bg-gray-100 text-gray-500 border-gray-200',
    expirada: 'bg-red-50 text-red-700 border-red-200',
    esgotada: 'bg-amber-50 text-amber-700 border-amber-200',
    agendada: 'bg-blue-50 text-blue-700 border-blue-200',
};

function Campo({ label, children }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
            {children}
        </div>
    );
}

const inputClass = "block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00] focus:border-[#FF5A00] transition-colors";

export default function Promocoes({ promocoes, planosValidos }) {
    const { flash = {} } = usePage().props;
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        nome: '', descricao: '', tipo: 'pontos_todos', quantidade_pontos: '',
        publico_alvo: 'todos', plano_necessario: '', data_inicio: new Date().toISOString().slice(0, 10),
        data_fim: '', limite_utilizacao: '', ativo: true, condicoes: '', imagem: null,
    });

    const abrirNova = () => {
        setEditando(null);
        reset();
        setFormAberto(true);
    };

    const abrirEdicao = (promo) => {
        setEditando(promo);
        setData({
            nome: promo.nome || '', descricao: promo.descricao || '', tipo: promo.tipo,
            quantidade_pontos: promo.quantidade_pontos || '', publico_alvo: promo.publico_alvo,
            plano_necessario: promo.plano_necessario || '', data_inicio: promo.data_inicio?.slice(0, 10) || '',
            data_fim: promo.data_fim?.slice(0, 10) || '', limite_utilizacao: promo.limite_utilizacao || '',
            ativo: promo.ativo, condicoes: promo.condicoes || '', imagem: null,
        });
        setFormAberto(true);
    };

    const submeter = (e) => {
        e.preventDefault();
        const url = editando ? route('admin.promocoes.update', editando.id) : route('admin.promocoes.store');
        post(url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { setFormAberto(false); reset(); },
        });
    };

    const executarCampanha = (promo) => {
        if (!window.confirm(`Executar a campanha "${promo.nome}"? Isso concede ${promo.quantidade_pontos} pontos a todos os usuários elegíveis AGORA e não pode ser desfeito nem repetido.`)) return;
        router.post(route('admin.promocoes.executar', promo.id), {}, { preserveScroll: true });
    };

    const toggleAtivo = (promo) => {
        router.patch(route('admin.promocoes.toggle-ativo', promo.id), {}, { preserveScroll: true });
    };

    const excluir = (promo) => {
        if (!window.confirm(`Excluir a promoção "${promo.nome}"? Essa ação não pode ser desfeita.`)) return;
        router.delete(route('admin.promocoes.destroy', promo.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-2">
                        <GiftIcon className="w-7 h-7 text-[#FF5A00]" />
                        Promoções e Campanhas
                    </h2>
                    <button
                        onClick={abrirNova}
                        className="flex items-center gap-2 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
                    >
                        <PlusIcon className="w-4 h-4" /> Nova promoção
                    </button>
                </div>
            }
        >
            <Head title="Admin - Promoções" />

            <div className="py-8">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
                    {flash?.success && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl text-sm font-semibold">
                            {flash.success}
                        </div>
                    )}
                    {flash?.error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-3 rounded-2xl text-sm font-semibold">
                            {flash.error}
                        </div>
                    )}

                    {formAberto && (
                        <form onSubmit={submeter} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">{editando ? 'Editar promoção' : 'Nova promoção'}</h3>
                                <button type="button" onClick={() => setFormAberto(false)} className="text-gray-400 hover:text-gray-600">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <Campo label="Nome">
                                        <input className={inputClass} value={data.nome} onChange={(e) => setData('nome', e.target.value)} maxLength={255} required />
                                    </Campo>
                                    {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
                                </div>

                                <div className="sm:col-span-2">
                                    <Campo label="Descrição">
                                        <textarea className={inputClass} rows={2} maxLength={2000} value={data.descricao} onChange={(e) => setData('descricao', e.target.value)} />
                                    </Campo>
                                </div>

                                <Campo label="Tipo">
                                    <select className={inputClass} value={data.tipo} onChange={(e) => setData('tipo', e.target.value)}>
                                        {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </Campo>

                                <Campo label="Público-alvo">
                                    <select className={inputClass} value={data.publico_alvo} onChange={(e) => setData('publico_alvo', e.target.value)}>
                                        <option value="todos">Todos</option>
                                        <option value="clientes">Só clientes</option>
                                        <option value="proprietarios">Só proprietários</option>
                                    </select>
                                </Campo>

                                {(data.tipo === 'pontos_todos' || data.tipo === 'pontos_plano') && (
                                    <Campo label="Quantidade de pontos">
                                        <input type="number" min={1} className={inputClass} value={data.quantidade_pontos} onChange={(e) => setData('quantidade_pontos', e.target.value)} />
                                    </Campo>
                                )}

                                {(data.tipo === 'pontos_plano' || data.tipo === 'oferta_assinantes') && (
                                    <Campo label="Plano necessário">
                                        <select className={inputClass} value={data.plano_necessario} onChange={(e) => setData('plano_necessario', e.target.value)}>
                                            <option value="">Selecione o plano</option>
                                            {planosValidos.map((p) => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </Campo>
                                )}

                                <Campo label="Data de início">
                                    <input type="date" className={inputClass} value={data.data_inicio} onChange={(e) => setData('data_inicio', e.target.value)} required />
                                </Campo>
                                <Campo label="Data de encerramento (opcional)">
                                    <input type="date" className={inputClass} value={data.data_fim} onChange={(e) => setData('data_fim', e.target.value)} />
                                </Campo>

                                <Campo label="Limite de utilizações (opcional)">
                                    <input type="number" min={1} className={inputClass} value={data.limite_utilizacao} onChange={(e) => setData('limite_utilizacao', e.target.value)} />
                                </Campo>

                                <Campo label="Imagem/banner (opcional)">
                                    <input type="file" accept="image/*" className={inputClass} onChange={(e) => setData('imagem', e.target.files[0])} />
                                </Campo>

                                <div className="sm:col-span-2">
                                    <Campo label="Condições (texto livre)">
                                        <textarea className={inputClass} rows={2} maxLength={2000} value={data.condicoes} onChange={(e) => setData('condicoes', e.target.value)} />
                                    </Campo>
                                </div>

                                <label className="flex items-center gap-2 sm:col-span-2">
                                    <input type="checkbox" checked={data.ativo} onChange={(e) => setData('ativo', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00]" />
                                    <span className="text-sm text-gray-700 font-semibold">Ativa</span>
                                </label>
                            </div>

                            <button type="submit" disabled={processing} className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition disabled:opacity-50">
                                {processing ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar promoção'}
                            </button>
                        </form>
                    )}

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        {promocoes.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <GiftIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p className="text-sm font-semibold">Nenhuma promoção criada ainda.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="text-left px-5 py-3">Nome</th>
                                        <th className="text-left px-5 py-3">Tipo</th>
                                        <th className="text-left px-5 py-3">Status</th>
                                        <th className="text-left px-5 py-3">Vigência</th>
                                        <th className="text-left px-5 py-3">Uso</th>
                                        <th className="text-right px-5 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {promocoes.map((promo) => (
                                        <tr key={promo.id} className="hover:bg-gray-50/50">
                                            <td className="px-5 py-3 font-semibold text-gray-900">{promo.nome}</td>
                                            <td className="px-5 py-3 text-gray-600">{TIPOS.find((t) => t.value === promo.tipo)?.label || promo.tipo}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_ESTILO[promo.status_calculado] || ''}`}>
                                                    {promo.status_calculado}
                                                </span>
                                                {promo.executada_em && (
                                                    <span className="block text-[10px] text-gray-400 mt-1">Executada em {new Date(promo.executada_em).toLocaleDateString('pt-BR')}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-gray-600 text-xs">
                                                {new Date(promo.data_inicio).toLocaleDateString('pt-BR')}
                                                {promo.data_fim ? ` – ${new Date(promo.data_fim).toLocaleDateString('pt-BR')}` : ' (sem fim)'}
                                            </td>
                                            <td className="px-5 py-3 text-gray-600 text-xs">
                                                {promo.utilizacoes_atuais}{promo.limite_utilizacao ? ` / ${promo.limite_utilizacao}` : ''}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {['pontos_todos', 'pontos_plano'].includes(promo.tipo) && !promo.executada_em && (
                                                        <button onClick={() => executarCampanha(promo)} title="Executar campanha" className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                                                            <PlayIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => toggleAtivo(promo)} title={promo.ativo ? 'Desativar' : 'Ativar'} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                        {promo.ativo ? <PauseCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={() => abrirEdicao(promo)} title="Editar" className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => excluir(promo)} title="Excluir" className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
