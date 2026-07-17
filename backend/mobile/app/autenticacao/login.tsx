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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <View style={styles.iconCircle}>
            <Feather name="arrow-left" size={22} color="#333" />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Bem-vindo de volta!</Text>
          <Text style={styles.subtitle}>Faça login para continuar no Waitless.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color="#b24b2b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Seu e-mail"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#b24b2b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#A0A0A0"
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

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/autenticacao/cadastro')}>
              <Text style={styles.signUpLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  backButton: {
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16.5,
    color: '#666666',
    lineHeight: 25,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    marginBottom: 18,
    paddingHorizontal: 20,
    height: 64,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    color: '#1A1A1A',
    fontSize: 16.5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 42,
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#b24b2b',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#FF6B35', // Laranja mais vibrante e moderno
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
    color: '#666666',
    fontSize: 15.5,
  },
  signUpLink: {
    color: '#FF6B35',
    fontSize: 15.5,
    fontWeight: '700',
  },
});