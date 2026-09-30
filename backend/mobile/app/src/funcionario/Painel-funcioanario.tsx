import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { O } from '../../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Metrica, Pilula, Vazio } from '../../../components/owner/ui';
import { alertar } from '../../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Agendamento {
  id: number;
  usuario?: { id: number; name: string; foto_perfil?: string; telefone?: string };
  servico?: { id: number; nome: string; valor?: number };
  data_agendamento: string;
  hora_agendamento?: string;
  hora_finalizacao?: string;
  status: 'pendente' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'cancelado' | string;
  status_pagamento?: string;
  valor_final?: number;
  finalizado_por?: { id: number; name: string } | null;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
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
  confirmado: 'alerta',
  em_atendimento: 'info',
  finalizado: 'positivo',
  cancelado: 'negativo',
};

export default function PainelFuncionario() {
  const router = useRouter();
  // Vindo do menu do sócio, mantém a barra de baixo do sócio (e não a da equipe).
  const { origem } = useLocalSearchParams();
  const variante = origem === 'socio' ? 'socio' : 'funcionario';

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  const [modalFinalizar, setModalFinalizar] = useState<{ open: boolean; agendamento: Agendamento | null }>({
    open: false,
    agendamento: null,
  });
  const [codigoPin, setCodigoPin] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  const carregarFila = useCallback(async () => {
    try {
      const token = await pegarToken();
      const hoje = new Date().toISOString().split('T')[0];

      const res = await fetch(
        `${API_URL}/agendamentos?data_inicio=${hoje}&data_fim=${hoje}&ordem=asc&per_page=50`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      const json = await res.json();
      setAgendamentos(json?.agendamentos?.data || []);
    } catch (e) {
      console.log('Erro ao carregar a fila do funcionário:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarFila();
    }, [carregarFila])
  );

  // Atualização suave em segundo plano, igual à tela de Fila do site
  useEffect(() => {
    const interval = setInterval(carregarFila, 30000);
    return () => clearInterval(interval);
  }, [carregarFila]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarFila();
  };

  const executarAcao = async (id: number, endpoint: string, method: 'PUT' | 'POST', mensagemErro: string) => {
    setProcessandoId(id);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${id}/${endpoint}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alertar('Não foi possível continuar', json.error || mensagemErro);
        return;
      }
      await carregarFila();
    } catch (e) {
      alertar('Erro de conexão', mensagemErro);
    } finally {
      setProcessandoId(null);
    }
  };

  const chamarCliente = (item: Agendamento) => executarAcao(item.id, 'chamar', 'PUT', 'Não foi possível chamar o cliente agora.');
  const adiarCliente = (item: Agendamento) => executarAcao(item.id, 'adiar', 'PUT', 'Não foi possível adiar este atendimento.');
  const pularCliente = (item: Agendamento) => executarAcao(item.id, 'pular', 'PUT', 'Não foi possível pular este cliente.');

  const abrirModalFinalizar = (item: Agendamento) => {
    setCodigoPin('');
    setModalFinalizar({ open: true, agendamento: item });
  };

  const fecharModalFinalizar = () => setModalFinalizar({ open: false, agendamento: null });

  const confirmarFinalizacao = async () => {
    if (!modalFinalizar.agendamento || codigoPin.length !== 4) return;
    setFinalizando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${modalFinalizar.agendamento.id}/finalizar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ codigo_pin: codigoPin }),
      });
      const json = await res.json();
      if (!res.ok) {
        alertar('PIN inválido', json.error || 'Verifique o código com o cliente.');
        return;
      }
      fecharModalFinalizar();
      carregarFila();
    } catch (e) {
      alertar('Erro', 'Não foi possível finalizar agora. Tente novamente.');
    } finally {
      setFinalizando(false);
    }
  };

  const emAtendimento = agendamentos.filter((a) => a.status === 'em_atendimento');
  const pendentes = agendamentos.filter((a) => a.status === 'pendente');
  const finalizadosHoje = agendamentos.filter((a) => a.status === 'finalizado');
  const cancelados = agendamentos.filter((a) => a.status === 'cancelado');
  const proximo = pendentes[0];

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const dataHojeCapitalizada = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);

  const abrirCliente = (item: Agendamento) => item.usuario?.id && router.push({ pathname: '/src/funcionario/DetalheCliente', params: { id: item.usuario.id } } as never);

  /** Cabeçalho do cartão: quem é o cliente, o serviço e o horário. Tocar abre o histórico dele. */
  const Topo = ({ item }: { item: Agendamento }) => (
    <TouchableOpacity style={styles.topo} activeOpacity={item.usuario?.id ? 0.7 : 1} onPress={() => abrirCliente(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTxt}>{item.usuario?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cliente} numberOfLines={1}>{item.usuario?.name || 'Cliente'}</Text>
        <Text style={styles.servico} numberOfLines={1}>{item.servico?.nome || 'Serviço'}</Text>
      </View>
      <View style={styles.hora}>
        <Ionicons name="time-outline" size={14} color={O.accent} />
        <Text style={styles.horaTxt}>{item.hora_agendamento?.substring(0, 5) || '--:--'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <OwnerScreen
        titulo="Minha fila"
        subtitulo={dataHojeCapitalizada}
        semVoltar
        variante={variante}
        aba="fila"
        carregando={loading}
        atualizando={refreshing}
        onAtualizar={onRefresh}
      >
        {/* RESUMO DO DIA */}
        <View style={styles.hero}>
          <Text style={styles.heroData}>{dataHojeCapitalizada}</Text>
          <View style={styles.heroLinha}>
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{pendentes.length}</Text>
              <Text style={styles.heroRotulo}>Aguardando</Text>
            </View>
            <View style={styles.heroDivisor} />
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{emAtendimento.length}</Text>
              <Text style={styles.heroRotulo}>Em atendimento</Text>
            </View>
            <View style={styles.heroDivisor} />
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{finalizadosHoje.length}</Text>
              <Text style={styles.heroRotulo}>Finalizados</Text>
            </View>
          </View>
        </View>

        {agendamentos.length === 0 ? (
          <Card><Vazio icone="calendar-outline" titulo="Nenhum agendamento hoje" texto="Assim que houver novos clientes na fila, eles aparecem aqui. Puxe a tela para baixo para atualizar." /></Card>
        ) : (
          <>
            {/* EM ATENDIMENTO AGORA */}
            {emAtendimento.length > 0 && (
              <>
                <Rotulo>Em atendimento agora</Rotulo>
                {emAtendimento.map((item) => (
                  <View key={item.id} style={[styles.cartao, styles.cartaoAgora]}>
                    <Topo item={item} />
                    <TouchableOpacity style={styles.btnConcluir} onPress={() => abrirModalFinalizar(item)} activeOpacity={0.85}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                      <Text style={styles.btnGrandeTxt}>Concluir com PIN do cliente</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* FILA DE ESPERA */}
            {pendentes.length > 0 && (
              <>
                <Rotulo>{`Fila de espera (${pendentes.length})`}</Rotulo>
                {pendentes.map((item, i) => {
                  const isProcessando = processandoId === item.id;
                  const ehProximo = item.id === proximo?.id;
                  return (
                    <View key={item.id} style={[styles.cartao, ehProximo && styles.cartaoProximo]}>
                      <View style={styles.posicaoLinha}>
                        <View style={[styles.posicao, ehProximo && styles.posicaoOn]}>
                          <Text style={[styles.posicaoTxt, ehProximo && { color: '#fff' }]}>{i + 1}º</Text>
                        </View>
                        <Text style={styles.posicaoRotulo}>{ehProximo ? 'Próximo da fila' : 'Aguardando'}</Text>
                      </View>
                      <Topo item={item} />

                      <TouchableOpacity style={[styles.btnChamar, isProcessando && { opacity: 0.6 }]} onPress={() => chamarCliente(item)} disabled={isProcessando} activeOpacity={0.85}>
                        {isProcessando ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="megaphone-outline" size={20} color="#fff" />
                            <Text style={styles.btnGrandeTxt}>Chamar cliente</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <View style={styles.acoes}>
                        <TouchableOpacity style={styles.btnSec} onPress={() => adiarCliente(item)} disabled={isProcessando} activeOpacity={0.7}>
                          <Ionicons name="time-outline" size={18} color={O.ink} />
                          <Text style={styles.btnSecTxt}>Adiar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnPular} onPress={() => pularCliente(item)} disabled={isProcessando} activeOpacity={0.7}>
                          <Ionicons name="play-skip-forward-outline" size={18} color={O.danger} />
                          <Text style={styles.btnPularTxt}>Pular</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* FINALIZADOS */}
            {finalizadosHoje.length > 0 && (
              <>
                <Rotulo>{`Finalizados (${finalizadosHoje.length})`}</Rotulo>
                {finalizadosHoje.map((item) => (
                  <View key={item.id} style={styles.cartao}>
                    <Topo item={item} />
                    <View style={styles.rodape}>
                      <Pilula texto={STATUS_LABEL[item.status] || item.status} tom={TOM_STATUS[item.status] || 'neutro'} />
                      {!!item.finalizado_por?.name && (
                        <Text style={styles.finalizado} numberOfLines={1}>por {item.finalizado_por.name} às {item.hora_finalizacao?.substring(0, 5)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {cancelados.length > 0 && (
              <Text style={styles.canceladosNota}>{cancelados.length} {cancelados.length === 1 ? 'agendamento cancelado' : 'agendamentos cancelados'} hoje.</Text>
            )}
          </>
        )}
      </OwnerScreen>

      {/* MODAL FINALIZAR COM PIN */}
      <Modal visible={modalFinalizar.open} transparent animationType="fade" onRequestClose={fecharModalFinalizar}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalIcone}>
              <Ionicons name="shield-checkmark-outline" size={28} color={O.accent} />
            </View>
            <Text style={styles.modalTitulo}>Concluir atendimento</Text>
            {!!modalFinalizar.agendamento?.usuario?.name && <Text style={styles.modalCliente}>{modalFinalizar.agendamento.usuario.name}</Text>}
            <Text style={styles.modalSub}>Peça ao cliente o código de 4 dígitos que aparece no app dele e digite abaixo para confirmar.</Text>

            <TextInput
              value={codigoPin}
              onChangeText={(t) => setCodigoPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={O.faint}
              style={styles.pin}
            />

            <View style={styles.modalAcoes}>
              <TouchableOpacity style={styles.modalCancelar} onPress={fecharModalFinalizar} disabled={finalizando}>
                <Text style={styles.modalCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmar, codigoPin.length !== 4 && { opacity: 0.5 }]}
                onPress={confirmarFinalizacao}
                disabled={finalizando || codigoPin.length !== 4}
              >
                {finalizando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmarTxt}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const styles = StyleSheet.create({
  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 20, marginBottom: 8 },
  heroData: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  heroLinha: { flexDirection: 'row', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingVertical: 14 },
  heroItem: { flex: 1, alignItems: 'center' },
  heroNum: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  heroRotulo: { color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  heroDivisor: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  cartao: { backgroundColor: O.card, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent', ...sombra },
  cartaoProximo: { borderColor: O.accent },
  cartaoAgora: { borderColor: O.success },
  posicaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  posicao: { minWidth: 32, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  posicaoOn: { backgroundColor: O.accent },
  posicaoTxt: { fontSize: 12, fontWeight: '800', color: O.muted },
  posicaoRotulo: { fontSize: 12, fontWeight: '700', color: O.muted },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 20, fontWeight: '800', color: O.accent },
  cliente: { fontSize: 17, fontWeight: '800', color: O.ink, letterSpacing: -0.2 },
  servico: { fontSize: 14, color: O.muted, marginTop: 2 },
  hora: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF1E4', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14 },
  horaTxt: { fontSize: 14, fontWeight: '800', color: O.accent },

  rodape: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  finalizado: { flex: 1, fontSize: 12, color: O.muted },
  canceladosNota: { textAlign: 'center', fontSize: 12, color: O.faint, marginTop: 4, marginBottom: 8 },

  btnChamar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: O.accent, height: 54, borderRadius: 27, marginTop: 14 },
  btnConcluir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#12A150', height: 54, borderRadius: 27, marginTop: 14 },
  btnGrandeTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  acoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnSec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 24, backgroundColor: O.soft },
  btnSecTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
  btnPular: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 24, backgroundColor: O.dangerBg },
  btnPularTxt: { fontSize: 14, fontWeight: '700', color: O.danger },

  overlay: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 28, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center' },
  modalIcone: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: O.ink, letterSpacing: -0.4 },
  modalCliente: { fontSize: 14, fontWeight: '700', color: O.accent, marginTop: 4 },
  modalSub: { fontSize: 13, color: O.muted, textAlign: 'center', lineHeight: 19, marginTop: 8, marginBottom: 18 },
  pin: { width: '100%', textAlign: 'center', fontSize: 34, fontWeight: '800', letterSpacing: 16, color: O.ink, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: O.line, paddingVertical: 14, marginBottom: 20 },
  modalAcoes: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelar: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: O.soft },
  modalCancelarTxt: { color: O.ink, fontWeight: '700' },
  modalConfirmar: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12A150' },
  modalConfirmarTxt: { color: '#fff', fontWeight: '800' },
});
