import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/AppColors';
import { alertar } from '../../services/alertar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const REENVIO_SEGUNDOS = 60;

const limpar = (t: string) => (t || '').replace(/[<>{}[\];=]/g, '').trim();

/** Chamada pública (o usuário ainda não está logado). Devolve a mensagem de erro já em português. */
async function chamar(caminho: string, corpo: unknown): Promise<{ ok: boolean; mensagem: string }> {
  try {
    const r = await fetch(`${API_URL}${caminho}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = await r.json().catch(() => null);
    if (r.ok) return { ok: true, mensagem: dados?.message || '' };
    if (r.status === 429) return { ok: false, mensagem: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.' };
    const primeiro = dados?.errors ? (Object.values(dados.errors)[0] as string[])?.[0] : null;
    return { ok: false, mensagem: primeiro || dados?.message || 'Não conseguimos concluir agora. Tente novamente em instantes.' };
  } catch {
    return { ok: false, mensagem: 'Sem conexão com o servidor. Verifique sua internet.' };
  }
}

export default function EsqueciSenha() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const iniciarEspera = () => {
    setEspera(REENVIO_SEGUNDOS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setEspera((s) => { if (s <= 1) { if (timer.current) clearInterval(timer.current); return 0; } return s - 1; }), 1000);
  };

  const enviarCodigo = async () => {
    const limpo = limpar(email).toLowerCase();
    if (!limpo) { setErro('Informe o e-mail da sua conta.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) { setErro('Digite um e-mail válido.'); return; }

    setErro(null);
    setEnviando(true);
    const r = await chamar('/senha/solicitar', { email: limpo });
    setEnviando(false);
    if (!r.ok) { setErro(r.mensagem); return; }

    setEmail(limpo);
    setEtapa('codigo');
    iniciarEspera();
  };

  const reenviar = async () => {
    if (espera > 0) return;
    setEnviando(true);
    const r = await chamar('/senha/solicitar', { email });
    setEnviando(false);
    if (!r.ok) { setErro(r.mensagem); return; }
    setErro(null);
    iniciarEspera();
    alertar('Código reenviado', 'Confira sua caixa de entrada e o spam.');
  };

  const redefinir = async () => {
    if (codigo.length !== 6) { setErro('Digite os 6 números do código que enviamos por e-mail.'); return; }
    if (senha.length < 8) { setErro('A nova senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmacao) { setErro('As senhas não conferem.'); return; }

    setErro(null);
    setEnviando(true);
    const r = await chamar('/senha/redefinir', { email, codigo, password: senha, password_confirmation: confirmacao });
    setEnviando(false);
    if (!r.ok) { setErro(r.mensagem); return; }

    alertar('Senha alterada!', 'Entre com a sua nova senha. Por segurança, você foi desconectado dos outros aparelhos.', [
      { text: 'Ir para o login', onPress: () => router.replace('/autenticacao/login' as never) },
    ]);
  };

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (etapa === 'codigo' ? (setEtapa('email'), setErro(null)) : router.back())} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Recuperar Senha</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name={etapa === 'email' ? 'lock-closed-outline' : 'mail-open-outline'} size={40} color={AppColors.primary} />
              </View>
            </View>

            {etapa === 'email' ? (
              <>
                <Text style={styles.title}>Esqueceu sua senha?</Text>
                <Text style={styles.subtitle}>Digite o e-mail da sua conta e enviaremos um código de 6 números para você criar uma nova senha.</Text>

                <Text style={styles.label}>E-mail da conta</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="exemplo@email.com" placeholderTextColor="#888888" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!enviando} />
                </View>

                {!!erro && <Text style={styles.erro}>{erro}</Text>}

                <TouchableOpacity style={[styles.primaryButton, enviando && { opacity: 0.6 }]} onPress={enviarCodigo} disabled={enviando} activeOpacity={0.85}>
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Enviar código</Text>}
                </TouchableOpacity>

                <View style={styles.aviso}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={AppColors.primary} />
                  <Text style={styles.avisoTxt}>Por segurança, cada conta pode trocar a senha até 3 vezes a cada 30 dias.</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Digite o código</Text>
                <Text style={styles.subtitle}>Enviamos um código de 6 números para <Text style={{ fontWeight: '700', color: '#000' }}>{email}</Text>. Ele vale por 15 minutos.</Text>

                <Text style={styles.label}>Código</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="keypad-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={[styles.input, { letterSpacing: 6, fontWeight: '700', fontSize: 20 }]} placeholder="000000" placeholderTextColor="#BBBBBB" keyboardType="number-pad" maxLength={6} value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))} editable={!enviando} />
                </View>

                <Text style={styles.label}>Nova senha</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Mínimo de 8 caracteres" placeholderTextColor="#888888" secureTextEntry={!mostrar} autoCapitalize="none" value={senha} onChangeText={setSenha} editable={!enviando} />
                  <TouchableOpacity onPress={() => setMostrar(!mostrar)}><Ionicons name={mostrar ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" /></TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirmar nova senha</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#000000" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Repita a senha" placeholderTextColor="#888888" secureTextEntry={!mostrar} autoCapitalize="none" value={confirmacao} onChangeText={setConfirmacao} editable={!enviando} />
                </View>

                {!!erro && <Text style={styles.erro}>{erro}</Text>}

                <TouchableOpacity style={[styles.primaryButton, enviando && { opacity: 0.6 }]} onPress={redefinir} disabled={enviando} activeOpacity={0.85}>
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Alterar senha</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={reenviar} disabled={espera > 0 || enviando} style={styles.reenviar}>
                  <Text style={[styles.reenviarTxt, espera > 0 && { color: '#999' }]}>{espera > 0 ? `Reenviar código em ${espera}s` : 'Não recebi o código — reenviar'}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F7F8FA' },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: Platform.OS === 'android' ? 40 : 10, marginBottom: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#000000', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#555555', textAlign: 'center', marginBottom: 28, paddingHorizontal: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#555555', marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 16, marginBottom: 18, paddingHorizontal: 16, height: 58 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#000000', fontSize: 15, height: '100%' },
  erro: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginBottom: 14, marginLeft: 4 },
  primaryButton: { backgroundColor: AppColors.primary, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: AppColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, backgroundColor: AppColors.primaryLight, borderRadius: 14, padding: 12 },
  avisoTxt: { flex: 1, fontSize: 12, color: '#7C2D12', lineHeight: 17 },
  reenviar: { alignItems: 'center', marginTop: 18, padding: 8 },
  reenviarTxt: { color: AppColors.primary, fontWeight: '700', fontSize: 14 },
});
