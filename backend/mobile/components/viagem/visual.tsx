import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T } from '../../constants/ClientTheme';

/** Gradientes das viagens: cada destino ganha sempre a mesma cor (fica fácil reconhecer na lista). */
const GRADIENTES: [string, string][] = [
  ['#FF7A00', '#E8590C'],
  ['#0EA5E9', '#2563EB'],
  ['#10B981', '#047857'],
  ['#8B5CF6', '#6D28D9'],
  ['#F43F5E', '#BE123C'],
  ['#F59E0B', '#D97706'],
];

export function gradienteDoDestino(destino?: string | null): [string, string] {
  const texto = (destino || '').toLowerCase();
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return GRADIENTES[h % GRADIENTES.length];
}

const meioDia = (iso: string) => new Date(`${iso}T12:00:00`);

/** "Faltam 12 dias", "Acontecendo agora" ou "Concluída" — com a cor do selo. */
export function contagem(inicio?: string | null, fim?: string | null): { texto: string; cor: string; bg: string } {
  if (!inicio) return { texto: '', cor: T.muted, bg: '#F3F4F6' };
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const ini = meioDia(inicio);
  const ate = meioDia(fim || inicio);
  const dias = Math.round((ini.getTime() - hoje.getTime()) / 86400000);
  if (hoje > ate) return { texto: 'Concluída', cor: '#6B7280', bg: '#F3F4F6' };
  if (dias <= 0) return { texto: 'Acontecendo agora', cor: '#047857', bg: '#D1FAE5' };
  if (dias === 1) return { texto: 'É amanhã!', cor: '#C2410C', bg: '#FFEDD5' };
  return { texto: `Faltam ${dias} dias`, cor: '#C2410C', bg: '#FFEDD5' };
}

/** Dia e mês curtos para o "calendário" do cartão: { dia: '14', mes: 'OUT' }. */
export function blocoData(iso?: string | null) {
  if (!iso) return { dia: '--', mes: '' };
  const d = meioDia(iso);
  return { dia: String(d.getDate()).padStart(2, '0'), mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() };
}

const CORES_AVATAR = ['#FF7A00', '#0EA5E9', '#10B981', '#8B5CF6', '#F43F5E', '#F59E0B'];

/** Bolinhas com as iniciais do grupo, sobrepostas. */
export function Avatares({ nomes, max = 4, tamanho = 28, borda = '#fff' }: { nomes: string[]; max?: number; tamanho?: number; borda?: string }) {
  const visiveis = nomes.slice(0, max);
  const resto = nomes.length - visiveis.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {visiveis.map((n, i) => (
        <View key={`${n}${i}`} style={[s.avatar, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: borda, backgroundColor: CORES_AVATAR[i % CORES_AVATAR.length], marginLeft: i === 0 ? 0 : -tamanho / 3 }]}>
          <Text style={[s.avatarTxt, { fontSize: tamanho * 0.4 }]}>{(n || '?').trim().charAt(0).toUpperCase()}</Text>
        </View>
      ))}
      {resto > 0 && (
        <View style={[s.avatar, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: borda, backgroundColor: '#E5E7EB', marginLeft: -tamanho / 3 }]}>
          <Text style={[s.avatarTxt, { fontSize: tamanho * 0.36, color: T.muted }]}>+{resto}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarTxt: { color: '#fff', fontWeight: '800' },
});
