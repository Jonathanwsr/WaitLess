import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export type OfertaMensagem = {
  titulo: string | null;
  texto: string;
  local: { id: number; nome: string } | null;
  cupom: null | { id: number; codigo: string; titulo: string; desconto: string; validade: string | null; valido: boolean; usado: boolean; apenas_premium: boolean };
};

/** Oferta exclusiva enviada pelo local a quem favoritou: aparece no chat como um cartão com o cupom. */
export default function CartaoOferta({ oferta, minha, horario }: { oferta: OfertaMensagem; minha: boolean; horario: string }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const cupom = oferta.cupom;
  const disponivel = !!cupom && cupom.valido && !cupom.usado;

  const copiar = async () => {
    if (!cupom) return;
    await Clipboard.setStringAsync(cupom.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <View style={[s.cartao, minha ? s.minha : s.deles]}>
      <Text style={s.rotulo}>🎁 OFERTA EXCLUSIVA{oferta.local ? ` · ${oferta.local.nome.toUpperCase()}` : ''}</Text>
      {!!oferta.titulo && <Text style={s.titulo}>{oferta.titulo}</Text>}
      <Text style={s.texto}>{oferta.texto}</Text>

      {cupom && (
        <View style={[s.cupom, !disponivel && { opacity: 0.6, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={s.codigo}>{cupom.codigo}</Text>
            {!minha && disponivel && (
              <TouchableOpacity onPress={copiar} style={s.copiar} accessibilityRole="button" accessibilityLabel="Copiar código do cupom">
                <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={14} color="#15803D" />
                <Text style={s.copiarTxt}>{copiado ? 'Copiado' : 'Copiar'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.cupomInfo}>{cupom.desconto}{cupom.validade ? ` · até ${cupom.validade}` : ''}{cupom.apenas_premium ? ' · só Premium' : ''}</Text>
          {cupom.usado && <Text style={s.encerrado}>Cupom já usado</Text>}
          {!cupom.valido && <Text style={s.encerrado}>Oferta encerrada</Text>}
          {!minha && disponivel && <Text style={s.carteira}>Já está na sua carteira — use o código ao reservar.</Text>}
        </View>
      )}

      {!minha && !!oferta.local && (
        <TouchableOpacity style={s.botao} onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: String(oferta.local!.id) } } as never)} accessibilityRole="button">
          <Text style={s.botaoTxt}>Ver o local e reservar</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </TouchableOpacity>
      )}
      <Text style={s.horario}>{horario}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { maxWidth: '85%', borderRadius: 18, padding: 14, marginVertical: 4, borderWidth: 1, borderColor: '#FECDD3', backgroundColor: '#fff' },
  minha: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  deles: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  rotulo: { fontSize: 10, fontWeight: '900', color: '#F43F5E', letterSpacing: 0.4 },
  titulo: { fontSize: 15, fontWeight: '900', color: '#111827', marginTop: 3 },
  texto: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 4 },
  cupom: { marginTop: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#86EFAC', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 10 },
  codigo: { fontSize: 17, fontWeight: '900', color: '#166534', letterSpacing: 1, flexShrink: 1 },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, minHeight: 36, borderWidth: 1, borderColor: '#BBF7D0' },
  copiarTxt: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  cupomInfo: { fontSize: 12, color: '#15803D', marginTop: 2 },
  encerrado: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginTop: 2 },
  carteira: { fontSize: 11, color: '#15803D', marginTop: 4 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FF7A00', borderRadius: 12, minHeight: 44, marginTop: 10 },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
  horario: { fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 6 },
});
