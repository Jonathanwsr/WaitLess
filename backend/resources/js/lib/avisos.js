/**
 * Mini barramento de avisos do site: qualquer código (axios, Inertia, páginas) chama
 * `avisar()` e o <AvisosGlobais /> montado no app exibe o toast. Não depende de contexto React.
 */
const ouvintes = new Set();
let contador = 0;

export function avisar({ tipo = 'erro', texto, acao = null, duracao = 6000 }) {
    if (!texto) return;
    const aviso = { id: ++contador, tipo, texto, acao, duracao };
    ouvintes.forEach((o) => o(aviso));
}

export function assinarAvisos(ouvinte) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
}

let ultimoAvisoDeRede = 0;

/** Traduz a falha de uma chamada axios em aviso claro e, quando preciso, age (login, recarregar). */
export function tratarErroAxios(error) {
    const resposta = error?.response;
    const dados = resposta?.data;
    const status = resposta?.status;
    const mensagem = typeof dados?.message === 'string' ? dados.message : (typeof dados?.error === 'string' ? dados.error : null);

    // Cancelamentos propositais não são erro.
    if (error?.code === 'ERR_CANCELED') return;

    if (!resposta) {
        // Sem resposta = rede caiu, servidor fora do ar ou tempo esgotado. Avisa no máximo a cada 8s.
        if (Date.now() - ultimoAvisoDeRede > 8000) {
            ultimoAvisoDeRede = Date.now();
            avisar({ tipo: 'erro', texto: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.' });
        }
        return;
    }

    if (status === 419) {
        avisar({ tipo: 'info', texto: 'Sua página expirou. Vamos recarregar para continuar.', duracao: 2500 });
        setTimeout(() => window.location.reload(), 1600);
        return;
    }

    if (status === 401) {
        avisar({ tipo: 'info', texto: 'Sua sessão expirou. Entre novamente para continuar.', duracao: 2500 });
        setTimeout(() => { window.location.href = '/login'; }, 1600);
        return;
    }

    if (status === 403 && dados?.premium_necessario) {
        avisar({ tipo: 'premium', texto: mensagem || 'Este recurso é exclusivo para assinantes Premium.', acao: { rotulo: 'Seja Premium', href: '/minha-assinatura/status' }, duracao: 9000 });
        return;
    }

    if (status === 403) {
        avisar({ tipo: 'erro', texto: mensagem || 'Você não tem permissão para fazer isso.' });
        return;
    }

    if (status === 429) {
        avisar({ tipo: 'erro', texto: mensagem || 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.' });
        return;
    }

    if (status >= 500) {
        avisar({ tipo: 'erro', texto: mensagem || 'Algo deu errado do nosso lado. Tente novamente em instantes.', duracao: 8000 });
    }
    // 404/422 e demais: cada tela sabe explicar melhor o próprio caso.
}
