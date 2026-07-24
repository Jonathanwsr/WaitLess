import React, { useState } from 'react';
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
  SafeAreaView,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // IP ou URL do seu backend
  const API_URL = 'https://waitless-g1yc.onrender.com/api/mobile/login';

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      // --- DEPURAÇÃO ---
      const textoCru = await response.text();
      console.log('RESPOSTA DO LARAVEL:', textoCru);

      let data;
      try {
        data = JSON.parse(textoCru);
      } catch (e) {
        Alert.alert(
          'Erro Fatal no Backend',
          'O Laravel retornou uma resposta inválida. Verifique o console.'
        );
        setLoading(false);
        return;
      }
      // --- FIM DA DEPURAÇÃO ---

      if (response.status === 421) {
        Alert.alert('Acesso Negado', data.message || 'Credenciais incorretas.');
        setLoading(false);
        return;
      }

      // Login bem-sucedido
      if (response.ok && data.status === 'success') {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('userData', JSON.stringify(data.usuario));

        if (data.destino === 'funcionario') {
          router.replace('/src/screens/funcionario/Painel-funcionario');
        } else {
          router.replace('/src/screens/Home');
        }
      } else {
        Alert.alert('Erro', data.message || 'Não foi possível fazer login.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique sua internet e se o backend está online.'
      );
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
            {/* Botão de Voltar */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <View style={styles.iconCircle}>
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Bem-vindo de volta!</Text>
              <Text style={styles.subtitle}>Faça login para continuar no Waitless.</Text>
            </View>

            <View style={styles.form}>
              {/* Input E-mail */}
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

              {/* Input Senha */}
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

              {/* Botão Entrar */}
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              {/* Link de Cadastro */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Não tem uma conta? </Text>
                <TouchableOpacity onPress={() => router.push('/autenticacao/cadastro')}>
                  <Text style={styles.signUpLink}>Cadastre-se</Text>
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
    backgroundColor: 'rgba(20, 10, 40, 0.55)', // Camada escura para destacar o texto
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
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Fundo translúcido
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    marginBottom: 48,
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
    color: '#E0E0E0', // Cinza claro para não brigar com o título
    lineHeight: 25,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Fundo translúcido (Glassmorphism)
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
    color: '#FF6B35', // Laranja
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#FF6B35', // Laranja vibrante
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 48,
  },
  signUpText: {
    color: '#E0E0E0',
    fontSize: 15.5,
  },
  signUpLink: {
    color: '#FF6B35',
    fontSize: 15.5,
    fontWeight: '700',
  },
});