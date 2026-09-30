// Tipo estrutural mínimo (em vez de importar o tipo interno do expo-router):
// só precisamos do que o `useRouter()` já garante existir.
type RouterComoLogin = {
  canGoBack: () => boolean;
  back: () => void;
  // `any` de propósito: o expo-router tipa `replace` com uma união estrita de
  // rotas válidas (Href), e essa função é chamada a partir de telas em pastas
  // diferentes — tipar como `string` aqui entraria em conflito de variância
  // com esse tipo estrito ao passar o router de cada tela.
  replace: (href: any) => void;
};

/**
 * Leva pra tela de login sem deixar rastro no histórico de navegação.
 *
 * `router.replace('/autenticacao/login')` sozinho só troca a tela ATUAL da
 * pilha — tudo que veio antes (Home, Perfil, etc.) continua embaixo dela. Por
 * isso, ao apertar "voltar" na tela de login logo depois de sair da conta, o
 * app caía de volta numa tela autenticada, com dados antigos na tela, dando
 * a impressão de que a sessão ainda estava ativa mesmo com o token já limpo.
 * Isso esvazia a pilha inteira antes de entrar no login, então não sobra
 * nada pra "voltar".
 */
export function irParaLoginSemVoltar(router: RouterComoLogin) {
  // Limite de segurança: evita travar o app num loop infinito caso
  // `canGoBack()` não reflita a pilha na hora (atualização de estado assíncrona).
  for (let tentativas = 0; tentativas < 30 && router.canGoBack(); tentativas++) {
    router.back();
  }
  router.replace('/autenticacao/login');
}
