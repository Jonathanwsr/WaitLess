import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, StatusBar, Platform, Linking, LayoutAnimation, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { apiRoteiro, CATEGORIAS, Guia } from '../../../services/roteirosApi';
import { pedirLocalizacao } from '../../../services/localizacaoOpcional';
import CartaoLocacao from '../../../components/viagem/roteiro/CartaoLocacao';
import MapaDia from '../../../components/viagem/roteiro/MapaDia';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

const TOPO = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;
const SUGESTOES = ['Recife', 'Olinda', 'Porto de Galinhas', 'Gramado', 'Salvador'];
const ICONES: Record<string, string> = {
  'Sobre o destino': '🧭', 'Como chegar': '✈️', 'Como circular': '🚌', 'O que ver': '👀', 'O que fazer': '🎒',
  'Onde comer': '🍽️', 'Onde beber': '🍹', 'Onde dormir': '🛏️', Segurança: '🛡️',
};

export default function GuiaLocal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ termo?: string }>();
  const [termo, setTermo] = useState(params.termo ? String(params.termo) : '');
  const [dados, setDados] = useState<Guia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [secao, setSecao] = useState<number | null>(0);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descricaoAberta, setDescricaoAberta] = useState(false);

  const buscar = async (q: Record<string, string | number>) => {
    setCarregando(true);
    setErro(null);
    const r = await apiRoteiro<Guia>(`/guia-local?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}`);
    setCarregando(false);
    if (!r.ok) { setDados(null); setErro(r.erro); return; }
    setDados(r.dados);
    setSecao(0);
    setDescricaoAberta(false);
    setCategoria(Object.keys(r.dados.locacoes_proximas || {})[0] || null);
  };

  useEffect(() => { if (params.termo) buscar({ termo: String(params.termo) }); }, []);

  const pertoDeMim = async () => {
    const p = await pedirLocalizacao('Mostramos o que há por perto de onde você está agora.');
    if (p) { setTermo(''); buscar({ lat: p.lat, lng: p.lng }); }
  };

  const local = dados?.local;
  const categorias = Object.entries(dados?.locacoes_proximas || {});
  const abrir = (tipo: string, id: number) => router.push({ pathname: '/src/screens/ExplorarDetalhes' as never, params: tipo === 'servico' ? { id: String(id) } : { id: String(id), tipo: 'reservas' } } as never);
  const alternar = (fn: () => void) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); fn(); };

  return (
    <View style={s.tela}>
      <StatusBar barStyle="light-content" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
        <LinearGradient colors={['#1F1A17', '#3A2414', '#7C2D12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.voltar} accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.heroRotulo}>Guia do Local</Text>
          <Text style={s.heroTitulo}>Conheça o destino{'\n'}antes de chegar</Text>
          <View style={s.busca}>
            <Ionicons name="search" size={18} color={T.faint} />
            <TextInput style={s.buscaInput} value={termo} onChangeText={setTermo} placeholder="Cidade ou ponto turístico" placeholderTextColor={T.faint} returnKeyType="search" maxLength={120}
              onSubmitEditing={() => termo.trim().length >= 2 && buscar({ termo: termo.trim() })} accessibilityLabel="Cidade ou ponto turístico" />
            <TouchableOpacity style={[s.buscaBtn, termo.trim().length < 2 && { opacity: 0.5 }]} disabled={termo.trim().length < 2 || carregando} onPress={() => buscar({ termo: termo.trim() })}>
              <Text style={s.buscaBtnTxt}>Buscar</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.perto} onPress={pertoDeMim} activeOpacity={0.85} accessibilityRole="button">
            <Ionicons name="navigate" size={16} color="#fff" /><Text style={s.pertoTxt}>Perto de mim</Text>
          </TouchableOpacity>
          {!dados && !carregando && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 14 }}>
              {SUGESTOES.map((x) => (
                <TouchableOpacity key={x} style={s.chip} onPress={() => { setTermo(x); buscar({ termo: x }); }}><Text style={s.chipTxt}>{x}</Text></TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </LinearGradient>

        <View style={s.corpo}>
          {!!erro && <View style={s.erro}><Ionicons name="alert-circle" size={18} color="#B45309" /><Text style={s.erroTxt}>{erro}</Text></View>}

          {carregando && (
            <View style={{ gap: 12 }} accessibilityLabel="Carregando o guia">
              <View style={[s.esqueleto, { height: 220 }]} />
              <View style={[s.esqueleto, { height: 90 }]} />
              <View style={{ flexDirection: 'row', gap: 10 }}><View style={[s.esqueleto, { height: 160, flex: 1 }]} /><View style={[s.esqueleto, { height: 160, flex: 1 }]} /></View>
            </View>
          )}

          {!carregando && dados && (
            <>
              {!!dados.mensagem && <View style={s.info}><Text style={s.infoTxt}>{dados.mensagem}</Text></View>}

              {local && (
                <View style={s.capa}>
                  <View style={s.capaFoto}>
                    {local.imagem ? <Image source={{ uri: local.imagem }} style={StyleSheet.absoluteFill} accessibilityLabel={`Foto de ${local.titulo}`} /> : null}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
                    <View style={s.capaTexto}>
                      <Text style={s.capaTitulo}>{local.titulo}</Text>
                      {!!local.subtitulo && <Text style={s.capaSub}>{local.subtitulo}</Text>}
                    </View>
                  </View>
                  <View style={{ padding: 16 }}>
                    <Text style={s.descricao} numberOfLines={descricaoAberta ? undefined : 6}>{local.descricao}</Text>
                    {(local.descricao?.length || 0) > 300 && (
                      <TouchableOpacity onPress={() => alternar(() => setDescricaoAberta((a) => !a))} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text style={s.link}>{descricaoAberta ? 'Mostrar menos' : 'Ler mais'}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={s.dados}>
                      {!!local.dados?.populacao && <Dado icone="people" rotulo="População" valor={Number(local.dados.populacao).toLocaleString('pt-BR')} />}
                      {!!local.dados?.area_km2 && <Dado icone="resize" rotulo="Área" valor={`${Number(local.dados.area_km2).toLocaleString('pt-BR')} km²`} />}
                      {local.dados?.altitude_m != null && <Dado icone="trending-up" rotulo="Altitude" valor={`${local.dados.altitude_m} m`} />}
                      {!!local.dados?.estado && <Dado icone="map" rotulo="Fica em" valor={local.dados.estado} />}
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push({ pathname: '/src/screens/RoteiroEditar' as never, params: { destino: local?.titulo || termo } } as never)}>
                <LinearGradient colors={['#FF9A3D', '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                  <View style={s.ctaIcone}><Ionicons name="sparkles" size={20} color={T.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ctaTitulo}>Montar roteiro para {local?.titulo || termo || 'cá'}</Text>
                    <Text style={s.ctaSub}>Pontos turísticos + Lokyva, dia a dia</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {!!local?.infos_uteis?.length && (
                <>
                  <Text style={s.secao}>Informações úteis</Text>
                  <View style={s.acordeao}>
                    {local.infos_uteis.map((x, i) => (
                      <View key={x.secao} style={i > 0 ? s.divisor : undefined}>
                        <TouchableOpacity style={s.acordeaoTopo} onPress={() => alternar(() => setSecao(secao === i ? null : i))} accessibilityRole="button" accessibilityState={{ expanded: secao === i }}>
                          <Text style={{ fontSize: 18 }}>{ICONES[x.secao] || '📌'}</Text>
                          <Text style={s.acordeaoTitulo}>{x.secao}</Text>
                          <Ionicons name={secao === i ? 'chevron-up' : 'chevron-down'} size={18} color={T.muted} />
                        </TouchableOpacity>
                        {secao === i && <Text style={s.acordeaoTxt}>{x.texto}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {dados.pontos_turisticos.length > 0 && (
                <>
                  <Text style={s.secao}>Pontos turísticos próximos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                    {dados.pontos_turisticos.map((p) => (
                      <View key={p.titulo} style={s.ponto}>
                        <View style={s.pontoFoto}>
                          {p.imagem ? <Image source={{ uri: p.imagem }} style={StyleSheet.absoluteFill} accessibilityLabel={p.titulo} /> : <Ionicons name="location" size={30} color={T.faint} />}
                          <View style={s.distancia}><Text style={s.distanciaTxt}>{String(p.distancia_km).replace('.', ',')} km</Text></View>
                        </View>
                        <View style={{ padding: 10 }}>
                          <Text style={s.pontoTitulo} numberOfLines={2}>{p.titulo}</Text>
                          {!!p.resumo && <Text style={s.pontoResumo} numberOfLines={3}>{p.resumo}</Text>}
                          <Text style={s.horario}>🕑 {p.aviso_horario}</Text>
                          <TouchableOpacity onPress={() => Linking.openURL(p.link)} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={s.link}>Ver na Wikipédia ↗</Text></TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={{ marginTop: 12 }}>
                    <MapaDia pontos={dados.pontos_turisticos.slice(0, 12).map((p, i) => ({ numero: i + 1, titulo: p.titulo, latitude: p.coordenadas.lat, longitude: p.coordenadas.lng, tipo: 'ponto_turistico' }))} centro={dados.centro} ligar={false} />
                  </View>
                </>
              )}

              <Text style={s.secao}>No Lokyva, por perto</Text>
              <Text style={s.secaoSub}>Até {dados.raio_km} km. Parceiros Premium e quem aceita pontos aparecem primeiro.</Text>
              {categorias.length === 0 ? (
                <View style={s.vazio}><Text style={s.vazioTxt}>Ainda não há locações do Lokyva nesse raio.</Text></View>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
                    {categorias.map(([cat, g]) => {
                      const on = categoria === cat;
                      const meta = CATEGORIAS[cat] || CATEGORIAS.servicos;
                      return (
                        <TouchableOpacity key={cat} style={[s.catChip, on && s.catChipOn]} onPress={() => setCategoria(cat)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                          <Ionicons name={meta.icone as any} size={15} color={on ? '#fff' : T.muted} />
                          <Text style={[s.catChipTxt, on && { color: '#fff' }]}>{g.rotulo} · {g.itens.length}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16, paddingBottom: 6 }}>
                    {(dados.locacoes_proximas[categoria || '']?.itens || []).map((l) => (
                      <CartaoLocacao key={l.chave} l={l} acao="Reservar" onAcao={() => abrir(l.tipo, l.id)} />
                    ))}
                  </ScrollView>
                </>
              )}

              {local && (
                <TouchableOpacity onPress={() => Linking.openURL(local.link)} style={s.fonte}>
                  <Text style={s.fonteTxt}>Fonte: {local.fonte}. Toque para abrir a página original.</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Dado({ icone, rotulo, valor }: { icone: string; rotulo: string; valor: string }) {
  return (
    <View style={s.dado}>
      <Ionicons name={icone as any} size={16} color={T.primary} />
      <Text style={s.dadoRotulo}>{rotulo}</Text>
      <Text style={s.dadoValor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

const sombra = { shadowColor: '#1F1A17', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 };

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: T.cream },
  hero: { paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroRotulo: { color: '#FDBA74', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16 },
  heroTitulo: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.7, lineHeight: 33, marginTop: 4 },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 18, paddingLeft: 14, padding: 6, marginTop: 16 },
  buscaInput: { flex: 1, fontSize: 15, color: T.ink, paddingVertical: 8 },
  buscaBtn: { backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  buscaBtnTxt: { color: '#fff', fontWeight: '900' },
  perto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginTop: 10 },
  pertoTxt: { color: '#fff', fontWeight: '800' },
  chip: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  chipTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  corpo: { padding: 16, gap: 12 },
  erro: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 16, padding: 12 },
  erroTxt: { flex: 1, color: '#92400E', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  info: { backgroundColor: '#E0F2FE', borderRadius: 16, padding: 12 },
  infoTxt: { color: '#075985', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  esqueleto: { backgroundColor: '#E7E5E4', borderRadius: 20 },
  capa: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', ...sombra },
  capaFoto: { height: 230, backgroundColor: '#D6D3D1', justifyContent: 'flex-end' },
  capaTexto: { padding: 16 },
  capaTitulo: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  capaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textTransform: 'capitalize' },
  descricao: { fontSize: 14, color: '#44403C', lineHeight: 21 },
  link: { color: '#E8590C', fontWeight: '900', fontSize: 13 },
  dados: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dado: { width: '48%', backgroundColor: T.cream, borderRadius: 14, padding: 10 },
  dadoRotulo: { fontSize: 10, fontWeight: '800', color: T.faint, textTransform: 'uppercase', marginTop: 4 },
  dadoValor: { fontSize: 14, fontWeight: '900', color: T.ink },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 14 },
  ctaIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ctaTitulo: { color: '#fff', fontWeight: '900', fontSize: 15 },
  ctaSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  secao: { fontSize: 19, fontWeight: '900', color: T.ink, letterSpacing: -0.3, marginTop: 8 },
  secaoSub: { fontSize: 12, color: T.muted, marginTop: -6 },
  acordeao: { backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', ...sombra },
  divisor: { borderTopWidth: 1, borderTopColor: T.line },
  acordeaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 54 },
  acordeaoTitulo: { flex: 1, fontSize: 15, fontWeight: '800', color: T.ink },
  acordeaoTxt: { fontSize: 13, color: T.muted, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  ponto: { width: 220, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', ...sombra },
  pontoFoto: { height: 130, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  distancia: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  distanciaTxt: { fontSize: 11, fontWeight: '800', color: T.ink },
  pontoTitulo: { fontSize: 14, fontWeight: '900', color: T.ink },
  pontoResumo: { fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 16 },
  horario: { fontSize: 11, color: '#B45309', fontWeight: '700', marginTop: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: T.line },
  catChipOn: { backgroundColor: T.ink, borderColor: T.ink },
  catChipTxt: { fontSize: 13, fontWeight: '800', color: T.muted },
  vazio: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  vazioTxt: { color: T.muted, fontSize: 13, textAlign: 'center' },
  fonte: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginTop: 6 },
  fonteTxt: { fontSize: 11, color: T.muted },
});
