import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { T } from '../../constants/ClientTheme';
import { apiViagem, PRESENCA } from '../../services/viagensApi';
import { alertar } from '../../services/alertar';

const SITE = (process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile').replace(/\/api\/mobile$/, '');

export default function GrupoViagem({ painel, recarregar, avisar }: { painel: any; recarregar: () => void; avisar: (t: string) => void }) {
  const router = useRouter();
  const { viagem, membros, eu } = painel;
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const meu = membros.find((m: any) => m.id === eu.id);
  const codigo: string | null = viagem.codigo_convite;
  const link = codigo ? `${SITE}/viagens/convite/${codigo}` : null;

  const executar = async (caminho: string, metodo: 'POST' | 'DELETE', corpo?: unknown, sucesso?: string) => {
    const r = await apiViagem(caminho, metodo, corpo);
    if (!r.ok) { alertar('Não foi possível concluir', r.erro || ''); return false; }
    avisar(sucesso || r.dados?.mensagem || 'Feito.');
    recarregar();
    return true;
  };

  const convidar = async () => {
    if (!email.trim()) return;
    setEnviando(true);
    if (await executar(`/${viagem.id}/convidar`, 'POST', { email: email.trim() })) setEmail('');
    setEnviando(false);
  };

  const compartilhar = () => Share.share({ message: `Vem viajar comigo! Entre no grupo "${viagem.titulo}" no Lokyva.\nCódigo de convite: ${codigo}\n${link}` }).catch(() => {});
  const copiar = async () => { await Clipboard.setStringAsync(codigo || ''); avisar('Código copiado!'); };

  const sair = () => alertar('Sair do grupo', 'Você deixará de ver essa viagem.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sair', style: 'destructive', onPress: async () => { if (await executar(`/${viagem.id}/presenca`, 'POST', { status: 'recusado' })) router.back(); } },
  ]);

  const remover = (m: any) => alertar('Remover participante', `Remover ${m.nome} da viagem?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => executar(`/${viagem.id}/membros/${m.id}`, 'DELETE') },
  ]);

  return (
    <View style={{ gap: 14 }}>
      {meu && meu.presenca !== 'confirmado' && (
        <View style={s.convite}>
          <Text style={s.conviteTxt}>Você já confirmou sua presença?</Text>
          <TouchableOpacity style={s.btnPrim} onPress={() => executar(`/${viagem.id}/presenca`, 'POST', { status: 'confirmado' })}><Text style={s.btnPrimTxt}>Confirmar presença</Text></TouchableOpacity>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.titulo}>Quem vai</Text>
        <Text style={s.sub}>{membros.filter((m: any) => m.presenca === 'confirmado').length} de {membros.length} confirmaram presença</Text>
        {membros.map((m: any) => {
          const p = PRESENCA[m.presenca] || PRESENCA.pendente;
          return (
            <View key={m.id} style={s.membro}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{m.nome.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{m.nome}{m.id === eu.id ? ' (você)' : ''}</Text>
                <Text style={s.papel}>{m.funcao === 'criador' ? 'Organizador' : m.funcao === 'editor' ? 'Pode editar' : 'Participante'}</Text>
              </View>
              <View style={[s.selo, { backgroundColor: p.bg }]}><Text style={[s.seloTxt, { color: p.cor }]}>{p.texto}</Text></View>
              {viagem.sou_criador && m.funcao !== 'criador' && <TouchableOpacity onPress={() => remover(m)} style={{ marginLeft: 8 }}><Ionicons name="trash-outline" size={17} color={T.faint} /></TouchableOpacity>}
            </View>
          );
        })}
      </View>

      {viagem.posso_editar && (
        <>
          <View style={s.card}>
            <Text style={s.titulo}>Convidar o pessoal</Text>
            <Text style={s.sub}>Quem entrar pelo código não precisa ser Premium.</Text>
            <View style={s.codigoBox}><Text style={s.codigo}>{codigo}</Text></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.btnSec, { flex: 1 }]} onPress={copiar}><Ionicons name="copy-outline" size={16} color={T.ink} /><Text style={s.btnSecTxt}> Copiar código</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnPrim, { flex: 1 }]} onPress={compartilhar}><Ionicons name="share-outline" size={16} color="#fff" /><Text style={s.btnPrimTxt}> Compartilhar</Text></TouchableOpacity>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.titulo}>Convidar por e-mail</Text>
            <Text style={s.sub}>A pessoa precisa ter conta no Lokyva.</Text>
            <TextInput style={s.input} placeholder="amigo@email.com" placeholderTextColor={T.faint} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <TouchableOpacity style={[s.btnPrim, { marginTop: 8 }, enviando && { opacity: 0.6 }]} onPress={convidar} disabled={enviando}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimTxt}>Convidar</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      {!viagem.sou_criador && (
        <TouchableOpacity style={s.sair} onPress={sair}><Text style={s.sairTxt}>Não vou / sair do grupo</Text></TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  convite: { backgroundColor: T.primarySoft, borderRadius: 18, padding: 14, gap: 10 },
  conviteTxt: { fontSize: 14, fontWeight: '700', color: T.ink },
  card: { backgroundColor: T.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  titulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  sub: { fontSize: 12, color: T.muted, marginTop: 2, marginBottom: 10 },
  membro: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: T.primary },
  nome: { fontSize: 14, fontWeight: '700', color: T.ink },
  papel: { fontSize: 11, color: T.faint },
  selo: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  seloTxt: { fontSize: 11, fontWeight: '800' },
  codigoBox: { backgroundColor: T.cream, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  codigo: { fontSize: 24, fontWeight: '800', letterSpacing: 4, color: T.ink },
  btnPrim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btnSecTxt: { color: T.ink, fontWeight: '800', fontSize: 14 },
  input: { backgroundColor: T.cream, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink },
  sair: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA' },
  sairTxt: { color: T.danger, fontWeight: '800' },
});
