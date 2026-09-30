import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, StatusBar, useWindowDimensions,
  ScrollView, NativeSyntheticEvent, NativeScrollEvent, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const SITE = ENV_URL.replace(/\/api(\/mobile)?\/?$/, '').replace(/\/+$/, '');

/** Aceita lista, JSON em texto ou texto único; completa caminhos relativos e descarta o que não é foto. */
export function normalizarFotos(fotos?: string | string[] | null): string[] {
  if (!fotos) return [];
  let lista: unknown = fotos;
  if (typeof fotos === 'string') {
    try {
      lista = JSON.parse(fotos);
    } catch {
      lista = [fotos];
    }
  }
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .map((f) => (f.startsWith('http') ? f : `${SITE}${f.startsWith('/') ? '' : '/'}${f}`));
}

/** Foto(s) em TELA CHEIA: fundo escuro, desliza entre as fotos e, no iPhone, dá zoom com pinça. */
export function VisualizadorFotos({ fotos, indice = 0, visivel, aoFechar, aoMudar }: {
  fotos: string[]; indice?: number; visivel: boolean; aoFechar: () => void; aoMudar?: (i: number) => void;
}) {
  const { width: larguraTela, height: alturaTela } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [atual, setAtual] = useState(indice);

  React.useEffect(() => { if (visivel) setAtual(indice); }, [visivel, indice]);

  const aoRolarCheia = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(larguraTela, 1));
    const seguro = Math.max(0, Math.min(i, fotos.length - 1));
    setAtual(seguro);
    aoMudar?.(seguro);
  };

  if (fotos.length === 0) return null;

  return (
    <Modal visible={visivel} animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={s.cheia}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <FlatList
          data={fotos}
          keyExtractor={(uri, i) => `cheia-${uri}-${i}`}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(indice, fotos.length - 1)}
          getItemLayout={(_, i) => ({ length: larguraTela, offset: larguraTela * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={aoRolarCheia}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width: larguraTela, height: alturaTela }}
              contentContainerStyle={{ width: larguraTela, height: alturaTela, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={Platform.OS === 'ios' ? 4 : 1}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri: item }} style={{ width: larguraTela, height: alturaTela * 0.8 }} contentFit="contain" />
            </ScrollView>
          )}
        />
        <TouchableOpacity style={[s.fechar, { top: insets.top + 12 }]} onPress={aoFechar} activeOpacity={0.8} accessibilityLabel="Fechar">
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {fotos.length > 1 && (
          <View style={[s.rodapeCheia, { bottom: insets.bottom + 20 }]} pointerEvents="none">
            <Text style={s.rodapeCheiaTxt}>{atual + 1} / {fotos.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

interface Props {
  fotos?: string | string[] | null;
  altura?: number;
  /** Imagem mostrada quando não há fotos. */
  fallback?: string;
  raio?: number;
  /** Conteúdo sobreposto (botões de voltar/favoritar). */
  children?: React.ReactNode;
  /** Desliga o "toque para ampliar" (ex.: quando a área já tem outro toque). */
  semAmpliar?: boolean;
}

/**
 * Galeria de fotos: passa com o dedo (com bolinhas e contador) e, ao tocar, abre a imagem em TELA CHEIA
 * com fundo escuro, também deslizando entre as fotos (e pinça para dar zoom no iPhone).
 */
export default function GaleriaFotos({ fotos, altura = 260, fallback, raio = 0, children, semAmpliar }: Props) {
  const { width: larguraTela } = useWindowDimensions();
  const lista = normalizarFotos(fotos);
  const imagens = lista.length > 0 ? lista : fallback ? [fallback] : [];

  const [largura, setLargura] = useState(larguraTela);
  const [indice, setIndice] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [indiceCheia, setIndiceCheia] = useState(0);

  const aoRolar = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>, larguraPagina: number, definir: (n: number) => void) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(larguraPagina, 1));
    definir(Math.max(0, Math.min(i, imagens.length - 1)));
  }, [imagens.length]);

  const abrir = (i: number) => {
    if (semAmpliar || lista.length === 0) return;
    setIndiceCheia(i);
    setAberto(true);
  };

  if (imagens.length === 0) {
    return <View style={[s.vazio, { height: altura, borderRadius: raio }]}><Ionicons name="image-outline" size={40} color="#C9CBD0" /></View>;
  }

  return (
    <View style={{ height: altura, borderRadius: raio, overflow: 'hidden', backgroundColor: '#E6E7E9' }} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <FlatList
        data={imagens}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => aoRolar(e, largura, setIndice)}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={semAmpliar ? 1 : 0.95} onPress={() => abrir(index)} style={{ width: largura, height: altura }}>
            <Image source={{ uri: item }} style={{ width: largura, height: altura }} contentFit="cover" transition={150} />
          </TouchableOpacity>
        )}
        getItemLayout={(_, i) => ({ length: largura, offset: largura * i, index: i })}
      />

      {imagens.length > 1 && (
        <>
          <View pointerEvents="none" style={s.pontos}>
            {imagens.map((_, i) => <View key={i} style={[s.ponto, i === indice && s.pontoOn]} />)}
          </View>
          <View pointerEvents="none" style={s.contador}>
            <Ionicons name="images-outline" size={13} color="#fff" />
            <Text style={s.contadorTxt}>{indice + 1}/{imagens.length}</Text>
          </View>
        </>
      )}

      {lista.length > 0 && !semAmpliar && (
        <TouchableOpacity style={s.ampliar} onPress={() => abrir(indice)} activeOpacity={0.8} accessibilityLabel="Ver em tela cheia">
          <Ionicons name="expand-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {children}

      <VisualizadorFotos fotos={lista} indice={indiceCheia} visivel={aberto} aoFechar={() => setAberto(false)} aoMudar={setIndiceCheia} />
    </View>
  );
}

const s = StyleSheet.create({
  vazio: { backgroundColor: '#F0F0F2', alignItems: 'center', justifyContent: 'center' },
  pontos: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  pontoOn: { width: 20, backgroundColor: '#fff' },
  contador: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  contadorTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ampliar: { position: 'absolute', bottom: 12, left: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  cheia: { flex: 1, backgroundColor: '#000' },
  fechar: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  rodapeCheia: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  rodapeCheiaTxt: { color: '#fff', fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
});
