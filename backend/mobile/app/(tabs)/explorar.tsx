import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, TextInput, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

import { ThemedText } from '@/components/themed-text';
// import { Fonts } from '@/constants/theme'; // Descomente se for usar

// Altere para o domínio de produção da API Laravel no Render
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// Cor Laranja Mais Viva para destaques e botões
const VIVID_ORANGE = '#FF4500'; 

export default function ExploreScreen() {
  const router = useRouter();
  const [estabelecimentos, setEstabelecimentos] = useState<any[]>([]);
  const [destaques, setDestaques] = useState<any[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Tudo');

  // Categorias atualizadas com Materiais, Eventos e Restaurantes
  const categorias = [
    { nome: 'Tudo', icone: 'apps' },
    { nome: 'Beleza', icone: 'content-cut' },
    { nome: 'Barbearia', icone: 'storefront' },
    { nome: 'Imóveis', icone: 'home' },
    { nome: 'Veículos', icone: 'directions-car' },
    { nome: 'Equipamentos', icone: 'build' },
    { nome: 'Materiais', icone: 'handyman' }, // Nova
    { nome: 'Eventos', icone: 'event' },      // Nova
    { nome: 'Restaurantes', icone: 'restaurant' }, // Nova
  ];

  useEffect(() => {
    carregarDados();
  }, [categoriaAtiva]);

  const carregarDados = async () => {
    try {
      setCarregando(true);

      // CORRIGIDO: Usando a constante API_URL corretamente
      const [resExplorar, resDestaques] = await Promise.all([
        axios.get(`${API_URL}/explorar?categoria=${categoriaAtiva}`),
        axios.get(`${API_URL}/explorar/destaques`),
      ]);

      // Mapeia os dados vindo da API Laravel
      setEstabelecimentos(resExplorar.data.data || resExplorar.data || []);
      setDestaques(resDestaques.data.data || resDestaques.data || []);
    } catch (e) {
      console.log('Erro ao conectar com a API Laravel:', e);
    } finally {
      setCarregando(false);
    }
  };

  const irParaDetalhes = (id: number, tipo: 'servico' | 'aluguel') => {
    if (tipo === 'servico') {
      router.push({ pathname: '/reservas', params: { estabelecimentoId: id, tipo: 'servico' } });
    } else {
      router.push({ pathname: '/reservas', params: { itemId: id, tipo: 'aluguel' } });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#777" />
            <TextInput
              placeholder="Buscar serviços ou aluguéis..."
              placeholderTextColor="#999"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/caixa-entrada')}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.badge} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileButton}>
            <ThemedText style={styles.profileText}>JR</ThemedText>
          </TouchableOpacity>
        </View>

        {/* LOCALIZAÇÃO */}
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={18} color={VIVID_ORANGE} />
          <ThemedText style={styles.locationText} numberOfLines={1}>
            Rua Professora Eunice de Vasconcelos Xavier, 100
          </ThemedText>
          <Ionicons name="chevron-down" size={16} color="#777" />
        </View>

        {/* CATEGORIAS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categorias.map((cat, i) => {
            const isAtivo = categoriaAtiva === cat.nome;
            return (
              <TouchableOpacity
                key={i}
                style={styles.categoriaCard}
                onPress={() => setCategoriaAtiva(cat.nome)}
              >
                <View style={[styles.iconContainer, isAtivo && styles.iconContainerAtivo]}>
                  <MaterialIcons name={cat.icone as any} size={24} color={isAtivo ? VIVID_ORANGE : '#555'} />
                </View>
                <ThemedText style={[styles.categoriaTexto, isAtivo && styles.categoriaTextoAtivo]}>
                  {cat.nome}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* BANNER PRINCIPAL */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800' }}
            style={styles.bannerImage}
            contentFit="cover"
          />
          <View style={styles.bannerOverlay}>
            <ThemedText style={styles.bannerTitle}>Cuide de você{'\n'}ou alugue com{'\n'}segurança.</ThemedText>
            <ThemedText style={styles.bannerSub}>Tudo na palma da sua mão.</ThemedText>
            <TouchableOpacity style={styles.bannerButton}>
              <ThemedText style={styles.bannerButtonText}>Explorar agora  →</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* INDICADOR DE CARREGAMENTO */}
        {carregando && (
          <ActivityIndicator size="large" color={VIVID_ORANGE} style={{ marginVertical: 20 }} />
        )}

        {/* DESTAQUES PARA VOCÊ */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Destaques para você</ThemedText>
          <TouchableOpacity><ThemedText style={styles.verTodos}>Ver todos</ThemedText></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {!carregando && destaques.length > 0 ? (
            destaques.map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                style={styles.cardDestaque}
                onPress={() => irParaDetalhes(item.id, item.tipo || 'servico')}
              >
                <View>
                  <Image
                    source={{ uri: item.foto_perfil || item.foto || 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400' }}
                    style={styles.imageDestaque}
                    contentFit="cover"
                  />
                  {index === 0 && (
                    <View style={styles.badgeAlta}>
                      <ThemedText style={styles.badgeText}>Em alta 🔥</ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.cardDestaqueInfo}>
                  <ThemedText style={styles.cardDestaqueTitle} numberOfLines={1}>
                    {item.nome || item.titulo || 'Item Premium'}
                  </ThemedText>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={12} color="#FFB800" />
                    <ThemedText style={styles.ratingText}>
                      {item.avaliacao || item.avaliacao_media || '4.9'} <ThemedText style={styles.ratingCount}>({item.votos || '120'})</ThemedText>
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.priceLabel}>
                    {item.tipo_periodo ? `Aluguel por ${item.tipo_periodo}` : 'A partir de'}
                  </ThemedText>
                  <ThemedText style={styles.priceValue}>
                    R$ {parseFloat(item.valor || item.valor_diaria || '0').toFixed(2)}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            !carregando && <ThemedText style={styles.emptyText}>Nenhum item em destaque.</ThemedText>
          )}
        </ScrollView>

        {/* RECOMENDADOS (LISTA VERTICAL) */}
        <ThemedText style={styles.sectionTitle}>Recomendados na Região</ThemedText>

        {!carregando && estabelecimentos.length > 0 ? (
          estabelecimentos.map((estab, index) => (
            <TouchableOpacity
              key={estab.id || index}
              style={styles.cardRecomendado}
              onPress={() => irParaDetalhes(estab.id, estab.categoria_tipo === 'locacao' ? 'aluguel' : 'servico')}
            >
              <Image
                source={{ uri: estab.foto_perfil || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=400' }}
                style={styles.imageRecomendado}
                contentFit="cover"
              />
              <View style={styles.infoRecomendado}>
                <View style={styles.headerRecomendado}>
                  <ThemedText style={styles.cardTitle} numberOfLines={1}>
                    {estab.nome || estab.name || 'Estabelecimento'}
                  </ThemedText>
                  <Ionicons name="heart-outline" size={20} color="#999" />
                </View>

                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={12} color="#FFB800" />
                  <ThemedText style={styles.ratingText}>
                    {estab.avaliacao || estab.avaliacao_media || '4.8'} <ThemedText style={styles.ratingCount}>({estab.votos || '85'})</ThemedText>
                  </ThemedText>
                </View>

                <View style={styles.tagsContainer}>
                  <View style={styles.tag}>
                    <ThemedText style={styles.tagText}>{estab.bairro || 'Centro'}</ThemedText>
                  </View>
                  <View style={styles.tag}>
                    <ThemedText style={styles.tagText}>{estab.cidade || estab.categoria_tipo || 'Serviço'}</ThemedText>
                  </View>
                </View>

                <View style={styles.footerRecomendado}>
                  <ThemedText style={styles.priceLabel}>
                    Status: <ThemedText style={styles.priceValueRec}>{estab.ativo || estab.disponivel ? 'Aberto' : 'Fechado'}</ThemedText>
                  </ThemedText>
                  <View style={styles.timeContainer}>
                    <Ionicons name="time-outline" size={12} color="#999" />
                    <ThemedText style={styles.timeText}> Ver horários</ThemedText>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          !carregando && <ThemedText style={styles.emptyText}>Nenhum recomendado encontrado para esta categoria.</ThemedText>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 15,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  iconButton: {
    padding: 8,
    position: 'relative',
    marginRight: 5,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VIVID_ORANGE,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VIVID_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    marginLeft: 5,
    marginRight: 5,
  },
  categoriesScroll: {
    marginBottom: 20,
  },
  categoriaCard: {
    alignItems: 'center',
    marginRight: 15,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconContainerAtivo: {
    borderColor: VIVID_ORANGE,
    backgroundColor: '#FFF0E6', // Fundo levemente alaranjado
  },
  categoriaTexto: {
    fontSize: 12,
    color: '#555',
  },
  categoriaTextoAtivo: {
    color: VIVID_ORANGE,
    fontWeight: 'bold',
  },
  bannerContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 25,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  bannerSub: {
    fontSize: 12,
    color: '#333',
    marginBottom: 15,
    fontWeight: '600'
  },
  bannerButton: {
    backgroundColor: VIVID_ORANGE,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginVertical: 15,
  },
  verTodos: {
    fontSize: 13,
    color: VIVID_ORANGE,
    fontWeight: '600',
  },
  horizontalScroll: {
    marginBottom: 25,
  },
  cardDestaque: {
    width: 150,
    marginRight: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  imageDestaque: {
    width: '100%',
    height: 120,
  },
  badgeAlta: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDestaqueInfo: {
    padding: 10,
  },
  cardDestaqueTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
  },
  ratingCount: {
    color: '#999',
    fontWeight: 'normal',
  },
  priceLabel: {
    fontSize: 11,
    color: '#777',
  },
  priceValue: {
    fontSize: 14,
    color: VIVID_ORANGE,
    fontWeight: 'bold',
    marginTop: 2,
  },
  cardRecomendado: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 8,
  },
  imageRecomendado: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  infoRecomendado: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  headerRecomendado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    maxWidth: '85%',
  },
  tagsContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#555',
  },
  footerRecomendado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceValueRec: {
    fontSize: 13,
    color: VIVID_ORANGE,
    fontWeight: 'bold',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    color: '#999',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    width: '100%',
    marginVertical: 15,
  }
});