import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { O } from '../../constants/OwnerTheme';

const PASSOS: { icone: keyof typeof Ionicons.glyphMap; titulo: string; texto: string }[] = [
  { icone: 'create-outline', titulo: 'Crie um modelo', texto: 'Escreva o texto do contrato uma vez. Pode ter um modelo por tipo de reserva (casa, carro, equipamento…) e um padrão para o resto.' },
  { icone: 'flash-outline', titulo: 'Gere para a reserva', texto: 'Quando chega uma reserva, toque em "Gerar". Os dados do cliente, do item, das datas e do valor entram sozinhos.' },
  { icone: 'mail-outline', titulo: 'Envie ao cliente', texto: 'O contrato sai em PDF e Word. Baixe os arquivos ou mande para o e-mail do cliente com um toque.' },
  { icone: 'eye-outline', titulo: 'O cliente lê no app', texto: 'O contrato aparece nos detalhes da reserva do cliente, no site e no app, para ler e baixar quando quiser.' },
];

const VARIAVEIS: [string, string][] = [
  ['{{LOCADOR_NOME}}', 'Seu nome'],
  ['{{LOCADOR_DOCUMENTO}}', 'Seu CPF/CNPJ'],
  ['{{LOCATARIO_NOME}}', 'Nome do cliente'],
  ['{{LOCATARIO_DOCUMENTO}}', 'CPF do cliente'],
  ['{{LOCATARIO_EMAIL}}', 'E-mail do cliente'],
  ['{{ITEM_NOME}}', 'Item reservado'],
  ['{{VALOR_TOTAL}}', 'Valor total'],
  ['{{DATA_INICIO}}', 'Data de início'],
  ['{{DATA_FIM}}', 'Data de término'],
];

const PERGUNTAS: [string, string][] = [
  ['Para quais reservas posso gerar?', 'Para qualquer reserva: as avulsas (locação direto com você) e as reservas dos seus locais.'],
  ['Tem assinatura eletrônica?', 'Ainda não. O Lokyva gera o PDF e o Word; se precisar de assinatura com certificado, use o arquivo numa plataforma de assinatura da sua preferência.'],
  ['Posso mudar o texto de um contrato só?', 'Sim. Ao gerar, você pode ajustar o texto daquela reserva sem mudar o modelo.'],
  ['Quem pode usar?', 'Contratos é um recurso dos planos Premium de sócio. Sócios e gerentes de um local com dono Premium também usam.'],
];

/** Explicação do recurso Contratos — visível para todos os sócios, com ou sem plano. */
export default function ComoFuncionamContratos({ abertoInicial = true }: { abertoInicial?: boolean }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [pergunta, setPergunta] = useState<number | null>(null);

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.topo} onPress={() => setAberto((a) => !a)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: aberto }}>
        <View style={s.topoIcone}><Ionicons name="information-circle" size={22} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.topoTitulo}>O que são e como funcionam</Text>
          <Text style={s.topoSub}>Um documento com as regras combinadas na reserva.</Text>
        </View>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={20} color={O.muted} />
      </TouchableOpacity>

      {aberto && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Text style={s.paragrafo}>
            <Text style={{ fontWeight: '800', color: O.ink }}>O que é: </Text>
            registra quem aluga, o que está sendo alugado, por quanto tempo, o valor e as suas regras (caução, multa por atraso, cuidados com o bem, cancelamento). Dá segurança para você e para o cliente.
          </Text>

          {PASSOS.map((p, i) => (
            <View key={p.titulo} style={s.passo}>
              <View style={s.passoNum}><Text style={s.passoNumTxt}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={p.icone} size={16} color={O.accent} />
                  <Text style={s.passoTitulo}>{p.titulo}</Text>
                </View>
                <Text style={s.passoTxt}>{p.texto}</Text>
              </View>
            </View>
          ))}

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>Campos que se preenchem sozinhos</Text>
            <View style={s.vars}>
              {VARIAVEIS.map(([codigo, rotulo]) => (
                <View key={codigo} style={s.var}>
                  <Text style={s.varCodigo}>{codigo}</Text>
                  <Text style={s.varRotulo}>{rotulo}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.bloco}>
            <Text style={s.blocoTitulo}>Perguntas frequentes</Text>
            {PERGUNTAS.map(([q, r], i) => (
              <View key={q} style={s.pergunta}>
                <TouchableOpacity style={s.perguntaTopo} onPress={() => setPergunta(pergunta === i ? null : i)} activeOpacity={0.8}>
                  <Text style={s.perguntaTxt}>{q}</Text>
                  <Ionicons name={pergunta === i ? 'remove' : 'add'} size={18} color={O.muted} />
                </TouchableOpacity>
                {pergunta === i && <Text style={s.resposta}>{r}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignSelf: 'stretch', backgroundColor: O.card, borderRadius: 24, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  topoIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center' },
  topoTitulo: { fontSize: 15, fontWeight: '800', color: O.ink },
  topoSub: { fontSize: 12, color: O.muted, marginTop: 1 },
  paragrafo: { fontSize: 13, color: O.muted, lineHeight: 19 },
  passo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  passoNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  passoNumTxt: { fontSize: 12, fontWeight: '900', color: O.accent },
  passoTitulo: { fontSize: 14, fontWeight: '800', color: O.ink },
  passoTxt: { fontSize: 12, color: O.muted, lineHeight: 18, marginTop: 2 },
  bloco: { backgroundColor: '#F7F7F8', borderRadius: 16, padding: 12 },
  blocoTitulo: { fontSize: 13, fontWeight: '800', color: O.ink, marginBottom: 8 },
  vars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  var: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  varCodigo: { fontSize: 11, fontWeight: '800', color: '#4F46E5' },
  varRotulo: { fontSize: 10, color: O.muted },
  pergunta: { borderTopWidth: 1, borderTopColor: '#ECECEE' },
  perguntaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  perguntaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: O.ink },
  resposta: { fontSize: 12, color: O.muted, lineHeight: 18, paddingBottom: 10 },
});
