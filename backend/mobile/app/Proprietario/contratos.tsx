import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import {
  OwnerScreen, Card, Rotulo, Segmentado, Vazio, Erro, Pilula, api, brl, dataCurta, estilos,
} from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import PremiumGate from '../../components/owner/PremiumGate';
import { useAviso } from '../../components/owner/Aviso';
import { alertar } from '../../services/alertar';

interface Modelo { id: number; titulo: string; conteudo: string; tipo_reserva: string; padrao: boolean }
interface Gerado {
  id: number; numero: string; titulo: string; cliente: string | null; item: string | null;
  enviado_em: string | null; criado_em: string | null; pdf_url: string | null; docx_url: string | null;
}
interface Pendente { id: number; codigo: string; item: string | null; cliente: string | null; data_inicio: string; data_fim: string; valor_total: number }

interface Dados {
  locais: { id: number; nome: string }[];
  semLocal?: boolean;
  premium?: boolean;
  estabelecimento?: { id: number; nome: string };
  modelos?: Modelo[];
  contratos?: Gerado[];
  reservas_pendentes?: Pendente[];
}

const VARIAVEIS = ['{{LOCADOR_NOME}}', '{{LOCATARIO_NOME}}', '{{LOCATARIO_DOCUMENTO}}', '{{ITEM_NOME}}', '{{VALOR_TOTAL}}', '{{DATA_INICIO}}', '{{DATA_FIM}}'];

const MODELO_INICIAL =
  'CONTRATO DE LOCAÇÃO\n\nLOCADOR: {{LOCADOR_NOME}}\nLOCATÁRIO: {{LOCATARIO_NOME}} — {{LOCATARIO_DOCUMENTO}}\n\nObjeto: {{ITEM_NOME}}\nPeríodo: {{DATA_INICIO}} a {{DATA_FIM}}\nValor total: R$ {{VALOR_TOTAL}}\n';

export default function ContratosSocio() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const [localId, setLocalId] = useState<number | null>(idParam ? Number(idParam) : null);
  const [aba, setAba] = useState('reservas');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { aviso, mostrar, mostrarErro, mostrarSucesso } = useAviso();

  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState(MODELO_INICIAL);
  const [padrao, setPadrao] = useState(false);

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(async () => {
    const dash = await api('/proprietario/dashboard');
    const locais = dash?.estabelecimentos || [];
    const id = localId ?? locais[0]?.id;
    if (!id) return { locais, semLocal: true, premium: !!dash?.premium };
    const c = await api(`/proprietario/contratos?estabelecimento_id=${id}`);
    return { locais, ...c };
  }, [localId]);

  if (dados && dados.premium === false) {
    return (
      <PremiumGate
        titulo="Contratos"
        texto="Com o plano Premium você cria modelos, gera o contrato de cada reserva em PDF e Word e envia direto ao cliente."
        icone="document-text"
        beneficios={[
          { icone: 'create-outline', texto: 'Modelos personalizados com dados preenchidos automaticamente' },
          { icone: 'download-outline', texto: 'PDF e Word prontos para cada reserva' },
          { icone: 'mail-outline', texto: 'Envio por e-mail ao cliente com um toque' },
        ]}
      />
    );
  }

  const executar = async (chave: string, acao: () => Promise<any>, sucesso: string) => {
    setOcupado(chave);
    try {
      await acao();
      mostrarSucesso('Tudo certo!', sucesso);
      recarregar();
    } catch (e: any) {
      mostrarErro(e);
    } finally {
      setOcupado(null);
    }
  };

  const gerar = (p: Pendente) =>
    executar(`g${p.id}`, () => api(`/proprietario/contratos/gerar/${p.id}`, { method: 'POST', body: {} }), 'Contrato gerado. Veja na aba Gerados.');

  const enviar = (c: Gerado) =>
    executar(`e${c.id}`, () => api(`/proprietario/contratos/${c.id}/enviar-email`, { method: 'POST', body: {} }), 'Contrato enviado ao e-mail do cliente.');

  const salvarModelo = () => {
    if (!titulo.trim() || !conteudo.trim() || !dados?.estabelecimento) {
      mostrar({ tipo: 'info', titulo: 'Faltam dados', mensagem: 'Informe o título e o texto do modelo para salvar.' });
      return;
    }
    executar(
      'modelo',
      async () => {
        await api('/proprietario/contratos/modelos', {
          method: 'POST',
          body: { estabelecimento_id: dados.estabelecimento!.id, titulo: titulo.trim(), conteudo, padrao },
        });
        setTitulo('');
        setConteudo(MODELO_INICIAL);
        setPadrao(false);
      },
      'Modelo salvo.',
    );
  };

  const removerModelo = (m: Modelo) =>
    alertar('Remover modelo', `Deseja remover "${m.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => executar(`r${m.id}`, () => api(`/proprietario/contratos/modelos/${m.id}`, { method: 'DELETE' }), 'Modelo removido.') },
    ]);

  const pendentes = dados?.reservas_pendentes || [];
  const gerados = dados?.contratos || [];
  const modelos = dados?.modelos || [];

  return (
    <OwnerScreen titulo="Contratos" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : dados && (
        <>
          <View style={s.hero}>
            <View style={s.heroIcone}><Ionicons name="document-text" size={22} color={O.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitulo}>Contratos</Text>
              <Text style={s.heroSub}>{dados.estabelecimento?.nome || 'Seu local'}</Text>
            </View>
            <Pilula texto="Premium" tom="alerta" />
          </View>

          {dados.locais.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {dados.locais.map((l) => {
                const on = l.id === (dados.estabelecimento?.id ?? localId);
                return (
                  <TouchableOpacity key={l.id} style={[s.chip, on && s.chipOn]} onPress={() => setLocalId(l.id)} activeOpacity={0.8}>
                    <Text style={[s.chipTxt, on && { color: '#fff' }]}>{l.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {dados.semLocal ? (
            <Card><Vazio icone="storefront-outline" titulo="Cadastre um local" texto="Os contratos ficam ligados às reservas do seu local." /></Card>
          ) : (
            <>
              <Segmentado
                opcoes={[
                  { id: 'reservas', rotulo: `Reservas (${pendentes.length})` },
                  { id: 'gerados', rotulo: `Gerados (${gerados.length})` },
                  { id: 'modelos', rotulo: 'Modelos' },
                ]}
                valor={aba}
                aoMudar={setAba}
              />

              {aba === 'reservas' && (
                pendentes.length === 0 ? (
                  <Card><Vazio icone="checkmark-done-outline" titulo="Tudo em dia" texto="Não há reservas sem contrato no momento." /></Card>
                ) : pendentes.map((p) => (
                  <Card key={p.id}>
                    <Text style={s.itemTitulo}>{p.item || 'Reserva'}</Text>
                    <Text style={s.itemSub}>{p.cliente || 'Cliente'} · {p.codigo}</Text>
                    <Text style={s.itemSub}>{dataCurta(p.data_inicio)} a {dataCurta(p.data_fim)} · {brl(p.valor_total)}</Text>
                    <TouchableOpacity style={[s.btn, ocupado === `g${p.id}` && { opacity: 0.6 }]} disabled={!!ocupado} onPress={() => gerar(p)} activeOpacity={0.85}>
                      <Ionicons name="document-text-outline" size={18} color="#fff" />
                      <Text style={s.btnTxt}>{ocupado === `g${p.id}` ? 'Gerando…' : 'Gerar contrato'}</Text>
                    </TouchableOpacity>
                  </Card>
                ))
              )}

              {aba === 'gerados' && (
                gerados.length === 0 ? (
                  <Card><Vazio icone="document-outline" titulo="Nenhum contrato gerado" texto="Gere o primeiro na aba Reservas." /></Card>
                ) : gerados.map((c) => (
                  <Card key={c.id}>
                    <View style={s.linha}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitulo} numberOfLines={1}>{c.titulo}</Text>
                        <Text style={s.itemSub}>{c.cliente || 'Cliente'} · {c.numero}</Text>
                      </View>
                      {c.enviado_em ? <Pilula texto="Enviado" tom="positivo" /> : <Pilula texto="Não enviado" />}
                    </View>
                    <View style={s.acoes}>
                      {!!c.pdf_url && (
                        <TouchableOpacity style={s.btnSec} onPress={() => Linking.openURL(c.pdf_url!)} activeOpacity={0.8}>
                          <Ionicons name="download-outline" size={16} color={O.accent} /><Text style={s.btnSecTxt}>PDF</Text>
                        </TouchableOpacity>
                      )}
                      {!!c.docx_url && (
                        <TouchableOpacity style={s.btnSec} onPress={() => Linking.openURL(c.docx_url!)} activeOpacity={0.8}>
                          <Ionicons name="download-outline" size={16} color={O.accent} /><Text style={s.btnSecTxt}>Word</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[s.btnSec, ocupado === `e${c.id}` && { opacity: 0.6 }]} disabled={!!ocupado} onPress={() => enviar(c)} activeOpacity={0.8}>
                        <Ionicons name="mail-outline" size={16} color={O.accent} /><Text style={s.btnSecTxt}>{ocupado === `e${c.id}` ? 'Enviando…' : 'E-mail'}</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))
              )}

              {aba === 'modelos' && (
                <>
                  <Rotulo>Novo modelo</Rotulo>
                  <Card>
                    <Text style={s.label}>Título</Text>
                    <TextInput style={[estilos.campo, { marginBottom: 12 }]} placeholder="Ex.: Contrato de locação padrão" placeholderTextColor={O.faint} value={titulo} onChangeText={setTitulo} />
                    <Text style={s.label}>Texto do contrato</Text>
                    <TextInput style={[estilos.campo, s.area]} multiline textAlignVertical="top" value={conteudo} onChangeText={setConteudo} placeholderTextColor={O.faint} />
                    <Text style={s.dica}>Estes campos são preenchidos sozinhos em cada reserva:</Text>
                    <View style={s.vars}>{VARIAVEIS.map((v) => <View key={v} style={s.var}><Text style={s.varTxt}>{v}</Text></View>)}</View>
                    <View style={s.padraoRow}>
                      <Text style={s.padraoTxt}>Usar como modelo padrão</Text>
                      <Switch value={padrao} onValueChange={setPadrao} trackColor={{ false: '#E1E2E5', true: '#12A150' }} />
                    </View>
                    <TouchableOpacity style={[s.btnSalvar, ocupado === 'modelo' && { opacity: 0.6 }]} disabled={!!ocupado} onPress={salvarModelo} activeOpacity={0.85}>
                      <Text style={s.btnTxt}>{ocupado === 'modelo' ? 'Salvando…' : 'Salvar modelo'}</Text>
                    </TouchableOpacity>
                  </Card>

                  <Rotulo>Seus modelos</Rotulo>
                  {modelos.length === 0 ? (
                    <Card><Vazio icone="create-outline" titulo="Nenhum modelo ainda" texto="Crie um acima para reaproveitar o texto." /></Card>
                  ) : modelos.map((m) => (
                    <Card key={m.id}>
                      <View style={s.linha}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTitulo}>{m.titulo}</Text>
                          <Text style={s.itemSub} numberOfLines={2}>{m.conteudo}</Text>
                        </View>
                        {m.padrao && <Pilula texto="Padrão" tom="positivo" />}
                        <TouchableOpacity onPress={() => removerModelo(m)} style={{ padding: 6 }}>
                          <Ionicons name="trash-outline" size={19} color={O.danger} />
                        </TouchableOpacity>
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: O.card, borderRadius: 24, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  heroIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  heroTitulo: { fontSize: 18, fontWeight: '800', color: O.ink },
  heroSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: O.card },
  chipOn: { backgroundColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  itemTitulo: { fontSize: 15, fontWeight: '700', color: O.ink },
  itemSub: { fontSize: 12, color: O.muted, marginTop: 3, lineHeight: 17 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: O.accent, marginTop: 14 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: '#FFF1E4' },
  btnSecTxt: { color: O.accent, fontWeight: '700', fontSize: 13 },
  btnSalvar: { alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 25, backgroundColor: '#12A150', marginTop: 16 },
  label: { fontSize: 12, fontWeight: '700', color: O.muted, marginBottom: 6 },
  area: { minHeight: 170, paddingTop: 12, marginBottom: 10 },
  dica: { fontSize: 12, color: O.muted, marginTop: 4 },
  vars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  var: { backgroundColor: O.soft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  varTxt: { fontSize: 10, fontWeight: '700', color: O.ink },
  padraoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  padraoTxt: { fontSize: 14, fontWeight: '600', color: O.ink },
});
