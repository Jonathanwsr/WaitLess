import InputError from '@/Components/InputError';
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
        // Fundo externo unificado cinza claro
        <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
            <Head title="Redefinir Senha - Waitless" />

            {/* CARD PRINCIPAL CENTRALIZADO */}
            <div className="w-full max-w-6xl bg-white rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-[750px]">
                
                {/* --- PAINEL ESQUERDO: IMAGEM PREENCHENDO TUDO --- */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-100 border-r border-gray-100">
                    <img 
                        src="/images/cadastro.png" 
                        alt="Fundo de Redefinição Waitless" 
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                </div>

                {/* --- PAINEL DIREITO: FORMULÁRIO DE REDEFINIÇÃO --- */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-10 sm:px-12 md:px-16 xl:px-20 bg-white overflow-y-auto">
                    <div className="max-w-md w-full space-y-6">
                        
                        {/* Cabeçalho de Identidade (Logo Waitless) */}
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl shadow-sm text-white font-black text-xl">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Waitless</h2>
                                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Simplifique. Agende. Conquiste.</p>
                            </div>
                        </div>

                        {/* Título da Ação Atual */}
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Redefinir sua senha</h3>
                            <p className="text-xs text-gray-500 font-medium">Crie uma nova credencial segura para acessar sua conta.</p>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={submit} className="space-y-4">
                            
                            {/* Campo: E-mail (Apenas Leitura / Desabilitado visualmente para segurança) */}
                            <div className="space-y-1">
                                <label htmlFor="email" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">E-mail de recuperação</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed select-none focus:outline-none"
                                        readOnly={true}
                                        required
                                    />
                                </div>
                                <InputError message={errors.email} className="text-xs mt-1" />
                            </div>

                            {/* Campo: Nova Senha */}
                            <div className="space-y-1">
                                <label htmlFor="password" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nova Senha</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <input
                                        id="password"
                                        type="password"
                                        name="password"
                                        value={data.password}
                                        className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all shadow-sm"
                                        placeholder="••••••••"
                                        onChange={(e) => setData('password', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <InputError message={errors.password} className="text-xs mt-1" />
                            </div>

                            {/* Campo: Confirmar Nova Senha */}
                            <div className="space-y-1">
                                <label htmlFor="password_confirmation" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confirmar Nova Senha</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <input
                                        id="password_confirmation"
                                        type="password"
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all shadow-sm"
                                        placeholder="••••••••"
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        required
                                    />
                                </div>
                                <InputError message={errors.password_confirmation} className="text-xs mt-1" />
                            </div>

                            {/* Botão de Envio Sólido (Estilo Dark Minimalista) */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3.5 px-4 bg-black hover:bg-slate-900 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition-all duration-150 disabled:opacity-50"
                                    disabled={processing}
                                >
                                    {processing ? 'Atualizando senha...' : 'Redefinir Senha'}
                                </button>
                            </div>
                        </form>

                        {/* Link de retorno para o Login */}
                        <div className="pt-2 text-center">
                            <p className="text-xs font-medium text-gray-500">
                                Lembrou seus dados?{' '}
                                <Link
                                    href={route('login')}
                                    className="font-bold text-[#10B981] hover:text-emerald-600 transition inline-flex items-center gap-0.5"
                                >
                                    Voltar para o login <span className="text-sm font-normal">→</span>
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}