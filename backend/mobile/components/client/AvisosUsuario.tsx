import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { apiMobile } from '../../services/entregasApi';

type Aviso = { id: number; titulo: string; mensagem: string };

/** Avisos da Lokyva (ex.: produto removido, pedido cancelado) exibidos no topo da home até serem lidos. */
export default function AvisosUsuario() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ avisos: Aviso[] }>('/avisos');
      if (ok) setAvisos(data.avisos || []);
    } catch {
      setAvisos([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarLido = async (id: number) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
    await apiMobile(`/avisos/${id}/lido`, { method: 'POST' }).catch(() => {});
  };

  if (avisos.length === 0) return null;

  return (
    <View style={s.lista}>
      {avisos.map((aviso) => (
        <View key={aviso.id} style={s.card}>
          <Ionicons name="alert-circle-outline" size={20} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>{aviso.titulo}</Text>
            <Text style={s.mensagem}>{aviso.mensagem}</Text>
          </View>
          <TouchableOpacity onPress={() => marcarLido(aviso.id)} hitSlop={8}>
            <Text style={s.entendi}>Entendi</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  lista: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  titulo: { fontSize: 13, fontWeight: '800', color: '#78350F' },
  mensagem: { fontSize: 12, color: '#92400E', marginTop: 2, lineHeight: 17 },
  entendi: { fontSize: 12, fontWeight: '800', color: T.primary },
});
