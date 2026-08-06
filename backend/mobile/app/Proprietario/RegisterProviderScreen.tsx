import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal, // Adicionado para criar o select customizado
} from 'react-native';
import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// --- TIPAGENS ---
interface RegisterProviderProps {
  navigation?: any;
  userToken: string;
}

interface Estabelecimento {
  id: string | number;
  nome: string;
}

interface FormState {
  name: string;
  email: string;
  person_type: 'FISICA' | 'JURIDICA';
  document: string;
  birth_date: string;
  income_value: string;
  mobile_phone: string;
  postal_code: string;
  address: string;
  address_number: string;
  complement: string;
  province: string;
  company_type: string;
  responsible_name: string;
  responsible_cpf: string;
  pix_key_type: string;
  pix_key: string;
  estabelecimento_id: string;
  chave_pix_reserva: string;
}

interface ApiErrorResponse {
  error?: string;
}

// --- COMPONENTE SELECT CUSTOMIZADO (Substitui o Picker) ---
const CustomSelect = ({ 
  options, 
  selectedValue, 
  onValueChange, 
  placeholder = 'Selecione uma opção' 
}: { 
  options: { label: string, value: string }[], 
  selectedValue: string, 
  onValueChange: (value: string) => void,
  placeholder?: string
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedLabel = options.find(opt => opt.value === selectedValue)?.label || placeholder;

  return (
    <View>
      <TouchableOpacity 
        style={styles.selectButton} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.selectButtonText, !selectedValue && { color: '#999' }]}>
          {selectedLabel}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{placeholder}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.modalOption}
                  onPress={() => {
                    onValueChange(opt.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedValue === opt.value && styles.modalOptionTextSelected
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCancelBtn} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function RegisterProviderScreen({ navigation, userToken }: RegisterProviderProps) {
  // Configuração do Axios com Token
  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // Estados dos Estabelecimentos
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState<boolean>(true);

  // Estado do Processamento
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Estado do Formulário
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    person_type: 'FISICA',
    document: '',
    birth_date: '', 
    income_value: '',
    mobile_phone: '',
    postal_code: '',
    address: '',
    address_number: '',
    complement: '',
    province: '',
    company_type: 'MEI',
    responsible_name: '',
    responsible_cpf: '',
    pix_key_type: 'CPF',
    pix_key: '',
    estabelecimento_id: '',
    chave_pix_reserva: '',
  });

  // 1. Carregar Estabelecimentos do Usuário Logado
  useEffect(() => {
    fetchEstabelecimentos();
  }, []);

  const fetchEstabelecimentos = async () => {
    try {
      const response = await api.get('/mobile/estabelecimentos');
      if (response.data.success) {
        setEstabelecimentos(response.data.estabelecimentos || []);
      }
    } catch (error) {
      Alert.alert('Atenção', 'Não foi possível carregar seus estabelecimentos.');
    } finally {
      setLoadingEstabelecimentos(false);
    }
  };

  // Helper para atualizar os campos do formulário com tipagem segura
  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 2. Submeter Formulário
  const handleSubmit = async () => {
    // Validação local: PIX Reserva não pode ser igual ao PIX Principal
    if (
      form.chave_pix_reserva &&
      form.chave_pix_reserva.trim() === form.pix_key.trim()
    ) {
      Alert.alert(
        'Erro no PIX Reserva',
        'A chave PIX Reserva deve ser diferente da chave PIX Principal.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...form,
        // Limpa chave reserva se não selecionou um estabelecimento
        estabelecimento_id: form.estabelecimento_id || null,
        chave_pix_reserva: form.estabelecimento_id ? form.chave_pix_reserva : null,
      };

      const response = await api.post('/mobile/provider', payload);

      Alert.alert('Sucesso!', response.data.message || 'Perfil cadastrado com sucesso.', [
        {
          text: 'OK',
          onPress: () => navigation?.goBack(),
        },
      ]);
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      const errorMessage =
        axiosError.response?.data?.error ||
        'Ocorreu um erro ao realizar o cadastro. Verifique os dados informados.';
      
      Alert.alert('Falha no Cadastro', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Opções para os Selects
  const companyTypeOptions = [
    { label: 'MEI', value: 'MEI' },
    { label: 'EI', value: 'EI' },
    { label: 'EIRELI', value: 'EIRELI' },
    { label: 'LTDA', value: 'LTDA' },
    { label: 'SA', value: 'SA' },
    { label: 'Outro', value: 'ANY_OTHER' },
  ];

  const pixKeyTypeOptions = [
    { label: 'CPF', value: 'CPF' },
    { label: 'CNPJ', value: 'CNPJ' },
    { label: 'E-mail', value: 'EMAIL' },
    { label: 'Telefone', value: 'PHONE' },
    { label: 'Chave Aleatória', value: 'RANDOM' },
  ];

  const estabelecimentoOptions = [
    { label: 'Nenhum (Apenas Provedor)', value: '' },
    ...estabelecimentos.map((est) => ({ label: est.nome, value: String(est.id) })),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cadastro de Conta Financeira</Text>
      <Text style={styles.subtitle}>Configuração da sua conta de recebimento Asaas</Text>

      {/* --- SEÇÃO 1: TIPO DE PESSOA --- */}
      <Text style={styles.sectionTitle}>1. Tipo de Perfil</Text>
      <View style={styles.rowToggle}>
        <TouchableOpacity
          style={[styles.btnToggle, form.person_type === 'FISICA' && styles.btnToggleActive]}
          onPress={() => handleChange('person_type', 'FISICA')}
        >
          <Text style={[styles.txtToggle, form.person_type === 'FISICA' && styles.txtToggleActive]}>
            Pessoa Física
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnToggle, form.person_type === 'JURIDICA' && styles.btnToggleActive]}
          onPress={() => handleChange('person_type', 'JURIDICA')}
        >
          <Text style={[styles.txtToggle, form.person_type === 'JURIDICA' && styles.txtToggleActive]}>
            Pessoa Jurídica
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- SEÇÃO 2: DADOS PESSOAIS / EMPRESA --- */}
      <Text style={styles.sectionTitle}>2. Dados do Provedor</Text>

      <Text style={styles.label}>Nome Completo / Razão Social *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: João da Silva"
        value={form.name}
        onChangeText={(v: string) => handleChange('name', v)}
      />

      <Text style={styles.label}>E-mail *</Text>
      <TextInput
        style={styles.input}
        placeholder="exemplo@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={(v: string) => handleChange('email', v)}
      />

      <Text style={styles.label}>{form.person_type === 'FISICA' ? 'CPF *' : 'CNPJ *'}</Text>
      <TextInput
        style={styles.input}
        placeholder={form.person_type === 'FISICA' ? '000.000.000-00' : '00.000.000/0001-00'}
        keyboardType="numeric"
        value={form.document}
        onChangeText={(v: string) => handleChange('document', v)}
      />

      <Text style={styles.label}>Data de Nascimento *</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        value={form.birth_date}
        onChangeText={(v: string) => handleChange('birth_date', v)}
      />

      <Text style={styles.label}>Renda Mensal / Faturamento (R$) *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 2500,00"
        keyboardType="numeric"
        value={form.income_value}
        onChangeText={(v: string) => handleChange('income_value', v)}
      />

      <Text style={styles.label}>Celular com DDD *</Text>
      <TextInput
        style={styles.input}
        placeholder="(00) 90000-0000"
        keyboardType="phone-pad"
        value={form.mobile_phone}
        onChangeText={(v: string) => handleChange('mobile_phone', v)}
      />

      {/* CAMPOS CONDICIONAIS PARA PESSOA JURÍDICA */}
      {form.person_type === 'JURIDICA' && (
        <View style={styles.pjContainer}>
          <Text style={styles.pjTitle}>Dados Específicos da Empresa</Text>

          <Text style={styles.label}>Tipo de Empresa *</Text>
          <CustomSelect 
            options={companyTypeOptions}
            selectedValue={form.company_type}
            onValueChange={(v) => handleChange('company_type', v)}
            placeholder="Selecione o tipo de empresa"
          />

          <Text style={styles.label}>Nome do Responsável *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do sócio responsável"
            value={form.responsible_name}
            onChangeText={(v: string) => handleChange('responsible_name', v)}
          />

          <Text style={styles.label}>CPF do Responsável *</Text>
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            keyboardType="numeric"
            value={form.responsible_cpf}
            onChangeText={(v: string) => handleChange('responsible_cpf', v)}
          />
        </View>
      )}

      {/* --- SEÇÃO 3: ENDEREÇO --- */}
      <Text style={styles.sectionTitle}>3. Endereço</Text>

      <Text style={styles.label}>CEP *</Text>
      <TextInput
        style={styles.input}
        placeholder="00000-000"
        keyboardType="numeric"
        value={form.postal_code}
        onChangeText={(v: string) => handleChange('postal_code', v)}
      />

      <Text style={styles.label}>Logradouro (Rua/Avenida) *</Text>
      <TextInput
        style={styles.input}
        placeholder="Rua Exemplo"
        value={form.address}
        onChangeText={(v: string) => handleChange('address', v)}
      />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Número *</Text>
          <TextInput
            style={styles.input}
            placeholder="123"
            value={form.address_number}
            onChangeText={(v: string) => handleChange('address_number', v)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Bairro *</Text>
          <TextInput
            style={styles.input}
            placeholder="Centro"
            value={form.province}
            onChangeText={(v: string) => handleChange('province', v)}
          />
        </View>
      </View>

      <Text style={styles.label}>Complemento</Text>
      <TextInput
        style={styles.input}
        placeholder="Apto, Sala, Bloco (Opcional)"
        value={form.complement}
        onChangeText={(v: string) => handleChange('complement', v)}
      />

      {/* --- SEÇÃO 4: PIX PRINCIPAL --- */}
      <Text style={styles.sectionTitle}>4. Chave PIX Principal</Text>

      <Text style={styles.label}>Tipo de Chave *</Text>
      <CustomSelect 
        options={pixKeyTypeOptions}
        selectedValue={form.pix_key_type}
        onValueChange={(v) => handleChange('pix_key_type', v)}
        placeholder="Selecione o tipo de chave"
      />

      <Text style={styles.label}>Chave PIX Principal *</Text>
      <TextInput
        style={styles.input}
        placeholder="Informe sua chave PIX principal"
        value={form.pix_key}
        onChangeText={(v: string) => handleChange('pix_key', v)}
      />

      {/* --- SEÇÃO 5: ESTABELECIMENTO & PIX RESERVA (OPCIONAL) --- */}
      <Text style={styles.sectionTitle}>5. Estabelecimento e PIX Reserva (Opcional)</Text>

      <Text style={styles.label}>Vincular a um Estabelecimento</Text>
      {loadingEstabelecimentos ? (
        <ActivityIndicator size="small" color="#0066CC" style={{ marginVertical: 10 }} />
      ) : (
        <CustomSelect 
          options={estabelecimentoOptions}
          selectedValue={form.estabelecimento_id}
          onValueChange={(v) => handleChange('estabelecimento_id', v)}
          placeholder="Selecione um estabelecimento"
        />
      )}

      {/* Se selecionou um estabelecimento, libera o campo do PIX Reserva */}
      {!!form.estabelecimento_id && (
        <>
          <Text style={styles.label}>Chave PIX Reserva (Deve ser diferente da Principal)</Text>
          <TextInput
            style={styles.input}
            placeholder="Chave PIX alternativa/reserva"
            value={form.chave_pix_reserva}
            onChangeText={(v: string) => handleChange('chave_pix_reserva', v)}
          />
        </>
      )}

      {/* BOTÃO SUBMIT */}
      <TouchableOpacity
        style={[styles.btnSubmit, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnSubmitText}>Cadastrar Conta Financeira</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0066CC', marginTop: 20, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 5, marginTop: 8 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  
  // Estilos do Select Customizado
  selectButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#0066CC',
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    marginTop: 15,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 15,
  },

  rowToggle: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btnToggle: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0066CC',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  btnToggleActive: { backgroundColor: '#0066CC' },
  txtToggle: { color: '#0066CC', fontWeight: 'bold' },
  txtToggleActive: { color: '#FFF' },
  pjContainer: {
    backgroundColor: '#EBF3FA',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  pjTitle: { fontWeight: 'bold', color: '#004488', marginBottom: 5 },
  row: { flexDirection: 'row' },
  btnSubmit: {
    backgroundColor: '#00A859',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  btnDisabled: { opacity: 0.6 },
  btnSubmitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});