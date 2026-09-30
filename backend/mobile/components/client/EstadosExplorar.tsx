import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../constants/ClientTheme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface Estado { uf: string; nome: string; lojas: number; servicos: number; reservas: number; total: number }

/**
 * "Explore por estado": um card por estado com a contagem REAL de lojas, serviços e reservas.
 * Tocar abre o Explorar já filtrado pelo estado e na aba que tem resultados.
 */
export default function EstadosExplorar({ titulo = 'Explore por estado', subtitulo }: { titulo?: string; subtitulo?: string }) {
  const router = useRouter();
  const [estados, setEstados] = useState<Estado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
        const res = await fetch(`${API_URL}/explorar/estados`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json();
        if (res.ok && Array.isArray(json)) setEstados(json);
      } catch {
        // sem contagem, a seção simplesmente não aparece
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Estados com mais resultados primeiro; depois os demais em ordem alfabética.
  const ordenados = useMemo(
    () => [...estados].sort((a, b) => (b.total - a.total) || a.nome.localeCompare(b.nome, 'pt-BR')),
    [estados],
  );

  const abrir = (e: Estado) => {
    const tipo = e.lojas > 0 ? 'estabelecimentos' : e.servicos > 0 ? 'servicos' : e.reservas > 0 ? 'reservas' : 'estabelecimentos';
    router.push(`/(tabs)/explorar?estado=${e.uf}&tipo=${tipo}` as never);
  };

  if (carregando) return <View style={s.carregando}><ActivityIndicator color={T.primary} /></View>;
  if (ordenados.length === 0) return null;

  return (
    <View>
      <Text style={s.titulo}>{titulo}</Text>
      {!!subtitulo && <Text style={s.subtitulo}>{subtitulo}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.lista}>
        {ordenados.map((e) => (
          <TouchableOpacity key={e.uf} style={[s.card, e.total === 0 && { opacity: 0.55 }]} onPress={() => abrir(e)} activeOpacity={0.85}>
            <View style={s.sigla}><Text style={s.siglaTxt}>{e.uf}</Text></View>
            <Text style={s.nome} numberOfLines={1}>{e.nome}</Text>
            <Text style={s.qtd}>
              {e.lojas} {e.lojas === 1 ? 'loja' : 'lojas'} · {e.servicos} serv. · {e.reservas} res.
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  carregando: { paddingVertical: 20 },
  titulo: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  subtitulo: { fontSize: 13, color: T.muted, marginTop: 3, lineHeight: 19 },
  lista: { gap: 10, paddingVertical: 12, paddingRight: 4 },
  card: { width: 150, backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sigla: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  siglaTxt: { fontSize: 14, fontWeight: '900', color: T.primary },
  nome: { fontSize: 14, fontWeight: '800', color: T.ink },
  qtd: { fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 16 },
});
