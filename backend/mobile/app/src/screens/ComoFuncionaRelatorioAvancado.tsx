import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../../constants/OwnerTheme';

interface Bloco {
  icone: string;
  titulo: string;
  texto?: string;
  itens?: { rotulo: string; texto: string }[];
  destaque?: string;
}

const BLOCOS: Bloco[] = [
  {
    icone: 'lock-closed-outline',
    titulo: 'Quem pode ver',
    texto: 'O Relatório Avançado é exclusivo para sócios com algum plano Premium ativo (qualquer nível). Sem um plano Premium, você vê uma tela de assinatura em vez dos dados.',
  },
  {
    icone: 'bar-chart-outline',
    titulo: 'Faturamento',
    itens: [
      { rotulo: 'Faturamento do mês', texto: 'Soma de todos os serviços finalizados neste mês, em todos os seus estabelecimentos.' },
      { rotulo: 'Comparativo', texto: 'Mostra o crescimento (ou queda) em % comparado ao mês anterior.' },
      { rotulo: 'Últimos 6 meses', texto: 'O gráfico de barras ajuda a enxergar a tendência do negócio ao longo do tempo.' },
    ],
  },
  {
    icone: 'people-outline',
    titulo: 'Produtividade da equipe',
    texto: 'Ranking dos funcionários por faturamento e número de atendimentos finalizados no mês — ajuda a identificar quem está performando melhor e quem pode precisar de apoio.',
  },
  {
    icone: 'flame-outline',
    titulo: 'Serviços e horários',
    texto: 'Veja quais serviços mais vendem e os horários com mais movimento no mês, para planejar escala da equipe e promoções.',
  },
  {
    icone: 'person-add-outline',
    titulo: 'Clientes novos x recorrentes',
    texto: 'Um cliente é considerado "novo" quando esta é a primeira reserva dele com você. Ajuda a entender se o crescimento vem de gente nova ou de quem já confia no seu negócio.',
    destaque: 'Dica: se a taxa de cancelamento estiver alta, revise horários e lembretes de confirmação.',
  },
];

export default function ComoFuncionaRelatorioAvancado() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={O.canvas} />
      <View style={s.header}>
        <TouchableOpacity style={s.voltar} onPress={() => (router.canGoBack() ? router.back() : router.replace('/Proprietario/RelatorioAvancado' as never))} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={O.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={s.heroIcone}><Ionicons name="school-outline" size={26} color="#fff" /></View>
          <Text style={s.heroTitulo}>Como usar o Relatório Avançado</Text>
          <Text style={s.heroTexto}>Entenda cada métrica e como usá-las para tomar decisões melhores no seu negócio.</Text>
        </View>

        {BLOCOS.map((b) => (
          <View key={b.titulo} style={s.card}>
            <View style={s.cardTopo}>
              <View style={s.cardIcone}><Ionicons name={b.icone as any} size={20} color={O.accent} /></View>
              <Text style={s.cardTitulo}>{b.titulo}</Text>
            </View>

            {!!b.texto && <Text style={s.texto}>{b.texto}</Text>}

            {!!b.itens && (
              <View style={s.itens}>
                {b.itens.map((it) => (
                  <View key={it.rotulo} style={s.item}>
                    <Text style={s.itemRotulo}>{it.rotulo}</Text>
                    <Text style={s.itemTexto}>{it.texto}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!b.destaque && (
              <View style={s.destaque}>
                <Ionicons name="information-circle" size={18} color={O.accent} />
                <Text style={s.destaqueTxt}>{b.destaque}</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={s.voltarBtn} onPress={() => router.replace('/Proprietario/RelatorioAvancado' as never)} activeOpacity={0.85}>
          <Ionicons name="bar-chart-outline" size={18} color="#fff" />
          <Text style={s.voltarBtnTxt}>Ver meu relatório</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: O.canvas },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center', ...sombra },
  conteudo: { paddingHorizontal: 20, paddingBottom: 40 },

  hero: { backgroundColor: O.accent, borderRadius: 28, padding: 22, marginTop: 8, marginBottom: 16 },
  heroIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitulo: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 21, marginTop: 8 },

  card: { backgroundColor: O.card, borderRadius: 24, padding: 18, marginBottom: 14, ...sombra },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: O.ink, letterSpacing: -0.2 },
  texto: { fontSize: 14, color: O.muted, lineHeight: 22 },

  itens: { marginTop: 4, gap: 10 },
  item: { backgroundColor: O.soft, borderRadius: 16, padding: 14 },
  itemRotulo: { fontSize: 14, fontWeight: '700', color: O.ink },
  itemTexto: { fontSize: 13, color: O.muted, lineHeight: 19, marginTop: 2 },

  destaque: { flexDirection: 'row', gap: 8, backgroundColor: O.soft, borderRadius: 16, padding: 12, marginTop: 12 },
  destaqueTxt: { flex: 1, fontSize: 13, color: O.ink, lineHeight: 19, fontWeight: '600' },

  voltarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: O.accent, marginTop: 8 },
  voltarBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
