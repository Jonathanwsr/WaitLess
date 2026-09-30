import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  TextInput,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { T } from '../../../constants/ClientTheme';
import { FavoriteButton } from '../../../components/client/ui';
import GaleriaFotos from '../../../components/client/GaleriaFotos';
import { alternarFavoritoRemoto } from '../../../services/favoritos';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { compartilharLocal } from '../../../services/compartilhar';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',
  background: '#F5F5F5',
  white: '#FFFFFF',
  textDark: '#282828',
  textGray: '#6A6C72',
  textLight: '#A0A2A8',
  border: '#E6E7E9',
  success: '#00A868',
  warning: '#F59E0B',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;
const SITE_URL = cleanBaseUrl.replace(/\/api\/?$/, '');

// Mesma taxa de conversão usada no backend (App\Services\PontosService) — só
// pra exibir uma prévia do desconto antes de enviar; o valor real e
// autoritativo sempre é recalculado no servidor.
const PONTOS_POR_REAL = 1000;

interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil?: string;
  cidade?: string;
  estado?: string;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
}

interface Servico {
  id: number;
  estabelecimento_id: number;
  nome: string;
  descricao?: string;
  valor: number | string;
  duracao_minutos?: number;
  fotos?: string | string[];
  tem_promocao?: boolean;
  tipo_desconto?: string;
  valor_desconto?: number | string;
  aceita_pontos?: boolean;
  maximo_pontos_permitidos?: number;
}

interface ItemAluguel {
  id: number;
  estabelecimento_id: number;
  nome: string;
  descricao?: string;
  categoria?: string;
  modelo?: string;
  marca?: string;
  valor_diaria: number | string;
  valor_semanal?: number | string;
  valor_mensal?: number | string;
  valor_caucao?: number | string;
  fotos?: string | string[];
  mobiliado?: boolean;
  aceita_pet?: boolean;
  possui_wifi?: boolean;
  possui_ar_condicionado?: boolean;
  capacidade_pessoas?: number;
  lugares?: number;
  tem_promocao?: boolean;
  tipo_desconto?: string;
  valor_desconto?: number | string;
  aceita_pontos?: boolean;
  maximo_pontos_permitidos?: number;
  modelo_precificacao?: 'pacote' | 'por_pessoa';
  pessoas_incluidas?: number;
  valor_pessoa_extra?: number | string;
  recursos_oferecidos?: string[];
  acessorios?: string[];
  piscina?: boolean;
  churrasqueira?: boolean;
  datas_indisponiveis?: string[];
  permite_entrega?: boolean;
  local_retirada?: string | null;
  local_entrega?: string | null;
  horario_retirada?: string | null;
  horario_entrega?: string | null;
  // Preenchidos pelo sócio na criação — cada categoria usa um subconjunto:
  quantidade?: number;
  especificacoes?: string | null;
  observacoes?: string | null;
  possui_seguro?: boolean;
  // Imóveis / espaços
  area_total?: number | string | null;
  area_construida?: number | string | null;
  numero_quartos?: number | null;
  numero_banheiros?: number | null;
  numero_suites?: number | null;
  numero_vagas?: number | null;
  numero_comodos?: number | null;
  // Endereço (retirada/uso do item — quando é um imóvel/espaço fixo)
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  // Veículos
  placa?: string | null;
  ano?: number | null;
  combustivel?: string | null;
  cambio?: string | null;
  cilindrada?: string | null;
  potencia?: string | null;
  quilometragem?: number | string | null;
  // Equipamentos
  fabricante?: string | null;
  numero_serie?: string | null;
  patrimonio?: string | null;
}

interface Reputacao {
  total: number;
  media: number | null;
  criterios: Record<string, number>;
  previa: { autor: string; foto?: string | null; nota: number; comentario?: string | null; data: string }[];
}

interface Anfitriao {
  nome?: string | null;
  foto?: string | null;
  desde?: string | null;
  superanfitriao: boolean;
}

interface CupomRecomendado {
  id: number;
  codigo: string;
  titulo: string;
  tipo_desconto: string;
  valor_desconto: number;
  pontos_custo: number;
  apenas_plus: boolean;
  bloqueado: boolean;
  escopo: 'local' | 'servico' | 'reserva';
  resgatado: boolean;
}

interface OpcaoParcela {
  parcelas: number;
  valor_parcela: number;
  total: number;
}

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=1000&auto=format&fit=crop';

function primeiraFoto(fotos?: string | string[]): string {
  if (!fotos) return DEFAULT_IMG;
  if (Array.isArray(fotos)) return fotos[0] || DEFAULT_IMG;
  try {
    const arr = JSON.parse(fotos);
    return Array.isArray(arr) && arr[0] ? arr[0] : DEFAULT_IMG;
  } catch {
    return fotos || DEFAULT_IMG;
  }
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function ExplorarDetalhes() {
  const router = useRouter();
  const { width: larguraTela } = useWindowDimensions();
  // Altura da galeria acompanha a largura da tela (proporção maior, tipo capa) —
  // antes era um valor fixo de 290, pequeno demais em telas largas.
  const alturaGaleria = Math.round(larguraTela * 0.95);
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const rawTipo = params.tipo;
  const tipoParam = Array.isArray(rawTipo) ? rawTipo[0] : rawTipo;
  const ehAluguel = tipoParam === 'reservas';

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [processando, setProcessando] = useState(false);

  const [servico, setServico] = useState<Servico | null>(null);
  const [itemAluguel, setItemAluguel] = useState<ItemAluguel | null>(null);
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [totalAvaliacoesPrevia, setTotalAvaliacoesPrevia] = useState(0);
  const [reputacao, setReputacao] = useState<Reputacao | null>(null);
  const [funcionarios, setFuncionarios] = useState<{ id: number; nome: string; cargo?: string | null }[]>([]);
  const [funcionarioId, setFuncionarioId] = useState<number | null>(null);
  const [anfitriao, setAnfitriao] = useState<Anfitriao | null>(null);

  // Pagamento online real (Asaas): Pix, cartão em até 12x ou boleto
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix');
  const [cartao, setCartao] = useState({ numero: '', titular: '', mes: '', ano: '', cvv: '' });
  const [parcelas, setParcelas] = useState(1);
  const [opcoesParcelas, setOpcoesParcelas] = useState<OpcaoParcela[]>([]);
  const [cuponsRec, setCuponsRec] = useState<CupomRecomendado[]>([]);

  // Servico: data + hora do agendamento
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horaAgendamento, setHoraAgendamento] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  // Prévia de parcelamento (a opção com mais parcelas, que é a de menor valor mensal) — calculada
  // sobre o preço base (serviço ou diária). O valor final de verdade é recalculado no pagamento,
  // já com quantidade, desconto e pontos aplicados.
  const [parcelaPrevia, setParcelaPrevia] = useState<{ parcelas: number; valor_parcela: number } | null>(null);
  const precoBaseParcelamento = ehAluguel ? Number(itemAluguel?.valor_diaria) || 0 : Number(servico?.valor) || 0;

  useEffect(() => {
    if (!precoBaseParcelamento) {
      setParcelaPrevia(null);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/pagamentos/parcelamento`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: precoBaseParcelamento }),
        });
        const json = await res.json().catch(() => null);
        const opcoes = json?.parcelamento;
        if (!cancelado && res.ok && Array.isArray(opcoes) && opcoes.length > 1) {
          setParcelaPrevia(opcoes[opcoes.length - 1]);
        }
      } catch {
        // prévia é só um "adianta aí" — sem ela, o preço à vista já está na tela
      }
    })();
    return () => { cancelado = true; };
  }, [precoBaseParcelamento]);
  // Lista de espera: id do pedido de aviso feito para a data escolhida (null = ainda não pediu)
  const [listaEsperaId, setListaEsperaId] = useState<number | null>(null);
  const [entrandoNaLista, setEntrandoNaLista] = useState(false);

  // Aluguel: período
  const [tipoPeriodo, setTipoPeriodo] = useState<'diaria' | 'semanal' | 'mensal'>('diaria');
  const [quantidadePeriodos, setQuantidadePeriodos] = useState('1');
  const [dataInicio, setDataInicio] = useState('');
  const [pessoasAluguel, setPessoasAluguel] = useState(1);
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  const [formaPagamento, setFormaPagamento] = useState<'online_agora' | 'presencial'>('online_agora');
  const [termosAceitos, setTermosAceitos] = useState(false);

  // Pontos de fidelidade (saldo global) e cupom de desconto
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAtivo, setCupomAtivo] = useState<{ codigo: string; valor: number; tipo: string } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState<string | null>(null);

  useEffect(() => {
    if (id) carregarDados();
    else { setCarregando(false); setErro(true); }
    carregarSaldoPontos();
  }, [id]);

  const carregarSaldoPontos = async () => {
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/meus-pontos`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSaldoPontos(data.pontos_saldo ?? 0);
      }
    } catch (e) {
      // segue com saldo 0; não é crítico pra tela carregar
    }
  };

  const carregarDados = async () => {
    setCarregando(true);
    setErro(false);
    try {
      const token = await pegarToken();
      const endpoint = ehAluguel ? `${API_URL}/reservas/item/${id}` : `${API_URL}/servicos/${id}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = await res.json();

      if (ehAluguel) {
        setItemAluguel(data.item);
        setEstabelecimento(data.estabelecimento);
      } else {
        setServico(data.servico);
        setEstabelecimento(data.servico?.estabelecimento || null);
      }
      setTotalAvaliacoesPrevia((data.avaliacoes_previa || []).length);
      setReputacao(data.reputacao || null);
      setFuncionarios(Array.isArray(data.funcionarios) ? data.funcionarios : []);
      setAnfitriao(data.anfitriao || null);
    } catch (e) {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  const aplicarMascaraData = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2');
    if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    setter(v.slice(0, 10));
  };

  const aplicarMascaraHora = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1:$2');
    setter(v.slice(0, 5));
  };

  const parseDataBRparaISO = (dataBR: string) => {
    const parts = dataBR.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
  };

  const formatarDataParaBR = (d: Date) => {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  };

  const parseDataBRparaDate = (dataBR: string): Date => {
    const parts = dataBR.split('/');
    if (parts.length === 3) {
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12);
      if (!isNaN(d.getTime())) return d;
    }
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    return hoje;
  };

  const entrarNaListaEspera = async () => {
    const dataISO = parseDataBRparaISO(dataAgendamento);
    if (!dataISO || !id) return;
    setEntrandoNaLista(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/lista-espera`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ servico_id: Number(id), data: dataISO }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertar('Não foi possível entrar na lista', json.error || json.message || 'Tente novamente.');
      } else {
        setListaEsperaId(json.id);
        mostrarToast('Você está na lista de espera!', 'sucesso');
      }
    } finally {
      setEntrandoNaLista(false);
    }
  };

  const sairDaListaEspera = async () => {
    if (!listaEsperaId) return;
    try {
      const token = await pegarToken();
      await fetch(`${API_URL}/lista-espera/${listaEsperaId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    } catch {
      // se falhar, o pedido só expira sozinho depois da data
    }
    setListaEsperaId(null);
  };

  useEffect(() => {
    const dataISO = parseDataBRparaISO(dataAgendamento);
    setListaEsperaId(null);
    if (!dataISO || !id || ehAluguel) return;
    (async () => {
      setBuscandoHorarios(true);
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/horarios-disponiveis/${id}?data=${dataISO}&tipo=servico`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const horarios = await res.json();
          setHorariosDisponiveis(horarios);
        }
      } catch (e) {
        // segue sem lista de horários; o cliente ainda pode digitar manualmente
      } finally {
        setBuscandoHorarios(false);
      }
    })();
  }, [dataAgendamento]);

  const calcularPrecoServico = () => {
    if (!servico) return 0;
    const base = Number(servico.valor) || 0;
    if (!servico.tem_promocao || !servico.valor_desconto) return base;
    const desconto = Number(servico.valor_desconto);
    const comDesconto = servico.tipo_desconto === 'percentual' ? base - (base * desconto) / 100 : base - desconto;
    return Math.max(0, comDesconto);
  };

  // Mesma regra do backend (App\Services\PrecificacaoService): "pacote" só cobra quem passa da
  // franquia de pessoas incluídas na diária; "por_pessoa" multiplica o valor cheio pelas pessoas.
  const calcularEstimativaAluguel = () => {
    if (!itemAluguel) return { valorUnitario: 0, total: 0, extraPessoas: 0 };
    const qtd = Math.max(1, parseInt(quantidadePeriodos, 10) || 1);
    let valorBase = Number(itemAluguel.valor_diaria) || 0;
    if (tipoPeriodo === 'semanal') valorBase = Number(itemAluguel.valor_semanal) || valorBase * 7;
    if (tipoPeriodo === 'mensal') valorBase = Number(itemAluguel.valor_mensal) || valorBase * 30;

    const ehPorPessoa = itemAluguel.modelo_precificacao === 'por_pessoa';
    const capacidade = itemAluguel.capacidade_pessoas || itemAluguel.lugares || 99;
    let valorUnitario = valorBase;
    let extraPessoas = 0;

    if (ehPorPessoa) {
      valorUnitario = valorBase * pessoasAluguel;
    } else {
      const incluidas = itemAluguel.pessoas_incluidas || capacidade;
      extraPessoas = Math.max(0, pessoasAluguel - incluidas);
      valorUnitario = valorBase + extraPessoas * (Number(itemAluguel.valor_pessoa_extra) || 0);
    }

    const bruto = valorUnitario * qtd;
    const caucao = Number(itemAluguel.valor_caucao) || 0;
    const taxa = bruto * 0.1;
    return { valorUnitario, total: bruto + caucao + taxa, extraPessoas };
  };

  // Datas já esgotadas (ver ItemAluguelController::show / DisponibilidadeService) — a partir do
  // check-in escolhido, olhamos os próximos dias do período pra saber se cai em algum deles.
  const dataInicioISO = parseDataBRparaISO(dataInicio);
  const periodoEsgotado = (() => {
    if (!ehAluguel || !dataInicioISO || !itemAluguel?.datas_indisponiveis?.length) return false;
    const dias = tipoPeriodo === 'semanal' ? 7 : tipoPeriodo === 'mensal' ? 30 : 1;
    const qtd = Math.max(1, parseInt(quantidadePeriodos, 10) || 1);
    const inicio = new Date(`${dataInicioISO}T12:00:00`);
    for (let i = 0; i < dias * qtd; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      if (itemAluguel.datas_indisponiveis.includes(d.toISOString().slice(0, 10))) return true;
    }
    return false;
  })();

  const aceitaPontos = ehAluguel ? !!itemAluguel?.aceita_pontos : !!servico?.aceita_pontos;
  const maximoPontosPermitidos = ehAluguel ? itemAluguel?.maximo_pontos_permitidos : servico?.maximo_pontos_permitidos;

  // Subtotal antes de pontos/cupom, e prévia dos descontos — o valor final e
  // autoritativo é sempre recalculado no servidor.
  const subtotalBase = ehAluguel ? calcularEstimativaAluguel().total : calcularPrecoServico();

  const pontosAplicaveisPreview = (() => {
    if (!aceitaPontos || !usarPontos || saldoPontos <= 0) return 0;
    const maxPeloSubtotal = Math.floor(subtotalBase * PONTOS_POR_REAL);
    return Math.min(saldoPontos, maxPeloSubtotal, maximoPontosPermitidos || Infinity);
  })();
  const descontoPontosPreview = pontosAplicaveisPreview / PONTOS_POR_REAL;

  const subtotalAposPontos = Math.max(0, subtotalBase - descontoPontosPreview);
  const descontoCupomPreview = cupomAtivo
    ? Math.min(subtotalAposPontos, cupomAtivo.tipo === 'percentual' ? subtotalAposPontos * (cupomAtivo.valor / 100) : cupomAtivo.valor)
    : 0;
  const totalFinalPreview = Math.max(0, subtotalAposPontos - descontoCupomPreview);

  // Parcelas calculadas pelo servidor para o valor atual (só quando paga no cartão agora).
  const pagandoNoCartao = formaPagamento === 'online_agora' && metodoPagamento === 'cartao';
  useEffect(() => {
    if (!pagandoNoCartao || totalFinalPreview <= 0) { setOpcoesParcelas([]); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/pagamentos/parcelamento`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: Number(totalFinalPreview.toFixed(2)) }),
        });
        const json = await res.json();
        if (cancelado || !res.ok) return;
        const lista: OpcaoParcela[] = json.parcelamento || [];
        setOpcoesParcelas(lista);
        setParcelas((p) => Math.min(p, lista.length || 1));
      } catch {
        if (!cancelado) setOpcoesParcelas([]);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
  }, [pagandoNoCartao, totalFinalPreview.toFixed(2)]);

  // Cupons que servem para este serviço/reserva, recomendados ao cliente.
  useEffect(() => {
    const estId = ehAluguel ? itemAluguel?.estabelecimento_id : servico?.estabelecimento_id;
    if (!estId) return;
    (async () => {
      try {
        const token = await pegarToken();
        const q = ehAluguel ? `item_aluguel_id=${itemAluguel?.id}` : `servico_id=${servico?.id}`;
        const res = await fetch(`${API_URL}/cupons/recomendados?estabelecimento_id=${estId}&${q}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json();
        if (res.ok) setCuponsRec(json.cupons || []);
      } catch {
        // recomendações são opcionais
      }
    })();
  }, [servico?.id, itemAluguel?.id]);

  const resgatarRecomendado = async (c: CupomRecomendado) => {
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/cupons/${c.id}/resgatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const json = await res.json();
      if (!res.ok) { alertar('Não foi possível resgatar', json.error || 'Tente novamente.'); return; }
      setCuponsRec((lista) => lista.map((x) => (x.id === c.id ? { ...x, resgatado: true } : x)));
      carregarSaldoPontos();
      alertar('Cupom resgatado', 'Agora é só aplicar na sua reserva.');
    } catch {
      alertar('Ops!', 'Não foi possível resgatar agora.');
    }
  };

  const aplicarCupom = () => aplicarCupomCodigo(cupomInput);

  const aplicarCupomCodigo = async (codigoBruto: string) => {
    const codigo = String(codigoBruto || '').trim();
    if (!codigo) return;
    setErroCupom(null);
    setValidandoCupom(true);
    try {
      const token = await pegarToken();
      const estabelecimentoId = ehAluguel ? itemAluguel?.estabelecimento_id : servico?.estabelecimento_id;
      const res = await fetch(`${API_URL}/cupons/validar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          estabelecimento_id: estabelecimentoId,
          servico_id: !ehAluguel ? servico?.id : undefined,
          item_aluguel_id: ehAluguel ? itemAluguel?.id : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroCupom(json.error || 'Não foi possível validar este cupom.');
        setCupomAtivo(null);
        return;
      }
      setCupomAtivo({ codigo: json.cupom.codigo, valor: Number(json.cupom.valor_desconto), tipo: json.cupom.tipo_desconto });
    } catch (e) {
      setErroCupom('Não foi possível validar este cupom.');
      setCupomAtivo(null);
    } finally {
      setValidandoCupom(false);
    }
  };

  const removerCupom = () => {
    setCupomAtivo(null);
    setCupomInput('');
    setErroCupom(null);
  };

  const abrirLink = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

  const handleConfirmar = async () => {
    if (!termosAceitos) {
      alertar('Atenção', 'Você precisa aceitar os termos de uso e política de privacidade.');
      return;
    }

    if (!ehAluguel) {
      if (!dataAgendamento || !horaAgendamento) {
        alertar('Atenção', 'Escolha a data e o horário do agendamento.');
        return;
      }
    } else {
      if (!dataInicio) {
        alertar('Atenção', itemAluguel?.permite_entrega ? 'Escolha a data de retirada.' : 'Escolha a data de entrada.');
        return;
      }
      if (periodoEsgotado) {
        alertar('Esgotado', 'Este período já está reservado. Escolha outras datas.');
        return;
      }
    }

    if (pagandoNoCartao) {
      const numero = cartao.numero.replace(/\D/g, '');
      if (numero.length < 13 || !cartao.titular.trim() || !cartao.mes || !cartao.ano || cartao.cvv.length < 3) {
        alertar('Dados do cartão', 'Preencha número, nome, validade e CVV do cartão.');
        return;
      }
    }

    const pagamentoOnline = formaPagamento === 'online_agora' ? {
      metodo_pagamento: metodoPagamento,
      parcelas: metodoPagamento === 'cartao' ? parcelas : undefined,
      cartao: metodoPagamento === 'cartao' ? {
        numero: cartao.numero.replace(/\D/g, ''),
        titular: cartao.titular.trim(),
        mes: Number(cartao.mes),
        ano: Number(cartao.ano),
        cvv: cartao.cvv,
      } : undefined,
    } : {};

    setProcessando(true);
    try {
      const token = await pegarToken();

      if (!ehAluguel && servico) {
        const res = await fetch(`${API_URL}/agendamentos/estabelecimento/${servico.estabelecimento_id}/store`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servico_id: servico.id,
            data_agendamento: parseDataBRparaISO(dataAgendamento),
            hora_agendamento: horaAgendamento,
            funcionario_id: funcionarioId || undefined,
            forma_pagamento: formaPagamento,
            pontos_utilizados: pontosAplicaveisPreview || undefined,
            cupom_codigo: cupomAtivo?.codigo || undefined,
            ...pagamentoOnline,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          alertar('Não foi possível agendar', json.error || 'Tente novamente em instantes.');
          return;
        }
        if (json.payment_url && !json.pago) {
          await WebBrowser.openBrowserAsync(json.payment_url);
        }
        alertar(
          json.pago ? 'Pagamento aprovado!' : 'Agendamento confirmado!',
          json.codigo_verificacao ? `Seu PIN de atendimento é ${json.codigo_verificacao}. Guarde-o para apresentar no local.` : 'Você receberá a confirmação em instantes.',
          [{ text: 'OK', onPress: () => router.push('/(tabs)/home' as never) }]
        );
      } else if (itemAluguel) {
        const res = await fetch(`${API_URL}/reservas/item/${itemAluguel.id}/store`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo_periodo: tipoPeriodo,
            quantidade_periodos: Math.max(1, parseInt(quantidadePeriodos, 10) || 1),
            data_inicio: parseDataBRparaISO(dataInicio),
            pessoas: pessoasAluguel,
            forma_pagamento: formaPagamento,
            pontos_utilizados: pontosAplicaveisPreview || undefined,
            cupom_codigo: cupomAtivo?.codigo || undefined,
            ...pagamentoOnline,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          alertar('Não foi possível reservar', json.error || 'Tente novamente em instantes.');
          return;
        }
        if (json.payment_url && !json.pago) {
          await WebBrowser.openBrowserAsync(json.payment_url);
        }
        alertar(
          json.pago ? 'Pagamento aprovado!' : 'Reserva enviada!',
          json.pago
            ? `Sua reserva está confirmada. Valor total: R$ ${Number(json.valor_total).toFixed(2).replace('.', ',')}`
            : `Sua reserva foi registrada. Valor total: R$ ${Number(json.valor_total).toFixed(2).replace('.', ',')}`,
          [{ text: 'OK', onPress: () => router.push('/(tabs)/home' as never) }]
        );
      }
    } catch (e) {
      alertar('Ops!', 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setProcessando(false);
    }
  };

  // ---- favoritos (coração) ----
  const [favorito, setFavorito] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/favoritos`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json();
        const lista: { id: number }[] = ehAluguel ? json.itens_aluguel || json.reservas || [] : json.servicos || [];
        setFavorito(lista.some((f) => String(f.id) === String(id)));
      } catch (e) {
        // sem estado inicial de favorito
      }
    })();
  }, [id, ehAluguel]);

  const alternarFavorito = async () => {
    setFavorito((v) => !v);
    const resultado = await alternarFavoritoRemoto(`${API_URL}/favoritos/toggle`, ehAluguel ? 'item_aluguel' : 'servico', Number(id));
    if (resultado === null) setFavorito((v) => !v);
  };

  // próximos 7 dias como atalho de data (a digitação manual continua disponível)
  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return {
      valor: `${dd}/${mm}/${d.getFullYear()}`,
      dia: dd,
      semana: i === 0 ? 'Hoje' : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
    };
  });

  if (carregando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (erro || (!servico && !itemAluguel)) {
    return (
      <View style={s.centro}>
        <View style={s.erroIcone}><Ionicons name="alert-circle-outline" size={30} color={T.faint} /></View>
        <Text style={s.erroTitulo}>Não foi possível carregar</Text>
        <TouchableOpacity style={s.btnRetry} onPress={carregarDados}>
          <Text style={s.btnRetryTxt}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Retirada/entrega só existe para bens móveis (veículos, equipamentos…). Hospedagem e espaços
  // usam "entrada/saída" no próprio local, e serviços não têm nenhum dos dois.
  const movel = ehAluguel && !!itemAluguel?.permite_entrega;
  const nomeItem = ehAluguel ? itemAluguel!.nome : servico!.nome;
  const descricaoItem = ehAluguel ? itemAluguel?.descricao : servico?.descricao;
  const fotoItem = primeiraFoto(ehAluguel ? itemAluguel?.fotos : servico?.fotos);
  const { valorUnitario } = calcularEstimativaAluguel();
  const precoServico = calcularPrecoServico();
  const precoExibido = ehAluguel ? valorUnitario : precoServico;
  const dataSelecionada = ehAluguel ? dataInicio : dataAgendamento;
  const setDataSelecionada = ehAluguel ? setDataInicio : setDataAgendamento;

  // Ícone por palavra-chave — cobre tanto o checklist fixo do dono quanto o que ele digitou à mão.
  const iconeComodidade = (rotulo: string): string => {
    const r = rotulo.toLowerCase();
    if (r.includes('wi-fi') || r.includes('wifi')) return 'wifi';
    if (r.includes('ar-condicionado') || r.includes('ar condicionado')) return 'snow-outline';
    if (r.includes('mobiliado')) return 'bed-outline';
    if (r.includes('pet')) return 'paw-outline';
    if (r.includes('piscina')) return 'water-outline';
    if (r.includes('churrasqueira')) return 'flame-outline';
    return 'checkmark-circle-outline';
  };

  const comodidades: { icone: string; rotulo: string }[] = ehAluguel
    ? ((itemAluguel?.recursos_oferecidos?.length
        ? itemAluguel.recursos_oferecidos.map((rotulo) => ({ icone: iconeComodidade(rotulo), rotulo }))
        : [
            itemAluguel?.possui_wifi && { icone: 'wifi', rotulo: 'Wi-Fi' },
            itemAluguel?.possui_ar_condicionado && { icone: 'snow-outline', rotulo: 'Ar-condicionado' },
            itemAluguel?.mobiliado && { icone: 'bed-outline', rotulo: 'Mobiliado' },
            itemAluguel?.aceita_pet && { icone: 'paw-outline', rotulo: 'Aceita pets' },
            itemAluguel?.piscina && { icone: 'water-outline', rotulo: 'Piscina' },
            itemAluguel?.churrasqueira && { icone: 'flame-outline', rotulo: 'Churrasqueira' },
          ].filter(Boolean)) as { icone: string; rotulo: string }[])
        .concat((itemAluguel?.lugares || itemAluguel?.capacidade_pessoas) ? [{ icone: 'people-outline', rotulo: `Até ${itemAluguel?.capacidade_pessoas || itemAluguel?.lugares} pessoas` }] : [])
    : [];

  // Ficha técnica: tudo que o sócio preencheu na criação da reserva, além das
  // comodidades — cada categoria usa um subconjunto diferente desses campos,
  // então só entram na lista os que realmente vieram preenchidos.
  const especificacoes: { icone: string; rotulo: string; valor: string }[] = !ehAluguel || !itemAluguel ? [] : ([
    itemAluguel.quantidade && itemAluguel.quantidade > 1 && { icone: 'copy-outline', rotulo: 'Quantidade disponível', valor: String(itemAluguel.quantidade) },
    itemAluguel.numero_quartos != null && { icone: 'bed-outline', rotulo: 'Quartos', valor: String(itemAluguel.numero_quartos) },
    itemAluguel.numero_suites != null && { icone: 'bed-outline', rotulo: 'Suítes', valor: String(itemAluguel.numero_suites) },
    itemAluguel.numero_banheiros != null && { icone: 'water-outline', rotulo: 'Banheiros', valor: String(itemAluguel.numero_banheiros) },
    itemAluguel.numero_vagas != null && { icone: 'car-outline', rotulo: 'Vagas de garagem', valor: String(itemAluguel.numero_vagas) },
    itemAluguel.numero_comodos != null && { icone: 'grid-outline', rotulo: 'Cômodos', valor: String(itemAluguel.numero_comodos) },
    itemAluguel.area_total != null && { icone: 'resize-outline', rotulo: 'Área total', valor: `${itemAluguel.area_total} m²` },
    itemAluguel.area_construida != null && { icone: 'resize-outline', rotulo: 'Área construída', valor: `${itemAluguel.area_construida} m²` },
    itemAluguel.marca && { icone: 'pricetag-outline', rotulo: 'Marca', valor: itemAluguel.marca },
    itemAluguel.modelo && { icone: 'pricetag-outline', rotulo: 'Modelo', valor: itemAluguel.modelo },
    itemAluguel.ano != null && { icone: 'calendar-outline', rotulo: 'Ano', valor: String(itemAluguel.ano) },
    itemAluguel.placa && { icone: 'card-outline', rotulo: 'Placa', valor: itemAluguel.placa },
    itemAluguel.combustivel && { icone: 'flash-outline', rotulo: 'Combustível', valor: itemAluguel.combustivel },
    itemAluguel.cambio && { icone: 'settings-outline', rotulo: 'Câmbio', valor: itemAluguel.cambio },
    itemAluguel.cilindrada && { icone: 'speedometer-outline', rotulo: 'Cilindrada', valor: itemAluguel.cilindrada },
    itemAluguel.potencia && { icone: 'speedometer-outline', rotulo: 'Potência', valor: itemAluguel.potencia },
    itemAluguel.quilometragem != null && { icone: 'speedometer-outline', rotulo: 'Quilometragem', valor: `${itemAluguel.quilometragem} km` },
    itemAluguel.fabricante && { icone: 'business-outline', rotulo: 'Fabricante', valor: itemAluguel.fabricante },
    itemAluguel.numero_serie && { icone: 'barcode-outline', rotulo: 'Número de série', valor: itemAluguel.numero_serie },
    itemAluguel.possui_seguro && { icone: 'shield-checkmark-outline', rotulo: 'Seguro', valor: 'Incluso' },
  ].filter(Boolean) as { icone: string; rotulo: string; valor: string }[]);

  const acessorios: string[] = itemAluguel?.acessorios?.length ? itemAluguel.acessorios : [];

  const enderecoCompleto = [itemAluguel?.endereco, itemAluguel?.numero, itemAluguel?.bairro, itemAluguel?.cidade, itemAluguel?.estado]
    .filter(Boolean)
    .join(', ');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* CAPA */}
        <GaleriaFotos fotos={ehAluguel ? itemAluguel?.fotos : servico?.fotos} altura={alturaGaleria} fallback={DEFAULT_IMG}>
          <View style={s.capaBotoes} pointerEvents="box-none">
            <TouchableOpacity style={s.circulo} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={22} color={T.ink} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={s.circulo}
                onPress={() => estabelecimento && compartilharLocal(estabelecimento, ehAluguel ? undefined : (servico ? { id: servico.id, nome: servico.nome } : undefined))}
                activeOpacity={0.85}
                accessibilityLabel="Compartilhar"
              >
                <Ionicons name="share-social-outline" size={20} color={T.ink} />
              </TouchableOpacity>
              <FavoriteButton ativo={favorito} onPress={alternarFavorito} tamanho={42} />
            </View>
          </View>
        </GaleriaFotos>

        <View style={s.painel}>
          {/* CABEÇALHO DO ITEM */}
          <View style={s.tagLinha}>
            <View style={s.tag}><Ionicons name={ehAluguel ? 'key-outline' : 'cut-outline'} size={12} color={T.tag} /><Text style={s.tagTxt}>{ehAluguel ? itemAluguel?.categoria?.replace(/_/g, ' ') || 'Reserva' : 'Serviço'}</Text></View>
          </View>
          <Text style={s.nome}>{nomeItem}</Text>

          <View style={s.metaLinha}>
            <View style={s.meta}>
              <Ionicons name="star" size={14} color={T.success} />
              <Text style={s.metaTxt}>
                {totalAvaliacoesPrevia > 0 && estabelecimento?.avaliacao_media ? `${Number(estabelecimento.avaliacao_media).toFixed(1).replace('.', ',')} (${estabelecimento.total_avaliacoes} avaliações)` : 'Novo por aqui'}
              </Text>
            </View>
            {!ehAluguel && !!servico?.duracao_minutos && (
              <View style={s.meta}><Ionicons name="time-outline" size={14} color={T.muted} /><Text style={s.metaTxt}>{servico.duracao_minutos} min</Text></View>
            )}
            {!!estabelecimento?.cidade && (
              <View style={s.meta}><Ionicons name="location-outline" size={14} color={T.muted} /><Text style={s.metaTxt}>{estabelecimento.cidade}</Text></View>
            )}
          </View>

          <View style={s.precoLinha}>
            <Text style={s.preco}>R$ {precoExibido.toFixed(2).replace('.', ',')}</Text>
            <Text style={s.precoUn}>{ehAluguel ? `/ ${tipoPeriodo === 'diaria' ? 'dia' : tipoPeriodo === 'semanal' ? 'semana' : 'mês'}` : `/ ${servico?.duracao_minutos || 30} min`}</Text>
          </View>
          {!!parcelaPrevia && (
            <Text style={s.parcelaPrevia}>
              Parcelas estimadas: <Text style={s.parcelaPreviaForte}>{parcelaPrevia.parcelas}x de R$ {parcelaPrevia.valor_parcela.toFixed(2).replace('.', ',')}</Text> sem juros no cartão
            </Text>
          )}

          {!!descricaoItem && (
            <>
              <Text style={s.secao}>Sobre o {ehAluguel ? 'item' : 'serviço'}</Text>
              <Text style={s.descricao}>{descricaoItem}</Text>
            </>
          )}

          {/* LOCAL */}
          {estabelecimento && (
            <TouchableOpacity style={s.loja} activeOpacity={0.85} onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: estabelecimento.id.toString() } })}>
              <Image source={{ uri: estabelecimento.foto_perfil || DEFAULT_IMG }} style={s.lojaFoto} />
              <View style={{ flex: 1 }}>
                <Text style={s.lojaNome}>{estabelecimento.nome}</Text>
                <Text style={s.lojaSub}>{[estabelecimento.cidade, estabelecimento.estado].filter(Boolean).join(' - ') || 'Ver perfil do local'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.faint} />
            </TouchableOpacity>
          )}

          {/* RETIRADA E DEVOLUÇÃO — só itens/veículos */}
          {movel && (!!itemAluguel?.local_retirada || !!itemAluguel?.local_entrega) && (
            <>
              <Text style={s.secao}>Retirada e devolução</Text>
              {!!itemAluguel?.local_retirada && (
                <Text style={s.descricao}>Retirada: {itemAluguel.local_retirada}{itemAluguel.horario_retirada ? ` às ${String(itemAluguel.horario_retirada).slice(0, 5)}` : ''}</Text>
              )}
              {!!itemAluguel?.local_entrega && (
                <Text style={s.descricao}>Devolução: {itemAluguel.local_entrega}{itemAluguel.horario_entrega ? ` até ${String(itemAluguel.horario_entrega).slice(0, 5)}` : ''}</Text>
              )}
            </>
          )}

          {/* ANFITRIÃO E AVALIAÇÕES (dados reais) */}
          {ehAluguel && anfitriao?.nome && (
            <TouchableOpacity
              style={s.anfitriao}
              activeOpacity={0.85}
              onPress={() => estabelecimento?.id && router.push({ pathname: '/src/screens/PerfilAnfitriao' as never, params: { id: String(estabelecimento.id) } })}
            >
              <View style={s.anfitriaoFoto}>
                {anfitriao.foto ? <Image source={{ uri: String(anfitriao.foto) }} style={{ width: '100%', height: '100%' }} /> : <Text style={s.anfitriaoIni}>{anfitriao.nome.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.anfitriaoNome}>Anfitrião: {anfitriao.nome}</Text>
                <Text style={s.anfitriaoSub}>
                  {anfitriao.superanfitriao ? 'Superanfitrião · ' : ''}{anfitriao.desde ? `No Lokyva desde ${anfitriao.desde}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.muted} />
            </TouchableOpacity>
          )}

          {ehAluguel && reputacao && (
            <>
              <Text style={s.secao}>Avaliações</Text>
              {reputacao.total > 0 ? (
                <>
                  <View style={s.notaLinha}>
                    <Text style={s.notaGrande}>{String(reputacao.media).replace('.', ',')}</Text>
                    <View>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((n) => <Ionicons key={n} name="star" size={15} color={n <= Math.round(reputacao.media || 0) ? T.star : '#E6E7E9'} />)}
                      </View>
                      <Text style={s.ajudaTxt}>{reputacao.total} {reputacao.total === 1 ? 'avaliação' : 'avaliações'}</Text>
                    </View>
                  </View>
                  {Object.entries(reputacao.criterios).map(([nome, nota]) => (
                    <View key={nome} style={s.criterioLinha}>
                      <Text style={s.criterioNome}>{nome}</Text>
                      <View style={s.criterioBarra}><View style={[s.criterioPreench, { width: `${(nota / 5) * 100}%` }]} /></View>
                      <Text style={s.criterioNota}>{String(nota).replace('.', ',')}</Text>
                    </View>
                  ))}
                  {reputacao.previa.map((a, i) => (
                    <View key={i} style={s.avaliacaoCard}>
                      <View style={s.avaliacaoTopo}>
                        <Text style={s.avaliacaoAutor}>{a.autor}</Text>
                        <Text style={s.avaliacaoNota}>★ {String(a.nota).replace('.', ',')}</Text>
                      </View>
                      <Text style={s.avaliacaoData}>{a.data}</Text>
                      {!!a.comentario && <Text style={s.avaliacaoTxt}>{a.comentario}</Text>}
                    </View>
                  ))}
                </>
              ) : (
                <Text style={s.ajudaTxt}>Este anfitrião ainda não recebeu avaliações. Seja o primeiro a se hospedar e avaliar.</Text>
              )}
            </>
          )}

          {/* COMODIDADES */}
          {comodidades.length > 0 && (
            <>
              <Text style={s.secao}>Comodidades</Text>
              <View style={s.comodidades}>
                {comodidades.map((c) => (
                  <View key={c.rotulo} style={s.comodidade}>
                    <Ionicons name={c.icone as never} size={20} color={T.primary} />
                    <Text style={s.comodidadeTxt}>{c.rotulo}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* FICHA TÉCNICA — tudo que o sócio preencheu ao criar a reserva */}
          {especificacoes.length > 0 && (
            <>
              <Text style={s.secao}>Detalhes</Text>
              <View style={s.fichaTecnica}>
                {especificacoes.map((e) => (
                  <View key={e.rotulo} style={s.fichaLinha}>
                    <Ionicons name={e.icone as never} size={18} color={T.muted} />
                    <Text style={s.fichaRotulo}>{e.rotulo}</Text>
                    <Text style={s.fichaValor}>{e.valor}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ACESSÓRIOS */}
          {acessorios.length > 0 && (
            <>
              <Text style={s.secao}>Acessórios inclusos</Text>
              <View style={s.comodidades}>
                {acessorios.map((a) => (
                  <View key={a} style={s.comodidade}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={T.primary} />
                    <Text style={s.comodidadeTxt}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ENDEREÇO */}
          {!!enderecoCompleto && (
            <>
              <Text style={s.secao}>Endereço</Text>
              <View style={s.explica}>
                <Ionicons name="location-outline" size={18} color={T.primary} />
                <Text style={s.explicaTxt}>{enderecoCompleto}{itemAluguel?.cep ? ` · CEP ${itemAluguel.cep}` : ''}</Text>
              </View>
            </>
          )}

          {/* OBSERVAÇÕES DO ANFITRIÃO */}
          {!!itemAluguel?.observacoes && (
            <>
              <Text style={s.secao}>Observações</Text>
              <Text style={s.ajudaTxt}>{itemAluguel.observacoes}</Text>
            </>
          )}

          {/* 1. DATA */}
          <Text style={s.secao}>{ehAluguel ? (movel ? 'Escolha a data de retirada' : 'Escolha a data de entrada') : 'Horários disponíveis'}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
            {proximosDias.map((d) => {
              const on = dataSelecionada === d.valor;
              return (
                <TouchableOpacity key={d.valor} style={[s.dia, on && s.diaOn]} onPress={() => setDataSelecionada(d.valor)} activeOpacity={0.85}>
                  <Text style={[s.diaSemana, on && { color: T.primary }]}>{d.semana}</Text>
                  <Text style={[s.diaNum, on && { color: T.primary }]}>{d.dia}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.linhaCampos}>
            <View style={{ flex: 1 }}>
              <Text style={s.campoRotulo}>{ehAluguel ? (movel ? 'Data de retirada' : 'Data de entrada') : 'Data do serviço'}</Text>
              <TouchableOpacity style={s.campo} activeOpacity={0.8} onPress={() => setCalendarioAberto(true)}>
                <Ionicons name="calendar-outline" size={17} color={T.muted} />
                <Text style={[s.campoInput, !dataSelecionada && { color: T.faint }]}>{dataSelecionada || 'DD/MM/AAAA'}</Text>
              </TouchableOpacity>
              {calendarioAberto && (
                <DateTimePicker
                  value={parseDataBRparaDate(dataSelecionada)}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, d) => {
                    setCalendarioAberto(Platform.OS === 'ios');
                    if (d) setDataSelecionada(formatarDataParaBR(d));
                  }}
                />
              )}
            </View>
            {!ehAluguel && (
              <View style={{ flex: 1 }}>
                <Text style={s.campoRotulo}>Horário</Text>
                <View style={s.campo}>
                  <Ionicons name="time-outline" size={17} color={T.muted} />
                  <TextInput style={s.campoInput} value={horaAgendamento} onChangeText={(t) => aplicarMascaraHora(t, setHoraAgendamento)} placeholder="10:00" placeholderTextColor={T.faint} keyboardType="numeric" />
                </View>
              </View>
            )}
          </View>

          {!ehAluguel && buscandoHorarios && <ActivityIndicator size="small" color={T.primary} style={{ marginTop: 10 }} />}

          {!ehAluguel && !buscandoHorarios && horariosDisponiveis.length > 0 && (
            <View style={s.horarios}>
              {horariosDisponiveis.map((h) => {
                const on = horaAgendamento === h;
                return (
                  <TouchableOpacity key={h} style={[s.horario, on && s.horarioOn]} onPress={() => setHoraAgendamento(h)} activeOpacity={0.85}>
                    <Text style={[s.horarioTxt, on && { color: '#fff' }]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* SEM HORÁRIOS LIVRES: lista de espera (aviso quando alguém cancelar) */}
          {!ehAluguel && !buscandoHorarios && horariosDisponiveis.length === 0 && !!parseDataBRparaISO(dataAgendamento) && (
            <View style={s.espera}>
              <Ionicons name="notifications-outline" size={22} color={T.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.esperaTitulo}>{listaEsperaId ? 'Você está na lista de espera' : 'Sem horários livres nesta data'}</Text>
                <Text style={s.esperaTxt}>
                  {listaEsperaId
                    ? 'Avisamos você por notificação assim que abrir uma vaga. Quem entrar primeiro no app garante o horário.'
                    : 'Quer ser avisado se alguém cancelar? Entre na lista de espera.'}
                </Text>
              </View>
              {listaEsperaId ? (
                <TouchableOpacity style={s.esperaBtnSec} onPress={sairDaListaEspera} activeOpacity={0.8}>
                  <Text style={s.esperaBtnSecTxt}>Sair</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.esperaBtn, entrandoNaLista && { opacity: 0.6 }]} onPress={entrarNaListaEspera} disabled={entrandoNaLista} activeOpacity={0.85}>
                  {entrandoNaLista ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.esperaBtnTxt}>Me avisar</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}

          {ehAluguel && (
            <>
              <Text style={s.campoRotulo}>Período</Text>
              <View style={s.periodos}>
                {(['diaria', 'semanal', 'mensal'] as const).map((p) => (
                  <TouchableOpacity key={p} style={[s.periodo, tipoPeriodo === p && s.periodoOn]} onPress={() => setTipoPeriodo(p)} activeOpacity={0.85}>
                    <Text style={[s.periodoTxt, tipoPeriodo === p && { color: '#fff' }]}>{p === 'diaria' ? 'Diária' : p === 'semanal' ? 'Semanal' : 'Mensal'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.campoRotulo, { marginTop: 14 }]}>Quantidade de {tipoPeriodo === 'diaria' ? 'diárias' : tipoPeriodo === 'semanal' ? 'semanas' : 'meses'}</Text>
              <View style={s.campo}>
                <Ionicons name="repeat-outline" size={17} color={T.muted} />
                <TextInput style={s.campoInput} value={quantidadePeriodos} onChangeText={(t) => setQuantidadePeriodos(t.replace(/\D/g, ''))} keyboardType="numeric" placeholder="1" placeholderTextColor={T.faint} />
              </View>

              <Text style={[s.campoRotulo, { marginTop: 14 }]}>Pessoas</Text>
              <View style={s.campo}>
                <Ionicons name="people-outline" size={17} color={T.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.campoInput}>{pessoasAluguel} pessoa{pessoasAluguel > 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => setPessoasAluguel((p) => Math.max(1, p - 1))} style={s.stepperBtn}><Ionicons name="remove" size={16} color={T.ink} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setPessoasAluguel((p) => Math.min(itemAluguel?.capacidade_pessoas || itemAluguel?.lugares || 99, p + 1))} style={s.stepperBtn}><Ionicons name="add" size={16} color={T.ink} /></TouchableOpacity>
              </View>
              {!!(itemAluguel?.capacidade_pessoas || itemAluguel?.lugares) && (
                <Text style={s.ajudaTxt}>Capacidade máxima: {itemAluguel?.capacidade_pessoas || itemAluguel?.lugares} pessoas.</Text>
              )}
              {itemAluguel?.modelo_precificacao !== 'por_pessoa' && (calcularEstimativaAluguel().extraPessoas || 0) > 0 && (
                <Text style={s.ajudaTxt}>
                  {calcularEstimativaAluguel().extraPessoas} pessoa{(calcularEstimativaAluguel().extraPessoas || 0) > 1 ? 's' : ''} extra
                  {(calcularEstimativaAluguel().extraPessoas || 0) > 1 ? 's' : ''} × R$ {Number(itemAluguel?.valor_pessoa_extra || 0).toFixed(2).replace('.', ',')}/dia
                </Text>
              )}

              {periodoEsgotado && (
                <View style={s.esgotadoAviso}>
                  <Ionicons name="alert-circle" size={16} color={T.danger} />
                  <Text style={s.esgotadoAvisoTxt}>Esgotado nessas datas. Escolha outro período.</Text>
                </View>
              )}
            </>
          )}

          {/* PROFISSIONAL (opcional) */}
          {!ehAluguel && funcionarios.length > 0 && (
            <>
              <Text style={s.secao}>Profissional <Text style={s.opcional}>(opcional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {[{ id: 0, nome: 'Qualquer um', cargo: null }, ...funcionarios].map((f) => {
                  const on = (funcionarioId || 0) === f.id;
                  return (
                    <TouchableOpacity key={f.id} style={[s.metodoChip, { flex: 0, paddingHorizontal: 16 }, on && s.metodoChipOn]} onPress={() => setFuncionarioId(f.id || null)} activeOpacity={0.85}>
                      <Ionicons name="person-outline" size={16} color={on ? '#fff' : T.ink} />
                      <Text style={[s.metodoTxt, on && { color: '#fff' }]}>{f.nome}{f.cargo ? ` · ${f.cargo}` : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* 2. PAGAMENTO */}
          <Text style={s.secao}>Forma de pagamento</Text>
          {[
            { value: 'online_agora', label: 'Pagar online agora', desc: 'Pix, cartão em até 12x ou boleto, com cobrança segura pelo Asaas.', icone: 'shield-checkmark-outline' },
            { value: 'presencial', label: 'Pagar no local', desc: 'Pague diretamente no estabelecimento.', icone: 'storefront-outline' },
          ].map((opt) => {
            const on = formaPagamento === opt.value;
            return (
              <TouchableOpacity key={opt.value} style={[s.opcao, on && s.opcaoOn]} onPress={() => setFormaPagamento(opt.value as typeof formaPagamento)} activeOpacity={0.85}>
                <View style={[s.opcaoIcone, on && { backgroundColor: T.primary }]}>
                  <Ionicons name={opt.icone as never} size={19} color={on ? '#fff' : T.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTitulo}>{opt.label}</Text>
                  <Text style={s.opcaoDesc}>{opt.desc}</Text>
                </View>
                <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioMiolo} />}</View>
              </TouchableOpacity>
            );
          })}

          {formaPagamento === 'online_agora' && (
            <View style={s.metodosBox}>
              <View style={s.metodosLinha}>
                {([{ id: 'pix', rotulo: 'Pix', icone: 'qr-code-outline' }, { id: 'cartao', rotulo: 'Cartão', icone: 'card-outline' }, { id: 'boleto', rotulo: 'Boleto', icone: 'document-text-outline' }] as const).map((m) => {
                  const on = metodoPagamento === m.id;
                  return (
                    <TouchableOpacity key={m.id} style={[s.metodoChip, on && s.metodoChipOn]} onPress={() => setMetodoPagamento(m.id)} activeOpacity={0.85}>
                      <Ionicons name={m.icone as never} size={17} color={on ? '#fff' : T.ink} />
                      <Text style={[s.metodoTxt, on && { color: '#fff' }]}>{m.rotulo}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.explica}>
                <Ionicons name={metodoPagamento === 'cartao' ? 'card-outline' : metodoPagamento === 'pix' ? 'flash-outline' : 'time-outline'} size={18} color={T.primary} />
                <Text style={s.explicaTxt}>
                  {metodoPagamento === 'cartao'
                    ? 'Cobrança no cartão agora, em até 12x sem juros. Confirmação na hora.'
                    : metodoPagamento === 'pix'
                      ? 'Aprovação imediata: você recebe um QR Code para pagar pelo app do seu banco.'
                      : 'Compensa em até 2 dias úteis; a reserva confirma quando o pagamento for identificado.'}
                </Text>
              </View>

              {metodoPagamento === 'cartao' && (
                <View style={{ gap: 12, marginTop: 4 }}>
                  <View>
                    <Text style={s.campoRotuloForte}>Número do cartão</Text>
                    <TextInput style={s.cartaoInput} placeholder="0000 0000 0000 0000" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={23} autoComplete="cc-number"
                      value={cartao.numero} onChangeText={(t) => setCartao({ ...cartao, numero: t.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim() })} />
                  </View>
                  <View>
                    <Text style={s.campoRotuloForte}>Nome como está no cartão</Text>
                    <TextInput style={s.cartaoInput} placeholder="NOME SOBRENOME" placeholderTextColor={T.faint} autoCapitalize="characters" autoComplete="cc-name"
                      value={cartao.titular} onChangeText={(t) => setCartao({ ...cartao, titular: t.toUpperCase() })} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.campoRotuloForte}>Mês</Text>
                      <TextInput style={s.cartaoInput} placeholder="MM" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={2}
                        value={cartao.mes} onChangeText={(t) => setCartao({ ...cartao, mes: t.replace(/\D/g, '') })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.campoRotuloForte}>Ano</Text>
                      <TextInput style={s.cartaoInput} placeholder="AA" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={4}
                        value={cartao.ano} onChangeText={(t) => setCartao({ ...cartao, ano: t.replace(/\D/g, '') })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.campoRotuloForte}>Código (CVV)</Text>
                      <TextInput style={s.cartaoInput} placeholder="123" placeholderTextColor={T.faint} keyboardType="number-pad" maxLength={4} secureTextEntry
                        value={cartao.cvv} onChangeText={(t) => setCartao({ ...cartao, cvv: t.replace(/\D/g, '') })} />
                    </View>
                  </View>

                  <Text style={s.campoRotuloForte}>Em quantas parcelas?</Text>
                  {opcoesParcelas.length === 0 ? (
                    <Text style={s.ajudaTxt}>Calculando parcelas…</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {opcoesParcelas.map((o) => {
                        const on = parcelas === o.parcelas;
                        return (
                          <TouchableOpacity key={o.parcelas} style={[s.parcelaLinha, on && s.parcelaLinhaOn]} onPress={() => setParcelas(o.parcelas)} activeOpacity={0.85}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.parcelaTxt, on && { color: T.primary }]}>
                                {o.parcelas === 1 ? 'À vista' : `${o.parcelas}x de R$ ${o.valor_parcela.toFixed(2).replace('.', ',')}`}
                              </Text>
                              <Text style={s.parcelaSub}>{o.parcelas === 1 ? `R$ ${o.total.toFixed(2).replace('.', ',')}` : `sem juros · total R$ ${o.total.toFixed(2).replace('.', ',')}`}</Text>
                            </View>
                            <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioMiolo} />}</View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  <Text style={s.ajudaTxt}>Pagamento processado com segurança pelo Asaas. Os dados do cartão não ficam salvos.</Text>
                </View>
              )}
            </View>
          )}

          {/* 3. CUPOM E PONTOS */}
          <Text style={s.secao}>Cupom e pontos <Text style={s.opcional}>(opcional)</Text></Text>

          {cuponsRec.length > 0 && !cupomAtivo && (
            <View style={s.recBox}>
              <Text style={s.recTitulo}>Cupons para você</Text>
              {cuponsRec.map((c) => (
                <View key={c.id} style={s.recLinha}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recNome} numberOfLines={1}>{c.titulo}</Text>
                    <Text style={s.recSub}>
                      {c.tipo_desconto === 'percentual' ? `${c.valor_desconto}% OFF` : `R$ ${Number(c.valor_desconto).toFixed(2).replace('.', ',')} OFF`}
                      {c.escopo !== 'local' ? ' · exclusivo deste item' : ''}{c.apenas_plus ? ' · Premium' : ''}
                    </Text>
                  </View>
                  {c.bloqueado ? (
                    <Text style={s.recBloq}>Premium</Text>
                  ) : c.resgatado ? (
                    <TouchableOpacity style={s.recBtn} onPress={() => { setCupomInput(c.codigo); aplicarCupomCodigo(c.codigo); }}><Text style={s.recBtnTxt}>Aplicar</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.recBtn, { backgroundColor: T.ink }]} onPress={() => resgatarRecomendado(c)}>
                      <Text style={s.recBtnTxt}>{c.pontos_custo > 0 ? `Resgatar (${c.pontos_custo} pts)` : 'Resgatar grátis'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {cupomAtivo ? (
            <View style={s.cupomAtivo}>
              <Ionicons name="pricetag-outline" size={16} color={T.success} />
              <Text style={s.cupomAtivoTxt}>{cupomAtivo.codigo} aplicado</Text>
              <TouchableOpacity onPress={removerCupom}><Ionicons name="close" size={18} color={T.success} /></TouchableOpacity>
            </View>
          ) : (
            <View style={s.cupomLinha}>
              <TextInput style={s.cupomInput} value={cupomInput} onChangeText={(t) => setCupomInput(t.toUpperCase())} placeholder="Código do cupom" placeholderTextColor={T.faint} editable={!validandoCupom} autoCapitalize="characters" />
              <TouchableOpacity style={[s.cupomBtn, (!cupomInput.trim() || validandoCupom) && { opacity: 0.5 }]} onPress={aplicarCupom} disabled={!cupomInput.trim() || validandoCupom} activeOpacity={0.85}>
                {validandoCupom ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.cupomBtnTxt}>Aplicar</Text>}
              </TouchableOpacity>
            </View>
          )}
          {!!erroCupom && <Text style={s.erroCupom}>{erroCupom}</Text>}

          {aceitaPontos && saldoPontos > 0 && (
            <TouchableOpacity style={s.pontos} onPress={() => setUsarPontos(!usarPontos)} activeOpacity={0.85}>
              <View style={s.pontosIcone}><Ionicons name="gift-outline" size={18} color={T.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pontosTitulo}>Usar meus pontos</Text>
                <Text style={s.pontosDesc}>Você tem {saldoPontos} pontos disponíveis</Text>
              </View>
              <View style={[s.check, usarPontos && s.checkOn]}>{usarPontos && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
            </TouchableOpacity>
          )}

          {(descontoPontosPreview > 0 || descontoCupomPreview > 0) && (
            <View style={s.descontos}>
              {descontoPontosPreview > 0 && (
                <View style={s.descontoLinha}>
                  <Text style={s.descontoRotulo}>{pontosAplicaveisPreview} pontos usados</Text>
                  <Text style={s.descontoValor}>- R$ {descontoPontosPreview.toFixed(2).replace('.', ',')}</Text>
                </View>
              )}
              {descontoCupomPreview > 0 && (
                <View style={s.descontoLinha}>
                  <Text style={s.descontoRotulo}>Cupom {cupomAtivo?.codigo}</Text>
                  <Text style={s.descontoValor}>- R$ {descontoCupomPreview.toFixed(2).replace('.', ',')}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={s.termos} onPress={() => setTermosAceitos(!termosAceitos)} activeOpacity={0.85}>
            <View style={[s.check, termosAceitos && s.checkOn]}>{termosAceitos && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
            <Text style={s.termosTxt}>
              Li e concordo com os{' '}
              <Text style={s.link} onPress={abrirLink.bind(null, '/termos')}>termos de uso</Text> e{' '}
              <Text style={s.link} onPress={abrirLink.bind(null, '/privacidade')}>política de privacidade</Text>.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* RODAPÉ: TOTAL + BOTÃO */}
      <View style={s.rodape}>
        <View style={s.rodapeCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.rodapeRotulo}>Total {ehAluguel ? `(${quantidadePeriodos}x ${tipoPeriodo})` : 'a pagar'}</Text>
            <Text style={s.rodapeTotal}>R$ {totalFinalPreview.toFixed(2).replace('.', ',')}</Text>
          </View>
          <TouchableOpacity style={[s.btnReservar, (processando || periodoEsgotado) && { opacity: 0.7 }]} onPress={handleConfirmar} disabled={processando || periodoEsgotado} activeOpacity={0.88}>
            {processando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnReservarTxt}>{periodoEsgotado ? 'Esgotado' : formaPagamento !== 'online_agora' ? (ehAluguel ? 'Reservar' : 'Agendar') : metodoPagamento === 'cartao' ? (parcelas > 1 ? `Pagar ${parcelas}x` : 'Pagar no cartão') : metodoPagamento === 'pix' ? 'Pagar com Pix' : 'Gerar boleto'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  espera: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.primarySoft, borderRadius: 18, padding: 14, marginTop: 14 },
  esperaTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  esperaTxt: { fontSize: 12, color: T.muted, lineHeight: 17, marginTop: 2 },
  esperaBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  esperaBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  esperaBtnSec: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  esperaBtnSecTxt: { color: T.muted, fontWeight: '700', fontSize: 13 },
  metodosBox: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginTop: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  metodosLinha: { flexDirection: 'row', gap: 8 },
  metodoChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: T.cream, borderWidth: 1.5, borderColor: 'transparent' },
  metodoChipOn: { backgroundColor: T.primary, borderColor: T.primary },
  metodoTxt: { fontSize: 13, fontWeight: '700', color: T.ink },
  cartaoInput: { backgroundColor: T.cream, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15, fontSize: 16, color: T.ink, borderWidth: 1.5, borderColor: T.line },
  campoRotuloForte: { fontSize: 13, fontWeight: '700', color: T.ink, marginBottom: 6 },
  explica: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: T.primarySoft, borderRadius: 14, padding: 12, marginTop: 12, marginBottom: 10 },
  explicaTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: T.ink },
  parcelaSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  parcelasRotulo: { fontSize: 12, fontWeight: '800', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  parcelaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: T.line, backgroundColor: '#fff' },
  parcelaLinhaOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  parcelaTxt: { fontSize: 14, fontWeight: '600', color: T.ink },
  recBox: { backgroundColor: T.successBg, borderRadius: 18, padding: 12, marginBottom: 10, gap: 8 },
  recTitulo: { fontSize: 12, fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: 0.6 },
  recLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 10 },
  recNome: { fontSize: 14, fontWeight: '700', color: T.ink },
  recSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  recBtn: { backgroundColor: T.success, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  recBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  recBloq: { fontSize: 12, fontWeight: '700', color: T.faint },
  anfitriao: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 14, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  anfitriaoFoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  anfitriaoIni: { color: '#fff', fontWeight: '800', fontSize: 18 },
  anfitriaoNome: { fontSize: 15, fontWeight: '800', color: T.ink },
  anfitriaoSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  notaLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  notaGrande: { fontSize: 38, fontWeight: '900', color: T.ink, letterSpacing: -1 },
  criterioLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  criterioNome: { width: 110, fontSize: 13, color: T.muted },
  criterioBarra: { flex: 1, height: 6, borderRadius: 3, backgroundColor: T.line, overflow: 'hidden' },
  criterioPreench: { height: '100%', backgroundColor: T.ink },
  criterioNota: { width: 30, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },
  avaliacaoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  avaliacaoTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  avaliacaoAutor: { fontSize: 14, fontWeight: '700', color: T.ink },
  avaliacaoNota: { fontSize: 13, fontWeight: '800', color: T.star },
  avaliacaoData: { fontSize: 11, color: T.faint, marginTop: 2, textTransform: 'capitalize' },
  avaliacaoTxt: { fontSize: 13, color: T.muted, marginTop: 8, lineHeight: 19 },
  safe: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.cream, padding: 24 },
  erroIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  erroTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },
  btnRetry: { marginTop: 16, backgroundColor: T.primary, paddingHorizontal: 22, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btnRetryTxt: { color: '#fff', fontWeight: '800' },

  capa: { height: 270, backgroundColor: T.line },
  capaImg: { width: '100%', height: '100%' },
  capaSombra: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31,26,23,0.12)' },
  capaBotoes: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  circulo: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center' },

  painel: { backgroundColor: T.cream, marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22 },
  tagLinha: { flexDirection: 'row' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#F8D9C8' },
  tagTxt: { fontSize: 12, fontWeight: '700', color: T.tag, textTransform: 'capitalize' },
  nome: { fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.5, marginTop: 10 },
  metaLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 13, color: T.muted, fontWeight: '500' },
  precoLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  preco: { fontSize: 28, fontWeight: '800', color: T.primary, letterSpacing: -0.6 },
  precoUn: { fontSize: 14, color: T.muted },
  parcelaPrevia: { fontSize: 12, color: T.muted, marginTop: 4 },
  parcelaPreviaForte: { fontWeight: '800', color: T.ink },

  secao: { fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 24, marginBottom: 12, letterSpacing: -0.3 },
  opcional: { fontSize: 13, fontWeight: '500', color: T.muted },
  descricao: { fontSize: 14, color: T.muted, lineHeight: 22 },

  loja: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 20, padding: 12, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  lojaFoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.line },
  lojaNome: { fontSize: 15, fontWeight: '800', color: T.ink },
  lojaSub: { fontSize: 12, color: T.muted, marginTop: 2 },

  comodidades: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  comodidade: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  comodidadeTxt: { fontSize: 13, fontWeight: '600', color: T.ink },
  fichaTecnica: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.line, overflow: 'hidden' },
  fichaLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.line },
  fichaRotulo: { flex: 1, fontSize: 13, color: T.muted, fontWeight: '600' },
  fichaValor: { fontSize: 13, color: T.ink, fontWeight: '800' },

  dia: { width: 58, height: 72, borderRadius: 20, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  diaOn: { borderColor: T.primary, backgroundColor: T.primarySoft, borderWidth: 1.5 },
  diaSemana: { fontSize: 12, color: T.muted, fontWeight: '600' },
  diaNum: { fontSize: 20, fontWeight: '800', color: T.ink },

  linhaCampos: { flexDirection: 'row', gap: 12, marginTop: 14 },
  campoRotulo: { fontSize: 12, fontWeight: '700', color: T.muted, marginBottom: 6 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 12, height: 48 },
  campoInput: { flex: 1, fontSize: 14, color: T.ink },
  horarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  horario: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  horarioOn: { backgroundColor: T.primary, borderColor: T.primary },
  horarioTxt: { fontSize: 14, fontWeight: '700', color: T.ink },
  periodos: { flexDirection: 'row', gap: 8 },
  periodo: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  periodoOn: { backgroundColor: T.primary, borderColor: T.primary },
  periodoTxt: { fontSize: 13, fontWeight: '700', color: T.ink },
  stepperBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.cream, alignItems: 'center', justifyContent: 'center' },
  ajudaTxt: { fontSize: 11, color: T.muted, marginTop: 6 },
  esgotadoAviso: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 10, marginTop: 12 },
  esgotadoAvisoTxt: { fontSize: 12, fontWeight: '700', color: T.danger, flexShrink: 1 },

  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  opcaoOn: { borderColor: T.primary, backgroundColor: '#FFF8F4' },
  opcaoIcone: { width: 42, height: 42, borderRadius: 13, backgroundColor: T.cream, alignItems: 'center', justifyContent: 'center' },
  opcaoTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  opcaoDesc: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: T.primary },
  radioMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary },

  cupomLinha: { flexDirection: 'row', gap: 10 },
  cupomInput: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, paddingHorizontal: 14, fontSize: 14, color: T.ink },
  cupomBtn: { paddingHorizontal: 20, height: 48, borderRadius: 24, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  cupomBtnTxt: { color: '#fff', fontWeight: '800' },
  cupomAtivo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.successBg, borderRadius: 14, padding: 14 },
  cupomAtivoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: T.success },
  erroCupom: { fontSize: 12, color: T.danger, marginTop: 8 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.primarySoft, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#F8D9C8' },
  pontosIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pontosTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  pontosDesc: { fontSize: 12, color: T.muted, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: T.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkOn: { backgroundColor: T.primary, borderColor: T.primary },
  descontos: { backgroundColor: T.successBg, borderRadius: 14, padding: 12, marginTop: 12, gap: 6 },
  descontoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  descontoRotulo: { fontSize: 12, color: T.success, fontWeight: '600' },
  descontoValor: { fontSize: 12, color: T.success, fontWeight: '800' },

  termos: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  termosTxt: { flex: 1, fontSize: 12, color: T.muted, lineHeight: 18 },
  link: { color: T.primary, fontWeight: '700' },

  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10, backgroundColor: 'rgba(253,248,245,0.96)' },
  rodapeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: T.card, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: T.line, shadowColor: '#7C2D12', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  rodapeRotulo: { fontSize: 12, color: T.muted },
  rodapeTotal: { fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  btnReservar: { backgroundColor: T.primary, paddingHorizontal: 32, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  btnReservarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
