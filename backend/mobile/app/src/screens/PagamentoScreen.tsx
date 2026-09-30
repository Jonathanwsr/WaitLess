import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { TextInput } from 'react-native';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

type PaymentMethod = 'pix' | 'boleto' | 'cartao' | 'local';

const PASSOS = ['Serviço', 'Agendamento', 'Dados', 'Pagamento'];

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function PagamentoScreen() {
  const router = useRouter();
  const [cancelamentoPct, setCancelamentoPct] = useState(2);
  useEffect(() => {
    fetch(`${API_URL}/taxas`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j) => { if (typeof j?.cancelamento_tardio_percentual === 'number') setCancelamentoPct(j.cancelamento_tardio_percentual); })
      .catch(() => {});
  }, []);
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
  const abrindoGateway = useRef(false);

  // Cartão com parcelas calculadas pelo servidor
  const [cartao, setCartao] = useState({ numero: '', titular: '', mes: '', ano: '', cvv: '' });
  const [parcelas, setParcelas] = useState(1);
  const [opcoesParcelas, setOpcoesParcelas] = useState<{ parcelas: number; valor_parcela: number; total: number }[]>([]);

  const pegarToken = async () => (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));

  const buscarDadosCheckout = useCallback(async () => {
    if (!agendamento_id) {
      setLoadingDados(false);
      return;
    }

    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/pagamentos/${agendamento_id}/resumo`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
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
  }, [agendamento_id]);

  useEffect(() => {
    buscarDadosCheckout();
  }, [buscarDadosCheckout]);

  // Se o cliente já pagou este pedido em outra sessão/aba, não deixa pagar de novo
  useEffect(() => {
    if (checkoutDados?.ja_esta_pago) {
      router.replace({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id } });
    }
  }, [checkoutDados?.ja_esta_pago]);

  const processarPagamento = async () => {
    if (!agendamento_id) return alertar('Ops', 'Não encontramos o pedido para pagar. Volte e tente novamente.');
    if (abrindoGateway.current) return; // evita duplo toque abrindo duas cobranças

    if (method === 'cartao') {
      const numero = cartao.numero.replace(/\D/g, '');
      if (numero.length < 13 || !cartao.titular.trim() || !cartao.mes || !cartao.ano || cartao.cvv.length < 3) {
        return alertar('Dados do cartão', 'Preencha número, nome, validade e CVV do cartão.');
      }
    }

    setProcessing(true);
    abrindoGateway.current = true;
    try {
      const token = await pegarToken();
      const payload = {
        agendamento_id,
        metodo_pagamento: method,
        parcelas: method === 'cartao' ? parcelas : 1,
        asaas_customer_id: method !== 'local' ? asaas_customer_id : undefined,
        cartao: method === 'cartao' ? {
          numero: cartao.numero.replace(/\D/g, ''),
          titular: cartao.titular.trim(),
          mes: Number(cartao.mes),
          ano: Number(cartao.ano),
          cvv: cartao.cvv,
        } : undefined,
      };

      const res = await fetch(`${API_URL}/pagamento/processar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Já pago (ex.: em outra aba) — segue direto para a confirmação
          router.replace({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id } });
          return;
        }
        alertar('Não foi possível continuar', data.error || data.message || 'Tente novamente em instantes.');
        return;
      }

      if (data.aprovado) {
        router.replace({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id, codigo: codigo_pedido_param } });
        return;
      }

      if (data.metodo === 'local') {
        router.replace({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id, codigo: codigo_pedido_param } });
        return;
      }

      if (data.invoice_url) {
        // Abre o ambiente de pagamento seguro. Quando o cliente fecha essa
        // tela, conferimos se o pagamento já foi confirmado: se sim, segue
        // para a confirmação; se não, o pedido continua "aguardando
        // pagamento" e ele é avisado — sem perder a reserva.
        await WebBrowser.openBrowserAsync(data.invoice_url);

        const token2 = await pegarToken();
        const resStatus = await fetch(`${API_URL}/pagamentos/${agendamento_id}/resumo`, {
          headers: { Authorization: `Bearer ${token2}`, Accept: 'application/json' },
        });
        const statusAtualizado = resStatus.ok ? await resStatus.json() : null;

        if (statusAtualizado?.ja_esta_pago) {
          router.replace({ pathname: '/src/screens/ConfirmacaoScreen', params: { id: agendamento_id, codigo: codigo_pedido_param } });
        } else {
          alertar(
            'Pagamento pendente',
            'Ainda não identificamos a confirmação do seu pagamento. Sua reserva foi mantida como pendente — você pode concluir o pagamento a qualquer momento em "Meus agendamentos".',
            [{ text: 'Entendi', onPress: () => router.replace('/(tabs)/home') }]
          );
        }
      }
    } catch (e) {
      alertar('Sem conexão', 'Não foi possível falar com o servidor agora. Verifique sua internet e tente novamente.');
    } finally {
      setProcessing(false);
      abrindoGateway.current = false;
    }
  };

  // Usa o valor do backend se existir, senão usa o que veio por parâmetro da tela anterior
  const amountToPay = checkoutDados?.valor_total ? parseFloat(checkoutDados.valor_total) : parseFloat(valor_total_param as string) || 0;

  useEffect(() => {
    if (method !== 'cartao' || amountToPay <= 0) { setOpcoesParcelas([]); return; }
    let cancelado = false;
    (async () => {
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/pagamentos/parcelamento`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ valor: Number(amountToPay.toFixed(2)) }),
        });
        const json = await res.json();
        if (cancelado || !res.ok) return;
        const lista = json.parcelamento || [];
        setOpcoesParcelas(lista);
        setParcelas((p) => Math.min(p, lista.length || 1));
      } catch {
        if (!cancelado) setOpcoesParcelas([]);
      }
    })();
    return () => { cancelado = true; };
  }, [method, amountToPay.toFixed(2)]);

  if (loadingDados) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={s.loadingTxt}>Buscando resumo do pedido...</Text>
      </View>
    );
  }

  const online = method !== 'local';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="chevron-back" size={24} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flex: 1 }} />
          <View style={{ flex: 1 }} />
        </View>
        <View style={s.cadeado}><Ionicons name="lock-closed" size={16} color={T.success} /></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
        {/* PASSOS */}
        <View style={s.passos}>
          {PASSOS.map((p, i) => {
            const atual = i === PASSOS.length - 1;
            return (
              <React.Fragment key={p}>
                <View style={s.passo}>
                  <View style={[s.passoCirculo, atual && s.passoCirculoAtual]}>
                    {atual ? <Text style={s.passoNum}>{i + 1}</Text> : <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={[s.passoTxt, atual && s.passoTxtAtual]}>{p}</Text>
                </View>
                {i < PASSOS.length - 1 && <View style={s.passoLinha} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* RESUMO DO PEDIDO */}
        <View style={s.resumo}>
          {!!codigo_pedido_param && (
            <View style={s.pedido}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={16} color={T.primary} />
              <Text style={s.pedidoTxt}>Pedido {codigo_pedido_param}</Text>
            </View>
          )}
          <View style={s.resumoTopo}>
            <View style={s.resumoAvatar}>
              <Ionicons name="storefront-outline" size={26} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.resumoNome} numberOfLines={1}>{checkoutDados?.estabelecimento_nome || 'Seu pedido'}</Text>
              {!!checkoutDados?.servico_nome && <Text style={s.resumoSub} numberOfLines={1}>{checkoutDados.servico_nome}{checkoutDados.funcionario_nome ? ` com ${checkoutDados.funcionario_nome}` : ''}</Text>}
              {!!checkoutDados?.data_formatada && (
                <View style={s.resumoInfo}>
                  <Ionicons name="calendar-outline" size={13} color={T.primary} />
                  <Text style={s.resumoInfoTxt}>{checkoutDados.data_formatada}{checkoutDados.hora_formatada ? ` às ${checkoutDados.hora_formatada}` : ''}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.resumoTotal}>
            <Text style={s.resumoTotalRotulo}>TOTAL A PAGAR</Text>
            <Text style={s.resumoTotalValor}>{brl(amountToPay)}</Text>
          </View>

          {checkoutDados?.pontos_usados > 0 && (
            <View style={s.desconto}>
              <Ionicons name="star" size={14} color={T.success} />
              <Text style={s.descontoTxt}>
                Desconto aplicado: {checkoutDados.pontos_usados} pontos (-{brl(checkoutDados.desconto_pontos)})
              </Text>
            </View>
          )}
        </View>

        {/* ITENS EXTRAS */}
        {Array.isArray(checkoutDados?.produtos) && checkoutDados.produtos.length > 0 && (
          <View style={s.extras}>
            <Text style={s.extrasTitulo}>Itens incluídos neste pedido</Text>
            {checkoutDados.produtos.map((produto: any) => (
              <View key={produto.id} style={s.extraLinha}>
                {produto.foto ? (
                  <Image source={{ uri: produto.foto }} style={s.extraFoto} contentFit="cover" />
                ) : (
                  <View style={[s.extraFoto, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="cube-outline" size={18} color={T.muted} />
                  </View>
                )}
                <Text style={s.extraNome} numberOfLines={1}>{produto.nome}</Text>
                <Text style={s.extraValor}>{brl(produto.valor)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 1. FORMA */}
        <View style={s.tituloLinha}><View style={s.numero}><Text style={s.numeroTxt}>1</Text></View><Text style={s.secao}>Forma de pagamento</Text></View>

        <TouchableOpacity style={[s.opcao, !online && s.opcaoOn]} onPress={() => setMethod('local')} activeOpacity={0.85}>
          <View style={[s.opcaoIcone, !online && s.opcaoIconeOn]}>
            <Ionicons name="storefront-outline" size={20} color={!online ? '#fff' : T.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.opcaoTitulo}>Pagar no local</Text>
            <Text style={s.opcaoDesc}>Pagamento diretamente no estabelecimento, no momento do atendimento ou da retirada.</Text>
          </View>
          <View style={[s.radio, !online && s.radioOn]}>{!online && <View style={s.radioMiolo} />}</View>
        </TouchableOpacity>

        <TouchableOpacity style={[s.opcao, online && s.opcaoOn]} onPress={() => setMethod('pix')} activeOpacity={0.85}>
          <View style={[s.opcaoIcone, online && s.opcaoIconeOn]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={online ? '#fff' : T.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.opcaoTitulo}>Pagar online</Text>
            <Text style={s.opcaoDesc}>Rápido, prático e seguro. Garanta sua reserva agora.</Text>
          </View>
          <View style={[s.radio, online && s.radioOn]}>{online && <View style={s.radioMiolo} />}</View>
        </TouchableOpacity>

        {/* 2. MÉTODO ONLINE */}
        {online && (
          <>
            <View style={s.tituloLinha}><View style={s.numero}><Text style={s.numeroTxt}>2</Text></View><Text style={s.secao}>Método de pagamento</Text></View>
            <View style={s.abas}>
              <TouchableOpacity style={[s.aba, method === 'cartao' && s.abaOn]} onPress={() => setMethod('cartao')} activeOpacity={0.85}>
                <Ionicons name="card-outline" size={19} color={method === 'cartao' ? T.primary : T.muted} />
                <Text style={[s.abaTxt, method === 'cartao' && { color: T.primary }]}>Cartão</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.aba, method === 'pix' && s.abaOn]} onPress={() => setMethod('pix')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="qrcode-scan" size={19} color={method === 'pix' ? T.primary : T.muted} />
                <Text style={[s.abaTxt, method === 'pix' && { color: T.primary }]}>Pix</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.aba, method === 'boleto' && s.abaOn]} onPress={() => setMethod('boleto')} activeOpacity={0.85}>
                <Ionicons name="barcode-outline" size={19} color={method === 'boleto' ? T.primary : T.muted} />
                <Text style={[s.abaTxt, method === 'boleto' && { color: T.primary }]}>Boleto</Text>
              </TouchableOpacity>
            </View>

            {/* Explicação simples do método escolhido */}
            <View style={s.explica}>
              <Ionicons name={method === 'cartao' ? 'card-outline' : method === 'pix' ? 'flash-outline' : 'time-outline'} size={18} color={T.primary} />
              <Text style={s.explicaTxt}>
                {method === 'cartao'
                  ? 'Cobrança no cartão de crédito agora, em até 12x sem juros. Sua reserva é confirmada na hora.'
                  : method === 'pix'
                    ? 'Aprovação imediata. Você recebe um QR Code para pagar pelo app do seu banco e a reserva é confirmada na hora.'
                    : 'Compensa em até 2 dias úteis. A reserva é confirmada assim que o pagamento for identificado.'}
              </Text>
            </View>

            {method === 'cartao' && (
              <View style={s.cartaoBox}>
                <View>
                  <Text style={s.campoRotulo}>Número do cartão</Text>
                  <TextInput style={s.cartaoInput} placeholder="0000 0000 0000 0000" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={23} autoComplete="cc-number"
                    value={cartao.numero} onChangeText={(t) => setCartao({ ...cartao, numero: t.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim() })} />
                </View>
                <View>
                  <Text style={s.campoRotulo}>Nome como está no cartão</Text>
                  <TextInput style={s.cartaoInput} placeholder="NOME SOBRENOME" placeholderTextColor={T.faint} autoCapitalize="characters" autoComplete="cc-name"
                    value={cartao.titular} onChangeText={(t) => setCartao({ ...cartao, titular: t.toUpperCase() })} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.campoRotulo}>Mês</Text>
                    <TextInput style={s.cartaoInput} placeholder="MM" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={2}
                      value={cartao.mes} onChangeText={(t) => setCartao({ ...cartao, mes: t.replace(/\D/g, '') })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.campoRotulo}>Ano</Text>
                    <TextInput style={s.cartaoInput} placeholder="AA" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={4}
                      value={cartao.ano} onChangeText={(t) => setCartao({ ...cartao, ano: t.replace(/\D/g, '') })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.campoRotulo}>Código (CVV)</Text>
                    <TextInput style={s.cartaoInput} placeholder="123" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={4} secureTextEntry
                      value={cartao.cvv} onChangeText={(t) => setCartao({ ...cartao, cvv: t.replace(/\D/g, '') })} />
                  </View>
                </View>

                <Text style={[s.campoRotulo, { marginTop: 6 }]}>Em quantas parcelas?</Text>
                {opcoesParcelas.length === 0 ? (
                  <Text style={s.seguroTxt}>Calculando parcelas…</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {opcoesParcelas.map((o) => {
                      const on = parcelas === o.parcelas;
                      return (
                        <TouchableOpacity key={o.parcelas} style={[s.parcelaLinha, on && s.parcelaLinhaOn]} onPress={() => setParcelas(o.parcelas)} activeOpacity={0.85}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.parcelaTxt, on && { color: T.primary }]}>
                              {o.parcelas === 1 ? 'À vista' : `${o.parcelas}x de ${brl(o.valor_parcela)}`}
                            </Text>
                            <Text style={s.parcelaSub}>{o.parcelas === 1 ? brl(o.total) : `sem juros · total ${brl(o.total)}`}</Text>
                          </View>
                          <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioMiolo} />}</View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={s.seguro}>
              <Ionicons name="lock-closed" size={15} color={T.success} />
              <Text style={s.seguroTxt}>Seus dados são criptografados de ponta a ponta.</Text>
            </View>
          </>
        )}

        <View style={s.confianca}>
          <View style={s.confiancaLinha}>
            <Ionicons name="shield-checkmark" size={20} color={T.success} />
            <Text style={s.confiancaTxt}>
              <Text style={s.confiancaForte}>Pagamento seguro. </Text>
              É processado por uma processadora de pagamentos regulamentada. A Lokyva não guarda os dados do seu cartão.
            </Text>
          </View>
          <View style={s.confiancaLinha}>
            <Ionicons name="return-up-back-outline" size={20} color={T.primary} />
            <Text style={s.confiancaTxt}>
              <Text style={s.confiancaForte}>Cancelamento e estorno. </Text>
              Cancele até 30 min antes do horário sem custo. Depois disso, {cancelamentoPct}% do valor é retido. Você pode pedir estorno em até 4 dias após pagar.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={s.linkAjuda} onPress={() => router.push('/src/screens/ComoFuncionamPagamentos?perfil=cliente' as never)} activeOpacity={0.7}>
          <Ionicons name="help-circle-outline" size={18} color={T.primary} />
          <Text style={s.linkAjudaTxt}>Como funciona o pagamento e quais são as taxas</Text>
          <Ionicons name="chevron-forward" size={16} color={T.faint} />
        </TouchableOpacity>
      </ScrollView>

      {/* BARRA INFERIOR */}
      <View style={s.barra}>
        <TouchableOpacity style={[s.pagar, processing && { opacity: 0.7 }]} onPress={processarPagamento} disabled={processing} activeOpacity={0.88}>
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={17} color="#fff" />
              <Text style={s.pagarTxt}>{!online ? 'Confirmar reserva' : method === 'cartao' ? (parcelas > 1 ? `Pagar ${parcelas}x de ${brl(amountToPay / parcelas)}` : `Pagar ${brl(amountToPay)}`) : method === 'pix' ? `Gerar Pix de ${brl(amountToPay)}` : `Gerar boleto de ${brl(amountToPay)}`}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  confianca: { backgroundColor: T.card, borderRadius: 20, padding: 16, marginTop: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  confiancaLinha: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  confiancaTxt: { flex: 1, fontSize: 12, color: T.muted, lineHeight: 18 },
  confiancaForte: { fontWeight: '800', color: T.ink },
  linkAjuda: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  linkAjudaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: T.ink },
  cartaoBox: { gap: 10, marginBottom: 12 },
  cartaoInput: { backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15, fontSize: 16, color: T.ink, borderWidth: 1.5, borderColor: T.line },
  campoRotulo: { fontSize: 13, fontWeight: '700', color: T.ink, marginBottom: 6 },
  explica: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: T.primarySoft, borderRadius: 14, padding: 12, marginTop: 12, marginBottom: 14 },
  explicaTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: T.ink },
  parcelaSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  parcelaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  parcelaLinhaOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  parcelaTxt: { fontSize: 14, fontWeight: '600', color: T.ink },
  safe: { flex: 1, backgroundColor: T.cream },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.cream },
  loadingTxt: { marginTop: 12, color: T.muted, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },
  headerSub: { fontSize: 12, color: T.muted, marginTop: 1 },
  cadeado: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.successBg, alignItems: 'center', justifyContent: 'center' },

  passos: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8, marginBottom: 22 },
  passo: { alignItems: 'center', width: 64 },
  passoCirculo: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  passoCirculoAtual: { backgroundColor: T.primary, borderWidth: 3, borderColor: '#F8D9C8', width: 28, height: 28, borderRadius: 14, marginTop: -2 },
  passoNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  passoTxt: { fontSize: 10, color: T.muted, marginTop: 6, textAlign: 'center' },
  passoTxtAtual: { color: T.primary, fontWeight: '800' },
  passoLinha: { flex: 1, height: 2, backgroundColor: T.primary, marginTop: 11, marginHorizontal: -8 },

  resumo: { backgroundColor: T.card, borderRadius: 24, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pedido: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.primarySoft, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 12 },
  pedidoTxt: { fontSize: 12, fontWeight: '800', color: T.primary },
  resumoTopo: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  resumoAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  resumoNome: { fontSize: 16, fontWeight: '800', color: T.ink },
  resumoSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  resumoInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  resumoInfoTxt: { fontSize: 12, fontWeight: '600', color: T.ink },
  resumoTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.line },
  resumoTotalRotulo: { fontSize: 13, fontWeight: '600', color: T.muted },
  resumoTotalValor: { fontSize: 30, fontWeight: '800', color: T.ink, letterSpacing: -0.8 },
  desconto: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.successBg, borderRadius: 10, padding: 10, marginTop: 12 },
  descontoTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: T.success },

  extras: { backgroundColor: T.card, borderRadius: 20, padding: 14, marginBottom: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  extrasTitulo: { fontSize: 13, fontWeight: '800', color: T.ink, marginBottom: 10 },
  extraLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  extraFoto: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.cream },
  extraNome: { flex: 1, fontSize: 13, color: T.ink, fontWeight: '600' },
  extraValor: { fontSize: 13, fontWeight: '800', color: T.ink },

  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12 },
  numero: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  numeroTxt: { fontSize: 12, fontWeight: '800', color: T.primary },
  secao: { fontSize: 16, fontWeight: '800', color: T.ink },

  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  opcaoOn: { borderColor: T.primary, backgroundColor: '#FFF8F1' },
  opcaoIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.cream, alignItems: 'center', justifyContent: 'center' },
  opcaoIconeOn: { backgroundColor: T.primary },
  opcaoTitulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  opcaoDesc: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: T.primary },
  radioMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary },

  abas: { flexDirection: 'row', backgroundColor: '#E9E9EC', borderRadius: 16, padding: 4 },
  aba: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  abaOn: { backgroundColor: T.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  abaTxt: { fontSize: 14, fontWeight: '700', color: T.muted },
  seguro: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.successBg, borderRadius: 12, padding: 12, marginTop: 14 },
  seguroTxt: { flex: 1, fontSize: 12, color: T.success, fontWeight: '600' },

  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.card, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  pagar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.primary, height: 56, borderRadius: 28 },
  pagarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
