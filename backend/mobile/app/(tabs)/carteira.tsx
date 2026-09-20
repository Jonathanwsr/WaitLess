// A aba "Carteira" mostra a gestão de assinatura/plano do usuário — mesmo
// catálogo de planos (constants/planos.ts) e mesmos endpoints usados na tela
// de assinatura acessível também via /assinatura, evitando duas
// implementações divergentes do mesmo fluxo.
export { default } from '../assinatura';
