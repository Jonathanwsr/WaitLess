import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { apiViagem, dia } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';
import { Avatares, blocoData, contagem, gradienteDoDestino } from '../../../components/viagem/visual';

type Viagem = {
  id: number; titulo: string; destino: string; data_inicio: string; data_fim: string; pessoas: number; status: string;
  itens: number; membros: string[]; sou_criador: boolean; minha_presenca: string | null;
};

const TOPO = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

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
  const proximas = lista.filter((v) => contagem(v.data_inicio, v.data_fim).texto !== 'Concluída');
  const passadas = lista.filter((v) => contagem(v.data_inicio, v.data_fim).texto === 'Concluída');

  const Cartao = ({ v }: { v: Viagem }) => {
    const cor = gradienteDoDestino(v.destino);
    const cont = contagem(v.data_inicio, v.data_fim);
    const ini = blocoData(v.data_inicio);
    return (
      <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => router.push(`/src/screens/ViagemDetalhe?id=${v.id}` as never)}>
        <LinearGradient colors={cor} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardCapa}>
          <Ionicons name="airplane" size={90} color="rgba(255,255,255,0.12)" style={s.cardAviao} />
          <View style={s.cardCapaTopo}>
            <View style={s.calendario}>
              <Text style={s.calMes}>{ini.mes}</Text>
              <Text style={s.calDia}>{ini.dia}</Text>
            </View>
            {!!cont.texto && <View style={[s.selo, { backgroundColor: cont.bg }]}><Text style={[s.seloTxt, { color: cont.cor }]}>{cont.texto}</Text></View>}
          </View>
          <Text style={s.cardDestino}><Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" /> {v.destino}</Text>
          <Text style={s.cardTitulo} numberOfLines={1}>{v.titulo}</Text>
        </LinearGradient>
        <View style={s.cardRodape}>
          <Avatares nomes={v.membros} />
          <View style={{ flex: 1 }}>
            <Text style={s.rodapeTxt}>{dia(v.data_inicio)} – {dia(v.data_fim)}</Text>
            <Text style={s.rodapeSub}>{v.membros.length} {v.membros.length === 1 ? 'pessoa' : 'pessoas'} · {v.itens} {v.itens === 1 ? 'item' : 'itens'} na agenda</Text>
          </View>
          <View style={s.seta}><Ionicons name="chevron-forward" size={18} color={T.ink} /></View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor="#fff" />}
      >
        {/* TOPO */}
        <LinearGradient colors={['#1F1A17', '#3A2414', '#7C2D12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <View style={s.bolha1} />
          <View style={s.bolha2} />
          <View style={s.heroLinha}>
            <TouchableOpacity onPress={() => router.back()} style={s.voltar} hitSlop={10}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
            {premium && <View style={s.premiumPill}><Ionicons name="diamond" size={11} color="#FDE68A" /><Text style={s.premiumPillTxt}> Premium</Text></View>}
          </View>
          <Text style={s.heroOla}>Suas viagens</Text>
          <Text style={s.heroTitulo}>Para onde vamos{'\n'}desta vez?</Text>
          <Text style={s.heroSub}>Roteiro, reservas, gastos e chat do grupo, tudo num lugar só.</Text>

          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statNum}>{proximas.length}</Text><Text style={s.statTxt}>próximas</Text></View>
            <View style={s.statDiv} />
            <View style={s.stat}><Text style={s.statNum}>{convites.length}</Text><Text style={s.statTxt}>convites</Text></View>
            <View style={s.statDiv} />
            <View style={s.stat}><Text style={s.statNum}>{passadas.length}</Text><Text style={s.statTxt}>concluídas</Text></View>
          </View>

          <TouchableOpacity onPress={nova} activeOpacity={0.9}>
            <LinearGradient colors={premium ? ['#FF9A3D', '#FF7A00'] : ['#4B5563', '#374151']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.botaoNova}>
              <View style={s.botaoNovaIcone}><Ionicons name={premium ? 'sparkles' : 'lock-closed'} size={18} color={premium ? T.primary : '#374151'} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.botaoNovaTxt}>Montar roteiro inteligente</Text>
                <Text style={s.botaoNovaSub}>{premium ? 'Cidade, datas e orçamento: o resto é com a gente' : 'Exclusivo Premium · toque para ver os planos'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        <View style={s.corpo}>
          {/* CÓDIGO DE CONVITE */}
          <View style={s.codigoBox}>
            <View style={s.codigoIcone}><Ionicons name="ticket-outline" size={20} color={T.primary} /></View>
            <TextInput style={s.codigoInput} placeholder="Tem um código de convite?" placeholderTextColor={T.faint} autoCapitalize="characters" autoCorrect={false} value={codigo} onChangeText={setCodigo} maxLength={16} onSubmitEditing={entrarPorCodigo} returnKeyType="go" />
            <TouchableOpacity style={[s.codigoBtn, (!codigo.trim() || entrando) && { opacity: 0.45 }]} onPress={entrarPorCodigo} disabled={!codigo.trim() || entrando}>
              {entrando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.codigoBtnTxt}>Entrar</Text>}
            </TouchableOpacity>
          </View>

          {carregando && <ActivityIndicator color={T.primary} size="large" style={{ marginTop: 30 }} />}
          {!!erro && <View style={s.erro}><Ionicons name="alert-circle" size={18} color="#B91C1C" /><Text style={s.erroTxt}>{erro}</Text></View>}

          {/* CONVITES */}
          {convites.length > 0 && (
            <>
              <View style={s.secaoLinha}><Text style={s.secao}>Convites para você</Text><View style={s.contador}><Text style={s.contadorTxt}>{convites.length}</Text></View></View>
              {convites.map((v) => {
                const cor = gradienteDoDestino(v.destino);
                return (
                  <View key={v.id} style={s.convite}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <LinearGradient colors={cor} style={s.conviteIcone}><Ionicons name="mail-open" size={20} color="#fff" /></LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={s.conviteTitulo} numberOfLines={1}>{v.titulo}</Text>
                        <Text style={s.conviteMeta}>{v.destino} · {dia(v.data_inicio)} a {dia(v.data_fim)}</Text>
                      </View>
                    </View>
                    <View style={s.conviteGrupo}>
                      <Avatares nomes={v.membros} tamanho={24} />
                      <Text style={s.conviteMeta} numberOfLines={1}>  {v.membros.slice(0, 3).join(', ')}{v.membros.length > 3 ? '…' : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <TouchableOpacity style={[s.btn, { backgroundColor: T.primary, flex: 1 }]} onPress={() => responder(v, 'confirmado')} activeOpacity={0.85}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={s.btnTxtClaro}> Eu vou</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.btn, { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line }]} onPress={() => responder(v, 'recusado')} activeOpacity={0.85}>
                        <Text style={s.btnTxtEscuro}>Não vou</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* VAZIO */}
          {!carregando && lista.length === 0 && convites.length === 0 && !erro && (
            <View style={s.vazio}>
              <LinearGradient colors={['#FFE7D1', '#FFF6EE']} style={s.vazioIcone}><Ionicons name="airplane" size={38} color={T.primary} /></LinearGradient>
              <Text style={s.vazioTitulo}>Nenhuma viagem por aqui ainda</Text>
              <Text style={s.vazioTxt}>Diga a cidade, as datas e o orçamento. O Lokyva monta o roteiro e você chama o grupo.</Text>
            </View>
          )}

          {proximas.length > 0 && <Text style={s.secao}>Próximas viagens</Text>}
          {proximas.map((v) => <Cartao key={v.id} v={v} />)}

          {passadas.length > 0 && <Text style={s.secao}>Já aconteceram</Text>}
          {passadas.map((v) => <View key={v.id} style={{ opacity: 0.75 }}><Cartao v={v} /></View>)}
        </View>
      </ScrollView>
    </View>
  );
}

const sombra = { shadowColor: '#1F1A17', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  hero: { paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  bolha1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,122,0,0.25)', top: -60, right: -70 },
  bolha2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -50, left: -40 },
  heroLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voltar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  premiumPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(253,230,138,0.15)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(253,230,138,0.35)' },
  premiumPillTxt: { color: '#FDE68A', fontSize: 11, fontWeight: '800' },
  heroOla: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700', marginTop: 18, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitulo: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 4, lineHeight: 35 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8, lineHeight: 19 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, paddingVertical: 12, marginTop: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginTop: 1 },
  statDiv: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },
  botaoNova: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, marginTop: 16 },
  botaoNovaIcone: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  botaoNovaTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  botaoNovaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1 },
  corpo: { padding: 18, gap: 14, marginTop: -4 },
  codigoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 20, padding: 8, ...sombra },
  codigoIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  codigoInput: { flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.5, color: T.ink, paddingVertical: 8 },
  codigoBtn: { backgroundColor: T.ink, borderRadius: 14, paddingHorizontal: 18, height: 40, justifyContent: 'center', minWidth: 76, alignItems: 'center' },
  codigoBtnTxt: { color: '#fff', fontWeight: '800' },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 12 },
  erroTxt: { flex: 1, color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  secaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  secao: { fontSize: 18, fontWeight: '900', color: T.ink, marginTop: 6, letterSpacing: -0.3 },
  contador: { backgroundColor: T.primary, borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 6 },
  contadorTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  convite: { backgroundColor: T.card, borderRadius: 22, padding: 16, borderWidth: 1.5, borderColor: '#FFD9B8', ...sombra },
  conviteIcone: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  conviteTitulo: { fontSize: 16, fontWeight: '900', color: T.ink },
  conviteMeta: { fontSize: 12, color: T.muted, marginTop: 2, flexShrink: 1 },
  conviteGrupo: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  btn: { flexDirection: 'row', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnTxtClaro: { color: '#fff', fontWeight: '800' },
  btnTxtEscuro: { color: T.muted, fontWeight: '800' },
  card: { backgroundColor: T.card, borderRadius: 24, overflow: 'hidden', ...sombra },
  cardCapa: { padding: 16, paddingBottom: 18, minHeight: 138, justifyContent: 'flex-end' },
  cardAviao: { position: 'absolute', right: -10, bottom: -14, transform: [{ rotate: '-20deg' }] },
  cardCapaTopo: { position: 'absolute', top: 14, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  calendario: { backgroundColor: '#fff', borderRadius: 12, width: 46, alignItems: 'center', paddingVertical: 4 },
  calMes: { fontSize: 9, fontWeight: '900', color: T.primary, letterSpacing: 0.5 },
  calDia: { fontSize: 18, fontWeight: '900', color: T.ink, marginTop: -2 },
  selo: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  seloTxt: { fontSize: 11, fontWeight: '900' },
  cardDestino: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  cardTitulo: { color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 },
  cardRodape: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rodapeTxt: { fontSize: 14, fontWeight: '800', color: T.ink },
  rodapeSub: { fontSize: 12, color: T.muted, marginTop: 1 },
  seta: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.cream, alignItems: 'center', justifyContent: 'center' },
  vazio: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20, gap: 8 },
  vazioIcone: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  vazioTitulo: { fontSize: 18, fontWeight: '900', color: T.ink },
  vazioTxt: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 19 },
});
