import axios from 'axios';
import { router } from '@inertiajs/react';

export const brl = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

export const temDesconto = (produto) =>
    Boolean(produto.tem_promocao) && Number(produto.valor_final) < Number(produto.valor);

export const percentualDesconto = (produto) =>
    Math.round((1 - Number(produto.valor_final) / Number(produto.valor)) * 100);

export const nomeVendedor = (produto) =>
    produto.estabelecimento?.nome || produto.vendedor?.name || 'Vendedor independente';

export async function alternarFavoritoProduto(produtoId) {
    const { data } = await axios.post('/favoritos/toggle', { tipo: 'produto_entrega', id: produtoId });
    return Boolean(data.is_favorito);
}

export function adicionarAoCarrinhoProduto(produtoId, quantidade = 1, opcoes = {}) {
    router.post(
        route('entregas.carrinho.store'),
        { produto_entrega_id: produtoId, quantidade },
        { preserveScroll: true, ...opcoes }
    );
}

export function perguntarAoDono(produtoId) {
    router.post(route('mensagens.iniciar'), { produto_entrega_id: produtoId });
}
