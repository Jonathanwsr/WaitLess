import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Modal, TextInput, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import ItemViagem, { ItemRoteiro } from '../../../components/viagem/ItemViagem';
import GastosViagem from '../../../components/viagem/GastosViagem';
import ChatViagem from '../../../components/viagem/ChatViagem';
import GrupoViagem from '../../../components/viagem/GrupoViagem';
import { agruparPorDia, apiViagem, brl, dia, diaLongo, STATUS_ITEM } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';

type Aba = 'roteiro' | 'reservas' | 'gastos' | 'chat' | 'grupo';
const ABAS: [Aba, string, keyof typeof Ionicons.glyphMap][] = [
  ['roteiro', 'Roteiro', 'map-outline'],
  ['reservas', 'Reservas', 'ticket-outline'],
  ['gastos', 'Gastos', 'cash-outline'],
  ['chat', 'Chat', 'chatbubbles-outline'],
  ['grupo', 'Grupo', 'people-outline'],
];

function FormItem({ viagem, onFechar, onSalvo }: { viagem: any; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState<string>(viagem.data_inicio);
  const [hora, setHora] = useState('');
  const [custo, setCusto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Dias da viagem como opções (evita digitar data e errar o período).
  const dias = useMemo(() => {
    const lista: string[] = [];
    const d = new Date(`${viagem.data_inicio}T12:00:00`);
    const fim = new Date(`${viagem.data_fim}T12:00:00`);
    while (d <= fim && lista.length < 40) { lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); d.setDate(d.getDate() + 1); }
    return lista;
  }, [viagem]);

  const salvar = async () => {
    if (!titulo.trim()) return alertar('Faltou o título', 'Descreva o compromisso (ex.: Almoço combinado).');
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) return alertar('Hora inválida', 'Use o formato HH:MM, por exemplo 12:30.');
    setEnviando(true);
    const r = await apiViagem(`/${viagem.id}/itens`, 'POST', { titulo: titulo.trim(), tipo: 'personalizado', dia: data, hora_inicio: hora || undefined, custo_estimado: Number(custo.replace(',', '.')) || undefined });
    setEnviando(false);
    if (!r.ok) return alertar('Não foi possível adicionar', r.erro || '');
    onSalvo();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: T.cream, padding: 20 }}>
        <View style={s.modalTopo}><Text style={s.modalTitulo}>Adicionar à agenda</Text><TouchableOpacity onPress={onFechar}><Ionicons name="close" size={24} color={T.ink} /></TouchableOpacity></View>
        <TextInput style={s.input} placeholder="Ex.: Almoço no mercado" placeholderTextColor={T.faint} value={titulo} onChangeText={setTitulo} maxLength={250} />
        <Text style={s.rotulo}>Dia</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dias.map((d) => (
            <TouchableOpacity key={d} onPress={() => setData(d)} style={[s.chipDia, data === d && s.chipDiaOn]}><Text style={[s.chipDiaTxt, data === d && { color: '#fff' }]}>{dia(d)}</Text></TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Hora (12:30)" placeholderTextColor={T.faint} value={hora} onChangeText={setHora} maxLength={5} keyboardType="numbers-and-punctuation" />
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Custo (R$)" placeholderTextColor={T.faint} value={custo} onChangeText={setCusto} keyboardType="decimal-pad" />
        </View>
        <TouchableOpacity style={[s.botao, enviando && { opacity: 0.6 }]} onPress={salvar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Adicionar</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function ViagemDetalhe() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);

  const [painel, setPainel] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('roteiro');
  const [aviso, setAviso] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState(false);

  const carregar = useCallback(async () => {
    const r = await apiViagem(`/${id}`);
    if (r.ok) {
      // O chat mantém as mensagens que já recebeu; só a primeira carga traz o histórico.
      setPainel((atual: any) => ({ ...r.dados, mensagens: atual?.mensagens ?? r.dados.mensagens }));
      setErro(null);
    } else setErro(r.erro);
    setCarregando(false);
    setAtualizando(false);
  }, [id]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 3500); return () => clearTimeout(t); }, [aviso]);

  const executar = async (caminho: string, metodo: 'POST' | 'DELETE', corpo?: unknown) => {
    const r = await apiViagem(caminho, metodo, corpo);
    if (!r.ok) { alertar('Não foi possível concluir', r.erro || ''); return null; }
    await carregar();
    return r.dados;
  };

  const presenca = (item: ItemRoteiro, status: string) => executar(`/${id}/itens/${item.id}/presenca`, 'POST', { status });
  const removerItem = (item: ItemRoteiro) => alertar('Remover da agenda', `Remover "${item.titulo}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => executar(`/${id}/itens/${item.id}`, 'DELETE') },
  ]);
  const regenerar = () => alertar('Refazer sugestões', 'As sugestões ainda não reservadas serão refeitas. O que o grupo já reservou ou adicionou é mantido.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Refazer', onPress: async () => { const d = await executar(`/${id}/regenerar`, 'POST'); if (d?.avisos?.length) alertar('Atenção', d.avisos.join('\n')); else if (d) setAviso('Roteiro atualizado.'); } },
  ]);
  const excluir = () => alertar('Excluir viagem', 'Isso apaga agenda, gastos e chat para todo o grupo.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { const r = await apiViagem(`/${id}`, 'DELETE'); if (!r.ok) return alertar('Não foi possível excluir', r.erro || ''); router.back(); } },
  ]);
  const compartilharReserva = async (r: any) => { if (await executar(`/${id}/reservas`, 'POST', { tipo: r.tipo, id: r.id })) setAviso('Reserva compartilhada com o grupo.'); };

  const itens: ItemRoteiro[] = painel?.itens ?? [];
  const agrupado = useMemo(() => agruparPorDia(itens as any), [itens]);

  if (carregando) return <SafeAreaView style={s.safe}><View style={s.centro}><ActivityIndicator color={T.primary} size="large" /></View></SafeAreaView>;
  if (erro || !painel) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centro}>
          <Ionicons name="alert-circle-outline" size={42} color={T.danger} />
          <Text style={s.erroTxt}>{erro || 'Viagem não encontrada.'}</Text>
          <TouchableOpacity style={s.botaoMini} onPress={() => router.back()}><Text style={s.botaoTxt}>Voltar</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { viagem, eu } = painel;
  const orc: number | null = viagem.orcamento_limite;
  const uso = orc ? Math.min(100, (painel.custos.estimado / orc) * 100) : null;
  const confirmados = painel.membros.filter((m: any) => m.presenca === 'confirmado').length;
  const comReserva = itens.filter((i) => i.reserva);
  const semReserva = itens.filter((i) => !i.reserva && ['hospedagem', 'transporte', 'servico', 'atracao'].includes(i.tipo));
  const itemProps = { euId: eu.id, onPresenca: presenca, onRemover: viagem.posso_editar ? removerItem : undefined };

  const conteudo = (
    <>
      {aba === 'roteiro' && (
        <View>
          {viagem.posso_editar && (
            <View style={s.acoes}>
              <TouchableOpacity style={s.acao} onPress={() => setNovoItem(true)}><Ionicons name="add" size={16} color={T.ink} /><Text style={s.acaoTxt}> Adicionar</Text></TouchableOpacity>
              <TouchableOpacity style={s.acao} onPress={regenerar}><Ionicons name="refresh" size={16} color={T.ink} /><Text style={s.acaoTxt}> Refazer sugestões</Text></TouchableOpacity>
              {viagem.sou_criador && <TouchableOpacity style={[s.acao, { borderColor: '#FECACA' }]} onPress={excluir}><Ionicons name="trash-outline" size={16} color={T.danger} /></TouchableOpacity>}
            </View>
          )}
          {itens.length === 0 && <Text style={s.vazio}>Nenhum item ainda. Adicione compromissos ou refaça as sugestões.</Text>}
          {agrupado.fixos.length > 0 && <Text style={s.diaTitulo}>Durante toda a viagem</Text>}
          {agrupado.fixos.map((i: any) => <ItemViagem key={i.id} item={i} {...itemProps} />)}
          {agrupado.dias.map(({ dia: d, itens: lista }: any) => (
            <View key={d}>
              <Text style={s.diaTitulo}>{d === 'sem-data' ? 'Sem data' : diaLongo(d)}</Text>
              {lista.map((i: any) => <ItemViagem key={i.id} item={i} {...itemProps} />)}
            </View>
          ))}
        </View>
      )}

      {aba === 'reservas' && (
        <View style={{ gap: 14 }}>
          {painel.minhas_reservas.length > 0 && (
            <View style={s.destaque}>
              <Text style={s.cardTitulo}>Suas reservas nesta viagem</Text>
              <Text style={s.cardSub}>Encontramos reservas suas na cidade e nas datas. Compartilhe para o grupo enxergar.</Text>
              {painel.minhas_reservas.map((r: any) => (
                <View key={`${r.tipo}${r.id}`} style={s.reservaCard}>
                  <Text style={s.reservaNome}>{r.titulo}</Text>
                  <Text style={s.reservaMeta}>{[r.local, r.quando].filter(Boolean).join(' · ')} · {brl(r.valor)}</Text>
                  <TouchableOpacity style={s.botaoMini} onPress={() => compartilharReserva(r)}><Text style={s.botaoTxt}>Compartilhar com o grupo</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardTitulo}>Reservas do grupo</Text>
            {comReserva.length === 0 && <Text style={s.cardSub}>Nenhuma reserva compartilhada ainda. Reserve os itens sugeridos e eles aparecem aqui para todos.</Text>}
            {comReserva.map((i) => {
              const st = STATUS_ITEM[i.status || 'reservado'] || STATUS_ITEM.reservado;
              return (
                <View key={i.id} style={s.linhaReserva}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reservaNome}>{i.titulo}</Text>
                    <Text style={s.reservaMeta}>{i.reserva?.por} · {i.reserva?.quando}{i.reserva?.codigo ? ` · cód. ${i.reserva.codigo}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.reservaNome}>{brl((i.reserva as any)?.valor || i.custo_estimado)}</Text>
                    <View style={[s.selo, { backgroundColor: st.bg }]}><Text style={[s.seloTxt, { color: st.cor }]}>{st.texto}</Text></View>
                  </View>
                </View>
              );
            })}
          </View>

          {semReserva.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitulo}>Ainda sem reserva</Text>
              <Text style={s.cardSub}>{semReserva.length} itens do roteiro ainda não foram reservados.</Text>
              {semReserva.map((i) => (
                <TouchableOpacity key={i.id} style={s.linhaReserva} activeOpacity={0.8}
                  onPress={() => (i.item_aluguel_id ? router.push(`/src/screens/ExplorarDetalhes?id=${i.item_aluguel_id}&tipo=reservas` as never) : i.servico_id ? router.push(`/src/screens/ExplorarDetalhes?id=${i.servico_id}` as never) : undefined)}>
                  <View style={{ flex: 1 }}><Text style={s.reservaNome}>{i.titulo}</Text><Text style={s.reservaMeta}>{i.dia ? dia(i.dia) : ''} {i.hora_inicio?.slice(0, 5) || ''} · {brl(i.custo_estimado)}</Text></View>
                  <Text style={s.link}>Reservar</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {aba === 'gastos' && <GastosViagem painel={painel} recarregar={carregar} avisar={setAviso} />}
      {aba === 'grupo' && <GrupoViagem painel={painel} recarregar={carregar} avisar={setAviso} />}
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <View style={s.hero}>
        <View style={s.heroTopo}>
          <TouchableOpacity onPress={() => router.back()} style={s.voltar}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.heroStatus}>{viagem.status}</Text>
        </View>
        <Text style={s.heroDestino}><Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" /> {viagem.destino}</Text>
        <Text style={s.heroTitulo} numberOfLines={2}>{viagem.titulo}</Text>
        <Text style={s.heroMeta}>{dia(viagem.data_inicio)} a {dia(viagem.data_fim)} · {viagem.total_dias} {viagem.total_dias === 1 ? 'dia' : 'dias'} · {confirmados}/{painel.membros.length} confirmados</Text>
        <View style={s.heroValores}>
          <Text style={s.heroPreco}>{brl(painel.custos.estimado)}</Text>
          {orc != null && <Text style={s.heroOrc}> de {brl(orc)}</Text>}
        </View>
        {uso != null && <View style={s.barra}><View style={[s.barraFill, { width: `${uso}%`, backgroundColor: painel.custos.estimado > (orc as number) ? '#F87171' : T.primary }]} /></View>}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.abas}>
          {ABAS.map(([k, nome, icone]) => (
            <TouchableOpacity key={k} style={[s.aba, aba === k && s.abaOn]} onPress={() => setAba(k)} activeOpacity={0.8}>
              <Ionicons name={icone} size={16} color={aba === k ? '#fff' : T.muted} /><Text style={[s.abaTxt, aba === k && { color: '#fff' }]}> {nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!aviso && <View style={s.aviso}><Text style={s.avisoTxt}>{aviso}</Text></View>}

      {aba === 'chat' ? (
        <View style={{ flex: 1, padding: 16, paddingBottom: Platform.OS === 'ios' ? 8 : 16 }}><ChatViagem painel={{ ...painel, mensagens: painel.mensagens }} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={T.primary} />}>
          {conteudo}
        </ScrollView>
      )}

      {novoItem && <FormItem viagem={viagem} onFechar={() => setNovoItem(false)} onSalvo={() => { setNovoItem(false); carregar(); }} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  erroTxt: { fontSize: 14, color: T.muted, textAlign: 'center' },
  hero: { backgroundColor: '#1F1A17', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 34 : 6, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voltar: { width: 36, height: 36, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  heroStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  heroDestino: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  heroTitulo: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.4 },
  heroMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  heroValores: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  heroPreco: { color: '#fff', fontSize: 26, fontWeight: '800' },
  heroOrc: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  barra: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 3 },
  abas: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  aba: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: T.line },
  abaOn: { backgroundColor: T.primary, borderColor: T.primary },
  abaTxt: { fontSize: 13, fontWeight: '800', color: T.muted },
  aviso: { marginHorizontal: 16, marginBottom: 4, backgroundColor: T.successBg, borderRadius: 12, padding: 10 },
  avisoTxt: { color: '#15803D', fontWeight: '700', fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 60 },
  acoes: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  acao: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  acaoTxt: { fontSize: 13, fontWeight: '800', color: T.ink },
  vazio: { textAlign: 'center', color: T.muted, marginVertical: 30, fontSize: 13 },
  diaTitulo: { fontSize: 15, fontWeight: '800', color: T.ink, textTransform: 'capitalize', marginVertical: 8 },
  card: { backgroundColor: T.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  destaque: { backgroundColor: T.primarySoft, borderRadius: 20, padding: 16 },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  cardSub: { fontSize: 12, color: T.muted, marginTop: 3, marginBottom: 8, lineHeight: 17 },
  reservaCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginTop: 8, gap: 4 },
  reservaNome: { fontSize: 14, fontWeight: '800', color: T.ink },
  reservaMeta: { fontSize: 12, color: T.muted },
  linhaReserva: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line },
  selo: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  seloTxt: { fontSize: 10, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '800', color: T.primary },
  botaoMini: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 6 },
  botao: { backgroundColor: T.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitulo: { fontSize: 22, fontWeight: '800', color: T.ink },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink, marginBottom: 12 },
  rotulo: { fontSize: 11, fontWeight: '800', color: T.faint, textTransform: 'uppercase', marginBottom: 8 },
  chipDia: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipDiaOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipDiaTxt: { fontSize: 13, fontWeight: '700', color: T.muted },
});
