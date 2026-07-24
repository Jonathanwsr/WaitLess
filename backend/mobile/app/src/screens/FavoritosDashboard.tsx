import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// ----------------------------------------------------
// INTERFACES (Definição dos tipos para evitar erro TS)
// ----------------------------------------------------
interface Estabelecimento {
  id: number | string;
  nome: string;
  foto_banner?: string;
  foto_perfil?: string;
  cidade?: string;
  estado?: string;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
  preco_medio?: string | number;
  valor?: string | number;
  ramo_atuacao?: string;
}

interface Servico {
  id: number | string;
  nome: string;
  foto?: string;
  categoria?: string;
  duracao_minutos?: number;
  valor?: string | number;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
  estabelecimento?: {
    id?: number | string;
    nome?: string;
    foto_perfil?: string;
  };
  cidade?: string;
}

interface ItemRemover {
  id: number | string;
  nome: string;
  tipo: 'estabelecimento' | 'servico';
}

interface DadosFavoritos {
  estabelecimentos: Estabelecimento[];
  servicos: Servico[];
}

// Cores da Identidade (Lokyva)
const COLORS = {
  primary: '#FF5A00',      // Laranja Lokyva
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  black: '#000000',        // Ícones em preto puro
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  error: '#DC2626',
  warning: '#FFB800'
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function FavoritosDashboard() {
  const router = useRouter();
  
  // Abas: 'todos' | 'estabelecimentos' | 'servicos'
  const [abaAtiva, setAbaAtiva] = useState<'todos' | 'estabelecimentos' | 'servicos'>('todos');
  const [loading, setLoading] = useState(true);
  
  // Estado tipado corretamente para evitar o erro 'never'
  const [dados, setDados] = useState<DadosFavoritos>({ 
    estabelecimentos: [], 
    servicos: [] 
  });

  // Estado para o Modal de Confirmação de Remoção
  const [modalVisivel, setModalVisivel] = useState(false);
  const [itemParaRemover, setItemParaRemover] = useState<ItemRemover | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    carregarFavoritos();
  }, []);

  const carregarFavoritos = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@lokyva_token') || await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/favoritos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();

      setDados({
        estabelecimentos: json.estabelecimentos || [],
        servicos: json.servicos || []
      });
    } catch (e) {
      console.log('Erro ao carregar favoritos da API');
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal de confirmação antes de remover
  const solicitarRemocao = (item: Estabelecimento | Servico, tipo: 'estabelecimento' | 'servico') => {
    setItemParaRemover({
      id: item.id,
      nome: item.nome,
      tipo
    });
    setModalVisivel(true);
  };

  // Executa a remoção via API e atualiza a tela
  const confirmarRemocao = async () => {
    if (!itemParaRemover) return;
    setRemovendo(true);

    try {
      const token = await AsyncStorage.getItem('@lokyva_token') || await AsyncStorage.getItem('@waitless_token');
      await fetch(`${API_URL}/favoritos/toggle`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          tipo: itemParaRemover.tipo, 
          id: itemParaRemover.id 
        })
      });

      // Remove localmente para resposta instantânea
      if (itemParaRemover.tipo === 'estabelecimento') {
        setDados(prev => ({
          ...prev,
          estabelecimentos: prev.estabelecimentos.filter(e => e.id !== itemParaRemover.id)
        }));
      } else {
        setDados(prev => ({
          ...prev,
          servicos: prev.servicos.filter(s => s.id !== itemParaRemover.id)
        }));
      }

    } catch (e) {
      console.log('Erro ao remover favorito');
    } finally {
      setRemovendo(false);
      setModalVisivel(false);
      setItemParaRemover(null);
    }
  };

  const temEstabelecimentos = dados.estabelecimentos && dados.estabelecimentos.length > 0;
  const temServicos = dados.servicos && dados.servicos.length > 0;
  const estaVazio = !temEstabelecimentos && !temServicos;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        
        {/* HEADER TOP BAR */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meus Favoritos</Text>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* BANNER INFORMATIVO */}
          <View style={styles.heroSection}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroDescription}>
                Acompanhe todos os lugares e serviços que você salvou para mais tarde.
              </Text>
            </View>
            <View style={styles.heroBadgeCircle}>
              <Ionicons name="heart-outline" size={24} color={COLORS.black} />
            </View>
          </View>

          {/* ABAS DE NAVEGAÇÃO SUPERIOR */}
          <View style={styles.tabsContainer}>
            
            <TouchableOpacity 
              style={[styles.tabItem, abaAtiva === 'todos' && styles.tabItemActive]}
              onPress={() => setAbaAtiva('todos')}
            >
              <Ionicons 
                name="heart" 
                size={18} 
                color={abaAtiva === 'todos' ? COLORS.primary : COLORS.black} 
              />
              <Text style={[styles.tabText, abaAtiva === 'todos' && styles.tabTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabItem, abaAtiva === 'estabelecimentos' && styles.tabItemActive]}
              onPress={() => setAbaAtiva('estabelecimentos')}
            >
              <Ionicons 
                name="storefront-outline" 
                size={18} 
                color={abaAtiva === 'estabelecimentos' ? COLORS.primary : COLORS.black} 
              />
              <Text style={[styles.tabText, abaAtiva === 'estabelecimentos' && styles.tabTextActive]}>
                Estabelecimentos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabItem, abaAtiva === 'servicos' && styles.tabItemActive]}
              onPress={() => setAbaAtiva('servicos')}
            >
              <Ionicons 
                name="briefcase-outline" 
                size={18} 
                color={abaAtiva === 'servicos' ? COLORS.primary : COLORS.black} 
              />
              <Text style={[styles.tabText, abaAtiva === 'servicos' && styles.tabTextActive]}>
                Serviços
              </Text>
            </TouchableOpacity>

          </View>

          {/* CONTEÚDO PRINCIPAL */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : estaVazio ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="heart-dislike-outline" size={60} color={COLORS.gray} />
              <Text style={styles.emptyStateTitle}>Nenhum favorito salvo</Text>
              <Text style={styles.emptyStateDesc}>
                Você ainda não salvou nenhum local ou serviço. Explore a plataforma e clique no ícone de coração!
              </Text>
              <TouchableOpacity 
                style={styles.btnExplorarState}
                onPress={() => router.push('/src/screens/TelaExplorar')}
              >
                <Text style={styles.btnExplorarStateText}>Explorar Agora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* SEÇÃO: ESTABELECIMENTOS SALVOS */}
              {(abaAtiva === 'todos' || abaAtiva === 'estabelecimentos') && temEstabelecimentos && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionIconBg}>
                        <Ionicons name="bed-outline" size={16} color={COLORS.primary} />
                      </View>
                      <Text style={styles.sectionTitle}>Reservas salvas</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')}>
                      <View style={styles.verTodasRow}>
                        <Text style={styles.verTodasText}>Ver todas</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {dados.estabelecimentos.map((item) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.favoriteCard}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: item.id } })}
                    >
                      <Image 
                        source={{ uri: item.foto_banner || item.foto_perfil || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=300' }} 
                        style={styles.cardImage} 
                      />

                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
                        
                        <View style={styles.cardMetaRow}>
                          <Ionicons name="location-outline" size={12} color={COLORS.black} />
                          <Text style={styles.cardMetaText} numberOfLines={1}>
                            {item.cidade ? `${item.cidade}, ${item.estado}` : 'Rio de Janeiro, RJ'}
                          </Text>
                        </View>

                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={13} color={COLORS.warning} />
                          <Text style={styles.ratingValue}>
                            {item.avaliacao_media || '4.8'}{' '}
                            <Text style={styles.ratingCount}>({item.total_avaliacoes || '86'})</Text>
                          </Text>
                        </View>

                        <Text style={styles.priceText}>
                          R$ {item.preco_medio || item.valor || '620'}{' '}
                          <Text style={styles.priceUnit}>/ noite</Text>
                        </Text>
                      </View>

                      <TouchableOpacity 
                        style={styles.heartActionBtn}
                        onPress={() => solicitarRemocao(item, 'estabelecimento')}
                      >
                        <Ionicons name="heart" size={22} color={COLORS.black} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* SEÇÃO: SERVIÇOS SALVOS */}
              {(abaAtiva === 'todos' || abaAtiva === 'servicos') && temServicos && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionIconBg}>
                        <Ionicons name="bag-handle-outline" size={16} color={COLORS.primary} />
                      </View>
                      <Text style={styles.sectionTitle}>Serviços salvos</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')}>
                      <View style={styles.verTodasRow}>
                        <Text style={styles.verTodasText}>Ver todos</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {dados.servicos.map((item) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.favoriteCard}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/src/screens/ExplorarDetalhes', params: { id: item.id, tipo: 'servico' } })}
                    >
                      <Image 
                        source={{ uri: item.foto || item.estabelecimento?.foto_perfil || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=300' }} 
                        style={styles.cardImage} 
                      />

                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
                        
                        <View style={styles.cardMetaRow}>
                          <Ionicons name="location-outline" size={12} color={COLORS.black} />
                          <Text style={styles.cardMetaText} numberOfLines={1}>
                            {item.estabelecimento?.nome || item.cidade || 'São Paulo, SP'}
                          </Text>
                        </View>

                        <Text style={styles.categorySubtext}>
                          {item.categoria || 'Gastronomia • Brasileira'}
                        </Text>

                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={13} color={COLORS.warning} />
                          <Text style={styles.ratingValue}>
                            {item.avaliacao_media || '4.9'}{' '}
                            <Text style={styles.ratingCount}>({item.total_avaliacoes || '230'})</Text>
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={styles.heartActionBtn}
                        onPress={() => solicitarRemocao(item, 'servico')}
                      >
                        <Ionicons name="heart" size={22} color={COLORS.black} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

        </ScrollView>

        {/* BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/Home')}>
            <Ionicons name="home-outline" size={22} color={COLORS.black} />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/TelaExplorar')}>
            <Ionicons name="compass-outline" size={22} color={COLORS.black} />
            <Text style={styles.navLabel}>Explorar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/MeusAgendamentos')}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.black} />
            <Text style={styles.navLabel}>Reservas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="heart" size={22} color={COLORS.primary} />
            <Text style={[styles.navLabel, { color: COLORS.primary }]}>Favoritos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/TelaPerfil')}>
            <Ionicons name="person-outline" size={22} color={COLORS.black} />
            <Text style={styles.navLabel}>Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL MODERNO DE CONFIRMAÇÃO DE REMOÇÃO */}
        <Modal
          visible={modalVisivel}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setModalVisivel(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="trash-outline" size={28} color={COLORS.error} />
              </View>

              <Text style={styles.modalTitle}>Remover dos Favoritos?</Text>
              
              <Text style={styles.modalMessage}>
                Tem certeza que deseja remover <Text style={{ fontWeight: '800', color: COLORS.secondary }}>"{itemParaRemover?.nome}"</Text> dos seus salvos?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalBtnCancel} 
                  onPress={() => setModalVisivel(false)}
                  disabled={removendo}
                >
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalBtnConfirm} 
                  onPress={confirmarRemocao}
                  disabled={removendo}
                >
                  {removendo ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.modalBtnConfirmText}>Sim, remover</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'android' ? 25 : 0
  },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    position: 'relative'
  },
  scrollContent: {
    paddingBottom: 90
  },

  // HEADER BAR
  headerBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerBtn: {
    padding: 6
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.secondary
  },

  // HERO BANNER
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18
  },
  heroTextContainer: {
    flex: 1,
    paddingRight: 12
  },
  heroDescription: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
    fontWeight: '500'
  },
  heroBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },

  // TABS SUPERIORES
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
    marginLeft: 6
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '900'
  },

  // SEÇÃO DE LISTA
  sectionBlock: {
    marginTop: 20,
    paddingHorizontal: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.secondary
  },
  verTodasRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  verTodasText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '800',
    marginRight: 2
  },

  // CARD DE FAVORITO
  favoriteCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 2
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  cardMetaText: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginLeft: 4
  },
  categorySubtext: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
    marginLeft: 4
  },
  ratingCount: {
    color: COLORS.gray,
    fontWeight: '500',
    fontSize: 11
  },
  priceText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary
  },
  priceUnit: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '500'
  },
  heartActionBtn: {
    padding: 8
  },

  // EMPTY & LOADING STATES
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center'
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.secondary,
    marginTop: 12,
    marginBottom: 6
  },
  emptyStateDesc: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  btnExplorarState: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25
  },
  btnExplorarStateText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13
  },

  // BOTTOM NAVIGATION
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 8
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 2
  },

  // MODAL DE CONFIRMAÇÃO
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  modalContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 8
  },
  modalMessage: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%'
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    marginRight: 8
  },
  modalBtnCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    marginLeft: 8
  },
  modalBtnConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white
  }
});