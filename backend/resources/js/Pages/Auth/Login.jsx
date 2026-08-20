import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [mostrarSenha, setMostrarSenha] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 lg:p-4 xl:p-8 font-sans selection:bg-[#F26522] selection:text-white">
            <Head title="Entrar - Lokyva" />

            {/* Container Principal - Responsividade corrigida para mobile e desktop */}
            <div className="w-full h-full min-h-screen lg:min-h-[650px] lg:h-[85vh] lg:max-h-[800px] max-w-[1200px] bg-white lg:rounded-[2rem] lg:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] flex flex-col lg:flex-row overflow-hidden lg:border lg:border-gray-100 relative">
                
                {/* --- LADO ESQUERDO (Marketing / Informativo) --- */}
                <div className="hidden lg:flex w-[55%] relative flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#FFF9F5] via-[#FFF1E5] to-[#FFE8D6] overflow-hidden">
                    
                    {/* Background Pattern Dots */}
                    <div className="absolute top-12 right-12 opacity-30">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="2" cy="2" r="2" fill="#F26522"/>
                            <circle cx="14" cy="2" r="2" fill="#F26522"/>
                            <circle cx="26" cy="2" r="2" fill="#F26522"/>
                            <circle cx="38" cy="2" r="2" fill="#F26522"/>
                            <circle cx="2" cy="14" r="2" fill="#F26522"/>
                            <circle cx="14" cy="14" r="2" fill="#F26522"/>
                            <circle cx="26" cy="14" r="2" fill="#F26522"/>
                            <circle cx="38" cy="14" r="2" fill="#F26522"/>
                            <circle cx="2" cy="26" r="2" fill="#F26522"/>
                            <circle cx="14" cy="26" r="2" fill="#F26522"/>
                            <circle cx="26" cy="26" r="2" fill="#F26522"/>
                            <circle cx="38" cy="26" r="2" fill="#F26522"/>
                            <circle cx="2" cy="38" r="2" fill="#F26522"/>
                            <circle cx="14" cy="38" r="2" fill="#F26522"/>
                            <circle cx="26" cy="38" r="2" fill="#F26522"/>
                            <circle cx="38" cy="38" r="2" fill="#F26522"/>
                        </svg>
                    </div>
                    <div className="absolute bottom-12 left-10 opacity-30">
                        <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="2" cy="2" r="2" fill="#F26522"/><circle cx="14" cy="2" r="2" fill="#F26522"/><circle cx="26" cy="2" r="2" fill="#F26522"/>
                            <circle cx="2" cy="14" r="2" fill="#F26522"/><circle cx="14" cy="14" r="2" fill="#F26522"/><circle cx="26" cy="14" r="2" fill="#F26522"/>
                            <circle cx="2" cy="26" r="2" fill="#F26522"/><circle cx="14" cy="26" r="2" fill="#F26522"/><circle cx="26" cy="26" r="2" fill="#F26522"/>
                            <circle cx="2" cy="38" r="2" fill="#F26522"/><circle cx="14" cy="38" r="2" fill="#F26522"/><circle cx="26" cy="38" r="2" fill="#F26522"/>
                        </svg>
                    </div>

                    {/* Conteúdo de Texto */}
                    <div className="relative z-10 w-full max-w-lg mt-2">
                        <h1 className="text-4xl xl:text-[42px] font-extrabold text-gray-900 leading-[1.1] mb-4 tracking-tight">
                            Você viaja, <br/>
                            a gente <span className="text-[#F26522]">conecta</span> <br/>
                            o <span className="text-[#F26522]">resto.</span>
                        </h1>
                        <p className="text-gray-600 text-sm xl:text-base mb-6 w-[85%] font-medium">
                            Acesse o ecossistema completo para planejar, reservar e vivenciar suas viagens com total liberdade e sem preocupações.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#F26522]">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                </div>
                                <span className="font-semibold text-gray-800 text-sm">Hospedagens Exclusivas</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#F26522] rounded-full flex items-center justify-center shadow-sm text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                </div>
                                <span className="font-semibold text-gray-800 text-sm">Tudo na palma da mão</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#F26522]">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <span className="font-semibold text-gray-800 text-sm">Reservas e pagamentos 100% seguros</span>
                            </div>
                        </div>

                        {/* Caixinha Mais Praticidade */}
                        <div className="relative z-20 mt-6 inline-flex items-center gap-3 bg-white/70 backdrop-blur-md px-5 py-3 rounded-2xl border border-white shadow-sm">
                            <svg className="w-6 h-6 text-[#F26522]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                            <div>
                                <p className="text-xs font-bold text-gray-900">Explore o mundo.</p>
                                <p className="text-xs text-gray-600 font-medium">Deixe a burocracia com a gente.</p>
                            </div>
                        </div>
                    </div>

                    {/* MOCKUP DO CELULAR EM CSS */}
                    <div className="absolute -right-4 xl:-right-8 bottom-[-4rem] w-[260px] h-[540px] bg-white rounded-[2.5rem] shadow-2xl border-[6px] border-[#2A2A2A] z-10 overflow-hidden flex flex-col transform rotate-[-2deg]">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#2A2A2A] rounded-b-2xl z-20"></div>
                        
                        {/* App Interface */}
                        <div className="flex-1 bg-gray-50 flex flex-col pt-8 px-4">
                            {/* App Header */}
                            <div className="flex items-center justify-between mb-5">
                                <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                                <span className="font-bold text-gray-900 text-xs">Sua Viagem</span>
                                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                                    <span className="text-[10px] text-orange-600 font-bold">L</span>
                                </div>
                            </div>

                            {/* Cards Internos do Mockup */}
                            <div className="bg-white rounded-2xl p-3.5 mb-3.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-orange-50 text-[#F26522] flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Hospedagem</p>
                                    <p className="text-sm font-black text-gray-900 leading-tight">Hotel Premium</p>
                                    <p className="text-[9px] font-bold text-emerald-500">Reserva Confirmada</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-3.5 mb-3.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-orange-50 text-[#F26522] flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Mobilidade</p>
                                    <p className="text-sm font-black text-gray-900 leading-tight">SUV Executivo</p>
                                    <p className="text-[9px] font-bold text-gray-500">Retirada às 10h</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-3.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[#F26522] text-white flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Experiência</p>
                                    <p className="text-sm font-black text-gray-900 leading-tight">Passeio Exclusivo</p>
                                    <p className="text-[9px] font-bold text-emerald-500">Agendado</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- LADO DIREITO (Formulário de Login) --- */}
                <div className="w-full h-full lg:w-[45%] bg-white p-6 sm:p-12 flex flex-col justify-center relative overflow-y-auto">
                    
                    <div className="w-full max-w-sm mx-auto my-auto lg:my-0">
                        {/* Logo Mobile e Desktop */}
                        <div className="flex justify-center lg:justify-start mb-6">
                            <Link href="/">
                                <img src="/images/logo_lokyva.png" alt="Logo Lokyva" className="h-12 w-auto object-contain" />
                            </Link>
                        </div>

                        <div className="mb-8 text-center lg:text-left">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Bem-vindo à Lokyva</h2>
                            <p className="text-sm font-medium text-gray-500 mt-2">
                                Acesse sua conta para gerenciar suas reservas, roteiros e experiências exclusivas.
                            </p>
                        </div>

                        {status && (
                            <div className="mb-6 text-sm font-bold text-[#F26522] bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                                {status}
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-4">
                            {/* Input: Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">
                                    E-mail
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F26522]">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] rounded-xl sm:text-sm font-medium transition-colors"
                                        placeholder="Insira seu email"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                                {errors.email && <p className="mt-1.5 text-sm text-red-500 font-medium">{errors.email}</p>}
                            </div>

                            {/* Input: Senha */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1.5">
                                    Senha
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#F26522]">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                    </div>
                                    <input
                                        id="password"
                                        type={mostrarSenha ? "text" : "password"}
                                        name="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        className="block w-full pl-11 pr-12 py-3.5 border border-gray-200 focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] rounded-xl sm:text-sm font-medium transition-colors"
                                        placeholder="Insira sua senha"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarSenha(!mostrarSenha)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                        tabIndex="-1"
                                    >
                                        {mostrarSenha ? (
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                        ) : (
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        )}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1.5 text-sm text-red-500 font-medium">{errors.password}</p>}
                            </div>

                            {/* Esqueceu a Senha */}
                            <div className="flex items-center justify-end pt-1">
                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-sm font-bold text-[#F26522] hover:text-[#d95a1e] transition-colors"
                                    >
                                        Esqueceu a senha?
                                    </Link>
                                )}
                            </div>

                            {/* Botão Entrar */}
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-[#111111] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors disabled:opacity-70 mt-6"
                            >
                                {processing ? 'Entrando...' : 'Entrar'}
                            </button>
                        </form>

                        {/* Criar Conta */}
                        <div className="mt-8 mb-8 lg:mb-0">
                            <div className="border border-gray-100 rounded-xl p-5 text-center bg-gray-50/50">
                                <p className="text-sm font-medium text-gray-600">
                                    Ainda não tem uma conta?{' '}
                                    <Link href={route('register')} className="font-bold text-[#F26522] hover:text-[#d95a1e] inline-flex items-center gap-1 transition-colors">
                                        Crie sua conta
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                    </Link>
                                </p>
                            </div>
                        </div>

                    </div>

                    <div className="lg:absolute bottom-6 left-0 right-0 text-center pb-4 lg:pb-0 mt-auto lg:mt-0">
                        <p className="text-xs font-semibold text-gray-400">
                            © {new Date().getFullYear()} Lokyva Tecnologia S.A. Desenvolvido por INNOVATE SOLUTIONS.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}