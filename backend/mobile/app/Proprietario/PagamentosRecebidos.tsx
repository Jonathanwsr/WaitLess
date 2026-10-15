import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreen, Card, Vazio, api, brl } from '../../components/owner/ui';
import { useAviso } from '../../components/owner/Aviso';
import { baixarPdf } from '../../services/baixarPdf';
import { O } from '../../constants/OwnerTheme';

type Pagamento = { id: number; descricao: string; valor: number; liquido: number; forma: string; status: string; data: string | null };
type Grupo = { cliente_id: number; cliente: string; quantidade: number; total: number; pagamentos: Pagamento[] };

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

/** Um cliente: baixa direto se tiver um pagamento; com vários, escolhe quais ou baixa todos num PDF só. */
function ClienteRecebido({ grupo, aoBaixar, baixando }: { grupo: Grupo; aoBaixar: (ids: number[]) => void; baixando: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<number[]>([]);
  const unico = grupo.quantidade === 1 ? grupo.pagamentos[0] : null;
  const alternar = (id: number) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <Card>
      <View style={s.topo}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.titulo} numberOfLines={1}>{grupo.cliente}</Text>
          <Text style={s.meta} numberOfLines={2}>
            {unico ? `${unico.descricao} · ${quando(unico.data)}` : `${grupo.quantidade} pagamentos`}
          </Text>
        </View>
        <Text style={s.valor}>{brl(grupo.total)}</Text>
      </View>

      <View style={s.acoes}>
        {unico ? (
          <TouchableOpacity style={s.botao} onPress={() => aoBaixar([unico.id])} disabled={baixando} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={16} color={O.accent} />
            <Text style={s.botaoTxt}>Baixar comprovante</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={s.botao} onPress={() => setAberto((v) => !v)} activeOpacity={0.8}>
              <Ionicons name={aberto ? 'chevron-up' : 'list-outline'} size={16} color={O.ink} />
              <Text style={[s.botaoTxt, { color: O.ink }]}>{aberto ? 'Fechar' : 'Escolher'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.botao, s.botaoCheio]} onPress={() => aoBaixar(grupo.pagamentos.map((p) => p.id))} disabled={baixando} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={[s.botaoTxt, { color: '#fff' }]}>Baixar todos ({grupo.quantidade})</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {aberto && !unico && (
        <View style={s.lista}>
          {grupo.pagamentos.map((p) => {
            const on = marcados.includes(p.id);
            return (
              <TouchableOpacity key={p.id} style={s.item} onPress={() => alternar(p.id)} activeOpacity={0.8}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? O.accent : O.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTxt} numberOfLines={1}>{p.descricao}</Text>
                  <Text style={s.meta}>{quando(p.data)}</Text>
                </View>
                <Text style={s.itemValor}>{brl(p.valor)}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[s.botao, s.botaoCheio, { alignSelf: 'flex-start' }, !marcados.length && { opacity: 0.5 }]}
            onPress={() => aoBaixar(marcados)}
            disabled={!marcados.length || baixando}
            activeOpacity={0.8}
          >
            <Text style={[s.botaoTxt, { color: '#fff' }]}>Baixar selecionados ({marcados.length})</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

/**
 * Comprovantes de recebimento: o sócio escolhe o período (e, se quiser, o cliente), busca e baixa.
 * Nada é listado antes da busca, para a tela não encher.
 */
export default function PagamentosRecebidos() {
  const { aviso, mostrarErro } = useAviso();
  const hoje = isoLocal(new Date());
  const [de, setDe] = useState(hoje.slice(0, 8) + '01');
  const [ate, setAte] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [calendario, setCalendario] = useState<'de' | 'ate' | null>(null);
  const [clientes, setClientes] = useState<Grupo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const buscar = async () => {
    setCarregando(true);
    try {
      const qs = `de=${de}&ate=${ate}${busca.trim() ? `&busca=${encodeURIComponent(busca.trim())}` : ''}`;
      const r = await api(`/proprietario/pagamentos-recebidos?${qs}`);
      setClientes(r.clientes || []);
    } catch (e) {
      mostrarErro(e, 'Não foi possível buscar');
    } finally {
      setCarregando(false);
    }
  };

  const baixar = async (ids: number[]) => {
    if (!ids.length) return;
    setBaixando(true);
    try {
      const qs = ids.map((id) => `ids[]=${id}`).join('&');
      await baixarPdf(`/proprietario/comprovantes-recebimento?${qs}`, ids.length === 1 ? `Comprovante_recebimento_${ids[0]}.pdf` : `Comprovantes_recebimento_${ids.length}.pdf`);
    } catch (e) {
      mostrarErro(e, 'Não foi possível baixar');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <OwnerScreen titulo="Comprovantes" subtitulo="Busque pelo período e baixe o de quem quiser">
      {aviso}
      <Card>
        <View style={s.datas}>
          {(['de', 'ate'] as const).map((qual) => (
            <TouchableOpacity key={qual} style={s.data} onPress={() => setCalendario(qual)} activeOpacity={0.8}>
              <Text style={s.dataRotulo}>{qual === 'de' ? 'De' : 'Até'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={16} color={O.accent} />
                <Text style={s.dataValor}>{dataBr(qual === 'de' ? de : ate)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {calendario && (
          <DateTimePicker
            value={new Date(`${calendario === 'de' ? de : ate}T12:00:00`)}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, d) => {
              const qual = calendario;
              setCalendario(Platform.OS === 'ios' ? qual : null);
              if (!d) return;
              const v = isoLocal(d);
              if (qual === 'de') { setDe(v); if (v > ate) setAte(v); } else { setAte(v); if (v < de) setDe(v); }
            }}
          />
        )}
        <TextInput style={s.input} value={busca} onChangeText={setBusca} placeholder="Cliente (opcional): nome ou e-mail" placeholderTextColor={O.faint} returnKeyType="search" onSubmitEditing={buscar} />
        <TouchableOpacity style={s.buscar} onPress={buscar} disabled={carregando} activeOpacity={0.85}>
          {carregando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="search" size={18} color="#fff" /><Text style={s.buscarTxt}>Buscar</Text></>}
        </TouchableOpacity>
      </Card>

      {baixando && <Text style={s.baixando}>Gerando o PDF…</Text>}

      {clientes !== null && (clientes.length === 0 ? (
        <Card><Vazio icone="receipt-outline" titulo="Nada nesse período" texto="Nenhum pagamento online recebido entre essas datas." /></Card>
      ) : clientes.map((g) => <ClienteRecebido key={g.cliente_id} grupo={g} aoBaixar={baixar} baixando={baixando} />))}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  datas: { flexDirection: 'row', gap: 10 },
  data: { flex: 1, borderWidth: 1, borderColor: O.line, borderRadius: 12, padding: 10, gap: 4 },
  dataRotulo: { fontSize: 11, fontWeight: '700', color: O.muted },
  dataValor: { fontSize: 15, fontWeight: '800', color: O.ink },
  input: { borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: O.ink, marginTop: 10 },
  buscar: { marginTop: 12, backgroundColor: O.accent, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buscarTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  baixando: { textAlign: 'center', color: O.muted, fontSize: 12, marginVertical: 6 },
  topo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  titulo: { fontSize: 15, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted },
  valor: { fontSize: 15, fontWeight: '900', color: O.ink },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  botao: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: O.line },
  botaoCheio: { backgroundColor: O.accent, borderColor: O.accent },
  botaoTxt: { color: O.accent, fontWeight: '800', fontSize: 13 },
  lista: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: O.soft, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  itemValor: { fontSize: 13, fontWeight: '800', color: O.ink },
});
