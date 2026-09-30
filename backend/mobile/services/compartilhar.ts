import { Share } from 'react-native';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
// Raiz do site: a mesma da API, sem o sufixo /api ou /api/mobile.
const SITE = ENV_URL.replace(/\/api(\/mobile)?\/?$/, '').replace(/\/+$/, '');

/** Link público do local (abre a página com prévia bonita e o botão "Agendar agora"). */
export const linkDoLocal = (id: number | string, servicoId?: number | string) =>
  `${SITE}/l/${id}${servicoId ? `?servico=${servicoId}` : ''}`;

/** Abre a folha de compartilhamento (WhatsApp, Instagram, etc.) com uma mensagem pronta. */
export async function compartilharLocal(local: { id: number | string; nome: string }, servico?: { id: number | string; nome: string }) {
  const link = linkDoLocal(local.id, servico?.id);
  const mensagem = servico
    ? `Olha esse serviço: ${servico.nome} na ${local.nome}. Agenda pelo Lokyva: ${link}`
    : `Olha essa: ${local.nome}. Agenda o seu horário pelo Lokyva: ${link}`;
  try {
    await Share.share({ message: mensagem });
  } catch {
    // o usuário fechou a folha de compartilhamento
  }
}
