import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, StatusBar, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { apiRoteiro, distanciaKm, ItemRoteiro, minutos } from '../../../services/roteirosApi';
import { brl, dia } from '../../../services/viagensApi';
import { pedirLocalizacao } from '../../../services/localizacaoOpcional';

const TOPO = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

type Resumo = { id: number; titulo: string; destino: string; estado: string | null; data_inicio: string; data_fim: string; dias: number; pessoas: number; itens: number; locacoes: number; compartilhado: boolean; capa: string | null };
type Hoje = { roteiro: { id: number; titulo: string }; dia: { numero: number; custo: number } | null; proximo: ItemRoteiro | null } | null;

export default function MeusRoteiros() {
  const router = useRouter();
  const [roteiros, setRoteiros] = useState<Resumo[]>([]);
  const [hoje, setHoje] = useState<Hoje>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const [lista, h] = await Promise.all([apiRoteiro<{ roteiros: Resumo[] }>('/roteiros'), apiRoteiro<{ hoje: Hoje }>('/roteiros/hoje')]);
    if (lista.ok) { setRoteiros(lista.dados.roteiros); setErro(null); } else setErro(lista.erro);
    if (h.ok) setHoje(h.dados.hoje);
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const medir = async () => {
    const p = await pedirLocalizacao('Calculamos a distância até o próximo item do seu roteiro.');
    const prox = hoje?.proximo;
    if (p && prox?.latitude != null) setDistancia(distanciaKm(p, { lat: Number(prox.latitude), lng: Number(prox.longitude) }));
  };

  const abrir = (id?: number) => router.push({ pathname: '/src/screens/RoteiroEditar' as never, params: id ? { id: String(id) } : {} } as never);

  return (
    <View style={s.tela}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor="#fff" />}>
        <LinearGradient colors={['#FF9A3D', '#FF7A00', '#E8590C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.voltar} accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.heroTitulo}>Meus roteiros</Text>
          <Text style={s.heroSub}>Pontos turísticos e o melhor do Lokyva, organizados dia a dia.</Text>
          <TouchableOpacity style={s.novo} onPress={() => abrir()} activeOpacity={0.9} accessibilityRole="button">
            <Ionicons name="add-circle" size={20} color={T.primary} /><Text style={s.novoTxt}>Novo roteiro</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={s.corpo}>
          {!!erro && <View style={s.erro}><Text style={s.erroTxt}>{erro}</Text></View>}

          {hoje && (
            <View style={s.hoje}>
              <Text style={s.hojeRotulo}>HOJE · DIA {hoje.dia?.numero} · {hoje.roteiro.titulo.toUpperCase()}</Text>
              {hoje.proximo ? (
                <>
                  <Text style={s.hojeSub}>Próximo da agenda{hoje.proximo.hora ? ` às ${hoje.proximo.hora}` : ''}</Text>
                  <Text style={s.hojeTitulo}>{hoje.proximo.titulo}</Text>
                  {!!hoje.proximo.aviso_horario && <Text style={s.hojeAviso}>🕑 {hoje.proximo.aviso_horario}</Text>}
                  {distancia != null && <Text style={s.hojeDist}>Você está a {distancia.toFixed(1).replace('.', ',')} km · cerca de {minutos(distancia)} min</Text>}
                  <View style={s.hojeBotoes}>
                    {hoje.proximo.latitude != null && distancia == null && (
                      <TouchableOpacity style={s.hojeBtn} onPress={medir}><Text style={s.hojeBtnTxt}>Ver distância</Text></TouchableOpacity>
                    )}
                    {hoje.proximo.latitude != null && (
                      <TouchableOpacity style={[s.hojeBtn, { backgroundColor: T.primary }]} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${hoje.proximo!.latitude},${hoje.proximo!.longitude}`)}>
                        <Text style={s.hojeBtnTxt}>Como chegar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : <Text style={s.hojeTitulo}>Tudo feito por hoje. Bom descanso!</Text>}
              <TouchableOpacity onPress={() => abrir(hoje.roteiro.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={s.hojeLink}>Ver o dia completo · {brl(hoje.dia?.custo || 0)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {carregando && [0, 1].map((i) => <View key={i} style={s.esqueleto} />)}

          {!carregando && roteiros.length === 0 && !erro && (
            <View style={s.vazio}>
              <View style={s.vazioIcone}><Ionicons name="map" size={34} color={T.primary} /></View>
              <Text style={s.vazioTitulo}>Nenhum roteiro ainda</Text>
              <Text style={s.vazioTxt}>Diga o destino e as datas: sugerimos o que ver, onde comer e onde ficar, dia a dia.</Text>
              <TouchableOpacity style={s.vazioBtn} onPress={() => router.push('/src/screens/GuiaLocal' as never)}><Text style={s.vazioBtnTxt}>Explorar o Guia do Local</Text></TouchableOpacity>
            </View>
          )}

          {roteiros.map((r) => (
            <TouchableOpacity key={r.id} style={s.card} activeOpacity={0.9} onPress={() => abrir(r.id)} accessibilityRole="button">
              <View style={s.cardCapa}>
                {r.capa ? <Image source={{ uri: r.capa }} style={StyleSheet.absoluteFill} /> : <LinearGradient colors={['#FF9A3D', '#7C2D12']} style={StyleSheet.absoluteFill} />}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
                {r.compartilhado && <View style={s.compartilhado}><Ionicons name="share-social" size={11} color={T.ink} /><Text style={s.compartilhadoTxt}>Compartilhado</Text></View>}
                <View style={{ padding: 14 }}>
                  <Text style={s.cardDestino}>📍 {r.destino}{r.estado ? ` · ${r.estado}` : ''}</Text>
                  <Text style={s.cardTitulo} numberOfLines={1}>{r.titulo}</Text>
                </View>
              </View>
              <View style={s.cardRodape}>
                <Text style={s.cardMeta}>{dia(r.data_inicio)} – {dia(r.data_fim)} · {r.dias} {r.dias === 1 ? 'dia' : 'dias'}</Text>
                <Text style={s.cardMeta}>{r.pessoas} 👤 · {r.itens} itens · {r.locacoes} no Lokyva</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const sombra = { shadowColor: '#1F1A17', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 };

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: T.cream },
  hero: { paddingHorizontal: 18, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitulo: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 14 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 4, lineHeight: 19 },
  novo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 18, minHeight: 52, marginTop: 16 },
  novoTxt: { color: T.ink, fontWeight: '900', fontSize: 15 },
  corpo: { padding: 16, gap: 14 },
  erro: { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 12 },
  erroTxt: { color: '#B91C1C', fontWeight: '700' },
  hoje: { backgroundColor: T.ink, borderRadius: 24, padding: 18 },
  hojeRotulo: { color: '#FDBA74', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  hojeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  hojeTitulo: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 2 },
  hojeAviso: { color: '#FCD34D', fontSize: 12, fontWeight: '700', marginTop: 4 },
  hojeDist: { color: '#6EE7B7', fontSize: 15, fontWeight: '900', marginTop: 8 },
  hojeBotoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hojeBtn: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  hojeBtnTxt: { color: '#fff', fontWeight: '900' },
  hojeLink: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  esqueleto: { height: 190, borderRadius: 24, backgroundColor: '#E7E5E4' },
  vazio: { alignItems: 'center', padding: 24, gap: 6 },
  vazioIcone: { width: 76, height: 76, borderRadius: 38, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  vazioTitulo: { fontSize: 18, fontWeight: '900', color: T.ink, marginTop: 6 },
  vazioTxt: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 19 },
  vazioBtn: { minHeight: 46, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', borderWidth: 1, borderColor: T.line, marginTop: 8 },
  vazioBtnTxt: { color: T.ink, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', ...sombra },
  cardCapa: { height: 140, justifyContent: 'flex-end', backgroundColor: '#E7E5E4' },
  compartilhado: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  compartilhadoTxt: { fontSize: 10, fontWeight: '800', color: T.ink },
  cardDestino: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  cardTitulo: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  cardRodape: { padding: 14, gap: 2 },
  cardMeta: { fontSize: 13, color: T.muted, fontWeight: '600' },
});
