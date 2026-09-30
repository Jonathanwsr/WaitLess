import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertar } from '../../../services/alertar';

const COLORS = {
  primary: '#FF7A00',
  primaryLight: '#FFF0E6',
  dark: '#282828',
  gray: '#6A6C72',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  border: '#E6E7E9',
  success: '#00A868',
  successLight: '#D1FAE5',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const PAPEL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  socio: 'Proprietário',
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  funcionario: 'Funcionário',
  atendente: 'Funcionário',
  user: 'Cliente',
};

const chaveCatalogoPorPapel = (papel: string) => (['socio', 'proprietario', 'gerente'].includes(papel) ? 'socio' : 'user');

interface PlanoInfo { valor: number; ciclo: string; tipo_publico: string; }
interface Usuario {
  id: number;
  name: string;
  email: string;
  foto_perfil?: string | null;
  papel: string;
  plano_assinatura?: string | null;
  plano_expira_em?: string | null;
  asaas_subscription_status?: string | null;
  pontos_saldo?: number;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

function statusPlano(usuario: Usuario) {
  const temPlano = usuario.plano_assinatura && usuario.plano_assinatura !== 'gratuito';
  const cancelado = usuario.asaas_subscription_status === 'CANCELLED';
  const expirado = usuario.plano_expira_em ? new Date(usuario.plano_expira_em) < new Date() : false;

  if (!temPlano) return { label: 'Gratuito', cor: COLORS.gray, fundo: COLORS.lightGray };
  if (cancelado || expirado) return { label: `${usuario.plano_assinatura} (expirado)`, cor: COLORS.danger, fundo: COLORS.dangerLight };
  return { label: usuario.plano_assinatura as string, cor: COLORS.success, fundo: COLORS.successLight };
}

export default function AdminUsuarios() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [catalogoPlanos, setCatalogoPlanos] = useState<Record<string, Record<string, PlanoInfo>>>({});
  const [modalUsuario, setModalUsuario] = useState<Usuario | null>(null);

  const carregar = useCallback(async (opts?: { isRefresh?: boolean; page?: number; termo?: string }) => {
    const page = opts?.page ?? 1;
    const termo = opts?.termo ?? busca;
    opts?.isRefresh ? setAtualizando(true) : setCarregando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/admin/usuarios?busca=${encodeURIComponent(termo)}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      setUsuarios(data.usuarios?.data || []);
      setPagina(data.usuarios?.current_page || 1);
      setUltimaPagina(data.usuarios?.last_page || 1);
      setCatalogoPlanos(data.catalogoPlanos || {});
    } catch (e) {
      // segue com lista vazia; não é crítico
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [busca]);

  useFocusEffect(
    useCallback(() => {
      carregar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const pesquisar = () => carregar({ page: 1, termo: busca });

  const revogar = (usuario: Usuario) => {
    alertar(
      'Revogar plano',
      `Revogar o plano de ${usuario.name}? O acesso premium dela(e) é encerrado imediatamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar', style: 'destructive', onPress: async () => {
            try {
              const token = await pegarToken();
              await fetch(`${API_URL}/admin/usuarios/${usuario.id}/revogar-plano`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
              carregar({ page: pagina });
            } catch (e) {
              alertar('Erro', 'Não foi possível revogar o plano.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuários</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou e-mail..."
          placeholderTextColor={COLORS.gray}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={pesquisar}
          returnKeyType="search"
        />
      </View>

      {carregando ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregar({ isRefresh: true, page: pagina })} colors={[COLORS.primary]} />}
        >
          {usuarios.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="people-outline" size={40} color={COLORS.gray} />
              <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
            </View>
          ) : (
            usuarios.map((usuario) => {
              const status = statusPlano(usuario);
              const temPlanoAtivo = !!usuario.plano_assinatura && usuario.plano_assinatura !== 'gratuito' && usuario.asaas_subscription_status !== 'CANCELLED';
              return (
                <View key={usuario.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.avatar}>
                      {usuario.foto_perfil ? (
                        <Image source={{ uri: usuario.foto_perfil }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>{usuario.name?.charAt(0)?.toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.nome} numberOfLines={1}>{usuario.name}</Text>
                      <Text style={styles.email} numberOfLines={1}>{usuario.email}</Text>
                    </View>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={styles.papelBadge}>
                      <Text style={styles.papelBadgeText}>{PAPEL_LABEL[usuario.papel] || usuario.papel}</Text>
                    </View>
                    <View style={[styles.planoBadge, { backgroundColor: status.fundo }]}>
                      <Text style={[styles.planoBadgeText, { color: status.cor }]}>{status.label}</Text>
                    </View>
                    <View style={styles.pontosBadge}>
                      <Ionicons name="sparkles" size={11} color={COLORS.primary} />
                      <Text style={styles.pontosBadgeText}>{usuario.pontos_saldo ?? 0}</Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.btnLiberar} onPress={() => setModalUsuario(usuario)}>
                      <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.btnLiberarText}>Liberar plano</Text>
                    </TouchableOpacity>
                    {temPlanoAtivo && (
                      <TouchableOpacity style={styles.btnRevogar} onPress={() => revogar(usuario)}>
                        <Ionicons name="ban-outline" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {ultimaPagina > 1 && (
            <View style={styles.paginacao}>
              <TouchableOpacity
                disabled={pagina <= 1}
                onPress={() => carregar({ page: pagina - 1 })}
                style={[styles.pagBtn, pagina <= 1 && styles.pagBtnDisabled]}
              >
                <Text style={styles.pagBtnText}>Anterior</Text>
              </TouchableOpacity>
              <Text style={styles.pagInfo}>{pagina} / {ultimaPagina}</Text>
              <TouchableOpacity
                disabled={pagina >= ultimaPagina}
                onPress={() => carregar({ page: pagina + 1 })}
                style={[styles.pagBtn, pagina >= ultimaPagina && styles.pagBtnDisabled]}
              >
                <Text style={styles.pagBtnText}>Próxima</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <ModalLiberarPlano
        usuario={modalUsuario}
        catalogoPlanos={catalogoPlanos}
        onFechar={() => setModalUsuario(null)}
        onSucesso={() => { setModalUsuario(null); carregar({ page: pagina }); }}
      />
    </SafeAreaView>
  );
}

function ModalLiberarPlano({ usuario, catalogoPlanos, onFechar, onSucesso }: {
  usuario: Usuario | null;
  catalogoPlanos: Record<string, Record<string, PlanoInfo>>;
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [plano, setPlano] = useState('');
  const [dias, setDias] = useState('30');
  const [enviando, setEnviando] = useState(false);

  if (!usuario) return null;

  const chave = chaveCatalogoPorPapel(usuario.papel);
  const planosDisponiveis = Object.entries(catalogoPlanos[chave] || {});

  const submeter = async () => {
    if (!plano) return alertar('Atenção', 'Selecione um plano.');
    setEnviando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/admin/usuarios/${usuario.id}/liberar-plano`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, dias: parseInt(dias, 10) || 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao liberar plano.');
      alertar('Sucesso', data.message || 'Plano liberado!');
      setPlano('');
      setDias('30');
      onSucesso();
    } catch (e: any) {
      alertar('Erro', e.message || 'Não foi possível liberar o plano.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <TouchableOpacity onPress={onFechar} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={COLORS.gray} />
          </TouchableOpacity>

          <View style={styles.modalHeaderRow}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Liberar plano cortesia</Text>
          </View>
          <Text style={styles.modalSubtitle}>Para {usuario.name} — não gera cobrança na Asaas.</Text>

          <Text style={styles.modalLabel}>Plano</Text>
          <View style={styles.planoOptions}>
            {planosDisponiveis.map(([id, info]) => (
              <TouchableOpacity
                key={id}
                style={[styles.planoOption, plano === id && styles.planoOptionSelected]}
                onPress={() => setPlano(id)}
              >
                <Text style={[styles.planoOptionText, plano === id && styles.planoOptionTextSelected]}>
                  {id} — R$ {info.valor.toFixed(2)}/{info.ciclo}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Duração (dias)</Text>
          <TextInput
            style={styles.modalInput}
            keyboardType="number-pad"
            value={dias}
            onChangeText={setDias}
          />

          <TouchableOpacity style={styles.modalSubmit} disabled={enviando || !plano} onPress={submeter}>
            {enviando ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalSubmitText}>Liberar plano</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: COLORS.gray, fontWeight: '600', textAlign: 'center' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.lightGray, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: COLORS.gray },
  nome: { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  email: { fontSize: 12, color: COLORS.gray, marginTop: 2 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  papelBadge: { backgroundColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  papelBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.gray },
  planoBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  planoBadgeText: { fontSize: 11, fontWeight: '800' },
  pontosBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pontosBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  btnLiberar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
  },
  btnLiberarText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  btnRevogar: { backgroundColor: COLORS.dangerLight, padding: 9, borderRadius: 12 },

  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
  pagBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.lightGray },
  pagBtnDisabled: { opacity: 0.4 },
  pagBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  pagInfo: { fontSize: 12, fontWeight: '700', color: COLORS.gray },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  modalSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.gray, textTransform: 'uppercase', marginBottom: 8 },
  planoOptions: { gap: 8, marginBottom: 16 },
  planoOption: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  planoOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  planoOptionText: { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  planoOptionTextSelected: { color: COLORS.primary, fontWeight: '800' },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: COLORS.dark, marginBottom: 20,
  },
  modalSubmit: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalSubmitText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
