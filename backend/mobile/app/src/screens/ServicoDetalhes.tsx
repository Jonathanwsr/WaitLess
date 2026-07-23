import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#E11D48',
  secondary: '#111827',
  gray: '#6B7280',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function ServicoDetalhes() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDetalhes();
  }, [id]);

  const carregarDetalhes = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/catalogo/servicos/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setDados(json);
    } catch (e) {
      console.log('Erro ao carregar detalhes do banco de dados');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !dados || !dados.servico) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const { servico } = dados;
  const estabelecimento = servico.estabelecimento;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View style={styles.imageContainer}>
          {/* Usa a foto do estabelecimento como capa do serviço */}
          <Image source={{ uri: estabelecimento?.foto_perfil || 'https://via.placeholder.com/600x400' }} style={styles.coverImage} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* DADOS PUXADOS DA TABELA SERVICOS */}
          <Text style={styles.title}>{servico.nome}</Text>
          <Text style={styles.subtitle}>
            {estabelecimento?.cidade}, {estabelecimento?.estado} • {servico.duracao_minutos} minutos
          </Text>

          {/* DADOS PUXADOS DA TABELA ESTABELECIMENTOS */}
          <View style={styles.ratingBar}>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingScore}>{estabelecimento?.avaliacao_media || 'Novo'}</Text>
              <View style={styles.stars}>
                {[1,2,3,4,5].map(i => <Ionicons key={i} name="star" size={10} color={COLORS.secondary} />)}
              </View>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingItem}>
              <Text style={styles.ratingHighlight}>Avaliação dos clientes</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingItem}>
              <Text style={styles.ratingScore}>{estabelecimento?.total_avaliacoes || '0'}</Text>
              <Text style={styles.ratingLabel}>avaliações</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* DADOS DO ANFITRIÃO */}
          <TouchableOpacity 
            style={styles.hostSection}
            onPress={() => router.push({ pathname: '/src/screens/PerfilAnfitriao', params: { id: servico.estabelecimento_id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.hostTitle}>Oferecido por {estabelecimento?.nome}</Text>
              <Text style={styles.hostSub}>Parceiro Local • {estabelecimento?.anos_plataforma} na plataforma</Text>
            </View>
            <Image source={{ uri: estabelecimento?.foto_perfil || 'https://via.placeholder.com/50' }} style={styles.hostImage} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* DESCRIÇÃO DA TABELA SERVICOS */}
          <Text style={styles.description}>{servico.descricao || 'Nenhuma descrição fornecida.'}</Text>
        </View>
      </ScrollView>

      {/* BOTTOM SHEET FIXO COM VALOR DA TABELA */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.priceTotal}>Total: R$ {Number(servico.valor).toFixed(2).replace('.', ',')}</Text>
          <Text style={styles.priceSub}>Garantia de atendimento</Text>
        </View>
        <TouchableOpacity 
          style={styles.reserveButton}
          onPress={() => router.push({ pathname: '/src/screens/Checkout', params: { servico_id: servico.id } })}
        >
          <Text style={styles.reserveButtonText}>Reservar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { position: 'relative', width: '100%', height: 280 },
  coverImage: { width: '100%', height: '100%' },
  backButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, elevation: 3 },
  content: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.secondary, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.secondary, fontWeight: '600', marginBottom: 20 },
  ratingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16 },
  ratingItem: { alignItems: 'center', flex: 1 },
  ratingScore: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },
  stars: { flexDirection: 'row', marginTop: 4 },
  ratingLabel: { fontSize: 12, color: COLORS.secondary, textDecorationLine: 'underline', marginTop: 4 },
  ratingHighlight: { fontSize: 14, fontWeight: '800', color: COLORS.secondary, textAlign: 'center' },
  ratingDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  hostSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hostTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary, marginBottom: 4 },
  hostSub: { fontSize: 14, color: COLORS.gray },
  hostImage: { width: 50, height: 50, borderRadius: 25 },
  description: { fontSize: 16, color: '#374151', lineHeight: 24 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  priceTotal: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, textDecorationLine: 'underline' },
  priceSub: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  reserveButton: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  reserveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '800' }
});