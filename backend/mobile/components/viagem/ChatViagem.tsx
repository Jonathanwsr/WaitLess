import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';
import { apiViagem } from '../../services/viagensApi';
import { obterEcho } from '../../services/echo';
import { alertar } from '../../services/alertar';

type Msg = { id: number; tipo: string; conteudo: string; usuario_id: number | null; autor: string | null; criado_em: string };

/**
 * Chat do grupo: tempo real pelo canal privado viagem.{id} (Reverb) e, como
 * garantia (Expo Go / sem websocket), consulta mensagens novas a cada poucos segundos.
 */
export default function ChatViagem({ painel }: { painel: any }) {
  const viagemId: number = painel.viagem.id;
  const euId: number = painel.eu.id;
  const [mensagens, setMensagens] = useState<Msg[]>(painel.mensagens || []);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const lista = useRef<FlatList<Msg>>(null);
  const ultimoId = useRef(0);

  const juntar = useCallback((novas: Msg[]) => {
    setMensagens((atual) => {
      const ids = new Set(atual.map((m) => m.id));
      const extra = novas.filter((m) => !ids.has(m.id));
      return extra.length ? [...atual, ...extra].sort((a, b) => a.id - b.id) : atual;
    });
  }, []);

  useEffect(() => { ultimoId.current = mensagens.length ? mensagens[mensagens.length - 1].id : 0; }, [mensagens]);
  useEffect(() => { setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 50); }, [mensagens.length]);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      if (AppState.currentState !== 'active') return;
      const r = await apiViagem<Msg[]>(`/${viagemId}/mensagens?apos=${ultimoId.current}`);
      if (ativo && r.ok && Array.isArray(r.dados) && r.dados.length) juntar(r.dados);
    };
    const t = setInterval(buscar, 6000);

    const canal = `viagem.${viagemId}`;
    obterEcho()
      .then((echo) => { if (ativo) echo.private(canal).listen('.mensagem.nova', (m: Msg) => juntar([m])); })
      .catch(() => { /* sem websocket: a consulta periódica cobre */ });

    return () => {
      ativo = false;
      clearInterval(t);
      obterEcho().then((echo) => echo.leave(canal)).catch(() => {});
    };
  }, [viagemId, juntar]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    setEnviando(true);
    const r = await apiViagem<Msg>(`/${viagemId}/mensagens`, 'POST', { conteudo });
    setEnviando(false);
    if (!r.ok) return alertar('Mensagem não enviada', r.erro || '');
    juntar([r.dados]);
    setTexto('');
  };

  const hora = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={s.box}>
      <FlatList
        ref={lista}
        data={mensagens}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        ListEmptyComponent={<Text style={s.vazio}>Comece a conversa do grupo.</Text>}
        renderItem={({ item: m }) => {
          if (m.tipo === 'sistema') return <Text style={s.sistema}>{m.conteudo}</Text>;
          const meu = m.usuario_id === euId;
          return (
            <View style={[s.linha, meu ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              <View style={[s.balao, meu ? s.balaoMeu : s.balaoOutro]}>
                {!meu && <Text style={s.autor}>{m.autor}</Text>}
                <Text style={[s.msg, meu && { color: '#fff' }]}>{m.conteudo}</Text>
                <Text style={[s.hora, meu && { color: 'rgba(255,255,255,0.75)' }]}>{hora(m.criado_em)}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={s.barra}>
        <TextInput style={s.input} placeholder="Escreva para o grupo…" placeholderTextColor={T.faint} value={texto} onChangeText={setTexto} maxLength={2000} multiline />
        <TouchableOpacity style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.5 }]} onPress={enviar} disabled={!texto.trim() || enviando}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, backgroundColor: T.card, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vazio: { textAlign: 'center', color: T.faint, marginTop: 40, fontSize: 13 },
  sistema: { textAlign: 'center', color: T.faint, fontSize: 11 },
  linha: { flexDirection: 'row' },
  balao: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  balaoMeu: { backgroundColor: T.primary, borderBottomRightRadius: 4 },
  balaoOutro: { backgroundColor: '#F3F0EE', borderBottomLeftRadius: 4 },
  autor: { fontSize: 11, fontWeight: '800', color: T.tag, marginBottom: 2 },
  msg: { fontSize: 14, color: T.ink },
  hora: { fontSize: 10, color: T.faint, marginTop: 3 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: T.line },
  input: { flex: 1, maxHeight: 100, backgroundColor: T.cream, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: T.ink },
  enviar: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
});
