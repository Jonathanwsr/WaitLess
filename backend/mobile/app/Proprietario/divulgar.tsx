import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Share, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Vazio, Erro, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { mostrarToast } from '../../services/toast';

interface ServicoLink { id: number; nome: string; valor: number; link: string; qr_url: string }
interface LocalDivulgacao {
  id: number; nome: string; foto_perfil: string | null; link: string; qr_url: string; mensagem: string; servicos: ServicoLink[];
}

export default function Divulgar() {
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<{ locais: LocalDivulgacao[] }>(() => api('/proprietario/divulgacao'));
  const [localId, setLocalId] = useState<number | null>(null);
  const [servicoId, setServicoId] = useState<number | null>(null);

  const locais = dados?.locais || [];
  const local = locais.find((l) => l.id === localId) || locais[0];
  const servico = local?.servicos.find((s) => s.id === servicoId) || null;

  const link = servico ? servico.link : local?.link || '';
  const qr = servico ? servico.qr_url : local?.qr_url || '';
  const mensagem = servico
    ? `Agende ${servico.nome} na ${local?.nome} pelo Lokyva, sem fila e sem ligar: ${servico.link}`
    : local?.mensagem || '';

  const copiar = async () => {
    await Clipboard.setStringAsync(link);
    mostrarToast('Link copiado!', 'sucesso');
  };

  const compartilhar = async () => {
    try {
      await Share.share({ message: mensagem });
    } catch {
      // usuário fechou a folha de compartilhamento
    }
  };

  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(mensagem)}`;
    const pode = await Linking.canOpenURL(url).catch(() => false);
    if (pode) Linking.openURL(url);
    else Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensagem)}`);
  };

  return (
    <OwnerScreen titulo="Divulgar" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : !local ? (
        <Card><Vazio icone="megaphone-outline" titulo="Cadastre um local primeiro" texto="Depois disso você ganha um link e um QR Code para divulgar no Instagram, no WhatsApp e no balcão." /></Card>
      ) : (
        <>
          <View style={s.hero}>
            <Text style={s.heroTitulo}>Traga seus clientes para o app</Text>
            <Text style={s.heroTexto}>Compartilhe o link ou imprima o QR Code. O cliente abre, escolhe o horário e agenda sem ligar.</Text>
          </View>

          {locais.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {locais.map((l) => (
                <TouchableOpacity key={l.id} style={[s.chip, l.id === local.id && s.chipOn]} onPress={() => { setLocalId(l.id); setServicoId(null); }} activeOpacity={0.8}>
                  <Text style={[s.chipTxt, l.id === local.id && { color: '#fff' }]} numberOfLines={1}>{l.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Card style={{ alignItems: 'center' }}>
            <Text style={s.qrTitulo}>{servico ? servico.nome : local.nome}</Text>
            <Text style={s.qrSub}>{servico ? 'QR Code deste serviço' : 'QR Code do seu local'}</Text>
            <View style={s.qrBox}>
              <Image source={{ uri: qr }} style={s.qr} resizeMode="contain" accessibilityLabel="QR Code de agendamento" />
            </View>
            <Text style={s.link} numberOfLines={1} selectable>{link}</Text>

            <TouchableOpacity style={s.btnPrim} onPress={compartilhar} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
              <Text style={s.btnPrimTxt}>Compartilhar</Text>
            </TouchableOpacity>
            <View style={s.linha}>
              <TouchableOpacity style={s.btnSec} onPress={whatsapp} activeOpacity={0.8}>
                <Ionicons name="logo-whatsapp" size={20} color="#12A150" />
                <Text style={s.btnSecTxt}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSec} onPress={copiar} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={20} color={O.ink} />
                <Text style={s.btnSecTxt}>Copiar link</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {local.servicos.length > 0 && (
            <>
              <Rotulo>Divulgar um serviço específico</Rotulo>
              <Card style={{ paddingVertical: 4 }}>
                <TouchableOpacity style={[s.servico, s.servicoBorda]} onPress={() => setServicoId(null)} activeOpacity={0.7}>
                  <Ionicons name={servicoId === null ? 'radio-button-on' : 'radio-button-off'} size={20} color={O.accent} />
                  <Text style={s.servicoNome}>Meu local (todos os serviços)</Text>
                </TouchableOpacity>
                {local.servicos.map((sv, i) => (
                  <TouchableOpacity key={sv.id} style={[s.servico, i < local.servicos.length - 1 && s.servicoBorda]} onPress={() => setServicoId(sv.id)} activeOpacity={0.7}>
                    <Ionicons name={servicoId === sv.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={O.accent} />
                    <Text style={s.servicoNome} numberOfLines={1}>{sv.nome}</Text>
                    <Text style={s.servicoValor}>{brl(sv.valor)}</Text>
                  </TouchableOpacity>
                ))}
              </Card>
            </>
          )}

          <Card>
            <Text style={s.dicaTitulo}>Onde divulgar</Text>
            {[
              ['logo-instagram', 'Coloque o link na bio do Instagram.'],
              ['print-outline', 'Imprima o QR Code e cole no balcão e no espelho.'],
              ['chatbubble-ellipses-outline', 'Mande no WhatsApp para quem você já atende.'],
            ].map(([icone, texto]) => (
              <View key={texto} style={s.dica}>
                <Ionicons name={icone as any} size={18} color={O.accent} />
                <Text style={s.dicaTxt}>{texto}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 14 },
  heroTitulo: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroTexto: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: O.card, maxWidth: 220 },
  chipOn: { backgroundColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  qrTitulo: { fontSize: 18, fontWeight: '800', color: O.ink, textAlign: 'center' },
  qrSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  qrBox: { width: 230, height: 230, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, borderColor: O.line, alignItems: 'center', justifyContent: 'center', marginVertical: 16, padding: 10 },
  qr: { width: '100%', height: '100%' },
  link: { fontSize: 12, color: O.muted, marginBottom: 16, maxWidth: '100%' },
  btnPrim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: O.accent },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  linha: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 10 },
  btnSec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: O.soft },
  btnSecTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
  servico: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  servicoBorda: { borderBottomWidth: 1, borderBottomColor: O.line },
  servicoNome: { flex: 1, fontSize: 14, fontWeight: '600', color: O.ink },
  servicoValor: { fontSize: 13, fontWeight: '700', color: O.muted },
  dicaTitulo: { fontSize: 15, fontWeight: '800', color: O.ink, marginBottom: 8 },
  dica: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dicaTxt: { flex: 1, fontSize: 13, color: O.muted, lineHeight: 19 },
});
