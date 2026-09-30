import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import {
    SparklesIcon, GiftIcon, TicketIcon, StarIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

export default function Recompensas({ auth, meusCupons = [], sugestoesLojas = [], pontosAtuais = 0, indicacao = null }) {
    const [codigoCopiado, setCodigoCopiado] = React.useState(false);
    const linkConvite = indicacao ? `${window.location.origin}/register?ref=${indicacao.codigo}` : '';
    const copiarConvite = async () => {
        try {
            await navigator.clipboard.writeText(linkConvite);
            setCodigoCopiado(true);
            setTimeout(() => setCodigoCopiado(false), 2000);
        } catch {
            window.prompt('Copie o link de convite:', linkConvite);
        }
    };

    const resgatar = (cupomId) => {
        router.post(route('cliente.resgatar.cupom', { id: cupomId }), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Recompensas" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Saldo de pontos */}
                <div className="bg-gradient-to-r from-[#006B4D] to-[#00915F] rounded-3xl p-6 sm:p-8 text-white shadow-lg mb-8 flex items-center justify-between">
                    <div>
                        <p className="text-emerald-100 text-sm font-semibold mb-1">Seus pontos</p>
                        <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">{pontosAtuais}</p>
                    </div>
                    <div className="bg-white/15 p-4 rounded-2xl">
                        <SparklesIcon className="w-9 h-9 text-white" />
                    </div>
                </div>

                {/* Convide amigos */}
                {indicacao && (
                    <div className="bg-white border border-orange-100 rounded-3xl p-5 sm:p-6 shadow-sm mb-8">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-[220px] flex-1">
                                <h2 className="text-lg font-black text-gray-900">Convide amigos e ganhe R$ {Number(indicacao.reais_por_indicacao).toFixed(0)} em pontos</h2>
                                <p className="text-sm text-gray-500 mt-1">Quando seu amigo concluir a primeira reserva, você ganha {indicacao.pontos_por_indicacao} pontos e ele ganha {indicacao.pontos_para_o_amigo}.</p>
                                <p className="text-xs text-gray-400 mt-2">{indicacao.convidados} convidados · {indicacao.recompensadas} já reservaram · {indicacao.pontos_ganhos} pontos ganhos</p>
                            </div>
                            <div className="flex flex-col items-stretch gap-2">
                                <div className="rounded-2xl bg-[#FFF1E4] px-5 py-3 text-center">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase">Seu código</p>
                                    <p className="text-2xl font-black text-[#FF5A00] tracking-widest">{indicacao.codigo}</p>
                                </div>
                                <button type="button" onClick={copiarConvite} className="px-5 py-2.5 rounded-full bg-[#FF5A00] hover:bg-orange-600 text-white text-sm font-bold transition">{codigoCopiado ? 'Link copiado!' : 'Copiar link de convite'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Meus cupons */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                        <TicketIcon className="w-5 h-5 text-gray-700" />
                        <h2 className="text-lg font-bold text-gray-900">Meus cupons</h2>
                    </div>

                    {meusCupons.length === 0 ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-500">
                            Você ainda não resgatou nenhum cupom. Explore as sugestões abaixo!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {meusCupons.map((cupom) => (
                                <div key={cupom.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
                                    <div className="flex items-start justify-between">
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                                            {cupom.estabelecimento?.nome || 'Estabelecimento'}
                                        </span>
                                        <GiftIcon className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">{cupom.titulo}</h3>
                                    {cupom.descricao && <p className="text-sm text-gray-500">{cupom.descricao}</p>}
                                    <span className="mt-1 text-xs font-mono font-bold text-gray-400 tracking-wider">{cupom.codigo}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sugestões */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <StarIcon className="w-5 h-5 text-gray-700" />
                        <h2 className="text-lg font-bold text-gray-900">Sugestões para você</h2>
                    </div>

                    {sugestoesLojas.length === 0 ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-500">
                            Nenhuma sugestão disponível no momento.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {sugestoesLojas.map((loja) => (
                                <div key={loja.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <StarSolidIcon className="w-4 h-4 text-amber-400" />
                                        <h3 className="font-bold text-gray-900">{loja.nome}</h3>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {(loja.cupons || []).map((cupom) => {
                                            // Planos premium de cliente são 'premium'/'premium-plus' (ver
                                            // PlanoService::PLANOS_PREMIUM['user']) — nunca o literal 'plus'.
                                            const bloqueado = cupom.apenas_plus && !String(auth?.user?.plano_assinatura || '').startsWith('premium');
                                            return (
                                                <div key={cupom.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 truncate">{cupom.titulo}</p>
                                                        <p className="text-xs text-gray-400">{cupom.pontos_custo} pontos</p>
                                                    </div>
                                                    {bloqueado ? (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-gray-400 flex-shrink-0">
                                                            <LockClosedIcon className="w-3.5 h-3.5" /> Plus
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => resgatar(cupom.id)}
                                                            disabled={pontosAtuais < cupom.pontos_custo}
                                                            className="flex-shrink-0 bg-[#006B4D] hover:bg-[#00553D] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
                                                        >
                                                            Resgatar
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
