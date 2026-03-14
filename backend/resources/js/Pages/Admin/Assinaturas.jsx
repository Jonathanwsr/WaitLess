import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ShieldCheckIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';

export default function AssinaturasAdmin({ auth, assinaturas }) {
    const { flash = {}, errors } = usePage().props;
    
   
    const [processingId, setProcessingId] = useState(null);

    const cancelarAssinatura = (id, nomeUser) => {
        if (window.confirm(`ATENÇÃO: Deseja realmente CANCELAR a assinatura de ${nomeUser}? A cobrança no cartão será interrompida imediatamente.`)) {
            setProcessingId(id);
            
            router.post(route('admin.assinaturas.cancelar', id), {}, {
                preserveScroll: true,
                onFinish: () => setProcessingId(null), 
            });
        }
    };

    // Pega o primeiro erro de validação (se houver algum do Laravel)
    const erroValidacao = Object.keys(errors).length > 0 ? Object.values(errors)[0] : null;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ShieldCheckIcon className="w-7 h-7 text-indigo-600" />
                    Painel Admin: Gestão de Assinaturas
                </h2>
            }
        >
            <Head title="Admin - Assinaturas" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20">
                
                {/* MENSAGEM DE SUCESSO */}
                {flash?.success && (
                    <div className="mb-6 p-4 bg-green-100 text-green-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ✅ {flash.success}
                    </div>
                )}
                
                {/* MENSAGEM DE ERRO (Junta os erros de Flash com os Erros do Laravel) */}
                {(flash?.error || erroValidacao) && (
                    <div className="mb-6 p-4 bg-red-100 text-red-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ❌ {flash?.error || erroValidacao}
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Todas as Assinaturas</h3>
                            <p className="text-sm text-gray-500">Acompanhe e gira as assinaturas de clientes e lojistas.</p>
                        </div>
                        <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm">
                            Total: {assinaturas.total}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="py-4 px-6 font-bold">Usuário</th>
                                    <th className="py-4 px-6 font-bold">Plano</th>
                                    <th className="py-4 px-6 font-bold text-center">Valor</th>
                                    <th className="py-4 px-6 font-bold text-center">Status</th>
                                    <th className="py-4 px-6 font-bold text-center">Vencimento</th>
                                    <th className="py-4 px-6 font-bold text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {assinaturas.data.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-gray-400">
                                            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            Nenhuma assinatura encontrada no sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    assinaturas.data.map((ass) => {
                                        const isAtiva = ass.status === 'ativa';
                                        const isProcessingThis = processingId === ass.id;

                                        return (
                                            <tr key={ass.id} className="hover:bg-gray-50/50 transition">
                                                <td className="py-4 px-6">
                                                    <p className="font-bold text-gray-900">{ass.user ? ass.user.name : 'Usuário Deletado'}</p>
                                                    <p className="text-xs text-gray-500">{ass.user?.email}</p>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                        {ass.nome_plano}
                                                    </span>
                                                    <p className="text-[10px] text-gray-400 mt-1 uppercase">{ass.tipo_publico}</p>
                                                </td>
                                                <td className="py-4 px-6 text-center font-bold text-gray-700">
                                                    R$ {Number(ass.valor_mensal).toFixed(2).replace('.', ',')}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {isAtiva ? (
                                                        <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">Ativa</span>
                                                    ) : ass.status === 'pendente' ? (
                                                        <span className="bg-yellow-100 text-yellow-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">Pendente</span>
                                                    ) : (
                                                        <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">Cancelada</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center text-gray-500">
                                                    {ass.data_vencimento ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    {isAtiva && (
                                                        <button 
                                                            onClick={() => cancelarAssinatura(ass.id, ass.user?.name)}
                                                            disabled={isProcessingThis}
                                                            className={`inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded-lg transition ${isProcessingThis ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white'}`}
                                                            title="Cancelar Assinatura"
                                                        >
                                                            {isProcessingThis ? (
                                                                <>
                                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                    Aguarde...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TrashIcon className="w-4 h-4" /> Cancelar
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação do Admin */}
                    {assinaturas.last_page > 1 && (
                        <div className="p-6 border-t border-gray-100 flex justify-center gap-2 bg-gray-50">
                            {assinaturas.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url || '#'}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${link.active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}