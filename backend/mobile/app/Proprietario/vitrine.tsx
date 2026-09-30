import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Vazio, Erro, api, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';

interface Servico { id: number; nome: string; valor: number; preco_final: number; em_promocao: boolean; duracao_minutos?: number; foto?: string | null; somente_premium: boolean; vagas_status: 'poucas_vagas' | 'esgotado' | null; vagas_restantes: number | null }
interface Reserva { id: number; nome: string; categoria?: string; valor_diaria: number; preco_final: number; em_promocao: boolean; foto?: string | null; cidade?: string | null; estado?: string | null; capacidade_pessoas?: number | null; vagas_status: 'poucas_vagas' | 'esgotado' | null; vagas_restantes: number | null }
interface Produto { id: number; nome: string; valor_final: number; foto?: string | null; somente_premium: boolean }
interface Cupom { id: number; titulo: string; codigo: string; tipo_desconto: string; valor_desconto: number; apenas_plus: boolean; alvo?: string | null }
interface Vitrine {
  locais: { id: number; nome: string }[];
  estabelecimento: { id: number; nome: string; foto_perfil?: string | null; foto_banner?: string | null; ramo_atuacao?: string | null; bairro?: string | null; cidade?: string | null; estado?: string | null };
  servicos: Servico[];
  reservas: Reserva[];
  produtos: Produto[];
  cupons: Cupom[];
  avaliacoes: { total: number; media: number | null; previa: { autor: string; nota: number; comentario?: string | null; data: string }[] };
}

const ABAS = [
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'reservas', rotulo: 'Reservas' },
  { id: 'produtos', rotulo: 'Produtos' },
  { id: 'cupons', rotulo: 'Cupons' },
] as const;

function Selo({ status, restantes }: { status: 'poucas_vagas' | 'esgotado' | null; restantes: number | null }) {
  if (!status) return null;
  const esgotado = status === 'esgotado';
  return (
    <View style={[s.selo, { backgroundColor: esgotado ? '#DC2626' : '#FBBF24' }]}>
      <Text style={[s.seloTxt, { color: esgotado ? '#fff' : '#282828' }]}>{esgotado ? 'Esgotado hoje' : `Últimas vagas hoje (${restantes})`}</Text>
    </View>
  );
}

export default function VitrineSocio() {
  const params = useLocalSearchParams();
  const [localId, setLocalId] = useState<number | null>(params.estabelecimento_id ? Number(params.estabelecimento_id) : null);
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('servicos');

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<{ vitrine: Vitrine | null }>(
    () => api(`/proprietario/vitrine${localId ? `?estabelecimento_id=${localId}` : ''}`),
    [localId]
  );
  const v = dados?.vitrine;

  return (
    <OwnerScreen titulo="Vitrine" aba="vitrine" variante="socio" semVoltar carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : !v ? (
        <Card><Vazio icone="storefront-outline" titulo="Você ainda não tem um local" texto="Cadastre seu primeiro local para ver como a vitrine aparece para os clientes." /></Card>
      ) : (
        <>
          <View style={s.aviso}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={s.avisoTxt}>Prévia: é assim que seus clientes veem o seu local</Text>
          </View>

          {v.locais.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {v.locais.map((l) => {
                const on = l.id === v.estabelecimento.id;
                return (
                  <TouchableOpacity key={l.id} style={[s.chip, on && s.chipOn]} onPress={() => setLocalId(l.id)}>
                    <Text style={[s.chipTxt, on && { color: '#fff' }]}>{l.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={s.capaBox}>
            {v.estabelecimento.foto_banner || v.estabelecimento.foto_perfil ? (
              <Image source={{ uri: String(v.estabelecimento.foto_banner || v.estabelecimento.foto_perfil) }} style={s.capa} contentFit="cover" />
            ) : (
              <View style={[s.capa, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="image-outline" size={34} color={O.faint} /></View>
            )}
            <View style={s.capaInfo}>
              <Text style={s.nome}>{v.estabelecimento.nome}</Text>
              <Text style={s.sub}>
                {[v.estabelecimento.ramo_atuacao, [v.estabelecimento.cidade, v.estabelecimento.estado].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')}
              </Text>
              {v.avaliacoes.total > 0 && (
                <View style={s.notaLinha}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={s.notaTxt}>{String(v.avaliacoes.media).replace('.', ',')} ({v.avaliacoes.total})</Text>
                </View>
              )}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {ABAS.map((a) => {
              const qtd = v[a.id].length;
              const on = aba === a.id;
              return (
                <TouchableOpacity key={a.id} style={[s.chip, on && s.chipOn]} onPress={() => setAba(a.id)}>
                  <Text style={[s.chipTxt, on && { color: '#fff' }]}>{a.rotulo} · {qtd}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {aba === 'servicos' && (v.servicos.length === 0 ? <Vazio2 texto="Nenhum serviço ativo." /> : v.servicos.map((sv) => (
            <View key={sv.id} style={s.cartao}>
              <View style={s.foto}>
                {sv.foto ? <Image source={{ uri: sv.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={28} color={O.faint} />}
                <Selo status={sv.vagas_status} restantes={sv.vagas_restantes} />
              </View>
              <View style={s.corpo}>
                <Text style={s.cartaoNome}>{sv.nome}</Text>
                {!!sv.duracao_minutos && <Text style={s.cartaoSub}>{sv.duracao_minutos} min{sv.somente_premium ? ' · Premium' : ''}</Text>}
                <View style={s.precoLinha}>
                  <Text style={s.preco}>{brl(sv.preco_final)}</Text>
                  {sv.em_promocao && <Text style={s.promo}>PROMO</Text>}
                </View>
              </View>
            </View>
          )))}

          {aba === 'reservas' && (v.reservas.length === 0 ? <Vazio2 texto="Nenhuma reserva (locação) ativa." /> : v.reservas.map((r) => (
            <View key={r.id} style={s.cartao}>
              <View style={s.foto}>
                {r.foto ? <Image source={{ uri: r.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={28} color={O.faint} />}
                <Selo status={r.vagas_status} restantes={r.vagas_restantes} />
              </View>
              <View style={s.corpo}>
                <Text style={s.cartaoSub}>{String(r.categoria || '').replace(/_/g, ' ')}</Text>
                <Text style={s.cartaoNome}>{r.nome}</Text>
                <Text style={s.cartaoSub}>{[r.cidade, r.estado].filter(Boolean).join(' - ')}{r.capacidade_pessoas ? ` · até ${r.capacidade_pessoas} pessoas` : ''}</Text>
                <View style={s.precoLinha}>
                  <Text style={s.preco}>{brl(r.preco_final)}<Text style={s.cartaoSub}> / dia</Text></Text>
                  {r.em_promocao && <Text style={s.promo}>PROMO</Text>}
                </View>
              </View>
            </View>
          )))}

          {aba === 'produtos' && (v.produtos.length === 0 ? <Vazio2 texto="Nenhum produto vinculado com estoque." /> : v.produtos.map((p) => (
            <View key={p.id} style={s.cartao}>
              <View style={[s.foto, { width: 84 }]}>
                {p.foto ? <Image source={{ uri: p.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="cube-outline" size={26} color={O.faint} />}
              </View>
              <View style={s.corpo}>
                <Text style={s.cartaoNome}>{p.nome}</Text>
                <Text style={s.preco}>{brl(p.valor_final)}</Text>
                {p.somente_premium && <Text style={s.cartaoSub}>Exclusivo Premium</Text>}
              </View>
            </View>
          )))}

          {aba === 'cupons' && (v.cupons.length === 0 ? <Vazio2 texto="Nenhum cupom ativo." /> : v.cupons.map((c) => (
            <View key={c.id} style={s.cupom}>
              <View style={{ flex: 1 }}>
                <Text style={s.cartaoNome}>{c.titulo}</Text>
                <Text style={s.cartaoSub}>
                  {c.tipo_desconto === 'percentual' ? `${c.valor_desconto}% de desconto` : `${brl(c.valor_desconto)} de desconto`}
                  {c.alvo ? ` · só em ${c.alvo}` : ' · em todo o local'}{c.apenas_plus ? ' · Premium' : ''}
                </Text>
              </View>
              <Text style={s.codigo}>{c.codigo}</Text>
            </View>
          )))}

          {v.avaliacoes.previa.length > 0 && (
            <>
              <Text style={s.secao}>O que os clientes dizem</Text>
              {v.avaliacoes.previa.map((a, i) => (
                <View key={i} style={s.avaliacao}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.cartaoNome}>{a.autor}</Text>
                    <Text style={{ color: '#F59E0B', fontWeight: '800' }}>★ {String(a.nota).replace('.', ',')}</Text>
                  </View>
                  {!!a.comentario && <Text style={[s.cartaoSub, { marginTop: 6 }]}>{a.comentario}</Text>}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </OwnerScreen>
  );
}

function Vazio2({ texto }: { texto: string }) {
  return <Card><Text style={{ textAlign: 'center', color: O.muted, paddingVertical: 18 }}>{texto}</Text></Card>;
}

const s = StyleSheet.create({
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: O.ink, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  avisoTxt: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: O.line },
  chipOn: { backgroundColor: O.accent, borderColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  capaBox: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  capa: { width: '100%', height: 150, backgroundColor: O.soft },
  capaInfo: { padding: 16 },
  nome: { fontSize: 22, fontWeight: '800', color: O.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: O.muted, marginTop: 3 },
  notaLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  notaTxt: { fontSize: 13, fontWeight: '700', color: O.ink },
  cartao: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  foto: { width: 110, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  corpo: { flex: 1, padding: 14, gap: 3 },
  cartaoNome: { fontSize: 15, fontWeight: '800', color: O.ink },
  cartaoSub: { fontSize: 12, color: O.muted },
  precoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  preco: { fontSize: 18, fontWeight: '900', color: O.ink },
  promo: { fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#12A150', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  selo: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  seloTxt: { fontSize: 10, fontWeight: '800' },
  cupom: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#86EFAC', borderStyle: 'dashed', marginBottom: 10 },
  codigo: { fontSize: 13, fontWeight: '900', color: '#fff', backgroundColor: O.ink, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, overflow: 'hidden', letterSpacing: 1.5 },
  secao: { fontSize: 17, fontWeight: '800', color: O.ink, marginTop: 20, marginBottom: 10 },
  avaliacao: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
