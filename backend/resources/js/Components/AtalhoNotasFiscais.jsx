import { Link } from '@inertiajs/react';
import { DocumentTextIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

/**
 * Atalho para as notas fiscais do sócio, nas telas de dinheiro (Extrato e Carteira):
 * explica em uma linha o que é a nota da comissão e leva direto para ela.
 */
export default function AtalhoNotasFiscais({ compacto = false }) {
    return (
        <Link href={route('notas-fiscais.index', { tipo: 'comissao' })}
            className="group flex items-center gap-4 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white p-4 transition hover:border-orange-200 hover:shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00] text-white">
                <DocumentTextIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-black text-gray-900">Suas notas fiscais</p>
                <p className="text-sm text-gray-600">
                    {compacto
                        ? 'Notas da comissão Lokyva e das suas vendas, prontas para o contador.'
                        : 'A cada venda online, a Lokyva emite para você a nota da comissão dela (a despesa da sua empresa com a plataforma). Baixe o PDF e o XML para o seu contador.'}
                </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-sm font-bold text-[#FF5A00] sm:inline-flex">
                Ver notas <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}
