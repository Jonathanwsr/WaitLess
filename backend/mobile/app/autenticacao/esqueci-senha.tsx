import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function EsqueciSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  // --- FILTRO DE SEGURANÇA ---
  const sanitizeInput = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[<>{}[\];=]/g, '')
      .trim();
  };

  const handleRecuperarSenha = () => {
    const cleanEmail = sanitizeInput(email);

    if (!cleanEmail) {
      Alert.alert('Atenção', 'Por favor, informe seu e-mail de cadastro.');
      return;
    }

    // Validação simples de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Atenção', 'Por favor, insira um e-mail válido.');
      return;
    }

    // Aqui no futuro você colocará o fetch() chamando a rota de recuperar senha da sua API
    Alert.alert(
      'Tudo certo!',
      'Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.',
      [{ text: 'Voltar ao Login', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Recuperar Senha</Text>
            </View>
            <View style={{ width: 44 }} /> {/* Espaçador para centralizar o título */}
          </View>

          {/* CONTEÚDO */}
          <View style={styles.content}>
            
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-closed-outline" size={40} color="#FF6B35" />
              </View>
            </View>

            <Text style={styles.title}>Esqueceu sua senha?</Text>
            <Text style={styles.subtitle}>
              Não se preocupe! Digite o e-mail associado à sua conta e enviaremos as instruções para redefinição.
            </Text>

            {/* FORMULÁRIO */}
            <View style={styles.form}>
              <Text style={styles.label}>E-mail de recuperação</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="exemplo@email.com"
                  placeholderTextColor="#888888"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRecuperarSenha}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Enviar link de recuperação</Text>
              </TouchableOpacity>
            </View>
            
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    marginTop: Platform.OS === 'android' ? 40 : 10, 
    marginBottom: 20 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerCenter: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#000000' 
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.1)', // Fundo laranja bem clarinho
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    marginBottom: 32,
    paddingHorizontal: 16,
    height: 58,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#000000',
    fontSize: 15,
    height: '100%',
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});