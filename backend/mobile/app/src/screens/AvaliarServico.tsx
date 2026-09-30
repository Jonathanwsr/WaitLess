import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const FRASES = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function AvaliarServico() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const agendamentoId = Array.isArray(id) ? id[0] : id;

  const [detalhes, setDetalhes] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await pegarToken();
        const res = await fetch(`${API_URL}/agendamentos/${agendamentoId}/fila`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const json = await res.json();
        setDetalhes(json?.detalhes || null);
      } catch (e) {
        // avaliação continua possível sem os detalhes
      } finally {
        setCarregando(false);
      }
    })();
  }, [agendamentoId]);

  const enviar = async () => {
    if (!nota) return alertar('Avaliação', 'Toque nas estrelas para dar uma nota.');
    setEnviando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${cleanBaseUrl}/agendamentos/${agendamentoId}/avaliar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, comentario: comentario.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertar('Não foi possível enviar', json.error || json.message || 'Tente novamente.');
        return;
      }
      alertar('Obrigado!', 'Sua avaliação foi publicada.', [{ text: 'OK', onPress: () => router.replace('/src/screens/MeusComentarios' as never) }]);
    } catch (e) {
      alertar('Erro', 'Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="chevron-back" size={24} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {carregando ? (
            <ActivityIndicator color={T.primary} style={{ marginVertical: 30 }} />
          ) : (
            !!detalhes && (
              <View style={s.card}>
                <View style={s.cardIcone}><Ionicons name="storefront-outline" size={24} color={T.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardKicker}>Serviço concluído</Text>
                  <Text style={s.cardNome} numberOfLines={1}>{detalhes.estabelecimento}</Text>
                  <Text style={s.cardSub} numberOfLines={1}>{detalhes.servico}{detalhes.data_agendamento ? ` • ${String(detalhes.data_agendamento).slice(0, 10).split('-').reverse().join('/')}` : ''}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={26} color={T.success} />
              </View>
            )
          )}

          <Text style={s.pergunta}>Como foi o serviço?</Text>
          <View style={s.estrelas}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setNota(n)} activeOpacity={0.8} hitSlop={6}>
                <Ionicons name={n <= nota ? 'star' : 'star-outline'} size={40} color={n <= nota ? T.star : '#D6CFC9'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.frase}>{FRASES[nota] || 'Toque para avaliar'}</Text>

          <Text style={s.rotulo}>Conte-nos o que achou</Text>
          <View style={s.caixa}>
            <TextInput
              style={s.input}
              placeholder="O atendimento foi pontual? O ambiente era agradável?"
              placeholderTextColor={T.faint}
              multiline
              maxLength={1000}
              value={comentario}
              onChangeText={setComentario}
              textAlignVertical="top"
            />
            <Text style={s.contador}>{comentario.length}/1000</Text>
          </View>

          <TouchableOpacity style={[s.btnEnviar, (!nota || enviando) && { opacity: 0.6 }]} onPress={enviar} disabled={!nota || enviando} activeOpacity={0.88}>
            {enviando ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={s.btnTxt}>Enviar avaliação</Text>
                <Ionicons name="paper-plane-outline" size={17} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.btnEstorno} onPress={() => router.push('/src/screens/MeusEstornosScreen' as never)} activeOpacity={0.88}>
            <Text style={s.btnTxt}>Solicitar estorno</Text>
            <Ionicons name="return-up-back-outline" size={17} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 17, fontWeight: '800', color: T.ink },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardIcone: { width: 52, height: 52, borderRadius: 16, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardKicker: { fontSize: 11, color: T.muted },
  cardNome: { fontSize: 17, fontWeight: '800', color: T.ink, marginTop: 1 },
  cardSub: { fontSize: 12, color: T.muted, marginTop: 2 },

  pergunta: { fontSize: 20, fontWeight: '800', color: T.ink, textAlign: 'center', marginTop: 30 },
  estrelas: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  frase: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: T.primary, marginTop: 10, minHeight: 20 },

  rotulo: { fontSize: 14, fontWeight: '800', color: T.ink, marginTop: 24, marginBottom: 10 },
  caixa: { backgroundColor: T.card, borderRadius: 20, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  input: { minHeight: 110, fontSize: 14, color: T.ink },
  contador: { alignSelf: 'flex-end', fontSize: 11, color: T.faint },

  btnEnviar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.success, height: 52, borderRadius: 26, marginTop: 24 },
  btnEstorno: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.ink, height: 52, borderRadius: 26, marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
