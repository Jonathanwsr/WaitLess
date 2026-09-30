import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { alertar } from '../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const BASE_URL = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
const API_URL = `${BASE_URL}/provider`;

interface Provider {
  id: number;
  name: string;
  email: string;
  asaas_wallet_id: string | null;
  asaas_status: string | null;
  pix_key_type: string;
  pix_key: string;
}

const FORM_INICIAL = {
  name: '',
  email: '',
  person_type: 'FISICA' as 'FISICA' | 'JURIDICA',
  document: '',
  birth_date: '',
  income_value: '',
  mobile_phone: '',
  postal_code: '',
  address: '',
  address_number: '',
  complement: '',
  province: '',
  company_type: '',
  responsible_name: '',
  responsible_cpf: '',
  pix_key_type: 'CPF',
  pix_key: '',
};

const OPCOES_TIPO_EMPRESA = [
  { label: 'MEI', value: 'MEI' },
  { label: 'Empresário Individual', value: 'EI' },
  { label: 'EIRELI', value: 'EIRELI' },
  { label: 'LTDA', value: 'LTDA' },
  { label: 'S/A', value: 'SA' },
  { label: 'Outro', value: 'ANY_OTHER' },
];

const OPCOES_TIPO_PIX = [
  { label: 'CPF', value: 'CPF' },
  { label: 'CNPJ', value: 'CNPJ' },
  { label: 'E-mail', value: 'EMAIL' },
  { label: 'Telefone', value: 'PHONE' },
  { label: 'Aleatória', value: 'RANDOM' },
];

function CampoSelect({ label, opcoes, valor, onSelecionar }: {
  label: string;
  opcoes: { label: string; value: string }[];
  valor: string;
  onSelecionar: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionado = opcoes.find((o) => o.value === valor);

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setAberto(true)}>
        <Text style={[styles.selectBtnText, !selecionado && { color: '#A0A2A8' }]}>
          {selecionado ? selecionado.label : `Selecione ${label.toLowerCase()}`}
        </Text>
        <Feather name="chevron-down" size={18} color="#6A6C72" />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <TouchableOpacity style={styles.selectOverlay} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={styles.selectModal}>
            <Text style={styles.selectModalTitulo}>{label}</Text>
            {opcoes.map((op) => (
              <TouchableOpacity
                key={op.value}
                style={styles.selectOpcao}
                onPress={() => { onSelecionar(op.value); setAberto(false); }}
              >
                <Text style={[styles.selectOpcaoText, valor === op.value && { color: '#00A868', fontWeight: '800' }]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function RegisterProviderScreen() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const getToken = async () => {
    return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
  };

  const carregar = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/autenticacao/login' as never);
        return;
      }
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      setProvider(json.has_profile ? json.provider : null);
    } catch (e) {
      // segue com provider nulo — mostra o formulário de criação
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizar = (campo: keyof typeof FORM_INICIAL, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  // keyboardType só troca o teclado exibido — não bloqueia colar texto nem
  // digitar por teclado físico. Como esta tela cria uma conta de recebimento
  // de verdade no gateway de pagamento, filtramos os campos sensíveis aqui.
  const atualizarSoNumeros = (campo: keyof typeof FORM_INICIAL, valor: string, tamanhoMax: number) => {
    atualizar(campo, valor.replace(/\D/g, '').slice(0, tamanhoMax));
  };

  const atualizarValorMonetario = (campo: keyof typeof FORM_INICIAL, valor: string) => {
    atualizar(campo, valor.replace(/[^0-9,]/g, ''));
  };

  const atualizarDataNascimento = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 8);
    let formatado = digitos;
    if (digitos.length > 4) formatado = `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}${digitos.length > 6 ? '-' + digitos.slice(6, 8) : ''}`;
    atualizar('birth_date', formatado);
  };

  const salvar = async () => {
    const obrigatorios: (keyof typeof FORM_INICIAL)[] = [
      'name', 'email', 'document', 'birth_date', 'income_value', 'mobile_phone',
      'postal_code', 'address', 'address_number', 'province', 'pix_key',
    ];
    const faltando = obrigatorios.some((campo) => !form[campo]?.trim());
    if (faltando) {
      alertar('Campos obrigatórios', 'Preencha todos os campos para ativar sua carteira.');
      return;
    }
    if (form.person_type === 'JURIDICA' && (!form.company_type || !form.responsible_name || !form.responsible_cpf)) {
      alertar('Campos obrigatórios', 'Preencha os dados da empresa (tipo, responsável e CPF do responsável).');
      return;
    }

    setEnviando(true);
    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok) {
        alertar('Erro', json?.error || 'Não foi possível ativar sua carteira agora.');
        return;
      }

      alertar('Carteira ativada!', 'Sua carteira digital foi criada com sucesso. Enviamos um e-mail de confirmação.');
      setProvider(json.provider);
    } catch (e) {
      alertar('Erro', 'Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color='#FF7A00' />
      </View>
    );
  }

  const carteiraAtiva = provider?.asaas_status === 'APPROVED' && provider?.asaas_wallet_id;
  const carteiraPendente = provider && provider.asaas_status !== 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#3A3A3A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carteira Digital</Text>
        <View style={{ width: 40 }} />
      </View>

      {carteiraAtiva ? (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingVertical: 24 }}>
          <View style={styles.statusCardAtiva}>
            <View style={styles.statusIconBox}>
              <Feather name="check-circle" size={32} color="#00A868" />
            </View>
            <Text style={styles.statusTitulo}>Carteira Ativa</Text>
            <Text style={styles.statusDesc}>Você já pode receber seus pagamentos online direto na sua conta.</Text>
            <View style={styles.walletIdBox}>
              <Text style={styles.walletIdLabel}>ID da Carteira (Wallet ID)</Text>
              <Text style={styles.walletIdValor}>{provider?.asaas_wallet_id}</Text>
            </View>
            <View style={styles.walletIdBox}>
              <Text style={styles.walletIdLabel}>Chave Pix cadastrada</Text>
              <Text style={styles.walletIdValor}>{provider?.pix_key} ({provider?.pix_key_type})</Text>
            </View>
          </View>
        </ScrollView>
      ) : carteiraPendente ? (
        <View style={styles.centerState}>
          <View style={styles.statusIconBoxPendente}>
            <Feather name="clock" size={32} color="#D97706" />
          </View>
          <Text style={styles.statusTitulo}>Carteira em Análise</Text>
          <Text style={styles.statusDesc}>Seus dados já foram enviados e estão em análise. Assim que aprovada, você poderá receber pagamentos por aqui.</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.introBox}>
            <View style={styles.introIconBox}>
              <Feather name="credit-card" size={26} color="#282828" />
            </View>
            <Text style={styles.introTitulo}>Crie sua carteira para receber seus pagamentos online direto na sua conta</Text>
            <Text style={styles.introDesc}>Preencha os dados abaixo para gerar sua carteira digital (Wallet ID) e começar a receber os repasses das suas reservas via Pix.</Text>
            <View style={styles.porQue}>
              <Text style={styles.porQueTitulo}>Por que preciso informar estes dados de novo?</Text>
              <Text style={styles.porQueTexto}>
                Seu cadastro no app serve para entrar na conta. Para receber dinheiro, abrimos uma conta de recebimento em seu nome numa processadora de pagamentos regulamentada, e ela exige a identificação completa de quem recebe. É uma regra do sistema financeiro para evitar fraudes. A conta fica no seu CPF/CNPJ e os repasses só saem para contas do mesmo titular.
              </Text>
              <Text style={styles.porQueTitulo}>O que acontece depois de enviar</Text>
              <Text style={styles.porQueTexto}>
                {'• Sua conta de recebimento é criada e seus clientes já podem pagar online.\n• Sua Carteira passa a funcionar: você vê o dia e o valor do próximo repasse, o que já entrou, as taxas e os valores estornados.\n• Você preenche uma vez só; os dados são usados apenas para abrir e manter a conta.'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Dados pessoais</Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, form.person_type === 'FISICA' && styles.toggleBtnAtivo]}
              onPress={() => atualizar('person_type', 'FISICA')}
            >
              <Text style={[styles.toggleText, form.person_type === 'FISICA' && styles.toggleTextAtivo]}>Pessoa Física</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, form.person_type === 'JURIDICA' && styles.toggleBtnAtivo]}
              onPress={() => atualizar('person_type', 'JURIDICA')}
            >
              <Text style={[styles.toggleText, form.person_type === 'JURIDICA' && styles.toggleTextAtivo]}>Pessoa Jurídica</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nome completo {form.person_type === 'JURIDICA' ? '(Razão Social)' : ''}</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={(v) => atualizar('name', v)} placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>E-mail</Text>
          <TextInput style={styles.input} value={form.email} onChangeText={(v) => atualizar('email', v)} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>{form.person_type === 'JURIDICA' ? 'CNPJ' : 'CPF'}</Text>
          <TextInput style={styles.input} value={form.document} onChangeText={(v) => atualizarSoNumeros('document', v, 14)} placeholder="Somente números" keyboardType="number-pad" placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Data de nascimento</Text>
          <TextInput style={styles.input} value={form.birth_date} onChangeText={atualizarDataNascimento} placeholder="AAAA-MM-DD" keyboardType="number-pad" placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Renda mensal (R$)</Text>
          <TextInput style={styles.input} value={form.income_value} onChangeText={(v) => atualizarValorMonetario('income_value', v)} placeholder="Ex: 3000,00" keyboardType="decimal-pad" placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Celular</Text>
          <TextInput style={styles.input} value={form.mobile_phone} onChangeText={(v) => atualizarSoNumeros('mobile_phone', v, 11)} placeholder="Somente números com DDD" keyboardType="phone-pad" placeholderTextColor="#A0A2A8" />

          {form.person_type === 'JURIDICA' && (
            <>
              <Text style={styles.label}>Tipo de empresa</Text>
              <CampoSelect label="Tipo de empresa" opcoes={OPCOES_TIPO_EMPRESA} valor={form.company_type} onSelecionar={(v) => atualizar('company_type', v)} />

              <Text style={styles.label}>Nome do responsável</Text>
              <TextInput style={styles.input} value={form.responsible_name} onChangeText={(v) => atualizar('responsible_name', v)} placeholderTextColor="#A0A2A8" />

              <Text style={styles.label}>CPF do responsável</Text>
              <TextInput style={styles.input} value={form.responsible_cpf} onChangeText={(v) => atualizarSoNumeros('responsible_cpf', v, 11)} keyboardType="number-pad" placeholderTextColor="#A0A2A8" />
            </>
          )}

          <Text style={styles.sectionLabel}>Endereço</Text>

          <Text style={styles.label}>CEP</Text>
          <TextInput style={styles.input} value={form.postal_code} onChangeText={(v) => atualizarSoNumeros('postal_code', v, 8)} keyboardType="number-pad" placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Bairro</Text>
          <TextInput style={styles.input} value={form.province} onChangeText={(v) => atualizar('province', v)} placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Endereço</Text>
          <TextInput style={styles.input} value={form.address} onChangeText={(v) => atualizar('address', v)} placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Número</Text>
          <TextInput style={styles.input} value={form.address_number} onChangeText={(v) => atualizar('address_number', v)} placeholderTextColor="#A0A2A8" />

          <Text style={styles.label}>Complemento</Text>
          <TextInput style={styles.input} value={form.complement} onChangeText={(v) => atualizar('complement', v)} placeholderTextColor="#A0A2A8" />

          <Text style={styles.sectionLabel}>Chave Pix para recebimento</Text>

          <Text style={styles.label}>Tipo de chave</Text>
          <CampoSelect label="Tipo de chave" opcoes={OPCOES_TIPO_PIX} valor={form.pix_key_type} onSelecionar={(v) => atualizar('pix_key_type', v)} />

          <Text style={styles.label}>Chave Pix</Text>
          <TextInput style={styles.input} value={form.pix_key} onChangeText={(v) => atualizar('pix_key', v)} placeholderTextColor="#A0A2A8" />

          <TouchableOpacity style={styles.salvarBtn} onPress={salvar} disabled={enviando}>
            {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.salvarBtnText}>Ativar Carteira</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  porQue: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 16, marginTop: 14 },
  porQueTitulo: { fontSize: 14, fontWeight: '800', color: '#282828', marginTop: 2 },
  porQueTexto: { fontSize: 13, color: '#6A6C72', lineHeight: 20, marginTop: 4, marginBottom: 10 },
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  container: { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F2',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F2', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#282828' },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  introBox: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 8 },
  introIconBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#F0F0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  introTitulo: { fontSize: 18, fontWeight: '800', color: '#282828', textAlign: 'center', marginBottom: 8, lineHeight: 24 },
  introDesc: { fontSize: 13, color: '#6A6C72', textAlign: 'center', lineHeight: 19 },

  statusCardAtiva: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  statusIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statusIconBoxPendente: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statusTitulo: { fontSize: 19, fontWeight: '800', color: '#282828', marginBottom: 8, textAlign: 'center' },
  statusDesc: { fontSize: 13, color: '#6A6C72', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  walletIdBox: { width: '100%', backgroundColor: '#F5F5F5', borderRadius: 14, padding: 14, marginTop: 8 },
  walletIdLabel: { fontSize: 10, fontWeight: '800', color: '#A0A2A8', textTransform: 'uppercase', marginBottom: 4 },
  walletIdValor: { fontSize: 14, fontWeight: '700', color: '#282828' },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#282828', textTransform: 'uppercase', marginTop: 20, marginBottom: 10, letterSpacing: 0.3 },
  label: { fontSize: 12, fontWeight: '800', color: '#6A6C72', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7E9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#282828' },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  toggleBtnAtivo: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  toggleText: { fontSize: 13, fontWeight: '800', color: '#6A6C72' },
  toggleTextAtivo: { color: '#FFFFFF' },

  selectBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7E9', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectBtnText: { fontSize: 14, color: '#282828' },
  selectOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  selectModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  selectModalTitulo: { fontSize: 16, fontWeight: '800', color: '#282828', marginBottom: 14 },
  selectOpcao: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  selectOpcaoText: { fontSize: 14, color: '#282828' },

  salvarBtn: { backgroundColor: '#12A150', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  salvarBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
