import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';
import { apiMobile, brl, pegarToken, API_MOBILE, PedidoEntrega, STATUS_PEDIDO } from '../../../services/entregasApi';

const C = { ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line, accent: T.primary };

export default function EntregaConfirmacao() {
  const router = useRouter();
  const { pedidoId } = useLocalSearchParams<{ pedidoId: string }>();
  const [pedido, setPedido] = useState<PedidoEntrega | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ pedido: PedidoEntrega }>(`/entregas/pedidos/${pedidoId}`);
      setPedido(ok ? data.pedido : null);
    } catch {
      setPedido(null);
    } finally {
      setCarregando(false);
    }
  }, [pedidoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const baixarComprovante = async () => {
    if (!pedido) return;
    setBaixando(true);
    try {
      const token = await pegarToken();
      const destino = `${FileSystem.cacheDirectory}comprovante-entrega-${pedido.id}.pdf`;
      const resultado = await FileSystem.downloadAsync(`${API_MOBILE}/entregas/pedidos/${pedido.id}/comprovante-pdf`, destino, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });
      if (resultado.status !== 200) throw new Error();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(resultado.uri, { mimeType: 'application/pdf', dialogTitle: 'Comprovante Lokyva', UTI: 'com.adobe.pdf' });
      }
    } catch {
      alertar('Erro', 'Não foi possível baixar o comprovante agora.');
    } finally {
      setBaixando(false);
    }
  };

  if (carregando) {
    return <SafeAreaView style={s.safe}><View style={s.centro}><ActivityIndicator color={C.accent} /></View></SafeAreaView>;
  }

  if (!pedido) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centro}>
          <Text style={s.muted}>Não encontramos este pedido.</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/entregas' as never)} style={s.botao}>
            <Text style={s.botaoTxt}>Voltar aos produtos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_PEDIDO[pedido.status] || { label: pedido.status, cor: C.muted, fundo: C.canvas };
  const podeBaixar = ['pago', 'aguardando_confirmacao', 'concluido'].includes(pedido.status);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.topo}>
          <View style={[s.iconeRedondo, { backgroundColor: status.fundo }]}>
            <Ionicons name={pedido.status === 'concluido' ? 'checkmark-circle' : 'time-outline'} size={40} color={status.cor} />
          </View>
          <Text style={s.titulo}>{status.label}</Text>
          <Text style={s.muted}>Pedido {pedido.codigo_pedido}</Text>
        </View>

        {!!pedido.codigo_confirmacao_visivel && (
          <View style={s.codigoBox}>
            <Text style={s.codigoRotulo}>CÓDIGO DE ENTREGA</Text>
            <Text style={s.codigo}>{pedido.codigo_confirmacao_visivel}</Text>
            <Text style={s.codigoNota}>
              Mostre este código ao vendedor na {pedido.modo_recebimento === 'entrega' ? 'entrega' : 'busca'}. Só ele libera o pagamento.
            </Text>
          </View>
        )}

        <View style={s.bloco}>
          <Linha rotulo="Produto" valor={pedido.produto?.nome || 'Produto removido'} />
          <Linha rotulo="Forma de pagamento" valor={pedido.forma_pagamento_label} />
          <Linha rotulo={pedido.modo_recebimento === 'entrega' ? 'Entrega em' : 'Buscar em'} valor={pedido.endereco_recebimento} />
          <View style={s.totalLinha}>
            <Text style={s.totalRotulo}>Total</Text>
            <Text style={s.totalValor}>{brl(pedido.valor_total)}</Text>
          </View>
        </View>

        {pedido.status === 'pendente_pagamento' && (
          <Text style={s.nota}>Assim que o pagamento for aprovado, o código aparece aqui e em "Meus pedidos".</Text>
        )}

        <TouchableOpacity onPress={() => router.push('/src/screens/MeusPedidosEntrega' as never)} style={s.botao}>
          <Text style={s.botaoTxt}>Ver meus pedidos</Text>
        </TouchableOpacity>
        {podeBaixar && (
          <TouchableOpacity onPress={baixarComprovante} disabled={baixando} style={s.botaoOutline}>
            <Ionicons name="download-outline" size={16} color={C.ink} />
            <Text style={s.botaoOutlineTxt}>{baixando ? 'Baixando...' : 'Baixar comprovante'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={s.linha}>
      <Text style={s.linhaRotulo}>{rotulo}</Text>
      <Text style={s.linhaValor}>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  conteudo: { padding: 20, gap: 16, paddingBottom: 40 },
  topo: { alignItems: 'center', gap: 6, marginTop: 10 },
  iconeRedondo: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  titulo: { fontSize: 19, fontWeight: '900', color: C.ink, textAlign: 'center' },
  muted: { fontSize: 13, color: C.muted, textAlign: 'center' },
  codigoBox: { backgroundColor: C.ink, borderRadius: 18, padding: 18, alignItems: 'center', gap: 4 },
  codigoRotulo: { fontSize: 10, fontWeight: '800', color: '#A1A1AA', letterSpacing: 0.6 },
  codigo: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 8 },
  codigoNota: { fontSize: 11, color: '#A1A1AA', textAlign: 'center', marginTop: 4 },
  bloco: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: C.line },
  linha: { gap: 3 },
  linhaRotulo: { fontSize: 10, fontWeight: '800', color: C.faint, textTransform: 'uppercase' },
  linhaValor: { fontSize: 14, fontWeight: '700', color: C.ink },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  totalRotulo: { fontSize: 15, fontWeight: '900', color: C.ink },
  totalValor: { fontSize: 20, fontWeight: '900', color: C.accent },
  nota: { fontSize: 12, color: C.faint, textAlign: 'center', lineHeight: 17 },
  botao: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  botaoOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 14, backgroundColor: C.card },
  botaoOutlineTxt: { color: C.ink, fontWeight: '800', fontSize: 14 },
});
