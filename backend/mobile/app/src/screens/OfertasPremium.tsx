import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  dark: '#0F172A',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  error: '#DC2626',
  blue: '#2563EB',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Oferta {
  id: number | string;
  tipo: 'servico' | 'reserva' | 'produto';
  nome: string;
  descricao?: string;
  fotos?: string[];
  estabelecimento?: { name?: string; nome?: string };
  somente_premium: boolean;
  tem_promocao: boolean;
  aceita_pontos?: boolean;
  maximo_pontos_permitidos?: number | null;
  valor_original: number;
  valor_com_desconto: number;
  bloqueado: boolean;
}

export default function OfertasPremium() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [planoAtual, setPlanoAtual] = useState<string | null>(null);
  const [servicos, setServicos] = useState<Oferta[]>([]);
  const [reservas, setReservas] = useState<Oferta[]>([]);
  const [produtos, setProdutos] = useState<Oferta[]>([]);

  const carregarOfertas = useCallback(async (isRefresh = false) => {
    isRefresh ? setAtualizando(true) : setCarregando(true);
    setErro(null);

    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      if (!token) {
        router.replace('/autenticacao/login' as never);
        return;
      }

      const res = await fetch(`${API_URL}/explorar/ofertas-premium`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setErro(data?.message || 'Não foi possível carregar as ofertas agora.');
        return;
      }

      setIsPremium(!!data.isPremium);
      setPlanoAtual(data.planoAtual || null);
      setServicos(data.servicos || []);
      setReservas(data.itensAluguel || []);
      setProdutos(data.produtos || []);
    } catch (e) {
      setErro('Verifique sua conexão com a internet e tente novamente.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [router]);

  useEffect(() => {
    carregarOfertas();
  }, [carregarOfertas]);

  const totalOfertas = servicos.length + reservas.length + produtos.length;

  const CardOferta = ({ oferta }: { oferta: Oferta }) => {
    const capa = oferta.fotos && oferta.fotos.length > 0 ? oferta.fotos[0] : null;
    const temDesconto = oferta.tem_promocao && oferta.valor_com_desconto < oferta.valor_original;

    return (
      <View style={styles.card}>
        <View style={styles.cardImageWrap}>
          {capa ? (
            <Image source={{ uri: capa }} style={[styles.cardImage, oferta.bloqueado && { opacity: 0.4 }]} />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
              <Ionicons name="image-outline" size={28} color={COLORS.gray} />
            </View>
          )}

          <View style={styles.badgesRow}>
            {oferta.somente_premium && (
              <View style={styles.badgePremium}>
                <Ionicons name="star" size={10} color={COLORS.white} />
                <Text style={styles.badgeText}>Premium</Text>
              </View>
            )}
            {temDesconto && (
              <View style={styles.badgeDesconto}>
                <Text style={styles.badgeText}>Desconto</Text>
              </View>
            )}
          </View>

          {oferta.bloqueado && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={22} color={COLORS.white} />
              <Text style={styles.lockText}>Exclusivo Premium</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardEstabelecimento} numberOfLines={1}>
            {oferta.estabelecimento?.name || oferta.estabelecimento?.nome || 'Estabelecimento'}
          </Text>
          <Text style={styles.cardNome} numberOfLines={2}>{oferta.nome}</Text>

          <View style={styles.cardFooter}>
            <View>
              {temDesconto && !oferta.bloqueado && (
                <Text style={styles.precoOriginal}>R$ {Number(oferta.valor_original).toFixed(2)}</Text>
              )}
              <Text style={styles.precoFinal}>
                R$ {Number(oferta.bloqueado ? oferta.valor_original : oferta.valor_com_desconto).toFixed(2)}
              </Text>
            </View>
            {!!oferta.maximo_pontos_permitidos && (
              <Text style={styles.pontosTexto}>até {oferta.maximo_pontos_permitidos} pts</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const Secao = ({ titulo, itens }: { titulo: string; itens: Oferta[] }) => {
    if (itens.length === 0) return null;
    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.sectionTitle}>{titulo}</Text>
        <View style={styles.cardsGrid}>
          {itens.map((oferta) => <CardOferta key={`${oferta.tipo}-${oferta.id}`} oferta={oferta} />)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ofertas Premium</Text>
        <View style={{ width: 36 }} />
      </View>

      {carregando ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : erro ? (
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.gray} />
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => carregarOfertas()}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregarOfertas(true)} colors={[COLORS.primary]} />}
        >
          {!isPremium && (
            <View style={styles.ctaBox}>
              <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.ctaTitle}>Desbloqueie as ofertas exclusivas</Text>
                <Text style={styles.ctaSubtitle}>Assine o Premium e libere os descontos marcados com o selo Premium.</Text>
              </View>
              <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/assinatura' as never)}>
                <Text style={styles.ctaButtonText}>Assinar</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPremium && planoAtual && (
            <View style={styles.premiumBanner}>
              <Ionicons name="star" size={16} color={COLORS.primary} />
              <Text style={styles.premiumBannerText}>Você está no plano {planoAtual} — ofertas já liberadas.</Text>
            </View>
          )}

          {totalOfertas === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="sparkles-outline" size={36} color={COLORS.gray} />
              <Text style={styles.erroTexto}>Nenhuma oferta exclusiva disponível no momento.</Text>
            </View>
          ) : (
            <>
              <Secao titulo="Serviços em Destaque" itens={servicos} />
              <Secao titulo="Reservas e Locações" itens={reservas} />
              <Secao titulo="Produtos" itens={produtos} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  erroTexto: { color: COLORS.gray, textAlign: 'center', fontWeight: '600' },
  retryBtn: { marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },
  ctaBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFD8BD',
  },
  ctaTitle: { fontWeight: '800', color: COLORS.dark, fontSize: 13 },
  ctaSubtitle: { color: COLORS.gray, fontSize: 11, marginTop: 2 },
  ctaButton: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  ctaButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primaryLight,
    padding: 12, borderRadius: 12, marginBottom: 20,
  },
  premiumBannerText: { color: COLORS.dark, fontWeight: '700', fontSize: 12, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  card: {
    width: '48%', backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 4,
  },
  cardImageWrap: { width: '100%', aspectRatio: 4 / 3, backgroundColor: COLORS.lightGray },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badgesRow: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 6 },
  badgePremium: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeDesconto: { backgroundColor: COLORS.error, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  lockText: { color: COLORS.white, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardBody: { padding: 10 },
  cardEstabelecimento: { fontSize: 9, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', marginBottom: 2 },
  cardNome: { fontSize: 13, fontWeight: '800', color: COLORS.dark, minHeight: 32 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  precoOriginal: { fontSize: 10, color: COLORS.gray, textDecorationLine: 'line-through' },
  precoFinal: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  pontosTexto: { fontSize: 9, fontWeight: '700', color: COLORS.blue, textAlign: 'right' },
});
