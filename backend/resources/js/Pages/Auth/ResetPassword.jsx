import InputError from '@/Components/InputError';
import { Head, useForm, Link } from '@inertiajs/react';
import { useState } from 'react';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Ícones SVG para mostrar/ocultar senha
    const EyeIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
    const EyeSlashIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    );

    return (
        // Fundo externo unificado cinza claro
        <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased selection:bg-emerald-500 selection:text-white">
            <Head title="Redefinir Senha - Waitless" />

            {/* CARD PRINCIPAL CENTRALIZADO */}
            <div className="w-full max-w-6xl bg-white rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-[750px] border border-gray-100">
                
                {/* --- PAINEL ESQUERDO: IMAGEM PREENCHENDO TUDO --- */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-50 border-r border-gray-100">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10" />
                    <img 
                        src="/images/cadastro.png" 
                        alt="Fundo de Redefinição Waitless" 
                        className="absolute inset-0 w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-1000 ease-in-out"
                    />
                </div>

                {/* --- PAINEL DIREITO: FORMULÁRIO DE REDEFINIÇÃO --- */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-10 sm:px-12 md:px-16 xl:px-20 bg-white overflow-y-auto">
                    <div className="max-w-md w-full space-y-8">
                        
                        {/* Cabeçalho de Identidade (Logo Waitless) */}
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 rounded-2xl shadow-lg text-white font-black text-xl mb-2">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Waitless</h2>
                                <p className="text-[10px] font-bold text-emerald-500 tracking-wider uppercase">Simplifique. Agende. Conquiste.</p>
                            </div>
                        </div>

                        {/* Título da Ação Atual */}
                        <div className="text-center space-y-1.5 pt-4">
                            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Redefinir sua senha</h3>
                            <p className="text-sm text-gray-500 font-medium">Crie uma nova credencial segura para sua conta.</p>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={submit} className="space-y-5 pt-2">
                            
                            {/* Campo: E-mail (Apenas Leitura / Desabilitado visualmente) */}
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">E-mail de recuperação</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed select-none focus:outline-none"
                                        readOnly={true}
                                        required
                                    />
                                </div>
                                <InputError message={errors.email} className="text-xs mt-1" />
                            </div>

                            {/* Campo: Nova Senha */}
                            <div className="space-y-1.5">
                                <label htmlFor="password" className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nova Senha</label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={data.password}
                                        className="block w-full pl-11 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                        placeholder="••••••••"
                                        onChange={(e) => setData('password', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-1 px-3 flex items-center cursor-pointer outline-none rounded-r-xl"
                                    >
                                        {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <InputError message={errors.password} className="text-xs mt-1" />
                            </div>

                            {/* Campo: Confirmar Nova Senha */}
                            <div className="space-y-1.5">
                                <label htmlFor="password_confirmation" className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Confirmar Nova Senha</label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <input
                                        id="password_confirmation"
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        className="block w-full pl-11 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                        placeholder="••••••••"
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-1 px-3 flex items-center cursor-pointer outline-none rounded-r-xl"
                                    >
                                        {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <InputError message={errors.password_confirmation} className="text-xs mt-1" />
                            </div>

                            {/* Botão de Envio */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-4 px-4 bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md shadow-slate-900/20 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Salvando nova senha...
                                        </>
                                    ) : 'Redefinir Senha'}
                                </button>
                            </div>
                        </form>

                        {/* Link de retorno para o Login */}
                        <div className="pt-6 mt-6 border-t border-gray-100 text-center">
                            <p className="text-sm font-medium text-gray-500">
                                Lembrou seus dados?{' '}
                                <Link
                                    href={route('login')}
                                    className="font-bold text-emerald-500 hover:text-emerald-600 transition inline-flex items-center gap-1 group"
                                >
                                    Voltar para o login 
                                    <span className="text-sm font-normal group-hover:translate-x-1 transition-transform">→</span>
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}