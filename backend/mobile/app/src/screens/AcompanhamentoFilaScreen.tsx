import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function AcompanhamentoFilaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [filaData, setFilaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilaStatus();
    // Você pode colocar um setInterval aqui para fazer Polling a cada 10 segundos!
  }, [id]);

  const fetchFilaStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      const res = await fetch(`${API_URL}/agendamentos/${id || '1'}/fila`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setFilaData(data);
    } catch (error) {
      console.log('Erro ao buscar fila', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSairDaFila = () => {
    Alert.alert("Sair da Fila", "Tem certeza que deseja cancelar seu atendimento?", [
      { text: "Não", style: "cancel" },
      { text: "Sim, sair", onPress: () => router.push('/src/screens/Home') }
    ]);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF6B35"/></View>;
  }

  // Fallback visual caso API falhe (Mock igual a sua imagem)
  const info = filaData || {
    posicao_atual: '03', tempo_estimado_minutos: 25,
    pessoas_na_frente: [
      { id: 1, nome_ficticio: 'Cliente 01', status_texto: 'Em atendimento', is_em_atendimento: true },
      { id: 2, nome_ficticio: 'Cliente 02', status_texto: 'Aguardando', is_em_atendimento: false }
    ],
    detalhes: { profissional: 'João Silva', servico: 'Corte Masculino', valor: 'R$ 35,00', horario_previsto: '14:30', estabelecimento: 'Barbearia Prime', endereco: 'Rua das Flores, 123 - Centro' }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <Feather name="bell" size={24} color="#1F2937" style={{marginRight: 16}} />
          <View style={styles.avatarMini} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Acompanhe sua fila em tempo real</Text>
        <Text style={styles.updateText}>Atualizado agora há pouco <View style={styles.dotGreen} /></Text>

        <View style={styles.statusHero}>
          <Text style={styles.heroTitle}>Você é o próximo!</Text>
          <Text style={styles.heroSubtitle}>Faltam {info.pessoas_na_frente?.length} pessoas para o seu atendimento.</Text>
          
          <View style={styles.circleProgress}>
            <Text style={styles.circleLabel}>SUA POSIÇÃO NA FILA</Text>
            <Text style={styles.circleNumber}>{info.posicao_atual}</Text>
          </View>

          <Text style={styles.timeLabel}>TEMPO ESTIMADO PARA SEU ATENDIMENTO</Text>
          <View style={styles.timeBox}>
            <Feather name="clock" size={18} color="#FF6B35" />
            <Text style={styles.timeValue}>{info.tempo_estimado_minutos} <Text style={{fontSize:14, fontWeight:'400'}}>min</Text></Text>
          </View>
        </View>

        <View style={styles.timelineContainer}>
          {info.pessoas_na_frente?.map((pessoa: any, index: number) => (
            <View key={index} style={styles.timelineItem}>
              <View style={[styles.timelineNode, pessoa.is_em_atendimento ? styles.nodeActive : styles.nodeWaiting]}>
                {pessoa.is_em_atendimento ? <Feather name="check" size={12} color="#FFF"/> : <Text style={styles.nodeTextSmall}>{index+1}</Text>}
              </View>
              <Text style={styles.timelineName}>{pessoa.nome_ficticio}</Text>
            </View>
          ))}
          <View style={styles.timelineItem}>
            <View style={[styles.timelineNode, styles.nodeYou]}>
              <Feather name="user" size={12} color="#FF6B35"/>
            </View>
            <Text style={[styles.timelineName, {color: '#FF6B35'}]}>Você</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Resumo do seu atendimento</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="users" size={14}/> Sua posição</Text>
            <Text style={[styles.summaryValue, {color: '#FF6B35'}]}>#{info.posicao_atual}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="clock" size={14}/> Tempo previsto</Text>
            <Text style={[styles.summaryValue, {color: '#FF6B35'}]}>{info.tempo_estimado_minutos} min</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="user" size={14}/> Profissional</Text>
            <Text style={styles.summaryValue}>{info.detalhes.profissional}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="scissors" size={14}/> Serviço</Text>
            <Text style={styles.summaryValue}>{info.detalhes.servico}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="dollar-sign" size={14}/> Valor</Text>
            <Text style={styles.summaryValue}>{info.detalhes.valor}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="calendar" size={14}/> Horário previsto</Text>
            <Text style={styles.summaryValue}>{info.detalhes.horario_previsto}</Text>
          </View>

          <TouchableOpacity style={styles.btnLeaveQueue} onPress={handleSairDaFila}>
            <Feather name="log-out" size={18} color="#FFF" />
            <Text style={styles.btnLeaveText}>Sair da Fila</Text>
          </TouchableOpacity>
        </View>

        {/* Card Profissional */}
        <Text style={styles.sectionTitle}>Profissional</Text>
        <View style={styles.profCard}>
          <View style={styles.avatarLarge} />
          <Text style={styles.profName}>{info.detalhes.profissional}</Text>
          <Text style={styles.profSub}>Barbeiro Premium</Text>
          <Text style={styles.profRating}><Ionicons name="star" size={12} color="#F59E0B"/> 4,9 <Text style={{color: '#6B7280'}}>(128 avaliações)</Text></Text>
          <TouchableOpacity style={styles.btnOutline}>
            <Text style={styles.btnOutlineText}>Ver perfil</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5E7EB' },
  
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 4 },
  updateText: { fontSize: 12, color: '#6B7280', marginBottom: 24, flexDirection: 'row', alignItems: 'center' },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginLeft: 6 },

  statusHero: { alignItems: 'center', marginBottom: 30 },
  heroTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  
  circleProgress: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circleLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center', width: '60%' },
  circleNumber: { fontSize: 48, fontWeight: '900', color: '#FF6B35' },

  timeLabel: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValue: { fontSize: 24, fontWeight: 'bold', color: '#FF6B35' },

  timelineContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, paddingHorizontal: 10 },
  timelineItem: { alignItems: 'center' },
  timelineNode: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  nodeActive: { backgroundColor: '#FF6B35' },
  nodeWaiting: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  nodeYou: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FF6B35' },
  nodeTextSmall: { fontSize: 10, color: '#6B7280' },
  timelineName: { fontSize: 10, color: '#6B7280' },

  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  
  btnLeaveQueue: { flexDirection: 'row', backgroundColor: '#FF6B35', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  btnLeaveText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  profCard: { alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E5E7EB', marginBottom: 12 },
  profName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  profSub: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  profRating: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 16 },
  
  btnOutline: { width: '100%', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#FF6B35', alignItems: 'center' },
  btnOutlineText: { color: '#FF6B35', fontWeight: 'bold', fontSize: 14 }
});