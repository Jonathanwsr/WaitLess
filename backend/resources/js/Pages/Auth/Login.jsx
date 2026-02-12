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

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center bg-gray-50 selection:bg-indigo-500 selection:text-white overflow-hidden">
            <Head title="Entrar no WaitLess" />

            
            <div className="absolute top-0 -left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

         
            <div className="w-full sm:max-w-md mt-6 px-8 py-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 relative z-10">
                
                
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-flex justify-center mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/20">
                            W
                        </div>
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta!</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        Acesse o painel para gerenciar suas filas.
                    </p>
                </div>

                {status && (
                    <div className="mb-4 text-sm font-medium text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <InputLabel htmlFor="email" value="E-mail" className="text-gray-700" />
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="username"
                            isFocused={true}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="seu@email.com"
                        />
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    <div>
                        <div className="flex justify-between items-center">
                            <InputLabel htmlFor="password" value="Senha" className="text-gray-700" />
                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
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
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="current-password"
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div className="block">
                        <label className="flex items-center cursor-pointer">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
                            />
                            <span className="ms-2 text-sm text-gray-600">
                                Lembrar-me neste dispositivo
                            </span>
                        </label>
                    </div>

                    <div className="pt-2">
                        <PrimaryButton 
                            className="w-full justify-center py-3 text-base bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-lg shadow-indigo-600/20 transition-all rounded-xl" 
                            disabled={processing}
                        >
                            {processing ? 'Entrando...' : 'Entrar'}
                        </PrimaryButton>
                    </div>
                </form>

                
                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        Ainda não tem uma conta?{' '}
                        <Link
                            href={route('register')}
                            className="font-bold text-indigo-600 hover:text-indigo-800 transition"
                        >
                            Criar conta grátis
                        </Link>
                    </p>
                </div>
            </div>
            
           
            <p className="mt-8 text-xs text-gray-400 absolute bottom-4">
                © {new Date().getFullYear()} WaitLess. Todos os direitos reservados.
            </p>
        </div>
    );
}