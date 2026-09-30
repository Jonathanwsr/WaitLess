import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../../constants/ClientTheme';
import { FavoriteButton } from '../../../components/client/ui';
import { compartilharLocal } from '../../../services/compartilhar';
import { alternarFavoritoRemoto } from '../../../services/favoritos';

const C = {
  ink: T.ink,
  muted: T.muted,
  faint: T.faint,
  canvas: T.cream,
  card: T.card,
  line: T.line,
  soft: '#F0F0F2',
  accent: T.primary,
  accentSoft: T.primarySoft,
  star: T.star,
  success: T.success,
  successBg: T.successBg,
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1000&auto=format&fit=crop';
const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil?: string;
  foto_banner?: string;
  ramo_atuacao?: string;
  categoria?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  rua?: string;
  numero?: string;
  bio?: string;
  favoritado?: boolean;
}

interface ResumoAvaliacoes {
  media_geral: string | number;
  total: number;
}

interface ItemRaw {
  id: number;
  nome: string;
  descricao?: string;
  categoria?: string;
  valor?: number | string;
  valor_diaria?: number | string;
  duracao_minutos?: number | string;
  foto_principal?: string;
  foto?: string;
  fotos?: string | string[];
  tem_promocao?: boolean | number | string;
  tipo_desconto?: string;
  valor_desconto?: number | string;
  capacidade_pessoas?: number;
  lugares?: number;
  cambio?: string;
  somente_premium?: boolean | number;
  aceita_pontos?: boolean | number;
}

interface ItemCatalogo extends ItemRaw {
  tipoItem: 'servico' | 'aluguel';
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function ServicoDetalhes() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const rawId = searchParams.id || searchParams.estabelecimentoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<ResumoAvaliacoes | null>(null);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);

  const [aba, setAba] = useState<'todos' | 'servico' | 'aluguel'>('todos');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Todas');

  const [saldoPontos, setSaldoPontos] = useState<number>(0);
  const [favorito, setFavorito] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      carregarPerfilDaLoja();
    } else {
      setLoading(false);
      setError(true);
    }
  }, [id]);

  const carregarPerfilDaLoja = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

      const res = await fetch(`${cleanBaseUrl}/mobile/estabelecimentos/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (!res.ok) throw new Error('Falha na API');
      const data = await res.json();

      setEstabelecimento(data.estabelecimento);
      setAvaliacoes({
        media_geral: data.avaliacoes_resumo?.media_geral ? Number(data.avaliacoes_resumo.media_geral).toFixed(1) : 0,
        total: data.avaliacoes_resumo?.total || 0,
      });
      setFavorito(!!data.estabelecimento?.favoritado);

      const locacoes: ItemCatalogo[] = (data.locacoes || []).map((loc: ItemRaw) => ({ ...loc, tipoItem: 'aluguel' }));
      const servicos: ItemCatalogo[] = (data.servicos || []).map((ser: ItemRaw) => ({ ...ser, tipoItem: 'servico' }));
      setCatalogo([...servicos, ...locacoes]);

      buscarSaldoPontos(cleanBaseUrl, token, String(id));
    } catch (e) {
      console.log('Erro ao carregar vitrine:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const buscarSaldoPontos = async (baseUrl: string, token: string | null, estId: string) => {
    try {
      const res = await fetch(`${baseUrl}/mobile/pontos/saldo?estabelecimento_id=${estId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSaldoPontos(data.saldo ?? 0);
      }
    } catch (e) {
      console.log('Erro ao buscar saldo', e);
    }
  };

  const getImagemUrl = (item: ItemCatalogo): string => {
    let img = item.foto_principal || item.foto;
    if (!img && item.fotos) {
      let arr: string[] = [];
      if (typeof item.fotos === 'string') {
        try { arr = JSON.parse(item.fotos); } catch (e) { arr = []; }
      } else if (Array.isArray(item.fotos)) {
        arr = item.fotos as string[];
      }
      if (arr && arr.length > 0) img = arr[0];
    }
    return img || DEFAULT_COVER;
  };

  const calcularPreco = (item: ItemCatalogo) => {
    const precoBase = Number(item.valor || item.valor_diaria || 0);
    let precoComDesconto = precoBase;
    const temPromocao = item.tem_promocao === true || item.tem_promocao === 1 || item.tem_promocao === '1';

    if (temPromocao && item.valor_desconto) {
      const valorDesc = Number(item.valor_desconto);
      precoComDesconto = item.tipo_desconto === 'percentual' ? precoBase - precoBase * (valorDesc / 100) : precoBase - valorDesc;
    }
    precoComDesconto = Math.max(0, precoComDesconto);
    return { precoBase, precoComDesconto, temPromocao: temPromocao && precoComDesconto < precoBase };
  };

  const toggleFavorito = async () => {
    if (!estabelecimento) return;
    setFavorito((atual) => !atual);
    const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
    const resultado = await alternarFavoritoRemoto(`${cleanBaseUrl}/mobile/favoritos/toggle`, 'estabelecimento', estabelecimento.id);
    if (resultado === null) setFavorito((atual) => !atual);
  };

  // Ao tocar num item do catálogo, vai direto pra tela de detalhes completa
  // (fotos, descrição, forma de pagamento) — antes caía num carrinho/modal
  // intermediário em vez de mostrar o item de verdade.
  const handleNavegarParaReserva = (item: ItemCatalogo) => {
    router.push({
      pathname: '/src/screens/ExplorarDetalhes' as never,
      params: { id: String(item.id), tipo: item.tipoItem === 'aluguel' ? 'reservas' : undefined },
    });
  };

  const categorias = useMemo(() => {
    const doTipo = catalogo.filter((i) => aba === 'todos' || i.tipoItem === aba);
    return ['Todas', ...Array.from(new Set(doTipo.map((i) => i.categoria).filter(Boolean) as string[]))];
  }, [catalogo, aba]);

  const itensExibidos = useMemo(
    () =>
      catalogo
        .filter((i) => aba === 'todos' || i.tipoItem === aba)
        .filter((i) => categoriaAtiva === 'Todas' || i.categoria === categoriaAtiva),
    [catalogo, aba, categoriaAtiva]
  );

  const totalServicos = catalogo.filter((i) => i.tipoItem === 'servico').length;
  const totalReservas = catalogo.filter((i) => i.tipoItem === 'aluguel').length;
  const menorPreco = catalogo.length ? Math.min(...catalogo.map((i) => calcularPreco(i).precoComDesconto)) : 0;

  const enderecoTxt = estabelecimento
    ? [[estabelecimento.rua, estabelecimento.numero].filter(Boolean).join(', '), estabelecimento.bairro, [estabelecimento.cidade, estabelecimento.estado].filter(Boolean).join(' - ')]
        .filter(Boolean)
        .join(' · ')
    : '';

  if (loading) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (error || !estabelecimento) {
    return (
      <View style={s.centro}>
        <View style={s.erroIcone}><Ionicons name="alert-circle-outline" size={30} color={C.faint} /></View>
        <Text style={s.erroTitulo}>Não foi possível carregar</Text>
        <Text style={s.erroTxt}>Verifique sua conexão e tente novamente.</Text>
        <TouchableOpacity style={s.erroBtn} onPress={carregarPerfilDaLoja} activeOpacity={0.85}>
          <Text style={s.erroBtnTxt}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = (item: ItemCatalogo) => {
    const { precoBase, precoComDesconto, temPromocao } = calcularPreco(item);
    const ehAluguel = item.tipoItem === 'aluguel';
    const label = item.categoria ? item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1).replace(/_/g, ' ') : ehAluguel ? 'Reserva' : 'Serviço';

    return (
      <TouchableOpacity key={`${item.tipoItem}-${item.id}`} style={s.item} activeOpacity={0.9} onPress={() => handleNavegarParaReserva(item)}>
        <View style={s.itemFoto}>
          <Image source={{ uri: getImagemUrl(item) }} style={s.itemImg} contentFit="cover" />
          {(ehAluguel || temPromocao) && (
            <View style={s.maisReservado}><Text style={s.maisReservadoTxt}>Mais reservado</Text></View>
          )}
          {temPromocao && (
            <View style={s.promo}>
              <Text style={s.promoTxt}>
                {item.tipo_desconto === 'percentual' ? `${Number(item.valor_desconto)}% OFF` : 'Oferta'}
              </Text>
            </View>
          )}
        </View>

        <View style={s.itemInfo}>
          <Text style={s.itemNome} numberOfLines={2}>{item.nome}</Text>
          <Text style={s.itemSub} numberOfLines={1}>{label}{item.cambio ? ` · ${item.cambio}` : ''}</Text>

          <View style={s.itemTags}>
            <View style={s.tag}>
              <Ionicons name={ehAluguel ? 'key-outline' : 'time-outline'} size={11} color={C.muted} />
              <Text style={s.tagTxt}>{ehAluguel ? 'Reserva' : `${item.duracao_minutos || 30} min`}</Text>
            </View>
            {!!(item.lugares || item.capacidade_pessoas) && (
              <View style={s.tag}>
                <Ionicons name="people-outline" size={11} color={C.muted} />
                <Text style={s.tagTxt}>{item.lugares || item.capacidade_pessoas} lugares</Text>
              </View>
            )}
            {!!item.somente_premium && (
              <View style={[s.tag, { backgroundColor: C.accentSoft }]}>
                <Ionicons name="star" size={10} color={C.accent} />
                <Text style={[s.tagTxt, { color: C.accent }]}>Premium</Text>
              </View>
            )}
            {!!item.aceita_pontos && (
              <View style={s.tag}><Text style={s.tagTxt}>Aceita pontos</Text></View>
            )}
          </View>

          <View style={s.itemRodape}>
            <View style={{ flex: 1 }}>
              <View style={s.precoLinha}>
                <Text style={s.preco}>{brl(precoComDesconto)}</Text>
                {ehAluguel && <Text style={s.precoSufixo}>/ dia</Text>}
              </View>
              {temPromocao && <Text style={s.precoAntigo}>{brl(precoBase)}</Text>}
            </View>
            <View style={s.acaoBtn}>
              <Text style={s.acaoTxt}>{ehAluguel ? 'Reservar' : 'Agendar'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: saldoPontos > 0 ? 110 : 40 }}>
        {/* CAPA */}
        <View style={s.capa}>
          <Image source={{ uri: estabelecimento.foto_banner || estabelecimento.foto_perfil || DEFAULT_COVER }} style={s.capaImg} contentFit="cover" />
          <View style={s.capaSombra} />
          <View style={s.capaBotoes}>
            <TouchableOpacity style={s.circulo} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color={C.ink} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <FavoriteButton ativo={favorito} onPress={toggleFavorito} tamanho={42} />
              <TouchableOpacity style={s.circulo} onPress={() => compartilharLocal({ id: estabelecimento.id, nome: estabelecimento.nome })} activeOpacity={0.8} accessibilityLabel="Compartilhar">
                <Ionicons name="share-social-outline" size={20} color={C.ink} />
              </TouchableOpacity>
              <TouchableOpacity style={s.circulo} onPress={() => router.push('/(tabs)/explorar' as never)} activeOpacity={0.8}>
                <Ionicons name="search" size={20} color={C.ink} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* CARTÃO DO LOCAL */}
        <View style={s.perfil}>
          <View style={s.perfilTopo}>
            <View style={s.avatar}>
              <Image source={{ uri: estabelecimento.foto_perfil || DEFAULT_COVER }} style={s.avatarImg} contentFit="cover" />
            </View>
            <View style={{ flex: 1, paddingTop: 30 }}>
              <Text style={s.nome} numberOfLines={2}>{estabelecimento.nome}</Text>
              <Text style={s.categoria} numberOfLines={1}>{estabelecimento.ramo_atuacao || estabelecimento.categoria || 'Estabelecimento'}</Text>
            </View>
          </View>

          <View style={s.stats}>
            <View style={s.stat}>
              <View style={s.statLinha}>
                <Ionicons name="star" size={15} color={C.star} />
                <Text style={s.statValor}>{avaliacoes && avaliacoes.total > 0 ? avaliacoes.media_geral : 'Novo'}</Text>
              </View>
              <Text style={s.statRotulo}>{avaliacoes && avaliacoes.total > 0 ? `${avaliacoes.total} avaliações` : 'sem avaliações'}</Text>
            </View>
            <View style={s.statDivisor} />
            <View style={s.stat}>
              <Text style={s.statValor}>{catalogo.length}</Text>
              <Text style={s.statRotulo}>{catalogo.length === 1 ? 'opção' : 'opções'}</Text>
            </View>
            <View style={s.statDivisor} />
            <View style={s.stat}>
              <Text style={s.statValor}>{catalogo.length ? brl(menorPreco) : '-'}</Text>
              <Text style={s.statRotulo}>a partir de</Text>
            </View>
          </View>

          {!!enderecoTxt && (
            <View style={s.infoLinha}>
              <View style={s.infoIcone}><Ionicons name="location-outline" size={17} color={C.ink} /></View>
              <Text style={s.infoTxt}>{enderecoTxt}</Text>
            </View>
          )}
          {!!estabelecimento.telefone && (
            <TouchableOpacity style={s.infoLinha} onPress={() => Linking.openURL(`tel:${estabelecimento.telefone}`)} activeOpacity={0.7}>
              <View style={s.infoIcone}><Ionicons name="call-outline" size={17} color={C.ink} /></View>
              <Text style={s.infoTxt}>{estabelecimento.telefone}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </TouchableOpacity>
          )}
          {!!estabelecimento.bio && <Text style={s.bio}>{estabelecimento.bio}</Text>}
        </View>

        {/* ABAS + CATEGORIAS */}
        <View style={s.abas}>
          {[
            { id: 'todos', rotulo: `Tudo (${catalogo.length})` },
            { id: 'servico', rotulo: `Serviços (${totalServicos})` },
            { id: 'aluguel', rotulo: `Reservas (${totalReservas})` },
          ].map((a) => {
            const on = aba === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.aba, on && s.abaOn]} onPress={() => { setAba(a.id as typeof aba); setCategoriaAtiva('Todas'); }} activeOpacity={0.85}>
                <Text style={[s.abaTxt, on && s.abaTxtOn]}>{a.rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {categorias.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {categorias.map((cat) => {
              const on = categoriaAtiva === cat;
              return (
                <TouchableOpacity key={cat} style={[s.chip, on && s.chipOn]} onPress={() => setCategoriaAtiva(cat)} activeOpacity={0.8}>
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{cat === 'Todas' ? cat : cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* LISTA */}
        <View style={s.lista}>
          {itensExibidos.length > 0 ? (
            itensExibidos.map(renderItem)
          ) : (
            <View style={s.vazio}>
              <Ionicons name="albums-outline" size={30} color={C.faint} />
              <Text style={s.vazioTxt}>Nenhum item encontrado nesta seção.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* PONTOS */}
      {saldoPontos > 0 && (
        <View style={s.pontosWrap}>
          <View style={s.pontos}>
            <View style={s.pontosIcone}><Ionicons name="gift-outline" size={20} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pontosTitulo}>Você tem {saldoPontos} pontos</Text>
              <Text style={s.pontosSub}>Use no checkout para ganhar desconto.</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.canvas },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas, padding: 32 },
  erroIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  erroTitulo: { fontSize: 18, fontWeight: '800', color: C.ink },
  erroTxt: { fontSize: 14, color: C.muted, marginTop: 6, textAlign: 'center' },
  erroBtn: { marginTop: 18, backgroundColor: C.accent, paddingHorizontal: 22, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  erroBtnTxt: { color: '#fff', fontWeight: '700' },

  capa: { height: 230, width: '100%' },
  capaImg: { width: '100%', height: '100%', backgroundColor: C.soft },
  capaSombra: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.14)' },
  capaBotoes: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  circulo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },

  perfil: { backgroundColor: C.canvas, marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingBottom: 20 },
  perfilTopo: { flexDirection: 'row', gap: 14 },
  avatar: { width: 92, height: 92, borderRadius: 28, borderWidth: 4, borderColor: C.canvas, marginTop: -38, overflow: 'hidden', backgroundColor: C.soft, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  avatarImg: { width: '100%', height: '100%' },
  nome: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  categoria: { fontSize: 14, color: C.muted, marginTop: 2, fontWeight: '500' },

  stats: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 22, paddingVertical: 16, marginTop: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statLinha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValor: { fontSize: 18, fontWeight: '800', color: C.ink },
  statRotulo: { fontSize: 11, color: C.muted, marginTop: 3, fontWeight: '500' },
  statDivisor: { width: 1, backgroundColor: C.line },

  infoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoTxt: { flex: 1, fontSize: 14, color: C.ink, fontWeight: '500', lineHeight: 20 },
  bio: { fontSize: 14, color: C.muted, lineHeight: 21, marginTop: 8 },

  abas: { flexDirection: 'row', backgroundColor: '#E9E9EC', marginHorizontal: 20, marginTop: 18, borderRadius: 16, padding: 4 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  abaOn: { backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  abaTxt: { fontSize: 12, fontWeight: '600', color: C.muted },
  abaTxtOn: { color: '#fff', fontWeight: '700' },

  chips: { paddingHorizontal: 20, gap: 8, paddingTop: 14 },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink },
  chipTxtOn: { color: '#fff' },

  lista: { paddingHorizontal: 20, paddingTop: 16 },
  item: { flexDirection: 'row', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 12, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  itemFoto: { width: 112, height: 132, borderRadius: 18, overflow: 'hidden', backgroundColor: C.soft },
  itemImg: { width: '100%', height: '100%' },
  maisReservado: { position: 'absolute', top: 8, left: 8, backgroundColor: T.tag, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  maisReservadoTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  promo: { position: 'absolute', bottom: 8, left: 8, backgroundColor: C.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  promoTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  itemInfo: { flex: 1, paddingVertical: 2 },
  itemNome: { fontSize: 16, fontWeight: '700', color: C.ink },
  itemSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  itemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.soft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagTxt: { fontSize: 10, fontWeight: '600', color: C.muted },
  itemRodape: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 'auto', paddingTop: 8 },
  precoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  preco: { fontSize: 19, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  precoSufixo: { fontSize: 12, color: C.muted },
  precoAntigo: { fontSize: 12, color: C.faint, textDecorationLine: 'line-through' },
  acaoBtn: { backgroundColor: C.accent, paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  acaoTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  vazio: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  vazioTxt: { fontSize: 14, color: C.muted },

  pontosWrap: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.accent, borderRadius: 22, padding: 14, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  pontosIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  pontosTitulo: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pontosSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
});
