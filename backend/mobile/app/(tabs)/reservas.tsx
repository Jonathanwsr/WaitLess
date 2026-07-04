import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import axios from 'axios';

import { ThemedText } from '@/components/themed-text';

// Altere para o IP correto da sua API Laravel
const API_BASE_URL = 'http://192.168.1.100:8000/api';

export default function ReservasScreen() {
  const router = useRouter();
  // Pega os parâmetros passados pelo router.push da tela anterior
  const { tipo, estabelecimentoId, itemId } = useLocalSearchParams<{
    tipo: 'servico' | 'aluguel';
    estabelecimentoId?: string;
    itemId?: string;
  }>();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [dados, setDados] = useState<any>(null);

  // Campos do formulário (mude conforme o que seu backend espera no Request)
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [quantidadeDias, setQuantidadeDias] = useState('1'); // Exclusivo para Aluguel

  useEffect(() => {
    buscarDadosEspecificos();
  }, []);

  // 1. BUSCAR DADOS (GET) baseando-se nas rotas da sua api.php
  const buscarDadosEspecificos = async () => {
    try {
      setCarregando(true);
      let url = '';

      if (tipo === 'servico') {
        // Rota: Route::get('/agendamentos/estabelecimento/{estabelecimento}')
        url = `${API_BASE_URL}/agendamentos/estabelecimento/${estabelecimentoId}`;
      } else {
        // Rota: Route::get('/reservas/item/{id}')
        url = `${API_BASE_URL}/reservas/item/${itemId}`;
      }

      const response = await axios.get(url);
      setDados(response.data.data || response.data);
    } catch (error) {
      console.log('Erro ao buscar detalhes:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do item ou serviço.');
      router.back();
    } finally {
      setCarregando(false);
    }
  };

  // 2. ENVIAR FORMULÁRIO (POST) consumindo suas rotas de store
  const handleConfirmarReserva = async () => {
    if (!dataSelecionada) {
      return Alert.alert('Atenção', 'Por favor, insira uma data válida.');
    }

    try {
      setEnviando(true);
      let url = '';
      let payload = {};

      if (tipo === 'servico') {
        // Rota: Route::post('/agendamentos/estabelecimento/{estabelecimento}/store')
        url = `${API_BASE_URL}/agendamentos/estabelecimento/${estabelecimentoId}/store`;
        payload = {
          data: dataSelecionada,
          horario: horarioSelecionado,
          // Adicione aqui outros campos que seu ClienteAgendamentoMobileController exija
        };
      } else {
        // Rota: Route::post('/reservas/item/{id}/store')
        url = `${API_BASE_URL}/reservas/item/${itemId}/store`;
        payload = {
          data_inicio: dataSelecionada,
          dias: quantidadeDias,
          // Campos adicionais como endereço de entrega ou dados de caução se necessário
        };
      }

      const response = await axios.post(url, payload);

      if (response.status === 200 || response.status === 201) {
        Alert.alert('Sucesso! 🎉', `Seu ${tipo} foi processado com sucesso.`, [
          { text: 'OK', onPress: () => router.replace('/(tabs)/agendamentos') } // Redireciona para aba de agendamentos salvos
        ]);
      }
    } catch (error: any) {
      console.log('Erro ao processar post:', error);
      Alert.alert('Erro na Operação', error.response?.data?.message || 'Erro ao enviar dados ao servidor.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF5A00" />
        <ThemedText style={{ marginTop: 10 }}>Carregando especificações...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER DA TELA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {tipo === 'servico' ? 'Agendar Serviço' : 'Alugar Item'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* BANNER DO ITEM/ESTABELECIMENTO */}
      <Image
        source={{ uri: dados?.foto || dados?.foto_perfil || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600' }}
        style={styles.imageBanner}
        contentFit="cover"
      />

      {/* INFORMAÇÕES VINDAS DO BANCO */}
      <View style={styles.content}>
        <ThemedText style={styles.title}>{dados?.nome || dados?.titulo || 'Nome indisponível'}</ThemedText>
        <ThemedText style={styles.description}>
          {dados?.descricao || 'Sem descrição detalhada fornecida por este parceiro.'}
        </ThemedText>

        <View style={styles.priceContainer}>
          <ThemedText style={styles.priceLabel}>Valor Base:</ThemedText>
          <ThemedText style={styles.priceValue}>
            R$ {parseFloat(dados?.valor || dados?.valor_diaria || '0').toFixed(2)}
            {tipo === 'aluguel' && <ThemedText style={styles.priceSub}> / diária</ThemedText>}
          </ThemedText>
        </View>

        <View style={styles.divider} />

        {/* FORMULÁRIO DINÂMICO PARA POST */}
        <ThemedText style={styles.sectionTitle}>Preencha os dados de Reserva</ThemedText>

        <ThemedText style={styles.inputLabel}>Escolha a Data (AAAA-MM-DD):</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Ex: 2026-07-15"
          placeholderTextColor="#999"
          value={dataSelecionada}
          onChangeText={setDataSelecionada}
        />

        {tipo === 'servico' ? (
          <>
            <ThemedText style={styles.inputLabel}>Escolha o Horário (HH:MM):</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Ex: 14:30"
              placeholderTextColor="#999"
              value={horarioSelecionado}
              onChangeText={setHorarioSelecionado}
            />
          </>
        ) : (
          <>
            <ThemedText style={styles.inputLabel}>Quantidade de diárias:</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Ex: 3"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={quantidadeDias}
              onChangeText={setQuantidadeDias}
            />
          </>
        )}

        {/* BOTÃO DE CONFIRMAÇÃO DO POST */}
        <TouchableOpacity
          style={[styles.buttonSubmit, enviando && styles.buttonDisabled]}
          onPress={handleConfirmarReserva}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonSubmitText}>
              {tipo === 'servico' ? 'Confirmar Agendamento' : 'Solicitar Aluguel'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  imageBanner: {
    width: '100%',
    height: 220,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  priceLabel: {
    fontSize: 15,
    color: '#444',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF5A00',
    marginLeft: 10,
  },
  priceSub: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#777',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 48,
    fontSize: 14,
    color: '#333',
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
  },
  buttonSubmit: {
    backgroundColor: '#FF5A00',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF5A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#A5A5A5',
  },
  buttonSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
