import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Carrega dados de uma tela toda vez que ela ganha foco, com estados de
 * carregamento, "puxar para atualizar" e erro. Sessão expirada (401) volta ao login.
 */
export function useCarga<T>(buscar: () => Promise<T>, dependencias: unknown[] = []) {
  const router = useRouter();
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      setDados(await buscar());
    } catch (e: any) {
      if (e?.status === 401) {
        await AsyncStorage.multiRemove(['@waitless_token', '@lokyva_token']);
        router.replace('/autenticacao/login' as never);
        return;
      }
      setErro(e?.message || 'Não foi possível carregar os dados.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useFocusEffect(
    useCallback(() => {
      carregar(!!dados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carregar])
  );

  const atualizar = () => {
    setAtualizando(true);
    carregar(true);
  };

  return { dados, carregando, atualizando, erro, recarregar: () => carregar(false), atualizar };
}
