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
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// URL DA SUA API
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile/register';

// OPÇÕES DE SELEÇÃO RÁPIDA
const OPCOES_ONDE_MORO = ['Casa', 'Apartamento', 'Chácara', 'Sítio', 'Fazenda'];
const OPCOES_PROFISSAO = ['Autônomo(a)', 'Empresário(a)', 'Estudante', 'CLT', 'Servidor Público'];
const OPCOES_ONDE_ESTUDEI = ['Ensino Médio', 'Faculdade / Ensino Superior', 'Pós-Graduação / MBA', 'Autodidata'];

export default function Cadastro() {
  const router = useRouter();

  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [phone, setPhone] = useState(''); 
  const [birthDate, setBirthDate] = useState(''); 
  
  // Endereço
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState(''); 
  const [province, setProvince] = useState(''); 
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');

  // Novos Campos do Perfil
  const [profissao, setProfissao] = useState('');
  const [ondeEstudei, setOndeEstudei] = useState('');
  const [ondeMoro, setOndeMoro] = useState('');
  const [idiomas, setIdiomas] = useState('');
  const [sobreMim, setSobreMim] = useState('');

  // Segurança e Configurações
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [papel, setPapel] = useState('user'); 
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConf, setShowPasswordConf] = useState(false);
  const [aceitoTermos, setAceitoTermos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // --- FILTRO DE SEGURANÇA E PRIMEIRA LETRA MAIÚSCULA ---
  const sanitizeInput = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[<>{}[\];=]/g, '');
  };

  // Garante que a primeira letra seja sempre maiúscula
  const capitalizeFirst = (text: string): string => {
    const sanitized = sanitizeInput(text);
    if (!sanitized) return '';
    return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  };

  // --- MÁSCARAS ---
  const maskCPF = (value: string): string => {
    const cleaned = sanitizeInput(value).replace(/\D/g, '');
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string): string => {
    const cleaned = sanitizeInput(value).replace(/\D/g, '');
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4,5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value: string): string => {
    const cleaned = sanitizeInput(value).replace(/\D/g, '');
    return cleaned.replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  const maskDate = (value: string): string => {
    const cleaned = sanitizeInput(value).replace(/\D/g, '');
    return cleaned
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
          setAddress(capitalizeFirst(data.logradouro || ''));
          setProvince(capitalizeFirst(data.bairro || ''));
          setCity(capitalizeFirst(data.localidade || ''));
          setStateUf(sanitizeInput(data.uf || '').toUpperCase());
        }
      } catch (e) {
        console.log("Erro ao buscar CEP");
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  // --- PEGAR IP NO FRONTEND ---
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
        phone: phone ? phone.replace(/\D/g, '') : null,
        birth_date: formattedBirthDate, 
        postal_code: postalCode.replace(/\D/g, ''),
        address,
        address_number: addressNumber,
        complement: complement || null, 
        province,
        city,
        state: stateUf,
        person_type: cpfCnpj.replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA',

        // NOVOS CAMPOS
        profissao: profissao || null,
        onde_estudei: ondeEstudei || null,
        onde_moro: ondeMoro || null,
        idiomas: idiomas || null,
        sobre_mim: sobreMim || null,
        
        termo_compromisso_aceito: true,
        termo_compromisso_versao: '1.0',
        termo_compromisso_ip: userIp,
        termo_compromisso_user_agent: userAgent,
      };

      const response = await fetch(`${API_URL}`, {
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
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          
          {/* HEADER (Botão de Voltar ajustado para redirecionar para o Index) */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#000000" />
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
              
              {/* TIPO DE USUÁRIO */}
              <Text style={styles.sectionTitle}>Selecione seu Perfil</Text>
              <View style={styles.badgeContainer}>
                {[
                  { label: 'Sou Cliente', value: 'user' },
                  { label: 'Sou Proprietário', value: 'proprietario' },
                ].map((item) => {
                  const isSelected = papel === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.badge, isSelected && styles.badgeSelected]}
                      onPress={() => setPapel(item.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* DADOS PESSOAIS */}
              <Text style={styles.sectionTitle}>Dados Pessoais</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Nome completo" 
                  placeholderTextColor="#888" 
                  value={name} 
                  onChangeText={(t) => setName(capitalizeFirst(t))} 
                  autoCapitalize="words" 
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#888" value={email} onChangeText={(t) => setEmail(sanitizeInput(t))} keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                  <Ionicons name="id-card-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="CPF / CNPJ" placeholderTextColor="#888" value={cpfCnpj} onChangeText={(t) => setCpfCnpj(maskCPF(t))} keyboardType="number-pad" />
                </View>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Ionicons name="call-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Celular" placeholderTextColor="#888" value={mobilePhone} onChangeText={(t) => setMobilePhone(maskPhone(t))} keyboardType="phone-pad" />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                  <Ionicons name="call-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Fixo (Opcional)" placeholderTextColor="#888" value={phone} onChangeText={(t) => setPhone(maskPhone(t))} keyboardType="phone-pad" />
                </View>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Ionicons name="calendar-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Nascimento" placeholderTextColor="#888" value={birthDate} onChangeText={(t) => setBirthDate(maskDate(t))} keyboardType="number-pad" />
                </View>
              </View>

              {/* INFORMAÇÕES ADICIONAIS / PERFIL */}
              <Text style={styles.sectionTitle}>Sobre Você (Perfil)</Text>

              {/* PROFISSÃO (Opções + Campo de Texto) */}
              <Text style={styles.fieldLabel}>Sua Profissão</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                {OPCOES_PROFISSAO.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, profissao === item && styles.chipSelected]}
                    onPress={() => setProfissao(item)}
                  >
                    <Text style={[styles.chipText, profissao === item && styles.chipTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputContainer}>
                <Ionicons name="briefcase-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Sua Profissão (ou digite aqui)" 
                  placeholderTextColor="#888" 
                  value={profissao} 
                  onChangeText={(t) => setProfissao(capitalizeFirst(t))} 
                  autoCapitalize="sentences"
                />
              </View>

              {/* ONDE ESTUDEI (Opções + Campo de Texto) */}
              <Text style={styles.fieldLabel}>Onde Estudei</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                {OPCOES_ONDE_ESTUDEI.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, ondeEstudei === item && styles.chipSelected]}
                    onPress={() => setOndeEstudei(item)}
                  >
                    <Text style={[styles.chipText, ondeEstudei === item && styles.chipTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputContainer}>
                <Ionicons name="school-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Onde estudei (ou digite a instituição)" 
                  placeholderTextColor="#888" 
                  value={ondeEstudei} 
                  onChangeText={(t) => setOndeEstudei(capitalizeFirst(t))} 
                  autoCapitalize="sentences"
                />
              </View>

              {/* ONDE MORO (Opções + Campo de Texto) */}
              <Text style={styles.fieldLabel}>Onde Moro</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                {OPCOES_ONDE_MORO.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, ondeMoro === item && styles.chipSelected]}
                    onPress={() => setOndeMoro(item)}
                  >
                    <Text style={[styles.chipText, ondeMoro === item && styles.chipTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputContainer}>
                <Ionicons name="home-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Onde moro (ou digite outro tipo)" 
                  placeholderTextColor="#888" 
                  value={ondeMoro} 
                  onChangeText={(t) => setOndeMoro(capitalizeFirst(t))} 
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="language-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Idiomas (ex: Português, Inglês)" 
                  placeholderTextColor="#888" 
                  value={idiomas} 
                  onChangeText={(t) => setIdiomas(capitalizeFirst(t))} 
                  autoCapitalize="sentences"
                />
              </View>

              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <Ionicons name="information-circle-outline" size={20} color="#000000" style={[styles.inputIcon, { marginTop: 12 }]} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Sobre mim (uma breve descrição)"
                  placeholderTextColor="#888"
                  value={sobreMim}
                  onChangeText={(t) => setSobreMim(capitalizeFirst(t))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                />
              </View>

              {/* ENDEREÇO */}
              <Text style={styles.sectionTitle}>Endereço (Financeiro)</Text>

              <View style={styles.rowInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                  <Ionicons name="map-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="CEP" placeholderTextColor="#888" value={postalCode} onChangeText={handleCepChange} keyboardType="number-pad" />
                  {buscandoCep && <ActivityIndicator size="small" color="#FF6B35" style={{ position: 'absolute', right: 15 }} />}
                </View>
                <View style={[styles.inputContainer, { flex: 2, paddingLeft: 15 }]}>
                  <TextInput style={styles.input} placeholder="Cidade / UF" placeholderTextColor="#888" value={city ? `${city} - ${stateUf}` : ''} editable={false} />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Rua / Avenida" 
                  placeholderTextColor="#888" 
                  value={address} 
                  onChangeText={(t) => setAddress(capitalizeFirst(t))} 
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10, paddingLeft: 15 }]}>
                  <TextInput style={styles.input} placeholder="Número" placeholderTextColor="#888" value={addressNumber} onChangeText={(t) => setAddressNumber(sanitizeInput(t))} />
                </View>
                <View style={[styles.inputContainer, { flex: 1, paddingLeft: 15 }]}>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Bairro" 
                    placeholderTextColor="#888" 
                    value={province} 
                    onChangeText={(t) => setProvince(capitalizeFirst(t))} 
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="add-circle-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Complemento (Opcional)" 
                  placeholderTextColor="#888" 
                  value={complement} 
                  onChangeText={(t) => setComplement(capitalizeFirst(t))} 
                  autoCapitalize="sentences"
                />
              </View>

              {/* SEGURANÇA */}
              <Text style={styles.sectionTitle}>Segurança</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#888" value={password} onChangeText={(t) => setPassword(sanitizeInput(t))} secureTextEntry={!showPassword} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#888888" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#000000" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Confirmar senha" placeholderTextColor="#888" value={passwordConfirmation} onChangeText={(t) => setPasswordConfirmation(sanitizeInput(t))} secureTextEntry={!showPasswordConf} />
                <TouchableOpacity onPress={() => setShowPasswordConf(!showPasswordConf)} style={styles.eyeIcon}>
                  <Ionicons name={showPasswordConf ? "eye-off-outline" : "eye-outline"} size={20} color="#888888" />
                </TouchableOpacity>
              </View>

              {/* TERMOS DE COMPROMISSO */}
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitoTermos(!aceitoTermos)}>
                <View style={[styles.checkbox, aceitoTermos && styles.checkboxChecked]}>
                  {aceitoTermos && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxText}>
                  Eu aceito o{' '}
                  <Text style={styles.linkText} onPress={handleAbrirTermos}>Termo de Compromisso</Text>
                </Text>
              </TouchableOpacity>

              {/* BOTÃO PRINCIPAL */}
              <TouchableOpacity style={styles.button} onPress={handleCadastro} disabled={loading} activeOpacity={0.88}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
              </TouchableOpacity>

              {/* LINK LOGIN */}
              <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/')}>
                <Text style={styles.loginLinkTextDesc}>Já tem uma conta? <Text style={styles.loginLinkText}>Entrar</Text></Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
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
  scrollContainer: { 
    flexGrow: 1, 
    paddingHorizontal: 24, 
    paddingBottom: 40 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    marginTop: Platform.OS === 'android' ? 35 : 10, 
    marginBottom: 10 
  },
  backButton: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#EAEAEA',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111111' },
  headerSubtitle: { fontSize: 13, color: '#666666', marginTop: 2 },
  logoContainer: { alignItems: 'center', marginBottom: 15, marginTop: 5 },
  logo: { width: 140, height: 48 },
  form: { flex: 1 },
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#FF6B35', 
    textTransform: 'uppercase', 
    letterSpacing: 1.1, 
    marginBottom: 12, 
    marginTop: 20 
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
    marginTop: 4,
  },
  chipScrollView: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badgeContainer: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  badge: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 18, 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1.5, 
    borderColor: '#EAEAEA', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  badgeSelected: { 
    borderColor: '#FF6B35', 
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: { fontSize: 14, color: '#555555', fontWeight: '600' },
  badgeTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E8E8E8', 
    borderRadius: 18, 
    height: 56, 
    paddingHorizontal: 16, 
    marginBottom: 14, 
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  textAreaContainer: {
    height: 'auto',
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#111111', height: '100%' },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  eyeIcon: { padding: 5 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 24 },
  checkbox: { 
    width: 22, 
    height: 22, 
    borderRadius: 7, 
    borderWidth: 1.8, 
    borderColor: '#CCCCCC', 
    marginRight: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxChecked: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  checkboxText: { fontSize: 14, color: '#444444' },
  linkText: { color: '#FF6B35', fontWeight: 'bold', textDecorationLine: 'underline' }, 
  button: { 
    backgroundColor: '#FF6B35', 
    borderRadius: 18, 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#FF6B35', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.35, 
    shadowRadius: 10, 
    elevation: 6,
    marginBottom: 20
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  loginLink: { alignItems: 'center', paddingVertical: 10 },
  loginLinkTextDesc: { color: '#666666', fontSize: 15 },
  loginLinkText: { color: '#FF6B35', fontWeight: 'bold' }, 
});