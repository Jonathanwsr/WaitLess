import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapbox, { MapView, Camera, MarkerView, ShapeSource, LineLayer, MAPBOX_DISPONIVEL } from '../../../services/mapboxSeguro';
import { T } from '../../../constants/ClientTheme';

type Ponto = { numero?: number | null; titulo: string; latitude: number | null; longitude: number | null; tipo?: string };

const COR: Record<string, string> = { ponto_turistico: '#E8590C', locacao: '#111827', anotacao: '#CA8A04' };

/**
 * Mapa do dia com os pontos numerados na ordem. No Expo Go (sem o Mapbox nativo) mostra a lista numerada
 * e o botão para abrir a rota completa no Google Maps — que funciona em qualquer aparelho.
 */
export default function MapaDia({ pontos, centro, altura = 260, ligar = true }: {
  pontos: Ponto[]; centro?: { lat: number; lng: number } | null; altura?: number; ligar?: boolean;
}) {
  const validos = useMemo(() => pontos.filter((p) => p.latitude != null && p.longitude != null), [pontos]);
  const coords = validos.map((p) => [Number(p.longitude), Number(p.latitude)]);

  const abrirRota = () => {
    if (!validos.length) return;
    const fim = validos[validos.length - 1];
    const meio = validos.slice(0, -1).slice(0, 8).map((p) => `${p.latitude},${p.longitude}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${fim.latitude},${fim.longitude}${meio ? `&waypoints=${encodeURIComponent(meio)}` : ''}`;
    Linking.openURL(url).catch(() => {});
  };

  const limites = useMemo(() => {
    if (coords.length < 2) return null;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    return { ne: [Math.max(...lngs), Math.max(...lats)], sw: [Math.min(...lngs), Math.min(...lats)], paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 };
  }, [JSON.stringify(coords)]);

  return (
    <View style={{ gap: 8 }}>
      {MAPBOX_DISPONIVEL ? (
        <View style={[s.caixa, { height: altura }]} accessibilityLabel="Mapa do dia">
          <MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Street} scaleBarEnabled={false}>
            <Camera
              bounds={limites || undefined}
              centerCoordinate={!limites ? (coords[0] || (centro ? [centro.lng, centro.lat] : [-51.9, -14.2])) : undefined}
              zoomLevel={!limites ? (coords.length ? 14 : centro ? 12 : 3) : undefined}
              animationDuration={400}
            />
            {ligar && coords.length > 1 && (
              <ShapeSource id="rota-dia" shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as any}>
                <LineLayer id="linha-dia" style={{ lineColor: T.primary, lineWidth: 3, lineDasharray: [2, 2], lineOpacity: 0.8 }} />
              </ShapeSource>
            )}
            {validos.map((p, i) => (
              <MarkerView key={`${p.titulo}${i}`} coordinate={coords[i]} allowOverlap>
                <View style={[s.marcador, { backgroundColor: COR[p.tipo || 'locacao'] || '#111827' }]}>
                  <Text style={s.marcadorTxt}>{p.numero ?? i + 1}</Text>
                </View>
              </MarkerView>
            ))}
          </MapView>
        </View>
      ) : (
        <View style={s.lista}>
          {validos.length === 0 ? <Text style={s.vazio}>Nenhum ponto com localização neste dia.</Text> : validos.map((p, i) => (
            <View key={`${p.titulo}${i}`} style={s.linha}>
              <View style={[s.marcador, { backgroundColor: COR[p.tipo || 'locacao'] || '#111827' }]}><Text style={s.marcadorTxt}>{p.numero ?? i + 1}</Text></View>
              <Text style={s.linhaTxt} numberOfLines={1}>{p.titulo}</Text>
            </View>
          ))}
        </View>
      )}
      {validos.length > 0 && (
        <TouchableOpacity style={s.botao} onPress={abrirRota} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={s.botaoTxt}>Abrir a rota do dia no Google Maps</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  marcador: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  marcadorTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  lista: { backgroundColor: '#fff', borderRadius: 20, padding: 12, gap: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linhaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: T.ink },
  vazio: { fontSize: 13, color: T.muted, textAlign: 'center', padding: 8 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 14, backgroundColor: T.ink },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
