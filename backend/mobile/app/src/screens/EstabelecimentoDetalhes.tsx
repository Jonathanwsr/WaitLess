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
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF5A00',      // Laranja Principal
  primaryLight: '#FFF0E6', 
  secondary: '#111827',    
  gray: '#6B7280',
  lightGray: '#F8F9FA',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  star: '#10B981',         // Estrela verde
  green: '#10B981',        
  greenLight: '#ECFDF5'
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_PROFILE = 'https://images.unsplash.com/photo-1560026301-88340cf26b6b?q=80&w=1000&auto=format&fit=crop';
const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

export default function CriarReserva() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const rawId = searchParams.id || searchParams.estabelecimentoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  
  const rawTipo = searchParams.tipo;
  const tipo = Array.isArray(rawTipo) ? rawTipo[0] : (rawTipo || 'servico');

  // Estados
  const [estabelecimento, setEstabelecimento] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carrinho Misto
  const [itensCarrinho, setItensCarrinho] = useState<any[]>([]);

  // Horários do Backend
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

  // Dados do Cliente (Vindos do Banco de Dados)
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [pontosAUsa, setPontosAUsa] = useState('');

  // 1. Carrega Dados Iniciais
  useEffect(() => {
    if (id) {
      // Define a data inicial como hoje formato AAAA-MM-DD
      const hoje = new Date();
      const dataString = hoje.toISOString().split('T')[0];
      setDataRetirada(dataString);
      
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      setDataDevolucao(amanha.toISOString().split('T')[0]);

      carregarDados();
      carregarUsuarioDoBanco();
    } else {
      setLoading(false);
      setError(true);
    }
  }, [id]);

  // 2. Monitora mudanças na data para recalcular diárias e buscar horários
  useEffect(() => {
    if(!dataRetirada || !dataDevolucao) return;
    
    try {
      const d1 = new Date(dataRetirada).getTime();
      const d2 = new Date(dataDevolucao).getTime();
      const diffTime = d2 - d1;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setQuantidadeDiarias(diffDays > 0 ? diffDays : 1);
      
      // Busca os horários livres no backend para a data selecionada
      if (servicos.length > 0) {
        buscarHorariosDoBanco(dataRetirada, servicos[0].id);
      }
    } catch {
      setQuantidadeDiarias(1);
    }
  }, [dataRetirada, dataDevolucao, servicos]);

  // 👉 BUSCA O USUÁRIO DIRETAMENTE DA API PARA GARANTIR DADOS REAIS
  const carregarUsuarioDoBanco = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
      
      const res = await fetch(`${cleanBaseUrl}/user`, { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json' 
        }
      });

      if (res.ok) {
        const userDb = await res.json();
        setNome(userDb.name || '');
        setEmail(userDb.email || '');
        setCelular(userDb.mobile_phone || userDb.phone || userDb.telefone || '');
        setCpf(userDb.cpf_cnpj || '');
        
        if (userDb.birth_date) {
            const parts = userDb.birth_date.split('-');
            if(parts.length === 3) setDataNascimento(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
      }
    } catch (e) {
      console.log('Erro ao ler user do banco:', e);
    }
  };

  // 👉 BUSCA HORÁRIOS LIVRES NO CONTROLLER
  const buscarHorariosDoBanco = async (dataString: string, servicoId: string) => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${BASE_API}/horarios-disponiveis/${servicoId}?data=${dataString}`, {
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

      // Requisição do Estabelecimento
      const res = await fetch(`${cleanBaseUrl}/mobile/estabelecimentos/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const textResponse = await res.text();
      let json;
      try {
        json = JSON.parse(textResponse);
      } catch (e) {
        console.log("Erro HTML retornado pela API", textResponse.substring(0, 200));
        setError(true);
        setLoading(false);
        return;
      }

      if (res.ok) {
        const estData = json.estabelecimento || json.data || json;
        setEstabelecimento(estData);

        // Puxa lista de serviços/locações do banco
        let listaCatalogo = [];
        if (tipo === 'aluguel') {
            listaCatalogo = json.locacoes || json.itens_aluguel || [];
        } else {
            listaCatalogo = json.servicos || estData.servicos || [];
        }
        
        setServicos(listaCatalogo);
        
        const servicoIdUrl = searchParams.servicoId;
        if (servicoIdUrl) {
            const servicoExistente = listaCatalogo.find((s:any) => s.id.toString() === servicoIdUrl.toString());
            if(servicoExistente) adicionarAoCarrinho(servicoExistente, tipo);
        } else if (listaCatalogo.length > 0) {
            adicionarAoCarrinho(listaCatalogo[0], tipo);
        }

        buscarSaldoPontos(cleanBaseUrl, token, estData.id || id);
      } else {
        setError(true);
      }
    } catch (e) {
      console.log('Erro ao carregar dados:', e);
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
        if(res.ok) {
            const data = await res.json();
            setSaldoPontos(data.saldo || 0);
        }
      } catch (e) {
          console.log("Falha ao buscar pontos", e);
      }
  }

  // Lógica do Calendário (TextInput substituindo Native Picker)
  const formatarDataBR = (dataYMD: string) => {
      if(!dataYMD) return '';
      const parts = dataYMD.split('-');
      if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dataYMD;
  }

  // --- CARRINHO LOGIC ---
  const adicionarAoCarrinho = (item: any, tipoItem: string) => {
      const itemJaExiste = itensCarrinho.find(i => i.id === item.id && i.tipo === tipoItem);
      if (itemJaExiste) {
          setItensCarrinho(itensCarrinho.map(i => 
              i.id === item.id && i.tipo === tipoItem ? { ...i, quantidade: i.quantidade + 1 } : i
          ));
      } else {
          setItensCarrinho([...itensCarrinho, { ...item, tipo: tipoItem, quantidade: 1 }]);
      }
  };

  const removerDoCarrinho = (itemId: number, tipoItem: string) => {
      const itemExistente = itensCarrinho.find(i => i.id === itemId && i.tipo === tipoItem);
      if(!itemExistente) return;

      if (itemExistente.quantidade > 1) {
          setItensCarrinho(itensCarrinho.map(i => 
              i.id === itemId && i.tipo === tipoItem ? { ...i, quantidade: i.quantidade - 1 } : i
          ));
      } else {
          setItensCarrinho(itensCarrinho.filter(i => !(i.id === itemId && i.tipo === tipoItem)));
      }
  };

  const calcularTotalBruto = () => {
    let valorTotal = 0;
    itensCarrinho.forEach(item => {
      const precoUnitario = Number(item.valor || item.valor_diaria || 0);
      let precoCalculado = precoUnitario * item.quantidade;
      
      if (item.tipo === 'aluguel') {
          precoCalculado = precoCalculado * quantidadeDiarias;
          if(item.valor_caucao) {
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

    if(usarPontos && pontosAUsa && Number(pontosAUsa) > saldoPontos) {
        Alert.alert('Erro', 'Você não tem essa quantidade de pontos.');
        return;
    }

    setIsProcessing(true);

    try {
        const token = await AsyncStorage.getItem('@waitless_token');
        const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

        const itensFormatados = itensCarrinho.map(item => {
            const baseItem = { tipo: item.tipo, id: item.id, quantidade: item.quantidade };

            if (item.tipo === 'servico') {
                return {
                    ...baseItem,
                    data_agendamento: dataRetirada,
                    hora_agendamento: horarioRetirada
                };
            } else if (item.tipo === 'aluguel') {
                return {
                    ...baseItem,
                    data_inicio: dataRetirada,
                    data_fim: dataDevolucao,
                    tipo_periodo: 'diaria',
                    quantidade_periodos: quantidadeDiarias
                };
            }
            return baseItem;
        });

        const payload = {
            estabelecimento_id: estabelecimento.id,
            forma_pagamento: 'online', 
            usar_pontos: usarPontos,
            pontos_a_usar: usarPontos ? Number(pontosAUsa) : null,
            itens: itensFormatados,
            cliente: {
              nome,
              cpf,
              data_nascimento: dataNascimento,
              email,
              celular
            },
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
                    valor_total: data.resumo_financeiro.valor_total,
                    codigo_pedido: data.codigo_pedido
                }
            });
        } else {
            Alert.alert('Erro', data.error || 'Falha ao processar reserva.');
        }

    } catch (e) {
        console.error("Erro Finalizar", e);
        Alert.alert('Erro', 'Falha na comunicação com o servidor.');
    } finally {
        setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !estabelecimento) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray} />
        <Text style={styles.errorText}>Não foi possível carregar as informações do banco.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={carregarDados}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const temAluguelNoCarrinho = itensCarrinho.some(i => i.tipo === 'aluguel');

  // Lógica para mostrar colunas detalhadas do ItemAluguel
  const itemPrincipal = itensCarrinho.length > 0 ? itensCarrinho[0] : servicos[0];
  let recursosStr = '';
  if(itemPrincipal?.recursos_oferecidos) {
      if(Array.isArray(itemPrincipal.recursos_oferecidos)){
          recursosStr = itemPrincipal.recursos_oferecidos.join(' • ');
      } else if(typeof itemPrincipal.recursos_oferecidos === 'string'){
          try {
              const parsed = JSON.parse(itemPrincipal.recursos_oferecidos);
              recursosStr = Array.isArray(parsed) ? parsed.join(' • ') : itemPrincipal.recursos_oferecidos;
          } catch(e) {
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
          <Text style={styles.headerTitle}>Criar reserva</Text>
          <View style={{ width: 32 }} />
        </View>
        <Text style={styles.headerSubtitle}>Preencha os detalhes para fazer sua reserva.</Text>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}>

          {/* 👉 LINK PARA O PERFIL DO ESTABELECIMENTO */}
          <TouchableOpacity 
              style={styles.estCard} 
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: estabelecimento.id } })}
          >
            <View style={styles.estCardHeader}>
              <Image source={{ uri: estabelecimento.foto_perfil || DEFAULT_PROFILE }} style={styles.estImage} />
              <View style={styles.estInfo}>
                <Text style={styles.estNome}>{estabelecimento.nome} <Feather name="chevron-right" size={14}/></Text>
                <Text style={styles.estCategoria}>{estabelecimento.categoria || 'Serviços & Atendimento'}</Text>

                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={COLORS.star} />
                  <Text style={styles.ratingScore}>{estabelecimento.avaliacao_media || '4.8'}</Text>
                  <Text style={styles.ratingCount}>({estabelecimento.total_avaliacoes || 0} avaliações)</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>A partir de </Text>
                  <Text style={styles.priceValue}>R$ {Number(servicos[0]?.valor || servicos[0]?.valor_diaria || 0).toFixed(2).replace('.', ',')}</Text>
                  {tipo === 'aluguel' && <Text style={styles.priceLabel}> /dia</Text>}
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* 👉 EXIBIÇÃO DE DIAS E HORÁRIOS DE FUNCIONAMENTO */}
          <View style={styles.operationInfoBox}>
            <View style={styles.operationRow}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.gray} />
                <Text style={styles.operationText}>
                    Dias abertos: {estabelecimento.dias_funcionamento || 'Segunda a Sábado'}
                </Text>
            </View>
            <View style={styles.operationRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.gray} />
                <Text style={styles.operationText}>
                    Horário: {estabelecimento.horario_abertura || '08:00'} às {estabelecimento.horario_fechamento || '18:00'}
                </Text>
            </View>
          </View>

          {/* 👉 EXIBIÇÃO DE RECURSOS DO ITEM_ALUGUEL */}
          <View style={styles.tagsContainer}>
              {tipo === 'aluguel' ? (
                  <View style={styles.tagsGrid}>
                      {itemPrincipal?.capacidade_pessoas && (
                          <View style={styles.tagChip}><Ionicons name="people" size={14} color={COLORS.secondary} /><Text style={styles.tagText}>{itemPrincipal.capacidade_pessoas} Pessoas</Text></View>
                      )}
                      {itemPrincipal?.mobiliado && (
                          <View style={styles.tagChip}><Ionicons name="bed" size={14} color={COLORS.secondary} /><Text style={styles.tagText}>Mobiliado</Text></View>
                      )}
                      {itemPrincipal?.aceita_pet && (
                          <View style={styles.tagChip}><Ionicons name="paw" size={14} color={COLORS.secondary} /><Text style={styles.tagText}>Pet Friendly</Text></View>
                      )}
                      {recursosStr ? (
                          <Text style={styles.tagsSubText}>{recursosStr}</Text>
                      ) : null}
                  </View>
              ) : (
                  estabelecimento.comodidades ? (
                      <View style={styles.tagsGrid}>
                      <View style={styles.tagChip}>
                          <MaterialCommunityIcons name="check-circle-outline" size={14} color={COLORS.secondary} />
                          <Text style={styles.tagText}>{String(estabelecimento.comodidades).slice(0, 30)}</Text>
                      </View>
                      </View>
                  ) : (
                      <Text style={styles.tagsSubText}>Atendimento personalizado • Garantia de reserva</Text>
                  )
              )}
          </View>

          {/* SEÇÃO 1: ESCOLHA A DATA E HORÁRIO (INPUT) */}
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
                      onChangeText={setDataRetirada}
                      placeholder="YYYY-MM-DD"
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
                      onChangeText={setHorarioRetirada}
                      placeholder="10:00"
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
                          onChangeText={setDataDevolucao}
                          placeholder="YYYY-MM-DD"
                          keyboardType="numeric"
                          maxLength={10}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Horário de devolução</Text>
                    <View style={styles.dateSelector}>
                      <Ionicons name="time-outline" size={18} color={COLORS.gray} />
                      <TextInput 
                          style={styles.timeInput}
                          value={horarioDevolucao}
                          onChangeText={setHorarioDevolucao}
                          placeholder="10:00"
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

            {/* HORÁRIOS LIVRES DO BANCO COMO DICA */}
            {horariosDisponiveis.length > 0 && (
                <View style={{marginTop: 10}}>
                    <Text style={{fontSize: 11, color: COLORS.gray, marginBottom: 4}}>Horários livres neste dia:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {horariosDisponiveis.map(h => (
                            <TouchableOpacity key={h} onPress={() => setHorarioRetirada(h)} style={{backgroundColor: COLORS.lightGray, padding: 6, borderRadius: 6, marginRight: 6, borderWidth: 1, borderColor: COLORS.border}}>
                                <Text style={{fontSize: 12, color: COLORS.secondary}}>{h}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
          </View>

          {/* SEÇÃO 2: LOCAL DE RETIRADA E DEVOLUÇÃO (SÓ APARECE PARA ALUGUEL) */}
          {temAluguelNoCarrinho && (
              <>
                  <Text style={styles.sectionTitle}>2. Local de retirada e devolução</Text>
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
                      <Text style={styles.optionSub}>{estabelecimento.rua}, {estabelecimento.numero} - {estabelecimento.cidade}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                      style={[styles.optionRow, tipoEntrega === 'endereco' && styles.optionRowActive, { marginTop: 8 }]}
                      onPress={() => setTipoEntrega('endereco')}
                  >
                      <View style={[styles.radio, tipoEntrega === 'endereco' && styles.radioActive]}>
                      {tipoEntrega === 'endereco' && <View style={styles.radioInner} />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.optionTitle}>Entrega no endereço</Text>
                      <Text style={styles.optionSub}>Informe um endereço para entrega do veículo/item</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  
                  {/* FORMULÁRIO DE ENDEREÇO CASO SELECIONADO "ENTREGA" */}
                  {tipoEntrega === 'endereco' && (
                      <View style={styles.addressFormContainer}>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabel}>CEP</Text>
                                  <View style={styles.inputBox}>
                                      <TextInput style={styles.textInput} placeholder="00000-000" value={cepEntrega} onChangeText={setCepEntrega} keyboardType="numeric"/>
                                  </View>
                              </View>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabel}>Número</Text>
                                  <View style={styles.inputBox}>
                                      <TextInput style={styles.textInput} placeholder="123" value={numeroEntrega} onChangeText={setNumeroEntrega} keyboardType="numeric"/>
                                  </View>
                              </View>
                          </View>
                          
                          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Rua</Text>
                          <View style={styles.inputBox}>
                              <TextInput style={styles.textInput} placeholder="Nome da rua" value={ruaEntrega} onChangeText={setRuaEntrega} />
                          </View>
                          
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabel}>Bairro</Text>
                                  <View style={styles.inputBox}>
                                      <TextInput style={styles.textInput} placeholder="Seu bairro" value={bairroEntrega} onChangeText={setBairroEntrega}/>
                                  </View>
                              </View>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabel}>Cidade</Text>
                                  <View style={styles.inputBox}>
                                      <TextInput style={styles.textInput} placeholder="Sua cidade" value={cidadeEntrega} onChangeText={setCidadeEntrega} />
                                  </View>
                              </View>
                          </View>
                      </View>
                  )}
                  </View>
              </>
          )}

          {/* SEÇÃO 3: ESCOLHA O SERVIÇO / QUER ACRESCENTAR AO PEDIDO */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Catálogo (Opcional)</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todos ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {servicos.map((s) => {
              const sId = s.id;
              const isAluguel = s.valor_diaria !== undefined;
              const sTipo = isAluguel ? 'aluguel' : 'servico';
              
              const itemNoCarrinho = itensCarrinho.find(i => i.id === sId && i.tipo === sTipo);
              const qtdNoCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;
              const valor = s.valor || s.valor_diaria || 0;

              let imageUrl = s.foto_principal || s.foto || DEFAULT_COVER;
              if(!s.foto_principal && !s.foto && s.fotos) {
                   const arrayFotos = typeof s.fotos === 'string' ? JSON.parse(s.fotos) : s.fotos;
                   if(arrayFotos && arrayFotos.length > 0) imageUrl = arrayFotos[0];
              }

              return (
                <View key={sId} style={[styles.itemCardHorizontal, qtdNoCarrinho > 0 && styles.itemCardSelected]}>
                  
                  {qtdNoCarrinho > 0 && (
                    <View style={styles.checkBadge}>
                      <Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>{qtdNoCarrinho}x</Text>
                    </View>
                  )}

                  <Image source={{ uri: imageUrl }} style={styles.itemImage} />
                  <Text style={styles.itemTitle} numberOfLines={1}>{s.nome}</Text>
                  {s.duracao_minutos && <Text style={styles.itemSub}>{s.duracao_minutos} min</Text>}
                  <Text style={styles.itemPrice}>R$ {Number(valor).toFixed(2).replace('.', ',')} {isAluguel ? '/dia' : ''}</Text>
                  
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 5}}>
                      <TouchableOpacity style={{flex: 1, backgroundColor: COLORS.lightGray, padding: 6, borderRadius: 6, alignItems: 'center'}} onPress={() => removerDoCarrinho(sId, sTipo)}>
                          <Ionicons name="remove" size={16} color={COLORS.secondary}/>
                      </TouchableOpacity>
                      <TouchableOpacity style={{flex: 1, backgroundColor: COLORS.primaryLight, padding: 6, borderRadius: 6, alignItems: 'center'}} onPress={() => adicionarAoCarrinho(s, sTipo)}>
                          <Ionicons name="add" size={16} color={COLORS.primary}/>
                      </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* SEÇÃO DESCONTOS / FIDELIDADE */}
          {saldoPontos > 0 && (
              <>
                  <Text style={styles.sectionTitle}>Usar Pontos de Fidelidade</Text>
                  <View style={styles.optionsBox}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                              <Ionicons name="star" size={20} color={COLORS.star}/>
                              <Text style={styles.optionTitle}>Saldo atual: {saldoPontos} pontos</Text>
                          </View>
                          <TouchableOpacity onPress={() => setUsarPontos(!usarPontos)}>
                              <Ionicons name={usarPontos ? "toggle" : "toggle-outline"} size={30} color={usarPontos ? COLORS.green : COLORS.gray}/>
                          </TouchableOpacity>
                      </View>
                      
                      {usarPontos && (
                          <View style={{marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10}}>
                              <Text style={styles.fieldLabel}>Quantos pontos deseja usar? (100 pts = R$ 1,00)</Text>
                              <View style={styles.inputBox}>
                                  <TextInput 
                                      style={styles.textInput} 
                                      placeholder={`Máx: ${saldoPontos}`} 
                                      value={pontosAUsa} 
                                      onChangeText={setPontosAUsa} 
                                      keyboardType="numeric"
                                  />
                              </View>
                              {descontoPontosVisual > 0 && (
                                  <Text style={{color: COLORS.green, fontSize: 12, marginTop: 4, fontWeight: 'bold'}}>
                                      Desconto de R$ {descontoPontosVisual.toFixed(2).replace('.', ',')}
                                  </Text>
                              )}
                          </View>
                      )}
                  </View>
              </>
          )}

          {/* SEÇÃO 4: INFORMAÇÕES DO CONDUTOR / CLIENTE */}
          <Text style={styles.sectionTitle}>4. Informações do cliente</Text>
          <View style={styles.formContainer}>
            <Text style={styles.fieldLabel}>Nome completo</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={18} color={COLORS.gray} />
              <TextInput style={styles.textInput} placeholder="Digite seu nome completo" value={nome} onChangeText={setNome} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CPF</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.textInput} placeholder="000.000.000-00" value={cpf} onChangeText={setCpf} keyboardType="numeric"/>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Data de nascimento</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.textInput} placeholder="dd/mm/aaaa" value={dataNascimento} onChangeText={setDataNascimento} />
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>E-mail</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.textInput} placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Celular</Text>
                <View style={styles.inputBox}>
                  <TextInput style={styles.textInput} placeholder="(11) 99999-9999" value={celular} onChangeText={setCelular} keyboardType="phone-pad" />
                </View>
              </View>
            </View>

            {/* TERMOS E CONDIÇÕES */}
            <TouchableOpacity style={styles.termsContainer} onPress={() => setAceitouTermos(!aceitouTermos)}>
              <View style={[styles.checkbox, aceitouTermos && styles.checkboxActive]}>
                  {aceitouTermos && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>
                  Li e concordo com os termos de uso e com a política de cancelamento deste estabelecimento.
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER - BARRA INFERIOR DE TOTAL E CONFIRMAÇÃO */}
      <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {totalFinalLiquido.toFixed(2).replace('.', ',')}</Text>
          </View>
          <TouchableOpacity 
              style={[styles.checkoutButton, isProcessing && { opacity: 0.7 }]} 
              onPress={handleFinalizar}
              disabled={isProcessing}
          >
              {isProcessing ? (
                  <ActivityIndicator color="#FFF" />
              ) : (
                  <Text style={styles.checkoutButtonText}>Confirmar reserva</Text>
              )}
          </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeHeader: { backgroundColor: '#FFF', paddingBottom: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: Platform.OS === 'android' ? 40 : 10 },
  backButton: { padding: 8, backgroundColor: COLORS.lightGray, borderRadius: 50 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  headerSubtitle: { fontSize: 14, color: COLORS.gray, paddingHorizontal: 16, marginTop: 8 },
  
  // Detalhes do Estabelecimento
  estCard: { flexDirection: 'row', backgroundColor: '#FFF', marginVertical: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  estCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  estImage: { width: 64, height: 64, borderRadius: 12 },
  estInfo: { flex: 1 },
  estNome: { fontSize: 16, fontWeight: '700', color: COLORS.secondary },
  estCategoria: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingScore: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  ratingCount: { fontSize: 12, color: COLORS.gray },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  priceLabel: { fontSize: 12, color: COLORS.gray },
  priceValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  
  // Infos Operacionais (Dias e Horários)
  operationInfoBox: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  operationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  operationText: { fontSize: 13, color: COLORS.gray },

  tagsContainer: { marginBottom: 20 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  tagText: { fontSize: 12, color: COLORS.secondary, fontWeight: '500' },
  tagsSubText: { fontSize: 12, color: COLORS.gray, marginTop: 8, lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, marginBottom: 12, marginTop: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Formulário Data e Hora
  datePickerBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  datePickerRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginBottom: 6 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  dateSelectorText: { flex: 1, fontSize: 14, color: COLORS.secondary, fontWeight: '500' },
  timeInput: { flex: 1, fontSize: 14, color: COLORS.secondary, fontWeight: '500', padding: 0 },
  periodBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: 10, borderRadius: 8, marginTop: 12, gap: 8 },
  periodText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Opções de Retirada/Entrega
  optionsBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.lightGray, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  optionRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  optionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
  optionSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  
  // Endereço de Entrega
  addressFormContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },

  // Itens Carrinho
  itemCardHorizontal: { width: width * 0.4, backgroundColor: '#FFF', padding: 10, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  itemCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  checkBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.primary, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  itemImage: { width: '100%', height: 80, borderRadius: 8, marginBottom: 8 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  itemSub: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 4 },

  // Formulário do Cliente
  formContainer: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginBottom: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  textInput: { flex: 1, fontSize: 14, color: COLORS.secondary, padding: 0 },
  
  // Termos
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termsText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  // Erros e Botão de Retry
  errorText: { fontSize: 14, color: COLORS.gray, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  retryButton: { marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: 'bold' },

  // Footer (Total e Pagar)
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  priceContainer: { flex: 1 },
  totalLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  checkoutButton: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkoutButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});