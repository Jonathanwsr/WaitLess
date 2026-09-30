import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { O } from '../../constants/OwnerTheme';
import { mensagemAmigavel } from './Aviso';

// ---------------------------------------------------------------- API
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
// Exportado para as telas que precisam montar a própria chamada (ex.: upload multipart de fotos,
// que `api()` não cobre porque sempre serializa o corpo como JSON).
export const BASE = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '') + '/mobile';

export async function tokenDoUsuario() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

/** Chamada autenticada à API mobile (relativa a /api/mobile). Lança Error com a mensagem do servidor. */
export async function api(caminho: string, opcoes: { method?: string; body?: unknown } = {}) {
  const token = await tokenDoUsuario();
  const res = await fetch(`${BASE}${caminho}`, {
    method: opcoes.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // Sem JSON = resposta de proxy/servidor fora do ar (ex.: 502 do host), não erro de negócio.
    const padrao = res.status >= 500 || !json ? mensagemAmigavel({ status: res.status || 500 }) : 'Não foi possível concluir a operação.';
    const erro: any = new Error(json?.error || json?.erro || json?.message || padrao);
    erro.codigo = json?.codigo;
    erro.erros = json?.errors;
    erro.protocolo = json?.protocolo;
    erro.status = res.status;
    erro.premium = !!json?.premium_necessario;
    throw erro;
  }
  return json;
}

// ---------------------------------------------------------------- formatação
export const brl = (v: number | string | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dataCurta = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10).split('-').reverse().join('/');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

export const dataCompleta = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

// ---------------------------------------------------------------- barra inferior
const ABAS: { id: string; rotulo: string; icone: string; iconeAtivo: string; rota: string }[] = [
  { id: 'painel', rotulo: 'Painel', icone: 'grid-outline', iconeAtivo: 'grid', rota: '/Proprietario/dashboard' },
  { id: 'fila', rotulo: 'Fila', icone: 'list-outline', iconeAtivo: 'list', rota: '/src/funcionario/Painel-funcioanario?origem=socio' },
  { id: 'vitrine', rotulo: 'Vitrine', icone: 'storefront-outline', iconeAtivo: 'storefront', rota: '/Proprietario/vitrine' },
  { id: 'financeiro', rotulo: 'Carteira', icone: 'wallet-outline', iconeAtivo: 'wallet', rota: '/Proprietario/financeiro' },
  { id: 'mensagens', rotulo: 'Mensagens', icone: 'chatbubble-outline', iconeAtivo: 'chatbubble', rota: '/mensagens' },
  { id: 'menu', rotulo: 'Mais', icone: 'apps-outline', iconeAtivo: 'apps', rota: '/Proprietario/menu' },
];

const ABAS_FUNCIONARIO: typeof ABAS = [
  { id: 'fila', rotulo: 'Fila', icone: 'list-outline', iconeAtivo: 'list', rota: '/src/funcionario/Painel-funcioanario' },
  { id: 'agenda', rotulo: 'Agenda', icone: 'calendar-outline', iconeAtivo: 'calendar', rota: '/src/funcionario/AgendaEquipe' },
  { id: 'mensagens', rotulo: 'Mensagens', icone: 'chatbubble-outline', iconeAtivo: 'chatbubble', rota: '/mensagens' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'person-outline', iconeAtivo: 'person', rota: '/src/screens/TelaPerfil' },
];

export type Variante = 'socio' | 'funcionario';

export function OwnerTabBar({ ativo, variante = 'socio' }: { ativo?: string; variante?: Variante }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const abas = variante === 'funcionario' ? ABAS_FUNCIONARIO : ABAS;
  return (
    <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 10), height: 58 + Math.max(insets.bottom, 10) }]}>
      {abas.map((a) => {
        const on = a.id === ativo;
        return (
          <TouchableOpacity key={a.id} style={s.tabItem} onPress={() => !on && router.replace(a.rota as never)} activeOpacity={0.7}>
            <Ionicons name={(on ? a.iconeAtivo : a.icone) as any} size={23} color={on ? O.accent : O.faint} />
            <Text style={[s.tabLabel, on && { color: O.accent }]}>{a.rotulo}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- estrutura de tela
interface ScreenProps {
  titulo: string;
  subtitulo?: string;
  /** Saudação exibida no topo (ex.: nome do usuário), no lugar do título da tela. */
  saudacao?: string;
  onVoltar?: () => void;
  semVoltar?: boolean;
  direita?: React.ReactNode;
  aba?: string;
  variante?: Variante;
  carregando?: boolean;
  atualizando?: boolean;
  onAtualizar?: () => void;
  children?: React.ReactNode;
}

/** Sininho do painel do dono: avisos de estorno (contestações, decisões). */
export function SinoAvisos() {
  const router = useRouter();
  const [n, setN] = React.useState(0);

  useFocusEffect(React.useCallback(() => {
    api('/notificacoes/contagem').then((r: any) => setN(Number(r?.nao_lidas || 0))).catch(() => {});
  }, []));

  return (
    <TouchableOpacity style={s.backBtn} onPress={() => router.push('/src/screens/Notificacoes' as never)} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={20} color={O.ink} />
      {n > 0 && (
        <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: O.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{n > 9 ? '9+' : n}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function OwnerScreen({ titulo, subtitulo, saudacao, semVoltar, onVoltar, direita, aba, variante, carregando, atualizando, onAtualizar, children }: ScreenProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={O.canvas} />
      <View style={s.header}>
        {!semVoltar && (
          <TouchableOpacity style={s.backBtn} onPress={() => (onVoltar ? onVoltar() : router.canGoBack() ? router.back() : router.replace('/Proprietario/dashboard' as never))} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={O.ink} />
          </TouchableOpacity>
        )}
        {saudacao ? (
          <View style={{ flex: 1 }}>
            <Text style={s.saudacaoPeq}>Olá,</Text>
            <Text style={s.saudacao} numberOfLines={1}>{saudacao}</Text>
          </View>
        ) : <View style={{ flex: 1 }} />}
        {direita}
        {aba !== undefined && <SinoAvisos />}
      </View>

      {carregando ? (
        <View style={s.center}><ActivityIndicator size="large" color={O.accent} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
          refreshControl={onAtualizar ? <RefreshControl refreshing={!!atualizando} onRefresh={onAtualizar} tintColor={O.accent} /> : undefined}
        >
          {children}
        </ScrollView>
      )}
      {aba !== undefined && <OwnerTabBar ativo={aba} variante={variante} />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- blocos
type Tom = 'neutro' | 'positivo' | 'negativo' | 'alerta' | 'info';

const TONS: Record<Tom, [string, string]> = {
  neutro: [O.soft, O.ink],
  positivo: [O.successBg, O.success],
  negativo: [O.dangerBg, O.danger],
  alerta: [O.warningBg, O.warning],
  info: [O.infoBg, O.info],
};

export const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const Rotulo = ({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) => (
  <View style={s.rotuloRow}>
    <Text style={s.rotulo}>{children}</Text>
    {direita}
  </View>
);

export function Metrica({ rotulo, valor, icone, tom = 'neutro', largura }: {
  rotulo: string; valor: string | number; icone: string; tom?: Tom; largura?: number;
}) {
  const c = TONS[tom];
  return (
    <View style={[s.metrica, largura ? { width: largura } : { flex: 1 }]}>
      <View style={[s.metricaIcone, { backgroundColor: c[0] }]}>
        <Ionicons name={icone as any} size={18} color={c[1]} />
      </View>
      <Text style={s.metricaValor} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
      <Text style={s.metricaRotulo} numberOfLines={1}>{rotulo}</Text>
    </View>
  );
}

export function Pilula({ texto, tom = 'neutro' }: { texto: string; tom?: Tom }) {
  const c = tom === 'neutro' ? [O.soft, O.muted] : TONS[tom];
  return (
    <View style={[s.pilula, { backgroundColor: c[0] }]}>
      <Text style={[s.pilulaTxt, { color: c[1] }]}>{texto}</Text>
    </View>
  );
}

export function Segmentado({ opcoes, valor, aoMudar }: { opcoes: { id: string; rotulo: string }[]; valor: string; aoMudar: (id: string) => void }) {
  return (
    <View style={s.seg}>
      {opcoes.map((o) => (
        <TouchableOpacity key={o.id} style={[s.segItem, o.id === valor && s.segItemOn]} onPress={() => aoMudar(o.id)} activeOpacity={0.8}>
          <Text style={[s.segTxt, o.id === valor && s.segTxtOn]}>{o.rotulo}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Vazio({ icone, titulo, texto }: { icone: string; titulo: string; texto?: string }) {
  return (
    <View style={s.vazio}>
      <View style={s.vazioIcone}><Ionicons name={icone as any} size={26} color={O.faint} /></View>
      <Text style={s.vazioTitulo}>{titulo}</Text>
      {!!texto && <Text style={s.vazioTexto}>{texto}</Text>}
    </View>
  );
}

export function Erro({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <View style={s.vazio}>
      <View style={[s.vazioIcone, { backgroundColor: O.dangerBg, borderColor: '#FECACA' }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={O.danger} />
      </View>
      <Text style={s.vazioTitulo}>Algo deu errado</Text>
      <Text style={s.vazioTexto}>{mensagem}</Text>
      {aoTentar && (
        <TouchableOpacity style={s.btnPrimario} onPress={aoTentar} activeOpacity={0.85}>
          <Text style={s.btnPrimarioTxt}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function LinhaMenu({ icone, titulo, descricao, aoPressionar, badge, ultimo, bloqueado }: {
  icone: string; titulo: string; descricao?: string; aoPressionar: () => void; badge?: string | number; ultimo?: boolean;
  /** Recurso Premium que o usuário ainda não tem: mostra o selo com cadeado. */
  bloqueado?: boolean;
}) {
  return (
    <TouchableOpacity style={[s.linha, !ultimo && s.linhaBorda]} onPress={aoPressionar} activeOpacity={0.6}>
      <View style={s.linhaIcone}><Ionicons name={icone as any} size={19} color={O.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.linhaTitulo}>{titulo}</Text>
        {!!descricao && <Text style={s.linhaDesc} numberOfLines={1}>{descricao}</Text>}
      </View>
      {bloqueado && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
          <Ionicons name="lock-closed" size={10} color="#7A4A00" />
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#7A4A00' }}>PREMIUM</Text>
        </View>
      )}
      {badge !== undefined && badge !== 0 && <Pilula texto={String(badge)} tom="alerta" />}
      <Ionicons name="chevron-forward" size={16} color={O.faint} />
    </TouchableOpacity>
  );
}

export const estilos = {
  botaoPrimario: {
    backgroundColor: O.accent, height: 52, borderRadius: 26, alignItems: 'center' as const, justifyContent: 'center' as const,
    flexDirection: 'row' as const, gap: 8,
  },
  botaoPrimarioTxt: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 15 },
  campo: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: O.line, borderRadius: 16, paddingHorizontal: 16, minHeight: 50,
    fontSize: 15, color: O.ink,
  },
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: O.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  saudacaoPeq: { fontSize: 13, color: O.muted, fontWeight: '500' },
  saudacao: { fontSize: 22, fontWeight: '800', color: O.ink, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '800', color: O.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: O.muted, marginTop: 1, fontWeight: '500' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabBar: { flexDirection: 'row', backgroundColor: O.card, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: O.faint },

  card: { backgroundColor: O.card, borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  rotuloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  rotulo: { fontSize: 12, fontWeight: '700', color: O.muted, textTransform: 'uppercase', letterSpacing: 0.7 },

  metrica: { backgroundColor: O.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  metricaIcone: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricaValor: { fontSize: 22, fontWeight: '800', color: O.ink, letterSpacing: -0.5 },
  metricaRotulo: { fontSize: 12, color: O.muted, fontWeight: '500', marginTop: 2 },

  pilula: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  pilulaTxt: { fontSize: 11, fontWeight: '700' },

  seg: { flexDirection: 'row', backgroundColor: O.soft, borderRadius: 20, padding: 3, marginBottom: 14 },
  segItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 17 },
  segItemOn: { backgroundColor: O.card, shadowColor: '#282828', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTxt: { fontSize: 13, fontWeight: '600', color: O.muted },
  segTxtOn: { color: O.ink, fontWeight: '700' },

  vazio: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  vazioIcone: { width: 60, height: 60, borderRadius: 30, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 16, fontWeight: '700', color: O.ink },
  vazioTexto: { fontSize: 13, color: O.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  btnPrimario: { marginTop: 18, backgroundColor: O.accent, paddingHorizontal: 22, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btnPrimarioTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  linhaBorda: { borderBottomWidth: 1, borderBottomColor: '#F0F0F2' },
  linhaIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  linhaTitulo: { fontSize: 15, fontWeight: '600', color: O.ink },
  linhaDesc: { fontSize: 12, color: O.muted, marginTop: 2 },
});
