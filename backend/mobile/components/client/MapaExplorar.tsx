import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapbox, { MapView, Camera, MarkerView, MAPBOX_DISPONIVEL } from '../../services/mapboxSeguro';
import { T } from '../../constants/ClientTheme';
import { useIdioma } from '../../services/idioma';

export type PinoExplorar = {
  chave: string; nome: string; subtitulo?: string | null; preco?: string | null; foto?: string | null;
  latitude?: number | null; longitude?: number | null; distancia?: number | null;
};

/**
 * Resultados do Explorar no mapa: pinos com o preço; tocar mostra um cartão com "Ver".
 * No Expo Go (sem Mapbox nativo) vira uma lista por distância com atalho para o Google Maps.
 */
export default function MapaExplorar({ pinos, aoAbrir, centro, altura = 460 }: {
  pinos: PinoExplorar[]; aoAbrir: (chave: string) => void; centro?: { lat: number; lng: number } | null; altura?: number;
}) {
  const [selecionado, setSelecionado] = useState<PinoExplorar | null>(null);
  const { t } = useIdioma();
  const validos = useMemo(() => pinos.filter((p) => p.latitude != null && p.longitude != null && Number(p.latitude) !== 0), [pinos]);
  const semPosicao = pinos.length - validos.length;

  const limites = useMemo(() => {
    if (validos.length < 2) return null;
    const lngs = validos.map((p) => Number(p.longitude));
    const lats = validos.map((p) => Number(p.latitude));
    return { ne: [Math.max(...lngs), Math.max(...lats)], sw: [Math.min(...lngs), Math.min(...lats)], paddingTop: 60, paddingBottom: 140, paddingLeft: 40, paddingRight: 40 };
  }, [validos]);

  const abrirNoMaps = (p: PinoExplorar) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`).catch(() => {});

  const aviso = semPosicao > 0 ? (
    <Text style={s.aviso}>
      {semPosicao === pinos.length
        ? t('Estes resultados ainda não têm localização. Use a lista.')
        : t('{n} resultado(s) sem localização aparecem só na lista.', { n: semPosicao })}
    </Text>
  ) : null;

  if (!MAPBOX_DISPONIVEL) {
    const ordenados = [...validos].sort((a, b) => (a.distancia ?? 1e9) - (b.distancia ?? 1e9));
    return (
      <View style={{ gap: 10 }}>
        <View style={s.semMapa}>
          <Ionicons name="map-outline" size={20} color={T.muted} />
          <Text style={s.semMapaTxt}>{t('O mapa aparece no app instalado. Aqui você pode abrir cada lugar no Google Maps.')}</Text>
        </View>
        {ordenados.map((p) => (
          <View key={p.chave} style={s.linha}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => aoAbrir(p.chave)} activeOpacity={0.8}>
              <Text style={s.nome} numberOfLines={1}>{p.nome}</Text>
              <Text style={s.sub} numberOfLines={1}>{[p.distancia != null ? `${p.distancia.toFixed(1)} km` : null, p.subtitulo, p.preco].filter(Boolean).join(' · ')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.mapsBtn} onPress={() => abrirNoMaps(p)} accessibilityLabel={`Abrir ${p.nome} no Google Maps`}>
              <Ionicons name="navigate" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {aviso}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.caixa, { height: altura }]} accessibilityLabel="Mapa dos resultados">
        <MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Street} scaleBarEnabled={false} onPress={() => setSelecionado(null)}>
          <Camera
            bounds={limites || undefined}
            centerCoordinate={!limites ? (validos[0] ? [Number(validos[0].longitude), Number(validos[0].latitude)] : centro ? [centro.lng, centro.lat] : [-51.9, -14.2]) : undefined}
            zoomLevel={!limites ? (validos.length ? 14 : centro ? 12 : 3) : undefined}
            animationDuration={400}
          />
          {centro && (
            <MarkerView coordinate={[centro.lng, centro.lat]} allowOverlap>
              <View style={s.voce} />
            </MarkerView>
          )}
          {validos.map((p) => {
            const ativo = selecionado?.chave === p.chave;
            return (
              <MarkerView key={p.chave} coordinate={[Number(p.longitude), Number(p.latitude)]} allowOverlap>
                <TouchableOpacity onPress={() => setSelecionado(p)} activeOpacity={0.85} style={[s.pino, ativo && s.pinoAtivo]}>
                  <Text style={s.pinoTxt} numberOfLines={1}>{p.preco || p.nome}</Text>
                </TouchableOpacity>
              </MarkerView>
            );
          })}
        </MapView>

        {selecionado && (
          <View style={s.cartao}>
            {selecionado.foto ? <Image source={{ uri: selecionado.foto }} style={s.foto} /> : <View style={[s.foto, s.fotoVazia]}><Ionicons name="location" size={22} color={T.primary} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={s.nome} numberOfLines={1}>{selecionado.nome}</Text>
              {!!selecionado.subtitulo && <Text style={s.sub} numberOfLines={1}>{selecionado.subtitulo}</Text>}
              {!!selecionado.preco && <Text style={s.preco}>{selecionado.preco}</Text>}
            </View>
            <TouchableOpacity style={s.ver} onPress={() => aoAbrir(selecionado.chave)} activeOpacity={0.85}>
              <Text style={s.verTxt}>{t('Ver')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {aviso}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  pino: { backgroundColor: T.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: '#fff', maxWidth: 160, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  pinoAtivo: { backgroundColor: T.ink },
  pinoTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  voce: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#fff' },
  cartao: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  foto: { width: 58, height: 58, borderRadius: 14 },
  fotoVazia: { backgroundColor: '#FFF1E8', alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 15, fontWeight: '900', color: T.ink },
  sub: { fontSize: 12, color: T.muted, marginTop: 1 },
  preco: { fontSize: 13, fontWeight: '800', color: T.primary, marginTop: 2 },
  ver: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' },
  verTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  aviso: { fontSize: 12, color: T.muted, textAlign: 'center' },
  semMapa: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 12 },
  semMapaTxt: { flex: 1, fontSize: 12, color: T.muted, lineHeight: 17 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F0F0F2' },
  mapsBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' },
});
