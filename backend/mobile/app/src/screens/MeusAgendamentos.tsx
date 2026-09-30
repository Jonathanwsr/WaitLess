import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';
import { obterEcho } from '../../../services/echo';

interface Estabelecimento {
  nome?: string;
  cidade?: string;
  foto_perfil?: string;
}

interface Servico {
  nome?: string;
  foto?: string;
}

interface ItemAluguel {
  nome?: string;
  fotos?: string[];
}

interface AgendamentoItem {
  id: number;
  estabelecimento_id?: number;
  servico_id?: number;
  status: string;
  status_pagamento?: string;
  data_agendamento?: string;
  data_inicio?: string;
  hora_agendamento?: string;
  valor_total?: number;
  valor_final?: number;
  created_at?: string;
  servico?: Servico;
  itemAluguel?: ItemAluguel;
  estabelecimento?: Estabelecimento;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const TABS = [
  { id: 'todos', label: 'Todas', icone: 'albums-outline' },
  { id: 'proximos', label: 'Próximas', icone: 'calendar-outline' },
  { id: 'andamento', label: 'Em andamento', icone: 'briefcase-outline' },
  { id: 'pendentes', label: 'Faltam pagar', icone: 'card-outline' },
  { id: 'concluidos', label: 'Concluídas', icone: 'checkmark-circle-outline' },
  { id: 'cancelados', label: 'Canceladas', icone: 'close-circle-outline' },
] as const;

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function MeusAgendamentos() {
  const router = useRouter();

  const [abaAtiva, setAbaAtiva] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [lista, setLista] = useState<AgendamentoItem[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  // Atualização em tempo real: quando o pagamento (PIX/boleto/cartão) é
  // confirmado pelo webhook do gateway, o status muda no banco na hora — sem
  // isso, a lista só atualizaria com um "puxar para atualizar" manual.
  useEffect(() => {
    const estabelecimentoIds = [...new Set(
      lista.map((a) => a.estabelecimento_id).filter((id): id is number => Boolean(id))
    )];
    if (estabelecimentoIds.length === 0) return;

    let cancelado = false;
    const canais = estabelecimentoIds.map((id) => `fila.${id}`);

    obterEcho().then((echo) => {
      if (cancelado) return;
      canais.forEach((canalNome) => {
        echo.channel(canalNome).listen('.FilaAtualizada', () => {
          carregarAgendamentos();
        });
      });
    });

    return () => {
      cancelado = true;
      obterEcho().then((echo) => canais.forEach((canalNome) => echo.leave(canalNome)));
    };
  }, [lista.map((a) => a.estabelecimento_id).join(',')]);

  const carregarAgendamentos = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const response = await fetch(`${API_URL}/meus-agendamentos`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const data = await response.json();
      if (Array.isArray(data)) {
        setLista(data);
      } else if (data.data) {
        setLista(data.data);
      }
    } catch (error) {
      alertar('Erro', 'Não foi possível carregar o seu histórico.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarAgendamentos();
  };

  /** Abre a tela de detalhes do mesmo serviço já escolhido; sem dados suficientes, volta ao Explorar. */
  const repetirReserva = (item: AgendamentoItem) => {
    if (item.servico_id) {
      router.push({
        pathname: '/src/screens/ExplorarDetalhes' as never,
        params: { id: String(item.servico_id) },
      });
    } else {
      router.push('/(tabs)/explorar' as never);
    }
  };

  const handleCancelar = (id: number) => {
    alertar('Cancelar reserva', 'Tem certeza que deseja cancelar este agendamento?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('@waitless_token');
            const response = await fetch(`${API_URL}/agendamentos/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
              alertar('Sucesso', 'Agendamento cancelado.');
              carregarAgendamentos();
            } else {
              alertar('Erro', 'Não foi possível cancelar.');
            }
          } catch (e) {
            alertar('Erro', 'Falha na comunicação com o servidor.');
          }
        },
      },
    ]);
  };

  const ehPendentePagamento = (item: AgendamentoItem) => item.status === 'aguardando_pagamento' && item.status_pagamento === 'pendente';

  const filtrar = (item: AgendamentoItem, aba: string) => {
    const pend = ehPendentePagamento(item);
    if (aba === 'todos') return true;
    if (aba === 'pendentes') return pend;
    if (aba === 'andamento') return item.status === 'em_atendimento';
    if (aba === 'proximos') return ['pendente', 'confirmado'].includes(item.status) || (item.status === 'aguardando_pagamento' && !pend);
    if (aba === 'concluidos') return ['finalizado', 'concluido'].includes(item.status);
    if (aba === 'cancelados') return ['cancelado', 'estornado', 'vencido'].includes(item.status);
    return true;
  };

  const dadosFiltrados = lista.filter((item) => {
    const termo = busca.toLowerCase();
    const nomeLocal = (item.estabelecimento?.nome || '').toLowerCase();
    const nomeServico = (item.servico?.nome || item.itemAluguel?.nome || '').toLowerCase();
    if (busca && !nomeLocal.includes(termo) && !nomeServico.includes(termo)) return false;
    return filtrar(item, abaAtiva);
  });

  const contagem = (aba: string) => lista.filter((i) => filtrar(i, aba)).length;
  const idProxima = lista.find((i) => filtrar(i, 'proximos'))?.id;

  const statusInfo = (item: AgendamentoItem) => {
    if (ehPendentePagamento(item)) return { label: 'Aguardando pagamento', bg: '#FEF3C7', cor: '#B45309' };
    if (['finalizado', 'concluido'].includes(item.status)) return { label: 'Concluída', bg: T.successBg, cor: T.success };
    if (['cancelado', 'estornado', 'vencido'].includes(item.status)) return { label: 'Cancelada', bg: '#FEE2E2', cor: T.danger };
    if (item.status === 'em_atendimento') return { label: 'Em andamento', bg: '#E0F2FE', cor: '#0369A1' };
    if (item.status === 'confirmado') return { label: 'Confirmada', bg: T.successBg, cor: T.success };
    return { label: 'Pendente', bg: '#FEF3C7', cor: '#B45309' };
  };

  const formatarData = (dataStr?: string) => {
    if (!dataStr) return 'Data não definida';
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${dia} ${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const abrirDetalhes = (item: AgendamentoItem, isAluguel: boolean) =>
    router.push({ pathname: '/agendamentos/detalhes', params: { id: String(item.id), tipo: isAluguel ? 'aluguel' : 'servico' } });

  const renderCard = (item: AgendamentoItem) => {
    const isAluguel = item.itemAluguel != null;
    const nomePrincipal = item.estabelecimento?.nome || 'Estabelecimento';
    const tituloItem = isAluguel ? item.itemAluguel?.nome : item.servico?.nome || 'Serviço';
    const foto = isAluguel ? item.itemAluguel?.fotos?.[0] : item.servico?.foto || item.estabelecimento?.foto_perfil;
    const st = statusInfo(item);
    const hora = item.hora_agendamento ? item.hora_agendamento.substring(0, 5) : '';
    const podeCancelar = ['pendente', 'confirmado', 'aguardando_pagamento'].includes(item.status);
    const pend = ehPendentePagamento(item);
    const concluido = ['finalizado', 'concluido'].includes(item.status);
    const cancelado = ['cancelado', 'estornado', 'vencido'].includes(item.status);

    return (
      <View key={item.id} style={s.card}>
        <View style={s.foto}>
          <Image source={{ uri: foto || 'https://via.placeholder.com/600x300' }} style={s.fotoImg} contentFit="cover" />
          {item.id === idProxima && (
            <View style={s.tagProxima}><Text style={s.tagProximaTxt}>Próxima reserva</Text></View>
          )}
          <View style={[s.status, { backgroundColor: st.bg }]}>
            <Text style={[s.statusTxt, { color: st.cor }]}>{st.label}</Text>
          </View>
        </View>

        <View style={s.corpo}>
          <Text style={s.titulo} numberOfLines={1}>{tituloItem}</Text>
          <View style={s.local}>
            <Ionicons name="location-outline" size={14} color={T.muted} />
            <Text style={s.localTxt} numberOfLines={1}>{nomePrincipal}{item.estabelecimento?.cidade ? `, ${item.estabelecimento.cidade}` : ''}</Text>
          </View>

          <View style={s.grade}>
            <View style={s.celula}>
              <Ionicons name="calendar-outline" size={17} color={T.primary} />
              <View>
                <Text style={s.celulaTxt}>{formatarData(item.data_agendamento || item.data_inicio)}</Text>
                <Text style={s.celulaSub}>{isAluguel ? 'Diária' : hora ? `às ${hora}h` : ''}</Text>
              </View>
            </View>
            <View style={s.celula}>
              <Ionicons name={isAluguel ? 'key-outline' : 'cut-outline'} size={17} color={T.primary} />
              <View>
                <Text style={s.celulaTxt}>{isAluguel ? 'Aluguel' : 'Serviço'}</Text>
                <Text style={s.celulaSub}>Ref #{item.id}</Text>
              </View>
            </View>
            <View style={s.celula}>
              <Ionicons name="cash-outline" size={17} color={T.primary} />
              <View>
                <Text style={s.celulaTxt}>{brl(item.valor_total || item.valor_final)}</Text>
                <Text style={s.celulaSub}>{pend ? 'a pagar' : 'total'}</Text>
              </View>
            </View>
            <View style={s.celula}>
              <Ionicons name="receipt-outline" size={17} color={T.primary} />
              <View>
                <Text style={s.celulaTxt}>{formatarData(item.created_at)}</Text>
                <Text style={s.celulaSub}>criada em</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.pontosLinha} onPress={() => router.push('/src/screens/MeusPontos' as never)} activeOpacity={0.8}>
            <Ionicons name="gift-outline" size={14} color={T.primary} />
            <Text style={s.pontosTxt} numberOfLines={1}>{concluido ? 'Você ganhou pontos com esta reserva' : 'Ganhe pontos ao concluir esta reserva'}</Text>
            <Ionicons name="chevron-forward" size={14} color={T.faint} />
          </TouchableOpacity>

          <View style={s.botoes}>
            <TouchableOpacity style={s.btnSec} onPress={() => abrirDetalhes(item, isAluguel)} activeOpacity={0.85}>
              <Ionicons name="eye-outline" size={17} color={T.ink} />
              <Text style={s.btnSecTxt}>Ver detalhes</Text>
            </TouchableOpacity>

            {pend ? (
              <TouchableOpacity style={s.btnPrim} onPress={() => router.push({ pathname: '/src/screens/PagamentoScreen', params: { agendamento_id: String(item.id) } })} activeOpacity={0.85}>
                <Ionicons name="card-outline" size={17} color="#fff" />
                <Text style={s.btnPrimTxt}>Pagar agora</Text>
              </TouchableOpacity>
            ) : !cancelado && !isAluguel ? (
              <TouchableOpacity style={s.btnPrim} onPress={() => router.push({ pathname: (concluido ? '/src/screens/AvaliarServico' : '/src/screens/AcompanhamentoFilaScreen') as never, params: { id: String(item.id) } })} activeOpacity={0.85}>
                <Ionicons name={concluido ? 'star-outline' : 'time-outline'} size={17} color="#fff" />
                <Text style={s.btnPrimTxt}>{concluido ? 'Avaliar' : 'Acompanhar fila'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.btnPrim} onPress={() => repetirReserva(item)} activeOpacity={0.85}>
                <Ionicons name="refresh-outline" size={17} color="#fff" />
                <Text style={s.btnPrimTxt}>Reservar de novo</Text>
              </TouchableOpacity>
            )}
          </View>

          {concluido && !isAluguel && !!item.estabelecimento_id && (
            <TouchableOpacity style={s.repetir} onPress={() => repetirReserva(item)} activeOpacity={0.85}>
              <Ionicons name="repeat-outline" size={18} color={T.primary} />
              <Text style={s.repetirTxt}>Repetir esta reserva{item.servico?.nome ? ` · ${item.servico.nome}` : ''}</Text>
            </TouchableOpacity>
          )}

          {podeCancelar && (
            <TouchableOpacity style={s.cancelar} onPress={() => handleCancelar(item.id)} activeOpacity={0.7}>
              <Text style={s.cancelarTxt}>Cancelar reserva</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        <HeaderCliente voltar tituloMenor titulo="Minhas reservas" subtitulo="Acompanhe seus agendamentos e experiências" />

        {/* ABAS EM CARTÕES COM ÍCONE */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.abas}>
          {TABS.map((tab) => {
            const on = abaAtiva === tab.id;
            const n = contagem(tab.id);
            return (
              <TouchableOpacity key={tab.id} style={[s.aba, on && s.abaOn]} onPress={() => setAbaAtiva(tab.id)} activeOpacity={0.85}>
                <Ionicons name={tab.icone as never} size={20} color={on ? T.primary : T.muted} />
                <Text style={[s.abaTxt, on && s.abaTxtOn]}>{tab.label}</Text>
                {n > 0 && tab.id !== 'todos' && (
                  <View style={[s.abaBadge, tab.id === 'pendentes' && { backgroundColor: T.primary }]}><Text style={s.abaBadgeTxt}>{n}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* BUSCA */}
        <View style={s.busca}>
          <Ionicons name="search" size={18} color={T.faint} />
          <TextInput placeholder="Buscar reservas..." placeholderTextColor={T.faint} style={s.buscaInput} value={busca} onChangeText={setBusca} />
          {!!busca && (
            <TouchableOpacity onPress={() => setBusca('')}><Ionicons name="close-circle" size={18} color={T.faint} /></TouchableOpacity>
          )}
        </View>

        {carregando ? (
          <View style={s.centro}><ActivityIndicator size="large" color={T.primary} /></View>
        ) : dadosFiltrados.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="calendar-outline" size={30} color={T.faint} /></View>
            <Text style={s.vazioTitulo}>Nenhuma reserva</Text>
            <Text style={s.vazioTxt}>Você não possui registros nesta categoria.</Text>
            <TouchableOpacity style={s.btnPrimLargo} onPress={() => router.push('/(tabs)/explorar' as never)} activeOpacity={0.85}>
              <Text style={s.btnPrimTxt}>Explorar serviços</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>{dadosFiltrados.map(renderCard)}</View>
        )}

        {/* PONTOS */}
        {!carregando && (
          <View style={s.bannerPontos}>
            <View style={s.bannerPontosIcone}><Ionicons name="gift-outline" size={22} color={T.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerPontosTitulo}>Acumule pontos em suas reservas</Text>
              <Text style={s.bannerPontosTxt}>Use seus pontos para ganhar descontos e benefícios exclusivos.</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/src/screens/MeusPontos' as never)}>
              <Text style={s.bannerPontosLink}>Ver meus pontos</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  repetir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, backgroundColor: T.primarySoft, marginTop: 10 },
  repetirTxt: { color: T.primary, fontWeight: '800', fontSize: 13 },
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centro: { paddingVertical: 60, alignItems: 'center' },

  abas: { paddingHorizontal: 20, gap: 10, paddingVertical: 12 },
  aba: { width: 92, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  abaOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  abaTxt: { fontSize: 11, fontWeight: '600', color: T.muted, textAlign: 'center' },
  abaTxtOn: { color: T.primary, fontWeight: '800' },
  abaBadge: { position: 'absolute', top: 6, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.muted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  abaBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, marginHorizontal: 20, marginBottom: 16, borderRadius: 16, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: T.line },
  buscaInput: { flex: 1, fontSize: 14, color: T.ink },

  card: { backgroundColor: T.card, borderRadius: 22, marginBottom: 18, borderWidth: 1, borderColor: T.line, overflow: 'hidden', shadowColor: '#7C2D12', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  foto: { height: 150, backgroundColor: T.line },
  fotoImg: { width: '100%', height: '100%' },
  tagProxima: { position: 'absolute', top: 12, left: 12, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#F8D9C8' },
  tagProximaTxt: { color: T.primary, fontSize: 11, fontWeight: '800' },
  status: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusTxt: { fontSize: 11, fontWeight: '800' },

  corpo: { padding: 16 },
  titulo: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  local: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  localTxt: { flex: 1, fontSize: 13, color: T.muted },

  grade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 16 },
  celula: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  celulaTxt: { fontSize: 13, fontWeight: '700', color: T.ink },
  celulaSub: { fontSize: 11, color: T.muted, marginTop: 1 },

  pontosLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.primarySoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  pontosTxt: { flex: 1, fontSize: 12, color: T.primary, fontWeight: '600' },

  botoes: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnSec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btnSecTxt: { fontSize: 13, fontWeight: '700', color: T.ink },
  btnPrim: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 23, backgroundColor: T.primary },
  btnPrimTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  btnPrimLargo: { marginTop: 18, paddingHorizontal: 24, height: 48, borderRadius: 24, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  cancelar: { alignItems: 'center', paddingTop: 14 },
  cancelarTxt: { fontSize: 13, fontWeight: '700', color: T.danger },

  vazio: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  vazioIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 18, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 14, color: T.muted, marginTop: 6, textAlign: 'center' },

  bannerPontos: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 6, backgroundColor: T.primarySoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#F8D9C8' },
  bannerPontosIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bannerPontosTitulo: { fontSize: 13, fontWeight: '800', color: T.ink },
  bannerPontosTxt: { fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 15 },
  bannerPontosLink: { fontSize: 12, fontWeight: '800', color: T.primary, maxWidth: 70, textAlign: 'right' },
});
