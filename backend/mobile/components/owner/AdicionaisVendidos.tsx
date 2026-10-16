import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { O } from '../../constants/OwnerTheme';
import { Card, Metrica, api, brl } from './ui';

type Dados = {
  dias: number; unidades: number; receita: number; pedidos_com_adicional: number; ticket_medio_adicionais: number;
  em_servicos: number; em_reservas: number;
  produtos: { produto_id: number; nome: string; quantidade: number; receita: number; pedidos: number }[];
};

const PERIODOS = [7, 30, 90];

/** Quanto os produtos adicionais renderam junto com serviços e reservas. */
export default function AdicionaisVendidos() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Dados | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    api(`/produtos/adicionais-vendidos?dias=${dias}`).then((d) => vivo && setDados(d)).catch(() => {});
    return () => { vivo = false; };
  }, [dias]);

  if (!dados) return null;
  const maior = Math.max(1, ...dados.produtos.map((p) => p.receita));

  return (
    <Card>
      <TouchableOpacity style={s.topo} onPress={() => setAberto((v) => !v)} activeOpacity={0.8} accessibilityRole="button">
        <View style={s.icone}><Ionicons name="bar-chart" size={18} color="#047857" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Adicionais vendidos</Text>
          <Text style={s.sub}>{brl(dados.receita)} em {dias} dias · {dados.unidades} un.</Text>
        </View>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={O.muted} />
      </TouchableOpacity>

      {aberto && (
        <>
          <View style={s.periodos}>
            {PERIODOS.map((p) => (
              <TouchableOpacity key={p} style={[s.periodo, dias === p && s.periodoOn]} onPress={() => setDias(p)}>
                <Text style={[s.periodoTxt, dias === p && { color: '#fff' }]}>{p} dias</Text>
              </TouchableOpacity>
            ))}
          </View>
          {dados.unidades === 0 ? (
            <Text style={s.vazio}>Nenhum adicional vendido no período. Vincule produtos a um serviço ou reserva para o cliente escolher ao agendar.</Text>
          ) : (
            <>
              <View style={s.linha}>
                <Metrica rotulo="Pedidos com adicional" valor={dados.pedidos_com_adicional} icone="receipt-outline" />
                <Metrica rotulo="Média por pedido" valor={brl(dados.ticket_medio_adicionais)} icone="trending-up-outline" tom="positivo" />
              </View>
              <Text style={s.divisao}>Em serviços: {brl(dados.em_servicos)} · Em reservas: {brl(dados.em_reservas)}</Text>
              {dados.produtos.map((p) => (
                <View key={p.produto_id} style={s.prod}>
                  <View style={s.prodLinha}>
                    <Text style={s.prodNome} numberOfLines={1}>{p.nome}</Text>
                    <Text style={s.prodValor}>{brl(p.receita)}</Text>
                  </View>
                  <View style={s.barra}><View style={[s.barraCheia, { width: `${(p.receita / maior) * 100}%` }]} /></View>
                  <Text style={s.prodSub}>{p.quantidade} un. em {p.pedidos} {p.pedidos === 1 ? 'pedido' : 'pedidos'}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 15, fontWeight: '800', color: O.ink },
  sub: { fontSize: 12, color: O.muted, marginTop: 1 },
  periodos: { flexDirection: 'row', gap: 6, marginTop: 14 },
  periodo: { flex: 1, minHeight: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  periodoOn: { backgroundColor: '#059669' },
  periodoTxt: { fontSize: 12, fontWeight: '800', color: O.ink },
  vazio: { fontSize: 13, color: O.muted, marginTop: 12, lineHeight: 19 },
  linha: { flexDirection: 'row', gap: 8, marginTop: 12 },
  divisao: { fontSize: 12, color: O.muted, marginTop: 8 },
  prod: { marginTop: 10 },
  prodLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  prodNome: { flex: 1, fontSize: 14, fontWeight: '700', color: O.ink },
  prodValor: { fontSize: 14, fontWeight: '900', color: O.ink },
  barra: { height: 6, borderRadius: 3, backgroundColor: '#F1F1F3', marginTop: 6, overflow: 'hidden' },
  barraCheia: { height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  prodSub: { fontSize: 11, color: O.muted, marginTop: 3 },
});
