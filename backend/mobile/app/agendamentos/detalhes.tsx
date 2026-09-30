import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { alertar } from '../../services/alertar';
import { T } from '../../constants/ClientTheme';
import GaleriaFotos, { normalizarFotos } from '../../components/client/GaleriaFotos';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
// Sempre termina em /mobile, mesmo que a variável de ambiente venha só com /api.
const API_URL = `${ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '')}/mobile`;

interface Reserva {
  id: string | number;
  status: string;
  status_pagamento?: string;
  codigo_verificacao?: string | null;
  data_agendamento?: string;
  hora_agendamento?: string;
  data_inicio?: string;
  data_fim?: string;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  quantidade?: number | string | null;
  valor_final?: number | string | null;
  posicao_fila?: number | null;
  servico?: { nome?: string; descricao?: string; duracao_minutos?: number | string; fotos?: string | string[] } | null;
  item?: {
    nome?: string; descricao?: string; fotos?: string | string[]; categoria?: string; marca?: string; modelo?: string;
    capacidade_pessoas?: number | string | null; ano?: number | string | null;
  } | null;
  estabelecimento?: {
    nome?: string; telefone?: string; rua?: string | null; numero?: string | null; bairro?: string | null;
    cidade?: string | null; estado?: string | null; foto_perfil?: string | null;
  } | null;
  estabelecimento_id?: number;
}

/** A API devolve valores como texto ("50.00"): converte com segurança. */
const num = (v: unknown, padrao = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};
const brl = (v: unknown) => `R$ ${num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (iso?: string) => (iso ? String(iso).substring(0, 10).split('-').reverse().join('/') : '');
const hora = (h?: string | null) => (h ? String(h).substring(0, 5) : '');

const STATUS: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  pendente: { rotulo: 'Aguardando', cor: '#B45309', fundo: '#FEF3C7' },
  confirmado: { rotulo: 'Confirmada', cor: T.success, fundo: T.successBg },
  em_atendimento: { rotulo: 'Em atendimento', cor: '#2563EB', fundo: '#EFF6FF' },
  finalizado: { rotulo: 'Concluída', cor: T.success, fundo: T.successBg },
  cancelado: { rotulo: 'Cancelada', cor: T.danger, fundo: '#FEF2F2' },
  estornado: { rotulo: 'Estornada', cor: T.danger, fundo: '#FEF2F2' },
  aguardando_pagamento: { rotulo: 'Aguardando pagamento', cor: '#B45309', fundo: '#FEF3C7' },
};

export default function DetalhesAgendamento() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams();
  const isAluguel = tipo === 'aluguel';

  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [cancelamentoPct, setCancelamentoPct] = useState(2);

  const token = () => AsyncStorage.getItem('@waitless_token').then((t) => t || AsyncStorage.getItem('@lokyva_token'));

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const endpoint = isAluguel ? `alugueis/${id}` : `agendamentos/${id}`;
      const res = await fetch(`${API_URL}/${endpoint}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } });
      const json = await res.json().catch(() => null);
      if (res.ok && json) setReserva(json);
      else setErro(json?.error || json?.message || 'Não foi possível carregar os detalhes desta reserva.');
    } catch {
      setErro('Não conseguimos conectar ao servidor. Verifique sua internet e tente de novo.');
    } finally {
      setLoading(false);
    }
  }, [id, isAluguel]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    fetch(`${API_URL}/taxas`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j) => { if (typeof j?.cancelamento_tardio_percentual === 'number') setCancelamentoPct(j.cancelamento_tardio_percentual); })
      .catch(() => {});
  }, []);

  const cancelar = () => {
    const prazo = isAluguel ? '24 horas' : '30 minutos';
    alertar(
      'Cancelar reserva',
      `Cancelamentos feitos a menos de ${prazo} do horário marcado podem ter retenção de ${cancelamentoPct}% do valor pago. Deseja cancelar?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            setProcessando(true);
            try {
              const endpoint = isAluguel ? `alugueis/${id}/cancelar` : `agendamentos/${id}/cancelar`;
              const res = await fetch(`${API_URL}/${endpoint}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } });
              const json = await res.json().catch(() => ({}));
              if (res.ok) {
                alertar('Reserva cancelada', json.message || 'Sua reserva foi cancelada.');
                router.back();
              } else {
                alertar('Não foi possível cancelar', json.error || json.message || 'Tente novamente em instantes.');
              }
            } catch {
              alertar('Sem conexão', 'Verifique sua internet e tente de novo.');
            } finally {
              setProcessando(false);
            }
          },
        },
      ],
    );
  };

  const baixarComprovante = async () => {
    if (!reserva) return;
    setProcessando(true);
    try {
      const nome = isAluguel ? reserva.item?.nome : reserva.servico?.nome;
      const quando = isAluguel
        ? `De ${dataBR(reserva.data_inicio)} até ${dataBR(reserva.data_fim)}`
        : `${dataBR(reserva.data_agendamento)} às ${hora(reserva.hora_agendamento)}`;
      const html = `
        <html><head><style>
          body { font-family: Helvetica, Arial, sans-serif; color: #282828; padding: 40px; }
          h1 { font-size: 24px; text-transform: uppercase; }
          .box { border: 1px solid #E6E7E9; border-radius: 12px; padding: 20px; margin-top: 20px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #F5F5F5; padding-bottom: 10px; }
          .label { font-size: 12px; color: #6A6C72; font-weight: bold; text-transform: uppercase; }
          .val { font-size: 16px; font-weight: bold; }
        </style></head><body>
          <h1>Comprovante de reserva</h1>
          <p>Este documento é o recibo da sua reserva no Lokyva.</p>
          <div class="box">
            <div class="row"><span class="label">Local</span><span class="val">${reserva.estabelecimento?.nome || ''}</span></div>
            <div class="row"><span class="label">Serviço / Item</span><span class="val">${nome || ''}${isAluguel && reserva.quantidade ? ` (x${reserva.quantidade})` : ''}</span></div>
            <div class="row"><span class="label">Período / Data</span><span class="val">${quando}</span></div>
            <div class="row"><span class="label">Valor</span><span class="val">${brl(reserva.valor_final)}</span></div>
            <div class="row"><span class="label">PIN</span><span class="val">${reserva.codigo_verificacao || 'N/A'}</span></div>
          </div>
          <p style="margin-top:40px;font-size:10px;color:#A0A2A8;text-align:center;">Lokyva · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      alertar('Não foi possível gerar o comprovante', 'Tente novamente em instantes.');
    } finally {
      setProcessando(false);
    }
  };

  const conversar = async () => {
    if (!reserva) return;
    if (!isAluguel && !reserva.estabelecimento_id) return;
    setProcessando(true);
    try {
      const payload = isAluguel ? { aluguel_id: id } : { estabelecimento_id: reserva.estabelecimento_id, agendamento_id: id };
      const res = await fetch(`${API_URL}/mensagens/iniciar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.id) router.push(`/mensagens/${json.id}` as never);
      else alertar('Não foi possível abrir a conversa', 'Tente novamente em instantes.');
    } catch {
      alertar('Sem conexão', 'Verifique sua internet e tente de novo.');
    } finally {
      setProcessando(false);
    }
  };

  const abrirMapa = () => {
    const e = reserva?.estabelecimento;
    if (!e) return;
    const endereco = encodeURIComponent([e.rua, e.numero, e.cidade, e.estado].filter(Boolean).join(', '));
    Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${endereco}` : `geo:0,0?q=${endereco}`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${endereco}`);
    });
  };

  if (loading) {
    return <View style={s.centro}><ActivityIndicator size="large" color={T.primary} /></View>;
  }

  if (erro || !reserva) {
    return (
      <View style={s.centro}>
        <View style={s.erroIcone}><Ionicons name="cloud-offline-outline" size={34} color={T.primary} /></View>
        <Text style={s.erroTitulo}>Não deu para abrir esta reserva</Text>
        <Text style={s.erroTxt}>{erro || 'Reserva não encontrada.'}</Text>
        <TouchableOpacity style={s.btnPrim} onPress={carregar} activeOpacity={0.85}><Text style={s.btnPrimTxt}>Tentar de novo</Text></TouchableOpacity>
        <TouchableOpacity style={s.btnLink} onPress={() => router.back()}><Text style={s.btnLinkTxt}>Voltar</Text></TouchableOpacity>
      </View>
    );
  }

  const st = STATUS[reserva.status] || { rotulo: reserva.status, cor: T.muted, fundo: '#F0F0F2' };
  const cancelada = ['cancelado', 'estornado'].includes(reserva.status);
  const podeCancelar = !cancelada && reserva.status !== 'finalizado';
  const fotos = normalizarFotos(isAluguel ? reserva.item?.fotos : reserva.servico?.fotos);
  const titulo = (isAluguel ? reserva.item?.nome : reserva.servico?.nome) || 'Reserva';
  const descricao = isAluguel ? reserva.item?.descricao : reserva.servico?.descricao;
  const quantidade = num(reserva.quantidade);
  const posicao = num(reserva.posicao_fila);
  const e = reserva.estabelecimento;
  const enderecoTxt = [[e?.rua, e?.numero].filter(Boolean).join(', '), [e?.bairro, [e?.cidade, e?.estado].filter(Boolean).join('/')].filter(Boolean).join(' - ')].filter(Boolean);

  const specs: { icone: string; texto: string }[] = [];
  if (isAluguel) {
    if (num(reserva.item?.capacidade_pessoas)) specs.push({ icone: 'people-outline', texto: `Até ${num(reserva.item?.capacidade_pessoas)} pessoas` });
    if (reserva.item?.marca) specs.push({ icone: 'pricetag-outline', texto: `${reserva.item.marca} ${reserva.item.modelo || ''}`.trim() });
    if (num(reserva.item?.ano)) specs.push({ icone: 'calendar-outline', texto: `Ano ${num(reserva.item?.ano)}` });
    if (reserva.item?.categoria) specs.push({ icone: 'apps-outline', texto: String(reserva.item.categoria) });
  }

  return (
    <View style={s.tela}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        {/* FOTOS (passa o dedo; toque para ver em tela cheia) */}
        <GaleriaFotos fotos={fotos} altura={260} fallback={e?.foto_perfil || undefined}>
          <TouchableOpacity style={s.voltar} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </TouchableOpacity>
        </GaleriaFotos>

        <View style={s.corpo}>
          {/* CARTÃO DE STATUS + PIN */}
          <View style={[s.status, cancelada && s.statusCancelada]}>
            <View style={s.statusTopo}>
              <Text style={[s.statusTitulo, cancelada && { color: T.danger }]}>{cancelada ? 'Reserva cancelada' : 'Reserva ativa'}</Text>
              <View style={[s.pilula, { backgroundColor: st.fundo }]}><Text style={[s.pilulaTxt, { color: st.cor }]}>{st.rotulo}</Text></View>
            </View>
            {!cancelada && (
              <View style={s.pinBox}>
                <Text style={s.pinRotulo}>SEU PIN DE ACESSO</Text>
                <Text style={s.pinValor}>{reserva.codigo_verificacao || '----'}</Text>
                <Text style={s.pinDesc}>Mostre este código no local para iniciar o atendimento.</Text>
              </View>
            )}
          </View>

          {!cancelada && !isAluguel && posicao > 0 && (
            <View style={s.fila}>
              <Ionicons name="hourglass-outline" size={24} color={T.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.filaTitulo}>Você é o {posicao}º da fila</Text>
                <Text style={s.filaTxt}>Chegue 10 minutos antes ({hora(reserva.hora_agendamento)}).</Text>
              </View>
            </View>
          )}

          {/* O QUE ESTÁ INCLUSO */}
          <View style={s.cartao}>
            <Text style={s.secao}>Sua reserva</Text>
            <Text style={s.titulo}>{titulo}{isAluguel && quantidade > 0 ? ` (x${quantidade})` : ''}</Text>
            {!!descricao && <Text style={s.descricao}>{descricao}</Text>}

            {specs.length > 0 && (
              <View style={s.specs}>
                {specs.map((sp) => (
                  <View key={sp.texto} style={s.spec}>
                    <Ionicons name={sp.icone as any} size={14} color={T.muted} />
                    <Text style={s.specTxt}>{sp.texto}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.linha}>
              <Text style={s.linhaRotulo}>{isAluguel ? 'Período' : 'Data e hora'}</Text>
              <Text style={s.linhaValor}>
                {isAluguel ? `${dataBR(reserva.data_inicio)} até ${dataBR(reserva.data_fim)}` : `${dataBR(reserva.data_agendamento)} às ${hora(reserva.hora_agendamento)}`}
              </Text>
            </View>
            {isAluguel && !!reserva.horario_inicio && (
              <View style={s.linha}>
                <Text style={s.linhaRotulo}>Horários</Text>
                <Text style={s.linhaValor}>{hora(reserva.horario_inicio)} às {hora(reserva.horario_fim)}</Text>
              </View>
            )}
            {!isAluguel && num(reserva.servico?.duracao_minutos) > 0 && (
              <View style={s.linha}>
                <Text style={s.linhaRotulo}>Duração</Text>
                <Text style={s.linhaValor}>{num(reserva.servico?.duracao_minutos)} minutos</Text>
              </View>
            )}
            <View style={[s.linha, { borderBottomWidth: 0 }]}>
              <Text style={s.linhaRotulo}>Valor</Text>
              <Text style={[s.linhaValor, { color: T.primary, fontSize: 17 }]}>{brl(reserva.valor_final)}</Text>
            </View>
          </View>

          {/* ONDE FICA */}
          <View style={s.cartao}>
            <Text style={s.secao}>Onde fica</Text>
            <Text style={s.titulo}>{e?.nome || 'Local'}</Text>
            {enderecoTxt.map((linha) => <Text key={linha} style={s.descricao}>{linha}</Text>)}
            <TouchableOpacity style={s.btnClaro} onPress={abrirMapa} activeOpacity={0.8}>
              <Ionicons name="map-outline" size={18} color={T.ink} />
              <Text style={s.btnClaroTxt}>Abrir no mapa</Text>
            </TouchableOpacity>
          </View>

          {/* AÇÕES */}
          <TouchableOpacity style={s.btnClaro} onPress={conversar} disabled={processando} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={T.ink} />
            <Text style={s.btnClaroTxt}>{isAluguel ? 'Conversar sobre esta locação' : 'Conversar sobre este agendamento'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnPrim} onPress={baixarComprovante} disabled={processando} activeOpacity={0.85}>
            {processando ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="document-text-outline" size={19} color="#fff" />
                <Text style={s.btnPrimTxt}>Baixar comprovante</Text>
              </>
            )}
          </TouchableOpacity>

          {podeCancelar && (
            <TouchableOpacity style={s.btnCancelar} onPress={cancelar} disabled={processando} activeOpacity={0.8}>
              <Text style={s.btnCancelarTxt}>Cancelar reserva</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: T.cream },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.cream, padding: 28 },
  erroIcone: { width: 76, height: 76, borderRadius: 38, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  erroTitulo: { fontSize: 20, fontWeight: '800', color: T.ink, textAlign: 'center' },
  erroTxt: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 20 },
  btnLink: { paddingVertical: 14 },
  btnLinkTxt: { color: T.muted, fontWeight: '700' },

  voltar: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 36, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...sombra },
  corpo: { padding: 20, marginTop: -22, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: T.cream, gap: 14 },

  status: { backgroundColor: T.ink, borderRadius: 26, padding: 20 },
  statusCancelada: { backgroundColor: '#FEF2F2' },
  statusTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTitulo: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pilula: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  pilulaTxt: { fontSize: 11, fontWeight: '800' },
  pinBox: { alignItems: 'center', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingVertical: 16 },
  pinRotulo: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pinValor: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: 10, marginTop: 6 },
  pinDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.primarySoft, borderRadius: 20, padding: 16 },
  filaTitulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  filaTxt: { fontSize: 12, color: T.muted, marginTop: 2 },

  cartao: { backgroundColor: T.card, borderRadius: 24, padding: 18, ...sombra },
  secao: { fontSize: 11, fontWeight: '800', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  titulo: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  descricao: { fontSize: 13, color: T.muted, lineHeight: 20, marginTop: 4 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  specTxt: { fontSize: 12, fontWeight: '600', color: T.ink },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F2', marginTop: 4 },
  linhaRotulo: { fontSize: 13, color: T.muted, fontWeight: '600' },
  linhaValor: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: T.ink },

  btnClaro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: T.card, marginTop: 6, ...sombra },
  btnClaroTxt: { fontSize: 14, fontWeight: '700', color: T.ink },
  btnPrim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: T.primary, paddingHorizontal: 28 },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnCancelar: { alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 25, backgroundColor: '#FEF2F2' },
  btnCancelarTxt: { color: T.danger, fontWeight: '800', fontSize: 14 },
});
