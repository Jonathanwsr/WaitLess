import { useSyncExternalStore } from 'react';
import { en, es } from './dicionarios';

/**
 * Idiomas das telas do cliente (Português, English, Español).
 * A chave é o próprio texto em português: o que ainda não tiver tradução aparece em português,
 * então nada quebra. A escolha fica no navegador (localStorage + cookie "idioma").
 */
export const IDIOMAS = [
    { id: 'pt', rotulo: 'Português', curto: 'PT', bandeira: '🇧🇷' },
    { id: 'en', rotulo: 'English', curto: 'EN', bandeira: '🇺🇸' },
    { id: 'es', rotulo: 'Español', curto: 'ES', bandeira: '🇪🇸' },
];

const DICIONARIOS = { en, es };
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const ouvintes = new Set();

function inicial() {
    try {
        const salvo = localStorage.getItem('idioma');
        if (salvo && LOCALES[salvo]) return salvo;
        const nav = (navigator.language || 'pt').slice(0, 2);
        return LOCALES[nav] ? nav : 'pt';
    } catch {
        return 'pt';
    }
}

let atual = typeof window === 'undefined' ? 'pt' : inicial();
if (typeof document !== 'undefined') document.documentElement.lang = LOCALES[atual];

export function getIdioma() {
    return atual;
}

export function setIdioma(id) {
    if (!LOCALES[id] || id === atual) return;
    atual = id;
    try {
        localStorage.setItem('idioma', id);
        document.cookie = `idioma=${id};path=/;max-age=31536000;samesite=lax`;
    } catch { /* navegador sem armazenamento */ }
    document.documentElement.lang = LOCALES[id];
    ouvintes.forEach((f) => f());
}

/** Traduz um texto em português; {nome} no texto é trocado por vars.nome. */
export function t(texto, vars) {
    const traduzido = (atual !== 'pt' && DICIONARIOS[atual]?.[texto]) || texto;
    return vars ? traduzido.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : traduzido;
}

export function locale() {
    return LOCALES[atual];
}

/** Hook: re-renderiza a tela quando o idioma muda. */
export function useIdioma() {
    const idioma = useSyncExternalStore(
        (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
        () => atual,
        () => 'pt',
    );

    return { idioma, setIdioma, t, locale: LOCALES[idioma] };
}
