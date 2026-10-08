import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { O } from '../../constants/OwnerTheme';

/** Seis quadradinhos para o código de entrega. O campo invisível recebe o teclado numérico. */
export default function CodigoSeisDigitos({ valor, onChange, desabilitado }: { valor: string; onChange: (v: string) => void; desabilitado?: boolean }) {
  const campo = useRef<TextInput>(null);
  const digitos = Array.from({ length: 6 }, (_, i) => valor[i] || '');
  const focoAtual = Math.min(valor.length, 5);

  return (
    <Pressable onPress={() => campo.current?.focus()} style={s.linha}>
      {digitos.map((d, i) => (
        <View key={i} style={[s.caixa, i === focoAtual && !desabilitado && s.caixaAtiva]}>
          <Text style={s.digito}>{d}</Text>
        </View>
      ))}
      <TextInput
        ref={campo}
        value={valor}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        editable={!desabilitado}
        style={s.invisivel}
        caretHidden
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  caixa: { width: 42, height: 52, borderRadius: 14, borderWidth: 2, borderColor: O.line, backgroundColor: O.card, alignItems: 'center', justifyContent: 'center' },
  caixaAtiva: { borderColor: O.accent },
  digito: { fontSize: 22, fontWeight: '900', color: O.ink },
  invisivel: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
