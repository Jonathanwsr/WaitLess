import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',
  background: '#FFFFFF',
  textDark: '#1F2937',
  textGray: '#6A6C72',
  border: '#E6E7E9',
  white: '#FFFFFF',
  success: '#00A868',
  successLight: '#D1FAE5',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;
const SITE_URL = cleanBaseUrl.replace(/\/api\/?$/, '');

interface TermoInfo {
  aceito: boolean;
  aceito_em: string | null;
  versao: string | null;
  versao_atual: string;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

function formatarData(data: string | null): string {
  if (!data) return '—';
  const d = new Date(data);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TermosCompromisso() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState<TermoInfo | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      if (data?.success) {
        setTermo(data.user.termo_compromisso);
      }
    } catch (e) {
      // segue mostrando estado vazio; não é crítico
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const abrirTermoCompleto = () => WebBrowser.openBrowserAsync(`${SITE_URL}/termos`);

  const versaoDesatualizada = termo?.aceito && termo.versao !== termo.versao_atual;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 24 }} />
      </View>

      {carregando ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.iconBadge}>
            <Ionicons name="document-text-outline" size={26} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Seu aceite do Termo de Compromisso</Text>
          <Text style={styles.subtitle}>
            Registro de quando e qual versão do termo você aceitou ao se cadastrar na Lokyva.
          </Text>

          {termo?.aceito ? (
            <View style={[styles.statusCard, { backgroundColor: COLORS.successLight }]}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: COLORS.success }]}>Termo aceito</Text>
                <Text style={styles.statusSub}>Versão {termo.versao} · {formatarData(termo.aceito_em)}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusCard, { backgroundColor: COLORS.dangerLight }]}>
              <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: COLORS.danger }]}>Nenhum aceite registrado</Text>
                <Text style={styles.statusSub}>Não encontramos um registro de aceite na sua conta.</Text>
              </View>
            </View>
          )}

          {versaoDesatualizada && (
            <View style={[styles.statusCard, { backgroundColor: COLORS.warningLight }]}>
              <Ionicons name="information-circle" size={20} color={COLORS.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: COLORS.warning }]}>Termo atualizado</Text>
                <Text style={styles.statusSub}>
                  A versão atual ({termo?.versao_atual}) é diferente da que você aceitou ({termo?.versao}).
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.btnPrimary} onPress={abrirTermoCompleto}>
            <Feather name="external-link" size={16} color={COLORS.white} />
            <Text style={styles.btnPrimaryText}>Ler o Termo de Compromisso completo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 15,
    backgroundColor: COLORS.background,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  iconBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textGray, lineHeight: 19, marginBottom: 20 },

  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 14, marginBottom: 12 },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  statusSub: { fontSize: 12, color: COLORS.textGray, marginTop: 2 },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.textDark, borderRadius: 14, paddingVertical: 15, marginTop: 12,
  },
  btnPrimaryText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
