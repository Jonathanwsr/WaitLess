import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Gift, Lock, Sparkles, Coins, Percent } from 'lucide-react';

function IconePromocao({ tipo }) {
    if (tipo === 'pontos_todos' || tipo === 'pontos_plano') return <Coins className="w-6 h-6 text-[#FF5A00]" />;
    if (tipo === 'oferta_assinantes') return <Sparkles className="w-6 h-6 text-[#FF5A00]" />;
    return <Percent className="w-6 h-6 text-[#FF5A00]" />;
}

function CardPromocao({ promo }) {
    return (
        <div className={`bg-white rounded-3xl border p-6 shadow-sm relative ${promo.elegivel ? 'border-gray-100' : 'border-gray-100 opacity-75'}`}>
            {!promo.elegivel && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-gray-900 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3" /> Exclusiva {promo.plano_necessario}
                </div>
            )}

            <div className="w-12 h-12 rounded-2xl bg-[#FFF3EC] flex items-center justify-center mb-4">
                <IconePromocao tipo={promo.tipo} />
            </div>

            <h3 className="font-black text-gray-900 text-lg leading-tight">{promo.nome}</h3>
            {promo.descricao && <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{promo.descricao}</p>}

            <div className="flex flex-wrap gap-2 mt-4">
                {!!promo.quantidade_pontos && (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">+{promo.quantidade_pontos} pontos</span>
                )}
                {!!promo.desconto_percentual && (
                    <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">{promo.desconto_percentual}% de desconto</span>
                )}
                {!!promo.desconto_valor && (
                    <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">R$ {Number(promo.desconto_valor).toFixed(2)} de desconto</span>
                )}
            </div>

            {promo.condicoes && <p className="text-xs text-gray-400 mt-4">{promo.condicoes}</p>}
            {promo.data_fim && (
                <p className="text-xs text-gray-400 mt-2">Válida até {new Date(promo.data_fim).toLocaleDateString('pt-BR')}</p>
            )}

            {!promo.elegivel && (
                <button
                    onClick={() => router.visit(route('assinatura.status'))}
                    className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition"
                >
                    Ver plano {promo.plano_necessario}
                </button>
            )}
        </div>
    );
}

export default function Promocoes({ promocoes }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-2">
                    <Gift className="w-7 h-7 text-[#FF5A00]" />
                    Promoções
                </h2>
            }
        >
            <Head title="Promoções" />

            <div className="py-8">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    {promocoes.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
                            <Gift className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900">Nenhuma promoção disponível no momento</h3>
                            <p className="text-sm text-gray-500 mt-2">Volte em breve para conferir novas campanhas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {promocoes.map((promo) => <CardPromocao key={promo.id} promo={promo} />)}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
