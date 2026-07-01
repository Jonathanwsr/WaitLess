import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome5 } from '@expo/vector-icons';

export default function TelaEntrada() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* O ideal é substituir o URI abaixo por um require('./caminho/da/imagem.jpg') do seu projeto */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        {/* Camada de sobreposição para dar o tom laranja/terracota */}
        <View style={styles.overlay}>

          {/* SEÇÃO SUPERIOR: Logo e Textos */}
          <View style={styles.topSection}>
            <Text style={styles.logoIcon}>W</Text>
            <Text style={styles.logoText}>Waitless</Text>
            <Text style={styles.tagline}>Reserve mais. Espere menos.</Text>
          </View>

          {/* SEÇÃO INFERIOR: Botões e Cards */}
          <View style={styles.bottomSection}>

            {/* Botão Entrar */}
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.8}
              onPress={() => router.push('/autenticacao/login')}
            >
              <Feather name="user" size={20} color="#b24b2b" />
              <Text style={styles.primaryButtonText}>Entrar</Text>
            </TouchableOpacity>

            {/* Botão Criar Conta */}
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => router.push('/autenticacao/cadastro')}
            >
              <Feather name="user-plus" size={20} color="#FFF" />
              <Text style={styles.secondaryButtonText}>Criar conta</Text>
            </TouchableOpacity>

            {/* Divisor "ou" */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.questionText}>Como você deseja continuar?</Text>

            {/* Cards de Seleção */}
            <View style={styles.cardsRow}>

              {/* Card Cliente */}
              <TouchableOpacity style={styles.card} activeOpacity={0.8}>
                <View style={styles.cardIconContainer}>
                  <FontAwesome5 name="user-alt" size={20} color="#FFF" />
                </View>
                <Text style={styles.cardTitle}>Sou cliente</Text>
                <Text style={styles.cardSubtitle}>
                  Quero reservar serviços e aproveitar experiências
                </Text>
              </TouchableOpacity>

              {/* Card Prestador */}
              <TouchableOpacity style={styles.card} activeOpacity={0.8}>
                <View style={styles.cardIconContainer}>
                  <FontAwesome5 name="briefcase" size={20} color="#FFF" />
                </View>
                <Text style={styles.cardTitle}>Sou prestador</Text>
                <Text style={styles.cardSubtitle}>
                  Quero oferecer serviços e alcançar mais clientes
                </Text>
              </TouchableOpacity>

            </View>
          </View>

        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#b24b2b',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(189, 65, 33, 0.85)', // Cor sobreposta para o tom da foto
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 90,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -5,
    marginBottom: -10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  bottomSection: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#b24b2b',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFF',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: '#FFF',
    marginHorizontal: 16,
    fontSize: 14,
  },
  questionText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 16,
    fontWeight: '500',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12, // Requer React Native versão mais recente, se der erro use margin
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    lineHeight: 16,
  },
});
