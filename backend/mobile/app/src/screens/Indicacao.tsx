import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Share, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const API_URL = `${ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '')}/mobile`;
const SITE = ENV_URL.replace(/\/api(\/mobile)?\/?$/, '').replace(/\/+$/, '');

interface Resumo {
  codigo: string;
  pontos_por_indicacao: number;
  pontos_para_o_amigo: number;
  reais_por_indicacao: number;
  convidados: number;
  recompensadas: number;
  pontos_ganhos: number;
  ja_indicado: boolean;
  lista: { nome: string | null; status: 'pendente' | 'recompensada'; pontos: number }[];
}

const token = async () => (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));

export default function Indicacao() {
  const router = useRouter();
  const [dados, setDados] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [codigoAmigo, setCodigoAmigo] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/indicacao`, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } });
      const json = await res.json();
      if (res.ok) setDados(json);
    } catch {
      // o aviso de conexão já é mostrado pelo app
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const link = dados ? `${SITE}/register?ref=${dados.codigo}` : '';
  const mensagem = dados
    ? `Use meu código ${dados.codigo} no Lokyva e ganhe ${dados.pontos_para_o_amigo} pontos na sua primeira reserva. Baixe e agende sem fila: ${link}`
    : '';

  const compartilhar = async () => {
    try { await Share.share({ message: mensagem }); } catch { /* fechou */ }
  };

  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(mensagem)}`;
    const pode = await Linking.canOpenURL(url).catch(() => false);
    Linking.openURL(pode ? url : `https://wa.me/?text=${encodeURIComponent(mensagem)}`);
  };

  const copiar = async () => {
    if (!dados) return;
    await Clipboard.setStringAsync(dados.codigo);
    mostrarToast('Código copiado!', 'sucesso');
  };

  const aplicar = async () => {
    if (!codigoAmigo.trim()) return;
    setAplicando(true);
    try {
      const res = await fetch(`${API_URL}/indicacao/aplicar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ codigo: codigoAmigo.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertar('Não foi possível usar o código', json.error || json.message || 'Confira o código e tente de novo.');
      } else {
        alertar('Código aplicado!', json.message);
        setCodigoAmigo('');
        carregar();
      }
    } finally {
      setAplicando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <HeaderCliente titulo="Convide amigos" subtitulo="Vocês dois ganham pontos" voltar tituloMenor />

      {carregando ? (
        <View style={s.centro}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : !dados ? (
        <View style={s.centro}><Text style={s.vazio}>Não foi possível carregar agora. Puxe para atualizar.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} colors={[T.primary]} />}>
          <View style={s.hero}>
            <View style={s.heroIcone}><Ionicons name="gift-outline" size={26} color="#fff" /></View>
            <Text style={s.heroTitulo}>Ganhe R$ {dados.reais_por_indicacao.toFixed(0)} a cada amigo</Text>
            <Text style={s.heroTexto}>
              Quando seu amigo concluir a primeira reserva, você ganha {dados.pontos_por_indicacao} pontos e ele ganha {dados.pontos_para_o_amigo}. Pontos viram desconto nas reservas.
            </Text>
          </View>

          <View style={s.cartao}>
            <Text style={s.rotulo}>Seu código</Text>
            <TouchableOpacity style={s.codigoBox} onPress={copiar} activeOpacity={0.8}>
              <Text style={s.codigo}>{dados.codigo}</Text>
              <Ionicons name="copy-outline" size={20} color={T.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={s.btnPrim} onPress={compartilhar} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
              <Text style={s.btnPrimTxt}>Convidar amigos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSec} onPress={whatsapp} activeOpacity={0.8}>
              <Ionicons name="logo-whatsapp" size={20} color="#12A150" />
              <Text style={s.btnSecTxt}>Enviar pelo WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <View style={s.grade}>
            <View style={s.metrica}><Text style={s.metricaNum}>{dados.convidados}</Text><Text style={s.metricaRotulo}>Convidados</Text></View>
            <View style={s.metrica}><Text style={s.metricaNum}>{dados.recompensadas}</Text><Text style={s.metricaRotulo}>Já reservaram</Text></View>
            <View style={s.metrica}><Text style={[s.metricaNum, { color: T.success }]}>{dados.pontos_ganhos}</Text><Text style={s.metricaRotulo}>Pontos ganhos</Text></View>
          </View>

          {dados.lista.length > 0 && (
            <View style={s.cartao}>
              <Text style={s.rotulo}>Seus convidados</Text>
              {dados.lista.map((i, idx) => (
                <View key={`${i.nome}-${idx}`} style={[s.linha, idx < dados.lista.length - 1 && s.linhaBorda]}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{(i.nome || '?').charAt(0).toUpperCase()}</Text></View>
                  <Text style={s.nome} numberOfLines={1}>{i.nome || 'Amigo'}</Text>
                  {i.status === 'recompensada'
                    ? <Text style={s.ganho}>+{i.pontos} pts</Text>
                    : <Text style={s.aguardando}>Aguardando 1ª reserva</Text>}
                </View>
              ))}
            </View>
          )}

          {!dados.ja_indicado && (
            <View style={s.cartao}>
              <Text style={s.rotulo}>Um amigo te convidou?</Text>
              <Text style={s.texto}>Informe o código dele antes da sua primeira reserva. Os dois ganham pontos.</Text>
              <View style={s.aplicarLinha}>
                <TextInput
                  style={s.input}
                  value={codigoAmigo}
                  onChangeText={(t) => setCodigoAmigo(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  autoCapitalize="characters"
                  placeholder="Código do amigo"
                  placeholderTextColor={T.faint}
                  maxLength={12}
                />
                <TouchableOpacity style={[s.btnAplicar, (!codigoAmigo || aplicando) && { opacity: 0.5 }]} disabled={!codigoAmigo || aplicando} onPress={aplicar} activeOpacity={0.85}>
                  {aplicando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimTxt}>Usar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={s.regras}>Os pontos são liberados quando o atendimento do amigo é concluído. Contas duplicadas e uso indevido não recebem os pontos.</Text>

          <TouchableOpacity style={s.link} onPress={() => router.push('/src/screens/MeusPontos' as never)} activeOpacity={0.7}>
            <Text style={s.linkTxt}>Ver meus pontos</Text>
            <Ionicons name="chevron-forward" size={16} color={T.primary} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  vazio: { color: T.muted, textAlign: 'center' },
  scroll: { padding: 20, paddingTop: 6, paddingBottom: 50, gap: 14 },

  hero: { backgroundColor: T.primary, borderRadius: 28, padding: 22 },
  heroIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitulo: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  heroTexto: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 21, marginTop: 8 },

  cartao: { backgroundColor: T.card, borderRadius: 24, padding: 18, ...sombra },
  rotulo: { fontSize: 12, fontWeight: '800', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  codigoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.primarySoft, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16 },
  codigo: { fontSize: 28, fontWeight: '800', color: T.primary, letterSpacing: 4 },
  btnPrim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: T.primary, marginTop: 14 },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: '#F0F0F2', marginTop: 10 },
  btnSecTxt: { color: T.ink, fontWeight: '700', fontSize: 14 },

  grade: { flexDirection: 'row', gap: 10 },
  metrica: { flex: 1, backgroundColor: T.card, borderRadius: 20, paddingVertical: 16, alignItems: 'center', ...sombra },
  metricaNum: { fontSize: 24, fontWeight: '800', color: T.ink },
  metricaRotulo: { fontSize: 11, color: T.muted, marginTop: 2, fontWeight: '600' },

  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  linhaBorda: { borderBottomWidth: 1, borderBottomColor: '#F0F0F2' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: T.primary },
  nome: { flex: 1, fontSize: 14, fontWeight: '700', color: T.ink },
  ganho: { fontSize: 13, fontWeight: '800', color: T.success },
  aguardando: { fontSize: 11, color: T.muted, fontWeight: '600' },

  texto: { fontSize: 13, color: T.muted, lineHeight: 19, marginBottom: 12 },
  aplicarLinha: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: T.line, paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: T.ink, backgroundColor: '#fff', letterSpacing: 2 },
  btnAplicar: { height: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },

  regras: { fontSize: 12, color: T.faint, textAlign: 'center', lineHeight: 18 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  linkTxt: { color: T.primary, fontWeight: '800', fontSize: 14 },
});
