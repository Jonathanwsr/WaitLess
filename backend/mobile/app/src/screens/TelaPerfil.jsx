import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertar } from '../../../services/alertar';
import { irParaLoginSemVoltar } from '../../../services/sessao';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const COLORS = {
  primary: '#FF7A00',
  accent: '#FF7A00',
  background: '#F5F5F5',
  white: '#FFFFFF',
  textDark: '#282828',
  textGray: '#6A6C72',
  textLight: '#A0A2A8',
  border: '#E6E7E9',
  danger: '#DC2626',
  avatarBg: '#E6E7E9',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

async function limparSessao() {
  await AsyncStorage.multiRemove(['@lokyva_token', '@waitless_token', '@waitless_user']);
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

const formatarTelefone = (v) => {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
};

const formatarData = (iso) => {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
};

const mascararDocumento = (doc) => {
  const d = soDigitos(doc);
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.***/****-${d.slice(12)}`;
  return '';
};

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
        irParaLoginSemVoltar(router);
        return;
      }

      const res = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (['socio', 'proprietario', 'gerente'].includes(String(data.user?.papel || '').toLowerCase())) {
          router.replace('/Proprietario/perfil');
          return;
        }
        setUsuario(data.user);
      } else if (res.status === 401) {
        alertar('Sessão expirada', 'Por favor, faça login novamente.');
        await limparSessao();
        irParaLoginSemVoltar(router);
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
    alertar(
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
              irParaLoginSemVoltar(router);
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
  const enderecoCompleto = [
    [usuario?.endereco, usuario?.numero].filter(Boolean).join(', '),
    usuario?.bairro,
  ].filter(Boolean).join(' - ');
  const inicial = (nomeExibicao || 'U').charAt(0).toUpperCase();
  // Pontos, favoritos, agendamentos e viagens são recursos de CLIENTE: sócio,
  // equipe e admin usam o app pelo próprio painel.
  const papelBruto = (usuario?.papel || '').toLowerCase();
  const souCliente = !['socio', 'proprietario', 'gerente', 'funcionario', 'atendente', 'admin'].includes(papelBruto);
  const souDono = ['socio', 'proprietario', 'gerente'].includes(papelBruto);
  // Assinatura é um recurso de cliente/dono: funcionário e atendente não têm plano próprio.
  const souEquipe = ['funcionario', 'atendente'].includes(papelBruto);

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
        <View style={{ flex: 1 }} />
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
            {usuario?.foto_perfil ? (
              <Image source={{ uri: usuario.foto_perfil }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInicial}>{inicial}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{nomeExibicao}</Text>
            {!!emailExibicao && <Text style={styles.profileEmail}>{emailExibicao}</Text>}
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{papelExibicao}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/src/screens/EditarPerfil')} activeOpacity={0.85}>
          <Feather name="edit-2" size={16} color={COLORS.white} />
          <Text style={styles.editBtnText}>Editar perfil</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          {souCliente && (
            <>
              <TouchableOpacity style={styles.statBox} onPress={() => router.push('/src/screens/MeusPontos')} activeOpacity={0.7}>
                <Text style={styles.statValue}>{usuario?.pontos_saldo ?? 0}</Text>
                <Text style={styles.statLabel}>Pontos</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
            </>
          )}
          {!souEquipe && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{planoExibicao}</Text>
              <Text style={styles.statLabel}>Plano atual</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Informações pessoais</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="person-outline" title="Nome completo" value={nomeExibicao} />
          <ListItem icon="mail-outline" title="E-mail" value={emailExibicao} />
          {!!usuario?.telefone && <ListItem icon="call-outline" title="Telefone" value={formatarTelefone(usuario.telefone)} />}
          {!!usuario?.data_nascimento && <ListItem icon="calendar-outline" title="Nascimento" value={formatarData(usuario.data_nascimento)} />}
          {!!mascararDocumento(usuario?.cpf_cnpj) && <ListItem icon="card-outline" title="CPF / CNPJ" value={mascararDocumento(usuario.cpf_cnpj)} />}
          {!!enderecoCompleto && <ListItem icon="home-outline" title="Endereço" value={enderecoCompleto} />}
          {!!localizacao && <ListItem icon="location-outline" title="Cidade" value={localizacao} />}
          {!!usuario?.profissao && <ListItem icon="briefcase-outline" title="Profissão" value={usuario.profissao} />}
          {!!usuario?.idiomas && <ListItem icon="language-outline" title="Idiomas" value={usuario.idiomas} />}
          {!!usuario?.onde_estudei && <ListItem icon="school-outline" title="Onde estudei" value={usuario.onde_estudei} />}
          {!!usuario?.onde_moro && <ListItem icon="map-outline" title="Onde moro" value={usuario.onde_moro} />}
          {!!usuario?.membro_desde && <ListItem icon="time-outline" title="Membro desde" value={formatarData(usuario.membro_desde)} />}
          <ListItem icon="create-outline" title="Editar informações" onPress={() => router.push('/src/screens/EditarPerfil')} isLast />
        </View>

        {!!usuario?.sobre_mim && (
          <>
            <Text style={styles.sectionTitle}>Sobre mim</Text>
            <View style={[styles.cardGroup, styles.aboutCard]}>
              <Text style={styles.aboutText}>{usuario.sobre_mim}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Conta e assinatura</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="people-outline" title="Tipo de usuário" value={papelExibicao} />
          {!souEquipe && (
            <ListItem
              icon="ribbon-outline"
              title="Minha assinatura"
              value={planoExibicao}
              valueColor={COLORS.textDark}
              onPress={() => router.push('/assinatura')}
            />
          )}
          {souCliente && (
            <>
          <ListItem
            icon="sparkles-outline"
            title="Meus pontos"
            value={`${usuario?.pontos_saldo ?? 0} pts`}
            valueColor={COLORS.textDark}
            onPress={() => router.push('/src/screens/MeusPontos')}
          />
              <ListItem
            icon="people-outline"
            title="Convide amigos e ganhe pontos"
            onPress={() => router.push('/src/screens/Indicacao')}
          />
              <ListItem
            icon="gift-outline"
            title="Promoções"
            onPress={() => router.push('/src/screens/Promocoes')}
          />
              <ListItem
            icon="time-outline"
            title="Meus agendamentos"
            onPress={() => router.push('/src/screens/MeusAgendamentos')}
          />
              <ListItem
            icon="chatbubble-ellipses-outline"
            title="Meus comentários"
            onPress={() => router.push('/src/screens/MeusComentarios')}
          />
          <ListItem
            icon="return-up-back-outline"
            title="Meus estornos"
            onPress={() => router.push('/src/screens/MeusEstornosScreen')}
          />
          <ListItem
            icon="heart-outline"
            title="Meus favoritos"
            onPress={() => router.push('/src/screens/FavoritosDashboard')}
          />
              <ListItem
            icon="airplane-outline"
            title="Planejar viagem"
            subValue="Organize seus roteiros e orçamento"
            onPress={() => router.push('/src/screens/PlanTripScreen')}
          />
          <ListItem
            icon="map-outline"
            title="Minhas viagens em grupo"
            subValue="Roteiro inteligente, reservas e gastos divididos"
            onPress={() => router.push('/src/screens/MinhasViagens')}
          />
            </>
          )}
          {souDono && (
            <ListItem
              icon="storefront-outline"
              title="Painel do proprietário"
              subValue="Locais, equipe e reservas"
              onPress={() => router.push('/Proprietario/dashboard')}
            />
          )}
          <ListItem
            icon="flash-outline"
            title="Ganhe pontos usando o app"
            subValue="Check-in diário e sugestões"
            onPress={() => router.push('/src/screens/Gamificacao')}
          />
          <ListItem
            icon="chatbubbles-outline"
            title="Mensagens"
            onPress={() => router.push(souCliente ? '/(tabs)/caixa-entrada' : '/mensagens')}
          />
          <ListItem
            icon="headset-outline"
            title="Suporte"
            onPress={() => router.push('/src/screens/TelaSuporte')}
          />
          <ListItem
            icon="document-text-outline"
            title="Termos e Compromissos"
            onPress={() => router.push('/src/screens/TermosCompromisso')}
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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.avatarBg, alignItems: 'center', justifyContent: 'center' },
  profileDetails: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 },
  profileEmail: { fontSize: 13, color: COLORS.textGray, marginBottom: 6 },
  tagBadge: { backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  tagText: { color: COLORS.textDark, fontSize: 11, fontWeight: '700' },
  avatarInicial: { fontSize: 26, fontWeight: '700', color: COLORS.textGray },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, height: 48, borderRadius: 24, marginBottom: 16 },
  editBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  aboutCard: { padding: 16 },
  aboutText: { fontSize: 14, lineHeight: 21, color: COLORS.textDark },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 20, marginBottom: 24, paddingVertical: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  statLabel: { fontSize: 11, color: COLORS.textGray, marginTop: 2, fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textGray, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 10 },
  cardGroup: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
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
