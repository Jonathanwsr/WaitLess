import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform,
  Linking,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Cores extraídas do design
const COLORS = {
  primary: '#FF5A00', // Laranja Lokyva
  primaryLight: '#FFF5F0',
  primaryOutline: '#FFEAE0',
  whatsapp: '#00BFA5', // Verde WhatsApp
  whatsappLight: '#E6F9F5',
  background: '#FFFFFF',
  textDark: '#1F2937',
  textGray: '#6B7280',
  textLight: '#9CA3AF',
  border: '#F3F4F6',
  white: '#FFFFFF',
};

export default function TelaSuporte() {
  const router = useRouter();

  // Funções de ação (Deep Links)
  const handleEmail = () => {
    Linking.openURL('mailto:suporte@lokyva.com').catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o app de e-mail.');
    });
  };

  const handleWhatsApp = () => {
    Linking.openURL('whatsapp://send?phone=5511999999999').catch(() => {
      Alert.alert('Erro', 'O WhatsApp não está instalado no seu dispositivo.');
    });
  };

  const handleTelefone = () => {
    Linking.openURL('tel:08000000000').catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o discador.');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suporte</Text>
        <View style={{ width: 24 }} /> {/* Espaçador invisível para centralizar o título */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Estamos prontos para{'\n'}ajudar você.</Text>
            <Text style={styles.heroSubtitle}>Respostas em horário comercial.</Text>
          </View>
          
          <View style={styles.heroGraphic}>
            <View style={styles.circleGraphic} />
            <Feather name="headphones" size={28} color={COLORS.textDark} style={styles.iconGraphic} />
            <View style={styles.dotGraphicRight} />
            <View style={styles.dotGraphicLeft} />
          </View>
        </View>

        {/* BANNER INTRODUTÓRIO */}
        <View style={styles.introBanner}>
          <View style={styles.introIconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.introTextContainer}>
            <Text style={styles.introTitle}>Como podemos ajudar?</Text>
            <Text style={styles.introText}>
              Caso tenha dúvidas sobre reservas, pagamentos, estornos ou sua conta,
            </Text>
          </View>
        </View>

        {/* CARD PRINCIPAL DE CONTATOS */}
        <View style={styles.contactCard}>
          
          {/* E-mail */}
          <View style={styles.contactItem}>
            <View style={styles.iconContainer}>
              <Feather name="mail" size={20} color={COLORS.textDark} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>E-mail</Text>
              <Text style={styles.contactValuePrimary}>suporte@lokyva.com</Text>
              <Text style={styles.contactSub}>Atendimento{'\n'}em até 24{'\n'}horas úteis.</Text>
            </View>
            <TouchableOpacity style={styles.actionButtonPrimary} onPress={handleEmail}>
              <Text style={styles.actionButtonText}>Enviar E-mail</Text>
            </TouchableOpacity>
            <Feather name="chevron-right" size={16} color={COLORS.textLight} style={styles.chevron} />
          </View>

          <View style={styles.divider} />

          {/* WhatsApp */}
          <View style={styles.contactItem}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.whatsappLight }]}>
              <MaterialCommunityIcons name="whatsapp" size={22} color={COLORS.whatsapp} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={[styles.contactValuePrimary, { color: COLORS.whatsapp }]}>
                (11){'\n'}99999-{'\n'}9999
              </Text>
              <Text style={styles.contactSub}>Resposta rápida{'\n'}durante o{'\n'}horário comercial.</Text>
            </View>
            <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: COLORS.whatsapp }]} onPress={handleWhatsApp}>
              <Text style={styles.actionButtonText}>Conversar no WhatsApp</Text>
            </TouchableOpacity>
            <Feather name="chevron-right" size={16} color={COLORS.textLight} style={styles.chevron} />
          </View>

          <View style={styles.divider} />

          {/* Telefone */}
          <View style={styles.contactItem}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.primaryLight }]}>
              <Feather name="phone" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Telefone</Text>
              <Text style={styles.contactValuePrimary}>0800 000{'\n'}0000</Text>
              <Text style={styles.contactSub}>Segunda a Sexta{'\n'}08:00 às 18:00</Text>
            </View>
            <TouchableOpacity style={styles.actionButtonPrimary} onPress={handleTelefone}>
              <Text style={styles.actionButtonText}>Ligar Agora</Text>
            </TouchableOpacity>
            <Feather name="chevron-right" size={16} color={COLORS.textLight} style={styles.chevron} />
          </View>

        </View>

        {/* CARD PERGUNTAS FREQUENTES */}
        <View style={styles.faqCard}>
          <View style={styles.iconContainer}>
            <Feather name="book-open" size={20} color={COLORS.textDark} />
          </View>
          <View style={styles.faqInfo}>
            <Text style={styles.contactLabel}>Perguntas{'\n'}Frequentes</Text>
            <Text style={styles.faqSub}>Encontre respostas{'\n'}para as dúvidas{'\n'}mais comuns.</Text>
          </View>
          <TouchableOpacity style={styles.actionButtonOutline}>
            <Text style={styles.actionButtonOutlineText}>Abrir Central de Ajuda</Text>
            <Feather name="chevron-right" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* CARD HORÁRIOS */}
        <View style={styles.hoursCard}>
          <View style={styles.hoursHeader}>
            <Feather name="clock" size={18} color={COLORS.textDark} />
            <Text style={styles.hoursTitle}>Horário de Atendimento</Text>
          </View>
          
          <View style={styles.hourRow}>
            <View style={styles.hourDayInfo}>
              <Feather name="calendar" size={14} color={COLORS.textGray} />
              <Text style={styles.hourDay}>Segunda a Sexta</Text>
            </View>
            <Text style={styles.hourTime}>08:00 às 18:00</Text>
          </View>

          <View style={styles.hourRow}>
            <View style={styles.hourDayInfo}>
              <Feather name="calendar" size={14} color={COLORS.textGray} />
              <Text style={styles.hourDay}>Sábado</Text>
            </View>
            <Text style={styles.hourTime}>08:00 às 12:00</Text>
          </View>

          <View style={styles.hourRow}>
            <View style={styles.hourDayInfo}>
              <Feather name="calendar" size={14} color={COLORS.textGray} />
              <Text style={styles.hourDay}>Domingos e Feriados</Text>
            </View>
            <Text style={styles.hourTime}>Fechado</Text>
          </View>
        </View>

        {/* FOOTER INFO */}
        <View style={styles.footerInfo}>
          <View style={styles.logoInfo}>
            <View style={styles.miniLogo}>
              <Text style={styles.miniLogoText}>L</Text>
            </View>
            <Text style={styles.versionText}>Lokyva v1.0.0</Text>
          </View>
          <Text style={styles.footerLinks}>Política de Privacidade  |  Termos de Uso</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: COLORS.background
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Hero Section
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 20
  },
  heroTexts: { flex: 1, justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, lineHeight: 28 },
  heroSubtitle: { fontSize: 12, color: COLORS.textGray, marginTop: 6 },
  
  heroGraphic: { width: 80, height: 80, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  circleGraphic: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, top: 0, right: 0 },
  iconGraphic: { position: 'absolute' },
  dotGraphicRight: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, right: 0, top: 10 },
  dotGraphicLeft: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#FCD34D', left: 10, top: 30 },

  // Intro Banner
  introBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: -10, // Para dar a sensação de sobreposição com o card abaixo
    paddingBottom: 26,
    zIndex: 0
  },
  introIconContainer: { marginRight: 12, marginTop: 2 },
  introTextContainer: { flex: 1 },
  introTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  introText: { fontSize: 12, color: COLORS.textGray, lineHeight: 18 },

  // Main Contact Card
  contactCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 1,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  contactItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  iconContainer: { 
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: COLORS.background, 
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', 
    marginRight: 12 
  },
  contactInfo: { flex: 1, paddingRight: 8 },
  contactLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  contactValuePrimary: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 4, lineHeight: 18 },
  contactSub: { fontSize: 11, color: COLORS.textGray, lineHeight: 16 },
  
  actionButtonPrimary: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignSelf: 'center' 
  },
  actionButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  chevron: { alignSelf: 'center', marginLeft: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // FAQ Card
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24
  },
  faqInfo: { flex: 1 },
  faqSub: { fontSize: 11, color: COLORS.textGray, lineHeight: 16, marginTop: 4 },
  actionButtonOutline: { 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: COLORS.primaryOutline, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignSelf: 'center' 
  },
  actionButtonOutlineText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  // Hours Card
  hoursCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 32
  },
  hoursHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hoursTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginLeft: 8 },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hourDayInfo: { flexDirection: 'row', alignItems: 'center' },
  hourDay: { fontSize: 13, color: COLORS.textGray, marginLeft: 8 },
  hourTime: { fontSize: 13, color: COLORS.textDark, fontWeight: '500' },

  // Footer
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoInfo: { flexDirection: 'row', alignItems: 'center' },
  miniLogo: { width: 20, height: 20, borderRadius: 4, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  miniLogoText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  versionText: { fontSize: 11, color: COLORS.textGray },
  footerLinks: { fontSize: 11, color: COLORS.textGray }
});