import { IDIOMAS, useIdioma } from '@/i18n';

/** Troca o idioma das telas do cliente (PT / EN / ES). */
export default function SeletorIdioma({ compacto = false, className = '' }) {
    const { idioma, setIdioma, t } = useIdioma();

    return (
        <div className={`inline-flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 ${className}`} role="group" aria-label={t('Idioma')}>
            {IDIOMAS.map((i) => (
                <button
                    key={i.id}
                    type="button"
                    onClick={() => setIdioma(i.id)}
                    aria-pressed={idioma === i.id}
                    title={i.rotulo}
                    className={`min-h-[32px] rounded-lg px-2.5 text-xs font-bold transition ${idioma === i.id ? 'bg-white text-zinc-900 shadow dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                    {compacto ? i.curto : <><span aria-hidden="true">{i.bandeira}</span> {i.curto}</>}
                </button>
            ))}
        </div>
    );
}
