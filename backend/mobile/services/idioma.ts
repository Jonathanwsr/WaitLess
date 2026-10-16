import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, es } from './idiomaDicionarios';

/**
 * Idiomas das telas do cliente no app (Português, English, Español).
 * A chave é o texto em português: sem tradução, aparece em português — nada quebra.
 * A escolha fica salva no aparelho.
 */
export type Idioma = 'pt' | 'en' | 'es';

export const IDIOMAS: { id: Idioma; rotulo: string; bandeira: string }[] = [
  { id: 'pt', rotulo: 'Português', bandeira: '🇧🇷' },
  { id: 'en', rotulo: 'English', bandeira: '🇺🇸' },
  { id: 'es', rotulo: 'Español', bandeira: '🇪🇸' },
];

const DICIONARIOS: Record<string, Record<string, string>> = { en, es };
const LOCALES: Record<Idioma, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const CHAVE = '@lokyva_idioma';

let atual: Idioma = 'pt';
const ouvintes = new Set<() => void>();

// Carrega a escolha salva assim que o app abre.
AsyncStorage.getItem(CHAVE)
  .then((v) => {
    if (v === 'en' || v === 'es' || v === 'pt') {
      atual = v;
      ouvintes.forEach((f) => f());
    }
  })
  .catch(() => {});

export function idiomaAtual(): Idioma {
  return atual;
}

export function mudarIdioma(id: Idioma) {
  if (id === atual) return;
  atual = id;
  AsyncStorage.setItem(CHAVE, id).catch(() => {});
  ouvintes.forEach((f) => f());
}

/** Traduz um texto em português; {n} é trocado por vars.n. */
export function t(texto: string, vars?: Record<string, string | number | null | undefined>): string {
  const traduzido = (atual !== 'pt' && DICIONARIOS[atual]?.[texto]) || texto;
  return vars ? traduzido.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : traduzido;
}

/** Hook: a tela re-renderiza quando o idioma muda. */
export function useIdioma() {
  const idioma = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => atual,
    () => atual,
  );
  return { idioma, mudarIdioma, t, locale: LOCALES[idioma] };
}
