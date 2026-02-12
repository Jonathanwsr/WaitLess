import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, useForm } from '@inertiajs/react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center bg-gray-50 selection:bg-indigo-500 selection:text-white overflow-hidden py-10">
            <Head title="Verificação de E-mail" />

            {/* --- Elementos de Fundo (Blobs) --- */}
            <div className="absolute top-0 -left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* --- Card Central --- */}
            <div className="w-full sm:max-w-md px-8 py-10 bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 relative z-10">
                
                {/* Cabeçalho com Logo */}
                <div className="mb-6 text-center">
                    <div className="inline-flex justify-center mb-6">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            {/* Ícone de Email (SVG) */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifique seu e-mail</h2>
                    
                    <div className="text-sm text-gray-600 leading-relaxed">
                        Obrigado por se cadastrar no WaitLess! Antes de começar, precisamos que você verifique seu endereço de e-mail clicando no link que acabamos de enviar.
                    </div>
                </div>

                {/* Status de Sucesso */}
                {status === 'verification-link-sent' && (
                    <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-sm font-medium text-green-700 text-center animate-fade-in-up">
                        Um novo link de verificação foi enviado para o e-mail informado durante o cadastro.
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <div className="pt-2">
                        <PrimaryButton 
                             className="w-full justify-center py-3 text-base bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-lg shadow-indigo-600/20 transition-all rounded-xl" 
                             disabled={processing}
                        >
                            {processing ? 'Enviando...' : 'Reenviar E-mail de Verificação'}
                        </PrimaryButton>
                    </div>

                    <div className="flex justify-center pt-2">
                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            className="text-sm text-gray-500 hover:text-gray-900 underline decoration-gray-300 hover:decoration-gray-900 underline-offset-4 transition-all"
                        >
                            Sair da conta
                        </Link>
                    </div>
                </form>
            </div>

            
            <p className="mt-8 text-xs text-gray-400 z-10">
                Não recebeu o e-mail? Verifique sua caixa de spam.
            </p>
        </div>
    );
}