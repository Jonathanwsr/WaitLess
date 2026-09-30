import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const API_URL = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '') + '/mobile';

interface Comentario {
  id: number;
  nota: number;
  comentario: string | null;
  local_nome: string | null;
  ramo_atuacao: string | null;
  local_foto: string | null;
  servico_nome: string | null;
  total_fotos: number;
  publica: boolean;
  resposta: string | null;
  data_resposta: string | null;
  created_at: string;
}

const dataBR = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '');

export default function MeusComentarios() {
  const router = useRouter();
  const [lista, setLista] = useState<Comentario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [aba, setAba] = useState<'todos' | 'fotos' | 'sem_resposta'>('todos');
  const [ordemAntigos, setOrdemAntigos] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
      const res = await fetch(`${API_URL}/minhas-avaliacoes`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const json = await res.json();
      setLista(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      // lista vazia
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const contagem = {
    todos: lista.length,
    fotos: lista.filter((c) => c.total_fotos > 0).length,
    sem_resposta: lista.filter((c) => !c.resposta).length,
  };

  const filtrada = lista
    .filter((c) => (aba === 'fotos' ? c.total_fotos > 0 : aba === 'sem_resposta' ? !c.resposta : true))
    .sort((a, b) => (ordemAntigos ? 1 : -1) * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

  const ABAS = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'fotos', rotulo: 'Com fotos' },
    { id: 'sem_resposta', rotulo: 'Sem resposta' },
  ] as const;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={T.primary} />}
      >
        <HeaderCliente voltar tituloMenor titulo="Meus comentários" subtitulo="Acompanhe e gerencie suas avaliações." />

        <View style={s.abas}>
          {ABAS.map((a) => {
            const on = aba === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.aba, on && s.abaOn]} onPress={() => setAba(a.id)} activeOpacity={0.8}>
                <Text style={[s.abaTxt, on && s.abaTxtOn]}>{a.rotulo} ({contagem[a.id]})</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.ordem}>
          <Text style={s.ordemRotulo}>Ordenar por</Text>
          <TouchableOpacity style={s.ordemBtn} onPress={() => setOrdemAntigos(!ordemAntigos)} activeOpacity={0.8}>
            <Text style={s.ordemTxt}>{ordemAntigos ? 'Mais antigos' : 'Mais recentes'}</Text>
            <Ionicons name="swap-vertical" size={14} color={T.primary} />
          </TouchableOpacity>
        </View>

        {carregando ? (
          <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 50 }} />
        ) : filtrada.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="chatbubble-ellipses-outline" size={30} color={T.faint} /></View>
            <Text style={s.vazioTitulo}>Nenhum comentário</Text>
            <Text style={s.vazioTxt}>Depois de um atendimento concluído, você pode avaliar e ele aparece aqui.</Text>
            <TouchableOpacity style={s.btn} onPress={() => router.push('/src/screens/MeusAgendamentos' as never)} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Ver minhas reservas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {filtrada.map((c) => (
              <View key={c.id} style={s.card}>
                <View style={s.topo}>
                  <View style={s.foto}>
                    <Image source={{ uri: c.local_foto || 'https://via.placeholder.com/120' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <View style={s.tag}><Text style={s.tagTxt}>{c.servico_nome ? 'Serviço' : 'Reserva'}</Text></View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome} numberOfLines={1}>{c.local_nome || 'Estabelecimento'}</Text>
                    <Text style={s.sub} numberOfLines={1}>{[c.servico_nome, c.ramo_atuacao].filter(Boolean).join(' • ')}</Text>
                    <View style={s.estrelas}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Ionicons key={n} name={n <= Math.round(c.nota) ? 'star' : 'star-outline'} size={15} color={T.star} />
                      ))}
                      <Text style={s.notaTxt}>{c.nota.toFixed(1).replace('.', ',')}</Text>
                    </View>
                  </View>
                </View>

                {!!c.comentario && <Text style={s.comentario}>{c.comentario}</Text>}

                {c.resposta && (
                  <View style={s.resposta}>
                    <View style={s.respostaTopo}>
                      <Text style={s.respostaTitulo}>Resposta do estabelecimento</Text>
                      <Text style={s.respostaData}>{dataBR(c.data_resposta)}</Text>
                    </View>
                    <Text style={s.respostaTxt}>{c.resposta}</Text>
                  </View>
                )}

                <View style={s.rodape}>
                  <Text style={s.data}>Enviada em {dataBR(c.created_at)}</Text>
                  <Text style={[s.status, { color: c.resposta ? T.primary : T.success }]}>{c.resposta ? 'Respondida' : c.publica ? 'Publicada' : 'Em análise'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 25 : 0 },

  abas: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 8, borderBottomWidth: 1, borderBottomColor: T.line },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaOn: { borderBottomColor: T.primary },
  abaTxt: { fontSize: 13, fontWeight: '600', color: T.muted },
  abaTxtOn: { color: T.primary, fontWeight: '800' },

  ordem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginVertical: 14 },
  ordemRotulo: { fontSize: 13, color: T.muted },
  ordemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderWidth: 1, borderColor: T.line, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  ordemTxt: { fontSize: 12, fontWeight: '700', color: T.primary },

  card: { backgroundColor: T.card, borderRadius: 20, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  topo: { flexDirection: 'row', gap: 12 },
  foto: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: T.line },
  tag: { position: 'absolute', top: 5, left: 5, backgroundColor: T.tag, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  nome: { fontSize: 15, fontWeight: '800', color: T.ink },
  sub: { fontSize: 12, color: T.muted, marginTop: 2 },
  estrelas: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  notaTxt: { fontSize: 13, fontWeight: '700', color: T.ink, marginLeft: 6 },
  comentario: { fontSize: 14, color: T.ink, lineHeight: 21, marginTop: 12 },
  resposta: { backgroundColor: T.primarySoft, borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#F8D9C8' },
  respostaTopo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  respostaTitulo: { fontSize: 12, fontWeight: '800', color: T.primary },
  respostaData: { fontSize: 11, color: T.muted },
  respostaTxt: { fontSize: 13, color: T.ink, lineHeight: 19 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line },
  data: { fontSize: 11, color: T.muted },
  status: { fontSize: 12, fontWeight: '800' },

  vazio: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 32 },
  vazioIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 18, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 14, color: T.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  btn: { marginTop: 18, backgroundColor: T.primary, paddingHorizontal: 24, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
