import React, { useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

export default function TelaEntrada() {
  const router = useRouter();
  
  // Estado para controlar a tela de carregamento enquanto verifica o login
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    verificarLogin();
  }, []);

  const verificarLogin = async () => {
    try {
      // Procura o token e os dados salvos no celular
      const token = await AsyncStorage.getItem('@waitless_token');
      const userDataString = await SecureStore.getItemAsync('userData');
      
      if (token && userDataString) {
        const usuario = JSON.parse(userDataString);
        const papelUsuario = usuario?.papel?.toLowerCase() || '';
        
        // Redirecionamento corrigido com base no papel do usuário
        if (['socio', 'proprietario', 'gerente'].includes(papelUsuario)) {
          // Agora envia os donos para o Dashboard correto
          router.replace('/Proprietario/dashboard');
        } else if (['funcionario', 'admin'].includes(papelUsuario)) {
          router.replace('/src/funcionario/Painel-funcioanario');
        } else {
          router.replace('/src/screens/Home');
        }
      } else {
        // Se não tiver token, para de carregar e mostra a tela de entrada normal
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.log('Erro ao verificar login no index:', error);
      setIsCheckingAuth(false);
    }
  };

  // Enquanto verifica o login, mostra uma tela de carregamento
  if (isCheckingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.mainContent}>
            
            {/* O caminho './assets/logo_lokyva.png' está correto de acordo com a sua estrutura de pastas */}
            <Image
              source={require('./assets/logo_lokyva.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            <Text style={styles.title}>
              Lok<Text style={styles.titleHighlight}>y</Text>va
            </Text>

            <View style={styles.subtitleContainer}>
              <Text style={styles.subtitle}>
                Conecte. <Text style={styles.subtitleHighlight}>Reserve.</Text>
              </Text>
              <Text style={styles.subtitle}>Viva mais experiências.</Text>
            </View>
          </View>

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#140A28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
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
    color: '#FF6B35',
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
    color: '#FF6B35',
    fontWeight: '600',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 40 : 20, 
    gap: 16, // Mantém o espaçamento uniforme entre os botões
  },
  
  // --- ESTILOS DOS BOTÕES ATUALIZADOS PARA O FORMATO DA IMAGEM ---
  primaryButton: {
    backgroundColor: '#FF6B35',
    height: 60,
    borderRadius: 30, // Metade da altura para criar o formato de pílula perfeito
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF', // Borda branca sólida
    height: 60,
    borderRadius: 30, // Metade da altura para criar o formato de pílula
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700', // Em negrito para dar o mesmo peso visual do botão de cima
  },
});