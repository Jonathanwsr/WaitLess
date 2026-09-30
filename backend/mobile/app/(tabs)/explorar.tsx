import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Modal,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alternarFavoritoRemoto } from '../../services/favoritos';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { T } from '../../constants/ClientTheme';
import { FavoriteButton, HeaderCliente } from '../../components/client/ui';

const C = {
  ink: T.ink,
  muted: T.muted,
  faint: T.faint,
  canvas: T.cream,
  card: T.card,
  line: T.line,
  soft: '#F6EEE9',
  accent: T.primary,
  accentSoft: T.primarySoft,
  star: T.star,
  success: T.success,
  successBg: T.successBg,
  warning: T.tag,
  warningBg: '#FBE9E1',
  danger: T.danger,
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Cada categoria com sua própria cor (a escolhida ganha esse tom no lugar do laranja padrão do
// app) — assim a barra de categorias não fica toda laranja, e cada área já "avisa" sua emoção:
// beleza em rosa, saúde em azul de confiança, festas em roxo, etc.
const CATEGORIAS: { nome: string; icone: MaterialIconName; slug: string; cor: string }[] = [
  { nome: 'Tudo', icone: 'apps', slug: 'tudo', cor: C.ink },
  { nome: 'Beleza', icone: 'content-cut', slug: 'beleza', cor: '#E8467C' },
  { nome: 'Barbearia', icone: 'storefront', slug: 'barbearia', cor: '#1F6F8B' },
  { nome: 'Estética', icone: 'face', slug: 'estetica', cor: '#DB2777' },
  { nome: 'Automotivo', icone: 'directions-car', slug: 'automotivo', cor: '#4F46E5' },
  { nome: 'Carros/Motos', icone: 'two-wheeler', slug: 'veiculos', cor: '#4338CA' },
  { nome: 'Flats/Estadias', icone: 'hotel', slug: 'flats', cor: '#0284C7' },
  { nome: 'Pets', icone: 'pets', slug: 'pets', cor: '#D97706' },
  { nome: 'Casa/Faxina', icone: 'cleaning-services', slug: 'casa', cor: '#0EA5A4' },
  { nome: 'Eventos', icone: 'event', slug: 'eventos', cor: '#7C3AED' },
  { nome: 'Saúde', icone: 'local-hospital', slug: 'saude', cor: '#2563EB' },
  { nome: 'Equipamentos', icone: 'build', slug: 'equipamentos', cor: '#475569' },
  // Cobrindo o restante dos ramos de atuação reais cadastráveis (igual à Home).
  { nome: 'Restaurantes', icone: 'restaurant', slug: 'restaurante', cor: '#DC2626' },
  { nome: 'Oficinas', icone: 'car-repair', slug: 'oficina', cor: '#4F46E5' },
  { nome: 'Locadoras', icone: 'directions-car', slug: 'locadora', cor: '#4338CA' },
  { nome: 'Academias', icone: 'fitness-center', slug: 'academia', cor: '#EA580C' },
  { nome: 'Esportes', icone: 'sports-basketball', slug: 'esportivo', cor: '#16A34A' },
  { nome: 'Clínicas', icone: 'medical-services', slug: 'clinica', cor: '#2563EB' },
];

const TIPOS = [
  { value: 'estabelecimentos', label: 'Lojas', icone: 'storefront-outline' },
  { value: 'servicos', label: 'Serviços', icone: 'cut-outline' },
  { value: 'reservas', label: 'Reservas', icone: 'key-outline' },
] as const;

const ORDENS = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'avaliacao', label: 'Melhor avaliados' },
  { value: 'preco_asc', label: 'Menor preço' },
  { value: 'preco_desc', label: 'Maior preço' },
  { value: 'distancia', label: 'Mais perto' },
  { value: 'recentes', label: 'Mais recentes' },
];

interface ItemExplorar {
  id: number;
  nome?: string;
  foto_perfil?: string | null;
  ramo_atuacao?: string | null;
  categoria?: string | null;
  modelo?: string | null;
  cidade?: string;
  estado?: string;
  nome_local?: string | null;
  valor?: number | string;
  valor_original?: number | string;
  tem_promocao?: boolean;
  desconto_label?: string | null;
  avaliacao_media?: number | string;
  total_avaliacoes?: number;
  duracao_minutos?: number | string | null;
  total_servicos?: number;
  fila_atual?: number;
  distancia?: number | null;
  aceita_pontos?: boolean;
  vagas_status?: 'esgotado' | 'poucas_vagas' | null;
  vagas_restantes?: number | null;
  direto_dono?: boolean;
  bloqueado?: boolean;
  destaque_premium?: boolean;
}

// "Áreas" do Explorar: hotéis, casas, lugares, passeios e veículos (mesmos ids do backend, App\Services\AreasExplorar).
const AREAS: { id: string; nome: string; icone: keyof typeof Ionicons.glyphMap; tipo?: 'reservas' | 'servicos' }[] = [
  { id: 'hoteis', nome: 'Hotéis', icone: 'bed-outline', tipo: 'reservas' },
  { id: 'casas', nome: 'Casas', icone: 'home-outline', tipo: 'reservas' },
  { id: 'lugares', nome: 'Lugares', icone: 'business-outline', tipo: 'reservas' },
  { id: 'passeios', nome: 'Passeios', icone: 'boat-outline' },
  { id: 'veiculos', nome: 'Veículos', icone: 'car-outline', tipo: 'reservas' },
];

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function Descubra() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [tipoAtivo, setTipoAtivo] = useState<'estabelecimentos' | 'servicos' | 'reservas'>(
    ['estabelecimentos', 'servicos', 'reservas'].includes(String(params.tipo)) ? (String(params.tipo) as 'estabelecimentos' | 'servicos' | 'reservas') : 'estabelecimentos'
  );
  const [busca, setBusca] = useState<string>(params.query ? params.query.toString() : '');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(params.categoria ? params.categoria.toString() : 'tudo');
  const [areaAtiva, setAreaAtiva] = useState<string | null>(params.area ? params.area.toString() : null);

  const [ordem, setOrdem] = useState('relevancia');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [comPromocao, setComPromocao] = useState(false);
  const [soPremium, setSoPremium] = useState(false);
  const [painelFiltros, setPainelFiltros] = useState(false);
  const [estadoAtivo, setEstadoAtivo] = useState<string>(params.estado ? params.estado.toString().toUpperCase() : '');
  const [estados, setEstados] = useState<{ uf: string; nome: string; lojas: number; servicos: number; reservas: number; total: number }[]>([]);

  const [itens, setItens] = useState<ItemExplorar[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [temPremium, setTemPremium] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cidade, setCidade] = useState('Sua localização');
  const [favoritos, setFavoritos] = useState<Record<string, Array<string | number>>>({ estabelecimentos: [], servicos: [], reservas: [] });

  // localização (opcional — habilita "Mais perto" e distância nos cards)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const [end] = await Location.reverseGeocodeAsync(pos.coords);
        if (end) setCidade(end.city || end.subregion || 'Sua localização');
      } catch {
        // segue sem localização
      }
    })();
  }, []);

  const carregarFavoritos = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/favoritos`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const json = await res.json();
      setFavoritos({
        estabelecimentos: (json.estabelecimentos || []).map((e: ItemExplorar) => e.id),
        servicos: (json.servicos || []).map((e: ItemExplorar) => e.id),
        reservas: (json.itens_aluguel || json.reservas || []).map((e: ItemExplorar) => e.id),
      });
    } catch {
      // favoritos são opcionais
    }
  }, []);

  useEffect(() => {
    carregarFavoritos();
  }, [carregarFavoritos]);

  // Cards dos 27 estados com a contagem real de lojas, serviços e reservas.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@waitless_token');
        const res = await fetch(`${API_URL}/explorar/estados`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json();
        if (res.ok && Array.isArray(json)) setEstados(json);
      } catch {
        // sem contagem, os cards ainda funcionam como filtro
      }
    })();
  }, []);

  const estadosOrdenados = useMemo(
    () => [...estados].sort((a, b) => (b.total - a.total) || a.nome.localeCompare(b.nome, 'pt-BR')),
    [estados]
  );

  const escolherEstado = (e: { uf: string; lojas: number; servicos: number; reservas: number }) => {
    if (estadoAtivo === e.uf) { setEstadoAtivo(''); return; }
    setEstadoAtivo(e.uf);
    // já abre na aba que tem resultados nesse estado
    setTipoAtivo(e.lojas > 0 ? 'estabelecimentos' : e.servicos > 0 ? 'servicos' : e.reservas > 0 ? 'reservas' : tipoAtivo);
  };

  const filtrosAtivos = useMemo(
    () => [ordem !== 'relevancia', !!precoMin, !!precoMax, comPromocao, soPremium].filter(Boolean).length,
    [ordem, precoMin, precoMax, comPromocao, soPremium]
  );

  const buscar = useCallback(
    async (paginaAlvo: number) => {
      const primeira = paginaAlvo === 1;
      primeira ? setCarregando(true) : setCarregandoMais(true);
      try {
        const token = await AsyncStorage.getItem('@waitless_token');
        if (!token) {
          router.replace('/autenticacao/login' as never);
          return;
        }

        const p: Record<string, string> = { tipo_busca: tipoAtivo, ordem, page: String(paginaAlvo), per_page: '15' };
        if (busca.trim()) p.busca = busca.trim();
        if (categoriaAtiva !== 'tudo') p.categoria = categoriaAtiva;
        if (areaAtiva) p.area = areaAtiva;
        if (estadoAtivo) p.estado = estadoAtivo;
        if (precoMin) p.preco_min = precoMin.replace(',', '.');
        if (precoMax) p.preco_max = precoMax.replace(',', '.');
        if (comPromocao) p.com_promocao = '1';
        if (soPremium) p.so_premium = '1';
        if (coords) {
          p.lat = String(coords.lat);
          p.lng = String(coords.lng);
        }

        const res = await fetch(`${API_URL}/explorar?${new URLSearchParams(p).toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const lista: ItemExplorar[] = Array.isArray(json) ? json : json.data || [];

        setItens((atual) => (primeira ? lista : [...atual, ...lista]));
        setTotal(json.total ?? lista.length);
        setPagina(json.current_page ?? paginaAlvo);
        setUltimaPagina(json.last_page ?? 1);
        setTemPremium(!!json.meta?.tem_premium);
      } catch {
        if (primeira) setItens([]);
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
      }
    },
    [tipoAtivo, busca, categoriaAtiva, areaAtiva, estadoAtivo, ordem, precoMin, precoMax, comPromocao, soPremium, coords, router]
  );

  useEffect(() => {
    const t = setTimeout(() => buscar(1), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  const favoritoDe = (item: ItemExplorar) => favoritos[tipoAtivo].includes(item.id);

  const alternarFavorito = async (item: ItemExplorar) => {
    const tipoApi = tipoAtivo === 'servicos' ? 'servico' : tipoAtivo === 'reservas' ? 'item_aluguel' : 'estabelecimento';
    const ja = favoritoDe(item);
    setFavoritos((f) => ({ ...f, [tipoAtivo]: ja ? f[tipoAtivo].filter((i) => i !== item.id) : [...f[tipoAtivo], item.id] }));
    const resultado = await alternarFavoritoRemoto(`${API_URL}/favoritos/toggle`, tipoApi as 'estabelecimento' | 'servico' | 'item_aluguel', item.id);
    if (resultado === null) {
      // não gravou: volta ao estado anterior
      setFavoritos((f) => ({ ...f, [tipoAtivo]: ja ? [...f[tipoAtivo], item.id] : f[tipoAtivo].filter((i) => i !== item.id) }));
    }
  };

  const abrir = (item: ItemExplorar) => {
    if (item.bloqueado) {
      router.push('/assinatura' as never);
      return;
    }
    if (tipoAtivo === 'estabelecimentos') {
      router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: String(item.id) } });
      return;
    }
    router.push({ pathname: '/src/screens/ExplorarDetalhes' as never, params: { id: String(item.id), tipo: tipoAtivo } });
  };

  const limpar = () => {
    setBusca('');
    setCategoriaAtiva('tudo');
    setOrdem('relevancia');
    setPrecoMin('');
    setPrecoMax('');
    setComPromocao(false);
    setSoPremium(false);
  };

  const destaques = ordem === 'relevancia' && !soPremium ? itens.filter((i) => i.destaque_premium).slice(0, 6) : [];
  const idsDestaque = new Set(destaques.map((d) => d.id));
  const lista = itens.filter((i) => !idsDestaque.has(i.id));

  // ------------------------------------------------------------------ cartões
  const Selo = ({ texto, tom }: { texto: string; tom: 'premium' | 'promo' | 'ok' | 'aviso' | 'neutro' | 'perigo' }) => {
    const c = {
      premium: [C.accentSoft, C.accent],
      promo: [C.successBg, C.success],
      ok: [C.successBg, C.success],
      aviso: [C.warningBg, C.warning],
      neutro: [C.soft, C.muted],
      perigo: [C.danger, '#fff'],
    }[tom];
    return (
      <View style={[s.selo, { backgroundColor: c[0] }]}>
        <Text style={[s.seloTxt, { color: c[1] }]}>{texto}</Text>
      </View>
    );
  };

  const Nota = ({ item }: { item: ItemExplorar }) => (
    <View style={s.nota}>
      <Ionicons name="star" size={12} color={C.star} />
      <Text style={s.notaTxt}>{Number(item.avaliacao_media || 0).toFixed(1)}</Text>
      {!!item.total_avaliacoes && <Text style={s.notaQtd}>({item.total_avaliacoes})</Text>}
    </View>
  );

  const Coracao = ({ item }: { item: ItemExplorar }) => (
    <FavoriteButton ativo={favoritoDe(item)} onPress={() => alternarFavorito(item)} style={s.coracao} />
  );

  const localizacaoTxt = (item: ItemExplorar) =>
    item.distancia != null
      ? `${item.distancia.toFixed(1)} km`
      : [item.cidade, item.estado].filter(Boolean).join(' - ');

  const precoBloco = (item: ItemExplorar) => {
    if (tipoAtivo === 'estabelecimentos') {
      return Number(item.valor) > 0 ? (
        <Text style={s.preco}><Text style={s.precoPre}>a partir de </Text>{brl(item.valor)}</Text>
      ) : (
        <Text style={s.precoPre}>Consulte os serviços</Text>
      );
    }
    return (
      <View style={s.precoLinha}>
        <Text style={s.preco}>{brl(item.valor)}</Text>
        {item.tem_promocao && Number(item.valor_original) > Number(item.valor) && <Text style={s.precoAntigo}>{brl(item.valor_original)}</Text>}
        <Text style={s.precoPre}>{tipoAtivo === 'reservas' ? '/ dia' : item.duracao_minutos ? `· ${item.duracao_minutos} min` : ''}</Text>
      </View>
    );
  };

  const subtitulo = (item: ItemExplorar) => {
    if (tipoAtivo === 'estabelecimentos') return item.ramo_atuacao || 'Estabelecimento';
    const base = item.nome_local || item.ramo_atuacao || '';
    return tipoAtivo === 'reservas' && item.modelo ? `${base} · ${item.modelo}` : base;
  };

  const rotuloTipo = tipoAtivo === 'servicos' ? 'Serviço' : tipoAtivo === 'reservas' ? 'Reserva' : 'Local';
  // Cada tipo de resultado com sua própria cor na etiqueta da foto, em vez de todas na mesma cor.
  const corTipoTag = tipoAtivo === 'servicos' ? '#2563EB' : tipoAtivo === 'reservas' ? '#DC2626' : T.ink;

  const renderCartao = (item: ItemExplorar) => (
    <TouchableOpacity key={`${tipoAtivo}-${item.id}`} style={s.cartao} onPress={() => abrir(item)} activeOpacity={0.93}>
      <View style={s.cartaoFoto}>
        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/600x300' }} style={[s.cartaoImg, item.bloqueado && { opacity: 0.4 }]} contentFit="cover" />
        <View style={[s.tipoTag, { backgroundColor: corTipoTag }]}><Text style={s.tipoTagTxt}>{item.destaque_premium ? `${rotuloTipo} · Premium` : rotuloTipo}</Text></View>
        <Coracao item={item} />
        {item.bloqueado && (
          <View style={s.bloqueio}><Ionicons name="lock-closed" size={20} color="#fff" /></View>
        )}
      </View>

      <View style={s.cartaoInfo}>
        <View style={s.cartaoTopo}>
          <Text style={s.cartaoNome} numberOfLines={1}>{item.nome}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {!!localizacaoTxt(item) && <Text style={s.metaDir}>{localizacaoTxt(item)}</Text>}
            {tipoAtivo === 'servicos' && !!item.duracao_minutos && <Text style={s.metaDir}>{item.duracao_minutos} min</Text>}
          </View>
        </View>
        <Text style={s.cartaoSub} numberOfLines={1}>{subtitulo(item)}</Text>

        <View style={s.linhaMeta}><Nota item={item} /></View>

        <View style={s.selos}>
          {item.bloqueado && <Selo texto="Exclusivo premium" tom="premium" />}
          {item.desconto_label ? <Selo texto={item.desconto_label} tom="promo" /> : item.tem_promocao ? <Selo texto="Promoção" tom="promo" /> : null}
          {tipoAtivo === 'estabelecimentos' && (item.fila_atual ? <Selo texto={`${item.fila_atual} na fila`} tom="aviso" /> : <Selo texto="Sem espera" tom="ok" />)}
          {tipoAtivo === 'estabelecimentos' && !!item.total_servicos && <Selo texto={`${item.total_servicos} serviços`} tom="neutro" />}
          {item.aceita_pontos && <Selo texto="Aceita pontos" tom="neutro" />}
          {tipoAtivo === 'reservas' && item.direto_dono && <Selo texto="Direto com o dono" tom="neutro" />}
          {item.vagas_status === 'esgotado' && <Selo texto="Esgotado hoje" tom="perigo" />}
          {item.vagas_status === 'poucas_vagas' && <Selo texto={`Últimas vagas${item.vagas_restantes ? ` (${item.vagas_restantes})` : ''}`} tom="aviso" />}
        </View>

        <View style={s.cartaoRodape}>
          <View>
            <Text style={s.precoPre}>{item.tem_promocao ? 'Por apenas' : tipoAtivo === 'reservas' ? 'Diária' : 'A partir de'}</Text>
            {tipoAtivo === 'estabelecimentos' && !(Number(item.valor) > 0) ? (
              <Text style={s.precoPre}>Consulte os serviços</Text>
            ) : (
              <View style={s.precoLinha}>
                <Text style={s.preco}>{brl(item.valor)}</Text>
                {item.tem_promocao && Number(item.valor_original) > Number(item.valor) && <Text style={s.precoAntigo}>{brl(item.valor_original)}</Text>}
              </View>
            )}
          </View>
          <View style={s.online}>
            <Ionicons name="calendar-outline" size={13} color={C.success} />
            <Text style={s.onlineTxt}>{tipoAtivo === 'reservas' ? 'Reserva online' : 'Agendamento online'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const larguraDestaque = width * 0.72;

  return (
    <SafeAreaView style={s.safe}>
      {/* CABEÇALHO */}
      <HeaderCliente titulo="Explorar">
        <View style={s.local}>
          <Ionicons name="location-sharp" size={14} color={C.accent} />
          <Text style={s.localTxt} numberOfLines={1}>{cidade}</Text>
          <Ionicons name="chevron-down" size={13} color={C.muted} />
        </View>
      </HeaderCliente>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* BUSCA + FILTROS */}
        <View style={s.buscaLinha}>
          <View style={s.busca}>
            <Ionicons name="search" size={18} color={C.faint} />
            <TextInput
              style={s.buscaInput}
              placeholder="Buscar serviços, locais, reservas..."
              placeholderTextColor={C.faint}
              value={busca}
              onChangeText={setBusca}
              returnKeyType="search"
            />
            {!!busca && (
              <TouchableOpacity onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={18} color={C.faint} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[s.filtroBtn, filtrosAtivos > 0 && s.filtroBtnOn]} onPress={() => setPainelFiltros(true)} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={18} color={filtrosAtivos > 0 ? '#fff' : C.ink} />
            <Text style={[s.filtroBtnTxt, filtrosAtivos > 0 && { color: '#fff' }]}>Filtros</Text>
            {filtrosAtivos > 0 && <View style={s.filtroBadge}><Text style={s.filtroBadgeTxt}>{filtrosAtivos}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* TIPO + ATALHOS DE FILTRO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.atalhos}>
          {TIPOS.map((t) => {
            const on = tipoAtivo === t.value;
            return (
              <TouchableOpacity key={t.value} style={[s.chip, on && s.chipAtivo]} onPress={() => setTipoAtivo(t.value)} activeOpacity={0.85}>
                <Ionicons name={t.icone as never} size={15} color={on ? '#fff' : C.ink} />
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={s.divisor} />
          <TouchableOpacity style={[s.chip, ordem === 'relevancia' && s.chipSuave]} onPress={() => setOrdem('relevancia')} activeOpacity={0.8}>
            <Text style={[s.chipTxt, ordem === 'relevancia' && { color: C.accent }]}>Mais relevantes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, comPromocao && s.chipAtivo]} onPress={() => setComPromocao(!comPromocao)} activeOpacity={0.8}>
            <Text style={[s.chipTxt, comPromocao && s.chipTxtOn]}>Promoções</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, soPremium && s.chipAtivo]} onPress={() => setSoPremium(!soPremium)} activeOpacity={0.8}>
            <Text style={[s.chipTxt, soPremium && s.chipTxtOn]}>Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, ordem === 'avaliacao' && s.chipAtivo]} onPress={() => setOrdem(ordem === 'avaliacao' ? 'relevancia' : 'avaliacao')} activeOpacity={0.8}>
            <Text style={[s.chipTxt, ordem === 'avaliacao' && s.chipTxtOn]}>Nota</Text>
            <Ionicons name="chevron-down" size={12} color={ordem === 'avaliacao' ? '#fff' : C.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, (ordem === 'preco_asc' || ordem === 'preco_desc') && s.chipAtivo]} onPress={() => setOrdem(ordem === 'preco_asc' ? 'preco_desc' : 'preco_asc')} activeOpacity={0.8}>
            <Text style={[s.chipTxt, (ordem === 'preco_asc' || ordem === 'preco_desc') && s.chipTxtOn]}>Preço</Text>
            <Ionicons name="chevron-down" size={12} color={(ordem === 'preco_asc' || ordem === 'preco_desc') ? '#fff' : C.muted} />
          </TouchableOpacity>
          {!!coords && (
            <TouchableOpacity style={[s.chip, ordem === 'distancia' && s.chipAtivo]} onPress={() => setOrdem(ordem === 'distancia' ? 'relevancia' : 'distancia')} activeOpacity={0.8}>
              <Text style={[s.chipTxt, ordem === 'distancia' && s.chipTxtOn]}>Distância</Text>
              <Ionicons name="chevron-down" size={12} color={ordem === 'distancia' ? '#fff' : C.muted} />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ÁREAS: hotéis, casas, lugares, passeios, veículos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingTop: 6, paddingBottom: 4 }}>
          {AREAS.map((a) => {
            const on = areaAtiva === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }, on && { backgroundColor: C.accent, borderColor: C.accent }]}
                onPress={() => {
                  setAreaAtiva(on ? null : a.id);
                  if (!on && a.tipo) setTipoAtivo(a.tipo);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name={a.icone} size={18} color={on ? '#fff' : C.ink} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : C.ink }}>{a.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* EXPLORE POR ESTADO (contagem real do sistema) */}
        {estadosOrdenados.length > 0 && (
          <>
            <View style={s.estadosTopo}>
              <Text style={s.estadosTitulo}>Explore por estado</Text>
              {!!estadoAtivo && (
                <TouchableOpacity onPress={() => setEstadoAtivo('')}><Text style={s.estadosLimpar}>Ver todos</Text></TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.estadosLista}>
              {estadosOrdenados.map((e) => {
                const on = estadoAtivo === e.uf;
                return (
                  <TouchableOpacity key={e.uf} style={[s.estadoCard, on && s.estadoCardOn, e.total === 0 && !on && { opacity: 0.55 }]} onPress={() => escolherEstado(e)} activeOpacity={0.85}>
                    <View style={[s.estadoSigla, on && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                      <Text style={[s.estadoSiglaTxt, on && { color: '#fff' }]}>{e.uf}</Text>
                    </View>
                    <Text style={[s.estadoNome, on && { color: '#fff' }]} numberOfLines={1}>{e.nome}</Text>
                    <Text style={[s.estadoQtd, on && { color: 'rgba(255,255,255,0.85)' }]}>
                      {e.lojas} {e.lojas === 1 ? 'loja' : 'lojas'} · {e.servicos} serv. · {e.reservas} res.
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* CATEGORIAS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categorias}>
          {CATEGORIAS.map((cat) => {
            const on = categoriaAtiva === cat.slug;
            return (
              <TouchableOpacity key={cat.slug} style={s.categoria} onPress={() => setCategoriaAtiva(cat.slug)} activeOpacity={0.8}>
                <View style={[s.categoriaIcone, { backgroundColor: on ? cat.cor : `${cat.cor}1F` }]}>
                  <MaterialIcons name={cat.icone} size={24} color={on ? '#fff' : cat.cor} />
                </View>
                <Text style={[s.categoriaTxt, on && { color: cat.cor, fontWeight: '700' }]}>{cat.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* RESULTADOS */}
        {carregando ? (
          <View style={s.centro}>
            <ActivityIndicator size="large" color={C.ink} />
          </View>
        ) : itens.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="search-outline" size={28} color={C.faint} /></View>
            <Text style={s.vazioTitulo}>Nada encontrado</Text>
            <Text style={s.vazioTxt}>Não há resultados para esta busca. Tente outros filtros ou outra categoria.</Text>
            <TouchableOpacity style={s.vazioBtn} onPress={limpar} activeOpacity={0.85}>
              <Text style={s.vazioBtnTxt}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {destaques.length > 0 && (
              <View style={s.secao}>
                <View style={s.secaoTopo}>
                  <Text style={s.secaoTitulo}>Destaques premium</Text>
                  <View style={s.secaoPilula}><Ionicons name="star" size={11} color={C.accent} /><Text style={s.secaoPilulaTxt}>Recomendados</Text></View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                  {destaques.map((item) => (
                    <TouchableOpacity key={`d-${item.id}`} style={[s.destaque, { width: larguraDestaque }]} onPress={() => abrir(item)} activeOpacity={0.92}>
                      <View style={s.destaqueFoto}>
                        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/400x300' }} style={s.destaqueImg} contentFit="cover" />
                        <Coracao item={item} />
                        {item.desconto_label ? <View style={s.destaqueSelo}><Selo texto={item.desconto_label} tom="promo" /></View> : null}
                      </View>
                      <View style={{ padding: 12 }}>
                        {item.vagas_status && (
                          <View style={{ marginBottom: 4 }}>
                            <Selo texto={item.vagas_status === 'esgotado' ? 'Esgotado hoje' : 'Últimas vagas'} tom={item.vagas_status === 'esgotado' ? 'perigo' : 'aviso'} />
                          </View>
                        )}
                        <Text style={s.cartaoNome} numberOfLines={1}>{item.nome}</Text>
                        <Text style={s.cartaoSub} numberOfLines={1}>{subtitulo(item)}</Text>
                        <View style={[s.linhaMeta, { marginTop: 8 }]}>
                          <Nota item={item} />
                          {!!localizacaoTxt(item) && <Text style={s.metaTxt} numberOfLines={1}>{localizacaoTxt(item)}</Text>}
                        </View>
                        <View style={{ marginTop: 8 }}>{precoBloco(item)}</View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={[s.secao, { paddingHorizontal: 20 }]}>
              <View style={s.secaoTopo2}>
                <Text style={s.secaoTitulo}>{temPremium && ordem === 'relevancia' ? 'Para você' : 'Resultados'}</Text>
                <Text style={s.contagem}>{total} {total === 1 ? 'resultado' : 'resultados'}</Text>
              </View>
              {lista.map(renderCartao)}

              {pagina < ultimaPagina && (
                <TouchableOpacity style={s.maisBtn} onPress={() => buscar(pagina + 1)} disabled={carregandoMais} activeOpacity={0.85}>
                  {carregandoMais ? <ActivityIndicator color={C.ink} /> : <Text style={s.maisBtnTxt}>Carregar mais</Text>}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* PAINEL DE FILTROS */}
      <Modal visible={painelFiltros} transparent animationType="slide" onRequestClose={() => setPainelFiltros(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPainelFiltros(false)} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <View style={s.sheetTopo}>
              <Text style={s.sheetTitulo}>Filtros</Text>
              <TouchableOpacity onPress={limpar}><Text style={s.sheetLimpar}>Limpar</Text></TouchableOpacity>
            </View>

            <Text style={s.sheetRotulo}>Ordenar por</Text>
            <View style={s.sheetChips}>
              {ORDENS.filter((o) => o.value !== 'distancia' || coords).map((o) => (
                <TouchableOpacity key={o.value} style={[s.chip, ordem === o.value && s.chipOn]} onPress={() => setOrdem(o.value)} activeOpacity={0.8}>
                  <Text style={[s.chipTxt, ordem === o.value && s.chipTxtOn]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sheetRotulo}>Faixa de preço (R$)</Text>
            <View style={s.precoInputs}>
              <TextInput style={s.precoInput} placeholder="Mínimo" placeholderTextColor={C.faint} keyboardType="numeric" value={precoMin} onChangeText={setPrecoMin} />
              <Text style={{ color: C.faint }}>até</Text>
              <TextInput style={s.precoInput} placeholder="Máximo" placeholderTextColor={C.faint} keyboardType="numeric" value={precoMax} onChangeText={setPrecoMax} />
            </View>

            <View style={s.switchLinha}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchTitulo}>Somente promoções</Text>
                <Text style={s.switchSub}>Itens e locais com desconto ativo</Text>
              </View>
              <Switch value={comPromocao} onValueChange={setComPromocao} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
            </View>
            <View style={s.switchLinha}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchTitulo}>Somente donos premium</Text>
                <Text style={s.switchSub}>Anunciantes verificados com plano premium</Text>
              </View>
              <Switch value={soPremium} onValueChange={setSoPremium} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
            </View>

            <TouchableOpacity style={s.aplicar} onPress={() => setPainelFiltros(false)} activeOpacity={0.85}>
              <Text style={s.aplicarTxt}>Ver resultados</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  estadosTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14, marginBottom: 8 },
  estadosTitulo: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  estadosLimpar: { fontSize: 13, fontWeight: '700', color: T.primary },
  estadosLista: { paddingHorizontal: 20, gap: 10, paddingBottom: 6 },
  estadoCard: { width: 150, backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  estadoCardOn: { backgroundColor: T.primary, borderColor: T.primary },
  estadoSigla: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  estadoSiglaTxt: { fontSize: 14, fontWeight: '900', color: T.primary },
  estadoNome: { fontSize: 14, fontWeight: '800', color: T.ink },
  estadoQtd: { fontSize: 11, color: T.muted, marginTop: 3 },
  safe: { flex: 1, backgroundColor: C.canvas, paddingTop: Platform.OS === 'android' ? 30 : 0 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  titulo: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  iconeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },

  divisor: { width: 1, height: 22, backgroundColor: C.line, alignSelf: 'center', marginHorizontal: 2 },
  chipSuave: { backgroundColor: C.accentSoft, borderColor: '#F8D9C8' },
  chipAtivo: { backgroundColor: C.accent, borderColor: C.accent },
  local: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  localTxt: { fontSize: 13, fontWeight: '600', color: C.ink, maxWidth: 220 },
  filtroBtnTxt: { fontSize: 13, fontWeight: '700', color: C.ink },
  buscaLinha: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  busca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14, height: 52 },
  buscaInput: { flex: 1, fontSize: 15, color: C.ink },
  filtroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 52, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  filtroBtnOn: { backgroundColor: C.accent, borderColor: C.accent },
  filtroBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.canvas },
  filtroBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  tipos: { flexDirection: 'row', backgroundColor: C.soft, marginHorizontal: 20, borderRadius: 16, padding: 4, marginBottom: 12 },
  tipo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  tipoOn: { backgroundColor: C.ink },
  tipoTxt: { fontSize: 14, fontWeight: '600', color: C.muted },
  tipoTxtOn: { color: '#fff', fontWeight: '700' },

  atalhos: { paddingHorizontal: 20, gap: 8, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink },
  chipTxtOn: { color: '#fff' },

  categorias: { paddingHorizontal: 20, gap: 16, paddingVertical: 14 },
  categoria: { alignItems: 'center', width: 66 },
  categoriaIcone: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  categoriaIconeOn: { backgroundColor: C.accent, borderColor: C.accent },
  categoriaTxt: { fontSize: 11, fontWeight: '600', color: C.muted, textAlign: 'center' },
  categoriaTxtOn: { color: C.ink, fontWeight: '700' },

  centro: { paddingVertical: 80, alignItems: 'center' },
  vazio: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 36 },
  vazioIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 18, fontWeight: '800', color: C.ink },
  vazioTxt: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  vazioBtn: { marginTop: 18, backgroundColor: C.accent, paddingHorizontal: 22, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  vazioBtnTxt: { color: '#fff', fontWeight: '700' },

  secao: { marginTop: 8, marginBottom: 12 },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  secaoTopo2: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  secaoTitulo: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  secaoPilula: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  secaoPilulaTxt: { fontSize: 11, fontWeight: '700', color: C.accent },
  contagem: { fontSize: 13, color: C.muted, fontWeight: '500' },

  destaque: { backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  destaqueFoto: { height: 150, position: 'relative' },
  destaqueImg: { width: '100%', height: '100%', backgroundColor: C.soft },
  destaqueSelo: { position: 'absolute', bottom: 10, left: 10 },

  cartao: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, marginBottom: 16, overflow: 'hidden', shadowColor: '#7C2D12', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cartaoFoto: { height: 158, backgroundColor: C.soft },
  cartaoImg: { width: '100%', height: '100%' },
  tipoTag: { position: 'absolute', top: 12, left: 12, backgroundColor: T.tag, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  tipoTagTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  bloqueio: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,26,23,0.3)' },
  cartaoInfo: { padding: 14 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cartaoNome: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  cartaoSub: { fontSize: 13, color: C.muted, marginTop: 3 },
  metaDir: { fontSize: 12, color: C.muted, fontWeight: '500' },
  coracao: { position: 'absolute', top: 12, right: 12 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  notaTxt: { fontSize: 13, fontWeight: '700', color: C.ink },
  notaQtd: { fontSize: 12, color: C.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaTxt: { fontSize: 12, color: C.muted, flexShrink: 1 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  selo: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  seloTxt: { fontSize: 11, fontWeight: '700' },
  cartaoRodape: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  precoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  preco: { fontSize: 20, fontWeight: '800', color: T.primary, letterSpacing: -0.4 },
  precoPre: { fontSize: 11, fontWeight: '500', color: C.muted },
  precoAntigo: { fontSize: 12, color: C.faint, textDecorationLine: 'line-through' },
  online: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineTxt: { fontSize: 12, fontWeight: '600', color: C.success },

  maisBtn: { height: 50, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  maisBtnTxt: { fontSize: 14, fontWeight: '700', color: C.ink },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 },
  sheetTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitulo: { fontSize: 22, fontWeight: '800', color: C.ink },
  sheetLimpar: { fontSize: 14, fontWeight: '700', color: C.muted },
  sheetRotulo: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 10 },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  precoInputs: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  precoInput: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: '#F5F5F5', paddingHorizontal: 14, fontSize: 15, color: C.ink },
  switchLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.soft },
  switchTitulo: { fontSize: 15, fontWeight: '600', color: C.ink },
  switchSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  aplicar: { height: 52, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  aplicarTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
