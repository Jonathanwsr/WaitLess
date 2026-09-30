import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const MOTIVOS = ['Serviço não prestado', 'Desistência', 'Cobrança indevida', 'Serviço com problema', 'Outro motivo'];

const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const dataBR = (v?: string) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');

export default function MeusEstornosScreen() {
  const router = useRouter();

  const [currentView, setCurrentView] = useState<'LIST' | 'FORM'>('LIST');
  const [userRole, setUserRole] = useState('cliente');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [estornos, setEstornos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'todos' | 'analise' | 'deferidos' | 'indeferidos'>('todos');
  const [busca, setBusca] = useState('');

  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagens, setImagens] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [elegiveis, setElegiveis] = useState<any[]>([]);
  const [carregandoElegiveis, setCarregandoElegiveis] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any>(null);

  const [modalDetalhesVisible, setModalDetalhesVisible] = useState(false);
  const [detalheSelecionado, setDetalheSelecionado] = useState<any>(null);
  const [detalheCompleto, setDetalheCompleto] = useState<any>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const isPrestador = ['socio', 'proprietario', 'gerente'].includes(userRole);
  const isAdmin = ['admin', 'superadmin', 'administrador'].includes(userRole);
  const isCliente = !isPrestador && !isAdmin;

  useEffect(() => {
    carregarUsuarioEDados();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEstornos();
  };

  const carregarUsuarioEDados = async () => {
    try {
      const userString = await SecureStore.getItemAsync('userData');
      if (userString) {
        const user = JSON.parse(userString);
        setUserRole(user.papel?.toLowerCase() || 'cliente');
      }
    } catch (e) {}
    fetchEstornos();
  };

  const fetchEstornos = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const isAdm = await SecureStore.getItemAsync('userData').then((u) => {
        if (!u) return false;
        const parsed = JSON.parse(u);
        return ['admin', 'superadmin'].includes(parsed.papel?.toLowerCase());
      });

      const endpoint = isAdm ? `${API_URL}/admin/estornos` : `${API_URL}/estornos`;

      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const data = await res.json();

      if (res.ok) {
        const list = isAdm ? data.data.data : data.data;
        setEstornos(list || []);
      }
    } catch (err) {
      // mantém a UI limpa
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const ANALISE = ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS'];
  const DEFERIDO = ['APROVADO', 'ESTORNADO', 'ESTORNO_SOLICITADO_ASAAS'];
  const INDEFERIDO = ['REPROVADO', 'CANCELADO', 'ERRO_ASAAS'];

  const dadosFiltrados = estornos.filter((item) => {
    if (activeTab === 'analise' && !ANALISE.includes(item.status)) return false;
    if (activeTab === 'deferidos' && !DEFERIDO.includes(item.status)) return false;
    if (activeTab === 'indeferidos' && !INDEFERIDO.includes(item.status)) return false;
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      const alvo = `${item.codigo_estorno || ''} ${item.itemAluguel?.nome || item.servico?.nome || ''} ${item.estabelecimento?.nome || ''}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const soma = (lista: any[], campo: 'valor_pago' | 'valor_estornado') =>
    lista.reduce((acc, curr) => acc + Number(campo === 'valor_estornado' ? curr.valor_estornado || curr.valor_pago : curr.valor_pago), 0);

  const listaAnalise = estornos.filter((i) => ANALISE.includes(i.status));
  const listaDeferida = estornos.filter((i) => DEFERIDO.includes(i.status));

  const resumo = {
    solicitados: estornos.length,
    valorSolicitado: soma(estornos, 'valor_pago'),
    emAnalise: listaAnalise.length,
    valorAnalise: soma(listaAnalise, 'valor_pago'),
    deferidos: listaDeferida.length,
    valorDeferido: soma(listaDeferida, 'valor_estornado'),
  };

  const abrirFormulario = async () => {
    setCurrentView('FORM');
    setPedidoSelecionado(null);
    setCarregandoElegiveis(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/estornos/elegiveis`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const data = await res.json();
      const lista = res.ok && Array.isArray(data.data) ? data.data : [];
      setElegiveis(lista);
      if (lista.length === 1) setPedidoSelecionado(lista[0]);
    } catch (e) {
      setElegiveis([]);
    } finally {
      setCarregandoElegiveis(false);
    }
  };

  const selecionarImagem = async () => {
    if (imagens.length >= 5) return alertar('Atenção', 'Máximo de 5 imagens.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) setImagens([...imagens, result.assets[0]]);
  };

  const enviarSolicitacao = async () => {
    if (!pedidoSelecionado) return alertar('Atenção', 'Selecione qual pedido você quer contestar.');
    if (!motivo) return alertar('Atenção', 'Selecione o motivo do estorno.');
    if (descricao.length < 10) return alertar('Atenção', 'Descreva o que aconteceu (mínimo 10 caracteres).');

    setEnviando(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const formData = new FormData();
      formData.append('motivo', motivo);
      formData.append('descricao', descricao);
      formData.append('categoria', 'SERVICO');

      imagens.forEach((img, index) => {
        formData.append('imagens[]', { uri: img.uri, name: `img_${index}.jpg`, type: 'image/jpeg' } as any);
      });

      const res = await fetch(`${API_URL}/estornos/solicitar/${pedidoSelecionado.pagamento_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        alertar('Sucesso!', 'Sua solicitação de estorno foi enviada.');
        setCurrentView('LIST');
        setMotivo('');
        setDescricao('');
        setImagens([]);
        setPedidoSelecionado(null);
        fetchEstornos();
      } else {
        alertar('Atenção', data.error || 'Falha ao solicitar estorno.');
      }
    } catch (e) {
      alertar('Erro', 'Falha na conexão.');
    } finally {
      setEnviando(false);
    }
  };

  // Detalhes reais do estorno (endpoint do cliente); para admin/prestador mostra o que já veio na lista.
  const abrirDetalhes = async (item: any) => {
    setDetalheSelecionado(item);
    setDetalheCompleto(null);
    setModalDetalhesVisible(true);
    if (!isCliente) return;
    setCarregandoDetalhe(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/estornos/${item.id}/detalhes`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const json = await res.json();
      if (res.ok) setDetalheCompleto(json.data);
    } catch (e) {
      // segue com os dados da lista
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const statusInfo = (status: string) => {
    if (DEFERIDO.includes(status)) return { label: 'Deferido', bg: T.successBg, cor: T.success, icone: 'checkmark-circle-outline' };
    if (ANALISE.includes(status)) return { label: 'Em análise', bg: '#FEF3C7', cor: '#B45309', icone: 'time-outline' };
    if (INDEFERIDO.includes(status)) return { label: 'Indeferido', bg: '#FEE2E2', cor: T.danger, icone: 'close-circle-outline' };
    return { label: 'Solicitado', bg: T.primarySoft, cor: T.primary, icone: 'hourglass-outline' };
  };

  // =========================================================================
  // FORMULÁRIO
  // =========================================================================
  if (currentView === 'FORM') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.formHeader}>
          <TouchableOpacity onPress={() => setCurrentView('LIST')} style={s.voltar}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </TouchableOpacity>
          <Text style={s.formTitulo}>Solicitar estorno</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
          <View style={s.banner}>
            <View style={s.bannerIcone}><Ionicons name="checkmark-circle-outline" size={22} color={T.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitulo}>Explique o que aconteceu</Text>
              <Text style={s.bannerTxt}>Envie informações e documentos que possam nos ajudar a analisar sua solicitação. Retornamos em até 3 dias úteis.</Text>
            </View>
          </View>

          <Text style={s.rotulo}>Pedido relacionado</Text>
          {carregandoElegiveis ? (
            <ActivityIndicator size="small" color={T.primary} style={{ marginVertical: 12 }} />
          ) : elegiveis.length === 0 ? (
            <View style={s.aviso}>
              <Ionicons name="information-circle-outline" size={18} color={T.muted} />
              <Text style={s.avisoTxt}>Nenhum serviço finalizado nos últimos 4 dias está disponível para estorno no momento.</Text>
            </View>
          ) : (
            elegiveis.map((item) => {
              const selecionado = pedidoSelecionado?.agendamento_id === item.agendamento_id;
              return (
                <TouchableOpacity key={item.agendamento_id} style={[s.pedido, selecionado && s.pedidoOn]} onPress={() => setPedidoSelecionado(item)} activeOpacity={0.85}>
                  {item.estabelecimento_foto ? (
                    <Image source={{ uri: item.estabelecimento_foto }} style={s.pedidoImg} contentFit="cover" />
                  ) : (
                    <View style={[s.pedidoImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: T.cream }]}>
                      <Ionicons name="cut-outline" size={20} color={T.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.pedidoTitulo} numberOfLines={1}>{item.servico || 'Serviço'}</Text>
                    <Text style={s.pedidoSub} numberOfLines={1}>{item.estabelecimento}</Text>
                    <Text style={s.pedidoSub}>Prazo para pedir: {item.data_limite_formatada}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.pedidoPreco}>{brl(item.valor_total)}</Text>
                    <Ionicons name={selecionado ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selecionado ? T.primary : T.faint} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <Text style={s.rotulo}>Motivo do estorno</Text>
          <View style={s.chips}>
            {MOTIVOS.map((m) => (
              <TouchableOpacity key={m} style={[s.chipMotivo, motivo === m && s.chipMotivoOn]} onPress={() => setMotivo(m)} activeOpacity={0.85}>
                <Text style={[s.chipMotivoTxt, motivo === m && { color: '#fff' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.rotulo}>Descreva sua solicitação</Text>
          <View style={s.textareaBox}>
            <TextInput
              placeholder="Conte-nos o que aconteceu. Inclua o máximo de detalhes possível para que nossa equipe possa analisar."
              placeholderTextColor={T.faint}
              multiline
              numberOfLines={5}
              maxLength={500}
              value={descricao}
              onChangeText={setDescricao}
              style={s.textarea}
              textAlignVertical="top"
            />
            <Text style={s.contador}>{descricao.length}/500</Text>
          </View>

          <Text style={s.rotulo}>Anexar evidências <Text style={s.opcional}>(opcional)</Text></Text>
          <Text style={s.ajuda}>Adicione fotos, comprovantes ou documentos que apoiem sua solicitação.</Text>
          <View style={s.fotos}>
            {imagens.map((img, idx) => (
              <View key={idx} style={s.fotoBox}>
                <Image source={{ uri: img.uri }} style={s.fotoPrev} contentFit="cover" />
                <TouchableOpacity style={s.fotoRemover} onPress={() => setImagens(imagens.filter((_, i) => i !== idx))}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {imagens.length < 5 && (
              <TouchableOpacity style={s.fotoAdd} onPress={selecionarImagem} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={22} color={T.primary} />
                <Text style={s.fotoAddTxt}>Adicionar foto</Text>
                <Text style={s.fotoAddSub}>Até 5 fotos</Text>
              </TouchableOpacity>
            )}
          </View>

          {!!pedidoSelecionado && (
            <View style={s.resumo}>
              <View style={s.resumoLinha}><Text style={s.resumoRotulo}>Valor pago</Text><Text style={s.resumoValor}>{brl(pedidoSelecionado.valor_total)}</Text></View>
              <View style={s.resumoDivisor} />
              <View style={s.resumoLinha}><Text style={s.resumoTotalRotulo}>Valor solicitado</Text><Text style={s.resumoTotal}>{brl(pedidoSelecionado.valor_total)}</Text></View>
              <Text style={s.resumoNota}>O valor final do reembolso é confirmado após a análise.</Text>
            </View>
          )}

          <View style={s.protegido}>
            <Ionicons name="lock-closed" size={16} color={T.primary} />
            <Text style={s.protegidoTxt}>Seus dados estão protegidos. As informações são usadas apenas para análise desta solicitação.</Text>
          </View>

          <TouchableOpacity style={[s.btnPrim, (!pedidoSelecionado || enviando) && { opacity: 0.55 }]} onPress={enviarSolicitacao} disabled={enviando || !pedidoSelecionado} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimTxt}>Enviar solicitação</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSec} onPress={() => setCurrentView('LIST')} disabled={enviando} activeOpacity={0.85}>
            <Text style={s.btnSecTxt}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // LISTA
  // =========================================================================
  const ABAS = [
    { id: 'todos', rotulo: 'Todos', n: estornos.length },
    { id: 'analise', rotulo: 'Em análise', n: listaAnalise.length },
    { id: 'deferidos', rotulo: 'Deferidos', n: listaDeferida.length },
    { id: 'indeferidos', rotulo: 'Indeferidos', n: estornos.filter((i) => INDEFERIDO.includes(i.status)).length },
  ] as const;

  const det = detalheCompleto || detalheSelecionado;
  const detStatus = det ? statusInfo(det.status) : null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        <HeaderCliente voltar tituloMenor titulo="Meus estornos" subtitulo="Acompanhe suas solicitações e conteste dentro do prazo para análise da nossa equipe." />

        <View style={s.buscaLinha}>
          <View style={s.busca}>
            <Ionicons name="search" size={18} color={T.faint} />
            <TextInput placeholder="Buscar por reserva, protocolo ou local..." placeholderTextColor={T.faint} style={s.buscaInput} value={busca} onChangeText={setBusca} />
          </View>
        </View>

        {isCliente && (
          <TouchableOpacity style={s.solicitar} onPress={abrirFormulario} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.solicitarTxt}>Solicitar estorno</Text>
          </TouchableOpacity>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.abas}>
          {ABAS.map((a) => {
            const on = activeTab === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.aba, on && s.abaOn]} onPress={() => setActiveTab(a.id)} activeOpacity={0.85}>
                <Text style={[s.abaTxt, on && { color: '#fff' }]}>{a.rotulo}</Text>
                {a.id !== 'todos' && a.n > 0 && (
                  <View style={[s.abaBadge, on && { backgroundColor: '#fff' }]}><Text style={[s.abaBadgeTxt, on && { color: T.primary }]}>{a.n}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.secao}>Resumo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 6 }}>
          <View style={s.resumoCard}>
            <View style={[s.resumoIcone, { backgroundColor: T.primarySoft }]}><Ionicons name="document-text-outline" size={18} color={T.primary} /></View>
            <Text style={s.resumoCount}>{resumo.solicitados}</Text>
            <Text style={s.resumoLabel}>Solicitados</Text>
            <Text style={[s.resumoMoney, { color: T.primary }]}>{brl(resumo.valorSolicitado)}</Text>
          </View>
          <View style={s.resumoCard}>
            <View style={[s.resumoIcone, { backgroundColor: '#FEF3C7' }]}><Ionicons name="time-outline" size={18} color="#B45309" /></View>
            <Text style={s.resumoCount}>{resumo.emAnalise}</Text>
            <Text style={s.resumoLabel}>Em análise</Text>
            <Text style={[s.resumoMoney, { color: '#B45309' }]}>{brl(resumo.valorAnalise)}</Text>
          </View>
          <View style={s.resumoCard}>
            <View style={[s.resumoIcone, { backgroundColor: T.successBg }]}><Ionicons name="checkmark-circle-outline" size={18} color={T.success} /></View>
            <Text style={s.resumoCount}>{resumo.deferidos}</Text>
            <Text style={s.resumoLabel}>Deferidos</Text>
            <Text style={[s.resumoMoney, { color: T.success }]}>{brl(resumo.valorDeferido)}</Text>
          </View>
        </ScrollView>

        <Text style={s.secao}>Histórico de estornos</Text>

        {loading ? (
          <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
        ) : dadosFiltrados.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="receipt-outline" size={28} color={T.faint} /></View>
            <Text style={s.vazioTitulo}>Nenhum registro encontrado</Text>
            <Text style={s.vazioTxt}>Suas solicitações de estorno aparecem aqui.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {dadosFiltrados.map((item) => {
              const st = statusInfo(item.status);
              const titulo = item.itemAluguel?.nome || item.servico?.nome || item.estabelecimento?.nome;
              const foto = item.itemAluguel?.fotos?.[0] || item.servico?.foto || item.estabelecimento?.foto_perfil;
              const protocolo = String(item.codigo_estorno || '').split('-').slice(1).join('-') || item.id;
              const emAnalise = ANALISE.includes(item.status);

              return (
                <TouchableOpacity key={item.id} style={s.card} activeOpacity={0.9} onPress={() => abrirDetalhes(item)}>
                  <View style={s.cardTopo}>
                    <View style={s.cardFoto}>
                      <Image source={{ uri: foto || 'https://via.placeholder.com/120' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      <View style={s.cardTag}><Text style={s.cardTagTxt}>{item.categoria === 'ALUGUEL' ? 'Reserva' : 'Serviço'}</Text></View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={s.cardLinha}>
                        <Text style={s.cardTitulo} numberOfLines={1}>{titulo}</Text>
                      </View>
                      <Text style={s.cardSub} numberOfLines={1}>Protocolo #{protocolo}</Text>
                      <Text style={s.cardSub}>Solicitação: {dataBR(item.data_solicitacao)}</Text>
                      <Text style={s.cardValor}>Valor: {brl(item.valor_pago)}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[s.status, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icone as never} size={12} color={st.cor} />
                        <Text style={[s.statusTxt, { color: st.cor }]}>{st.label}</Text>
                      </View>
                      {emAnalise && item.prazo_resposta && <Text style={s.prazo}>Prazo {dataBR(item.prazo_resposta)}</Text>}
                      {DEFERIDO.includes(item.status) && <Text style={s.prazo}>Reembolso {dataBR(item.data_estorno || item.updated_at)}</Text>}
                      <Ionicons name="chevron-forward" size={18} color={T.faint} />
                    </View>
                  </View>

                  <View style={s.cardBotao}>
                    <Text style={s.cardBotaoTxt}>Ver detalhes</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* DETALHES DO ESTORNO */}
      <Modal visible={modalDetalhesVisible} animationType="slide" transparent onRequestClose={() => setModalDetalhesVisible(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalDetalhesVisible(false)} />
          <View style={s.sheet}>
            <View style={s.grip} />
            <View style={s.sheetTopo}>
              <Text style={s.sheetTitulo}>Detalhes do estorno</Text>
              {detStatus && (
                <View style={[s.status, { backgroundColor: detStatus.bg }]}>
                  <Text style={[s.statusTxt, { color: detStatus.cor }]}>{detStatus.label}</Text>
                </View>
              )}
            </View>

            {carregandoDetalhe && <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />}

            {!!det && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={s.detLinha}><Text style={s.detRotulo}>Protocolo</Text><Text style={s.detValor}>{det.codigo_estorno}</Text></View>
                <View style={s.detLinha}><Text style={s.detRotulo}>Local</Text><Text style={s.detValor}>{det.estabelecimento?.nome || '-'}</Text></View>
                <View style={s.detLinha}><Text style={s.detRotulo}>Item</Text><Text style={s.detValor}>{det.itemAluguel?.nome || det.servico?.nome || '-'}</Text></View>
                <View style={s.detLinha}><Text style={s.detRotulo}>Valor pago</Text><Text style={s.detValor}>{brl(det.valor_pago)}</Text></View>
                {Number(det.valor_estornado) > 0 && <View style={s.detLinha}><Text style={s.detRotulo}>Valor estornado</Text><Text style={[s.detValor, { color: T.success }]}>{brl(det.valor_estornado)}</Text></View>}
                <View style={s.detLinha}><Text style={s.detRotulo}>Solicitado em</Text><Text style={s.detValor}>{dataBR(det.data_solicitacao)}</Text></View>
                {!!det.motivo && <View style={s.detBloco}><Text style={s.detRotulo}>Motivo</Text><Text style={s.detTexto}>{det.motivo}</Text></View>}
                {!!det.descricao_cliente && <View style={s.detBloco}><Text style={s.detRotulo}>Sua descrição</Text><Text style={s.detTexto}>{det.descricao_cliente}</Text></View>}
                {!!det.descricao_admin && <View style={[s.detBloco, { backgroundColor: T.primarySoft }]}><Text style={s.detRotulo}>Resposta da análise</Text><Text style={s.detTexto}>{det.descricao_admin}</Text></View>}

                {Array.isArray(detalheCompleto?.historicos) && detalheCompleto.historicos.length > 0 && (
                  <>
                    <Text style={[s.rotulo, { marginTop: 16 }]}>Andamento</Text>
                    {detalheCompleto.historicos.map((h: any) => (
                      <View key={h.id} style={s.histLinha}>
                        <View style={s.histPonto} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.histTitulo}>{String(h.novo_status).replace(/_/g, ' ')}</Text>
                          {!!h.descricao && <Text style={s.histSub}>{h.descricao}</Text>}
                          <Text style={s.histSub}>{dataBR(h.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={s.btnPrim} onPress={() => setModalDetalhesVisible(false)} activeOpacity={0.85}>
              <Text style={s.btnPrimTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 30 : 0 },

  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  formTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },

  buscaLinha: { paddingHorizontal: 20, marginTop: 6 },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 24, paddingHorizontal: 16, height: 50, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buscaInput: { flex: 1, fontSize: 14, color: T.ink },

  solicitar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.primary, marginHorizontal: 20, marginTop: 14, height: 54, borderRadius: 27 },
  solicitarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  abas: { paddingHorizontal: 20, gap: 8, paddingVertical: 14 },
  aba: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  abaOn: { backgroundColor: T.primary, borderColor: T.primary },
  abaTxt: { fontSize: 13, fontWeight: '700', color: T.ink },
  abaBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  abaBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  secao: { fontSize: 18, fontWeight: '800', color: T.ink, paddingHorizontal: 20, marginTop: 10, marginBottom: 12, letterSpacing: -0.3 },
  resumoCard: { backgroundColor: T.card, width: 148, borderRadius: 22, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  resumoIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  resumoCount: { fontSize: 28, fontWeight: '800', color: T.ink },
  resumoLabel: { fontSize: 12, color: T.muted, marginBottom: 6 },
  resumoMoney: { fontSize: 14, fontWeight: '800' },

  card: { backgroundColor: T.card, borderRadius: 24, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTopo: { flexDirection: 'row', gap: 12 },
  cardFoto: { width: 84, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: T.line },
  cardTag: { position: 'absolute', top: 6, left: 6, backgroundColor: T.tag, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  cardTagTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cardLinha: { flexDirection: 'row', alignItems: 'center' },
  cardTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: T.ink },
  cardSub: { fontSize: 12, color: T.muted, marginTop: 3 },
  cardValor: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusTxt: { fontSize: 11, fontWeight: '800' },
  prazo: { fontSize: 10, color: T.muted, textAlign: 'right', maxWidth: 90 },
  cardBotao: { marginTop: 12, backgroundColor: T.primary, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cardBotaoTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  vazio: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 },
  vazioIcone: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazioTitulo: { fontSize: 16, fontWeight: '800', color: T.ink },
  vazioTxt: { fontSize: 13, color: T.muted, marginTop: 4, textAlign: 'center' },

  // formulário
  banner: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: T.primarySoft, borderRadius: 20, padding: 16 },
  bannerIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bannerTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  bannerTxt: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },
  rotulo: { fontSize: 14, fontWeight: '800', color: T.ink, marginTop: 20, marginBottom: 10 },
  opcional: { fontWeight: '500', color: T.muted },
  ajuda: { fontSize: 12, color: T.muted, marginTop: -6, marginBottom: 10 },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  avisoTxt: { flex: 1, fontSize: 13, color: T.muted, lineHeight: 18 },
  pedido: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pedidoOn: { borderColor: T.primary, backgroundColor: T.primarySoft },
  pedidoImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: T.line },
  pedidoTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  pedidoSub: { fontSize: 11, color: T.muted, marginTop: 2 },
  pedidoPreco: { fontSize: 14, fontWeight: '800', color: T.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipMotivo: { backgroundColor: T.card, borderWidth: 1.5, borderColor: T.line, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22 },
  chipMotivoOn: { backgroundColor: T.primary, borderColor: T.primary },
  chipMotivoTxt: { fontSize: 13, fontWeight: '600', color: T.ink },
  textareaBox: { backgroundColor: T.card, borderRadius: 20, borderWidth: 1.5, borderColor: T.line, padding: 14 },
  textarea: { minHeight: 110, fontSize: 14, color: T.ink },
  contador: { alignSelf: 'flex-end', fontSize: 11, color: T.faint },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fotoBox: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden' },
  fotoPrev: { width: '100%', height: '100%' },
  fotoRemover: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(31,26,23,0.7)', alignItems: 'center', justifyContent: 'center' },
  fotoAdd: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F0B79C', backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', gap: 2 },
  fotoAddTxt: { fontSize: 10, fontWeight: '700', color: T.ink },
  fotoAddSub: { fontSize: 9, color: T.muted },
  resumo: { backgroundColor: T.card, borderRadius: 20, padding: 14, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumoRotulo: { fontSize: 13, color: T.muted },
  resumoValor: { fontSize: 14, fontWeight: '700', color: T.ink },
  resumoDivisor: { height: 1, backgroundColor: T.line, marginVertical: 10 },
  resumoTotalRotulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  resumoTotal: { fontSize: 18, fontWeight: '800', color: T.primary },
  resumoNota: { fontSize: 11, color: T.muted, marginTop: 8 },
  protegido: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: T.primarySoft, borderRadius: 14, padding: 14, marginTop: 20 },
  protegidoTxt: { flex: 1, fontSize: 12, color: T.muted, lineHeight: 17 },
  btnPrim: { backgroundColor: T.primary, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: T.card, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btnSecTxt: { color: T.primary, fontWeight: '800', fontSize: 15 },

  // detalhes
  overlay: { flex: 1, backgroundColor: 'rgba(31,26,23,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.line, alignSelf: 'center', marginBottom: 14 },
  sheetTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitulo: { fontSize: 19, fontWeight: '800', color: T.ink },
  detLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line, gap: 12 },
  detRotulo: { fontSize: 13, color: T.muted },
  detValor: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700', color: T.ink },
  detBloco: { backgroundColor: T.cream, borderRadius: 14, padding: 12, marginTop: 12 },
  detTexto: { fontSize: 13, color: T.ink, marginTop: 4, lineHeight: 19 },
  histLinha: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  histPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary, marginTop: 4 },
  histTitulo: { fontSize: 13, fontWeight: '700', color: T.ink, textTransform: 'capitalize' },
  histSub: { fontSize: 11, color: T.muted, marginTop: 2 },
});
