import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { alertar } from '../../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const C = {
  ink: '#282828',
  muted: '#6A6C72',
  faint: '#A0A2A8',
  canvas: '#F5F5F5',
  line: '#E6E7E9',
  white: '#FFFFFF',
  fieldBg: '#F5F5F5',
  danger: '#DC2626',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

const soDigitos = (v: string) => v.replace(/\D/g, '');

const mascaraTelefone = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const mascaraData = (v: string) => {
  const d = soDigitos(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const mascaraCep = (v: string) => {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const isoParaBR = (iso?: string | null) => {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
};

const brParaISO = (br: string) => {
  const [dia, mes, ano] = br.split('/');
  return dia && mes && ano && ano.length === 4 ? `${ano}-${mes}-${dia}` : null;
};

const mascararDocumento = (doc?: string | null) => {
  const d = soDigitos(doc || '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.***/****-${d.slice(12)}`;
  return doc || '';
};

interface CampoProps {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  hint?: string;
}

function Campo({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline, maxLength, editable = true, hint }: CampoProps) {
  return (
    <View style={styles.campo}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti, !editable && styles.inputLocked]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export default function EditarPerfil() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [email, setEmail] = useState('');
  const [documento, setDocumento] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [profissao, setProfissao] = useState('');
  const [idiomas, setIdiomas] = useState('');
  const [ondeEstudei, setOndeEstudei] = useState('');
  const [ondeMoro, setOndeMoro] = useState('');
  const [sobreMim, setSobreMim] = useState('');

  const preencher = useCallback((u: any) => {
    setEmail(u.email || '');
    setDocumento(u.cpf_cnpj || '');
    setNome(u.name || '');
    setTelefone(mascaraTelefone(u.telefone || ''));
    setDataNascimento(isoParaBR(u.data_nascimento));
    setCep(mascaraCep(u.cep || ''));
    setEndereco(u.endereco || '');
    setNumero(u.numero || '');
    setBairro(u.bairro || '');
    setCidade(u.cidade || '');
    setEstado(u.estado || '');
    setProfissao(u.profissao || '');
    setIdiomas(u.idiomas || '');
    setOndeEstudei(u.onde_estudei || '');
    setOndeMoro(u.onde_moro || '');
    setSobreMim(u.sobre_mim || '');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await pegarToken();
        if (!token) {
          router.replace('/autenticacao/login' as never);
          return;
        }
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const data = await res.json();
        if (res.ok && data.success) preencher(data.user);
      } catch (e) {
        alertar('Ops', 'Não foi possível carregar seus dados.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const buscarCep = async (valor: string) => {
    const d = soDigitos(valor);
    if (d.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const json = await res.json();
      if (!json.erro) {
        setEndereco(json.logradouro || endereco);
        setBairro(json.bairro || bairro);
        setCidade(json.localidade || cidade);
        setEstado(json.uf || estado);
      }
    } catch (e) {
      // preenchimento manual continua disponível
    }
  };

  const salvar = async () => {
    if (nome.trim().length < 3) {
      alertar('Nome inválido', 'Informe seu nome completo.');
      return;
    }
    if (dataNascimento && !brParaISO(dataNascimento)) {
      alertar('Data inválida', 'Use o formato dd/mm/aaaa.');
      return;
    }

    setSalvando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/me`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome.trim(),
          telefone: soDigitos(telefone) || null,
          data_nascimento: dataNascimento ? brParaISO(dataNascimento) : null,
          cep: soDigitos(cep) || null,
          endereco: endereco.trim() || null,
          numero: numero.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          estado: estado.trim().toUpperCase() || null,
          profissao: profissao.trim() || null,
          idiomas: idiomas.trim() || null,
          onde_estudei: ondeEstudei.trim() || null,
          onde_moro: ondeMoro.trim() || null,
          sobre_mim: sobreMim.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const primeiroErro = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : data?.message;
        alertar('Não foi possível salvar', primeiroErro || 'Tente novamente.');
        return;
      }

      // Mantém o nome usado na Home (guardado no SecureStore) em dia.
      try {
        const salvo = await SecureStore.getItemAsync('userData');
        const atual = salvo ? JSON.parse(salvo) : {};
        await SecureStore.setItemAsync('userData', JSON.stringify({ ...atual, name: data.user?.name || nome.trim() }));
      } catch (e) {}

      alertar('Perfil atualizado', 'Suas informações foram salvas.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      alertar('Erro de conexão', 'Verifique sua internet e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={C.ink} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Dados pessoais</Text>
          <View style={styles.card}>
            <Campo label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" placeholder="Seu nome" />
            <Campo label="Telefone" value={telefone} onChangeText={(t) => setTelefone(mascaraTelefone(t))} keyboardType="phone-pad" placeholder="(00) 00000-0000" />
            <Campo label="Data de nascimento" value={dataNascimento} onChangeText={(t) => setDataNascimento(mascaraData(t))} keyboardType="numeric" placeholder="dd/mm/aaaa" />
            <Campo label="E-mail" value={email} editable={false} hint="O e-mail identifica sua conta e não pode ser alterado aqui." />
            {!!documento && <Campo label="CPF / CNPJ" value={mascararDocumento(documento)} editable={false} />}
          </View>

          <Text style={styles.sectionTitle}>Endereço</Text>
          <View style={styles.card}>
            <Campo
              label="CEP"
              value={cep}
              onChangeText={(t) => {
                const m = mascaraCep(t);
                setCep(m);
                buscarCep(m);
              }}
              keyboardType="numeric"
              placeholder="00000-000"
            />
            <Campo label="Rua / Avenida" value={endereco} onChangeText={setEndereco} autoCapitalize="words" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Campo label="Número" value={numero} onChangeText={setNumero} keyboardType="numeric" />
              </View>
              <View style={{ flex: 2 }}>
                <Campo label="Bairro" value={bairro} onChangeText={setBairro} autoCapitalize="words" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 3 }}>
                <Campo label="Cidade" value={cidade} onChangeText={setCidade} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <Campo label="UF" value={estado} onChangeText={(t) => setEstado(t.toUpperCase())} autoCapitalize="none" maxLength={2} />
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sobre você</Text>
          <View style={styles.card}>
            <Campo label="Profissão" value={profissao} onChangeText={setProfissao} autoCapitalize="sentences" placeholder="Ex: Designer, Professor..." />
            <Campo label="Idiomas" value={idiomas} onChangeText={setIdiomas} placeholder="Ex: Português, Inglês" />
            <Campo label="Onde estudei" value={ondeEstudei} onChangeText={setOndeEstudei} placeholder="Escola ou universidade" />
            <Campo label="Onde moro" value={ondeMoro} onChangeText={setOndeMoro} placeholder="Cidade onde você vive" />
            <Campo label="Sobre mim" value={sobreMim} onChangeText={setSobreMim} multiline maxLength={1000} placeholder="Conte um pouco sobre você" hint={`${sobreMim.length}/1000`} />
          </View>

          <TouchableOpacity style={[styles.saveBtn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} activeOpacity={0.85}>
            {salvando ? <ActivityIndicator color={C.white} /> : (
              <>
                <Ionicons name="checkmark" size={20} color={C.white} />
                <Text style={styles.saveBtnText}>Salvar alterações</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.canvas, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', gap: 12 },
  campo: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  input: { backgroundColor: C.fieldBg, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, height: 48, fontSize: 15, color: C.ink },
  inputMulti: { height: 110, paddingTop: 12 },
  inputLocked: { color: C.muted, backgroundColor: '#F0F0F2' },
  hint: { fontSize: 11, color: C.faint, marginTop: 5 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#12A150', height: 54, borderRadius: 27, marginTop: 24 },
  saveBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
});
