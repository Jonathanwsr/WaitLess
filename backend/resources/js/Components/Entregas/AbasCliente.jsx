import { Link } from '@inertiajs/react';
import { ShoppingBagIcon, ClipboardDocumentListIcon, CalendarDaysIcon, BanknotesIcon } from '@heroicons/react/24/outline';

/** Navegação da área de compras do cliente: catálogo, pedidos, assinaturas e pagamentos mensais. */
const ABAS = [
    { id: 'produtos', rotulo: 'Produtos', rota: 'entregas.index', icone: ShoppingBagIcon },
    { id: 'pedidos', rotulo: 'Meus pedidos', rota: 'entregas.pedidos.meus', icone: ClipboardDocumentListIcon },
    { id: 'assinaturas', rotulo: 'Assinaturas', rota: 'entregas.assinaturas.page', icone: CalendarDaysIcon },
    { id: 'parcelas', rotulo: 'Pagamentos mensais', rota: 'cobrancas.minhas', icone: BanknotesIcon },
];

export default function AbasCliente({ ativa }) {
    const abas = ABAS.filter((a) => route().has(a.rota));

    return (
        <nav aria-label="Área de compras" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {abas.map((a) => {
                const on = a.id === ativa;
                return (
                    <Link
                        key={a.id}
                        href={route(a.rota)}
                        aria-current={on ? 'page' : undefined}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition ${on ? 'bg-zinc-900 text-white shadow-md' : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300 hover:text-zinc-900'}`}
                    >
                        <a.icone className="w-4 h-4" /> {a.rotulo}
                    </Link>
                );
            })}
        </nav>
    );
}
