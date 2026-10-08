import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Link, useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { TrashIcon, ExclamationTriangleIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

/**
 * Apagar a conta só é liberado sem pendências (pagamentos, estornos, agendamentos, reservas, pedidos,
 * cobranças, assinatura e taxas). O servidor confere de novo em ProfileController::destroy.
 */
export default function DeleteUserForm({ className = '', pendencias = [] }) {
    const [confirmando, setConfirmando] = useState(false);
    const [entendi, setEntendi] = useState(false);
    const senhaRef = useRef();

    const { data, setData, delete: destroy, processing, reset, errors, clearErrors } = useForm({ password: '' });

    const bloqueado = pendencias.length > 0;

    const apagar = (e) => {
        e.preventDefault();
        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => fechar(),
            onError: () => senhaRef.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const fechar = () => {
        setConfirmando(false);
        setEntendi(false);
        clearErrors();
        reset();
    };

    return (
        <section className={className}>
            <header className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <TrashIcon className="w-5 h-5" />
                </span>
                <div>
                    <h2 className="text-lg font-black text-gray-900">Apagar conta</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                        Ao apagar sua conta, seus dados, pontos, histórico e favoritos são removidos para sempre. Baixe antes os comprovantes que quiser guardar.
                    </p>
                </div>
            </header>

            {bloqueado ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="font-bold text-amber-900 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5" /> Resolva estas pendências antes de apagar a conta
                    </p>
                    <p className="text-sm text-amber-800 mt-1">Assim ninguém fica sem receber, sem reembolso ou com um atendimento marcado.</p>
                    <ul className="mt-4 space-y-2">
                        {pendencias.map((p) => (
                            <li key={p.chave} className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-bold text-gray-900 text-sm">
                                        {p.titulo} {p.quantidade > 1 && <span className="text-gray-500 font-semibold">({p.quantidade})</span>}
                                    </p>
                                    {p.rota && (
                                        <Link href={p.rota} className="text-xs font-bold text-[#FF5A00] hover:underline inline-flex items-center gap-1 shrink-0">
                                            Resolver <ArrowRightIcon className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5">{p.como_resolver}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="mt-6 flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircleIcon className="w-5 h-5" /> Nenhuma pendência. Sua conta pode ser apagada.
                </div>
            )}

            <button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={bloqueado}
                className="mt-5 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
                Apagar minha conta
            </button>

            <Modal show={confirmando} onClose={fechar}>
                <form onSubmit={apagar} className="p-6 space-y-5">
                    <div className="flex items-start gap-3">
                        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <ExclamationTriangleIcon className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Tem certeza que quer apagar sua conta?</h2>
                            <p className="mt-1 text-sm text-gray-600">Isso não pode ser desfeito. Digite sua senha para confirmar.</p>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="senha_exclusao" className="block text-sm font-bold text-gray-700 mb-1.5">Senha</label>
                        <input
                            id="senha_exclusao"
                            type="password"
                            ref={senhaRef}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            autoComplete="current-password"
                            autoFocus
                            className="w-full rounded-xl border-gray-200 text-sm focus:border-red-500 focus:ring-red-500"
                        />
                        <InputError message={errors.password} className="mt-1.5" />
                    </div>

                    <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} className="mt-0.5 rounded text-red-600 focus:ring-red-500" />
                        Entendo que meus dados, pontos e histórico serão apagados para sempre.
                    </label>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={fechar} className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold">
                            Cancelar
                        </button>
                        <button type="submit" disabled={processing || !entendi || !data.password} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-40">
                            {processing ? 'Apagando...' : 'Apagar conta'}
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
