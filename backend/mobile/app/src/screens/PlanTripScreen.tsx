import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import EstadosExplorar from '../../../components/client/EstadosExplorar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertar } from '../../../services/alertar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const TRAVEL_URL = `${API_URL}/travel-assistant`;

const pegarToken = async () => (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));

interface Gasto {
  id: string;
  categoria: string;
  descricao?: string | null;
  valor: number | string;
  data_gasto?: string | null;
}

interface Viagem {
  id: number;
  titulo: string;
  destino: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim: string;
  orcamento_limite: number | string;
  gastos_planejados: Gasto[];
}

const CATEGORIAS_GASTO: { valor: string; icone: keyof typeof Ionicons.glyphMap; corBg: string; corIcon: string }[] = [
  { valor: 'Hospedagem', icone: 'bed', corBg: '#F0F0F2', corIcon: '#FF6B00' },
  { valor: 'Transporte', icone: 'bus-sharp', corBg: '#FEF9C3', corIcon: '#CA8A04' },
  { valor: 'Alimentação', icone: 'restaurant', corBg: '#DCFCE7', corIcon: '#16A34A' },
  { valor: 'Passeios', icone: 'camera', corBg: '#F3E8FF', corIcon: '#9333EA' },
  { valor: 'Compras', icone: 'bag-handle', corBg: '#E0F2FE', corIcon: '#0284C7' },
  { valor: 'Outros', icone: 'ellipsis-horizontal', corBg: '#E6E7E9', corIcon: '#6A6C72' },
];

const estiloCategoria = (categoria: string) =>
  CATEGORIAS_GASTO.find((c) => c.valor === categoria) || CATEGORIAS_GASTO[CATEGORIAS_GASTO.length - 1];

function formatarMoeda(valor: number | string): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  return (Number.isFinite(num) ? num : 0).toFixed(2).replace('.', ',');
}

export default function PlanTripScreen() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemAtivaId, setViagemAtivaId] = useState<number | null>(null);

  const [editandoDados, setEditandoDados] = useState(false);
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [formTitulo, setFormTitulo] = useState('');
  const [formDestino, setFormDestino] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  const [formOrcamento, setFormOrcamento] = useState('');
  const [formDescricao, setFormDescricao] = useState('');

  const [criandoNovaViagem, setCriandoNovaViagem] = useState(false);

  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [gastoEditandoId, setGastoEditandoId] = useState<string | null>(null);
  const [gastoCategoria, setGastoCategoria] = useState(CATEGORIAS_GASTO[0].valor);
  const [gastoDescricao, setGastoDescricao] = useState('');
  const [gastoValor, setGastoValor] = useState('');

  const viagemAtiva = viagens.find((v) => v.id === viagemAtivaId) || null;

  const carregarViagens = useCallback(async () => {
    setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${TRAVEL_URL}/viagens`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data: Viagem[] = await res.json();
        const ordenadas = [...data].sort((a, b) => b.id - a.id);
        setViagens(ordenadas);
        setViagemAtivaId((atual) => {
          if (atual && ordenadas.some((v) => v.id === atual)) return atual;
          return ordenadas[0]?.id ?? null;
        });
      }
    } catch (e) {
      alertar('Erro', 'Não foi possível carregar suas viagens agora.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarViagens();
    }, [carregarViagens])
  );

  const iniciarEdicaoDados = () => {
    if (!viagemAtiva) return;
    setFormTitulo(viagemAtiva.titulo);
    setFormDestino(viagemAtiva.destino);
    setFormDataInicio(viagemAtiva.data_inicio.slice(0, 10));
    setFormDataFim(viagemAtiva.data_fim.slice(0, 10));
    setFormOrcamento(String(viagemAtiva.orcamento_limite ?? ''));
    setEditandoDados(true);
  };

  const salvarDadosViagem = async () => {
    if (!viagemAtiva) return;
    if (!formTitulo.trim() || !formDestino.trim()) {
      alertar('Campos obrigatórios', 'Preencha o nome da viagem e o destino.');
      return;
    }
    setSalvando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${TRAVEL_URL}/viagens/${viagemAtiva.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: formTitulo.trim(),
          destino: formDestino.trim(),
          data_inicio: formDataInicio,
          data_fim: formDataFim,
          orcamento_limite: parseFloat(formOrcamento.replace(',', '.')) || 0,
        }),
      });
      if (res.ok) {
        setEditandoDados(false);
        carregarViagens();
      } else {
        alertar('Erro', 'Não foi possível salvar os dados da viagem.');
      }
    } catch (e) {
      alertar('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicaoDescricao = () => {
    if (!viagemAtiva) return;
    setFormDescricao(viagemAtiva.descricao || '');
    setEditandoDescricao(true);
  };

  const salvarDescricao = async () => {
    if (!viagemAtiva) return;
    setSalvando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${TRAVEL_URL}/viagens/${viagemAtiva.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: formDescricao }),
      });
      if (res.ok) {
        setEditandoDescricao(false);
        carregarViagens();
      } else {
        alertar('Erro', 'Não foi possível salvar a descrição.');
      }
    } catch (e) {
      alertar('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const criarViagem = async () => {
    if (!formTitulo.trim() || !formDestino.trim() || !formDataInicio || !formDataFim) {
      alertar('Campos obrigatórios', 'Preencha nome, destino e as datas da viagem.');
      return;
    }
    setSalvando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${TRAVEL_URL}/viagens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: formTitulo.trim(),
          destino: formDestino.trim(),
          data_inicio: formDataInicio,
          data_fim: formDataFim,
          orcamento_limite: parseFloat(formOrcamento.replace(',', '.')) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCriandoNovaViagem(false);
        setFormTitulo(''); setFormDestino(''); setFormDataInicio(''); setFormDataFim(''); setFormOrcamento('');
        await carregarViagens();
        setViagemAtivaId(data.viagem.id);
      } else {
        alertar('Erro', 'Não foi possível criar a viagem. Confira as datas informadas.');
      }
    } catch (e) {
      alertar('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirViagemAtiva = () => {
    if (!viagemAtiva) return;
    alertar('Excluir viagem', `Tem certeza que deseja excluir "${viagemAtiva.titulo}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await pegarToken();
            const res = await fetch(`${TRAVEL_URL}/viagens/${viagemAtiva.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (res.ok) {
              setViagemAtivaId(null);
              carregarViagens();
            } else {
              alertar('Erro', 'Não foi possível excluir a viagem.');
            }
          } catch (e) {
            alertar('Erro', 'Falha na comunicação com o servidor.');
          }
        },
      },
    ]);
  };

  const abrirFormNovoGasto = () => {
    setGastoEditandoId(null);
    setGastoCategoria(CATEGORIAS_GASTO[0].valor);
    setGastoDescricao('');
    setGastoValor('');
    setMostrarFormGasto(true);
  };

  const abrirFormEditarGasto = (gasto: Gasto) => {
    setGastoEditandoId(gasto.id);
    setGastoCategoria(gasto.categoria);
    setGastoDescricao(gasto.descricao || '');
    setGastoValor(String(gasto.valor ?? ''));
    setMostrarFormGasto(true);
  };

  const salvarGasto = async () => {
    if (!viagemAtiva) return;
    const valorNum = parseFloat(gastoValor.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      alertar('Valor inválido', 'Informe um valor maior que zero para o gasto.');
      return;
    }
    setSalvando(true);
    try {
      const token = await pegarToken();
      const payload = { categoria: gastoCategoria, descricao: gastoDescricao.trim() || null, valor: valorNum };
      const url = gastoEditandoId
        ? `${TRAVEL_URL}/viagens/${viagemAtiva.id}/gastos/${gastoEditandoId}`
        : `${TRAVEL_URL}/viagens/${viagemAtiva.id}/gastos`;
      const res = await fetch(url, {
        method: gastoEditandoId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMostrarFormGasto(false);
        carregarViagens();
      } else {
        alertar('Erro', 'Não foi possível salvar o gasto.');
      }
    } catch (e) {
      alertar('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirGasto = (gasto: Gasto) => {
    if (!viagemAtiva) return;
    alertar('Remover gasto', `Remover "${gasto.categoria}" da lista de gastos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await pegarToken();
            const res = await fetch(`${TRAVEL_URL}/viagens/${viagemAtiva.id}/gastos/${gasto.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (res.ok) {
              carregarViagens();
            } else {
              alertar('Erro', 'Não foi possível remover o gasto.');
            }
          } catch (e) {
            alertar('Erro', 'Falha na comunicação com o servidor.');
          }
        },
      },
    ]);
  };

  const gastos = viagemAtiva?.gastos_planejados || [];
  const totalGasto = gastos.reduce((acc, g) => acc + (typeof g.valor === 'string' ? parseFloat(g.valor) : g.valor), 0);
  const orcamentoNum = viagemAtiva ? (typeof viagemAtiva.orcamento_limite === 'string' ? parseFloat(viagemAtiva.orcamento_limite) : viagemAtiva.orcamento_limite) : 0;
  const restante = orcamentoNum - totalGasto;
  const porcentagemGasta = orcamentoNum > 0 ? Math.min(Math.round((totalGasto / orcamentoNum) * 100), 100) : 0;

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#FF7A00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {viagemAtiva ? (
            <TouchableOpacity style={styles.iconBtn} onPress={excluirViagemAtiva}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        <Text style={styles.headerSubtitle}>
          Organize sua viagem, controle seus gastos e aproveite cada momento.
        </Text>

        {/* Seletor de viagens (quando há mais de uma) */}
        {viagens.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {viagens.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, v.id === viagemAtivaId && styles.chipAtivo]}
                onPress={() => { setViagemAtivaId(v.id); setCriandoNovaViagem(false); }}
              >
                <Text style={[styles.chipText, v.id === viagemAtivaId && styles.chipTextAtivo]} numberOfLines={1}>
                  {v.titulo}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, styles.chipNovo]}
              onPress={() => { setCriandoNovaViagem(true); setFormTitulo(''); setFormDestino(''); setFormDataInicio(''); setFormDataFim(''); setFormOrcamento(''); }}
            >
              <Feather name="plus" size={14} color="#FF7A00" />
              <Text style={styles.chipNovoText}>Nova viagem</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Formulário de criação (primeira viagem ou nova viagem) */}
        {(criandoNovaViagem || viagens.length === 0) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithIcon}>
                <Feather name="map-pin" size={18} color="#FF7A00" />
                <Text style={styles.cardTitle}>{viagens.length === 0 ? 'Vamos planejar sua primeira viagem' : 'Nova viagem'}</Text>
              </View>
            </View>

            <Text style={styles.label}>Nome da viagem</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} value={formTitulo} onChangeText={setFormTitulo} placeholder="Ex: Férias de Verão" />
            </View>

            <Text style={styles.label}>Destino</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} value={formDestino} onChangeText={setFormDestino} placeholder="Ex: Porto de Galinhas, PE" />
            </View>

            <EstadosExplorar titulo="Ainda sem destino? Explore por estado" />

            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Data de ida (AAAA-MM-DD)</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} value={formDataInicio} onChangeText={setFormDataInicio} placeholder="2026-10-01" />
                </View>
              </View>
              <View style={{ width: 12 }} />
              <View style={styles.flex1}>
                <Text style={styles.label}>Data de volta</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} value={formDataFim} onChangeText={setFormDataFim} placeholder="2026-10-07" />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Orçamento previsto</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="wallet-outline" size={18} color="#5A5C62" style={styles.inputLeftIcon} />
              <TextInput
                style={[styles.input, { paddingLeft: 30 }]}
                value={formOrcamento}
                onChangeText={setFormOrcamento}
                placeholder="0,00"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              {viagens.length > 0 && (
                <TouchableOpacity style={[styles.btnSecundario, { flex: 1, marginRight: 8 }]} onPress={() => setCriandoNovaViagem(false)}>
                  <Text style={styles.btnSecundarioText}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.btnSalvar, { flex: 1, marginTop: 0 }]} onPress={criarViagem} disabled={salvando}>
                {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnSalvarText}>Criar viagem</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {viagemAtiva && !criandoNovaViagem && (
          <>
            {/* Card 1: Dados da Viagem */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleWithIcon}>
                  <Feather name="briefcase" size={18} color="#FF7A00" />
                  <Text style={styles.cardTitle}>Dados da viagem</Text>
                </View>
                {!editandoDados && (
                  <TouchableOpacity style={styles.btnEditar} onPress={iniciarEdicaoDados}>
                    <Feather name="edit-2" size={14} color="#FF7A00" />
                    <Text style={styles.btnEditarText}>Editar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editandoDados ? (
                <>
                  <Text style={styles.label}>Nome da viagem</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={styles.input} value={formTitulo} onChangeText={setFormTitulo} />
                  </View>

                  <Text style={styles.label}>Destino</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="location-outline" size={18} color="#5A5C62" style={styles.inputLeftIcon} />
                    <TextInput style={[styles.input, { paddingLeft: 30 }]} value={formDestino} onChangeText={setFormDestino} />
                  </View>

                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Data de ida</Text>
                      <View style={styles.inputContainer}>
                        <Feather name="calendar" size={16} color="#5A5C62" style={styles.inputLeftIcon} />
                        <TextInput style={[styles.input, { paddingLeft: 28 }]} value={formDataInicio} onChangeText={setFormDataInicio} />
                      </View>
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Data de volta</Text>
                      <View style={styles.inputContainer}>
                        <Feather name="calendar" size={16} color="#5A5C62" style={styles.inputLeftIcon} />
                        <TextInput style={[styles.input, { paddingLeft: 28 }]} value={formDataFim} onChangeText={setFormDataFim} />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>Orçamento previsto</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="wallet-outline" size={18} color="#5A5C62" style={styles.inputLeftIcon} />
                    <TextInput
                      style={[styles.input, { paddingLeft: 30, fontWeight: 'bold' }]}
                      value={formOrcamento}
                      onChangeText={setFormOrcamento}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.btnSecundario, { flex: 1, marginRight: 8 }]} onPress={() => setEditandoDados(false)}>
                      <Text style={styles.btnSecundarioText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSalvar, { flex: 1, marginTop: 0 }]} onPress={salvarDadosViagem} disabled={salvando}>
                      {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnSalvarText}>Salvar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Nome da viagem</Text>
                  <Text style={styles.valorExibido}>{viagemAtiva.titulo}</Text>
                  <Text style={styles.label}>Destino</Text>
                  <Text style={styles.valorExibido}>{viagemAtiva.destino}</Text>
                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Data de ida</Text>
                      <Text style={styles.valorExibido}>{viagemAtiva.data_inicio.slice(0, 10)}</Text>
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Data de volta</Text>
                      <Text style={styles.valorExibido}>{viagemAtiva.data_fim.slice(0, 10)}</Text>
                    </View>
                  </View>
                  <Text style={styles.label}>Orçamento previsto</Text>
                  <Text style={styles.valorExibido}>R$ {formatarMoeda(viagemAtiva.orcamento_limite)}</Text>
                </>
              )}
            </View>

            {/* Card 2: Resumo do Orçamento */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitleBold}>Resumo do orçamento</Text>
              </View>

              <View style={styles.rowSpaceBetween}>
                <View>
                  <Text style={styles.metricLabel}>Total gasto</Text>
                  <Text style={styles.metricGasto}>R$ {formatarMoeda(totalGasto)}</Text>
                  <Text style={styles.metricSub}>{porcentagemGasta}% do orçamento</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabel}>Restante</Text>
                  <Text style={[styles.metricRestante, restante < 0 && { color: '#EF4444' }]}>R$ {formatarMoeda(restante)}</Text>
                </View>
              </View>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${porcentagemGasta}%` }]} />
              </View>
              <Text style={styles.progressPercentageText}>{porcentagemGasta}%</Text>
            </View>

            {/* Card 3: Gastos da Viagem */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleWithIcon}>
                  <Feather name="folder" size={18} color="#FF7A00" />
                  <Text style={styles.cardTitle}>Gastos da viagem</Text>
                </View>
                <TouchableOpacity style={styles.btnOrangeSmall} onPress={abrirFormNovoGasto}>
                  <Text style={styles.btnOrangeSmallText}>+ Adicionar gasto</Text>
                </TouchableOpacity>
              </View>

              {gastos.length === 0 ? (
                <Text style={styles.emptyGastosText}>Nenhum gasto registrado ainda.</Text>
              ) : (
                gastos.map((item) => {
                  const cores = estiloCategoria(item.categoria);
                  return (
                    <View key={item.id} style={styles.gastoItem}>
                      <View style={styles.rowCenter}>
                        <View style={[styles.gastoIconContainer, { backgroundColor: cores.corBg }]}>
                          <Ionicons name={cores.icone} size={18} color={cores.corIcon} />
                        </View>
                        <View style={styles.gastoInfo}>
                          <Text style={styles.gastoCategoria}>{item.categoria}</Text>
                          {!!item.descricao && <Text style={styles.gastoData}>{item.descricao}</Text>}
                        </View>
                      </View>

                      <View style={styles.rowCenter}>
                        <Text style={styles.gastoValor}>R$ {formatarMoeda(item.valor)}</Text>
                        <TouchableOpacity style={styles.actionIconBtn} onPress={() => abrirFormEditarGasto(item)}>
                          <Feather name="edit-2" size={14} color="#6A6C72" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => excluirGasto(item)}>
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              {mostrarFormGasto && (
                <View style={styles.gastoForm}>
                  <Text style={styles.label}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {CATEGORIAS_GASTO.map((cat) => (
                      <TouchableOpacity
                        key={cat.valor}
                        style={[styles.categoriaChip, gastoCategoria === cat.valor && { backgroundColor: cat.corIcon }]}
                        onPress={() => setGastoCategoria(cat.valor)}
                      >
                        <Ionicons name={cat.icone} size={14} color={gastoCategoria === cat.valor ? '#FFF' : cat.corIcon} />
                        <Text style={[styles.categoriaChipText, gastoCategoria === cat.valor && { color: '#FFF' }]}>{cat.valor}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Descrição (opcional)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={styles.input} value={gastoDescricao} onChangeText={setGastoDescricao} placeholder="Ex: Hotel 5 noites" />
                  </View>

                  <Text style={styles.label}>Valor</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={styles.input} value={gastoValor} onChangeText={setGastoValor} placeholder="0,00" keyboardType="numeric" />
                  </View>

                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.btnSecundario, { flex: 1, marginRight: 8 }]} onPress={() => setMostrarFormGasto(false)}>
                      <Text style={styles.btnSecundarioText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSalvar, { flex: 1, marginTop: 0 }]} onPress={salvarGasto} disabled={salvando}>
                      {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnSalvarText}>{gastoEditandoId ? 'Salvar' : 'Adicionar'}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Card 4: Descrição / Roteiro */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleWithIcon}>
                  <Feather name="align-left" size={18} color="#FF7A00" />
                  <Text style={styles.cardTitle}>Descrição / Roteiro</Text>
                </View>
                {!editandoDescricao && (
                  <TouchableOpacity style={styles.btnEditar} onPress={iniciarEdicaoDescricao}>
                    <Feather name="edit-2" size={14} color="#FF7A00" />
                    <Text style={styles.btnEditarText}>Editar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editandoDescricao ? (
                <>
                  <View style={[styles.inputContainer, { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
                    <TextInput
                      style={[styles.input, { textAlignVertical: 'top' }]}
                      value={formDescricao}
                      onChangeText={setFormDescricao}
                      multiline
                      placeholder="Conte como vai ser o roteiro da viagem..."
                    />
                  </View>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.btnSecundario, { flex: 1, marginRight: 8 }]} onPress={() => setEditandoDescricao(false)}>
                      <Text style={styles.btnSecundarioText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSalvar, { flex: 1, marginTop: 0 }]} onPress={salvarDescricao} disabled={salvando}>
                      {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnSalvarText}>Salvar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.descricaoText}>
                  {viagemAtiva.descricao || 'Nenhuma descrição adicionada ainda. Toque em "Editar" para contar como vai ser o roteiro.'}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.btnSalvar} onPress={() => router.back()}>
              <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnSalvarText}>Concluído</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282828',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6A6C72',
    marginBottom: 16,
    lineHeight: 18,
  },
  iconBtn: {
    padding: 6,
    minWidth: 30,
  },
  chipsScroll: {
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6E7E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    marginRight: 8,
    maxWidth: 180,
  },
  chipAtivo: {
    backgroundColor: '#FF7A00',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A5C62',
  },
  chipTextAtivo: {
    color: '#FFFFFF',
  },
  chipNovo: {
    backgroundColor: '#F0F0F2',
    borderWidth: 1,
    borderColor: '#FF7A00',
    gap: 4,
  },
  chipNovoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#282828',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6E7E9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  cardTitleBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  btnEditar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnEditarText: {
    fontSize: 13,
    color: '#282828',
    fontWeight: '600',
    marginLeft: 4,
  },
  label: {
    fontSize: 12,
    color: '#6A6C72',
    marginBottom: 6,
    marginTop: 4,
  },
  valorExibido: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E6E7E9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    position: 'relative',
  },
  inputLeftIcon: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6A6C72',
  },
  metricGasto: {
    fontSize: 18,
    fontWeight: '800',
    color: '#282828',
    marginVertical: 2,
  },
  metricRestante: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00A868',
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#A0A2A8',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E6E7E9',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF7A00',
    borderRadius: 4,
  },
  progressPercentageText: {
    fontSize: 11,
    color: '#6A6C72',
    textAlign: 'right',
    marginTop: 4,
  },
  btnOrangeSmall: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnOrangeSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyGastosText: {
    fontSize: 13,
    color: '#A0A2A8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E7E9',
  },
  gastoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  gastoInfo: {
    justifyContent: 'center',
  },
  gastoCategoria: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  gastoData: {
    fontSize: 11,
    color: '#A0A2A8',
    marginTop: 1,
  },
  gastoValor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 8,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E6E7E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  gastoForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6E7E9',
  },
  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6E7E9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
    marginRight: 8,
    gap: 6,
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A5C62',
  },
  descricaoText: {
    fontSize: 13,
    color: '#5A5C62',
    lineHeight: 20,
  },
  btnSecundario: {
    backgroundColor: '#E6E7E9',
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecundarioText: {
    color: '#5A5C62',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSalvar: {
    backgroundColor: '#12A150',
    borderRadius: 25,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#282828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnSalvarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
