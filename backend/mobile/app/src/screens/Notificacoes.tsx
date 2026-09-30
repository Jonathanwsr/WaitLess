import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { T } from '../../../constants/ClientTheme';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const API = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '') + '/mobile';

type Aviso = { id: number; tipo: string; titulo: string; mensagem: string; lida: boolean; estorno_id: number | null; criado_em: string };

const quando = (v: string) => {
  const d = new Date(v);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const icone = (titulo: string): { nome: keyof typeof Ionicons.glyphMap; cor: string; bg: string } => {
  const t = titulo.toLowerCase();
  if (t.includes('aprovado') && !t.includes('não')) return { nome: 'checkmark-circle', cor: T.success, bg: T.successBg };
  if (t.includes('não aprovado') || t.includes('reprovado')) return { nome: 'close-circle', cor: T.danger, bg: '#FEE2E2' };
  if (t.includes('análise')) return { nome: 'time', cor: '#D97706', bg: '#FEF3C7' };
  return { nome: 'return-up-back', cor: T.primary, bg: T.primarySoft };
};

/** Sininho: avisos sobre estornos (pedido enviado, em análise, aprovado, reprovado). */
export default function Notificacoes() {
  const router = useRouter();
  const [lista, setLista] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cabecalho = useCallback(async () => {
    const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
    return { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/notificacoes`, { headers: await cabecalho() });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error();
      setLista(Array.isArray(j?.data) ? j.data : []);
      setErro(null);
    } catch {
      setErro('Não conseguimos carregar seus avisos agora. Puxe para atualizar.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [cabecalho]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const marcarTodas = async () => {
    setLista((l) => l.map((n) => ({ ...n, lida: true })));
    fetch(`${API}/notificacoes/lidas`, { method: 'POST', headers: await cabecalho() }).catch(() => {});
  };

  const abrir = async (n: Aviso) => {
    if (!n.lida) {
      setLista((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      fetch(`${API}/notificacoes/${n.id}/lida`, { method: 'POST', headers: await cabecalho() }).catch(() => {});
    }
    // Cliente vai para "Meus estornos"; dono do local para a tela de estornos do painel.
    let rota = '/src/screens/MeusEstornosScreen';
    try {
      const salvo = await SecureStore.getItemAsync('userData');
      const papel = salvo ? String(JSON.parse(salvo).papel || '').toLowerCase() : '';
      if (['socio', 'proprietario', 'gerente'].includes(papel)) rota = '/Proprietario/estornos';
    } catch { /* usa a rota do cliente */ }
    router.push(rota as never);
  };

  const naoLidas = lista.filter((n) => !n.lida).length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.topo}>
        <TouchableOpacity style={s.voltar} onPress={() => router.back()} activeOpacity={0.7}><Ionicons name="chevron-back" size={22} color={T.ink} /></TouchableOpacity>
        <View>
          <Text style={s.topoTitulo}>Avisos</Text>
          <Text style={s.topoSub}>{naoLidas ? `${naoLidas} ${naoLidas === 1 ? 'novo' : 'novos'}` : 'Tudo em dia'}</Text>
        </View>
      </View>

      {carregando ? (
        <View style={s.centro}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={s.lista}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={T.primary} />}
          ListHeaderComponent={naoLidas > 0 ? <TouchableOpacity onPress={marcarTodas} style={s.marcar}><Text style={s.marcarTxt}>Marcar todos como lidos</Text></TouchableOpacity> : null}
          ListEmptyComponent={
            <View style={s.vazio}>
              <Ionicons name="notifications-off-outline" size={44} color={T.faint} />
              <Text style={s.vazioTitulo}>{erro ? 'Algo deu errado' : 'Nenhum aviso por aqui'}</Text>
              <Text style={s.vazioTxt}>{erro || 'Quando houver novidades sobre seus estornos, elas aparecem aqui.'}</Text>
            </View>
          }
          renderItem={({ item: n }) => {
            const ic = icone(n.titulo);
            return (
              <TouchableOpacity style={[s.card, !n.lida && s.cardNovo]} activeOpacity={0.85} onPress={() => abrir(n)}>
                <View style={[s.icone, { backgroundColor: ic.bg }]}><Ionicons name={ic.nome} size={22} color={ic.cor} /></View>
                <View style={{ flex: 1 }}>
                  <View style={s.linha}>
                    <Text style={[s.titulo, !n.lida && { color: T.ink }]} numberOfLines={1}>{n.titulo}</Text>
                    <Text style={s.quando}>{quando(n.criado_em)}</Text>
                  </View>
                  <Text style={s.msg}>{n.mensagem}</Text>
                </View>
                {!n.lida && <View style={s.ponto} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topoTitulo: { fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.6 },
  topoSub: { fontSize: 12, color: T.muted },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: 20, paddingTop: 6, gap: 10, flexGrow: 1 },
  marcar: { alignSelf: 'flex-end', paddingVertical: 4, marginBottom: 4 },
  marcarTxt: { fontSize: 13, fontWeight: '800', color: T.primary },
  card: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardNovo: { borderColor: '#F8D9C8', backgroundColor: '#FFFBF8' },
  icone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700', color: T.muted },
  quando: { fontSize: 11, color: T.faint },
  msg: { fontSize: 13, color: T.muted, marginTop: 3, lineHeight: 18 },
  ponto: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.primary, marginTop: 4 },
  vazio: { alignItems: 'center', padding: 40, gap: 8, marginTop: 40 },
  vazioTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 19 },
});
