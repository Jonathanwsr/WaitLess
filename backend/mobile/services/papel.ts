import * as SecureStore from 'expo-secure-store';

export const PAPEIS_DONO = ['socio', 'proprietario', 'gerente'];
export const PAPEIS_EQUIPE = ['funcionario', 'atendente'];

export async function obterPapel(): Promise<string> {
  try {
    const salvo = await SecureStore.getItemAsync('userData');
    const usuario = salvo ? JSON.parse(salvo) : null;
    return String(usuario?.papel || '').toLowerCase().trim();
  } catch {
    return '';
  }
}

/** Área do cliente (abas Início/Descubra/Carteira/...): só quem NÃO é dono, equipe nem admin. */
export function ehCliente(papel: string): boolean {
  return !PAPEIS_DONO.includes(papel) && !PAPEIS_EQUIPE.includes(papel) && papel !== 'admin';
}

/** Tela inicial correta de cada papel. */
export function rotaInicialDoPapel(papel: string): string {
  if (papel === 'admin') return '/src/screens/AdminUsuarios';
  if (PAPEIS_DONO.includes(papel)) return '/Proprietario/dashboard';
  if (PAPEIS_EQUIPE.includes(papel)) return '/src/funcionario/Painel-funcioanario';
  return '/(tabs)/home';
}
