import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreen, Card, Rotulo, Metrica, Segmentado, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { O } from '../../constants/OwnerTheme';

type Painel = {
  periodo_dias: number;
  faturamento: number;
  pedidos: number;
  ticket_medio: number;
  produtos_vendidos: number;
  top_produtos: { produto_entrega_id: number; nome: string; unidades: number; receita: number }[];
  pico_por_hora: { hora: number; pedidos: number }[];
};

const PERIODOS = [
  { id: '7', rotulo: '7 dias' },
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '90 dias' },
];

export default function PainelVendas() {
  const [dias, setDias] = useState('30');

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Painel>(
    () => api(`/entregas/painel-vendas?dias=${dias}`),
    [dias]
  );

  const pico = Array.from({ length: 24 }, (_, h) => dados?.pico_por_hora.find((p) => p.hora === h)?.pedidos || 0);
  const maxPico = Math.max(1, ...pico);
  const maxReceita = Math.max(1, ...(dados?.top_produtos || []).map((p) => p.receita));

  return (
    <OwnerScreen
      titulo="Painel de vendas"
      subtitulo="Entregas de produtos"
      carregando={carregando && !dados}
      atualizando={atualizando}
      onAtualizar={atualizar}
    >
      <Segmentado opcoes={PERIODOS} valor={dias} aoMudar={setDias} />

      {erro && !dados ? (
        <TouchableOpacity onPress={recarregar} style={s.erro}>
          <Text style={s.erroTxt}>Não foi possível carregar. Toque para tentar de novo.</Text>
        </TouchableOpacity>
      ) : dados && (
        <>
          <View style={s.grade}>
            <Metrica rotulo="Faturamento" valor={brl(dados.faturamento)} icone="cash-outline" tom="positivo" largura={160} />
            <Metrica rotulo="Entregas" valor={String(dados.pedidos)} icone="cube-outline" tom="neutro" largura={160} />
            <Metrica rotulo="Ticket médio" valor={brl(dados.ticket_medio)} icone="pricetag-outline" tom="info" largura={160} />
            <Metrica rotulo="Vendidos (total)" valor={String(dados.produtos_vendidos)} icone="bag-handle-outline" tom="neutro" largura={160} />
          </View>

          <Rotulo>Mais vendidos</Rotulo>
          <Card>
            {dados.top_produtos.length === 0 ? (
              <Text style={s.vazio}>Nenhuma entrega concluída neste período.</Text>
            ) : dados.top_produtos.map((p) => (
              <View key={p.produto_entrega_id} style={s.linhaProduto}>
                <View style={s.linhaTopo}>
                  <Text style={s.nomeProduto} numberOfLines={1}>{p.nome}</Text>
                  <Text style={s.meta}>{p.unidades} un · {brl(p.receita)}</Text>
                </View>
                <View style={s.barra}>
                  <View style={[s.barraCheia, { width: `${(p.receita / maxReceita) * 100}%` }]} />
                </View>
              </View>
            ))}
          </Card>

          <Rotulo>Horário de pico</Rotulo>
          <Card>
            <Text style={s.meta}>Pedidos concluídos por hora (Brasília)</Text>
            <View style={s.picoLinha}>
              {pico.map((n, h) => (
                <View key={h} style={s.picoColuna}>
                  <View style={[s.picoBarra, { height: `${Math.max(4, (n / maxPico) * 100)}%`, backgroundColor: n ? O.accent : O.soft }]} />
                </View>
              ))}
            </View>
            <View style={s.eixo}>
              <Text style={s.meta}>0h</Text>
              <Text style={s.meta}>12h</Text>
              <Text style={s.meta}>23h</Text>
            </View>
          </Card>

          <View style={s.dica}>
            <Ionicons name="information-circle-outline" size={16} color={O.muted} />
            <Text style={s.dicaTxt}>Os números contam só entregas concluídas (código de 6 dígitos confirmado).</Text>
          </View>
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  vazio: { color: O.muted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  erro: { padding: 16, borderRadius: 14, backgroundColor: O.dangerBg },
  erroTxt: { color: O.danger, fontWeight: '700', textAlign: 'center' },
  linhaProduto: { gap: 6, marginBottom: 12 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  nomeProduto: { flex: 1, fontSize: 14, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted },
  barra: { height: 8, borderRadius: 4, backgroundColor: O.soft, overflow: 'hidden' },
  barraCheia: { height: 8, borderRadius: 4, backgroundColor: O.accent },
  picoLinha: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3, marginTop: 12 },
  picoColuna: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  picoBarra: { width: '100%', borderRadius: 3 },
  eixo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dica: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },
  dicaTxt: { flex: 1, fontSize: 12, color: O.muted },
});
