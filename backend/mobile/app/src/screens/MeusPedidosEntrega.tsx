import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { apiMobile, brl, mensagemDeErro, pegarToken, API_MOBILE, PedidoEntrega, STATUS_PEDIDO } from '../../../services/entregasApi';

const C = {
  ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line,
  accent: T.primary, accentSoft: T.primarySoft, success: T.success, danger: T.danger,
};

const ABAS = [
  { id: 'todos', titulo: 'Todos' },
  { id: 'abertos', titulo: 'Em aberto' },
  { id: 'entregues', titulo: 'Entregues' },
  { id: 'cancelados', titulo: 'Cancelados' },
] as const;

// Comprador só cancela o que não foi pago online. Pedido pago é cancelado pelo vendedor, que devolve o valor.
const PODE_CANCELAR = ['pendente_pagamento', 'aguardando_confirmacao'];
const EM_ABERTO = ['pendente_pagamento', 'pago', 'aguardando_confirmacao'];

function EstrelasMobile({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= valor ? 'star' : 'star-outline'} size={30} color={n <= valor ? '#F59E0B' : C.faint} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Entregador a caminho: consulta a última posição a cada 15 segundos. */
function RastreioMobile({ pedidoId }: { pedidoId: number }) {
  const [posicao, setPosicao] = useState<{ lat?: number | null; lng?: number | null; atualizada_em?: string | null } | null>(null);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      const { ok, data } = await apiMobile(`/entregas/pedidos/${pedidoId}/posicao`);
      if (ativo && ok) setPosicao(data);
    };
    buscar();
    const timer = setInterval(buscar, 15000);
    return () => { ativo = false; clearInterval(timer); };
  }, [pedidoId]);

  const minutos = posicao?.atualizada_em
    ? Math.max(0, Math.round((Date.now() - new Date(posicao.atualizada_em).getTime()) / 60000))
    : null;

  return (
    <View style={s.rastreio}>
      <Ionicons name="bicycle-outline" size={20} color="#047857" />
      <View style={{ flex: 1 }}>
        <Text style={s.rastreioTitulo}>Entregador a caminho</Text>
        <Text style={s.rastreioTxt}>
          {posicao?.lat ? `Última posição ${minutos === 0 ? 'agora há pouco' : `há ${minutos} min`}.` : 'Aguardando a primeira posição.'}
        </Text>
      </View>
    </View>
  );
}

export default function MeusPedidosEntrega() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoEntrega[]>([]);
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('todos');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [processando, setProcessando] = useState<number | null>(null);
  const [modalEstorno, setModalEstorno] = useState<PedidoEntrega | null>(null);
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [avaliando, setAvaliando] = useState<PedidoEntrega | null>(null);
  const [notaProduto, setNotaProduto] = useState(0);
  const [notaVendedor, setNotaVendedor] = useState(0);
  const [comentarioAval, setComentarioAval] = useState('');
  const [enviandoAval, setEnviandoAval] = useState(false);

  const enviarAvaliacao = async () => {
    if (!avaliando) return;
    setEnviandoAval(true);
    const { ok, data } = await apiMobile(`/entregas/pedidos/${avaliando.id}/avaliar`, {
      method: 'POST', json: { nota_produto: notaProduto, nota_vendedor: notaVendedor, comentario: comentarioAval },
    });
    setEnviandoAval(false);
    if (ok) {
      setAvaliando(null);
      mostrarToast(data.message || 'Obrigado pela avaliação!', 'sucesso');
      carregar();
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível enviar sua avaliação.'), 'erro');
    }
  };

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ pedidos: PedidoEntrega[] }>('/entregas/meus-pedidos');
      if (ok) setPedidos(data.pedidos || []);
    } catch {
      setPedidos([]);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = pedidos.filter((p) => {
    if (aba === 'abertos') return EM_ABERTO.includes(p.status);
    if (aba === 'entregues') return p.status === 'concluido';
    if (aba === 'cancelados') return ['cancelado', 'estornado'].includes(p.status);
    return true;
  });

  const cancelar = (pedido: PedidoEntrega) => {
    alertar('Cancelar pedido?', 'Se você já pagou online, o valor volta para a forma de pagamento original.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          setProcessando(pedido.id);
          const { ok, data } = await apiMobile('/entregas/pedidos/' + pedido.id + '/cancelar', { method: 'POST' });
          setProcessando(null);
          if (ok) { mostrarToast(data.message || 'Pedido cancelado.', 'sucesso'); carregar(); }
          else mostrarToast(mensagemDeErro(data, 'Não foi possível cancelar o pedido.'), 'erro');
        },
      },
    ]);
  };

  const enviarEstorno = async () => {
    if (!modalEstorno) return;
    setProcessando(modalEstorno.id);
    const { ok, data } = await apiMobile('/entregas/pedidos/' + modalEstorno.id + '/estorno', {
      method: 'POST', json: { motivo, descricao },
    });
    setProcessando(null);
    if (ok) {
      setModalEstorno(null);
      mostrarToast(data.message || 'Solicitação enviada.', 'sucesso');
      carregar();
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível enviar a solicitação.'), 'erro');
    }
  };

  const falarComVendedor = async (pedido: PedidoEntrega) => {
    const { ok, data } = await apiMobile<{ conversa_id: number }>('/mensagens/iniciar', {
      method: 'POST', json: { produto_entrega_id: pedido.produto_entrega_id },
    });
    if (ok && data.conversa_id) router.push({ pathname: '/mensagens/[id]' as never, params: { id: String(data.conversa_id) } });
    else mostrarToast(mensagemDeErro(data, 'Não foi possível abrir a conversa.'), 'erro');
  };

  const baixarComprovante = async (pedido: PedidoEntrega) => {
    setProcessando(pedido.id);
    try {
      const token = await pegarToken();
      const destino = `${FileSystem.cacheDirectory}comprovante-entrega-${pedido.id}.pdf`;
      const resultado = await FileSystem.downloadAsync(`${API_MOBILE}/entregas/pedidos/${pedido.id}/comprovante-pdf`, destino, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });
      if (resultado.status !== 200) throw new Error();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(resultado.uri, { mimeType: 'application/pdf', dialogTitle: 'Comprovante Lokyva', UTI: 'com.adobe.pdf' });
      } else {
        alertar('Comprovante salvo', `Arquivo salvo em: ${resultado.uri}`);
      }
    } catch {
      alertar('Erro', 'Não foi possível baixar o comprovante agora.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.botaoRedondo}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Meus pedidos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.abas}>
        {ABAS.map((a) => (
          <TouchableOpacity key={a.id} onPress={() => setAba(a.id)} style={[s.chip, aba === a.id && s.chipAtivo]}>
            <Text style={[s.chipTxt, aba === a.id && s.chipTxtAtivo]}>{a.titulo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity onPress={() => router.push('/src/screens/AssinaturasEntrega' as never)} style={s.link}>
        <Ionicons name="calendar-outline" size={16} color={C.accent} />
        <Text style={s.linkTxt}>Minhas assinaturas de entrega</Text>
      </TouchableOpacity>

      {carregando ? (
        <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.lista}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={C.accent} />}
        >
          {filtrados.length === 0 && (
            <View style={s.vazio}>
              <Ionicons name="receipt-outline" size={44} color={C.faint} />
              <Text style={s.vazioTxt}>Nenhum pedido por aqui ainda.</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/entregas' as never)} style={s.botaoLink}>
                <Text style={s.botaoLinkTxt}>Ver produtos</Text>
              </TouchableOpacity>
            </View>
          )}

          {filtrados.map((pedido) => {
            const status = STATUS_PEDIDO[pedido.status] || { label: pedido.status, cor: C.muted, fundo: C.canvas };
            const podeCancelar = PODE_CANCELAR.includes(pedido.status);
            const podeEstornar = pedido.status === 'concluido' && !pedido.disputa_status;
            const ocupado = processando === pedido.id;

            return (
              <View key={pedido.id} style={s.card}>
                <View style={s.cardTopo}>
                  <Image source={{ uri: pedido.produto?.fotos?.[0] || 'https://placehold.co/160x160/f4f4f5/a1a1aa?text=Produto' }} style={s.foto} contentFit="cover" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.linhaEntre}>
                      <Text style={s.nome} numberOfLines={1}>{pedido.produto?.nome || 'Produto removido'}</Text>
                    </View>
                    <Text style={s.meta}>{pedido.codigo_pedido} · {pedido.quantidade}x</Text>
                    <View style={[s.badge, { backgroundColor: status.fundo }]}>
                      <Text style={[s.badgeTxt, { color: status.cor }]}>{status.label}</Text>
                    </View>
                    <Text style={s.total}>{brl(pedido.valor_total)}</Text>
                  </View>
                </View>

                <View style={s.infoBox}>
                  <Text style={s.rotulo}>{pedido.modo_recebimento === 'entrega' ? 'ENDEREÇO DE ENTREGA' : 'ENDEREÇO PARA BUSCAR'}</Text>
                  <Text style={s.infoTxt}>{pedido.endereco_recebimento}</Text>
                  {!!pedido.entrega_observacoes && pedido.modo_recebimento === 'entrega' && <Text style={s.infoSub}>Detalhes: {pedido.entrega_observacoes}</Text>}
                  <Text style={[s.rotulo, { marginTop: 8 }]}>FORMA DE PAGAMENTO</Text>
                  <Text style={s.infoTxt}>{pedido.forma_pagamento_label}</Text>
                </View>

                {pedido.codigo_confirmacao_visivel ? (
                  <View style={s.codigoBox}>
                    <Ionicons name="key-outline" size={18} color="#fff" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.codigoRotulo}>CÓDIGO DE ENTREGA</Text>
                      <Text style={s.codigo}>{pedido.codigo_confirmacao_visivel}</Text>
                      <Text style={s.codigoNota}>Mostre ao vendedor. Só ele libera o pagamento.</Text>
                    </View>
                  </View>
                ) : null}

                {!!pedido.disputa_status && (
                  <View style={s.avisoBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#92400E" />
                    <Text style={s.avisoTxt}>
                      Estorno: {pedido.disputa_status === 'solicitado' ? 'em análise pela Lokyva.' : pedido.disputa_status === 'aprovado' ? 'aprovado.' : 'não aprovado.'}
                    </Text>
                  </View>
                )}

                {pedido.em_rota && <RastreioMobile pedidoId={pedido.id} />}

                <View style={s.acoes}>
                  {(pedido.pontos_ganhos || 0) > 0 && (
                    <View style={s.pontos}>
                      <Ionicons name="star" size={13} color="#B45309" />
                      <Text style={s.pontosTxt}>+{pedido.pontos_ganhos || 0} pontos</Text>
                    </View>
                  )}
                  {pedido.status === 'concluido' && !pedido.avaliado && (
                    <TouchableOpacity onPress={() => { setAvaliando(pedido); setNotaProduto(0); setNotaVendedor(0); setComentarioAval(''); }} style={[s.acao, { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}>
                      <Ionicons name="star-outline" size={15} color="#fff" />
                      <Text style={[s.acaoTxt, { color: '#fff' }]}>Avaliar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => falarComVendedor(pedido)} style={s.acao}>
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.ink} />
                    <Text style={s.acaoTxt}>Falar com o vendedor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => baixarComprovante(pedido)} disabled={ocupado} style={s.acao}>
                    <Ionicons name="download-outline" size={15} color={C.ink} />
                    <Text style={s.acaoTxt}>Comprovante PDF</Text>
                  </TouchableOpacity>
                  {podeCancelar && (
                    <TouchableOpacity onPress={() => cancelar(pedido)} disabled={ocupado} style={s.acao}>
                      <Ionicons name="close-circle-outline" size={15} color={C.danger} />
                      <Text style={[s.acaoTxt, { color: C.danger }]}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                  {podeEstornar && (
                    <TouchableOpacity onPress={() => { setModalEstorno(pedido); setMotivo(''); setDescricao(''); }} style={s.acao}>
                      <Ionicons name="return-down-back-outline" size={15} color={C.ink} />
                      <Text style={s.acaoTxt}>Pedir estorno</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!avaliando} transparent animationType="fade" onRequestClose={() => setAvaliando(null)}>
        <View style={s.modalFundo}>
          <View style={s.modalCaixa}>
            <Text style={s.modalTitulo}>Como foi sua compra?</Text>
            <Text style={s.modalSub}>{avaliando?.produto?.nome}</Text>
            <Text style={s.rotulo}>O PRODUTO</Text>
            <EstrelasMobile valor={notaProduto} onChange={setNotaProduto} />
            <Text style={s.rotulo}>O VENDEDOR</Text>
            <EstrelasMobile valor={notaVendedor} onChange={setNotaVendedor} />
            <TextInput value={comentarioAval} onChangeText={setComentarioAval} placeholder="Conte como foi (opcional)" placeholderTextColor={C.faint} multiline style={[s.campo, { minHeight: 70, textAlignVertical: 'top' }]} />
            <View style={s.modalAcoes}>
              <TouchableOpacity onPress={() => setAvaliando(null)} style={[s.modalBotao, { backgroundColor: C.canvas }]}>
                <Text style={[s.modalBotaoTxt, { color: C.ink }]}>Depois</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!notaProduto || !notaVendedor || enviandoAval}
                onPress={enviarAvaliacao}
                style={[s.modalBotao, { backgroundColor: '#F59E0B' }, (!notaProduto || !notaVendedor) && { opacity: 0.4 }]}
              >
                <Text style={[s.modalBotaoTxt, { color: '#fff' }]}>{enviandoAval ? 'Enviando...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalEstorno} transparent animationType="fade" onRequestClose={() => setModalEstorno(null)}>
        <View style={s.modalFundo}>
          <View style={s.modalCaixa}>
            <Text style={s.modalTitulo}>Pedir estorno</Text>
            <Text style={s.modalSub}>{modalEstorno?.produto?.nome} · {modalEstorno?.codigo_pedido}</Text>
            <TextInput value={motivo} onChangeText={setMotivo} placeholder="Motivo (ex.: produto veio danificado)" placeholderTextColor={C.faint} style={s.campo} />
            <TextInput
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descreva o que aconteceu (mínimo de 10 caracteres)"
              placeholderTextColor={C.faint}
              multiline
              style={[s.campo, { minHeight: 90, textAlignVertical: 'top' }]}
            />
            <View style={s.modalAcoes}>
              <TouchableOpacity onPress={() => setModalEstorno(null)} style={[s.modalBotao, { backgroundColor: C.canvas }]}>
                <Text style={[s.modalBotaoTxt, { color: C.ink }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={enviarEstorno}
                disabled={!motivo.trim() || descricao.trim().length < 10 || processando === modalEstorno?.id}
                style={[s.modalBotao, { backgroundColor: C.accent }, (!motivo.trim() || descricao.trim().length < 10) && { opacity: 0.4 }]}
              >
                <Text style={[s.modalBotaoTxt, { color: '#fff' }]}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitulo: { fontSize: 16, fontWeight: '800', color: C.ink },
  botaoRedondo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  abas: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipAtivo: { backgroundColor: C.ink, borderColor: C.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  chipTxtAtivo: { color: '#fff' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 },
  vazio: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  vazioTxt: { color: C.muted, fontWeight: '600' },
  botaoLink: { marginTop: 4 },
  botaoLinkTxt: { color: C.accent, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line, gap: 12 },
  cardTopo: { flexDirection: 'row', gap: 12 },
  foto: { width: 76, height: 76, borderRadius: 14, backgroundColor: '#EDEDED' },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { flex: 1, fontSize: 15, fontWeight: '800', color: C.ink },
  meta: { fontSize: 11, color: C.faint },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  total: { fontSize: 16, fontWeight: '900', color: C.accent },
  infoBox: { backgroundColor: C.canvas, borderRadius: 14, padding: 12 },
  rotulo: { fontSize: 9, fontWeight: '800', color: C.faint, letterSpacing: 0.4 },
  infoTxt: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 3, lineHeight: 18 },
  infoSub: { fontSize: 11, color: C.muted, marginTop: 4 },
  codigoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.ink, borderRadius: 14, padding: 14 },
  codigoRotulo: { fontSize: 9, fontWeight: '800', color: '#A1A1AA', letterSpacing: 0.6 },
  codigo: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 6, marginTop: 2 },
  codigoNota: { fontSize: 10, color: '#A1A1AA', marginTop: 2 },
  avisoBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10 },
  avisoTxt: { flex: 1, fontSize: 12, color: '#78350F', fontWeight: '600' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  acaoTxt: { fontSize: 12, fontWeight: '700', color: C.ink },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCaixa: { width: '100%', backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 10 },
  modalTitulo: { fontSize: 17, fontWeight: '900', color: C.ink },
  modalSub: { fontSize: 12, color: C.faint },
  campo: { backgroundColor: C.canvas, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.line },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBotao: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBotaoTxt: { fontWeight: '800', fontSize: 14 },
  rastreio: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  rastreioTitulo: { fontSize: 13, fontWeight: '900', color: '#065F46' },
  rastreioTxt: { fontSize: 12, color: '#047857', marginTop: 2 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  pontosTxt: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 10 },
  linkTxt: { fontSize: 13, fontWeight: '800', color: C.accent },
});
