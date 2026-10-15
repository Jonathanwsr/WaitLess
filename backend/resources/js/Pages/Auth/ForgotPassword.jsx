import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const PASSOS = [
    { n: 1, titulo: 'Informe o seu e-mail', texto: 'O mesmo que você usa para entrar na Lokyva.' },
    { n: 2, titulo: 'Abra o link no e-mail', texto: 'Ele chega em instantes. Confira também o spam.' },
    { n: 3, titulo: 'Crie a nova senha', texto: 'Pronto: é só entrar de novo.' },
];

const IconeEmail = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
    </svg>
);

const IconeCadeado = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.3" />
    </svg>
);

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });
    const [espera, setEspera] = useState(0);
    const enviado = Boolean(status);

    // Depois de enviar, espera 60 s antes de liberar "Reenviar" (evita pedidos repetidos).
    useEffect(() => {
        if (enviado) setEspera(60);
    }, [status]);
    useEffect(() => {
        if (espera <= 0) return undefined;
        const t = setTimeout(() => setEspera((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [espera]);

    const enviar = (e) => {
        e?.preventDefault();
        post(route('password.email'), { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-gray-50 lg:p-6 xl:p-10 flex items-center justify-center font-sans antialiased selection:bg-[#FF5A00] selection:text-white">
            <Head title="Esqueci minha senha" />

            <div className="w-full max-w-[1100px] min-h-screen lg:min-h-[620px] bg-white lg:rounded-[2rem] lg:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] lg:border lg:border-gray-100 overflow-hidden flex flex-col lg:flex-row">
                {/* LADO DA MARCA */}
                <aside className="relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#FF7A00] via-[#FF5A00] to-[#E8590C] p-10 xl:p-12 text-white">
                    <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

                    <Link href="/" className="relative inline-flex items-center gap-3">
                        <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-9 w-auto rounded-lg bg-white/95 p-1" />
                    </Link>

                    <div className="relative">
                        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                            <IconeCadeado className="h-8 w-8" />
                        </div>
                        <h2 className="text-3xl xl:text-4xl font-black leading-tight tracking-tight">Recupere o acesso em três passos.</h2>
                        <ol className="mt-8 space-y-5">
                            {PASSOS.map((p) => (
                                <li key={p.n} className="flex items-start gap-4">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#FF5A00]">{p.n}</span>
                                    <div>
                                        <p className="font-bold">{p.titulo}</p>
                                        <p className="text-sm text-white/80">{p.texto}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <p className="relative text-xs text-white/70">A Lokyva nunca pede a sua senha por e-mail, mensagem ou telefone.</p>
                </aside>

                {/* FORMULÁRIO */}
                <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
                    <div className="mx-auto w-full max-w-md">
                        <Link href="/" className="mb-10 inline-flex lg:hidden">
                            <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-9 w-auto" />
                        </Link>

                        {!enviado ? (
                            <>
                                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#E8590C]">
                                    <IconeCadeado className="h-4 w-4" /> Recuperar senha
                                </span>
                                <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-900">Esqueceu a senha?</h1>
                                <p className="mt-2 text-gray-500">Sem problema. Digite o e-mail da sua conta e enviamos um link para você criar uma nova senha.</p>

                                <form onSubmit={enviar} className="mt-8 space-y-5">
                                    <label className="block">
                                        <span className="text-sm font-semibold text-gray-700">E-mail</span>
                                        <div className={`mt-1.5 flex items-center gap-3 rounded-2xl border bg-gray-50 px-4 transition focus-within:bg-white focus-within:ring-4 ${errors.email ? 'border-red-300 focus-within:ring-red-100' : 'border-gray-200 focus-within:border-[#FF5A00] focus-within:ring-orange-100'}`}>
                                            <IconeEmail className="h-5 w-5 shrink-0 text-gray-400" />
                                            <input
                                                id="email"
                                                type="email"
                                                name="email"
                                                autoComplete="email"
                                                autoFocus
                                                required
                                                value={data.email}
                                                onChange={(e) => setData('email', e.target.value)}
                                                placeholder="voce@exemplo.com"
                                                className="w-full border-0 bg-transparent py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-0"
                                            />
                                        </div>
                                        {errors.email && <p className="mt-2 text-sm font-medium text-red-600">{errors.email}</p>}
                                    </label>

                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF5A00] py-3.5 text-[15px] font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-[#E8590C] active:scale-[0.99] disabled:opacity-60"
                                    >
                                        {processing ? (
                                            <>
                                                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
                                                Enviando…
                                            </>
                                        ) : 'Enviar link de recuperação'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                                    <IconeEmail className="h-10 w-10" />
                                </div>
                                <h1 className="mt-6 text-3xl font-black tracking-tight text-gray-900">Confira o seu e-mail</h1>
                                <p className="mt-3 text-gray-600">{status}</p>
                                {data.email && <p className="mt-2 text-sm text-gray-500">Enviado para <b className="text-gray-800">{data.email}</b></p>}

                                <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-left text-sm text-gray-600">
                                    <p className="font-bold text-gray-800">Não chegou?</p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                        <li>Procure na pasta de spam ou promoções.</li>
                                        <li>Confira se o e-mail foi digitado certinho.</li>
                                        <li>O link vale por 60 minutos.</li>
                                    </ul>
                                </div>

                                <button
                                    type="button"
                                    onClick={enviar}
                                    disabled={processing || espera > 0}
                                    className="mt-6 w-full rounded-2xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {espera > 0 ? `Reenviar em ${espera}s` : processing ? 'Reenviando…' : 'Reenviar o link'}
                                </button>
                            </div>
                        )}

                        <p className="mt-10 text-center text-sm text-gray-500">
                            Lembrou a senha?{' '}
                            <Link href={route('login')} className="font-bold text-[#FF5A00] hover:underline">Voltar para o login</Link>
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
