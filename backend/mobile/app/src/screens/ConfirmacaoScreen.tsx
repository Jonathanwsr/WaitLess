import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface CheckoutData {
  pin: string;
  estabelecimento_nome: string;
  servico_nome: string;
  funcionario_nome: string;
  data_formatada: string;
  hora_formatada: string;
  valor_total: string;
}

export default function ConfirmacaoScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams(); 
  
  // Pegando o id passado da tela de pagamento
  const rawId = searchParams.id || searchParams.agendamento_id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  
  const [dados, setDados] = useState<CheckoutData | null>(null);

  useEffect(() => {
    const buscarResumo = async () => {
      try {
        const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
        const res = await fetch(`${API_URL}/pagamentos/${id}/resumo`, { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (res.ok) {
          setDados(await res.json());
        }
      } catch (error) {
        console.log("Erro ao buscar resumo", error);
      }
    };
    
    if (id) buscarResumo();
  }, [id]);

  if (!dados) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" color="#FF5A00"/></View>;

  const pinDigits = dados.pin ? dados.pin.split('') : ['0','0','0','0'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/src/screens/Home')}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmação</Text>
        <Feather name="more-vertical" size={24} color="#1F2937" />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        </View>
        <Text style={styles.title}>Pedido Confirmado!</Text>
        <Text style={styles.subtitle}>Sua reserva foi processada com sucesso. Mostre o PIN abaixo para iniciar/retirar.</Text>

        <View style={styles.pinCard}>
          <Text style={styles.pinLabel}>PIN de Segurança</Text>
          <View style={styles.pinContainer}>
            {pinDigits.map((num: string, idx: number) => (
              <View key={idx} style={styles.pinBox}><Text style={styles.pinText}>{num}</Text></View>
            ))}
          </View>
          <View style={styles.securityWarning}>
            <Feather name="shield" size={14} color="#6B7280" />
            <Text style={styles.securityText}>Apresente este código apenas após o serviço ser finalizado ou o bem ser retirado.</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.avatarPlaceholder} />
            <View>
              <Text style={styles.summaryTitle}>{dados.estabelecimento_nome}</Text>
              <Text style={styles.summarySub}>{dados.servico_nome}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {dados.funcionario_nome && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}><Feather name="user" size={14}/> Profissional</Text>
              <Text style={styles.summaryValue}>{dados.funcionario_nome}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="clock" size={14}/> Horário</Text>
            <Text style={styles.summaryValue}>{dados.data_formatada} às {dados.hora_formatada}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Pago</Text>
            <Text style={styles.summaryPrice}>R$ {parseFloat(dados.valor_total).toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.btnOutline}><Text style={styles.btnOutlineText}>Baixar Comprovante</Text></TouchableOpacity>
        
        {/* BOTÃO PARA VER A FILA EM TEMPO REAL */}
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push({ pathname: '/src/screens/AcompanhamentoFilaScreen', params: { id } })}>
          <Text style={styles.btnPrimaryText}>Acompanhar Fila Ao Vivo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btnDanger}><Text style={styles.btnDangerText}>CANCELAR RESERVA</Text></TouchableOpacity>
        
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnFinish} onPress={() => router.push('/src/screens/Home')}>
          <Text style={styles.btnFinishText}>Concluir e Voltar</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  container: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  successIconBox: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  
  pinCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', marginBottom: 20 },
  pinLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  pinContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pinBox: { width: 45, height: 55, backgroundColor: '#FEF2F2', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  pinText: { fontSize: 24, fontWeight: 'bold', color: '#B91C1C' },
  securityWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, gap: 8 },
  securityText: { fontSize: 10, color: '#4B5563', flex: 1 },

  summaryCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  summarySub: { fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  summaryPrice: { fontSize: 16, fontWeight: 'bold', color: '#FF5A00' },

  btnOutline: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 12, alignItems: 'center' },
  btnOutlineText: { fontSize: 14, fontWeight: 'bold', color: '#4B5563' },
  btnPrimary: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: '#FF5A00', marginBottom: 12, alignItems: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
  btnDanger: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', marginBottom: 20 },
  btnDangerText: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },

  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  btnFinish: { flexDirection: 'row', backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnFinishText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});