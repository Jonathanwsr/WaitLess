import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    CheckCircleIcon, ClockIcon, XCircleIcon, ArrowUturnLeftIcon,
    ArrowDownTrayIcon, TruckIcon, KeyIcon,
} from '@heroicons/react/24/solid';
import { brl } from '@/lib/produtosEntrega';

const STATUS_INFO = {
    pendente_pagamento: { titulo: 'Aguardando confirmação do pagamento', icone: ClockIcon, cor: 'text-amber-600', bg: 'bg-amber-50' },
    pago: { titulo: 'Pagamento protegido!', icone: CheckCircleIcon, cor: 'text-emerald-600', bg: 'bg-emerald-50' },
    aguardando_confirmacao: { titulo: 'Pedido registrado', icone: ClockIcon, cor: 'text-blue-600', bg: 'bg-blue-50' },
    concluido: { titulo: 'Entrega confirmada', icone: CheckCircleIcon, cor: 'text-emerald-600', bg: 'bg-emerald-50' },
    cancelado: { titulo: 'Pedido cancelado', icone: XCircleIcon, cor: 'text-red-600', bg: 'bg-red-50' },
    estornado: { titulo: 'Pedido estornado', icone: ArrowUturnLeftIcon, cor: 'text-red-600', bg: 'bg-red-50' },
};

export default function Confirmacao({ pedido }) {
    const info = STATUS_INFO[pedido.status] || STATUS_INFO.pendente_pagamento;
    const Icone = info.icone;
    const podeBaixarComprovante = ['pago', 'aguardando_confirmacao', 'concluido'].includes(pedido.status);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><TruckIcon className="w-6 h-6 text-[#FF5A00]" /> Produtos</h2>}>
            <Head title={`Pedido ${pedido.codigo_pedido}`} />

            <div className="max-w-xl mx-auto mt-10 px-4 pb-20">
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">
                    <div className={`w-20 h-20 rounded-full ${info.bg} flex items-center justify-center mx-auto mb-5`}>
                        <Icone className={`w-11 h-11 ${info.cor}`} />
                    </div>
                    <h1 className="text-xl font-black text-gray-900">{info.titulo}</h1>
                    <p className="text-sm text-gray-400 mt-1">Pedido {pedido.codigo_pedido}</p>

                    {pedido.codigo_confirmacao_visivel && (
                        <div className="bg-zinc-900 text-white rounded-2xl p-5 mt-6">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-center gap-1.5">
                                <KeyIcon className="w-3.5 h-3.5" /> Código de entrega
                            </p>
                            <p className="text-4xl font-black tracking-[0.35em] font-mono mt-2">{pedido.codigo_confirmacao_visivel}</p>
                            <p className="text-xs text-zinc-400 mt-2">Mostre este código ao vendedor na {pedido.modo_recebimento === 'entrega' ? 'entrega' : 'busca'}. Só ele libera o pagamento.</p>
                        </div>
                    )}

                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mt-6 text-left space-y-2">
                        <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500">Produto</span>
                            <span className="font-semibold text-gray-900 text-right">{pedido.produto?.nome}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500">Forma de pagamento</span>
                            <span className="font-semibold text-gray-900 text-right">{pedido.forma_pagamento_label}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500">{pedido.modo_recebimento === 'entrega' ? 'Entrega em' : 'Buscar em'}</span>
                            <span className="font-semibold text-gray-900 text-right">{pedido.endereco_recebimento}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                            <span className="font-black text-gray-900">Total</span>
                            <span className="font-black text-[#FF5A00]">{brl(pedido.valor_total)}</span>
                        </div>
                    </div>

                    {pedido.status === 'pendente_pagamento' && (
                        <p className="text-xs text-gray-400 mt-5 leading-relaxed">
                            Assim que o pagamento for aprovado, o código aparece aqui e em "Meus pedidos".
                        </p>
                    )}

                    <Link href={route('entregas.pedidos.meus')} className="block w-full mt-6 bg-[#FF5A00] hover:bg-orange-600 text-white font-black py-3.5 rounded-xl shadow-sm transition">
                        Ver meus pedidos
                    </Link>

                    {podeBaixarComprovante && (
                        <a
                            href={route('entregas.pedidos.comprovante', pedido.id)}
                            className="flex items-center justify-center gap-2 w-full mt-3 border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" /> Baixar comprovante
                        </a>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
