import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import { OwnerScreen, Card, Rotulo, Pilula, Vazio, api, BASE, tokenDoUsuario, brl, dataCurta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import CodigoSeisDigitos from '../../components/owner/CodigoSeisDigitos';
import { O } from '../../constants/OwnerTheme';
import { STATUS_PEDIDO } from '../../services/entregasApi';
import { alertar } from '../../services/alertar';

type Pedido = any;
type Dados = { pedidos: Pedido[]; funcionarios: { id: number; nome: string; estabelecimento_id: number }[]; papel: string };

const FILTROS = [
  { id: 'abertos', rotulo: 'Em aberto' },
  { id: 'concluidos', rotulo: 'Concluídas' },
  { id: 'todos', rotulo: 'Todas' },
];

export default function EntregasGestao() {
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const [filtro, setFiltro] = useState('abertos');
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(() => api('/entregas/gestao'));

  const pedidos = (dados?.pedidos || []).filter((p) => {
    if (filtro === 'abertos') return ['pago', 'aguardando_confirmacao'].includes(p.status);
    if (filtro === 'concluidos') return p.status === 'concluido';
    return true;
  });

  return (
    <OwnerScreen
      titulo="Entregas"
      subtitulo={dados?.papel === 'funcionario' ? 'Suas entregas designadas' : 'Quem entrega, rastreio e finalização'}
      carregando={carregando && !dados}
      atualizando={atualizando}
      onAtualizar={atualizar}
    >
      {erro && !dados ? null : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
            {FILTROS.map((f) => (
              <TouchableOpacity key={f.id} onPress={() => setFiltro(f.id)} style={[s.chip, filtro === f.id && s.chipAtivo]}>
                <Text style={[s.chipTxt, filtro === f.id && s.chipTxtAtivo]}>{f.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {pedidos.length === 0 ? (
            <Vazio
              icone="bicycle-outline"
              titulo={dados?.papel === 'funcionario' ? 'Nenhuma entrega para você agora' : 'Nenhuma entrega nesta lista'}
              texto="Quando um pedido chegar, ele aparece aqui."
            />
          ) : pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              funcionarios={dados?.funcionarios || []}
              aoAtualizar={recarregar}
              mostrarErro={mostrarErro}
              mostrarSucesso={mostrarSucesso}
            />
          ))}
        </>
      )}
      {aviso}
    </OwnerScreen>
  );
}

function PedidoCard({ pedido, funcionarios, aoAtualizar, mostrarErro, mostrarSucesso }: {
  pedido: Pedido; funcionarios: Dados['funcionarios']; aoAtualizar: () => void;
  mostrarErro: (e: any, t?: string) => void; mostrarSucesso: (t: string, m?: string) => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const status = STATUS_PEDIDO[pedido.status] || { label: pedido.status, cor: O.muted, fundo: O.soft };
  const doLocal = funcionarios.filter((f) => f.estabelecimento_id === pedido.estabelecimento?.id);

  const atribuir = async (corpo: Record<string, unknown>) => {
    setOcupado(true);
    try {
      await api(`/entregas/pedidos/${pedido.id}/funcionario`, { method: 'POST', body: corpo });
      aoAtualizar();
    } catch (e) {
      mostrarErro(e, 'Não foi possível escolher o entregador');
    } finally {
      setOcupado(false);
    }
  };

  const finalizar = async () => {
    if (pedido.precisa_codigo && codigo.length !== 6) return;
    setOcupado(true);
    try {
      await api(`/entregas/pedidos/${pedido.id}/liberar`, { method: 'POST', body: pedido.precisa_codigo ? { codigo } : {} });
      setCodigo('');
      mostrarSucesso('Entrega finalizada', pedido.precisa_codigo ? 'O pagamento foi liberado.' : 'Pedido marcado como finalizado.');
      aoAtualizar();
    } catch (e) {
      mostrarErro(e, 'Não foi possível finalizar');
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = () => {
    const online = pedido.status === 'pago';
    alertar(
      'Cancelar pedido',
      online ? 'O valor pago será devolvido ao cliente na forma de pagamento original.' : 'O pedido será cancelado.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar pedido',
          style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              await api(`/entregas/pedidos/${pedido.id}/cancelar-vendedor`, { method: 'POST' });
              mostrarSucesso('Pedido cancelado', online ? 'A devolução pode levar até 1 hora.' : 'Pedido cancelado.');
              aoAtualizar();
            } catch (e) {
              mostrarErro(e, 'Não foi possível cancelar');
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );
  };

  const enviarPosicao = async () => {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (!permissao.granted) return mostrarErro({ message: 'Permita a localização para enviar a posição.' });
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api(`/entregas/pedidos/${pedido.id}/posicao`, { method: 'POST', body: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      mostrarSucesso('Posição enviada', 'O cliente já pode acompanhar.');
    } catch (e) {
      mostrarErro(e, 'Não foi possível enviar a posição');
    }
  };

  const baixarComprovante = async () => {
    try {
      const token = await tokenDoUsuario();
      const destino = `${FileSystem.cacheDirectory}comprovante-${pedido.id}.pdf`;
      const r = await FileSystem.downloadAsync(`${BASE}/entregas/pedidos/${pedido.id}/comprovante-pdf`, destino, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });
      if (r.status !== 200) throw new Error();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(r.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      mostrarErro({ message: 'Não foi possível baixar o comprovante agora.' });
    }
  };

  const quemEntrega = pedido.eu_sou_entregador ? 'Você' : (pedido.entregador_nome || pedido.funcionario_nome || 'Ninguém ainda');

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.topo}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.nome} numberOfLines={2}>{pedido.produto?.nome || 'Produto removido'}</Text>
          <Text style={s.meta}>{pedido.codigo_pedido} · {pedido.quantidade}x · {brl(pedido.valor_total)} · {dataCurta(pedido.created_at)}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: status.fundo }]}><Text style={[s.badgeTxt, { color: status.cor }]}>{status.label}</Text></View>
      </View>

      <View style={s.bloco}>
        <Rotulo>Cliente</Rotulo>
        <Text style={s.linhaTxt}>{pedido.cliente?.nome}{pedido.cliente?.telefone ? ` · ${pedido.cliente.telefone}` : ''}</Text>
        <Text style={s.meta}>{pedido.endereco_recebimento}</Text>
        {!!pedido.entrega_observacoes && <Text style={s.meta}>Detalhes: {pedido.entrega_observacoes}</Text>}
        <View style={s.pilulas}>
          <Pilula texto={pedido.modo_recebimento === 'entrega' ? 'Entrega em casa' : 'Retirada'} tom="neutro" />
          <Pilula texto={pedido.forma_pagamento_label} tom="info" />
        </View>
      </View>

      <View style={s.bloco}>
        <Rotulo>Quem entrega</Rotulo>
        {pedido.pode_atribuir ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity disabled={ocupado} onPress={() => atribuir({ eu_mesmo: true })} style={[s.chip, pedido.eu_sou_entregador && s.chipAtivo]}>
              <Text style={[s.chipTxt, pedido.eu_sou_entregador && s.chipTxtAtivo]}>Eu mesmo</Text>
            </TouchableOpacity>
            {doLocal.map((f) => (
              <TouchableOpacity key={f.id} disabled={ocupado} onPress={() => atribuir({ funcionario_id: f.id })} style={[s.chip, pedido.funcionario?.id === f.id && s.chipAtivo]}>
                <Text style={[s.chipTxt, pedido.funcionario?.id === f.id && s.chipTxtAtivo]}>{f.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={s.linhaTxt}>{quemEntrega}</Text>
        )}
      </View>

      {pedido.pode_finalizar && (
        <View style={s.bloco}>
          <Rotulo>Finalizar</Rotulo>
          {pedido.precisa_codigo ? (
            <>
              <Text style={s.meta}>Pedido online: peça o código de 6 dígitos ao cliente.</Text>
              <CodigoSeisDigitos valor={codigo} onChange={setCodigo} desabilitado={ocupado} />
              <TouchableOpacity onPress={finalizar} disabled={ocupado || codigo.length !== 6} style={[s.botaoPrincipal, (ocupado || codigo.length !== 6) && { opacity: 0.4 }]}>
                <Text style={s.botaoPrincipalTxt}>{ocupado ? 'Confirmando...' : 'Confirmar entrega'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.meta}>Pagamento no local ou direto com o vendedor: basta marcar como finalizado.</Text>
              <TouchableOpacity onPress={finalizar} disabled={ocupado} style={[s.botaoPrincipal, ocupado && { opacity: 0.4 }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.botaoPrincipalTxt}>{ocupado ? 'Finalizando...' : 'Finalizado'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={s.acoes}>
        {pedido.pode_posicao && pedido.monitoramento && pedido.pode_finalizar && (
          <TouchableOpacity onPress={enviarPosicao} style={s.acao}>
            <Ionicons name="navigate-outline" size={15} color={O.ink} />
            <Text style={s.acaoTxt}>Enviar posição</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={baixarComprovante} style={s.acao}>
          <Ionicons name="download-outline" size={15} color={O.ink} />
          <Text style={s.acaoTxt}>Comprovante PDF</Text>
        </TouchableOpacity>
        {pedido.pode_cancelar && (
          <TouchableOpacity disabled={ocupado} onPress={cancelar} style={s.acao}>
            <Ionicons name="close-circle-outline" size={15} color={O.ink} />
            <Text style={s.acaoTxt}>Cancelar pedido</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  filtros: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: O.line, backgroundColor: O.card },
  chipAtivo: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: O.muted },
  chipTxtAtivo: { color: '#fff' },
  topo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  nome: { fontSize: 15, fontWeight: '900', color: O.ink },
  meta: { fontSize: 12, color: O.muted, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  bloco: { gap: 6, borderTopWidth: 1, borderTopColor: O.line, paddingTop: 10 },
  linhaTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  botaoPrincipal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: O.success, borderRadius: 14, paddingVertical: 13, marginTop: 4 },
  botaoPrincipalTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: O.line, paddingTop: 10 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: O.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  acaoTxt: { fontSize: 12, fontWeight: '700', color: O.ink },
});
