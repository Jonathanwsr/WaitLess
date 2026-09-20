import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

// --- CORES PADRÃO (mesma paleta usada em (tabs)/explorar.tsx) ---
const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF4ED',
  secondary: '#222222',
  gray: '#717171',
  lightGray: '#F7F7F9',
  white: '#FFFFFF',
  border: '#EBEBEB',
  star: '#FFB800',
  success: '#10B981',
  successBg: '#ECFDF5',
};

// Planos de cliente considerados Premium (mesmo catálogo usado no backend,
// em App\Services\PlanoService::PLANOS_PREMIUM['user']).
const PLANOS_PREMIUM_CLIENTE = ['premium', 'premium-plus', 'premium_plus', 'pro'];

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
// O .env local já define EXPO_PUBLIC_API_URL terminando em "/mobile" — removemos
// esse sufixo antes de recompor as URLs para não gerar ".../api/mobile/mobile".
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Ícone padrão para quando o backend devolve um ramo_atuacao sem mapeamento local
const ICONE_PADRAO: MaterialIconName = 'storefront';

const ICONES_CATEGORIA: Record<string, MaterialIconName> = {
  beleza: 'content-cut',
  barbearia: 'storefront',
  estetica: 'face',
  automotivo: 'directions-car',
  veiculos: 'two-wheeler',
  flats: 'hotel',
  hospedagem: 'hotel',
  pets: 'pets',
  casa: 'cleaning-services',
  eventos: 'event',
  saude: 'local-hospital',
  equipamentos: 'build',
  restaurante: 'restaurant',
  academia: 'fitness-center',
};

function resolverIconeCategoria(nome: string): MaterialIconName {
  const chave = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return ICONES_CATEGORIA[chave] || ICONE_PADRAO;
}

interface Categoria {
  nome: string;
  total: number;
}

interface EstabelecimentoProximo {
  id: number;
  nome: string;
  tipo?: string | null;
  foto_perfil?: string | null;
  avaliacao_media?: number;
  total_avaliacoes?: number;
  cidade?: string | null;
  estado?: string | null;
  distance?: number | null;
  fila_atual?: number;
}

interface AgendamentoAtivo {
  id: number;
  status: string;
  status_pagamento?: string;
  data_agendamento?: string;
  hora_agendamento?: string;
  servico?: { nome?: string };
  itemAluguel?: { nome?: string };
  estabelecimento?: { nome?: string; foto_perfil?: string };
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const [nomeUsuario, setNomeUsuario] = useState('');
  const [fotoUsuario, setFotoUsuario] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [busca, setBusca] = useState('');
  const [localizacaoTexto, setLocalizacaoTexto] = useState('Ativar localização');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proximos, setProximos] = useState<EstabelecimentoProximo[]>([]);
  const [origemProximos, setOrigemProximos] = useState<'proximidade' | 'premium' | 'recomendado'>('recomendado');
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState<AgendamentoAtivo | null>(null);
  const [pendentesPagamento, setPendentesPagamento] = useState<AgendamentoAtivo[]>([]);

  const carregarUsuario = useCallback(async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        setNomeUsuario((usuario.name || usuario.nome || 'Explorador').split(' ')[0]);
        setFotoUsuario(usuario.foto_perfil || usuario.foto || null);
        setIsPremium(PLANOS_PREMIUM_CLIENTE.includes(String(usuario.plano_assinatura || '').toLowerCase()));
      }
    } catch (e) {
      // segue sem nome, não é crítico
    }
  }, []);

  const obterLocalizacao = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: posicao.coords.latitude, lng: posicao.coords.longitude };
      setCoordenadas(coords);

      const [endereco] = await Location.reverseGeocodeAsync(posicao.coords);
      if (endereco) {
        setLocalizacaoTexto(endereco.city || endereco.subregion || endereco.region || 'Sua localização');
      }

      return coords;
    } catch (e) {
      return null;
    }
  }, []);

  const carregarDados = useCallback(async (coordsForcadas?: { lat: number; lng: number } | null) => {
    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      const coords = coordsForcadas !== undefined ? coordsForcadas : coordenadas;
      const queryProximos = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';

      // "categorias" e "estabelecimentos/proximos" são registradas sem o
      // prefixo /mobile em routes/api.php — só favoritos e meus-agendamentos
      // usam o prefixo mobile.
      const [resCategorias, resProximos, resFavoritos, resAgendamentos] = await Promise.all([
        fetch(`${cleanBaseUrl}/explorar/categorias`, { headers }),
        fetch(`${cleanBaseUrl}/estabelecimentos/proximos${queryProximos}`, { headers }),
        fetch(`${API_URL}/favoritos`, { headers }),
        fetch(`${API_URL}/meus-agendamentos`, { headers }),
      ]);

      const jsonCategorias = await resCategorias.json().catch(() => null);
      setCategorias(Array.isArray(jsonCategorias?.data) ? jsonCategorias.data : []);

      const jsonProximos = await resProximos.json().catch(() => null);
      setProximos(Array.isArray(jsonProximos?.data) ? jsonProximos.data : []);
      setOrigemProximos(jsonProximos?.origem || 'recomendado');

      const jsonFavoritos = await resFavoritos.json().catch(() => null);
      const idsFavoritos = Array.isArray(jsonFavoritos?.estabelecimentos)
        ? jsonFavoritos.estabelecimentos.map((e: { id: number }) => e.id)
        : [];
      setFavoritos(idsFavoritos);

      const jsonAgendamentos = await resAgendamentos.json().catch(() => null);
      const lista: AgendamentoAtivo[] = Array.isArray(jsonAgendamentos?.data) ? jsonAgendamentos.data : [];
      const ativo = lista.find((a) => ['pendente', 'confirmado'].includes(a.status)) || null;
      setAgendamentoAtivo(ativo);
      setPendentesPagamento(lista.filter((a) => a.status === 'aguardando_pagamento' && a.status_pagamento === 'pendente'));
    } catch (e) {
      // mantém o que já estava carregado; a UI trata listas vazias
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [coordenadas]);

  useEffect(() => {
    (async () => {
      await carregarUsuario();
      const coords = await obterLocalizacao();
      await carregarDados(coords);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarUsuario();
    }, [carregarUsuario])
  );

  const aoAtualizar = () => {
    setAtualizando(true);
    carregarDados();
  };

  const toggleFavorito = async (id: number) => {
    setFavoritos((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    try {
      const token = await pegarToken();
      await fetch(`${API_URL}/favoritos/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tipo: 'estabelecimento', id }),
      });
    } catch (e) {
      // otimista: se falhar, a próxima sincronização corrige
    }
  };

  const buscar = () => {
    router.push({ pathname: '/(tabs)/explorar' as never, params: busca.trim() ? { query: busca.trim() } : {} });
  };

  const abrirCategoria = (nome: string) => {
    router.push({ pathname: '/(tabs)/explorar' as never, params: { categoria: nome } });
  };

  const abrirEstabelecimento = (id: number) => {
    router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: id.toString() } });
  };

  const tituloCompromisso = agendamentoAtivo
    ? agendamentoAtivo.servico?.nome || agendamentoAtivo.itemAluguel?.nome || 'Seu agendamento'
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} numberOfLines={1}>Olá, {nomeUsuario || 'Explorador'} 👋</Text>
          <TouchableOpacity style={styles.locationRow} onPress={obterLocalizacao}>
            <Ionicons name="location-sharp" size={14} color={COLORS.primary} />
            <Text style={styles.locationText} numberOfLines={1}>{localizacaoTexto}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/src/screens/TelaPerfil' as never)}>
          {fotoUsuario ? (
            <Image source={{ uri: fotoUsuario }} style={styles.avatar} />
          ) : (
            <Ionicons name="person" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={COLORS.primary} />}
        >
          {/* BARRA DE PESQUISA */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.secondary} style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Busque serviços, aluguéis, hospedagens..."
              placeholderTextColor={COLORS.gray}
              style={styles.searchInput}
              value={busca}
              onChangeText={setBusca}
              onSubmitEditing={buscar}
              returnKeyType="search"
            />
          </View>

          {/* AVISO DE PAGAMENTO PENDENTE */}
          {pendentesPagamento.length > 0 && (
            <TouchableOpacity
              style={styles.pendenteCard}
              activeOpacity={0.9}
              onPress={() =>
                pendentesPagamento.length === 1
                  ? router.push({ pathname: '/src/screens/PagamentoScreen' as never, params: { agendamento_id: String(pendentesPagamento[0].id) } })
                  : router.push('/src/screens/MeusAgendamentos' as never)
              }
            >
              <View style={styles.pendenteCardIcon}>
                <Ionicons name="alert-circle" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendenteCardTitle}>
                  {pendentesPagamento.length === 1 ? 'Você tem 1 pagamento pendente' : `Você tem ${pendentesPagamento.length} pagamentos pendentes`}
                </Text>
                <Text style={styles.pendenteCardSubtitle} numberOfLines={1}>
                  Finalize agora para garantir sua reserva
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          )}

          {/* COMPROMISSO ATIVO OU BANNER DE ASSINATURA */}
          {agendamentoAtivo ? (
            <TouchableOpacity
              style={styles.activeCard}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/src/screens/AcompanhamentoFilaScreen' as never, params: { id: agendamentoAtivo.id.toString() } })}
            >
              <View style={styles.activeCardIcon}>
                <Ionicons name="time" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeCardTitle} numberOfLines={1}>
                  {agendamentoAtivo.estabelecimento?.nome || 'Seu compromisso'}
                </Text>
                <Text style={styles.activeCardSubtitle} numberOfLines={1}>
                  {tituloCompromisso} {agendamentoAtivo.hora_agendamento ? `• ${agendamentoAtivo.hora_agendamento.slice(0, 5)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.promoBanner} activeOpacity={0.9} onPress={() => router.push('/assinatura' as never)}>
              <View style={styles.promoBannerText}>
                <Text style={styles.promoBannerTitle}>Vantagens Premium</Text>
                <Text style={styles.promoBannerSubtitle}>7 dias grátis para testar todos os benefícios</Text>
              </View>
              <Ionicons name="sparkles" size={28} color={COLORS.white} />
            </TouchableOpacity>
          )}

          {/* AÇÕES RÁPIDAS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={isPremium ? styles.quickActionsRowScroll : styles.quickActionsRow}
          >
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/src/screens/MeusAgendamentos' as never)}>
              <View style={styles.quickActionIcon}><Ionicons name="calendar-outline" size={22} color={COLORS.primary} /></View>
              <Text style={styles.quickActionText}>Agendamentos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/src/screens/TelaCarrinho' as never)}>
              <View style={styles.quickActionIcon}><Ionicons name="cart-outline" size={22} color={COLORS.primary} /></View>
              <Text style={styles.quickActionText}>Carrinho</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/src/screens/FavoritosDashboard' as never)}>
              <View style={styles.quickActionIcon}><Ionicons name="heart-outline" size={22} color={COLORS.primary} /></View>
              <Text style={styles.quickActionText}>Favoritos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/src/screens/TelaSuporte' as never)}>
              <View style={styles.quickActionIcon}><Ionicons name="help-buoy-outline" size={22} color={COLORS.primary} /></View>
              <Text style={styles.quickActionText}>Suporte</Text>
            </TouchableOpacity>

            {isPremium && (
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/src/screens/OfertasPremium' as never)}>
                <View style={styles.quickActionIcon}><Ionicons name="star" size={22} color={COLORS.primary} /></View>
                <Text style={styles.quickActionText}>Ofertas Premium</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* CATEGORIAS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
            <TouchableOpacity style={styles.categoriaCard} onPress={() => router.push('/(tabs)/explorar' as never)}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="apps" size={26} color={COLORS.secondary} />
              </View>
              <Text style={styles.categoriaTexto}>Tudo</Text>
            </TouchableOpacity>

            {categorias.map((cat) => (
              <TouchableOpacity key={cat.nome} style={styles.categoriaCard} onPress={() => abrirCategoria(cat.nome)}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name={resolverIconeCategoria(cat.nome)} size={26} color={COLORS.secondary} />
                </View>
                <Text style={styles.categoriaTexto} numberOfLines={1}>{cat.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* PERTO DE VOCÊ / DESTAQUES PREMIUM / RECOMENDADOS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {origemProximos === 'proximidade' ? 'Perto de você' : origemProximos === 'premium' ? 'Em destaque' : 'Recomendados para você'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explorar' as never)}>
                <Text style={styles.seeAllText}>Ver tudo</Text>
              </TouchableOpacity>
            </View>

            {proximos.length === 0 ? (
              <View style={styles.emptyNearby}>
                <Ionicons name="compass-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyNearbyText}>
                  {coordenadas ? 'Nada por perto ainda. Explore outras regiões.' : 'Ative a localização para ver o que há perto de você.'}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {proximos.map((item) => {
                  const isFav = favoritos.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.cardDestaque, { width: width * 0.6 }]}
                      activeOpacity={0.9}
                      onPress={() => abrirEstabelecimento(item.id)}
                    >
                      <View style={styles.imageDestaqueContainer}>
                        <Image
                          source={{ uri: item.foto_perfil || 'https://via.placeholder.com/300x200' }}
                          style={styles.imageDestaque}
                          contentFit="cover"
                        />

                        {!!item.fila_atual && item.fila_atual > 0 ? (
                          <View style={styles.filaBadge}>
                            <Text style={styles.filaBadgeText}>{item.fila_atual} na fila</Text>
                          </View>
                        ) : (
                          <View style={[styles.filaBadge, styles.filaBadgeLivre]}>
                            <Text style={styles.filaBadgeText}>Sem espera</Text>
                          </View>
                        )}

                        <TouchableOpacity style={styles.heartBtnAbs} onPress={() => toggleFavorito(item.id)}>
                          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? COLORS.primary : COLORS.white} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.infoDestaque}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.titleDestaque} numberOfLines={1}>{item.nome}</Text>
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={12} color={COLORS.star} />
                            <Text style={styles.ratingText}> {Number(item.avaliacao_media || 0).toFixed(1)}</Text>
                          </View>
                        </View>
                        <Text style={styles.subTitleDestaque} numberOfLines={1}>
                          {item.tipo || 'Estabelecimento'}
                          {item.distance != null ? ` • ${item.distance} km` : item.cidade ? ` • ${item.cidade}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  greeting: { fontSize: 20, fontWeight: '900', color: COLORS.secondary, letterSpacing: -0.3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  locationText: { fontSize: 13, fontWeight: '600', color: COLORS.gray, maxWidth: '90%' },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, borderRadius: 30, paddingHorizontal: 16, height: 54,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.secondary, fontWeight: '500' },

  pendenteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#DC2626', marginHorizontal: 16, borderRadius: 18,
    padding: 16, marginBottom: 14,
  },
  pendenteCardIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  pendenteCardTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  pendenteCardSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  activeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.secondary, marginHorizontal: 16, borderRadius: 18,
    padding: 16, marginBottom: 20,
  },
  activeCardIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  activeCardTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  activeCardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  promoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, marginHorizontal: 16, borderRadius: 18,
    padding: 18, marginBottom: 20,
  },
  promoBannerText: { flex: 1, marginRight: 12 },
  promoBannerTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  promoBannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 24, width: '100%' },
  quickActionsRowScroll: { flexDirection: 'row', gap: 18, paddingHorizontal: 16, marginBottom: 24 },
  quickAction: { alignItems: 'center', width: 76 },
  quickActionIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  quickActionText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary, textAlign: 'center' },

  categoriesScroll: { marginBottom: 8 },
  categoriaCard: { alignItems: 'center', marginRight: 24, width: 64 },
  iconContainer: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  categoriaTexto: { fontSize: 12, fontWeight: '600', color: COLORS.gray, textAlign: 'center' },

  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.3 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  emptyNearby: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 40 },
  emptyNearbyText: { marginTop: 10, fontSize: 13, color: COLORS.gray, textAlign: 'center', fontWeight: '500' },

  cardDestaque: { marginRight: 16 },
  imageDestaqueContainer: { position: 'relative', width: '100%', height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  imageDestaque: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  heartBtnAbs: {
    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  filaBadge: {
    position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  filaBadgeLivre: { backgroundColor: 'rgba(16,185,129,0.85)' },
  filaBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

  infoDestaque: { paddingHorizontal: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleDestaque: { fontSize: 14, fontWeight: '800', color: COLORS.secondary, flex: 1, marginRight: 8 },
  subTitleDestaque: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
});
