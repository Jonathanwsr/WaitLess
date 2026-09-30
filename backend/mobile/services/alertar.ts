/**
 * Substituto visual do `Alert.alert` do React Native: mesma assinatura (título, mensagem,
 * botões), mas exibido numa janela moderna pelo <AlertaHost /> do layout raiz.
 * Funciona em qualquer lugar (telas, serviços, callbacks), sem hook nem contexto.
 */
export type BotaoAlerta = {
  text?: string;
  onPress?: (valor?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type TipoAlerta = 'erro' | 'sucesso' | 'info' | 'aviso' | 'premium';

export type DadosAlerta = {
  id: number;
  titulo: string;
  mensagem?: string;
  botoes: BotaoAlerta[];
  tipo: TipoAlerta;
};

type Ouvinte = (a: DadosAlerta) => void;

const ouvintes = new Set<Ouvinte>();
// Alertas disparados antes do host montar (ex.: logo na abertura) ficam na fila.
const pendentes: DadosAlerta[] = [];
let contador = 0;

const RE_ERRO = /erro|falha|não foi possível|nao foi possivel|ops|inválid|invalid|negad|recusad|não permitid|indispon|expirad|incorret/i;
const RE_SUCESSO = /sucesso|pronto|conclu|enviad|salv|confirmad|parabéns|aprovad|criad|atualizad|removid|cancelad|tudo certo|feito/i;
const RE_AVISO = /atenção|atencao|aviso|aten|preencha|campos? obrigat|faltam|selecione|informe|permiss/i;

function inferirTipo(titulo: string, mensagem: string | undefined, botoes: BotaoAlerta[]): TipoAlerta {
  const texto = `${titulo} ${mensagem || ''}`;
  if (/premium/i.test(texto) && botoes.length <= 1 && /(seja|assine|exclusiv|dispon[ií]vel apenas|somente)/i.test(texto)) return 'premium';
  if (botoes.some((b) => b.style === 'destructive')) return 'aviso';
  if (RE_ERRO.test(titulo)) return 'erro';
  if (RE_SUCESSO.test(titulo)) return 'sucesso';
  if (RE_AVISO.test(titulo)) return 'aviso';
  if (botoes.length > 1) return 'info';
  // Título neutro: a mensagem ajuda a decidir.
  if (RE_ERRO.test(mensagem || '')) return 'erro';
  if (RE_SUCESSO.test(mensagem || '')) return 'sucesso';
  return 'info';
}

export function alertar(titulo: string, mensagem?: string, botoes?: BotaoAlerta[], _opcoes?: unknown) {
  const lista: BotaoAlerta[] = botoes && botoes.length > 0 ? botoes : [{ text: 'Ok' }];
  const dados: DadosAlerta = {
    id: ++contador,
    titulo: String(titulo ?? ''),
    mensagem: mensagem === undefined || mensagem === null || mensagem === '' ? undefined : String(mensagem),
    botoes: lista,
    tipo: inferirTipo(String(titulo ?? ''), mensagem, lista),
  };

  if (ouvintes.size === 0) pendentes.push(dados);
  else ouvintes.forEach((o) => o(dados));
}

export function assinarAlertas(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  while (pendentes.length > 0) ouvinte(pendentes.shift() as DadosAlerta);
  return () => { ouvintes.delete(ouvinte); };
}
