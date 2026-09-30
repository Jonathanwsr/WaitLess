import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Segmentado, Vazio, Erro, api, brl, dataCurta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';

interface Movimentacao {
  id: number;
  tipo: string;
  descricao: string | null;
  valor_bruto: number;
  valor_liquido: number;
  taxa_plataforma: number;
  status: string;
  metodo_pagamento: string | null;
  data: string;
  data_liberacao?: string | null;
}

interface EstornoLinha {
  id: number;
  codigo: string | null;
  status: string;
  cliente: string | null;
  valor_pago: number;
  valor_estornado: number;
  motivo: string | null;
  data: string | null;
}

interface Financeiro {
  dias: number;
  carteira: {
    configurada: boolean;
    saldo?: number;
    disponivel?: number;
    retido?: number;
    em_analise?: number;
    estornado?: number;
    tem_chave_pix?: boolean;
    saldo_carteira?: number | null;
    a_receber_semana?: number;
    proximo_repasse?: string | null;
    proximo_repasse_rotulo?: string | null;
    conta_recebimento_ativa?: boolean;
    estornos_em_analise?: number;
    estornado_total?: number;
    estornos_lista?: EstornoLinha[];
  };
  resumo: {
    receita_bruta: number;
    taxas_plataforma: number;
    estornos: number;
    repasses: number;
    liquido: number;
    transacoes: number;
    ticket_medio: number;
  };
  movimentacoes: Movimentacao[];
}

const TIPOS: Record<string, { rotulo: string; icone: string; tom: 'positivo' | 'negativo' | 'info' | 'neutro' }> = {
  credito: { rotulo: 'Recebimento', icone: 'arrow-down-circle-outline', tom: 'positivo' },
  estorno: { rotulo: 'Estorno', icone: 'return-up-back-outline', tom: 'negativo' },
  repasse: { rotulo: 'Repasse PIX', icone: 'arrow-up-circle-outline', tom: 'info' },
};

const STATUS_ESTORNO: Record<string, { texto: string; tom: 'alerta' | 'negativo' | 'neutro' }> = {
  PENDENTE: { texto: 'Aguardando', tom: 'alerta' },
  EM_ANALISE: { texto: 'Em análise', tom: 'alerta' },
  ESTORNADO: { texto: 'Estornado', tom: 'negativo' },
  REPROVADO: { texto: 'Negado', tom: 'neutro' },
  CANCELADO: { texto: 'Cancelado', tom: 'neutro' },
};

/** Em que pé está cada movimentação e quando o dinheiro entra. */
function situacao(m: Movimentacao, proximoRepasse?: string | null): { texto: string; tom: 'positivo' | 'alerta' | 'negativo' | 'neutro' } | null {
  if (m.tipo === 'repasse') return null;
  if (m.tipo === 'estorno' || m.status === 'estornado') return { texto: 'Estornado', tom: 'negativo' };
  if (m.data_liberacao && new Date(m.data_liberacao) > new Date()) return { texto: `Libera em ${dataCurta(m.data_liberacao)}`, tom: 'alerta' };
  if (['pendente', 'aguardando', 'a_liberar'].includes(m.status)) return { texto: proximoRepasse ? `Entra no repasse de ${proximoRepasse}` : 'Entra no próximo repasse', tom: 'alerta' };
  return { texto: 'Recebido', tom: 'positivo' };
}

/** Carteira ainda desativada: explica por que os dados precisam ser informados de novo e o que acontece depois. */
function ExplicacaoAtivacao({ aoInformar }: { aoInformar: () => void }) {
  const motivos = [
    { icone: 'id-card-outline', titulo: 'É uma exigência para receber', texto: 'Quem recebe pagamentos precisa ser identificado (nome, CPF/CNPJ, nascimento ou tipo de empresa, endereço e telefone). É uma regra do sistema financeiro para evitar fraudes e lavagem de dinheiro.' },
    { icone: 'shield-checkmark-outline', titulo: 'O dinheiro só vai para você', texto: 'A conta é aberta no seu CPF/CNPJ e os repasses só saem para contas do mesmo titular.' },
    { icone: 'checkmark-done-outline', titulo: 'Você faz isso uma vez só', texto: 'Depois de enviar, os dados ficam salvos. Você só volta para atualizar algo.' },
  ];
  const passos = [
    { titulo: 'Sua conta de recebimento é criada', texto: 'Seus clientes já podem pagar online (Pix, cartão e boleto) nas suas reservas.' },
    { titulo: 'Você cadastra a chave Pix de destino', texto: 'É para essa chave que os repasses semanais são enviados.' },
    { titulo: 'Sua carteira funciona por completo', texto: 'Você vê o dia e o valor do próximo repasse, o que já entrou, as taxas, os valores estornados e cada movimentação.' },
  ];
  return (
    <>
      <View style={s.ativarHero}>
        <View style={s.ativarIcone}><Ionicons name="wallet-outline" size={26} color="#fff" /></View>
        <Text style={s.ativarTitulo}>Ative sua carteira</Text>
        <Text style={s.ativarTexto}>Falta um passo: informar seus dados de recebimento. Até lá, seus clientes não conseguem pagar online e a carteira fica desativada.</Text>
      </View>

      <Card>
        <Text style={s.blocoTitulo}>Por que preciso informar meus dados de novo?</Text>
        <Text style={s.blocoTexto}>
          Seu cadastro no app serve para você entrar na conta. Para receber dinheiro, abrimos uma conta de recebimento em seu nome numa processadora de pagamentos externa e regulamentada, e ela exige os dados completos de quem vai receber.
        </Text>
        {motivos.map((m) => (
          <View key={m.titulo} style={s.motivo}>
            <View style={s.motivoIcone}><Ionicons name={m.icone as any} size={20} color={O.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.motivoTitulo}>{m.titulo}</Text>
              <Text style={s.motivoTexto}>{m.texto}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.blocoTitulo}>O que acontece depois que você enviar</Text>
        {passos.map((p, i) => (
          <View key={p.titulo} style={s.passo}>
            <View style={s.passoNum}><Text style={s.passoNumTxt}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.motivoTitulo}>{p.titulo}</Text>
              <Text style={s.motivoTexto}>{p.texto}</Text>
            </View>
          </View>
        ))}
      </Card>

      <TouchableOpacity style={s.ativarBtn} onPress={aoInformar} activeOpacity={0.85}>
        <Text style={s.ativarBtnTxt}>Informar meus dados agora</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
      <Text style={s.ativarNota}>Seus dados são usados apenas para abrir e manter a sua conta de recebimento.</Text>
    </>
  );
}

export default function FinanceiroSocio() {
  const router = useRouter();
  const [dias, setDias] = useState('30');
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Financeiro>(
    () => api(`/proprietario/financeiro?dias=${dias}`),
    [dias]
  );

  const carteira = dados?.carteira;

  return (
    <OwnerScreen titulo="Carteira" subtitulo="Recebimentos, taxas e repasses" semVoltar aba="financeiro" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : dados && !carteira?.configurada ? (
        <>
          <ExplicacaoAtivacao aoInformar={() => router.push('/Proprietario/RegisterProviderScreen' as never)} />
          <TouchableOpacity style={s.linkAjuda} onPress={() => router.push('/src/screens/ComoFuncionamPagamentos?perfil=dono' as never)} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={20} color={O.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.linkAjudaTitulo}>Como funcionam os pagamentos e as taxas</Text>
              <Text style={s.linkAjudaSub}>Divisão do valor, repasse semanal e saque antecipado</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={O.faint} />
          </TouchableOpacity>
        </>
      ) : dados && (
        <>
          {/* SALDO */}
          <View style={s.hero}>
            <Text style={s.heroRotulo}>Saldo na carteira</Text>
            <Text style={s.heroValor}>{carteira?.configurada ? brl(carteira.saldo_carteira ?? carteira.disponivel) : 'R$ 0,00'}</Text>

            {carteira?.configurada && !!carteira.proximo_repasse_rotulo && (
              <View style={s.repasse}>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.repasseValor}>{brl(carteira.a_receber_semana)}</Text>
                  <Text style={s.repasseTxt}>caem na sua conta na {carteira.proximo_repasse_rotulo} (repasse semanal)</Text>
                </View>
              </View>
            )}

            {carteira?.configurada ? (
              <View style={s.heroLinha}>
                <View style={s.heroItem}>
                  <Text style={s.heroItemRotulo}>Retido</Text>
                  <Text style={s.heroItemValor}>{brl(carteira.retido)}</Text>
                </View>
                <View style={s.heroDivisor} />
                <View style={s.heroItem}>
                  <Text style={s.heroItemRotulo}>Em análise</Text>
                  <Text style={s.heroItemValor}>{brl(carteira.em_analise)}</Text>
                </View>
                <View style={s.heroDivisor} />
                <View style={s.heroItem}>
                  <Text style={s.heroItemRotulo}>Estornado</Text>
                  <Text style={s.heroItemValor}>{brl(carteira.estornado)}</Text>
                </View>
              </View>
            ) : null}

            {carteira?.configurada && !carteira.tem_chave_pix && (
              <View style={s.aviso}>
                <Ionicons name="alert-circle-outline" size={18} color="#fff" />
                <Text style={s.avisoTxt}>Cadastre uma chave PIX para receber os repasses semanais.</Text>
              </View>
            )}
          </View>

          <Segmentado
            opcoes={[{ id: '7', rotulo: '7 dias' }, { id: '30', rotulo: '30 dias' }, { id: '90', rotulo: '90 dias' }]}
            valor={dias}
            aoMudar={setDias}
          />

          {/* RESUMO */}
          <View style={s.grade}>
            <Metrica rotulo="Receita bruta" valor={brl(dados.resumo.receita_bruta)} icone="trending-up-outline" tom="positivo" />
            <Metrica rotulo="Líquido" valor={brl(dados.resumo.liquido)} icone="cash-outline" />
          </View>
          <View style={s.grade}>
            <Metrica rotulo="Taxas da plataforma" valor={brl(dados.resumo.taxas_plataforma)} icone="receipt-outline" tom="alerta" />
            <Metrica rotulo="Estornos" valor={brl(dados.resumo.estornos)} icone="return-up-back-outline" tom="negativo" />
          </View>
          <View style={s.grade}>
            <Metrica rotulo="Repasses enviados" valor={brl(dados.resumo.repasses)} icone="paper-plane-outline" />
            <Metrica rotulo="Ticket médio" valor={brl(dados.resumo.ticket_medio)} icone="pricetag-outline" />
          </View>

          <TouchableOpacity style={s.linkAjuda} onPress={() => router.push('/src/screens/ComoFuncionamPagamentos?perfil=dono' as never)} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={20} color={O.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.linkAjudaTitulo}>Como funcionam os pagamentos e as taxas</Text>
              <Text style={s.linkAjudaSub}>Divisão do valor, repasse semanal e saque antecipado</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={O.faint} />
          </TouchableOpacity>

          <TouchableOpacity style={s.linkAjuda} onPress={() => router.push('/Proprietario/carteira-contas' as never)} activeOpacity={0.7}>
            <Ionicons name="business-outline" size={20} color={O.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.linkAjudaTitulo}>Contas de destino e saque</Text>
              <Text style={s.linkAjudaSub}>Cadastre onde receber e retire antes do repasse semanal</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={O.faint} />
          </TouchableOpacity>

          <TouchableOpacity style={s.linkAjuda} onPress={() => router.push('/Proprietario/RegisterProviderScreen' as never)} activeOpacity={0.7}>
            <Ionicons name="id-card-outline" size={20} color={O.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.linkAjudaTitulo}>Dados da conta de recebimento</Text>
              <Text style={s.linkAjudaSub}>Confira seus dados e a chave Pix dos repasses</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={O.faint} />
          </TouchableOpacity>

          <Rotulo>{`Movimentações (${dados.resumo.transacoes} recebimentos)`}</Rotulo>
          {dados.movimentacoes.length === 0 ? (
            <Card><Vazio icone="receipt-outline" titulo="Sem movimentações" texto="Quando houver pagamentos, estornos ou repasses neste período, eles aparecem aqui." /></Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {dados.movimentacoes.map((m, i) => {
                const t = TIPOS[m.tipo] || { rotulo: m.tipo, icone: 'ellipse-outline', tom: 'neutro' as const };
                const positivo = m.tipo === 'credito';
                const valor = m.tipo === 'credito' ? m.valor_bruto : Math.abs(m.valor_liquido);
                return (
                  <View key={m.id} style={[s.mov, i < dados.movimentacoes.length - 1 && s.movBorda]}>
                    <View style={[s.movIcone, { backgroundColor: positivo ? O.successBg : m.tipo === 'estorno' ? O.dangerBg : O.soft }]}>
                      <Ionicons name={t.icone as any} size={20} color={positivo ? O.success : m.tipo === 'estorno' ? O.danger : O.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.movTitulo} numberOfLines={1}>{m.descricao || t.rotulo}</Text>
                      <Text style={s.movSub}>
                        {t.rotulo}{m.metodo_pagamento ? ` · ${m.metodo_pagamento.toUpperCase()}` : ''} · {dataCurta(m.data)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[s.movValor, { color: positivo ? O.success : O.ink }]}>
                        {positivo ? '+ ' : '- '}{brl(valor)}
                      </Text>
                      {(() => { const st = situacao(m, carteira?.proximo_repasse_rotulo); return st ? <Pilula texto={st.texto} tom={st.tom} /> : null; })()}
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          <Rotulo direita={
            <TouchableOpacity onPress={() => router.push('/Proprietario/estornos' as never)}>
              <Text style={s.verTodos}>Ver e contestar</Text>
            </TouchableOpacity>
          }>
            {`Estornos${carteira?.estornos_em_analise ? ` (${carteira.estornos_em_analise} em análise)` : ''}`}
          </Rotulo>
          {(carteira?.estornos_lista || []).length === 0 ? (
            <Card><Vazio icone="return-up-back-outline" titulo="Nenhum estorno" texto="Quando um cliente pedir a devolução de um pagamento, você acompanha o valor e a decisão aqui. O valor devolvido é descontado do seu saldo ou dos próximos repasses." /></Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {(carteira?.estornos_lista || []).map((e, i, lista) => {
                const st = STATUS_ESTORNO[e.status] || STATUS_ESTORNO.PENDENTE;
                return (
                  <View key={e.id} style={[s.mov, i < lista.length - 1 && s.movBorda]}>
                    <View style={[s.movIcone, { backgroundColor: O.dangerBg }]}>
                      <Ionicons name="return-up-back-outline" size={20} color={O.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.movTitulo} numberOfLines={1}>{e.cliente || 'Cliente'}</Text>
                      <Text style={s.movSub} numberOfLines={1}>{e.codigo || `#${e.id}`}{e.motivo ? ` · ${e.motivo}` : ''}{e.data ? ` · ${dataCurta(e.data)}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={s.movValor}>{brl(e.valor_estornado || e.valor_pago)}</Text>
                      <Pilula texto={st.texto} tom={st.tom} />
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  verTodos: { fontSize: 12, fontWeight: '700', color: O.accent, textTransform: 'none', letterSpacing: 0 },
  ativarHero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 14 },
  ativarIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ativarTitulo: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  ativarTexto: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  blocoTitulo: { fontSize: 16, fontWeight: '800', color: O.ink, letterSpacing: -0.2 },
  blocoTexto: { fontSize: 13, color: O.muted, lineHeight: 20, marginTop: 6, marginBottom: 6 },
  motivo: { flexDirection: 'row', gap: 12, marginTop: 12 },
  motivoIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  motivoTitulo: { fontSize: 14, fontWeight: '700', color: O.ink },
  motivoTexto: { fontSize: 13, color: O.muted, lineHeight: 19, marginTop: 2 },
  passo: { flexDirection: 'row', gap: 12, marginTop: 14 },
  passoNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center' },
  passoNumTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ativarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 27, backgroundColor: O.accent, marginTop: 4 },
  ativarBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ativarNota: { fontSize: 12, color: O.muted, textAlign: 'center', marginTop: 10, marginBottom: 16 },
  linkAjuda: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: O.card, borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  linkAjudaTitulo: { fontSize: 14, fontWeight: '700', color: O.ink },
  linkAjudaSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 16 },
  heroRotulo: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValor: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 6, marginBottom: 18 },
  repasse: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: 14, marginBottom: 14 },
  repasseValor: { color: '#fff', fontSize: 20, fontWeight: '800' },
  repasseTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 2 },
  heroLinha: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 12 },
  heroItem: { flex: 1, alignItems: 'center' },
  heroItemRotulo: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  heroItemValor: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 3 },
  heroDivisor: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avisoTxt: { flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 12, lineHeight: 17 },

  grade: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  mov: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  movBorda: { borderBottomWidth: 1, borderBottomColor: O.line },
  movIcone: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  movTitulo: { fontSize: 14, fontWeight: '600', color: O.ink },
  movSub: { fontSize: 12, color: O.muted, marginTop: 2 },
  movValor: { fontSize: 14, fontWeight: '700' },
});
