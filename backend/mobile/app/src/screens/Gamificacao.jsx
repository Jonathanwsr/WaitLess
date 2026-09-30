import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertar } from '../../../services/alertar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const COLORS = {
  primary: '#FF7A00',
  background: '#F5F5F5',
  white: '#FFFFFF',
  textDark: '#282828',
  textGray: '#6A6C72',
  textLight: '#A0A2A8',
  border: '#E6E7E9',
  success: '#16A34A',
  premium: '#7C3AED',
};

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  arquivada: 'Arquivada',
};

const STATUS_COR = {
  pendente: '#D97706',
  em_analise: '#2563EB',
  respondida: '#16A34A',
  arquivada: '#6A6C72',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function Gamificacao() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [sugestoes, setSugestoes] = useState([]);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const token = await pegarToken();
      if (!token) {
        router.replace('/autenticacao/login');
        return;
      }
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      const [resResumo, resSugestoes] = await Promise.all([
        fetch(`${API_URL}/gamificacao/resumo`, { headers }),
        fetch(`${API_URL}/gamificacao/sugestoes`, { headers }),
      ]);

      if (resResumo.ok) setResumo(await resResumo.json());
      if (resSugestoes.ok) setSugestoes(await resSugestoes.json());
    } catch (error) {
      console.log('Erro ao carregar gamificação:', error);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const fazerCheckin = async () => {
    if (fazendoCheckin || resumo?.ja_fez_checkin_hoje) return;
    setFazendoCheckin(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/gamificacao/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        alertar('Check-in!', data.message);
        carregar();
      } else {
        alertar('Ops', data.message || 'Não foi possível fazer o check-in agora.');
      }
    } catch (error) {
      alertar('Erro', 'Falha de conexão. Tente novamente.');
    } finally {
      setFazendoCheckin(false);
    }
  };

  const enviarSugestao = async () => {
    if (texto.trim().length < 5) {
      alertar('Escreva mais um pouco', 'Sua sugestão precisa ter pelo menos 5 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/gamificacao/sugestoes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), categoria: 'app' }),
      });
      const data = await res.json();
      if (res.ok) {
        alertar('Obrigado!', data.message);
        setTexto('');
        carregar();
      } else {
        alertar('Ops', data.message || 'Não foi possível enviar sua sugestão.');
      }
    } catch (error) {
      alertar('Erro', 'Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const jaFezCheckin = !!resumo?.ja_fez_checkin_hoje;
  const premium = !!resumo?.premium;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ganhe pontos</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.saldoCard}>
          <Ionicons name="sparkles" size={22} color={COLORS.primary} />
          <Text style={styles.saldoValor}>{resumo?.pontos_saldo ?? 0} pontos</Text>
          {premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={styles.premiumBadgeText}>Premium: pontos em dobro</Text>
            </View>
          )}
        </View>

        <View style={styles.comoFuncionaCard}>
          <View style={styles.comoFuncionaHeader}>
            <Ionicons name="information-circle" size={18} color={COLORS.premium} />
            <Text style={styles.comoFuncionaTitulo}>Como funciona</Text>
          </View>
          <View style={styles.comoFuncionaLinha}>
            <Text style={styles.comoFuncionaBullet}>•</Text>
            <Text style={styles.comoFuncionaTexto}>
              <Text style={styles.comoFuncionaForte}>1000 pontos = R$ 1,00</Text> de desconto nas suas próximas reservas.
            </Text>
          </View>
          <View style={styles.comoFuncionaLinha}>
            <Text style={styles.comoFuncionaBullet}>•</Text>
            <Text style={styles.comoFuncionaTexto}>
              Você ganha pontos <Text style={styles.comoFuncionaForte}>reservando</Text>, <Text style={styles.comoFuncionaForte}>avaliando</Text>, <Text style={styles.comoFuncionaForte}>indicando amigos</Text>, fazendo <Text style={styles.comoFuncionaForte}>check-in diário</Text> e enviando <Text style={styles.comoFuncionaForte}>sugestões</Text> aqui nesta tela.
            </Text>
          </View>
          <View style={styles.comoFuncionaLinha}>
            <Text style={styles.comoFuncionaBullet}>•</Text>
            <Text style={styles.comoFuncionaTexto}>
              Só o check-in tem limite: <Text style={styles.comoFuncionaForte}>1 vez por dia</Text>. Sugestão também vale só a <Text style={styles.comoFuncionaForte}>1ª do dia</Text> — as demais continuam sendo enviadas, só não geram pontos extras.
            </Text>
          </View>
          <View style={styles.comoFuncionaLinha}>
            <Text style={styles.comoFuncionaBullet}>•</Text>
            <Text style={styles.comoFuncionaTexto}>
              Quem é <Text style={[styles.comoFuncionaForte, { color: COLORS.premium }]}>Premium</Text> ganha o <Text style={styles.comoFuncionaForte}>dobro</Text> em check-in, sugestão e indicação — automaticamente, sem precisar fazer nada.
            </Text>
          </View>
          <View style={[styles.comoFuncionaLinha, { marginBottom: 0 }]}>
            <Text style={styles.comoFuncionaBullet}>•</Text>
            <Text style={styles.comoFuncionaTexto}>
              Assinantes do plano <Text style={styles.comoFuncionaForte}>Sócio Premium</Text> também recebem um <Text style={styles.comoFuncionaForte}>bônus automático todo mês</Text>, só por estarem com a assinatura ativa.
            </Text>
          </View>
        </View>

        <View style={styles.checkinCard}>
          <View style={styles.checkinIconWrap}>
            <Ionicons name={jaFezCheckin ? 'checkmark-circle' : 'flash'} size={28} color={jaFezCheckin ? COLORS.success : COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkinTitulo}>Estou usando o app</Text>
            <Text style={styles.checkinSub}>
              {jaFezCheckin
                ? 'Você já fez o check-in de hoje. Volte amanhã!'
                : `Toque para ganhar ${resumo?.pontos_checkin ?? 0} pontos por usar o app hoje.`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.checkinBtn, jaFezCheckin && styles.checkinBtnFeito]}
            onPress={fazerCheckin}
            disabled={jaFezCheckin || fazendoCheckin}
            activeOpacity={0.8}
          >
            {fazendoCheckin ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkinBtnText}>{jaFezCheckin ? 'Feito' : 'Check-in'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Enviar uma sugestão</Text>
        <View style={styles.sugestaoCard}>
          <Text style={styles.sugestaoSub}>
            Sua opinião ajuda a melhorar o app. A primeira sugestão do dia ganha {resumo?.pontos_sugestao ?? 0} pontos.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="O que você gostaria de ver no app?"
            placeholderTextColor={COLORS.textLight}
            value={texto}
            onChangeText={setTexto}
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.enviarBtn, enviando && { opacity: 0.7 }]}
            onPress={enviarSugestao}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.enviarBtnText}>Enviar sugestão</Text>}
          </TouchableOpacity>
        </View>

        {sugestoes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Suas sugestões</Text>
            <View style={styles.listaCard}>
              {sugestoes.map((s, i) => (
                <View key={s.id} style={[styles.sugestaoItem, i < sugestoes.length - 1 && styles.sugestaoItemBorder]}>
                  <View style={styles.sugestaoItemHeader}>
                    <View style={[styles.statusPill, { backgroundColor: `${STATUS_COR[s.status]}1A` }]}>
                      <Text style={[styles.statusPillText, { color: STATUS_COR[s.status] }]}>{STATUS_LABEL[s.status] || s.status}</Text>
                    </View>
                    {s.pontos_concedidos > 0 && <Text style={styles.pontosTag}>+{s.pontos_concedidos} pts</Text>}
                  </View>
                  <Text style={styles.sugestaoTexto}>{s.texto}</Text>
                  {!!s.resposta_admin && (
                    <Text style={styles.respostaTexto}>Resposta da equipe: {s.resposta_admin}</Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  saldoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white,
    borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, flexWrap: 'wrap',
  },
  saldoValor: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.premium,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto',
  },
  premiumBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  comoFuncionaCard: {
    backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E9D5FF',
  },
  comoFuncionaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  comoFuncionaTitulo: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  comoFuncionaLinha: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'flex-start' },
  comoFuncionaBullet: { color: COLORS.premium, fontSize: 14, lineHeight: 19 },
  comoFuncionaTexto: { flex: 1, fontSize: 12.5, color: COLORS.textGray, lineHeight: 19 },
  comoFuncionaForte: { fontWeight: '700', color: COLORS.textDark },
  checkinCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white,
    borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  checkinIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  checkinTitulo: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  checkinSub: { fontSize: 12, color: COLORS.textGray, marginTop: 2 },
  checkinBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 84, alignItems: 'center',
  },
  checkinBtnFeito: { backgroundColor: COLORS.success },
  checkinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textGray, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  sugestaoCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  sugestaoSub: { fontSize: 12, color: COLORS.textGray, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14,
    color: COLORS.textDark, textAlignVertical: 'top', minHeight: 90, backgroundColor: COLORS.background,
  },
  enviarBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  enviarBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listaCard: { backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  sugestaoItem: { padding: 14 },
  sugestaoItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sugestaoItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  pontosTag: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  sugestaoTexto: { fontSize: 13, color: COLORS.textDark },
  respostaTexto: { fontSize: 12, color: COLORS.textGray, marginTop: 6, backgroundColor: COLORS.background, borderRadius: 8, padding: 8 },
});
