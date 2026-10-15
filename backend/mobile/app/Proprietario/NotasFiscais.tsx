import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Linking, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreen, Card, Vazio, Metrica, Segmentado, Pilula, api, brl } from '../../components/owner/ui';
import { useAviso } from '../../components/owner/Aviso';
import { O } from '../../constants/OwnerTheme';

type Nota = {
  id: number; tipo: 'venda' | 'comissao' | 'assinatura'; status: string; valor: number; valor_operacao: number | null;
  percentual: number | null; numero: string | null; descricao_servico: string | null; pdf_url: string | null;
  xml_url: string | null; mensagem_erro: string | null; emitida_em: string | null; created_at: string;
};
type Config = {
  configurada: boolean; nfse_servico_id: string | null; nfse_servico_codigo: string | null; nfse_servico_nome: string | null;
  nfse_iss: number; nfse_retem_iss: boolean; nfse_pis: number; nfse_cofins: number; nfse_csll: number; nfse_ir: number; nfse_inss: number;
  nfse_observacoes: string | null;
};
type Painel = {
  ehSocio: boolean; elegivel: boolean; taxas: { reservas: number; produtos: number; cobrancas: number };
  resumo: { vendas_mes: number; comissoes_mes: number; vendas_intermediadas_mes: number; pendencias: number };
  configuracao: Config | null;
};

const STATUS: Record<string, { nome: string; tom: 'positivo' | 'alerta' | 'negativo' | 'neutro' }> = {
  AGENDADA: { nome: 'Agendada', tom: 'neutro' },
  SINCRONIZADA: { nome: 'Em processamento', tom: 'neutro' },
  AUTORIZADA: { nome: 'Autorizada', tom: 'positivo' },
  CANCELADA: { nome: 'Cancelada', tom: 'neutro' },
  ERRO: { nome: 'Erro', tom: 'negativo' },
  NAO_CONFIGURADO: { nome: 'Falta configurar', tom: 'alerta' },
};
const TIPOS = { venda: 'Venda · sua nota para o cliente', comissao: 'Comissão Lokyva · nota para você', assinatura: 'Assinatura Lokyva' };
const ABAS = [{ id: '', rotulo: 'Todas' }, { id: 'venda', rotulo: 'Vendas' }, { id: 'comissao', rotulo: 'Comissões' }, { id: 'assinatura', rotulo: 'Assinatura' }];
const pct = (v?: number | null) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const data = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '-');

function CartaoNota({ nota, aoTentar, tentando }: { nota: Nota; aoTentar: (n: Nota) => void; tentando: boolean }) {
  const st = STATUS[nota.status] || { nome: nota.status, tom: 'neutro' as const };
  return (
    <Card>
      <View style={s.linhaTopo}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.tipo}>{TIPOS[nota.tipo] || nota.tipo}</Text>
          <Text style={s.titulo} numberOfLines={3}>{nota.descricao_servico || 'Nota fiscal'}</Text>
          <Text style={s.meta}>
            {data(nota.emitida_em || nota.created_at)}{nota.numero ? ` · Nº ${nota.numero}` : ''}
            {nota.tipo === 'comissao' && nota.valor_operacao ? ` · ${pct(nota.percentual)} de ${brl(nota.valor_operacao)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={s.valor}>{brl(nota.valor)}</Text>
          <Pilula texto={st.nome} tom={st.tom} />
        </View>
      </View>
      {!!nota.mensagem_erro && <Text style={s.erro}>{nota.mensagem_erro}</Text>}
      {(nota.pdf_url || nota.xml_url || ['ERRO', 'NAO_CONFIGURADO'].includes(nota.status)) && (
        <View style={s.acoes}>
          {!!nota.pdf_url && (
            <TouchableOpacity style={s.botao} onPress={() => Linking.openURL(nota.pdf_url!)} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={16} color={O.accent} /><Text style={s.botaoTxt}>PDF</Text>
            </TouchableOpacity>
          )}
          {!!nota.xml_url && (
            <TouchableOpacity style={s.botao} onPress={() => Linking.openURL(nota.xml_url!)} activeOpacity={0.8}>
              <Ionicons name="code-download-outline" size={16} color={O.accent} /><Text style={s.botaoTxt}>XML</Text>
            </TouchableOpacity>
          )}
          {['ERRO', 'NAO_CONFIGURADO'].includes(nota.status) && (
            <TouchableOpacity style={s.botao} onPress={() => aoTentar(nota)} disabled={tentando} activeOpacity={0.8}>
              {tentando ? <ActivityIndicator size="small" color={O.ink} /> : <Ionicons name="refresh" size={16} color={O.ink} />}
              <Text style={[s.botaoTxt, { color: O.ink }]}>Tentar novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
  );
}

function ConfiguracaoFiscal({ inicial, aoSalvar }: { inicial: Config; aoSalvar: (c: Config) => void }) {
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const [aberto, setAberto] = useState(!inicial.configurada);
  const [f, setF] = useState<Config>(inicial);
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof Config, rotulo: string, opcoes: { numero?: boolean; placeholder?: string } = {}) => (
    <View style={{ gap: 4 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput
        style={s.input}
        value={f[k] === null || f[k] === undefined ? '' : String(f[k])}
        onChangeText={(t) => setF({ ...f, [k]: opcoes.numero ? t.replace(',', '.') : t })}
        keyboardType={opcoes.numero ? 'decimal-pad' : 'default'}
        placeholder={opcoes.placeholder}
        placeholderTextColor={O.faint}
      />
    </View>
  );

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await api('/proprietario/notas-fiscais/configuracao', { method: 'POST', body: f });
      setF(r.configuracao);
      aoSalvar(r.configuracao);
      mostrarSucesso('Configuração salva', 'As próximas notas de venda já saem com esses dados.');
    } catch (e) {
      mostrarErro(e, 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      {aviso}
      <TouchableOpacity style={s.linhaTopo} onPress={() => setAberto((v) => !v)} activeOpacity={0.8}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.titulo}>Configuração fiscal das suas notas de venda</Text>
          <Text style={[s.meta, inicial.configurada && { color: O.success }]}>
            {inicial.configurada ? 'Configurada' : 'Peça estes dados ao seu contador. Sem eles a nota de venda não sai.'}
          </Text>
        </View>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={20} color={O.faint} />
      </TouchableOpacity>
      {aberto && (
        <View style={{ gap: 12, marginTop: 14 }}>
          {campo('nfse_servico_codigo', 'Código do serviço (Nacional ou da prefeitura)', { placeholder: 'Ex.: 06.01.01' })}
          {campo('nfse_servico_nome', 'Descrição do serviço', { placeholder: 'Ex.: Barbearia e cabeleireiros' })}
          {campo('nfse_servico_id', 'ID do serviço no Asaas (no Portal Nacional, deixe vazio)')}
          {campo('nfse_iss', 'ISS (%)', { numero: true })}
          <View style={s.switchLinha}>
            <Text style={s.rotulo}>Reter ISS</Text>
            <Switch value={!!f.nfse_retem_iss} onValueChange={(v) => setF({ ...f, nfse_retem_iss: v })} trackColor={{ true: O.accent }} />
          </View>
          <Text style={s.meta}>Retenções federais (normalmente zero no Simples Nacional e no MEI):</Text>
          <View style={s.grade}>
            {(['nfse_pis', 'nfse_cofins', 'nfse_csll', 'nfse_ir', 'nfse_inss'] as const).map((k) => (
              <View key={k} style={{ width: '31%' }}>{campo(k, k.replace('nfse_', '').toUpperCase() + ' (%)', { numero: true })}</View>
            ))}
          </View>
          {campo('nfse_observacoes', 'Observações na nota (opcional)')}
          <View style={s.dica}>
            <Ionicons name="information-circle-outline" size={18} color={O.info} />
            <Text style={s.dicaTxt}>Cidade na NFS-e Nacional (ex.: Vitória de Santo Antão)? Use o código de tributação nacional do serviço (ex.: 06.01.01) e deixe o ID vazio. No Asaas, em Notas fiscais → Configurações, escolha o Portal Nacional e cadastre inscrição municipal, regime tributário e o acesso de emissão.</Text>
          </View>
          <TouchableOpacity style={[s.botao, s.botaoCheio, { alignSelf: 'stretch', justifyContent: 'center' }]} onPress={salvar} disabled={salvando} activeOpacity={0.85}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={[s.botaoTxt, { color: '#fff' }]}>Salvar configuração</Text>}
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

/**
 * Notas fiscais do sócio no app: as notas de comissão que a Lokyva emite para ele a cada venda online,
 * as notas de venda que ele emite para os clientes (Sócio Premium) e as da assinatura.
 */
export default function NotasFiscais() {
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const [aba, setAba] = useState('');
  const [painel, setPainel] = useState<Painel | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tentando, setTentando] = useState<number | null>(null);

  const carregar = useCallback(async (tipo = aba) => {
    setCarregando(true);
    try {
      const r = await api(`/proprietario/notas-fiscais${tipo ? `?tipo=${tipo}` : ''}`);
      setNotas(r.notas?.data || []);
      setPainel(r);
    } catch (e) {
      mostrarErro(e, 'Não foi possível carregar as notas');
    } finally {
      setCarregando(false);
    }
  }, [aba, mostrarErro]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const trocarAba = (id: string) => { setAba(id); carregar(id); };

  const tentar = async (nota: Nota) => {
    setTentando(nota.id);
    try {
      const r = await api(`/proprietario/notas-fiscais/${nota.id}/tentar-novamente`, { method: 'POST' });
      mostrarSucesso('Pedido enviado', r.message);
      carregar();
    } catch (e) {
      mostrarErro(e, 'Não foi possível reenviar');
    } finally {
      setTentando(null);
    }
  };

  const comissao = painel ? (100 * painel.taxas.reservas) / 100 : 6;

  return (
    <OwnerScreen titulo="Notas fiscais" subtitulo="Vendas, comissão Lokyva e assinatura" carregando={carregando && !painel} onAtualizar={() => carregar()}>
      {aviso}

      {painel?.ehSocio && (
        <>
          <View style={s.metricas}>
            <Metrica rotulo="Comissões no mês" valor={brl(painel.resumo.comissoes_mes)} icone="receipt-outline" />
            <Metrica rotulo="Vendas com nota" valor={brl(painel.resumo.vendas_mes)} icone="cash-outline" tom="positivo" />
            <Metrica rotulo="Precisam de atenção" valor={painel.resumo.pendencias} icone="alert-circle-outline" tom={painel.resumo.pendencias ? 'alerta' : 'neutro'} />
          </View>

          <Card>
            <Text style={s.titulo}>Onde ficam as notas que a Lokyva emite para você</Text>
            {[
              ['phone-portrait-outline', 'Aqui, nesta tela', 'Menu → Notas fiscais. A aba "Comissões" tem só as notas da Lokyva para você.'],
              ['mail-outline', 'No seu e-mail', 'Quando a prefeitura autoriza, a nota chega com o PDF e o XML.'],
              ['desktop-outline', 'No site', 'Menu lateral → Gestão → Notas fiscais.'],
            ].map(([icone, titulo, texto], i) => (
              <View key={titulo} style={s.passo}>
                <View style={s.passoNum}><Text style={s.passoNumTxt}>{i + 1}</Text></View>
                <Ionicons name={icone as any} size={18} color={O.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.passoTitulo}>{titulo}</Text>
                  <Text style={s.meta}>{texto}</Text>
                </View>
              </View>
            ))}
            <View style={s.fluxo}>
              <Text style={s.fluxoTxt}>
                Cliente paga {brl(100)} → {brl(100 - comissao)} vão direto para a sua carteira → a comissão de {brl(comissao)} tem nota da Lokyva para você. Entregue essas notas ao seu contador como despesa.
              </Text>
            </View>
          </Card>

          {!painel.elegivel && (
            <View style={s.dica}>
              <Ionicons name="sparkles-outline" size={18} color={O.accent} />
              <Text style={s.dicaTxt}>A nota da comissão Lokyva sai para você em toda venda online. A emissão automática das suas notas de venda para os clientes faz parte do Sócio Premium.</Text>
            </View>
          )}

          {painel.configuracao && <ConfiguracaoFiscal inicial={painel.configuracao} aoSalvar={(c) => setPainel({ ...painel, configuracao: c })} />}
        </>
      )}

      <Segmentado opcoes={painel?.ehSocio ? ABAS : ABAS.filter((a) => a.id !== 'comissao')} valor={aba} aoMudar={trocarAba} />

      {carregando ? (
        <ActivityIndicator color={O.accent} style={{ marginTop: 24 }} />
      ) : notas.length === 0 ? (
        <Vazio icone="document-text-outline" titulo="Nenhuma nota por aqui ainda" texto="As notas aparecem assim que um pagamento online é confirmado." />
      ) : (
        notas.map((n) => <CartaoNota key={n.id} nota={n} aoTentar={tentar} tentando={tentando === n.id} />)
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  metricas: { flexDirection: 'row', gap: 10 },
  linhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipo: { fontSize: 11, fontWeight: '800', color: O.accent, textTransform: 'uppercase', letterSpacing: 0.4 },
  titulo: { fontSize: 15, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted, lineHeight: 17 },
  valor: { fontSize: 16, fontWeight: '800', color: O.ink },
  erro: { fontSize: 12, color: O.danger, marginTop: 8 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  botao: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  botaoCheio: { backgroundColor: O.accent, borderColor: O.accent, paddingVertical: 12 },
  botaoTxt: { fontSize: 13, fontWeight: '700', color: O.accent },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  passoNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  passoNumTxt: { fontSize: 11, fontWeight: '800', color: O.accent },
  passoTitulo: { fontSize: 13, fontWeight: '700', color: O.ink },
  fluxo: { backgroundColor: O.soft, borderRadius: 14, padding: 12, marginTop: 14 },
  fluxoTxt: { fontSize: 12, color: O.ink, lineHeight: 18 },
  dica: { flexDirection: 'row', gap: 8, backgroundColor: O.infoBg, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  dicaTxt: { flex: 1, fontSize: 12, color: O.ink, lineHeight: 17 },
  rotulo: { fontSize: 12, fontWeight: '700', color: O.muted },
  input: { borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: O.ink, backgroundColor: '#fff' },
  switchLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
});
