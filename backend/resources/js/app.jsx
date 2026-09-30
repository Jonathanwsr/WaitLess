import '../css/app.css';
import './bootstrap';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './Components/ErrorBoundary';
import AvisosGlobais from './Components/AvisosGlobais';
import { avisar } from './lib/avisos';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Depois de um novo deploy/build, o navegador pode ainda ter em memória o
// nome do arquivo JS antigo de uma página (code-splitting do Vite). Ao
// navegar pra essa página, o import() falha (arquivo não existe mais) e a
// tela ficava em branco sem explicação. Detecta esse caso específico e força
// um reload completo, que busca a versão atual.
router.on('exception', (event) => {
    const mensagem = String(event?.detail?.exception?.message || '');
    if (/dynamically imported module|Failed to fetch|Importing a module script failed/i.test(mensagem)) {
        event.preventDefault();
        window.location.reload();
    }
});

// Falha de rede ao navegar/enviar formulário (Inertia): aviso claro em vez de nada acontecer.
router.on('networkError', () => {
    avisar({ tipo: 'erro', texto: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.' });
});

// Resposta que não é uma página do app (ex.: erro cru do servidor/proxy): sem o modal com HTML cru.
router.on('invalid', (event) => {
    event.preventDefault();
    avisar({ tipo: 'erro', texto: 'Algo deu errado do nosso lado. Tente novamente em instantes.' });
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ErrorBoundary>
                <App {...props} />
                <AvisosGlobais />
            </ErrorBoundary>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
