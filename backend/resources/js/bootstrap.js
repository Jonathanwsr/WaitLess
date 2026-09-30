import axios from 'axios';
import { tratarErroAxios } from './lib/avisos';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
// Sem tempo limite, uma rede ruim deixa botões "carregando" para sempre.
window.axios.defaults.timeout = 60000;

// Falhas de rede, sessão expirada, sem permissão/Premium e erros do servidor viram avisos claros
// em qualquer chamada axios do site. O erro continua sendo repassado para a tela tratar o seu caso.
window.axios.interceptors.response.use(
    (resposta) => resposta,
    (erro) => {
        try {
            tratarErroAxios(erro);
        } catch (e) {
            console.error('Falha ao exibir aviso de erro:', e);
        }
        return Promise.reject(erro);
    },
);

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
});
