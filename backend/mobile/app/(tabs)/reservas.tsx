import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import MeusAgendamentosScreen from '../src/screens/MeusAgendamentos';

// EXPO_PUBLIC_API_URL já vem terminando em "/mobile" — removemos esse sufixo
// antes de recompor as URLs para não gerar ".../api/mobile/mobile".
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#1A1A1A',
  gray: '#6B7280',
  lightGray: '#F8F9FA',
  border: '#EAEAEA',
  white: '#FFFFFF',
  success: '#10B981',
};

interface Servico {
  id: number;
  nome: string;
  valor?: number | string;
  duracao_minutos?: number;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

// Converte "DD/MM/AAAA" (o que o cliente digita) para "AAAA-MM-DD" (o que a API espera)
function paraIso(dataBr: string) {
  const partes = dataBr.split('/');
  if (partes.length !== 3) return '';
  const [dia, mes, ano] = partes;
  return `${ano}-${mes}-${dia}`;
}

const aplicarMascaraData = (text: string, setter: (v: string) => void) => {
  let v = text.replace(/\D/g, '');
  if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2');
  if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
  setter(v.slice(0, 10));
};

const aplicarMascaraHora = (text: string, setter: (v: string) => void) => {
  let v = text.replace(/\D/g, '');
  if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1:$2');
  setter(v.slice(0, 5));
};

type FormaPagamento = 'presencial' | 'online_agora' | 'online_depois';

// A aba "Reservas" tem dois modos: sem parâmetros, mostra a lista de
// agendamentos do cliente; com parâmetros (tipo + estabelecimentoId/itemId),
// mostra o formulário de reserva. Cada modo é um componente próprio para não
// violar as regras de hooks trocando de ramo entre eles.
export default function ReservasTab() {
  const params = useLocalSearchParams<{ tipo?: 'servico' | 'aluguel'; estabelecimentoId?: string; itemId?: string }>();

  if (!params.tipo || (!params.estabelecimentoId && !params.itemId)) {
    return <MeusAgendamentosScreen />;
  }

  return <FormularioReserva tipo={params.tipo} estabelecimentoId={params.estabelecimentoId} itemId={params.itemId} />;
}

function FormularioReserva({
  tipo,
  estabelecimentoId,
  itemId,
}: {
  tipo: 'servico' | 'aluguel';
  estabelecimentoId?: string;
  itemId?: string;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  const [estabelecimento, setEstabelecimento] = useState<any>(null);
  const [servicosDisponiveis, setServicosDisponiveis] = useState<Servico[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [item, setItem] = useState<any>(null);

  const [dataSelecionada, setDataSelecionada] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState<'diaria' | 'semanal' | 'mensal'>('diaria');
  const [quantidadePeriodos, setQuantidadePeriodos] = useState('1');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('presencial');
  const [metodoOnline, setMetodoOnline] = useState<'pix' | 'cartao' | 'boleto'>('pix');

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      if (tipo === 'servico') {
        const res = await fetch(`${API_URL}/agendamentos/estabelecimento/${estabelecimentoId}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não encontramos este estabelecimento.');
        setEstabelecimento(data.estabelecimento);
        setServicosDisponiveis(data.servicos || []);
        if ((data.servicos || []).length === 1) setServicoSelecionado(data.servicos[0]);
      } else {
        const res = await fetch(`${API_URL}/reservas/item/${itemId}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não encontramos este item.');
        setItem(data.item);
      }
    } catch (e) {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [tipo, estabelecimentoId, itemId]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const confirmarReserva = async () => {
    if (tipo === 'servico' && !servicoSelecionado) {
      return Alert.alert('Escolha um serviço', 'Selecione qual serviço você quer agendar.');
    }
    if (!dataSelecionada || dataSelecionada.length < 10) {
      return Alert.alert('Data obrigatória', 'Informe a data no formato DD/MM/AAAA.');
    }
    if (tipo === 'servico' && (!horarioSelecionado || horarioSelecionado.length < 5)) {
      return Alert.alert('Horário obrigatório', 'Informe o horário no formato HH:MM.');
    }

    setEnviando(true);
    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
      let url = '';
      let payload: Record<string, unknown> = {};

      if (tipo === 'servico') {
        url = `${API_URL}/agendamentos/estabelecimento/${estabelecimentoId}/store`;
        payload = {
          servico_id: servicoSelecionado!.id,
          data_agendamento: paraIso(dataSelecionada),
          hora_agendamento: `${horarioSelecionado}:00`,
          forma_pagamento: formaPagamento,
          ...(formaPagamento === 'online_agora' && { metodo_pagamento: metodoOnline }),
        };
      } else {
        url = `${API_URL}/reservas/item/${itemId}/store`;
        payload = {
          tipo_periodo: tipoPeriodo,
          quantidade_periodos: parseInt(quantidadePeriodos, 10) || 1,
          data_inicio: paraIso(dataSelecionada),
          forma_pagamento: formaPagamento === 'online_agora' ? metodoOnline : formaPagamento,
        };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Não foi possível continuar', data.error || 'Verifique os dados e tente novamente.');
        return;
      }

      if (data.payment_url) {
        await WebBrowser.openBrowserAsync(data.payment_url);
      } else {
        Alert.alert(
          'Reserva registrada! 🎉',
          data.message || (data.pin ? `Seu código de check-in é ${data.pin}.` : 'Confira os detalhes em "Meus agendamentos".')
        );
      }

      router.replace('/(tabs)/reservas' as never);
    } catch (e) {
      Alert.alert('Sem conexão', 'Não foi possível falar com o servidor agora. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray} />
          <Text style={styles.errorText}>Não conseguimos carregar os dados desta reserva.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={buscarDados}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const nomeItem = tipo === 'servico' ? estabelecimento?.nome : (item?.nome || item?.titulo);
  const fotoItem = tipo === 'servico' ? estabelecimento?.foto_perfil : (item?.foto || item?.foto_perfil);
  const valorUnitario = tipo === 'aluguel' ? parseFloat(item?.valor_diaria || item?.valor || '0') : parseFloat(String(servicoSelecionado?.valor || 0));
  const totalCalculado = tipo === 'aluguel' ? valorUnitario * (parseInt(quantidadePeriodos, 10) || 1) : valorUnitario;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/reservas' as never)} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tipo === 'servico' ? 'Agendar serviço' : 'Alugar item'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.imageContainer, { width, height: width * 0.55 }]}>
          <Image
            source={{ uri: fotoItem || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600' }}
            style={styles.imageBanner}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.badgeCategory}>
            <Ionicons name={tipo === 'servico' ? 'cut-outline' : 'key-outline'} size={14} color={COLORS.white} />
            <Text style={styles.badgeText}>{tipo === 'servico' ? 'Serviço' : 'Item para locação'}</Text>
          </View>
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.title}>{nomeItem || 'Sem título'}</Text>

          {tipo === 'aluguel' && item?.descricao ? <Text style={styles.description}>{item.descricao}</Text> : null}

          {/* SELEÇÃO DE SERVIÇO (apenas tipo servico) */}
          {tipo === 'servico' && (
            <>
              <Text style={styles.sectionTitle}>Escolha o serviço</Text>
              {servicosDisponiveis.length === 0 ? (
                <Text style={styles.emptyText}>Este estabelecimento não tem serviços ativos no momento.</Text>
              ) : (
                <View style={{ gap: 10, marginBottom: 8 }}>
                  {servicosDisponiveis.map((s) => {
                    const ativo = servicoSelecionado?.id === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.servicoCard, ativo && styles.servicoCardAtivo]}
                        onPress={() => setServicoSelecionado(s)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.servicoNome, ativo && styles.textoAtivo]}>{s.nome}</Text>
                          {s.duracao_minutos ? (
                            <Text style={[styles.servicoDuracao, ativo && styles.textoAtivoSub]}>{s.duracao_minutos} min</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.servicoValor, ativo && styles.textoAtivo]}>
                          R$ {Number(s.valor || 0).toFixed(2).replace('.', ',')}
                        </Text>
                        <Ionicons
                          name={ativo ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={ativo ? COLORS.white : COLORS.border}
                          style={{ marginLeft: 10 }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* CARD DE PREÇO */}
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Valor {tipo === 'aluguel' ? 'da diária' : 'do serviço'}</Text>
              <Text style={styles.priceValue}>R$ {valorUnitario.toFixed(2).replace('.', ',')}</Text>
            </View>
            {tipo === 'aluguel' && (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeLabel}>Total estimado</Text>
                <Text style={styles.totalBadgeValue}>R$ {totalCalculado.toFixed(2).replace('.', ',')}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Preencha as informações</Text>

          {/* PERÍODO (apenas aluguel) */}
          {tipo === 'aluguel' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de período</Text>
              <View style={styles.segmentedRow}>
                {(['diaria', 'semanal', 'mensal'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.segmentedBtn, tipoPeriodo === p && styles.segmentedBtnAtivo]}
                    onPress={() => setTipoPeriodo(p)}
                  >
                    <Text style={[styles.segmentedText, tipoPeriodo === p && styles.segmentedTextAtivo]}>
                      {p === 'diaria' ? 'Diária' : p === 'semanal' ? 'Semanal' : 'Mensal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* DATA */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tipo === 'servico' ? 'Data da reserva' : 'Data de início'}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={COLORS.gray}
                value={dataSelecionada}
                onChangeText={(t) => aplicarMascaraData(t, setDataSelecionada)}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          {tipo === 'servico' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Horário desejado</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.gray}
                  value={horarioSelecionado}
                  onChangeText={(t) => aplicarMascaraHora(t, setHorarioSelecionado)}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantidade de {tipoPeriodo === 'diaria' ? 'diárias' : tipoPeriodo === 'semanal' ? 'semanas' : 'meses'}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="repeat-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 3"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                  value={quantidadePeriodos}
                  onChangeText={setQuantidadePeriodos}
                />
              </View>
            </View>
          )}

          {/* FORMA DE PAGAMENTO */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Como você quer pagar?</Text>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.pagamentoOpcao, formaPagamento === 'presencial' && styles.pagamentoOpcaoAtiva]}
                onPress={() => setFormaPagamento('presencial')}
              >
                <Ionicons name="storefront-outline" size={18} color={formaPagamento === 'presencial' ? COLORS.primary : COLORS.gray} />
                <Text style={[styles.pagamentoTexto, formaPagamento === 'presencial' && styles.pagamentoTextoAtivo]}>Pagar no local</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pagamentoOpcao, formaPagamento === 'online_agora' && styles.pagamentoOpcaoAtiva]}
                onPress={() => setFormaPagamento('online_agora')}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={formaPagamento === 'online_agora' ? COLORS.primary : COLORS.gray} />
                <Text style={[styles.pagamentoTexto, formaPagamento === 'online_agora' && styles.pagamentoTextoAtivo]}>Pagar agora, online</Text>
              </TouchableOpacity>
              {tipo === 'servico' && (
                <TouchableOpacity
                  style={[styles.pagamentoOpcao, formaPagamento === 'online_depois' && styles.pagamentoOpcaoAtiva]}
                  onPress={() => setFormaPagamento('online_depois')}
                >
                  <Ionicons name="time-outline" size={18} color={formaPagamento === 'online_depois' ? COLORS.primary : COLORS.gray} />
                  <Text style={[styles.pagamentoTexto, formaPagamento === 'online_depois' && styles.pagamentoTextoAtivo]}>Reservar e pagar depois, online</Text>
                </TouchableOpacity>
              )}
            </View>

            {formaPagamento === 'online_agora' && (
              <View style={styles.metodoRow}>
                {(['pix', 'cartao', 'boleto'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.metodoBtn, metodoOnline === m && styles.metodoBtnAtivo]}
                    onPress={() => setMetodoOnline(m)}
                  >
                    <Text style={[styles.metodoTexto, metodoOnline === m && styles.metodoTextoAtivo]}>
                      {m === 'pix' ? 'PIX' : m === 'cartao' ? 'Cartão' : 'Boleto'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.buttonSubmit, enviando && styles.buttonDisabled]}
            onPress={confirmarReserva}
            activeOpacity={0.85}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.buttonSubmitText}>{tipo === 'servico' ? 'Confirmar agendamento' : 'Solicitar locação'}</Text>
                <Feather name="arrow-right" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 30 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.gray, fontWeight: '500' },
  errorText: { marginTop: 12, fontSize: 14, color: COLORS.gray, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.secondary },
  scrollContent: { paddingBottom: 40 },

  imageContainer: { position: 'relative' },
  imageBanner: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  badgeCategory: {
    position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  contentCard: { padding: 20, backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.gray, lineHeight: 21, marginBottom: 16 },
  emptyText: { fontSize: 13, color: COLORS.gray, marginBottom: 16 },

  servicoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.border,
  },
  servicoCardAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  servicoNome: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  servicoDuracao: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  servicoValor: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  textoAtivo: { color: COLORS.white },
  textoAtivoSub: { color: 'rgba(255,255,255,0.8)' },

  priceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.lightGray,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 12,
  },
  priceLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase' },
  priceValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  totalBadge: { alignItems: 'flex-end', backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primaryLight },
  totalBadgeLabel: { fontSize: 10, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase' },
  totalBadgeValue: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, marginBottom: 12 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, color: COLORS.secondary, marginBottom: 8, fontWeight: '600' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderWidth: 1.5,
    borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.secondary, fontWeight: '500' },

  segmentedRow: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderRadius: 12, padding: 4, gap: 4 },
  segmentedBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentedBtnAtivo: { backgroundColor: COLORS.primary },
  segmentedText: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  segmentedTextAtivo: { color: COLORS.white },

  pagamentoOpcao: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
  },
  pagamentoOpcaoAtiva: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  pagamentoTexto: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  pagamentoTextoAtivo: { color: COLORS.primary, fontWeight: '700' },

  metodoRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metodoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  metodoBtnAtivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  metodoTexto: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  metodoTextoAtivo: { color: COLORS.primary },

  buttonSubmit: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: 27, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  buttonDisabled: { backgroundColor: '#CCC', shadowOpacity: 0, elevation: 0 },
  buttonSubmitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
