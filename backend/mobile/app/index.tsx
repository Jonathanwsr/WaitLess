import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TelaEntrada() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Hero Image */}
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
        style={styles.heroImage}
      />

      {/* Conteúdo principal */}
      <View style={styles.contentContainer}>
        {/* Header com Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>W</Text>
          </View>
          <View>
            <Text style={styles.title}>Waitless</Text>
            <Text style={styles.subtitle}>Reserve mais. Espere menos.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Como você deseja acessar?</Text>

        {/* Cards Modernos */}
        <View style={styles.cardsRow}>
          <TouchableOpacity style={styles.card} activeOpacity={0.85}>
            <View style={styles.cardIconContainer}>
              <FontAwesome5 name="user-alt" size={28} color="#FF6B35" />
            </View>
            <Text style={styles.cardTitle}>Cliente</Text>
            <Text style={styles.cardSubtitle}>Faça reservas e aproveite os serviços</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} activeOpacity={0.85}>
            <View style={styles.cardIconContainer}>
              <FontAwesome5 name="briefcase" size={28} color="#FF6B35" />
            </View>
            <Text style={styles.cardTitle}>Prestador</Text>
            <Text style={styles.cardSubtitle}>Gerencie sua equipe e filas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        {/* Botões de Ação */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.push('/autenticacao/login')}
          >
            <Text style={styles.primaryButtonText}>Entrar na minha conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => router.push('/autenticacao/cadastro')}
          >
            <Text style={styles.secondaryButtonText}>Criar nova conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  heroImage: {
    width: '100%',
    height: 460,
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
  },
  contentContainer: {
    flex: 1,
    marginTop: 320,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F1F1F',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15.5,
    color: '#666666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 20,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: '#777777',
  },
  spacer: {
    flex: 1,
    minHeight: 30,
  },
  actionContainer: {
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    borderColor: '#E5E5E5',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1F1F1F',
    fontSize: 17,
    fontWeight: '600',
  },
});