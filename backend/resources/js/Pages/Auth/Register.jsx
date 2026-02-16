import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        papel: '', // Estado inicial para o papel
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center bg-gray-50 selection:bg-indigo-500 selection:text-white overflow-hidden py-10">
            <Head title="Criar Conta - WaitLess" />

           
            <div className="absolute top-0 -left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            <div className="w-full sm:max-w-md px-8 py-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 relative z-10">
                
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-flex justify-center mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/20">
                            W
                        </div>
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900">Comece com o WaitLess</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        Crie sua conta em segundos e organize suas filas.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    
                 
                    <div>
                        <InputLabel htmlFor="name" value="Nome Completo" className="text-gray-700" />
                        <TextInput
                            id="name"
                            name="name"
                            value={data.name}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="name"
                            isFocused={true}
                            onChange={(e) => setData('name', e.target.value)}
                            required
                            placeholder="Ex: João Silva"
                        />
                        <InputError message={errors.name} className="mt-2" />
                    </div>

                   
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
                            required
                            placeholder="seu@email.com"
                        />
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                  
                    <div>
                        <InputLabel htmlFor="papel" value="Tipo de Usuário" className="text-gray-700" />
                        <select
                            id="papel"
                            name="papel"
                            value={data.papel}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50 text-gray-600"
                            onChange={(e) => setData('papel', e.target.value)}
                            required
                        >
                            <option value="" disabled>Selecione seu cargo</option>
                            <option value="admin">Administrador</option>
                            <option value="socio">Sócio</option>
                            <option value="gerente">Gerente</option>
                            <option value="atendente">Atendente</option>
                            <option value="user">Usuário Comum / Cliente</option>
                        </select>
                        <InputError message={errors.papel} className="mt-2" />
                    </div>

                   
                    <div>
                        <InputLabel htmlFor="password" value="Senha" className="text-gray-700" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="new-password"
                            onChange={(e) => setData('password', e.target.value)}
                            required
                            placeholder="Mínimo de 8 caracteres"
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                   
                    <div>
                        <InputLabel htmlFor="password_confirmation" value="Confirmar Senha" className="text-gray-700" />
                        <TextInput
                            id="password_confirmation"
                            type="password"
                            name="password_confirmation"
                            value={data.password_confirmation}
                            className="mt-1 block w-full py-3 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
                            autoComplete="new-password"
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            required
                            placeholder="Repita a senha"
                        />
                        <InputError message={errors.password_confirmation} className="mt-2" />
                    </div>

                    <div className="pt-2">
                        <PrimaryButton 
                             className="w-full justify-center py-3 text-base bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-lg shadow-indigo-600/20 transition-all rounded-xl" 
                             disabled={processing}
                        >
                            {processing ? 'Criando conta...' : 'Criar Conta'}
                        </PrimaryButton>
                    </div>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        Já tem uma conta?{' '}
                        <Link
                            href={route('login')}
                            className="font-bold text-indigo-600 hover:text-indigo-800 transition"
                        >
                            Fazer Login
                        </Link>
                    </p>
                </div>
            </div>
            
             <p className="mt-8 text-xs text-gray-400">
                © {new Date().getFullYear()} WaitLess. Todos os direitos reservados.
            </p>
        </div>
    );
}