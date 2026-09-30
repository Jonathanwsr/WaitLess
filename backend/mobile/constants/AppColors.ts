/**
 * Paleta única do app (Lokyva/WaitLess). Usada pra manter as telas
 * consistentes entre si — sempre que uma tela for modernizada, ela deve
 * importar daqui em vez de espalhar hex codes soltos pelo StyleSheet.
 *
 * Direção visual: base neutra (branco, cinza-azulado, tinta escura) e o
 * laranja da marca só como DETALHE (ícone, chip ativo, ação principal) —
 * nunca como cor de fundo de blocos grandes.
 */
export const AppColors = {
  // Marca (usar com moderação)
  primary: '#FF7A00',
  primaryLight: '#FFF1E4',

  // Base neutra moderna
  ink: '#282828',
  inkSoft: '#3A3A3A',
  canvas: '#F5F5F5',
  card: '#FFFFFF',
  line: '#E6E7E9',

  secondary: '#3A3A3A',
  success: '#00A868',
  successLight: '#D1FAE5',
  error: '#DC2626',
  errorLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FEF3C7',

  text: '#282828',
  textMuted: '#6A6C72',
  textFaint: '#A0A2A8',

  background: '#F5F5F5',
  white: '#FFFFFF',
  border: '#E6E7E9',
  borderLight: '#F0F0F2',
} as const;

export default AppColors;
