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
  Linking,
  ImageBackground,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// URL DA SUA API
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile/register';

export default function Cadastro() {
  const router = useRouter();

  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [phone, setPhone] = useState(''); // ADICIONADO: Telefone fixo/secundário
  const [birthDate, setBirthDate] = useState(''); // ADICIONADO: Data de nascimento
  
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState(''); // Já existia no state, mas faltava na UI
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
      .replace(/(\d{4,5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value: string): string => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  // ADICIONADO: Máscara para Data de Nascimento
  const maskDate = (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .substring(0, 10);
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
    // Validando campos obrigatórios conforme o Controller
    if (!name || !email || !cpfCnpj || !mobilePhone || !postalCode || !address || !addressNumber || !province || !city || !stateUf || !password) {
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
      const userIp = await fetchUserIP();
      const userAgent = `WaitlessApp/${Platform.OS} (Version: ${Platform.Version})`;

      // Formatar data de nascimento para o backend (YYYY-MM-DD) se houver
      let formattedBirthDate = null;
      if (birthDate && birthDate.length === 10) {
        formattedBirthDate = birthDate.split('/').reverse().join('-');
      }

      const payload = {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        papel,
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        mobile_phone: mobilePhone.replace(/\D/g, ''),
        phone: phone ? phone.replace(/\D/g, '') : null, // ADICIONADO
        birth_date: formattedBirthDate, // ADICIONADO
        postal_code: postalCode.replace(/\D/g, ''),
        address,
        address_number: addressNumber,
        complement: complement || null, // ADICIONADO
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
      const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
      Alert.alert('Falha no Cadastro', message);
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Criar conta</Text>
                <Text style={styles.headerSubtitle}>Preencha seus dados para começar</Text>
              </View>
              <View style={{ width: 44 }} />
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
                      <Text style={[styles.badgeText, papel === item.value && styles.badgeTextSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* DADOS PESSOAIS */}
                <Text style={styles.sectionTitle}>Dados Pessoais</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={name} onChangeText={setName} autoCapitalize="words" />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <Ionicons name="id-card-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="CPF / CNPJ" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={cpfCnpj} onChangeText={(t) => setCpfCnpj(maskCPF(t))} keyboardType="number-pad" />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Ionicons name="call-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Celular" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={mobilePhone} onChangeText={(t) => setMobilePhone(maskPhone(t))} keyboardType="phone-pad" />
                  </View>
                </View>

                {/* ADICIONADO: Novos Campos Pessoais - Telefone Secundário e Data de Nascimento */}
                <View style={styles.rowInputs}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <Ionicons name="call-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Fixo (Opcional)" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={phone} onChangeText={(t) => setPhone(maskPhone(t))} keyboardType="phone-pad" />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Ionicons name="calendar-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Nascimento (Opcional)" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={birthDate} onChangeText={(t) => setBirthDate(maskDate(t))} keyboardType="number-pad" />
                  </View>
                </View>

                {/* ENDEREÇO */}
                <Text style={styles.sectionTitle}>Endereço (Financeiro)</Text>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <Ionicons name="map-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="CEP" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={postalCode} onChangeText={handleCepChange} keyboardType="number-pad" />
                    {buscandoCep && <ActivityIndicator size="small" color="#FF6B35" style={{ position: 'absolute', right: 15 }} />}
                  </View>
                  <View style={[styles.inputContainer, { flex: 2, paddingLeft: 15 }]}>
                    <TextInput style={styles.input} placeholder="Cidade / UF" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={city ? `${city} - ${stateUf}` : ''} editable={false} />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="business-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Rua / Avenida" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={address} onChangeText={setAddress} />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10, paddingLeft: 15 }]}>
                    <TextInput style={styles.input} placeholder="Número" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={addressNumber} onChangeText={setAddressNumber} />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1, paddingLeft: 15 }]}>
                    <TextInput style={styles.input} placeholder="Bairro" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={province} onChangeText={setProvince} />
                  </View>
                </View>

                {/* ADICIONADO: Campo de Complemento */}
                <View style={styles.inputContainer}>
                  <Ionicons name="add-circle-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Complemento (Opcional)" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={complement} onChangeText={setComplement} />
                </View>

                {/* SEGURANÇA */}
                <Text style={styles.sectionTitle}>Segurança</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255, 255, 255, 0.6)" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#FF6B35" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Confirmar senha" placeholderTextColor="rgba(255, 255, 255, 0.6)" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry={!showPasswordConf} />
                  <TouchableOpacity onPress={() => setShowPasswordConf(!showPasswordConf)} style={styles.eyeIcon}>
                    <Ionicons name={showPasswordConf ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255, 255, 255, 0.6)" />
                  </TouchableOpacity>
                </View>

                {/* TERMOS DE COMPROMISSO E PRIVACIDADE */}
                <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitoTermos(!aceitoTermos)}>
                  <View style={[styles.checkbox, aceitoTermos && styles.checkboxChecked]}>
                    {aceitoTermos && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    Eu aceito o{' '}
                    <Text style={styles.linkText} onPress={handleAbrirTermos}>Termo de Compromisso</Text>
                  </Text>
                </TouchableOpacity>

                {/* BOTÃO */}
                <TouchableOpacity style={styles.button} onPress={handleCadastro} disabled={loading} activeOpacity={0.85}>
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
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialButton}>
                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
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
    backgroundColor: 'rgba(20, 10, 40, 0.65)',
  },
  safeArea: {
    flex: 1,
  },
  container: { 
    flex: 1, 
  },
  scrollContainer: { 
    flexGrow: 1, 
    paddingHorizontal: 24, 
    paddingBottom: 40 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    marginTop: Platform.OS === 'android' ? 40 : 10, 
    marginBottom: 10 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255, 255, 255, 0.15)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.2)' 
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#E0E0E0', marginTop: 2 },
  logoContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  logo: { width: 150, height: 50 },
  form: { flex: 1 },
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#E0E0E0', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 12, 
    marginTop: 15 
  },
  badgeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  badge: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255, 255, 255, 0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.2)', 
    alignItems: 'center' 
  },
  badgeSelected: { 
    borderColor: '#FF6B35', 
    backgroundColor: 'rgba(255, 107, 53, 0.15)' 
  },
  badgeText: { fontSize: 13, color: '#E0E0E0', fontWeight: '600' },
  badgeTextSelected: { color: '#FF6B35', fontWeight: 'bold' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.15)', 
    borderRadius: 16, 
    height: 58, 
    paddingHorizontal: 15, 
    marginBottom: 16, 
    backgroundColor: 'rgba(255, 255, 255, 0.08)' 
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#FFFFFF', height: '100%' },
  eyeIcon: { padding: 5 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24 },
  checkbox: { 
    width: 22, 
    height: 22, 
    borderRadius: 6, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.4)', 
    marginRight: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  checkboxChecked: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  checkboxText: { fontSize: 14, color: '#E0E0E0' },
  linkText: { color: '#FF6B35', fontWeight: 'bold', textDecorationLine: 'underline' }, 
  button: { 
    backgroundColor: '#FF6B35', 
    borderRadius: 16, 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#FF6B35', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 10, 
    elevation: 8 
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  dividerText: { marginHorizontal: 15, fontSize: 14, color: '#E0E0E0' },
  socialContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginBottom: 30 },
  socialButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.15)', 
    borderRadius: 16, 
    height: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  socialButtonText: { marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  loginLink: { alignItems: 'center' },
  loginLinkTextDesc: { color: '#E0E0E0', fontSize: 15 },
  loginLinkText: { color: '#FF6B35', fontWeight: 'bold' }, 
});