import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

const COLORS = { 
  primary: '#FF5A00', 
  primaryLight: '#FFF4ED', 
  secondary: '#111827', 
  gray: '#6B7280', 
  lightGray: '#F3F4F6', 
  white: '#FFFFFF', 
  border: '#E5E7EB', 
  success: '#10B981', 
  warning: '#F59E0B' 
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

type PaymentMethod = 'pix' | 'boleto' | 'cartao' | 'local';

export default function PagamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Parâmetros recebidos da tela de Criar Reserva
  const agendamento_id = Array.isArray(params.agendamento_id) ? params.agendamento_id[0] : params.agendamento_id;
  const asaas_customer_id = Array.isArray(params.asaas_customer_id) ? params.asaas_customer_id[0] : params.asaas_customer_id;
  const valor_total_param = Array.isArray(params.valor_total) ? params.valor_total[0] : params.valor_total;
  const codigo_pedido_param = Array.isArray(params.codigo_pedido) ? params.codigo_pedido[0] : params.codigo_pedido;

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [processing, setProcessing] = useState(false);
  const [loadingDados, setLoadingDados] = useState(true);
  const [checkoutDados, setCheckoutDados] = useState<any>(null);

  useEffect(() => {
    buscarDadosCheckout();
  }, []);

  const buscarDadosCheckout = async () => {
    if (!agendamento_id) {
      setLoadingDados(false);
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      const res = await fetch(`${API_URL}/pagamentos/${agendamento_id}/resumo`, { // Rota ajustada para buscar o resumo do Pagamento Mestre
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCheckoutDados(data);
      }
    } catch (e) {
      console.log('Erro ao buscar checkout', e);
    } finally {
      setLoadingDados(false);
    }
  };

  const processarPagamento = async () => {
    if (!agendamento_id) return Alert.alert('Erro', 'Nenhum pedido vinculado.');
    
    setProcessing(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token');
      const payload = {
        pagamento_id: agendamento_id, // Enviando o ID do Pagamento Mestre
        metodo_pagamento: method,
        parcelas: 1,
        asaas_customer_id: method !== 'local' ? (asaas_customer_id || 'cus_0000000000') : undefined
      };

      const res = await fetch(`${API_URL}/pagamento/processar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.metodo === 'local' || method === 'pix') {
          router.push({ 
            pathname: '/src/screens/ConfirmacaoScreen', 
            params: { id: agendamento_id, qr_code: data.pix_qr_code, codigo: codigo_pedido_param } 
          });
        } else if (data.invoice_url) {
          await WebBrowser.openBrowserAsync(data.invoice_url);
          router.push({ 
            pathname: '/src/screens/ConfirmacaoScreen', 
            params: { id: agendamento_id, codigo: codigo_pedido_param } 
          });
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

  // Usa o valor do backend se existir, senão usa o que veio por parâmetro da tela anterior
  const amountToPay = checkoutDados?.valor_total ? parseFloat(checkoutDados.valor_total) : (parseFloat(valor_total_param as string) || 0);

  if (loadingDados) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{marginTop: 12, color: COLORS.gray, fontWeight: '600'}}>Buscando resumo do pedido...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento</Text>
        <View style={{ width: 32, alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={18} color={COLORS.success} />
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        
        {/* STEPPER VISUAL */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepBox}>
            <View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View>
            <Text style={styles.stepText}>Serviço</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}>
            <View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View>
            <Text style={styles.stepText}>Agendamento</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}>
            <View style={styles.stepCircle}><Feather name="check" size={12} color="#FFF"/></View>
            <Text style={styles.stepText}>Dados</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepBox}>
            <View style={[styles.stepCircle, {backgroundColor: COLORS.primary}]}>
              <Text style={styles.stepNumber}>4</Text>
            </View>
            <Text style={[styles.stepText, {color: COLORS.primary, fontWeight: 'bold'}]}>Pagamento</Text>
          </View>
        </View>

        {/* CÓDIGO DO PEDIDO */}
        {codigo_pedido_param && (
          <View style={styles.orderCodeBadge}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color={COLORS.primary} />
            <Text style={styles.orderCodeText}>Pedido: {codigo_pedido_param}</Text>
          </View>
        )}

        {/* RESUMO DO VALOR */}
        <View style={styles.totalSummaryCard}>
          <Text style={styles.totalSummaryLabel}>Total a pagar</Text>
          <Text style={styles.totalSummaryValue}>R$ {amountToPay.toFixed(2).replace('.', ',')}</Text>
          
          {/* Se a API retornar que usou pontos, exibe aqui */}
          {checkoutDados?.pontos_usados > 0 && (
            <View style={styles.discountRow}>
              <Ionicons name="star" size={14} color={COLORS.success} />
              <Text style={styles.discountText}>
                Desconto aplicado: {checkoutDados.pontos_usados} pontos (-R$ {Number(checkoutDados.desconto_pontos).toFixed(2).replace('.', ',')})
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>1. Como você prefere pagar?</Text>
        
        {/* OPÇÕES FIÉIS À IMAGEM */}
        <TouchableOpacity style={[styles.optionCard, method === 'local' && styles.optionCardActive]} onPress={() => setMethod('local')}>
          <View style={[styles.iconWrap, method === 'local' && styles.iconWrapActive]}>
            <Ionicons name="storefront" size={20} color={method === 'local' ? COLORS.primary : COLORS.gray} />
          </View>
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={styles.optionTitle}>Pagar no local (Presencial)</Text>
            <Text style={styles.optionDesc}>Efetue o pagamento diretamente no estabelecimento no momento do atendimento/retirada.</Text>
          </View>
          <View style={[styles.radioCircle, method === 'local' && styles.radioActive]}>
             {method === 'local' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionCard, method !== 'local' && styles.optionCardActive]} onPress={() => setMethod('pix')}>
          <View style={[styles.iconWrap, method !== 'local' && styles.iconWrapActive]}>
            <Ionicons name="shield-checkmark" size={20} color={method !== 'local' ? COLORS.primary : COLORS.gray} />
          </View>
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={styles.optionTitle}>Pagar online agora</Text>
            <Text style={styles.optionDesc}>Garanta sua reserva antecipadamente com segurança e rapidez.</Text>
          </View>
          <View style={[styles.radioCircle, method !== 'local' && styles.radioActive]}>
            {method !== 'local' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* MÉTODOS ONLINE (EXIBIDOS APENAS SE A OPÇÃO FOR ONLINE) */}
        {method !== 'local' && (
          <View style={styles.onlineMethodsContainer}>
            <Text style={styles.sectionTitle}>2. Selecione a forma digital</Text>
            <View style={styles.tabsRow}>
              <TouchableOpacity style={[styles.tabBtn, method === 'cartao' && styles.tabActive]} onPress={() => setMethod('cartao')}>
                <Ionicons name="card-outline" size={20} color={method === 'cartao' ? COLORS.primary : COLORS.gray} />
                <Text style={[styles.tabText, method === 'cartao' && styles.tabTextActive]}>Cartão</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.tabBtn, method === 'pix' && styles.tabActive]} onPress={() => setMethod('pix')}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={method === 'pix' ? COLORS.success : COLORS.gray} />
                <Text style={[styles.tabText, method === 'pix' && {color: COLORS.success, fontWeight:'800'}]}>Pix</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.secureBox}>
              <Ionicons name="lock-closed" size={16} color={COLORS.success} />
              <Text style={styles.secureText}>Pagamento processado de forma 100% segura com criptografia ponta-a-ponta.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* FOOTER BARRA ELEVADA */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainerBottom}>
            <Text style={styles.totalLabelBottom}>Total a pagar</Text>
            <Text style={styles.totalValueBottom}>R$ {amountToPay.toFixed(2).replace('.', ',')}</Text>
        </View>

        <TouchableOpacity style={styles.payBtn} onPress={processarPagamento} disabled={processing}>
          {processing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.payBtnText}>
              Confirmar Pagamento
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4, backgroundColor: COLORS.lightGray, borderRadius: 50 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },
  
  container: { padding: 20 },
  
  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  stepBox: { alignItems: 'center' },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepNumber: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  stepText: { fontSize: 10, color: COLORS.gray, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.success, marginHorizontal: 8, marginBottom: 16 },

  orderCodeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: 10, borderRadius: 8, marginBottom: 16, gap: 8, borderWidth: 1, borderColor: '#FFDDC2' },
  orderCodeText: { fontSize: 14, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },

  totalSummaryCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  totalSummaryLabel: { fontSize: 14, color: COLORS.gray, fontWeight: '600', marginBottom: 4 },
  totalSummaryValue: { fontSize: 36, fontWeight: '900', color: COLORS.secondary },
  discountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.greenLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12, gap: 6 },
  discountText: { fontSize: 12, color: COLORS.success, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginBottom: 12 },
  
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  optionCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, borderWidth: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
  iconWrapActive: { backgroundColor: '#FFEDD5' },
  optionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.secondary, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: COLORS.gray, lineHeight: 16, paddingRight: 10 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  onlineMethodsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8, backgroundColor: COLORS.white },
  tabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, borderWidth: 2 },
  tabText: { fontSize: 15, fontWeight: '700', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary },

  secureBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  secureText: { flex: 1, fontSize: 12, color: COLORS.success, fontWeight: '700', lineHeight: 18 },

  // Footer ajustado
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: COLORS.white, 
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, // Elevação
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1, 
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20
  },
  priceContainerBottom: { flex: 1 },
  totalLabelBottom: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  totalValueBottom: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  payBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  payBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '900' }
});