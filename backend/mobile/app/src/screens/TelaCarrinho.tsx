import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',
  secondary: '#282828',
  black: '#000000',
  gray: '#6A6C72',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  border: '#E6E7E9',
  green: '#00A868',
  yellow: '#B45309',
  yellowBg: '#FFFBEB',
  error: '#DC2626',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface ItemCarrinho {
  id: number;
  quantidade: number;
  estabelecimento_id: number;
  estabelecimento_nome: string;
  servico_id: number;
  nome_item: string;
  duracao_minutos?: number;
  preco_unitario: number;
  subtotal: number;
  fotos: string[];
}

function formatarPreco(valor: number) {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function TelaCarrinho() {
  const router = useRouter();

  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [total, setTotal] = useState(0);
  const [itensRemovidos, setItensRemovidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<number | null>(null);
  const [processandoCheckout, setProcessandoCheckout] = useState(false);
  const [itemParaRemover, setItemParaRemover] = useState<ItemCarrinho | null>(null);
  const [fotoIndices, setFotoIndices] = useState<Record<number, number>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/carrinho`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();

      setItens(json.data || []);
      setTotal(json.resumo?.total_carrinho || 0);
      setItensRemovidos(json.resumo?.itens_removidos || 0);
    } catch (e) {
      console.log('Erro ao carregar carrinho');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const atualizarQuantidade = async (item: ItemCarrinho, novaQuantidade: number) => {
    if (novaQuantidade < 1) return;
    setAtualizandoId(item.id);

    setItens((atual) =>
      atual.map((i) => (i.id === item.id ? { ...i, quantidade: novaQuantidade, subtotal: i.preco_unitario * novaQuantidade } : i))
    );

    try {
      const token = await pegarToken();
      await fetch(`${API_URL}/carrinho/${item.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: novaQuantidade }),
      });
      carregar();
    } catch (e) {
      console.log('Erro ao atualizar quantidade');
    } finally {
      setAtualizandoId(null);
    }
  };

  const confirmarRemocao = async () => {
    if (!itemParaRemover) return;
    const id = itemParaRemover.id;
    setItemParaRemover(null);

    try {
      const token = await pegarToken();
      await fetch(`${API_URL}/carrinho/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setItens((atual) => atual.filter((i) => i.id !== id));
    } catch (e) {
      console.log('Erro ao remover item');
    }
  };

  const moverFoto = (itemId: number, direcao: number, totalFotos: number) => {
    setFotoIndices((prev) => {
      const atual = prev[itemId] || 0;
      let novo = atual + direcao;
      if (novo < 0) novo = totalFotos - 1;
      if (novo >= totalFotos) novo = 0;
      return { ...prev, [itemId]: novo };
    });
  };

  const irParaAgendamento = async () => {
    setProcessandoCheckout(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/carrinho/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();

      if (!res.ok) {
        console.log(json.error || 'Não foi possível iniciar o agendamento.');
        return;
      }

      router.push({
        pathname: '/src/screens/EstabelecimentoDetalhes',
        params: { id: json.estabelecimento_id, tipo: 'servico' },
      });
    } catch (e) {
      console.log('Erro ao iniciar checkout');
    } finally {
      setProcessandoCheckout(false);
    }
  };

  const quantidadeTotal = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : itens.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-outline" size={48} color={COLORS.gray} />
          </View>
          <Text style={styles.emptyStateTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptyStateDesc}>
            Navegue pelos estabelecimentos e adicione serviços para agendar seu horário sem filas.
          </Text>
          <TouchableOpacity style={styles.btnExplorar} onPress={() => router.push('/(tabs)/explorar' as never)}>
            <Text style={styles.btnExplorarTexto}>Explorar serviços</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {itensRemovidos > 0 && (
              <View style={styles.avisoBanner}>
                <Ionicons name="warning-outline" size={18} color={COLORS.yellow} />
                <Text style={styles.avisoTexto}>
                  {itensRemovidos} serviço(s) do seu carrinho foram removidos pelo estabelecimento e não estão mais disponíveis.
                </Text>
              </View>
            )}

            {itens.map((item) => {
              const temFotos = item.fotos && item.fotos.length > 0;
              const indiceFoto = fotoIndices[item.id] || 0;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.fotoContainer}>
                    {temFotos ? (
                      <>
                        <Image source={{ uri: item.fotos[indiceFoto] }} style={styles.foto} />
                        {item.fotos.length > 1 && (
                          <>
                            <TouchableOpacity
                              style={[styles.fotoBtn, styles.fotoBtnEsquerda]}
                              onPress={() => moverFoto(item.id, -1, item.fotos.length)}
                            >
                              <Ionicons name="chevron-back" size={16} color={COLORS.secondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.fotoBtn, styles.fotoBtnDireita]}
                              onPress={() => moverFoto(item.id, 1, item.fotos.length)}
                            >
                              <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    ) : (
                      <View style={styles.fotoFallback}>
                        <Ionicons name="bag-outline" size={28} color={COLORS.gray} />
                      </View>
                    )}
                  </View>

                  <View style={styles.infoContainer}>
                    <TouchableOpacity style={styles.btnRemover} onPress={() => setItemParaRemover(item)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.gray} />
                    </TouchableOpacity>

                    <View style={styles.estabelecimentoRow}>
                      <Ionicons name="location-outline" size={12} color={COLORS.gray} />
                      <Text style={styles.estabelecimentoTexto} numberOfLines={1}>{item.estabelecimento_nome}</Text>
                    </View>

                    <Text style={styles.nomeServico} numberOfLines={2}>{item.nome_item}</Text>

                    {!!item.duracao_minutos && (
                      <View style={styles.duracaoBadge}>
                        <Ionicons name="time-outline" size={12} color={COLORS.gray} />
                        <Text style={styles.duracaoTexto}>{item.duracao_minutos} min</Text>
                      </View>
                    )}

                    <View style={styles.controlesRow}>
                      <View style={styles.quantidadeControle}>
                        <TouchableOpacity
                          style={styles.quantidadeBtn}
                          disabled={item.quantidade <= 1 || atualizandoId === item.id}
                          onPress={() => atualizarQuantidade(item, item.quantidade - 1)}
                        >
                          <Ionicons name="remove" size={16} color={item.quantidade <= 1 ? COLORS.border : COLORS.secondary} />
                        </TouchableOpacity>
                        <Text style={styles.quantidadeTexto}>{item.quantidade}</Text>
                        <TouchableOpacity
                          style={styles.quantidadeBtn}
                          disabled={atualizandoId === item.id}
                          onPress={() => atualizarQuantidade(item, item.quantidade + 1)}
                        >
                          <Ionicons name="add" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.precoTexto}>{formatarPreco(item.subtotal)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.resumoContainer}>
            <View style={styles.resumoRow}>
              <Text style={styles.resumoLabel}>Serviços ({quantidadeTotal})</Text>
              <Text style={styles.resumoValor}>{formatarPreco(total)}</Text>
            </View>
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoLabel, { color: COLORS.green }]}>Taxa de agendamento</Text>
              <Text style={[styles.resumoValor, { color: COLORS.green }]}>Grátis</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.resumoRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValor}>{formatarPreco(total)}</Text>
            </View>

            <TouchableOpacity style={styles.btnAgendar} onPress={irParaAgendamento} disabled={processandoCheckout}>
              {processandoCheckout ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnAgendarTexto}>Agendar horários</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={!!itemParaRemover} transparent animationType="fade" onRequestClose={() => setItemParaRemover(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="trash-outline" size={26} color={COLORS.error} />
            </View>
            <Text style={styles.modalTitle}>Remover do carrinho?</Text>
            <Text style={styles.modalMessage}>
              Tem certeza que deseja remover{' '}
              <Text style={{ fontWeight: '800', color: COLORS.secondary }}>"{itemParaRemover?.nome_item}"</Text> do seu carrinho?
            </Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.modalBtnVoltar} onPress={() => setItemParaRemover(null)}>
                <Text style={styles.modalBtnVoltarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnRemover} onPress={confirmarRemocao}>
                <Text style={styles.modalBtnRemoverTexto}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerBar: {
    height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.secondary },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyStateTitle: { fontSize: 19, fontWeight: '800', color: COLORS.secondary, textAlign: 'center' },
  emptyStateDesc: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  btnExplorar: { backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 32, borderRadius: 28, marginTop: 24 },
  btnExplorarTexto: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  scrollContent: { padding: 16, paddingBottom: 20 },

  avisoBanner: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.yellowBg, borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'flex-start' },
  avisoTexto: { flex: 1, fontSize: 12, color: COLORS.yellow, fontWeight: '600', lineHeight: 17 },

  card: { flexDirection: 'row', gap: 14, backgroundColor: COLORS.white, borderRadius: 22, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  fotoContainer: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', backgroundColor: COLORS.lightGray },
  foto: { width: '100%', height: '100%' },
  fotoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fotoBtn: { position: 'absolute', top: '50%', marginTop: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  fotoBtnEsquerda: { left: 4 },
  fotoBtnDireita: { right: 4 },

  infoContainer: { flex: 1, position: 'relative' },
  btnRemover: { position: 'absolute', top: 0, right: 0, padding: 4 },
  estabelecimentoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, marginRight: 24 },
  estabelecimentoTexto: { fontSize: 11, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase' },
  nomeServico: { fontSize: 17, fontWeight: '800', color: COLORS.secondary, marginRight: 24, letterSpacing: -0.2 },
  duracaoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.lightGray, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  duracaoTexto: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  controlesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  quantidadeControle: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 999 },
  quantidadeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  quantidadeTexto: { width: 24, textAlign: 'center', fontWeight: '800', fontSize: 14, color: COLORS.secondary },
  precoTexto: { fontSize: 20, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.4 },

  resumoContainer: { padding: 20, paddingBottom: 28, backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resumoLabel: { fontSize: 14, color: COLORS.gray, fontWeight: '500' },
  resumoValor: { fontSize: 14, color: COLORS.secondary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  totalValor: { fontSize: 26, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.6 },

  btnAgendar: { backgroundColor: COLORS.primary, borderRadius: 28, paddingVertical: 17, alignItems: 'center', marginTop: 16 },
  btnAgendarTexto: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center' },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.secondary, marginBottom: 8 },
  modalMessage: { fontSize: 13, color: COLORS.gray, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  modalBotoes: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnVoltar: { flex: 1, backgroundColor: COLORS.lightGray, paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  modalBtnVoltarTexto: { color: COLORS.secondary, fontWeight: '700' },
  modalBtnRemover: { flex: 1, backgroundColor: COLORS.error, paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  modalBtnRemoverTexto: { color: COLORS.white, fontWeight: '700' },
});
