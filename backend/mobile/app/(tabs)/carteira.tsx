import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// --- TIPAGENS ---
interface FaturaDetalhes {
  valor: number;
  ciclo: string;
  metodo?: string;
  status_pagamento?: string;
}

interface SubscriptionData {
  plano_atual: string;
  status_acesso: 'ativo' | 'inativo';
  expira_em: string;
  dias_restantes: number;
  detalhes_fatura: FaturaDetalhes | null;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  precoMensal: number;
  cor: string;
  icon: IoniconName;
  destaque?: string;
  beneficios: string[];
}

interface CatalogoPlanos {
  [key: string]: Plano;
}

// --- CONFIGURAÇÃO DOS PLANOS ---
const CATALOGO_PLANOS: CatalogoPlanos = {
  cliente: {
    id: 'cliente_flex', // Ajustado para bater com o catálogo do seu backend
    nome: 'Cliente',
    descricao: 'Para quem busca e reserva os melhores serviços e experiências.',
    precoMensal: 14.90,
    cor: '#FF5500',
    icon: 'person-outline',
    beneficios: [
      'Faz reservas e agendamentos',
      'Acesso a ofertas exclusivas',
      'Acumula pontos',
      'Suporte prioritário',
    ],
  },
  proprietario: {
    id: 'proprietario',
    nome: 'Proprietário',
    descricao: 'Para quem anuncia e gerencia suas propriedades ou estabelecimentos.',
    precoMensal: 25.00,
    cor: '#8B5CF6',
    icon: 'home-outline',
    destaque: 'MAIS ESCOLHIDO',
    beneficios: [
      'Anuncia propriedades',
      'Gerencia reservas',
      'Calendário de disponibilidade',
      'Relatórios de desempenho',
      'Suporte prioritário',
    ],
  },
  full: {
    id: 'socio_mensal', // Ajustado para bater com o catálogo do seu backend
    nome: 'Sócio Full',
    descricao: 'A solução completa para gerenciar e impulsionar seu negócio.',
    precoMensal: 50.00,
    cor: '#10B981',
    icon: 'ribbon-outline',
    beneficios: [
      'Todos os benefícios do plano Proprietário',
      'Destaque nas buscas',
      'Campanhas e cupons',
      'Analíticos avançados',
      'Suporte dedicado',
    ],
  },
};

export default function CarteiraScreen() {
  // --- ESTADOS ---
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Simulação do Usuário Logado
  const [userRole, setUserRole] = useState<'cliente' | 'proprietario' | 'admin'>('cliente'); 
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);

  // Estados do Fluxo de Assinatura
  const [step, setStep] = useState<'CATALOG' | 'CHECKOUT'>('CATALOG');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('cliente');
  const [selectedCycle, setSelectedCycle] = useState<'mensal' | 'trimestral' | 'semestral'>('mensal');
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'boleto'>('credit_card');

  // Formulário do Cartão
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [cardName, setCardName] = useState<string>('');

  // --- CARREGAR STATUS DA ASSINATURA DA API ---
  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/assinaturas/status`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const json = await res.json();
      
      if (res.ok && json.status === 'success') {
        setSubscriptionData(json.data);
      } else {
        // Fallback state caso ainda não tenha assinatura
        setSubscriptionData({
          plano_atual: 'gratuito',
          status_acesso: 'inativo',
          expira_em: '',
          dias_restantes: 0,
          detalhes_fatura: null
        });
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as informações do plano.');
    } finally {
      setLoading(false);
    }
  };

  // --- CANCELAR ASSINATURA NA API ---
  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancelar Assinatura',
      'Tem certeza que deseja cancelar? Você continuará com acesso até o fim do período pago.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const token = await AsyncStorage.getItem('@waitless_token');
              const res = await fetch(`${API_URL}/assinaturas/cancelar`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });
              const json = await res.json();

              if (res.ok) {
                Alert.alert('Sucesso', json.message || 'Sua assinatura foi cancelada.');
                fetchSubscriptionStatus();
              } else {
                Alert.alert('Erro', json.message || 'Não foi possível cancelar.');
              }
            } catch (err) {
              Alert.alert('Erro', 'Falha de comunicação com o servidor.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // --- PROCESSAR PAGAMENTO / ASSINAR NA API ---
  const handleConfirmSubscription = async () => {
    if (paymentMethod === 'credit_card' && (!cardNumber || !cardName || !cardExpiry || !cardCvv)) {
      Alert.alert('Atenção', 'Preencha todos os dados do cartão.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      // Mapeia o ID do plano da tela pro ID real do catálogo do Backend
      const currentPlan = CATALOGO_PLANOS[selectedPlanId];
      
      const payload = {
        plano: currentPlan.id, // Envia cliente_flex, proprietario, socio_mensal, etc
        metodo: paymentMethod === 'boleto' ? 'pix' : paymentMethod, // Caso seu backend só tenha validado pix/credit_card
        ciclo: selectedCycle,
      };

      const res = await fetch(`${API_URL}/assinaturas/assinar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();

      if (res.ok) {
        if (data.pix_qr_code) {
          Alert.alert(
            'PIX Gerado', 
            `Copie o código abaixo para pagar:\n\n${data.pix_qr_code}`,
            [{ text: 'Entendi' }]
          );
        } else if (data.link_pagamento) {
          await WebBrowser.openBrowserAsync(data.link_pagamento);
        } else {
          Alert.alert('Sucesso!', data.message || 'Assinatura realizada com sucesso!');
        }
        
        fetchSubscriptionStatus();
        setStep('CATALOG');
      } else {
        Alert.alert('Erro', data.message || 'Falha ao processar assinatura.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha na comunicação com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- CÁLCULO DE VALORES DE ACORDO COM O CICLO ---
  const getCalculatedPrice = (basePrice: number) => {
    if (selectedCycle === 'trimestral') return basePrice * 0.9; // 10% desc
    if (selectedCycle === 'semestral') return basePrice * 0.85; // 15% desc
    return basePrice;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5500" />
      </View>
    );
  }

  // ==========================================
  // 1. USUÁRIO JÁ POSSUI PLANO ATIVO (SITUAÇÃO)
  // ==========================================
  if (subscriptionData?.status_acesso === 'ativo') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.pageTitle}>Minha Assinatura</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.badgeActive}>
                <Text style={styles.badgeActiveText}>PLANO ATIVO</Text>
              </View>
              <Text style={styles.statusDaysLeft}>
                {subscriptionData.dias_restantes} dias restantes
              </Text>
            </View>

            <Text style={styles.statusPlanName}>
              {subscriptionData.plano_atual.toUpperCase()}
            </Text>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                Vencimento em:{' '}
                <Text style={styles.infoBold}>
                  {subscriptionData.expira_em ? new Date(subscriptionData.expira_em).toLocaleDateString('pt-BR') : 'N/A'}
                </Text>
              </Text>
            </View>

            {subscriptionData.detalhes_fatura && (
              <View style={styles.infoRow}>
                <Ionicons name="card-outline" size={20} color="#6B7280" />
                <Text style={styles.infoText}>
                  Valor do Ciclo:{' '}
                  <Text style={styles.infoBold}>
                    R$ {subscriptionData.detalhes_fatura.valor?.toFixed(2)} ({subscriptionData.detalhes_fatura.ciclo})
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancelar Assinatura</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // 2. CHECKOUT / FORMA DE PAGAMENTO (IMAGEM 2)
  // ==========================================
  if (step === 'CHECKOUT') {
    const currentPlan = CATALOGO_PLANOS[selectedPlanId];
    const finalPrice = getCalculatedPrice(currentPlan.precoMensal);

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {/* Header com Voltar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setStep('CATALOG')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Assinar Plano</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.checkoutContainer} showsVerticalScrollIndicator={false}>
          {/* Subheader Segurança */}
          <View style={styles.securityHeader}>
            <Ionicons name="lock-closed-outline" size={16} color="#6B7280" />
            <Text style={styles.securityHeaderText}>Pagamento 100% seguro via Asaas</Text>
          </View>

          {/* Card Resumo Superior */}
          <View style={styles.checkoutPlanCard}>
            <View style={styles.checkoutPlanInfo}>
              <View style={styles.planIconCircle}>
                <Ionicons name={currentPlan.icon} size={24} color="#FF5500" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.planSubtitleText}>Plano selecionado</Text>
                <Text style={styles.planTitleText}>{currentPlan.nome}</Text>
                <Text style={styles.planDescText}>{currentPlan.descricao}</Text>
                <View style={styles.tagMensal}>
                  <Text style={styles.tagMensalText}>
                    {selectedCycle.charAt(0).toUpperCase() + selectedCycle.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.checkoutPriceContainer}>
              <Text style={styles.priceCurrency}>R$ <Text style={styles.priceValue}>{finalPrice.toFixed(2).replace('.', ',')}</Text></Text>
              <Text style={styles.priceSub}>/mês</Text>
            </View>
          </View>

          {/* 1. Escolha o período */}
          <Text style={styles.sectionTitle}>1. Escolha o período</Text>
          <View style={styles.cycleGrid}>
            <TouchableOpacity
              style={[styles.cycleOption, selectedCycle === 'mensal' && styles.cycleOptionSelected]}
              onPress={() => setSelectedCycle('mensal')}
            >
              <Ionicons
                name={selectedCycle === 'mensal' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selectedCycle === 'mensal' ? '#FF5500' : '#9CA3AF'}
              />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.cycleTitle}>Mensal</Text>
                <Text style={styles.cyclePrice}>R$ {currentPlan.precoMensal.toFixed(2).replace('.', ',')}/mês</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cycleOption, selectedCycle === 'trimestral' && styles.cycleOptionSelected]}
              onPress={() => setSelectedCycle('trimestral')}
            >
              <Ionicons
                name={selectedCycle === 'trimestral' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selectedCycle === 'trimestral' ? '#FF5500' : '#9CA3AF'}
              />
              <View style={{ marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.cycleTitle}>Trimestral</Text>
                  <View style={styles.discountBadge}><Text style={styles.discountText}>-10%</Text></View>
                </View>
                <Text style={styles.cyclePrice}>R$ {(currentPlan.precoMensal * 0.9).toFixed(2).replace('.', ',')}/mês</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cycleOption, selectedCycle === 'semestral' && styles.cycleOptionSelected]}
              onPress={() => setSelectedCycle('semestral')}
            >
              <Ionicons
                name={selectedCycle === 'semestral' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selectedCycle === 'semestral' ? '#FF5500' : '#9CA3AF'}
              />
              <View style={{ marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.cycleTitle}>Semestral</Text>
                  <View style={styles.discountBadge}><Text style={styles.discountText}>-15%</Text></View>
                </View>
                <Text style={styles.cyclePrice}>R$ {(currentPlan.precoMensal * 0.85).toFixed(2).replace('.', ',')}/mês</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 2. Forma de pagamento */}
          <Text style={styles.sectionTitle}>2. Forma de pagamento</Text>
          <View style={styles.paymentBox}>
            {/* Cartão de Crédito */}
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('credit_card')}
            >
              <Ionicons name="card-outline" size={24} color="#000" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.paymentOptionTitle}>Cartão de crédito</Text>
                <Text style={styles.paymentOptionSub}>Visa, Mastercard, Elo, American Express</Text>
              </View>
              <Ionicons
                name={paymentMethod === 'credit_card' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={paymentMethod === 'credit_card' ? '#FF5500' : '#9CA3AF'}
              />
            </TouchableOpacity>

            {/* Inputs do Cartão de Crédito */}
            {paymentMethod === 'credit_card' && (
              <View style={styles.cardForm}>
                <Text style={styles.inputLabel}>Dados do cartão</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="numeric"
                  />
                  <Ionicons name="card" size={20} color="#000" />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Validade</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>CVV</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="123"
                        value={cardCvv}
                        onChangeText={setCardCvv}
                        keyboardType="numeric"
                      />
                      <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Nome do titular</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Como está escrito no cartão"
                    value={cardName}
                    onChangeText={setCardName}
                  />
                </View>
              </View>
            )}

            <View style={styles.dividerLight} />

            {/* Pix */}
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('pix')}
            >
              <Ionicons name="qr-code-outline" size={24} color="#000" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.paymentOptionTitle}>Pix</Text>
                <Text style={styles.paymentOptionSub}>Aprovação imediata</Text>
              </View>
              <Ionicons
                name={paymentMethod === 'pix' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={paymentMethod === 'pix' ? '#FF5500' : '#9CA3AF'}
              />
            </TouchableOpacity>

            <View style={styles.dividerLight} />

            {/* Boleto Bancário */}
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('boleto')}
            >
              <Ionicons name="barcode-outline" size={24} color="#000" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.paymentOptionTitle}>Boleto bancário</Text>
                <Text style={styles.paymentOptionSub}>O pagamento pode levar até 3 dias úteis</Text>
              </View>
              <Ionicons
                name={paymentMethod === 'boleto' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={paymentMethod === 'boleto' ? '#FF5500' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>

          {/* Resumo do Pedido */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo do pedido</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plano {currentPlan.nome} ({selectedCycle})</Text>
              <Text style={styles.summaryValue}>R$ {finalPrice.toFixed(2).replace('.', ',')}</Text>
            </View>
            <View style={styles.dividerLight} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {finalPrice.toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>

          {/* Botão de Ação */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleConfirmSubscription}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Confirmar assinatura</Text>
            )}
          </TouchableOpacity>

          {/* Rodapé Legal */}
          <View style={styles.legalFooter}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#6B7280" />
            <Text style={styles.legalText}>
              Ao confirmar, você concorda com nossos{' '}
              <Text style={styles.legalLink}>Termos de Uso</Text> e{' '}
              <Text style={styles.legalLink}>Política de Privacidade</Text>.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // 3. SELEÇÃO DE PLANOS / CATALOGO (IMAGEM 1)
  // ==========================================
  // SE FOR CLIENTE: Mostra apenas o plano Cliente
  const planosExibidos = userRole === 'cliente' 
    ? [CATALOGO_PLANOS.cliente] 
    : Object.values(CATALOGO_PLANOS);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header principal */}
        <View style={styles.catalogHeader}>
          <Text style={styles.catalogTitle}>Planos Waitless</Text>
          <View style={styles.badgeSubHeader}>
            <Ionicons name="star" size={14} color="#FF5500" />
            <Text style={styles.badgeSubHeaderText}>Escolha o plano ideal para você</Text>
          </View>
          <Text style={styles.mainHeading}>Mais benefícios, mais experiências</Text>
          <Text style={styles.subHeading}>Escolha o plano que combina com seu perfil</Text>
        </View>

        {/* Toggle de Ciclo */}
        <View style={styles.cycleToggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedCycle === 'mensal' && styles.toggleBtnActive]}
            onPress={() => setSelectedCycle('mensal')}
          >
            <Text style={[styles.toggleBtnText, selectedCycle === 'mensal' && styles.toggleBtnTextActive]}>
              Mensal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, selectedCycle === 'trimestral' && styles.toggleBtnActive]}
            onPress={() => setSelectedCycle('trimestral')}
          >
            <Text style={[styles.toggleBtnText, selectedCycle === 'trimestral' && styles.toggleBtnTextActive]}>
              Trimestral
            </Text>
            <View style={styles.discountBadge}><Text style={styles.discountText}>-10%</Text></View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, selectedCycle === 'semestral' && styles.toggleBtnActive]}
            onPress={() => setSelectedCycle('semestral')}
          >
            <Text style={[styles.toggleBtnText, selectedCycle === 'semestral' && styles.toggleBtnTextActive]}>
              Semestral
            </Text>
            <View style={styles.discountBadge}><Text style={styles.discountText}>-15%</Text></View>
          </TouchableOpacity>
        </View>

        {/* Lista/Cards de Planos */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsScroll}
        >
          {planosExibidos.map((plano) => {
            const calculatedPrice = getCalculatedPrice(plano.precoMensal);

            return (
              <View
                key={plano.id}
                style={[
                  styles.planCard,
                  plano.destaque ? { borderColor: plano.cor, borderWidth: 2 } : null,
                ]}
              >
                {plano.destaque && (
                  <View style={[styles.highlightTag, { backgroundColor: plano.cor }]}>
                    <Text style={styles.highlightTagText}>{plano.destaque}</Text>
                  </View>
                )}

                <View style={styles.planIconWrapper}>
                  <Ionicons name={plano.icon} size={28} color={plano.cor} />
                </View>

                <Text style={[styles.cardPlanName, { color: plano.cor }]}>{plano.nome}</Text>
                <Text style={styles.cardPlanDesc}>{plano.descricao}</Text>

                <View style={styles.cardPriceRow}>
                  <Text style={styles.cardCurrency}>R$ </Text>
                  <Text style={styles.cardPriceValue}>{calculatedPrice.toFixed(2).replace('.', ',')}</Text>
                  <Text style={styles.cardPriceSub}>/mês</Text>
                </View>
                <Text style={styles.cardPriceOriginal}>
                  R$ {plano.precoMensal.toFixed(2).replace('.', ',')} por mês
                </Text>

                {/* Botão Assinar */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: plano.id === 'cliente' ? '#FFF' : plano.cor },
                    plano.id === 'cliente' ? { borderWidth: 1, borderColor: '#FF5500' } : null,
                  ]}
                  onPress={() => {
                    setSelectedPlanId(plano.id); // Guardamos com o ID original para mapeamento
                    setStep('CHECKOUT');
                  }}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: plano.id === 'cliente' ? '#FF5500' : '#FFF' },
                    ]}
                  >
                    Assinar plano
                  </Text>
                </TouchableOpacity>

                {/* Benefícios */}
                <Text style={[styles.beneficiosHeading, { color: plano.cor }]}>
                  Ideal para você que:
                </Text>

                {plano.beneficios.map((beneficio, idx) => (
                  <View key={idx} style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={plano.cor} />
                    <Text style={styles.benefitText}>{beneficio}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>

        {/* Rodapé de Pagamento Seguro */}
        <View style={styles.secureFooterBanner}>
          <Ionicons name="shield-outline" size={28} color="#FF5500" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.secureFooterTitle}>Pagamento 100% seguro via Asaas</Text>
            <Text style={styles.secureFooterSub}>Seus dados protegidos e privacidade garantida.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// ESTILOS RESPONSIVOS E MODERNOS
// ==========================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { padding: 16, alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // STATUS CARD (Quando Ativo)
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#111827', alignSelf: 'flex-start', marginBottom: 16 },
  statusCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
  },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeActive: { backgroundColor: '#DEF7EC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeActiveText: { color: '#03543F', fontSize: 12, fontWeight: '700' },
  statusDaysLeft: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  statusPlanName: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 12 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  dividerLight: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: '#4B5563' },
  infoBold: { fontWeight: '700', color: '#111827' },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },

  // CHECKOUT
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  backButton: { padding: 4 },
  headerBarTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  checkoutContainer: { padding: 16 },
  securityHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 16 },
  securityHeaderText: { fontSize: 13, color: '#6B7280' },
  
  checkoutPlanCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkoutPlanInfo: { flexDirection: 'row', flex: 1 },
  planIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  planSubtitleText: { fontSize: 12, color: '#6B7280' },
  planTitleText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  planDescText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  tagMensal: { backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
  tagMensalText: { fontSize: 11, color: '#FF5500', fontWeight: '600' },
  checkoutPriceContainer: { alignItems: 'flex-end' },
  priceCurrency: { fontSize: 14, color: '#FF5500', fontWeight: '600' },
  priceValue: { fontSize: 22, fontWeight: '800' },
  priceSub: { fontSize: 12, color: '#6B7280' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 10 },
  cycleGrid: { flexDirection: 'column', gap: 8, marginBottom: 20 },
  cycleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cycleOptionSelected: { borderColor: '#FF5500', backgroundColor: '#FFF7ED' },
  cycleTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cyclePrice: { fontSize: 12, color: '#6B7280' },
  discountBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  discountText: { fontSize: 10, color: '#059669', fontWeight: '700' },

  paymentBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  paymentOptionTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentOptionSub: { fontSize: 12, color: '#6B7280' },

  cardForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#F3F4F6' },
  inputLabel: { fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
  },
  input: { flex: 1, height: 40, fontSize: 14, color: '#111827' },

  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: '#4B5563' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#111827' },

  submitButton: { backgroundColor: '#FF5500', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  legalFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  legalText: { fontSize: 11, color: '#6B7280', textAlign: 'center', lineHeight: 16 },
  legalLink: { color: '#FF5500', fontWeight: '600' },

  // CATALOGO (IMAGEM 1)
  catalogHeader: { alignItems: 'center', marginBottom: 20 },
  catalogTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  badgeSubHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  badgeSubHeaderText: { fontSize: 12, color: '#FF5500', fontWeight: '600' },
  mainHeading: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12, textAlign: 'center' },
  subHeading: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  cycleToggleContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FF5500' },
  toggleBtnText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  toggleBtnTextActive: { color: '#FF5500', fontWeight: '700' },

  cardsScroll: { gap: 16, paddingBottom: 10 },
  planCard: {
    width: 280,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    position: 'relative',
  },
  highlightTag: { position: 'absolute', top: -12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  highlightTagText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  planIconWrapper: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  cardPlanName: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  cardPlanDesc: { fontSize: 12, color: '#6B7280', textAlign: 'center', height: 36 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  cardCurrency: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardPriceValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  cardPriceSub: { fontSize: 12, color: '#6B7280' },
  cardPriceOriginal: { fontSize: 11, color: '#9CA3AF', marginBottom: 16 },

  actionBtn: { width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  actionBtnText: { fontWeight: '700', fontSize: 14 },

  beneficiosHeading: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 10 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 8 },
  benefitText: { fontSize: 12, color: '#4B5563', flex: 1 },

  secureFooterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    marginTop: 20,
  },
  secureFooterTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  secureFooterSub: { fontSize: 12, color: '#6B7280' },
});