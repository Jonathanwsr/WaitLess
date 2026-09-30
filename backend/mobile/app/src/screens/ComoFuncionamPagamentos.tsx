import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { T } from '../../../constants/ClientTheme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

type Perfil = 'cliente' | 'dono';

interface Bloco {
  icone: string;
  titulo: string;
  texto?: string;
  itens?: { rotulo: string; valor?: string; texto: string }[];
  destaque?: string;
}

// Regras espelhadas do servidor (PagamentoService, EstornoService e config/carteira.php).
const PARA_CLIENTE: Bloco[] = [
  {
    icone: 'shield-checkmark-outline',
    titulo: 'Quem processa o seu pagamento',
    texto:
      'A Lokyva conecta você aos locais, mas não é um banco nem processa pagamentos por conta própria. Todo pagamento online é feito por uma processadora de pagamentos externa e regulamentada, que cuida da cobrança com segurança. Por isso o app nunca guarda o número do seu cartão.',
  },
  {
    icone: 'card-outline',
    titulo: 'Formas de pagar',
    itens: [
      { rotulo: 'Pix', texto: 'Aprovação na hora, com QR Code ou código copia e cola.' },
      { rotulo: 'Cartão de crédito', texto: 'Em até 12x sem juros para você. A parcela mínima é de R$ 20,00.' },
      { rotulo: 'Boleto', texto: 'A compensação pode levar alguns dias úteis.' },
      { rotulo: 'Pagar no local', texto: 'Você garante a vaga agora e paga direto no estabelecimento, quando estiver lá.' },
    ],
  },
  {
    icone: 'pricetag-outline',
    titulo: 'Quais taxas você paga',
    texto: 'Nenhuma taxa extra. O valor que aparece no resumo é o total: sem juros no parcelamento e sem cobrança adicional pelo uso do app.',
    destaque: 'Se você pagar no local, o valor é exatamente o combinado, sem acréscimos.',
  },
  {
    icone: 'return-up-back-outline',
    titulo: 'Cancelamento e estorno',
    itens: [
      { rotulo: 'Cancelar até 30 min antes', texto: 'O valor pago é devolvido para a forma de pagamento original.' },
      { rotulo: 'Cancelar com menos de 30 min', valor: '2%', texto: 'Uma taxa de 2% do valor é retida; o restante é devolvido.' },
      { rotulo: 'Pedir estorno', texto: 'Você tem até 4 dias após o pagamento. O local e a Lokyva analisam em até 48 horas e você é avisado da decisão.' },
    ],
  },
];

const paraDono = (taxa: number, parteLocal: number): Bloco[] => [
  {
    icone: 'shield-checkmark-outline',
    titulo: 'Quem processa os pagamentos',
    texto:
      'A Lokyva não gerencia o sistema de pagamentos: a cobrança, a confirmação e o envio do dinheiro são feitos por uma processadora de pagamentos externa e regulamentada, integrada ao app. A Lokyva organiza as reservas, divide o valor e mostra tudo no seu Financeiro.',
  },
  {
    icone: 'git-branch-outline',
    titulo: 'Como o valor é dividido',
    texto: 'Quando o cliente paga online (Pix, cartão ou boleto), a divisão é automática no momento da cobrança:',
    itens: [
      { rotulo: 'Você recebe', valor: `${parteLocal}%`, texto: 'Cai na sua carteira, dentro do app.' },
      { rotulo: 'Taxa da plataforma', valor: `${taxa}%`, texto: 'É a taxa da Lokyva sobre cada venda online.' },
    ],
    destaque: 'No cartão parcelado, o cliente paga sem juros e você recebe normalmente.',
  },
  {
    icone: 'calendar-outline',
    titulo: 'Quando o dinheiro chega',
    texto:
      'O saldo da carteira é enviado para a sua conta no repasse semanal. Em Financeiro você vê o valor e o dia do próximo repasse. Para receber, mantenha a conta bancária ou a chave Pix cadastrada e validada.',
  },
  {
    icone: 'storefront-outline',
    titulo: 'Quando o cliente paga no local',
    texto:
      `O dinheiro fica com você, direto no balcão. A taxa de ${taxa}% desse atendimento é registrada como valor a acertar e descontada automaticamente dos seus próximos repasses.`,
    destaque: 'Sócios e o plano Premium Sócio são isentos dessa taxa no pagamento presencial.',
  },
  {
    icone: 'flash-outline',
    titulo: 'Repasse antecipado',
    texto: 'Quer o dinheiro antes do dia do repasse? Disponível no plano Premium Sócio Anual:',
    itens: [
      { rotulo: 'Taxa do saque antecipado', valor: '2%', texto: 'Com mínimo de R$ 3,00 por saque.' },
      { rotulo: 'Valor mínimo', valor: 'R$ 20,00', texto: 'Por saque.' },
      { rotulo: 'Conta validada', texto: 'Enviamos um Pix de R$ 0,01 para confirmar que a conta é sua.' },
    ],
  },
  {
    icone: 'return-up-back-outline',
    titulo: 'Cancelamentos e estornos',
    itens: [
      { rotulo: 'Cancelamento tardio', valor: '2%', texto: 'Se o cliente cancela com menos de 30 min, 2% do valor é retido e o restante é devolvido a ele.' },
      { rotulo: 'Pedido de estorno', texto: 'O cliente pode pedir em até 4 dias após pagar. Você é avisado e pode contestar dentro do prazo, enviando fotos ou vídeos.' },
      { rotulo: 'Estorno aprovado', texto: 'O valor devolvido é descontado do seu saldo ou dos próximos repasses.' },
    ],
  },
];

export default function ComoFuncionamPagamentos() {
  const router = useRouter();
  const { perfil: perfilParam } = useLocalSearchParams<{ perfil?: string }>();
  const [perfil, setPerfil] = useState<Perfil>(perfilParam === 'dono' ? 'dono' : 'cliente');
  const [taxas, setTaxas] = useState({ plataforma: 6, parteLocal: 94 });

  // Os números vêm do servidor (fonte única); se falhar, mostra os valores padrão.
  useEffect(() => {
    fetch(`${API_URL}/taxas`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j?.plataforma_percentual === 'number') setTaxas({ plataforma: j.plataforma_percentual, parteLocal: j.parte_do_local_percentual });
      })
      .catch(() => {});
  }, []);

  const blocos = perfil === 'dono' ? paraDono(taxas.plataforma, taxas.parteLocal) : PARA_CLIENTE;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream} />
      <View style={s.header}>
        <TouchableOpacity
          style={s.voltar}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={T.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={s.heroIcone}><Ionicons name="wallet-outline" size={26} color="#fff" /></View>
          <Text style={s.heroTitulo}>Como funcionam os pagamentos</Text>
          <Text style={s.heroTexto}>Entenda quem cuida do dinheiro, como o valor é dividido e quais taxas existem, sem letras miúdas.</Text>
        </View>

        <View style={s.seg}>
          {([['cliente', 'Sou cliente'], ['dono', 'Tenho um local']] as [Perfil, string][]).map(([id, rotulo]) => (
            <TouchableOpacity key={id} style={[s.segItem, perfil === id && s.segItemOn]} onPress={() => setPerfil(id)} activeOpacity={0.8}>
              <Text style={[s.segTxt, perfil === id && s.segTxtOn]}>{rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {blocos.map((b) => (
          <View key={b.titulo} style={s.card}>
            <View style={s.cardTopo}>
              <View style={s.cardIcone}><Ionicons name={b.icone as any} size={20} color={T.primary} /></View>
              <Text style={s.cardTitulo}>{b.titulo}</Text>
            </View>

            {!!b.texto && <Text style={s.texto}>{b.texto}</Text>}

            {!!b.itens && (
              <View style={s.itens}>
                {b.itens.map((it) => (
                  <View key={it.rotulo} style={s.item}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemRotulo}>{it.rotulo}</Text>
                      <Text style={s.itemTexto}>{it.texto}</Text>
                    </View>
                    {!!it.valor && <View style={s.valor}><Text style={s.valorTxt}>{it.valor}</Text></View>}
                  </View>
                ))}
              </View>
            )}

            {!!b.destaque && (
              <View style={s.destaque}>
                <Ionicons name="information-circle" size={18} color={T.tag} />
                <Text style={s.destaqueTxt}>{b.destaque}</Text>
              </View>
            )}
          </View>
        ))}

        <Text style={s.rodape}>
          Valores e prazos podem ser atualizados. Dúvidas? Fale com o suporte pelo app.
        </Text>

        <TouchableOpacity style={s.suporte} onPress={() => router.push('/src/screens/TelaSuporte' as never)} activeOpacity={0.85}>
          <Ionicons name="help-buoy-outline" size={18} color={T.primary} />
          <Text style={s.suporteTxt}>Falar com o suporte</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', ...sombra },
  conteudo: { paddingHorizontal: 20, paddingBottom: 40 },

  hero: { backgroundColor: T.primary, borderRadius: 28, padding: 22, marginTop: 8, marginBottom: 16 },
  heroIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitulo: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  heroTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 21, marginTop: 8 },

  seg: { flexDirection: 'row', backgroundColor: '#ECECEE', borderRadius: 22, padding: 4, marginBottom: 16 },
  segItem: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 18 },
  segItemOn: { backgroundColor: T.card, ...sombra },
  segTxt: { fontSize: 14, fontWeight: '600', color: T.muted },
  segTxtOn: { color: T.ink, fontWeight: '800' },

  card: { backgroundColor: T.card, borderRadius: 24, padding: 18, marginBottom: 14, ...sombra },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
  texto: { fontSize: 14, color: T.muted, lineHeight: 22 },

  itens: { marginTop: 10, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.cream, borderRadius: 18, padding: 14 },
  itemRotulo: { fontSize: 14, fontWeight: '700', color: T.ink },
  itemTexto: { fontSize: 13, color: T.muted, lineHeight: 19, marginTop: 2 },
  valor: { backgroundColor: T.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  valorTxt: { fontSize: 15, fontWeight: '800', color: T.primaryDark },

  destaque: { flexDirection: 'row', gap: 8, backgroundColor: T.primarySoft, borderRadius: 16, padding: 12, marginTop: 12 },
  destaqueTxt: { flex: 1, fontSize: 13, color: T.tag, lineHeight: 19, fontWeight: '600' },

  rodape: { fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  suporte: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: T.primarySoft, marginTop: 16 },
  suporteTxt: { color: T.primary, fontWeight: '800', fontSize: 14 },
});
