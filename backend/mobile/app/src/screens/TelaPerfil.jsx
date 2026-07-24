import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// Cores Padrão da Aplicação
const COLORS = {
  primary: '#FF5A00',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B'
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
        // Fallback genérico caso a API retorne erros de autenticação
        Alert.alert('Sessão expirada', 'Por favor, faça login novamente.');
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

              // Executa a chamada na rota informada
              await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });

              // Limpa os dados salvos localmente
              await AsyncStorage.removeItem('@waitless_token');
              await AsyncStorage.removeItem('@waitless_user');

              // Redireciona para a tela de login
              router.replace('/src/screens/LoginScreen');
            } catch (error) {
              console.log('Erro ao realizar logout:', error);
              // Mesmo com erro de rede, desloga localmente por segurança
              await AsyncStorage.removeItem('@waitless_token');
              router.replace('/src/screens/LoginScreen');
            } finally {
              setSaindo(false);
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
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        {/* Info do Usuário */}
        <View style={styles.userInfoContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={60} color={COLORS.primary} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {usuario?.name ? usuario.name.toUpperCase() : 'USUÁRIO'}
            </Text>
            <View style={styles.tagDigital}>
              <Text style={styles.tagText}>
                {usuario?.plano_atual ? usuario.plano_atual.toUpperCase() : 'DIGITAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Nome de Exibição */}
        <View style={styles.displayNameCard}>
          <Text style={styles.label}>Nome de exibição</Text>
          <Text style={styles.displayName}>{usuario?.name || 'Não informado'}</Text>
          {usuario?.email && (
            <Text style={styles.emailText}>{usuario.email}</Text>
          )}
        </View>

        {/* Card Meus Pontos */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeader}>
            <Ionicons name="ribbon-outline" size={24} color={COLORS.warning} />
            <Text style={styles.pointsTitle}>Meus Pontos</Text>
          </View>
          <Text style={styles.pointsValue}>{usuario?.pontos_saldo ?? 0} pts</Text>
          <Text style={styles.pointsSub}>Acumulados em seus atendimentos</Text>
        </View>

        {/* Ações Rápidas (Horizontal) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/src/screens/MinhaCarteira')}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.primary} style={styles.actionIcon} />
            <Text style={styles.actionText}>Ver minha carteira</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/src/screens/MinhaAssinatura')}>
            <Ionicons name="card-outline" size={22} color={COLORS.primary} style={styles.actionIcon} />
            <Text style={styles.actionText}>Ver assinatura</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.primary} style={styles.actionIcon} />
            <Text style={styles.actionText}>Informe de rendimentos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="cash-outline" size={22} color={COLORS.primary} style={styles.actionIcon} />
            <Text style={styles.actionText}>Meu Crédito</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Central de Segurança */}
        <Text style={styles.sectionTitle}>Central de Segurança</Text>
        <View style={styles.securityContainer}>
          <TouchableOpacity style={styles.securityCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.secondary} style={{ marginBottom: 6 }} />
            <Text style={styles.cardTitle}>Meus Limites</Text>
            <Text style={styles.cardSubtitle}>Gestão de limites diários</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.securityCard}>
            <Ionicons name="qr-code-outline" size={20} color={COLORS.secondary} style={{ marginBottom: 6 }} />
            <Text style={styles.cardTitle}>Token e Autorização</Text>
            <Text style={styles.cardSubtitle}>Autenticar com QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Configurações */}
        <View style={styles.listContainer}>
          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemRow}>
              <Ionicons name="gift-outline" size={20} color={COLORS.gray} style={{ marginRight: 12 }} />
              <Text style={styles.listText}>Meus benefícios</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemRow}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.gray} style={{ marginRight: 12 }} />
              <Text style={styles.listText}>Perfil do Fórum</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemRow}>
              <Ionicons name="create-outline" size={20} color={COLORS.gray} style={{ marginRight: 12 }} />
              <Text style={styles.listText}>Atualização cadastral</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* BOTÃO DE SAIR */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          disabled={saindo}
        >
          {saindo ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, padding: 20 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.gray, fontWeight: '600' },

  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary },
  
  userInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 5 },
  tagDigital: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { color: COLORS.white, fontSize: 11, fontWeight: 'bold' },

  displayNameCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 15, marginBottom: 15, backgroundColor: COLORS.white },
  label: { fontSize: 12, color: COLORS.gray, marginBottom: 4 },
  displayName: { fontSize: 16, fontWeight: '600', color: COLORS.secondary },
  emailText: { fontSize: 13, color: COLORS.gray, marginTop: 2 },

  pointsCard: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  pointsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  pointsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginLeft: 8 },
  pointsValue: { fontSize: 24, fontWeight: '900', color: '#B45309' },
  pointsSub: { fontSize: 12, color: '#B45309', marginTop: 2 },

  quickActions: { flexDirection: 'row', marginBottom: 25 },
  actionCard: { width: 130, height: 100, backgroundColor: COLORS.lightGray, borderRadius: 12, padding: 12, marginRight: 12, justifyContent: 'space-between' },
  actionIcon: { alignSelf: 'flex-start' },
  actionText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 15 },
  securityContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  securityCard: { flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 12, padding: 15, marginHorizontal: 4 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: COLORS.gray },

  listContainer: { marginBottom: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemRow: { flexDirection: 'row', alignItems: 'center' },
  listText: { fontSize: 15, color: COLORS.secondary, fontWeight: '500' },

  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerLight, borderRadius: 12, paddingVertical: 14, marginBottom: 40, marginTop: 10 },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' }
});