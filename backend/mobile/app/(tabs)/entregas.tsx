import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../../constants/ClientTheme';
import { HeaderCliente } from '../../components/client/ui';
import { mostrarToast } from '../../services/toast';
import { apiMobile, brl, COMO_FUNCIONA, mensagemDeErro, ProdutoEntrega } from '../../services/entregasApi';

const ORDENACOES = [
  { id: '', rotulo: 'Relevantes' },
  { id: 'menor_preco', rotulo: 'Menor preço' },
  { id: 'maior_preco', rotulo: 'Maior preço' },
  { id: 'mais_vendidos', rotulo: 'Mais vendidos' },
  { id: 'recentes', rotulo: 'Recentes' },
];

const C = {
  ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line,
  accent: T.primary, accentSoft: T.primarySoft, success: T.success, successBg: T.successBg, danger: T.danger,
};

export default function EntregasTab() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colunas = width >= 700 ? 3 : 2;

  const [produtos, setProdutos] = useState<ProdutoEntrega[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [somentePromocoes, setSomentePromocoes] = useState(false);
  const [somentePremium, setSomentePremium] = useState(false);
  const [ordenar, setOrdenar] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [comoFunciona, setComoFunciona] = useState(false);
  const [sugestoes, setSugestoes] = useState<any[]>([]);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (categoria) params.set('categoria', categoria);
      if (somentePromocoes) params.set('apenas_promocoes', '1');
      if (somentePremium) params.set('apenas_premium', '1');
      if (ordenar) params.set('ordenar', ordenar);
      const min = precoMin.replace(',', '.');
      const max = precoMax.replace(',', '.');
      if (min && Number(min) >= 0) params.set('preco_min', min);
      if (max && Number(max) >= 0) params.set('preco_max', max);
      const { ok, data } = await apiMobile<{ data?: ProdutoEntrega[]; total?: number }>(`/entregas/catalogo?${params.toString()}`);
      if (ok) {
        const lista = Array.isArray(data.data) ? data.data : [];
        setProdutos(lista);
        setTotal(Number(data.total ?? lista.length));
      }
    } catch {
      setProdutos([]);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [busca, categoria, somentePromocoes, somentePremium, ordenar, precoMin, precoMax]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    apiMobile<{ sugestoes: any[] }>('/entregas/recompras')
      .then(({ ok, data }) => { if (ok) setSugestoes(data.sugestoes || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiMobile<{ categorias: string[] }>('/entregas/categorias')
      .then(({ ok, data }) => { if (ok) setCategorias(data.categorias || []); })
      .catch(() => {});
  }, []);

  const alternarFavorito = async (produto: ProdutoEntrega) => {
    setProdutos((lista) => lista.map((p) => (p.id === produto.id ? { ...p, favoritado: !p.favoritado } : p)));
    const { ok, data } = await apiMobile<{ is_favorito: boolean }>('/favoritos/toggle', {
      method: 'POST', json: { tipo: 'produto_entrega', id: produto.id },
    });
    if (!ok) {
      setProdutos((lista) => lista.map((p) => (p.id === produto.id ? { ...p, favoritado: !!produto.favoritado } : p)));
      mostrarToast('Não foi possível atualizar os favoritos.', 'erro');
      return;
    }
    setProdutos((lista) => lista.map((p) => (p.id === produto.id ? { ...p, favoritado: data.is_favorito } : p)));
  };

  const adicionarAoCarrinho = async (produto: ProdutoEntrega) => {
    const { ok, data } = await apiMobile('/entregas/carrinho', {
      method: 'POST', json: { produto_entrega_id: produto.id, quantidade: produto.quantidade_minima || 1 },
    });
    if (ok) mostrarToast('Produto adicionado ao carrinho.', 'sucesso');
    else mostrarToast(mensagemDeErro(data, 'Não foi possível adicionar ao carrinho.'), 'erro');
  };

  const abrirProduto = (produto: ProdutoEntrega) => {
    router.push({ pathname: '/src/screens/EntregaDetalhes' as never, params: { id: String(produto.id) } });
  };

  const abrirPedidos = () => router.push('/src/screens/MeusPedidosEntrega' as never);

  return (
    <SafeAreaView style={s.safe}>
      <HeaderCliente titulo="Produtos" subtitulo="Entrega ou retirada perto de você" />

      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar(); }} tintColor={C.accent} />}
      >
        {sugestoes.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={s.tituloSecao}>Repor agora</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {sugestoes.map((sg) => (
                <TouchableOpacity
                  key={sg.produto_entrega_id}
                  onPress={() => router.push({ pathname: '/src/screens/EntregaDetalhes' as never, params: { id: String(sg.produto_entrega_id) } })}
                  style={[s.cardRepor, sg.pronta_para_repetir && { borderColor: C.accent }]}
                >
                  <Image source={{ uri: sg.fotos?.[0] || 'https://placehold.co/120x120/f4f4f5/a1a1aa?text=P' }} style={s.fotoRepor} contentFit="cover" />
                  <Text style={s.nomeRepor} numberOfLines={1}>{sg.nome}</Text>
                  <Text style={[s.metaRepor, sg.pronta_para_repetir && { color: C.accent, fontWeight: '800' }]}>
                    {sg.pronta_para_repetir ? 'Hora de repor' : `Próxima ~${new Date(`${sg.proxima_prevista_em}T12:00:00`).toLocaleDateString('pt-BR')}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/src/screens/AssinaturasEntrega' as never)} style={s.linkPedidos}>
          <Ionicons name="calendar-outline" size={18} color={C.accent} />
          <Text style={s.linkPedidosTxt}>Minhas assinaturas de entrega</Text>
          <Ionicons name="chevron-forward" size={16} color={C.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/src/screens/MinhasCobrancas' as never)} style={s.linkPedidos}>
          <Ionicons name="cash-outline" size={18} color={C.accent} />
          <Text style={s.linkPedidosTxt}>Pagamentos mensais (serviços e reservas em parcelas)</Text>
          <Ionicons name="chevron-forward" size={16} color={C.accent} />
        </TouchableOpacity>

        <View style={s.linhaBusca}>
          <View style={s.campoBusca}>
            <Ionicons name="search" size={18} color={C.faint} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar botijão, água, mercado..."
              placeholderTextColor={C.faint}
              style={s.inputBusca}
            />
          </View>
          <TouchableOpacity onPress={() => setSomentePromocoes((v) => !v)} style={[s.chipPromo, somentePromocoes && s.chipAtivo]}>
            <Text style={[s.chipTxt, somentePromocoes && s.chipTxtAtivo]}>Promoções</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linhaCategorias}>
          {['', ...categorias].map((c) => (
            <TouchableOpacity key={c || 'todas'} onPress={() => setCategoria(c)} style={[s.chip, categoria === c && s.chipAtivo]}>
              <Text style={[s.chipTxt, categoria === c && s.chipTxtAtivo]}>{c || 'Todas'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linhaCategorias}>
          {ORDENACOES.map((o) => (
            <TouchableOpacity key={o.id || 'relevantes'} onPress={() => setOrdenar(o.id)} style={[s.chip, ordenar === o.id && s.chipAtivo]}>
              <Text style={[s.chipTxt, ordenar === o.id && s.chipTxtAtivo]}>{o.rotulo}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setSomentePremium((v) => !v)} style={[s.chip, somentePremium && s.chipPremiumAtivo]}>
            <Text style={[s.chipTxt, somentePremium && s.chipTxtAtivo]}>★ Vendedor premium</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={s.linhaPrecoFiltro}>
          <Text style={s.rotuloPreco}>Preço</Text>
          <TextInput value={precoMin} onChangeText={(t) => setPrecoMin(t.replace(/[^0-9.,]/g, ''))} placeholder="Mín." keyboardType="decimal-pad" style={s.campoPreco} placeholderTextColor={C.muted} />
          <Text style={s.rotuloPreco}>até</Text>
          <TextInput value={precoMax} onChangeText={(t) => setPrecoMax(t.replace(/[^0-9.,]/g, ''))} placeholder="Máx." keyboardType="decimal-pad" style={s.campoPreco} placeholderTextColor={C.muted} />
          {!carregando && <Text style={[s.rotuloPreco, { marginLeft: 'auto' }]}>{total} produto(s)</Text>}
        </View>

        <TouchableOpacity onPress={() => setComoFunciona((v) => !v)} style={s.cardComoFunciona} activeOpacity={0.85}>
          <View style={s.linhaEntre}>
            <Text style={s.tituloComoFunciona}>Como funcionam os produtos</Text>
            <Ionicons name={comoFunciona ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
          </View>
          {comoFunciona && COMO_FUNCIONA.map(([titulo, texto], i) => (
            <View key={titulo} style={s.passo}>
              <View style={s.numeroPasso}><Text style={s.numeroPassoTxt}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.passoTitulo}>{titulo}</Text>
                <Text style={s.passoTexto}>{texto}</Text>
              </View>
            </View>
          ))}
        </TouchableOpacity>

        <TouchableOpacity onPress={abrirPedidos} style={s.linkPedidos}>
          <Ionicons name="receipt-outline" size={18} color={C.accent} />
          <Text style={s.linkPedidosTxt}>Meus pedidos e códigos de entrega</Text>
          <Ionicons name="chevron-forward" size={16} color={C.accent} />
        </TouchableOpacity>

        {carregando ? (
          <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
        ) : produtos.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="cube-outline" size={44} color={C.faint} />
            <Text style={s.vazioTxt}>Nenhum produto encontrado com esses filtros.</Text>
          </View>
        ) : (
          <View style={s.grade}>
            {produtos.map((produto) => {
              const desconto = produto.tem_promocao && Number(produto.valor_final) < Number(produto.valor);
              const percentual = desconto ? Math.round((1 - Number(produto.valor_final) / Number(produto.valor)) * 100) : 0;
              return (
                <TouchableOpacity
                  key={produto.id}
                  activeOpacity={0.9}
                  onPress={() => abrirProduto(produto)}
                  style={[s.card, { width: `${100 / colunas - 3}%` }]}
                >
                  <View style={s.fotoBox}>
                    <Image source={{ uri: produto.fotos?.[0] || 'https://placehold.co/400x400/f4f4f5/a1a1aa?text=Produto' }} style={s.foto} contentFit="cover" />
                    {desconto && <View style={s.selo}><Text style={s.seloTxt}>-{percentual}%</Text></View>}
                    <TouchableOpacity onPress={() => alternarFavorito(produto)} style={s.botaoFavorito} hitSlop={8}>
                      <Ionicons name={produto.favoritado ? 'heart' : 'heart-outline'} size={18} color={produto.favoritado ? C.danger : C.ink} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.corpoCard}>
                    <View style={s.linhaSelos}>
                      {!!produto.categoria && <Text style={s.categoria}>{produto.categoria}</Text>}
                      {produto.vendedor_premium && <Text style={s.seloPremium}>★ PREMIUM</Text>}
                    </View>
                    <Text style={s.nome} numberOfLines={2}>{produto.nome}</Text>
                    <Text style={s.vendedor} numberOfLines={1}>{produto.estabelecimento?.nome || produto.vendedor?.name || 'Vendedor independente'}</Text>
                    <View style={s.linhaPreco}>
                      <Text style={s.preco}>{brl(produto.valor_final)}</Text>
                      {desconto && <Text style={s.precoAntigo}>{brl(produto.valor)}</Text>}
                    </View>
                    <View style={s.tags}>
                      <Text style={[s.tag, produto.aceita_pagamento_online ? s.tagVerde : s.tagCinza]}>
                        {produto.aceita_pagamento_online ? 'Pague online' : 'Pague no local'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => adicionarAoCarrinho(produto)} style={s.botaoCarrinho} activeOpacity={0.85}>
                      <Ionicons name="bag-add-outline" size={15} color="#fff" />
                      <Text style={s.botaoCarrinhoTxt}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  conteudo: { padding: 16, paddingBottom: 40, gap: 14 },
  centro: { paddingVertical: 40, alignItems: 'center' },
  vazio: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  vazioTxt: { color: C.muted, fontSize: 14, fontWeight: '600' },
  linhaBusca: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  campoBusca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line },
  inputBusca: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.ink },
  chipPromo: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  linhaCategorias: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipAtivo: { backgroundColor: C.ink, borderColor: C.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  chipTxtAtivo: { color: '#fff' },
  chipPremiumAtivo: { backgroundColor: '#D97706', borderColor: '#D97706' },
  linhaPrecoFiltro: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rotuloPreco: { fontSize: 12, fontWeight: '700', color: C.muted },
  campoPreco: { width: 80, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: C.ink },
  linhaSelos: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  seloPremium: { fontSize: 9, fontWeight: '900', color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  cardComoFunciona: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, gap: 10 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tituloComoFunciona: { fontSize: 14, fontWeight: '800', color: C.ink },
  passo: { flexDirection: 'row', gap: 10 },
  numeroPasso: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  numeroPassoTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  passoTitulo: { fontSize: 13, fontWeight: '800', color: C.ink },
  passoTexto: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  tituloSecao: { fontSize: 15, fontWeight: '900', color: C.ink },
  cardRepor: { width: 130, backgroundColor: C.card, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: C.line, gap: 6 },
  fotoRepor: { width: '100%', height: 80, borderRadius: 12, backgroundColor: '#EDEDED' },
  nomeRepor: { fontSize: 13, fontWeight: '800', color: C.ink },
  metaRepor: { fontSize: 11, color: C.muted },
  linkPedidos: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentSoft, borderRadius: 14, padding: 14 },
  linkPedidosTxt: { flex: 1, fontSize: 13, fontWeight: '800', color: C.accent },
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  card: { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  fotoBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F1F1F1' },
  foto: { width: '100%', height: '100%' },
  selo: { position: 'absolute', top: 8, left: 8, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  seloTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
  botaoFavorito: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  corpoCard: { padding: 12, gap: 3 },
  categoria: { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  nome: { fontSize: 14, fontWeight: '800', color: C.ink, lineHeight: 18 },
  vendedor: { fontSize: 11, color: C.faint },
  linhaPreco: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  preco: { fontSize: 16, fontWeight: '900', color: C.ink },
  precoAntigo: { fontSize: 11, color: C.faint, textDecorationLine: 'line-through' },
  tags: { flexDirection: 'row', marginTop: 4 },
  tag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  tagVerde: { backgroundColor: C.successBg, color: C.success },
  tagCinza: { backgroundColor: '#F1F1F1', color: C.muted },
  botaoCarrinho: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 9 },
  botaoCarrinhoTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
