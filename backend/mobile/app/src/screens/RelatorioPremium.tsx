import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../../constants/ClientTheme';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const brl = (v: unknown) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Resumo {
  total_gasto: number; total_gasto_servicos: number; total_gasto_locacoes: number;
  total_reservas: number; total_servicos: number; total_locacoes: number;
  total_economizado: number; avaliacoes_feitas: number;
  pontos_ganhos: number; pontos_usados: number; pontos_saldo_atual: number;
}
interface MesGasto { mes: string; valor: number }
interface Favorito { nome: string; visitas: number }
interface Categoria { nome: string; quantidade: number }

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function RelatorioPremium() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [gastoPorMes, setGastoPorMes] = useState<MesGasto[]>([]);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/relatorio-premium`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });

      if (res.status === 403) {
        setBloqueado(true);
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setBloqueado(false);
        setResumo(data.resumo);
        setGastoPorMes(data.gasto_por_mes || []);
        setFavoritos(data.estabelecimentos_favoritos || []);
        setCategorias(data.categorias_mais_usadas || []);
      }
    } catch {
      // mantém tela vazia; não é crítico
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  if (carregando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (bloqueado) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.voltar}><Ionicons name="chevron-back" size={22} color={T.ink} /></TouchableOpacity>
          <Text style={s.headerTitulo}>Relatório Premium</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.centro}>
          <View style={s.upsellIcone}><Ionicons name="bar-chart" size={34} color={T.primary} /></View>
          <Text style={s.upsellTitulo}>Exclusivo para assinantes Premium</Text>
          <Text style={s.upsellTxt}>Assine um plano Premium para ver um relatório completo com gastos, economia e seus lugares favoritos.</Text>
          <TouchableOpacity style={s.upsellBtn} onPress={() => router.push('/assinatura' as never)} activeOpacity={0.85}>
            <Text style={s.upsellBtnTxt}>Ver planos Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const maiorGastoMensal = Math.max(1, ...gastoPorMes.map((m) => m.valor));
  const maiorVisita = Math.max(1, ...favoritos.map((f) => f.visitas));
  const maiorCategoria = Math.max(1, ...categorias.map((c) => c.quantidade));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}><Ionicons name="chevron-back" size={22} color={T.ink} /></TouchableOpacity>
        <Text style={s.headerTitulo}>Relatório Premium</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* RESUMO */}
        <View style={s.grid}>
          <View style={s.tile}>
            <Text style={s.tileRotulo}>Total gasto</Text>
            <Text style={s.tileValor}>{brl(resumo?.total_gasto)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileRotulo}>Reservas feitas</Text>
            <Text style={s.tileValor}>{resumo?.total_reservas ?? 0}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileRotulo}>Você economizou</Text>
            <Text style={[s.tileValor, { color: T.success }]}>{brl(resumo?.total_economizado)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileRotulo}>Pontos (saldo atual)</Text>
            <Text style={s.tileValor}>{resumo?.pontos_saldo_atual ?? 0}</Text>
          </View>
        </View>

        <View style={s.linhaResumo}>
          <Ionicons name="trending-up-outline" size={16} color={T.success} />
          <Text style={s.linhaResumoTxt}>{resumo?.pontos_ganhos ?? 0} pontos ganhos · {resumo?.pontos_usados ?? 0} pontos usados · {resumo?.avaliacoes_feitas ?? 0} avaliações feitas</Text>
        </View>

        {/* GRÁFICO: GASTO POR MÊS */}
        <Text style={s.secaoTitulo}>Gasto nos últimos 6 meses</Text>
        <View style={s.cartao}>
          <View style={s.barrasLinha}>
            {gastoPorMes.map((m) => (
              <View key={m.mes} style={s.barraCol}>
                <Text style={s.barraValor}>{m.valor > 0 ? brl(m.valor).replace('R$ ', '').replace('R$ ', '') : ''}</Text>
                <View style={s.barraTrilho}>
                  <View style={[s.barraPreenchida, { height: `${Math.max(4, (m.valor / maiorGastoMensal) * 100)}%` }]} />
                </View>
                <Text style={s.barraRotulo}>{m.mes}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ESTABELECIMENTOS FAVORITOS */}
        {favoritos.length > 0 && (
          <>
            <Text style={s.secaoTitulo}>Seus lugares favoritos</Text>
            <View style={s.cartao}>
              {favoritos.map((f) => (
                <View key={f.nome} style={{ marginBottom: 12 }}>
                  <View style={s.rankLinha}>
                    <Text style={s.rankNome} numberOfLines={1}>{f.nome}</Text>
                    <Text style={s.rankValor}>{f.visitas}x</Text>
                  </View>
                  <View style={s.rankTrilho}><View style={[s.rankPreenchido, { width: `${Math.max(6, (f.visitas / maiorVisita) * 100)}%` }]} /></View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* CATEGORIAS MAIS USADAS */}
        {categorias.length > 0 && (
          <>
            <Text style={s.secaoTitulo}>Categorias que você mais usa</Text>
            <View style={s.cartao}>
              {categorias.map((c) => (
                <View key={c.nome} style={{ marginBottom: 12 }}>
                  <View style={s.rankLinha}>
                    <Text style={s.rankNome} numberOfLines={1}>{c.nome}</Text>
                    <Text style={s.rankValor}>{c.quantidade}</Text>
                  </View>
                  <View style={s.rankTrilho}><View style={[s.rankPreenchido, { width: `${Math.max(6, (c.quantidade / maiorCategoria) * 100)}%`, backgroundColor: T.success }]} /></View>
                </View>
              ))}
            </View>
          </>
        )}

        {(resumo?.total_reservas ?? 0) === 0 && (
          <View style={s.cartao}>
            <Text style={{ color: T.muted, textAlign: 'center' }}>Ainda não há reservas suficientes para montar seu relatório.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.cream, padding: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: T.ink },

  upsellIcone: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  upsellTitulo: { fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' },
  upsellTxt: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 22, paddingHorizontal: 12 },
  upsellBtn: { backgroundColor: T.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 26 },
  upsellBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  tile: { width: '48%', backgroundColor: T.card, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tileRotulo: { fontSize: 11, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValor: { fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 4 },

  linhaResumo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 20 },
  linhaResumoTxt: { flex: 1, fontSize: 12, color: T.muted, fontWeight: '600' },

  secaoTitulo: { fontSize: 15, fontWeight: '800', color: T.ink, marginBottom: 10, marginTop: 4 },
  cartao: { backgroundColor: T.card, borderRadius: 20, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },

  barrasLinha: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  barraCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraValor: { fontSize: 9, color: T.muted, fontWeight: '700', marginBottom: 4 },
  barraTrilho: { width: 18, flex: 1, backgroundColor: T.cream, borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  barraPreenchida: { width: '100%', backgroundColor: T.primary, borderRadius: 9, minHeight: 4 },
  barraRotulo: { fontSize: 10, color: T.muted, fontWeight: '700', marginTop: 6 },

  rankLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankNome: { flex: 1, fontSize: 13, fontWeight: '700', color: T.ink, marginRight: 8 },
  rankValor: { fontSize: 13, fontWeight: '800', color: T.ink },
  rankTrilho: { height: 8, borderRadius: 4, backgroundColor: T.cream, overflow: 'hidden' },
  rankPreenchido: { height: '100%', borderRadius: 4, backgroundColor: T.primary },
});
