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
  ActivityIndicator,
  Image,
  SafeAreaView,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF5A00', 
  primaryLight: '#FFF4ED', 
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  textInput: '#111827',
  icon: '#000000', 
};

// URL DA SUA API
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function Cadastro() {
  const router = useRouter();

  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [province, setProvince] = useState(''); 
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [papel, setPapel] = useState('user'); 
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConf, setShowPasswordConf] = useState(false);
  const [aceitoTermos, setAceitoTermos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // --- MÁSCARAS (COM TIPAGEM STRING) ---
  const maskCPF = (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value: string): string => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  // --- BUSCA CEP AUTOMÁTICA ---
  const handleCepChange = async (cepText: string) => {
    const masked = maskCEP(cepText);
    setPostalCode(masked);

    const cepLimpo = masked.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddress(data.logradouro || '');
          setProvince(data.bairro || '');
          setCity(data.localidade || '');
          setStateUf(data.uf || '');
        }
      } catch (e) {
        console.log("Erro ao buscar CEP");
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  // --- FUNÇÃO PARA PEGAR IP NO FRONTEND ---
  const fetchUserIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'IP Desconhecido';
    } catch (error) {
      return 'IP Desconhecido';
    }
  };

  // --- ABRIR PDF DOS TERMOS ---
  const handleAbrirTermos = () => {
    Linking.openURL('https://waitless-g1yc.onrender.com/documentos/Termo-decompromisso.pdf')
      .catch(() => Alert.alert('Erro', 'Não foi possível abrir o documento.'));
  };

  // --- SUBMIT ---
  const handleCadastro = async () => {
    if (!name || !email || !cpfCnpj || !mobilePhone || !postalCode || !address || !addressNumber || !password) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }

    if (!aceitoTermos) {
      Alert.alert('Atenção', 'Você precisa aceitar os Termos de Uso.');
      return;
    }

    setLoading(true);

    try {
      // Captura o IP do usuário
      const userIp = await fetchUserIP();
      const userAgent = `WaitlessApp/${Platform.OS} (Version: ${Platform.Version})`;

      const payload = {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        papel,
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        mobile_phone: mobilePhone.replace(/\D/g, ''),
        postal_code: postalCode.replace(/\D/g, ''),
        address,
        address_number: addressNumber,
        complement,
        province,
        city,
        state: stateUf,
        person_type: cpfCnpj.replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA',
        
        // DADOS DO TERMO DE COMPROMISSO
        termo_compromisso_aceito: true,
        termo_compromisso_versao: '1.0',
        termo_compromisso_ip: userIp,
        termo_compromisso_user_agent: userAgent,
      };

      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || 'Erro ao realizar cadastro.';
        throw new Error(errorMessage);
      }

      Alert.alert('Sucesso!', 'Conta criada com sucesso e carteira ativada.');
      router.replace('/src/screens/Home');

    } catch (error: unknown) {
      // CORREÇÃO DO ERRO TS18046: Trata a variável 'error' como desconhecida com segurança
      const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
      Alert.alert('Falha no Cadastro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.icon} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Criar conta</Text>
            <Text style={styles.headerSubtitle}>Preencha seus dados para começar</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo_lokyva.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.form}>
            
            <Text style={styles.sectionTitle}>Selecione seu Perfil</Text>
            <View style={styles.badgeContainer}>
              {[
                { label: 'Sou Cliente', value: 'user' },
                { label: 'Sou Proprietário (Criar Loja)', value: 'proprietario' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.badge, papel === item.value && styles.badgeSelected]}
                  onPress={() => setPapel(item.value)}
                >
                  <Text style={[styles.badgeText, papel === item.value && styles.badgeTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* DADOS PESSOAIS */}
            <Text style={styles.sectionTitle}>Dados Pessoais</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={COLORS.gray} value={name} onChangeText={setName} autoCapitalize="words" />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={COLORS.gray} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                <Ionicons name="id-card-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="CPF / CNPJ" placeholderTextColor={COLORS.gray} value={cpfCnpj} onChangeText={(t) => setCpfCnpj(maskCPF(t))} keyboardType="number-pad" />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Ionicons name="call-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Telefone" placeholderTextColor={COLORS.gray} value={mobilePhone} onChangeText={(t) => setMobilePhone(maskPhone(t))} keyboardType="phone-pad" />
              </View>
            </View>

            {/* ENDEREÇO */}
            <Text style={styles.sectionTitle}>Endereço (Financeiro)</Text>

            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                <Ionicons name="map-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="CEP" placeholderTextColor={COLORS.gray} value={postalCode} onChangeText={handleCepChange} keyboardType="number-pad" />
                {buscandoCep && <ActivityIndicator size="small" color={COLORS.primary} style={{ position: 'absolute', right: 15 }} />}
              </View>
              <View style={[styles.inputContainer, { flex: 2 }]}>
                <TextInput style={[styles.input, { paddingLeft: 15 }]} placeholder="Cidade / UF" placeholderTextColor={COLORS.gray} value={city ? `${city} - ${stateUf}` : ''} editable={false} />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="business-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Rua / Avenida" placeholderTextColor={COLORS.gray} value={address} onChangeText={setAddress} />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                <TextInput style={[styles.input, { paddingLeft: 15 }]} placeholder="Número" placeholderTextColor={COLORS.gray} value={addressNumber} onChangeText={setAddressNumber} />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <TextInput style={[styles.input, { paddingLeft: 15 }]} placeholder="Bairro" placeholderTextColor={COLORS.gray} value={province} onChangeText={setProvince} />
              </View>
            </View>

            {/* SEGURANÇA */}
            <Text style={styles.sectionTitle}>Segurança</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Senha" placeholderTextColor={COLORS.gray} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.icon} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Confirmar senha" placeholderTextColor={COLORS.gray} value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry={!showPasswordConf} />
              <TouchableOpacity onPress={() => setShowPasswordConf(!showPasswordConf)} style={styles.eyeIcon}>
                <Ionicons name={showPasswordConf ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {/* TERMOS DE COMPROMISSO E PRIVACIDADE */}
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitoTermos(!aceitoTermos)}>
              <View style={[styles.checkbox, aceitoTermos && styles.checkboxChecked]}>
                {aceitoTermos && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
              <Text style={styles.checkboxText}>
                Eu aceito o{' '}
                <Text style={styles.linkText} onPress={handleAbrirTermos}>Termo de Compromisso</Text>
              </Text>
            </TouchableOpacity>

            {/* BOTÃO */}
            <TouchableOpacity style={styles.button} onPress={handleCadastro} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
            </TouchableOpacity>

            {/* DIVISOR */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou cadastre-se com</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SOCIAL LOGIN */}
            <View style={styles.socialContainer}>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-apple" size={20} color="#000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>

            {/* LINK LOGIN */}
            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={styles.loginLinkTextDesc}>Já tem uma conta? <Text style={styles.loginLinkText}>Entrar</Text></Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  backButton: { padding: 8, marginLeft: -8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary },
  headerSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  logoContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  logo: { width: 180, height: 60 },
  form: { flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 10 },
  badgeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  badge: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  badgeSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  badgeText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  badgeTextSelected: { color: COLORS.primary, fontWeight: 'bold' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, height: 55, paddingHorizontal: 15, marginBottom: 16, backgroundColor: COLORS.white },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textInput, height: '100%' },
  eyeIcon: { padding: 5 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.gray, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxText: { fontSize: 13, color: COLORS.gray },
  linkText: { color: '#7C3AED', fontWeight: '600', textDecorationLine: 'underline' }, 
  button: { backgroundColor: COLORS.primary, borderRadius: 12, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 15, fontSize: 13, color: COLORS.gray },
  socialContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginBottom: 30 },
  socialButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, height: 55 },
  socialButtonText: { marginLeft: 10, fontSize: 14, fontWeight: '600', color: COLORS.secondary },
  loginLink: { alignItems: 'center' },
  loginLinkTextDesc: { color: COLORS.gray, fontSize: 14 },
  loginLinkText: { color: '#7C3AED', fontWeight: 'bold' }, 
});