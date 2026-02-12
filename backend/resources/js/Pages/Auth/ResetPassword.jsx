import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, Link } from '@inertiajs/react';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center bg-gray-50 selection:bg-indigo-500 selection:text-white overflow-hidden py-10">
            <Head title="Redefinir Senha" />

            {/* --- Elementos de Fundo (Blobs) --- */}
            <div className="absolute top-0 -left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* --- Card Central --- */}
            <div className="w-full sm:max-w-md px-8 py-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 relative z-10">
                
                {/* Cabeçalho */}
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-flex justify-center mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/20">
                            W
                        </div>
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900">Redefinir Senha</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        Crie uma nova senha segura para sua conta.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    {/* Email */}
                    <div>
                        <InputLabel htmlFor="email" value="E-mail" className="text-gray-700" />
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="username"
                            onChange={(e) => setData('email', e.target.value)}
                            readOnly={true} // Geralmente o email vem travado na redefinição, mas pode deixar editável se preferir
                        />
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    {/* Nova Senha */}
                    <div>
                        <InputLabel htmlFor="password" value="Nova Senha" className="text-gray-700" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="new-password"
                            isFocused={true}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                        <InputLabel htmlFor="password_confirmation" value="Confirmar Nova Senha" className="text-gray-700" />
                        <TextInput
                            type="password"
                            id="password_confirmation"
                            name="password_confirmation"
                            value={data.password_confirmation}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="new-password"
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            placeholder="Repita a senha"
                        />
                        <InputError message={errors.password_confirmation} className="mt-2" />
                    </div>

                    {/* Botão de Ação */}
                    <div className="pt-2">
                        <PrimaryButton 
                             className="w-full justify-center py-3 text-base bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-lg shadow-indigo-600/20 transition-all rounded-xl" 
                             disabled={processing}
                        >
                            {processing ? 'Redefinindo...' : 'Redefinir Senha'}
                        </PrimaryButton>
                    </div>
                </form>
            </div>

          
            <p className="mt-8 text-xs text-gray-400 z-10">
                © {new Date().getFullYear()} WaitLess. Segurança garantida.
            </p>
        </div>
    );
}