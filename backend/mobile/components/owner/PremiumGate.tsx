import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen } from './ui';

/** Convite para assinar o Premium, mostrado no lugar de telas exclusivas para assinantes. */
export default function PremiumGate({ titulo, texto, beneficios, icone = 'sparkles' }: {
  titulo: string;
  texto: string;
  beneficios: { icone: string; texto: string }[];
  icone?: string;
}) {
  const router = useRouter();
  return (
    <OwnerScreen titulo={titulo}>
      <View style={s.wrap}>
        <View style={s.selo}><Ionicons name={icone as any} size={38} color={O.accent} /></View>
        <View style={s.pill}><Ionicons name="lock-closed" size={12} color="#7A4A00" /><Text style={s.pillTxt}>RECURSO PREMIUM</Text></View>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.texto}>{texto}</Text>

        <View style={s.lista}>
          {beneficios.map((b) => (
            <View key={b.texto} style={s.item}>
              <View style={s.itemIcone}><Ionicons name={b.icone as any} size={18} color={O.accent} /></View>
              <Text style={s.itemTxt}>{b.texto}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.cta} onPress={() => router.push('/assinatura' as never)} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={s.ctaTxt}>Seja Premium</Text>
        </TouchableOpacity>
      </View>
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 12 },
  selo: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FBBF24', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginTop: 16 },
  pillTxt: { fontSize: 10, fontWeight: '800', color: '#7A4A00', letterSpacing: 0.6 },
  titulo: { fontSize: 24, fontWeight: '800', color: O.ink, textAlign: 'center', letterSpacing: -0.5, marginTop: 14 },
  texto: { fontSize: 14, color: O.muted, textAlign: 'center', lineHeight: 21, marginTop: 10, paddingHorizontal: 8 },
  lista: { alignSelf: 'stretch', backgroundColor: O.card, borderRadius: 24, padding: 8, marginTop: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  itemTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: O.ink, lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 54, borderRadius: 27, backgroundColor: O.accent, marginTop: 24 },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
