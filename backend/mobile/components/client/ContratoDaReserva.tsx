import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Linking, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { API_MOBILE, pegarToken } from '../../services/entregasApi';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { alertar } from '../../services/alertar';

export type ContratoReserva = {
  id: number; numero: string; titulo: string; gerado_em: string | null; enviado_em: string | null;
  assinado: boolean; texto: string | null; pdf_url: string | null; docx_url: string | null;
  pode_aceitar?: boolean;
  aceite?: { em: string | null; como: string | null; aparelho: string | null; codigo: string | null } | null;
};

const dataHoraBr = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const dataBr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '');

const abrir = async (url: string | null) => {
  if (!url) return;
  try { await Linking.openURL(url); } catch { alertar('Não foi possível abrir', 'Tente de novo em instantes.'); }
};

/** Contrato da reserva: ler no app e abrir o PDF/Word. Vale para reservas avulsas e de locais. */
export default function ContratoDaReserva({ contrato: inicial, exigeContrato }: { contrato?: ContratoReserva | null; exigeContrato?: boolean }) {
  const [lendo, setLendo] = useState(false);
  const [contrato, setContrato] = useState(inicial);
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setContrato(inicial), [inicial]);

  const aceitar = async () => {
    if (!contrato || !marcado || enviando) return;
    setEnviando(true);
    try {
      const token = await pegarToken();
      const r = await fetch(`${API_MOBILE}/contratos/${contrato.id}/aceitar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json',
          'X-Aparelho': `LOKYVA-App · ${Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : Platform.OS}`,
        },
        body: JSON.stringify({ aceito: true }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'Tente de novo em instantes.');
      setContrato(data.contrato);
      setLendo(false);
      alertar('Contrato aceito', 'O proprietário foi avisado.');
    } catch (e: any) {
      alertar('Não foi possível aceitar', e?.message || 'Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  const blocoAceite = contrato?.pode_aceitar ? (
    <View style={s.aceiteCaixa}>
      <TouchableOpacity style={s.aceiteLinha} onPress={() => setMarcado((v) => !v)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }}>
        <View style={[s.check, marcado && s.checkOn]}>{marcado && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
        <Text style={s.aceiteTxt}><Text style={{ fontWeight: '900', color: T.ink }}>Li e aceito</Text> os termos deste contrato. Ficam registrados a data, a hora e o aparelho, e o proprietário é avisado.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.btnAceitar, (!marcado || enviando) && { opacity: 0.5 }]} onPress={aceitar} disabled={!marcado || enviando} activeOpacity={0.85}>
        {enviando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-done" size={18} color="#fff" /><Text style={s.btnPrimarioTxt}>Aceitar contrato</Text></>}
      </TouchableOpacity>
    </View>
  ) : null;

  if (!contrato) {
    if (!exigeContrato) return null;
    return (
      <View style={[s.card, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
        <View style={s.topo}><Ionicons name="document-text-outline" size={20} color="#B45309" /><Text style={s.titulo}>Contrato da reserva</Text></View>
        <Text style={s.texto}>Esta reserva tem contrato. Assim que o proprietário gerar o documento, ele aparece aqui para você ler e baixar.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={s.card}>
        <View style={s.topo}>
          <View style={s.icone}><Ionicons name="document-text" size={20} color="#4F46E5" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Contrato da reserva</Text>
            <Text style={s.sub} numberOfLines={1}>{contrato.titulo}</Text>
          </View>
          <View style={[s.selo, contrato.assinado && { backgroundColor: '#DCFCE7' }]}>
            <Text style={[s.seloTxt, contrato.assinado && { color: '#15803D' }]}>{contrato.assinado ? 'Aceito' : contrato.pode_aceitar ? 'Aguardando' : 'Disponível'}</Text>
          </View>
        </View>
        <Text style={s.meta}>Nº {contrato.numero}{contrato.gerado_em ? ` · gerado em ${dataBr(contrato.gerado_em)}` : ''}</Text>
        <Text style={s.texto}>As regras combinadas para esta reserva. Leia antes da data de início; se tiver dúvida, fale com o proprietário.</Text>
        {!!contrato.aceite && (
          <View style={s.aceitoBox}>
            <Ionicons name="shield-checkmark" size={18} color="#15803D" />
            <View style={{ flex: 1 }}>
              <Text style={s.aceitoTxt}>Você aceitou em {dataHoraBr(contrato.aceite.em)}{contrato.aceite.aparelho ? ` · ${contrato.aceite.aparelho}` : ''}</Text>
              {!!contrato.aceite.codigo && <Text style={s.aceitoCod}>Código do aceite: {contrato.aceite.codigo}</Text>}
            </View>
          </View>
        )}

        <View style={s.botoes}>
          {!!contrato.texto && (
            <TouchableOpacity style={[s.btn, s.btnPrimario]} onPress={() => setLendo(true)} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="book-outline" size={18} color="#fff" /><Text style={s.btnPrimarioTxt}>Ler contrato</Text>
            </TouchableOpacity>
          )}
          {!!contrato.pdf_url && (
            <TouchableOpacity style={[s.btn, contrato.texto ? s.btnSecundario : s.btnPrimario]} onPress={() => abrir(contrato.pdf_url)} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="download-outline" size={18} color={contrato.texto ? T.ink : '#fff'} />
              <Text style={contrato.texto ? s.btnSecundarioTxt : s.btnPrimarioTxt}>{contrato.texto ? 'PDF' : 'Abrir PDF'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {blocoAceite}
      </View>

      <Modal visible={lendo} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLendo(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.modalTopo}>
            <Ionicons name="document-text" size={22} color="#4F46E5" />
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitulo} numberOfLines={1}>{contrato.titulo}</Text>
              <Text style={s.meta}>Nº {contrato.numero}</Text>
            </View>
            <TouchableOpacity onPress={() => setLendo(false)} style={s.fechar} accessibilityLabel="Fechar"><Ionicons name="close" size={24} color={T.ink} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text style={s.contratoTxt} selectable>{contrato.texto}</Text>
            {blocoAceite}
          </ScrollView>
          {!!contrato.pdf_url && (
            <View style={s.modalRodape}>
              <Text style={[s.meta, { flex: 1 }]}>O PDF é a versão oficial do documento.</Text>
              <TouchableOpacity style={[s.btn, s.btnPrimario, { flex: 0, paddingHorizontal: 18 }]} onPress={() => abrir(contrato.pdf_url)}>
                <Ionicons name="download-outline" size={18} color="#fff" /><Text style={s.btnPrimarioTxt}>Baixar PDF</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginHorizontal: 20, marginTop: 14, borderWidth: 1, borderColor: '#E0E7FF' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  sub: { fontSize: 12, color: T.muted, marginTop: 1 },
  selo: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  seloTxt: { fontSize: 10, fontWeight: '900', color: '#4F46E5', textTransform: 'uppercase' },
  meta: { fontSize: 11, color: T.faint, marginTop: 8 },
  texto: { fontSize: 13, color: T.muted, lineHeight: 19, marginTop: 6 },
  botoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 14 },
  btnPrimario: { backgroundColor: '#4F46E5' },
  btnPrimarioTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnSecundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line },
  btnSecundarioTxt: { color: T.ink, fontWeight: '800', fontSize: 14 },
  modalTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line },
  modalTitulo: { fontSize: 16, fontWeight: '900', color: T.ink },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  contratoTxt: { fontSize: 15, lineHeight: 25, color: T.ink },
  aceiteCaixa: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#F8FAFF' },
  aceiteLinha: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#A5B4FC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  aceiteTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: T.muted },
  btnAceitar: { backgroundColor: '#059669', marginTop: 12, flex: 0 },
  aceitoBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, marginTop: 10 },
  aceitoTxt: { fontSize: 13, color: '#166534', fontWeight: '700' },
  aceitoCod: { fontSize: 11, color: '#15803D', marginTop: 2 },
  modalRodape: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: '#FAFAFA' },
});
