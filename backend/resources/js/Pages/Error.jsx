import { Head, Link } from '@inertiajs/react';
import {
    ExclamationTriangleIcon, LockClosedIcon, MapIcon,
    ServerIcon, WifiIcon, ClockIcon, ArrowLeftIcon, SparklesIcon,
} from '@heroicons/react/24/outline';

const CONTEUDO_POR_STATUS = {
    400: {
        icone: ExclamationTriangleIcon,
        titulo: 'Requisição inválida',
        descricao: 'Algo nos dados enviados não fez sentido pro servidor. Volte e tente novamente.',
    },
    401: {
        icone: LockClosedIcon,
        titulo: 'Você precisa entrar',
        descricao: 'Sua sessão expirou ou você ainda não fez login. Entre na sua conta para continuar.',
    },
    403: {
        icone: LockClosedIcon,
        titulo: 'Acesso não autorizado',
        descricao: 'Você não tem permissão para ver esta página.',
    },
    404: {
        icone: MapIcon,
        titulo: 'Página não encontrada',
        descricao: 'O endereço que você tentou acessar não existe ou foi movido.',
    },
    429: {
        icone: ClockIcon,
        titulo: 'Muitas tentativas',
        descricao: 'Você fez várias requisições em pouco tempo. Aguarde um instante e tente de novo.',
    },
    500: {
        icone: ServerIcon,
        titulo: 'Algo deu errado do nosso lado',
        descricao: 'Já fomos avisados e estamos olhando isso. Tente novamente em alguns minutos.',
    },
    503: {
        icone: WifiIcon,
        titulo: 'Em manutenção',
        descricao: 'Estamos com uma manutenção rápida em andamento. Voltamos já.',
    },
};

const CONTEUDO_PREMIUM = {
    icone: SparklesIcon,
    titulo: 'Recurso exclusivo Premium',
    descricao: 'Este recurso faz parte do plano Premium. Assine para liberar e aproveitar tudo o que a Lokyva oferece.',
};

export default function Error({ status, mensagem = null, premium = false }) {
    const base = premium ? CONTEUDO_PREMIUM : (CONTEUDO_POR_STATUS[status] || CONTEUDO_POR_STATUS[500]);
    // Mensagem específica do servidor (ex.: qual recurso é Premium) tem prioridade sobre o texto genérico.
    const conteudo = { ...base, descricao: mensagem || base.descricao };
    const Icone = conteudo.icone;

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-12">
            <Head title={`Erro ${status}`} />

            <div className="max-w-md w-full text-center">
                <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-9 mx-auto mb-10 object-contain" />

                <div className="bg-white border border-gray-100 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.04)] p-8 sm:p-10">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFF3EC] flex items-center justify-center mx-auto mb-6">
                        <Icone className="w-8 h-8 text-[#FF5A00]" />
                    </div>

                    {premium
                        ? <span className="inline-block text-[10px] font-black bg-amber-400 text-zinc-900 px-3 py-1 rounded-full tracking-widest">PREMIUM</span>
                        : <span className="text-xs font-black text-gray-300 tracking-widest">ERRO {status}</span>}
                    <h1 className="text-2xl font-black text-gray-900 mt-2 mb-3">{conteudo.titulo}</h1>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8">{conteudo.descricao}</p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {premium ? (
                            <>
                                <a
                                    href="/minha-assinatura/status"
                                    className="flex-1 inline-flex items-center justify-center gap-2 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-2xl transition"
                                >
                                    <SparklesIcon className="w-4 h-4" /> Seja Premium
                                </a>
                                <button
                                    type="button"
                                    onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
                                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold py-3 px-5 rounded-2xl border border-gray-200 transition"
                                >
                                    <ArrowLeftIcon className="w-4 h-4" /> Voltar
                                </button>
                            </>
                        ) : (
                        <Link
                            href="/"
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-2xl transition"
                        >
                            <ArrowLeftIcon className="w-4 h-4" /> Voltar ao início
                        </Link>
                        )}
                        {status === 401 && (
                            <Link
                                href="/login"
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold py-3 px-5 rounded-2xl border border-gray-200 transition"
                            >
                                Fazer login
                            </Link>
                        )}
                    </div>
                </div>

                <p className="text-xs text-gray-400 mt-8">
                    Se o problema continuar, fale com o suporte pelo app.
                </p>
            </div>
        </div>
    );
}
