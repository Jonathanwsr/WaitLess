import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { assinarAlertas, DadosAlerta, TipoAlerta, BotaoAlerta } from '../services/alertar';

const VISUAL: Record<TipoAlerta, { icone: string; cor: string; fundo: string }> = {
  erro: { icone: 'alert-circle', cor: '#DC2626', fundo: '#FEF2F2' },
  aviso: { icone: 'warning', cor: '#B45309', fundo: '#FEF3C7' },
  sucesso: { icone: 'checkmark-circle', cor: '#00A868', fundo: '#E5F6EE' },
  info: { icone: 'information-circle', cor: '#2563EB', fundo: '#EFF6FF' },
  premium: { icone: 'sparkles', cor: '#FF7A00', fundo: '#FFF1E4' },
};

/**
 * Janela de alerta moderna, montada uma vez no layout raiz. Exibe os alertas de `alertar()`
 * em fila (um por vez) com ícone por tipo e botões no estilo do app.
 */
export default function AlertaHost() {
  const [fila, setFila] = useState<DadosAlerta[]>([]);
  // O botão só dispara uma vez, mesmo com toque duplo.
  const respondido = useRef<number | null>(null);

  useEffect(() => assinarAlertas((a) => setFila((f) => [...f, a])), []);

  const atual = fila[0];

  const fechar = (botao?: BotaoAlerta) => {
    if (!atual || respondido.current === atual.id) return;
    respondido.current = atual.id;
    setFila((f) => f.slice(1));
    // Executa depois de fechar, para o callback poder abrir outro alerta/tela sem conflito.
    setTimeout(() => botao?.onPress?.(), 0);
  };

  if (!atual) return null;

  const v = VISUAL[atual.tipo];
  const cancelavel = atual.botoes.find((b) => b.style === 'cancel');
  const vertical = atual.botoes.length > 2 || atual.botoes.some((b) => (b.text || '').length > 14);
  // Cancelar sempre por último/à esquerda; o resto em ordem.
  const ordenados = [...atual.botoes].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => fechar(cancelavel)} statusBarTranslucent>
      <Pressable style={s.fundo} onPress={() => (atual.botoes.length <= 1 || cancelavel) && fechar(cancelavel || atual.botoes[0])}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={[s.icone, { backgroundColor: v.fundo }]}>
            <Ionicons name={v.icone as any} size={34} color={v.cor} />
          </View>
          {!!atual.titulo && <Text style={s.titulo}>{atual.titulo}</Text>}
          {!!atual.mensagem && (
            <ScrollView style={s.msgBox} showsVerticalScrollIndicator={false}>
              <Text style={s.mensagem}>{atual.mensagem}</Text>
            </ScrollView>
          )}

          <View style={[s.botoes, vertical ? { flexDirection: 'column' } : { flexDirection: 'row' }]}>
            {atual.tipo === 'premium' && atual.botoes.length <= 1 ? (
              <>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#FF7A00' }]} activeOpacity={0.85} onPress={() => { fechar(atual.botoes[0]); router.push('/assinatura' as never); }}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={s.btnTxt}>Seja Premium</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnSec]} activeOpacity={0.8} onPress={() => fechar(atual.botoes[0])}>
                  <Text style={s.btnSecTxt}>Agora não</Text>
                </TouchableOpacity>
              </>
            ) : (
              ordenados.map((b, i) => {
                const secundario = b.style === 'cancel';
                const perigo = b.style === 'destructive';
                const principal = !secundario && !perigo;
                const cor = perigo ? '#DC2626' : atual.tipo === 'sucesso' ? '#12A150' : '#FF7A00';
                return (
                  <TouchableOpacity
                    key={`${b.text}-${i}`}
                    style={[s.btn, vertical ? {} : { flex: 1 }, secundario ? s.btnSec : { backgroundColor: cor }]}
                    activeOpacity={0.85}
                    onPress={() => fechar(b)}
                  >
                    <Text style={[s.btnTxt, secundario && s.btnSecTxt, !principal && !secundario && { color: '#fff' }]}>{b.text || 'Ok'}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  icone: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  titulo: { fontSize: 19, fontWeight: '800', color: '#282828', textAlign: 'center', letterSpacing: -0.3 },
  msgBox: { maxHeight: 220, marginTop: 8, alignSelf: 'stretch' },
  mensagem: { fontSize: 14, color: '#6A6C72', textAlign: 'center', lineHeight: 21 },
  botoes: { alignSelf: 'stretch', gap: 10, marginTop: 22 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, paddingHorizontal: 16 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { backgroundColor: '#F0F0F2' },
  btnSecTxt: { color: '#282828', fontWeight: '700', fontSize: 15 },
});
