import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// Cores baseadas no design
const COLORS = {
  primary: '#F05627', // Laranja do design
  background: '#F8F9FA',
  white: '#FFFFFF',
  textDark: '#1F2937',
  textGray: '#6B7280',
  textLight: '#9CA3AF',
  border: '#F3F4F6',
  danger: '#EF4444',
  avatarBg: '#E5E7EB'
};

export default function TelaPerfil() {
  const router = useRouter();
  
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    try {
      setCarregando(true);
      const token = await AsyncStorage.getItem('@waitless_token');
      
      const res = await fetch(`${API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUsuario(data.user);
      } else {
        Alert.alert('Sessão expirada', 'Por favor, faça login novamente.');
        await AsyncStorage.multiRemove(['@waitless_token', '@waitless_user']);
        router.replace('/src/screens/LoginScreen');
      }
    } catch (error) {
      console.log('Erro ao carregar dados do perfil:', error);
    } finally {
      setCarregando(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza de que deseja encerrar sua sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaindo(true);
              const token = await AsyncStorage.getItem('@waitless_token');

              if (token) {
                await fetch(`${API_URL}/logout`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  }
                });
              }
            } catch (error) {
              console.log('Erro na requisição de logout:', error);
            } finally {
              await AsyncStorage.multiRemove(['@waitless_token', '@waitless_user']);
              setSaindo(false);
              router.replace('/src/screens/LoginScreen');
            }
          }
        }
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

  // Dados mockados para preencher o visual caso não venham da API
  const nomeExibicao = usuario?.name || 'Lucas Ferreira';
  const emailExibicao = usuario?.email || 'lucas.ferreira@email.com';
  const tipoExibicao = usuario?.plano_atual || 'Profissional';

  // Componente de Item da Lista (Reutilizável)
  const ListItem = ({ icon, title, value, subValue, valueColor, titleColor, isLast, onPress }) => (
    <TouchableOpacity 
      style={[styles.listItem, !isLast && styles.listItemBorder]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.listItemLeft}>
        <Ionicons name={icon} size={20} color={titleColor || COLORS.textGray} style={styles.listIcon} />
        <View>
          <Text style={[styles.listTitle, titleColor && { color: titleColor }]}>{title}</Text>
          {subValue && <Text style={styles.listSubValue}>{subValue}</Text>}
        </View>
      </View>
      <View style={styles.listItemRight}>
        {value && <Text style={[styles.listValue, valueColor && { color: valueColor }]}>{value}</Text>}
        <Feather name="chevron-right" size={18} color={COLORS.textLight} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER TOP BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="bell" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* INFO DO USUÁRIO TOP */}
        <TouchableOpacity style={styles.profileSummary}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={COLORS.textGray} />
            </View>
            <View style={styles.avatarEditBadge}>
              <Feather name="camera" size={10} color={COLORS.textDark} />
            </View>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{nomeExibicao}</Text>
            <Text style={styles.profileEmail}>{emailExibicao}</Text>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{tipoExibicao}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        {/* 1. INFORMAÇÕES PESSOAIS */}
        <Text style={styles.sectionTitle}>Informações pessoais</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="person-outline" title="Nome completo" value={nomeExibicao} />
          <ListItem icon="calendar-outline" title="Data de nascimento" value="15/07/1996" />
          <ListItem icon="school-outline" title="Onde estuda" value="Universidade Federal" />
          <ListItem icon="briefcase-outline" title="Profissão" value="Desenvolvedor" />
          <ListItem icon="information-circle-outline" title="Sobre mim" value="Tecnologia e inovação..." isLast />
        </View>

        {/* 2. CONTA E PREFERÊNCIAS */}
        <Text style={styles.sectionTitle}>Conta e preferências</Text>
        <View style={styles.cardGroup}>
          <ListItem icon="people-outline" title="Tipo de usuário" value="Profissional" valueColor={COLORS.primary} />
          <ListItem 
            icon="ribbon-outline" 
            title="Plano atual" 
            value="Plano Premium" 
            subValue="Validade até 08/09/2026"
            valueColor={COLORS.primary} 
          />
          <ListItem icon="card-outline" title="Método de pagamento" value="**** 4242 (Visa)" />
          <ListItem icon="chatbubble-outline" title="Meus comentários" />
          <ListItem icon="time-outline" title="Histórico de reservas" />
          <ListItem icon="headset-outline" title="Suporte" isLast />
        </View>

        {/* 3. AÇÕES DA CONTA */}
        <Text style={styles.sectionTitle}>Ações da conta</Text>
        <View style={styles.cardGroup}>
          <ListItem 
            icon="log-out-outline" 
            title="Sair da conta" 
            subValue="Fazer logout do aplicativo" 
            onPress={handleLogout}
          />
          <ListItem 
            icon="trash-outline" 
            title="Apagar minha conta" 
            subValue="Excluir permanentemente sua conta e dados" 
            titleColor={COLORS.danger}
            isLast 
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.background 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 14, 
    color: COLORS.textGray, 
    fontWeight: '500' 
  },
  
  // Header Top Bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: COLORS.background
  },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Profile Summary (Top)
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 2
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textGray,
    marginBottom: 6
  },
  tagBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  tagText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600'
  },

  // Sections
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 12,
    marginTop: 10
  },
  cardGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border
  },

  // List Items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  listIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center'
  },
  listTitle: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '500'
  },
  listSubValue: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1
  },
  listValue: {
    fontSize: 13,
    color: COLORS.textGray,
    marginRight: 8,
    textAlign: 'right'
  },
  chevron: {
    marginLeft: 4
  }
});