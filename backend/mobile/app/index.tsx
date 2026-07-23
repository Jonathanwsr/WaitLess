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
  ImageBackground,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function TelaEntrada() {
  const router = useRouter();

  return (
    <ImageBackground
      // Mantive a imagem do Unsplash original, mas você pode trocar para a imagem de fundo exata do seu app
      source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
      style={styles.background}
    >
      {/* Overlay escuro para garantir a leitura do texto branco por cima da imagem */}
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <SafeAreaView style={styles.safeArea}>
          {/* Conteúdo Principal Centralizado */}
          <View style={styles.mainContent}>
            {/* Logo Lokyva */}
            <Image
              // Ajuste o caminho '../assets/' de acordo com a profundidade da pasta onde este arquivo está
             source={require('./assets/logo_lokyva.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            {/* Opcional: Se a imagem do logo já tiver a palavra "Lokyva", você pode remover este Text. 
                Deixei aqui para simular o layout da imagem caso o arquivo de logo seja apenas o ícone. */}
            <Text style={styles.title}>
              Lok<Text style={styles.titleHighlight}>y</Text>va
            </Text>

            {/* Subtítulos */}
            <View style={styles.subtitleContainer}>
              <Text style={styles.subtitle}>
                Conecte. <Text style={styles.subtitleHighlight}>Reserve.</Text>
              </Text>
              <Text style={styles.subtitle}>Viva mais experiências.</Text>
            </View>
          </View>

          {/* Botões de Ação na parte inferior */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => router.push('/autenticacao/login')}
            >
              <Text style={styles.primaryButtonText}>Entrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => router.push('/autenticacao/cadastro')}
            >
              <Text style={styles.secondaryButtonText}>Criar conta</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    // Cria um gradiente escuro ou sombra por cima da imagem para destacar os textos brancos
    backgroundColor: 'rgba(20, 10, 40, 0.4)', 
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 20,
  },
  titleHighlight: {
    color: '#FF6B35', // Ou o tom roxo/laranja da sua marca
  },
  subtitleContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '400',
    lineHeight: 26,
    textAlign: 'center',
  },
  subtitleHighlight: {
    color: '#FF6B35', // Laranja conforme a imagem
    fontWeight: '600',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    // padding extra embaixo para evitar a barra de navegação/botões virtuais no Android e iOS
    paddingBottom: Platform.OS === 'android' ? 40 : 20, 
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#FF6B35', // Todo laranja conforme solicitado
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#4A3B69', // Borda com cor inspirada na imagem (tom roxo escuro/transparente)
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});