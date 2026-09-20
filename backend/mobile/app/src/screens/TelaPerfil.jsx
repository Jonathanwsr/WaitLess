import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const COLORS = {
  primary: '#F05627',
  primaryLight: '#FFF0E6',
  background: '#F8F9FA',
  white: '#FFFFFF',
  textDark: '#1F2937',
  textGray: '#6B7280',
  textLight: '#9CA3AF',
  border: '#F3F4F6',
  danger: '#EF4444',
  avatarBg: '#E5E7EB',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

async function limparSessao() {
  await AsyncStorage.multiRemove(['@lokyva_token', '@waitless_token', '@waitless_user']);
}

const PAPEL_LABEL = {
  user: 'Cliente',
  socio: 'Sócio / Proprietário',
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  funcionario: 'Funcionário',
};

export default function TelaPerfil() {
  const router = useRouter();

  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const carregarPerfil = useCallback(async (mostrarLoading = true) => {
    if (mostrarLoading) setCarregando(true);
    try {
      const token = await pegarToken();

      if (!token) {
        router.replace('/autenticacao/login');
        return;
      }

      const res = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUsuario(data.user);
      } else if (res.status === 401) {
        Alert.alert('Sessão expirada', 'Por favor, faça login novamente.');
        await limparSessao();
        router.replace('/autenticacao/login');
      }
    } catch (error) {
      console.log('Erro ao carregar dados do perfil:', error);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      carregarPerfil(!usuario);
    }, [carregarPerfil])
  );

  const handleLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Tem certeza de que deseja encerrar sua sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setSaindo(true);
            try {
              const token = await pegarToken();
              if (token) {
                await fetch(`${API_URL}/logout`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                });
              }
            } catch (error) {
              console.log('Erro na requisição de logout:', error);
            } finally {
              await limparSessao();
              setSaindo(false);
              router.replace('/autenticacao/login');
            }
          },
        },
      ]
    );
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </SafeAreaView>
    );
  }

  const nomeExibicao = usuario?.name || 'Usuário Lokyva';
  const emailExibicao = usuario?.email || '';
  const papelExibicao = PAPEL_LABEL[(usuario?.papel || '').toLowerCase()] || usuario?.papel || 'Cliente';
  const planoExibicao = (usuario?.plano_atual || 'gratuito').toUpperCase();
  const temAssinatura = usuario?.assinatura && usuario.assinatura.status === 'ativa';
  const localizacao = [usuario?.cidade, usuario?.estado].filter(Boolean).join(' - ');

  const ListItem = ({ icon, title, value, subValue, valueColor, titleColor, isLast, onPress }) => (
    <TouchableOpacity
      style={[styles.listItem, !isLast && styles.listItemBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.listItemLeft}>
        <Ionicons name={icon} size={20} color={titleColor || COLORS.textGray} style={styles.listIcon} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.listTitle, titleColor && { color: titleColor }]}>{title}</Text>
          {subValue ? <Text style={styles.listSubValue}>{subValue}</Text> : null}
        </View>
      </View>
      <View style={styles.listItemRight}>
        {value ? <Text style={[styles.listValue, valueColor && { color: valueColor }]} numberOfLines={1}>{value}</Text> : null}
        {onPress && <Feather name="chevron-right" size={18} color={COLORS.textLight} style={styles.chevron} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              carregarPerfil(false);
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.profileSummary}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={COLORS.textGray} />
            </View>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{nomeExibicao}</Text>
            {!!emailExibicao && <Text style={styles.profileEmail}>{emailExibicao}</Text>}
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{papelExibicao}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{usuario?.pontos_saldo ?? 0}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, temAssinatura && { color: COLORS.primary }]}>{planoExibicao}</Text>
            <Text style={styles.statLabel}>Plano atual</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Informações pessoais</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="person-outline" title="Nome completo" value={nomeExibicao} />
          {!!usuario?.telefone && <ListItem icon="call-outline" title="Telefone" value={usuario.telefone} />}
          {!!localizacao && <ListItem icon="location-outline" title="Localização" value={localizacao} />}
          {!!usuario?.profissao && <ListItem icon="briefcase-outline" title="Profissão" value={usuario.profissao} />}
          <ListItem icon="mail-outline" title="E-mail" value={emailExibicao} isLast />
        </View>

        <Text style={styles.sectionTitle}>Conta e assinatura</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="people-outline" title="Tipo de usuário" value={papelExibicao} />
          <ListItem
            icon="ribbon-outline"
            title="Minha assinatura"
            value={planoExibicao}
            valueColor={COLORS.primary}
            onPress={() => router.push('/assinatura')}
          />
          <ListItem
            icon="time-outline"
            title="Meus agendamentos"
            onPress={() => router.push('/src/screens/MeusAgendamentos')}
          />
          <ListItem
            icon="heart-outline"
            title="Meus favoritos"
            onPress={() => router.push('/src/screens/FavoritosDashboard')}
          />
          <ListItem
            icon="chatbubbles-outline"
            title="Mensagens"
            onPress={() => router.push('/(tabs)/caixa-entrada')}
          />
          <ListItem
            icon="airplane-outline"
            title="Planejar viagem"
            subValue="Organize seus roteiros e orçamento"
            onPress={() => router.push('/src/screens/PlanTripScreen')}
          />
          <ListItem
            icon="headset-outline"
            title="Suporte"
            onPress={() => router.push('/src/screens/TelaSuporte')}
            isLast
          />
        </View>

        <Text style={styles.sectionTitle}>Ações da conta</Text>
        <View style={styles.cardGroup}>
          <ListItem
            icon="log-out-outline"
            title={saindo ? 'Saindo...' : 'Sair da conta'}
            subValue="Fazer logout do aplicativo"
            onPress={saindo ? undefined : handleLogout}
          />
          <ListItem
            icon="trash-outline"
            title="Apagar minha conta"
            subValue="Fale com o suporte para excluir sua conta e dados"
            titleColor={COLORS.danger}
            onPress={() => router.push('/src/screens/TelaSuporte')}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textGray, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: COLORS.background,
  },
  headerButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.avatarBg, alignItems: 'center', justifyContent: 'center' },
  profileDetails: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 },
  profileEmail: { fontSize: 13, color: COLORS.textGray, marginBottom: 6 },
  tagBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, paddingVertical: 16 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  statLabel: { fontSize: 11, color: COLORS.textGray, marginTop: 2, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 12, marginTop: 10 },
  cardGroup: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: COLORS.white },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  listIcon: { marginRight: 12, width: 24, textAlign: 'center' },
  listTitle: { fontSize: 14, color: COLORS.textDark, fontWeight: '500' },
  listSubValue: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  listItemRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', maxWidth: '45%' },
  listValue: { fontSize: 13, color: COLORS.textGray, marginRight: 8, textAlign: 'right' },
  chevron: { marginLeft: 4 },
});
