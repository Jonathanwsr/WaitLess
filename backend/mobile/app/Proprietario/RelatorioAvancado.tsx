import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Vazio, Erro, api } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Dados {
  bloqueado: boolean;
  semDados?: boolean;
  faturamento_por_mes?: { mes: string; valor: number }[];
  resumo?: {
    faturamento_mes_atual: number; crescimento_percentual: number | null; ticket_medio: number;
    taxa_cancelamento: number; atendimentos_mes: number; clientes_novos: number; clientes_recorrentes: number;
  };
  ranking_funcionarios?: { nome: string; atendimentos: number; faturamento: number }[];
  servicos_mais_vendidos?: { nome: string; quantidade: number; faturamento: number }[];
  horarios_pico?: { hora: string; quantidade: number }[];
}

export default function RelatorioAvancado() {
  const router = useRouter();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(() => api('/relatorio-avancado'));

  const ajuda = (
    <TouchableOpacity style={s.ajudaBtn} onPress={() => router.push('/src/screens/ComoFuncionaRelatorioAvancado' as never)} activeOpacity={0.7}>
      <Ionicons name="help-circle-outline" size={22} color={O.ink} />
    </TouchableOpacity>
  );

  if (erro) {
    return (
      <OwnerScreen titulo="Relatório Avançado" direita={ajuda}>
        <Erro mensagem={erro} aoTentar={recarregar} />
      </OwnerScreen>
    );
  }

  if (!carregando && dados?.bloqueado) {
    return (
      <OwnerScreen titulo="Relatório Avançado" direita={ajuda}>
        <View style={s.bloqueado}>
          <View style={s.bloqueadoIcone}><Ionicons name="lock-closed" size={26} color="#7A4A00" /></View>
          <Text style={s.bloqueadoTitulo}>Exclusivo para planos Premium</Text>
          <Text style={s.bloqueadoTexto}>Assine um plano Premium de sócio para liberar faturamento histórico, produtividade da equipe, retenção de clientes e muito mais.</Text>
          <TouchableOpacity style={s.bloqueadoBtn} onPress={() => router.push('/assinatura' as never)} activeOpacity={0.85}>
            <Text style={s.bloqueadoBtnTxt}>Ver planos Premium</Text>
          </TouchableOpacity>
        </View>
      </OwnerScreen>
    );
  }

  if (!carregando && dados?.semDados) {
    return (
      <OwnerScreen titulo="Relatório Avançado" direita={ajuda}>
        <Vazio icone="storefront-outline" titulo="Cadastre um estabelecimento" texto="Assim que você tiver um local cadastrado, seu relatório aparece aqui." />
      </OwnerScreen>
    );
  }

  const faturamentoPorMes = dados?.faturamento_por_mes || [];
  const maiorMes = Math.max(1, ...faturamentoPorMes.map((m) => m.valor));
  const ranking = dados?.ranking_funcionarios || [];
  const maiorRanking = Math.max(1, ...ranking.map((f) => f.faturamento));
  const servicos = dados?.servicos_mais_vendidos || [];
  const maiorServico = Math.max(1, ...servicos.map((sv) => sv.quantidade));
  const resumo = dados?.resumo;
  const crescimento = resumo?.crescimento_percentual;

  return (
    <OwnerScreen titulo="Relatório Avançado" subtitulo="Visão completa do seu negócio" direita={ajuda} carregando={carregando} atualizando={atualizando} onAtualizar={atualizar}>
      <View style={s.grid}>
        <Metrica rotulo="Faturamento (mês)" valor={brl(resumo?.faturamento_mes_atual || 0)} icone="cash-outline" tom="positivo" />
        <Metrica rotulo="Ticket médio" valor={brl(resumo?.ticket_medio || 0)} icone="pricetag-outline" />
      </View>
      <View style={[s.grid, { marginTop: 12 }]}>
        <Metrica rotulo="Cancelamento" valor={`${resumo?.taxa_cancelamento || 0}%`} icone="close-circle-outline" tom="negativo" />
        <Metrica rotulo="Atendimentos (mês)" valor={resumo?.atendimentos_mes || 0} icone="checkmark-done-outline" tom="info" />
      </View>

      {crescimento !== null && crescimento !== undefined && (
        <View style={s.crescimentoLinha}>
          <Ionicons name={crescimento >= 0 ? 'trending-up' : 'trending-down'} size={15} color={crescimento >= 0 ? O.success : O.danger} />
          <Text style={[s.crescimentoTxt, { color: crescimento >= 0 ? O.success : O.danger }]}>
            {crescimento}% vs. mês anterior
          </Text>
        </View>
      )}

      <Rotulo>Faturamento nos últimos 6 meses</Rotulo>
      <Card>
        <View style={s.barrasLinha}>
          {faturamentoPorMes.map((m) => (
            <View key={m.mes} style={s.barraCol}>
              <View style={s.barraTrilho}>
                <View style={[s.barraPreenchida, { height: `${Math.max(4, (m.valor / maiorMes) * 100)}%` }]} />
              </View>
              <Text style={s.barraRotulo}>{m.mes}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Rotulo>Produtividade da equipe (mês)</Rotulo>
      <Card>
        {ranking.length === 0 ? (
          <Text style={s.vazioTxt}>Nenhum atendimento finalizado neste mês ainda.</Text>
        ) : (
          ranking.map((f, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <View style={s.rankLinha}>
                <Text style={s.rankNome} numberOfLines={1}>{f.nome}</Text>
                <Text style={s.rankValor}>{f.atendimentos}x · {brl(f.faturamento)}</Text>
              </View>
              <View style={s.rankTrilho}><View style={[s.rankPreenchido, { width: `${Math.max(4, (f.faturamento / maiorRanking) * 100)}%` }]} /></View>
            </View>
          ))
        )}
      </Card>

      <Rotulo>Serviços mais vendidos (mês)</Rotulo>
      <Card>
        {servicos.length === 0 ? (
          <Text style={s.vazioTxt}>Nenhum serviço finalizado neste mês ainda.</Text>
        ) : (
          servicos.map((sv, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <View style={s.rankLinha}>
                <Text style={s.rankNome} numberOfLines={1}>{sv.nome}</Text>
                <Text style={s.rankValor}>{sv.quantidade}x · {brl(sv.faturamento)}</Text>
              </View>
              <View style={s.rankTrilho}><View style={[s.rankPreenchido, { width: `${Math.max(4, (sv.quantidade / maiorServico) * 100)}%`, backgroundColor: O.success }]} /></View>
            </View>
          ))
        )}
      </Card>

      <Rotulo>Clientes no mês</Rotulo>
      <View style={s.grid}>
        <Metrica rotulo="Novos" valor={resumo?.clientes_novos || 0} icone="person-add-outline" />
        <Metrica rotulo="Recorrentes" valor={resumo?.clientes_recorrentes || 0} icone="repeat-outline" />
      </View>

      {!!dados?.horarios_pico?.length && (
        <>
          <Rotulo>Horários de pico (mês)</Rotulo>
          <View style={s.picoLinha}>
            {dados.horarios_pico.map((h, i) => (
              <View key={i} style={s.picoChip}>
                <Text style={s.picoTxt}>{h.hora}</Text>
                <View style={s.picoBadge}><Text style={s.picoBadgeTxt}>{h.quantidade}</Text></View>
              </View>
            ))}
          </View>
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  ajudaBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  bloqueado: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28 },
  bloqueadoIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  bloqueadoTitulo: { fontSize: 17, fontWeight: '800', color: O.ink, textAlign: 'center' },
  bloqueadoTexto: { fontSize: 13, color: O.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 22 },
  bloqueadoBtn: { backgroundColor: O.accent, paddingHorizontal: 26, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  bloqueadoBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  grid: { flexDirection: 'row', gap: 10 },
  crescimentoLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
  crescimentoTxt: { fontSize: 12, fontWeight: '700' },

  vazioTxt: { fontSize: 13, color: O.muted, textAlign: 'center', paddingVertical: 8 },

  barrasLinha: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  barraCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraTrilho: { width: 16, flex: 1, backgroundColor: O.soft, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  barraPreenchida: { width: '100%', backgroundColor: O.accent, borderRadius: 8, minHeight: 4 },
  barraRotulo: { fontSize: 10, color: O.muted, fontWeight: '700', marginTop: 6 },

  rankLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankNome: { flex: 1, fontSize: 13, fontWeight: '700', color: O.ink, marginRight: 8 },
  rankValor: { fontSize: 12, fontWeight: '700', color: O.muted },
  rankTrilho: { height: 7, borderRadius: 4, backgroundColor: O.soft, overflow: 'hidden' },
  rankPreenchido: { height: '100%', borderRadius: 4, backgroundColor: O.accent },

  picoLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  picoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: O.card, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  picoTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  picoBadge: { backgroundColor: O.accent, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  picoBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
});
