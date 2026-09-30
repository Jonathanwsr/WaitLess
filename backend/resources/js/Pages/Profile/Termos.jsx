import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

function formatarData(data) {
    if (!data) return null;
    return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function Termos({ aceite }) {
    const versaoDesatualizada = aceite.aceito && aceite.versao !== aceite.versao_atual;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-200">
                    Termos e Compromissos
                </h2>
            }
        >
            <Head title="Termos e Compromissos" />

            <div className="py-10">
                <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFF3EC] flex items-center justify-center mb-5">
                            <DocumentTextIcon className="w-6 h-6 text-[#FF5A00]" />
                        </div>

                        <h3 className="text-lg font-black text-gray-900 mb-1">Seu aceite do Termo de Compromisso</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Registro de quando e qual versão do termo você aceitou ao se cadastrar na Lokyva.
                        </p>

                        {aceite.aceito ? (
                            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
                                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Termo aceito</p>
                                    <p className="text-xs text-emerald-700 mt-0.5">
                                        Versão {aceite.versao} · {formatarData(aceite.aceito_em)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 mb-4">
                                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-red-900">Nenhum aceite registrado</p>
                                    <p className="text-xs text-red-700 mt-0.5">
                                        Não encontramos um registro de aceite do Termo de Compromisso na sua conta.
                                    </p>
                                </div>
                            </div>
                        )}

                        {versaoDesatualizada && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-900">Termo atualizado</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        A versão atual do termo ({aceite.versao_atual}) é diferente da que você aceitou
                                        ({aceite.versao}). Vale a pena ler a versão mais recente.
                                    </p>
                                </div>
                            </div>
                        )}

                        <Link
                            href={route('legal.termos')}
                            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white font-bold text-sm px-5 py-3 rounded-2xl transition"
                        >
                            <DocumentTextIcon className="w-4 h-4" />
                            Ler o Termo de Compromisso completo
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-70" />
                        </Link>
                    </div>

                    <Link
                        href={route('profile.edit')}
                        className="inline-block text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                        ← Voltar para o perfil
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
