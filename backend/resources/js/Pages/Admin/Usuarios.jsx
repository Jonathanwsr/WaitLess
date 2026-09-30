import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    UsersIcon, MagnifyingGlassIcon, SparklesIcon, XMarkIcon,
    CheckBadgeIcon, NoSymbolIcon, PencilSquareIcon, TrashIcon,
} from '@heroicons/react/24/solid';

const PAPEIS_EDITAVEIS = ['user', 'socio', 'proprietario', 'gerente', 'funcionario', 'atendente', 'admin'];

const PAPEL_LABEL = {
    admin: 'Administrador',
    socio: 'Proprietário',
    proprietario: 'Proprietário',
    gerente: 'Gerente',
    funcionario: 'Funcionário',
    atendente: 'Funcionário',
    user: 'Cliente',
};

const CHAVE_CATALOGO_POR_PAPEL = (papel) => (['socio', 'proprietario', 'gerente'].includes(papel) ? 'socio' : 'user');

function statusPlano(usuario) {
    const temPlano = usuario.plano_assinatura && usuario.plano_assinatura !== 'gratuito';
    const cancelado = usuario.asaas_subscription_status === 'CANCELLED';
    const expirado = usuario.plano_expira_em && new Date(usuario.plano_expira_em) < new Date();

    if (!temPlano) return { label: 'Gratuito', estilo: 'bg-gray-100 text-gray-500' };
    if (cancelado || expirado) return { label: `${usuario.plano_assinatura} (expirado)`, estilo: 'bg-red-50 text-red-600' };
    return { label: usuario.plano_assinatura, estilo: 'bg-emerald-50 text-emerald-700' };
}

function ModalLiberarPlano({ usuario, catalogoPlanos, onClose }) {
    const [plano, setPlano] = useState('');
    const [dias, setDias] = useState(30);
    const [enviando, setEnviando] = useState(false);

    const chave = CHAVE_CATALOGO_POR_PAPEL(usuario.papel);
    const planosDisponiveis = Object.entries(catalogoPlanos[chave] || {});

    const submeter = (e) => {
        e.preventDefault();
        if (!plano) return;
        setEnviando(true);
        router.post(route('admin.usuarios.liberar-plano', usuario.id), { plano, dias }, {
            preserveScroll: true,
            onFinish: () => { setEnviando(false); onClose(); },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <form onSubmit={submeter} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 mb-1">
                    <SparklesIcon className="w-5 h-5 text-[#FF5A00]" />
                    <h3 className="font-black text-gray-900">Liberar plano cortesia</h3>
                </div>
                <p className="text-sm text-gray-500 mb-5">Para <strong>{usuario.name}</strong> — não gera cobrança na Asaas.</p>

                <label className="text-xs font-bold text-gray-500 uppercase">Plano</label>
                <select
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    className="block w-full mt-1 mb-4 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                    required
                >
                    <option value="" disabled>Selecione o plano</option>
                    {planosDisponiveis.map(([id, info]) => (
                        <option key={id} value={id}>{id} — R$ {info.valor.toFixed(2)}/{info.ciclo}</option>
                    ))}
                </select>

                <label className="text-xs font-bold text-gray-500 uppercase">Duração (dias)</label>
                <input
                    type="number" min={1} max={365} value={dias}
                    onChange={(e) => setDias(e.target.value)}
                    className="block w-full mt-1 mb-5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                    required
                />

                <button
                    type="submit" disabled={enviando || !plano}
                    className="w-full bg-[#FF5A00] hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                    {enviando ? 'Liberando...' : 'Liberar plano'}
                </button>
            </form>
        </div>
    );
}

function ModalEditarUsuario({ usuario, onClose }) {
    const [form, setForm] = useState({
        name: usuario.name || '',
        email: usuario.email || '',
        telefone: usuario.telefone || '',
        papel: usuario.papel || 'user',
    });
    const [enviando, setEnviando] = useState(false);
    const [erros, setErros] = useState({});

    const submeter = (e) => {
        e.preventDefault();
        setEnviando(true);
        router.put(route('admin.usuarios.update', usuario.id), form, {
            preserveScroll: true,
            onError: (err) => setErros(err),
            onFinish: () => setEnviando(false),
            onSuccess: () => onClose(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <form onSubmit={submeter} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 mb-5">
                    <PencilSquareIcon className="w-5 h-5 text-[#FF5A00]" />
                    <h3 className="font-black text-gray-900">Editar usuário</h3>
                </div>

                <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
                <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="block w-full mt-1 mb-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                    required
                />
                {erros.name && <p className="text-xs text-red-600 mb-2">{erros.name}</p>}

                <label className="text-xs font-bold text-gray-500 uppercase">E-mail</label>
                <input
                    type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="block w-full mt-1 mb-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                    required
                />
                {erros.email && <p className="text-xs text-red-600 mb-2">{erros.email}</p>}

                <label className="text-xs font-bold text-gray-500 uppercase">Telefone</label>
                <input
                    type="text" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="block w-full mt-1 mb-4 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                />

                <label className="text-xs font-bold text-gray-500 uppercase">Papel</label>
                <select
                    value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}
                    className="block w-full mt-1 mb-5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00]"
                >
                    {PAPEIS_EDITAVEIS.map((p) => (
                        <option key={p} value={p}>{PAPEL_LABEL[p] || p}</option>
                    ))}
                </select>

                <button
                    type="submit" disabled={enviando}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                    {enviando ? 'Salvando...' : 'Salvar alterações'}
                </button>
            </form>
        </div>
    );
}

export default function Usuarios({ usuarios, busca, catalogoPlanos }) {
    const { flash = {} } = usePage().props;
    const [termoBusca, setTermoBusca] = useState(busca || '');
    const [modalUsuario, setModalUsuario] = useState(null);
    const [usuarioEditando, setUsuarioEditando] = useState(null);

    const pesquisar = (e) => {
        e.preventDefault();
        router.get(route('admin.usuarios.index'), { busca: termoBusca }, { preserveState: true });
    };

    const revogar = (usuario) => {
        if (!window.confirm(`Revogar o plano de ${usuario.name}? O acesso premium dela(e) é encerrado imediatamente.`)) return;
        router.post(route('admin.usuarios.revogar-plano', usuario.id), {}, { preserveScroll: true });
    };

    const apagar = (usuario) => {
        if (!window.confirm(`Apagar definitivamente ${usuario.name} (${usuario.email})? Esta ação não pode ser desfeita.`)) return;
        router.delete(route('admin.usuarios.destroy', usuario.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-2">
                    <UsersIcon className="w-7 h-7 text-[#FF5A00]" />
                    Usuários
                </h2>
            }
        >
            <Head title="Admin - Usuários" />

            <div className="py-8">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
                    {flash?.success && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl text-sm font-semibold">
                            {flash.success}
                        </div>
                    )}

                    <form onSubmit={pesquisar} className="relative">
                        <MagnifyingGlassIcon className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            placeholder="Buscar por nome ou e-mail..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-1 focus:ring-[#FF5A00] shadow-sm"
                        />
                    </form>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        {usuarios.data.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p className="text-sm font-semibold">Nenhum usuário encontrado.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="text-left px-5 py-3">Usuário</th>
                                        <th className="text-left px-5 py-3">Papel</th>
                                        <th className="text-left px-5 py-3">Plano</th>
                                        <th className="text-left px-5 py-3">Pontos</th>
                                        <th className="text-right px-5 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {usuarios.data.map((usuario) => {
                                        const status = statusPlano(usuario);
                                        const temPlanoAtivo = usuario.plano_assinatura && usuario.plano_assinatura !== 'gratuito' && usuario.asaas_subscription_status !== 'CANCELLED';
                                        return (
                                            <tr key={usuario.id} className="hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                                                            {usuario.foto_perfil ? (
                                                                <img src={usuario.foto_perfil} alt={usuario.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-sm font-bold text-gray-500">{usuario.name?.charAt(0)?.toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">{usuario.name}</p>
                                                            <p className="text-xs text-gray-400">{usuario.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">{PAPEL_LABEL[usuario.papel] || usuario.papel}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${status.estilo}`}>{status.label}</span>
                                                    {usuario.plano_expira_em && temPlanoAtivo && (
                                                        <span className="block text-[10px] text-gray-400 mt-1">até {new Date(usuario.plano_expira_em).toLocaleDateString('pt-BR')}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">{usuario.pontos_saldo ?? 0}</td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setModalUsuario(usuario)}
                                                            title="Liberar plano"
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF3EC] text-[#FF5A00] hover:bg-orange-100 text-xs font-bold"
                                                        >
                                                            <CheckBadgeIcon className="w-4 h-4" /> Liberar plano
                                                        </button>
                                                        {temPlanoAtivo && (
                                                            <button
                                                                onClick={() => revogar(usuario)}
                                                                title="Revogar plano"
                                                                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                                            >
                                                                <NoSymbolIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setUsuarioEditando(usuario)}
                                                            title="Editar usuário"
                                                            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        >
                                                            <PencilSquareIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => apagar(usuario)}
                                                            title="Apagar usuário"
                                                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {usuarios.last_page > 1 && (
                            <div className="p-5 border-t border-gray-100 flex justify-center gap-2 bg-gray-50">
                                {usuarios.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || '#'}
                                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${link.active ? 'bg-[#FF5A00] text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {modalUsuario && (
                <ModalLiberarPlano usuario={modalUsuario} catalogoPlanos={catalogoPlanos} onClose={() => setModalUsuario(null)} />
            )}

            {usuarioEditando && (
                <ModalEditarUsuario usuario={usuarioEditando} onClose={() => setUsuarioEditando(null)} />
            )}
        </AuthenticatedLayout>
    );
}
