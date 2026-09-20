import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TAREFA_RASTREAMENTO = 'lokyva-rastreamento-em-segundo-plano';

const CHAVE_AGENDAMENTO_ATIVO = '@lokyva_rastreamento_agendamento_id';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

// Precisa ser definida no escopo do módulo (fora de qualquer componente) para que o
// sistema operacional consiga acordar essa tarefa mesmo com o app em segundo plano.
TaskManager.defineTask(TAREFA_RASTREAMENTO, async ({ data, error }) => {
  if (error) {
    console.log('Erro na tarefa de rastreamento:', error.message);
    return;
  }

  const { locations } = (data as { locations: Location.LocationObject[] }) || { locations: [] };
  const ultimaPosicao = locations?.[locations.length - 1];
  if (!ultimaPosicao) return;

  const agendamentoId = await AsyncStorage.getItem(CHAVE_AGENDAMENTO_ATIVO);
  if (!agendamentoId) return;

  try {
    const token = await pegarToken();
    await fetch(`${API_URL}/rastreamento/atualizar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agendamento_id: Number(agendamentoId),
        lat: ultimaPosicao.coords.latitude,
        lng: ultimaPosicao.coords.longitude,
      }),
    });
  } catch (e) {
    console.log('Falha ao transmitir localização em segundo plano', e);
  }
});

/**
 * Pede permissão de localização (em uso + segundo plano) e inicia o
 * compartilhamento contínuo, com notificação persistente no Android
 * (exigência do sistema para manter o rastreamento ativo em background).
 */
export async function iniciarRastreamentoBackground(agendamentoId: number): Promise<{ ok: boolean; motivo?: string }> {
  const permissaoUso = await Location.requestForegroundPermissionsAsync();
  if (permissaoUso.status !== 'granted') {
    return { ok: false, motivo: 'Permissão de localização negada.' };
  }

  const permissaoSegundoPlano = await Location.requestBackgroundPermissionsAsync();
  if (permissaoSegundoPlano.status !== 'granted') {
    return { ok: false, motivo: 'Permissão de localização em segundo plano negada.' };
  }

  await AsyncStorage.setItem(CHAVE_AGENDAMENTO_ATIVO, String(agendamentoId));

  const jaEmExecucao = await Location.hasStartedLocationUpdatesAsync(TAREFA_RASTREAMENTO).catch(() => false);
  if (jaEmExecucao) {
    await Location.stopLocationUpdatesAsync(TAREFA_RASTREAMENTO);
  }

  await Location.startLocationUpdatesAsync(TAREFA_RASTREAMENTO, {
    accuracy: Location.Accuracy.High,
    timeInterval: 6000,
    distanceInterval: 15,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Compartilhando sua localização',
      notificationBody: 'O estabelecimento está acompanhando sua chegada em tempo real.',
      notificationColor: '#FF5A00',
    },
  });

  return { ok: true };
}

export async function pararRastreamentoBackground() {
  await AsyncStorage.removeItem(CHAVE_AGENDAMENTO_ATIVO);

  const emExecucao = await Location.hasStartedLocationUpdatesAsync(TAREFA_RASTREAMENTO).catch(() => false);
  if (emExecucao) {
    await Location.stopLocationUpdatesAsync(TAREFA_RASTREAMENTO);
  }
}

export async function rastreamentoEstaAtivo() {
  return Location.hasStartedLocationUpdatesAsync(TAREFA_RASTREAMENTO).catch(() => false);
}
