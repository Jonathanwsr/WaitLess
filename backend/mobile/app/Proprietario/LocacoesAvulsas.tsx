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
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const BASE_URL = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
const API_URL = `${BASE_URL}/proprietario/locacoes-avulsas`;

interface ItemLocacao {
  id: number;
  nome: string;
  categoria: string;
  descricao: string | null;
  valor_diaria: string | number;
  somente_premium: boolean;
  tem_promocao: boolean;
  tipo_desconto: string;
  valor_desconto: string | number | null;
  aceita_pontos: boolean;
  maximo_pontos_permitidos: number | null;
  ativo: boolean;
  fotos: string[] | null;
}

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
  somente_premium: false,
  tem_promocao: false,
  tipo_desconto: 'percentual',
  valor_desconto: '',
  aceita_pontos: false,
  maximo_pontos_permitidos: '',
  ativo: true,
};

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
  const [fotos, setFotos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

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
    setFotos([]);
    setModalVisivel(true);
  };

  const abrirEdicao = (item: ItemLocacao) => {
    setEditandoId(item.id);
    setForm({
      nome: item.nome,
      categoria: item.categoria,
      descricao: item.descricao || '',
      valor_diaria: String(item.valor_diaria ?? ''),
      somente_premium: !!item.somente_premium,
      tem_promocao: !!item.tem_promocao,
      tipo_desconto: item.tipo_desconto || 'percentual',
      valor_desconto: item.valor_desconto ? String(item.valor_desconto) : '',
      aceita_pontos: !!item.aceita_pontos,
      maximo_pontos_permitidos: item.maximo_pontos_permitidos ? String(item.maximo_pontos_permitidos) : '',
      ativo: item.ativo,
    });
    setFotos([]);
    setModalVisivel(true);
  };

  const escolherFotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às fotos para continuar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 6 - fotos.length),
      quality: 0.8,
    });
    if (!res.canceled) {
      setFotos((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, 6));
    }
  };

  const removerFoto = (uri: string) => setFotos((prev) => prev.filter((f) => f !== uri));

  const salvar = async () => {
    if (!form.nome.trim() || !form.categoria || !form.valor_diaria) {
      Alert.alert('Campos obrigatórios', 'Preencha nome, categoria e valor da diária.');
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
      formData.append('somente_premium', form.somente_premium ? '1' : '0');
      formData.append('tem_promocao', form.tem_promocao ? '1' : '0');
      formData.append('tipo_desconto', form.tipo_desconto);
      formData.append('valor_desconto', form.valor_desconto || '0');
      formData.append('aceita_pontos', form.aceita_pontos ? '1' : '0');
      formData.append('maximo_pontos_permitidos', form.maximo_pontos_permitidos || '0');
      formData.append('ativo', form.ativo ? '1' : '0');
      fotos.forEach((uri, idx) => {
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
      carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar a locação.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = (item: ItemLocacao) => {
    Alert.alert('Excluir locação', `Tem certeza que deseja excluir "${item.nome}"?`, [
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
            Alert.alert('Erro', 'Não foi possível excluir a locação.');
          }
        },
      },
    ]);
  };

  const todasCategorias = Object.entries(categorias);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5A00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#1E293B" />
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
              <Feather name="clock" size={14} color="#FF5A00" /> Em uso agora
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
            <Feather name="home" size={40} color="#CBD5E1" />
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
                        <Feather name="image" size={28} color="#CBD5E1" />
                      </View>
                    )}
                    <View style={styles.badgesRow}>
                      {item.somente_premium && (
                        <View style={[styles.badge, { backgroundColor: '#FF5A00' }]}>
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
                        <Feather name="edit-2" size={14} color="#1E293B" />
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
              <Feather name="x" size={22} color="#1E293B" />
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
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Categoria</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setCategoriaModalVisivel(true)}>
              <Text style={[styles.selectBtnText, !form.categoria && { color: '#94A3B8' }]}>
                {form.categoria ? form.categoria.replace(/_/g, ' ') : 'Selecione uma categoria'}
              </Text>
              <Feather name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.label}>Valor da diária (R$)</Text>
            <TextInput
              style={styles.input}
              value={form.valor_diaria}
              onChangeText={(v) => setForm((f) => ({ ...f, valor_diaria: v.replace(/[^0-9.,]/g, '') }))}
              placeholder="0,00"
              keyboardType="decimal-pad"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.descricao}
              onChangeText={(v) => setForm((f) => ({ ...f, descricao: v }))}
              placeholder="Detalhes da locação..."
              multiline
              numberOfLines={4}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Fotos (até 6)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {fotos.map((uri) => (
                <View key={uri} style={styles.fotoPreviewBox}>
                  <Image source={{ uri }} style={styles.fotoPreview} />
                  <TouchableOpacity style={styles.fotoRemoveBtn} onPress={() => removerFoto(uri)}>
                    <Feather name="x" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {fotos.length < 6 && (
                <TouchableOpacity style={styles.fotoAddBtn} onPress={escolherFotos}>
                  <Feather name="camera" size={22} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}><Feather name="award" size={14} color="#FF5A00" /> Somente clientes Premium</Text>
              <Switch
                value={form.somente_premium}
                onValueChange={(v) => setForm((f) => ({ ...f, somente_premium: v }))}
                trackColor={{ true: '#FF5A00' }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Tem promoção / desconto</Text>
              <Switch
                value={form.tem_promocao}
                onValueChange={(v) => setForm((f) => ({ ...f, tem_promocao: v }))}
                trackColor={{ true: '#FF5A00' }}
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
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Aceita pontos como desconto</Text>
              <Switch
                value={form.aceita_pontos}
                onValueChange={(v) => setForm((f) => ({ ...f, aceita_pontos: v }))}
                trackColor={{ true: '#FF5A00' }}
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
                  placeholderTextColor="#94A3B8"
                />
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Ativo (visível para clientes)</Text>
              <Switch
                value={form.ativo}
                onValueChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                trackColor={{ true: '#FF5A00' }}
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
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5A00', justifyContent: 'center', alignItems: 'center' },

  erroBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginTop: 12 },
  erroTexto: { color: '#DC2626', fontSize: 13, fontWeight: '600' },

  emUsoSection: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  emUsoTitulo: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  emUsoCard: { backgroundColor: '#FFF3EC', borderRadius: 12, padding: 10, marginBottom: 6 },
  emUsoNome: { fontWeight: '700', color: '#1E293B', fontSize: 13 },
  emUsoLocatario: { fontSize: 12, color: '#64748B', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateText: { color: '#94A3B8', fontWeight: '600', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  emptyStateBtn: { backgroundColor: '#FF5A00', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyStateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, paddingBottom: 24 },
  card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardImageBox: { height: 110, backgroundColor: '#F1F5F9', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badgesRow: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  cardActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
  cardActionBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 10 },
  cardCategoria: { fontSize: 9, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 },
  cardNome: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 6, minHeight: 34 },
  cardValor: { fontSize: 15, fontWeight: '900', color: '#FF5A00' },
  cardValorSufixo: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },

  label: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E293B', marginBottom: 4 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  selectBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectBtnText: { fontSize: 14, color: '#1E293B', textTransform: 'capitalize' },

  fotoPreviewBox: { position: 'relative', marginRight: 8 },
  fotoPreview: { width: 70, height: 70, borderRadius: 12 },
  fotoRemoveBtn: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  fotoAddBtn: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  switchLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 10 },

  promoRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  tipoDescontoBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  tipoDescontoBtnAtivo: { backgroundColor: '#FF5A00', borderColor: '#FF5A00' },
  tipoDescontoText: { fontWeight: '800', color: '#64748B' },
  tipoDescontoTextAtivo: { color: '#FFFFFF' },

  salvarBtn: { backgroundColor: '#FF5A00', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  salvarBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  categoriaOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  categoriaModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  categoriaModalTitulo: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 14 },
  categoriaGrupoLabel: { fontSize: 11, fontWeight: '800', color: '#FF5A00', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  categoriaOpcao: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  categoriaOpcaoText: { fontSize: 14, color: '#334155', textTransform: 'capitalize' },
  categoriaFechar: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  categoriaFecharText: { color: '#64748B', fontWeight: '700' },
});
