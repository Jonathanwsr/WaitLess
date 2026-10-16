import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Vazio, Erro, api, dataCurta, brl, Metrica } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { alertar } from '../../services/alertar';

interface CupomOpcao { id: number; codigo: string; titulo: string }
interface Dados {
  locais: { id: number; nome: string }[];
  semLocal?: boolean;
  estabelecimento?: { id: number; nome: string };
  publico?: number;
  cupons?: CupomOpcao[];
  enviadas_hoje?: number;
  limite_por_dia?: number;
  historico?: { id: number; titulo: string; destinatarios: number; created_at: string; cupom?: { codigo: string } | null; resultado?: Resultado }[];
  resultados?: Resultado & { dias: number; ofertas: number };
}
interface Resultado { destinatarios: number; leram: number; usaram_cupom: number; reservaram: number; receita: number; conversao: number }

/** Ofertas Exclusivas via Mensagem: cupom + comunicado para quem favoritou o local. */
export default function OfertasFavoritos() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const [localId, setLocalId] = useState<number | null>(idParam ? Number(idParam) : null);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [cupomId, setCupomId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(async () => {
    const dash = await api('/proprietario/dashboard');
    const locais = dash?.estabelecimentos || [];
    const id = localId ?? locais[0]?.id;
    if (!id) return { locais, semLocal: true };
    const p = await api(`/proprietario/ofertas-favoritos?estabelecimento_id=${id}`);
    return { locais, ...p };
  }, [localId]);

  const publico = dados?.publico ?? 0;
  const restantes = Math.max(0, (dados?.limite_por_dia ?? 0) - (dados?.enviadas_hoje ?? 0));
  const cupom = dados?.cupons?.find((c) => c.id === cupomId);
  const pronto = publico > 0 && restantes > 0 && titulo.trim().length >= 3 && mensagem.trim().length >= 5;

  const enviar = () => alertar('Enviar oferta', `A oferta vai para ${publico} ${publico === 1 ? 'cliente' : 'clientes'} que favoritaram ${dados?.estabelecimento?.nome}.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Enviar', onPress: async () => {
      setEnviando(true);
      try {
        const r = await api('/proprietario/ofertas-favoritos', { method: 'POST', body: { estabelecimento_id: dados?.estabelecimento?.id, titulo: titulo.trim(), mensagem: mensagem.trim(), cupom_id: cupomId } });
        mostrarSucesso('Oferta enviada!', r?.mensagem || 'Os clientes já receberam no chat.');
        setTitulo(''); setMensagem(''); setCupomId(null);
        recarregar();
      } catch (e: any) {
        mostrarErro(e);
      } finally {
        setEnviando(false);
      }
    } },
  ]);

  return (
    <OwnerScreen titulo="Ofertas para quem favoritou" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro && !dados ? <Erro mensagem={erro} aoTentar={recarregar} /> : dados && (
        <>
          {dados.locais.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {dados.locais.map((l) => {
                const on = l.id === (dados.estabelecimento?.id ?? localId);
                return (
                  <TouchableOpacity key={l.id} style={[s.chip, on && s.chipOn]} onPress={() => setLocalId(l.id)}>
                    <Text style={[s.chipTxt, on && { color: '#fff' }]}>{l.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {dados.semLocal ? (
            <Card><Vazio icone="storefront-outline" titulo="Cadastre um local" texto="As ofertas vão para quem favoritou o seu local." /></Card>
          ) : (
            <>
              <View style={s.topo}>
                <View style={s.topoIcone}><Ionicons name="heart" size={22} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.topoNum}>{publico}</Text>
                  <Text style={s.topoTxt}>{publico === 1 ? 'cliente favoritou' : 'clientes favoritaram'} {dados.estabelecimento?.nome}, um serviço ou uma reserva dele</Text>
                </View>
              </View>

              <Card>
                <Rotulo>Nova oferta</Rotulo>
                <TextInput style={s.input} value={titulo} onChangeText={setTitulo} maxLength={120} placeholder="Título (ex.: 20% para quem nos segue)" placeholderTextColor={O.muted} />
                <TextInput style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]} value={mensagem} onChangeText={setMensagem} maxLength={1000} multiline placeholder="Mensagem que os clientes vão receber no chat" placeholderTextColor={O.muted} />

                <Text style={s.label}>Cupom (opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity style={[s.chip, cupomId === null && s.chipOn]} onPress={() => setCupomId(null)}>
                    <Text style={[s.chipTxt, cupomId === null && { color: '#fff' }]}>Sem cupom</Text>
                  </TouchableOpacity>
                  {(dados.cupons || []).map((c) => (
                    <TouchableOpacity key={c.id} style={[s.chip, cupomId === c.id && s.chipOn]} onPress={() => setCupomId(c.id)}>
                      <Text style={[s.chipTxt, cupomId === c.id && { color: '#fff' }]}>{c.codigo}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {(dados.cupons || []).length === 0 && <Text style={s.dica}>Você ainda não tem cupons ativos neste local. Crie um em Marketing no site.</Text>}
                <Text style={s.dica}>O cupom já entra na carteira de cada cliente, sem custar pontos. Até {dados.limite_por_dia} ofertas por dia ({restantes} {restantes === 1 ? 'restante' : 'restantes'} hoje).</Text>

                <Text style={[s.label, { marginTop: 14 }]}>Como o cliente vai ver</Text>
                <View style={s.previa}>
                  <Text style={s.previaRotulo}>🎁 OFERTA EXCLUSIVA · {dados.estabelecimento?.nome?.toUpperCase()}</Text>
                  <Text style={s.previaTitulo}>{titulo || 'Título da oferta'}</Text>
                  <Text style={s.previaTexto}>{mensagem || 'Sua mensagem aparece aqui.'}</Text>
                  {!!cupom && <View style={s.previaCupom}><Text style={s.previaCodigo}>{cupom.codigo}</Text><Text style={s.previaCupomTxt}>{cupom.titulo}</Text></View>}
                </View>

                <TouchableOpacity style={[s.botao, (!pronto || enviando) && { opacity: 0.5 }]} disabled={!pronto || enviando} onPress={enviar}>
                  {enviando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={s.botaoTxt}>Enviar para {publico} {publico === 1 ? 'cliente' : 'clientes'}</Text></>}
                </TouchableOpacity>
                {publico === 0 && <Text style={s.dica}>Ninguém favoritou ainda. Use "Divulgar meu local" para ganhar seguidores.</Text>}
              </Card>

              {!!dados.resultados?.ofertas && (
                <Card>
                  <Rotulo>Resultado · últimos {dados.resultados.dias} dias</Rotulo>
                  <View style={s.metricas}>
                    <Metrica rotulo="Leram" valor={`${dados.resultados.leram}/${dados.resultados.destinatarios}`} icone="eye-outline" />
                    <Metrica rotulo="Reservaram" valor={`${dados.resultados.reservaram} · ${String(dados.resultados.conversao).replace('.', ',')}%`} icone="calendar-outline" tom="positivo" />
                  </View>
                  <View style={[s.metricas, { marginTop: 8 }]}>
                    <Metrica rotulo="Cupons usados" valor={dados.resultados.usaram_cupom} icone="ticket-outline" />
                    <Metrica rotulo="Gerou" valor={brl(dados.resultados.receita)} icone="cash-outline" tom="positivo" />
                  </View>
                  <Text style={s.dica}>Conta quem reservou neste local em até 14 dias depois de receber a oferta.</Text>
                </Card>
              )}

              {!!dados.historico?.length && (
                <Card>
                  <Rotulo>Últimos envios</Rotulo>
                  {dados.historico.map((h) => (
                    <View key={h.id} style={s.hist}>
                      <Text style={s.histTitulo} numberOfLines={1}>{h.titulo}{h.cupom ? ` · ${h.cupom.codigo}` : ''}</Text>
                      <Text style={s.histSub}>
                        {dataCurta(h.created_at)} · {h.destinatarios} receberam
                        {h.resultado ? ` · ${h.resultado.leram} leram · ${h.resultado.reservaram} reservaram${h.resultado.receita > 0 ? ` (${brl(h.resultado.receita)})` : ''}` : ''}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  chipOn: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF1F2', borderRadius: 22, padding: 16, marginBottom: 12 },
  topoIcone: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#F43F5E', alignItems: 'center', justifyContent: 'center' },
  topoNum: { fontSize: 26, fontWeight: '900', color: O.ink },
  topoTxt: { fontSize: 12, color: O.muted, lineHeight: 17 },
  input: { backgroundColor: '#F7F7F8', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: O.ink, marginTop: 10 },
  label: { fontSize: 12, fontWeight: '800', color: O.muted, marginTop: 12, marginBottom: 8 },
  dica: { fontSize: 12, color: O.muted, marginTop: 8, lineHeight: 17 },
  previa: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 16, padding: 12 },
  previaRotulo: { fontSize: 10, fontWeight: '900', color: '#F43F5E' },
  previaTitulo: { fontSize: 15, fontWeight: '900', color: O.ink, marginTop: 3 },
  previaTexto: { fontSize: 13, color: O.muted, marginTop: 3, lineHeight: 18 },
  previaCupom: { marginTop: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#86EFAC', backgroundColor: '#F0FDF4', borderRadius: 12, padding: 8 },
  previaCodigo: { fontSize: 15, fontWeight: '900', color: '#166534' },
  previaCupomTxt: { fontSize: 11, color: '#15803D' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 26, backgroundColor: O.accent, marginTop: 16 },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  metricas: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hist: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F1F3' },
  histTitulo: { fontSize: 14, fontWeight: '700', color: O.ink },
  histSub: { fontSize: 12, color: O.muted },
});
