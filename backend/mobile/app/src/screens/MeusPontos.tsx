import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLANOS_CLIENTE } from '../../../constants/planos';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',
  dark: '#282828',
  gray: '#6A6C72',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  border: '#E6E7E9',
  success: '#00A868',
  successLight: '#D1FAE5',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface HistoricoItem {
  id: number;
  tipo: 'ganho' | 'uso' | string;
  descricao: string;
  quantidade: number;
  created_at: string;
  estabelecimento_nome?: string | null;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function MeusPontos() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [nivel, setNivel] = useState<{ nome: string; proximo_nome: string | null; faltam: number; progresso: number } | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const carregar = useCallback(async (isRefresh = false) => {
    isRefresh ? setAtualizando(true) : setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/meus-pontos`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      setSaldo(data.pontos_saldo ?? 0);
      setNivel(data.nivel || null);
      setHistorico(data.historico || []);
    } catch (e) {
      // segue com lista vazia; não é crítico
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 36 }} />
      </View>

      {carregando ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregar(true)} colors={[COLORS.primary]} />}
        >
          <View style={styles.saldoCard}>
            <View style={styles.saldoIconBadge}>
              <Ionicons name="sparkles" size={20} color={COLORS.white} />
            </View>
            <Text style={styles.saldoLabel}>Seus pontos Lokyva</Text>
            <Text style={styles.saldoValor}>{saldo}</Text>
            <Text style={styles.saldoHint}>pontos disponíveis para trocar por recompensas</Text>
          </View>

          {!!nivel && (
            <View style={styles.nivelCard}>
              <View style={styles.nivelTopo}>
                <Ionicons name="ribbon-outline" size={20} color={COLORS.primary} />
                <Text style={styles.nivelNome}>Nível {nivel.nome}</Text>
              </View>
              <View style={styles.nivelBarra}><View style={[styles.nivelBarraOn, { width: `${Math.max(4, nivel.progresso)}%` }]} /></View>
              <Text style={styles.nivelTxt}>
                {nivel.proximo_nome ? `Faltam ${nivel.faltam} pontos ganhos para o nível ${nivel.proximo_nome}` : 'Você chegou ao nível máximo. Parabéns!'}
              </Text>
            </View>
          )}

          <Text style={styles.secaoTitulo}>Como ganhar pontos</Text>
          <View style={styles.ganharGrade}>
            {[
              { icone: 'bag-check-outline', titulo: 'Reservas e serviços', texto: '100 pontos a cada R$ 1,00 gasto' },
              { icone: 'star-outline', titulo: 'Avalie o que usar', texto: 'Ganhe pontos ao avaliar (mais se enviar fotos)' },
              { icone: 'person-add-outline', titulo: 'Indique amigos', texto: '500 pontos por amigo que reservar' },
              { icone: 'flash-outline', titulo: 'Check-in diário', texto: 'Toque em "Estou usando" todo dia' },
            ].map((item) => (
              <View key={item.titulo} style={styles.ganharCard}>
                <View style={styles.ganharIcone}><Ionicons name={item.icone as any} size={20} color={COLORS.primary} /></View>
                <Text style={styles.ganharTitulo}>{item.titulo}</Text>
                <Text style={styles.ganharTxt}>{item.texto}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.convite} onPress={() => router.push('/src/screens/Gamificacao' as never)} activeOpacity={0.85}>
            <View style={styles.conviteIcone}><Ionicons name="flash-outline" size={22} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.conviteTitulo}>Check-in diário e sugestões</Text>
              <Text style={styles.conviteTexto}>Toque em "Estou usando" ou envie uma sugestão e ganhe pontos hoje.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.convite} onPress={() => router.push('/src/screens/Indicacao' as never)} activeOpacity={0.85}>
            <View style={styles.conviteIcone}><Ionicons name="people-outline" size={22} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.conviteTitulo}>Convide amigos, ganhe pontos</Text>
              <Text style={styles.conviteTexto}>Você e seu amigo ganham pontos na primeira reserva dele.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
          </TouchableOpacity>

          <Text style={styles.secaoTitulo}>Planos e benefícios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            <View style={styles.planoCard}>
              <Text style={styles.planoNome}>Grátis</Text>
              <Text style={styles.planoPreco}>R$ 0<Text style={styles.planoPrecoCiclo}>/sempre</Text></Text>
              <View style={{ gap: 8, marginTop: 14, marginBottom: 16 }}>
                <View style={styles.planoBeneficio}><Ionicons name="checkmark" size={14} color={COLORS.success} /><Text style={styles.planoBeneficioTxt}>Ganhe pontos em reservas</Text></View>
                <View style={styles.planoBeneficio}><Ionicons name="checkmark" size={14} color={COLORS.success} /><Text style={styles.planoBeneficioTxt}>Acesso ao catálogo completo</Text></View>
              </View>
              <View style={[styles.planoBtn, styles.planoBtnAtual]}><Text style={[styles.planoBtnTxt, { color: COLORS.gray }]}>Seu plano atual</Text></View>
            </View>
            {PLANOS_CLIENTE.map((p) => (
              <View key={p.id} style={[styles.planoCard, p.destaque && styles.planoCardDestaque]}>
                {!!p.badge && (
                  <View style={styles.planoBadge}><Text style={styles.planoBadgeTxt}>{p.badge}</Text></View>
                )}
                <Text style={styles.planoNome}>{p.nome}</Text>
                <Text style={styles.planoPreco}>R$ {p.preco}<Text style={styles.planoPrecoCiclo}>/{p.ciclo === 'mensal' ? 'mês' : 'ano'}</Text></Text>
                <View style={{ gap: 8, marginTop: 14, marginBottom: 16 }}>
                  {p.beneficios.slice(0, 4).map((b) => (
                    <View key={b} style={styles.planoBeneficio}><Ionicons name="checkmark" size={14} color={COLORS.success} /><Text style={styles.planoBeneficioTxt}>{b}</Text></View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.planoBtn, p.destaque && { backgroundColor: COLORS.primary }]} onPress={() => router.push('/assinatura' as never)} activeOpacity={0.85}>
                  <Text style={[styles.planoBtnTxt, p.destaque && { color: '#fff' }]}>Assinar plano</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Histórico</Text>

          {historico.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="time-outline" size={40} color={COLORS.gray} />
              <Text style={styles.emptyText}>Você ainda não tem pontos registrados.</Text>
            </View>
          ) : (
            historico.map((item) => {
              const ganho = item.tipo === 'ganho';
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={[styles.itemIconBadge, { backgroundColor: ganho ? COLORS.successLight : COLORS.dangerLight }]}>
                    <Ionicons
                      name={ganho ? 'add-circle-outline' : 'remove-circle-outline'}
                      size={20}
                      color={ganho ? COLORS.success : COLORS.danger}
                    />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemDescricao} numberOfLines={2}>{item.descricao}</Text>
                    <Text style={styles.itemMeta}>
                      {item.estabelecimento_nome || 'Plataforma Lokyva'} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={[styles.itemQuantidade, { color: ganho ? COLORS.success : COLORS.danger }]}>
                    {ganho ? '+' : '-'}{item.quantidade}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: COLORS.gray, fontWeight: '600', textAlign: 'center' },

  convite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 20, padding: 14, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  conviteIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  conviteTitulo: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  conviteTexto: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  nivelCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  nivelTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nivelNome: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  nivelBarra: { height: 10, borderRadius: 5, backgroundColor: '#F0F0F2', marginTop: 12, overflow: 'hidden' },
  nivelBarraOn: { height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  nivelTxt: { fontSize: 12, color: COLORS.gray, marginTop: 8 },
  secaoTitulo: { fontSize: 14, fontWeight: '800', color: COLORS.dark, marginTop: 20, marginBottom: 10 },
  ganharGrade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ganharCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  ganharIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ganharTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.dark },
  ganharTxt: { fontSize: 11, color: COLORS.gray, marginTop: 4, lineHeight: 16 },
  saldoCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  saldoIconBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  saldoValor: { color: COLORS.white, fontSize: 48, fontWeight: '800', marginTop: 6, letterSpacing: -1 },
  saldoHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', marginTop: 4 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.dark, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  itemIconBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemInfo: { flex: 1, marginRight: 8 },
  itemDescricao: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  itemMeta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  itemQuantidade: { fontSize: 16, fontWeight: '800' },

  planoCard: { width: 190, backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  planoCardDestaque: { borderColor: COLORS.primary, borderWidth: 2 },
  planoBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  planoBadgeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },
  planoNome: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  planoPreco: { fontSize: 22, fontWeight: '800', color: COLORS.dark, marginTop: 4 },
  planoPrecoCiclo: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  planoBeneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  planoBeneficioTxt: { flex: 1, fontSize: 11, color: COLORS.gray, lineHeight: 15 },
  planoBtn: { height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray },
  planoBtnAtual: { backgroundColor: COLORS.lightGray },
  planoBtnTxt: { fontSize: 12, fontWeight: '800', color: COLORS.dark },
});
