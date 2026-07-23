import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF5A00', // Laranja
  primaryLight: '#FFF4ED',
  secondary: '#111827', // Escuro
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  success: '#059669',
  error: '#DC2626', // Vermelho para a lixeira/limpar
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function EstabelecimentoDetalhes() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [dadosLoja, setDadosLoja] = useState<any>(null);
  
  // Controle da Sacola
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [modalSacolaVisivel, setModalSacolaVisivel] = useState(false);
  
  // Checkout
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  useEffect(() => {
    carregarDadosLoja();
  }, [id]);

  const carregarDadosLoja = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const response = await fetch(`${API_URL}/estabelecimentos/${id}/catalogo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setDadosLoja(data);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar os dados do estabelecimento.');
    } finally {
      setLoading(false);
    }
  };

  const adicionarASacola = (servico: any) => {
    setItemSelecionado(servico);
  };

  const limparSacola = () => {
    setItemSelecionado(null);
    setModalSacolaVisivel(false);
  };

  const handleFinalizarPagamento = async () => {
    setProcessandoPagamento(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      const payload = {
        estabelecimento_id: dadosLoja.estabelecimento.id,
        servico_id: itemSelecionado.id,
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '14:00:00', // Exemplo estático, ajuste conforme sua lógica de horários
        metodo_pagamento: metodoPagamento
      };

      const response = await fetch(`${API_URL}/pedidos/sacola`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok) {
        setModalSacolaVisivel(false);
        setItemSelecionado(null);
        if (resData.invoice_url) {
          Alert.alert("Quase lá!", "Abra a fatura oficial para concluir o pagamento.", [
            { text: "OK", onPress: () => router.push('/src/screens/MeusAgendamentos') }
          ]);
        } else {
          Alert.alert("Reserva Confirmada!", `Seu PIN de segurança é: ${resData.pin}`, [
            { text: "Ver Meus Agendamentos", onPress: () => router.push('/src/screens/MeusAgendamentos') }
          ]);
        }
      } else {
        Alert.alert("Erro", resData.error || "Falha ao gerar o pedido.");
      }
    } catch (e) {
      Alert.alert("Erro", "Erro de conexão com o servidor.");
    } finally {
      setProcessandoPagamento(false);
    }
  };

  if (loading || !dadosLoja) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Prevenção de erros usando arrays vazios como fallback
  const estabelecimento = dadosLoja.estabelecimento || {};
  const destaques = dadosLoja.destaques || [];
  const cupons = dadosLoja.cupons || [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: itemSelecionado ? 100 : 40 }}>
        
        {/* HEADER: Fundo Amarelo/Laranja estilo McDonald's */}
        <View style={styles.headerBackground}>
          <View style={styles.headerTopActions}>
            <TouchableOpacity style={styles.actionCircleBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.headerTopRight}>
              <TouchableOpacity style={styles.actionCircleBtn}>
                <Ionicons name="heart-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionCircleBtn, { marginLeft: 10 }]}>
                <Ionicons name="search" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* CARD PRINCIPAL (Sobreposto ao header) */}
        <View style={styles.cardPerfilLoja}>
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: estabelecimento.foto_perfil || 'https://via.placeholder.com/150' }} 
              style={styles.logoLoja} 
            />
          </View>
          <Text style={styles.nomeLoja}>{estabelecimento.nome}</Text>
          <Text style={styles.subLoja}>{estabelecimento.ramo_atuacao} • {estabelecimento.endereco}</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="star" size={14} color={COLORS.secondary} />
            <Text style={styles.infoRowText}>
              <Text style={{fontWeight: '900'}}>{estabelecimento.avaliacao_media || '5.0'}</Text> 
              <Text style={{color: COLORS.gray}}> ({estabelecimento.total_avaliacoes || '0'} avaliações) • </Text>
              <Text style={{color: COLORS.error, fontWeight: 'bold'}}>Super</Text>
            </Text>
          </View>
        </View>

        {/* CUPONS DISPONÍVEIS */}
        {cupons.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cupomScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {cupons.map((cupom: any) => (
              <View key={cupom.id} style={styles.cupomCard}>
                <View style={styles.cupomIconBg}>
                  <Ionicons name="ticket" size={16} color={COLORS.success} />
                </View>
                <View>
                  <Text style={styles.cupomSub}>Cupom de</Text>
                  <Text style={styles.cupomTitulo}>
                    {cupom.tipo_desconto === 'percentual' ? `${cupom.valor_desconto}% OFF` : `R$ ${cupom.valor_desconto}`}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* CATÁLOGO DE SERVIÇOS */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Destaques</Text>
          <View style={styles.gridDestaques}>
            {destaques.map((servico: any) => (
              <TouchableOpacity 
                key={servico.id} 
                style={styles.cardServico}
                onPress={() => adicionarASacola(servico)}
                activeOpacity={0.9}
              >
                <View style={styles.servicoInfo}>
                  <Text style={styles.servicoNome} numberOfLines={2}>{servico.nome}</Text>
                  <Text style={styles.servicoDesc} numberOfLines={2}>{servico.descricao}</Text>
                  <Text style={styles.servicoPreco}>
                    R$ {Number(servico.valor).toFixed(2).replace('.', ',')}
                  </Text>
                </View>
                {/* Simulando a imagem do serviço à direita */}
                <View style={styles.servicoImgPlaceholder}>
                  <Ionicons name="image-outline" size={24} color={COLORS.gray} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* BARRA FLUTUANTE INFERIOR (Aparece ao selecionar item) */}
      {itemSelecionado && !modalSacolaVisivel && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setModalSacolaVisivel(true)}>
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>1</Text></View>
              <Text style={styles.floatingCartTotal}>R$ {Number(itemSelecionado.valor).toFixed(2).replace('.', ',')}</Text>
            </View>
            <Text style={styles.floatingCartTextBtn}>Ver sacola</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL DA SACOLA (Estilo Full Screen / Bottom Sheet) */}
      <Modal visible={modalSacolaVisivel} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.sacolaSafeArea}>
          <View style={styles.sacolaHeader}>
            <TouchableOpacity onPress={() => setModalSacolaVisivel(false)} style={{ padding: 10 }}>
              <Ionicons name="chevron-down" size={24} color={COLORS.error} />
            </TouchableOpacity>
            <Text style={styles.sacolaTitle}>SACOLA</Text>
            <TouchableOpacity onPress={limparSacola} style={{ padding: 10 }}>
              <Text style={styles.sacolaLimpar}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sacolaBody} showsVerticalScrollIndicator={false}>
            {/* Cabecalho da Loja na Sacola */}
            <View style={styles.sacolaLojaHeader}>
              <Image source={{ uri: estabelecimento.foto_perfil || 'https://via.placeholder.com/150' }} style={styles.sacolaLojaImg} />
              <View>
                <Text style={styles.sacolaLojaNome}>{estabelecimento.nome}</Text>
                <Text style={styles.sacolaLojaLink}>Adicionar mais itens</Text>
              </View>
            </View>

            <Text style={styles.sacolaSecaoTitle}>Itens adicionados</Text>

            {itemSelecionado && (
              <View style={styles.sacolaItemRow}>
                <View style={styles.sacolaItemLeft}>
                  <View style={styles.sacolaItemImgPlaceholder}>
                    <Ionicons name="cut" size={20} color={COLORS.gray} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.sacolaItemNome}>{itemSelecionado.nome}</Text>
                    <Text style={styles.sacolaItemPreco}>R$ {Number(itemSelecionado.valor).toFixed(2).replace('.', ',')}</Text>
                  </View>
                </View>
                {/* Controles de quantidade/Lixeira */}
                <View style={styles.qtdControl}>
                  <TouchableOpacity onPress={limparSacola}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                  <Text style={styles.qtdText}>1</Text>
                  <TouchableOpacity>
                    <Ionicons name="add" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.sacolaDivisor} />

            <Text style={styles.sacolaSecaoTitle}>Opções de pagamento</Text>
            <View style={styles.opcoesPagamentoContainer}>
              {[
                { key: 'pix', label: 'PIX (Aprovação na hora)', icon: 'flash' },
                { key: 'cartao', label: 'Cartão de Crédito', icon: 'card' },
                { key: 'local', label: 'Pagar no Estabelecimento', icon: 'storefront' }
              ].map(m => (
                <TouchableOpacity 
                  key={m.key} 
                  style={[styles.opcaoPgtoCard, metodoPagamento === m.key && styles.opcaoPgtoCardAtivo]}
                  onPress={() => setMetodoPagamento(m.key)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name={m.icon as any} size={20} color={metodoPagamento === m.key ? COLORS.primary : COLORS.secondary} />
                    <Text style={[styles.opcaoPgtoLabel, metodoPagamento === m.key && { color: COLORS.primary }]}>  {m.label}</Text>
                  </View>
                  {/* Radio button circle */}
                  <View style={[styles.radioCircle, metodoPagamento === m.key && styles.radioCircleAtivo]}>
                    {metodoPagamento === m.key && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          {/* RODAPÉ DA SACOLA */}
          <View style={styles.sacolaFooter}>
            <View style={styles.sacolaTotalRow}>
              <Text style={styles.sacolaTotalLabel}>Total a pagar</Text>
              <Text style={styles.sacolaTotalValue}>
                R$ {itemSelecionado ? Number(itemSelecionado.valor).toFixed(2).replace('.', ',') : '0,00'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.btnContinuar} 
              onPress={handleFinalizarPagamento}
              disabled={processandoPagamento}
            >
              {processandoPagamento ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnContinuarText}>Continuar</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // --- HEADER (Fundo Amarelo/Laranja) ---
  headerBackground: { height: 160, backgroundColor: '#FBBF24', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 16 },
  headerTopActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTopRight: { flexDirection: 'row' },
  actionCircleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },

  // --- CARD DA LOJA ---
  cardPerfilLoja: { backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: -40, borderRadius: 24, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  logoContainer: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.white, marginTop: -50, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  logoLoja: { width: 66, height: 66, borderRadius: 33 },
  nomeLoja: { fontSize: 22, fontWeight: '900', color: COLORS.secondary, marginBottom: 4, textAlign: 'center', letterSpacing: -0.5 },
  subLoja: { fontSize: 13, color: COLORS.gray, fontWeight: '500', marginBottom: 12, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoRowText: { fontSize: 13, color: COLORS.secondary, marginLeft: 6 },

  // --- CUPONS ---
  cupomScroll: { marginTop: 24, marginBottom: 10 },
  cupomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cupomIconBg: { backgroundColor: '#ECFDF5', padding: 8, borderRadius: 10, marginRight: 12 },
  cupomTitulo: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  cupomSub: { fontSize: 10, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase' },

  // --- CATÁLOGO DE SERVIÇOS ---
  secao: { paddingHorizontal: 16, marginTop: 24 },
  tituloSecao: { fontSize: 20, fontWeight: '900', color: COLORS.secondary, marginBottom: 16 },
  gridDestaques: { gap: 16 },
  
  cardServico: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'space-between' },
  servicoInfo: { flex: 1, paddingRight: 16 },
  servicoNome: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginBottom: 4 },
  servicoDesc: { fontSize: 13, color: COLORS.gray, marginBottom: 12, lineHeight: 18 },
  servicoPreco: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  servicoImgPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },

  // --- BARRA FLUTUANTE (SACOLA) ---
  floatingCartContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 30 : 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E11D48', padding: 16, borderRadius: 12, shadowColor: '#E11D48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  cartBadgeText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  floatingCartTotal: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  floatingCartTextBtn: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  // --- MODAL SACOLA ---
  sacolaSafeArea: { flex: 1, backgroundColor: COLORS.white },
  sacolaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 20 : 0, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sacolaTitle: { fontSize: 14, fontWeight: '900', color: COLORS.secondary, letterSpacing: 1 },
  sacolaLimpar: { fontSize: 14, fontWeight: '800', color: COLORS.error },
  
  sacolaBody: { flex: 1, padding: 20 },
  sacolaLojaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  sacolaLojaImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  sacolaLojaNome: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  sacolaLojaLink: { fontSize: 13, fontWeight: '800', color: '#E11D48', marginTop: 2 },
  
  sacolaSecaoTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 16 },
  
  sacolaItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sacolaItemLeft: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  sacolaItemImgPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  sacolaItemNome: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  sacolaItemPreco: { fontSize: 14, fontWeight: '700', color: COLORS.success, marginTop: 4 },
  
  qtdControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  qtdText: { fontSize: 14, fontWeight: '900', color: COLORS.secondary, marginHorizontal: 16 },
  
  sacolaDivisor: { height: 8, backgroundColor: COLORS.lightGray, marginHorizontal: -20, marginVertical: 20 },
  
  // Opções de Pagamento (Estilo Opções de Entrega)
  opcoesPagamentoContainer: { gap: 12, marginBottom: 40 },
  opcaoPgtoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  opcaoPgtoCardAtivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  opcaoPgtoLabel: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.gray, alignItems: 'center', justifyContent: 'center' },
  radioCircleAtivo: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  sacolaFooter: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  sacolaTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sacolaTotalLabel: { fontSize: 14, color: COLORS.gray, fontWeight: '700' },
  sacolaTotalValue: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  
  btnContinuar: { backgroundColor: '#E11D48', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnContinuarText: { color: COLORS.white, fontSize: 16, fontWeight: '900' }
});