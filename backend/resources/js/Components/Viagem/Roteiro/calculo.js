// Mesmas regras do RoteiroViagemService::montar(): numeração para o mapa, distância/tempo até o próximo item
// e custo por dia. Serve para a tela reagir na hora quando o usuário arrasta ou move itens; ao salvar, o servidor
// recalcula tudo (inclusive o custo das locações) e devolve os valores oficiais.

export const PERIODOS_ORDEM = ['manha', 'tarde', 'noite'];
const LIMITE_A_PE_KM = 1.5;

export function distanciaKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    const r = 6371;
    const rad = (g) => (g * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function minutos(km) {
    if (km <= LIMITE_A_PE_KM) return Math.max(1, Math.round((km / 4.5) * 60));
    return Math.max(5, Math.round(((km * 1.3) / 30) * 60 + 5));
}

let contador = 0;
export const novaChave = () => `k${Date.now().toString(36)}${(contador++).toString(36)}`;

/** Garante uma chave estável em cada item (para arrastar/soltar e para o React). */
export function comChaves(dias) {
    return dias.map((d) => ({
        ...d,
        periodos: Object.fromEntries(PERIODOS_ORDEM.map((p) => [p, (d.periodos?.[p] || []).map((i) => ({ ...i, _k: i._k || novaChave() }))])),
    }));
}

const ehFixo = (i) => i.tipo === 'locacao' && ['hospedagem', 'veiculos'].includes(i.categoria);

export function recalcular(roteiro, dias) {
    const base = roteiro.partida_latitude != null
        ? { lat: Number(roteiro.partida_latitude), lng: Number(roteiro.partida_longitude) }
        : { lat: Number(roteiro.latitude), lng: Number(roteiro.longitude) };
    const todos = dias.flatMap((d) => PERIODOS_ORDEM.flatMap((p) => d.periodos[p]));
    const totalDias = Math.max(1, dias.length);
    const noites = Math.max(1, totalDias - 1);
    const hosp = todos.find((i) => i.tipo === 'locacao' && i.categoria === 'hospedagem' && i.latitude != null);
    const inicio = roteiro.partida === 'hospedagem' && hosp ? { lat: Number(hosp.latitude), lng: Number(hosp.longitude) } : base;
    const porNoite = todos.filter((i) => ehFixo(i) && i.categoria === 'hospedagem').reduce((s, i) => s + Number(i.custo_estimado || 0), 0) / noites;
    const porDiaVeiculo = todos.filter((i) => ehFixo(i) && i.categoria === 'veiculos').reduce((s, i) => s + Number(i.custo_estimado || 0), 0) / totalDias;

    let total = 0;
    const novosDias = dias.map((d, idx) => {
        let pos = inicio;
        let numero = 0;
        let custo = 0;
        const periodos = {};
        PERIODOS_ORDEM.forEach((p) => {
            periodos[p] = d.periodos[p].map((i) => {
                let km = null;
                let num = null;
                if (i.latitude != null && i.longitude != null) {
                    numero += 1;
                    num = numero;
                    const ponto = { lat: Number(i.latitude), lng: Number(i.longitude) };
                    km = distanciaKm(pos, ponto);
                    pos = ponto;
                }
                const c = Number(i.custo_estimado || 0);
                total += c;
                if (!ehFixo(i)) custo += c;
                return {
                    ...i,
                    numero: num,
                    distancia_km: km == null ? null : Math.round(km * 10) / 10,
                    minutos: km == null ? null : minutos(km),
                    modo: km == null ? null : km <= LIMITE_A_PE_KM ? 'a_pe' : 'carro',
                    aviso_horario: i.tipo === 'ponto_turistico' ? 'Confira o horário de funcionamento' : null,
                };
            });
        });
        custo += (idx < noites ? porNoite : 0) + porDiaVeiculo;
        return { ...d, periodos, custo: Math.round(custo * 100) / 100 };
    });

    const orcamento = roteiro.orcamento ? Number(roteiro.orcamento) : null;
    return {
        dias: novosDias,
        resumo: {
            total: Math.round(total * 100) / 100,
            por_pessoa: Math.round((total / Math.max(1, Number(roteiro.pessoas || 1))) * 100) / 100,
            orcamento,
            passou_orcamento: !!orcamento && total > orcamento,
            diferenca: orcamento ? Math.round((orcamento - total) * 100) / 100 : null,
            locacoes: todos.filter((i) => i.tipo === 'locacao').length,
        },
    };
}

/** Corpo do POST/PUT /roteiros a partir do estado da tela. */
export function paraSalvar(roteiro, dias) {
    const campos = ['tipo', 'periodo', 'hora', 'titulo', 'descricao', 'latitude', 'longitude', 'link', 'imagem', 'servico_id', 'item_aluguel_id', 'custo_estimado', 'anotacao'];
    return {
        titulo: roteiro.titulo,
        destino: roteiro.destino,
        estado: roteiro.estado,
        latitude: roteiro.latitude,
        longitude: roteiro.longitude,
        data_inicio: roteiro.data_inicio,
        data_fim: roteiro.data_fim,
        pessoas: roteiro.pessoas,
        orcamento: roteiro.orcamento,
        interesses: roteiro.interesses || [],
        partida: roteiro.partida,
        dias: dias.map((d) => ({
            itens: PERIODOS_ORDEM.flatMap((p) => d.periodos[p].map((i) => Object.fromEntries(campos.map((c) => [c, c === 'periodo' ? p : i[c] ?? null])))),
        })),
    };
}
