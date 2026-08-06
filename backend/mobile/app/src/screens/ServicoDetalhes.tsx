import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#E11D48',
  primaryLight: '#FFE4E6',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  cardBg: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  star: '#FBBF24',
  green: '#10B981'
};

const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1560026301-88340cf26b6b?q=80&w=1000&auto=format&fit=crop';
const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

export default function ServicoDetalhes() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  
  // Garante a captura correta do ID vindo da navegação
  const rawId = searchParams.id || searchParams.servicoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Estado do Botão Seguir
  const [seguindo, setSeguindo] = useState(false);
  const [loadingSeguir, setLoadingSeguir] = useState(false);

  // Datas e Horários para Agendamento/Reserva
  const [diasDisponiveis, setDiasDisponiveis] = useState<any[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState(0);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string>('');

  useEffect(() => {
    if (id) {
      gerarCalendario();
      carregarDetalhes();
    } else {
      setLoading(false);
      setError(true);
    }
  }, [id]);

  const gerarCalendario = () => {
    const dias = [];
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const data = new Date();
      data.setDate(data.getDate() + i);
      dias.push({
        diaSemana: i === 0 ? 'Hoje' : nomesDias[data.getDay()],
        numero: data.getDate().toString(),
        dataISO: data.toISOString().split('T')[0]
      });
    }
    setDiasDisponiveis(dias);

    const horariosDefault = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
    setHorariosDisponiveis(horariosDefault);
    setHorarioSelecionado(horariosDefault[0]);
  };

  const carregarDetalhes = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await AsyncStorage.getItem('@waitless_token');
      
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
      const url = `${cleanBaseUrl}/mobile/catalogo/servicos/${id}`;

      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const json = await res.json();

      if (res.ok && (json.servico || json.data || json.id)) {
        const servicoData = json.servico || json.data || json;
        setDados({ servico: servicoData });
        
        // Verifica status inicial do botão "Seguir"
        if (servicoData.estabelecimento?.seguindo || json.seguindo) {
          setSeguindo(true);
        }
      } else {
        setError(true);
      }
    } catch (e) {
      console.log('Erro ao carregar detalhes:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // 1. NAVEGAÇÃO CORRETA PARA O ESTABELECIMENTO
  const irParaEstabelecimento = () => {
    const estId = dados?.servico?.estabelecimento_id || dados?.servico?.estabelecimento?.id;
    if (estId) {
      router.push({
        pathname: '/src/screens/PerfilAnfitriao',
        params: { id: String(estId), estabelecimentoId: String(estId) }
      });
    } else {
      Alert.alert('Aviso', 'ID do estabelecimento não encontrado.');
    }
  };

  // 2. LÓGICA DO BOTÃO SEGUIR / DEIXAR DE SEGUIR
  const toggleSeguir = async () => {
    const estId = dados?.servico?.estabelecimento_id || dados?.servico?.estabelecimento?.id;
    if (!estId) return;

    try {
      setLoadingSeguir(true);
      const estadoAnterior = seguindo;
      setSeguindo(!estadoAnterior); // Atualização otimista na UI

      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
      
      const response = await fetch(`${cleanBaseUrl}/mobile/estabelecimentos/${estId}/seguir`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Se a API falhar, reverte o estado
        setSeguindo(estadoAnterior);
      }
    } catch (e) {
      console.log('Erro ao seguir estabelecimento:', e);
    } finally {
      setLoadingSeguir(false);
    }
  };

  // 3. EXTRAÇÃO E PARSE DAS COMODIDADES DO BANCO DE DADOS
  const parseComodidadesDoBanco = () => {
    const servico = dados?.servico;
    const estabelecimento = servico?.estabelecimento;

    let comodidadesRaw = servico?.comodidades || estabelecimento?.comodidades || [];

    if (typeof comodidadesRaw === 'string') {
      try {
        comodidadesRaw = JSON.parse(comodidadesRaw);
      } catch (e) {
        comodidadesRaw = comodidadesRaw.split(',').map((item: string) => item.trim());
      }
    }

    if (!Array.isArray(comodidadesRaw) || comodidadesRaw.length === 0) {
      return [];
    }

    return comodidadesRaw.map((item: any) => {
      const nome = typeof item === 'string' ? item : (item?.nome || item?.label || 'Comodidade');
      return {
        label: nome,
        icon: obterIconeComodidade(nome)
      };
    });
  };

  const obterIconeComodidade = (nome: string): string => {
    const text = String(nome).toLowerCase();
    if (text.includes('wifi') || text.includes('internet')) return 'wifi';
    if (text.includes('ar') || text.includes('clima')) return 'snowflake';
    if (text.includes('estaciona') || text.includes('vaga') || text.includes('park')) return 'car';
    if (text.includes('piscina')) return 'pool';
    if (text.includes('cafe') || text.includes('bebida')) return 'coffee';
    if (text.includes('pet') || text.includes('animal')) return 'dog';
    if (text.includes('acessib') || text.includes('rampa')) return 'wheelchair-accessibility';
    return 'check-circle-outline';
  };

  // 4. RESERVA E REDIRECIONAMENTO CORRIGIDOS
  const handleReservar = () => {
    if (!dados?.servico) return;
    
    const servico = dados.servico;
    const estabelecimento = servico.estabelecimento;
    const diaObj = diasDisponiveis[diaSelecionado];

    router.push({
      pathname: '/src/screens/Checkout',
      params: {
        servico_id: String(servico.id),
        nome_servico: servico.nome || '',
        valor: String(servico.valor || 0),
        estabelecimento_id: String(servico.estabelecimento_id || estabelecimento?.id || ''),
        nome_estabelecimento: estabelecimento?.nome || '',
        data: diaObj?.dataISO || '',
        horario: horarioSelecionado
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !dados || !dados.servico) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray} />
        <Text style={styles.errorText}>Não foi possível carregar os detalhes do serviço.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={carregarDetalhes}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { servico } = dados;
  const estabelecimento = servico.estabelecimento;
  const fotoCapa = servico.foto || estabelecimento?.foto_perfil || DEFAULT_PLACEHOLDER;
  const listaComodidades = parseComodidadesDoBanco();

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* FOTO DE CAPA E BOTÃO VOLTAR */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: fotoCapa }} style={styles.coverImage} />
          
          <SafeAreaView style={styles.headerOverlay}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* TÍTULO E LOCALIZAÇÃO */}
          <Text style={styles.title}>{servico.nome}</Text>
          <Text style={styles.subtitle}>
            {estabelecimento?.cidade ? `${estabelecimento.cidade}, ${estabelecimento.estado}` : 'Localização não informada'} • {servico.duracao_minutos || 30} min
          </Text>

          {/* BARRA DE AVALIAÇÃO */}
          <View style={styles.ratingBar}>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingScore}>{estabelecimento?.avaliacao_media || '5.0'}</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons key={i} name="star" size={11} color={COLORS.star} />
                ))}
              </View>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingItem}>
              <Text style={styles.ratingHighlight}>Avaliações do local</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingItem}>
              <Text style={styles.ratingScore}>{estabelecimento?.total_avaliacoes || '0'}</Text>
              <Text style={styles.ratingLabel}>opiniões</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* CARD DO ANFITRIÃO / ESTABELECIMENTO COM BOTÃO DE SEGUIR */}
          <View style={styles.hostCardContainer}>
            <TouchableOpacity 
              style={styles.hostInfoArea}
              onPress={irParaEstabelecimento}
            >
              <Image 
                source={{ uri: estabelecimento?.foto_perfil || DEFAULT_PLACEHOLDER }} 
                style={styles.hostImage} 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.hostTitle}>{estabelecimento?.nome || 'Estabelecimento'}</Text>
                <Text style={styles.hostSub}>
                  {estabelecimento?.cidade || 'Ver todos os serviços oferecidos'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* BOTÃO SEGUIR */}
            <TouchableOpacity 
              style={[styles.followButton, seguindo && styles.followingButton]}
              onPress={toggleSeguir}
              disabled={loadingSeguir}
            >
              {loadingSeguir ? (
                <ActivityIndicator size="small" color={seguindo ? COLORS.secondary : COLORS.white} />
              ) : (
                <Text style={[styles.followButtonText, seguindo && styles.followingButtonText]}>
                  {seguindo ? 'Seguindo' : 'Seguir'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* SELEÇÃO DE DATA */}
          <Text style={styles.sectionTitle}>Selecione a Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {diasDisponiveis.map((item, index) => {
              const selected = index === diaSelecionado;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, selected && styles.dateCardSelected]}
                  onPress={() => setDiaSelecionado(index)}
                >
                  <Text style={[styles.dateDay, selected && styles.textSelected]}>{item.diaSemana}</Text>
                  <Text style={[styles.dateNum, selected && styles.textSelected]}>{item.numero}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* SELEÇÃO DE HORÁRIO */}
          <Text style={styles.sectionTitle}>Horários Disponíveis</Text>
          <View style={styles.timeSlotsGrid}>
            {horariosDisponiveis.map((slot, index) => {
              const selected = slot === horarioSelecionado;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.timeChip, selected && styles.timeChipSelected]}
                  onPress={() => setHorarioSelecionado(slot)}
                >
                  <Text style={[styles.timeChipText, selected && styles.timeChipTextSelected]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* EXIBIÇÃO DAS COMODIDADES PUXADAS DO BANCO DE DADOS */}
          {listaComodidades.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Comodidades e Recursos</Text>
              <View style={styles.amenitiesGrid}>
                {listaComodidades.map((item: any, idx: number) => (
                  <View key={idx} style={styles.amenityCard}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={COLORS.primary} />
                    <Text style={styles.amenityText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.divider} />

          {/* DESCRIÇÃO DO SERVIÇO */}
          <Text style={styles.sectionTitle}>Sobre o Serviço</Text>
          <Text style={styles.description}>
            {servico.descricao || 'Nenhuma descrição detalhada foi fornecida para este serviço.'}
          </Text>
        </View>
      </ScrollView>

      {/* BOTTOM BAR COM PREÇO E BOTÃO RESERVAR */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.priceTotal}>
            Total: R$ {Number(servico.valor || 0).toFixed(2).replace('.', ',')}
          </Text>
          <Text style={styles.priceSub}>Garantia de agendamento</Text>
        </View>
        <TouchableOpacity style={styles.reserveButton} onPress={handleReservar}>
          <Text style={styles.reserveButtonText}>Reservar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, color: COLORS.gray, textAlign: 'center', marginTop: 12, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: COLORS.white, fontWeight: '700' },

  imageContainer: { position: 'relative', width: '100%', height: 260 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerOverlay: { position: 'absolute', top: 12, left: 16, right: 16 },
  backButton: { 
    width: 38, height: 38, borderRadius: 19, 
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 
  },

  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.secondary, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.gray, fontWeight: '500', marginBottom: 16 },

  ratingBar: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16,
    backgroundColor: COLORS.lightGray
  },
  ratingItem: { alignItems: 'center', flex: 1 },
  ratingScore: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  stars: { flexDirection: 'row', marginTop: 2 },
  ratingLabel: { fontSize: 11, color: COLORS.gray, textDecorationLine: 'underline', marginTop: 2 },
  ratingHighlight: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, textAlign: 'center' },
  ratingDivider: { width: 1, height: 26, backgroundColor: COLORS.border },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },

  hostCardContainer: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border
  },
  hostInfoArea: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  hostTitle: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  hostSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  hostImage: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: COLORS.border },

  followButton: {
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20
  },
  followingButton: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border
  },
  followButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  followingButtonText: { color: COLORS.secondary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, marginBottom: 12 },
  
  dateCard: {
    width: 60, height: 68, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: COLORS.white
  },
  dateCardSelected: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  dateDay: { fontSize: 12, color: COLORS.gray, marginBottom: 4 },
  dateNum: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  textSelected: { color: COLORS.primary },

  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white
  },
  timeChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  timeChipTextSelected: { color: COLORS.white },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8
  },
  amenityText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },

  description: { fontSize: 15, color: '#374151', lineHeight: 22 },

  bottomBar: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 16, 
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 10
  },
  priceTotal: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },
  priceSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  reserveButton: { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  reserveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '800' }
});