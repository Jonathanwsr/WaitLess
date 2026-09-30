import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { T } from '../../constants/ClientTheme';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const API = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '') + '/mobile';

/**
 * Botão de favorito moderno: círculo branco com sombra suave; ao favoritar,
 * o coração preenche em vermelho com uma animação rápida de "pulso".
 */
export function FavoriteButton({ ativo, onPress, tamanho = 38, style }: {
  ativo: boolean; onPress: () => void; tamanho?: number; style?: any;
}) {
  const escala = useRef(new Animated.Value(1)).current;

  const aoPressionar = () => {
    Animated.sequence([
      Animated.timing(escala, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(escala, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={aoPressionar} hitSlop={8}
      style={[s.fav, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }, ativo && s.favOn, style]}>
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Ionicons name={ativo ? 'heart' : 'heart-outline'} size={tamanho * 0.52} color={ativo ? '#E11D48' : T.ink} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function Selo({ valor, cor }: { valor: number; cor: string }) {
  if (!valor) return null;
  return (
    <View style={[s.selo, { backgroundColor: cor }]}>
      <Text style={s.seloTxt}>{valor > 9 ? '9+' : valor}</Text>
    </View>
  );
}

/** Cabeçalho das telas principais: título, subtítulo e atalhos (carrinho, favoritos, perfil). */
export function HeaderCliente({ titulo, subtitulo, children, voltar, tituloMenor }: { titulo: string; subtitulo?: string; children?: React.ReactNode; voltar?: boolean; tituloMenor?: boolean }) {
  const router = useRouter();
  const [foto, setFoto] = useState<string | null>(null);
  const [inicial, setInicial] = useState('U');
  const [carrinho, setCarrinho] = useState(0);
  const [favoritos, setFavoritos] = useState(0);
  const [avisos, setAvisos] = useState(0);

  useEffect(() => {
    SecureStore.getItemAsync('userData').then((salvo) => {
      if (!salvo) return;
      const u = JSON.parse(salvo);
      setFoto(u.foto_perfil || u.foto || null);
      setInicial(String(u.name || u.nome || 'U').charAt(0).toUpperCase());
    }).catch(() => {});
  }, []);

  const contar = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const [rc, rf, rn] = await Promise.all([fetch(`${API}/carrinho`, { headers }), fetch(`${API}/favoritos`, { headers }), fetch(`${API}/notificacoes/contagem`, { headers })]);
      const jc = await rc.json().catch(() => null);
      const jf = await rf.json().catch(() => null);
      const jn = await rn.json().catch(() => null);
      setAvisos(Number(jn?.nao_lidas || 0));
      setCarrinho(Array.isArray(jc?.data) ? jc.data.length : 0);
      setFavoritos((jf?.estabelecimentos?.length || 0) + (jf?.servicos?.length || 0));
    } catch {
      // badges são opcionais
    }
  }, []);

  useFocusEffect(useCallback(() => { contar(); }, [contar]));

  const icones = (
    <View style={s.acoes}>
      <TouchableOpacity style={s.icone} onPress={() => router.push('/src/screens/Notificacoes' as never)} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={23} color={T.ink} />
        <Selo valor={avisos} cor={T.danger} />
      </TouchableOpacity>
      <TouchableOpacity style={s.icone} onPress={() => router.push('/src/screens/TelaCarrinho' as never)} activeOpacity={0.7}>
        <Ionicons name="cart-outline" size={23} color={T.ink} />
        <Selo valor={carrinho} cor={T.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={s.icone} onPress={() => router.push('/src/screens/FavoritosDashboard' as never)} activeOpacity={0.7}>
        <Ionicons name="heart-outline" size={23} color={T.ink} />
        <Selo valor={favoritos} cor="#E11D48" />
      </TouchableOpacity>
      <TouchableOpacity style={s.avatar} onPress={() => router.push('/src/screens/TelaPerfil' as never)} activeOpacity={0.8}>
        {foto ? <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={s.avatarTxt}>{inicial}</Text>}
      </TouchableOpacity>
    </View>
  );

  // O nome da tela não aparece mais no topo: só o voltar (quando houver), o conteúdo da tela e os atalhos.
  if (voltar) {
    return (
      <View style={s.headerVoltar}>
        <View style={s.linhaTopo}>
          <TouchableOpacity style={s.voltar} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </TouchableOpacity>
          {icones}
        </View>
        {children}
      </View>
    );
  }

  return (
    <View style={s.header}>
      <View style={{ flex: 1, paddingRight: 8, justifyContent: 'center' }}>{children}</View>
      {icones}
    </View>
  );
}

const s = StyleSheet.create({
  fav: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  favOn: { backgroundColor: '#FFF1F2' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12 },
  headerVoltar: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 8 : 0, paddingBottom: 10 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  voltar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tituloMenor: { fontSize: 24 },
  titulo: { fontSize: 30, fontWeight: '800', color: T.ink, letterSpacing: -0.8 },
  subtitulo: { fontSize: 13, color: T.muted, marginTop: 2, lineHeight: 18 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontWeight: '700' },
  selo: { position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  seloTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
