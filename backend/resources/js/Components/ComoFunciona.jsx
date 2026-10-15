import { useState } from 'react';
import { ChevronDownIcon, LightBulbIcon } from '@heroicons/react/24/outline';

/**
 * Cartão "Como funciona": passo a passo numerado e dicas, que abre e fecha.
 * Lembra no navegador se a pessoa fechou (chave própria por tela), para não ocupar espaço toda vez.
 */
export default function ComoFunciona({ chave, titulo = 'Como funciona', passos = [], dicas = [] }) {
    const storageKey = `lokyva_como_funciona_${chave}`;
    const [aberto, setAberto] = useState(() => {
        try {
            return localStorage.getItem(storageKey) !== 'fechado';
        } catch {
            return true;
        }
    });

    const alternar = () => {
        setAberto((v) => {
            try { localStorage.setItem(storageKey, v ? 'fechado' : 'aberto'); } catch { /* sem storage */ }
            return !v;
        });
    };

    return (
        <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white">
            <button type="button" onClick={alternar} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" aria-expanded={aberto}>
                <span className="flex items-center gap-2 font-bold text-gray-900">
                    <LightBulbIcon className="h-5 w-5 text-[#FF5A00]" /> {titulo}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#FF5A00]">
                    {aberto ? 'Ocultar' : 'Ver passo a passo'}
                    <ChevronDownIcon className={`h-4 w-4 transition ${aberto ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {aberto && (
                <div className="space-y-4 px-5 pb-5">
                    <ol className={`grid gap-3 sm:grid-cols-2 ${passos.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                        {passos.map((p, i) => (
                            <li key={p.titulo} className="rounded-2xl border border-gray-100 bg-white p-4">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF5A00] text-xs font-black text-white">{i + 1}</span>
                                <p className="mt-2 text-sm font-bold text-gray-900">{p.titulo}</p>
                                <p className="mt-1 text-xs leading-relaxed text-gray-600">{p.texto}</p>
                            </li>
                        ))}
                    </ol>
                    {dicas.length > 0 && (
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {dicas.map((d) => (
                                <li key={d} className="flex gap-2 text-xs text-gray-600">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5A00]" /> {d}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
