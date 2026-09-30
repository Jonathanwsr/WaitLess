import { useEffect, useState } from 'react';
import { assinarAvisos } from '@/lib/avisos';

const ESTILO = {
    erro: { barra: 'bg-red-500', icone: '!' , fundo: 'bg-white' },
    info: { barra: 'bg-blue-500', icone: 'i', fundo: 'bg-white' },
    sucesso: { barra: 'bg-emerald-500', icone: '✓', fundo: 'bg-white' },
    premium: { barra: 'bg-amber-400', icone: '★', fundo: 'bg-white' },
};

/** Pilha de avisos no canto da tela (erros de rede/sessão/permissão e convites Premium). */
export default function AvisosGlobais() {
    const [avisos, setAvisos] = useState([]);

    useEffect(() => assinarAvisos((novo) => {
        setAvisos((atuais) => [...atuais.filter((a) => a.texto !== novo.texto).slice(-3), novo]);
        setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== novo.id)), novo.duracao);
    }), []);

    if (avisos.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] flex flex-col gap-3 pointer-events-none" role="status" aria-live="polite">
            {avisos.map((a) => {
                const e = ESTILO[a.tipo] || ESTILO.erro;
                return (
                    <div key={a.id} className={`pointer-events-auto flex items-stretch overflow-hidden rounded-2xl shadow-xl border border-gray-100 ${e.fundo}`}>
                        <div className={`${e.barra} w-12 shrink-0 flex items-center justify-center text-white font-black text-lg`}>{e.icone}</div>
                        <div className="flex-1 px-4 py-3">
                            <p className="text-sm font-semibold text-gray-800 leading-snug">{a.texto}</p>
                            {a.acao && (
                                <a href={a.acao.href} className="inline-block mt-2 text-xs font-black text-white bg-[#FF5A00] hover:bg-orange-600 px-3 py-1.5 rounded-full transition">
                                    {a.acao.rotulo}
                                </a>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setAvisos((atuais) => atuais.filter((x) => x.id !== a.id))}
                            className="px-3 text-gray-300 hover:text-gray-600 text-lg leading-none"
                            aria-label="Fechar aviso"
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
