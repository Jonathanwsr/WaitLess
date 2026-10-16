import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { O } from '../../constants/OwnerTheme';

export type ModoVinculo = 'loja' | 'local' | 'servico' | 'reserva';

const OPCOES: { modo: ModoVinculo; titulo: string; texto: string; icone: string; cor: string; bg: string }[] = [
  { modo: 'loja', titulo: 'Só na loja', texto: 'Venda avulsa, não aparece como adicional', icone: 'storefront-outline', cor: '#4B5563', bg: '#F3F4F6' },
  { modo: 'local', titulo: 'Em todo o local', texto: 'Adicional em qualquer serviço ou reserva', icone: 'grid-outline', cor: '#4F46E5', bg: '#EEF2FF' },
  { modo: 'servico', titulo: 'Em um serviço', texto: 'Só quando agendam o serviço escolhido', icone: 'cut-outline', cor: '#EA580C', bg: '#FFF7ED' },
  { modo: 'reserva', titulo: 'Em uma reserva', texto: 'Casa, carro, quadra, equipamento…', icone: 'key-outline', cor: '#059669', bg: '#ECFDF5' },
];

export const modoDoProduto = (p: { vinculo_modo?: string | null; servico_id?: number | null; aluguel_id?: number | null; atrelado_reservas?: boolean | number | null }): ModoVinculo => {
  if (p.vinculo_modo && ['loja', 'local', 'servico', 'reserva'].includes(p.vinculo_modo)) return p.vinculo_modo as ModoVinculo;
  if (p.servico_id) return 'servico';
  if (p.aluguel_id) return 'reserva';
  return Number(p.atrelado_reservas) ? 'local' : 'loja';
};

/** "Onde este produto aparece?" — escolha clara do vínculo, com busca e prévia do que o cliente vê. */
export default function VinculoProduto({ modo, servicoId, aluguelId, servicos, reservas, nomeProduto, onChange }: {
  modo: ModoVinculo; servicoId: number | null; aluguelId: number | null;
  servicos: { id: number; nome: string }[]; reservas: { id: number; nome: string; categoria_rotulo?: string; avulsa?: boolean }[];
  nomeProduto: string;
  onChange: (v: { vinculo_modo: ModoVinculo; servico_id: number | null; aluguel_id: number | null }) => void;
}) {
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => {
    const base: { id: number; nome: string; extra?: string }[] = modo === 'servico' ? servicos : modo === 'reserva' ? reservas.map((r) => ({ id: r.id, nome: r.nome, extra: [r.categoria_rotulo, r.avulsa ? 'avulsa' : null].filter(Boolean).join(' · ') })) : [];
    const t = busca.trim().toLowerCase();
    return t ? base.filter((x) => x.nome.toLowerCase().includes(t)) : base;
  }, [modo, busca, servicos, reservas]);

  const escolhido = modo === 'servico' ? servicos.find((x) => x.id === servicoId) : modo === 'reserva' ? reservas.find((x) => x.id === aluguelId) : null;
  const mudar = (novo: ModoVinculo, s: number | null = servicoId, a: number | null = aluguelId) =>
    onChange({ vinculo_modo: novo, servico_id: novo === 'servico' ? s : null, aluguel_id: novo === 'reserva' ? a : null });

  const previa = {
    loja: 'Aparece só na sua loja, para compra avulsa.',
    local: 'Aparece como adicional em todos os serviços e reservas deste local.',
    servico: escolhido ? `Ao agendar "${escolhido.nome}", o cliente vê: "Leve junto: ${nomeProduto || 'este produto'}".` : 'Escolha o serviço abaixo.',
    reserva: escolhido ? `Ao reservar "${escolhido.nome}", o cliente vê: "Leve junto: ${nomeProduto || 'este produto'}".` : 'Escolha a reserva abaixo.',
  }[modo];

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={s.titulo}>Onde este produto aparece?</Text>
        <Text style={s.sub}>Vendido sozinho ou oferecido como adicional na hora de agendar ou reservar.</Text>
      </View>
      <View style={s.grade}>
        {OPCOES.map((o) => {
          const on = modo === o.modo;
          const vazio = (o.modo === 'servico' && servicos.length === 0) || (o.modo === 'reserva' && reservas.length === 0);
          return (
            <TouchableOpacity key={o.modo} disabled={vazio} onPress={() => mudar(o.modo)} style={[s.opcao, on && s.opcaoOn, vazio && { opacity: 0.45 }]} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: vazio }}>
              <View style={[s.icone, { backgroundColor: o.bg }]}><Ionicons name={o.icone as any} size={18} color={o.cor} /></View>
              <Text style={s.opcaoTitulo}>{o.titulo}</Text>
              <Text style={s.opcaoTxt}>{vazio ? (o.modo === 'servico' ? 'Cadastre um serviço primeiro' : 'Cadastre uma reserva primeiro') : o.texto}</Text>
              {on && <Ionicons name="checkmark-circle" size={18} color={O.accent} style={s.check} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {(modo === 'servico' || modo === 'reserva') && (
        <View style={s.caixa}>
          <View style={s.busca}>
            <Ionicons name="search" size={16} color={O.muted} />
            <TextInput value={busca} onChangeText={setBusca} placeholder={modo === 'servico' ? 'Buscar serviço…' : 'Buscar reserva…'} placeholderTextColor={O.muted} style={{ flex: 1, fontSize: 14, color: O.ink, paddingVertical: 8 }} />
          </View>
          {lista.length === 0 && <Text style={s.vazio}>Nada encontrado.</Text>}
          {lista.map((x) => {
            const on = x.id === (modo === 'servico' ? servicoId : aluguelId);
            return (
              <TouchableOpacity key={x.id} style={[s.linha, on && s.linhaOn]} onPress={() => (modo === 'servico' ? mudar('servico', x.id) : mudar('reserva', servicoId, x.id))} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.linhaTxt, on && { color: '#C2410C', fontWeight: '800' }]} numberOfLines={1}>{x.nome}</Text>
                  {!!x.extra && <Text style={s.linhaExtra}>{x.extra}</Text>}
                </View>
                {on && <Ionicons name="checkmark-circle" size={20} color={O.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={s.previa}><Ionicons name="eye-outline" size={16} color="#075985" /><Text style={s.previaTxt}>{previa}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  titulo: { fontSize: 16, fontWeight: '800', color: O.ink },
  sub: { fontSize: 12, color: O.muted, marginTop: 2, lineHeight: 17 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { width: '48.5%', minHeight: 112, borderRadius: 18, borderWidth: 2, borderColor: '#EEF0F2', backgroundColor: '#fff', padding: 12 },
  opcaoOn: { borderColor: O.accent, backgroundColor: '#FFFAF5' },
  icone: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  opcaoTitulo: { fontSize: 14, fontWeight: '800', color: O.ink },
  opcaoTxt: { fontSize: 11, color: O.muted, marginTop: 2, lineHeight: 15 },
  check: { position: 'absolute', top: 10, right: 10 },
  caixa: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 8, gap: 4, backgroundColor: '#fff' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F7F8', borderRadius: 12, paddingHorizontal: 10 },
  vazio: { fontSize: 13, color: O.muted, textAlign: 'center', padding: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 10, borderRadius: 12 },
  linhaOn: { backgroundColor: '#FFF7ED' },
  linhaTxt: { fontSize: 14, color: O.ink },
  linhaExtra: { fontSize: 11, color: O.muted },
  previa: { flexDirection: 'row', gap: 6, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 10 },
  previaTxt: { flex: 1, fontSize: 12, color: '#075985', lineHeight: 17 },
});
