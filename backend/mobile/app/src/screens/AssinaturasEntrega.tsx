import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { apiMobile, brl, mensagemDeErro } from '../../../services/entregasApi';

const C = { ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line, accent: T.primary, accentSoft: T.primarySoft, success: T.success, danger: T.danger };

const FREQ: Record<number, string> = { 7: 'Toda semana', 14: 'A cada 2 semanas', 30: 'Todo mês' };
const STATUS: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  ativa: { rotulo: 'Ativa', cor: '#047857', fundo: '#D1FAE5' },
  pausada: { rotulo: 'Pausada', cor: '#B45309', fundo: '#FEF3C7' },
  cancelada: { rotulo: 'Cancelada', cor: '#525252', fundo: '#F3F4F6' },
};

type Assinatura = {
  id: number;
  status: 'ativa' | 'pausada' | 'cancelada';
  quantidade: number;
  frequencia_dias: number;
  modo_recebimento: string;
  modo_pagamento: string;
  proxima_entrega_em: string;
  produto?: { nome: string; fotos?: string[] | null; valor_final: number | string } | null;
};

export default function AssinaturasEntrega() {
  const router = useRouter();
  const [assinaturas, setAssinaturas] = useState<Assinatura[] | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [ocupada, setOcupada] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ assinaturas: Assinatura[] }>('/entregas/assinaturas');
      setAssinaturas(ok ? data.assinaturas : []);
    } catch {
      setAssinaturas([]);
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterar = (a: Assinatura, acao: 'pausar' | 'retomar' | 'cancelar') => {
    const executar = async () => {
      setOcupada(a.id);
      const { ok, data } = await apiMobile(`/entregas/assinaturas/${a.id}/alterar`, { method: 'POST', json: { acao } });
      setOcupada(null);
      if (ok) { mostrarToast('Assinatura atualizada.', 'sucesso'); carregar(); }
      else mostrarToast(mensagemDeErro(data, 'Não foi possível atualizar a assinatura.'), 'erro');
    };

    if (acao === 'cancelar') {
      alertar('Cancelar assinatura?', 'As próximas entregas deixam de ser geradas.', [
        { text: 'Manter', style: 'cancel' },
        { text: 'Cancelar', style: 'destructive', onPress: executar },
      ]);
    } else {
      executar();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <HeaderCliente titulo="Assinaturas" subtitulo="Entregas recorrentes" voltar />

      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={C.accent} />}
      >
        {assinaturas === null ? (
          <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
        ) : assinaturas.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="calendar-outline" size={44} color={C.faint} />
            <Text style={s.vazioTitulo}>Nenhuma assinatura ainda</Text>
            <Text style={s.vazioTxt}>Abra um produto e toque em "Assinar entrega recorrente".</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/entregas' as never)} style={s.botao}>
              <Text style={s.botaoTxt}>Ver produtos</Text>
            </TouchableOpacity>
          </View>
        ) : assinaturas.map((a) => {
          const st = STATUS[a.status] || STATUS.ativa;
          const cancelada = a.status === 'cancelada';
          return (
            <View key={a.id} style={s.card}>
              <View style={s.topo}>
                <Image source={{ uri: a.produto?.fotos?.[0] || 'https://placehold.co/160x160/f4f4f5/a1a1aa?text=Produto' }} style={s.foto} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.nome} numberOfLines={2}>{a.produto?.nome || 'Produto removido'}</Text>
                  <View style={[s.badge, { backgroundColor: st.fundo }]}><Text style={[s.badgeTxt, { color: st.cor }]}>{st.rotulo}</Text></View>
                  <Text style={s.meta}>{a.quantidade}x · {FREQ[a.frequencia_dias] || `a cada ${a.frequencia_dias} dias`}</Text>
                  <Text style={s.meta}>{a.modo_recebimento === 'entrega' ? 'Entrega em casa' : 'Retirada'} · {a.modo_pagamento === 'local' ? 'pago no local' : 'pago direto com o vendedor'}</Text>
                </View>
              </View>

              {!cancelada && (
                <View style={s.proxima}>
                  <Ionicons name="time-outline" size={16} color={C.accent} />
                  <Text style={s.proximaTxt}>Próxima entrega: {new Date(`${a.proxima_entrega_em}T12:00:00`).toLocaleDateString('pt-BR')}</Text>
                </View>
              )}

              {!cancelada && (
                <View style={s.acoes}>
                  {a.status === 'ativa' && (
                    <TouchableOpacity disabled={ocupada === a.id} onPress={() => alterar(a, 'pausar')} style={s.acao}>
                      <Ionicons name="pause-outline" size={15} color={C.ink} /><Text style={s.acaoTxt}>Pausar</Text>
                    </TouchableOpacity>
                  )}
                  {a.status === 'pausada' && (
                    <TouchableOpacity disabled={ocupada === a.id} onPress={() => alterar(a, 'retomar')} style={[s.acao, { backgroundColor: C.success, borderColor: C.success }]}>
                      <Ionicons name="play-outline" size={15} color="#fff" /><Text style={[s.acaoTxt, { color: '#fff' }]}>Retomar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity disabled={ocupada === a.id} onPress={() => alterar(a, 'cancelar')} style={s.acao}>
                    <Ionicons name="close-outline" size={15} color={C.danger} /><Text style={[s.acaoTxt, { color: C.danger }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  conteudo: { padding: 16, gap: 14, paddingBottom: 40 },
  centro: { paddingVertical: 60, alignItems: 'center' },
  vazio: { alignItems: 'center', paddingVertical: 50, gap: 8, paddingHorizontal: 20 },
  vazioTitulo: { fontSize: 16, fontWeight: '900', color: C.ink },
  vazioTxt: { fontSize: 13, color: C.muted, textAlign: 'center' },
  botao: { marginTop: 8, backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  botaoTxt: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line, gap: 12 },
  topo: { flexDirection: 'row', gap: 12 },
  foto: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#EDEDED' },
  nome: { fontSize: 15, fontWeight: '800', color: C.ink },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  meta: { fontSize: 12, color: C.muted },
  proxima: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentSoft, borderRadius: 12, padding: 10 },
  proximaTxt: { fontSize: 13, fontWeight: '800', color: C.accent },
  acoes: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  acaoTxt: { fontSize: 12, fontWeight: '800', color: C.ink },
});
