import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { T } from '../../../constants/ClientTheme';
import { HeaderCliente } from '../../../components/client/ui';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { apiMobile, mensagemDeErro } from '../../../services/entregasApi';
import { irParaLoginSemVoltar } from '../../../services/sessao';

const C = { ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line, accent: T.primary, success: T.success, danger: T.danger };

type Pendencia = { chave: string; titulo: string; quantidade: number; como_resolver: string };

/** Mesmas regras do servidor (App\Support\RegrasSenha): 8+ caracteres, letra e número. */
const REGRAS = [
  { id: 'tamanho', rotulo: 'Pelo menos 8 caracteres', testa: (s: string) => s.length >= 8 },
  { id: 'letra', rotulo: 'Uma letra', testa: (s: string) => /[A-Za-zÀ-ÿ]/.test(s) },
  { id: 'numero', rotulo: 'Um número', testa: (s: string) => /\d/.test(s) },
];

function CampoSenha({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <View style={s.campo}>
        <TextInput
          value={valor}
          onChangeText={onChange}
          secureTextEntry={!visivel}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.campoInput}
          placeholderTextColor={C.faint}
        />
        <TouchableOpacity onPress={() => setVisivel((v) => !v)} hitSlop={8} accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}>
          <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ContaSeguranca() {
  const router = useRouter();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [apagando, setApagando] = useState(false);

  const carregarPendencias = useCallback(async () => {
    const { ok, data } = await apiMobile<{ pendencias: Pendencia[] }>('/conta/pendencias');
    setPendencias(ok ? data.pendencias || [] : []);
  }, []);

  useFocusEffect(useCallback(() => { carregarPendencias(); }, [carregarPendencias]));

  const regrasOk = REGRAS.every((r) => r.testa(nova));
  const confere = !!confirmacao && nova === confirmacao;
  const podeSalvar = !!atual && regrasOk && confere && !salvando;

  const salvarSenha = async () => {
    setSalvando(true);
    const { ok, data } = await apiMobile<{ message?: string }>('/conta/senha', {
      method: 'POST',
      json: { current_password: atual, password: nova, password_confirmation: confirmacao },
    });
    setSalvando(false);
    if (ok) {
      mostrarToast(data.message || 'Senha alterada.', 'sucesso');
      setAtual(''); setNova(''); setConfirmacao('');
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível alterar a senha.'), 'erro');
    }
  };

  const apagarConta = () => {
    alertar('Apagar sua conta?', 'Seus dados, pontos e histórico serão apagados para sempre. Isso não pode ser desfeito.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Apagar conta',
        style: 'destructive',
        onPress: async () => {
          setApagando(true);
          const { ok, data } = await apiMobile<{ message?: string; pendencias?: Pendencia[] }>('/conta', {
            method: 'DELETE',
            json: { password: senhaExclusao },
          });
          setApagando(false);
          if (ok) {
            await AsyncStorage.multiRemove(['@lokyva_token', '@waitless_token', '@waitless_user']);
            await SecureStore.deleteItemAsync('userData').catch(() => {});
            mostrarToast('Sua conta foi apagada.', 'sucesso');
            irParaLoginSemVoltar(router);
          } else {
            if (data.pendencias) setPendencias(data.pendencias);
            mostrarToast(mensagemDeErro(data, 'Não foi possível apagar a conta.'), 'erro');
          }
        },
      },
    ]);
  };

  const bloqueado = (pendencias?.length ?? 0) > 0;

  return (
    <SafeAreaView style={s.safe}>
      <HeaderCliente titulo="Segurança da conta" subtitulo="Senha e exclusão" voltar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {/* ALTERAR SENHA */}
          <View style={s.card}>
            <View style={s.cabecalho}>
              <View style={[s.icone, { backgroundColor: '#FFF1E4' }]}><Ionicons name="lock-closed-outline" size={20} color={C.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.titulo}>Alterar senha</Text>
                <Text style={s.sub}>Use uma senha longa e difícil de adivinhar.</Text>
              </View>
            </View>

            <CampoSenha rotulo="Senha atual" valor={atual} onChange={setAtual} />
            <CampoSenha rotulo="Nova senha" valor={nova} onChange={setNova} />
            {!!nova && (
              <View style={{ gap: 4 }}>
                {REGRAS.map((r) => (
                  <View key={r.id} style={s.regra}>
                    <Ionicons name="checkmark-circle" size={16} color={r.testa(nova) ? C.success : C.faint} />
                    <Text style={[s.regraTxt, r.testa(nova) && { color: C.success }]}>{r.rotulo}</Text>
                  </View>
                ))}
              </View>
            )}
            <CampoSenha rotulo="Confirmar nova senha" valor={confirmacao} onChange={setConfirmacao} />
            {!!confirmacao && !confere && <Text style={s.aviso}>As senhas ainda não são iguais.</Text>}

            <TouchableOpacity disabled={!podeSalvar} onPress={salvarSenha} style={[s.botao, { backgroundColor: C.ink }, !podeSalvar && { opacity: 0.4 }]}>
              {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Salvar nova senha</Text>}
            </TouchableOpacity>
          </View>

          {/* APAGAR CONTA */}
          <View style={[s.card, { borderColor: '#FECACA' }]}>
            <View style={s.cabecalho}>
              <View style={[s.icone, { backgroundColor: '#FEF2F2' }]}><Ionicons name="trash-outline" size={20} color={C.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.titulo}>Apagar conta</Text>
                <Text style={s.sub}>Seus dados, pontos e histórico são removidos para sempre. Baixe antes os comprovantes que quiser guardar.</Text>
              </View>
            </View>

            {pendencias === null ? (
              <ActivityIndicator color={C.accent} />
            ) : bloqueado ? (
              <View style={s.pendencias}>
                <Text style={s.pendenciasTitulo}>Resolva estas pendências antes</Text>
                <Text style={s.pendenciasSub}>Assim ninguém fica sem receber, sem reembolso ou com um atendimento marcado.</Text>
                {pendencias.map((p) => (
                  <View key={p.chave} style={s.pendencia}>
                    <Text style={s.pendenciaTitulo}>{p.titulo}{p.quantidade > 1 ? ` (${p.quantidade})` : ''}</Text>
                    <Text style={s.pendenciaTxt}>{p.como_resolver}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={s.regra}>
                  <Ionicons name="checkmark-circle" size={18} color={C.success} />
                  <Text style={[s.regraTxt, { color: C.success }]}>Nenhuma pendência. Sua conta pode ser apagada.</Text>
                </View>
                <CampoSenha rotulo="Digite sua senha para confirmar" valor={senhaExclusao} onChange={setSenhaExclusao} />
                <TouchableOpacity disabled={!senhaExclusao || apagando} onPress={apagarConta} style={[s.botao, { backgroundColor: C.danger }, (!senhaExclusao || apagando) && { opacity: 0.4 }]}>
                  {apagando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Apagar minha conta</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  conteudo: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, gap: 14 },
  cabecalho: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 17, fontWeight: '900', color: C.ink },
  sub: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },
  rotulo: { fontSize: 13, fontWeight: '700', color: C.ink },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff' },
  campoInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.ink },
  regra: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  regraTxt: { fontSize: 12, color: C.muted, flexShrink: 1 },
  aviso: { fontSize: 12, color: '#B45309' },
  botao: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pendencias: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: '#FDE68A' },
  pendenciasTitulo: { fontSize: 14, fontWeight: '900', color: '#92400E' },
  pendenciasSub: { fontSize: 12, color: '#92400E' },
  pendencia: { backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 2 },
  pendenciaTitulo: { fontSize: 13, fontWeight: '800', color: C.ink },
  pendenciaTxt: { fontSize: 12, color: C.muted },
});
