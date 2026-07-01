import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function EsqueciSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleRecuperarSenha = () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, informe seu e-mail de cadastro.');
      return;
    }

    // Aqui no futuro você colocará o fetch() chamando a rota de recuperar senha do Laravel
    Alert.alert(
      'Tudo certo!',
      'Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.',
      [{ text: 'Voltar ao Login', onPress: () => router.back() }]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>
          Digite o e-mail associado à sua conta e enviaremos um link para você redefinir sua senha.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Feather name="mail" size={20} color="#rgba(255,255,255,0.7)" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Seu e-mail cadastrado"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleRecuperarSenha}
        >
          <Text style={styles.primaryButtonText}>Enviar link de recuperação</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    marginBottom: 32,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#FFF',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#b24b2b',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
