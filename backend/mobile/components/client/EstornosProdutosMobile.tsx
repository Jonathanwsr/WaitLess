import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { apiMobile, brl, mensagemDeErro } from '../../services/entregasApi';
import { mostrarToast } from '../../services/toast';

const SITUACAO: Record<string, { texto: string; cor: string; fundo: string }> = {
  solicitado: { texto: 'Em análise', cor: '#B45309', fundo: '#FEF3C7' },
  aprovado: { texto: 'Aprovado', cor: '#047857', fundo: '#D1FAE5' },
  reprovado: { texto: 'Não aprovado', cor: '#B91C1C', fundo: '#FEE2E2' },
};

/** Estornos de produtos para entrega (aba "Produtos" da tela de estornos). */
export default function EstornosProdutosMobile() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [alvo, setAlvo] = useState<any | null>(null);
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ pedidos: any[] }>('/entregas/estornos');
      if (ok) setPedidos(data.pedidos || []);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    if (!alvo) return;
    setEnviando(true);
    const { ok, data } = await apiMobile(`/entregas/pedidos/${alvo.id}/estorno`, { method: 'POST', json: { motivo, descricao } });
    setEnviando(false);
    if (ok) {
      setAlvo(null);
      mostrarToast(data.message || 'Solicitação enviada.', 'sucesso');
      carregar();
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível enviar a solicitação.'), 'erro');
    }
  };

  if (carregando) return <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />;

  if (pedidos.length === 0) {
    return (
      <View style={s.vazio}>
        <Ionicons name="cube-outline" size={30} color={T.faint} />
        <Text style={s.vazioTxt}>Nenhum produto entregue para pedir estorno.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={T.primary} />}
    >
      {pedidos.map((pedido) => {
        const situacao = SITUACAO[pedido.disputa_status || ''] || (pedido.estorno_status ? { texto: pedido.estorno_status, cor: T.muted, fundo: T.cream } : null);
        const podePedir = !situacao;
        return (
          <View key={pedido.id} style={s.card}>
            <Image source={{ uri: pedido.produto?.fotos?.[0] || 'https://placehold.co/160x160/f4f4f5/a1a1aa?text=Produto' }} style={s.foto} contentFit="cover" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.nome} numberOfLines={1}>{pedido.produto?.nome || 'Produto removido'}</Text>
              <Text style={s.meta}>{pedido.codigo_pedido} · {brl(pedido.valor_total)}</Text>
              <View style={s.linha}>
                {situacao && <View style={[s.badge, { backgroundColor: situacao.fundo }]}><Text style={[s.badgeTxt, { color: situacao.cor }]}>{situacao.texto}</Text></View>}
                {podePedir && (
                  <TouchableOpacity onPress={() => { setAlvo(pedido); setMotivo(''); setDescricao(''); }} style={s.botao}>
                    <Text style={s.botaoTxt}>Pedir estorno</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        );
      })}

      <Modal visible={!!alvo} transparent animationType="fade" onRequestClose={() => setAlvo(null)}>
        <View style={s.fundo}>
          <View style={s.caixa}>
            <Text style={s.tituloModal}>Pedir estorno</Text>
            <Text style={s.meta}>{alvo?.produto?.nome} · {alvo?.codigo_pedido}</Text>
            <TextInput value={motivo} onChangeText={setMotivo} placeholder="Motivo (ex.: produto veio danificado)" placeholderTextColor={T.faint} style={s.campo} />
            <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descreva o que aconteceu (mínimo 10 caracteres)" placeholderTextColor={T.faint} multiline style={[s.campo, { minHeight: 90, textAlignVertical: 'top' }]} />
            <View style={s.linha}>
              <TouchableOpacity onPress={() => setAlvo(null)} style={[s.botao, { flex: 1, backgroundColor: T.cream }]}><Text style={[s.botaoTxt, { color: T.ink }]}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={enviar} disabled={enviando || !motivo.trim() || descricao.trim().length < 10} style={[s.botao, { flex: 1 }, (!motivo.trim() || descricao.trim().length < 10) && { opacity: 0.4 }]}>
                <Text style={s.botaoTxt}>{enviando ? 'Enviando...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  vazio: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  vazioTxt: { color: T.muted, fontWeight: '600' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: T.line },
  foto: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#EDEDED' },
  nome: { fontSize: 14, fontWeight: '800', color: T.ink },
  meta: { fontSize: 11, color: T.faint },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  botao: { backgroundColor: T.ink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  botaoTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: { width: '100%', backgroundColor: T.card, borderRadius: 20, padding: 20, gap: 10 },
  tituloModal: { fontSize: 17, fontWeight: '900', color: T.ink },
  campo: { backgroundColor: T.cream, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: T.ink, borderWidth: 1, borderColor: T.line },
});
