import React from 'react';
import { View, Text } from 'react-native';

// O Expo Go não traz o código nativo do Mapbox: importar '@rnmapbox/maps' lá
// lança exceção na hora do import e derruba a tela inteira (e o Expo Router
// ainda acusa "missing default export"). Aqui o import é protegido — num
// development build o mapa real é usado; no Expo Go cai num aviso simples.
let mapboxReal: any = null;
try {
  mapboxReal = require('@rnmapbox/maps');
} catch {
  mapboxReal = null;
}

export const MAPBOX_DISPONIVEL = !!mapboxReal;

const modulo = mapboxReal?.default ?? mapboxReal;

if (MAPBOX_DISPONIVEL) {
  try {
    modulo.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  } catch {}
}

function MapaIndisponivel({ style }: { style?: any }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 16 }, style]}>
      <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
        Mapa indisponível no Expo Go. Use um development build para ver o mapa.
      </Text>
    </View>
  );
}

const Nulo = () => null;

export const Mapbox: any = MAPBOX_DISPONIVEL ? modulo : { StyleURL: { Street: '' }, setAccessToken: () => {} };
export const MapView: any = MAPBOX_DISPONIVEL ? mapboxReal.MapView : MapaIndisponivel;
export const Camera: any = MAPBOX_DISPONIVEL ? mapboxReal.Camera : Nulo;
export const MarkerView: any = MAPBOX_DISPONIVEL ? mapboxReal.MarkerView : Nulo;
export const ShapeSource: any = MAPBOX_DISPONIVEL ? mapboxReal.ShapeSource : Nulo;
export const LineLayer: any = MAPBOX_DISPONIVEL ? mapboxReal.LineLayer : Nulo;

export default Mapbox;
