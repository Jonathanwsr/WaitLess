import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Cores baseadas na sua identidade visual
const COLORS = {
  primary: '#FF5A00',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#DC2626',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function MeusAgendamentos() {
  const router = useRouter();
  
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('historico');
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState<string | null>(null); // Armazena o ID do item gerando PDF

  const carregarAgendamentos = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const response = await fetch(`${API_URL}/agendamentos/meus`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setLista(data);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar o seu histórico.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarAgendamentos();
  };

  // Separação Inteligente das Abas
  const dadosFiltrados = lista.filter(item =>
    abaAtiva === 'ativos'
      ? ['pendente', 'confirmado', 'em_atendimento', 'aguardando_pagamento'].includes(item.status)
      : ['finalizado', 'cancelado', 'estornado', 'vencido'].includes(item.status)
  );

  // ====================================================
  // FUNÇÕES DE AÇÃO
  // ====================================================

  const handleVerDetalhes = (item: any) => {
    // Redireciona para a tela de Detalhes passando o ID e o Tipo (serviço ou aluguel)
    const tipo = item.aluguel_id ? 'aluguel' : 'servico';
    router.push({ pathname: '/agendamentos/detalhes', params: { id: item.id, tipo } });
  };

  const handleBaixarRecibo = async (item: any) => {
    setBaixandoPdf(item.id);
    try {
      const nomeServico = item.servico?.nome || 'Serviço WaitLess';
      const nomeLocal = item.estabelecimento?.nome || 'Estabelecimento Parceiro';
      const dataFormatada = item.data_agendamento.split('-').reverse().join('/');
      const horaFormatada = item.hora_agendamento.substring(0, 5);
      const valorFinal = Number(item.valor_final || 0).toFixed(2).replace('.', ',');

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; color: #111827; padding: 40px; }
              h1 { color: #FF5A00; font-size: 28px; text-transform: uppercase; letter-spacing: -1px; margin-bottom: 5px; }
              .sub { color: #6B7280; font-size: 14px; margin-bottom: 40px; }
              .box { border: 2px solid #E5E7EB; border-radius: 16px; padding: 24px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #F3F4F6; padding-bottom: 16px; }
              .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              .label { font-size: 12px; color: #9CA3AF; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
              .val { font-size: 16px; font-weight: 900; text-transform: uppercase; }
              .footer { margin-top: 60px; font-size: 10px; color: #9CA3AF; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            </style>
          </head>
          <body>
            <h1>Comprovante de Serviço</h1>
            <div class="sub">Histórico de Atendimento • WaitLess</div>
            
            <div class="box">
              <div class="row">
                <span class="label">Local</span>
                <span class="val">${nomeLocal}</span>
              </div>
              <div class="row">
                <span class="label">Descrição</span>
                <span class="val">${nomeServico}</span>
              </div>
              <div class="row">
                <span class="label">Data e Hora</span>
                <span class="val">${dataFormatada} às ${horaFormatada}</span>
              </div>
              <div class="row">
                <span class="label">Pagamento</span>
                <span class="val">${item.status_pagamento === 'pago_online' ? 'Pago no App' : 'Pago no Local'}</span>
              </div>
              <div class="row">
                <span class="label">Valor Total</span>
                <span class="val" style="color: #059669;">R$ ${valorFinal}</span>
              </div>
            </div>
            
            <div class="footer">Gerado digitalmente via WaitLess em ${new Date().toLocaleDateString('pt-BR')}</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar o comprovante.');
    } finally {
      setBaixandoPdf(null);
    }
  };

  // ====================================================
  // RENDERIZAÇÃO DO CARTÃO
  // ====================================================
  const renderCard = ({ item }: { item: any }) => {
    const nomeServico = item.servico?.nome || 'Serviço Indisponível';
    const nomeLocal = item.estabelecimento?.nome || 'Estabelecimento';
    const dataFormatada = item.data_agendamento.split('-').reverse().join('/');
    const horaFormatada = item.hora_agendamento.substring(0, 5);
    
    const isFinalizado = item.status === 'finalizado';
    const isCancelado = item.status === 'cancelado' || item.status === 'estornado';

    return (
      <View style={[styles.card, isCancelado && styles.cardCancelado]}>
        
        <View style={styles.cardHeader}>
          <View style={styles.infoPrincipal}>
            <Text style={styles.titulo} numberOfLines={1}>{nomeServico}</Text>
            <Text style={styles.subTitulo}>{nomeLocal}</Text>
          </View>
          <View style={[
            styles.badgeStatus, 
            isFinalizado && { backgroundColor: '#ECFDF5' },
            isCancelado && { backgroundColor: '#FEF2F2' }
          ]}>
            <Text style={[
              styles.badgeTexto,
              isFinalizado && { color: COLORS.success },
              isCancelado && { color: COLORS.error }
            ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divisor} />

        <View style={styles.infoGrid}>
          <View style={styles.infoBloco}>
            <Text style={styles.infoLabel}>DATA</Text>
            <Text style={styles.infoValor}>{dataFormatada}</Text>
          </View>
          <View style={styles.infoBloco}>
            <Text style={styles.infoLabel}>HORA</Text>
            <Text style={styles.infoValor}>{horaFormatada}</Text>
          </View>
          <View style={styles.infoBloco}>
            <Text style={styles.infoLabel}>VALOR</Text>
            <Text style={styles.infoValor}>R$ {Number(item.valor_final || 0).toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

        {/* BOTÕES DE AÇÃO: Diferentes para a aba Ativos e Histórico */}
        {abaAtiva === 'historico' ? (
          <View style={styles.acoesContainer}>
            <TouchableOpacity style={styles.btnDetalhes} onPress={() => handleVerDetalhes(item)}>
              <Text style={styles.btnDetalhesTexto}>VER DETALHES</Text>
            </TouchableOpacity>
            
            {/* Só permite baixar recibo se foi concluído com sucesso */}
            {isFinalizado && (
              <TouchableOpacity 
                style={styles.btnRecibo} 
                onPress={() => handleBaixarRecibo(item)}
                disabled={baixandoPdf === item.id}
              >
                {baixandoPdf === item.id ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.btnReciboTexto}>BAIXAR RECIBO</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.acoesContainer}>
            <TouchableOpacity style={styles.btnDetalhes} onPress={() => handleVerDetalhes(item)}>
              <Text style={styles.btnDetalhesTexto}>ACOMPANHAR FILA</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Seus Pedidos</Text>

      {/* ABAS MODERNAS SEM ÍCONES */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, abaAtiva === 'ativos' && styles.tabAtiva]}
          onPress={() => setAbaAtiva('ativos')}
        >
          <Text style={[styles.tabTexto, abaAtiva === 'ativos' && styles.tabTextoAtivo]}>EM ABERTO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, abaAtiva === 'historico' && styles.tabAtiva]}
          onPress={() => setAbaAtiva('historico')}
        >
          <Text style={[styles.tabTexto, abaAtiva === 'historico' && styles.tabTextoAtivo]}>HISTÓRICO</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      ) : (
        <FlatList
          data={dadosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCard}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum registro encontrado.</Text>
              <Text style={styles.emptyDesc}>Suas reservas aparecerão aqui.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray, paddingHorizontal: 20, paddingTop: 40 },
  pageTitle: { fontSize: 32, fontWeight: '900', color: COLORS.secondary, marginBottom: 24, letterSpacing: -1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Abas
  tabContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 100, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 100 },
  tabAtiva: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabTexto: { fontSize: 12, fontWeight: '800', color: COLORS.gray, letterSpacing: 1 },
  tabTextoAtivo: { color: COLORS.secondary },

  // Card
  card: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardCancelado: { backgroundColor: '#FAFAFA', opacity: 0.8 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoPrincipal: { flex: 1, paddingRight: 16 },
  titulo: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  subTitulo: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  
  badgeStatus: { backgroundColor: '#E0E7FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeTexto: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#3730A3' },
  
  divisor: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },

  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  infoBloco: { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 4 },
  infoValor: { fontSize: 15, fontWeight: '900', color: COLORS.secondary },

  // Botões de Ação
  acoesContainer: { flexDirection: 'row', gap: 12 },
  
  btnDetalhes: { flex: 1, backgroundColor: COLORS.lightGray, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnDetalhesTexto: { fontSize: 12, fontWeight: '900', color: COLORS.secondary, letterSpacing: 1 },

  btnRecibo: { flex: 1, backgroundColor: '#FFF4ED', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnReciboTexto: { fontSize: 12, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: COLORS.gray, fontWeight: '500' }
});