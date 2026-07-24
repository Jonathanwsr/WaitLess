import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';

const { width } = Dimensions.get('window');

// URL Base da API Laravel
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

export default function ReservasScreen() {
  const router = useRouter();

  // Recebe parâmetros do Expo Router
  const { tipo, estabelecimentoId, itemId } = useLocalSearchParams<{
    tipo: 'servico' | 'aluguel';
    estabelecimentoId?: string;
    itemId?: string;
  }>();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [dados, setDados] = useState<any>(null);

  // Estados dos inputs do formulário
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [quantidadeDias, setQuantidadeDias] = useState('1');

  useEffect(() => {
    buscarDadosEspecificos();
  }, []);

  // Helper para resgatar o token Sanctum salvo no app
  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        : { headers: { Accept: 'application/json' } };
    } catch {
      return { headers: { Accept: 'application/json' } };
    }
  };

  // 1. BUSCAR DADOS DO ITEM OU SERVIÇO (GET)
  const buscarDadosEspecificos = async () => {
    try {
      setCarregando(true);
      let url = '';

      if (tipo === 'servico') {
        url = `${API_BASE_URL}/agendamentos/estabelecimento/${estabelecimentoId}`;
      } else {
        url = `${API_BASE_URL}/reservas/item/${itemId}`;
      }

      const config = await getAuthHeaders();
      const response = await axios.get(url, config);
      setDados(response.data.data || response.data);
    } catch (error: any) {
      console.log('Erro ao buscar detalhes:', error?.response?.data || error.message);
      Alert.alert(
        'Erro',
        'Não foi possível carregar os detalhes do item ou serviço.'
      );
      router.back();
    } finally {
      setCarregando(false);
    }
  };

  // 2. ENVIAR SOLICITAÇÃO (POST)
  const handleConfirmarReserva = async () => {
    if (!dataSelecionada.trim()) {
      return Alert.alert('Campo Obrigatório', 'Por favor, insira uma data válida.');
    }

    if (tipo === 'servico' && !horarioSelecionado.trim()) {
      return Alert.alert('Campo Obrigatório', 'Por favor, informe o horário do agendamento.');
    }

    try {
      setEnviando(true);
      let url = '';
      let payload = {};

      if (tipo === 'servico') {
        url = `${API_BASE_URL}/agendamentos/estabelecimento/${estabelecimentoId}/store`;
        payload = {
          data: dataSelecionada,
          horario: horarioSelecionado,
        };
      } else {
        url = `${API_BASE_URL}/reservas/item/${itemId}/store`;
        payload = {
          data_inicio: dataSelecionada,
          dias: parseInt(quantidadeDias) || 1,
        };
      }

      const config = await getAuthHeaders();
      const response = await axios.post(url, payload, config);

      if (response.status === 200 || response.status === 201) {
        Alert.alert(
          'Sucesso! 🎉',
          `Seu ${tipo === 'servico' ? 'agendamento' : 'aluguel'} foi registrado com sucesso.`,
          [{ text: 'Ver Meus Pedidos', onPress: () => router.replace('/agendamentos') }]
        );
      }
    } catch (error: any) {
      console.log('Erro no envio:', error?.response?.data || error.message);
      Alert.alert(
        'Falha no Registro',
        error.response?.data?.message || 'Não foi possível completar o pedido. Tente novamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  // Cálculo dinâmico do total para locação
  const valorUnitario = parseFloat(dados?.valor || dados?.valor_diaria || '0');
  const totalCalculado =
    tipo === 'aluguel'
      ? valorUnitario * (parseInt(quantidadeDias) || 1)
      : valorUnitario;

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF5A00" />
        <ThemedText style={styles.loadingText}>
          Carregando especificações...
        </ThemedText>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* HEADER SUPERIOR */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {tipo === 'servico' ? 'Agendar Serviço' : 'Alugar Item'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* BANNER COM BADGE */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                dados?.foto ||
                dados?.foto_perfil ||
                'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600',
            }}
            style={styles.imageBanner}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.badgeCategory}>
            <Ionicons
              name={tipo === 'servico' ? 'cut-outline' : 'key-outline'}
              size={14}
              color="#FFF"
            />
            <ThemedText style={styles.badgeText}>
              {tipo === 'servico' ? 'Serviço Exclusivo' : 'Item para Locação'}
            </ThemedText>
          </View>
        </View>

        {/* INFORMAÇÕES DO ITEM */}
        <View style={styles.contentCard}>
          <ThemedText style={styles.title}>
            {dados?.nome || dados?.titulo || 'Sem título'}
          </ThemedText>
          
          <ThemedText style={styles.description}>
            {dados?.descricao ||
              'Aproveite a melhor experiência oferecida diretamente por nossos parceiros credenciados.'}
          </ThemedText>

          {/* CARD DE PREÇO E VALORES */}
          <View style={styles.priceCard}>
            <View>
              <ThemedText style={styles.priceLabel}>Valor Base</ThemedText>
              <ThemedText style={styles.priceValue}>
                R$ {valorUnitario.toFixed(2)}
                <ThemedText style={styles.priceSub}>
                  {tipo === 'aluguel' ? ' / dia' : ''}
                </ThemedText>
              </ThemedText>
            </View>

            {tipo === 'aluguel' && (
              <View style={styles.totalBadge}>
                <ThemedText style={styles.totalBadgeLabel}>Total Estimado</ThemedText>
                <ThemedText style={styles.totalBadgeValue}>
                  R$ {totalCalculado.toFixed(2)}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* FORMULÁRIO DE PREENCHIMENTO */}
          <ThemedText style={styles.sectionTitle}>
            Preencha as informações
          </ThemedText>

          {/* DATA */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Data da Reserva</ThemedText>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={20} color="#FF5A00" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-DD (ex: 2026-08-10)"
                placeholderTextColor="#A0A0A0"
                value={dataSelecionada}
                onChangeText={setDataSelecionada}
              />
            </View>
          </View>

          {/* HORÁRIO (APENAS SERVIÇO) */}
          {tipo === 'servico' ? (
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Horário Desejado</ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="time-outline" size={20} color="#FF5A00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (ex: 14:30)"
                  placeholderTextColor="#A0A0A0"
                  value={horarioSelecionado}
                  onChangeText={setHorarioSelecionado}
                />
              </View>
            </View>
          ) : (
            /* DIÁRIAS (APENAS ALUGUEL) */
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Quantidade de Diárias</ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="repeat-outline" size={20} color="#FF5A00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 3"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="numeric"
                  value={quantidadeDias}
                  onChangeText={setQuantidadeDias}
                />
              </View>
            </View>
          )}

          {/* BOTÃO SUBMIT */}
          <TouchableOpacity
            style={[styles.buttonSubmit, enviando && styles.buttonDisabled]}
            onPress={handleConfirmarReserva}
            activeOpacity={0.8}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <ThemedText style={styles.buttonSubmitText}>
                  {tipo === 'servico' ? 'Confirmar Agendamento' : 'Solicitar Locação'}
                </ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    position: 'relative',
    width: width,
    height: 230,
  },
  imageBanner: {
    width: '100%',
    height: '100%',
  },
  badgeCategory: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  contentCard: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 20,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  priceLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF5A00',
    marginTop: 2,
  },
  priceSub: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
  },
  totalBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEAE0',
  },
  totalBadgeLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalBadgeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
  },
  buttonSubmit: {
    backgroundColor: '#FF5A00',
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#FF5A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonSubmitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});