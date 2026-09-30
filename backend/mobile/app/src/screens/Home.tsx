import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  RefreshControl,
  useWindowDimensions,
  Modal,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { T } from '../../../constants/ClientTheme';
import { FavoriteButton, HeaderCliente } from '../../../components/client/ui';
import { alternarFavoritoRemoto } from '../../../services/favoritos';

// Planos de cliente considerados Premium (mesmo catálogo usado no backend,
// em App\Services\PlanoService::PLANOS_PREMIUM['user']).
const PLANOS_PREMIUM_CLIENTE = ['premium', 'premium-plus', 'premium_plus', 'pro'];

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
// O .env local já define EXPO_PUBLIC_API_URL terminando em "/mobile" — removemos
// esse sufixo antes de recompor as URLs para não gerar ".../api/mobile/mobile".
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const BANNER = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Ícone padrão para quando o backend devolve um ramo_atuacao sem mapeamento local
const ICONE_PADRAO: MaterialIconName = 'storefront';

// Cobre os ramos de atuação reais cadastráveis (mesma lista do formulário de
// criação de estabelecimento) — antes só ~14 palavras-chave existiam e a
// maioria dos ramos reais (locadoras, esportes, clínicas...) caía no ícone e
// na cor genéricos, dando a impressão de que só "Beleza" tinha destaque e o
// resto ficava tudo cinza/preto.
const ICONES_CATEGORIA: Record<string, MaterialIconName> = {
  barbearia: 'content-cut',
  beleza: 'content-cut',
  clinica: 'local-hospital',
  odont: 'medical-services',
  restaurante: 'restaurant',
  lanchonete: 'fastfood',
  oficina: 'car-repair',
  'pet shop': 'pets',
  pet: 'pets',
  estetica: 'face',
  spa: 'spa',
  locadora: 'directions-car',
  motocicletas: 'two-wheeler',
  quadriciclos: 'two-wheeler',
  complexo: 'sports',
  'beach tennis': 'sports-tennis',
  pilates: 'self-improvement',
  academia: 'fitness-center',
  futebol: 'sports-soccer',
  futsal: 'sports-soccer',
  tenis: 'sports-tennis',
  squash: 'sports-tennis',
  marciais: 'sports-martial-arts',
  skate: 'skateboarding',
  radicais: 'skateboarding',
  esportivos: 'sports-basketball',
  esportivo: 'sports-basketball',
  clube: 'groups',
  recreativo: 'groups',
  // Mantidos por compatibilidade com dados antigos/digitados fora da lista oficial
  automotivo: 'directions-car',
  veiculos: 'two-wheeler',
  flats: 'hotel',
  hospedagem: 'hotel',
  casa: 'cleaning-services',
  eventos: 'event',
  saude: 'local-hospital',
  equipamentos: 'build',
};

// Uma cor por palavra-chave — cada categoria "avisa" sua emoção (beleza em rosa, saúde em azul de
// confiança, eventos em roxo...) em vez de tudo virar cinza/preto quando não há correspondência.
const CORES_CATEGORIA: Record<string, string> = {
  barbearia: '#1F6F8B',
  beleza: '#E8467C',
  clinica: '#2563EB',
  odont: '#0EA5E9',
  restaurante: '#DC2626',
  lanchonete: '#EA580C',
  oficina: '#4F46E5',
  'pet shop': '#D97706',
  pet: '#D97706',
  estetica: '#DB2777',
  spa: '#C026D3',
  locadora: '#4338CA',
  motocicletas: '#4338CA',
  quadriciclos: '#4338CA',
  complexo: '#16A34A',
  'beach tennis': '#16A34A',
  pilates: '#0D9488',
  academia: '#EA580C',
  futebol: '#16A34A',
  futsal: '#16A34A',
  tenis: '#16A34A',
  squash: '#16A34A',
  marciais: '#B91C1C',
  skate: '#7C3AED',
  radicais: '#7C3AED',
  esportivos: '#16A34A',
  esportivo: '#16A34A',
  clube: '#7C3AED',
  recreativo: '#7C3AED',
  automotivo: '#4F46E5',
  veiculos: '#4338CA',
  flats: '#0284C7',
  hospedagem: '#0284C7',
  casa: '#0EA5A4',
  eventos: '#9333EA',
  saude: '#2563EB',
  equipamentos: '#475569',
};
// Fallback só pra ramo digitado fora da lista oficial ("Outros" etc.) — mesmo
// assim usa a cor da marca em vez de um cinza sem graça.
const COR_PADRAO = T.primary;

function normalizarNomeCategoria(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// `ramo_atuacao` é texto livre digitado pelo próprio lojista (ex.: "Salão de beleza e estética"),
// então a busca é por palavra-chave CONTIDA no nome, não por igualdade exata — antes disso quase
// nenhuma categoria real batia com o dicionário e tudo caía no ícone genérico.
function resolverIconeCategoria(nome: string): MaterialIconName {
  const chave = normalizarNomeCategoria(nome);
  const encontrada = Object.keys(ICONES_CATEGORIA).find((k) => chave.includes(k));
  return (encontrada && ICONES_CATEGORIA[encontrada]) || ICONE_PADRAO;
}

function resolverCorCategoria(nome: string): string {
  const chave = normalizarNomeCategoria(nome);
  const encontrada = Object.keys(CORES_CATEGORIA).find((k) => chave.includes(k));
  return (encontrada && CORES_CATEGORIA[encontrada]) || COR_PADRAO;
}

interface Categoria {
  nome: string;
  total: number;
}

interface EstabelecimentoProximo {
  id: number;
  nome: string;
  ramo_atuacao?: string | null;
  foto_perfil?: string | null;
  avaliacao_media?: number;
  total_avaliacoes?: number;
  cidade?: string | null;
  estado?: string | null;
  distancia?: number | null;
  fila_atual?: number;
  valor?: number | null;
  total_servicos?: number;
  tem_promocao?: boolean;
  destaque_premium?: boolean;
}

interface ItemHome {
  id: number;
  nome: string;
  foto_perfil?: string | null;
  nome_local?: string | null;
  ramo_atuacao?: string | null;
  categoria?: string | null;
  direto_dono?: boolean;
  cidade?: string;
  valor?: number | string;
  valor_original?: number | string;
  tem_promocao?: boolean;
  desconto_label?: string | null;
  avaliacao_media?: number | string;
  total_avaliacoes?: number;
  duracao_minutos?: number | string | null;
  aceita_pontos?: boolean;
  bloqueado?: boolean;
  destaque_premium?: boolean;
  distancia?: number | null;
  vagas_status?: 'esgotado' | 'poucas_vagas' | null;
  vagas_restantes?: number | null;
}

/** Selo "Poucas vagas hoje" / "Esgotado hoje" — mostrado nos cards conforme o serviço/reserva vai lotando. */
function SeloVagas({ item }: { item: ItemHome }) {
  if (!item.vagas_status) return null;
  const esgotado = item.vagas_status === 'esgotado';
  return (
    <View style={[s.seloVagas, esgotado ? s.seloVagasEsgotado : s.seloVagasPoucas]}>
      <Ionicons name={esgotado ? 'close-circle' : 'flame'} size={11} color={esgotado ? '#fff' : '#92400E'} />
      <Text style={[s.seloVagasTxt, esgotado && { color: '#fff' }]}>
        {esgotado ? 'Esgotado hoje' : `Últimas vagas hoje${item.vagas_restantes ? ` (${item.vagas_restantes})` : ''}`}
      </Text>
    </View>
  );
}

interface AreaExplorar { id: string; rotulo: string; icone: string; total: number; na_cidade: number | null }
type Escopo = { local: boolean; semResultados: boolean };

type Filtros = {
  area: string | null;
  categoria: string | null;
  ordem: 'relevancia' | 'preco_asc' | 'preco_desc' | 'avaliacao' | 'distancia';
  precoMax: number | null;
  notaMin: number | null;
  promocao: boolean;
  premium: boolean;
  semEspera: boolean;
  todoSistema: boolean;
};

const FILTROS_PADRAO: Filtros = { area: null, categoria: null, ordem: 'relevancia', precoMax: null, notaMin: null, promocao: false, premium: false, semEspera: false, todoSistema: false };

const ORDENS: { id: Filtros['ordem']; rotulo: string }[] = [
  { id: 'relevancia', rotulo: 'Relevância' },
  { id: 'preco_asc', rotulo: 'Menor preço' },
  { id: 'preco_desc', rotulo: 'Maior preço' },
  { id: 'avaliacao', rotulo: 'Melhor avaliados' },
  { id: 'distancia', rotulo: 'Mais perto' },
];
const FAIXAS_PRECO: (number | null)[] = [null, 50, 100, 200, 500];
const NOTAS: (number | null)[] = [null, 4, 4.5];

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const nota = (v: unknown) => Number(v || 0).toFixed(1).replace('.', ',');

interface AgendamentoAtivo {
  id: number;
  status: string;
  status_pagamento?: string;
  data_agendamento?: string;
  hora_agendamento?: string;
  servico?: { nome?: string };
  itemAluguel?: { nome?: string };
  estabelecimento?: { nome?: string; foto_perfil?: string };
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [carregandoListas, setCarregandoListas] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

  const [busca, setBusca] = useState('');
  const [buscaEfetiva, setBuscaEfetiva] = useState('');
  const [localizacaoTexto, setLocalizacaoTexto] = useState('Ativar localização');
  const [cidadeAtual, setCidadeAtual] = useState<string | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [localizacaoPronta, setLocalizacaoPronta] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [areas, setAreas] = useState<AreaExplorar[]>([]);
  const [proximos, setProximos] = useState<EstabelecimentoProximo[]>([]);
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [favoritosServ, setFavoritosServ] = useState<number[]>([]);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState<AgendamentoAtivo | null>(null);
  const [pendentesPagamento, setPendentesPagamento] = useState<AgendamentoAtivo[]>([]);
  const [servicos, setServicos] = useState<ItemHome[]>([]);
  const [servicosTemPremium, setServicosTemPremium] = useState(false);
  const [reservasItens, setReservasItens] = useState<ItemHome[]>([]);
  const [escopos, setEscopos] = useState<{ servicos: Escopo; locais: Escopo; reservas: Escopo }>({
    servicos: { local: false, semResultados: false }, locais: { local: false, semResultados: false }, reservas: { local: false, semResultados: false },
  });
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [modalFiltros, setModalFiltros] = useState(false);
  const [rascunho, setRascunho] = useState<Filtros>(FILTROS_PADRAO);
  const [pontos, setPontos] = useState(0);
  const requisicao = useRef(0);

  const carregarUsuario = useCallback(async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        setIsPremium(PLANOS_PREMIUM_CLIENTE.includes(String(usuario.plano_assinatura || '').toLowerCase()));
      }
    } catch (e) {
      // segue sem dados, não é crítico
    }
  }, []);

  const obterLocalizacao = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: posicao.coords.latitude, lng: posicao.coords.longitude };
      setCoordenadas(coords);

      const [endereco] = await Location.reverseGeocodeAsync(posicao.coords);
      if (endereco) {
        const cidade = endereco.city || endereco.subregion || null;
        setCidadeAtual(cidade);
        setLocalizacaoTexto(cidade || endereco.region || 'Sua localização');
      }

      return coords;
    } catch (e) {
      return null;
    } finally {
      setLocalizacaoPronta(true);
    }
  }, []);

  const carregarBase = useCallback(async () => {
    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      const [resCategorias, resFavoritos, resAgendamentos, resPontos] = await Promise.all([
        fetch(`${cleanBaseUrl}/explorar/categorias`, { headers }),
        fetch(`${API_URL}/favoritos`, { headers }),
        fetch(`${API_URL}/meus-agendamentos`, { headers }),
        fetch(`${API_URL}/meus-pontos`, { headers }),
      ]);

      const jsonPontos = await resPontos.json().catch(() => null);
      setPontos(Number(jsonPontos?.pontos_saldo || 0));

      const jsonCategorias = await resCategorias.json().catch(() => null);
      setCategorias(Array.isArray(jsonCategorias?.data) ? jsonCategorias.data : []);

      const jsonFavoritos = await resFavoritos.json().catch(() => null);
      setFavoritos(Array.isArray(jsonFavoritos?.estabelecimentos) ? jsonFavoritos.estabelecimentos.map((e: { id: number }) => e.id) : []);
      setFavoritosServ(Array.isArray(jsonFavoritos?.servicos) ? jsonFavoritos.servicos.map((e: { id: number }) => e.id) : []);

      const jsonAgendamentos = await resAgendamentos.json().catch(() => null);
      const lista: AgendamentoAtivo[] = Array.isArray(jsonAgendamentos?.data) ? jsonAgendamentos.data : [];
      setAgendamentoAtivo(lista.find((a) => ['pendente', 'confirmado'].includes(a.status)) || null);
      setPendentesPagamento(lista.filter((a) => a.status === 'aguardando_pagamento' && a.status_pagamento === 'pendente'));
    } catch (e) {
      // mantém o que já estava carregado; a UI trata listas vazias
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  const carregarListas = useCallback(async () => {
    const minhaVez = ++requisicao.current;
    setCarregandoListas(true);

    try {
      const token = await pegarToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const usarCidade = !!cidadeAtual && !filtros.todoSistema;

      const params = (tipo: string) => {
        const q: Record<string, string> = { tipo_busca: tipo, per_page: '12', ordem: filtros.ordem };
        if (buscaEfetiva) q.busca = buscaEfetiva;
        if (filtros.area) q.area = filtros.area;
        if (filtros.categoria) q.categoria = filtros.categoria;
        if (filtros.precoMax) q.preco_max = String(filtros.precoMax);
        if (filtros.notaMin) q.nota_min = String(filtros.notaMin);
        if (filtros.promocao) q.com_promocao = '1';
        if (filtros.premium) q.so_premium = '1';
        if (filtros.semEspera && tipo === 'estabelecimentos') q.sem_espera = '1';
        if (coordenadas) { q.lat = String(coordenadas.lat); q.lng = String(coordenadas.lng); }
        if (usarCidade) { q.cidade = cidadeAtual as string; q.fallback_geral = '1'; }
        return new URLSearchParams(q).toString();
      };

      const [rs, rl, rr, ra] = await Promise.all([
        fetch(`${API_URL}/explorar?${params('servicos')}`, { headers }),
        fetch(`${API_URL}/explorar?${params('estabelecimentos')}`, { headers }),
        fetch(`${API_URL}/explorar?${params('reservas')}`, { headers }),
        fetch(`${API_URL}/explorar/areas${usarCidade ? `?cidade=${encodeURIComponent(cidadeAtual as string)}` : ''}`, { headers }),
      ]);
      const [js, jl, jr, ja] = await Promise.all([rs, rl, rr, ra].map((r) => r.json().catch(() => null)));
      if (minhaVez !== requisicao.current) return; 

      const escopoDe = (j: any): Escopo => ({ local: j?.meta?.escopo === 'local', semResultados: !!j?.meta?.sem_resultados_na_cidade });

      setServicos(Array.isArray(js?.data) ? js.data : []);
      setServicosTemPremium(!!js?.meta?.tem_premium);
      setProximos(Array.isArray(jl?.data) ? jl.data : []);
      setReservasItens(Array.isArray(jr?.data) ? jr.data : []);
      setAreas(Array.isArray(ja?.data) ? ja.data : []);
      setEscopos({ servicos: escopoDe(js), locais: escopoDe(jl), reservas: escopoDe(jr) });
    } catch (e) {
      // mantém as listas atuais
    } finally {
      if (minhaVez === requisicao.current) setCarregandoListas(false);
    }
  }, [buscaEfetiva, filtros, cidadeAtual, coordenadas]);

  useEffect(() => {
    (async () => {
      await carregarUsuario();
      await obterLocalizacao();
      await carregarBase();
    })();
  }, []);

  useEffect(() => {
    if (!localizacaoPronta) return;
    carregarListas();
  }, [localizacaoPronta, carregarListas]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaEfetiva(busca.trim()), 450);
    return () => clearTimeout(t);
  }, [busca]);

  useFocusEffect(
    useCallback(() => {
      carregarUsuario();
    }, [carregarUsuario])
  );

  const aoAtualizar = () => {
    setAtualizando(true);
    carregarBase();
    carregarListas();
  };

  const alternarFavorito = async (tipo: 'estabelecimento' | 'servico', id: number) => {
    const setter = tipo === 'servico' ? setFavoritosServ : setFavoritos;
    setter((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    const resultado = await alternarFavoritoRemoto(`${API_URL}/favoritos/toggle`, tipo, id);
    if (resultado === null) setter((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const atualizarFiltro = (parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial }));
  const limparTudo = () => { setFiltros(FILTROS_PADRAO); setBusca(''); setBuscaEfetiva(''); };
  const totalFiltros = [
    filtros.area, filtros.categoria, filtros.precoMax, filtros.notaMin, filtros.promocao || null, filtros.premium || null,
    filtros.semEspera || null, filtros.todoSistema || null, filtros.ordem !== 'relevancia' ? filtros.ordem : null,
  ].filter(Boolean).length;
  const emBusca = !!buscaEfetiva || totalFiltros > 0;

  const abrirFiltros = () => { setRascunho(filtros); setModalFiltros(true); };
  const aplicarRascunho = () => { setFiltros(rascunho); setModalFiltros(false); };

  const abrirEstabelecimento = (id: number) => {
    router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: id.toString() } });
  };

  const abrirItem = (item: ItemHome, tipo: 'servicos' | 'reservas') => {
    if (item.bloqueado) {
      router.push('/assinatura' as never);
      return;
    }
    router.push({ pathname: '/src/screens/ExplorarDetalhes' as never, params: { id: String(item.id), tipo } });
  };

  const tituloCompromisso = agendamentoAtivo
    ? agendamentoAtivo.servico?.nome || agendamentoAtivo.itemAluguel?.nome || 'Seu agendamento'
    : '';

  const cidadeTxt = cidadeAtual || 'sua região';

  const avisoEscopo = (esc: Escopo, oque: string) =>
    esc.semResultados ? (
      <View style={s.avisoEscopo}>
        <Ionicons name="information-circle" size={18} color="#B45309" />
        <Text style={s.avisoEscopoTxt}>Ainda não temos {oque} em {cidadeTxt}. Mostrando o que há disponível no sistema.</Text>
      </View>
    ) : null;

  const renderRecomendado = (item: ItemHome) => (
    <TouchableOpacity key={`rec-${item.id}`} style={s.cartao} activeOpacity={0.93} onPress={() => abrirItem(item, 'servicos')}>
      <View style={s.cartaoFoto}>
        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/600x300' }} style={[s.cartaoImg, item.bloqueado && { opacity: 0.45 }]} contentFit="cover" />
        <FavoriteButton ativo={favoritosServ.includes(item.id)} onPress={() => alternarFavorito('servico', item.id)} style={s.cartaoCoracao} />
        <View style={[s.tagTipo, { backgroundColor: '#2563EB' }]}><Ionicons name="calendar-outline" size={11} color="#fff" /><Text style={[s.tagTipoTxt, { color: '#fff' }]}>SERVIÇO</Text></View>
        {item.destaque_premium ? (
          <View style={[s.selo, { backgroundColor: T.tag }]}><Ionicons name="star" size={10} color="#fff" /><Text style={s.seloTxt}>PREMIUM</Text></View>
        ) : item.desconto_label ? (
          <View style={[s.selo, { backgroundColor: T.success }]}><Text style={s.seloTxt}>{item.desconto_label}</Text></View>
        ) : null}
        {item.bloqueado && <View style={s.lock}><Ionicons name="lock-closed" size={22} color="#fff" /></View>}
      </View>

      <View style={s.cartaoCorpo}>
        <SeloVagas item={item} />
        <Text style={s.cartaoNome} numberOfLines={1}>{item.nome}</Text>
        <View style={s.cartaoMeta}>
          <View style={s.nota}>
            <Ionicons name="star" size={13} color={T.success} />
            <Text style={s.notaTxt}>{nota(item.avaliacao_media)}</Text>
            {!!item.total_avaliacoes && <Text style={s.notaQtd}>({item.total_avaliacoes})</Text>}
          </View>
          {(item.distancia != null || !!item.cidade) && (
            <View style={s.distancia}>
              <Ionicons name="location-outline" size={13} color={T.muted} />
              <Text style={s.distanciaTxt}>{item.distancia != null ? `${Number(item.distancia).toFixed(1).replace('.', ',')} km` : item.cidade}</Text>
            </View>
          )}
        </View>
        <Text style={s.cartaoSub} numberOfLines={1}>
          {[item.ramo_atuacao, item.nome_local].filter(Boolean).join(' · ')}
          {item.duracao_minutos ? `  ·  ${item.duracao_minutos} min` : ''}
        </Text>

        <View style={s.cartaoRodape}>
          <View>
            <Text style={s.aPartirDe}>{item.tem_promocao ? 'Por apenas' : 'Por pessoa'}</Text>
            <View style={s.precoLinha}>
              <Text style={s.preco}>{brl(item.valor)}</Text>
              {item.tem_promocao && Number(item.valor_original) > Number(item.valor) && <Text style={s.precoRiscado}>{brl(item.valor_original)}</Text>}
            </View>
          </View>
          <TouchableOpacity style={s.btnAgendar} onPress={() => abrirItem(item, 'servicos')} activeOpacity={0.85}>
            <Text style={s.btnAgendarTxt}>{item.bloqueado ? 'Assinar' : 'Agendar'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderReserva = (item: ItemHome) => (
    <TouchableOpacity key={`res-${item.id}`} style={[s.cartaoH, { width: width * 0.62 }]} activeOpacity={0.92} onPress={() => abrirItem(item, 'reservas')}>
      <View style={s.cartaoHFoto}>
        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/300x200' }} style={[s.cartaoImg, item.bloqueado && { opacity: 0.4 }]} contentFit="cover" />
        <View style={[s.tagTipo, { backgroundColor: '#DC2626' }]}><Ionicons name="key-outline" size={11} color="#fff" /><Text style={[s.tagTipoTxt, { color: '#fff' }]}>{item.direto_dono ? 'RESERVA AVULSA' : 'RESERVA'}</Text></View>
        {item.desconto_label ? <View style={[s.selo, { backgroundColor: T.success }]}><Text style={s.seloTxt}>{item.desconto_label}</Text></View> : null}
        {item.bloqueado && <View style={s.lock}><Ionicons name="lock-closed" size={20} color="#fff" /></View>}
      </View>
      <View style={{ padding: 12 }}>
        <SeloVagas item={item} />
        <Text style={s.cartaoNome} numberOfLines={1}>{item.nome}</Text>
        <View style={[s.cartaoMeta, { marginTop: 4 }]}>
          <View style={s.nota}>
            <Ionicons name="star" size={12} color={T.success} />
            <Text style={s.notaTxt}>{nota(item.avaliacao_media)}</Text>
          </View>
          {!!item.cidade && <Text style={s.distanciaTxt} numberOfLines={1}>{item.cidade}</Text>}
        </View>
        <View style={[s.precoLinha, { marginTop: 8 }]}>
          <Text style={s.preco}>{brl(item.valor)}</Text>
          <Text style={s.aPartirDe}>/ dia</Text>
          {item.tem_promocao && Number(item.valor_original) > Number(item.valor) && <Text style={s.precoRiscado}>{brl(item.valor_original)}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  const nadaEncontrado = !carregandoListas && servicos.length === 0 && proximos.length === 0 && reservasItens.length === 0;

  const chipsRapidos: { id: string; rotulo: string; icone: string; ativo: boolean; acao: () => void }[] = [
    { id: 'perto', rotulo: 'Perto de mim', icone: 'navigate-outline', ativo: filtros.ordem === 'distancia', acao: () => atualizarFiltro({ ordem: filtros.ordem === 'distancia' ? 'relevancia' : 'distancia' }) },
    { id: 'avaliados', rotulo: 'Melhor avaliados', icone: 'star-outline', ativo: filtros.ordem === 'avaliacao', acao: () => atualizarFiltro({ ordem: filtros.ordem === 'avaliacao' ? 'relevancia' : 'avaliacao' }) },
    { id: 'promo', rotulo: 'Promoções', icone: 'pricetag-outline', ativo: filtros.promocao, acao: () => atualizarFiltro({ promocao: !filtros.promocao }) },
    { id: 'barato', rotulo: 'Até R$ 100', icone: 'cash-outline', ativo: filtros.precoMax === 100, acao: () => atualizarFiltro({ precoMax: filtros.precoMax === 100 ? null : 100 }) },
    { id: 'espera', rotulo: 'Sem espera', icone: 'flash-outline', ativo: filtros.semEspera, acao: () => atualizarFiltro({ semEspera: !filtros.semEspera }) },
    { id: 'premium', rotulo: 'Premium', icone: 'ribbon-outline', ativo: filtros.premium, acao: () => atualizarFiltro({ premium: !filtros.premium }) },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {carregando ? (
        <View style={s.centro}><ActivityIndicator size="large" color={T.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={T.primary} />}
        >
          <View style={s.headerWrap}>
            <HeaderCliente titulo="Home" subtitulo="Encontre serviços, lojas e muito mais">
              <TouchableOpacity style={s.localizacao} onPress={obterLocalizacao} activeOpacity={0.7}>
                <Ionicons name="location-sharp" size={14} color={T.primary} />
                <Text style={s.localizacaoTxt} numberOfLines={1}>{localizacaoTexto}</Text>
              </TouchableOpacity>
            </HeaderCliente>
          </View>

          {/* BUSCA */}
          <View style={s.busca}>
            <Ionicons name="search" size={20} color="#8A92A6" />
            <TextInput
              placeholder="Buscar serviços, locais, hotéis, passeios..."
              placeholderTextColor="#A0A8B8"
              style={s.buscaInput}
              value={busca}
              onChangeText={setBusca}
              returnKeyType="search"
              autoCorrect={false}
            />
            {!!busca && (
              <TouchableOpacity onPress={() => { setBusca(''); setBuscaEfetiva(''); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#A0A8B8" />
              </TouchableOpacity>
            )}
            <View style={s.divisorVertical} />
            <TouchableOpacity onPress={abrirFiltros} hitSlop={8} style={s.filtrosBtn}>
              <Ionicons name="options-outline" size={22} color={T.primary} />
              {totalFiltros > 0 && <View style={s.filtrosBadge}><Text style={s.filtrosBadgeTxt}>{totalFiltros}</Text></View>}
            </TouchableOpacity>
          </View>

          {/* FILTROS RÁPIDOS - Estilo atalhos horizontais */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={[s.chip, totalFiltros > 0 && s.chipOn]} onPress={abrirFiltros} activeOpacity={0.8}>
              <Ionicons name="options-outline" size={16} color={totalFiltros > 0 ? '#fff' : T.ink} />
              <Text style={[s.chipTxt, totalFiltros > 0 && s.chipTxtOn]}>{totalFiltros > 0 ? `Filtros (${totalFiltros})` : 'Filtros'}</Text>
            </TouchableOpacity>
            {chipsRapidos.map((c) => (
              <TouchableOpacity key={c.id} style={[s.chip, c.ativo && s.chipAtivo]} onPress={c.acao} activeOpacity={0.8}>
                <Ionicons name={c.icone as never} size={15} color={c.ativo ? '#fff' : T.ink} />
                <Text style={[s.chipTxt, c.ativo && s.chipTxtOn]}>{c.rotulo}</Text>
              </TouchableOpacity>
            ))}
            {emBusca && (
              <TouchableOpacity style={s.chip} onPress={limparTudo} activeOpacity={0.8}>
                <Ionicons name="close" size={15} color={T.danger} />
                <Text style={[s.chipTxt, { color: T.danger }]}>Limpar</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* CATEGORIAS - Ícones limpos e profissionais */}
          {categorias.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categorias}>
              <TouchableOpacity style={s.categoria} onPress={() => atualizarFiltro({ categoria: null })} activeOpacity={0.8}>
                <View style={[s.categoriaIcone, { backgroundColor: !filtros.categoria ? T.ink : `${T.ink}1F` }]}><MaterialIcons name="apps" size={26} color={!filtros.categoria ? '#fff' : T.ink} /></View>
                <Text style={[s.categoriaTxt, !filtros.categoria && { color: T.ink, fontWeight: '700' }]}>Tudo</Text>
              </TouchableOpacity>
              {categorias.map((cat) => {
                const on = filtros.categoria === cat.nome;
                const cor = resolverCorCategoria(cat.nome);
                // Fundo sempre colorido (tom suave da cor da categoria) — antes só
                // ganhava cor quando selecionado, e ficava branco/neutro o resto do tempo.
                return (
                  <TouchableOpacity key={cat.nome} style={s.categoria} onPress={() => atualizarFiltro({ categoria: on ? null : cat.nome })} activeOpacity={0.8}>
                    <View style={[s.categoriaIcone, { backgroundColor: on ? cor : `${cor}1F` }]}><MaterialIcons name={resolverIconeCategoria(cat.nome)} size={26} color={on ? '#fff' : cor} /></View>
                    <Text style={[s.categoriaTxt, on && { color: cor, fontWeight: '700' }]} numberOfLines={1}>{cat.nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* AVISO DE PAGAMENTO PENDENTE */}
          {!emBusca && pendentesPagamento.length > 0 && (
            <TouchableOpacity
              style={s.aviso}
              activeOpacity={0.85}
              onPress={() =>
                pendentesPagamento.length === 1
                  ? router.push({ pathname: '/src/screens/PagamentoScreen' as never, params: { agendamento_id: String(pendentesPagamento[0].id) } })
                  : router.push('/src/screens/MeusAgendamentos' as never)
              }
            >
              <View style={s.avisoIcone}><Ionicons name="alert-circle" size={20} color={T.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.avisoTitulo}>{pendentesPagamento.length === 1 ? '1 pagamento pendente' : `${pendentesPagamento.length} pagamentos pendentes`}</Text>
                <Text style={s.avisoSub} numberOfLines={1}>Finalize agora para garantir sua reserva</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.danger} />
            </TouchableOpacity>
          )}

          {/* COMPROMISSO ATIVO OU BANNER PRINCIPAL */}
          {!emBusca && (agendamentoAtivo ? (
            <TouchableOpacity
              style={s.ativo}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/src/screens/AcompanhamentoFilaScreen' as never, params: { id: agendamentoAtivo.id.toString() } })}
            >
              <View style={s.ativoIcone}><Ionicons name="time-outline" size={24} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.ativoKicker}>SEU PRÓXIMO COMPROMISSO</Text>
                <Text style={s.ativoTitulo} numberOfLines={1}>{agendamentoAtivo.estabelecimento?.nome || 'Seu compromisso'}</Text>
                <Text style={s.ativoSub} numberOfLines={1}>
                  {tituloCompromisso} {agendamentoAtivo.hora_agendamento ? `• ${agendamentoAtivo.hora_agendamento.slice(0, 5)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          ) : (
            <View style={s.banner}>
              <Image source={{ uri: BANNER }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={s.bannerSombra} />
              <View style={s.bannerConteudo}>
                <View style={s.bannerTag}>
                  <Ionicons name="flame" size={12} color="#fff" />
                  <Text style={s.bannerTagTxt}>EM ALTA</Text>
                </View>
                <Text style={s.bannerTitulo}>Agende serviços com os melhores perto de você</Text>
                <Text style={s.bannerSub}>Prático, rápido e seguro!</Text>
              </View>
            </View>
          ))}

          {/* EXPLORAR POR ÁREA */}
          <View style={s.secaoAreas}>
            <Text style={s.areasTitulo}>Explorar por área</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.areas}>
              {areas.map((a) => {
                const on = filtros.area === a.id;
                const contagem = a.na_cidade ?? a.total;
                return (
                  <TouchableOpacity key={a.id} style={[s.area, on && s.areaOn, contagem === 0 && !on && { opacity: 0.55 }]} onPress={() => atualizarFiltro({ area: on ? null : a.id })} activeOpacity={0.85}>
                    <View style={[s.areaIcone, on && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Ionicons name={`${a.icone}-outline` as never} size={22} color={on ? '#fff' : T.primary} />
                    </View>
                    <Text style={[s.areaTxt, on && { color: '#fff' }]}>{a.rotulo}</Text>
                    <Text style={[s.areaQtd, on && { color: 'rgba(255,255,255,0.85)' }]}>{contagem} {contagem === 1 ? 'opção' : 'opções'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ONDE ESTOU BUSCANDO */}
          <View style={s.escopoLinha}>
            <Ionicons name={cidadeAtual && !filtros.todoSistema ? 'location' : 'earth'} size={14} color={T.primary} />
            <Text style={s.escopoTxt} numberOfLines={1}>
              {!cidadeAtual ? 'Ative a localização para ver opções próximas' : filtros.todoSistema ? 'Mostrando todo o sistema' : `Resultados em ${cidadeAtual}`}
            </Text>
            {!!cidadeAtual && (
              <TouchableOpacity onPress={() => atualizarFiltro({ todoSistema: !filtros.todoSistema })} hitSlop={8}>
                <Text style={s.escopoLink}>{filtros.todoSistema ? 'Só perto de mim' : 'Ver tudo'}</Text>
              </TouchableOpacity>
            )}
            {carregandoListas && <ActivityIndicator size="small" color={T.primary} style={{ marginLeft: 8 }} />}
          </View>

          {nadaEncontrado && (
            <View style={s.nada}>
              <Ionicons name="search-outline" size={48} color="#CBD5E1" />
              <Text style={s.nadaTitulo}>Nada encontrado</Text>
              <Text style={s.nadaTxt}>Tente usar outras palavras ou remova alguns dos filtros aplicados.</Text>
              <TouchableOpacity style={s.nadaBtn} onPress={limparTudo}><Text style={s.nadaBtnTxt}>Limpar busca e filtros</Text></TouchableOpacity>
            </View>
          )}

          {/* SERVIÇOS */}
          {servicos.length > 0 && (
            <View style={s.secao}>
              <View style={s.secaoTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.secaoTitulo}>{emBusca ? `Serviços (${servicos.length})` : servicosTemPremium ? 'Serviços em destaque' : 'Serviços para você'}</Text>
                  <Text style={s.secaoSub}>{servicosTemPremium && !emBusca ? 'De anunciantes premium verificados' : 'Você agenda um horário'}</Text>
                </View>
              </View>
              {avisoEscopo(escopos.servicos, 'serviços')}
              <View style={{ paddingHorizontal: 20 }}>{servicos.slice(0, emBusca ? 12 : 6).map(renderRecomendado)}</View>
            </View>
          )}

          {/* RESERVAS E ALUGUÉIS */}
          {reservasItens.length > 0 && (
            <View style={s.secao}>
              <View style={s.secaoTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.secaoTitulo}>{emBusca ? `Reservas e aluguéis (${reservasItens.length})` : 'Reservas e aluguéis'}</Text>
                  <Text style={s.secaoSub}>Estadias, veículos e espaços por dia</Text>
                </View>
              </View>
              {avisoEscopo(escopos.reservas, 'reservas ou aluguéis')}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {reservasItens.map(renderReserva)}
              </ScrollView>
            </View>
          )}

          {/* LOCAIS */}
          {proximos.length > 0 && (
            <View style={s.secao}>
              <View style={s.secaoTopo}>
                <Text style={[s.secaoTitulo, { flex: 1 }]}>{emBusca ? `Locais (${proximos.length})` : coordenadas ? 'Perto de você' : 'Locais recomendados'}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/explorar' as never)}>
                  <Text style={s.verTodos}>Ver todos</Text>
                </TouchableOpacity>
              </View>
              {avisoEscopo(escopos.locais, 'locais')}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {proximos.map((item) => {
                  const semEspera = !item.fila_atual || item.fila_atual <= 0;
                  return (
                    <TouchableOpacity key={item.id} style={[s.cartaoH, { width: width * 0.66 }]} activeOpacity={0.92} onPress={() => abrirEstabelecimento(item.id)}>
                      <View style={s.cartaoHFoto}>
                        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/300x200' }} style={s.cartaoImg} contentFit="cover" />
                        <FavoriteButton ativo={favoritos.includes(item.id)} onPress={() => alternarFavorito('estabelecimento', item.id)} tamanho={34} style={s.cartaoCoracao} />
                        <View style={[s.selo, { backgroundColor: semEspera ? T.success : T.tag }]}>
                          <Text style={s.seloTxt}>{semEspera ? 'SEM ESPERA' : `${item.fila_atual} NA FILA`}</Text>
                        </View>
                      </View>
                      <View style={{ padding: 12 }}>
                        <Text style={s.cartaoNome} numberOfLines={1}>{item.nome}</Text>
                        <View style={[s.cartaoMeta, { marginTop: 4 }]}>
                          <View style={s.nota}>
                            <Ionicons name="star" size={13} color={T.success} />
                            <Text style={s.notaTxt}>{nota(item.avaliacao_media)}</Text>
                            {!!item.total_avaliacoes && <Text style={s.notaQtd}>({item.total_avaliacoes})</Text>}
                          </View>
                          {(item.distancia != null || !!item.cidade) && (
                            <View style={s.distancia}>
                              <Ionicons name="location-outline" size={12} color={T.muted} />
                              <Text style={s.distanciaTxt}>{item.distancia != null ? `${String(item.distancia).replace('.', ',')} km` : item.cidade}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[s.cartaoSub, { marginTop: 4 }]} numberOfLines={1}>
                          {item.ramo_atuacao || 'Estabelecimento'}{item.total_servicos ? ` · ${item.total_servicos} serviços` : ''}
                        </Text>
                        <View style={[s.precoLinha, { marginTop: 8 }]}>
                          {item.valor ? (
                            <>
                              <Text style={s.aPartirDe}>a partir de</Text>
                              <Text style={s.preco}>{brl(item.valor)}</Text>
                            </>
                          ) : (
                            <Text style={s.aPartirDe}>Ver serviços</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* PONTOS */}
          {!emBusca && pontos > 0 && (
            <View style={s.pontos}>
              <View style={s.pontosIcone}><Ionicons name="gift-outline" size={22} color={T.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pontosTitulo}>Você tem {pontos.toLocaleString('pt-BR')} pontos!</Text>
                <Text style={s.pontosSub}>Troque por descontos em serviços.</Text>
              </View>
              <TouchableOpacity style={s.pontosBtnBase} onPress={() => router.push('/src/screens/MeusPontos' as never)}>
                <Text style={s.pontosBtn}>Resgatar</Text>
              </TouchableOpacity>
            </View>
          )}

          {!emBusca && isPremium && (
            <TouchableOpacity style={s.premiumLink} onPress={() => router.push('/src/screens/OfertasPremium' as never)} activeOpacity={0.85}>
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={s.premiumLinkTxt}>Ver ofertas exclusivas Premium</Text>
              <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* FOLHA DE FILTROS - Refinada, com blocos separados e claros */}
      <Modal visible={modalFiltros} animationType="slide" transparent onRequestClose={() => setModalFiltros(false)}>
        <View style={s.folhaFundo}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalFiltros(false)} />
          <View style={s.folha}>
            <View style={s.folhaHandle} />
            <View style={s.folhaTopo}>
              <Text style={s.folhaTitulo}>Filtros</Text>
              <TouchableOpacity onPress={() => setRascunho(FILTROS_PADRAO)}><Text style={s.folhaLimpar}>Limpar tudo</Text></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              <View style={s.folhaBloco}>
                <Text style={s.folhaRotulo}>Ordenar por</Text>
                <View style={s.folhaChips}>
                  {ORDENS.map((o) => (
                    <TouchableOpacity key={o.id} style={[s.chip, rascunho.ordem === o.id && s.chipAtivo]} onPress={() => setRascunho({ ...rascunho, ordem: o.id })}>
                      <Text style={[s.chipTxt, rascunho.ordem === o.id && s.chipTxtOn]}>{o.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.folhaBloco}>
                <Text style={s.folhaRotulo}>Preço Máximo</Text>
                <View style={s.folhaChips}>
                  {FAIXAS_PRECO.map((v) => (
                    <TouchableOpacity key={String(v)} style={[s.chip, rascunho.precoMax === v && s.chipAtivo]} onPress={() => setRascunho({ ...rascunho, precoMax: v })}>
                      <Text style={[s.chipTxt, rascunho.precoMax === v && s.chipTxtOn]}>{v ? `Até R$ ${v}` : 'Qualquer'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.folhaBloco}>
                <Text style={s.folhaRotulo}>Avaliação Mínima</Text>
                <View style={s.folhaChips}>
                  {NOTAS.map((v) => (
                    <TouchableOpacity key={String(v)} style={[s.chip, rascunho.notaMin === v && s.chipAtivo]} onPress={() => setRascunho({ ...rascunho, notaMin: v })}>
                      {!!v && <Ionicons name="star" size={14} color={rascunho.notaMin === v ? '#fff' : T.star} />}
                      <Text style={[s.chipTxt, rascunho.notaMin === v && s.chipTxtOn]}>{v ? `${String(v).replace('.', ',')}+` : 'Qualquer'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.folhaBloco}>
                <Text style={s.folhaRotulo}>Área da Cidade</Text>
                <View style={s.folhaChips}>
                  <TouchableOpacity style={[s.chip, !rascunho.area && s.chipAtivo]} onPress={() => setRascunho({ ...rascunho, area: null })}>
                    <Text style={[s.chipTxt, !rascunho.area && s.chipTxtOn]}>Todas as áreas</Text>
                  </TouchableOpacity>
                  {areas.map((a) => (
                    <TouchableOpacity key={a.id} style={[s.chip, rascunho.area === a.id && s.chipAtivo]} onPress={() => setRascunho({ ...rascunho, area: a.id })}>
                      <Text style={[s.chipTxt, rascunho.area === a.id && s.chipTxtOn]}>{a.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.folhaBlocoConfig}>
                {([
                  ['promocao', 'Somente promoções', 'Mostrar itens com desconto'],
                  ['premium', 'Anunciantes Premium', 'Locais verificados pela plataforma'],
                  ['semEspera', 'Locais sem fila agora', 'Disponibilidade imediata'],
                ] as const).map(([chave, titulo, sub], index) => (
                  <View key={chave} style={[s.folhaLinha, index === 0 && { borderTopWidth: 0, paddingTop: 0 }]}>
                    <View style={{ flex: 1 }}><Text style={s.folhaLinhaTitulo}>{titulo}</Text><Text style={s.folhaLinhaSub}>{sub}</Text></View>
                    <Switch value={rascunho[chave]} onValueChange={(v) => setRascunho({ ...rascunho, [chave]: v })} trackColor={{ true: T.primary, false: '#E2E8F0' }} thumbColor="#FFFFFF" />
                  </View>
                ))}
              </View>

              {!!cidadeAtual && (
                <View style={s.folhaBlocoConfig}>
                  <View style={[s.folhaLinha, { borderTopWidth: 0, paddingTop: 0, paddingBottom: 0 }]}>
                    <View style={{ flex: 1 }}><Text style={s.folhaLinhaTitulo}>Ver o sistema todo</Text><Text style={s.folhaLinhaSub}>Buscar além de {cidadeAtual}</Text></View>
                    <Switch value={rascunho.todoSistema} onValueChange={(v) => setRascunho({ ...rascunho, todoSistema: v })} trackColor={{ true: T.primary, false: '#E2E8F0' }} thumbColor="#FFFFFF" />
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={s.folhaAplicar} onPress={aplicarRascunho} activeOpacity={0.85}>
              <Text style={s.folhaAplicarTxt}>Mostrar resultados</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerWrap: { backgroundColor: '#F5F6F8' },
  localizacao: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  localizacaoTxt: { fontSize: 13, fontWeight: '700', color: T.ink, maxWidth: 200 },

  busca: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 8,
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#F1F3F5',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  buscaInput: { flex: 1, fontSize: 15, color: T.ink, fontWeight: '500' },
  divisorVertical: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  filtrosBtn: { paddingLeft: 4, position: 'relative' },
  filtrosBadge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#FFF' },
  filtrosBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

  filtros: { paddingHorizontal: 20, gap: 10, paddingVertical: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipAtivo: { backgroundColor: T.primary, borderColor: T.primary },
  chipTxt: { fontSize: 13, fontWeight: '600', color: T.ink },
  chipTxtOn: { color: '#fff' },

  categorias: { paddingHorizontal: 20, gap: 16, paddingBottom: 22 },
  categoria: { alignItems: 'center', width: 68 },
  categoriaIcone: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoriaIconeOn: { backgroundColor: T.primary, borderColor: T.primary },
  categoriaTxt: { fontSize: 12, fontWeight: '600', color: T.ink, textAlign: 'center' },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FEF2F2', marginHorizontal: 20, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  avisoIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  avisoTitulo: { color: T.danger, fontSize: 15, fontWeight: '800' },
  avisoSub: { color: '#991B1B', fontSize: 13, marginTop: 2, fontWeight: '500' },

  ativo: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1E293B', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ativoIcone: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ativoKicker: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ativoTitulo: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 4 },
  ativoSub: { color: '#CBD5E1', fontSize: 13, marginTop: 2 },

  banner: { height: 180, marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: '#334155', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  bannerSombra: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  bannerConteudo: { flex: 1, padding: 20, justifyContent: 'center' },
  bannerTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: T.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 12 },
  bannerTagTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  bannerTitulo: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 28, letterSpacing: -0.5, maxWidth: '85%' },
  bannerSub: { color: '#E2E8F0', fontSize: 14, marginTop: 8, fontWeight: '500' },

  secaoAreas: { marginTop: 8, paddingBottom: 8 },
  areasTitulo: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.4, paddingHorizontal: 20 },
  areas: { paddingHorizontal: 20, gap: 12, paddingTop: 14, paddingBottom: 10 },
  area: { width: 114, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  areaOn: { backgroundColor: T.primary, borderColor: T.primary },
  areaIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  areaTxt: { fontSize: 14, fontWeight: '800', color: T.ink },
  areaQtd: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '500' },

  escopoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  escopoTxt: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: '#64748B' },
  escopoLink: { fontSize: 13, fontWeight: '800', color: T.primary, marginLeft: 4 },
  avisoEscopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FEF9C3', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FEF08A' },
  avisoEscopoTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: '#854D0E', lineHeight: 18 },

  secao: { marginTop: 12, marginBottom: 10 },
  secaoTopo: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 16 },
  secaoTitulo: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  secaoSub: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },
  verTodos: { fontSize: 14, fontWeight: '800', color: T.primary },

  cartao: { backgroundColor: '#FFFFFF', borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cartaoFoto: { height: 180, backgroundColor: '#E2E8F0' },
  cartaoImg: { width: '100%', height: '100%' },
  cartaoCoracao: { position: 'absolute', top: 14, right: 14 },
  tagTipo: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  tagTipoTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: T.ink },
  selo: { position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  seloTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  lock: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  cartaoCorpo: { padding: 18 },
  cartaoNome: { fontSize: 17, fontWeight: '800', color: T.ink },
  cartaoMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notaTxt: { fontSize: 14, fontWeight: '800', color: T.ink },
  notaQtd: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  distancia: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanciaTxt: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  cartaoSub: { fontSize: 13, color: '#64748B', marginTop: 8, fontWeight: '500' },
  cartaoRodape: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  aPartirDe: { fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  precoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  preco: { fontSize: 22, fontWeight: '800', color: T.primary, letterSpacing: -0.5 },
  precoRiscado: { fontSize: 13, color: '#94A3B8', textDecorationLine: 'line-through', fontWeight: '600' },
  btnAgendar: { backgroundColor: T.primary, paddingHorizontal: 24, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: T.primary, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  btnAgendarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  cartaoH: { backgroundColor: '#FFFFFF', borderRadius: 20, marginRight: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  cartaoHFoto: { height: 130, backgroundColor: '#E2E8F0' },

  pontos: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginTop: 24, backgroundColor: '#FFF7ED', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FFEDD5' },
  pontosIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  pontosTitulo: { fontSize: 15, fontWeight: '800', color: '#9A3412' },
  pontosSub: { fontSize: 13, color: '#C2410C', marginTop: 2, fontWeight: '500' },
  pontosBtnBase: { backgroundColor: T.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  pontosBtn: { fontSize: 13, fontWeight: '800', color: '#fff' },

  premiumLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 16, height: 52, borderRadius: 16, backgroundColor: '#FFFBEB', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: '#FEF3C7' },
  premiumLinkTxt: { fontSize: 14, fontWeight: '800', color: '#D97706' },

  nada: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30, gap: 8 },
  nadaTitulo: { fontSize: 20, fontWeight: '800', color: T.ink, marginTop: 10 },
  nadaTxt: { fontSize: 14, color: '#64748B', textAlign: 'center', fontWeight: '500', lineHeight: 20 },
  nadaBtn: { marginTop: 16, backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  nadaBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  folhaFundo: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  folha: { backgroundColor: '#F1F5F9', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, maxHeight: '90%' },
  folhaHandle: { width: 40, height: 5, backgroundColor: '#CBD5E1', borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  folhaTitulo: { fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  folhaLimpar: { fontSize: 15, fontWeight: '800', color: T.primary },
  
  folhaBloco: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  folhaBlocoConfig: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  folhaRotulo: { fontSize: 14, fontWeight: '800', color: T.ink, marginBottom: 14 },
  folhaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  folhaLinha: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  folhaLinhaTitulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  folhaLinhaSub: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  
  folhaAplicar: { backgroundColor: T.primary, borderRadius: 18, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: T.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  folhaAplicarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  seloVagas: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 10 },
  seloVagasPoucas: { backgroundColor: '#FEF3C7' },
  seloVagasEsgotado: { backgroundColor: '#FEE2E2' },
  seloVagasTxt: { fontSize: 11, fontWeight: '800', color: '#92400E' },
});