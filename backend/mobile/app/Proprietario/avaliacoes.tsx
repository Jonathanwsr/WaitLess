import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Segmentado, Vazio, Erro, api, dataCompleta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { alertar } from '../../services/alertar';

interface Avaliacao {
  id: number;
  nota: number;
  comentario: string | null;
  autor: string | null;
  local: string | null;
  resposta: string | null;
  data_resposta: string | null;
  data: string;
}

interface Resposta {
  resumo: { total: number; media: number; sem_resposta: number; estrelas: Record<string, number> };
  avaliacoes: Avaliacao[];
}

const Estrelas = ({ nota, tamanho = 14 }: { nota: number; tamanho?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Ionicons key={n} name={n <= Math.round(nota) ? 'star' : 'star-outline'} size={tamanho} color={n <= Math.round(nota) ? '#F59E0B' : O.line} />
    ))}
  </View>
);

export default function AvaliacoesSocio() {
  const [filtro, setFiltro] = useState('todas');
  const [alvo, setAlvo] = useState<Avaliacao | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Resposta>(() => api('/proprietario/avaliacoes'));

  const lista = (dados?.avaliacoes || []).filter((a) => (filtro === 'pendentes' ? !a.resposta : true));

  const responder = async () => {
    if (!alvo || !texto.trim()) return;
    setEnviando(true);
    try {
      await api(`/proprietario/avaliacoes/${alvo.id}/responder`, { method: 'POST', body: { resposta: texto.trim() } });
      setAlvo(null);
      setTexto('');
      recarregar();
    } catch (e: any) {
      alertar('Não foi possível publicar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  const total = dados?.resumo.total || 0;

  return (
    <OwnerScreen titulo="Avaliações" subtitulo="O que seus clientes dizem" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : dados && (
        <>
          <Card>
            <View style={s.resumo}>
              <View style={{ alignItems: 'center', paddingRight: 18 }}>
                <Text style={s.media}>{dados.resumo.media.toFixed(1)}</Text>
                <Estrelas nota={dados.resumo.media} />
                <Text style={s.totalTxt}>{total} avaliações</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {['5', '4', '3', '2', '1'].map((n) => {
                  const qtd = dados.resumo.estrelas[n] || 0;
                  return (
                    <View key={n} style={s.barraLinha}>
                      <Text style={s.barraN}>{n}</Text>
                      <View style={s.barraFundo}><View style={[s.barraPreench, { width: `${total ? (qtd / total) * 100 : 0}%` }]} /></View>
                      <Text style={s.barraQtd}>{qtd}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>

          <Metrica rotulo="Sem resposta sua" valor={dados.resumo.sem_resposta} icone="chatbox-ellipses-outline" tom={dados.resumo.sem_resposta ? 'alerta' : 'neutro'} />
          <View style={{ height: 14 }} />

          <Segmentado opcoes={[{ id: 'todas', rotulo: 'Todas' }, { id: 'pendentes', rotulo: 'Sem resposta' }]} valor={filtro} aoMudar={setFiltro} />

          {lista.length === 0 ? (
            <Card><Vazio icone="star-outline" titulo="Nenhuma avaliação" texto="As avaliações dos seus clientes aparecem aqui para você responder." /></Card>
          ) : (
            lista.map((a) => (
              <Card key={a.id}>
                <View style={s.topo}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{(a.autor || 'C').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.autor} numberOfLines={1}>{a.autor || 'Cliente'}</Text>
                    <Text style={s.local} numberOfLines={1}>{a.local} · {dataCompleta(a.data)}</Text>
                  </View>
                  <Estrelas nota={a.nota} />
                </View>

                {!!a.comentario && <Text style={s.comentario}>{a.comentario}</Text>}

                {a.resposta ? (
                  <View style={s.resposta}>
                    <Text style={s.respostaTitulo}>Sua resposta</Text>
                    <Text style={s.respostaTxt}>{a.resposta}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={s.btn} onPress={() => { setAlvo(a); setTexto(''); }} activeOpacity={0.8}>
                    <Ionicons name="return-down-forward-outline" size={16} color={O.ink} />
                    <Text style={s.btnTxt}>Responder</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))
          )}
        </>
      )}

      <Modal visible={!!alvo} transparent animationType="slide" onRequestClose={() => setAlvo(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAlvo(null)} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <Text style={s.sheetTitulo}>Responder avaliação</Text>
            {!!alvo?.comentario && <Text style={s.sheetCitacao} numberOfLines={3}>"{alvo.comentario}"</Text>}
            <TextInput
              style={s.textarea}
              value={texto}
              onChangeText={setTexto}
              multiline
              maxLength={1500}
              placeholder="Escreva uma resposta cordial e profissional"
              placeholderTextColor={O.faint}
              textAlignVertical="top"
            />
            <TouchableOpacity style={[s.btnPrim, (!texto.trim() || enviando) && { opacity: 0.5 }]} onPress={responder} disabled={!texto.trim() || enviando} activeOpacity={0.85}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimTxt}>Publicar resposta</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  resumo: { flexDirection: 'row', alignItems: 'center' },
  media: { fontSize: 44, fontWeight: '800', color: O.ink, letterSpacing: -1 },
  totalTxt: { fontSize: 12, color: O.muted, marginTop: 6 },
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraN: { width: 10, fontSize: 12, fontWeight: '600', color: O.muted },
  barraFundo: { flex: 1, height: 6, borderRadius: 3, backgroundColor: O.soft, overflow: 'hidden' },
  barraPreench: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  barraQtd: { width: 24, textAlign: 'right', fontSize: 12, color: O.muted },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '700', color: O.muted },
  autor: { fontSize: 15, fontWeight: '700', color: O.ink },
  local: { fontSize: 12, color: O.muted, marginTop: 2 },
  comentario: { fontSize: 14, color: O.ink, lineHeight: 21, marginTop: 12 },
  resposta: { backgroundColor: O.soft, borderRadius: 14, padding: 12, marginTop: 12 },
  respostaTitulo: { fontSize: 12, fontWeight: '700', color: O.muted, marginBottom: 4 },
  respostaTxt: { fontSize: 13, color: O.ink, lineHeight: 19 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: O.line, marginTop: 14 },
  btnTxt: { fontSize: 14, fontWeight: '700', color: O.ink },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: O.line, alignSelf: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 20, fontWeight: '800', color: O.ink },
  sheetCitacao: { fontSize: 13, color: O.muted, marginTop: 8, fontStyle: 'italic', lineHeight: 19 },
  textarea: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: O.line, borderRadius: 16, padding: 14, minHeight: 120, fontSize: 15, color: O.ink, marginTop: 14 },
  btnPrim: { backgroundColor: O.accent, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnPrimTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
