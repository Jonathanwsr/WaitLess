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
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // MUDANÇA AQUI: IP da sua rede para o celular conseguir achar o Laravel
  const API_URL = 'http://192.168.1.11:8000/api/mobile/login';

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
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      // --- INÍCIO DO BLOCO DE DEPURAÇÃO ---
      const textoCru = await response.text();
      console.log("RESPOSTA DO LARAVEL:", textoCru);

      let data;
      try {
        data = JSON.parse(textoCru);
      } catch (e) {
        Alert.alert('Erro Fatal no Backend', 'O Laravel quebrou. Aperte F12 e olhe a aba Console no navegador para ver o erro vermelho.');
        setLoading(false);
        return;
      }
      // --- FIM DO BLOCO DE DEPURAÇÃO ---

      if (response.status === 421) {
        Alert.alert('Acesso Negado', data.message || 'As credenciais estão incorretas.');
        setLoading(false);
        return;
      }

      // --- LOGIN BEM-SUCEDIDO: Salvando autenticação ---
      if (response.ok && data.status === 'success') {

        // 1. Salva o Token e dados do usuário com segurança
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('userData', JSON.stringify(data.usuario));

        // 2. Redirecionamento seguro
        if (data.destino === 'funcionario') {
          router.replace('/src/screens/funcionario/Painel-funcioanario');
        } else {
          router.replace('/src/screens/Home');
        }

      } else {
        Alert.alert('Erro', data.message || 'Não foi possível fazer o login.');
      }

    } catch (error) {
      console.error(error);
      Alert.alert(
        'Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique se o Laravel está rodando com --host=0.0.0.0 e se o celular está no mesmo Wi-Fi.'
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
            activeOpacity={0.8}
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  backButton: { marginBottom: 32, alignSelf: 'flex-start' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 40 },
  title: { fontSize: 34, fontWeight: '800', color: '#1A1A1A', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#666666', lineHeight: 24 },
  form: { flex: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F9', borderWidth: 1, borderColor: '#EFEFEF', borderRadius: 16, marginBottom: 16, paddingHorizontal: 18, height: 60 },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, color: '#1A1A1A', fontSize: 16 },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 40, marginTop: 8 },
  forgotPasswordText: { color: '#b24b2b', fontSize: 15, fontWeight: '600' },
  loginButton: {
    backgroundColor: '#b24b2b',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // MUDANÇA AQUI: Removidas as propriedades shadow antigas e adicionada a boxShadow moderna
    boxShadow: '0px 6px 8px rgba(178, 75, 43, 0.25)',
    elevation: 6
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  signUpContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  signUpText: { color: '#666666', fontSize: 15 },
  signUpLink: { color: '#b24b2b', fontSize: 15, fontWeight: 'bold' },
});
