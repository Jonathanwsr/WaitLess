import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Modal, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export type CamposAtendimentoForm = {
  modalidade_atendimento: string; atende_24h: boolean; raio_atendimento_km: string; taxa_deslocamento: string;
  tempo_chegada_minutos: string; tipo_preco: string; o_que_inclui: string; como_se_preparar: string; garantia_dias: string;
};

export const CAMPOS_ATENDIMENTO_VAZIOS: CamposAtendimentoForm = {
  modalidade_atendimento: 'no_local', atende_24h: false, raio_atendimento_km: '', taxa_deslocamento: '',
  tempo_chegada_minutos: '', tipo_preco: 'fixo', o_que_inclui: '', como_se_preparar: '', garantia_dias: '',
};

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Lê os campos de um serviço salvo (vindo da API). */
export const camposAtendimentoDe = (s: any): CamposAtendimentoForm => ({
  modalidade_atendimento: s?.modalidade_atendimento || 'no_local',
  atende_24h: !!s?.atende_24h,
  raio_atendimento_km: txt(s?.raio_atendimento_km),
  taxa_deslocamento: s?.taxa_deslocamento && Number(s.taxa_deslocamento) > 0 ? txt(s.taxa_deslocamento) : '',
  tempo_chegada_minutos: txt(s?.tempo_chegada_minutos),
  tipo_preco: s?.tipo_preco || 'fixo',
  o_que_inclui: s?.o_que_inclui || '',
  como_se_preparar: s?.como_se_preparar || '',
  garantia_dias: txt(s?.garantia_dias),
});

const MODALIDADES = [
  { valor: 'no_local', rotulo: 'No meu local', icone: 'storefront-outline' },
  { valor: 'a_domicilio', rotulo: 'Vou até o cliente', icone: 'car-outline' },
  { valor: 'ambos', rotulo: 'Os dois', icone: 'swap-horizontal-outline' },
  { valor: 'online', rotulo: 'Online', icone: 'videocam-outline' },
];
const TIPOS_PRECO = [
  { valor: 'fixo', rotulo: 'Fixo' }, { valor: 'a_partir_de', rotulo: 'A partir de' }, { valor: 'por_hora', rotulo: 'Por hora' },
  { valor: 'por_km', rotulo: 'Por km' }, { valor: 'sob_orcamento', rotulo: 'Sob orçamento' },
];
const LARANJA = '#FF7A00';

/** Seção "Como é o atendimento" do cadastro de serviço (app do sócio). */
export default function CamposAtendimento({ valor, aoMudar }: { valor: CamposAtendimentoForm; aoMudar: (v: CamposAtendimentoForm) => void }) {
  const set = (k: keyof CamposAtendimentoForm, v: any) => aoMudar({ ...valor, [k]: v });
  const vaiAte = valor.modalidade_atendimento === 'a_domicilio' || valor.modalidade_atendimento === 'ambos';
  const num = (v: string) => v.replace(/[^0-9]/g, '');
  const dec = (v: string) => v.replace(',', '.').replace(/[^0-9.]/g, '');

  return (
    <View style={s.caixa}>
      <Text style={s.titulo}>Como é o atendimento</Text>
      <Text style={s.sub}>Aparece para o cliente no Explorar, nos detalhes e na hora de agendar.</Text>

      <Text style={s.rotulo}>Onde o serviço é feito?</Text>
      <View style={s.grade}>
        {MODALIDADES.map((m) => {
          const on = valor.modalidade_atendimento === m.valor;
          return (
            <TouchableOpacity key={m.valor} style={[s.opcao, on && s.opcaoOn]} onPress={() => set('modalidade_atendimento', m.valor)} activeOpacity={0.85}>
              <Ionicons name={m.icone as any} size={18} color={on ? '#fff' : '#282828'} />
              <Text style={[s.opcaoTxt, on && { color: '#fff' }]}>{m.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {vaiAte && <Text style={s.dica}>Guincho, borracharia móvel, a domicílio: o cliente informa onde está ao agendar.</Text>}

      {vaiAte && (
        <View style={s.linha}>
          <View style={s.col}><Text style={s.rotuloMini}>Raio (km)</Text><TextInput style={s.input} keyboardType="numeric" value={valor.raio_atendimento_km} onChangeText={(v) => set('raio_atendimento_km', num(v))} placeholder="30" placeholderTextColor="#A0A2A8" /></View>
          <View style={s.col}><Text style={s.rotuloMini}>Taxa (R$)</Text><TextInput style={s.input} keyboardType="decimal-pad" value={valor.taxa_deslocamento} onChangeText={(v) => set('taxa_deslocamento', dec(v))} placeholder="0" placeholderTextColor="#A0A2A8" /></View>
          <View style={s.col}><Text style={s.rotuloMini}>Chega em (min)</Text><TextInput style={s.input} keyboardType="numeric" value={valor.tempo_chegada_minutos} onChangeText={(v) => set('tempo_chegada_minutos', num(v))} placeholder="40" placeholderTextColor="#A0A2A8" /></View>
        </View>
      )}

      <View style={s.switchLinha}>
        <View style={{ flex: 1 }}><Text style={s.forte}>Atende 24 horas</Text><Text style={s.dica}>Emergências, socorro, plantão.</Text></View>
        <Switch value={valor.atende_24h} onValueChange={(v) => set('atende_24h', v)} trackColor={{ false: '#E1E2E5', true: LARANJA }} />
      </View>

      <Text style={s.rotulo}>Como o preço é cobrado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TIPOS_PRECO.map((t) => {
          const on = valor.tipo_preco === t.valor;
          return (
            <TouchableOpacity key={t.valor} style={[s.chip, on && s.chipOn]} onPress={() => set('tipo_preco', t.valor)}>
              <Text style={[s.chipTxt, on && { color: '#fff' }]}>{t.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={s.rotuloMini}>Garantia (dias)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={valor.garantia_dias} onChangeText={(v) => set('garantia_dias', num(v))} placeholder="Ex: 90 (opcional)" placeholderTextColor="#A0A2A8" />
      <Text style={s.rotuloMini}>O que está incluído</Text>
      <TextInput style={[s.input, s.area]} multiline maxLength={2000} value={valor.o_que_inclui} onChangeText={(v) => set('o_que_inclui', v)} placeholder="Ex: reboque até 50 km, troca de pneu, mão de obra" placeholderTextColor="#A0A2A8" />
      <Text style={s.rotuloMini}>Como o cliente deve se preparar</Text>
      <TextInput style={[s.input, s.area]} multiline maxLength={2000} value={valor.como_se_preparar} onChangeText={(v) => set('como_se_preparar', v)} placeholder="Ex: documento do veículo em mãos" placeholderTextColor="#A0A2A8" />
    </View>
  );
}

type Categoria = { valor: string; icone: string; cor: string; grupo?: string };

/** Escolha da categoria do serviço: busca + lista por grupo (Veículos e socorro, Casa e reparos...). */
export function SeletorCategoriaServico({ categorias, valor, aoEscolher }: { categorias: Categoria[]; valor: string; aoEscolher: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const atual = categorias.find((c) => c.valor === valor);
  const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const grupos = useMemo(() => {
    const q = semAcento(busca.trim());
    const mapa: Record<string, Categoria[]> = {};
    categorias.filter((c) => !q || semAcento(c.valor).includes(q) || semAcento(c.grupo || '').includes(q))
      .forEach((c) => { (mapa[c.grupo || 'Outros'] ||= []).push(c); });
    return Object.entries(mapa);
  }, [categorias, busca]);

  return (
    <>
      <TouchableOpacity style={s.seletor} onPress={() => setAberto(true)} activeOpacity={0.85} accessibilityRole="button">
        {atual ? <MaterialIcons name={atual.icone as any} size={20} color={atual.cor} /> : <Ionicons name="pricetags-outline" size={20} color="#6A6C72" />}
        <Text style={[s.seletorTxt, !atual && { color: '#A0A2A8' }]} numberOfLines={1}>{atual ? atual.valor : categorias.length ? 'Escolher categoria' : 'Carregando categorias…'}</Text>
        <Ionicons name="chevron-down" size={18} color="#6A6C72" />
      </TouchableOpacity>

      <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.modalTopo}>
            <Text style={s.modalTitulo}>Categoria do serviço</Text>
            <TouchableOpacity onPress={() => setAberto(false)} style={s.fechar} accessibilityLabel="Fechar"><Ionicons name="close" size={24} color="#282828" /></TouchableOpacity>
          </View>
          <View style={s.buscaCaixa}>
            <Ionicons name="search" size={18} color="#6A6C72" />
            <TextInput style={s.buscaInput} value={busca} onChangeText={setBusca} placeholder="Buscar (ex: guincho, borracharia, eletricista)" placeholderTextColor="#A0A2A8" autoFocus />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {grupos.length === 0 && <Text style={s.dica}>Nada encontrado. Use "Outros".</Text>}
            {grupos.map(([grupo, lista]) => (
              <View key={grupo} style={{ marginBottom: 14 }}>
                <Text style={s.grupoTitulo}>{grupo}</Text>
                <View style={s.chipsGrupo}>
                  {lista.map((c) => {
                    const on = c.valor === valor;
                    return (
                      <TouchableOpacity key={c.valor} style={[s.catChip, on && { backgroundColor: c.cor, borderColor: c.cor }]} onPress={() => { aoEscolher(c.valor); setAberto(false); setBusca(''); }}>
                        <MaterialIcons name={c.icone as any} size={15} color={on ? '#fff' : c.cor} />
                        <Text style={[s.catChipTxt, on && { color: '#fff' }]}>{c.valor}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  caixa: { backgroundColor: '#FFF8F2', borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#FFE4CC' },
  titulo: { fontSize: 15, fontWeight: '900', color: '#282828' },
  sub: { fontSize: 12, color: '#6A6C72', marginTop: 2 },
  rotulo: { fontSize: 13, fontWeight: '800', color: '#282828', marginTop: 14, marginBottom: 8 },
  rotuloMini: { fontSize: 12, fontWeight: '700', color: '#6A6C72', marginTop: 10, marginBottom: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  opcaoOn: { backgroundColor: LARANJA, borderColor: LARANJA },
  opcaoTxt: { fontSize: 13, fontWeight: '800', color: '#282828', flexShrink: 1 },
  dica: { fontSize: 12, color: '#6A6C72', marginTop: 4, lineHeight: 17 },
  linha: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#282828' },
  area: { minHeight: 70, textAlignVertical: 'top' },
  switchLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  forte: { fontSize: 14, fontWeight: '800', color: '#282828' },
  chip: { paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  chipOn: { backgroundColor: '#282828', borderColor: '#282828' },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#282828' },
  seletor: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', marginTop: 6, marginBottom: 10 },
  seletorTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: '#282828' },
  modalTopo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F1F3' },
  modalTitulo: { flex: 1, fontSize: 17, fontWeight: '900', color: '#282828' },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  buscaCaixa: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0, paddingHorizontal: 12, minHeight: 46, borderRadius: 14, backgroundColor: '#F4F4F6' },
  buscaInput: { flex: 1, fontSize: 14, color: '#282828' },
  grupoTitulo: { fontSize: 12, fontWeight: '900', color: '#6A6C72', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chipsGrupo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  catChipTxt: { fontSize: 13, fontWeight: '700', color: '#282828' },
});
