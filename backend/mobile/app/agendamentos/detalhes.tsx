import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Linking,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF4ED',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  error: '#DC2626',
  success: '#10B981'
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Interfaces para evitar o uso de 'any'
interface Servico {
  nome: string;
  descricao: string;
  duracao_minutos: number;
}

interface Estabelecimento {
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface Reserva {
  id: string | string[];
  status: string;
  status_pagamento: string;
  codigo_verificacao?: string;
  data_agendamento: string;
  hora_agendamento: string;
  valor_final: number;
  posicao_fila?: number;
  servico: Servico;
  estabelecimento: Estabelecimento;
}

export default function DetalhesAgendamento() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams(); // tipo: 'servico' ou 'aluguel'

  // Utilizando a tipagem Reserva para evitar erro de 'any'
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    carregarDetalhes();
  }, [id, tipo]);

  const carregarDetalhes = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      // Ajustado para o endpoint solicitado
      const response = await fetch(`${API_URL}/reservas/item/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setReserva(data);
      } else {
        Alert.alert('Erro', data.error || 'Não foi possível carregar os detalhes.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    const isAluguel = tipo === 'aluguel';
    const avisoTempo = isAluguel ? '24 horas' : '30 minutos';

    Alert.alert(
      "Cancelar Reserva",
      `Atenção: Cancelamentos feitos a menos de ${avisoTempo} do horário marcado sofrem uma retenção de 2% do valor pago. Tem certeza que deseja cancelar?`,
      [
        { text: "Voltar", style: "cancel" },
        { 
          text: "Sim, Cancelar", 
          style: "destructive", 
          onPress: async () => {
            setProcessando(true);
            try {
              const token = await AsyncStorage.getItem('@waitless_token');
              const endpoint = isAluguel ? `alugueis/${id}/cancelar` : `agendamentos/${id}/cancelar`;

              // Corrigido API_BASE_URL para API_URL
              const response = await fetch(`${API_URL}/${endpoint}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });
              
              const data = await response.json();
              if (response.ok) {
                Alert.alert("Sucesso", data.message || "Reserva cancelada com sucesso.");
                router.back();
              } else {
                Alert.alert("Erro", data.error || "Não foi possível cancelar.");
              }
            } catch (error) {
              Alert.alert("Erro", "Falha de conexão.");
            } finally {
              setProcessando(false);
            }
          }
        }
      ]
    );
  };

  const handleBaixarComprovante = async () => {
    if (!reserva) return;
    
    setProcessando(true);
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; padding: 40px; }
              h1 { color: #FF5A00; font-size: 24px; text-transform: uppercase; letter-spacing: -1px; }
              .box { border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-top: 20px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #F9FAFB; padding-bottom: 10px; }
              .label { font-size: 12px; color: #6B7280; font-weight: bold; text-transform: uppercase; }
              .val { font-size: 16px; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Comprovante WaitLess</h1>
            <p>Este documento serve como recibo oficial de sua reserva no sistema WaitLess.</p>
            
            <div class="box">
              <div class="row">
                <span class="label">Estabelecimento</span>
                <span class="val">${reserva.estabelecimento.nome}</span>
              </div>
              <div class="row">
                <span class="label">Serviço / Item</span>
                <span class="val">${reserva.servico.nome}</span>
              </div>
              <div class="row">
                <span class="label">Data e Hora</span>
                <span class="val">${reserva.data_agendamento.split('-').reverse().join('/')} às ${reserva.hora_agendamento.substring(0,5)}</span>
              </div>
              <div class="row">
                <span class="label">Valor Pago</span>
                <span class="val">R$ ${reserva.valor_final.toFixed(2).replace('.', ',')}</span>
              </div>
              <div class="row">
                <span class="label">PIN de Segurança</span>
                <span class="val" style="color: #FF5A00; font-size: 20px;">${reserva.codigo_verificacao || 'N/A'}</span>
              </div>
            </div>
            
            <p style="margin-top: 40px; font-size: 10px; color: #9CA3AF; text-align: center;">
              WaitLess Marketplace - Gerado digitalmente em ${new Date().toLocaleDateString('pt-BR')}
            </p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      
    } catch (error) {
      Alert.alert('Erro', 'Falha ao gerar o comprovante.');
    } finally {
      setProcessando(false);
    }
  };

  const abrirMapa = () => {
    if (!reserva) return;
    const address = `${reserva.estabelecimento.rua}, ${reserva.estabelecimento.numero}, ${reserva.estabelecimento.cidade}, ${reserva.estabelecimento.estado}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`
    });
    Linking.openURL(url as string);
  };

  if (loading || !reserva) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isCancelado = reserva.status === 'cancelado' || reserva.status === 'estornado';
  const podeCancelar = !isCancelado && reserva.status !== 'finalizado';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={[styles.statusCard, isCancelado ? styles.bgError : styles.bgPrimary]}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusText}>{isCancelado ? 'RESERVA CANCELADA' : 'RESERVA ATIVA'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{reserva.status.toUpperCase()}</Text>
            </View>
          </View>
          
          {!isCancelado && (
            <View style={styles.pinContainer}>
              <Text style={styles.pinLabel}>SEU PIN DE ACESSO</Text>
              <Text style={styles.pinValue}>{reserva.codigo_verificacao || '----'}</Text>
              <Text style={styles.pinDesc}>Mostre este código no estabelecimento para iniciar.</Text>
            </View>
          )}
        </View>

        {!isCancelado && reserva.posicao_fila && (
          <View style={styles.queueCard}>
            <View style={styles.queueIcon}>
              <Text style={{ fontSize: 24 }}>⏳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.queueTitle}>Você é o {reserva.posicao_fila}º da fila</Text>
              <Text style={styles.queueDesc}>Chegue 10 minutos antes do seu horário ({reserva.hora_agendamento.substring(0,5)}).</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que está incluso</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoHighlight}>{reserva.servico?.nome}</Text>
            <Text style={styles.infoNormal}>{reserva.servico?.descricao}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duração Estimada:</Text>
              <Text style={styles.infoData}>{reserva.servico?.duracao_minutos} minutos</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Valor Pago:</Text>
              <Text style={[styles.infoData, { color: COLORS.primary }]}>R$ {reserva.valor_final?.toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localização</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoHighlight}>{reserva.estabelecimento?.nome}</Text>
            <Text style={styles.infoNormal}>{reserva.estabelecimento?.rua}, {reserva.estabelecimento?.numero}</Text>
            <Text style={styles.infoNormal}>{reserva.estabelecimento?.bairro} - {reserva.estabelecimento?.cidade}/{reserva.estabelecimento?.estado}</Text>
            
            <TouchableOpacity style={styles.actionButtonLight} onPress={abrirMapa}>
              <Ionicons name="map-outline" size={18} color={COLORS.secondary} />
              <Text style={styles.actionButtonLightText}>Abrir no Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.downloadButton} onPress={handleBaixarComprovante} disabled={processando}>
            {processando ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Ionicons name="document-text-outline" size={20} color={COLORS.white} />
                <Text style={styles.downloadButtonText}>Baixar Comprovante</Text>
              </>
            )}
          </TouchableOpacity>

          {podeCancelar && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelar} disabled={processando}>
              <Text style={styles.cancelButtonText}>Cancelar Reserva</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },

  // Status & PIN Banner
  statusCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  bgPrimary: { backgroundColor: COLORS.secondary },
  bgError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusText: { fontSize: 12, fontWeight: '800', color: COLORS.gray, letterSpacing: 1 },
  badge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  pinContainer: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pinLabel: { fontSize: 10, fontWeight: '700', color: COLORS.gray, letterSpacing: 1.5, marginBottom: 8 },
  pinValue: { fontSize: 40, fontWeight: '900', color: COLORS.white, letterSpacing: 6, marginBottom: 8 },
  pinDesc: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // Queue Card
  queueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: 20, borderRadius: 20, marginBottom: 24 },
  queueIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  queueTitle: { fontSize: 16, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  queueDesc: { fontSize: 12, color: '#9A3412', fontWeight: '500' },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 16, letterSpacing: -0.5 },
  infoBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  infoHighlight: { fontSize: 16, fontWeight: '900', color: COLORS.secondary, marginBottom: 8 },
  infoNormal: { fontSize: 14, color: COLORS.gray, marginBottom: 4, lineHeight: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  infoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  infoData: { fontSize: 14, fontWeight: '900', color: COLORS.secondary },

  actionButtonLight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  actionButtonLightText: { marginLeft: 8, fontSize: 14, fontWeight: '800', color: COLORS.secondary },

  // Bottom Actions
  actionsContainer: { marginTop: 10, gap: 12 },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, paddingVertical: 16, borderRadius: 16 },
  downloadButtonText: { marginLeft: 8, fontSize: 15, fontWeight: '900', color: COLORS.white },
  
  cancelButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16 },
  cancelButtonText: { fontSize: 15, fontWeight: '900', color: COLORS.error },
});