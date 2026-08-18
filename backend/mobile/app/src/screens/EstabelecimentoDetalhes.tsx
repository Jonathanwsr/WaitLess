import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Switch,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  star: '#F59E0B',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  textDark: '#1F2937',
  textMuted: '#9CA3AF'
};

const DEFAULT_PROFILE = 'https://images.unsplash.com/photo-1560026301-88340cf26b6b?q=80&w=1000&auto=format&fit=crop';
const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

// --- TIPAGENS TYPESCRIPT ---
interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil?: string;
  categoria?: string;
  ramo_atuacao?: string;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
  dias_funcionamento?: string;
  horario_abertura?: string;
  horario_fechamento?: string;
  comodidades?: string | string[];
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  locais_retirada_disponiveis?: string[];
}

interface ItemCatalogo {
  id: number;
  nome: string;
  descricao?: string;
  tipo?: string;
  valor?: number;
  valor_promocional?: number;
  desconto_percentual?: number;
  valor_diaria?: number;
  valor_caucao?: number;
  duracao_minutos?: number;
  foto?: string;
  foto_principal?: string;
  fotos?: string | string[];
  recursos_oferecidos?: string | string[];
  comodidades?: string | string[];
  locais_retirada?: string | string[];
  capacidade_pessoas?: number;
  numero_quartos?: number;
  mobiliado?: boolean;
  aceita_pet?: boolean;
  possui_ar_condicionado?: boolean;
}

interface ItemCarrinho extends ItemCatalogo {
  quantidade: number;
}

export default function CriarReserva() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const rawId = searchParams.id || searchParams.estabelecimentoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const rawTipo = searchParams.tipo;
  const tipo = Array.isArray(rawTipo) ? rawTipo[0] : (rawTipo || 'servico');

  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [servicos, setServicos] = useState<ItemCatalogo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modal de Detalhes do Serviço/Item
  const [modalItem, setModalItem] = useState<ItemCatalogo | null>(null);

  const [itensCarrinho, setItensCarrinho] = useState<ItemCarrinho[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);

  // Datas e Horários
  const [dataRetirada, setDataRetirada] = useState('');
  const [horarioRetirada, setHorarioRetirada] = useState('');
  const [dataDevolucao, setDataDevolucao] = useState('');
  const [horarioDevolucao, setHorarioDevolucao] = useState('');
  const [quantidadeDiarias, setQuantidadeDiarias] = useState(1);

  const [tipoEntrega, setTipoEntrega] = useState<'estabelecimento' | 'endereco'>('estabelecimento');

  // Endereço de Entrega
  const [cepEntrega, setCepEntrega] = useState('');
  const [ruaEntrega, setRuaEntrega] = useState('');
  const [numeroEntrega, setNumeroEntrega] = useState('');
  const [bairroEntrega, setBairroEntrega] = useState('');
  const [cidadeEntrega, setCidadeEntrega] = useState('');

  // Cliente
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);

  // Pontos
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [pontosAUsa, setPontosAUsa] = useState('');

  // Rota do perfil do estabelecimento
  const irParaPerfilEstabelecimento = () => {
    if (estabelecimento?.id) {
      router.push({
        pathname: '/src/screens/ServicoDetalhes',
        params: { id: estabelecimento.id }
      });
    }
  };

  // Helpers de Formatação e Máscaras
  const formatarDataBR = (dateObj: Date) => {
    const dia = String(dateObj.getDate()).padStart(2, '0');
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const ano = dateObj.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const parseDataBRparaISO = (dataBR: string) => {
    if (!dataBR) return '';
    const parts = dataBR.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dataBR;
  };

  const aplicarMascaraData = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2');
    if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    setter(v);
  };

  const aplicarMascaraHora = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1:$2');
    setter(v);
  };

  const aplicarMascaraCPF = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, '$1.$2');
    if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
    if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    setter(v);
  };

  const aplicarMascaraCelular = (text: string, setter: (v: string) => void) => {
    let v = text.replace(/\D/g, '');
    if (v.length > 0) v = v.replace(/^(\d)/, '($1');
    if (v.length > 2) v = v.replace(/^(\(\d{2})(\d)/, '$1) $2');
    if (v.length > 7) v = v.replace(/(\d{5})(\d)/, '$1-$2');
    setter(v);
  };

  // 1. Carrega Dados Iniciais
  useEffect(() => {
    if (id) {
      const hoje = new Date();
      setDataRetirada(formatarDataBR(hoje));
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      setDataDevolucao(formatarDataBR(amanha));

      carregarDados();
      carregarUsuarioDoBanco();
    } else {
      setLoading(false);
      setError(true);
    }
  }, [id]);

  // 2. Monitora mudanças de data
  useEffect(() => {
    if (!dataRetirada || !dataDevolucao) return;

    try {
      const dataIsoRetirada = parseDataBRparaISO(dataRetirada);
      const dataIsoDevolucao = parseDataBRparaISO(dataDevolucao);

      const d1 = new Date(dataIsoRetirada).getTime();
      const d2 = new Date(dataIsoDevolucao).getTime();

      if (!isNaN(d1) && !isNaN(d2)) {
        const diffTime = d2 - d1;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setQuantidadeDiarias(diffDays > 0 ? diffDays : 1);

        if (servicos.length > 0) {
          buscarHorariosDoBanco(dataIsoRetirada, servicos[0].id.toString(), tipo);
        }
      }
    } catch {
      setQuantidadeDiarias(1);
    }
  }, [dataRetirada, dataDevolucao, servicos]);

  const carregarUsuarioDoBanco = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

      const res = await fetch(`${cleanBaseUrl}/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });

      if (res.ok) {
        const userDb = await res.json();
        setNome(userDb.name || '');
        setEmail(userDb.email || '');
        aplicarMascaraCelular(userDb.mobile_phone || userDb.phone || userDb.telefone || '', setCelular);
        aplicarMascaraCPF(userDb.cpf_cnpj || '', setCpf);

        if (userDb.birth_date) {
          const parts = userDb.birth_date.split('-');
          if (parts.length === 3) setDataNascimento(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
      }
    } catch (e) {
      console.log('Erro ao ler user do banco:', e);
    }
  };

  const buscarHorariosDoBanco = async (dataString: string, servicoId: string, tipoBusca: string) => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${BASE_API}/horarios-disponiveis/${servicoId}?data=${dataString}&tipo=${tipoBusca}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const horarios = await res.json();
        setHorariosDisponiveis(horarios);
        if (horarios.length > 0) {
          setHorarioRetirada(horarios[0]);
          setHorarioDevolucao(horarios[0]);
        }
      }
    } catch (error) {
      console.log('Erro ao buscar horários:', error);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

      const res = await fetch(`${cleanBaseUrl}/mobile/estabelecimentos/${id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });

      const textResponse = await res.text();
      let json;
      try {
        json = JSON.parse(textResponse);
      } catch (e) {
        setError(true);
        setLoading(false);
        return;
      }

      if (res.ok) {
        const estData = json.estabelecimento || json.data || json;
        setEstabelecimento(estData);

        let listaCatalogo: ItemCatalogo[] = [];
        if (tipo === 'aluguel') {
          listaCatalogo = json.locacoes || json.itens_aluguel || [];
        } else {
          listaCatalogo = json.servicos || estData.servicos || [];
        }

        setServicos(listaCatalogo);

        const servicoIdUrl = searchParams.servicoId;
        if (servicoIdUrl) {
          const servicoExistente = listaCatalogo.find((s: any) => s.id.toString() === servicoIdUrl.toString());
          if (servicoExistente) adicionarAoCarrinho(servicoExistente, tipo);
        } else if (listaCatalogo.length > 0) {
          adicionarAoCarrinho(listaCatalogo[0], tipo);
        }

        buscarSaldoPontos(cleanBaseUrl, token, estData.id || id);
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const buscarSaldoPontos = async (baseUrl: string, token: string | null, estId: string) => {
    try {
      const res = await fetch(`${baseUrl}/mobile/pontos/saldo?estabelecimento_id=${estId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSaldoPontos(data.saldo || 0);
      }
    } catch (e) {}
  };

  // --- LÓGICA DE PREÇOS E PROMOÇÕES ---
  const obterPrecoEfetivo = (item: ItemCatalogo) => {
    if (item.valor_promocional && item.valor_promocional > 0) {
      return Number(item.valor_promocional);
    }
    return Number(item.valor || item.valor_diaria || 0);
  };

  const obterPrecoOriginal = (item: ItemCatalogo) => {
    return Number(item.valor || item.valor_diaria || 0);
  };

  // --- LÓGICA DO CARRINHO ---
  const adicionarAoCarrinho = (item: ItemCatalogo, tipoItem: string) => {
    setItensCarrinho(prev => {
      const itemJaExiste = prev.find(i => i.id === item.id && i.tipo === tipoItem);
      if (itemJaExiste) {
        return prev.map(i =>
          i.id === item.id && i.tipo === tipoItem ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      } else {
        return [...prev, { ...item, tipo: tipoItem, quantidade: 1 }];
      }
    });
  };

  const removerDoCarrinho = (itemId: number, tipoItem: string) => {
    setItensCarrinho(prev => {
      const itemExistente = prev.find(i => i.id === itemId && i.tipo === tipoItem);
      if (!itemExistente) return prev;

      if (itemExistente.quantidade > 1) {
        return prev.map(i =>
          i.id === itemId && i.tipo === tipoItem ? { ...i, quantidade: i.quantidade - 1 } : i
        );
      } else {
        return prev.filter(i => !(i.id === itemId && i.tipo === tipoItem));
      }
    });
  };

  const getItemQuantidade = (itemId: number, tipoItem: string) => {
    const item = itensCarrinho.find(i => i.id === itemId && i.tipo === tipoItem);
    return item ? item.quantidade : 0;
  };

  const calcularTotalBruto = () => {
    let valorTotal = 0;
    itensCarrinho.forEach(item => {
      const precoUnitario = obterPrecoEfetivo(item);
      let precoCalculado = precoUnitario * item.quantidade;

      if (item.tipo === 'aluguel') {
        precoCalculado = precoCalculado * quantidadeDiarias;
        if (item.valor_caucao) {
          precoCalculado += Number(item.valor_caucao);
        }
      }
      valorTotal += precoCalculado;
    });
    return valorTotal;
  };

  const totalCalculado = calcularTotalBruto();
  const descontoPontosVisual = usarPontos && pontosAUsa ? (Number(pontosAUsa) * 0.01) : 0;
  const totalFinalLiquido = Math.max(0, totalCalculado - descontoPontosVisual);

  const handleFinalizar = async () => {
    if (!aceitouTermos) {
      Alert.alert('Atenção', 'Você precisa aceitar os termos de uso para continuar.');
      return;
    }

    if (itensCarrinho.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um item ao pedido.');
      return;
    }

    if (!dataRetirada || !horarioRetirada) {
      Alert.alert('Atenção', 'Preencha a data e horário corretamente.');
      return;
    }

    if (usarPontos && pontosAUsa && Number(pontosAUsa) > saldoPontos) {
      Alert.alert('Erro', 'Você não tem essa quantidade de pontos.');
      return;
    }

    setIsProcessing(true);

    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

      const dataRetiradaISO = parseDataBRparaISO(dataRetirada);
      const dataDevolucaoISO = parseDataBRparaISO(dataDevolucao);

      const itensFormatados = itensCarrinho.map(item => {
        const baseItem = { tipo: item.tipo, id: item.id, quantidade: item.quantidade };

        if (item.tipo === 'servico') {
          return {
            ...baseItem,
            data_agendamento: dataRetiradaISO,
            hora_agendamento: horarioRetirada
          };
        } else if (item.tipo === 'aluguel') {
          return {
            ...baseItem,
            data_inicio: dataRetiradaISO,
            data_fim: dataDevolucaoISO,
            tipo_periodo: 'diaria',
            quantidade_periodos: quantidadeDiarias
          };
        }
        return baseItem;
      });

      const payload = {
        estabelecimento_id: estabelecimento?.id,
        forma_pagamento: 'online',
        usar_pontos: usarPontos,
        pontos_a_usar: usarPontos ? Number(pontosAUsa) : null,
        itens: itensFormatados,
        tipo_entrega: tipoEntrega,
        ...(tipoEntrega === 'endereco' && {
          cep_entrega: cepEntrega,
          rua_entrega: ruaEntrega,
          numero_entrega: numeroEntrega,
          bairro_entrega: bairroEntrega,
          cidade_entrega: cidadeEntrega
        })
      };

      const res = await fetch(`${cleanBaseUrl}/mobile/checkout/misto`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        router.push({
          pathname: '/src/screens/PagamentoScreen',
          params: {
            agendamento_id: data.pagamento_id,
            valor_total: data.resumo_financeiro?.valor_total || totalFinalLiquido,
            codigo_pedido: data.codigo_pedido
          }
        });
      } else {
        Alert.alert('Erro', data.error || 'Falha ao processar reserva.');
      }
    } catch (e) {
      console.error('Erro Finalizar', e);
      Alert.alert('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </View>
    );
  }

  if (error || !estabelecimento) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={56} color={COLORS.gray} />
        <Text style={styles.errorText}>Não foi possível carregar as informações do estabelecimento.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={carregarDados}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const temAluguelNoCarrinho = itensCarrinho.some(i => i.tipo === 'aluguel');
  const itemPrincipal = itensCarrinho.length > 0 ? itensCarrinho[0] : servicos[0];

  let recursosStr = '';
  if (itemPrincipal?.recursos_oferecidos) {
    if (Array.isArray(itemPrincipal.recursos_oferecidos)) {
      recursosStr = itemPrincipal.recursos_oferecidos.join(' • ');
    } else if (typeof itemPrincipal.recursos_oferecidos === 'string') {
      try {
        const parsed = JSON.parse(itemPrincipal.recursos_oferecidos);
        recursosStr = Array.isArray(parsed) ? parsed.join(' • ') : itemPrincipal.recursos_oferecidos;
      } catch (e) {
        recursosStr = itemPrincipal.recursos_oferecidos;
      }
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeHeader}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar Reserva</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.headerSubtitle}>Preencha os detalhes para agendar ou alugar.</Text>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190, paddingHorizontal: 16 }}>

          {/* 👉 LINK/CARD PERFIL DO ESTABELECIMENTO */}
          <TouchableOpacity
            style={styles.estCard}
            activeOpacity={0.85}
            onPress={irParaPerfilEstabelecimento}
          >
            <View style={styles.estCardHeader}>
              <Image source={{ uri: estabelecimento.foto_perfil || DEFAULT_PROFILE }} style={styles.estImage} />
              <View style={styles.estInfo}>
                <View style={styles.estNomeRow}>
                  <Text style={styles.estNome} numberOfLines={1}>{estabelecimento.nome}</Text>
                  <Feather name="chevron-right" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.estCategoria}>
                  {estabelecimento.ramo_atuacao || estabelecimento.categoria || 'Serviços & Atendimento'}
                </Text>

                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={COLORS.star} />
                  <Text style={styles.ratingScore}>{estabelecimento.avaliacao_media || '4.8'}</Text>
                  <Text style={styles.ratingCount}>({estabelecimento.total_avaliacoes || 0} avaliações)</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>A partir de </Text>
                  <Text style={styles.priceValue}>
                    R$ {Number(servicos[0]?.valor_promocional || servicos[0]?.valor || servicos[0]?.valor_diaria || 0).toFixed(2).replace('.', ',')}
                  </Text>
                  {tipo === 'aluguel' && <Text style={styles.priceLabel}> /dia</Text>}
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* 👉 HORÁRIOS E DIAS DE FUNCIONAMENTO */}
          <View style={styles.operationInfoBox}>
            <View style={styles.operationRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.operationText}>
                Funcionamento: <Text style={styles.boldText}>{estabelecimento.dias_funcionamento || 'Segunda a Sábado'}</Text>
              </Text>
            </View>
            <View style={[styles.operationRow, { marginTop: 6 }]}>
              <Ionicons name="time-outline" size={16} color={COLORS.primary} />
              <Text style={styles.operationText}>
                Horário: <Text style={styles.boldText}>{estabelecimento.horario_abertura || '08:00'} às {estabelecimento.horario_fechamento || '18:00'}</Text>
              </Text>
            </View>
          </View>

          {/* 👉 TAGS / COMODIDADES DO ESTABELECIMENTO */}
          <View style={styles.tagsContainer}>
            {tipo === 'aluguel' ? (
              <View style={styles.tagsGrid}>
                {itemPrincipal?.capacidade_pessoas && (
                  <View style={styles.tagChip}>
                    <Ionicons name="people" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>{itemPrincipal.capacidade_pessoas} Pessoas</Text>
                  </View>
                )}
                {itemPrincipal?.mobiliado && (
                  <View style={styles.tagChip}>
                    <Ionicons name="bed" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>Mobiliado</Text>
                  </View>
                )}
                {itemPrincipal?.aceita_pet && (
                  <View style={styles.tagChip}>
                    <Ionicons name="paw" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>Pet Friendly</Text>
                  </View>
                )}
                {recursosStr ? <Text style={styles.tagsSubText}>{recursosStr}</Text> : null}
              </View>
            ) : (
              estabelecimento.comodidades ? (
                <View style={styles.tagsGrid}>
                  <View style={styles.tagChip}>
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.tagText}>{String(estabelecimento.comodidades).slice(0, 35)}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.tagsSubText}>✓ Atendimento personalizado • Garantia de reserva</Text>
              )
            )}
          </View>

          {/* SEÇÃO 1: ESCOLHA A DATA E HORÁRIO */}
          <Text style={styles.sectionTitle}>1. Escolha a data e horário</Text>
          <View style={styles.datePickerBox}>
            <View style={styles.datePickerRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{temAluguelNoCarrinho ? 'Data de retirada' : 'Data do Serviço'}</Text>
                <View style={styles.dateSelector}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.gray} />
                  <TextInput
                    style={styles.timeInput}
                    value={dataRetirada}
                    onChangeText={(t) => aplicarMascaraData(t, setDataRetirada)}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Horário</Text>
                <View style={styles.dateSelector}>
                  <Ionicons name="time-outline" size={18} color={COLORS.gray} />
                  <TextInput
                    style={styles.timeInput}
                    value={horarioRetirada}
                    onChangeText={(t) => aplicarMascaraHora(t, setHorarioRetirada)}
                    placeholder="10:00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>

            {temAluguelNoCarrinho && (
              <View style={[styles.datePickerRow, { marginTop: 12 }]}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Data de devolução</Text>
                  <View style={styles.dateSelector}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.gray} />
                    <TextInput
                      style={styles.timeInput}
                      value={dataDevolucao}
                      onChangeText={(t) => aplicarMascaraData(t, setDataDevolucao)}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Horário devolução</Text>
                  <View style={styles.dateSelector}>
                    <Ionicons name="time-outline" size={18} color={COLORS.gray} />
                    <TextInput
                      style={styles.timeInput}
                      value={horarioDevolucao}
                      onChangeText={(t) => aplicarMascaraHora(t, setHorarioDevolucao)}
                      placeholder="10:00"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>
            )}

            {temAluguelNoCarrinho && (
              <View style={styles.periodBanner}>
                <Ionicons name="time" size={16} color={COLORS.primary} />
                <Text style={styles.periodText}>Período selecionado: {quantidadeDiarias} diária(s)</Text>
              </View>
            )}

            {/* HORÁRIOS LIVRES */}
            {horariosDisponiveis.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Horários sugeridos:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {horariosDisponiveis.map(h => (
                    <TouchableOpacity
                      key={h}
                      onPress={() => setHorarioRetirada(h)}
                      style={[
                        styles.chipHorario,
                        horarioRetirada === h && styles.chipHorarioActive
                      ]}
                    >
                      <Text style={[styles.chipHorarioText, horarioRetirada === h && styles.chipHorarioTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* SEÇÃO 2: LOCAL DE RETIRADA / DEVOLUÇÃO */}
          <Text style={styles.sectionTitle}>2. Local de retirada / devolução</Text>
          <View style={styles.optionsBox}>
            <TouchableOpacity
              style={[styles.optionRow, tipoEntrega === 'estabelecimento' && styles.optionRowActive]}
              onPress={() => setTipoEntrega('estabelecimento')}
            >
              <View style={[styles.radio, tipoEntrega === 'estabelecimento' && styles.radioActive]}>
                {tipoEntrega === 'estabelecimento' && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.optionTitle}>Retirar no estabelecimento</Text>
                <Text style={styles.optionSub}>
                  {estabelecimento?.rua ? `${estabelecimento.rua}, ${estabelecimento.numero || 'S/N'} - ${estabelecimento.bairro || ''}, ${estabelecimento.cidade || ''}` : 'Endereço principal do estabelecimento'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, tipoEntrega === 'endereco' && styles.optionRowActive, { marginTop: 10 }]}
              onPress={() => setTipoEntrega('endereco')}
            >
              <View style={[styles.radio, tipoEntrega === 'endereco' && styles.radioActive]}>
                {tipoEntrega === 'endereco' && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.optionTitle}>Entrega no meu endereço</Text>
                <Text style={styles.optionSub}>Informe onde deseja receber o serviço/item</Text>
              </View>
            </TouchableOpacity>

            {/* FORMULÁRIO DE ENDEREÇO DE ENTREGA */}
            {tipoEntrega === 'endereco' && (
              <View style={styles.addressFormContainer}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CEP</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.textInput} placeholder="00000-000" placeholderTextColor={COLORS.textMuted} value={cepEntrega} onChangeText={setCepEntrega} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Número</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.textInput} placeholder="123" placeholderTextColor={COLORS.textMuted} value={numeroEntrega} onChangeText={setNumeroEntrega} keyboardType="numeric" />
                    </View>
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Rua / Logradouro</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.textInput} placeholder="Nome da rua" placeholderTextColor={COLORS.textMuted} value={ruaEntrega} onChangeText={setRuaEntrega} />
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Bairro</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.textInput} placeholder="Seu bairro" placeholderTextColor={COLORS.textMuted} value={bairroEntrega} onChangeText={setBairroEntrega} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Cidade</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.textInput} placeholder="Sua cidade" placeholderTextColor={COLORS.textMuted} value={cidadeEntrega} onChangeText={setCidadeEntrega} />
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* SEÇÃO 3: CATÁLOGO DE SERVIÇOS / ITENS */}
          <Text style={styles.sectionTitle}>
            {tipo === 'aluguel' ? '3. Selecione os itens para aluguel' : '3. Selecione os serviços'}
          </Text>
          <View style={styles.catalogContainer}>
            {servicos.length === 0 ? (
              <View style={styles.emptyCatalogBox}>
                <Ionicons name="briefcase-outline" size={32} color={COLORS.gray} />
                <Text style={styles.emptyCatalogText}>Nenhum item disponível no catálogo momento.</Text>
              </View>
            ) : (
              servicos.map((item) => {
                const qtd = getItemQuantidade(item.id, tipo);
                const precoEfetivo = obterPrecoEfetivo(item);
                const precoOriginal = obterPrecoOriginal(item);
                const temDesconto = item.valor_promocional && item.valor_promocional < precoOriginal;

                return (
                  <View key={item.id} style={styles.itemCard}>
                    <TouchableOpacity
                      style={styles.itemCardContent}
                      onPress={() => setModalItem(item)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.foto_principal || item.foto || DEFAULT_PROFILE }}
                        style={styles.itemImage}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.nome}</Text>
                        {item.descricao ? (
                          <Text style={styles.itemDesc} numberOfLines={2}>{item.descricao}</Text>
                        ) : null}

                        <View style={styles.itemPriceRow}>
                          <Text style={styles.itemPrice}>
                            R$ {precoEfetivo.toFixed(2).replace('.', ',')}
                          </Text>
                          {temDesconto && (
                            <Text style={styles.itemOldPrice}>
                              R$ {precoOriginal.toFixed(2).replace('.', ',')}
                            </Text>
                          )}
                          {tipo === 'aluguel' && <Text style={styles.itemPriceUnit}>/dia</Text>}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* CONTROLES DE QUANTIDADE DO CARRINHO */}
                    <View style={styles.quantityContainer}>
                      {qtd > 0 && (
                        <>
                          <TouchableOpacity
                            style={styles.qtdButton}
                            onPress={() => removerDoCarrinho(item.id, tipo)}
                          >
                            <Ionicons name="remove" size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                          <Text style={styles.qtdText}>{qtd}</Text>
                        </>
                      )}
                      <TouchableOpacity
                        style={[styles.qtdButton, styles.qtdButtonAdd]}
                        onPress={() => adicionarAoCarrinho(item, tipo)}
                      >
                        <Ionicons name="add" size={18} color={COLORS.cardBg} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* SEÇÃO 4: SEUS DADOS */}
          <Text style={styles.sectionTitle}>4. Seus Dados</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Nome Completo</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CPF</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={cpf}
                    onChangeText={(t) => aplicarMascaraCPF(t, setCpf)}
                    placeholder="000.000.000-00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    maxLength={14}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Data Nasc.</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={dataNascimento}
                    onChangeText={(t) => aplicarMascaraData(t, setDataNascimento)}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>E-mail</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Celular / WhatsApp</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={celular}
                onChangeText={(t) => aplicarMascaraCelular(t, setCelular)}
                placeholder="(00) 00000-0000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                maxLength={15}
              />
            </View>
          </View>

          {/* SEÇÃO 5: PROGRAMA DE PONTOS */}
          {saldoPontos > 0 && (
            <>
              <Text style={styles.sectionTitle}>5. Programa de Pontos</Text>
              <View style={styles.pointsCard}>
                <View style={styles.pointsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <MaterialCommunityIcons name="star-circle" size={24} color={COLORS.star} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pointsTitle}>Usar saldo de pontos</Text>
                      <Text style={styles.pointsSubtitle}>Você possui {saldoPontos} pontos disponível(is)</Text>
                    </View>
                  </View>
                  <Switch
                    value={usarPontos}
                    onValueChange={setUsarPontos}
                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                    thumbColor={usarPontos ? COLORS.primary : COLORS.gray}
                  />
                </View>

                {usarPontos && (
                  <View style={styles.pointsInputRow}>
                    <TextInput
                      style={styles.pointsInput}
                      value={pontosAUsa}
                      onChangeText={setPontosAUsa}
                      placeholder={`Máx. ${saldoPontos}`}
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.maxPointsBtn}
                      onPress={() => setPontosAUsa(saldoPontos.toString())}
                    >
                      <Text style={styles.maxPointsText}>Usar Máximo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}

          {/* SEÇÃO 6: TERMOS E CONDIÇÕES */}
          <View style={styles.termsBox}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAceitouTermos(!aceitouTermos)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={aceitouTermos ? "checkbox" : "square-outline"}
                size={22}
                color={aceitouTermos ? COLORS.primary : COLORS.gray}
              />
              <Text style={styles.termsText}>
                Li e concordo com os <Text style={styles.termsLink}>Termos de Uso</Text> e a <Text style={styles.termsLink}>Política de Cancelamento</Text>.
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL DE DETALHES DO ITEM */}
      <Modal
        visible={!!modalItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalItem(null)}>
              <Ionicons name="close" size={24} color={COLORS.secondary} />
            </TouchableOpacity>

            {modalItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: modalItem.foto_principal || modalItem.foto || DEFAULT_PROFILE }}
                  style={styles.modalImage}
                />
                <Text style={styles.modalTitle}>{modalItem.nome}</Text>
                <Text style={styles.modalPrice}>
                  R$ {obterPrecoEfetivo(modalItem).toFixed(2).replace('.', ',')}
                  {tipo === 'aluguel' ? ' / dia' : ''}
                </Text>

                {modalItem.descricao ? (
                  <Text style={styles.modalDescription}>{modalItem.descricao}</Text>
                ) : null}

                {modalItem.valor_caucao ? (
                  <View style={styles.modalBadgeRow}>
                    <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
                    <Text style={styles.modalBadgeText}>
                      Caução: R$ {Number(modalItem.valor_caucao).toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.modalAddButton}
                  onPress={() => {
                    adicionarAoCarrinho(modalItem, tipo);
                    setModalItem(null);
                  }}
                >
                  <Text style={styles.modalAddButtonText}>Adicionar ao Pedido</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* BARRA FIXA INFERIOR COM RESUMO DE VALORES E CONFIRMAÇÃO */}
      <View style={styles.footerBar}>
        <View style={styles.footerPriceContainer}>
          <Text style={styles.footerTotalLabel}>Total a Pagar</Text>
          <Text style={styles.footerTotalValue}>
            R$ {totalFinalLiquido.toFixed(2).replace('.', ',')}
          </Text>
          {descontoPontosVisual > 0 && (
            <Text style={styles.footerDiscountText}>
              (Desconto de R$ {descontoPontosVisual.toFixed(2).replace('.', ',')} aplicado)
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            (isProcessing || !aceitouTermos || itensCarrinho.length === 0) && styles.checkoutBtnDisabled
          ]}
          onPress={handleFinalizar}
          disabled={isProcessing || !aceitouTermos || itensCarrinho.length === 0}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.checkoutBtnText}>Confirmar Reserva</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- ESTILOS COMPLETO DA TELA ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '500'
  },
  errorText: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  safeHeader: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center'
  },
  estCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  estCardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  estImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray
  },
  estInfo: {
    flex: 1,
    marginLeft: 12
  },
  estNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  estNome: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1
  },
  estCategoria: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    marginLeft: 4
  },
  ratingCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 4
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4
  },
  priceLabel: {
    fontSize: 11,
    color: COLORS.gray
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary
  },
  operationInfoBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  operationRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  operationText: {
    fontSize: 13,
    color: COLORS.textDark,
    marginLeft: 8
  },
  boldText: {
    fontWeight: '600',
    color: COLORS.secondary
  },
  tagsContainer: {
    marginTop: 8
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center'
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 4
  },
  tagsSubText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 20,
    marginBottom: 10
  },
  datePickerBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 10
  },
  inputGroup: {
    flex: 1
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 6
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  timeInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 6
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    borderRadius: 8,
    marginTop: 12
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6
  },
  chipHorario: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  chipHorarioActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipHorarioText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '500'
  },
  chipHorarioTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  optionsBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FAF9F8'
  },
  optionRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center'
  },
  radioActive: {
    borderColor: COLORS.primary
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary
  },
  optionSub: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2
  },
  addressFormContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4
  },
  inputBox: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  textInput: {
    fontSize: 14,
    color: COLORS.secondary
  },
  catalogContainer: {
    gap: 10
  },
  emptyCatalogBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  emptyCatalogText: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 8
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  itemCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemImage: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary
  },
  itemDesc: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    gap: 4
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary
  },
  itemOldPrice: {
    fontSize: 11,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through'
  },
  itemPriceUnit: {
    fontSize: 11,
    color: COLORS.gray
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6
  },
  qtdButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  qtdButtonAdd: {
    backgroundColor: COLORS.primary
  },
  qtdText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    minWidth: 18,
    textAlign: 'center'
  },
  formCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  pointsCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pointsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary
  },
  pointsSubtitle: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2
  },
  pointsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10
  },
  pointsInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  maxPointsBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  maxPointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary
  },
  termsBox: {
    marginTop: 16,
    marginBottom: 10
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  termsText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: 8,
    flex: 1
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%'
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    padding: 4
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: COLORS.lightGray
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary
  },
  modalPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4
  },
  modalDescription: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 10,
    lineHeight: 18
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: 8,
    borderRadius: 6,
    marginTop: 12
  },
  modalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6
  },
  modalAddButton: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20
  },
  modalAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  footerPriceContainer: {
    flex: 1
  },
  footerTotalLabel: {
    fontSize: 11,
    color: COLORS.gray,
    textTransform: 'uppercase'
  },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.secondary
  },
  footerDiscountText: {
    fontSize: 10,
    color: COLORS.green,
    fontWeight: '600'
  },
  checkoutBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  checkoutBtnDisabled: {
    backgroundColor: COLORS.textMuted
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  }
});