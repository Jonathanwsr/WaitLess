import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { DocumentTextIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const BADGES = {
    AGENDADA: 'bg-blue-50 text-blue-700',
    SINCRONIZADA: 'bg-blue-50 text-blue-700',
    AUTORIZADA: 'bg-green-50 text-green-700',
    CANCELADA: 'bg-gray-100 text-gray-600',
    ERRO: 'bg-red-50 text-red-700',
    NAO_CONFIGURADO: 'bg-amber-50 text-amber-700',
};

const LABELS = {
    AGENDADA: 'Agendada',
    SINCRONIZADA: 'Sincronizada',
    AUTORIZADA: 'Autorizada',
    CANCELADA: 'Cancelada',
    ERRO: 'Erro',
    NAO_CONFIGURADO: 'Conta não configurada',
};

function LinhaNota({ nota }) {
    const { post, processing } = useForm();

    const tentarNovamente = () => {
        post(route('notas-fiscais.tentar-novamente', nota.id), { preserveScroll: true });
    };

    return (
        <tr className="border-t border-gray-100">
            <td className="px-4 py-3 text-sm text-gray-500">#{nota.id}</td>
            <td className="px-4 py-3 text-sm text-gray-700">
                {nota.descricao_servico}
                <span className="block text-xs text-gray-400 mt-0.5">
                    {nota.tipo === 'assinatura' ? 'Assinatura Lokyva' : 'Venda / serviço'}
                </span>
            </td>
            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-800">
                R$ {Number(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${BADGES[nota.status] || 'bg-gray-100 text-gray-600'}`}>
                    {LABELS[nota.status] || nota.status}
                </span>
                {nota.mensagem_erro && (
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">{nota.mensagem_erro}</p>
                )}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(nota.created_at).toLocaleDateString('pt-BR')}
            </td>
            <td className="px-4 py-3 text-right">
                {nota.pdf_url && (
                    <a href={nota.pdf_url} target="_blank" rel="noreferrer" className="text-[#FF5A00] font-semibold text-sm mr-3">
                        Ver PDF
                    </a>
                )}
                {(nota.status === 'ERRO' || nota.status === 'NAO_CONFIGURADO') && (
                    <button
                        onClick={tentarNovamente}
                        disabled={processing}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-[#FF5A00] disabled:opacity-50"
                    >
                        <ArrowPathIcon className="w-4 h-4" /> Tentar novamente
                    </button>
                )}
            </td>
        </tr>
    );
}

export default function NotasFiscais({ notas, elegivel }) {
    const { auth } = usePage().props;
    const papel = String(auth.user?.papel || '').toLowerCase();
    const ehGestorDeLocal = ['socio', 'gerente', 'proprietario'].includes(papel);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Notas Fiscais" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center gap-3 mb-1">
                    <DocumentTextIcon className="w-7 h-7 text-[#FF5A00]" />
                    <h1 className="text-2xl font-bold text-gray-800">Notas Fiscais</h1>
                </div>
                <p className="text-gray-500 mb-6">
                    Aqui ficam as notas fiscais das suas compras e da sua assinatura Lokyva — enviadas também para o seu e-mail quando emitidas.
                </p>

                {!elegivel && ehGestorDeLocal && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                            A emissão automática de notas fiscais para as <strong>suas vendas</strong> é exclusiva do plano <strong>Sócio Premium</strong>.
                            Assine ou faça o upgrade do seu plano para ativar este benefício.
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Descrição</th>
                                <th className="px-4 py-3 text-right">Valor</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Data</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {notas.data.map((nota) => <LinhaNota key={nota.id} nota={nota} />)}
                            {notas.data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                                        Nenhuma nota fiscal emitida ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {notas.links?.length > 3 && (
                    <div className="flex flex-wrap gap-1 justify-center mt-4">
                        {notas.links.map((l, i) => (
                            <Link
                                key={i}
                                href={l.url || '#'}
                                preserveScroll
                                preserveState
                                className={`px-3 py-1.5 rounded-lg text-sm ${l.active ? 'bg-[#FF5A00] text-white font-bold' : 'bg-white text-gray-600 border border-gray-200'} ${!l.url ? 'opacity-40 pointer-events-none' : ''}`}
                                dangerouslySetInnerHTML={{ __html: l.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
