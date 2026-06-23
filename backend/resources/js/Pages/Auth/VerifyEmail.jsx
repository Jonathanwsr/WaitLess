import { Head, Link, useForm } from '@inertiajs/react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        // Fundo externo cinza claro para manter o padrão de card destacado
        <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
            <Head title="Verificação de E-mail - Waitless" />

            {/* CARD PRINCIPAL CENTRALIZADO */}
            <div className="w-full max-w-6xl bg-white rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-[750px]">
                
                {/* --- PAINEL ESQUERDO: IMAGEM PREENCHENDO TUDO (Exibido a partir de telas LG) --- */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-100 border-r border-gray-100">
                    <img 
                        src="/images/cadastro.png" 
                        alt="Fundo de Verificação Waitless" 
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                </div>

                {/* --- PAINEL DIREITO: INTERFACE DE VERIFICAÇÃO --- */}
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

                        {/* Título e Mensagem de Orientação */}
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Verifique seu e-mail</h3>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                Obrigado por se cadastrar no Waitless! Antes de começar, precisamos que você confirme seu endereço de e-mail clicando no link de ativação que enviamos para você.
                            </p>
                        </div>

                        {/* Status de Sucesso (Alerta de Reenvio) */}
                        {status === 'verification-link-sent' && (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700 text-center shadow-sm">
                                Um novo link de verificação foi enviado para o e-mail informado durante o cadastro.
                            </div>
                        )}

                        {/* Ações */}
                        <form onSubmit={submit} className="space-y-4">
                            
                            {/* Botão Principal de Reenvio */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3.5 px-4 bg-black hover:bg-slate-900 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition-all duration-150 disabled:opacity-50"
                                    disabled={processing}
                                >
                                    {processing ? 'Enviando...' : 'Reenviar E-mail de Verificação'}
                                </button>
                            </div>

                            {/* Botão de Logout / Desconexão Segura */}
                            <div className="pt-2 text-center">
                                <Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                    className="text-xs font-bold text-gray-400 hover:text-slate-900 transition underline underline-offset-4 decoration-gray-200 hover:decoration-slate-900"
                                >
                                    Sair da conta
                                </Link>
                            </div>
                        </form>

                        {/* Nota de rodapé informativa */}
                        <div className="pt-4 border-t border-gray-100 text-center">
                            <p className="text-[11px] font-medium text-gray-400">
                                Não encontrou o e-mail? Verifique sua pasta de lixo eletrônico ou spam.
                            </p>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}