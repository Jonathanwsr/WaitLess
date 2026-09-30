import AsyncStorage from '@react-native-async-storage/async-storage';
import { mostrarToast } from './toast';

/**
 * Liga/desliga um favorito no servidor e avisa na tela:
 * "Favorito adicionado" ou "Removido dos favoritos" (segundo o que o servidor confirmou).
 * Devolve o novo estado, ou null se falhou (a tela deve desfazer a mudança otimista).
 */
export async function alternarFavoritoRemoto(url: string, tipo: 'estabelecimento' | 'servico' | 'item_aluguel', id: number): Promise<boolean | null> {
  try {
    const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    });
    if (!r.ok) throw new Error(String(r.status));

    const dados = await r.json().catch(() => null);
    const favorito: boolean | null = typeof dados?.is_favorito === 'boolean' ? dados.is_favorito : null;
    mostrarToast(favorito === false ? 'Removido dos favoritos' : 'Favorito adicionado');
    return favorito === null ? true : favorito;
  } catch {
    mostrarToast('Não foi possível atualizar seus favoritos. Tente de novo.', 'erro');
    return null;
  }
}
