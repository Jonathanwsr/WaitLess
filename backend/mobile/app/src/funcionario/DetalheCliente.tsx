import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { O } from '../../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Vazio, Erro, brl, api } from '../../../components/owner/ui';
import { alertar } from '../../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Paciente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  foto: string;
  desde: string;
}

interface ProximoServico {
  id: number;
  data_formatada: string;
  hora: string;
  servico: string;
  profissional: string;
  tipo: string;
}

interface HistoricoItem {
  id: number;
  servico: string;
  profissional: string;
  data: string;
  status: string;
  valor_final?: number;
  finalizado_por?: string | null;
  hora_finalizacao?: string | null;
}

interface ServicoReserva {
  id: number;
  nome: string;
  valor: number;
  max_pessoas: number;
}

interface ReservaManualDados {
  estabelecimento_id: number;
  servicos: ServicoReserva[];
}

interface DetalheClienteData {
  reserva_manual?: ReservaManualDados | null;
  paciente: Paciente;
  triagem: any;
  proximoServico: ProximoServico | null;
  financeiro: { total_gasto: number; pendente: number };
  historicoServicos: HistoricoItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const TOM_STATUS: Record<string, 'alerta' | 'info' | 'positivo' | 'negativo'> = {
  pendente: 'alerta',
  confirmado: 'info',
  em_atendimento: 'info',
  finalizado: 'positivo',
  cancelado: 'negativo',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function DetalheCliente() {
  const params = useLocalSearchParams();
  const clienteId = params.id?.toString();

  const [dados, setDados] = useState<DetalheClienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // --- Reserva manual (dono/gerente reserva um serviço em nome do cliente) ---
  const [modalReserva, setModalReserva] = useState(false);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [dataReserva, setDataReserva] = useState('');
  const [horaReserva, setHoraReserva] = useState('');
  const [pessoas, setPessoas] = useState(1);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [salvandoReserva, setSalvandoReserva] = useState(false);
  const [erroReserva, setErroReserva] = useState<string | null>(null);

  const proximosDias = React.useMemo(() => {
    const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { iso, semana: semana[d.getDay()], dia: String(d.getDate()).padStart(2, '0') };
    });
  }, []);

  const servicoEscolhido = dados?.reserva_manual?.servicos.find((sv) => sv.id === servicoId) || null;
  const maxPessoas = servicoEscolhido?.max_pessoas || 1;
  const valorEstimado = servicoEscolhido ? servicoEscolhido.valor * pessoas : 0;

  const abrirReserva = () => {
    setServicoId(null); setDataReserva(''); setHoraReserva(''); setPessoas(1); setHorarios([]); setErroReserva(null);
    setModalReserva(true);
  };

  React.useEffect(() => {
    setPessoas(1);
    setHoraReserva('');
  }, [servicoId]);

  React.useEffect(() => {
    if (!servicoId || !dataReserva) { setHorarios([]); return; }
    let cancelado = false;
    setBuscandoHorarios(true);
    setHoraReserva('');
    api(`/horarios-disponiveis/${servicoId}?data=${dataReserva}&tipo=servico`)
      .then((lista: string[]) => { if (!cancelado) setHorarios(Array.isArray(lista) ? lista : []); })
      .catch(() => { if (!cancelado) setHorarios([]); })
      .finally(() => { if (!cancelado) setBuscandoHorarios(false); });
    return () => { cancelado = true; };
  }, [servicoId, dataReserva]);

  const confirmarReserva = async () => {
    if (!dados?.reserva_manual || !servicoId || !dataReserva || !horaReserva) {
      setErroReserva('Escolha o serviço, a data e o horário.');
      return;
    }
    setSalvandoReserva(true);
    setErroReserva(null);
    try {
      await api('/proprietario/reservas-manuais', {
        method: 'POST',
        body: {
          cliente_id: dados.paciente.id,
          estabelecimento_id: dados.reserva_manual.estabelecimento_id,
          servico_id: servicoId,
          data: dataReserva,
          hora: horaReserva,
          pessoas,
        },
      });
      setModalReserva(false);
      alertar('Reserva criada', 'A reserva foi registrada para o cliente.');
      carregar();
    } catch (e: any) {
      setErroReserva(e?.message || 'Não foi possível criar a reserva.');
    } finally {
      setSalvandoReserva(false);
    }
  };

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/clientes/${clienteId}/detalhes`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Não foi possível carregar o histórico deste cliente.');
        return;
      }
      setErro(null);
      setDados(json);
    } catch (e) {
      setErro('Erro de conexão ao carregar o histórico do cliente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clienteId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregar();
  };

  return (
    <OwnerScreen titulo="Cliente" subtitulo="Histórico de atendimentos" carregando={loading} atualizando={refreshing} onAtualizar={onRefresh}>
      {erro ? (
        <Erro mensagem={erro} aoTentar={() => { setLoading(true); carregar(); }} />
      ) : dados && (
        <>
          {/* CARTÃO DO CLIENTE */}
          <View style={s.hero}>
            <View style={s.avatar}>
              {dados.paciente.foto ? (
                <Image source={{ uri: dados.paciente.foto }} style={s.avatarImg} contentFit="cover" />
              ) : (
                <Text style={s.avatarTxt}>{dados.paciente.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              )}
            </View>
            <Text style={s.nome}>{dados.paciente.nome}</Text>
            <Text style={s.desde}>Cliente desde {dados.paciente.desde}</Text>

            <View style={s.contatos}>
              {!!dados.paciente.telefone && (
                <View style={s.contato}>
                  <Ionicons name="call-outline" size={15} color={O.muted} />
                  <Text style={s.contatoTxt}>{dados.paciente.telefone}</Text>
                </View>
              )}
              {!!dados.paciente.email && (
                <View style={s.contato}>
                  <Ionicons name="mail-outline" size={15} color={O.muted} />
                  <Text style={s.contatoTxt} numberOfLines={1}>{dados.paciente.email}</Text>
                </View>
              )}
            </View>
          </View>

          {/* NOVA RESERVA (só dono/gerente) */}
          {!!dados.reserva_manual && dados.reserva_manual.servicos.length > 0 && (
            <TouchableOpacity style={s.botaoReserva} activeOpacity={0.85} onPress={abrirReserva}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={s.botaoReservaTxt}>Nova reserva para {dados.paciente.nome?.split(' ')[0]}</Text>
            </TouchableOpacity>
          )}

          {/* RESUMO FINANCEIRO */}
          <View style={s.grade}>
            <Metrica rotulo="Total gasto" valor={brl(dados.financeiro.total_gasto)} icone="cash-outline" tom="positivo" />
            <Metrica rotulo="Pendente" valor={brl(dados.financeiro.pendente)} icone="hourglass-outline" tom={dados.financeiro.pendente > 0 ? 'alerta' : 'neutro'} />
          </View>
          <Metrica rotulo="Atendimentos registrados" valor={dados.historicoServicos.length} icone="clipboard-outline" />

          {/* PRÓXIMO SERVIÇO */}
          {dados.proximoServico && (
            <>
              <Rotulo>Próximo agendamento</Rotulo>
              <Card style={s.proximo}>
                <View style={s.proximoIcone}><Ionicons name="calendar-outline" size={20} color={O.ink} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.proximoTitulo}>{dados.proximoServico.servico}</Text>
                  <Text style={s.proximoSub}>
                    {dados.proximoServico.data_formatada} às {dados.proximoServico.hora} · {dados.proximoServico.profissional}
                  </Text>
                </View>
              </Card>
            </>
          )}

          {/* HISTÓRICO */}
          <Rotulo>Histórico de atendimentos</Rotulo>
          {dados.historicoServicos.length === 0 ? (
            <Card><Vazio icone="calendar-outline" titulo="Nenhum atendimento" texto="Os atendimentos deste cliente aparecem aqui." /></Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {dados.historicoServicos.map((item, i) => (
                <View key={item.id} style={[s.item, i < dados.historicoServicos.length - 1 && s.itemBorda]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitulo} numberOfLines={1}>{item.servico}</Text>
                    <Text style={s.itemMeta}>{item.data} · {item.profissional}</Text>
                    {item.status === 'finalizado' && item.finalizado_por && (
                      <Text style={s.itemMeta} numberOfLines={1}>
                        Finalizado por {item.finalizado_por}{item.hora_finalizacao ? ` às ${item.hora_finalizacao.substring(0, 5)}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Pilula texto={STATUS_LABEL[item.status] || item.status} tom={TOM_STATUS[item.status] || 'neutro'} />
                    {typeof item.valor_final === 'number' && item.valor_final > 0 && <Text style={s.itemValor}>{brl(item.valor_final)}</Text>}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      <Modal visible={modalReserva} animationType="slide" transparent onRequestClose={() => setModalReserva(false)}>
        <View style={s.modalFundo}>
          <View style={s.modalCaixa}>
            <View style={s.modalTopo}>
              <Text style={s.modalTitulo}>Nova reserva</Text>
              <TouchableOpacity onPress={() => setModalReserva(false)}><Ionicons name="close" size={24} color={O.ink} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              <View style={s.presencial}>
                <View style={s.presencialIcone}><Ionicons name="storefront-outline" size={20} color={O.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.presencialTitulo}>Pagamento presencial</Text>
                  <Text style={s.presencialTxt}>O cliente paga direto no estabelecimento. Reservas feitas por você não têm pagamento online (Pix, cartão ou boleto).</Text>
                </View>
              </View>

              <Text style={s.campoRotulo}>Serviço</Text>
              <View style={s.chips}>
                {dados?.reserva_manual?.servicos.map((sv) => (
                  <TouchableOpacity key={sv.id} style={[s.chip, servicoId === sv.id && s.chipOn]} onPress={() => setServicoId(sv.id)}>
                    <Text style={[s.chipTxt, servicoId === sv.id && s.chipTxtOn]}>{sv.nome} · {brl(sv.valor)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.campoRotulo}>Data</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {proximosDias.map((d) => (
                  <TouchableOpacity key={d.iso} style={[s.dia, dataReserva === d.iso && s.chipOn]} onPress={() => setDataReserva(d.iso)}>
                    <Text style={[s.diaSemana, dataReserva === d.iso && s.chipTxtOn]}>{d.semana}</Text>
                    <Text style={[s.diaNum, dataReserva === d.iso && s.chipTxtOn]}>{d.dia}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.campoRotulo}>Horário</Text>
              {!servicoId || !dataReserva ? (
                <Text style={s.dica}>Escolha o serviço e a data para ver os horários.</Text>
              ) : buscandoHorarios ? (
                <ActivityIndicator color={O.ink} style={{ alignSelf: 'flex-start' }} />
              ) : horarios.length === 0 ? (
                <Text style={[s.dica, { color: O.danger }]}>Esgotado: não há horários livres nesta data.</Text>
              ) : (
                <View style={s.chips}>
                  {horarios.map((h) => (
                    <TouchableOpacity key={h} style={[s.chip, horaReserva === h && s.chipOn]} onPress={() => setHoraReserva(h)}>
                      <Text style={[s.chipTxt, horaReserva === h && s.chipTxtOn]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {maxPessoas > 1 && (
                <>
                  <Text style={s.campoRotulo}>Quantas pessoas</Text>
                  <View style={s.stepper}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas((n) => Math.max(1, n - 1))}><Ionicons name="remove" size={20} color={O.ink} /></TouchableOpacity>
                    <Text style={s.stepNum}>{pessoas}</Text>
                    <TouchableOpacity style={s.stepBtn} onPress={() => setPessoas((n) => Math.min(maxPessoas, n + 1))}><Ionicons name="add" size={20} color={O.ink} /></TouchableOpacity>
                    <Text style={s.dica}>máx. {maxPessoas}</Text>
                  </View>
                </>
              )}

              {!!servicoEscolhido && (
                <View style={s.total}>
                  <Text style={s.totalRotulo}>Valor estimado</Text>
                  <Text style={s.totalValor}>{brl(valorEstimado)}</Text>
                </View>
              )}

              {!!erroReserva && <Text style={s.erroReserva}>{erroReserva}</Text>}
            </ScrollView>

            <TouchableOpacity style={[s.botaoReserva, (salvandoReserva || !horaReserva) && { opacity: 0.5 }]} disabled={salvandoReserva || !horaReserva} onPress={confirmarReserva} activeOpacity={0.85}>
              {salvandoReserva ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoReservaTxt}>Confirmar reserva</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  presencial: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF7ED', borderRadius: 18, padding: 14, marginBottom: 6 },
  presencialIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  presencialTitulo: { fontSize: 14, fontWeight: '800', color: O.ink },
  presencialTxt: { fontSize: 12, color: O.muted, lineHeight: 18, marginTop: 2 },
  botaoReserva: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: O.accent, borderRadius: 16, paddingVertical: 14, marginBottom: 14 },
  botaoReservaTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'flex-end' },
  modalCaixa: { backgroundColor: O.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: O.ink },
  campoRotulo: { fontSize: 12, fontWeight: '700', color: O.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: O.line, backgroundColor: O.soft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  chipOn: { backgroundColor: O.accent, borderColor: O.accent },
  chipTxt: { fontSize: 13, fontWeight: '600', color: O.ink },
  chipTxtOn: { color: '#fff' },
  dia: { width: 56, alignItems: 'center', borderWidth: 1, borderColor: O.line, backgroundColor: O.soft, borderRadius: 14, paddingVertical: 10 },
  diaSemana: { fontSize: 11, color: O.muted, textTransform: 'uppercase' },
  diaNum: { fontSize: 18, fontWeight: '800', color: O.ink, marginTop: 2 },
  dica: { fontSize: 12, color: O.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 20, fontWeight: '800', color: O.ink, minWidth: 28, textAlign: 'center' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: O.soft, borderRadius: 14, padding: 14, marginTop: 18 },
  totalRotulo: { fontSize: 13, color: O.muted, fontWeight: '600' },
  totalValor: { fontSize: 20, fontWeight: '800', color: O.ink },
  erroReserva: { color: O.danger, fontSize: 13, fontWeight: '600', marginTop: 12 },
  hero: { alignItems: 'center', backgroundColor: O.card, borderRadius: 26, padding: 22, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: '#fff', fontSize: 32, fontWeight: '700' },
  nome: { fontSize: 20, fontWeight: '800', color: O.ink, letterSpacing: -0.4 },
  desde: { fontSize: 13, color: O.muted, marginTop: 3 },
  contatos: { alignSelf: 'stretch', marginTop: 16, gap: 8 },
  contato: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: O.soft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  contatoTxt: { flex: 1, fontSize: 13, color: O.ink, fontWeight: '500' },

  grade: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  proximo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proximoIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  proximoTitulo: { fontSize: 15, fontWeight: '700', color: O.ink },
  proximoSub: { fontSize: 12, color: O.muted, marginTop: 3 },

  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemBorda: { borderBottomWidth: 1, borderBottomColor: O.line },
  itemTitulo: { fontSize: 15, fontWeight: '700', color: O.ink },
  itemMeta: { fontSize: 12, color: O.muted, marginTop: 2 },
  itemValor: { fontSize: 14, fontWeight: '700', color: O.ink },
});
