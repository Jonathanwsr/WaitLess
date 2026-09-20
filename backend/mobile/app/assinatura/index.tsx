import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Plano, PLANOS_SOCIO, PLANOS_CLIENTE } from '../../constants/planos';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  black: '#000000',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  green: '#10B981',
  red: '#DC2626',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  yellow: '#F59E0B',
  yellowLight: '#FFFBEB',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface DetalhesFatura {
  id: number;
  nome_plano: string;
  valor_mensal: string | number;
  status: string;
}

interface StatusAssinatura {
  plano_atual: string;
  status_acesso: string;
  expira_em: string;
  dias_restantes: number;
  detalhes_fatura: DetalhesFatura | null;
  dados_usuario: {
    pontos_saldo: number;
    asaas_subscription_id: string | null;
    asaas_subscription_status: string | null;
    plano_assinatura: string;
    plano_expira_em: string;
  };
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function AssinaturaScreen() {
  const router = useRouter();

  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [papel, setPapel] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [cicloFaturamento, setCicloFaturamento] = useState<'mensal' | 'anual'>('mensal');
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'credit_card'>('pix');

  const isSocio = papel === 'socio';
  const catalogoPlanos = isSocio ? PLANOS_SOCIO : PLANOS_CLIENTE;
  const planosExibidos = catalogoPlanos.filter((p) => p.ciclo === cicloFaturamento || !isSocio);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      const [resStatus, resMe] = await Promise.all([
        fetch(`${API_URL}/assinatura/status`, { headers }),
        fetch(`${API_URL}/me`, { headers }),
      ]);

      const jsonStatus = await resStatus.json();
      const jsonMe = await resMe.json();

      setStatus(jsonStatus);
      setPapel((jsonMe?.user?.papel || 'user').toLowerCase());

      // Mantém o cache local de dados do usuário (usado para liberar botões
      // premium, ex: na Home e no Explorar) sincronizado com o plano real,
      // já que a ativação acontece de forma assíncrona no gateway de pagamento.
      const planoAtual = jsonStatus?.dados_usuario?.plano_assinatura;
      if (planoAtual) {
        try {
          const userDataString = await SecureStore.getItemAsync('userData');
          const usuarioCache = userDataString ? JSON.parse(userDataString) : {};
          await SecureStore.setItemAsync('userData', JSON.stringify({
            ...usuarioCache,
            plano_assinatura: planoAtual,
          }));
        } catch (e) {
          // cache é apenas otimização; segue sem travar a tela
        }
      }
    } catch (e) {
      console.log('Erro ao carregar assinatura');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const hasSubscription = ['ativo', 'em período de teste'].includes((status?.status_acesso || '').toLowerCase());

  const valorPlanoFormatado = status?.detalhes_fatura?.valor_mensal
    ? `R$ ${Number(status.detalhes_fatura.valor_mensal).toFixed(2).replace('.', ',')}`
    : 'R$ 0,00';

  const confirmarPlano = async () => {
    if (!planoSelecionado) return;
    setProcessando(true);

    const endpoint = hasSubscription ? '/assinatura/mudar-plano' : '/assinatura/assinar';
    const payload = hasSubscription
      ? { novo_plano: planoSelecionado.id, metodo: metodoPagamento }
      : { plano: planoSelecionado.id, metodo: metodoPagamento };

    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        Alert.alert('Não foi possível continuar', json.error || 'Tente novamente em instantes.');
        return;
      }

      if (json.gateway_link) {
        await WebBrowser.openBrowserAsync(json.gateway_link);
      } else {
        Alert.alert('Tudo certo!', json.message || 'Operação realizada com sucesso.');
      }

      setPlanoSelecionado(null);
      setMostrarPlanos(false);
      carregar();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível processar sua solicitação agora.');
    } finally {
      setProcessando(false);
    }
  };

  const cancelarAssinatura = () => {
    Alert.alert(
      'Cancelar assinatura',
      'Tem certeza que deseja cancelar? O acesso fica disponível até o fim do ciclo vigente.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar assinatura',
          style: 'destructive',
          onPress: async () => {
            setProcessando(true);
            try {
              const token = await pegarToken();
              const res = await fetch(`${API_URL}/assinatura/cancelar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
              const json = await res.json();
              Alert.alert(res.ok ? 'Assinatura cancelada' : 'Não foi possível cancelar', json.message || json.error || '');
              carregar();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível cancelar agora.');
            } finally {
              setProcessando(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        {router.canGoBack() ? (
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <Text style={styles.headerTitle}>Minha Assinatura</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* RESUMO DO PLANO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo do seu plano</Text>
          <Text style={styles.cardSubtitle}>Acompanhe o status e os dados da sua assinatura.</Text>

          <View style={styles.gridResumo}>
            <View style={[styles.statBox, styles.statBoxIndigo]}>
              <Text style={styles.statLabelIndigo}>Plano atual</Text>
              <Text style={styles.statValue}>{(status?.plano_atual || 'gratuito').toUpperCase()}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Status do acesso</Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: hasSubscription ? COLORS.green : COLORS.red }]} />
                <Text style={styles.statValue}>{status?.status_acesso || 'inativo'}</Text>
              </View>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Valor vigente</Text>
              <Text style={styles.statValue}>{valorPlanoFormatado}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Próxima ação em</Text>
              <Text style={styles.statValue}>
                {status?.expira_em} <Text style={styles.statValueSub}>({status?.dias_restantes} dias)</Text>
              </Text>
            </View>

            <View style={[styles.statBox, styles.statBoxYellow]}>
              <Text style={styles.statLabelYellow}>Saldo de pontos</Text>
              <Text style={styles.statValue}>{status?.dados_usuario?.pontos_saldo ?? 0} pts</Text>
            </View>
          </View>

          {hasSubscription && (
            <Text style={styles.integracaoTexto}>
              ID integração: {status?.dados_usuario?.asaas_subscription_id || 'Pendente'} • Status gateway: {status?.dados_usuario?.asaas_subscription_status || 'Aguardando'}
            </Text>
          )}

          <View style={styles.acoesRow}>
            {hasSubscription && !mostrarPlanos && (
              <TouchableOpacity style={styles.btnMudarPlano} onPress={() => setMostrarPlanos(true)}>
                <Text style={styles.btnMudarPlanoTexto}>Mudar de plano</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasSubscription && (
            <TouchableOpacity style={styles.linkCancelar} onPress={cancelarAssinatura} disabled={processando}>
              <Text style={styles.linkCancelarTexto}>Cancelar assinatura atual</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* OFERTA DE PLANOS */}
        {(!hasSubscription || mostrarPlanos) && (
          <View style={styles.planosSection}>
            <Text style={styles.planosTitulo}>
              {hasSubscription ? 'Escolha o seu novo plano' : 'Evolua sua experiência'}
            </Text>
            <Text style={styles.planosSubtitulo}>
              {hasSubscription
                ? 'A cobrança e a ativação ocorrerão apenas no seu próximo ciclo de faturamento.'
                : 'Assine agora e ganhe 7 dias grátis para testar todos os benefícios.'}
            </Text>

            {isSocio && (
              <View style={styles.toggleCiclo}>
                <TouchableOpacity
                  style={[styles.toggleBtn, cicloFaturamento === 'mensal' && styles.toggleBtnAtivo]}
                  onPress={() => setCicloFaturamento('mensal')}
                >
                  <Text style={[styles.toggleTexto, cicloFaturamento === 'mensal' && styles.toggleTextoAtivo]}>Mensal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, cicloFaturamento === 'anual' && styles.toggleBtnAtivoIndigo]}
                  onPress={() => setCicloFaturamento('anual')}
                >
                  <Text style={[styles.toggleTexto, cicloFaturamento === 'anual' && styles.toggleTextoAtivo]}>Anual · 30% OFF</Text>
                </TouchableOpacity>
              </View>
            )}

            {planosExibidos.map((plano) => (
              <CardPlano
                key={plano.id}
                plano={plano}
                hasSubscription={hasSubscription}
                onEscolher={() => setPlanoSelecionado(plano)}
              />
            ))}

            {hasSubscription && (
              <TouchableOpacity style={styles.linkFechar} onPress={() => setMostrarPlanos(false)}>
                <Text style={styles.linkFecharTexto}>Fechar sem mudar de plano</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE MÉTODO DE PAGAMENTO */}
      <Modal visible={!!planoSelecionado} transparent animationType="fade" onRequestClose={() => setPlanoSelecionado(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {hasSubscription ? 'Agendar mudança de plano' : 'Iniciar período de teste'}
            </Text>
            <Text style={styles.modalMessage}>
              {hasSubscription
                ? `Você está mudando para o ${planoSelecionado?.nome}. A cobrança de R$ ${planoSelecionado?.preco} acontecerá apenas quando seu ciclo atual vencer.`
                : `Você está prestes a ativar o ${planoSelecionado?.nome}. A primeira cobrança de R$ ${planoSelecionado?.preco} ocorrerá somente após 7 dias.`}
            </Text>

            <TouchableOpacity
              style={[styles.opcaoPagamento, metodoPagamento === 'pix' && styles.opcaoPagamentoAtiva]}
              onPress={() => setMetodoPagamento('pix')}
            >
              <Ionicons name={metodoPagamento === 'pix' ? 'radio-button-on' : 'radio-button-off'} size={20} color={COLORS.indigo} />
              <Text style={styles.opcaoPagamentoTexto}>PIX</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.opcaoPagamento, metodoPagamento === 'credit_card' && styles.opcaoPagamentoAtiva]}
              onPress={() => setMetodoPagamento('credit_card')}
            >
              <Ionicons name={metodoPagamento === 'credit_card' ? 'radio-button-on' : 'radio-button-off'} size={20} color={COLORS.indigo} />
              <Text style={styles.opcaoPagamentoTexto}>Cartão de crédito automático</Text>
            </TouchableOpacity>

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.modalBtnVoltar}
                onPress={() => setPlanoSelecionado(null)}
                disabled={processando}
              >
                <Text style={styles.modalBtnVoltarTexto}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmar} onPress={confirmarPlano} disabled={processando}>
                {processando ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalBtnConfirmarTexto}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CardPlano({ plano, hasSubscription, onEscolher }: { plano: Plano; hasSubscription: boolean; onEscolher: () => void }) {
  const conteudo = (
    <>
      {plano.badge && (
        <View style={[styles.badgePlano, plano.destaque && styles.badgePlanoDestaque]}>
          <Text style={[styles.badgePlanoTexto, plano.destaque && styles.badgePlanoTextoDestaque]}>{plano.badge}</Text>
        </View>
      )}

      <Text style={[styles.planoNome, plano.destaque && styles.textoClaro]}>{plano.nome}</Text>
      <Text style={[styles.planoDesc, plano.destaque && styles.textoClaroSub]}>{plano.desc}</Text>

      {plano.precoOriginal && (
        <Text style={[styles.planoPrecoOriginal, plano.destaque && styles.textoClaroSub]}>De R$ {plano.precoOriginal} por</Text>
      )}
      <View style={styles.planoPrecoRow}>
        <Text style={[styles.planoPreco, plano.destaque && styles.textoClaro]}>R$ {plano.preco}</Text>
        <Text style={[styles.planoPrecoCiclo, plano.destaque && styles.textoClaroSub]}>/{plano.ciclo === 'anual' ? 'ano' : 'mês'}</Text>
      </View>

      {!hasSubscription && (
        <View style={[styles.badgeTeste, plano.destaque && styles.badgeTesteDestaque]}>
          <Text style={[styles.badgeTesteTexto, plano.destaque && styles.textoClaro]}>+ 7 dias grátis inclusos</Text>
        </View>
      )}

      <View style={styles.beneficiosLista}>
        {plano.beneficios.map((beneficio, index) => (
          <View key={index} style={styles.beneficioItem}>
            <Ionicons name="checkmark-circle" size={18} color={plano.destaque ? COLORS.white : COLORS.green} />
            <Text style={[styles.beneficioTexto, plano.destaque && styles.textoClaro]}>{beneficio}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btnEscolherPlano, plano.destaque && styles.btnEscolherPlanoDestaque]}
        onPress={onEscolher}
      >
        <Text style={[styles.btnEscolherPlanoTexto, plano.destaque && styles.btnEscolherPlanoTextoDestaque]}>
          {hasSubscription ? `Mudar para ${plano.nome}` : 'Iniciar 7 dias grátis'}
        </Text>
      </TouchableOpacity>
    </>
  );

  if (plano.destaque && plano.gradiente) {
    return (
      <LinearGradient colors={plano.gradiente} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardPlano}>
        {conteudo}
      </LinearGradient>
    );
  }

  return <View style={[styles.cardPlano, styles.cardPlanoBorda]}>{conteudo}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerBtn: { padding: 6, width: 34 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: COLORS.secondary },
  scrollContent: { padding: 16, paddingBottom: 60 },

  card: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },
  cardSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 4, marginBottom: 16 },

  gridResumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flexBasis: '48%', flexGrow: 1, backgroundColor: COLORS.lightGray, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  statBoxIndigo: { backgroundColor: COLORS.indigoLight, borderColor: COLORS.indigoLight },
  statBoxYellow: { backgroundColor: COLORS.yellowLight, borderColor: COLORS.yellowLight },
  statLabel: { fontSize: 12, color: COLORS.gray, marginBottom: 4, fontWeight: '600' },
  statLabelIndigo: { fontSize: 12, color: COLORS.indigo, marginBottom: 4, fontWeight: '700' },
  statLabelYellow: { fontSize: 12, color: '#B45309', marginBottom: 4, fontWeight: '700' },
  statValue: { fontSize: 15, fontWeight: '800', color: COLORS.secondary, textTransform: 'uppercase' },
  statValueSub: { fontSize: 11, fontWeight: '500', color: COLORS.gray, textTransform: 'none' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  integracaoTexto: { fontSize: 11, color: COLORS.gray, marginTop: 14 },

  acoesRow: { flexDirection: 'row', marginTop: 18 },
  btnMudarPlano: { backgroundColor: COLORS.secondary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  btnMudarPlanoTexto: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  linkCancelar: { marginTop: 16, alignSelf: 'flex-end' },
  linkCancelarTexto: { color: COLORS.gray, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  planosSection: { marginTop: 32 },
  planosTitulo: { fontSize: 22, fontWeight: '900', color: COLORS.secondary, textAlign: 'center' },
  planosSubtitulo: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 20 },

  toggleCiclo: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderRadius: 999, padding: 4, marginBottom: 20, alignSelf: 'center' },
  toggleBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  toggleBtnAtivo: { backgroundColor: COLORS.white },
  toggleBtnAtivoIndigo: { backgroundColor: COLORS.indigo },
  toggleTexto: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  toggleTextoAtivo: { color: COLORS.secondary },

  cardPlano: { borderRadius: 22, padding: 22, marginBottom: 16, position: 'relative' },
  cardPlanoBorda: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  badgePlano: { alignSelf: 'flex-start', backgroundColor: COLORS.indigo, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 12 },
  badgePlanoDestaque: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgePlanoTexto: { color: COLORS.white, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  badgePlanoTextoDestaque: { color: COLORS.white },

  planoNome: { fontSize: 20, fontWeight: '800', color: COLORS.secondary },
  planoDesc: { fontSize: 13, color: COLORS.gray, marginTop: 6, lineHeight: 18 },
  textoClaro: { color: COLORS.white },
  textoClaroSub: { color: 'rgba(255,255,255,0.8)' },

  planoPrecoOriginal: { fontSize: 12, color: COLORS.gray, marginTop: 14, textDecorationLine: 'line-through' },
  planoPrecoRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4, marginBottom: 4 },
  planoPreco: { fontSize: 32, fontWeight: '900', color: COLORS.secondary },
  planoPrecoCiclo: { fontSize: 14, color: COLORS.gray, marginLeft: 6 },

  badgeTeste: { alignSelf: 'flex-start', backgroundColor: COLORS.indigoLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8, marginBottom: 4 },
  badgeTesteDestaque: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeTesteTexto: { fontSize: 11, fontWeight: '700', color: COLORS.indigo },

  beneficiosLista: { marginTop: 16, gap: 12 },
  beneficioItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  beneficioTexto: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.secondary, marginTop: 1 },

  btnEscolherPlano: { marginTop: 20, backgroundColor: COLORS.indigoLight, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnEscolherPlanoDestaque: { backgroundColor: COLORS.white },
  btnEscolherPlanoTexto: { color: COLORS.indigo, fontWeight: '800', fontSize: 14 },
  btnEscolherPlanoTextoDestaque: { color: COLORS.secondary },

  linkFechar: { alignItems: 'center', marginTop: 4, marginBottom: 20 },
  linkFecharTexto: { color: COLORS.gray, fontWeight: '600', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: 22, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.secondary, marginBottom: 8 },
  modalMessage: { fontSize: 13, color: COLORS.gray, lineHeight: 19, marginBottom: 18 },

  opcaoPagamento: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  opcaoPagamentoAtiva: { borderColor: COLORS.indigo, backgroundColor: COLORS.indigoLight },
  opcaoPagamentoTexto: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },

  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtnVoltar: { flex: 1, backgroundColor: COLORS.lightGray, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnVoltarTexto: { color: COLORS.secondary, fontWeight: '700' },
  modalBtnConfirmar: { flex: 1, backgroundColor: COLORS.indigo, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnConfirmarTexto: { color: COLORS.white, fontWeight: '700' },
});
