import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { OwnerScreen, Card, Rotulo, Pilula, Vazio, Erro, Segmentado, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { O } from '../../constants/OwnerTheme';
import { alertar } from '../../services/alertar';
import { baixarPdf } from '../../services/baixarPdf';

type Parcela = { id: number; numero: number; valor: string | number; vencimento: string; status: string; forma_pagamento: string; baixa_manual?: boolean };
type Cobranca = {
  id: number;
  codigo: string;
  modo: 'online' | 'presencial';
  valor_total: string | number;
  status: string;
  cliente?: { name: string } | null;
  estabelecimento?: { nome: string } | null;
  itens: { id: number; descricao: string; funcionario?: { nome: string } | null }[];
  parcelas: Parcela[];
};
type Dados = { cobrancas: Cobranca[]; podeCriar: boolean; taxaPercentual: number; parteDoSocioPercentual: number; estabelecimentos: { id: number; nome: string }[] };

const STATUS: Record<string, { rotulo: string; tom: 'neutro' | 'positivo' | 'negativo' | 'alerta' | 'info' }> = {
  aguardando_aceite: { rotulo: 'Aguardando aceite', tom: 'alerta' },
  aceita: { rotulo: 'Em andamento', tom: 'info' },
  quitada: { rotulo: 'Quitada', tom: 'positivo' },
  recusada: { rotulo: 'Recusada', tom: 'negativo' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
};

const PARCELA: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'Pendente', cor: O.muted },
  atrasado: { rotulo: 'Atrasada', cor: O.danger },
  pago: { rotulo: 'Paga', cor: O.success },
  cancelado: { rotulo: 'Cancelada', cor: O.faint },
  estornado: { rotulo: 'Estornada', cor: O.faint },
};

const FILTROS = [
  { id: 'abertas', rotulo: 'Em aberto' },
  { id: 'quitadas', rotulo: 'Quitadas' },
  { id: 'todas', rotulo: 'Todas' },
];

const pct = (v: number) => String(v).replace('.', ',');
const dataBR = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-');

export default function Cobrancas() {
  const router = useRouter();
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(() => api('/cobrancas'));
  const [filtro, setFiltro] = useState('abertas');
  const [ocupado, setOcupado] = useState<number | null>(null);

  const lista = (dados?.cobrancas || []).filter((c) => {
    if (filtro === 'abertas') return c.status === 'aguardando_aceite' || c.status === 'aceita';
    if (filtro === 'quitadas') return c.status === 'quitada';
    return true;
  });

  const executar = async (id: number, acao: () => Promise<any>, sucesso: string) => {
    setOcupado(id);
    try {
      const r = await acao();
      mostrarSucesso(r?.message || sucesso);
      recarregar();
    } catch (e) {
      mostrarErro(e);
    } finally {
      setOcupado(null);
    }
  };

  const darBaixa = (c: Cobranca, p: Parcela) => {
    alertar('Marcar como paga?', `Parcela ${p.numero} de ${brl(p.valor)}. A taxa de ${pct(dados?.taxaPercentual ?? 0.5)}% será descontada do seu próximo repasse.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Marcar como paga', onPress: () => executar(c.id, () => api(`/cobrancas/parcelas/${p.id}/baixa`, { method: 'POST', body: {} }), 'Parcela marcada como paga.') },
    ]);
  };

  const cancelar = (c: Cobranca) => {
    alertar('Cancelar cobrança?', 'As parcelas em aberto deixam de ser cobradas.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar cobrança', style: 'destructive', onPress: () => executar(c.id, () => api(`/cobrancas/${c.id}/cancelar`, { method: 'POST' }), 'Cobrança cancelada.') },
    ]);
  };

  const comprovante = async (c: Cobranca) => {
    try {
      await baixarPdf(`/cobrancas/${c.id}/comprovante-pdf`, `Comprovante_${c.codigo}.pdf`);
    } catch (e) {
      mostrarErro(e);
    }
  };

  const novo = (
    <TouchableOpacity
      onPress={() => (dados?.podeCriar ? router.push('/Proprietario/NovaCobranca' as never) : mostrarErro({ premium: true, message: 'Cobranças parceladas são exclusivas do plano premium de sócio.' }))}
      style={s.botaoNovo}
      accessibilityRole="button"
      accessibilityLabel="Nova cobrança"
    >
      <Ionicons name="add" size={22} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <OwnerScreen titulo="Cobranças" subtitulo="Parcelas de serviços e reservas" direita={novo} carregando={carregando} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro ? <Erro mensagem={erro} aoTentar={recarregar} /> : (
        <>
          <Card style={{ backgroundColor: O.infoBg }}>
            <Text style={s.infoTitulo}>Como funciona o dinheiro</Text>
            <Text style={s.infoTxt}>• Online: cada parcela vira um link (PIX, boleto ou cartão). Você recebe {pct(dados?.parteDoSocioPercentual ?? 99.5)}% direto na carteira; a plataforma fica com {pct(dados?.taxaPercentual ?? 0.5)}%.</Text>
            <Text style={s.infoTxt}>• Presencial: o cliente paga a você e você marca como paga. A taxa de {pct(dados?.taxaPercentual ?? 0.5)}% sai do seu próximo repasse.</Text>
            <Text style={s.infoTxt}>• O cliente precisa aceitar antes de qualquer cobrança.</Text>
          </Card>

          <Segmentado opcoes={FILTROS} valor={filtro} aoMudar={setFiltro} />

          {lista.length === 0 ? (
            <Card><Vazio icone="cash-outline" titulo="Nenhuma cobrança aqui" texto="Toque em + para cobrar um serviço ou uma reserva em parcelas." /></Card>
          ) : lista.map((c) => {
            const st = STATUS[c.status] || STATUS.aceita;
            const podeCancelar = (c.status === 'aguardando_aceite' || c.status === 'aceita') && !c.parcelas.some((p) => p.status === 'pago');
            return (
              <Card key={c.id}>
                <View style={s.topo}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.cliente}>{c.cliente?.name || 'Cliente'}</Text>
                    <Pilula texto={st.rotulo} tom={st.tom} />
                    <Text style={s.meta}>{c.codigo} · {c.estabelecimento?.nome} · {c.modo === 'online' ? 'Online' : 'Presencial'}</Text>
                  </View>
                  <Text style={s.total}>{brl(c.valor_total)}</Text>
                </View>

                {c.itens.map((i) => (
                  <Text key={i.id} style={s.item}>• {i.descricao}{i.funcionario?.nome ? ` · com ${i.funcionario.nome}` : ''}</Text>
                ))}

                <Rotulo>Parcelas</Rotulo>
                {c.parcelas.map((p) => {
                  const ps = PARCELA[p.status] || PARCELA.pendente;
                  const emAberto = (p.status === 'pendente' || p.status === 'atrasado') && c.status === 'aceita';
                  return (
                    <View key={p.id} style={s.parcela}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.parcelaTxt}>{p.numero}/{c.parcelas.length} · {brl(p.valor)}</Text>
                        <Text style={[s.meta, { color: ps.cor }]}>{ps.rotulo}{p.baixa_manual ? ' (baixa manual)' : ''} · vence {dataBR(p.vencimento)}</Text>
                      </View>
                      {emAberto && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {p.forma_pagamento === 'online' && (
                            <TouchableOpacity disabled={ocupado === c.id} onPress={() => executar(c.id, () => api(`/cobrancas/parcelas/${p.id}/sincronizar`, { method: 'POST' }), 'Parcela atualizada.')} style={s.acaoIcone} accessibilityLabel="Atualizar com o Asaas">
                              <Ionicons name="refresh" size={16} color={O.ink} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity disabled={ocupado === c.id} onPress={() => darBaixa(c, p)} style={s.acaoPaga}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={s.acaoPagaTxt}>Paga</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={s.rodape}>
                  <TouchableOpacity onPress={() => comprovante(c)} style={s.link}>
                    <Ionicons name="document-text-outline" size={15} color={O.ink} />
                    <Text style={s.linkTxt}>Comprovante PDF</Text>
                  </TouchableOpacity>
                  {podeCancelar && (
                    <TouchableOpacity disabled={ocupado === c.id} onPress={() => cancelar(c)} style={s.link}>
                      <Ionicons name="close-circle-outline" size={15} color={O.danger} />
                      <Text style={[s.linkTxt, { color: O.danger }]}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  botaoNovo: { width: 44, height: 44, borderRadius: 22, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center' },
  infoTitulo: { fontSize: 14, fontWeight: '800', color: O.info, marginBottom: 6 },
  infoTxt: { fontSize: 12, color: O.ink, lineHeight: 18 },
  topo: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cliente: { fontSize: 16, fontWeight: '800', color: O.ink },
  total: { fontSize: 18, fontWeight: '900', color: O.ink },
  meta: { fontSize: 12, color: O.muted },
  item: { fontSize: 13, color: O.ink, marginBottom: 2 },
  parcela: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: O.line, borderRadius: 12, padding: 10, marginBottom: 6 },
  parcelaTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
  acaoIcone: { width: 34, height: 34, borderRadius: 10, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  acaoPaga: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: O.success, borderRadius: 10, paddingHorizontal: 10, height: 34 },
  acaoPagaTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  linkTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
});
