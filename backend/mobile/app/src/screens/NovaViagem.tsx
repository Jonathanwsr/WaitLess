import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, Platform, StatusBar, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import EstadosExplorar from '../../../components/client/EstadosExplorar';
import ItemViagem, { ItemRoteiro } from '../../../components/viagem/ItemViagem';
import { agruparPorDia, apiViagem, brl, diaLongo, isoData } from '../../../services/viagensApi';
import { alertar } from '../../../services/alertar';

const INTERESSES = ['praia', 'gastronomia', 'aventura', 'cultura', 'bem-estar', 'família', 'vida noturna', 'natureza'];
const RITMOS: [string, string, string][] = [['leve', 'Leve', '2 paradas/dia'], ['moderado', 'Moderado', '3 paradas/dia'], ['intenso', 'Intenso', '4 paradas/dia']];

type Previa = { cidade: string; estado: string | null; dias: number; itens: ItemRoteiro[]; avisos: string[]; resumo: { total_estimado: number; itens_premium: number } };

function CampoData({ rotulo, valor, minimo, onChange }: { rotulo: string; valor: Date | null; minimo: Date; onChange: (d: Date) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TouchableOpacity style={s.campoData} onPress={() => setAberto(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={16} color={T.muted} />
        <Text style={[s.dataTxt, !valor && { color: T.faint }]}>{valor ? valor.toLocaleDateString('pt-BR') : 'Escolher'}</Text>
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

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <HeaderCliente titulo="Roteiro inteligente" subtitulo="Cidade, datas e orçamento — o Lokyva monta o resto" voltar tituloMenor />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {bloqueado && (
          <View style={s.bloqueio}>
            <Ionicons name="lock-closed" size={20} color={T.primary} />
            <Text style={s.bloqueioTxt}>O roteiro inteligente é exclusivo para assinantes Premium.</Text>
            <TouchableOpacity onPress={() => router.push('/assinatura' as never)}><Text style={s.link}>Ver planos</Text></TouchableOpacity>
          </View>
        )}

        <EstadosExplorar subtitulo="Toque em um estado para ver as lojas, serviços e reservas disponíveis lá." />

        <View style={s.card}>
          <Text style={s.rotulo}>Para onde você vai?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder={coords ? 'Usando sua localização' : 'Ex.: Maceió'} placeholderTextColor={T.faint} value={cidade} onChangeText={(v) => { setCidade(v); setCoords(null); }} />
            <TouchableOpacity style={s.gps} onPress={usarLocalizacao}><Ionicons name="locate" size={20} color={T.primary} /></TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <CampoData rotulo="Ida" valor={ida} minimo={hoje} onChange={(d) => { setIda(d); if (volta && volta < d) setVolta(null); }} />
            <CampoData rotulo="Volta" valor={volta} minimo={ida || hoje} onChange={setVolta} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.rotulo}>Pessoas</Text>
              <TextInput style={s.input} keyboardType="number-pad" value={pessoas} onChangeText={setPessoas} maxLength={2} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.rotulo}>Orçamento total (opcional)</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="R$ 0,00" placeholderTextColor={T.faint} value={orcamento} onChangeText={setOrcamento} />
            </View>
          </View>

          <Text style={[s.rotulo, { marginTop: 16 }]}>Ritmo</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {RITMOS.map(([v, n, d]) => (
              <TouchableOpacity key={v} onPress={() => setRitmo(v)} style={[s.ritmo, ritmo === v && s.ritmoOn]} activeOpacity={0.85}>
                <Text style={[s.ritmoNome, ritmo === v && { color: T.primaryDark }]}>{n}</Text>
                <Text style={s.ritmoDesc}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.rotulo, { marginTop: 16 }]}>Interesses (opcional)</Text>
          <View style={s.chips}>
            {INTERESSES.map((i) => {
              const on = interesses.includes(i);
              return (
                <TouchableOpacity key={i} onPress={() => setInteresses(on ? interesses.filter((x) => x !== i) : [...interesses, i])} style={[s.chip, on && s.chipOn]}>
                  <Text style={[s.chipTxt, on && { color: '#fff' }]}>{i}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.linhaSwitch}><Text style={s.switchTxt}>Incluir hospedagem</Text><Switch value={hospedagem} onValueChange={setHospedagem} trackColor={{ true: T.primary }} /></View>
          <View style={s.linhaSwitch}><Text style={s.switchTxt}>Incluir aluguel de veículo</Text><Switch value={veiculo} onValueChange={setVeiculo} trackColor={{ true: T.primary }} /></View>

          <TouchableOpacity style={[s.botao, gerando && { opacity: 0.6 }]} onPress={gerar} disabled={gerando} activeOpacity={0.85}>
            {gerando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.botaoTxt}> Montar roteiro</Text></>}
          </TouchableOpacity>
        </View>

        {previa && (
          <>
            <View style={s.card}>
              <Text style={s.rotulo}>Seu roteiro</Text>
              <Text style={s.previaTitulo}>{previa.cidade} · {previa.dias} {previa.dias === 1 ? 'dia' : 'dias'}</Text>
              <Text style={s.total}>{brl(total)}</Text>
              <Text style={s.totalSub}>
                {brl(total / Math.max(Number(pessoas) || 1, 1))} por pessoa{orc ? ` · ${total <= orc ? `sobram ${brl(orc - total)}` : `passa ${brl(total - orc)} do orçamento`}` : ''}
              </Text>
              {previa.resumo.itens_premium > 0 && <Text style={s.premiumTxt}>{previa.resumo.itens_premium} recomendações de parceiros Premium neste roteiro</Text>}
              {previa.avisos.map((a, i) => <Text key={i} style={s.aviso}>{a}</Text>)}
            </View>

            {itens.length > 0 && (
              <View style={{ marginTop: 4 }}>
                {agrupado.fixos.length > 0 && <Text style={s.diaTitulo}>Durante toda a viagem</Text>}
                {agrupado.fixos.map((i: any, k: number) => <ItemViagem key={`f${k}`} item={i} previa onRemover={remover} />)}
                {agrupado.dias.map(({ dia: d, itens: lista }: any) => (
                  <View key={d}>
                    <Text style={s.diaTitulo}>{diaLongo(d)}</Text>
                    {lista.map((i: any, k: number) => <ItemViagem key={`${d}${k}`} item={i} previa onRemover={remover} />)}
                  </View>
                ))}
              </View>
            )}

            <View style={s.card}>
              <TextInput style={s.input} placeholder={`Nome da viagem (ex.: Férias em ${previa.cidade})`} placeholderTextColor={T.faint} value={titulo} onChangeText={setTitulo} maxLength={200} />
              <TouchableOpacity style={[s.botao, { marginTop: 12 }, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} activeOpacity={0.85}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Salvar e convidar o grupo</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  scroll: { padding: 20, paddingTop: 6, paddingBottom: 60, gap: 14 },
  bloqueio: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.primarySoft, borderRadius: 16, padding: 14, flexWrap: 'wrap' },
  bloqueioTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: T.ink },
  link: { fontSize: 13, fontWeight: '800', color: T.primary },
  card: { backgroundColor: T.card, borderRadius: 22, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  rotulo: { fontSize: 11, fontWeight: '800', color: T.faint, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: T.cream, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink },
  gps: { width: 48, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  campoData: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.cream, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  dataTxt: { fontSize: 15, color: T.ink, fontWeight: '600' },
  ritmo: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: T.line, padding: 10 },
  ritmoOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  ritmoNome: { fontSize: 14, fontWeight: '800', color: T.ink },
  ritmoDesc: { fontSize: 11, color: T.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTxt: { fontSize: 13, fontWeight: '700', color: T.muted },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchTxt: { fontSize: 14, fontWeight: '600', color: T.ink },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#12A150', borderRadius: 16, paddingVertical: 15, marginTop: 18 },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  previaTitulo: { fontSize: 22, fontWeight: '800', color: T.ink },
  total: { fontSize: 30, fontWeight: '800', color: T.ink, marginTop: 6 },
  totalSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  premiumTxt: { fontSize: 12, fontWeight: '700', color: '#B45309', marginTop: 8 },
  aviso: { fontSize: 12, fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 8, marginTop: 8 },
  diaTitulo: { fontSize: 15, fontWeight: '800', color: T.ink, textTransform: 'capitalize', marginVertical: 8 },
});
