import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { apiViagem, brl, dia } from '../../services/viagensApi';
import { alertar } from '../../services/alertar';

type Painel = any;

const CATEGORIAS: [string, string][] = [['alimentacao', 'Alimentação'], ['hospedagem', 'Hospedagem'], ['transporte', 'Transporte'], ['passeio', 'Passeio'], ['outros', 'Outros']];

function FormGasto({ painel, onFechar, onSalvo }: { painel: Painel; onFechar: () => void; onSalvo: (msg: string) => void }) {
  const membros = painel.membros.filter((m: any) => m.presenca !== 'recusado');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [pagador, setPagador] = useState<number>(painel.eu.id);
  const [categoria, setCategoria] = useState('alimentacao');
  const [modo, setModo] = useState<'igual' | 'personalizada'>('igual');
  const [participantes, setParticipantes] = useState<number[]>(membros.map((m: any) => m.id));
  const [partes, setPartes] = useState<Record<number, string>>({});
  const [enviando, setEnviando] = useState(false);

  const total = Number(valor.replace(',', '.')) || 0;
  const soma = Object.values(partes).reduce((s, v) => s + (Number(String(v).replace(',', '.')) || 0), 0);
  const nome = (m: any) => (m.id === painel.eu.id ? 'Eu' : m.nome);

  const alternar = (id: number) => setParticipantes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const salvar = async () => {
    if (!descricao.trim()) return alertar('Faltou a descrição', 'Diga o que foi pago (ex.: Jantar).');
    if (total <= 0) return alertar('Valor inválido', 'Informe um valor maior que zero.');
    const corpo: any = { descricao: descricao.trim(), valor: total, pagador_id: pagador, categoria };
    if (modo === 'igual') corpo.participantes = participantes;
    else corpo.partes = Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, Number(String(v).replace(',', '.')) || 0]).filter(([, v]) => (v as number) > 0));

    setEnviando(true);
    const r = await apiViagem(`/${painel.viagem.id}/despesas`, 'POST', corpo);
    setEnviando(false);
    if (!r.ok) return alertar('Não foi possível lançar', r.erro || '');
    onSalvo(r.dados?.mensagem || 'Gasto lançado.');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onFechar} presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.cream }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalTopo}>
          <Text style={s.modalTitulo}>Novo gasto</Text>
          <TouchableOpacity onPress={onFechar}><Ionicons name="close" size={24} color={T.ink} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <TextInput style={s.input} placeholder="O que foi? (ex.: Jantar)" placeholderTextColor={T.faint} value={descricao} onChangeText={setDescricao} maxLength={255} />
          <View style={s.valorBox}>
            <Text style={s.rs}>R$</Text>
            <TextInput style={s.valorInput} placeholder="0,00" placeholderTextColor={T.faint} keyboardType="decimal-pad" value={valor} onChangeText={setValor} />
          </View>

          <Text style={s.rotulo}>Quem pagou</Text>
          <View style={s.linhaChips}>
            {membros.map((m: any) => (
              <TouchableOpacity key={m.id} onPress={() => setPagador(m.id)} style={[s.chip, pagador === m.id && s.chipOn]}>
                <Text style={[s.chipTxt, pagador === m.id && s.chipTxtOn]}>{nome(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.rotulo}>Categoria</Text>
          <View style={s.linhaChips}>
            {CATEGORIAS.map(([v, n]) => (
              <TouchableOpacity key={v} onPress={() => setCategoria(v)} style={[s.chip, categoria === v && s.chipOn]}>
                <Text style={[s.chipTxt, categoria === v && s.chipTxtOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.abas}>
            {([['igual', 'Dividir igualmente'], ['personalizada', 'Valores diferentes']] as const).map(([v, n]) => (
              <TouchableOpacity key={v} onPress={() => setModo(v)} style={[s.aba, modo === v && s.abaOn]}><Text style={[s.abaTxt, modo === v && { color: '#fff' }]}>{n}</Text></TouchableOpacity>
            ))}
          </View>

          {modo === 'igual' ? (
            membros.map((m: any) => (
              <TouchableOpacity key={m.id} onPress={() => alternar(m.id)} style={[s.parte, participantes.includes(m.id) && s.parteOn]} activeOpacity={0.8}>
                <Ionicons name={participantes.includes(m.id) ? 'checkbox' : 'square-outline'} size={22} color={participantes.includes(m.id) ? T.primary : T.faint} />
                <Text style={s.parteNome}>{nome(m)}</Text>
                {participantes.includes(m.id) && total > 0 && <Text style={s.partePreco}>{brl(total / Math.max(participantes.length, 1))}</Text>}
              </TouchableOpacity>
            ))
          ) : (
            <>
              {membros.map((m: any) => (
                <View key={m.id} style={s.parte}>
                  <Text style={[s.parteNome, { marginLeft: 0 }]}>{nome(m)}</Text>
                  <TextInput style={s.parteInput} placeholder="0,00" placeholderTextColor={T.faint} keyboardType="decimal-pad" value={partes[m.id] ?? ''} onChangeText={(v) => setPartes({ ...partes, [m.id]: v })} />
                </View>
              ))}
              <Text style={{ fontWeight: '800', color: Math.abs(soma - total) < 0.005 ? T.success : '#D97706' }}>Soma das partes: {brl(soma)} de {brl(total)}</Text>
            </>
          )}

          <TouchableOpacity style={[s.botao, enviando && { opacity: 0.6 }]} onPress={salvar} disabled={enviando} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Lançar gasto</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function GastosViagem({ painel, recarregar, avisar }: { painel: Painel; recarregar: () => void; avisar: (t: string) => void }) {
  const [novo, setNovo] = useState(false);
  const { despesas, saldos, acertos, custos, eu, viagem } = painel;
  const meu = saldos.find((x: any) => x.usuario_id === eu.id)?.saldo ?? 0;

  const apagar = (d: any) => alertar('Apagar gasto', `Apagar "${d.descricao}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: async () => {
      const r = await apiViagem(`/${viagem.id}/despesas/${d.id}`, 'DELETE');
      if (!r.ok) return alertar('Não foi possível apagar', r.erro || '');
      recarregar();
    } },
  ]);

  const acertar = (a: any) => alertar('Registrar acerto', `${a.de_nome} pagou ${brl(a.valor)} a ${a.para_nome}?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', onPress: async () => {
      const r = await apiViagem(`/${viagem.id}/pagamentos`, 'POST', { de_id: a.de, para_id: a.para, valor: a.valor });
      if (!r.ok) return alertar('Não foi possível registrar', r.erro || '');
      avisar('Acerto registrado.');
      recarregar();
    } },
  ]);

  return (
    <View style={{ gap: 14 }}>
      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiRot}>Gasto real</Text><Text style={s.kpiVal}>{brl(custos.gasto_real)}</Text></View>
        <View style={s.kpi}><Text style={s.kpiRot}>Previsto</Text><Text style={s.kpiVal}>{brl(custos.estimado)}</Text></View>
        <View style={[s.kpi, meu > 0.004 && { backgroundColor: T.successBg }, meu < -0.004 && { backgroundColor: '#FEE2E2' }]}>
          <Text style={s.kpiRot}>{meu > 0.004 ? 'Você recebe' : meu < -0.004 ? 'Você deve' : 'Seu saldo'}</Text>
          <Text style={[s.kpiVal, meu > 0.004 && { color: T.success }, meu < -0.004 && { color: T.danger }]}>{brl(Math.abs(meu))}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.botao} onPress={() => setNovo(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={20} color="#fff" /><Text style={s.botaoTxt}> Lançar gasto</Text>
      </TouchableOpacity>

      {acertos.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitulo}>Como acertar as contas</Text>
          {acertos.map((a: any, i: number) => (
            <View key={i} style={s.acerto}>
              <Text style={s.acertoTxt}><Text style={{ fontWeight: '800' }}>{a.de === eu.id ? 'Você' : a.de_nome}</Text> paga <Text style={{ fontWeight: '800' }}>{brl(a.valor)}</Text> a <Text style={{ fontWeight: '800' }}>{a.para === eu.id ? 'você' : a.para_nome}</Text></Text>
              {(a.de === eu.id || a.para === eu.id || viagem.sou_criador) && <TouchableOpacity onPress={() => acertar(a)}><Text style={s.link}>Marcar pago</Text></TouchableOpacity>}
            </View>
          ))}
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitulo}>Quanto cada um pagou e deve</Text>
        {saldos.map((x: any) => (
          <View key={x.usuario_id} style={s.saldoLinha}>
            <Text style={s.saldoNome}>{x.usuario_id === eu.id ? 'Você' : x.nome}</Text>
            <Text style={s.saldoMini}>pagou {brl(x.pago)} · deve {brl(x.devido)}</Text>
            <Text style={[s.saldoVal, x.saldo > 0.004 && { color: T.success }, x.saldo < -0.004 && { color: T.danger }]}>{x.saldo > 0.004 ? '+' : x.saldo < -0.004 ? '-' : ''}{brl(Math.abs(x.saldo))}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitulo}>Gastos lançados</Text>
        {despesas.length === 0 && <Text style={s.vazio}>Nenhum gasto ainda. Lance o primeiro e o Lokyva divide para todo mundo.</Text>}
        {despesas.map((d: any) => (
          <View key={d.id} style={s.despesa}>
            <View style={{ flex: 1 }}>
              <Text style={s.despNome}>{d.descricao}</Text>
              <Text style={s.despMeta}>{dia(d.data)} · pago por {d.pagador_id === eu.id ? 'você' : d.pagador}{d.item ? ` · ${d.item}` : ''}</Text>
              <Text style={s.despPartes}>{d.partes.map((p: any) => `${p.usuario_id === eu.id ? 'Você' : p.nome.split(' ')[0]} ${brl(p.valor)}`).join(' · ')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.despValor}>{brl(d.valor)}</Text>
              {d.pode_apagar && <TouchableOpacity onPress={() => apagar(d)} style={{ marginTop: 6 }}><Ionicons name="trash-outline" size={17} color={T.faint} /></TouchableOpacity>}
            </View>
          </View>
        ))}
      </View>

      {novo && <FormGasto painel={painel} onFechar={() => setNovo(false)} onSalvo={(m) => { setNovo(false); avisar(m); recarregar(); }} />}
    </View>
  );
}

const s = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: T.card, borderRadius: 20, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  kpiRot: { fontSize: 10, fontWeight: '800', color: T.faint, textTransform: 'uppercase' },
  kpiVal: { fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 2 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary, borderRadius: 16, paddingVertical: 14 },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: T.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: T.ink, marginBottom: 10 },
  acerto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.line },
  acertoTxt: { flex: 1, fontSize: 13, color: T.muted },
  link: { fontSize: 12, fontWeight: '800', color: T.primary },
  saldoLinha: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.line },
  saldoNome: { fontSize: 14, fontWeight: '700', color: T.ink },
  saldoMini: { fontSize: 11, color: T.faint, marginTop: 1 },
  saldoVal: { position: 'absolute', right: 0, top: 10, fontSize: 14, fontWeight: '800', color: T.faint },
  vazio: { fontSize: 13, color: T.muted },
  despesa: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line },
  despNome: { fontSize: 14, fontWeight: '800', color: T.ink },
  despMeta: { fontSize: 11, color: T.muted, marginTop: 2 },
  despPartes: { fontSize: 11, color: T.faint, marginTop: 2 },
  despValor: { fontSize: 14, fontWeight: '800', color: T.ink },

  modalTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 4 },
  modalTitulo: { fontSize: 22, fontWeight: '800', color: T.ink },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink },
  valorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  rs: { fontWeight: '800', color: T.faint, fontSize: 16 },
  valorInput: { flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, paddingVertical: 10, marginLeft: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', color: T.faint, textTransform: 'uppercase' },
  linhaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTxt: { fontSize: 13, fontWeight: '700', color: T.muted },
  chipTxtOn: { color: '#fff' },
  abas: { flexDirection: 'row', gap: 8, marginTop: 4 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  abaOn: { backgroundColor: T.ink, borderColor: T.ink },
  abaTxt: { fontSize: 13, fontWeight: '800', color: T.muted },
  parte: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 20, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  parteOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  parteNome: { flex: 1, fontSize: 14, fontWeight: '700', color: T.ink, marginLeft: 2 },
  partePreco: { fontSize: 14, fontWeight: '800', color: T.ink },
  parteInput: { width: 100, textAlign: 'right', fontSize: 15, fontWeight: '700', color: T.ink, borderBottomWidth: 1, borderBottomColor: T.line, paddingVertical: 2 },
});
