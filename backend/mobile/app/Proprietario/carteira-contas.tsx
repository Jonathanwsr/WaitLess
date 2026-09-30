import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Pilula, Vazio, Erro, api, brl, estilos } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { alertar } from '../../services/alertar';

interface Conta {
  id: number;
  apelido: string;
  tipo: 'PIX' | 'CONTA';
  destino: string;
  titular_nome: string;
  status_validacao: 'validada' | 'validando' | 'pendente' | 'falhou';
  erro: string | null;
  padrao: boolean;
}

interface Repasse {
  id: number;
  nome: string;
  tipo: string;
  status: 'concluida' | 'processando' | 'pendente' | 'falhou' | 'cancelada';
  valor_bruto: number;
  taxa_plataforma: number;
  valor_liquido: number;
  destino: string | null;
  erro: string | null;
  criado_em: string | null;
}

interface Painel {
  proximo_repasse_rotulo: string;
  plano_libera_saque: boolean;
  tem_conta_asaas: boolean;
  regras: { taxa_percentual: number; taxa_minima: number; saque_minimo: number };
  contas: Conta[];
  historico: Repasse[];
  a_repassar: number;
  divida: number;
  saldo_asaas: number | null;
  saldo_indisponivel: boolean;
}

const BANCOS: [string, string][] = [
  ['260', 'Nubank'], ['077', 'Inter'], ['001', 'Banco do Brasil'], ['104', 'Caixa'], ['237', 'Bradesco'], ['341', 'Itaú'],
  ['033', 'Santander'], ['336', 'C6 Bank'], ['380', 'PicPay'], ['756', 'Sicoob'], ['748', 'Sicredi'], ['212', 'Original'],
];

const TIPOS_CHAVE: [string, string][] = [['CPF', 'CPF'], ['CNPJ', 'CNPJ'], ['EMAIL', 'E-mail'], ['PHONE', 'Celular'], ['RANDOM', 'Aleatória']];

const STATUS_CONTA: Record<string, { texto: string; tom: 'positivo' | 'alerta' | 'negativo' }> = {
  validada: { texto: 'Validada', tom: 'positivo' },
  validando: { texto: 'Validando…', tom: 'alerta' },
  pendente: { texto: 'Aguardando validação', tom: 'alerta' },
  falhou: { texto: 'Não validada', tom: 'negativo' },
};

const STATUS_REPASSE: Record<string, { texto: string; tom: 'positivo' | 'alerta' | 'negativo' | 'neutro' }> = {
  concluida: { texto: 'Concluído', tom: 'positivo' },
  processando: { texto: 'Em processamento', tom: 'alerta' },
  pendente: { texto: 'Enviando', tom: 'alerta' },
  falhou: { texto: 'Não concluído', tom: 'negativo' },
  cancelada: { texto: 'Cancelado', tom: 'neutro' },
};

const FORM_CONTA = {
  apelido: '', tipo: 'PIX' as 'PIX' | 'CONTA', pix_key_type: 'CPF', pix_key: '',
  banco_codigo: '260', agencia: '', conta: '', conta_digito: '', tipo_conta: 'CONTA_CORRENTE',
  titular_nome: '', titular_documento: '',
};

const taxaPara = (valor: number, regras: Painel['regras']) => (valor <= 0 ? 0 : Math.max(valor * (regras.taxa_percentual / 100), regras.taxa_minima));

export default function CarteiraContas() {
  const router = useRouter();
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Painel>(() => api('/proprietario/carteira'));

  const [valor, setValor] = useState('');
  const [contaId, setContaId] = useState<number | null>(null);
  const [sacando, setSacando] = useState(false);
  const [modal, setModal] = useState(false);

  const contasValidadas = useMemo(() => (dados?.contas || []).filter((c) => c.status_validacao === 'validada'), [dados]);

  // Conta escolhida para o saque: a padrão validada, ou a primeira validada.
  useEffect(() => {
    if (contaId && contasValidadas.some((c) => c.id === contaId)) return;
    const padrao = contasValidadas.find((c) => c.padrao) || contasValidadas[0];
    setContaId(padrao ? padrao.id : null);
  }, [contasValidadas, contaId]);

  // Enquanto houver conta sendo validada ou repasse em andamento, confere a cada 8s.
  const temPendencia = useMemo(
    () => !!dados && (dados.contas.some((c) => ['pendente', 'validando'].includes(c.status_validacao))
      || dados.historico.some((h) => ['pendente', 'processando'].includes(h.status))),
    [dados],
  );
  useEffect(() => {
    if (!temPendencia) return undefined;
    const t = setInterval(() => recarregar(), 8000);
    return () => clearInterval(t);
  }, [temPendencia, recarregar]);

  const acaoConta = useCallback(async (fn: () => Promise<any>) => {
    try {
      const r = await fn();
      if (r?.mensagem) mostrarSucesso('Tudo certo!', r.mensagem);
    } catch (e: any) {
      mostrarErro(e);
    } finally {
      recarregar();
    }
  }, [mostrarErro, mostrarSucesso, recarregar]);

  if (carregando && !dados) {
    return <OwnerScreen titulo="Contas e saque" carregando />;
  }
  if (erro && !dados) {
    return <OwnerScreen titulo="Contas e saque"><Erro mensagem={erro} aoTentar={recarregar} /></OwnerScreen>;
  }
  if (!dados) return null;

  // Sem conta de recebimento a carteira ainda não existe: volta para a explicação.
  if (!dados.tem_conta_asaas) {
    return (
      <OwnerScreen titulo="Contas e saque">
        <Card>
          <Vazio icone="wallet-outline" titulo="Ative sua carteira primeiro" texto="Para cadastrar contas de destino e sacar, informe seus dados de recebimento. Explicamos o porquê na tela da Carteira." />
          <TouchableOpacity style={estilos.botaoPrimario} onPress={() => router.replace('/Proprietario/financeiro' as never)} activeOpacity={0.85}>
            <Text style={estilos.botaoPrimarioTxt}>Ir para a Carteira</Text>
          </TouchableOpacity>
        </Card>
      </OwnerScreen>
    );
  }

  const { regras, plano_libera_saque: liberado } = dados;
  const valorNum = Number(String(valor).replace(',', '.')) || 0;
  const taxa = taxaPara(valorNum, regras);
  const receber = Math.max(valorNum - taxa, 0);
  const podeSacar = liberado && !!contaId && valorNum >= regras.saque_minimo && receber >= 1
    && dados.saldo_asaas !== null && valorNum <= dados.saldo_asaas && dados.divida <= 0;

  const sacar = () => {
    alertar('Confirmar repasse antecipado', `Você vai sacar ${brl(valorNum)}, pagar ${brl(taxa)} de taxa e receber ${brl(receber)}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sacar agora',
        onPress: async () => {
          setSacando(true);
          try {
            const r = await api('/proprietario/carteira/sacar', { method: 'POST', body: { conta_id: contaId, valor: valorNum } });
            mostrarSucesso('Repasse solicitado', r?.mensagem);
            setValor('');
          } catch (e: any) {
            mostrarErro(e, 'Não foi possível sacar');
          } finally {
            setSacando(false);
            recarregar();
          }
        },
      },
    ]);
  };

  const removerConta = (c: Conta) =>
    alertar('Remover conta', `Deseja remover "${c.apelido}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => acaoConta(() => api(`/proprietario/carteira/contas/${c.id}`, { method: 'DELETE' })) },
    ]);

  return (
    <OwnerScreen titulo="Contas e saque" atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}

      {/* SALDO + PRÓXIMO REPASSE */}
      <View style={s.hero}>
        <Text style={s.heroRotulo}>{liberado ? 'Saldo na carteira' : 'Próximo repasse'}</Text>
        {liberado ? (
          <>
            <Text style={s.heroValor}>{dados.saldo_asaas === null ? '—' : brl(dados.saldo_asaas)}</Text>
            {dados.saldo_indisponivel && <Text style={s.heroAlerta}>Não conseguimos consultar o saldo agora. Puxe para atualizar.</Text>}
          </>
        ) : (
          <Text style={s.heroValor}>{brl(dados.a_repassar)}</Text>
        )}
        <View style={s.heroLinha}>
          <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={s.heroSub}>
            {liberado ? `Repasse semanal previsto: ${brl(dados.a_repassar)} · ` : ''}cai na sua conta na {dados.proximo_repasse_rotulo}
          </Text>
        </View>
        {dados.divida > 0 && (
          <Text style={s.heroAlerta}>Pendências com a plataforma: {brl(dados.divida)}. O saque antecipado volta a ficar liberado quando forem quitadas no repasse semanal.</Text>
        )}
      </View>

      {/* REPASSE ANTECIPADO */}
      <Rotulo>Repasse antecipado</Rotulo>
      {!liberado ? (
        <Card>
          <View style={s.bloqueioTopo}>
            <View style={s.bloqueioIcone}><Ionicons name="lock-closed" size={20} color={O.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemTitulo}>Saque quando quiser</Text>
              <Text style={s.itemSub}>Seu saldo é repassado toda segunda-feira, sem taxa. O plano Premium Sócio Anual libera o saldo completo e o repasse antecipado.</Text>
            </View>
          </View>
          <TouchableOpacity style={estilos.botaoPrimario} onPress={() => router.push('/assinatura' as never)} activeOpacity={0.85}>
            <Text style={estilos.botaoPrimarioTxt}>Ver planos</Text>
          </TouchableOpacity>
        </Card>
      ) : contasValidadas.length === 0 ? (
        <Card><Vazio icone="business-outline" titulo="Cadastre e valide uma conta" texto="Para sacar, cadastre uma conta de destino abaixo e aguarde a validação por Pix de R$ 0,01." /></Card>
      ) : (
        <Card>
          <Text style={s.label}>Enviar para</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {contasValidadas.map((c) => (
              <TouchableOpacity key={c.id} style={[s.chip, contaId === c.id && s.chipOn]} onPress={() => setContaId(c.id)} activeOpacity={0.8}>
                <Text style={[s.chipTxt, contaId === c.id && { color: '#fff' }]} numberOfLines={1}>{c.apelido} · {c.destino}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Quanto sacar</Text>
          <View style={s.valorBox}>
            <Text style={s.valorRs}>R$</Text>
            <TextInput style={s.valorInput} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={O.faint} />
            {!!dados.saldo_asaas && dados.saldo_asaas > 0 && (
              <TouchableOpacity onPress={() => setValor(String(dados.saldo_asaas).replace('.', ','))}><Text style={s.tudo}>TUDO</Text></TouchableOpacity>
            )}
          </View>

          <View style={s.conta}>
            <View style={s.contaLinha}><Text style={s.contaRotulo}>Taxa de antecipação ({regras.taxa_percentual}%, mín. {brl(regras.taxa_minima)})</Text><Text style={s.contaValor}>{valorNum > 0 ? `- ${brl(taxa)}` : '—'}</Text></View>
            <View style={s.contaLinha}><Text style={s.contaTotal}>Você recebe</Text><Text style={s.contaTotal}>{valorNum > 0 ? brl(receber) : '—'}</Text></View>
          </View>

          <TouchableOpacity style={[s.btnSacar, (!podeSacar || sacando) && { opacity: 0.4 }]} disabled={!podeSacar || sacando} onPress={sacar} activeOpacity={0.85}>
            {sacando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSacarTxt}>Sacar agora</Text>}
          </TouchableOpacity>
          <Text style={s.nota}>Mínimo de {brl(regras.saque_minimo)}. Sem a antecipação, o saldo é repassado automaticamente toda segunda-feira, sem taxa.</Text>
        </Card>
      )}

      {/* CONTAS DE DESTINO */}
      <Rotulo direita={
        <TouchableOpacity style={s.nova} onPress={() => setModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={O.accent} /><Text style={s.novaTxt}>Nova conta</Text>
        </TouchableOpacity>
      }>
        Contas de destino
      </Rotulo>
      {dados.contas.length === 0 ? (
        <Card><Vazio icone="business-outline" titulo="Nenhuma conta ainda" texto="Cadastre uma chave Pix ou conta bancária para receber seus repasses. Enviamos R$ 0,01 por Pix para confirmar que é sua." /></Card>
      ) : dados.contas.map((c) => {
        const st = STATUS_CONTA[c.status_validacao] || STATUS_CONTA.pendente;
        return (
          <Card key={c.id}>
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <View style={s.linha}>
                  <Text style={s.itemTitulo} numberOfLines={1}>{c.apelido}</Text>
                  {c.padrao && <Ionicons name="star" size={15} color="#F59E0B" />}
                </View>
                <Text style={s.itemSub} numberOfLines={1}>{c.destino}</Text>
              </View>
              <Pilula texto={st.texto} tom={st.tom} />
            </View>
            {!!c.erro && <Text style={s.erro}>{c.erro}</Text>}
            <View style={s.acoes}>
              {c.status_validacao === 'falhou' && (
                <TouchableOpacity onPress={() => acaoConta(() => api(`/proprietario/carteira/contas/${c.id}/validar`, { method: 'POST', body: {} }))}><Text style={s.acao}>Tentar validar de novo</Text></TouchableOpacity>
              )}
              {c.status_validacao === 'validada' && !c.padrao && (
                <TouchableOpacity onPress={() => acaoConta(() => api(`/proprietario/carteira/contas/${c.id}/padrao`, { method: 'POST', body: {} }))}><Text style={s.acaoCinza}>Usar no repasse semanal</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => removerConta(c)}><Ionicons name="trash-outline" size={19} color={O.faint} /></TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {/* HISTÓRICO */}
      <Rotulo>Repasses</Rotulo>
      {dados.historico.length === 0 ? (
        <Card><Vazio icone="cash-outline" titulo="Nenhum repasse ainda" texto="Seus repasses semanais e antecipados aparecem aqui." /></Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {dados.historico.map((h, i) => {
            const st = STATUS_REPASSE[h.status] || STATUS_REPASSE.pendente;
            return (
              <View key={h.id} style={[s.hist, i < dados.historico.length - 1 && s.histBorda]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitulo} numberOfLines={1}>{h.nome} <Text style={s.itemSub}>#{h.id}</Text></Text>
                  <Text style={s.itemSub} numberOfLines={1}>{h.criado_em ? new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}{h.destino ? ` · ${h.destino}` : ''}</Text>
                  {!!h.erro && <Text style={s.erro}>{h.erro}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.itemTitulo}>{brl(h.valor_liquido)}</Text>
                  {h.taxa_plataforma > 0 && <Text style={s.itemSub}>taxa {brl(h.taxa_plataforma)}</Text>}
                  <Pilula texto={st.texto} tom={st.tom} />
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <ModalConta
        visivel={modal}
        aoFechar={() => setModal(false)}
        aoSalvar={(msg) => { setModal(false); mostrarSucesso('Conta cadastrada', msg); recarregar(); }}
        aoErro={(e) => mostrarErro(e, 'Não foi possível cadastrar')}
      />
    </OwnerScreen>
  );
}

/** Linha de opções escolhíveis (tipo de chave, banco, tipo de conta...). Fora do modal para não remontar a cada tecla. */
function Chips({ opcoes, valor, aoEscolher }: { opcoes: [string, string][]; valor: string; aoEscolher: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
      {opcoes.map(([v, r]) => (
        <TouchableOpacity key={v} style={[s.chip, valor === v && s.chipOn]} onPress={() => aoEscolher(v)} activeOpacity={0.8}>
          <Text style={[s.chipTxt, valor === v && { color: '#fff' }]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ModalConta({ visivel, aoFechar, aoSalvar, aoErro }: {
  visivel: boolean; aoFechar: () => void; aoSalvar: (mensagem?: string) => void; aoErro: (e: any) => void;
}) {
  const [f, setF] = useState(FORM_CONTA);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof FORM_CONTA) => (v: string) => setF((atual) => ({ ...atual, [k]: v }));

  const enviar = async () => {
    setEnviando(true);
    try {
      const banco = BANCOS.find(([c]) => c === f.banco_codigo);
      const r = await api('/proprietario/carteira/contas', {
        method: 'POST',
        body: { ...f, banco_nome: f.tipo === 'CONTA' ? banco?.[1] : null },
      });
      setF(FORM_CONTA);
      aoSalvar(r?.mensagem);
    } catch (e: any) {
      aoErro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoFechar}>
      <KeyboardAvoidingView style={s.modalFundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalCard}>
          <View style={s.modalTopo}>
            <Text style={s.modalTitulo}>Nova conta de destino</Text>
            <TouchableOpacity onPress={aoFechar}><Ionicons name="close" size={24} color={O.ink} /></TouchableOpacity>
          </View>
          <Text style={s.itemSub}>Vamos enviar R$ 0,01 por Pix para confirmar que a conta é sua. Ela precisa estar no seu CPF/CNPJ.</Text>

          <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Chips opcoes={[['PIX', 'Chave Pix'], ['CONTA', 'Conta bancária']]} valor={f.tipo} aoEscolher={(v) => set('tipo')(v)} />

            <Text style={s.label}>Apelido</Text>
            <TextInput style={[estilos.campo, s.gap]} value={f.apelido} onChangeText={set('apelido')} placeholder="Ex.: Conta pessoal" placeholderTextColor={O.faint} maxLength={60} />

            {f.tipo === 'PIX' ? (
              <>
                <Text style={s.label}>Tipo da chave</Text>
                <Chips opcoes={TIPOS_CHAVE} valor={f.pix_key_type} aoEscolher={set('pix_key_type')} />
                <Text style={s.label}>Chave Pix</Text>
                <TextInput style={[estilos.campo, s.gap]} value={f.pix_key} onChangeText={set('pix_key')} autoCapitalize="none" placeholder="Digite a chave" placeholderTextColor={O.faint} />
              </>
            ) : (
              <>
                <Text style={s.label}>Banco</Text>
                <Chips opcoes={BANCOS.map(([c, n]) => [c, `${c} · ${n}`] as [string, string])} valor={f.banco_codigo} aoEscolher={set('banco_codigo')} />
                <View style={s.trio}>
                  <TextInput style={[estilos.campo, { flex: 1 }]} value={f.agencia} onChangeText={set('agencia')} keyboardType="number-pad" placeholder="Agência" placeholderTextColor={O.faint} />
                  <TextInput style={[estilos.campo, { flex: 1 }]} value={f.conta} onChangeText={set('conta')} keyboardType="number-pad" placeholder="Conta" placeholderTextColor={O.faint} />
                  <TextInput style={[estilos.campo, { width: 70 }]} value={f.conta_digito} onChangeText={set('conta_digito')} placeholder="Dígito" placeholderTextColor={O.faint} maxLength={3} />
                </View>
                <Chips opcoes={[['CONTA_CORRENTE', 'Conta corrente'], ['CONTA_POUPANCA', 'Conta poupança']]} valor={f.tipo_conta} aoEscolher={set('tipo_conta')} />
              </>
            )}

            <Text style={s.label}>Titular</Text>
            <TextInput style={[estilos.campo, s.gap]} value={f.titular_nome} onChangeText={set('titular_nome')} placeholder="Nome completo do titular" placeholderTextColor={O.faint} />
            <TextInput style={[estilos.campo, s.gap]} value={f.titular_documento} onChangeText={set('titular_documento')} keyboardType="number-pad" placeholder="CPF/CNPJ do titular" placeholderTextColor={O.faint} />
          </ScrollView>

          <TouchableOpacity style={[s.btnSalvar, enviando && { opacity: 0.6 }]} disabled={enviando} onPress={enviar} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSacarTxt}>Cadastrar e validar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 6 },
  heroRotulo: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValor: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  heroLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  heroSub: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 12, lineHeight: 17 },
  heroAlerta: { color: '#FEF3C7', fontSize: 12, lineHeight: 17, marginTop: 10 },

  itemTitulo: { fontSize: 15, fontWeight: '700', color: O.ink },
  itemSub: { fontSize: 12, color: O.muted, marginTop: 2, lineHeight: 17 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  erro: { fontSize: 12, color: O.danger, marginTop: 8, lineHeight: 17 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  acao: { fontSize: 13, fontWeight: '700', color: O.accent },
  acaoCinza: { fontSize: 13, fontWeight: '700', color: O.muted },

  bloqueioTopo: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  bloqueioIcone: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 12, fontWeight: '700', color: O.muted, marginBottom: 6 },
  gap: { marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: O.soft, maxWidth: 260 },
  chipOn: { backgroundColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.ink },

  valorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: O.line, borderRadius: 16, paddingHorizontal: 16, height: 60 },
  valorRs: { fontSize: 16, fontWeight: '800', color: O.faint },
  valorInput: { flex: 1, fontSize: 24, fontWeight: '800', color: O.ink },
  tudo: { fontSize: 12, fontWeight: '800', color: O.accent },
  conta: { backgroundColor: O.soft, borderRadius: 16, padding: 14, marginTop: 12, gap: 6 },
  contaLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  contaRotulo: { flex: 1, fontSize: 12, color: O.muted },
  contaValor: { fontSize: 13, fontWeight: '700', color: O.ink },
  contaTotal: { fontSize: 15, fontWeight: '800', color: O.ink },
  btnSacar: { alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, backgroundColor: '#12A150', marginTop: 14 },
  btnSacarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  nota: { fontSize: 11, color: O.muted, marginTop: 10, lineHeight: 16 },

  nova: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1E4', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  novaTxt: { fontSize: 12, fontWeight: '700', color: O.accent, textTransform: 'none', letterSpacing: 0 },

  hist: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  histBorda: { borderBottomWidth: 1, borderBottomColor: O.line },

  modalFundo: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, maxHeight: '92%' },
  modalTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: O.ink, letterSpacing: -0.4 },
  trio: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnSalvar: { alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, backgroundColor: '#12A150', marginTop: 14 },
});
