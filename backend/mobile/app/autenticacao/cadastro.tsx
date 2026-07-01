import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';

export default function Cadastro() {
  const router = useRouter();

  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [papel, setPapel] = useState('user'); // Padrão 'user'
  const [loading, setLoading] = useState(false);

  // Lista de papéis disponíveis conforme validação do backend
  const papeisDisponiveis = [
    { label: 'Usuário', value: 'user' },
    { label: 'Atendente', value: 'atendente' },
    { label: 'Gerente', value: 'gerente' },
    { label: 'Sócio', value: 'socio' },
  ];

  const handleCadastro = async () => {
    if (!name || !email || !password || !passwordConfirmation) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // SUBSTITUA PELA URL DO SEU SERVIDOR/IP DA SUA MÁQUINA
      const URL_API = 'http://192.168.1.100:8000/api/mobile/cadastro';

      const response = await fetch(URL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          papel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao realizar cadastro.');
      }

      Alert.alert('Sucesso', 'Conta criada com sucesso!');

      // Redirecionamento condicional comentado conforme solicitado
      // if (data.destino === 'funcionario') {
      // # router.replace('/painel-funcionario');
      // } else {
        router.replace('/(tabs)/explorar');
      // }

    } catch (error: any) {
      Alert.alert('Falha no Cadastro', error.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Criar Conta</Text>
          <Text style={styles.subtitle}>Preencha os dados abaixo para começar</Text>
        </View>

        <View style={styles.form}>
          {/* Campo Nome */}
          <Text style={styles.label}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Campo Email */}
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seuemail@exemplo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Seletor de Papel Estilizado */}
          <Text style={styles.label}>Selecione seu Perfil</Text>
          <View style={styles.badgeContainer}>
            {papeisDisponiveis.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.badge, papel === item.value && styles.badgeSelected]}
                onPress={() => setPapel(item.value)}
              >
                <Text style={[styles.badgeText, papel === item.value && styles.badgeTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Campo Senha */}
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="No mínimo 8 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Confirmação da Senha */}
          <Text style={styles.label}>Confirmar Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita a senha digitada"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            secureTextEntry
          />

          {/* Botão Cadastrar */}
          <TouchableOpacity style={styles.button} onPress={handleCadastro} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Cadastrar</Text>
            )}
          </TouchableOpacity>

          {/* Link para voltar ao Login */}
          <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
            <Text style={styles.loginLinkText}>Já tem uma conta? Faça login</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flexGrow: 1, // Corrigido de paddingGrow para flexGrow
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    height: 48, // Corrigido de paddingHeight para height
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 5,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeSelected: {
    backgroundColor: '#C85A17',
    borderColor: '#C85A17',
  },
  badgeText: {
    fontSize: 14,
    color: '#555',
  },
  badgeTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#C85A17',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#C85A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#C85A17',
    fontSize: 14,
    fontWeight: '600',
  },
});
