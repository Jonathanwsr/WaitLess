import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();

        // O redirecionamento inteligente agora é feito 100% pelo Laravel (AuthenticatedSessionController)
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center bg-gray-50 selection:bg-emerald-500 selection:text-white overflow-hidden">
            <Head title="Entrar no WaitLess" />

            {/* Background Blobs (Modernizados) */}
            <div className="absolute top-0 -left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
            <div className="absolute top-0 -right-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-72 h-72 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>

            <div className="w-full sm:max-w-md mt-6 px-8 py-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/60 relative z-10">
                
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-flex justify-center mb-5 hover:scale-105 transition-transform duration-300">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-emerald-500/30">
                            W
                        </div>
                    </Link>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Bem-vindo de volta!</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                        Acesse o painel para gerenciar suas filas.
                    </p>
                </div>

                {status && (
                    <div className="mb-5 text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center animate-in fade-in">
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6">
                    <div>
                        <InputLabel htmlFor="email" value="E-mail" className="text-gray-700 font-bold ml-1" />
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="mt-1 block w-full py-3.5 px-4 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl bg-gray-50 hover:bg-white transition-colors shadow-sm"
                            autoComplete="username"
                            isFocused={true}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="seu@email.com"
                        />
                        <InputError message={errors.email} className="mt-2 ml-1" />
                    </div>

                    <div>
                        <div className="flex justify-between items-center ml-1 mb-1">
                            <InputLabel htmlFor="password" value="Senha" className="text-gray-700 font-bold" />
                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-xs text-emerald-600 hover:text-emerald-800 font-bold transition-colors"
                                >
                                    Esqueceu a senha?
                                </Link>
                            )}
                        </div>
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="mt-1 block w-full py-3.5 px-4 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl bg-gray-50 hover:bg-white transition-colors shadow-sm"
                            autoComplete="current-password"
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                        />
                        <InputError message={errors.password} className="mt-2 ml-1" />
                    </div>

                    <div className="block ml-1">
                        <label className="flex items-center cursor-pointer group">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="text-emerald-500 border-gray-300 focus:ring-emerald-500 rounded transition-colors group-hover:border-emerald-400"
                            />
                            <span className="ms-3 text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                                Lembrar-me neste dispositivo
                            </span>
                        </label>
                    </div>

                    <div className="pt-4">
                        <PrimaryButton 
                            className="w-full flex justify-center py-4 text-base font-black bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 rounded-xl border border-emerald-400" 
                            disabled={processing}
                        >
                            {processing ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Entrando...
                                </span>
                            ) : 'Entrar na Conta'}
                        </PrimaryButton>
                    </div>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm font-medium text-gray-500">
                        Ainda não tem uma conta?{' '}
                        <Link
                            href={route('register')}
                            className="font-black text-emerald-600 hover:text-emerald-700 transition-colors ml-1"
                        >
                            Criar conta grátis
                        </Link>
                    </p>
                </div>
            </div>
            
            <p className="mt-10 text-xs font-medium text-gray-400 absolute bottom-6">
                © {new Date().getFullYear()} WaitLess. Todos os direitos reservados.
            </p>
        </div>
    );
}