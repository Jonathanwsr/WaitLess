import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { baixarPdf } from '../../services/baixarPdf';
import { useAviso } from '../../components/owner/Aviso';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreen, Card, Pilula, Vazio, Erro, Metrica, Segmentado, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { O } from '../../constants/OwnerTheme';

type Pedido = {
  tipo: 'produto' | 'reserva';
  id: number;
  codigo: string;
  titulo: string;
  quantidade: number;
  cliente?: string | null;
  local?: string | null;
  status: string;
  status_rotulo: string;
  valor: number;
  quem_atende?: string | null;
  detalhe: string;
  criado_em?: string | null;
};
type Dados = {
  pedidos: Pedido[];
  estabelecimentos: { id: number; nome: string }[];
  resumo: { em_aberto: number; concluidos: number; cancelados: number };
};

// Situações em que já existe pagamento confirmado: dá para baixar o comprovante do pagamento.
const COM_PAGAMENTO = ['pago', 'aguardando_confirmacao', 'concluido', 'confirmado', 'em_andamento', 'finalizado', 'estornado'];

const TOM: Record<string, 'neutro' | 'positivo' | 'negativo' | 'alerta' | 'info'> = {
  pendente_pagamento: 'alerta',
  pendente: 'alerta',
  aguardando_confirmacao: 'info',
  pago: 'info',
  confirmado: 'info',
  concluido: 'positivo',
  finalizado: 'positivo',
  cancelado: 'neutro',
  estornado: 'neutro',
};

const TIPOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'produto', rotulo: 'Produtos' },
  { id: 'reserva', rotulo: 'Reservas' },
];

const EM_ABERTO = ['pendente_pagamento', 'aguardando_confirmacao', 'pago', 'pendente', 'confirmado'];

const quando = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ULTIMOS_MESES = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  return { id: isoLocal(d).slice(0, 7), rotulo: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) };
});

/** Histórico em PDF de todos os serviços e reservas de um dia ou de um mês. */
function HistoricoPdf({ local, aoErro }: { local: number | null; aoErro: (e: any) => void }) {
  const [periodo, setPeriodo] = useState<'dia' | 'mes'>('dia');
  const [dia, setDia] = useState(isoLocal(new Date()));
  const [mes, setMes] = useState(ULTIMOS_MESES[0].id);
  const [calendario, setCalendario] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const baixar = async () => {
    setBaixando(true);
    try {
      const params = new URLSearchParams({ periodo, ...(periodo === 'dia' ? { data: dia } : { mes }), ...(local ? { estabelecimento_id: String(local) } : {}) });
      await baixarPdf(`/gestao/historico-pdf?${params.toString()}`, `Historico_${periodo === 'dia' ? dia : mes}.pdf`);
    } catch (e) {
      aoErro(e);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Card>
      <Text style={s.histTitulo}>Histórico em PDF</Text>
      <Text style={s.meta}>Todos os serviços e reservas do período: cliente, código, situação, quem atendeu, valores e reembolsos.</Text>
      <View style={[s.filtros, { marginTop: 12, marginBottom: 10 }]}>
        {(['dia', 'mes'] as const).map((p) => (
          <TouchableOpacity key={p} onPress={() => setPeriodo(p)} style={[s.chip, periodo === p && s.chipAtivo]}>
            <Text style={[s.chipTxt, periodo === p && s.chipTxtAtivo]}>{p === 'dia' ? 'Dia' : 'Mês'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {periodo === 'dia' ? (
        <>
          <TouchableOpacity onPress={() => setCalendario(true)} style={s.dataBotao}>
            <Ionicons name="calendar-outline" size={16} color={O.ink} />
            <Text style={s.dataTxt}>{new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR')}</Text>
          </TouchableOpacity>
          {calendario && (
            <DateTimePicker
              value={new Date(`${dia}T12:00:00`)}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => {
                setCalendario(Platform.OS === 'ios');
                if (d) setDia(isoLocal(d));
              }}
            />
          )}
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {ULTIMOS_MESES.map((m) => (
            <TouchableOpacity key={m.id} onPress={() => setMes(m.id)} style={[s.chip, mes === m.id && s.chipAtivo]}>
              <Text style={[s.chipTxt, mes === m.id && s.chipTxtAtivo]}>{m.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity disabled={baixando} onPress={baixar} style={[s.baixar, baixando && { opacity: 0.5 }]}>
        {baixando ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={18} color="#fff" />}
        <Text style={s.baixarTxt}>{baixando ? 'Gerando...' : 'Baixar PDF'}</Text>
      </TouchableOpacity>
    </Card>
  );
}

export default function PedidosGestao() {
  const { aviso, mostrarErro } = useAviso();
  const [local, setLocal] = useState<number | null>(null);
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(
    () => api(`/gestao/pedidos${local ? `?estabelecimento_id=${local}` : ''}`),
    [local],
  );
  const [tipo, setTipo] = useState('todos');
  const [soAbertos, setSoAbertos] = useState(true);
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.pedidos || []).filter((p) => {
      if (tipo !== 'todos' && p.tipo !== tipo) return false;
      if (soAbertos && !EM_ABERTO.includes(p.status)) return false;
      if (termo && !`${p.titulo} ${p.cliente ?? ''} ${p.quem_atende ?? ''} ${p.codigo}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [dados, tipo, soAbertos, busca]);

  return (
    <OwnerScreen titulo="Pedidos" subtitulo="Tudo o que foi solicitado e quem atende" carregando={carregando} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro ? <Erro mensagem={erro} aoTentar={recarregar} /> : (
        <>
          <HistoricoPdf local={local} aoErro={mostrarErro} />

          <View style={s.metricas}>
            <Metrica rotulo="Em aberto" valor={dados?.resumo.em_aberto ?? 0} icone="time-outline" tom="info" largura={110} />
            <Metrica rotulo="Concluídos" valor={dados?.resumo.concluidos ?? 0} icone="checkmark-done-outline" tom="positivo" largura={110} />
            <Metrica rotulo="Cancelados" valor={dados?.resumo.cancelados ?? 0} icone="close-circle-outline" tom="neutro" largura={110} />
          </View>

          {(dados?.estabelecimentos.length ?? 0) > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <TouchableOpacity onPress={() => setLocal(null)} style={[s.chip, local === null && s.chipAtivo]}>
                <Text style={[s.chipTxt, local === null && s.chipTxtAtivo]}>Todos os locais</Text>
              </TouchableOpacity>
              {dados!.estabelecimentos.map((e) => (
                <TouchableOpacity key={e.id} onPress={() => setLocal(e.id)} style={[s.chip, local === e.id && s.chipAtivo]}>
                  <Text style={[s.chipTxt, local === e.id && s.chipTxtAtivo]}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Segmentado opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />

          <View style={s.filtros}>
            <View style={s.busca}>
              <Ionicons name="search" size={16} color={O.faint} />
              <TextInput value={busca} onChangeText={setBusca} placeholder="Cliente, pedido ou quem atende" placeholderTextColor={O.faint} style={s.buscaInput} />
            </View>
            <TouchableOpacity onPress={() => setSoAbertos((v) => !v)} style={[s.chip, soAbertos && s.chipAtivo]}>
              <Text style={[s.chipTxt, soAbertos && s.chipTxtAtivo]}>Só em aberto</Text>
            </TouchableOpacity>
          </View>

          {lista.length === 0 ? (
            <Card><Vazio icone="clipboard-outline" titulo="Nenhum pedido" texto="Nenhum pedido com esses filtros." /></Card>
          ) : lista.map((p) => (
            <Card key={`${p.tipo}-${p.id}`}>
              <View style={s.topo}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.titulo}>{p.titulo}{p.quantidade > 1 ? ` × ${p.quantidade}` : ''}</Text>
                  <Text style={s.meta}>{p.tipo === 'produto' ? 'Produto' : 'Reserva'} · {p.codigo} · {p.tipo === 'reserva' ? p.detalhe : `${p.detalhe} · ${quando(p.criado_em)}`}</Text>
                  {!!p.local && <Text style={s.meta}>{p.local}</Text>}
                </View>
                <Text style={s.valor}>{brl(p.valor)}</Text>
              </View>
              <View style={s.rodape}>
                <Pilula texto={p.status_rotulo} tom={TOM[p.status] || 'neutro'} />
                <Text style={s.meta} numberOfLines={1}>{p.cliente || '-'}</Text>
              </View>
              <View style={s.atende}>
                <Ionicons name="person-circle-outline" size={18} color={p.quem_atende ? O.accent : O.faint} />
                <Text style={[s.atendeTxt, !p.quem_atende && { color: O.faint }, { flex: 1 }]}>{p.quem_atende || 'Ninguém designado'}</Text>
                {COM_PAGAMENTO.includes(p.status) && (
                  <TouchableOpacity
                    onPress={() => baixarPdf(`/comprovante-pagamento?${p.tipo === 'produto' ? 'pedido_entrega_id' : 'aluguel_id'}=${p.id}`, `Comprovante_pagamento_${p.codigo}.pdf`).catch(mostrarErro)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    hitSlop={8}
                  >
                    <Ionicons name="receipt-outline" size={15} color={O.accent} />
                    <Text style={{ color: O.accent, fontWeight: '800', fontSize: 12 }}>Comprovante</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  metricas: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: O.card, borderWidth: 1, borderColor: O.line },
  chipAtivo: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: O.muted },
  chipTxtAtivo: { color: '#fff' },
  filtros: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 },
  busca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: O.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: O.line },
  buscaInput: { flex: 1, paddingVertical: 9, fontSize: 13, color: O.ink },
  topo: { flexDirection: 'row', gap: 10 },
  titulo: { fontSize: 15, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted, flexShrink: 1 },
  valor: { fontSize: 15, fontWeight: '900', color: O.ink },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  atende: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: O.soft, borderRadius: 10, padding: 8 },
  atendeTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  histTitulo: { fontSize: 15, fontWeight: '800', color: O.ink, marginBottom: 4 },
  dataBotao: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  dataTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
  baixar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: O.ink, borderRadius: 14, height: 46, marginTop: 14 },
  baixarTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
