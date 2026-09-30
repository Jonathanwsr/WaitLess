import React, { useCallback, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';

type Tipo = 'erro' | 'sucesso' | 'info' | 'premium';

interface AvisoDados {
  tipo: Tipo;
  titulo: string;
  mensagem?: string;
}

const VISUAL: Record<Tipo, { icone: string; cor: string; fundo: string }> = {
  erro: { icone: 'alert-circle', cor: O.danger, fundo: O.dangerBg },
  sucesso: { icone: 'checkmark-circle', cor: O.success, fundo: O.successBg },
  info: { icone: 'information-circle', cor: O.info, fundo: O.infoBg },
  premium: { icone: 'sparkles', cor: O.accent, fundo: '#FFF1E4' },
};

/** Traduz o erro técnico (rede, servidor) em uma frase que o usuário entende. */
export function mensagemAmigavel(e: any): string {
  const bruta = String(e?.message || '');
  if (/network request failed|failed to fetch|timeout|timed out/i.test(bruta)) {
    return 'Não conseguimos falar com o servidor. Verifique sua conexão com a internet e tente de novo.';
  }
  if (e?.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (e?.status === 403) return bruta || 'Você não tem permissão para fazer isso.';
  if (e?.status === 404) return 'Não encontramos o que você procurava. Ele pode ter sido removido.';
  if (e?.status === 422) return bruta || 'Confira os dados informados e tente novamente.';
  if (e?.status === 429) return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.';
  if (e?.status >= 500) return 'Algo deu errado do nosso lado. Tente novamente em alguns minutos.';
  return bruta || 'Não foi possível concluir. Tente novamente.';
}

/**
 * Aviso bonito (no lugar do Alert nativo): erro, sucesso, informação ou convite Premium.
 * Uso: const { aviso, mostrarErro, mostrarSucesso } = useAviso(); e renderize {aviso} na tela.
 */
export function useAviso() {
  const router = useRouter();
  const [dados, setDados] = useState<AvisoDados | null>(null);

  const fechar = useCallback(() => setDados(null), []);

  const mostrar = useCallback((d: AvisoDados) => setDados(d), []);

  const mostrarErro = useCallback((e: any, titulo = 'Não foi possível concluir') => {
    if (e?.premium) {
      setDados({ tipo: 'premium', titulo: 'Recurso Premium', mensagem: e?.message || 'Assine o plano Premium para liberar este recurso.' });
    } else {
      setDados({ tipo: 'erro', titulo, mensagem: mensagemAmigavel(e) });
    }
  }, []);

  const mostrarSucesso = useCallback((titulo: string, mensagem?: string) => setDados({ tipo: 'sucesso', titulo, mensagem }), []);

  const aviso = (
    <Modal visible={!!dados} transparent animationType="fade" onRequestClose={fechar}>
      <Pressable style={s.fundo} onPress={fechar}>
        <Pressable style={s.card} onPress={() => {}}>
          {dados && (
            <>
              <View style={[s.icone, { backgroundColor: VISUAL[dados.tipo].fundo }]}>
                <Ionicons name={VISUAL[dados.tipo].icone as any} size={34} color={VISUAL[dados.tipo].cor} />
              </View>
              <Text style={s.titulo}>{dados.titulo}</Text>
              {!!dados.mensagem && <Text style={s.mensagem}>{dados.mensagem}</Text>}

              {dados.tipo === 'premium' ? (
                <>
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: O.accent }]}
                    activeOpacity={0.85}
                    onPress={() => { fechar(); router.push('/assinatura' as never); }}
                  >
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={s.btnTxt}>Seja Premium</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnTexto} onPress={fechar} activeOpacity={0.7}><Text style={s.btnTextoTxt}>Agora não</Text></TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: dados.tipo === 'sucesso' ? '#12A150' : O.ink }]}
                  activeOpacity={0.85}
                  onPress={fechar}
                >
                  <Text style={s.btnTxt}>{dados.tipo === 'erro' ? 'Entendi' : 'Ok'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { aviso, mostrar, mostrarErro, mostrarSucesso, fechar };
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 380, backgroundColor: O.card, borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  icone: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  titulo: { fontSize: 19, fontWeight: '800', color: O.ink, textAlign: 'center', letterSpacing: -0.3 },
  mensagem: { fontSize: 14, color: O.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 50, borderRadius: 25, marginTop: 22 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnTexto: { paddingVertical: 12, marginTop: 4 },
  btnTextoTxt: { color: O.muted, fontWeight: '700', fontSize: 14 },
});
