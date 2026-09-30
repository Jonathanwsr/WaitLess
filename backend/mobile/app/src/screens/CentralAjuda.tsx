import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',
  background: '#FFFFFF',
  textDark: '#1F2937',
  textGray: '#6A6C72',
  border: '#E6E7E9',
  white: '#FFFFFF',
};

interface Pergunta {
  pergunta: string;
  resposta: string;
}

const FAQ: Pergunta[] = [
  {
    pergunta: 'Como funciona o agendamento sem fila?',
    resposta:
      'Você escolhe o serviço, o profissional e o horário disponíveis no estabelecimento e paga pelo app. No dia, é só chegar perto do horário marcado — sem precisar esperar em fila física.',
  },
  {
    pergunta: 'Como cancelo uma reserva ou agendamento?',
    resposta:
      'Vá em "Meus Agendamentos", abra a reserva desejada e toque em "Cancelar Reserva". As condições de reembolso variam por estabelecimento e são mostradas antes da confirmação da compra.',
  },
  {
    pergunta: 'Como funciona o PIN de retirada/atendimento?',
    resposta:
      'Depois de confirmar o pagamento, você recebe um PIN de 4 dígitos. Apresente esse código ao estabelecimento apenas na hora do atendimento ou da retirada do item alugado — ele confirma que o serviço foi concluído.',
  },
  {
    pergunta: 'Posso solicitar reembolso de um pagamento?',
    resposta:
      'Sim. Na área financeira da sua conta você encontra "Minhas Solicitações e Disputas", onde pode abrir um pedido de estorno para pagamentos elegíveis e acompanhar o andamento.',
  },
  {
    pergunta: 'Qual a diferença entre reservar um serviço e alugar um item?',
    resposta:
      'Serviços (como corte de cabelo ou estética) usam agendamento por horário. Itens e veículos usam locação por período (diárias), com retirada e devolução em datas combinadas.',
  },
  {
    pergunta: 'O que ganho com o plano Premium?',
    resposta:
      'O plano Premium libera benefícios exclusivos, como ofertas de parceiros selecionados e acesso ao controle financeiro completo com relatório semanal por e-mail. Você pode assinar ou cancelar a qualquer momento na tela de Assinatura.',
  },
  {
    pergunta: 'Quais formas de pagamento são aceitas?',
    resposta:
      'Aceitamos cartão de crédito, PIX e boleto, processados por um parceiro de pagamentos seguro. A Lokyva não armazena os dados completos do seu cartão.',
  },
  {
    pergunta: 'Como funciona o rastreamento em tempo real?',
    resposta:
      'Em atendimentos ou entregas com esse recurso ativo, você acompanha a localização do profissional no mapa, ao vivo, até a chegada. Sua própria localização só é compartilhada enquanto você estiver participando ativamente do rastreamento.',
  },
  {
    pergunta: 'Como recebo o contrato de uma locação?',
    resposta:
      'Estabelecimentos podem gerar um contrato em PDF ou Word para a sua reserva e enviá-lo por e-mail diretamente pelo app, com todos os dados da locação preenchidos.',
  },
  {
    pergunta: 'Quero anunciar meu estabelecimento ou meus itens na Lokyva. Como faço?',
    resposta:
      'Crie uma conta, escolha o perfil de proprietário/prestador e cadastre seu estabelecimento, serviços ou itens de locação direto pelo app ou pelo site.',
  },
];

export default function CentralAjuda() {
  const router = useRouter();
  const [abertaIndex, setAbertaIndex] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introTitle}>Perguntas frequentes</Text>
        <Text style={styles.introText}>
          Não achou o que precisava? Fale com a gente pela tela de Suporte.
        </Text>

        {FAQ.map((item, index) => {
          const aberta = abertaIndex === index;
          return (
            <TouchableOpacity
              key={index}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setAbertaIndex(aberta ? null : index)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.pergunta}>{item.pergunta}</Text>
                <Feather name={aberta ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
              </View>
              {aberta && <Text style={styles.resposta}>{item.resposta}</Text>}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.btnSuporte} onPress={() => router.back()}>
          <Feather name="headphones" size={16} color={COLORS.white} />
          <Text style={styles.btnSuporteText}>Falar com o Suporte</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: COLORS.background,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  introTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, marginTop: 8, marginBottom: 4 },
  introText: { fontSize: 13, color: COLORS.textGray, marginBottom: 20, lineHeight: 18 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  pergunta: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  resposta: { fontSize: 13, color: COLORS.textGray, lineHeight: 20, marginTop: 12 },

  btnSuporte: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 16,
  },
  btnSuporteText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
