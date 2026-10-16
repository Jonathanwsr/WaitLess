import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, StatusBar, Platform, Modal, Share, Switch, Linking, LayoutAnimation, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../../constants/ClientTheme';
import {
  apiRoteiro, CATEGORIAS, comChaves, DiaRoteiro, Guia, INTERESSES, ItemRoteiro, Locacao, novaChave, ORDEM, paraSalvar, Periodo, PERIODOS, recalcular, RoteiroDados, TelaRoteiro,
} from '../../../services/roteirosApi';
import { brl, dia as diaCurto, diaLongo } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';
import { baixarPdf } from '../../../services/baixarPdf';
import { pedirLocalizacao } from '../../../services/localizacaoOpcional';
import CartaoLocacao from '../../../components/viagem/roteiro/CartaoLocacao';
import MapaDia from '../../../components/viagem/roteiro/MapaDia';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

const TOPO = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const animar = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

type Pedido = { codigo: string; total: number; reservas: { tipo: string; id: number; titulo: string; data: string; data_fim?: string; hora?: string; valor: number }[]; nao_reservados: { titulo: string; motivo: string }[] | null; mensagem?: string };

export default function RoteiroEditar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; destino?: string }>();
  const [roteiro, setRoteiro] = useState<RoteiroDados | null>(null);
  const [dias, setDias] = useState<DiaRoteiro[]>([]);
  const [avisosServidor, setAvisosServidor] = useState<string[]>([]);
  const [flash, setFlash] = useState<Locacao[]>([]);
  const [diaAtivo, setDiaAtivo] = useState(0);
  const [alterado, setAlterado] = useState(false);
  const [carregando, setCarregando] = useState(!!params.id);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [adicionar, setAdicionar] = useState<{ dia: number; periodo: Periodo; pre?: Locacao } | null>(null);
  const [mover, setMover] = useState<string | null>(null);
  const [anotar, setAnotar] = useState<{ chave: string; texto: string } | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const aplicar = (t: TelaRoteiro) => {
    setRoteiro(t.roteiro);
    setDias(comChaves(t.dias));
    setAvisosServidor(t.avisos || []);
    if (t.sugestoes_flash) setFlash(t.sugestoes_flash);
  };

  useEffect(() => {
    if (!params.id) return;
    apiRoteiro<TelaRoteiro>(`/roteiros/${params.id}`).then((r) => {
      setCarregando(false);
      if (r.ok) aplicar(r.dados); else setAviso({ tipo: 'erro', texto: r.erro || '' });
    });
  }, [params.id]);

  const calc = useMemo(() => (roteiro ? recalcular(roteiro, dias) : null), [roteiro, dias]);
  const dia = calc?.dias[diaAtivo];
  const pontosDia = useMemo(() => (dia ? ORDEM.flatMap((p) => dia.periodos[p]).filter((i) => i.numero) : []), [dia]);

  const mostrar = (tipo: 'ok' | 'erro', texto: string) => { setAviso({ tipo, texto }); setTimeout(() => setAviso(null), 6000); };

  // ------------------------------------------------------------ ações
  const gerar = async (corpo: Record<string, unknown>) => {
    setOcupado('gerar');
    const r = await apiRoteiro<TelaRoteiro>('/roteiros/gerar', 'POST', corpo);
    setOcupado(null);
    if (!r.ok) return alertar('Não foi possível montar', r.erro || '');
    aplicar(r.dados);
    setDiaAtivo(0);
    setAlterado(true);
  };

  const salvar = async (silencioso = false): Promise<number | null> => {
    if (!roteiro) return null;
    setOcupado('salvar');
    const corpo = paraSalvar(roteiro, dias);
    const r = roteiro.id
      ? await apiRoteiro<TelaRoteiro & { mensagem: string }>(`/roteiros/${roteiro.id}`, 'PUT', corpo)
      : await apiRoteiro<TelaRoteiro & { mensagem: string; id: number }>('/roteiros', 'POST', corpo);
    setOcupado(null);
    if (!r.ok) { mostrar('erro', r.erro || ''); return null; }
    aplicar(r.dados);
    setAlterado(false);
    if (!silencioso) mostrar('ok', r.dados.mensagem || 'Roteiro salvo.');
    return r.dados.roteiro.id;
  };

  const garantirSalvo = async () => (roteiro?.id && !alterado ? roteiro.id : salvar(true));

  const reservar = () => alertar('Reservar tudo', 'Todas as locações do Lokyva deste roteiro entram em um único pedido, com as datas e as pessoas já preenchidas. O pagamento fica para o local (você pode pagar online depois, onde o local aceita).', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Reservar', onPress: async () => {
      const id = await garantirSalvo();
      if (!id) return;
      setOcupado('reservar');
      const r = await apiRoteiro<{ pedido: Pedido; mensagem: string }>(`/roteiros/${id}/reservar`, 'POST');
      setOcupado(null);
      if (!r.ok) return alertar('Não foi possível reservar', r.erro || '');
      setPedido({ ...r.dados.pedido, mensagem: r.dados.mensagem });
    } },
  ]);

  const compartilhar = async () => {
    const id = await garantirSalvo();
    if (!id) return;
    setOcupado('compartilhar');
    const r = await apiRoteiro<{ link: string }>(`/roteiros/${id}/compartilhar`, 'POST');
    setOcupado(null);
    if (!r.ok) return alertar('Não foi possível compartilhar', r.erro || '');
    await Share.share({ message: `Nosso roteiro "${roteiro?.titulo}": ${r.dados.link}\n(Somente leitura)` }).catch(() => {});
  };

  const pdf = async () => {
    const id = await garantirSalvo();
    if (!id) return;
    setOcupado('pdf');
    try { await baixarPdf(`/roteiros/${id}/pdf`, `roteiro-${id}.pdf`, { titulo: 'Roteiro de viagem', erro: 'Não foi possível baixar o PDF do roteiro agora.' }); }
    catch (e: any) { alertar('PDF', e?.message || 'Tente novamente.'); }
    finally { setOcupado(null); }
  };

  const menu = () => alertar(roteiro?.titulo || 'Roteiro', 'O que deseja fazer?', [
    { text: 'Duplicar', onPress: async () => {
      const id = await garantirSalvo();
      if (!id) return;
      const r = await apiRoteiro<{ id: number }>(`/roteiros/${id}/duplicar`, 'POST');
      if (!r.ok) return alertar('Não foi possível duplicar', r.erro || '');
      router.replace({ pathname: '/src/screens/RoteiroEditar' as never, params: { id: String(r.dados.id) } } as never);
    } },
    ...(roteiro?.id ? [{ text: 'Parar de compartilhar', onPress: async () => { const r = await apiRoteiro(`/roteiros/${roteiro.id}/compartilhar`, 'DELETE'); mostrar(r.ok ? 'ok' : 'erro', r.ok ? 'O link antigo deixou de funcionar.' : r.erro || ''); } }] : []),
    ...(roteiro?.id ? [{ text: 'Excluir', style: 'destructive' as const, onPress: () => alertar('Excluir roteiro', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { const r = await apiRoteiro(`/roteiros/${roteiro!.id}`, 'DELETE'); if (r.ok) router.back(); else alertar('Erro', r.erro || ''); } },
    ]) }] : []),
    { text: 'Fechar', style: 'cancel' },
  ]);

  const voltar = () => {
    if (!alterado) return router.back();
    alertar('Sair sem salvar?', 'As alterações deste roteiro ainda não foram salvas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Salvar e sair', onPress: async () => { if (await salvar(true)) router.back(); } },
      { text: 'Sair', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  // ------------------------------------------------------------ edição
  const alterar = (fn: (ds: DiaRoteiro[]) => DiaRoteiro[]) => { animar(); setDias((atual) => fn(atual.map((d) => ({ ...d, periodos: { ...d.periodos } })))); setAlterado(true); };

  const moverItem = (chave: string, diaDest: number, perDest: Periodo, indice: number) => alterar((ds) => {
    let item: ItemRoteiro | null = null;
    let origem: { di: number; p: Periodo; pos: number } | null = null;
    ds.forEach((d, di) => ORDEM.forEach((p) => {
      const pos = d.periodos[p].findIndex((i) => i._k === chave);
      if (pos >= 0) { item = d.periodos[p][pos]; origem = { di, p, pos }; d.periodos[p] = d.periodos[p].filter((i) => i._k !== chave); }
    }));
    if (!item || !origem) return ds;
    const o = origem as { di: number; p: Periodo; pos: number };
    let destino = indice;
    if (o.di === diaDest && o.p === perDest && o.pos < indice) destino -= 1;
    const lista = [...ds[diaDest].periodos[perDest]];
    lista.splice(Math.max(0, Math.min(destino, lista.length)), 0, item);
    ds[diaDest].periodos[perDest] = lista;
    return ds;
  });

  const remover = (chave: string) => alterar((ds) => ds.map((d) => ({ ...d, periodos: Object.fromEntries(ORDEM.map((p) => [p, d.periodos[p].filter((i) => i._k !== chave)])) as DiaRoteiro['periodos'] })));

  const salvarAnotacao = () => {
    if (!anotar) return;
    const { chave, texto } = anotar;
    alterar((ds) => ds.map((d) => ({ ...d, periodos: Object.fromEntries(ORDEM.map((p) => [p, d.periodos[p].map((i) => (i._k === chave ? { ...i, anotacao: texto.trim().slice(0, 2000) || null } : i))])) as DiaRoteiro['periodos'] })));
    setAnotar(null);
  };

  const inserir = (item: ItemRoteiro) => {
    if (!adicionar) return;
    const { dia: d, periodo } = adicionar;
    alterar((ds) => { ds[d].periodos[periodo] = [...ds[d].periodos[periodo], { ...item, periodo, _k: novaChave() }]; return ds; });
    setAdicionar(null);
    mostrar('ok', `"${item.titulo}" entrou no dia ${d + 1}. Salve para atualizar os custos oficiais.`);
  };

  // ------------------------------------------------------------ telas
  if (carregando) return <View style={[s.tela, s.centro]}><ActivityIndicator size="large" color={T.primary} /></View>;
  if (!roteiro) return <Formulario destinoInicial={params.destino ? String(params.destino) : ''} ocupado={ocupado === 'gerar'} onGerar={gerar} onVoltar={() => router.back()} />;

  const resumo = calc!.resumo;
  const avisos = Array.from(new Set([...(avisosServidor || []).filter((a) => !a.includes('orçamento')), ...(resumo.passou_orcamento ? [`O roteiro passou do orçamento em ${brl(-(resumo.diferenca || 0))}. Remova ou troque alguma locação.`] : [])]));
  const uso = resumo.orcamento ? Math.min(100, (resumo.total / resumo.orcamento) * 100) : null;
  const itemMovendo = mover ? dias.flatMap((d) => ORDEM.flatMap((p) => d.periodos[p])).find((i) => i._k === mover) : null;

  return (
    <View style={s.tela}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1F1A17', '#3A2414', '#7C2D12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <View style={s.heroTopo}>
            <TouchableOpacity onPress={voltar} style={s.voltar} accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={menu} style={s.voltar} accessibilityLabel="Mais opções"><Ionicons name="ellipsis-horizontal" size={20} color="#fff" /></TouchableOpacity>
          </View>
          <TextInput value={roteiro.titulo} onChangeText={(t) => { setRoteiro({ ...roteiro, titulo: t.slice(0, 200) }); setAlterado(true); }} style={s.heroTitulo} accessibilityLabel="Nome do roteiro" multiline />
          <View style={s.pilulas}>
            <Text style={s.pilula}>📍 {roteiro.destino}</Text>
            <Text style={s.pilula}>📅 {diaCurto(roteiro.data_inicio)} – {diaCurto(roteiro.data_fim)}</Text>
            <Text style={s.pilula}>👤 {roteiro.pessoas}</Text>
          </View>
          <Text style={s.heroRotulo}>CUSTO ESTIMADO</Text>
          <Text style={s.heroTotal}>{brl(resumo.total)}</Text>
          <Text style={s.heroSub}>{brl(resumo.por_pessoa)} por pessoa · {resumo.locacoes} locações do Lokyva</Text>
          {uso != null && (
            <>
              <View style={s.barra}><View style={[s.barraFill, { width: `${uso}%`, backgroundColor: resumo.passou_orcamento ? '#F87171' : '#34D399' }]} /></View>
              <Text style={[s.heroSub, { color: resumo.passou_orcamento ? '#FCA5A5' : '#6EE7B7', fontWeight: '800' }]}>
                {resumo.passou_orcamento ? `Passou ${brl(-(resumo.diferenca || 0))} do orçamento` : `Sobram ${brl(resumo.diferenca)} do orçamento de ${brl(resumo.orcamento)}`}
              </Text>
            </>
          )}
        </LinearGradient>

        <View style={s.corpo}>
          {!!aviso && <View style={[s.aviso, aviso.tipo === 'erro' && s.avisoErro]}><Text style={[s.avisoTxt, aviso.tipo === 'erro' && { color: '#B91C1C' }]}>{aviso.texto}</Text></View>}
          {avisos.map((a) => <View key={a} style={s.alerta}><Ionicons name="warning" size={16} color="#B45309" /><Text style={s.alertaTxt}>{a}</Text></View>)}
          {alterado && <Text style={s.naoSalvo}>Alterações ainda não salvas.</Text>}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {calc!.dias.map((d, i) => (
              <TouchableOpacity key={d.numero} style={[s.diaAba, diaAtivo === i && s.diaAbaOn]} onPress={() => { animar(); setDiaAtivo(i); }} accessibilityRole="tab" accessibilityState={{ selected: diaAtivo === i }}>
                <Text style={[s.diaAbaNum, diaAtivo === i && { color: '#fff' }]}>Dia {d.numero}</Text>
                <Text style={[s.diaAbaData, diaAtivo === i && { color: 'rgba(255,255,255,0.7)' }]}>{diaCurto(d.data)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.diaTopo}>
            <Text style={s.diaTitulo}>{diaLongo(dia!.data)}</Text>
            <Text style={s.diaCusto}>{brl(dia!.custo)}</Text>
          </View>

          <TouchableOpacity style={s.mapaBtn} onPress={() => { animar(); setMapaAberto((a) => !a); }} accessibilityState={{ expanded: mapaAberto }}>
            <Ionicons name="map" size={18} color={T.primary} /><Text style={s.mapaBtnTxt}>Ver o dia no mapa</Text>
            <Ionicons name={mapaAberto ? 'chevron-up' : 'chevron-down'} size={18} color={T.muted} />
          </TouchableOpacity>
          {mapaAberto && <MapaDia pontos={pontosDia} centro={{ lat: roteiro.latitude, lng: roteiro.longitude }} />}

          {PERIODOS.map(([periodo, rotulo, emoji]) => {
            const itens = dia!.periodos[periodo];
            return (
              <View key={periodo} style={s.periodo}>
                <View style={s.periodoTopo}>
                  <Text style={s.periodoTitulo}>{emoji} {rotulo.toUpperCase()}</Text>
                  <TouchableOpacity style={s.addBtn} onPress={() => setAdicionar({ dia: diaAtivo, periodo })} accessibilityLabel={`Adicionar em ${rotulo}`}>
                    <Ionicons name="add" size={16} color="#E8590C" /><Text style={s.addTxt}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
                {itens.length === 0 && <Text style={s.livre}>Período livre.</Text>}
                {itens.map((item, idx) => (
                  <View key={item._k}>
                    {item.distancia_km != null && (item.numero || 0) > 1 && (
                      <Text style={s.desloc}>↓ {String(item.distancia_km).replace('.', ',')} km · {item.minutos} min {item.modo === 'a_pe' ? 'a pé' : 'de carro'}</Text>
                    )}
                    <ItemCartao
                      item={item}
                      onSubir={idx > 0 ? () => moverItem(item._k!, diaAtivo, periodo, idx - 1) : undefined}
                      onDescer={idx < itens.length - 1 ? () => moverItem(item._k!, diaAtivo, periodo, idx + 2) : undefined}
                      onMover={() => setMover(item._k!)}
                      onAnotar={() => setAnotar({ chave: item._k!, texto: item.anotacao || '' })}
                      onRemover={() => remover(item._k!)}
                      onAbrir={item.locacao ? () => router.push({ pathname: '/src/screens/ExplorarDetalhes' as never, params: item.locacao!.tipo === 'servico' ? { id: String(item.locacao!.id) } : { id: String(item.locacao!.id), tipo: 'reservas' } } as never) : undefined}
                    />
                  </View>
                ))}
              </View>
            );
          })}

          {flash.length > 0 && (
            <View style={s.flash}>
              <Text style={s.flashTitulo}>⚡ Ofertas relâmpago perto do roteiro</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
                {flash.map((l) => <CartaoLocacao key={l.chave} l={l} acao="Incluir" onAcao={() => setAdicionar({ dia: diaAtivo, periodo: 'tarde', pre: l })} />)}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Ações fixas no rodapé */}
      <View style={[s.rodape, { paddingBottom: Math.max(10, insets.bottom) }]}>
        <Acao icone="checkmark-circle" rotulo={ocupado === 'salvar' ? 'Salvando…' : 'Salvar'} destaque={alterado} onPress={() => salvar()} disabled={!!ocupado} />
        <Acao icone="cart" rotulo={ocupado === 'reservar' ? '…' : 'Reservar'} onPress={reservar} disabled={!!ocupado} />
        <Acao icone="share-social" rotulo="Compartilhar" onPress={compartilhar} disabled={!!ocupado} />
        <Acao icone="document-text" rotulo={ocupado === 'pdf' ? '…' : 'PDF'} onPress={pdf} disabled={!!ocupado} />
      </View>

      {adicionar && <ModalAdicionar roteiro={roteiro} alvo={adicionar} onFechar={() => setAdicionar(null)} onEscolher={inserir} />}

      <Modal visible={!!mover} transparent animationType="fade" onRequestClose={() => setMover(null)}>
        <TouchableOpacity style={s.fundo} activeOpacity={1} onPress={() => setMover(null)}>
          <View style={s.folha}>
            <Text style={s.folhaTitulo}>Mover "{itemMovendo?.titulo}"</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {dias.map((d, di) => PERIODOS.map(([p, r]) => (
                <TouchableOpacity key={`${di}${p}`} style={s.opcao} onPress={() => { moverItem(mover!, di, p, Number.MAX_SAFE_INTEGER); setMover(null); }}>
                  <Text style={s.opcaoTxt}>Dia {d.numero} · {r}</Text><Text style={s.opcaoSub}>{diaCurto(d.data)}</Text>
                </TouchableOpacity>
              )))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!anotar} transparent animationType="fade" onRequestClose={() => setAnotar(null)}>
        <View style={s.fundo}>
          <View style={s.folha}>
            <Text style={s.folhaTitulo}>Sua anotação</Text>
            <TextInput value={anotar?.texto || ''} onChangeText={(t) => setAnotar((a) => (a ? { ...a, texto: t } : a))} multiline maxLength={2000} style={s.notaInput} placeholder="Ex.: levar protetor solar" placeholderTextColor={T.faint} autoFocus />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.folhaBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => setAnotar(null)}><Text style={[s.folhaBtnTxt, { color: T.ink }]}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.folhaBtn} onPress={salvarAnotacao}><Text style={s.folhaBtnTxt}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pedido} transparent animationType="slide" onRequestClose={() => setPedido(null)}>
        <View style={s.fundo}>
          <View style={s.folha}>
            <View style={s.okIcone}><Ionicons name="checkmark" size={30} color="#059669" /></View>
            <Text style={[s.folhaTitulo, { textAlign: 'center' }]}>Pedido {pedido?.codigo}</Text>
            <Text style={s.pedidoMsg}>{pedido?.mensagem}</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {pedido?.reservas.map((r) => (
                <View key={`${r.tipo}${r.id}`} style={s.pedidoLinha}>
                  <View style={{ flex: 1 }}><Text style={s.opcaoTxt}>{r.titulo}</Text><Text style={s.opcaoSub}>{diaCurto(r.data)}{r.data_fim ? ` – ${diaCurto(r.data_fim)}` : ''}{r.hora ? ` · ${r.hora}` : ''}</Text></View>
                  <Text style={s.opcaoTxt}>{brl(r.valor)}</Text>
                </View>
              ))}
              {!!pedido?.nao_reservados?.length && (
                <View style={s.alerta}><Text style={s.alertaTxt}>Não reservados: {pedido.nao_reservados.map((n) => `${n.titulo} (${n.motivo})`).join('; ')}</Text></View>
              )}
            </ScrollView>
            <Text style={s.pedidoTotal}>Total {brl(pedido?.total)}</Text>
            <TouchableOpacity style={[s.folhaBtn, { marginTop: 10 }]} onPress={() => { setPedido(null); router.push('/(tabs)/reservas' as never); }}><Text style={s.folhaBtnTxt}>Ver minhas reservas</Text></TouchableOpacity>
            <TouchableOpacity style={[s.folhaBtn, { backgroundColor: '#F3F4F6', marginTop: 8 }]} onPress={() => setPedido(null)}><Text style={[s.folhaBtnTxt, { color: T.ink }]}>Voltar ao roteiro</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ====================================================================== partes

function ItemCartao({ item, onSubir, onDescer, onMover, onAnotar, onRemover, onAbrir }: {
  item: ItemRoteiro; onSubir?: () => void; onDescer?: () => void; onMover: () => void; onAnotar: () => void; onRemover: () => void; onAbrir?: () => void;
}) {
  const meta = CATEGORIAS[item.tipo === 'locacao' ? item.categoria || 'servicos' : item.tipo] || CATEGORIAS.servicos;
  const foto = item.imagem || item.locacao?.foto;
  const cor = item.tipo === 'ponto_turistico' ? '#E8590C' : item.tipo === 'anotacao' ? '#CA8A04' : T.ink;
  return (
    <View style={s.item}>
      <View style={[s.itemNum, { backgroundColor: cor }]}><Text style={s.itemNumTxt}>{item.numero ?? '•'}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!!foto && <Image source={{ uri: foto }} style={s.itemFoto} accessibilityIgnoresInvertColors />}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {!!item.hora && <Text style={s.itemHora}>{item.hora}</Text>}
              <Text style={[s.itemTag, { backgroundColor: meta.bg, color: meta.cor }]}>{item.tipo === 'locacao' ? `LOKYVA · ${meta.rotulo.toUpperCase()}` : meta.rotulo.toUpperCase()}</Text>
            </View>
            <Text style={s.itemTitulo}>{item.titulo}</Text>
            {!!item.descricao && <Text style={s.itemDesc} numberOfLines={2}>{item.descricao}</Text>}
          </View>
        </View>
        {!!item.anotacao && <Text style={s.itemNota}>📝 {item.anotacao}</Text>}
        <View style={s.itemMeta}>
          {!!item.aviso_horario && <Text style={s.itemAviso}>🕑 {item.aviso_horario}</Text>}
          {item.custo_estimado > 0 && <Text style={s.itemCusto}>{brl(item.custo_estimado)}</Text>}
          {!!item.link && <TouchableOpacity onPress={() => Linking.openURL(item.link!)}><Text style={s.itemLink}>Wikipédia ↗</Text></TouchableOpacity>}
          {!!onAbrir && item.locacao?.disponivel && <TouchableOpacity onPress={onAbrir}><Text style={s.itemLink}>Ver no Lokyva</Text></TouchableOpacity>}
          {item.locacao && !item.locacao.disponivel && <Text style={[s.itemAviso, { color: '#DC2626' }]}>Não está mais disponível</Text>}
        </View>
        <View style={s.itemAcoes}>
          <BotaoIcone icone="arrow-up" rotulo="Subir" onPress={onSubir} />
          <BotaoIcone icone="arrow-down" rotulo="Descer" onPress={onDescer} />
          <BotaoIcone icone="swap-horizontal" rotulo="Mover para outro dia" onPress={onMover} />
          <BotaoIcone icone="create-outline" rotulo="Anotação" onPress={onAnotar} />
          <BotaoIcone icone="trash-outline" rotulo="Remover" onPress={onRemover} perigo />
        </View>
      </View>
    </View>
  );
}

function BotaoIcone({ icone, rotulo, onPress, perigo }: { icone: string; rotulo: string; onPress?: () => void; perigo?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={[s.botaoIcone, !onPress && { opacity: 0.3 }]} accessibilityLabel={rotulo} accessibilityRole="button">
      <Ionicons name={icone as any} size={17} color={perigo ? '#DC2626' : T.muted} />
    </TouchableOpacity>
  );
}

function Acao({ icone, rotulo, onPress, destaque, disabled }: { icone: string; rotulo: string; onPress: () => void; destaque?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[s.acao, destaque && { backgroundColor: T.primary }, disabled && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={rotulo}>
      <Ionicons name={icone as any} size={20} color={destaque ? '#fff' : T.ink} />
      <Text style={[s.acaoTxt, destaque && { color: '#fff' }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function ModalAdicionar({ roteiro, alvo, onFechar, onEscolher }: { roteiro: RoteiroDados; alvo: { dia: number; periodo: Periodo; pre?: Locacao }; onFechar: () => void; onEscolher: (i: ItemRoteiro) => void }) {
  const [aba, setAba] = useState<'ponto' | 'locacao' | 'nota'>(alvo.pre ? 'locacao' : 'ponto');
  const [dados, setDados] = useState<Guia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState({ titulo: '', hora: '', texto: '', custo: '' });

  const daLocacao = (l: Locacao): ItemRoteiro => ({
    tipo: 'locacao', periodo: alvo.periodo, hora: null, titulo: l.titulo, descricao: l.descricao, categoria: l.categoria, latitude: l.lat, longitude: l.lng,
    servico_id: l.tipo === 'servico' ? l.id : null, item_aluguel_id: l.tipo === 'item_aluguel' ? l.id : null,
    custo_estimado: l.tipo === 'servico' ? l.valor_com_promocao * roteiro.pessoas : l.valor_com_promocao,
    locacao: { tipo: l.tipo, id: l.id, foto: l.foto, disponivel: true },
  });

  useEffect(() => {
    if (alvo.pre) { onEscolher(daLocacao(alvo.pre)); return; }
    apiRoteiro<Guia>(`/guia-local?lat=${roteiro.latitude}&lng=${roteiro.longitude}`).then((r) => (r.ok ? setDados(r.dados) : setErro(r.erro)));
  }, []);

  const locacoes = Object.values(dados?.locacoes_proximas || {}).flatMap((g) => g.itens);
  const rotulo = PERIODOS.find(([p]) => p === alvo.periodo)?.[1];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: T.cream }}>
        <View style={s.modalTopo}>
          <View style={{ flex: 1 }}><Text style={s.folhaTitulo}>Adicionar ao dia {alvo.dia + 1}</Text><Text style={s.opcaoSub}>{rotulo} · perto de {roteiro.destino}</Text></View>
          <TouchableOpacity onPress={onFechar} style={s.botaoIcone} accessibilityLabel="Fechar"><Ionicons name="close" size={24} color={T.ink} /></TouchableOpacity>
        </View>
        <View style={s.abas}>
          {([['ponto', 'Ponto turístico'], ['locacao', 'Lokyva'], ['nota', 'Anotação']] as const).map(([id, r]) => (
            <TouchableOpacity key={id} style={[s.aba, aba === id && s.abaOn]} onPress={() => setAba(id)} accessibilityRole="tab" accessibilityState={{ selected: aba === id }}>
              <Text style={[s.abaTxt, aba === id && { color: '#fff' }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!!erro && <Text style={s.alertaTxt}>{erro}</Text>}
          {!dados && !erro && aba !== 'nota' && <ActivityIndicator color={T.primary} style={{ marginTop: 30 }} />}

          {aba === 'ponto' && dados && (dados.pontos_turisticos.length === 0 ? <Text style={s.livre}>Não conseguimos carregar pontos turísticos agora.</Text> : dados.pontos_turisticos.map((p) => (
            <View key={p.titulo} style={s.pontoLinha}>
              {p.imagem ? <Image source={{ uri: p.imagem }} style={s.pontoFoto} /> : <View style={[s.pontoFoto, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="location" size={22} color={T.faint} /></View>}
              <View style={{ flex: 1 }}><Text style={s.opcaoTxt} numberOfLines={2}>{p.titulo}</Text><Text style={s.opcaoSub}>{String(p.distancia_km).replace('.', ',')} km do centro</Text></View>
              <TouchableOpacity style={s.incluir} onPress={() => onEscolher({ tipo: 'ponto_turistico', periodo: alvo.periodo, hora: null, titulo: p.titulo, descricao: p.resumo, categoria: 'ponto_turistico', latitude: p.coordenadas.lat, longitude: p.coordenadas.lng, link: p.link, imagem: p.imagem, custo_estimado: 0 })}>
                <Text style={s.incluirTxt}>Incluir</Text>
              </TouchableOpacity>
            </View>
          )))}

          {aba === 'locacao' && dados && (locacoes.length === 0 ? <Text style={s.livre}>Não há locações do Lokyva por perto.</Text> : locacoes.map((l) => (
            <CartaoLocacao key={l.chave} l={l} acao="Incluir" largura="100%" onAcao={() => onEscolher(daLocacao(l))} />
          )))}

          {aba === 'nota' && (
            <View style={{ gap: 10 }}>
              <TextInput value={nota.titulo} onChangeText={(t) => setNota({ ...nota, titulo: t })} placeholder="Título (ex.: Comprar lembrancinhas)" placeholderTextColor={T.faint} style={s.notaInput} maxLength={250} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={nota.hora} onChangeText={(t) => setNota({ ...nota, hora: t.replace(/[^\d:]/g, '').slice(0, 5) })} placeholder="Hora (12:30)" placeholderTextColor={T.faint} style={[s.notaInput, { flex: 1 }]} keyboardType="numbers-and-punctuation" />
                <TextInput value={nota.custo} onChangeText={(t) => setNota({ ...nota, custo: t.replace(/[^\d,.]/g, '') })} placeholder="Custo (R$)" placeholderTextColor={T.faint} style={[s.notaInput, { flex: 1 }]} keyboardType="decimal-pad" />
              </View>
              <TextInput value={nota.texto} onChangeText={(t) => setNota({ ...nota, texto: t })} placeholder="Detalhes" placeholderTextColor={T.faint} style={[s.notaInput, { minHeight: 90 }]} multiline maxLength={2000} />
              <TouchableOpacity style={[s.folhaBtn, !nota.titulo.trim() && { opacity: 0.5 }]} disabled={!nota.titulo.trim()} onPress={() => {
                if (nota.hora && !/^\d{2}:\d{2}$/.test(nota.hora)) return alertar('Hora inválida', 'Use o formato HH:MM, por exemplo 12:30.');
                onEscolher({ tipo: 'anotacao', periodo: alvo.periodo, hora: nota.hora || null, titulo: nota.titulo.trim(), anotacao: nota.texto.trim() || null, latitude: null, longitude: null, custo_estimado: Number(nota.custo.replace(',', '.')) || 0 });
              }}>
                <Text style={s.folhaBtnTxt}>Adicionar anotação</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CampoData({ rotulo, valor, minimo, maximo, onChange }: { rotulo: string; valor: Date; minimo: Date; maximo?: Date; onChange: (d: Date) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TouchableOpacity style={s.campo} onPress={() => setAberto(true)} accessibilityRole="button" accessibilityLabel={`${rotulo}: ${valor.toLocaleDateString('pt-BR')}`}>
        <Ionicons name="calendar" size={18} color={T.primary} />
        <View><Text style={s.campoValor}>{valor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</Text><Text style={s.campoSub}>{valor.toLocaleDateString('pt-BR', { weekday: 'long' })}</Text></View>
      </TouchableOpacity>
      {aberto && <DateTimePicker value={valor} mode="date" minimumDate={minimo} maximumDate={maximo} display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, d) => { setAberto(Platform.OS === 'ios'); if (d) onChange(d); }} />}
    </View>
  );
}

function Formulario({ destinoInicial, ocupado, onGerar, onVoltar }: { destinoInicial: string; ocupado: boolean; onGerar: (c: Record<string, unknown>) => void; onVoltar: () => void }) {
  const hoje = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);
  const mais = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const [destino, setDestino] = useState(destinoInicial);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ida, setIda] = useState(mais(hoje, 7));
  const [volta, setVolta] = useState(mais(hoje, 9));
  const [pessoas, setPessoas] = useState(2);
  const [orcamento, setOrcamento] = useState('');
  const [interesses, setInteresses] = useState<string[]>([]);
  const [partida, setPartida] = useState<'centro' | 'hospedagem' | 'localizacao'>('centro');
  const [partidaCoords, setPartidaCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospedagem, setHospedagem] = useState(true);
  const [veiculo, setVeiculo] = useState(false);
  const dias = Math.round((volta.getTime() - ida.getTime()) / 86400000) + 1;

  const usarLocalDestino = async () => {
    const p = await pedirLocalizacao('Montamos o roteiro na região onde você está agora.');
    if (p) { setCoords(p); setDestino(''); }
  };
  const escolherPartida = async (v: typeof partida) => {
    if (v !== 'localizacao') return setPartida(v);
    const p = await pedirLocalizacao('Calculamos as distâncias a partir de onde você está.');
    if (p) { setPartidaCoords(p); setPartida('localizacao'); }
  };

  const enviar = () => {
    if (!destino.trim() && !coords) return alertar('Faltou o destino', 'Digite a cidade ou use sua localização.');
    onGerar({
      destino: coords ? undefined : destino.trim(), latitude: coords?.lat, longitude: coords?.lng,
      data_inicio: iso(ida), data_fim: iso(volta), pessoas, orcamento: Number(orcamento.replace(',', '.')) || undefined, interesses, partida,
      partida_latitude: partida === 'localizacao' ? partidaCoords?.lat : undefined, partida_longitude: partida === 'localizacao' ? partidaCoords?.lng : undefined,
      precisa_hospedagem: hospedagem, precisa_veiculo: veiculo,
    });
  };

  return (
    <View style={s.tela}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#FF9A3D', '#FF7A00', '#E8590C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <TouchableOpacity onPress={onVoltar} style={s.voltar} accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={[s.heroRotulo, { color: 'rgba(255,255,255,0.85)', marginTop: 16 }]}>ROTEIRO DE VIAGEM</Text>
          <Text style={[s.heroTitulo, { marginTop: 4 }]}>Monte o seu dia a dia de viagem</Text>
          <Text style={s.heroSub}>Pontos turísticos + hospedagem, restaurantes e passeios do Lokyva, agrupados por proximidade.</Text>
        </LinearGradient>

        <View style={s.corpo}>
          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>1 · Para onde?</Text>
            <View style={s.campo}>
              <Ionicons name="search" size={18} color={T.faint} />
              <TextInput value={destino} onChangeText={(t) => { setDestino(t); setCoords(null); }} placeholder={coords ? 'Usando a sua localização' : 'Cidade ou ponto turístico'} placeholderTextColor={coords ? T.primary : T.faint} style={{ flex: 1, fontSize: 15, color: T.ink, paddingVertical: 4 }} maxLength={120} />
            </View>
            <TouchableOpacity style={[s.linhaBtn, !!coords && { backgroundColor: T.primary }]} onPress={usarLocalDestino}>
              <Ionicons name="navigate" size={16} color={coords ? '#fff' : T.primary} /><Text style={[s.linhaBtnTxt, !!coords && { color: '#fff' }]}>{coords ? 'Usando minha localização' : 'Usar minha localização'}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>2 · Quando?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <CampoData rotulo="Ida" valor={ida} minimo={hoje} onChange={(d) => { setIda(d); if (volta < d) setVolta(d); }} />
              <CampoData rotulo="Volta" valor={volta} minimo={ida} maximo={mais(ida, 29)} onChange={setVolta} />
            </View>
            <Text style={s.duracao}>{dias} {dias === 1 ? 'dia' : 'dias'} de viagem</Text>
          </View>

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>3 · Quem vai e quanto gastar</Text>
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas((p) => Math.max(1, p - 1))} accessibilityLabel="Menos uma pessoa"><Ionicons name="remove" size={20} color={T.ink} /></TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.stepNum}>{pessoas}</Text><Text style={s.campoSub}>{pessoas === 1 ? 'pessoa' : 'pessoas'}</Text></View>
              <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas((p) => Math.min(50, p + 1))} accessibilityLabel="Mais uma pessoa"><Ionicons name="add" size={20} color={T.ink} /></TouchableOpacity>
            </View>
            <View style={[s.campo, { marginTop: 10 }]}>
              <Text style={{ fontWeight: '900', color: T.faint }}>R$</Text>
              <TextInput value={orcamento} onChangeText={(t) => setOrcamento(t.replace(/[^\d,.]/g, ''))} placeholder="Orçamento total (opcional)" placeholderTextColor={T.faint} keyboardType="decimal-pad" style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink, paddingVertical: 4 }} />
            </View>
          </View>

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>4 · Do que vocês gostam?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {INTERESSES.map(([id, r, e]) => {
                const on = interesses.includes(id);
                return (
                  <TouchableOpacity key={id} onPress={() => setInteresses(on ? interesses.filter((x) => x !== id) : [...interesses, id])} style={[s.chipInt, on && s.chipIntOn]} accessibilityState={{ selected: on }}>
                    <Text style={[s.chipIntTxt, on && { color: '#fff' }]}>{e} {r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>5 · Detalhes</Text>
            <Text style={s.rotulo}>Cada dia começa…</Text>
            {([['centro', 'No centro do destino'], ['hospedagem', 'Na hospedagem escolhida'], ['localizacao', 'Na minha localização atual']] as const).map(([v, r]) => (
              <TouchableOpacity key={v} style={[s.radio, partida === v && s.radioOn]} onPress={() => escolherPartida(v)} accessibilityRole="radio" accessibilityState={{ checked: partida === v }}>
                <Ionicons name={partida === v ? 'radio-button-on' : 'radio-button-off'} size={20} color={partida === v ? T.primary : T.faint} /><Text style={s.radioTxt}>{r}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.linhaSwitch}><View style={{ flex: 1 }}><Text style={s.radioTxt}>Incluir hospedagem do Lokyva</Text><Text style={s.campoSub}>Onde ficar perto dos passeios</Text></View><Switch value={hospedagem} onValueChange={setHospedagem} trackColor={{ true: T.primary }} thumbColor="#fff" /></View>
            <View style={s.linhaSwitch}><View style={{ flex: 1 }}><Text style={s.radioTxt}>Incluir aluguel de veículo</Text><Text style={s.campoSub}>Carro, moto ou van</Text></View><Switch value={veiculo} onValueChange={setVeiculo} trackColor={{ true: T.primary }} thumbColor="#fff" /></View>
          </View>

          <TouchableOpacity onPress={enviar} disabled={ocupado} activeOpacity={0.9} style={[s.gerar, ocupado && { opacity: 0.7 }]} accessibilityRole="button">
            {ocupado ? <><ActivityIndicator color="#fff" /><Text style={s.gerarTxt}>  Montando o roteiro…</Text></> : <><Ionicons name="sparkles" size={20} color="#FDBA74" /><Text style={s.gerarTxt}> Gerar roteiro</Text></>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const sombra = { shadowColor: '#1F1A17', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 };

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: T.cream },
  centro: { alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroTitulo: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.6, marginTop: 10, padding: 0 },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pilula: { color: '#fff', fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  heroRotulo: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 14 },
  heroTotal: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, lineHeight: 17 },
  barra: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 4 },
  corpo: { padding: 16, gap: 12 },
  aviso: { backgroundColor: T.successBg, borderRadius: 14, padding: 12 },
  avisoErro: { backgroundColor: '#FEE2E2' },
  avisoTxt: { color: '#047857', fontWeight: '700', fontSize: 13 },
  alerta: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12 },
  alertaTxt: { flex: 1, color: '#92400E', fontWeight: '700', fontSize: 12, lineHeight: 17 },
  naoSalvo: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  diaAba: { minHeight: 54, minWidth: 74, borderRadius: 16, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: T.line },
  diaAbaOn: { backgroundColor: T.ink, borderColor: T.ink },
  diaAbaNum: { fontSize: 13, fontWeight: '900', color: T.ink },
  diaAbaData: { fontSize: 11, color: T.muted, textTransform: 'capitalize' },
  diaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  diaTitulo: { flex: 1, fontSize: 17, fontWeight: '900', color: T.ink, textTransform: 'capitalize' },
  diaCusto: { fontSize: 13, fontWeight: '900', color: T.ink, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  mapaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line },
  mapaBtnTxt: { flex: 1, fontWeight: '800', color: T.ink },
  periodo: { backgroundColor: '#fff', borderRadius: 22, padding: 14, ...sombra },
  periodoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  periodoTitulo: { fontSize: 12, fontWeight: '900', color: T.muted, letterSpacing: 0.8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 40, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#FFF7ED' },
  addTxt: { color: '#E8590C', fontWeight: '900', fontSize: 12 },
  livre: { fontSize: 13, color: T.faint, textAlign: 'center', paddingVertical: 14 },
  desloc: { fontSize: 11, color: T.faint, fontWeight: '700', marginLeft: 44, marginVertical: 4 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  itemNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemNumTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
  itemFoto: { width: 64, height: 54, borderRadius: 12, backgroundColor: '#F3F4F6' },
  itemHora: { fontSize: 12, fontWeight: '900', color: T.ink },
  itemTag: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  itemTitulo: { fontSize: 15, fontWeight: '900', color: T.ink, marginTop: 2 },
  itemDesc: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 16 },
  itemNota: { fontSize: 12, color: '#713F12', backgroundColor: '#FEF9C3', borderRadius: 10, padding: 8, marginTop: 6, overflow: 'hidden' },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  itemAviso: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  itemCusto: { fontSize: 12, fontWeight: '900', color: T.ink },
  itemLink: { fontSize: 12, fontWeight: '900', color: '#E8590C', paddingVertical: 4 },
  itemAcoes: { flexDirection: 'row', gap: 6, marginTop: 6 },
  botaoIcone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F8' },
  flash: { backgroundColor: '#FEF2F2', borderRadius: 22, padding: 14 },
  flashTitulo: { fontSize: 15, fontWeight: '900', color: '#991B1B' },
  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: T.line },
  acao: { flex: 1, minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2 },
  acaoTxt: { fontSize: 11, fontWeight: '800', color: T.ink },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  folha: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 },
  folhaTitulo: { fontSize: 18, fontWeight: '900', color: T.ink, marginBottom: 8 },
  folhaBtn: { minHeight: 50, borderRadius: 16, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', flex: 1 },
  folhaBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  opcao: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: T.line },
  opcaoTxt: { fontSize: 14, fontWeight: '800', color: T.ink },
  opcaoSub: { fontSize: 12, color: T.muted },
  notaInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 12, fontSize: 15, color: T.ink, textAlignVertical: 'top' },
  okIcone: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pedidoMsg: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 10 },
  pedidoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  pedidoTotal: { fontSize: 15, fontWeight: '900', color: T.ink, textAlign: 'right', marginTop: 8 },
  modalTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff' },
  abas: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  aba: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  abaOn: { backgroundColor: T.ink },
  abaTxt: { fontSize: 13, fontWeight: '800', color: T.muted },
  pontoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 8 },
  pontoFoto: { width: 64, height: 56, borderRadius: 12, backgroundColor: '#F3F4F6' },
  incluir: { backgroundColor: T.primary, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  incluirTxt: { color: '#fff', fontWeight: '900' },
  bloco: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 8, ...sombra },
  blocoTitulo: { fontSize: 16, fontWeight: '900', color: T.ink, marginBottom: 2 },
  rotulo: { fontSize: 11, fontWeight: '800', color: T.faint, textTransform: 'uppercase', marginBottom: 4 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cream, borderRadius: 16, paddingHorizontal: 14, minHeight: 54, borderWidth: 1, borderColor: T.line },
  campoValor: { fontSize: 16, fontWeight: '900', color: T.ink },
  campoSub: { fontSize: 11, color: T.muted, textTransform: 'capitalize' },
  linhaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 14, backgroundColor: T.primarySoft },
  linhaBtnTxt: { color: T.primaryDark, fontWeight: '800' },
  duracao: { fontSize: 12, fontWeight: '900', color: T.primaryDark },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cream, borderRadius: 18, padding: 6, borderWidth: 1, borderColor: T.line },
  stepBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 22, fontWeight: '900', color: T.ink },
  chipInt: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: T.cream, borderWidth: 1, borderColor: T.line },
  chipIntOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipIntTxt: { fontSize: 13, fontWeight: '800', color: T.ink },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line },
  radioOn: { borderColor: T.primary, backgroundColor: '#FFF8F1' },
  radioTxt: { fontSize: 14, fontWeight: '700', color: T.ink },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line, marginTop: 4 },
  gerar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 58, borderRadius: 20, backgroundColor: T.ink },
  gerarTxt: { color: '#fff', fontWeight: '900', fontSize: 17 },
});
