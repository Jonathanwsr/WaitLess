import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform,
  Image,
  TextInput,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF4500', // Laranja avermelhado da imagem
  primaryLight: '#FFF0ED',
  background: '#F9FAFB',
  white: '#FFFFFF',
  textDark: '#111827',
  textGray: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  success: '#10B981', // Verde do botão extra
  warning: '#F59E0B'
};

export default function ExplorarDetalhes() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams();

  // Estados de Processamento
  const [processando, setProcessando] = useState(false);

  // Estados do Formulário baseados na nova UI
  const [localRetirada, setLocalRetirada] = useState('estabelecimento');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState('jeep');
  const [termosAceitos, setTermosAceitos] = useState(false);

  // Dados Mockados para manter a estrutura do visual
  const resumoReserva = {
    diarias: 3,
    veiculo: 'Jeep Compass',
    total: 389.70
  };

  const handleConfirmar = async () => {
    if (!termosAceitos) {
      Alert.alert("Atenção", "Você precisa aceitar os termos de uso e política de privacidade.");
      return;
    }

    setProcessando(true);

    try {
      // Simulação de processamento da API
      setTimeout(() => {
        setProcessando(false);
        Alert.alert("Quase lá!", "Você será redirecionado para o ambiente seguro de pagamento.", [
          { 
            text: "Pagar Agora", 
            onPress: () => router.push('/agendamentos') 
          }
        ]);
      }, 1500);
    } catch (error) {
      setProcessando(false);
      Alert.alert("Ops!", "Ocorreu um erro ao processar sua solicitação.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Criar reserva</Text>
        </View>
        <View style={{ width: 24 }} /> {/* Espaçador */}
      </View>
      <Text style={styles.headerSubtitle}>Preencha os detalhes para fazer sua reserva.</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* CARD DO ESTABELECIMENTO */}
        <View style={styles.storeCard}>
          <View style={styles.storeImageContainer}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=300&auto=format&fit=crop' }} 
              style={styles.storeImage} 
            />
            <View style={styles.badgeReserva}>
              <Text style={styles.badgeReservaText}>Reserva</Text>
            </View>
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>Auto Reserva</Text>
            <Text style={styles.storeType}>Locadora de veículos</Text>
            
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.warning} />
              <Text style={styles.ratingValue}>4,8</Text>
              <Text style={styles.ratingCount}>(829 avaliações)</Text>
            </View>

            <View style={styles.tagsRow}>
              <View style={styles.tag}><Text style={styles.tagText}>Econômico</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>SUVs</Text></View>
              <View style={styles.tag}><Text style={styles.tagText}>Premium</Text></View>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>A partir de</Text>
              <Text style={styles.priceValue}>R$ 129,90<Text style={styles.priceUnit}>/dia</Text></Text>
              <Text style={styles.freePickupText}>Retirada grátis</Text>
            </View>
          </View>
        </View>

        {/* DETALHES DO VEÍCULO PRINCIPAL */}
        <View style={styles.vehicleDetails}>
          <Text style={styles.vehicleCategory}>SUV • Automático • 5 lugares</Text>
          <Text style={styles.vehicleName}>Jeep Compass</Text>
          
          <View style={styles.tagsRowVehicle}>
            <View style={styles.tagVehicle}><Text style={styles.tagText}>Econômica</Text></View>
            <View style={styles.tagVehicle}><Text style={styles.tagText}>SUVs</Text></View>
            <View style={styles.tagVehicle}><Text style={styles.tagText}>Premium</Text></View>
          </View>

          <View style={styles.featuresGrid}>
            <View style={styles.featureItem}>
              <Feather name="shopping-bag" size={14} color={COLORS.textGray} />
              <Text style={styles.featureText}>2 malas grandes</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="bluetooth" size={14} color={COLORS.textGray} />
              <Text style={styles.featureText}>Bluetooth</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="snow-outline" size={14} color={COLORS.textGray} />
              <Text style={styles.featureText}>Ar-condicionado</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="shield" size={14} color={COLORS.textGray} />
              <Text style={styles.featureText}>Seguro incluso</Text>
            </View>
          </View>
          
          <View style={styles.vehicleRating}>
            <Ionicons name="star" size={16} color={COLORS.warning} />
            <Text style={styles.vehicleRatingValue}>4,8</Text>
          </View>
        </View>

        {/* 1. DATA E HORÁRIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Escolha a data e horário</Text>
          
          <View style={styles.rowInputs}>
            <View style={styles.inputBoxHalf}>
              <Text style={styles.inputLabel}>Data de retirada</Text>
              <View style={styles.inputField}>
                <Feather name="calendar" size={16} color={COLORS.textGray} />
                <View style={styles.inputTextContainer}>
                  <Text style={styles.inputValue}>24/05/2025</Text>
                  <Text style={styles.inputSub}>Sábado</Text>
                </View>
                <Feather name="chevron-down" size={16} color={COLORS.primary} />
              </View>
            </View>

            <View style={styles.inputBoxHalf}>
              <Text style={styles.inputLabel}>Horário de retirada</Text>
              <View style={styles.inputField}>
                <Feather name="clock" size={16} color={COLORS.textGray} />
                <View style={styles.inputTextContainer}>
                  <Text style={styles.inputValue}>10:00</Text>
                </View>
                <Feather name="chevron-down" size={16} color={COLORS.primary} />
              </View>
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputBoxHalf}>
              <Text style={styles.inputLabel}>Data de devolução</Text>
              <View style={styles.inputField}>
                <Feather name="calendar" size={16} color={COLORS.textGray} />
                <View style={styles.inputTextContainer}>
                  <Text style={styles.inputValue}>27/05/2025</Text>
                  <Text style={styles.inputSub}>Terça-feira</Text>
                </View>
                <Feather name="chevron-down" size={16} color={COLORS.primary} />
              </View>
            </View>

            <View style={styles.inputBoxHalf}>
              <Text style={styles.inputLabel}>Horário de devolução</Text>
              <View style={styles.inputField}>
                <Feather name="clock" size={16} color={COLORS.textGray} />
                <View style={styles.inputTextContainer}>
                  <Text style={styles.inputValue}>10:00</Text>
                </View>
                <Feather name="chevron-down" size={16} color={COLORS.primary} />
              </View>
            </View>
          </View>

          <View style={styles.alertBox}>
            <Feather name="clock" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.alertText}>Período selecionado: 3 diárias</Text>
          </View>
        </View>

        {/* 2. LOCAL DE RETIRADA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Local de retirada e devolução</Text>
          
          <TouchableOpacity 
            style={[styles.radioCard, localRetirada === 'estabelecimento' && styles.radioCardSelected]}
            onPress={() => setLocalRetirada('estabelecimento')}
          >
            <View style={styles.radioIconContainer}>
              <View style={[styles.radioCircle, localRetirada === 'estabelecimento' && styles.radioCircleSelected]}>
                {localRetirada === 'estabelecimento' && <View style={styles.radioDot} />}
              </View>
            </View>
            <View style={styles.radioTextContainer}>
              <Text style={styles.radioTitle}>Retirar no estabelecimento</Text>
              <Text style={styles.radioDesc}>Auto Reserva - Av. Paulista, 1000. São Paulo - SP</Text>
            </View>
            <Feather name="chevron-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.radioCard, localRetirada === 'endereco' && styles.radioCardSelected]}
            onPress={() => setLocalRetirada('endereco')}
          >
            <View style={styles.radioIconContainer}>
              <View style={[styles.radioCircle, localRetirada === 'endereco' && styles.radioCircleSelected]}>
                {localRetirada === 'endereco' && <View style={styles.radioDot} />}
              </View>
            </View>
            <View style={styles.radioTextContainer}>
              <Text style={styles.radioTitle}>Entrega no endereço</Text>
              <Text style={styles.radioDesc}>Informe um endereço para entrega do veículo</Text>
            </View>
            <Feather name="chevron-right" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* 3. ESCOLHA O VEÍCULO (OPCIONAL) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Escolha o veículo <Text style={styles.optionalText}>(opcional)</Text></Text>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {/* Card 1 */}
            <TouchableOpacity 
              style={[styles.vehicleChoiceCard, veiculoSelecionado === 'jeep' && styles.vehicleChoiceCardSelected]}
              onPress={() => setVeiculoSelecionado('jeep')}
            >
              <Image source={{ uri: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=300&auto=format&fit=crop' }} style={styles.vehicleChoiceImage} />
              {veiculoSelecionado === 'jeep' && (
                <View style={styles.checkBadge}><Feather name="check" size={10} color={COLORS.white} /></View>
              )}
              <View style={styles.vehicleChoiceInfo}>
                <Text style={styles.vehicleChoiceTitle}>Jeep Compass</Text>
                <Text style={styles.vehicleChoiceSub}>SUVs Automático</Text>
                <Text style={styles.vehicleChoicePrice}>R$ 129,90 <Text style={styles.priceUnit}>/ dia</Text></Text>
              </View>
            </TouchableOpacity>

            {/* Card 2 */}
            <TouchableOpacity 
              style={[styles.vehicleChoiceCard, veiculoSelecionado === 'fiat' && styles.vehicleChoiceCardSelected]}
              onPress={() => setVeiculoSelecionado('fiat')}
            >
              <Image source={{ uri: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=300&auto=format&fit=crop' }} style={styles.vehicleChoiceImage} />
              {veiculoSelecionado === 'fiat' && (
                <View style={styles.checkBadge}><Feather name="check" size={10} color={COLORS.white} /></View>
              )}
              <View style={styles.vehicleChoiceInfo}>
                <Text style={styles.vehicleChoiceTitle}>Fiat Pulse</Text>
                <Text style={styles.vehicleChoiceSub}>SUVs Automático</Text>
                <Text style={styles.vehicleChoicePrice}>R$ 119,90 <Text style={styles.priceUnit}>/ dia</Text></Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={styles.btnAddExtra}>
            <Feather name="plus-circle" size={16} color={COLORS.white} />
            <Text style={styles.btnAddExtraText}>Quer acrescentar ao pedido</Text>
          </TouchableOpacity>
        </View>

        {/* 4. INFORMAÇÕES DO CONDUTOR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Informações do condutor</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Nome completo</Text>
            <View style={styles.formInputContainer}>
              <Feather name="user" size={18} color={COLORS.textLight} />
              <TextInput style={styles.formInput} placeholder="Digite seu nome completo" placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>CPF</Text>
              <View style={styles.formInputContainer}>
                <MaterialCommunityIcons name="card-account-details-outline" size={18} color={COLORS.textLight} />
                <TextInput style={styles.formInput} placeholder="000.000.000-00" placeholderTextColor={COLORS.textLight} keyboardType="numeric" />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Data de nascimento</Text>
              <View style={styles.formInputContainer}>
                <Feather name="calendar" size={18} color={COLORS.textLight} />
                <TextInput style={styles.formInput} placeholder="dd/mm/aaaa" placeholderTextColor={COLORS.textLight} />
                <Feather name="chevron-down" size={16} color={COLORS.textLight} />
              </View>
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <View style={styles.formInputContainer}>
                <Feather name="mail" size={18} color={COLORS.textLight} />
                <TextInput style={styles.formInput} placeholder="seu@email.com" placeholderTextColor={COLORS.textLight} keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Celular</Text>
              <View style={styles.formInputContainer}>
                <Feather name="phone" size={18} color={COLORS.textLight} />
                <TextInput style={styles.formInput} placeholder="(11) 99999-9999" placeholderTextColor={COLORS.textLight} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setTermosAceitos(!termosAceitos)}>
            <View style={[styles.checkbox, termosAceitos && styles.checkboxSelected]}>
              {termosAceitos && <Feather name="check" size={12} color={COLORS.white} />}
            </View>
            <Text style={styles.checkboxText}>
              Li e concordo com os <Text style={styles.linkText}>termos de uso</Text> e <Text style={styles.linkText}>política de privacidade</Text>.
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* RODAPÉ FIXO DE CHECKOUT */}
      <View style={styles.footer}>
        <View style={styles.footerInfoRow}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerLabel}>Resumo da reserva</Text>
            <Text style={styles.footerDesc}>{resumoReserva.diarias} diárias + {resumoReserva.veiculo}</Text>
            <Text style={styles.footerSubText}>24/05/2025 (10:00) até 27/05/2025 (10:00)</Text>
          </View>
          <View style={styles.footerTotalBox}>
            <Text style={styles.footerLabel}>Total estimado</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.footerTotalValue}>R$ {resumoReserva.total.toFixed(2).replace('.', ',')}</Text>
              <Feather name="chevron-down" size={16} color={COLORS.primary} style={{ marginLeft: 4 }} />
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.botaoPrincipal, processando && styles.botaoDesabilitado]} 
          onPress={handleConfirmar}
          disabled={processando}
        >
          {processando ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.botaoPrincipalTexto}>Continuar para pagamento</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
    backgroundColor: COLORS.white
  },
  backButton: { padding: 4 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  headerSubtitle: { 
    fontSize: 13, 
    color: COLORS.textGray, 
    textAlign: 'center', 
    backgroundColor: COLORS.white, 
    paddingBottom: 16 
  },
  
  scrollContent: { padding: 16, paddingBottom: 160 },
  
  // Card Estabelecimento
  storeCard: { 
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    padding: 12, 
    flexDirection: 'row', 
    marginBottom: 16,
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  storeImageContainer: { position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden' },
  storeImage: { width: '100%', height: '100%' },
  badgeReserva: { 
    position: 'absolute', 
    top: 0, left: 0, 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 6, paddingVertical: 2, 
    borderBottomRightRadius: 8 
  },
  badgeReservaText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  storeInfo: { flex: 1, marginLeft: 12 },
  storeName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  storeType: { fontSize: 12, color: COLORS.textGray, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingValue: { fontSize: 12, fontWeight: '700', marginLeft: 4, color: COLORS.textDark },
  ratingCount: { fontSize: 12, color: COLORS.textGray, marginLeft: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  tagText: { fontSize: 10, color: COLORS.textDark, fontWeight: '500' },
  priceRow: { marginTop: 'auto' },
  priceLabel: { fontSize: 10, color: COLORS.textGray },
  priceValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  priceUnit: { fontSize: 12, color: COLORS.textGray, fontWeight: '400' },
  freePickupText: { fontSize: 10, color: COLORS.textGray, marginTop: 2 },

  // Veículo Detalhes
  vehicleDetails: { marginBottom: 24, paddingHorizontal: 4 },
  vehicleCategory: { fontSize: 12, color: COLORS.textGray, marginBottom: 4 },
  vehicleName: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  tagsRowVehicle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tagVehicle: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  featureItem: { width: '45%', flexDirection: 'row', alignItems: 'center' },
  featureText: { fontSize: 12, color: COLORS.textGray, marginLeft: 6 },
  vehicleRating: { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  vehicleRatingValue: { fontSize: 14, fontWeight: '700', marginLeft: 4 },

  // Sections Base
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },
  optionalText: { fontSize: 14, color: COLORS.textGray, fontWeight: '400' },
  seeAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // 1. Data e Horário
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  inputBoxHalf: { flex: 1 },
  inputLabel: { fontSize: 10, color: COLORS.textGray, marginBottom: 4, marginLeft: 4 },
  inputField: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderWidth: 1, borderColor: COLORS.border, 
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 
  },
  inputTextContainer: { flex: 1, marginLeft: 8 },
  inputValue: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  inputSub: { fontSize: 11, color: COLORS.textGray },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 8, marginTop: 4 },
  alertText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  // 2. Radio Buttons Local
  radioCard: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, 
    borderRadius: 8, padding: 16, marginBottom: 12 
  },
  radioCardSelected: { borderColor: COLORS.primary },
  radioIconContainer: { marginRight: 12 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textLight, alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  radioTextContainer: { flex: 1 },
  radioTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginBottom: 2 },
  radioDesc: { fontSize: 12, color: COLORS.textGray },

  // 3. Escolha o veículo
  horizontalScroll: { paddingBottom: 16, gap: 12 },
  vehicleChoiceCard: { 
    width: 240, backgroundColor: COLORS.white, 
    borderWidth: 1, borderColor: COLORS.border, 
    borderRadius: 8, overflow: 'hidden', position: 'relative' 
  },
  vehicleChoiceCardSelected: { borderColor: COLORS.primary },
  vehicleChoiceImage: { width: '100%', height: 100 },
  checkBadge: { 
    position: 'absolute', top: 8, right: 8, 
    width: 20, height: 20, borderRadius: 10, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center', justifyContent: 'center' 
  },
  vehicleChoiceInfo: { padding: 12 },
  vehicleChoiceTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  vehicleChoiceSub: { fontSize: 11, color: COLORS.textGray, marginBottom: 8 },
  vehicleChoicePrice: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  btnAddExtra: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    backgroundColor: COLORS.success, borderRadius: 8, padding: 14, marginTop: 8 
  },
  btnAddExtraText: { color: COLORS.white, fontWeight: '700', fontSize: 14, marginLeft: 8 },

  // 4. Form Info Condutor
  formGroup: { marginBottom: 12 },
  formInputContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderWidth: 1, borderColor: COLORS.border, 
    borderRadius: 8, paddingHorizontal: 12, height: 44 
  },
  formInput: { flex: 1, marginLeft: 8, fontSize: 13, color: COLORS.textDark },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingHorizontal: 4 },
  checkbox: { 
    width: 18, height: 18, borderRadius: 4, 
    borderWidth: 1, borderColor: COLORS.border, 
    alignItems: 'center', justifyContent: 'center', 
    marginRight: 10, backgroundColor: COLORS.white, marginTop: 2 
  },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxText: { flex: 1, fontSize: 12, color: COLORS.textGray, lineHeight: 18 },
  linkText: { color: COLORS.primary, fontWeight: '500' },

  // Footer Fixo
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: COLORS.white, 
    borderTopWidth: 1, borderTopColor: COLORS.border, 
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 
  },
  footerInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  footerSummary: { flex: 1, paddingRight: 16 },
  footerLabel: { fontSize: 11, color: COLORS.textGray, marginBottom: 2 },
  footerDesc: { fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 2 },
  footerSubText: { fontSize: 10, color: COLORS.textLight },
  footerTotalBox: { alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: COLORS.border, paddingLeft: 16 },
  footerTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  
  botaoPrincipal: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  botaoDesabilitado: { backgroundColor: COLORS.textLight },
  botaoPrincipalTexto: { color: COLORS.white, fontSize: 15, fontWeight: '700' }
});