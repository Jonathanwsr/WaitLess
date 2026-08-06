import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';

const COLORS = { primary: '#FF5A00', primaryLight: '#FFF4ED', secondary: '#111827', gray: '#6B7280', lightGray: '#F3F4F6', white: '#FFFFFF', border: '#E5E7EB', success: '#10B981', warning: '#F59E0B' };
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

type PaymentMethod = 'pix' | 'boleto' | 'cartao' | 'local';

export default function PagamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const agendamento_id = Array.isArray(params.agendamento_id) ? params.agendamento_id[0] : params.agendamento_id;
  const asaas_customer_id = Array.isArray(params.asaas_customer_id) ? params.asaas_customer_id[0] : params.asaas_customer_id;

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [processing, setProcessing] = useState(false);
  const [loadingDados, setLoadingDados] = useState(true);
  const [checkoutDados, setCheckoutDados] = useState<any>(null);

  useEffect(() => {
    buscarDadosCheckout();
  }, []);

  const buscarDadosCheckout = async () => {
    if (!agendamento_id) return;
    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      const res = await fetch(`${API_URL}/agendamentos/${agendamento_id}/checkout`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCheckoutDados(await res.json());
      }
    } catch (e) {
      console.log('Erro ao buscar checkout', e);
    } finally {
      setLoadingDados(false);
    }
  };

  const processarPagamento = async () => {
    if (!agendamento_id) return Alert.alert('Erro', 'Nenhum agendamento vinculado.');
    setProcessing(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      const payload = {
        agendamento_id: agendamento_id,
        metodo_pagamento: method,
        parcelas: 1,
        asaas_customer_id: method !== 'local' ? (asaas_customer_id || 'cus_0000000000') : undefined
      };

      const res = await fetch(`${API_URL}/pagamento/processar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.metodo === 'local' || method === 'pix') {
          // ROTA PARA A TELA DE CONFIRMAÇÃO SEGUINDO SEU FLUXO!
          router.push({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id, qr_code: data.pix_qr_code } });
        } else if (data.invoice_url) {
          await WebBrowser.openBrowserAsync(data.invoice_url);
          router.push({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id } });
        }
      } else {
        Alert.alert('Erro', data.error || 'Falha ao processar pagamento.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setProcessing(false);
    }
  };

  if (loadingDados) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const amount = checkoutDados?.valor_total ? parseFloat(checkoutDados.valor_total) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento</Text>
        <Ionicons name="lock-closed" size={20} color={COLORS.success} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* STEPPER VISUAL DA SUA IMAGEM */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepBox}><View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View><Text style={styles.stepText}>Serviço</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}><View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View><Text style={styles.stepText}>Profissional</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}><View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View><Text style={styles.stepText}>Data e hora</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}><View style={[styles.stepCircle, {backgroundColor: COLORS.primary}]}><Text style={styles.stepNumber}>4</Text></View><Text style={[styles.stepText, {color: COLORS.primary, fontWeight: 'bold'}]}>Pagamento</Text></View>
        </View>

        {/* RESUMO DO SERVIÇO (DADOS REAIS) */}
        <View style={styles.serviceSummaryCard}>
          <Image source={{ uri: checkoutDados?.estabelecimento_foto || 'https://via.placeholder.com/60' }} style={styles.serviceImage} />
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>{checkoutDados?.estabelecimento_nome}</Text>
            <Text style={styles.serviceSub}>{checkoutDados?.servico_nome} com {checkoutDados?.funcionario_nome}</Text>
            <View style={styles.serviceDateRow}>
              <Feather name="calendar" size={12} color={COLORS.gray} />
              <Text style={styles.serviceDateText}>{checkoutDados?.data_formatada} às {checkoutDados?.hora_formatada}</Text>
              <Feather name="clock" size={12} color={COLORS.gray} style={{marginLeft: 8}} />
              <Text style={styles.serviceDateText}>{checkoutDados?.duracao_minutos} min</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R$ {amount.toFixed(2).replace('.', ',')}</Text>
        </View>

        <Text style={styles.sectionTitle}>1. Escolha a forma de pagamento</Text>
        
        {/* OPÇÕES FIÉIS À IMAGEM */}
        <TouchableOpacity style={[styles.optionCard, method === 'local' && styles.optionCardActive]} onPress={() => setMethod('local')}>
          <View style={[styles.iconWrap, method === 'local' && styles.iconWrapActive]}>
            <Ionicons name="storefront" size={20} color={method === 'local' ? COLORS.primary : COLORS.gray} />
          </View>
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={styles.optionTitle}>Pagar no local</Text>
            <Text style={styles.optionDesc}>Efetue o pagamento no estabelecimento.</Text>
          </View>
          <View style={[styles.radioCircle, method === 'local' && styles.radioActive]} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionCard, method !== 'local' && styles.optionCardActive]} onPress={() => setMethod('pix')}>
          <View style={[styles.iconWrap, method !== 'local' && styles.iconWrapActive]}>
            <Ionicons name="card" size={20} color={method !== 'local' ? COLORS.primary : COLORS.gray} />
          </View>
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={styles.optionTitle}>Pagar online</Text>
            <Text style={styles.optionDesc}>Pague agora com mais praticidade e segurança.</Text>
          </View>
          <View style={[styles.radioCircle, method !== 'local' && styles.radioActive]} />
        </TouchableOpacity>

        {method !== 'local' && (
          <View style={styles.onlineMethodsContainer}>
            <Text style={styles.sectionTitle}>2. Escolha o método de pagamento</Text>
            <View style={styles.tabsRow}>
              <TouchableOpacity style={[styles.tabBtn, method === 'cartao' && styles.tabActive]} onPress={() => setMethod('cartao')}>
                <Ionicons name="card-outline" size={18} color={method === 'cartao' ? COLORS.primary : COLORS.gray} />
                <Text style={[styles.tabText, method === 'cartao' && styles.tabTextActive]}>Cartão</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, method === 'pix' && styles.tabActive]} onPress={() => setMethod('pix')}>
                <MaterialCommunityIcons name="qrcode-scan" size={18} color={method === 'pix' ? COLORS.success : COLORS.gray} />
                <Text style={[styles.tabText, method === 'pix' && {color: COLORS.success, fontWeight:'bold'}]}>Pix</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.secureBox}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
              <Text style={styles.secureText}>Pagamento 100% seguro pelo Asaas.</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.payBtn} onPress={processarPagamento} disabled={processing}>
          {processing ? <ActivityIndicator color={COLORS.white} /> : (
            <Text style={styles.payBtnText}>
              Confirmar e Pagar R$ {amount.toFixed(2).replace('.', ',')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FAFAFA' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary },
  
  container: { padding: 20 },
  
  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  stepBox: { alignItems: 'center' },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepNumber: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  stepText: { fontSize: 10, color: COLORS.gray },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.success, marginHorizontal: 4, marginBottom: 12 },

  serviceSummaryCard: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, alignItems: 'center' },
  serviceImage: { width: 60, height: 60, borderRadius: 12, marginRight: 12 },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.secondary },
  serviceSub: { fontSize: 12, color: COLORS.gray, marginBottom: 6 },
  serviceDateRow: { flexDirection: 'row', alignItems: 'center' },
  serviceDateText: { fontSize: 11, color: COLORS.gray, marginLeft: 4 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  totalLabel: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },

  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 12 },
  
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  optionCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  iconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
  iconWrapActive: { backgroundColor: '#FFEDD5' },
  optionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.secondary },
  optionDesc: { fontSize: 12, color: COLORS.gray },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.gray },
  radioActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary, borderWidth: 6 },

  onlineMethodsContainer: { marginTop: 12 },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 8, backgroundColor: COLORS.white },
  tabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary },

  secureBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, gap: 8, marginBottom: 20 },
  secureText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  payBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  payBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }
});