import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Vazio, Erro, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';

interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil: string | null;
  avaliacao_media: number;
  arrecadacao_total: number;
  ativo: boolean;
  fila_agora: number;
  funcionarios_count: number;
}

interface DashboardData {
  estabelecimentos: Estabelecimento[];
  metricas: { total_fila: number; total_arrecadado: number; ativos: number };
  financeiro?: { carteira_configurada: boolean; saldo_disponivel: number; receita_30_dias: number };
  onboarding?: { locais: number; servicos: number; reservas: number };
  premium?: boolean;
}

const ATALHOS = [
  { icone: 'megaphone-outline', rotulo: 'Divulgar', rota: '/Proprietario/divulgar' },
  { icone: 'school-outline', rotulo: 'Tutoriais', rota: '/Proprietario/tutorial' },
  { icone: 'storefront-outline', rotulo: 'Vitrine', rota: '/Proprietario/vitrine' },
  { icone: 'list-outline', rotulo: 'Fila', rota: 'local:/src/funcionario/Painel-funcioanario?origem=socio&estabelecimento_id=' },
  { icone: 'calendar-outline', rotulo: 'Agenda', rota: 'local:/src/funcionario/AgendaEquipe?estabelecimento_id=' },
  { icone: 'people-outline', rotulo: 'Equipe', rota: 'local:/Proprietario/FuncionariosScreen?id=' },
  { icone: 'person-outline', rotulo: 'Clientes', rota: '/Proprietario/clientes' },
  { icone: 'star-outline', rotulo: 'Avaliações', rota: '/Proprietario/avaliacoes' },
  { icone: 'return-up-back-outline', rotulo: 'Estornos', rota: '/Proprietario/estornos' },
  { icone: 'navigate-outline', rotulo: 'Rastreio', rota: '/Proprietario/MapaRastreamento', premium: true },
  { icone: 'document-text-outline', rotulo: 'Contratos', rota: '/Proprietario/contratos', premium: true },
  { icone: 'key-outline', rotulo: 'Locações', rota: '/Proprietario/LocacoesAvulsas' },
];

export default function ProprietarioDashboard() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<DashboardData>(() => api('/proprietario/dashboard'));

  const carregarUsuario = useCallback(async () => {
    try {
      const salvo = await SecureStore.getItemAsync('userData');
      if (salvo) {
        const u = JSON.parse(salvo);
        setNome(String(u.name || u.nome || '').split(' ')[0]);
        setFoto(u.foto_perfil || u.foto || null);
      }
    } catch {
      // segue sem nome
    }
  }, []);

  const buscarNaoLidas = useCallback(async () => {
    try {
      const r = await api('/mensagens/nao-lidas');
      setNaoLidas(r?.total || 0);
    } catch {
      // badge é opcional
    }
  }, []);

  useEffect(() => {
    carregarUsuario();
    buscarNaoLidas();
    const t = setInterval(buscarNaoLidas, 20000);
    return () => clearInterval(t);
  }, [carregarUsuario, buscarNaoLidas]);

  const locais = dados?.estabelecimentos || [];
  const passosConcluidos = [dados?.onboarding?.locais, dados?.onboarding?.servicos, dados?.onboarding?.reservas].filter((n) => (n || 0) > 0).length;

  const abrirPorLocal = (prefixo: string) => {
    if (locais.length === 1) router.push(`${prefixo}${locais[0].id}` as never);
    else router.push('/Proprietario/MeusEstabelecimentos' as never);
  };

  const abrirAtalho = (rota: string) => {
    if (rota.startsWith('local:')) abrirPorLocal(rota.slice(6));
    else router.push(rota as never);
  };

  const direita = (
    <View style={s.acoes}>
      <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/mensagens' as never)} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={20} color={O.ink} />
        {naoLidas > 0 && (
          <View style={s.badge}><Text style={s.badgeTxt}>{naoLidas > 9 ? '9+' : naoLidas}</Text></View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={s.avatar} onPress={() => router.push('/Proprietario/perfil' as never)} activeOpacity={0.8}>
        {foto ? <Image source={{ uri: foto }} style={s.avatarImg} /> : <Text style={s.avatarTxt}>{(nome || 'S').charAt(0).toUpperCase()}</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <OwnerScreen
      titulo="Painel"
      saudacao={nome || undefined}
      semVoltar
      direita={direita}
      aba="painel"
      carregando={carregando && !dados}
      atualizando={atualizando}
      onAtualizar={atualizar}
    >
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : dados && (
        <>
          {/* PRIMEIROS PASSOS */}
          {passosConcluidos < 3 && (
            <View style={s.inicio}>
              <View style={s.inicioTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inicioTitulo}>Comece por aqui</Text>
                  <Text style={s.inicioSub}>{passosConcluidos} de 3 etapas concluídas</Text>
                </View>
                <View style={s.inicioBarra}><View style={[s.inicioBarraOn, { width: `${(passosConcluidos / 3) * 100}%` }]} /></View>
              </View>
              {[
                { id: 'local', rotulo: 'Cadastrar um local', ok: (dados.onboarding?.locais || 0) > 0 },
                { id: 'servico', rotulo: 'Criar um serviço', ok: (dados.onboarding?.servicos || 0) > 0 },
                { id: 'reserva', rotulo: 'Criar uma reserva', ok: (dados.onboarding?.reservas || 0) > 0 },
              ].map((p) => (
                <TouchableOpacity key={p.id} style={s.inicioItem} activeOpacity={0.7} onPress={() => router.push(`/Proprietario/tutorial?fluxo=${p.id}` as never)}>
                  <Ionicons name={p.ok ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={p.ok ? O.success : O.faint} />
                  <Text style={[s.inicioItemTxt, p.ok && s.inicioItemOk]}>{p.rotulo}</Text>
                  {!p.ok && <Text style={s.inicioVer}>Ver passo a passo</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* DESTAQUE FINANCEIRO */}
          <TouchableOpacity style={s.hero} activeOpacity={0.9} onPress={() => router.push('/Proprietario/financeiro' as never)}>
            <View style={s.heroTopo}>
              <Text style={s.heroRotulo}>Receita nos últimos 30 dias</Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.6)" />
            </View>
            <Text style={s.heroValor}>{brl(dados.financeiro?.receita_30_dias)}</Text>
            <View style={s.heroRodape}>
              <View>
                <Text style={s.heroSub}>Saldo disponível</Text>
                <Text style={s.heroSubValor}>{brl(dados.financeiro?.saldo_disponivel)}</Text>
              </View>
              {dados.financeiro && !dados.financeiro.carteira_configurada && (
                <View style={s.heroAviso}><Text style={s.heroAvisoTxt}>Configurar conta</Text></View>
              )}
            </View>
          </TouchableOpacity>

          <View style={s.grade}>
            <Metrica rotulo="Na fila agora" valor={dados.metricas.total_fila} icone="people-outline" tom={dados.metricas.total_fila ? 'alerta' : 'neutro'} />
            <Metrica rotulo="Locais ativos" valor={dados.metricas.ativos} icone="storefront-outline" tom="positivo" />
          </View>

          {/* ATALHOS */}
          <Rotulo>Acesso rápido</Rotulo>
          <View style={s.atalhosGrade}>
            {ATALHOS.map((a) => (
              <TouchableOpacity key={a.rotulo} style={s.atalho} onPress={() => abrirAtalho(a.rota)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={a.rotulo}>
                <View style={s.atalhoIcone}>
                  <Ionicons name={a.icone as any} size={24} color={O.accent} />
                  {'premium' in a && a.premium && dados.premium === false && (
                    <View style={s.cadeado}><Ionicons name="lock-closed" size={9} color="#7A4A00" /></View>
                  )}
                </View>
                <Text style={s.atalhoTxt} numberOfLines={1}>{a.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* LOCAIS */}
          <Rotulo direita={
            <TouchableOpacity onPress={() => router.push('/Proprietario/CriarEstabelecimento' as never)} style={s.novo}>
              <Ionicons name="add" size={16} color={O.accent} />
              <Text style={s.novoTxt}>Novo local</Text>
            </TouchableOpacity>
          }>
            Seus locais
          </Rotulo>

          {locais.length === 0 ? (
            <Card><Vazio icone="storefront-outline" titulo="Cadastre seu primeiro local" texto="Depois disso, você acompanha fila, equipe, reservas e financeiro por aqui." /></Card>
          ) : (
            locais.map((l) => (
              <Card key={l.id}>
                <View style={s.localTopo}>
                  <View style={s.localFoto}>
                    {l.foto_perfil ? <Image source={{ uri: l.foto_perfil }} style={s.localFotoImg} /> : <Text style={s.localInicial}>{l.nome.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.localNome} numberOfLines={1}>{l.nome}</Text>
                    <Text style={s.localSub}>
                      Nota {Number(l.avaliacao_media || 0).toFixed(1)} · {l.funcionarios_count} {l.funcionarios_count === 1 ? 'membro' : 'membros'}
                    </Text>
                  </View>
                  <Pilula texto={l.ativo ? 'Ativo' : 'Inativo'} tom={l.ativo ? 'positivo' : 'negativo'} />
                </View>

                <View style={s.localFila}>
                  <Text style={s.localFilaRotulo}>Na fila agora</Text>
                  <Text style={s.localFilaValor}>{l.fila_agora || 0}</Text>
                </View>

                <View style={s.localAcoes}>
                  {[
                    { t: 'Vitrine', i: 'storefront-outline', r: `/Proprietario/vitrine?estabelecimento_id=${l.id}` },
                    { t: 'Fila', i: 'list-outline', r: `/src/funcionario/Painel-funcioanario?origem=socio&estabelecimento_id=${l.id}` },
                    { t: 'Equipe', i: 'people-outline', r: `/Proprietario/FuncionariosScreen?id=${l.id}` },
                    { t: 'Agenda', i: 'calendar-outline', r: `/src/funcionario/AgendaEquipe?estabelecimento_id=${l.id}` },
                    { t: 'Ajustes', i: 'options-outline', r: `/Proprietario/ConfiguracoesMobile?id=${l.id}&nome=${encodeURIComponent(l.nome)}` },
                  ].map((b) => (
                    <TouchableOpacity key={b.t} style={s.localBtn} onPress={() => router.push(b.r as never)} activeOpacity={0.7}>
                      <Ionicons name={b.i as any} size={17} color={O.accent} />
                      <Text style={s.localBtnTxt}>{b.t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: O.canvas },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: O.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },

  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 14 },
  heroTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRotulo: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValor: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  heroRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  heroSubValor: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  heroAviso: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  heroAvisoTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  grade: { flexDirection: 'row', gap: 12, marginBottom: 6 },

  inicio: { backgroundColor: O.card, borderRadius: 24, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  inicioTopo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  inicioTitulo: { fontSize: 17, fontWeight: '800', color: O.ink, letterSpacing: -0.3 },
  inicioSub: { fontSize: 12, color: O.muted, marginTop: 2, fontWeight: '500' },
  inicioBarra: { width: 80, height: 8, borderRadius: 4, backgroundColor: O.soft, overflow: 'hidden' },
  inicioBarraOn: { height: 8, borderRadius: 4, backgroundColor: O.success },
  inicioItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F2' },
  inicioItemTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: O.ink },
  inicioItemOk: { color: O.muted, textDecorationLine: 'line-through' },
  inicioVer: { fontSize: 12, fontWeight: '700', color: O.accent },

  atalhos: { paddingHorizontal: 20, gap: 12, paddingBottom: 6 },
  atalhosGrade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  atalho: { width: '25%', alignItems: 'center' },
  atalhoIcone: { width: 60, height: 60, borderRadius: 30, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cadeado: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: O.canvas },
  atalhoTxt: { fontSize: 12, fontWeight: '600', color: O.ink },

  novo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1E4', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  novoTxt: { fontSize: 12, fontWeight: '700', color: O.accent },

  localTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  localFoto: { width: 48, height: 48, borderRadius: 16, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  localFotoImg: { width: '100%', height: '100%' },
  localInicial: { fontSize: 18, fontWeight: '700', color: O.muted },
  localNome: { fontSize: 16, fontWeight: '700', color: O.ink },
  localSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  localFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: O.soft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  localFilaRotulo: { fontSize: 13, color: O.muted, fontWeight: '600' },
  localFilaValor: { fontSize: 20, fontWeight: '800', color: O.ink },
  localAcoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  localBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: '#FFF7EF' },
  localBtnTxt: { fontSize: 11, fontWeight: '600', color: O.ink },
});
