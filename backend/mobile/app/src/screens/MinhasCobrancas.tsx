import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { apiMobile, brl, mensagemDeErro } from '../../../services/entregasApi';
import { baixarPdf } from '../../../services/baixarPdf';

const C = { ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line, accent: T.primary, success: T.success, danger: T.danger };

type Parcela = { id: number; numero: number; valor: string | number; vencimento: string; status: string; invoice_url?: string | null; pago_em?: string | null };
type Item = {
  id: number; descricao: string; valor: string | number;
  funcionario?: { nome: string } | null;
  servico?: { nome: string; fotos?: string | string[] | null } | null;
  agendamento?: { data_agendamento?: string; hora_agendamento?: string } | null;
};
type Cobranca = {
  id: number;
  codigo: string;
  descricao?: string | null;
  modo: 'online' | 'presencial';
  valor_total: string | number;
  status: 'aguardando_aceite' | 'aceita' | 'quitada' | 'recusada' | 'cancelada';
  criador?: { name: string } | null;
  estabelecimento?: { nome: string; foto_perfil?: string | null; foto_banner?: string | null; cidade?: string | null; estado?: string | null } | null;
  itens: Item[];
  parcelas: Parcela[];
};

const STATUS: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  aguardando_aceite: { rotulo: 'Aguardando sua resposta', cor: '#92400E', fundo: '#FEF3C7' },
  aceita: { rotulo: 'Em andamento', cor: '#1E40AF', fundo: '#DBEAFE' },
  quitada: { rotulo: 'Quitada', cor: '#065F46', fundo: '#D1FAE5' },
  recusada: { rotulo: 'Recusada', cor: '#B91C1C', fundo: '#FEE2E2' },
  cancelada: { rotulo: 'Cancelada', cor: '#3F3F46', fundo: '#E4E4E7' },
};

const PARCELA: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'A pagar', cor: '#3F3F46' },
  atrasado: { rotulo: 'Atrasada', cor: '#B91C1C' },
  pago: { rotulo: 'Paga', cor: '#047857' },
  cancelado: { rotulo: 'Cancelada', cor: '#A1A1AA' },
  estornado: { rotulo: 'Estornada', cor: '#71717A' },
};

const FILTROS: { id: string; rotulo: string; inclui: string[] | null }[] = [
  { id: 'andamento', rotulo: 'Em andamento', inclui: ['aceita'] },
  { id: 'resposta', rotulo: 'Aguardando', inclui: ['aguardando_aceite'] },
  { id: 'encerradas', rotulo: 'Encerradas', inclui: ['quitada', 'recusada', 'cancelada'] },
  { id: 'todas', rotulo: 'Todas', inclui: null },
];

const dataBR = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-');
const emAberto = (p: Parcela) => p.status === 'pendente' || p.status === 'atrasado';
const primeiraFoto = (fotos?: string | string[] | null) => {
  let lista: any = fotos;
  if (typeof lista === 'string') { try { lista = JSON.parse(lista); } catch { lista = [lista]; } }
  return Array.isArray(lista) && lista[0] ? String(lista[0]) : null;
};

export default function MinhasCobrancas() {
  const [cobrancas, setCobrancas] = useState<Cobranca[] | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ cobrancas: Cobranca[] }>('/minhas-cobrancas');
      setCobrancas(ok ? data.cobrancas : []);
    } catch {
      setCobrancas([]);
    } finally {
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const lista = cobrancas || [];
  const pendentes = lista.filter((c) => c.status === 'aguardando_aceite').length;
  const filtroAtivo = filtro ?? (pendentes > 0 ? 'resposta' : 'andamento');

  const resumo = useMemo(() => {
    const ativas = lista.filter((c) => c.status === 'aceita');
    const abertas = ativas.flatMap((c) => c.parcelas.filter(emAberto).map((p) => ({ ...p, local: c.estabelecimento?.nome })));
    const proxima = [...abertas].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];
    return {
      ativas: ativas.length,
      totalAberto: abertas.reduce((s, p) => s + Number(p.valor), 0),
      abertas: abertas.length,
      atrasadas: abertas.filter((p) => p.status === 'atrasado').length,
      proxima,
    };
  }, [lista]);

  const visiveis = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtroAtivo);
    return f?.inclui ? lista.filter((c) => f.inclui!.includes(c.status)) : lista;
  }, [lista, filtroAtivo]);

  const responder = (c: Cobranca, acao: 'aceitar' | 'recusar') => {
    const executar = async () => {
      setOcupada(c.id);
      const { ok, data } = await apiMobile<{ message?: string }>(`/minhas-cobrancas/${c.id}/${acao}`, { method: 'POST' });
      setOcupada(null);
      if (ok) { mostrarToast(data.message || 'Pronto!', 'sucesso'); carregar(); }
      else mostrarToast(mensagemDeErro(data, 'Não foi possível responder agora.'), 'erro');
    };

    if (acao === 'aceitar') {
      alertar('Aceitar cobrança?', `${brl(c.valor_total)} em ${c.parcelas.length}x.${c.modo === 'online' ? ' Cada parcela terá um link de pagamento.' : ' Você paga direto no local.'}`, [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Aceitar', onPress: executar },
      ]);
    } else {
      alertar('Recusar cobrança?', 'Nenhum pagamento será gerado.', [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Recusar', style: 'destructive', onPress: executar },
      ]);
    }
  };

  const comprovante = async (c: Cobranca) => {
    try {
      await baixarPdf(`/minhas-cobrancas/${c.id}/comprovante-pdf`, `Comprovante_${c.codigo}.pdf`);
    } catch (e: any) {
      mostrarToast(e?.message || 'Não foi possível baixar o comprovante.', 'erro');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <HeaderCliente titulo="Pagamentos mensais" subtitulo={pendentes > 0 ? `${pendentes} esperando sua resposta` : 'Serviços e reservas em parcelas'} voltar />

      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={C.accent} />}
      >
        {cobrancas === null ? (
          <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
        ) : (
          <>
            {/* RESUMO */}
            <View style={s.resumoPrincipal}>
              <Text style={s.resumoRotulo}>Próximo pagamento</Text>
              {resumo.proxima ? (
                <>
                  <Text style={s.resumoValor}>{brl(resumo.proxima.valor)}</Text>
                  <Text style={s.resumoSub}>vence em {dataBR(resumo.proxima.vencimento)}{resumo.proxima.local ? ` · ${resumo.proxima.local}` : ''}</Text>
                </>
              ) : (
                <Text style={[s.resumoValor, { fontSize: 18 }]}>Nada para pagar agora</Text>
              )}
            </View>
            <View style={s.resumoLinha}>
              <View style={s.resumoCard}>
                <Text style={s.resumoCardRotulo}>Em aberto</Text>
                <Text style={s.resumoCardValor}>{brl(resumo.totalAberto)}</Text>
                <Text style={s.meta}>{resumo.abertas} parcela(s){resumo.atrasadas > 0 ? ` · ${resumo.atrasadas} atrasada(s)` : ''}</Text>
              </View>
              <View style={s.resumoCard}>
                <Text style={s.resumoCardRotulo}>Em andamento</Text>
                <Text style={s.resumoCardValor}>{resumo.ativas}</Text>
                <Text style={s.meta}>pago(s) por mês</Text>
              </View>
            </View>

            {/* FILTROS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {FILTROS.map((f) => {
                const qtd = f.inclui ? lista.filter((c) => f.inclui!.includes(c.status)).length : lista.length;
                const ativo = filtroAtivo === f.id;
                return (
                  <TouchableOpacity key={f.id} onPress={() => setFiltro(f.id)} style={[s.chip, ativo && s.chipAtivo]}>
                    <Text style={[s.chipTxt, ativo && s.chipTxtAtivo]}>{f.rotulo} ({qtd})</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {visiveis.length === 0 ? (
              <View style={s.vazio}>
                <Ionicons name="cash-outline" size={44} color={C.faint} />
                <Text style={s.vazioTitulo}>{lista.length === 0 ? 'Nenhum pagamento parcelado' : 'Nada nesta lista'}</Text>
                {lista.length === 0 && <Text style={s.vazioTxt}>Quando um estabelecimento enviar um serviço ou reserva para pagar em parcelas, ele aparece aqui.</Text>}
              </View>
            ) : visiveis.map((c) => {
              const st = STATUS[c.status] || STATUS.aceita;
              const total = c.parcelas.length;
              const pagas = c.parcelas.filter((p) => p.status === 'pago').length;
              const pagoValor = c.parcelas.filter((p) => p.status === 'pago').reduce((soma, p) => soma + Number(p.valor), 0);
              const proxima = c.parcelas.find(emAberto);
              const local = c.estabelecimento || ({} as NonNullable<Cobranca['estabelecimento']>);
              const capa = local.foto_banner || primeiraFoto(c.itens.find((i) => i.servico)?.servico?.fotos) || local.foto_perfil;
              const online = c.modo === 'online';
              const mostrarParcelas = c.status === 'aceita' || c.status === 'quitada';

              return (
                <View key={c.id} style={s.card}>
                  {/* CAPA */}
                  <View style={s.capa}>
                    {capa ? <Image source={{ uri: capa }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                    <View style={s.capaVeu} />
                    <View style={s.capaRodape}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.capaNome} numberOfLines={1}>{local.nome || 'Estabelecimento'}</Text>
                        {!!(local.cidade || local.estado) && <Text style={s.capaCidade}>{[local.cidade, local.estado].filter(Boolean).join(' - ')}</Text>}
                      </View>
                      <View style={[s.badge, { backgroundColor: st.fundo }]}><Text style={[s.badgeTxt, { color: st.cor }]}>{st.rotulo}</Text></View>
                    </View>
                  </View>

                  <View style={s.corpo}>
                    <View style={s.linhaEntre}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.titulo}>{c.descricao || c.itens.map((i) => i.descricao).join(' + ')}</Text>
                        <Text style={s.meta}>Enviada por {c.criador?.name || 'o estabelecimento'} · {c.codigo}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.total}>{brl(c.valor_total)}</Text>
                        <Text style={s.meta}>{total}x de {brl(c.parcelas[0]?.valor)}</Text>
                      </View>
                    </View>

                    {/* INFORMAÇÕES RÁPIDAS */}
                    <View style={s.infos}>
                      <View style={s.info}><Text style={s.infoRotulo}>Pagamento</Text><Text style={s.infoValor}>{online ? 'Online (PIX, boleto, cartão)' : 'Presencial'}</Text></View>
                      <View style={s.info}><Text style={s.infoRotulo}>Parcelas</Text><Text style={s.infoValor}>{pagas} de {total} pagas</Text></View>
                      <View style={s.info}><Text style={s.infoRotulo}>Próxima</Text><Text style={s.infoValor}>{proxima ? `${brl(proxima.valor)} · ${dataBR(proxima.vencimento)}` : '—'}</Text></View>
                      <View style={s.info}><Text style={s.infoRotulo}>Já pago</Text><Text style={[s.infoValor, { color: C.success }]}>{brl(pagoValor)}</Text></View>
                    </View>

                    {c.status !== 'aguardando_aceite' && total > 0 && (
                      <View style={s.barra}><View style={[s.barraOn, { width: `${(pagas / total) * 100}%` }]} /></View>
                    )}

                    {/* O QUE FOI COMBINADO */}
                    <View style={s.caixa}>
                      {c.itens.map((i) => (
                        <View key={i.id} style={s.itemLinha}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNome}>{i.descricao}</Text>
                            {!!i.funcionario?.nome && <Text style={s.meta}>Quem atende: {i.funcionario.nome}</Text>}
                            {!!i.agendamento?.data_agendamento && (
                              <Text style={s.meta}>Reserva em {dataBR(i.agendamento.data_agendamento)} às {String(i.agendamento.hora_agendamento || '').slice(0, 5)}</Text>
                            )}
                          </View>
                          <Text style={s.itemValor}>{brl(i.valor)}</Text>
                        </View>
                      ))}
                    </View>

                    {c.status === 'aguardando_aceite' && (
                      <View style={s.acoes}>
                        <TouchableOpacity disabled={ocupada === c.id} onPress={() => responder(c, 'aceitar')} style={[s.botao, { backgroundColor: C.success }]}>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                          <Text style={s.botaoTxt}>{ocupada === c.id ? 'Aguarde...' : 'Aceitar'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={ocupada === c.id} onPress={() => responder(c, 'recusar')} style={[s.botao, s.botaoBranco]}>
                          <Ionicons name="close-circle-outline" size={18} color={C.ink} />
                          <Text style={[s.botaoTxt, { color: C.ink }]}>Recusar</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {mostrarParcelas && c.parcelas.map((p) => {
                      const ps = PARCELA[p.status] || PARCELA.pendente;
                      const podePagar = emAberto(p) && !!p.invoice_url;
                      return (
                        <View key={p.id} style={[s.parcela, p.status === 'atrasado' && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                          <View style={[s.parcelaNumero, p.status === 'pago' && { backgroundColor: '#D1FAE5' }]}>
                            {p.status === 'pago'
                              ? <Ionicons name="checkmark" size={16} color="#047857" />
                              : <Text style={s.parcelaNumeroTxt}>{p.numero}</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNome}>{brl(p.valor)}</Text>
                            <Text style={[s.meta, { color: ps.cor }]}>
                              {p.status === 'pago' ? `Paga em ${dataBR(p.pago_em)}` : `Vence em ${dataBR(p.vencimento)} · ${ps.rotulo}`}
                            </Text>
                          </View>
                          {podePagar ? (
                            <TouchableOpacity onPress={() => Linking.openURL(p.invoice_url as string)} style={s.pagar}>
                              <Text style={s.pagarTxt}>Pagar</Text>
                              <Ionicons name="open-outline" size={14} color="#fff" />
                            </TouchableOpacity>
                          ) : emAberto(p) && !online ? (
                            <Text style={s.meta}>Pague no local</Text>
                          ) : null}
                        </View>
                      );
                    })}

                    <TouchableOpacity onPress={() => comprovante(c)} style={s.linkPdf}>
                      <Ionicons name="document-text-outline" size={16} color={C.ink} />
                      <Text style={s.linkPdfTxt}>Comprovante PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  conteudo: { padding: 16, gap: 14, paddingBottom: 40 },
  centro: { paddingVertical: 60, alignItems: 'center' },
  resumoPrincipal: { backgroundColor: '#18181B', borderRadius: 22, padding: 18 },
  resumoRotulo: { color: '#A1A1AA', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  resumoValor: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
  resumoSub: { color: '#D4D4D8', fontSize: 13, marginTop: 2 },
  resumoLinha: { flexDirection: 'row', gap: 10 },
  resumoCard: { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line },
  resumoCardRotulo: { fontSize: 10, fontWeight: '800', color: C.faint, textTransform: 'uppercase' },
  resumoCardValor: { fontSize: 20, fontWeight: '900', color: C.ink, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipAtivo: { backgroundColor: C.ink, borderColor: C.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  chipTxtAtivo: { color: '#fff' },
  vazio: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 20 },
  vazioTitulo: { fontSize: 16, fontWeight: '900', color: C.ink },
  vazioTxt: { fontSize: 13, color: C.muted, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  capa: { height: 120, backgroundColor: '#3F3F46', justifyContent: 'flex-end' },
  capaVeu: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  capaRodape: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12 },
  capaNome: { color: '#fff', fontSize: 16, fontWeight: '900' },
  capaCidade: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  corpo: { padding: 14, gap: 12 },
  linhaEntre: { flexDirection: 'row', gap: 10 },
  titulo: { fontSize: 15, fontWeight: '900', color: C.ink },
  total: { fontSize: 18, fontWeight: '900', color: C.ink },
  meta: { fontSize: 12, color: C.muted },
  infos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { width: '48%', backgroundColor: '#F7F7F8', borderRadius: 12, padding: 10 },
  infoRotulo: { fontSize: 10, fontWeight: '800', color: C.faint, textTransform: 'uppercase' },
  infoValor: { fontSize: 13, fontWeight: '800', color: C.ink, marginTop: 2 },
  barra: { height: 6, borderRadius: 3, backgroundColor: '#E4E4E7', overflow: 'hidden' },
  barraOn: { height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  caixa: { borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, gap: 8 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemNome: { fontSize: 14, fontWeight: '700', color: C.ink },
  itemValor: { fontSize: 14, fontWeight: '800', color: C.ink },
  acoes: { flexDirection: 'row', gap: 8 },
  botao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  botaoBranco: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  parcela: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10 },
  parcelaNumero: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center' },
  parcelaNumeroTxt: { fontSize: 13, fontWeight: '900', color: '#52525B' },
  pagar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pagarTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  linkPdf: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingVertical: 4 },
  linkPdfTxt: { fontSize: 13, fontWeight: '800', color: C.ink },
});
