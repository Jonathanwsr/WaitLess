import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreen, Card, Pilula, Vazio, Erro, Segmentado, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { alertar } from '../../services/alertar';
import { O } from '../../constants/OwnerTheme';

type Opcao = { tipo: 'item_aluguel' | 'servico'; id: number; nome: string; categoria?: string | null; cidade?: string | null; valor: number };
type Deal = {
  id: number; alvo_nome: string; percentual: number; quantidade: number; usados: number; cidade: string | null;
  status: 'ativo' | 'esgotado' | 'encerrado' | 'cancelado'; inicia_em: string; expira_em: string; notificados: number; clicados: number;
};
type Dados = {
  opcoes: { itens: Opcao[]; servicos: Opcao[] };
  deals: Deal[];
  limites: { percentual_min: number; percentual_max: number; quantidade_max: number; duracao_padrao: number; raio_padrao: number; por_dia: number };
};

const DURACOES = [30, 60, 120, 180, 240, 360];
const RAIOS = [5, 10, 30, 50, 100];
const DESCONTOS = [10, 20, 30, 40, 50, 60, 70];
const STATUS: Record<Deal['status'], { texto: string; tom: 'positivo' | 'alerta' | 'neutro' }> = {
  ativo: { texto: 'No ar', tom: 'positivo' },
  esgotado: { texto: 'Esgotado', tom: 'alerta' },
  encerrado: { texto: 'Encerrado', tom: 'neutro' },
  cancelado: { texto: 'Cancelado', tom: 'neutro' },
};

const duracaoTxt = (min: number) => (min < 60 ? `${min} min` : `${min / 60}h`);

function Restante({ ate }: { ate: string }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(ate).getTime() - agora);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return <Text style={s.restante}>acaba em {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}m {String(sec).padStart(2, '0')}s</Text>;
}

function Chips<T extends number>({ valores, valor, aoMudar, rotulo }: { valores: T[]; valor: T; aoMudar: (v: T) => void; rotulo: (v: T) => string }) {
  return (
    <View style={s.chips}>
      {valores.map((v) => (
        <TouchableOpacity key={v} style={[s.chip, v === valor && s.chipOn]} onPress={() => aoMudar(v)} activeOpacity={0.8}>
          <Text style={[s.chipTxt, v === valor && s.chipTxtOn]}>{rotulo(v)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Flash Deals: o sócio/gerente lança um desconto relâmpago para vagas ociosas e avisamos quem está na cidade. */
export default function FlashDeals() {
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(() => api('/proprietario/flash-deals'));

  const [aba, setAba] = useState<'item_aluguel' | 'servico'>('item_aluguel');
  const [alvoId, setAlvoId] = useState<number | null>(null);
  const [percentual, setPercentual] = useState(50);
  const [quantidade, setQuantidade] = useState('5');
  const [duracao, setDuracao] = useState(120);
  const [raio, setRaio] = useState(30);
  const [enviando, setEnviando] = useState(false);

  const lista = useMemo(() => (aba === 'item_aluguel' ? dados?.opcoes.itens : dados?.opcoes.servicos) || [], [dados, aba]);
  const escolhido = lista.find((o) => o.id === alvoId) || null;

  useEffect(() => {
    if (dados && !dados.opcoes.itens.length && dados.opcoes.servicos.length) setAba('servico');
  }, [dados]);
  useEffect(() => { setAlvoId(lista[0]?.id ?? null); }, [lista]);

  const lancar = async () => {
    if (!alvoId) return;
    setEnviando(true);
    try {
      const r = await api('/proprietario/flash-deals', {
        method: 'POST',
        body: { alvo_tipo: aba, alvo_id: alvoId, percentual, quantidade: Number(quantidade) || 1, duracao_minutos: duracao, raio_km: raio },
      });
      mostrarSucesso('Flash Deal no ar!', r?.message);
      atualizar();
    } catch (e) {
      mostrarErro(e, 'Não foi possível lançar');
    } finally {
      setEnviando(false);
    }
  };

  const encerrar = (deal: Deal) => {
    alertar('Encerrar Flash Deal?', `"${deal.alvo_nome}" volta ao preço normal na hora.`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Encerrar', style: 'destructive', onPress: async () => {
          try {
            await api(`/proprietario/flash-deals/${deal.id}/cancelar`, { method: 'POST' });
            atualizar();
          } catch (e) {
            mostrarErro(e);
          }
        },
      },
    ]);
  };

  return (
    <OwnerScreen titulo="Flash Deals" subtitulo="Vaga ociosa vira receita agora" carregando={carregando} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro ? <Erro mensagem={erro} aoTentar={recarregar} /> : dados && (
        <>
          <View style={s.hero}>
            <Ionicons name="flash" size={26} color="#fff" />
            <Text style={s.heroTitulo}>Sobrou quarto, carro ou mesa?</Text>
            <Text style={s.heroTxt}>
              Lance um desconto por tempo curto. Avisamos na hora só quem está na sua cidade. Acabou o tempo ou as vagas, o preço normal volta sozinho.
            </Text>
          </View>

          <Card>
            <Segmentado
              opcoes={[{ id: 'item_aluguel', rotulo: `Reservas (${dados.opcoes.itens.length})` }, { id: 'servico', rotulo: `Serviços (${dados.opcoes.servicos.length})` }]}
              valor={aba}
              aoMudar={(v) => setAba(v as 'item_aluguel' | 'servico')}
            />

            {lista.length === 0 ? (
              <Text style={s.vazioTxt}>Nenhum {aba === 'item_aluguel' ? 'item de reserva' : 'serviço'} ativo para colocar em oferta.</Text>
            ) : (
              <>
                <Text style={s.label}>O que está ocioso?</Text>
                <View style={{ gap: 8 }}>
                  {lista.map((o) => (
                    <TouchableOpacity key={o.id} style={[s.opcao, o.id === alvoId && s.opcaoOn]} onPress={() => setAlvoId(o.id)} activeOpacity={0.85}>
                      <Ionicons name={o.id === alvoId ? 'radio-button-on' : 'radio-button-off'} size={18} color={o.id === alvoId ? O.accent : O.faint} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.opcaoNome} numberOfLines={1}>{o.nome}</Text>
                        <Text style={s.opcaoSub} numberOfLines={1}>{[o.cidade, brl(o.valor)].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Desconto</Text>
                <Chips valores={DESCONTOS} valor={percentual} aoMudar={setPercentual} rotulo={(v) => `${v}%`} />
                {escolhido && (
                  <Text style={s.preco}>
                    <Text style={s.precoAntigo}>{brl(escolhido.valor)}</Text>  {brl(escolhido.valor * (1 - percentual / 100))}
                  </Text>
                )}

                <Text style={s.label}>Vagas (máx. {dados.limites.quantidade_max})</Text>
                <TextInput style={s.input} keyboardType="number-pad" value={quantidade} onChangeText={(t) => setQuantidade(t.replace(/\D/g, '').slice(0, 2))} />

                <Text style={s.label}>Dura</Text>
                <Chips valores={DURACOES} valor={duracao} aoMudar={setDuracao} rotulo={duracaoTxt} />

                <Text style={s.label}>Avisar quem está a até</Text>
                <Chips valores={RAIOS} valor={raio} aoMudar={setRaio} rotulo={(v) => `${v} km`} />

                <TouchableOpacity style={[s.botao, (enviando || !alvoId) && { opacity: 0.6 }]} onPress={lancar} disabled={enviando || !alvoId} activeOpacity={0.85}>
                  {enviando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="flash" size={18} color="#fff" /><Text style={s.botaoTxt}>Lançar e avisar quem está perto</Text></>}
                </TouchableOpacity>
                <Text style={s.nota}>Até {dados.limites.por_dia} por dia. Cada cliente recebe no máximo 3 ofertas relâmpago por dia.</Text>
              </>
            )}
          </Card>

          <Text style={s.secao}>Seus Flash Deals</Text>
          {dados.deals.length === 0 ? (
            <Vazio icone="flash-outline" titulo="Nenhum Flash Deal ainda" texto="Os deals que você lançar aparecem aqui com avisados, aberturas e vendas." />
          ) : dados.deals.map((d) => (
            <Card key={d.id}>
              <View style={s.dealTopo}>
                <View style={s.selo}><Text style={s.seloTxt}>-{d.percentual}%</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoNome} numberOfLines={1}>{d.alvo_nome}</Text>
                  {d.status === 'ativo' ? <Restante ate={d.expira_em} /> : <Text style={s.opcaoSub}>{d.cidade || ''}</Text>}
                </View>
                <Pilula texto={STATUS[d.status]?.texto || d.status} tom={STATUS[d.status]?.tom || 'neutro'} />
              </View>
              <View style={s.numeros}>
                <Text style={s.numero}><Text style={s.numeroForte}>{d.notificados}</Text> avisados</Text>
                <Text style={s.numero}><Text style={s.numeroForte}>{d.clicados}</Text> abriram</Text>
                <Text style={s.numero}><Text style={s.numeroForte}>{d.usados}/{d.quantidade}</Text> vendidas</Text>
              </View>
              {d.status === 'ativo' && (
                <TouchableOpacity style={s.encerrar} onPress={() => encerrar(d)} activeOpacity={0.8}>
                  <Ionicons name="close-circle-outline" size={16} color={O.danger} />
                  <Text style={s.encerrarTxt}>Encerrar agora</Text>
                </TouchableOpacity>
              )}
            </Card>
          ))}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: O.accent, borderRadius: 20, padding: 18, gap: 6, marginBottom: 14 },
  heroTitulo: { color: '#fff', fontSize: 18, fontWeight: '900' },
  heroTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 19 },
  vazioTxt: { color: O.muted, fontSize: 13, marginTop: 12 },
  label: { fontSize: 13, fontWeight: '800', color: O.ink, marginTop: 16, marginBottom: 8 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: O.line },
  opcaoOn: { borderColor: O.accent, backgroundColor: '#FFF7ED' },
  opcaoNome: { fontSize: 14, fontWeight: '800', color: O.ink },
  opcaoSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: O.soft },
  chipOn: { backgroundColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.muted },
  chipTxtOn: { color: '#fff' },
  preco: { fontSize: 16, fontWeight: '900', color: O.ink, marginTop: 8 },
  precoAntigo: { textDecorationLine: 'line-through', color: O.faint, fontWeight: '600', fontSize: 14 },
  input: { borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: O.ink, width: 100 },
  botao: { marginTop: 20, backgroundColor: O.accent, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  nota: { fontSize: 11, color: O.faint, textAlign: 'center', marginTop: 8 },
  secao: { fontSize: 16, fontWeight: '900', color: O.ink, marginTop: 20, marginBottom: 10 },
  dealTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selo: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  seloTxt: { color: O.accent, fontWeight: '900', fontSize: 15 },
  restante: { fontSize: 12, color: O.success, fontWeight: '700', marginTop: 2 },
  numeros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: O.line },
  numero: { fontSize: 12, color: O.muted },
  numeroForte: { fontWeight: '900', color: O.ink, fontSize: 14 },
  encerrar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginTop: 10 },
  encerrarTxt: { color: O.danger, fontWeight: '800', fontSize: 13 },
});
