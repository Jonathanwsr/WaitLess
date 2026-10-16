import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { API_MOBILE, pegarToken } from '../../services/entregasApi';

export type Adicional = {
  id: number; nome: string; descricao: string | null; detalhes: string | null; foto: string | null;
  valor: number; valor_normal: number; em_promocao: boolean; estoque: number; ultimas_unidades: boolean;
  somente_premium: boolean; vinculo: 'servico' | 'reserva' | 'local'; vinculo_texto: string; maximo: number;
};

export type ResumoAdicionais = { itens: { id: number; quantidade: number }[]; total: number; quantidade: number };

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const BASE = API_MOBILE.replace(/\/mobile$/, '');

/**
 * Produtos adicionais que o cliente pode levar junto com o serviço ou a reserva.
 * O valor entra no mesmo pagamento; o servidor confere tudo ao confirmar.
 */
export default function AdicionaisEscolha({ servicoId, itemId, contexto, onChange }: {
  servicoId?: number | null; itemId?: number | null; contexto: 'serviço' | 'reserva'; onChange: (r: ResumoAdicionais) => void;
}) {
  const [produtos, setProdutos] = useState<Adicional[] | null>(null);
  const [selecao, setSelecao] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!servicoId && !itemId) return;
    let ativo = true;
    (async () => {
      try {
        const token = await pegarToken();
        const q = servicoId ? `servico_id=${servicoId}` : `item_aluguel_id=${itemId}`;
        const res = await fetch(`${API_MOBILE}/produtos/adicionais?${q}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json().catch(() => ({}));
        if (ativo) setProdutos(res.ok && Array.isArray(json.produtos) ? json.produtos : []);
      } catch {
        if (ativo) setProdutos([]);
      }
    })();
    return () => { ativo = false; };
  }, [servicoId, itemId]);

  const resumo = useMemo<ResumoAdicionais>(() => {
    const itens = Object.entries(selecao).filter(([, q]) => q > 0).map(([id, q]) => ({ id: Number(id), quantidade: q }));
    const total = itens.reduce((s, i) => s + (produtos?.find((p) => p.id === i.id)?.valor || 0) * i.quantidade, 0);
    return { itens, total: Math.round(total * 100) / 100, quantidade: itens.reduce((s, i) => s + i.quantidade, 0) };
  }, [selecao, produtos]);

  useEffect(() => { onChange(resumo); }, [resumo]);

  const mudar = (p: Adicional, delta: number) => setSelecao((s) => ({ ...s, [p.id]: Math.max(0, Math.min(p.maximo, (s[p.id] || 0) + delta)) }));

  if (produtos === null) return <ActivityIndicator color={T.primary} style={{ marginVertical: 10 }} />;
  if (produtos.length === 0) return null;

  return (
    <View style={s.caixa}>
      <View style={s.topo}>
        <Ionicons name="bag-handle" size={20} color={T.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Leve junto com a sua {contexto === 'serviço' ? 'visita' : 'reserva'}</Text>
          <Text style={s.sub}>Opcional. O valor entra no mesmo pagamento.</Text>
        </View>
        {resumo.quantidade > 0 && <Text style={s.resumo}>+ {brl(resumo.total)}</Text>}
      </View>

      {produtos.map((p) => {
        const q = selecao[p.id] || 0;
        const feitoPara = p.vinculo !== 'local';
        return (
          <View key={p.id} style={[s.item, q > 0 && s.itemOn]}>
            <View style={s.foto}>
              {p.foto ? <Image source={{ uri: p.foto.startsWith('http') ? p.foto : `${BASE.replace(/\/api$/, '')}${p.foto}` }} style={StyleSheet.absoluteFill} accessibilityLabel={p.nome} /> : <Ionicons name="bag-outline" size={26} color={T.faint} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.selos}>
                <Text style={[s.selo, feitoPara ? { backgroundColor: '#FFEDD5', color: '#C2410C' } : { backgroundColor: '#F3F4F6', color: '#4B5563' }]}>{feitoPara ? '✦ ' : ''}{p.vinculo_texto}</Text>
                {p.somente_premium && <Text style={[s.selo, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>★ Premium</Text>}
              </View>
              <Text style={s.nome} numberOfLines={1}>{p.nome}</Text>
              {!!(p.detalhes || p.descricao) && <Text style={s.desc} numberOfLines={1}>{p.detalhes || p.descricao}</Text>}
              {p.ultimas_unidades && <Text style={s.ultimas}>Últimas {p.estoque} unidades</Text>}
              <View style={s.rodape}>
                <View>
                  {p.em_promocao && <Text style={s.riscado}>{brl(p.valor_normal)}</Text>}
                  <Text style={s.preco}>{brl(p.valor)}</Text>
                </View>
                {q === 0 ? (
                  <TouchableOpacity style={s.adicionar} onPress={() => mudar(p, 1)} accessibilityRole="button" accessibilityLabel={`Adicionar ${p.nome}`}>
                    <Ionicons name="add" size={16} color="#fff" /><Text style={s.adicionarTxt}>Adicionar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.stepper}>
                    <TouchableOpacity style={s.passo} onPress={() => mudar(p, -1)} accessibilityLabel={`Menos um ${p.nome}`}><Ionicons name="remove" size={18} color={T.ink} /></TouchableOpacity>
                    <Text style={s.qtd}>{q}</Text>
                    <TouchableOpacity style={[s.passo, q >= p.maximo && { opacity: 0.3 }]} disabled={q >= p.maximo} onPress={() => mudar(p, 1)} accessibilityLabel={`Mais um ${p.nome}`}><Ionicons name="add" size={18} color={T.ink} /></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { backgroundColor: '#FFFAF5', borderRadius: 22, padding: 14, gap: 10, borderWidth: 1, borderColor: '#FFE4CC', marginTop: 6 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 15, fontWeight: '900', color: T.ink },
  sub: { fontSize: 12, color: T.muted },
  resumo: { fontSize: 12, fontWeight: '900', color: '#fff', backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  item: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 10, borderWidth: 1.5, borderColor: '#F1F1F3' },
  itemOn: { borderColor: T.primary },
  foto: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#F3F4F6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  selo: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', textTransform: 'uppercase' },
  nome: { fontSize: 14, fontWeight: '900', color: T.ink, marginTop: 3 },
  desc: { fontSize: 12, color: T.muted },
  ultimas: { fontSize: 11, fontWeight: '800', color: '#DC2626', marginTop: 1 },
  rodape: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  riscado: { fontSize: 10, color: T.faint, textDecorationLine: 'line-through' },
  preco: { fontSize: 14, fontWeight: '900', color: T.primary },
  adicionar: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: T.ink, borderRadius: 12, paddingHorizontal: 12, minHeight: 40 },
  adicionarTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 12 },
  passo: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtd: { width: 22, textAlign: 'center', fontWeight: '900', color: T.ink },
});
