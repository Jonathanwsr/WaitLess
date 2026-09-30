import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, TextInput, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { apiViagem, dia } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';

type Viagem = {
  id: number; titulo: string; destino: string; data_inicio: string; data_fim: string; pessoas: number; status: string;
  itens: number; membros: string[]; sou_criador: boolean; minha_presenca: string | null;
};

export default function MinhasViagens() {
  const router = useRouter();
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [premium, setPremium] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [entrando, setEntrando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await apiViagem<{ viagens: Viagem[]; premium: boolean }>('');
    if (r.ok) { setViagens(r.dados.viagens); setPremium(r.dados.premium); setErro(null); } else setErro(r.erro);
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const responder = async (v: Viagem, status: 'confirmado' | 'recusado') => {
    const r = await apiViagem(`/${v.id}/presenca`, 'POST', { status });
    if (!r.ok) return alertar('Não foi possível responder', r.erro || '');
    carregar();
  };

  const nova = () => {
    if (!premium) {
      alertar('Recurso Premium', 'O roteiro inteligente é exclusivo para assinantes Premium. Você continua podendo participar de grupos para os quais foi convidado.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver planos', onPress: () => router.push('/assinatura' as never) },
      ]);
      return;
    }
    router.push('/src/screens/NovaViagem' as never);
  };

  const entrarPorCodigo = async () => {
    const c = codigo.trim().toUpperCase();
    if (!c) return;
    setEntrando(true);
    const info = await apiViagem(`/convite/${encodeURIComponent(c)}`);
    if (!info.ok) { setEntrando(false); return alertar('Convite não encontrado', info.erro || ''); }
    if (info.dados.ja_participa) { setEntrando(false); setCodigo(''); return router.push(`/src/screens/ViagemDetalhe?id=${info.dados.viagem_id}` as never); }

    alertar(info.dados.titulo, `${info.dados.criador} convidou você.\n${info.dados.destino} · ${dia(info.dados.data_inicio)} a ${dia(info.dados.data_fim)}\n${info.dados.membros} no grupo`, [
      { text: 'Cancelar', style: 'cancel', onPress: () => setEntrando(false) },
      { text: 'Entrar no grupo', onPress: async () => {
        const e = await apiViagem(`/convite/${encodeURIComponent(c)}`, 'POST');
        setEntrando(false);
        if (!e.ok) return alertar('Não foi possível entrar', e.erro || '');
        setCodigo('');
        router.push(`/src/screens/ViagemDetalhe?id=${info.dados.viagem_id}` as never);
      } },
    ]);
  };

  const convites = viagens.filter((v) => v.minha_presenca === 'pendente');
  const lista = viagens.filter((v) => v.minha_presenca !== 'pendente');

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <HeaderCliente titulo="Minhas viagens" subtitulo="Roteiros, reservas e gastos do grupo" voltar tituloMenor />

      {carregando ? (
        <View style={s.centro}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={T.primary} />}>
          {!!erro && <View style={s.erro}><Text style={s.erroTxt}>{erro}</Text></View>}

          <TouchableOpacity style={s.botaoNova} onPress={nova} activeOpacity={0.85}>
            <Ionicons name={premium ? 'sparkles' : 'lock-closed'} size={18} color="#fff" />
            <Text style={s.botaoNovaTxt}> Montar roteiro inteligente</Text>
          </TouchableOpacity>
          {!premium && <Text style={s.dica}>Recurso Premium — mas você pode entrar em grupos com um código de convite.</Text>}

          <View style={s.codigoBox}>
            <TextInput style={s.codigoInput} placeholder="Código de convite" placeholderTextColor={T.faint} autoCapitalize="characters" autoCorrect={false} value={codigo} onChangeText={setCodigo} maxLength={16} />
            <TouchableOpacity style={[s.codigoBtn, (!codigo.trim() || entrando) && { opacity: 0.5 }]} onPress={entrarPorCodigo} disabled={!codigo.trim() || entrando}>
              {entrando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.codigoBtnTxt}>Entrar</Text>}
            </TouchableOpacity>
          </View>

          {convites.length > 0 && (
            <>
              <Text style={s.secao}>Convites para você</Text>
              {convites.map((v) => (
                <View key={v.id} style={s.convite}>
                  <Text style={s.viagemTitulo}>{v.titulo}</Text>
                  <Text style={s.meta}>{v.destino} · {dia(v.data_inicio)} a {dia(v.data_fim)}</Text>
                  <Text style={s.meta}>{v.membros.join(', ')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={[s.btn, { backgroundColor: T.primary, flex: 1 }]} onPress={() => responder(v, 'confirmado')}><Text style={{ color: '#fff', fontWeight: '800' }}>Confirmar presença</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.btn, { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line }]} onPress={() => responder(v, 'recusado')}><Text style={{ color: T.muted, fontWeight: '800' }}>Não vou</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {lista.length === 0 && convites.length === 0 && !erro && (
            <View style={s.vazio}>
              <Ionicons name="airplane-outline" size={44} color={T.primary} />
              <Text style={s.vazioTitulo}>Nenhuma viagem por aqui ainda</Text>
              <Text style={s.vazioTxt}>Diga a cidade, as datas e o orçamento — o Lokyva monta o roteiro para o seu grupo.</Text>
            </View>
          )}

          {lista.map((v) => (
            <TouchableOpacity key={v.id} style={s.card} activeOpacity={0.85} onPress={() => router.push(`/src/screens/ViagemDetalhe?id=${v.id}` as never)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[s.viagemTitulo, { flex: 1 }]}>{v.titulo}</Text>
                <View style={s.status}><Text style={s.statusTxt}>{v.status}</Text></View>
              </View>
              <View style={s.linhaMeta}><Ionicons name="location-outline" size={14} color={T.muted} /><Text style={s.meta}> {v.destino}</Text></View>
              <View style={s.linhaMeta}><Ionicons name="calendar-outline" size={14} color={T.muted} /><Text style={s.meta}> {dia(v.data_inicio)} a {dia(v.data_fim)}</Text></View>
              <View style={s.linhaMeta}><Ionicons name="people-outline" size={14} color={T.muted} /><Text style={s.meta}> {v.membros.length} {v.membros.length === 1 ? 'pessoa' : 'pessoas'} · {v.itens} itens na agenda</Text></View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 6, paddingBottom: 60, gap: 12 },
  erro: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 12 },
  erroTxt: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  botaoNova: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary, borderRadius: 18, paddingVertical: 15 },
  botaoNovaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dica: { fontSize: 12, color: T.muted, textAlign: 'center', marginTop: -4 },
  codigoBox: { flexDirection: 'row', gap: 8, backgroundColor: T.card, borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  codigoInput: { flex: 1, paddingHorizontal: 10, fontSize: 15, fontWeight: '700', letterSpacing: 1, color: T.ink },
  codigoBtn: { backgroundColor: T.ink, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', minWidth: 72, alignItems: 'center' },
  codigoBtnTxt: { color: '#fff', fontWeight: '800' },
  secao: { fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 6 },
  convite: { backgroundColor: T.primarySoft, borderRadius: 20, padding: 16 },
  btn: { borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  card: { backgroundColor: T.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  viagemTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  meta: { fontSize: 13, color: T.muted, marginTop: 1 },
  status: { backgroundColor: '#F3F0EE', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 11, fontWeight: '800', color: T.muted, textTransform: 'capitalize' },
  vazio: { alignItems: 'center', padding: 30, gap: 8 },
  vazioTitulo: { fontSize: 18, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 19 },
});
