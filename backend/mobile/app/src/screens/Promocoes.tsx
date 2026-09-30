import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  blue: '#2563EB',
  blueLight: '#EFF6FF',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Promocao {
  id: number;
  nome: string;
  descricao?: string;
  tipo: string;
  quantidade_pontos?: number | null;
  desconto_percentual?: number | null;
  desconto_valor?: number | null;
  plano_necessario?: string | null;
  data_fim?: string | null;
  condicoes?: string | null;
  elegivel: boolean;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function Promocoes() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);

  const carregar = useCallback(async (isRefresh = false) => {
    isRefresh ? setAtualizando(true) : setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/promocoes`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      setPromocoes(data.promocoes || []);
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

  const iconePorTipo = (tipo: string) => {
    if (tipo === 'pontos_todos' || tipo === 'pontos_plano') return 'diamond-outline';
    if (tipo === 'oferta_assinantes') return 'sparkles-outline';
    return 'pricetag-outline';
  };

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
          {promocoes.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="gift-outline" size={40} color={COLORS.gray} />
              <Text style={styles.emptyText}>Nenhuma promoção disponível no momento.</Text>
            </View>
          ) : (
            promocoes.map((promo) => (
              <View key={promo.id} style={[styles.card, !promo.elegivel && styles.cardBloqueado]}>
                {!promo.elegivel && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={10} color={COLORS.white} />
                    <Text style={styles.lockBadgeText}>Exclusiva {promo.plano_necessario}</Text>
                  </View>
                )}

                <View style={styles.iconBadge}>
                  <Ionicons name={iconePorTipo(promo.tipo) as any} size={22} color={COLORS.primary} />
                </View>

                <Text style={styles.cardNome}>{promo.nome}</Text>
                {!!promo.descricao && <Text style={styles.cardDesc}>{promo.descricao}</Text>}

                <View style={styles.badgesRow}>
                  {!!promo.quantidade_pontos && (
                    <View style={[styles.badge, { backgroundColor: COLORS.successLight }]}>
                      <Text style={[styles.badgeText, { color: COLORS.success }]}>+{promo.quantidade_pontos} pontos</Text>
                    </View>
                  )}
                  {!!promo.desconto_percentual && (
                    <View style={[styles.badge, { backgroundColor: COLORS.blueLight }]}>
                      <Text style={[styles.badgeText, { color: COLORS.blue }]}>{promo.desconto_percentual}% off</Text>
                    </View>
                  )}
                </View>

                {!!promo.data_fim && (
                  <Text style={styles.validadeText}>Válida até {new Date(promo.data_fim).toLocaleDateString('pt-BR')}</Text>
                )}

                {!promo.elegivel && (
                  <TouchableOpacity style={styles.btnVerPlano} onPress={() => router.push('/assinatura' as never)}>
                    <Text style={styles.btnVerPlanoText}>Ver plano {promo.plano_necessario}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
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
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: COLORS.gray, fontWeight: '600', textAlign: 'center' },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 18, marginBottom: 14, position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardBloqueado: { opacity: 0.85 },
  lockBadge: {
    position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.dark, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  lockBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  iconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardNome: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  cardDesc: { fontSize: 13, color: COLORS.gray, marginTop: 4, lineHeight: 19 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  validadeText: { fontSize: 11, color: COLORS.gray, marginTop: 10 },
  btnVerPlano: { marginTop: 14, backgroundColor: COLORS.dark, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnVerPlanoText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
});
