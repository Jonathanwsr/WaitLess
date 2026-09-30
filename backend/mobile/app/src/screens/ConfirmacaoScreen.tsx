import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';
import { obterEcho } from '../../../services/echo';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface CheckoutData {
  pin: string;
  status_pagamento?: string;
  estabelecimento_id?: number;
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
  const [baixandoComprovante, setBaixandoComprovante] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const pegarToken = async () => (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));

  const buscarResumo = async () => {
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/pagamentos/${id}/resumo`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (res.ok) {
        setDados(await res.json());
      }
    } catch (error) {
      console.log('Erro ao buscar resumo', error);
    }
  };

  useEffect(() => {
    if (id) buscarResumo();
  }, [id]);

  // Se o cliente chegou aqui com o PIX/boleto ainda pendente (o webhook do
  // gateway confirma de forma assíncrona), esta tela reflete a confirmação
  // assim que ela chegar, sem precisar que o cliente saia e volte.
  useEffect(() => {
    const estabelecimentoId = dados?.estabelecimento_id;
    if (!estabelecimentoId || dados?.status_pagamento === 'pago' || dados?.status_pagamento === 'pago_online') {
      return;
    }

    let cancelado = false;
    const canalNome = `fila.${estabelecimentoId}`;

    obterEcho().then((echo) => {
      if (cancelado) return;
      echo.channel(canalNome).listen('.FilaAtualizada', () => {
        buscarResumo();
      });
    });

    return () => {
      cancelado = true;
      obterEcho().then((echo) => echo.leave(canalNome));
    };
  }, [dados?.estabelecimento_id, dados?.status_pagamento]);

  const baixarComprovante = async () => {
    if (!id) return;
    setBaixandoComprovante(true);
    try {
      const token = await pegarToken();
      const destino = `${FileSystem.cacheDirectory}comprovante-lokyva-${id}.pdf`;

      const resultado = await FileSystem.downloadAsync(`${API_URL}/agendamentos/${id}/comprovante-pdf`, destino, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });

      if (resultado.status !== 200) {
        throw new Error('Não foi possível gerar o comprovante.');
      }

      const podeCompartilhar = await Sharing.isAvailableAsync();
      if (podeCompartilhar) {
        await Sharing.shareAsync(resultado.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Comprovante Lokyva',
          UTI: 'com.adobe.pdf',
        });
      } else {
        alertar('Comprovante salvo', `O arquivo foi salvo em: ${resultado.uri}`);
      }
    } catch (error) {
      alertar('Erro', 'Não foi possível baixar o comprovante agora. Tente novamente.');
    } finally {
      setBaixandoComprovante(false);
    }
  };

  const handleCancelar = () => {
    if (!id) return;
    alertar('Cancelar reserva', 'Tem certeza que deseja cancelar este agendamento?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancelando(true);
          try {
            const token = await pegarToken();
            const res = await fetch(`${API_URL}/agendamentos/${id}/cancelar`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (res.ok) {
              alertar('Cancelado', 'Seu agendamento foi cancelado.');
              router.push('/(tabs)/home' as never);
            } else {
              alertar('Erro', 'Não foi possível cancelar. Tente novamente.');
            }
          } catch (error) {
            alertar('Erro', 'Falha na comunicação com o servidor.');
          } finally {
            setCancelando(false);
          }
        },
      },
    ]);
  };

  if (!dados) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: T.cream }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const pinDigits = dados.pin ? dados.pin.split('') : ['0', '0', '0', '0'];
  // Pagamento no local: a reserva está garantida, mas ainda não foi paga.
  const pagarNoLocal = ['local', 'presencial'].includes(String(dados.status_pagamento || ''));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={s.voltar}>
          <Ionicons name="chevron-back" size={24} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={s.sucessoBox}>
          <View style={s.sucessoAnel}>
            <View style={s.sucessoMiolo}><Ionicons name="checkmark" size={38} color="#fff" /></View>
          </View>
        </View>
        <Text style={s.titulo}>Reserva confirmada!</Text>
        <Text style={s.subtitulo}>
          {pagarNoLocal
            ? 'Sua vaga está garantida. O pagamento será feito no local. Mostre o PIN abaixo ao profissional.'
            : 'Pagamento aprovado. Mostre o PIN abaixo ao profissional para iniciar ou retirar.'}
        </Text>

        <View style={s.pinCard}>
          <Text style={s.pinRotulo}>PIN de segurança</Text>
          <View style={s.pinLinha}>
            {pinDigits.map((num: string, idx: number) => (
              <View key={idx} style={s.pinBox}><Text style={s.pinNum}>{num}</Text></View>
            ))}
          </View>
          <View style={s.aviso}>
            <Ionicons name="shield-checkmark-outline" size={16} color={T.primary} />
            <Text style={s.avisoTxt}>Apresente este código apenas após o serviço ser finalizado ou o bem ser retirado.</Text>
          </View>
        </View>

        <View style={s.resumo}>
          <View style={s.resumoTopo}>
            <View style={s.resumoAvatar}><Ionicons name="storefront-outline" size={22} color={T.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.resumoNome} numberOfLines={1}>{dados.estabelecimento_nome}</Text>
              <Text style={s.resumoSub} numberOfLines={1}>{dados.servico_nome}</Text>
            </View>
          </View>
          <View style={s.divisor} />
          {!!dados.funcionario_nome && (
            <View style={s.linha}>
              <View style={s.linhaEsq}><Ionicons name="person-outline" size={15} color={T.muted} /><Text style={s.linhaRotulo}>Profissional</Text></View>
              <Text style={s.linhaValor}>{dados.funcionario_nome}</Text>
            </View>
          )}
          <View style={s.linha}>
            <View style={s.linhaEsq}><Ionicons name="time-outline" size={15} color={T.muted} /><Text style={s.linhaRotulo}>Horário</Text></View>
            <Text style={s.linhaValor}>{dados.data_formatada} às {dados.hora_formatada}</Text>
          </View>
          <View style={s.linha}>
            <View style={s.linhaEsq}><Ionicons name="cash-outline" size={15} color={T.muted} /><Text style={s.linhaRotulo}>{pagarNoLocal ? 'Total a pagar no local' : 'Total pago'}</Text></View>
            <Text style={s.preco}>R$ {parseFloat(dados.valor_total).toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.btnComprovante} onPress={baixarComprovante} disabled={baixandoComprovante} activeOpacity={0.85}>
          {baixandoComprovante ? <ActivityIndicator size="small" color={T.ink} /> : (
            <>
              <Ionicons name="document-text-outline" size={18} color={T.ink} />
              <Text style={s.btnSecTxt}>Baixar comprovante</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.acoes}>
          <TouchableOpacity style={s.btnVerde} onPress={() => router.push('/(tabs)/explorar' as never)} activeOpacity={0.88}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={s.btnVerdeTxt}>Agendar novamente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSec} onPress={() => router.push({ pathname: '/src/screens/AcompanhamentoFilaScreen', params: { id } })} activeOpacity={0.85}>
            <Ionicons name="people-outline" size={18} color={T.ink} />
            <Text style={s.btnSecTxt}>Acompanhar fila ao vivo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnPerigo} onPress={handleCancelar} disabled={cancelando} activeOpacity={0.85}>
            {cancelando ? <ActivityIndicator size="small" color={T.danger} /> : <Text style={s.btnPerigoTxt}>Cancelar reserva</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.ajuda}>
          <Ionicons name="help-circle-outline" size={16} color={T.muted} />
          <Text style={s.ajudaTxt}>Precisa de ajuda? </Text>
          <TouchableOpacity onPress={() => router.push('/src/screens/TelaSuporte' as never)}><Text style={s.ajudaLink}>Fale com o suporte</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <TouchableOpacity style={s.btnFinalizar} onPress={() => router.push('/(tabs)/home')} activeOpacity={0.88}>
          <Text style={s.btnFinalizarTxt}>Finalizar</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },

  sucessoBox: { alignItems: 'center', marginTop: 10 },
  sucessoAnel: { width: 104, height: 104, borderRadius: 52, backgroundColor: T.successBg, alignItems: 'center', justifyContent: 'center' },
  sucessoMiolo: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: T.ink, textAlign: 'center', marginTop: 16, letterSpacing: -0.5 },
  subtitulo: { fontSize: 14, color: T.muted, textAlign: 'center', marginTop: 6, lineHeight: 20, paddingHorizontal: 10 },

  pinCard: { backgroundColor: T.card, borderRadius: 24, padding: 20, marginTop: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pinRotulo: { fontSize: 13, fontWeight: '800', color: T.ink },
  pinLinha: { flexDirection: 'row', gap: 12, marginVertical: 14 },
  pinBox: { width: 60, height: 72, borderRadius: 18, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pinNum: { fontSize: 32, fontWeight: '800', color: T.ink },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: T.primarySoft, borderRadius: 12, padding: 12 },
  avisoTxt: { flex: 1, fontSize: 12, color: T.muted, lineHeight: 17 },

  resumo: { backgroundColor: T.card, borderRadius: 24, padding: 18, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  resumoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumoAvatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  resumoNome: { fontSize: 15, fontWeight: '800', color: T.ink },
  resumoSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  divisor: { height: 1, backgroundColor: T.line, marginVertical: 14 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  linhaEsq: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  linhaRotulo: { fontSize: 14, color: T.muted },
  linhaValor: { fontSize: 14, fontWeight: '700', color: T.ink },
  preco: { fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },

  btnComprovante: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: T.card, marginTop: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  acoes: { gap: 10, marginTop: 10 },
  btnVerde: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: T.primary },
  btnVerdeTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: T.card, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  btnSecTxt: { color: T.ink, fontWeight: '700', fontSize: 14 },
  btnPerigo: { alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, backgroundColor: '#FFF5F5' },
  btnPerigoTxt: { color: T.danger, fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

  ajuda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 18 },
  ajudaTxt: { fontSize: 12, color: T.muted },
  ajudaLink: { fontSize: 12, fontWeight: '700', color: T.primary },

  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.card, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  btnFinalizar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 28, backgroundColor: T.primary },
  btnFinalizarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
