import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alternarFavoritoRemoto } from '../../../services/favoritos';
import { T } from '../../../constants/ClientTheme';
import { FavoriteButton, HeaderCliente } from '../../../components/client/ui';

interface Estabelecimento {
  id: number | string;
  nome: string;
  foto_banner?: string;
  foto_perfil?: string;
  cidade?: string;
  estado?: string;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
  preco_medio?: string | number;
  valor?: string | number;
  ramo_atuacao?: string;
}

interface Servico {
  id: number | string;
  nome: string;
  foto?: string;
  categoria?: string;
  duracao_minutos?: number;
  valor?: string | number;
  avaliacao_media?: string | number;
  total_avaliacoes?: number;
  estabelecimento?: {
    id?: number | string;
    nome?: string;
    foto_perfil?: string;
  };
  cidade?: string;
}

interface ItemReserva {
  id: number | string;
  nome: string;
  categoria?: string;
  fotos?: string[] | string | null;
  cidade?: string | null;
  estado?: string | null;
  valor_diaria?: string | number;
  estabelecimento?: { nome?: string; name?: string; foto_perfil?: string; cidade?: string; estado?: string } | null;
}

interface ItemRemover {
  id: number | string;
  nome: string;
  tipo: 'estabelecimento' | 'servico' | 'item_aluguel';
}

interface DadosFavoritos {
  estabelecimentos: Estabelecimento[];
  servicos: Servico[];
  reservas: ItemReserva[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function FavoritosDashboard() {
  const router = useRouter();

  const [abaAtiva, setAbaAtiva] = useState<'todos' | 'estabelecimentos' | 'servicos' | 'reservas'>('todos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dados, setDados] = useState<DadosFavoritos>({ estabelecimentos: [], servicos: [], reservas: [] });

  const [modalVisivel, setModalVisivel] = useState(false);
  const [itemParaRemover, setItemParaRemover] = useState<ItemRemover | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    carregarFavoritos();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarFavoritos();
    setRefreshing(false);
  };

  const carregarFavoritos = async () => {
    setLoading(true);
    try {
      const token = (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
      const res = await fetch(`${API_URL}/favoritos`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();

      setDados({
        estabelecimentos: json.estabelecimentos || [],
        servicos: json.servicos || [],
        reservas: json.itens_aluguel || [],
      });
    } catch (e) {
      console.log('Erro ao carregar favoritos da API');
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal de confirmação antes de remover
  const solicitarRemocao = (item: Estabelecimento | Servico | ItemReserva, tipo: 'estabelecimento' | 'servico' | 'item_aluguel') => {
    setItemParaRemover({ id: item.id, nome: item.nome, tipo });
    setModalVisivel(true);
  };

  // Executa a remoção via API e atualiza a tela
  const confirmarRemocao = async () => {
    if (!itemParaRemover) return;
    setRemovendo(true);

    try {
      const resultado = await alternarFavoritoRemoto(`${API_URL}/favoritos/toggle`, itemParaRemover.tipo, Number(itemParaRemover.id));
      if (resultado === null) return; // o aviso de erro já foi mostrado; mantém o item na lista

      if (itemParaRemover.tipo === 'estabelecimento') {
        setDados((prev) => ({ ...prev, estabelecimentos: prev.estabelecimentos.filter((e) => e.id !== itemParaRemover.id) }));
      } else if (itemParaRemover.tipo === 'item_aluguel') {
        setDados((prev) => ({ ...prev, reservas: prev.reservas.filter((r) => r.id !== itemParaRemover.id) }));
      } else {
        setDados((prev) => ({ ...prev, servicos: prev.servicos.filter((s) => s.id !== itemParaRemover.id) }));
      }
    } catch (e) {
      console.log('Erro ao remover favorito');
    } finally {
      setRemovendo(false);
      setModalVisivel(false);
      setItemParaRemover(null);
    }
  };

  const temEstabelecimentos = dados.estabelecimentos.length > 0;
  const temServicos = dados.servicos.length > 0;
  const temReservas = dados.reservas.length > 0;
  const estaVazio = !temEstabelecimentos && !temServicos && !temReservas;
  const total = dados.estabelecimentos.length + dados.servicos.length + dados.reservas.length;

  const ABAS = [
    { id: 'todos', rotulo: 'Todos', icone: 'heart' },
    { id: 'estabelecimentos', rotulo: 'Locais', icone: 'storefront-outline' },
    { id: 'servicos', rotulo: 'Serviços', icone: 'briefcase-outline' },
    { id: 'reservas', rotulo: 'Reservas', icone: 'key-outline' },
  ] as const;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />}
      >
        <HeaderCliente voltar tituloMenor titulo="Favoritos" subtitulo="Os lugares e serviços que você mais gosta e quer voltar depois" />

        {/* ABAS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.abas}>
          {ABAS.map((a) => {
            const on = abaAtiva === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.chip, on && s.chipOn]} onPress={() => setAbaAtiva(a.id)} activeOpacity={0.85}>
                <Ionicons name={a.icone as never} size={16} color={on ? '#fff' : T.ink} />
                <Text style={[s.chipTxt, on && { color: '#fff' }]}>{a.rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* DICA */}
        <View style={s.dica}>
          <View style={s.dicaIcone}><Ionicons name="heart" size={18} color={T.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.dicaTitulo}>Dica Lokyva</Text>
            <Text style={s.dicaTxt}>
              {total === 0 ? 'Salve seus favoritos para encontrá-los rápido depois.' : `Você tem ${total} ${total === 1 ? 'item salvo' : 'itens salvos'}. Toque no coração para remover.`}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={s.centro}><ActivityIndicator size="large" color={T.primary} /></View>
        ) : estaVazio ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="heart-dislike-outline" size={30} color={T.faint} /></View>
            <Text style={s.vazioTitulo}>Nenhum favorito salvo</Text>
            <Text style={s.vazioTxt}>Você ainda não salvou nenhum local ou serviço. Explore e toque no coração!</Text>
            <TouchableOpacity style={s.btnPrim} onPress={() => router.push('/(tabs)/explorar')} activeOpacity={0.85}>
              <Text style={s.btnPrimTxt}>Explorar agora</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {(abaAtiva === 'todos' || abaAtiva === 'estabelecimentos') && temEstabelecimentos && (
              <>
                {abaAtiva === 'todos' && <Text style={s.secao}>Locais salvos</Text>}
                {dados.estabelecimentos.map((item) => (
                  <TouchableOpacity
                    key={`e-${item.id}`}
                    style={s.card}
                    activeOpacity={0.9}
                    onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: item.id } })}
                  >
                    <View style={s.foto}>
                      <Image source={{ uri: item.foto_banner || item.foto_perfil || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600' }} style={s.fotoImg} contentFit="cover" />
                      <FavoriteButton ativo onPress={() => solicitarRemocao(item, 'estabelecimento')} tamanho={38} style={s.coracao} />
                    </View>
                    <View style={s.corpo}>
                      <Text style={s.nome} numberOfLines={1}>{item.nome}</Text>
                      <View style={s.linha}>
                        <Ionicons name="location-outline" size={14} color={T.muted} />
                        <Text style={s.linhaTxt} numberOfLines={1}>{item.cidade ? `${item.cidade}${item.estado ? `, ${item.estado}` : ''}` : item.ramo_atuacao || 'Local'}</Text>
                      </View>
                      <View style={s.linha}>
                        <Ionicons name="star" size={14} color={T.success} />
                        <Text style={s.nota}>
                          {item.avaliacao_media ? Number(item.avaliacao_media).toFixed(1).replace('.', ',') : 'Novo'}
                          {item.total_avaliacoes ? <Text style={s.notaQtd}> ({item.total_avaliacoes} avaliações)</Text> : null}
                        </Text>
                      </View>
                      <View style={s.rodape}>
                        <Text style={s.categoria} numberOfLines={1}>{item.ramo_atuacao || 'Estabelecimento'}</Text>
                        {item.preco_medio || item.valor ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.preco}>{brl(item.preco_medio || item.valor)}</Text>
                            <Text style={s.precoSub}>a partir de</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {(abaAtiva === 'todos' || abaAtiva === 'servicos') && temServicos && (
              <>
                {abaAtiva === 'todos' && <Text style={s.secao}>Serviços salvos</Text>}
                {dados.servicos.map((item) => (
                  <TouchableOpacity
                    key={`s-${item.id}`}
                    style={s.card}
                    activeOpacity={0.9}
                    onPress={() => router.push({ pathname: '/src/screens/ExplorarDetalhes', params: { id: item.id, tipo: 'servicos' } })}
                  >
                    <View style={s.foto}>
                      <Image source={{ uri: item.foto || item.estabelecimento?.foto_perfil || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600' }} style={s.fotoImg} contentFit="cover" />
                      <FavoriteButton ativo onPress={() => solicitarRemocao(item, 'servico')} tamanho={38} style={s.coracao} />
                    </View>
                    <View style={s.corpo}>
                      <Text style={s.nome} numberOfLines={1}>{item.nome}</Text>
                      <View style={s.linha}>
                        <Ionicons name="storefront-outline" size={14} color={T.muted} />
                        <Text style={s.linhaTxt} numberOfLines={1}>{item.estabelecimento?.nome || item.cidade || 'Local'}</Text>
                      </View>
                      <View style={s.linha}>
                        <Ionicons name="star" size={14} color={T.success} />
                        <Text style={s.nota}>
                          {item.avaliacao_media ? Number(item.avaliacao_media).toFixed(1).replace('.', ',') : 'Novo'}
                          {item.total_avaliacoes ? <Text style={s.notaQtd}> ({item.total_avaliacoes} avaliações)</Text> : null}
                        </Text>
                      </View>
                      <View style={s.rodape}>
                        <View style={s.tags}>
                          {!!item.categoria && <View style={s.tag}><Text style={s.tagTxt}>{item.categoria}</Text></View>}
                          {!!item.duracao_minutos && <View style={s.tag}><Text style={s.tagTxt}>{item.duracao_minutos} min</Text></View>}
                        </View>
                        {item.valor ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.preco}>{brl(item.valor)}</Text>
                            <Text style={s.precoSub}>por serviço</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {(abaAtiva === 'todos' || abaAtiva === 'reservas') && temReservas && (
              <>
                {abaAtiva === 'todos' && <Text style={s.secao}>Reservas salvas</Text>}
                {dados.reservas.map((item) => {
                  const fotos = Array.isArray(item.fotos) ? item.fotos : (() => { try { return JSON.parse(String(item.fotos || '[]')); } catch { return []; } })();
                  const local = [item.cidade || item.estabelecimento?.cidade, item.estado || item.estabelecimento?.estado].filter(Boolean).join(' - ');
                  return (
                    <TouchableOpacity
                      key={`r-${item.id}`}
                      style={s.card}
                      activeOpacity={0.9}
                      onPress={() => router.push({ pathname: '/src/screens/ExplorarDetalhes', params: { id: item.id, tipo: 'reservas' } })}
                    >
                      <View style={s.foto}>
                        <Image source={{ uri: fotos[0] || item.estabelecimento?.foto_perfil || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=600' }} style={s.fotoImg} contentFit="cover" />
                        <FavoriteButton ativo onPress={() => solicitarRemocao(item, 'item_aluguel')} tamanho={38} style={s.coracao} />
                      </View>
                      <View style={s.corpo}>
                        <Text style={s.nome} numberOfLines={1}>{item.nome}</Text>
                        {!!local && (
                          <View style={s.linha}>
                            <Ionicons name="location-outline" size={14} color={T.muted} />
                            <Text style={s.linhaTxt} numberOfLines={1}>{local}</Text>
                          </View>
                        )}
                        <View style={s.rodape}>
                          <View style={s.tags}>
                            {!!item.categoria && <View style={s.tag}><Text style={s.tagTxt}>{String(item.categoria).replace(/_/g, ' ')}</Text></View>}
                          </View>
                          {item.valor_diaria ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={s.preco}>{brl(item.valor_diaria)}</Text>
                              <Text style={s.precoSub}>por diária</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO */}
      <Modal visible={modalVisivel} transparent animationType="fade" onRequestClose={() => setModalVisivel(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalIcone}><Ionicons name="heart-dislike-outline" size={28} color={T.danger} /></View>
            <Text style={s.modalTitulo}>Remover dos favoritos?</Text>
            <Text style={s.modalMsg}>
              Tem certeza que deseja remover <Text style={{ fontWeight: '800', color: T.ink }}>"{itemParaRemover?.nome}"</Text> dos seus salvos?
            </Text>
            <View style={s.modalAcoes}>
              <TouchableOpacity style={s.modalCancelar} onPress={() => setModalVisivel(false)} disabled={removendo}>
                <Text style={s.modalCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirmar} onPress={confirmarRemocao} disabled={removendo}>
                {removendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalConfirmarTxt}>Sim, remover</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  centro: { paddingVertical: 60, alignItems: 'center' },

  abas: { paddingHorizontal: 20, gap: 8, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderWidth: 1, borderColor: T.line, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  chipOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipTxt: { fontSize: 13, fontWeight: '700', color: T.ink },

  dica: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, marginHorizontal: 20, marginVertical: 10, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  dicaIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dicaTitulo: { fontSize: 13, fontWeight: '800', color: T.primary },
  dicaTxt: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },

  secao: { fontSize: 18, fontWeight: '800', color: T.ink, marginVertical: 10, letterSpacing: -0.3 },

  card: { backgroundColor: T.card, borderRadius: 22, marginBottom: 16, borderWidth: 1, borderColor: T.line, overflow: 'hidden', shadowColor: '#7C2D12', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  foto: { height: 170, backgroundColor: T.line },
  fotoImg: { width: '100%', height: '100%' },
  coracao: { position: 'absolute', top: 12, right: 12 },
  corpo: { padding: 14, gap: 6 },
  nome: { fontSize: 17, fontWeight: '800', color: T.ink },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linhaTxt: { flex: 1, fontSize: 13, color: T.muted },
  nota: { fontSize: 13, fontWeight: '700', color: T.ink },
  notaQtd: { fontWeight: '400', color: T.muted },
  rodape: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line },
  categoria: { flex: 1, fontSize: 13, color: T.muted, fontWeight: '500' },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: T.primarySoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagTxt: { fontSize: 11, fontWeight: '700', color: T.primary },
  preco: { fontSize: 18, fontWeight: '800', color: T.primary },
  precoSub: { fontSize: 11, color: T.muted },

  vazio: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  vazioIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 18, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 14, color: T.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  btnPrim: { marginTop: 18, backgroundColor: T.primary, paddingHorizontal: 24, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(31,26,23,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 26, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
  modalIcone: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitulo: { fontSize: 19, fontWeight: '800', color: T.ink },
  modalMsg: { fontSize: 14, color: T.muted, textAlign: 'center', marginTop: 8, lineHeight: 20, marginBottom: 20 },
  modalAcoes: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelar: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: T.cream, borderWidth: 1, borderColor: T.line },
  modalCancelarTxt: { color: T.ink, fontWeight: '700' },
  modalConfirmar: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: T.danger },
  modalConfirmarTxt: { color: '#fff', fontWeight: '700' },
});
