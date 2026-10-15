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

// Visual de cada etapa: nome curto no indicador e o aviso em cartão no topo da etapa.
const ETAPAS_VISUAIS: { curto: string; titulo: string; texto: string; icone: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { curto: 'Perfil', titulo: 'Bem-vindo à Lokyva', texto: 'Conte como você vai usar o app. Dá para mudar depois.', icone: 'sparkles-outline' },
  { curto: 'Dados', titulo: 'Seus dados', texto: 'Usados para pagamentos, contratos e para falar com você.', icone: 'person-outline' },
  { curto: 'Sobre', titulo: 'Sobre você', texto: 'Opcional: aparece no seu perfil e ajuda a te conhecer.', icone: 'chatbubble-ellipses-outline' },
  { curto: 'Endereço', titulo: 'Seu endereço', texto: 'Digite o CEP e completamos o resto para você.', icone: 'location-outline' },
  { curto: 'Senha', titulo: 'Quase lá', texto: 'Crie sua senha e aceite o termo para terminar.', icone: 'shield-checkmark-outline' },
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

  const etapa = ETAPAS_VISUAIS[step];
  const ehProprietario = papel === 'proprietario';

  // Campo com rótulo em cima e ícone à esquerda (padrão das telas novas do app).
  const rotulo = (texto: string, opcional = false) => (
    <Text style={styles.fieldLabel}>
      {texto}
      {opcional && <Text style={styles.fieldLabelOpcional}> (opcional)</Text>}
    </Text>
  );

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

          {/* HEADER: seta, título no centro e ajuda (mesmo padrão de "Contestar estorno") */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={AppColors.ink} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Criar conta</Text>
            <TouchableOpacity
              onPress={() => alertar('Precisa de ajuda?', 'Preencha uma etapa por vez. Você pode voltar e corrigir qualquer dado antes de criar a conta. Seus dados são usados só para sua conta, pagamentos e contratos.')}
              style={styles.headerBtn}
              hitSlop={10}
            >
              <Ionicons name="help-circle-outline" size={26} color={AppColors.ink} />
            </TouchableOpacity>
          </View>

          {/* ETAPAS: bolinhas com check e o nome embaixo (mesmo padrão da tela de Pagamento) */}
          <View style={styles.stepper}>
            {ETAPAS_VISUAIS.map((e, idx) => {
              const feita = idx < step;
              const atual = idx === step;
              return (
                <React.Fragment key={e.curto}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepDot, (feita || atual) && styles.stepDotActive]}>
                      {feita ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.stepDotText, atual && styles.stepDotTextActive]}>{idx + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepLabel, (feita || atual) && styles.stepLabelActive]} numberOfLines={1}>{e.curto}</Text>
                  </View>
                  {idx < ETAPAS_VISUAIS.length - 1 && <View style={[styles.stepConnector, feita && styles.stepConnectorActive]} />}
                </React.Fragment>
              );
            })}
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* AVISO DA ETAPA: cartão laranja-claro com ícone (padrão "Explique o que aconteceu") */}
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name={etapa.icone} size={24} color={AppColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{etapa.titulo}</Text>
                <Text style={styles.bannerText}>{etapa.texto}</Text>
              </View>
            </View>

            {/* ETAPA 0 — PERFIL */}
            {step === 0 && (
              <>
                {rotulo('Como você vai usar a Lokyva')}
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
                          <Text style={styles.profileCardTitle}>{item.label}</Text>
                          <Text style={styles.profileCardDesc}>{item.desc}</Text>
                        </View>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {ehProprietario && (
                  <View style={styles.cnpjBox}>
                    <Text style={styles.cnpjTitulo}>Tem CNPJ? Veja o que muda</Text>
                    <View style={styles.cnpjItem}>
                      <Ionicons name="storefront-outline" size={18} color={AppColors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cnpjItemTitulo}>Sem CNPJ</Text>
                        <Text style={styles.cnpjItemTexto}>Você usa a Lokyva normalmente. O cliente paga no local.</Text>
                      </View>
                    </View>
                    <View style={styles.cnpjItem}>
                      <Ionicons name="card-outline" size={18} color={AppColors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cnpjItemTitulo}>Com CNPJ (MEI serve)</Text>
                        <Text style={styles.cnpjItemTexto}>Você recebe pagamento online (Pix, cartão e boleto), tem carteira e aparece antes nas buscas.</Text>
                      </View>
                    </View>
                    <Text style={styles.cnpjRodape}>Pode começar sem CNPJ e cadastrar depois.</Text>
                  </View>
                )}
              </>
            )}

            {/* ETAPA 1 — DADOS PESSOAIS */}
            {step === 1 && (
              <>
                {rotulo('Nome completo')}
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Como está no seu documento" placeholderTextColor={AppColors.textFaint} value={name} onChangeText={(t) => setName(capitalizeFirst(t))} autoCapitalize="words" />
                </View>

                {rotulo('E-mail')}
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={AppColors.textFaint} value={email} onChangeText={(t) => setEmail(sanitizeInput(t))} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    {rotulo('CPF ou CNPJ')}
                    <View style={styles.inputContainer}>
                      <Ionicons name="id-card-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Só números" placeholderTextColor={AppColors.textFaint} value={cpfCnpj} onChangeText={(t) => setCpfCnpj(maskCPF(t))} keyboardType="number-pad" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    {rotulo('Celular')}
                    <View style={styles.inputContainer}>
                      <Ionicons name="call-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="(00) 00000-0000" placeholderTextColor={AppColors.textFaint} value={mobilePhone} onChangeText={(t) => setMobilePhone(maskPhone(t))} keyboardType="phone-pad" />
                    </View>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    {rotulo('Telefone fixo', true)}
                    <View style={styles.inputContainer}>
                      <Ionicons name="call-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="(00) 0000-0000" placeholderTextColor={AppColors.textFaint} value={phone} onChangeText={(t) => setPhone(maskPhone(t))} keyboardType="phone-pad" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    {rotulo('Nascimento')}
                    <View style={styles.inputContainer}>
                      <Ionicons name="calendar-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor={AppColors.textFaint} value={birthDate} onChangeText={(t) => setBirthDate(maskDate(t))} keyboardType="number-pad" />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* ETAPA 2 — SOBRE VOCÊ */}
            {step === 2 && (
              <>
                {rotulo('Sua profissão', true)}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                  {OPCOES_PROFISSAO.map((item) => (
                    <TouchableOpacity key={item} style={[styles.chip, profissao === item && styles.chipSelected]} onPress={() => setProfissao(item)}>
                      <Text style={[styles.chipText, profissao === item && styles.chipTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.inputContainer}>
                  <Ionicons name="briefcase-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Ou digite sua profissão" placeholderTextColor={AppColors.textFaint} value={profissao} onChangeText={(t) => setProfissao(capitalizeFirst(t))} autoCapitalize="sentences" />
                </View>

                {rotulo('Onde estudei', true)}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                  {OPCOES_ONDE_ESTUDEI.map((item) => (
                    <TouchableOpacity key={item} style={[styles.chip, ondeEstudei === item && styles.chipSelected]} onPress={() => setOndeEstudei(item)}>
                      <Text style={[styles.chipText, ondeEstudei === item && styles.chipTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.inputContainer}>
                  <Ionicons name="school-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Ou digite a instituição" placeholderTextColor={AppColors.textFaint} value={ondeEstudei} onChangeText={(t) => setOndeEstudei(capitalizeFirst(t))} autoCapitalize="sentences" />
                </View>

                {rotulo('Onde moro', true)}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                  {OPCOES_ONDE_MORO.map((item) => (
                    <TouchableOpacity key={item} style={[styles.chip, ondeMoro === item && styles.chipSelected]} onPress={() => setOndeMoro(item)}>
                      <Text style={[styles.chipText, ondeMoro === item && styles.chipTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.inputContainer}>
                  <Ionicons name="home-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Ou digite outro tipo" placeholderTextColor={AppColors.textFaint} value={ondeMoro} onChangeText={(t) => setOndeMoro(capitalizeFirst(t))} autoCapitalize="sentences" />
                </View>

                {rotulo('Idiomas', true)}
                <View style={styles.inputContainer}>
                  <Ionicons name="language-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Ex: Português, Inglês" placeholderTextColor={AppColors.textFaint} value={idiomas} onChangeText={(t) => setIdiomas(capitalizeFirst(t))} autoCapitalize="sentences" />
                </View>

                {rotulo('Sobre mim', true)}
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Conte um pouco sobre você e seus interesses."
                    placeholderTextColor={AppColors.textFaint}
                    value={sobreMim}
                    onChangeText={(t) => setSobreMim(capitalizeFirst(t).slice(0, 1000))}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoCapitalize="sentences"
                  />
                  <Text style={styles.contador}>{sobreMim.length}/1000</Text>
                </View>
              </>
            )}

            {/* ETAPA 3 — ENDEREÇO */}
            {step === 3 && (
              <>
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    {rotulo('CEP')}
                    <View style={styles.inputContainer}>
                      <Ionicons name="map-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="00000-000" placeholderTextColor={AppColors.textFaint} value={postalCode} onChangeText={handleCepChange} keyboardType="number-pad" />
                      {buscandoCep && <ActivityIndicator size="small" color={AppColors.primary} />}
                    </View>
                  </View>
                  <View style={{ flex: 1.3 }}>
                    {rotulo('Cidade / UF')}
                    <View style={[styles.inputContainer, styles.inputBloqueado]}>
                      <TextInput style={styles.input} placeholder="Preenche pelo CEP" placeholderTextColor={AppColors.textFaint} value={city ? `${city} - ${stateUf}` : ''} editable={false} />
                    </View>
                  </View>
                </View>

                {rotulo('Rua / avenida')}
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Nome da rua" placeholderTextColor={AppColors.textFaint} value={address} onChangeText={(t) => setAddress(capitalizeFirst(t))} autoCapitalize="words" />
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    {rotulo('Número')}
                    <View style={styles.inputContainer}>
                      <TextInput style={styles.input} placeholder="Nº" placeholderTextColor={AppColors.textFaint} value={addressNumber} onChangeText={(t) => setAddressNumber(sanitizeInput(t))} />
                    </View>
                  </View>
                  <View style={{ flex: 1.3 }}>
                    {rotulo('Bairro')}
                    <View style={styles.inputContainer}>
                      <TextInput style={styles.input} placeholder="Bairro" placeholderTextColor={AppColors.textFaint} value={province} onChangeText={(t) => setProvince(capitalizeFirst(t))} autoCapitalize="words" />
                    </View>
                  </View>
                </View>

                {rotulo('Complemento', true)}
                <View style={styles.inputContainer}>
                  <Ionicons name="add-circle-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Apto, bloco, referência" placeholderTextColor={AppColors.textFaint} value={complement} onChangeText={(t) => setComplement(capitalizeFirst(t))} autoCapitalize="sentences" />
                </View>
              </>
            )}

            {/* ETAPA 4 — SEGURANÇA */}
            {step === 4 && (
              <>
                {rotulo('Senha')}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Crie uma senha" placeholderTextColor={AppColors.textFaint} value={password} onChangeText={(t) => setPassword(sanitizeInput(t))} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={AppColors.textMuted} />
                  </TouchableOpacity>
                </View>

                {rotulo('Confirmar senha')}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Repita a senha" placeholderTextColor={AppColors.textFaint} value={passwordConfirmation} onChangeText={(t) => setPasswordConfirmation(sanitizeInput(t))} secureTextEntry={!showPasswordConf} />
                  <TouchableOpacity onPress={() => setShowPasswordConf(!showPasswordConf)} style={styles.eyeIcon}>
                    <Ionicons name={showPasswordConf ? 'eye-off-outline' : 'eye-outline'} size={20} color={AppColors.textMuted} />
                  </TouchableOpacity>
                </View>
                {!!passwordConfirmation && passwordConfirmation !== password && (
                  <Text style={styles.erroCampo}>As senhas não são iguais.</Text>
                )}

                {rotulo('Código de indicação', true)}
                <View style={styles.inputContainer}>
                  <Ionicons name="gift-outline" size={20} color={AppColors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Código de um amigo: vocês ganham pontos" placeholderTextColor={AppColors.textFaint} value={codigoIndicacao} onChangeText={(t) => setCodigoIndicacao(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={12} />
                </View>

                <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAceitoTermos(!aceitoTermos)} activeOpacity={0.8}>
                  <View style={[styles.checkbox, aceitoTermos && styles.checkboxChecked]}>
                    {aceitoTermos && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    Li e aceito o{' '}
                    <Text style={styles.linkText} onPress={handleAbrirTermos}>Termo de Compromisso</Text>
                    {' '}da Lokyva.
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* DADOS PROTEGIDOS (padrão "Seus dados estão protegidos") */}
            <View style={styles.protegido}>
              <Ionicons name="lock-closed-outline" size={22} color={AppColors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.protegidoTitulo}>Seus dados estão protegidos</Text>
                <Text style={styles.protegidoTexto}>Usamos suas informações só para sua conta, pagamentos e contratos.</Text>
              </View>
            </View>

            {/* BOTÕES: principal cheio e secundário com contorno (padrão "Enviar" / "Cancelar") */}
            {step < STEPS.length - 1 ? (
              <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.88}>
                <Text style={styles.buttonText}>Continuar</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleCadastro} disabled={loading} activeOpacity={0.88}>
                {loading ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Criar minha conta</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
            </TouchableOpacity>

            {step === 0 && (
              <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/')}>
                <Text style={styles.loginLinkTextDesc}>Já tem uma conta? <Text style={styles.loginLinkText}>Entrar</Text></Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 35 : 6,
    marginBottom: 14,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: AppColors.ink },

  stepper: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 16 },
  stepItem: { alignItems: 'center', width: 58 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AppColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  stepDotText: { fontSize: 11, fontWeight: '800', color: AppColors.textFaint },
  stepDotTextActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 11, color: AppColors.textFaint, marginTop: 6, fontWeight: '600' },
  stepLabelActive: { color: AppColors.ink },
  stepConnector: { flex: 1, height: 2, backgroundColor: AppColors.line, marginTop: 12, marginHorizontal: -10 },
  stepConnectorActive: { backgroundColor: AppColors.primary },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF4EC',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: AppColors.ink },
  bannerText: { fontSize: 13, color: AppColors.textMuted, marginTop: 3, lineHeight: 18 },

  fieldLabel: { fontSize: 14, fontWeight: '700', color: AppColors.ink, marginBottom: 8 },
  fieldLabelOpcional: { fontWeight: '500', color: AppColors.textFaint },
  chipScrollView: { flexDirection: 'row', marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: AppColors.line,
    marginRight: 8,
  },
  chipSelected: { backgroundColor: AppColors.primaryLight, borderColor: AppColors.primary },
  chipText: { fontSize: 13, color: AppColors.textMuted, fontWeight: '600' },
  chipTextSelected: { color: AppColors.primary, fontWeight: '800' },

  profileCards: { gap: 12, marginBottom: 16 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.line,
    padding: 16,
  },
  profileCardSelected: { borderColor: AppColors.primary, backgroundColor: '#FFF8F3' },
  profileCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AppColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileCardIconSelected: { backgroundColor: AppColors.primary },
  profileCardTitle: { fontSize: 15, fontWeight: '800', color: AppColors.ink },
  profileCardDesc: { fontSize: 12.5, color: AppColors.textMuted, marginTop: 2 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: AppColors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioOuterSelected: { borderColor: AppColors.primary, backgroundColor: AppColors.primary },

  cnpjBox: { backgroundColor: '#FFF4EC', borderRadius: 16, padding: 14, gap: 10, marginBottom: 8 },
  cnpjTitulo: { fontSize: 14, fontWeight: '800', color: AppColors.ink },
  cnpjItem: { flexDirection: 'row', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12 },
  cnpjItemTitulo: { fontSize: 13, fontWeight: '800', color: AppColors.ink },
  cnpjItemTexto: { fontSize: 12.5, color: AppColors.textMuted, lineHeight: 17, marginTop: 2 },
  cnpjRodape: { fontSize: 12, color: AppColors.textMuted },

  rowInputs: { flexDirection: 'row', gap: 12 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.line,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  inputBloqueado: { backgroundColor: AppColors.canvas },
  textAreaContainer: { height: 'auto', minHeight: 120, alignItems: 'flex-start', paddingVertical: 12, flexDirection: 'column' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: AppColors.ink, height: '100%' },
  textArea: { width: '100%', minHeight: 80, textAlignVertical: 'top' },
  contador: { alignSelf: 'flex-end', fontSize: 12, color: AppColors.textFaint },
  eyeIcon: { padding: 5 },
  erroCampo: { color: '#DC2626', fontSize: 12, marginTop: -10, marginBottom: 12 },

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: AppColors.line,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  checkboxText: { flex: 1, fontSize: 14, color: AppColors.inkSoft, lineHeight: 20 },
  linkText: { color: AppColors.primary, fontWeight: '800' },

  protegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8F3',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    marginBottom: 20,
  },
  protegidoTitulo: { fontSize: 14, fontWeight: '800', color: AppColors.ink },
  protegidoTexto: { fontSize: 12.5, color: AppColors.textMuted, marginTop: 2 },

  button: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: AppColors.primary, fontSize: 16, fontWeight: '800' },
  loginLink: { alignItems: 'center', paddingVertical: 16 },
  loginLinkTextDesc: { color: AppColors.textMuted, fontSize: 15 },
  loginLinkText: { color: AppColors.primary, fontWeight: '800' },
});
