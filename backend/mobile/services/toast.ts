/**
 * Avisos rápidos na tela ("Favorito adicionado", "Removido dos favoritos"...).
 * Um mini barramento de eventos: qualquer tela chama mostrarToast() e o
 * <ToastHost /> do layout raiz exibe — não depende de contexto React.
 */
export type TipoToast = 'sucesso' | 'info' | 'erro';
export type ToastMsg = { id: number; texto: string; tipo: TipoToast };

type Ouvinte = (t: ToastMsg) => void;
const ouvintes = new Set<Ouvinte>();
let contador = 0;

export function mostrarToast(texto: string, tipo: TipoToast = 'sucesso') {
  const msg: ToastMsg = { id: ++contador, texto, tipo };
  ouvintes.forEach((o) => o(msg));
}

export function assinarToast(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}
