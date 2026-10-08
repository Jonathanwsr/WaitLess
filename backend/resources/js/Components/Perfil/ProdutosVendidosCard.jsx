import { TruckIcon } from '@heroicons/react/24/outline';

export default function ProdutosVendidosCard({ quantidade = 0, titulo = 'Produtos vendidos' }) {
    return (
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#FF5A00] flex items-center justify-center">
                <TruckIcon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-black text-gray-900 leading-none">{Number(quantidade).toLocaleString('pt-BR')}</p>
                <p className="text-xs font-semibold text-gray-500 mt-1">{titulo} em produtos para entrega e retirada</p>
            </div>
        </div>
    );
}
