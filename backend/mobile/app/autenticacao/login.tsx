import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  StatusBar,
} from 'react-native';
// --- IMPORTAÇÃO CORRIGIDA DO SAFE AREA ---
import { SafeAreaView } from 'react-native-safe-area-context'; 

import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- NOTIFICAÇÕES REATIVADAS ---
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para o bloqueio de tentativas
  const [attempts, setAttempts] = useState(0);
  const [blockTime, setBlockTime] = useState(0);

  // Carrega o histórico de tentativas e bloqueios ao abrir a tela
  useEffect(() => {
    const loadLockoutState = async () => {
      try {
        const storedBlockUntil = await SecureStore.getItemAsync('blockUntil');
        const storedAttempts = await SecureStore.getItemAsync('loginAttempts');

        if (storedBlockUntil) {
          const blockUntil = parseInt(storedBlockUntil, 10);
          const now = Date.now();
          
          if (blockUntil > now) {
            // Se ainda estiver no período de bloqueio, calcula os segundos restantes
            setBlockTime(Math.ceil((blockUntil - now) / 1000));
          } else {
            // Tempo já passou, limpa o bloqueio
            await SecureStore.deleteItemAsync('blockUntil');
            await SecureStore.setItemAsync('loginAttempts', '0');
            setAttempts(0);
          }
        } else if (storedAttempts) {
          setAttempts(parseInt(storedAttempts, 10));
        }
      } catch (e) {
        // Ignora erro de leitura
      }
    };

    loadLockoutState();
  }, []);

  // Efeito para contar o tempo de bloqueio na tela
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    
    if (blockTime > 0) {
      timer = setInterval(() => {
        setBlockTime((prev) => prev - 1);
      }, 1000);
    } else if (blockTime === 0 && attempts >= 5) {
      // Quando o tempo acaba, reseta as tentativas e limpa a memória
      setAttempts(0);
      SecureStore.deleteItemAsync('blockUntil');
      SecureStore.setItemAsync('loginAttempts', '0');
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [blockTime, attempts]);

  // Função para lidar com falhas e incrementar tentativas persistentes
  const handleFailedAttempt = async () => {
    try {
      const newAttempts = attempts + 1;
      
      if (newAttempts >= 5) {
        const blockDurationInSeconds = 1 * 60; 
        const blockUntil = Date.now() + (blockDurationInSeconds * 1000);
        
        setBlockTime(blockDurationInSeconds);
        setAttempts(5); 
        
        await SecureStore.setItemAsync('blockUntil', blockUntil.toString());
        await SecureStore.setItemAsync('loginAttempts', '5');
      } else {
        setAttempts(newAttempts);
        await SecureStore.setItemAsync('loginAttempts', newAttempts.toString());
      }
    } catch (e) {
      // Ignora erro de gravação
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleLogin = async () => {
    if (blockTime > 0) {
      Alert.alert('Acesso bloqueado', `Aguarde ${formatTime(blockTime)} minutos para tentar novamente.`);
      return;
    }

    if (!email || !password) {
      Alert.alert('Ops', 'Por favor, preencha seu e-mail e senha.');
      return;
    }

    setLoading(true);

    let pushToken: string | null = null;
    
    // --- LÓGICA DE PUSH NOTIFICATION REATIVADA ---
    try {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          pushToken = tokenData.data;
        }
      }
    } catch (error) {
      console.log('Aviso: Falha ao pegar push token', error);
    }

    try {
      const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
      const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
      const API_URL = `${cleanBaseUrl}/mobile/login`;

      console.log('=====> ENVIANDO PARA:', API_URL);
      console.log('=====> TOKEN PUSH GERADO:', pushToken);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          expo_push_token: pushToken, // Agora vai enviar o token real!
        }),
      });

      const textoCru = await response.text();

      let data;
      try {
        data = JSON.parse(textoCru);
      } catch (e) {
        await handleFailedAttempt();
        console.log("Erro de JSON:", textoCru);
        Alert.alert('Ops', 'Servidor retornou um erro inesperado.');
        setLoading(false);
        return;
      }

      if (response.status === 421 || response.status === 401 || !response.ok) {
        await handleFailedAttempt();
        Alert.alert('Ops', 'E-mail ou senha incorretos. Tente novamente!');
        setLoading(false);
        return;
      }

      if (response.ok && data.status === 'success') {
        setAttempts(0);
        await SecureStore.deleteItemAsync('loginAttempts');
        await SecureStore.deleteItemAsync('blockUntil');
        await SecureStore.setItemAsync('userToken', data.token);
        await AsyncStorage.setItem('@waitless_token', data.token);
        
        let papelUsuario = '';
        if (data.usuario) {
          await SecureStore.setItemAsync('userData', JSON.stringify(data.usuario));
          papelUsuario = data.usuario.papel?.toLowerCase() || '';
        }

        if (data.destino === 'dashboard' || ['socio', 'proprietario', 'gerente'].includes(papelUsuario)) {
          router.replace('/Proprietario/dashboard');
        } else if (data.destino === 'funcionario') {
          router.replace('/src/funcionario/Painel-funcioanario');
        } else {
          router.replace('/src/screens/Home');
        }
        
      } else {
        await handleFailedAttempt();
        Alert.alert('Ops', 'Algo deu errado. Tente novamente!');
      }
    } catch (error) {
      await handleFailedAttempt();
      console.log('ERRO DE CONEXAO:', error);
      Alert.alert('Ops', 'Não foi possível conectar. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <View style={styles.iconCircle}>
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.centerWrapper}>
              <View style={styles.header}>
                <Text style={styles.title}>Bem-vindo de volta!</Text>
                <Text style={styles.subtitle}>Faça login para continuar no Lokyva.</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Seu e-mail"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Feather name="lock" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Sua senha"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={() => router.push('/autenticacao/esqueci-senha')}
                >
                  <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, blockTime > 0 && { backgroundColor: '#A9A9A9' }]}
                  onPress={handleLogin}
                  disabled={loading || blockTime > 0}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {blockTime > 0 ? `Aguarde ${formatTime(blockTime)}` : 'Entrar'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.createAccountButton}
                  onPress={() => router.push('/autenticacao/cadastro')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.createAccountButtonText}>Criar conta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(20, 10, 40, 0.55)',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16.5,
    color: '#E0E0E0',
    lineHeight: 25,
  },
  form: {
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    marginBottom: 18,
    paddingHorizontal: 20,
    height: 64,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16.5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 42,
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  createAccountButton: {
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  createAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});