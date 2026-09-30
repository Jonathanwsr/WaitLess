import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AppColors } from '../../constants/AppColors';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rotaInicialDoPapel } from '../../services/papel';
import { alertar } from '../../services/alertar';

// URL DA SUA API — antes isso apontava direto pra EXPO_PUBLIC_API_URL sem
// nenhum path, e como essa env var já termina em "/mobile" (sem "/register"),
// o cadastro sempre batia num 404 em qualquer build real (só "funcionava" no
// fallback hardcoded, usado apenas quando a env var não está definida).
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const API_URL = `${ENV_URL.replace(/\/+$/, '')}/register`;
const SITE_URL = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '').replace(/\/api\/?$/, '');

// OPÇÕES DE SELEÇÃO RÁPIDA
const OPCOES_ONDE_MORO = ['Casa', 'Apartamento', 'Chácara', 'Sítio', 'Fazenda'];
const OPCOES_PROFISSAO = ['Autônomo(a)', 'Empresário(a)', 'Estudante', 'CLT', 'Servidor Público'];
const OPCOES_ONDE_ESTUDEI = ['Ensino Médio', 'Faculdade / Ensino Superior', 'Pós-Graduação / MBA', 'Autodidata'];

const PERFIS = [
  { label: 'Sou Cliente', desc: 'Quero alugar itens e agendar serviços', value: 'user', icon: 'person-outline' as const },
  { label: 'Sou Proprietário', desc: 'Quero anunciar meus itens e serviços', value: 'proprietario', icon: 'storefront-outline' as const },
];

const STEPS = [
  { title: 'Selecione seu Perfil', subtitle: 'Quem vai usar essa conta?' },
  { title: 'Dados Pessoais', subtitle: 'Como podemos te chamar e contatar' },
  { title: 'Sobre Você', subtitle: 'Personalize seu perfil (opcional)' },
  { title: 'Endereço', subtitle: 'Pra localizar seus pedidos e repasses' },
  { title: 'Segurança', subtitle: 'Defina sua senha e aceite os termos' },
];

export default function Cadastro() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Navegação por etapas
  const [step, setStep] = useState(0);

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
  // Código de indicação: vem do link do amigo (?ref=CODIGO) ou é digitado; é opcional.
  const { ref: refParam } = useLocalSearchParams<{ ref?: string }>();
  const [codigoIndicacao, setCodigoIndicacao] = useState(refParam ? String(refParam).toUpperCase().replace(/[^A-Z0-9]/g, '') : '');
  const [papel, setPapel] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConf, setShowPasswordConf] = useState(false);
  const [aceitoTermos, setAceitoTermos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Volta o scroll pro topo sempre que troca de etapa
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

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

  // --- ABRIR TERMO DE COMPROMISSO (página dinâmica, sempre com a versão vigente) ---
  const handleAbrirTermos = () => {
    WebBrowser.openBrowserAsync(`${SITE_URL}/termos`)
      .catch(() => alertar('Erro', 'Não foi possível abrir o documento.'));
  };

  // --- VALIDAÇÃO POR ETAPA ---
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!name || !email || !cpfCnpj || !mobilePhone) {
        alertar('Atenção', 'Preencha nome, e-mail, CPF/CNPJ e celular para continuar.');
        return false;
      }
    }
    if (currentStep === 3) {
      if (!postalCode || !address || !addressNumber || !province || !city || !stateUf) {
        alertar('Atenção', 'Preencha todos os campos de endereço para continuar.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      router.replace('/');
    } else {
      setStep((s) => s - 1);
    }
  };

  // --- SUBMIT ---
  const handleCadastro = async () => {
    if (!name || !email || !cpfCnpj || !mobilePhone || !postalCode || !address || !addressNumber || !province || !city || !stateUf || !password) {
      alertar('Atenção', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (password !== passwordConfirmation) {
      alertar('Atenção', 'As senhas não coincidem.');
      return;
    }

    if (!aceitoTermos) {
      alertar('Atenção', 'Você precisa aceitar os Termos de Uso.');
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
        codigo_indicacao: codigoIndicacao || null,
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

      // A API já devolve token + usuário no cadastro: salva a sessão pra que a
      // pessoa entre logada e na área do próprio papel (cliente x proprietário).
      if (data.token) {
        await SecureStore.setItemAsync('userToken', data.token);
        await AsyncStorage.setItem('@waitless_token', data.token);
      }
      if (data.usuario) {
        await SecureStore.setItemAsync('userData', JSON.stringify(data.usuario));
      }

      alertar('Sucesso!', 'Conta criada com sucesso e carteira ativada.');
      router.replace(rotaInicialDoPapel(String(data.usuario?.papel || '').toLowerCase()) as never);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
      alertar('Falha no Cadastro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#000000" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Criar conta</Text>
              <Text style={styles.headerSubtitle}>{STEPS[step].subtitle}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* STEPPER */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepDotsRow}>
              {STEPS.map((s, idx) => (
                <React.Fragment key={s.title}>
                  <View style={[styles.stepDot, idx <= step && styles.stepDotActive]}>
                    {idx < step ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.stepDotText, idx <= step && styles.stepDotTextActive]}>{idx + 1}</Text>
                    )}
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={[styles.stepConnector, idx < step && styles.stepConnectorActive]} />
                  )}
                </React.Fragment>
              ))}
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
            </View>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* LOGO (só na primeira etapa) */}
            {step === 0 && (
              <View style={styles.logoContainer}>
                <Image source={require('../assets/logo_lokyva.png')} style={styles.logo} resizeMode="contain" />
              </View>
            )}

            <View style={styles.form}>

              <Text style={styles.sectionTitle}>{STEPS[step].title}</Text>

              {/* ETAPA 0 — PERFIL */}
              {step === 0 && (
                <View style={styles.profileCards}>
                  {PERFIS.map((item) => {
                    const isSelected = papel === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.profileCard, isSelected && styles.profileCardSelected]}
                        onPress={() => setPapel(item.value)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.profileCardIcon, isSelected && styles.profileCardIconSelected]}>
                          <Ionicons name={item.icon} size={22} color={isSelected ? '#FFFFFF' : AppColors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.profileCardTitle, isSelected && styles.profileCardTitleSelected]}>{item.label}</Text>
                          <Text style={styles.profileCardDesc}>{item.desc}</Text>
                        </View>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ETAPA 1 — DADOS PESSOAIS */}
              {step === 1 && (
                <>
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
                </>
              )}

              {/* ETAPA 2 — SOBRE VOCÊ */}
              {step === 2 && (
                <>
                  <Text style={styles.stepHint}>Esses dados são opcionais e só ajudam a personalizar sua experiência.</Text>

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
                </>
              )}

              {/* ETAPA 3 — ENDEREÇO */}
              {step === 3 && (
                <>
                  <View style={styles.rowInputs}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                      <Ionicons name="map-outline" size={20} color="#000000" style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="CEP" placeholderTextColor="#888" value={postalCode} onChangeText={handleCepChange} keyboardType="number-pad" />
                      {buscandoCep && <ActivityIndicator size="small" color={AppColors.primary} style={{ position: 'absolute', right: 15 }} />}
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
                </>
              )}

              {/* ETAPA 4 — SEGURANÇA */}
              {step === 4 && (
                <>
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

                  <View style={styles.inputContainer}>
                    <Ionicons name="gift-outline" size={20} color="#000000" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Código de indicação (opcional)" placeholderTextColor="#888" value={codigoIndicacao} onChangeText={(t) => setCodigoIndicacao(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={12} />
                  </View>

                  <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitoTermos(!aceitoTermos)}>
                    <View style={[styles.checkbox, aceitoTermos && styles.checkboxChecked]}>
                      {aceitoTermos && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.checkboxText}>
                      Eu aceito o{' '}
                      <Text style={styles.linkText} onPress={handleAbrirTermos}>Termo de Compromisso</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* NAVEGAÇÃO ENTRE ETAPAS */}
              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>Voltar</Text>
                  </TouchableOpacity>
                )}
                {step < STEPS.length - 1 ? (
                  <TouchableOpacity style={[styles.button, styles.navButtonFlex]} onPress={handleNext} activeOpacity={0.88}>
                    <Text style={styles.buttonText}>Continuar</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.button, styles.navButtonFlex]} onPress={handleCadastro} disabled={loading} activeOpacity={0.88}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
                  </TouchableOpacity>
                )}
              </View>

              {/* LINK LOGIN (só na primeira etapa) */}
              {step === 0 && (
                <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/')}>
                  <Text style={styles.loginLinkTextDesc}>Já tem uma conta? <Text style={styles.loginLinkText}>Entrar</Text></Text>
                </TouchableOpacity>
              )}

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
    marginBottom: 14
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
  stepperContainer: { paddingHorizontal: 24, marginBottom: 6 },
  stepDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: AppColors.primary },
  stepDotText: { fontSize: 11, fontWeight: '700', color: '#999999' },
  stepDotTextActive: { color: '#FFFFFF' },
  stepConnector: { flex: 1, height: 2, backgroundColor: '#EFEFEF', marginHorizontal: 4, maxWidth: 28 },
  stepConnectorActive: { backgroundColor: AppColors.primary },
  progressBarTrack: { height: 4, borderRadius: 2, backgroundColor: '#EFEFEF', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: AppColors.primary, borderRadius: 2 },
  logoContainer: { alignItems: 'center', marginBottom: 15, marginTop: 5 },
  logo: { width: 140, height: 48 },
  form: { flex: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 12,
    marginTop: 8
  },
  stepHint: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 14,
    marginTop: -4,
    lineHeight: 18,
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
  profileCards: { gap: 12, marginTop: 4 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  profileCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFF8F4',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  profileCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF1E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileCardIconSelected: { backgroundColor: AppColors.primary },
  profileCardTitle: { fontSize: 15, fontWeight: '700', color: '#111111' },
  profileCardTitleSelected: { color: AppColors.primary },
  profileCardDesc: { fontSize: 12.5, color: '#888888', marginTop: 2 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioOuterSelected: { borderColor: AppColors.primary },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: AppColors.primary },
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
  checkboxChecked: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  checkboxText: { fontSize: 14, color: '#444444' },
  linkText: { color: AppColors.primary, fontWeight: 'bold', textDecorationLine: 'underline' },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 10 },
  secondaryButton: {
    flex: 0.38,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  secondaryButtonText: { color: '#333333', fontSize: 16, fontWeight: '700' },
  navButtonFlex: { flex: 1, flexDirection: 'row' },
  button: {
    backgroundColor: AppColors.primary,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  loginLink: { alignItems: 'center', paddingVertical: 10 },
  loginLinkTextDesc: { color: '#666666', fontSize: 15 },
  loginLinkText: { color: AppColors.primary, fontWeight: 'bold' },
});
