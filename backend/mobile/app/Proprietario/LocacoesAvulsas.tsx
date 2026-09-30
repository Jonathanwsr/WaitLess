import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Switch,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { alertar } from '../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const BASE_URL = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
const API_URL = `${BASE_URL}/proprietario/locacoes-avulsas`;

interface ItemLocacao {
  id: number;
  nome: string;
  categoria: string;
  descricao: string | null;
  valor_diaria: string | number;
  quantidade: number | null;
  somente_premium: boolean;
  tem_promocao: boolean;
  tipo_desconto: string;
  valor_desconto: string | number | null;
  aceita_pontos: boolean;
  maximo_pontos_permitidos: number | null;
  ativo: boolean;
  fotos: string[] | null;
  local_retirada: string | null;
  local_entrega: string | null;
  horario_retirada: string | null;
  horario_entrega: string | null;
  informacoes_extras: string | null;
  capacidade_pessoas: number | null;
  modelo_precificacao: 'pacote' | 'por_pessoa' | null;
  pessoas_incluidas: number | null;
  valor_pessoa_extra: string | number | null;
  possui_wifi: boolean;
  possui_ar_condicionado: boolean;
  mobiliado: boolean;
  aceita_pet: boolean;
  piscina: boolean;
  churrasqueira: boolean;
  recursos_oferecidos: string[] | null;
  sempre_disponivel: boolean;
  data_inicio_disponibilidade: string | null;
  data_fim_disponibilidade: string | null;
  dias_semana_disponiveis: number[] | null;
}

// Checklist fixo de comodidades — vira texto em `recursos_oferecidos` (mesma lista exibida ao cliente).
const COMODIDADES_FIXAS: { campo: 'possui_wifi' | 'possui_ar_condicionado' | 'mobiliado' | 'aceita_pet' | 'piscina' | 'churrasqueira'; rotulo: string; icone: React.ComponentProps<typeof Feather>['name'] }[] = [
  { campo: 'possui_wifi', rotulo: 'Wi-Fi', icone: 'wifi' },
  { campo: 'possui_ar_condicionado', rotulo: 'Ar-condicionado', icone: 'wind' },
  { campo: 'mobiliado', rotulo: 'Mobiliado', icone: 'archive' },
  { campo: 'aceita_pet', rotulo: 'Aceita pets', icone: 'heart' },
  { campo: 'piscina', rotulo: 'Piscina', icone: 'droplet' },
  { campo: 'churrasqueira', rotulo: 'Churrasqueira', icone: 'sun' },
];
const ROTULOS_COMODIDADES_FIXAS = new Set(COMODIDADES_FIXAS.map((c) => c.rotulo));
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface EmUso {
  id: number;
  item_nome: string;
  locatario: string;
  data_inicio: string;
  data_fim: string;
}

type Categorias = Record<string, string[]>;

const FORM_INICIAL = {
  nome: '',
  categoria: '',
  descricao: '',
  valor_diaria: '',
  quantidade: '1',
  somente_premium: false,
  tem_promocao: false,
  tipo_desconto: 'percentual',
  valor_desconto: '',
  aceita_pontos: false,
  maximo_pontos_permitidos: '',
  ativo: true,
  local_retirada: '',
  local_entrega: '',
  horario_retirada: '',
  horario_entrega: '',
  informacoes_extras: '',

  capacidade_pessoas: '2',
  modelo_precificacao: 'pacote' as 'pacote' | 'por_pessoa',
  pessoas_incluidas: '2',
  valor_pessoa_extra: '',

  possui_wifi: false,
  possui_ar_condicionado: false,
  mobiliado: false,
  aceita_pet: false,
  piscina: false,
  churrasqueira: false,
  comodidades_extra: [] as string[],

  sempre_disponivel: true,
  data_inicio_disponibilidade: '',
  data_fim_disponibilidade: '',
  dias_semana_disponiveis: [] as number[],
};

function grupoDaCategoria(categoria: string, categorias: Categorias): string | null {
  for (const [grupo, opcoes] of Object.entries(categorias)) {
    if (opcoes.includes(categoria)) return grupo;
  }
  return null;
}

export default function LocacoesAvulsas() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemLocacao[]>([]);
  const [emUsoAgora, setEmUsoAgora] = useState<EmUso[]>([]);
  const [categorias, setCategorias] = useState<Categorias>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [categoriaModalVisivel, setCategoriaModalVisivel] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [fotosExistentes, setFotosExistentes] = useState<string[]>([]);
  const [fotosNovas, setFotosNovas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [novaComodidade, setNovaComodidade] = useState('');

  const adicionarComodidadeExtra = () => {
    const texto = novaComodidade.trim();
    if (!texto || form.comodidades_extra.includes(texto)) return;
    setForm((f) => ({ ...f, comodidades_extra: [...f.comodidades_extra, texto] }));
    setNovaComodidade('');
  };
  const removerComodidadeExtra = (texto: string) => setForm((f) => ({ ...f, comodidades_extra: f.comodidades_extra.filter((c) => c !== texto) }));
  const alternarDiaSemana = (dia: number) => setForm((f) => ({
    ...f,
    dias_semana_disponiveis: f.dias_semana_disponiveis.includes(dia) ? f.dias_semana_disponiveis.filter((d) => d !== dia) : [...f.dias_semana_disponiveis, dia],
  }));

  const grupoAtual = grupoDaCategoria(form.categoria, categorias);
  // Local de retirada/entrega só faz sentido para bens móveis (veículos, equipamentos…).
  const permiteEntrega = grupoAtual !== null && ['Veículos', 'Equipamentos', 'Outros'].includes(grupoAtual);
  const maxFotos = grupoAtual === 'Imóveis' ? 10 : 5;
  const totalFotos = fotosExistentes.length + fotosNovas.length;

  const getToken = async () => {
    return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
  };

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const token = await getToken();
      if (!token) {
        router.replace('/autenticacao/login' as never);
        return;
      }

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (response.status === 401) {
        router.replace('/autenticacao/login' as never);
        return;
      }

      const json = await response.json();
      if (!response.ok) throw new Error('Erro na resposta');

      setItens(json.itens || []);
      setEmUsoAgora(json.em_uso_agora || []);
      setCategorias(json.categorias || {});
    } catch (e) {
      setErro('Não foi possível carregar suas locações agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirCriacao = () => {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setFotosExistentes([]);
    setFotosNovas([]);
    setModalVisivel(true);
  };

  const abrirEdicao = (item: ItemLocacao) => {
    setEditandoId(item.id);
    const recursos = Array.isArray(item.recursos_oferecidos) ? item.recursos_oferecidos : [];
    setForm({
      nome: item.nome,
      categoria: item.categoria,
      descricao: item.descricao || '',
      valor_diaria: String(item.valor_diaria ?? ''),
      quantidade: String(item.quantidade ?? '1'),
      somente_premium: !!item.somente_premium,
      tem_promocao: !!item.tem_promocao,
      tipo_desconto: item.tipo_desconto || 'percentual',
      valor_desconto: item.valor_desconto ? String(item.valor_desconto) : '',
      aceita_pontos: !!item.aceita_pontos,
      maximo_pontos_permitidos: item.maximo_pontos_permitidos ? String(item.maximo_pontos_permitidos) : '',
      ativo: item.ativo,
      local_retirada: item.local_retirada || '',
      local_entrega: item.local_entrega || '',
      horario_retirada: item.horario_retirada || '',
      horario_entrega: item.horario_entrega || '',
      informacoes_extras: item.informacoes_extras || '',

      capacidade_pessoas: String(item.capacidade_pessoas ?? '2'),
      modelo_precificacao: item.modelo_precificacao === 'por_pessoa' ? 'por_pessoa' : 'pacote',
      pessoas_incluidas: String(item.pessoas_incluidas ?? '2'),
      valor_pessoa_extra: item.valor_pessoa_extra ? String(item.valor_pessoa_extra) : '',

      possui_wifi: !!item.possui_wifi,
      possui_ar_condicionado: !!item.possui_ar_condicionado,
      mobiliado: !!item.mobiliado,
      aceita_pet: !!item.aceita_pet,
      piscina: !!item.piscina,
      churrasqueira: !!item.churrasqueira,
      comodidades_extra: recursos.filter((r) => !ROTULOS_COMODIDADES_FIXAS.has(r)),

      sempre_disponivel: item.sempre_disponivel ?? true,
      data_inicio_disponibilidade: item.data_inicio_disponibilidade?.slice(0, 10) || '',
      data_fim_disponibilidade: item.data_fim_disponibilidade?.slice(0, 10) || '',
      dias_semana_disponiveis: Array.isArray(item.dias_semana_disponiveis) ? item.dias_semana_disponiveis.map(Number) : [],
    });
    setFotosExistentes(Array.isArray(item.fotos) ? item.fotos : []);
    setFotosNovas([]);
    setModalVisivel(true);
  };

  const escolherFotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alertar('Permissão necessária', 'Precisamos de acesso às fotos para continuar.');
      return;
    }
    const espacoLivre = maxFotos - fotosExistentes.length - fotosNovas.length;
    if (espacoLivre <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: espacoLivre,
      quality: 0.8,
    });
    if (!res.canceled) {
      setFotosNovas((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, espacoLivre));
    }
  };

  const removerFotoExistente = (uri: string) => setFotosExistentes((prev) => prev.filter((f) => f !== uri));
  const removerFotoNova = (uri: string) => setFotosNovas((prev) => prev.filter((f) => f !== uri));

  const salvar = async () => {
    if (!form.nome.trim() || !form.categoria || !form.valor_diaria) {
      alertar('Campos obrigatórios', 'Preencha nome, categoria e valor da diária.');
      return;
    }

    setSalvando(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('nome', form.nome);
      formData.append('categoria', form.categoria);
      formData.append('descricao', form.descricao);
      formData.append('valor_diaria', form.valor_diaria);
      formData.append('quantidade', form.quantidade || '1');
      formData.append('somente_premium', form.somente_premium ? '1' : '0');
      formData.append('tem_promocao', form.tem_promocao ? '1' : '0');
      formData.append('tipo_desconto', form.tipo_desconto);
      formData.append('valor_desconto', form.valor_desconto || '0');
      formData.append('aceita_pontos', form.aceita_pontos ? '1' : '0');
      formData.append('maximo_pontos_permitidos', form.maximo_pontos_permitidos || '0');
      formData.append('ativo', form.ativo ? '1' : '0');
      formData.append('local_retirada', form.local_retirada);
      formData.append('local_entrega', form.local_entrega);
      formData.append('horario_retirada', form.horario_retirada);
      formData.append('horario_entrega', form.horario_entrega);
      formData.append('informacoes_extras', form.informacoes_extras);

      formData.append('capacidade_pessoas', form.capacidade_pessoas || '1');
      formData.append('modelo_precificacao', form.modelo_precificacao);
      if (form.modelo_precificacao === 'pacote') {
        formData.append('pessoas_incluidas', form.pessoas_incluidas || '1');
        formData.append('valor_pessoa_extra', form.valor_pessoa_extra || '0');
      }

      (['possui_wifi', 'possui_ar_condicionado', 'mobiliado', 'aceita_pet', 'piscina', 'churrasqueira'] as const).forEach((campo) => {
        formData.append(campo, form[campo] ? '1' : '0');
      });
      form.comodidades_extra.forEach((c) => formData.append('comodidades_extra[]', c));

      formData.append('sempre_disponivel', form.sempre_disponivel ? '1' : '0');
      if (!form.sempre_disponivel) {
        if (form.data_inicio_disponibilidade) formData.append('data_inicio_disponibilidade', form.data_inicio_disponibilidade);
        if (form.data_fim_disponibilidade) formData.append('data_fim_disponibilidade', form.data_fim_disponibilidade);
        form.dias_semana_disponiveis.forEach((d) => formData.append('dias_semana_disponiveis[]', String(d)));
      }

      fotosExistentes.forEach((uri) => {
        formData.append('fotos_mantidas[]', uri);
      });
      fotosNovas.forEach((uri, idx) => {
        formData.append('fotos[]', { uri, name: `locacao_${idx}.jpg`, type: 'image/jpeg' } as any);
      });

      const url = editandoId ? `${API_URL}/${editandoId}` : API_URL;
      if (editandoId) formData.append('_method', 'PUT');

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || 'Erro ao salvar');

      setModalVisivel(false);
      alertar(editandoId ? 'Locação atualizada com sucesso!' : 'Locação criada com sucesso!', editandoId ? 'As alterações já estão valendo para novas reservas.' : 'Ela já aparece no seu catálogo e para os clientes.');
      carregar();
    } catch (e: any) {
      alertar('Erro', e?.message || 'Não foi possível salvar a locação.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = (item: ItemLocacao) => {
    alertar('Excluir locação', `Tem certeza que deseja excluir "${item.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/${item.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (!response.ok) throw new Error();
            carregar();
          } catch {
            alertar('Erro', 'Não foi possível excluir a locação.');
          }
        },
      },
    ]);
  };

  const todasCategorias = Object.entries(categorias);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color='#FF7A00' />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#3A3A3A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locações Avulsas</Text>
        <TouchableOpacity onPress={abrirCriacao} style={styles.addBtn}>
          <Feather name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {erro && (
          <View style={styles.erroBox}>
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        )}

        {emUsoAgora.length > 0 && (
          <View style={styles.emUsoSection}>
            <Text style={styles.emUsoTitulo}>
              <Feather name="clock" size={14} color="#282828" /> Em uso agora
            </Text>
            {emUsoAgora.map((u) => (
              <View key={u.id} style={styles.emUsoCard}>
                <Text style={styles.emUsoNome}>{u.item_nome}</Text>
                <Text style={styles.emUsoLocatario}>com {u.locatario}</Text>
              </View>
            ))}
          </View>
        )}

        {itens.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="home" size={40} color="#E1E2E5" />
            <Text style={styles.emptyStateText}>Você ainda não cadastrou locações avulsas.</Text>
            <TouchableOpacity style={styles.emptyStateBtn} onPress={abrirCriacao}>
              <Text style={styles.emptyStateBtnText}>Criar minha primeira locação</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {itens.map((item) => {
              const capa = item.fotos && item.fotos.length > 0 ? item.fotos[0] : null;
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardImageBox}>
                    {capa ? (
                      <Image source={{ uri: capa }} style={styles.cardImage} />
                    ) : (
                      <View style={styles.cardImagePlaceholder}>
                        <Feather name="image" size={28} color="#E1E2E5" />
                      </View>
                    )}
                    <View style={styles.badgesRow}>
                      {item.somente_premium && (
                        <View style={[styles.badge, { backgroundColor: '#282828' }]}>
                          <Feather name="award" size={10} color="#FFF" />
                          <Text style={styles.badgeText}>Premium</Text>
                        </View>
                      )}
                      {item.tem_promocao && (
                        <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
                          <Text style={styles.badgeText}>Promoção</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => abrirEdicao(item)}>
                        <Feather name="edit-2" size={14} color="#3A3A3A" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => excluir(item)}>
                        <Feather name="trash-2" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardCategoria}>{item.categoria}</Text>
                    <Text style={styles.cardNome} numberOfLines={2}>{item.nome}</Text>
                    <Text style={styles.cardValor}>R$ {Number(item.valor_diaria).toFixed(2).replace('.', ',')}<Text style={styles.cardValorSufixo}>/diária</Text></Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
      <Modal visible={modalVisivel} animationType="slide" onRequestClose={() => setModalVisivel(false)}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalVisivel(false)} style={styles.backBtn}>
              <Feather name="x" size={22} color="#3A3A3A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editandoId ? 'Editar Locação' : 'Nova Locação'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={form.nome}
              onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))}
              placeholder="Ex: Apartamento na praia, Honda CG 160..."
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Categoria</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setCategoriaModalVisivel(true)}>
              <Text style={[styles.selectBtnText, !form.categoria && { color: '#A0A2A8' }]}>
                {form.categoria ? form.categoria.replace(/_/g, ' ') : 'Selecione uma categoria'}
              </Text>
              <Feather name="chevron-down" size={18} color="#6A6C72" />
            </TouchableOpacity>

            <Text style={styles.label}>Valor da diária (R$)</Text>
            <TextInput
              style={styles.input}
              value={form.valor_diaria}
              onChangeText={(v) => setForm((f) => ({ ...f, valor_diaria: v.replace(/[^0-9.,]/g, '') }))}
              placeholder="0,00"
              keyboardType="decimal-pad"
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Unidades disponíveis</Text>
            <TextInput
              style={styles.input}
              value={form.quantidade}
              onChangeText={(v) => setForm((f) => ({ ...f, quantidade: v.replace(/[^0-9]/g, '') }))}
              placeholder="1"
              keyboardType="number-pad"
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.descricao}
              onChangeText={(v) => setForm((f) => ({ ...f, descricao: v }))}
              placeholder="Detalhes da locação..."
              multiline
              numberOfLines={4}
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Informações extras</Text>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 60 }]}
              value={form.informacoes_extras}
              onChangeText={(v) => setForm((f) => ({ ...f, informacoes_extras: v }))}
              placeholder="Regras, o que está incluso, observações..."
              multiline
              numberOfLines={3}
              placeholderTextColor="#A0A2A8"
            />

            {permiteEntrega && (
              <>
            <Text style={styles.label}>Local de retirada</Text>
            <TextInput
              style={styles.input}
              value={form.local_retirada}
              onChangeText={(v) => setForm((f) => ({ ...f, local_retirada: v }))}
              placeholder="Endereço ou ponto de retirada"
              placeholderTextColor="#A0A2A8"
            />
              </>
            )}

            <Text style={styles.label}>{permiteEntrega ? 'Horário de retirada' : 'Horário de chegada'}</Text>
            <TextInput
              style={styles.input}
              value={form.horario_retirada}
              onChangeText={(v) => setForm((f) => ({ ...f, horario_retirada: v }))}
              placeholder="Ex: 14:00"
              placeholderTextColor="#A0A2A8"
            />

            {permiteEntrega && (
              <>
            <Text style={styles.label}>Local de entrega</Text>
            <TextInput
              style={styles.input}
              value={form.local_entrega}
              onChangeText={(v) => setForm((f) => ({ ...f, local_entrega: v }))}
              placeholder="Endereço ou ponto de devolução"
              placeholderTextColor="#A0A2A8"
            />
              </>
            )}

            <Text style={styles.label}>{permiteEntrega ? 'Horário de devolução' : 'Horário de saída'}</Text>
            <TextInput
              style={styles.input}
              value={form.horario_entrega}
              onChangeText={(v) => setForm((f) => ({ ...f, horario_entrega: v }))}
              placeholder="Ex: 12:00"
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Fotos ({totalFotos}/{maxFotos}{grupoAtual ? ` — ${grupoAtual}` : ''})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {fotosExistentes.map((uri) => (
                <View key={uri} style={styles.fotoPreviewBox}>
                  <Image source={{ uri }} style={styles.fotoPreview} />
                  <TouchableOpacity style={styles.fotoRemoveBtn} onPress={() => removerFotoExistente(uri)}>
                    <Feather name="x" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {fotosNovas.map((uri) => (
                <View key={uri} style={styles.fotoPreviewBox}>
                  <Image source={{ uri }} style={styles.fotoPreview} />
                  <TouchableOpacity style={styles.fotoRemoveBtn} onPress={() => removerFotoNova(uri)}>
                    <Feather name="x" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {totalFotos < maxFotos && (
                <TouchableOpacity style={styles.fotoAddBtn} onPress={escolherFotos}>
                  <Feather name="camera" size={22} color="#A0A2A8" />
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* PESSOAS E PREÇO */}
            <Text style={styles.secaoTitulo}><Feather name="users" size={14} color="#282828" /> Pessoas e preço</Text>

            <Text style={styles.label}>Capacidade máxima (pessoas)</Text>
            <TextInput
              style={styles.input}
              value={form.capacidade_pessoas}
              onChangeText={(v) => setForm((f) => ({ ...f, capacidade_pessoas: v.replace(/[^0-9]/g, '') }))}
              placeholder="1"
              keyboardType="number-pad"
              placeholderTextColor="#A0A2A8"
            />

            <Text style={styles.label}>Como cobrar por pessoa</Text>
            <View style={styles.opcoesRow}>
              <TouchableOpacity
                style={[styles.opcaoBtn, form.modelo_precificacao === 'pacote' && styles.opcaoBtnAtiva]}
                onPress={() => setForm((f) => ({ ...f, modelo_precificacao: 'pacote' }))}
              >
                <Text style={[styles.opcaoBtnText, form.modelo_precificacao === 'pacote' && styles.opcaoBtnTextAtiva]}>Valor fixo até um limite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.opcaoBtn, form.modelo_precificacao === 'por_pessoa' && styles.opcaoBtnAtiva]}
                onPress={() => setForm((f) => ({ ...f, modelo_precificacao: 'por_pessoa' }))}
              >
                <Text style={[styles.opcaoBtnText, form.modelo_precificacao === 'por_pessoa' && styles.opcaoBtnTextAtiva]}>Valor por pessoa</Text>
              </TouchableOpacity>
            </View>

            {form.modelo_precificacao === 'pacote' ? (
              <>
                <Text style={styles.label}>Pessoas incluídas no valor da diária</Text>
                <TextInput
                  style={styles.input}
                  value={form.pessoas_incluidas}
                  onChangeText={(v) => setForm((f) => ({ ...f, pessoas_incluidas: v.replace(/[^0-9]/g, '') }))}
                  placeholder="1"
                  keyboardType="number-pad"
                  placeholderTextColor="#A0A2A8"
                />
                <Text style={styles.label}>Valor por pessoa extra / dia (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={form.valor_pessoa_extra}
                  onChangeText={(v) => setForm((f) => ({ ...f, valor_pessoa_extra: v.replace(/[^0-9.,]/g, '') }))}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#A0A2A8"
                />
              </>
            ) : (
              <View style={styles.avisoBox}>
                <Text style={styles.avisoBoxText}>O valor da diária acima será cobrado por pessoa.</Text>
              </View>
            )}

            {/* COMODIDADES */}
            <Text style={styles.secaoTitulo}>Comodidades</Text>
            <View style={styles.comodidadesGrid}>
              {COMODIDADES_FIXAS.map(({ campo, rotulo, icone }) => {
                const ativo = form[campo];
                return (
                  <TouchableOpacity
                    key={campo}
                    style={[styles.comodidadeChip, ativo && styles.comodidadeChipAtiva]}
                    onPress={() => setForm((f) => ({ ...f, [campo]: !f[campo] }))}
                  >
                    <Feather name={icone} size={14} color={ativo ? '#EA6C00' : '#6A6C72'} />
                    <Text style={[styles.comodidadeChipText, ativo && { color: '#EA6C00' }]}>{rotulo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Outras comodidades</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={novaComodidade}
                onChangeText={setNovaComodidade}
                placeholder="Ex: Vista para o mar"
                placeholderTextColor="#A0A2A8"
                onSubmitEditing={adicionarComodidadeExtra}
              />
              <TouchableOpacity style={styles.addComodidadeBtn} onPress={adicionarComodidadeExtra}>
                <Text style={styles.addComodidadeBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            {form.comodidades_extra.length > 0 && (
              <View style={[styles.comodidadesGrid, { marginTop: 8 }]}>
                {form.comodidades_extra.map((c) => (
                  <View key={c} style={styles.comodidadeTag}>
                    <Text style={styles.comodidadeTagText}>{c}</Text>
                    <TouchableOpacity onPress={() => removerComodidadeExtra(c)}>
                      <Feather name="x" size={12} color="#6A6C72" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* DISPONIBILIDADE */}
            <Text style={styles.secaoTitulo}><Feather name="calendar" size={14} color="#282828" /> Disponibilidade</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Sempre disponível para reserva</Text>
              <Switch
                value={form.sempre_disponivel}
                onValueChange={(v) => setForm((f) => ({ ...f, sempre_disponivel: v }))}
                trackColor={{ true: '#FF7A00' }}
              />
            </View>

            {!form.sempre_disponivel && (
              <>
                <Text style={styles.label}>Disponível a partir de (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={form.data_inicio_disponibilidade}
                  onChangeText={(v) => setForm((f) => ({ ...f, data_inicio_disponibilidade: v }))}
                  placeholder="2026-10-01"
                  placeholderTextColor="#A0A2A8"
                />
                <Text style={styles.label}>Disponível até (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={form.data_fim_disponibilidade}
                  onChangeText={(v) => setForm((f) => ({ ...f, data_fim_disponibilidade: v }))}
                  placeholder="2026-12-31"
                  placeholderTextColor="#A0A2A8"
                />
                <Text style={styles.label}>Dias de chegada permitidos</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DIAS_SEMANA.map((rotulo, dia) => {
                    const ativo = form.dias_semana_disponiveis.includes(dia);
                    return (
                      <TouchableOpacity key={dia} style={[styles.diaBtn, ativo && styles.diaBtnAtivo]} onPress={() => alternarDiaSemana(dia)}>
                        <Text style={[styles.diaBtnText, ativo && styles.diaBtnTextAtivo]}>{rotulo}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}><Feather name="award" size={14} color="#282828" /> Somente clientes Premium</Text>
              <Switch
                value={form.somente_premium}
                onValueChange={(v) => setForm((f) => ({ ...f, somente_premium: v }))}
                trackColor={{ true: '#FF7A00' }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Tem promoção / desconto</Text>
              <Switch
                value={form.tem_promocao}
                onValueChange={(v) => setForm((f) => ({ ...f, tem_promocao: v }))}
                trackColor={{ true: '#FF7A00' }}
              />
            </View>

            {form.tem_promocao && (
              <View style={styles.promoRow}>
                <TouchableOpacity
                  style={[styles.tipoDescontoBtn, form.tipo_desconto === 'percentual' && styles.tipoDescontoBtnAtivo]}
                  onPress={() => setForm((f) => ({ ...f, tipo_desconto: 'percentual' }))}
                >
                  <Text style={[styles.tipoDescontoText, form.tipo_desconto === 'percentual' && styles.tipoDescontoTextAtivo]}>%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tipoDescontoBtn, form.tipo_desconto === 'fixo' && styles.tipoDescontoBtnAtivo]}
                  onPress={() => setForm((f) => ({ ...f, tipo_desconto: 'fixo' }))}
                >
                  <Text style={[styles.tipoDescontoText, form.tipo_desconto === 'fixo' && styles.tipoDescontoTextAtivo]}>R$</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.valor_desconto}
                  onChangeText={(v) => setForm((f) => ({ ...f, valor_desconto: v.replace(/[^0-9.,]/g, '') }))}
                  placeholder="Valor do desconto"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#A0A2A8"
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Aceita pontos como desconto</Text>
              <Switch
                value={form.aceita_pontos}
                onValueChange={(v) => setForm((f) => ({ ...f, aceita_pontos: v }))}
                trackColor={{ true: '#FF7A00' }}
              />
            </View>

            {form.aceita_pontos && (
              <>
                <Text style={styles.label}>Máximo de pontos permitidos</Text>
                <TextInput
                  style={styles.input}
                  value={form.maximo_pontos_permitidos}
                  onChangeText={(v) => setForm((f) => ({ ...f, maximo_pontos_permitidos: v.replace(/[^0-9]/g, '') }))}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor="#A0A2A8"
                />
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Ativo (visível para clientes)</Text>
              <Switch
                value={form.ativo}
                onValueChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                trackColor={{ true: '#FF7A00' }}
              />
            </View>

            <TouchableOpacity style={styles.salvarBtn} onPress={salvar} disabled={salvando}>
              {salvando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.salvarBtnText}>{editandoId ? 'Salvar alterações' : 'Criar locação'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>

        {/* SELETOR DE CATEGORIA */}
        <Modal visible={categoriaModalVisivel} transparent animationType="fade">
          <View style={styles.categoriaOverlay}>
            <View style={styles.categoriaModal}>
              <Text style={styles.categoriaModalTitulo}>Escolha a categoria</Text>
              <FlatList
                data={todasCategorias}
                keyExtractor={([grupo]) => grupo}
                style={{ maxHeight: 420 }}
                renderItem={({ item: [grupo, opcoes] }) => (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.categoriaGrupoLabel}>{grupo}</Text>
                    {opcoes.map((op) => (
                      <TouchableOpacity
                        key={op}
                        style={styles.categoriaOpcao}
                        onPress={() => {
                          setForm((f) => ({ ...f, categoria: op }));
                          setCategoriaModalVisivel(false);
                        }}
                      >
                        <Text style={styles.categoriaOpcaoText}>{op.replace(/_/g, ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
              <TouchableOpacity style={styles.categoriaFechar} onPress={() => setCategoriaModalVisivel(false)}>
                <Text style={styles.categoriaFecharText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  container: { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F2',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F2', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#282828' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF7A00', justifyContent: 'center', alignItems: 'center' },

  erroBox: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, marginTop: 12 },
  erroTexto: { color: '#DC2626', fontSize: 13, fontWeight: '600' },

  emUsoSection: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  emUsoTitulo: { fontSize: 14, fontWeight: '800', color: '#282828', marginBottom: 10 },
  emUsoCard: { backgroundColor: '#F0F0F2', borderRadius: 14, padding: 10, marginBottom: 6 },
  emUsoNome: { fontWeight: '700', color: '#282828', fontSize: 13 },
  emUsoLocatario: { fontSize: 12, color: '#6A6C72', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateText: { color: '#A0A2A8', fontWeight: '600', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  emptyStateBtn: { backgroundColor: '#FF7A00', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyStateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, paddingBottom: 24 },
  card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardImageBox: { height: 110, backgroundColor: '#F0F0F2', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badgesRow: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  cardActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
  cardActionBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 10 },
  cardCategoria: { fontSize: 9, fontWeight: '800', color: '#A0A2A8', textTransform: 'uppercase', marginBottom: 2 },
  cardNome: { fontSize: 13, fontWeight: '700', color: '#282828', marginBottom: 6, minHeight: 34 },
  cardValor: { fontSize: 15, fontWeight: '800', color: '#282828' },
  cardValorSufixo: { fontSize: 10, fontWeight: '600', color: '#A0A2A8' },

  label: { fontSize: 12, fontWeight: '800', color: '#6A6C72', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7E9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#282828', marginBottom: 4 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  selectBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7E9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectBtnText: { fontSize: 14, color: '#282828', textTransform: 'capitalize' },

  fotoPreviewBox: { position: 'relative', marginRight: 8 },
  fotoPreview: { width: 70, height: 70, borderRadius: 12 },
  fotoRemoveBtn: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  fotoAddBtn: { width: 70, height: 70, borderRadius: 14, backgroundColor: '#F0F0F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E6E7E9', borderStyle: 'dashed' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  switchLabel: { fontSize: 13, fontWeight: '700', color: '#282828', flex: 1, marginRight: 10 },

  promoRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  tipoDescontoBtn: { width: 44, height: 44, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  tipoDescontoBtnAtivo: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  tipoDescontoText: { fontWeight: '800', color: '#6A6C72' },
  tipoDescontoTextAtivo: { color: '#FFFFFF' },

  salvarBtn: { backgroundColor: '#12A150', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  salvarBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  categoriaOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  categoriaModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  categoriaModalTitulo: { fontSize: 16, fontWeight: '800', color: '#282828', marginBottom: 14 },
  categoriaGrupoLabel: { fontSize: 11, fontWeight: '800', color: '#282828', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  categoriaOpcao: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  categoriaOpcaoText: { fontSize: 14, color: '#282828', textTransform: 'capitalize' },
  categoriaFechar: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  categoriaFecharText: { color: '#6A6C72', fontWeight: '700' },

  secaoTitulo: { fontSize: 14, fontWeight: '800', color: '#282828', marginTop: 24, marginBottom: 4, borderTopWidth: 1, borderTopColor: '#F0F0F2', paddingTop: 18 },
  opcoesRow: { flexDirection: 'row', gap: 8 },
  opcaoBtn: { flex: 1, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  opcaoBtnAtiva: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  opcaoBtnText: { fontSize: 12, fontWeight: '700', color: '#6A6C72', textAlign: 'center' },
  opcaoBtnTextAtiva: { color: '#FFFFFF' },
  avisoBox: { backgroundColor: '#F0F0F2', borderRadius: 14, padding: 12, marginTop: 4 },
  avisoBoxText: { fontSize: 12, color: '#6A6C72' },

  comodidadesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  comodidadeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F0F0F2', width: '31%' },
  comodidadeChipAtiva: { backgroundColor: '#FFF0E5' },
  comodidadeChipText: { fontSize: 11, fontWeight: '700', color: '#6A6C72' },
  addComodidadeBtn: { paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#FF7A00', justifyContent: 'center' },
  addComodidadeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  comodidadeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F0F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  comodidadeTagText: { fontSize: 12, fontWeight: '700', color: '#282828' },

  diaBtn: { width: 44, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E6E7E9', backgroundColor: '#FFFFFF', alignItems: 'center' },
  diaBtnAtivo: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  diaBtnText: { fontSize: 11, fontWeight: '700', color: '#6A6C72' },
  diaBtnTextAtivo: { color: '#FFFFFF' },
});
