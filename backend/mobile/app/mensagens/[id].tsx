import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  black: '#000000',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const INTERVALO_POLLING_MS = 4000;

interface Mensagem {
  id: number | string;
  conteudo: string;
  horario: string;
  data: string;
  is_mine: boolean;
}

interface ConversaAtiva {
  id: number | string;
  nome: string;
  avatar?: string | null;
  iniciais: string;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function ConversaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [conversa, setConversa] = useState<ConversaAtiva | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async (mostrarLoading = false) => {
    if (mostrarLoading) setLoading(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/mensagens/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setConversa(json.conversa || null);
      setMensagens(json.mensagens || []);
    } catch (e) {
      console.log('Erro ao carregar conversa');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar(true);

    const intervalo = setInterval(() => carregar(false), INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  useEffect(() => {
    if (mensagens.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [mensagens.length]);

  const enviarMensagem = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setTexto('');

    // Atualização otimista: mostra a mensagem na hora, sem esperar a resposta da API
    const mensagemTemporaria: Mensagem = {
      id: `temp-${Date.now()}`,
      conteudo,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: '',
      is_mine: true,
    };
    setMensagens((atual) => [...atual, mensagemTemporaria]);

    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/mensagens/${id}/enviar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conteudo }),
      });
      const mensagemSalva = await res.json();

      setMensagens((atual) =>
        atual.map((m) => (m.id === mensagemTemporaria.id ? mensagemSalva : m))
      );
    } catch (e) {
      console.log('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  const renderItem = ({ item }: { item: Mensagem }) => (
    <View style={[styles.bolha, item.is_mine ? styles.bolhaMinha : styles.bolhaDeles]}>
      <Text style={[styles.bolhaTexto, item.is_mine && styles.bolhaTextoMinha]}>{item.conteudo}</Text>
      <Text style={[styles.bolhaHorario, item.is_mine && styles.bolhaHorarioMinha]}>{item.horario}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>

        {conversa?.avatar ? (
          <Image source={{ uri: conversa.avatar }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarFallback}>
            <Text style={styles.headerAvatarFallbackText}>{conversa?.iniciais || '?'}</Text>
          </View>
        )}

        <Text style={styles.headerTitle} numberOfLines={1}>{conversa?.nome || 'Conversa'}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={mensagens}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={COLORS.gray}
            value={texto}
            onChangeText={setTexto}
            multiline
          />
          <TouchableOpacity
            style={[styles.btnEnviar, !texto.trim() && styles.btnEnviarDesabilitado]}
            onPress={enviarMensagem}
            disabled={!texto.trim() || enviando}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  headerBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  headerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarFallbackText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.secondary,
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  bolha: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bolhaDeles: {
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bolhaMinha: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bolhaTexto: {
    fontSize: 14,
    color: COLORS.secondary,
    lineHeight: 20,
  },
  bolhaTextoMinha: {
    color: COLORS.white,
  },
  bolhaHorario: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bolhaHorarioMinha: {
    color: 'rgba(255,255,255,0.75)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: COLORS.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.secondary,
    marginRight: 10,
  },
  btnEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEnviarDesabilitado: {
    backgroundColor: COLORS.gray,
  },
});
