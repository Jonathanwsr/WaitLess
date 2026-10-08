import InputError from '@/Components/InputError';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { LockClosedIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

/** Mesmas regras do servidor (PasswordController): 8+ caracteres, letras e números, diferente da atual. */
const REGRAS = [
    { id: 'tamanho', rotulo: 'Pelo menos 8 caracteres', testa: (s) => s.length >= 8 },
    { id: 'letra', rotulo: 'Uma letra', testa: (s) => /[A-Za-zÀ-ÿ]/.test(s) },
    { id: 'numero', rotulo: 'Um número', testa: (s) => /\d/.test(s) },
    { id: 'forte', rotulo: 'Maiúscula, minúscula ou símbolo (deixa mais forte)', testa: (s) => /[A-Z]/.test(s) && /[a-z]/.test(s) || /[^A-Za-z0-9]/.test(s) },
];

function CampoSenha({ id, rotulo, valor, onChange, erro, entradaRef, autoComplete }) {
    const [visivel, setVisivel] = useState(false);
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-bold text-gray-700 mb-1.5">{rotulo}</label>
            <div className="relative">
                <input
                    id={id}
                    ref={entradaRef}
                    type={visivel ? 'text' : 'password'}
                    value={valor}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    className={`w-full rounded-xl pr-11 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] ${erro ? 'border-red-300' : 'border-gray-200'}`}
                />
                <button
                    type="button"
                    onClick={() => setVisivel((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
                    aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {visivel ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            </div>
            <InputError message={erro} className="mt-1.5" />
        </div>
    );
}

export default function UpdatePasswordForm({ className = '' }) {
    const senhaRef = useRef();
    const senhaAtualRef = useRef();

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const cumpridas = REGRAS.filter((r) => r.testa(data.password));
    const obrigatoriasOk = REGRAS.slice(0, 3).every((r) => r.testa(data.password));
    const forca = data.password ? cumpridas.length : 0;
    const coresForca = ['bg-gray-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-400', 'bg-emerald-600'];
    const confirmacaoConfere = data.password_confirmation && data.password === data.password_confirmation;

    const atualizarSenha = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (erros) => {
                if (erros.password) {
                    reset('password', 'password_confirmation');
                    senhaRef.current?.focus();
                }
                if (erros.current_password) {
                    reset('current_password');
                    senhaAtualRef.current?.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <header className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF5A00] flex items-center justify-center shrink-0">
                    <LockClosedIcon className="w-5 h-5" />
                </span>
                <div>
                    <h2 className="text-lg font-black text-gray-900">Alterar senha</h2>
                    <p className="mt-0.5 text-sm text-gray-500">Use uma senha longa e difícil de adivinhar para manter sua conta segura.</p>
                </div>
            </header>

            <form onSubmit={atualizarSenha} className="mt-6 space-y-5">
                <CampoSenha
                    id="current_password"
                    rotulo="Senha atual"
                    valor={data.current_password}
                    onChange={(v) => setData('current_password', v)}
                    erro={errors.current_password}
                    entradaRef={senhaAtualRef}
                    autoComplete="current-password"
                />

                <div>
                    <CampoSenha
                        id="password"
                        rotulo="Nova senha"
                        valor={data.password}
                        onChange={(v) => setData('password', v)}
                        erro={errors.password}
                        entradaRef={senhaRef}
                        autoComplete="new-password"
                    />
                    {data.password && (
                        <div className="mt-3 space-y-2">
                            <div className="flex gap-1" aria-hidden="true">
                                {[1, 2, 3, 4].map((n) => (
                                    <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= forca ? coresForca[forca] : 'bg-gray-200'}`} />
                                ))}
                            </div>
                            <ul className="grid sm:grid-cols-2 gap-1">
                                {REGRAS.map((r) => (
                                    <li key={r.id} className={`flex items-center gap-1.5 text-xs ${r.testa(data.password) ? 'text-emerald-700' : 'text-gray-500'}`}>
                                        <CheckCircleIcon className="w-4 h-4" /> {r.rotulo}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div>
                    <CampoSenha
                        id="password_confirmation"
                        rotulo="Confirmar nova senha"
                        valor={data.password_confirmation}
                        onChange={(v) => setData('password_confirmation', v)}
                        erro={errors.password_confirmation}
                        autoComplete="new-password"
                    />
                    {data.password_confirmation && !confirmacaoConfere && (
                        <p className="mt-1.5 text-xs text-amber-700">As senhas ainda não são iguais.</p>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={processing || !data.current_password || !obrigatoriasOk || !confirmacaoConfere}
                        className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold disabled:opacity-40 transition"
                    >
                        {processing ? 'Salvando...' : 'Salvar nova senha'}
                    </button>

                    <Transition show={recentlySuccessful} enter="transition ease-in-out" enterFrom="opacity-0" leave="transition ease-in-out" leaveTo="opacity-0">
                        <p className="text-sm font-semibold text-emerald-700">Senha alterada com sucesso.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
