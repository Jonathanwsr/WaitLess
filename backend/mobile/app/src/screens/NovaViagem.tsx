import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, StatusBar, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import EstadosExplorar from '../../../components/client/EstadosExplorar';
import ItemViagem, { ItemRoteiro } from '../../../components/viagem/ItemViagem';
import { agruparPorDia, apiViagem, brl, diaLongo, isoData } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';

const INTERESSES: [string, keyof typeof Ionicons.glyphMap][] = [
  ['praia', 'sunny-outline'], ['gastronomia', 'restaurant-outline'], ['aventura', 'trail-sign-outline'], ['cultura', 'library-outline'],
  ['bem-estar', 'leaf-outline'], ['família', 'people-outline'], ['vida noturna', 'moon-outline'], ['natureza', 'flower-outline'],
];
const RITMOS: [string, string, string, keyof typeof Ionicons.glyphMap][] = [
  ['leve', 'Leve', '2 paradas/dia', 'cafe-outline'], ['moderado', 'Moderado', '3 paradas/dia', 'walk-outline'], ['intenso', 'Intenso', '4 paradas/dia', 'flash-outline'],
];
const TOPO = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

function Etapa({ n, titulo, icone, children }: { n: number; titulo: string; icone: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.etapaTopo}>
        <View style={s.etapaNum}><Text style={s.etapaNumTxt}>{n}</Text></View>
        <Text style={s.etapaTitulo}>{titulo}</Text>
        <Ionicons name={icone} size={18} color={T.faint} style={{ marginLeft: 'auto' }} />
      </View>
      {children}
    </View>
  );
}

type Previa = { cidade: string; estado: string | null; dias: number; itens: ItemRoteiro[]; avisos: string[]; resumo: { total_estimado: number; itens_premium: number } };

function CampoData({ rotulo, valor, minimo, onChange }: { rotulo: string; valor: Date | null; minimo: Date; onChange: (d: Date) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TouchableOpacity style={[s.campoData, !!valor && s.campoDataOn]} onPress={() => setAberto(true)} activeOpacity={0.8}>
        <Ionicons name="calendar" size={18} color={valor ? T.primary : T.faint} />
        <View>
          <Text style={[s.dataTxt, !valor && { color: T.faint }]}>{valor ? valor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'Escolher'}</Text>
          {!!valor && <Text style={s.dataSemana}>{valor.toLocaleDateString('pt-BR', { weekday: 'long' })}</Text>}
        </View>
      </TouchableOpacity>
      {aberto && (
        <DateTimePicker
          value={valor || minimo}
          mode="date"
          minimumDate={minimo}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => { setAberto(Platform.OS === 'ios'); if (d) onChange(d); }}
        />
      )}
    </View>
  );
}

export default function NovaViagem() {
  const router = useRouter();
  const hoje = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);
  const [cidade, setCidade] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ida, setIda] = useState<Date | null>(null);
  const [volta, setVolta] = useState<Date | null>(null);
  const [pessoas, setPessoas] = useState('2');
  const [orcamento, setOrcamento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [ritmo, setRitmo] = useState('moderado');
  const [hospedagem, setHospedagem] = useState(true);
  const [veiculo, setVeiculo] = useState(false);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [itens, setItens] = useState<ItemRoteiro[]>([]);
  const [bloqueado, setBloqueado] = useState(false);

  const pedido = () => ({
    cidade: cidade.trim() || undefined,
    latitude: !cidade.trim() && coords ? coords.lat : undefined,
    longitude: !cidade.trim() && coords ? coords.lng : undefined,
    data_inicio: ida ? isoData(ida) : '',
    data_fim: volta ? isoData(volta) : '',
    pessoas: Number(pessoas) || 1,
    orcamento: Number(orcamento.replace(',', '.')) || undefined,
    preferencias: { ritmo, precisa_hospedagem: hospedagem, precisa_veiculo: veiculo, interesses },
  });

  const usarLocalizacao = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return alertar('Localização', 'Sem permissão de localização. Digite a cidade de destino.');
    try {
      const p = await Location.getCurrentPositionAsync({});
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
      setCidade('');
      alertar('Localização captada', 'Vamos montar o roteiro na cidade mais próxima que tenha serviços do Lokyva.');
    } catch { alertar('Localização', 'Não foi possível obter sua localização. Digite a cidade.'); }
  };

  const gerar = async () => {
    if (!cidade.trim() && !coords) return alertar('Faltou o destino', 'Digite a cidade ou use sua localização.');
    if (!ida || !volta) return alertar('Faltaram as datas', 'Escolha a data de ida e a de volta.');
    if (volta < ida) return alertar('Datas inválidas', 'A volta precisa ser depois da ida.');

    setGerando(true);
    const r = await apiViagem<Previa>('/roteiro/previa', 'POST', pedido());
    setGerando(false);
    if (!r.ok) {
      if (r.status === 403) setBloqueado(true);
      return alertar(r.status === 403 ? 'Recurso Premium' : 'Não foi possível montar', r.erro || '');
    }
    setPrevia(r.dados);
    setItens(r.dados.itens);
  };

  const salvar = async () => {
    if (!previa) return;
    setSalvando(true);
    const r = await apiViagem<{ viagem_id: number }>('', 'POST', { ...pedido(), cidade: previa.cidade, estado: previa.estado || undefined, latitude: undefined, longitude: undefined, titulo: titulo.trim(), itens });
    setSalvando(false);
    if (!r.ok) return alertar('Não foi possível salvar', r.erro || '');
    router.replace(`/src/screens/ViagemDetalhe?id=${r.dados.viagem_id}` as never);
  };

  const total = itens.reduce((sum, i) => sum + Number(i.custo_estimado || 0), 0);
  const orc = Number(orcamento.replace(',', '.')) || null;
  const agrupado = useMemo(() => agruparPorDia(itens as any), [itens]);
  const remover = (i: ItemRoteiro) => setItens((l) => l.filter((x) => x !== i));

  const qtdPessoas = Math.max(Number(pessoas) || 1, 1);
  const dias = ida && volta ? Math.round((volta.getTime() - ida.getTime()) / 86400000) + 1 : null;
  const usoOrc = orc ? Math.min(100, (total / orc) * 100) : null;

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#FF9A3D', '#FF7A00', '#E8590C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: TOPO }]}>
          <View style={s.bolha} />
          <Ionicons name="map" size={140} color="rgba(255,255,255,0.10)" style={s.heroMapa} />
          <TouchableOpacity onPress={() => router.back()} style={s.voltar} hitSlop={10}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <View style={s.heroPill}><Ionicons name="sparkles" size={12} color="#fff" /><Text style={s.heroPillTxt}> Roteiro inteligente</Text></View>
          <Text style={s.heroTitulo}>Monte a viagem{'\n'}em 1 minuto</Text>
          <Text style={s.heroSub}>Diga para onde, quando e quanto quer gastar. A gente sugere hospedagem, passeios e serviços dos parceiros Lokyva.</Text>
        </LinearGradient>

        <View style={s.corpo}>
          {bloqueado && (
            <View style={s.bloqueio}>
              <View style={s.bloqueioIcone}><Ionicons name="lock-closed" size={18} color={T.primary} /></View>
              <Text style={s.bloqueioTxt}>O roteiro inteligente é exclusivo para assinantes Premium.</Text>
              <TouchableOpacity style={s.bloqueioBtn} onPress={() => router.push('/assinatura' as never)}><Text style={s.bloqueioBtnTxt}>Ver planos</Text></TouchableOpacity>
            </View>
          )}

          <Etapa n={1} titulo="Para onde você vai?" icone="location-outline">
            <View style={s.destinoLinha}>
              <View style={s.destinoInput}>
                <Ionicons name="search" size={18} color={T.faint} />
                <TextInput style={s.destinoTxt} placeholder={coords ? 'Usando sua localização' : 'Ex.: Maceió'} placeholderTextColor={coords ? T.primary : T.faint} value={cidade} onChangeText={(v) => { setCidade(v); setCoords(null); }} />
              </View>
              <TouchableOpacity style={[s.gps, !!coords && { backgroundColor: T.primary }]} onPress={usarLocalizacao} activeOpacity={0.85}>
                <Ionicons name="navigate" size={20} color={coords ? '#fff' : T.primary} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12 }}>
              <EstadosExplorar subtitulo="Ou toque em um estado para ver o que tem por lá." />
            </View>
          </Etapa>

          <Etapa n={2} titulo="Quando?" icone="calendar-outline">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <CampoData rotulo="Ida" valor={ida} minimo={hoje} onChange={(d) => { setIda(d); if (volta && volta < d) setVolta(null); }} />
              <CampoData rotulo="Volta" valor={volta} minimo={ida || hoje} onChange={setVolta} />
            </View>
            {dias != null && dias > 0 && (
              <View style={s.duracao}><Ionicons name="time-outline" size={14} color={T.primaryDark} /><Text style={s.duracaoTxt}> {dias} {dias === 1 ? 'dia' : 'dias'} de viagem</Text></View>
            )}
          </Etapa>

          <Etapa n={3} titulo="Quem vai e quanto gastar" icone="wallet-outline">
            <Text style={s.rotulo}>Pessoas</Text>
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas(String(Math.max(1, qtdPessoas - 1)))} disabled={qtdPessoas <= 1}>
                <Ionicons name="remove" size={20} color={qtdPessoas <= 1 ? T.faint : T.ink} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={s.stepNum}>{qtdPessoas}</Text>
                <Text style={s.stepTxt}>{qtdPessoas === 1 ? 'pessoa' : 'pessoas'}</Text>
              </View>
              <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas(String(Math.min(50, qtdPessoas + 1)))}>
                <Ionicons name="add" size={20} color={T.ink} />
              </TouchableOpacity>
            </View>

            <Text style={[s.rotulo, { marginTop: 16 }]}>Orçamento total (opcional)</Text>
            <View style={s.dinheiro}>
              <Text style={s.cifrao}>R$</Text>
              <TextInput style={s.dinheiroInput} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={T.faint} value={orcamento} onChangeText={setOrcamento} />
            </View>
            {!!orc && qtdPessoas > 1 && <Text style={s.dica}>≈ {brl(orc / qtdPessoas)} por pessoa</Text>}
          </Etapa>

          <Etapa n={4} titulo="O seu estilo" icone="heart-outline">
            <Text style={s.rotulo}>Ritmo</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RITMOS.map(([v, n, d, icone]) => {
                const on = ritmo === v;
                return (
                  <TouchableOpacity key={v} onPress={() => setRitmo(v)} style={[s.ritmo, on && s.ritmoOn]} activeOpacity={0.85}>
                    <View style={[s.ritmoIcone, on && { backgroundColor: T.primary }]}><Ionicons name={icone} size={18} color={on ? '#fff' : T.muted} /></View>
                    <Text style={[s.ritmoNome, on && { color: T.primaryDark }]}>{n}</Text>
                    <Text style={s.ritmoDesc}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.rotulo, { marginTop: 16 }]}>Interesses (opcional)</Text>
            <View style={s.chips}>
              {INTERESSES.map(([i, icone]) => {
                const on = interesses.includes(i);
                return (
                  <TouchableOpacity key={i} onPress={() => setInteresses(on ? interesses.filter((x) => x !== i) : [...interesses, i])} style={[s.chip, on && s.chipOn]} activeOpacity={0.85}>
                    <Ionicons name={icone} size={14} color={on ? '#fff' : T.muted} />
                    <Text style={[s.chipTxt, on && { color: '#fff' }]}> {i}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.linhaSwitch}>
              <View style={[s.switchIcone, { backgroundColor: '#EEF2FF' }]}><Ionicons name="bed-outline" size={18} color="#4F46E5" /></View>
              <View style={{ flex: 1 }}><Text style={s.switchTxt}>Incluir hospedagem</Text><Text style={s.switchSub}>Casas, quartos e hotéis dos parceiros</Text></View>
              <Switch value={hospedagem} onValueChange={setHospedagem} trackColor={{ true: T.primary }} thumbColor="#fff" />
            </View>
            <View style={s.linhaSwitch}>
              <View style={[s.switchIcone, { backgroundColor: '#E0F2FE' }]}><Ionicons name="car-outline" size={18} color="#0284C7" /></View>
              <View style={{ flex: 1 }}><Text style={s.switchTxt}>Incluir aluguel de veículo</Text><Text style={s.switchSub}>Carro, moto ou van para o grupo</Text></View>
              <Switch value={veiculo} onValueChange={setVeiculo} trackColor={{ true: T.primary }} thumbColor="#fff" />
            </View>
          </Etapa>

          <TouchableOpacity onPress={gerar} disabled={gerando} activeOpacity={0.9} style={gerando && { opacity: 0.7 }}>
            <LinearGradient colors={['#FF9A3D', '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.botao}>
              {gerando
                ? <><ActivityIndicator color="#fff" /><Text style={s.botaoTxt}>  Montando o seu roteiro…</Text></>
                : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.botaoTxt}> {previa ? 'Montar de novo' : 'Montar roteiro'}</Text></>}
            </LinearGradient>
          </TouchableOpacity>

          {previa && (
            <>
              <LinearGradient colors={['#1F1A17', '#3A2414']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.resumo}>
                <Text style={s.resumoRotulo}>Seu roteiro</Text>
                <Text style={s.resumoTitulo}>{previa.cidade}{previa.estado ? ` · ${previa.estado}` : ''}</Text>
                <View style={s.resumoPills}>
                  <View style={s.resumoPill}><Ionicons name="calendar-outline" size={12} color="#fff" /><Text style={s.resumoPillTxt}> {previa.dias} {previa.dias === 1 ? 'dia' : 'dias'}</Text></View>
                  <View style={s.resumoPill}><Ionicons name="people-outline" size={12} color="#fff" /><Text style={s.resumoPillTxt}> {qtdPessoas}</Text></View>
                  <View style={s.resumoPill}><Ionicons name="list-outline" size={12} color="#fff" /><Text style={s.resumoPillTxt}> {itens.length} itens</Text></View>
                </View>
                <Text style={s.total}>{brl(total)}</Text>
                <Text style={s.totalSub}>{brl(total / qtdPessoas)} por pessoa</Text>
                {usoOrc != null && (
                  <>
                    <View style={s.barra}><View style={[s.barraFill, { width: `${usoOrc}%`, backgroundColor: orc && total > orc ? '#F87171' : '#34D399' }]} /></View>
                    <Text style={[s.totalSub, { color: orc && total > orc ? '#FCA5A5' : '#6EE7B7', fontWeight: '800' }]}>
                      {orc && total <= orc ? `Sobram ${brl(orc - total)} do orçamento` : `Passa ${brl(total - (orc || 0))} do orçamento`}
                    </Text>
                  </>
                )}
                {previa.resumo.itens_premium > 0 && (
                  <View style={s.resumoPremium}><Ionicons name="star" size={12} color="#FDE68A" /><Text style={s.resumoPremiumTxt}> {previa.resumo.itens_premium} recomendações de parceiros Premium</Text></View>
                )}
              </LinearGradient>
              {previa.avisos.map((a, i) => <View key={i} style={s.aviso}><Ionicons name="information-circle" size={16} color="#B45309" /><Text style={s.avisoTxt}>{a}</Text></View>)}

              {itens.length > 0 && (
                <View>
                  {agrupado.fixos.length > 0 && <Text style={s.diaTitulo}>Durante toda a viagem</Text>}
                  {agrupado.fixos.map((i: any, k: number) => <ItemViagem key={`f${k}`} item={i} previa onRemover={remover} />)}
                  {agrupado.dias.map(({ dia: d, itens: lista }: any, idx: number) => (
                    <View key={d}>
                      <View style={s.diaLinha}>
                        <View style={s.diaBadge}><Text style={s.diaBadgeTxt}>Dia {idx + 1}</Text></View>
                        <Text style={s.diaTitulo}>{diaLongo(d)}</Text>
                      </View>
                      {lista.map((i: any, k: number) => <ItemViagem key={`${d}${k}`} item={i} previa onRemover={remover} />)}
                    </View>
                  ))}
                </View>
              )}

              <View style={s.card}>
                <Text style={s.rotulo}>Dê um nome para a viagem</Text>
                <View style={s.destinoInput}>
                  <Ionicons name="bookmark-outline" size={18} color={T.faint} />
                  <TextInput style={s.destinoTxt} placeholder={`Ex.: Férias em ${previa.cidade}`} placeholderTextColor={T.faint} value={titulo} onChangeText={setTitulo} maxLength={200} />
                </View>
                <TouchableOpacity onPress={salvar} disabled={salvando} activeOpacity={0.9} style={[{ marginTop: 12 }, salvando && { opacity: 0.7 }]}>
                  <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.botao, { marginTop: 0 }]}>
                    {salvando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="people" size={18} color="#fff" /><Text style={s.botaoTxt}> Salvar e convidar o grupo</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const sombra = { shadowColor: '#1F1A17', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 };

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  hero: { paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  bolha: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)', top: -70, right: -50 },
  heroMapa: { position: 'absolute', right: -20, bottom: -20, transform: [{ rotate: '-12deg' }] },
  voltar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 16 },
  heroPillTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heroTitulo: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 10, lineHeight: 35 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8, lineHeight: 19, maxWidth: 320 },
  corpo: { padding: 18, gap: 14 },
  bloqueio: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: '#FFD9B8' },
  bloqueioIcone: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  bloqueioTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: T.ink },
  bloqueioBtn: { backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bloqueioBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: T.card, borderRadius: 24, padding: 16, ...sombra },
  etapaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  etapaNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  etapaNumTxt: { color: T.primaryDark, fontWeight: '900', fontSize: 13 },
  etapaTitulo: { fontSize: 16, fontWeight: '900', color: T.ink, letterSpacing: -0.2 },
  rotulo: { fontSize: 11, fontWeight: '800', color: T.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  destinoLinha: { flexDirection: 'row', gap: 8 },
  destinoInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cream, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line },
  destinoTxt: { flex: 1, paddingVertical: 13, fontSize: 15, color: T.ink, fontWeight: '600' },
  gps: { width: 50, borderRadius: 16, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  campoData: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cream, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: T.line, minHeight: 58 },
  campoDataOn: { borderColor: '#FFC48F', backgroundColor: '#FFF8F1' },
  dataTxt: { fontSize: 16, color: T.ink, fontWeight: '800' },
  dataSemana: { fontSize: 11, color: T.muted, textTransform: 'capitalize' },
  duracao: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: T.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  duracaoTxt: { fontSize: 12, fontWeight: '800', color: T.primaryDark },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cream, borderRadius: 18, padding: 6, borderWidth: 1, borderColor: T.line },
  stepBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...sombra },
  stepNum: { fontSize: 22, fontWeight: '900', color: T.ink },
  stepTxt: { fontSize: 11, color: T.muted, marginTop: -2 },
  dinheiro: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cream, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: T.line },
  cifrao: { fontSize: 18, fontWeight: '900', color: T.faint, marginRight: 6 },
  dinheiroInput: { flex: 1, paddingVertical: 12, fontSize: 20, fontWeight: '900', color: T.ink },
  dica: { fontSize: 12, color: T.muted, marginTop: 6 },
  ritmo: { flex: 1, borderRadius: 18, borderWidth: 1.5, borderColor: T.line, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  ritmoOn: { borderColor: T.primary, backgroundColor: '#FFF8F1' },
  ritmoIcone: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ritmoNome: { fontSize: 14, fontWeight: '900', color: T.ink },
  ritmoDesc: { fontSize: 10, color: T.muted, marginTop: 2, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTxt: { fontSize: 13, fontWeight: '700', color: T.muted, textTransform: 'capitalize' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.line },
  switchIcone: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  switchTxt: { fontSize: 14, fontWeight: '800', color: T.ink },
  switchSub: { fontSize: 11, color: T.muted, marginTop: 1 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingVertical: 16, marginTop: 4, shadowColor: '#FF7A00', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  resumo: { borderRadius: 26, padding: 18 },
  resumoRotulo: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  resumoTitulo: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  resumoPills: { flexDirection: 'row', gap: 6, marginTop: 10 },
  resumoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  resumoPillTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  total: { fontSize: 34, fontWeight: '900', color: '#fff', marginTop: 14, letterSpacing: -1 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  barra: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12, marginBottom: 4, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 4 },
  resumoPremium: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(253,230,138,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  resumoPremiumTxt: { color: '#FDE68A', fontSize: 11, fontWeight: '800' },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12 },
  avisoTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: '#92400E', lineHeight: 17 },
  diaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  diaBadge: { backgroundColor: T.ink, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  diaBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  diaTitulo: { fontSize: 15, fontWeight: '900', color: T.ink, textTransform: 'capitalize', marginVertical: 10 },
});
