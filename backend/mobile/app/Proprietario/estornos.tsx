import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Segmentado, Vazio, Erro, api, brl, dataCompleta, BASE, tokenDoUsuario } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { alertar } from '../../services/alertar';

const MAX_FOTOS = 4;

interface Estorno {
  id: number;
  codigo: string;
  status: string;
  categoria: string;
  cliente: string | null;
  valor_pago: number;
  valor_estornado: number;
  motivo: string;
  descricao_cliente: string;
  prazo_resposta: string | null;
  prestador_respondeu: boolean;
  pode_contestar: boolean;
  data: string;
}

interface Resposta {
  resumo: { total: number; pendentes: number; valor_estornado: number };
  estornos: Estorno[];
}

const STATUS: Record<string, { rotulo: string; tom: 'neutro' | 'positivo' | 'negativo' | 'alerta' | 'info' }> = {
  PENDENTE: { rotulo: 'Aguardando resposta', tom: 'alerta' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'info' },
  AGUARDANDO_DOCUMENTOS: { rotulo: 'Aguardando documentos', tom: 'alerta' },
  APROVADO: { rotulo: 'Aprovado', tom: 'negativo' },
  ESTORNO_SOLICITADO_ASAAS: { rotulo: 'Processando', tom: 'info' },
  ESTORNADO: { rotulo: 'Estornado', tom: 'negativo' },
  REPROVADO: { rotulo: 'Reprovado', tom: 'positivo' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
  ERRO_ASAAS: { rotulo: 'Erro no gateway', tom: 'negativo' },
};

/** Urgência do prazo de contestação: quanto falta, e a cor/andamento da barrinha (fica vermelha perto do fim). */
function prazoInfo(dataSolicitacao: string, prazoResposta: string | null): { texto: string; cor: string; progresso: number } | null {
  if (!prazoResposta) return null;
  const inicio = new Date(dataSolicitacao).getTime();
  const fim = new Date(prazoResposta).getTime();
  const agora = Date.now();
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return null;

  const restanteMs = fim - agora;
  const progresso = Math.min(1, Math.max(0, (agora - inicio) / (fim - inicio)));
  const horas = Math.max(0, Math.ceil(restanteMs / (1000 * 60 * 60)));
  const dias = Math.ceil(horas / 24);

  if (restanteMs <= 0) return { texto: 'Prazo esgotado', cor: O.danger, progresso: 1 };
  const texto = horas <= 24 ? (horas <= 1 ? 'Expira em menos de 1h' : `Expira em ${horas}h`) : `Expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const cor = horas <= 24 ? O.danger : horas <= 48 ? O.warning : O.accent;
  return { texto, cor, progresso };
}

export default function EstornosSocio() {
  const [filtro, setFiltro] = useState('todos');
  const [alvo, setAlvo] = useState<Estorno | null>(null);
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const escolherFotos = async () => {
    if (fotos.length >= MAX_FOTOS) return;
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      alertar('Permissão necessária', 'Precisamos de acesso às fotos para anexar evidências.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 0.8,
    });
    if (!res.canceled && res.assets) {
      setFotos((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, MAX_FOTOS));
    }
  };

  const removerFoto = (uri: string) => setFotos((prev) => prev.filter((f) => f !== uri));

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Resposta>(() => api('/proprietario/estornos'));

  const lista = (dados?.estornos || []).filter((e) => {
    if (filtro === 'abertos') return ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS'].includes(e.status);
    if (filtro === 'concluidos') return ['ESTORNADO', 'REPROVADO', 'CANCELADO'].includes(e.status);
    return true;
  });

  const fecharModalContestar = () => {
    setAlvo(null);
    setTexto('');
    setFotos([]);
  };

  const enviar = async () => {
    if (!alvo) return;
    if (texto.trim().length < 10) {
      alertar('Descreva melhor', 'Explique sua defesa com pelo menos 10 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      // Upload de fotos exige multipart — a api() do painel sempre manda o corpo como JSON,
      // então aqui a chamada é montada à mão com o mesmo token e a mesma base da api().
      const token = await tokenDoUsuario();
      const formData = new FormData();
      formData.append('descricao', texto.trim());
      fotos.forEach((uri, idx) => formData.append('fotos[]', { uri, name: `evidencia_${idx}.jpg`, type: 'image/jpeg' } as any));

      const res = await fetch(`${BASE}/proprietario/estornos/${alvo.id}/contestar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || 'Não foi possível enviar sua contestação.');

      fecharModalContestar();
      alertar('Contestação enviada', json?.message || 'Sua defesa foi registrada.');
      recarregar();
    } catch (e: any) {
      alertar('Não foi possível enviar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <OwnerScreen titulo="Estornos" subtitulo="Solicitações dos seus clientes" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : dados && (
        <>
          <View style={s.grade}>
            <Metrica rotulo="Solicitações" valor={dados.resumo.total} icone="documents-outline" />
            <Metrica rotulo="Aguardando você" valor={dados.resumo.pendentes} icone="hourglass-outline" tom={dados.resumo.pendentes ? 'alerta' : 'neutro'} />
          </View>
          <View style={{ marginBottom: 14 }}>
            <Metrica rotulo="Total estornado" valor={brl(dados.resumo.valor_estornado)} icone="return-up-back-outline" tom="negativo" />
          </View>

          <Segmentado
            opcoes={[{ id: 'todos', rotulo: 'Todos' }, { id: 'abertos', rotulo: 'Em aberto' }, { id: 'concluidos', rotulo: 'Concluídos' }]}
            valor={filtro}
            aoMudar={setFiltro}
          />

          {lista.length === 0 ? (
            <Card><Vazio icone="shield-checkmark-outline" titulo="Nenhum estorno por aqui" texto="Quando um cliente pedir estorno de um pagamento seu, ele aparece nesta lista." /></Card>
          ) : (
            lista.map((e) => {
              const st = STATUS[e.status] || { rotulo: e.status, tom: 'neutro' as const };
              const prazo = e.pode_contestar ? prazoInfo(e.data, e.prazo_resposta) : null;
              return (
                <Card key={e.id}>
                  <View style={s.topo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cliente} numberOfLines={1}>{e.cliente || 'Cliente'}</Text>
                      <Text style={s.codigo}>{e.codigo} · {dataCompleta(e.data)}</Text>
                    </View>
                    <Pilula texto={st.rotulo} tom={st.tom} />
                  </View>

                  {!!prazo && (
                    <View style={s.prazoBox}>
                      <View style={s.prazoLinha}>
                        <Text style={[s.prazoTxt, { color: prazo.cor }]}>{prazo.texto}</Text>
                        <Text style={s.prazoLabel}>para contestar</Text>
                      </View>
                      <View style={s.prazoBarra}>
                        <View style={[s.prazoBarraOn, { width: `${Math.max(6, prazo.progresso * 100)}%`, backgroundColor: prazo.cor }]} />
                      </View>
                    </View>
                  )}

                  <View style={s.valores}>
                    <View>
                      <Text style={s.valorRotulo}>Valor pago</Text>
                      <Text style={s.valor}>{brl(e.valor_pago)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.valorRotulo}>A estornar</Text>
                      <Text style={[s.valor, { color: O.danger }]}>{brl(e.valor_estornado)}</Text>
                    </View>
                  </View>

                  <View style={s.motivo}>
                    <Text style={s.motivoTitulo}>{e.motivo}</Text>
                    {!!e.descricao_cliente && <Text style={s.motivoTexto} numberOfLines={4}>{e.descricao_cliente}</Text>}
                  </View>

                  {e.pode_contestar ? (
                    <TouchableOpacity style={s.btn} onPress={() => { setAlvo(e); setTexto(''); setFotos([]); }} activeOpacity={0.85}>
                      <Text style={s.btnTxt}>Contestar estorno</Text>
                    </TouchableOpacity>
                  ) : e.prestador_respondeu ? (
                    <Text style={s.nota}>Você já enviou sua defesa. Aguarde a análise da administração.</Text>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      )}

      <Modal visible={!!alvo} transparent animationType="slide" onRequestClose={fecharModalContestar}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={fecharModalContestar} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <Text style={s.sheetTitulo}>Contestar estorno</Text>
            <ScrollView style={{ maxHeight: '65%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.sheetSub}>Explique por que o serviço foi prestado ou por que o estorno não procede. A administração analisa sua resposta.</Text>
              <TextInput
                style={s.textarea}
                value={texto}
                onChangeText={(t) => setTexto(t.slice(0, 2000))}
                multiline
                maxLength={2000}
                placeholder="Descreva sua defesa"
                placeholderTextColor={O.faint}
                textAlignVertical="top"
              />
              <Text style={s.contador}>{texto.length}/2000</Text>

              <Text style={s.evidenciasTitulo}>Anexar evidências (opcional)</Text>
              <Text style={s.evidenciasSub}>Fotos ou prints que ajudem a explicar o caso. Até {MAX_FOTOS} imagens, 3MB cada.</Text>
              <View style={s.evidenciasGrade}>
                {fotos.map((uri) => (
                  <View key={uri} style={s.evidenciaFoto}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 14 }} contentFit="cover" />
                    <TouchableOpacity style={s.evidenciaRemover} onPress={() => removerFoto(uri)} activeOpacity={0.8}>
                      <Ionicons name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {fotos.length < MAX_FOTOS && (
                  <TouchableOpacity style={s.evidenciaAdicionar} onPress={escolherFotos} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={20} color={O.muted} />
                    <Text style={s.evidenciaAdicionarTxt}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} activeOpacity={0.85}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Enviar contestação</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  grade: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cliente: { fontSize: 16, fontWeight: '700', color: O.ink },
  codigo: { fontSize: 12, color: O.muted, marginTop: 2 },
  prazoBox: { marginTop: 10 },
  prazoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  prazoTxt: { fontSize: 12, fontWeight: '800' },
  prazoLabel: { fontSize: 11, color: O.muted, fontWeight: '600' },
  prazoBarra: { height: 6, borderRadius: 3, backgroundColor: O.soft, marginTop: 6, overflow: 'hidden' },
  prazoBarraOn: { height: 6, borderRadius: 3 },
  valores: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: O.line },
  valorRotulo: { fontSize: 11, color: O.muted, fontWeight: '600' },
  valor: { fontSize: 18, fontWeight: '800', color: O.ink, marginTop: 2 },
  motivo: { backgroundColor: O.soft, borderRadius: 14, padding: 12, marginTop: 14 },
  motivoTitulo: { fontSize: 13, fontWeight: '700', color: O.ink },
  motivoTexto: { fontSize: 13, color: O.muted, marginTop: 4, lineHeight: 19 },
  btn: { backgroundColor: O.accent, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  nota: { fontSize: 12, color: O.muted, marginTop: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: O.line, alignSelf: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 20, fontWeight: '800', color: O.ink },
  sheetSub: { fontSize: 13, color: O.muted, marginTop: 6, lineHeight: 19, marginBottom: 14 },
  textarea: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: O.line, borderRadius: 16, padding: 14, minHeight: 130, fontSize: 15, color: O.ink },
  contador: { fontSize: 11, color: O.faint, textAlign: 'right', marginTop: 4 },
  evidenciasTitulo: { fontSize: 14, fontWeight: '700', color: O.ink, marginTop: 16 },
  evidenciasSub: { fontSize: 12, color: O.muted, marginTop: 2, marginBottom: 10, lineHeight: 17 },
  evidenciasGrade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  evidenciaFoto: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: O.soft },
  evidenciaRemover: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  evidenciaAdicionar: { width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderColor: O.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  evidenciaAdicionarTxt: { fontSize: 10, color: O.muted, fontWeight: '600' },
});
