import * as Location from 'expo-location';
import { alertar } from './alertar';

/**
 * Localização sempre opcional: explica em uma frase para que serve, só então pede a permissão.
 * Devolve null se a pessoa recusar ou o GPS falhar — a tela segue com a busca por nome.
 * A coordenada é usada só na consulta; nada é salvo.
 */
export function pedirLocalizacao(explicacao: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    alertar('Usar sua localização?', `${explicacao} Ela não fica salva.`, [
      { text: 'Agora não', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Permitir',
        onPress: async () => {
          try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (perm.status !== 'granted') {
              alertar('Sem permissão de localização', 'Tudo bem! Você pode buscar pelo nome da cidade ou do ponto turístico.');
              resolve(null);
              return;
            }
            const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
          } catch {
            alertar('Não conseguimos sua localização', 'Verifique se o GPS está ligado ou busque pelo nome do lugar.');
            resolve(null);
          }
        },
      },
    ]);
  });
}
