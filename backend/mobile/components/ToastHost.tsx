import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assinarToast, ToastMsg } from '../services/toast';

const CORES = {
  sucesso: { bg: '#1F1A17', icone: 'checkmark-circle' as const, cor: '#4ADE80' },
  info: { bg: '#1F1A17', icone: 'information-circle' as const, cor: '#93C5FD' },
  erro: { bg: '#7F1D1D', icone: 'alert-circle' as const, cor: '#FCA5A5' },
};

/** Exibe um aviso por vez no topo da tela, some sozinho em ~2,4s. */
export default function ToastHost() {
  const [atual, setAtual] = useState<ToastMsg | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => assinarToast((msg) => {
    if (timer.current) clearTimeout(timer.current);
    setAtual(msg);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setAtual(null));
    }, msg.tipo === 'erro' ? 3600 : 2400);
  }), [anim]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!atual) return null;
  const c = CORES[atual.tipo];

  return (
    <View pointerEvents="none" style={s.area}>
      <Animated.View style={[s.toast, { backgroundColor: c.bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
        <Ionicons name={c.icone} size={20} color={c.cor} />
        <Text style={s.texto} numberOfLines={2}>{atual.texto}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  area: { position: 'absolute', top: Platform.OS === 'android' ? 44 : 54, left: 0, right: 0, alignItems: 'center', zIndex: 9999, elevation: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 420, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  texto: { flexShrink: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
});
