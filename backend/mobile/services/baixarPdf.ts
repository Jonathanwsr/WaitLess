import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_MOBILE, pegarToken } from './entregasApi';

/**
 * Baixa um PDF autenticado da API mobile e abre a folha de compartilhamento (salvar, enviar, imprimir).
 * Lança Error com mensagem amigável quando o download falha.
 */
export async function baixarPdf(caminho: string, nomeArquivo: string): Promise<void> {
  const token = await pegarToken();
  const destino = `${FileSystem.cacheDirectory}${nomeArquivo.replace(/[^A-Za-z0-9_.-]/g, '_')}`;

  const r = await FileSystem.downloadAsync(`${API_MOBILE}${caminho}`, destino, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
  });

  if (r.status !== 200) {
    throw new Error('Não foi possível baixar o comprovante agora. Tente novamente.');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(r.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Comprovante' });
  }
}
