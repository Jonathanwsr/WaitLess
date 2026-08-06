import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ADICIONADO: Importação do SecureStore para pegar o user_id
import * as SecureStore from 'expo-secure-store';

const COLORS = {
  primary: '#FF5A00', 
  primaryLight: '#FFF4ED',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  danger: '#EF4444',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function TelaCarrinho() {
  const router = useRouter();
  
  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState({ quantidade_itens: 0, total_carrinho: 0 });
  const [carregando, setCarregando] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState(null);
  
  const [processandoCheckout, setProcessandoCheckout] = useState(false);

  useEffect(() => {
    carregarCarrinho();
  }, []);

  const carregarCarrinho = async () => {
    setCarregando(true);
    try {
      // 1. Pega o token 
      const token = await AsyncStorage.getItem('@waitless_token');
      
      // 2. Pega o user_id do SecureStore
      const userDataString = await SecureStore.getItemAsync('userData');
      let userId = '';
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        userId = usuario.id || usuario.user_id || '';
      }

      // 3. Adiciona o user_id como query param, se necessário pelo backend
      const queryParams = new URLSearchParams({
        user_id: userId
      }).toString();

      const res = await fetch(`${API_URL}/carrinho?${queryParams}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (data.status === 'success') {
        setItens(data.data);
        setResumo(data.resumo);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar seu carrinho.');
    } finally {
      setCarregando(false);
    }
  };

  const alterarQuantidade = async (id, novaQuantidade) => {
    if (novaQuantidade < 1) return removerItem(id);

    setAtualizandoId(id);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      const userDataString = await SecureStore.getItemAsync('userData');
      let userId = '';
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        userId = usuario.id || usuario.user_id || '';
      }

      const res = await fetch(`${API_URL}/carrinho/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          quantidade: novaQuantidade,
          user_id: userId
        })
      });

      if (res.ok) {
        carregarCarrinho(); // Recarrega para atualizar os totais corretamente
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar quantidade.');
    } finally {
      setAtualizandoId(null);
    }
  };

  const removerItem = async (id) => {
    Alert.alert('Remover item', 'Deseja remover este item do carrinho?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Remover', 
        style: 'destructive',
        onPress: async () => {
          setAtualizandoId(id);
          try {
            const token = await AsyncStorage.getItem('@waitless_token');
            
            const userDataString = await SecureStore.getItemAsync('userData');
            let userId = '';
            if (userDataString) {
              const usuario = JSON.parse(userDataString);
              userId = usuario.id || usuario.user_id || '';
            }
            
            const queryParams = new URLSearchParams({ user_id: userId }).toString();

            await fetch(`${API_URL}/carrinho/${id}?${queryParams}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            carregarCarrinho();
          } catch (error) {
            Alert.alert('Erro', 'Falha ao remover o item.');
            setAtualizandoId(null);
          }
        }
      }
    ]);
  };

  const irParaPagamento = async () => {
    if (itens.length === 0) {
      Alert.alert('Carrinho vazio', 'Adicione itens antes de prosseguir.');
      return;
    }

    setProcessandoCheckout(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      const userDataString = await SecureStore.getItemAsync('userData');
      let userId = '';
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        userId = usuario.id || usuario.user_id || '';
      }

      const res = await fetch(`${API_URL}/carrinho/checkout`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (res.ok) {
        router.push({
          pathname: '/src/screens/PagamentoScreen',
          params: {
            agendamento_id: data.agendamento_id,
            valor_total: data.valor_total,
            asaas_customer_id: data.asaas_customer_id
          }
        });
      } else {
        Alert.alert('Erro', data.error || 'Não foi possível iniciar o checkout.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setProcessandoCheckout(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Carrinho</Text>
        <TouchableOpacity onPress={carregarCarrinho} style={styles.backBtn}>
          <Ionicons name="reload" size={20} color={COLORS.gray} />
        </TouchableOpacity>
      </View>

      {carregando && itens.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando carrinho...</Text>
        </View>
      ) : itens.length === 0 ? (
        /* ESTADO VAZIO ATUALIZADO (ÍCONE E TEXTO) */
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="cart-outline" size={60} color={COLORS.gray} />
          </View>
          <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptyDesc}>Adicione serviços ou locações para continuar o agendamento.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/src/screens/TelaExplorar')}>
            <Text style={styles.exploreBtnText}>Explorar Opções</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Itens Adicionados ({resumo.quantidade_itens})</Text>
              
              {itens.map((item) => (
                <View key={item.id} style={[styles.cardItem, atualizandoId === item.id && styles.cardOpacity]}>
                  <Image 
                    source={{ uri: item.foto || 'https://via.placeholder.com/150' }} 
                    style={styles.itemImg} 
                    contentFit="cover" 
                  />
                  
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemStore}>{item.estabelecimento_nome}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>{item.nome_item}</Text>
                    <Text style={styles.itemPrice}>
                      R$ {item.preco_unitario.toFixed(2).replace('.', ',')} 
                      <Text style={styles.itemPriceType}> {item.tipo === 'aluguel' ? '/ diária' : ''}</Text>
                    </Text>
                    
                    <View style={styles.itemControls}>
                      <View style={styles.qtdSelector}>
                        <TouchableOpacity 
                          style={styles.qtdBtn} 
                          onPress={() => alterarQuantidade(item.id, item.quantidade - 1)}
                        >
                          <Ionicons name="remove" size={18} color={COLORS.secondary} />
                        </TouchableOpacity>
                        
                        <Text style={styles.qtdText}>{item.quantidade}</Text>
                        
                        <TouchableOpacity 
                          style={styles.qtdBtn} 
                          onPress={() => alterarQuantidade(item.id, item.quantidade + 1)}
                        >
                          <Ionicons name="add" size={18} color={COLORS.secondary} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity 
                        style={styles.deleteBtn}
                        onPress={() => removerItem(item.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>

                  </View>
                </View>
              ))}
            </View>

            <View style={styles.resumoBox}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Subtotal</Text>
                <Text style={styles.resumoValue}>R$ {resumo.total_carrinho.toFixed(2).replace('.', ',')}</Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Taxa de Serviço</Text>
                <Text style={styles.resumoValueGr}>Grátis</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.resumoRow}>
                <Text style={styles.resumoTotalLabel}>Total estimado</Text>
                <Text style={styles.resumoTotalValue}>R$ {resumo.total_carrinho.toFixed(2).replace('.', ',')}</Text>
              </View>
            </View>

          </ScrollView>

          <View style={styles.bottomBar}>
            <View style={styles.bottomBarInfo}>
              <Text style={styles.bottomTotalLabel}>Total a pagar</Text>
              <Text style={styles.bottomTotalValue}>R$ {resumo.total_carrinho.toFixed(2).replace('.', ',')}</Text>
            </View>
            <TouchableOpacity 
              style={styles.checkoutBtn} 
              onPress={irParaPagamento}
              disabled={processandoCheckout}
            >
              {processandoCheckout ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Text style={styles.checkoutBtnText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={{ marginLeft: 4 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.lightGray, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },
  
  scrollContent: { padding: 16, paddingBottom: 120 },

  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.gray, fontWeight: '700' },
  cardOpacity: { opacity: 0.5 },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: COLORS.secondary, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: COLORS.gray, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  exploreBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100 },
  exploreBtnText: { color: COLORS.white, fontWeight: '900', fontSize: 15 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 16 },

  // Card Item
  cardItem: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 20, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  itemImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.lightGray },
  itemInfo: { flex: 1, marginLeft: 16 },
  itemStore: { fontSize: 11, fontWeight: '800', color: COLORS.gray, textTransform: 'uppercase', marginBottom: 2 },
  itemName: { fontSize: 16, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  itemPrice: { fontSize: 16, fontWeight: '900', color: COLORS.primary, marginBottom: 12 },
  itemPriceType: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  
  // Controles
  itemControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtdSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 100, paddingHorizontal: 4, paddingVertical: 4 },
  qtdBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  qtdText: { fontSize: 15, fontWeight: '900', color: COLORS.secondary, marginHorizontal: 12 },
  deleteBtn: { padding: 6 },

  // Resumo
  resumoBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resumoLabel: { fontSize: 15, color: COLORS.gray, fontWeight: '600' },
  resumoValue: { fontSize: 15, color: COLORS.secondary, fontWeight: '800' },
  resumoValueGr: { fontSize: 15, color: COLORS.success, fontWeight: '900' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  resumoTotalLabel: { fontSize: 16, color: COLORS.secondary, fontWeight: '900' },
  resumoTotalValue: { fontSize: 18, color: COLORS.primary, fontWeight: '900' },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopWidth: 1, borderTopColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
  bottomBarInfo: { flex: 1 },
  bottomTotalLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '700', marginBottom: 2 },
  bottomTotalValue: { fontSize: 22, fontWeight: '900', color: COLORS.secondary },
  checkoutBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  checkoutBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '900' }
});