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
  Platform,
  TextInput,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Plano, PLANOS_SOCIO, PLANOS_CLIENTE } from '../../constants/planos';
import { alertar } from '../../services/alertar';
import * as Clipboard from 'expo-clipboard';
import PagamentoAssinatura from '../../components/client/PagamentoAssinatura';

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
  planos?: { id: string; nome: string; valor: number; ciclo: 'mensal' | 'anual'; beneficios: { titulo: string; texto: string }[] }[];
  volta_gratuito_em?: string | null;
  premium?: boolean;
  dados_usuario: {
    pontos_saldo: number;
    cpf_cnpj?: string | null;
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
  // Preço e benefícios explicados vêm do servidor (mesma lista do web); cores e selos ficam no app.
  const catalogoBase = isSocio ? PLANOS_SOCIO : PLANOS_CLIENTE;
  const catalogoPlanos: Plano[] = status?.planos?.length
    ? status.planos.map((p) => {
        const visual = catalogoBase.find((b) => b.id === p.id);
        return {
          ...(visual || { destaque: false, desc: '' }),
          id: p.id,
          nome: p.nome,
          preco: Number(p.valor).toFixed(2).replace('.', ','),
          ciclo: p.ciclo,
          beneficios: p.beneficios,
        } as Plano;
      })
    : catalogoBase;

  // Cartão digitado na tela (vai direto para o Asaas; nada fica salvo no app)
  const [cartao, setCartao] = useState({ numero: '', titular: '', validade: '', cvv: '' });
  const [titularCartao, setTitularCartao] = useState({ cpf_cnpj: '', cep: '', numero: '' });
  const mascararNumero = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const mascararValidade = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

  // Cobrança Pix perto de vencer: QR code aqui na tela (o Asaas também manda por e-mail).
  const [cobranca, setCobranca] = useState<any>(null);
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

      fetch(`${API_URL}/assinatura/cobranca`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setCobranca(j?.cobranca || null))
        .catch(() => {});

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
            // "premium" vem do servidor (vale também no período de teste logo após assinar).
            ...(typeof jsonMe?.user?.premium === 'boolean' ? { premium: jsonMe.user.premium } : {}),
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

    let dadosCartao = {};
    if (metodoPagamento === 'credit_card') {
      const [mes, ano] = cartao.validade.split('/');
      const numero = cartao.numero.replace(/\D/g, '');
      if (numero.length < 13 || !cartao.titular.trim() || !mes || !ano || cartao.cvv.length < 3) {
        alertar('Dados do cartão', 'Preencha número, nome, validade e CVV do cartão.');
        return;
      }
      if (titularCartao.cpf_cnpj.replace(/\D/g, '').length < 11 || titularCartao.cep.replace(/\D/g, '').length < 8 || !titularCartao.numero) {
        alertar('Dados do titular', 'Informe o CPF/CNPJ, o CEP e o número do endereço do titular do cartão.');
        return;
      }
      dadosCartao = {
        cartao: { numero, titular: cartao.titular.trim(), mes: Number(mes), ano: Number(ano), cvv: cartao.cvv },
        titular: { ...titularCartao },
      };
    }
    setProcessando(true);

    const endpoint = hasSubscription ? '/assinatura/mudar-plano' : '/assinatura/assinar';
    const payload = hasSubscription
      ? { novo_plano: planoSelecionado.id, metodo: metodoPagamento, ...dadosCartao }
      : { plano: planoSelecionado.id, metodo: metodoPagamento, ...dadosCartao };

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
        const primeiroErro = json?.errors ? (Object.values(json.errors)[0] as string[] | undefined)?.[0] : null;
        alertar('Não foi possível continuar', json.error || primeiroErro || 'Tente novamente em instantes.');
        return;
      }
      setCartao({ numero: '', titular: '', validade: '', cvv: '' });

      if (json.gateway_link) {
        await WebBrowser.openBrowserAsync(json.gateway_link);
      } else {
        alertar('Tudo certo!', json.message || 'Operação realizada com sucesso.');
      }

      setPlanoSelecionado(null);
      setMostrarPlanos(false);
      carregar();
    } catch (e) {
      alertar('Erro', 'Não foi possível processar sua solicitação agora.');
    } finally {
      setProcessando(false);
    }
  };

  // Cancelar = voltar para o plano Grátis (sem plano). A mensagem explica o que muda.
  const cancelarAssinatura = () => {
    const pago = status?.detalhes_fatura?.status === 'ativa';
    alertar(
      'Voltar para o plano Grátis?',
      `• A cobrança é cancelada: você não paga mais nada.\n• ${pago ? `Os benefícios continuam até ${status?.expira_em}, o fim do período já pago.` : 'Como o período ainda não foi pago, a conta volta para o Grátis agora.'}\n• Seus pontos, agendamentos e histórico continuam na conta.\n• Você pode assinar de novo quando quiser.`,
      [
        { text: 'Manter plano', style: 'cancel' },
        {
          text: 'Sim, voltar ao Grátis',
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
              alertar(res.ok ? 'Assinatura cancelada' : 'Não foi possível cancelar', json.message || json.error || '');
              if (res.ok) {
                // Atualiza o cache usado pela Home para liberar ou esconder os recursos Premium.
                try {
                  const atual = await SecureStore.getItemAsync('userData');
                  const usuarioCache = atual ? JSON.parse(atual) : {};
                  await SecureStore.setItemAsync('userData', JSON.stringify({
                    ...usuarioCache,
                    premium: !!json.premium,
                    ...(json.premium ? {} : { plano_assinatura: 'gratuito' }),
                  }));
                } catch (e) {
                  // cache é só otimização
                }
                setMostrarPlanos(false);
              }
              carregar();
            } catch (e) {
              alertar('Erro', 'Não foi possível cancelar agora.');
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
        <View style={{ flex: 1 }} />
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* COBRANÇA PIX PERTO DE VENCER: QR code aqui (o Asaas também manda por e-mail) */}
        {cobranca?.mostrar && (
          <View style={[styles.pixBox, { backgroundColor: cobranca.vencida ? '#FEF2F2' : '#FFFBEB', borderColor: cobranca.vencida ? '#FECACA' : '#FDE68A' }]}>
            <Text style={[styles.pixTitulo, { color: cobranca.vencida ? '#991B1B' : '#92400E' }]}>
              {cobranca.vencida ? 'Pagamento da assinatura atrasado' : cobranca.dias_para_vencer <= 0 ? 'Sua assinatura vence hoje' : `Sua assinatura vence em ${cobranca.dias_para_vencer} ${cobranca.dias_para_vencer === 1 ? 'dia' : 'dias'}`}
            </Text>
            <Text style={styles.pixTexto}>
              Valor: R$ {Number(cobranca.valor).toFixed(2).replace('.', ',')}{cobranca.vencimento ? ` · vencimento ${String(cobranca.vencimento).split('-').reverse().join('/')}` : ''}
            </Text>
            {cobranca.pix?.imagem ? (
              <>
                <Image source={{ uri: `data:image/png;base64,${cobranca.pix.imagem}` }} style={styles.pixQr} resizeMode="contain" />
                <Text style={styles.pixTexto}>Aponte a câmera do app do seu banco ou use o Pix copia e cola. O Asaas também enviou esta cobrança para o seu e-mail.</Text>
                <TouchableOpacity
                  style={styles.pixBotao}
                  onPress={async () => { await Clipboard.setStringAsync(cobranca.pix.copia_e_cola || ''); alertar('Código copiado', 'Cole no app do seu banco, na opção Pix copia e cola.'); }}
                >
                  <Text style={styles.pixBotaoTxt}>Copiar código Pix</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.pixTexto}>O Asaas enviou esta cobrança para o seu e-mail.</Text>
            )}
            {!!cobranca.link && (
              <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(cobranca.link)}>
                <Text style={{ color: COLORS.indigo, fontWeight: '700', textAlign: 'center' }}>Abrir a fatura completa</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

          {!!status?.volta_gratuito_em && (
            <View style={styles.avisoCancelada}>
              <Ionicons name="information-circle" size={20} color="#B45309" />
              <Text style={styles.avisoCanceladaTxt}>
                Sua assinatura foi cancelada. Você não será mais cobrado. Os benefícios do plano {(status.plano_atual || '').toUpperCase()} continuam até {status.volta_gratuito_em}; depois sua conta volta sozinha para o plano Grátis.
              </Text>
            </View>
          )}

          {hasSubscription && (
            <TouchableOpacity style={styles.linkCancelar} onPress={cancelarAssinatura} disabled={processando}>
              <Text style={styles.linkCancelarTexto}>Cancelar e voltar para o plano Grátis</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PAGAMENTO: forma padrão e faturas reais do Asaas */}
        {(hasSubscription || !!status?.detalhes_fatura) && <PagamentoAssinatura cpfInicial={status?.dados_usuario?.cpf_cnpj || ''} />}

        {/* OFERTA DE PLANOS */}
        {(!hasSubscription || mostrarPlanos) && (
          <View style={styles.planosSection}>
            <Text style={styles.planosTitulo}>
              {hasSubscription ? 'Escolha o seu novo plano' : 'Evolua sua experiência'}
            </Text>
            {hasSubscription && (
              <View style={styles.cardGratis}>
                <Text style={styles.gratisRotulo}>SEM PLANO</Text>
                <Text style={styles.gratisNome}>Grátis <Text style={styles.gratisPreco}>R$ 0/mês</Text></Text>
                <Text style={styles.gratisTexto}>Continue usando a Lokyva sem pagar: agendar, reservar, comprar e juntar pontos. Você só perde os benefícios do plano.</Text>
                <TouchableOpacity style={styles.btnGratis} onPress={cancelarAssinatura} disabled={processando}>
                  <Text style={styles.btnGratisTxt}>Voltar para o Grátis</Text>
                </TouchableOpacity>
              </View>
            )}
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.opcaoPagamentoTexto}>Cartão de crédito (cobrado sozinho a cada ciclo)</Text>
            </TouchableOpacity>

            {metodoPagamento === 'credit_card' && (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <LinearGradient colors={['#1F2937', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cartaoVisual}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={styles.cartaoChip} />
                    <Text style={styles.cartaoMarca}>CARTÃO</Text>
                  </View>
                  <Text style={styles.cartaoNumero}>{(mascararNumero(cartao.numero) || '•••• •••• •••• ••••')}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.cartaoNome} numberOfLines={1}>{cartao.titular || 'NOME COMO NO CARTÃO'}</Text>
                    <Text style={styles.cartaoNome}>{cartao.validade || 'MM/AA'}</Text>
                  </View>
                </LinearGradient>
                <TextInput style={styles.campoCartao} placeholder="Número do cartão" keyboardType="number-pad" value={cartao.numero}
                  onChangeText={(t) => setCartao({ ...cartao, numero: mascararNumero(t) })} />
                <TextInput style={styles.campoCartao} placeholder="Nome impresso no cartão" autoCapitalize="characters" value={cartao.titular}
                  onChangeText={(t) => setCartao({ ...cartao, titular: t.toUpperCase() })} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={[styles.campoCartao, { flex: 1 }]} placeholder="Validade MM/AA" keyboardType="number-pad" value={cartao.validade}
                    onChangeText={(t) => setCartao({ ...cartao, validade: mascararValidade(t) })} />
                  <TextInput style={[styles.campoCartao, { flex: 1 }]} placeholder="CVV" keyboardType="number-pad" secureTextEntry maxLength={4} value={cartao.cvv}
                    onChangeText={(t) => setCartao({ ...cartao, cvv: t.replace(/\D/g, '') })} />
                </View>
                <Text style={styles.cartaoAjuda}>Dados do titular (exigidos pelo banco)</Text>
                <TextInput style={styles.campoCartao} placeholder="CPF/CNPJ do titular" keyboardType="number-pad" value={titularCartao.cpf_cnpj}
                  onChangeText={(t) => setTitularCartao({ ...titularCartao, cpf_cnpj: t })} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={[styles.campoCartao, { flex: 2 }]} placeholder="CEP" keyboardType="number-pad" value={titularCartao.cep}
                    onChangeText={(t) => setTitularCartao({ ...titularCartao, cep: t })} />
                  <TextInput style={[styles.campoCartao, { flex: 1 }]} placeholder="Nº" value={titularCartao.numero}
                    onChangeText={(t) => setTitularCartao({ ...titularCartao, numero: t })} />
                </View>
                <Text style={styles.cartaoAjuda}>Processado pelo Asaas. Os dados do cartão não ficam salvos na Lokyva.{!hasSubscription ? ' Nada é cobrado nos 7 dias grátis.' : ''}</Text>
              </View>
            )}

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
                  <Text style={styles.modalBtnConfirmarTexto}>{metodoPagamento === 'credit_card' ? 'Confirmar com cartão' : 'Confirmar'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
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
            <View style={{ flex: 1 }}>
              <Text style={[styles.beneficioTexto, plano.destaque && styles.textoClaro]}>{typeof beneficio === 'string' ? beneficio : beneficio.titulo}</Text>
              {typeof beneficio !== 'string' && (
                <Text style={[styles.beneficioExplica, plano.destaque && styles.textoClaroSub]}>{beneficio.texto}</Text>
              )}
            </View>
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
  safeArea: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerBtn: { padding: 6, width: 34 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.secondary },
  scrollContent: { padding: 16, paddingBottom: 60 },

  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
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
  avisoCancelada: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12, marginTop: 14, alignItems: 'flex-start' },
  avisoCanceladaTxt: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 19 },
  cardGratis: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 16, gap: 6 },
  gratisRotulo: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.6 },
  gratisNome: { fontSize: 22, fontWeight: '800', color: '#111827' },
  gratisPreco: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  gratisTexto: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  btnGratis: { marginTop: 8, borderWidth: 2, borderColor: '#111827', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnGratisTxt: { fontSize: 14, fontWeight: '800', color: '#111827' },
  linkCancelarTexto: { color: COLORS.gray, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  planosSection: { marginTop: 32 },
  planosTitulo: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, textAlign: 'center' },
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
  planoPreco: { fontSize: 32, fontWeight: '800', color: COLORS.secondary },
  planoPrecoCiclo: { fontSize: 14, color: COLORS.gray, marginLeft: 6 },

  badgeTeste: { alignSelf: 'flex-start', backgroundColor: COLORS.indigoLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8, marginBottom: 4 },
  badgeTesteDestaque: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeTesteTexto: { fontSize: 11, fontWeight: '700', color: COLORS.indigo },

  beneficiosLista: { marginTop: 16, gap: 12 },
  beneficioItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  beneficioTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginTop: 1 },
  beneficioExplica: { fontSize: 12, color: COLORS.gray, lineHeight: 17, marginTop: 2 },
  cartaoVisual: { borderRadius: 16, padding: 16, height: 150, justifyContent: 'space-between' },
  cartaoChip: { width: 40, height: 28, borderRadius: 6, backgroundColor: '#FCD34D' },
  cartaoMarca: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
  cartaoNumero: { color: '#fff', fontSize: 18, letterSpacing: 2, fontWeight: '700' },
  cartaoNome: { color: '#fff', fontSize: 12, fontWeight: '700', maxWidth: '70%' },
  campoCartao: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.secondary, backgroundColor: COLORS.white },
  cartaoAjuda: { fontSize: 11, color: COLORS.gray },
  pixBox: { borderRadius: 20, padding: 16, marginBottom: 16, gap: 8, borderWidth: 1 },
  pixTitulo: { fontSize: 16, fontWeight: '800' },
  pixTexto: { fontSize: 13, color: COLORS.secondary, lineHeight: 19 },
  pixQr: { width: 180, height: 180, alignSelf: 'center', backgroundColor: COLORS.white, borderRadius: 12 },
  pixBotao: { backgroundColor: COLORS.secondary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  pixBotaoTxt: { color: COLORS.white, fontWeight: '800' },

  btnEscolherPlano: { marginTop: 20, backgroundColor: COLORS.indigoLight, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnEscolherPlanoDestaque: { backgroundColor: COLORS.white },
  btnEscolherPlanoTexto: { color: COLORS.indigo, fontWeight: '800', fontSize: 14 },
  btnEscolherPlanoTextoDestaque: { color: COLORS.secondary },

  linkFechar: { alignItems: 'center', marginTop: 4, marginBottom: 20 },
  linkFecharTexto: { color: COLORS.gray, fontWeight: '600', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: 22, width: '100%', maxWidth: 420, maxHeight: '88%' },
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
