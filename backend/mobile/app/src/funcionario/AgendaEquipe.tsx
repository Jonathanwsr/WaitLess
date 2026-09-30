import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { O } from '../../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Segmentado, Vazio, Erro, brl } from '../../../components/owner/ui';
import { alertar } from '../../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface AgendamentoResumo {
  id: number;
  usuario?: { id: number; name: string };
  servico?: { id: number; nome: string; valor?: number };
  data_agendamento: string;
  hora_agendamento?: string;
  status: string;
  valor_final?: number;
  finalizado_por?: { id: number; name: string } | null;
}

interface FuncionarioColuna {
  id: number;
  nome: string;
  cargo?: string;
  total_finalizados: number;
  faturamento: number;
  agendamentos: AgendamentoResumo[];
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
};

const TOM_STATUS: Record<string, 'alerta' | 'info' | 'positivo'> = {
  pendente: 'alerta',
  confirmado: 'info',
  em_atendimento: 'info',
  finalizado: 'positivo',
};

export default function AgendaEquipe() {
  const params = useLocalSearchParams();
  const estabelecimentoId = params.estabelecimento_id?.toString();

  const [periodo, setPeriodo] = useState<'hoje' | 'mes' | 'ano'>('hoje');
  const [funcionarios, setFuncionarios] = useState<FuncionarioColuna[]>([]);
  const [semFuncionario, setSemFuncionario] = useState<AgendamentoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAtribuir, setModalAtribuir] = useState<{ open: boolean; agendamento: AgendamentoResumo | null }>({
    open: false,
    agendamento: null,
  });

  const carregar = useCallback(async (periodoAtual: string) => {
    try {
      const token = await pegarToken();
      const query = new URLSearchParams({ periodo: periodoAtual });
      if (estabelecimentoId) query.append('estabelecimento_id', estabelecimentoId);

      const res = await fetch(`${API_URL}/equipe/agenda-produtividade?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Não foi possível carregar o quadro da equipe.');
        return;
      }
      setErro(null);
      setFuncionarios(json.funcionarios || []);
      setSemFuncionario(json.semFuncionario || []);
    } catch (e) {
      setErro('Erro de conexão ao carregar o quadro da equipe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [estabelecimentoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregar(periodo);
    }, [carregar, periodo])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregar(periodo);
  };

  const abrirAtribuir = (item: AgendamentoResumo) => setModalAtribuir({ open: true, agendamento: item });
  const fecharAtribuir = () => setModalAtribuir({ open: false, agendamento: null });

  const atribuirFuncionario = async (funcionarioId: number) => {
    if (!modalAtribuir.agendamento) return;
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${modalAtribuir.agendamento.id}/funcionario`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ funcionario_id: funcionarioId }),
      });
      if (!res.ok) {
        alertar('Erro', 'Não foi possível atribuir este cliente agora.');
        return;
      }
      fecharAtribuir();
      carregar(periodo);
    } catch (e) {
      alertar('Erro de conexão', 'Tente novamente.');
    }
  };

  const totalEquipeFaturamento = funcionarios.reduce((acc, f) => acc + Number(f.faturamento || 0), 0);
  const totalEquipeFinalizados = funcionarios.reduce((acc, f) => acc + Number(f.total_finalizados || 0), 0);

  // Dono chega aqui a partir de um local (com estabelecimento_id) e volta para o painel;
  // funcionário usa a aba "Agenda" da própria barra.
  const modoFuncionario = !estabelecimentoId;

  return (
    <>
      <OwnerScreen
        titulo="Equipe"
        subtitulo="Produção e agenda por profissional"
        semVoltar={modoFuncionario}
        variante={modoFuncionario ? 'funcionario' : undefined}
        aba={modoFuncionario ? 'agenda' : undefined}
        carregando={loading}
        atualizando={refreshing}
        onAtualizar={onRefresh}
      >
        <Segmentado
          opcoes={[{ id: 'hoje', rotulo: 'Hoje' }, { id: 'mes', rotulo: 'Mês' }, { id: 'ano', rotulo: 'Ano' }]}
          valor={periodo}
          aoMudar={(v) => setPeriodo(v as 'hoje' | 'mes' | 'ano')}
        />

        {erro ? (
          <Erro mensagem={erro} aoTentar={() => { setLoading(true); carregar(periodo); }} />
        ) : (
          <>
            <View style={s.grade}>
              <Metrica rotulo="Profissionais" valor={funcionarios.length} icone="people-outline" />
              <Metrica rotulo="Finalizados" valor={totalEquipeFinalizados} icone="checkmark-circle-outline" tom="positivo" />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Metrica rotulo="Faturamento da equipe" valor={brl(totalEquipeFaturamento)} icone="cash-outline" tom="positivo" />
            </View>

            {semFuncionario.length > 0 && (
              <>
                <Rotulo>{`Sem profissional definido (${semFuncionario.length})`}</Rotulo>
                <Card style={{ paddingVertical: 4 }}>
                  {semFuncionario.map((item, i) => (
                    <View key={item.id} style={[s.semLinha, i < semFuncionario.length - 1 && s.borda]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.nome} numberOfLines={1}>{item.usuario?.name || 'Cliente'}</Text>
                        <Text style={s.sub} numberOfLines={1}>{item.servico?.nome || 'Serviço'} · {item.hora_agendamento?.substring(0, 5)}</Text>
                      </View>
                      <TouchableOpacity style={s.btnAtribuir} onPress={() => abrirAtribuir(item)} activeOpacity={0.8}>
                        <Text style={s.btnAtribuirTxt}>Atribuir</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </Card>
              </>
            )}

            <Rotulo>Profissionais</Rotulo>
            {funcionarios.length === 0 ? (
              <Card><Vazio icone="people-outline" titulo="Nenhum profissional ativo" texto="Cadastre a equipe para acompanhar a produção por aqui." /></Card>
            ) : (
              funcionarios.map((func) => (
                <Card key={func.id}>
                  <View style={s.funcTopo}>
                    <View style={s.avatar}><Text style={s.avatarTxt}>{func.nome?.charAt(0)?.toUpperCase() || '?'}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.funcNome} numberOfLines={1}>{func.nome}</Text>
                      <Text style={s.sub} numberOfLines={1}>{func.cargo || 'Profissional'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.funcValor}>{brl(func.faturamento)}</Text>
                      <Text style={s.sub}>{func.total_finalizados} finalizados</Text>
                    </View>
                  </View>

                  {func.agendamentos.length === 0 ? (
                    <Text style={s.vazioInline}>Sem atendimentos no período.</Text>
                  ) : (
                    <View style={s.lista}>
                      {func.agendamentos.map((ag) => (
                        <View key={ag.id} style={s.ag}>
                          <Text style={s.agHora}>{ag.hora_agendamento?.substring(0, 5) || '--:--'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.agCliente} numberOfLines={1}>{ag.usuario?.name || 'Cliente'}</Text>
                            <Text style={s.sub} numberOfLines={1}>
                              {ag.servico?.nome}{ag.status === 'finalizado' && ag.finalizado_por?.name ? ` · por ${ag.finalizado_por.name}` : ''}
                            </Text>
                          </View>
                          <Pilula texto={STATUS_LABEL[ag.status] || ag.status} tom={TOM_STATUS[ag.status] || 'neutro'} />
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </OwnerScreen>

      {/* MODAL DE ATRIBUIÇÃO */}
      <Modal visible={modalAtribuir.open} transparent animationType="slide" onRequestClose={fecharAtribuir}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={fecharAtribuir} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <Text style={s.sheetTitulo}>Atribuir profissional</Text>
            <Text style={s.sheetSub}>Cliente: {modalAtribuir.agendamento?.usuario?.name}</Text>
            {funcionarios.map((f) => (
              <TouchableOpacity key={f.id} style={s.opcao} onPress={() => atribuirFuncionario(f.id)} activeOpacity={0.7}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{f.nome?.charAt(0)?.toUpperCase() || '?'}</Text></View>
                <Text style={s.opcaoTxt}>{f.nome}</Text>
                <Ionicons name="chevron-forward" size={16} color={O.faint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  grade: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  nome: { fontSize: 15, fontWeight: '700', color: O.ink },
  sub: { fontSize: 12, color: O.muted, marginTop: 2 },
  borda: { borderBottomWidth: 1, borderBottomColor: O.line },

  semLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  btnAtribuir: { backgroundColor: O.accent, paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnAtribuirTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

  funcTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '700', color: O.muted },
  funcNome: { fontSize: 16, fontWeight: '700', color: O.ink },
  funcValor: { fontSize: 15, fontWeight: '800', color: O.success },
  vazioInline: { fontSize: 13, color: O.muted, textAlign: 'center', paddingTop: 16 },
  lista: { marginTop: 14, borderTopWidth: 1, borderTopColor: O.line },
  ag: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: O.soft },
  agHora: { width: 44, fontSize: 13, fontWeight: '700', color: O.ink },
  agCliente: { fontSize: 14, fontWeight: '600', color: O.ink },

  overlay: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: O.line, alignSelf: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 20, fontWeight: '800', color: O.ink },
  sheetSub: { fontSize: 13, color: O.muted, marginTop: 4, marginBottom: 12 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: O.line },
  opcaoTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: O.ink },
});
