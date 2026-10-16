import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const BASE = `${ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '')}/mobile`;

type Catalogo = {
  ramos: Record<string, string[]>;
  reservas: Record<string, { valor: string; rotulo: string }[]>;
};

let cache: Catalogo | null = null;
let pedido: Promise<Catalogo | null> | null = null;

/** Lista oficial de ramos e categorias de reserva (config/categorias.php), carregada uma vez. */
export function useCatalogoCategorias(): Catalogo | null {
  const [dados, setDados] = useState<Catalogo | null>(cache);
  useEffect(() => {
    if (cache) return;
    pedido ??= fetch(`${BASE}/categorias`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (cache = j ? { ramos: j.ramos || {}, reservas: j.reservas || {} } : null))
      .catch(() => null)
      .finally(() => { pedido = null; });
    pedido.then((c) => c && setDados(c));
  }, []);
  return dados;
}

/** Chips de grupo e, abaixo, as opções do grupo escolhido. */
function Seletor({ grupos, valor, onEscolher, cor }: { grupos: Record<string, { valor: string; rotulo: string }[]>; valor: string; onEscolher: (v: string) => void; cor: string }) {
  const grupoDoValor = Object.entries(grupos).find(([, op]) => op.some((o) => o.valor === valor))?.[0];
  const [grupo, setGrupo] = useState<string | null>(grupoDoValor || null);
  useEffect(() => { if (grupoDoValor) setGrupo(grupoDoValor); }, [grupoDoValor]);
  const opcoes = grupo ? grupos[grupo] || [] : [];

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linha}>
        {Object.keys(grupos).map((g) => {
          const on = grupo === g;
          return (
            <TouchableOpacity key={g} style={[s.grupo, on && { backgroundColor: cor, borderColor: cor }]} onPress={() => setGrupo(on ? null : g)} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[s.grupoTxt, on && { color: '#fff' }]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {opcoes.length > 0 && (
        <View style={s.opcoes}>
          {opcoes.map((o) => {
            const on = o.valor === valor;
            return (
              <TouchableOpacity key={o.valor} style={[s.opcao, on && { borderColor: cor, backgroundColor: `${cor}14` }]} onPress={() => onEscolher(o.valor)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.opcaoTxt, on && { color: cor, fontWeight: '800' }]}>{o.rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Ramo de atuação do local: sugestões da lista oficial (o campo de texto continua livre). */
export function SugestoesRamo({ valor, onEscolher, cor = '#FF7A00' }: { valor: string; onEscolher: (v: string) => void; cor?: string }) {
  const cat = useCatalogoCategorias();
  if (!cat) return null;
  const grupos = Object.fromEntries(Object.entries(cat.ramos).map(([g, rs]) => [g, rs.map((r) => ({ valor: r, rotulo: r }))]));
  return <Seletor grupos={grupos} valor={valor} onEscolher={onEscolher} cor={cor} />;
}

/** Categoria da reserva (itens de locação): só valores que o sistema aceita. */
export function SeletorCategoriaReserva({ valor, onEscolher, cor = '#FF7A00' }: { valor: string; onEscolher: (v: string) => void; cor?: string }) {
  const cat = useCatalogoCategorias();
  if (!cat) return <Text style={s.carregando}>Carregando categorias…</Text>;
  return <Seletor grupos={cat.reservas} valor={valor} onEscolher={onEscolher} cor={cor} />;
}

const s = StyleSheet.create({
  linha: { gap: 8, paddingVertical: 2 },
  grupo: { paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  grupoTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opcao: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  opcaoTxt: { fontSize: 13, color: '#374151' },
  carregando: { fontSize: 12, color: '#6B7280' },
});
