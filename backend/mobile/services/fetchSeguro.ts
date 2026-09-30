/**
 * Blindagem do `fetch` de TODO o app (instalada uma vez no layout raiz):
 *  - tempo limite: sem isso, servidor lento/rede ruim deixa a tela carregando para sempre;
 *  - nova tentativa automática (1x) só em leituras (GET/HEAD) quando a rede falha ou o
 *    servidor responde 502/503/504 — cobre o "servidor acordando" do plano gratuito;
 *  - erro de rede vira uma mensagem clara e um aviso único (sem repetir a cada chamada).
 * Envios (POST/PUT/DELETE) nunca são repetidos sozinhos, para não duplicar cobranças ou reservas.
 */
import { mostrarToast } from './toast';

const TEMPO_LIMITE_MS = 30000;
const TEMPO_LIMITE_UPLOAD_MS = 90000;
const ESPERA_ANTES_DE_REPETIR_MS = 700;
const INTERVALO_AVISO_MS = 10000;

let instalado = false;
let ultimoAviso = 0;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function avisarSemConexao() {
  const agora = Date.now();
  if (agora - ultimoAviso < INTERVALO_AVISO_MS) return;
  ultimoAviso = agora;
  mostrarToast('Sem conexão com o servidor. Verifique sua internet.', 'erro');
}

export function instalarFetchSeguro() {
  if (instalado) return;
  instalado = true;

  const fetchOriginal: typeof fetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const metodo = String(init.method || 'GET').toUpperCase();
    const leitura = metodo === 'GET' || metodo === 'HEAD';
    const upload = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const limite = upload ? TEMPO_LIMITE_UPLOAD_MS : TEMPO_LIMITE_MS;
    const maximoTentativas = leitura ? 2 : 1;

    let ultimoErro: unknown;

    for (let tentativa = 1; tentativa <= maximoTentativas; tentativa++) {
      // Respeita um AbortSignal que a própria tela tenha passado.
      const controlador = init.signal ? null : new AbortController();
      const timer = controlador ? setTimeout(() => controlador.abort(), limite) : null;

      try {
        const res = await fetchOriginal(entrada as any, controlador ? { ...init, signal: controlador.signal } : init);
        if (timer) clearTimeout(timer);

        if (leitura && tentativa < maximoTentativas && [502, 503, 504].includes(res.status)) {
          await dormir(ESPERA_ANTES_DE_REPETIR_MS);
          continue;
        }
        return res;
      } catch (e: any) {
        if (timer) clearTimeout(timer);
        ultimoErro = e;
        // Cancelamento pedido pela própria tela não é falha de rede.
        if (init.signal?.aborted) throw e;
        if (tentativa < maximoTentativas) await dormir(ESPERA_ANTES_DE_REPETIR_MS);
      }
    }

    avisarSemConexao();
    const erro: any = new Error('Não conseguimos falar com o servidor. Verifique sua conexão com a internet e tente de novo.');
    erro.status = 0;
    erro.rede = true;
    erro.causa = ultimoErro;
    throw erro;
  }) as typeof fetch;
}
