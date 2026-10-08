import { useRef } from 'react';

/** Seis quadradinhos para digitar o código de entrega. Avança sozinho e aceita colar o código inteiro. */
export default function CodigoSeisDigitos({ valor, onChange, desabilitado = false }) {
    const refs = useRef([]);
    const digitos = Array.from({ length: 6 }, (_, i) => valor[i] || '');

    const atualizar = (indice, texto) => {
        const limpo = texto.replace(/\D/g, '');
        if (limpo.length > 1) {
            onChange(limpo.slice(0, 6));
            refs.current[Math.min(limpo.length, 5)]?.focus();
            return;
        }
        const novo = digitos.map((d, i) => (i === indice ? limpo : d)).join('').replace(/_/g, '');
        onChange(novo.slice(0, 6));
        if (limpo && indice < 5) refs.current[indice + 1]?.focus();
    };

    const apagar = (indice, e) => {
        if (e.key === 'Backspace' && !digitos[indice] && indice > 0) {
            refs.current[indice - 1]?.focus();
        }
    };

    return (
        <div className="flex gap-2" role="group" aria-label="Código de 6 dígitos">
            {digitos.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => (refs.current[i] = el)}
                    value={d}
                    inputMode="numeric"
                    maxLength={1}
                    disabled={desabilitado}
                    onChange={(e) => atualizar(i, e.target.value)}
                    onKeyDown={(e) => apagar(i, e)}
                    onPaste={(e) => { e.preventDefault(); atualizar(i, e.clipboardData.getData('text')); }}
                    className="w-11 h-14 text-center text-2xl font-black font-mono rounded-2xl border-2 border-zinc-200 focus:border-[#FF5A00] focus:ring-0 disabled:opacity-50"
                />
            ))}
        </div>
    );
}
