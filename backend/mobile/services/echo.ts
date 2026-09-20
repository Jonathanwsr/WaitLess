import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore - laravel-echo espera Pusher disponível globalmente, igual ao bootstrap.js do web
global.Pusher = Pusher;

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
// API_URL termina em ".../api/mobile" — a raiz da API (sem o prefixo /mobile) é onde vive o endpoint de auth.
const API_ROOT = API_URL.replace(/\/mobile$/, '');

const REVERB_HOST = process.env.EXPO_PUBLIC_REVERB_HOST || 'localhost';
const REVERB_PORT = Number(process.env.EXPO_PUBLIC_REVERB_PORT || 8080);
const REVERB_SCHEME = process.env.EXPO_PUBLIC_REVERB_SCHEME || 'http';
const REVERB_APP_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY || '';

let instanciaEcho: Echo<'reverb'> | null = null;

/**
 * Cria (ou reaproveita) a conexão com o Reverb, autenticando canais privados
 * via token Sanctum do usuário logado — equivalente mobile do window.Echo do web.
 */
export async function obterEcho(): Promise<Echo<'reverb'>> {
  if (instanciaEcho) {
    return instanciaEcho;
  }

  const token = (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));

  instanciaEcho = new Echo({
    broadcaster: 'reverb',
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${API_ROOT}/mobile/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  });

  return instanciaEcho;
}

export function encerrarEcho() {
  if (instanciaEcho) {
    instanciaEcho.disconnect();
    instanciaEcho = null;
  }
}
