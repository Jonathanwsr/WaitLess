import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';
import { mostrarToast } from '../../../services/toast';
import { apiMobile, brl, mensagemDeErro, ProdutoEntrega } from '../../../services/entregasApi';

const C = {
  ink: T.ink, muted: T.muted, faint: T.faint, canvas: T.cream, card: T.card, line: T.line,
  accent: T.primary, accentSoft: T.primarySoft, success: T.success, danger: T.danger,
};

type ModoPagamento = 'online' | 'local' | 'direto_vendedor';
type Recebimento = 'retirada' | 'entrega';
type MetodoOnline = 'pix' | 'cartao' | 'boleto';

const MODOS_PAGAMENTO: { id: ModoPagamento; titulo: string; descricao: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'online', titulo: 'Online', descricao: 'Protegido pela Lokyva até a entrega.', icone: 'shield-checkmark-outline' },
  { id: 'local', titulo: 'No local', descricao: 'Pague ao buscar ou receber.', icone: 'cash-outline' },
  { id: 'direto_vendedor', titulo: 'Direto com o vendedor', descricao: 'Combine o pagamento com ele.', icone: 'chatbubbles-outline' },
];

const METODOS_ONLINE: { id: MetodoOnline; titulo: string }[] = [
  { id: 'pix', titulo: 'Pix' },
  { id: 'cartao', titulo: 'Cartão' },
  { id: 'boleto', titulo: 'Boleto' },
];

const ENDERECO_VAZIO = {
  entrega_cep: '', entrega_rua: '', entrega_numero: '', entrega_complemento: '',
  entrega_bairro: '', entrega_cidade: '', entrega_estado: '', entrega_observacoes: '',
};

export default function EntregaDetalhes() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [produto, setProduto] = useState<ProdutoEntrega | null>(null);
  const [favoritado, setFavoritado] = useState(false);
  const [noCarrinho, setNoCarrinho] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [quantidade, setQuantidade] = useState(1);
  const [modoPagamento, setModoPagamento] = useState<ModoPagamento | null>(null);
  const [metodoOnline, setMetodoOnline] = useState<MetodoOnline | null>(null);
  const [recebimento, setRecebimento] = useState<Recebimento>('retirada');
  const [endereco, setEndereco] = useState(ENDERECO_VAZIO);

  const [assinando, setAssinando] = useState(false);
  const [enviandoAss, setEnviandoAss] = useState(false);
  const [freqAss, setFreqAss] = useState(30);
  const [qtdAss, setQtdAss] = useState(1);
  const [pagAss, setPagAss] = useState<'local' | 'direto_vendedor'>('local');

  const criarAssinatura = async () => {
    if (!produto) return;
    if (recebimento === 'entrega' && !enderecoCompleto) {
      alertar('Endereço incompleto', 'Preencha o endereço de entrega antes de assinar.');
      return;
    }
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    setEnviandoAss(true);
    const { ok, data } = await apiMobile('/entregas/assinaturas', {
      method: 'POST',
      json: {
        produto_entrega_id: produto.id,
        quantidade: qtdAss,
        frequencia_dias: freqAss,
        modo_recebimento: recebimento,
        modo_pagamento: pagAss,
        proxima_entrega_em: amanha.toISOString().slice(0, 10),
        endereco: recebimento === 'entrega'
          ? { cep: endereco.entrega_cep, rua: endereco.entrega_rua, numero: endereco.entrega_numero, complemento: endereco.entrega_complemento, bairro: endereco.entrega_bairro, cidade: endereco.entrega_cidade, estado: endereco.entrega_estado, observacoes: endereco.entrega_observacoes }
          : null,
      },
    });
    setEnviandoAss(false);
    if (ok) {
      setAssinando(false);
      mostrarToast('Assinatura criada!', 'sucesso');
      router.push('/src/screens/AssinaturasEntrega' as never);
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível criar a assinatura.'), 'erro');
    }
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { ok, data } = await apiMobile<{ produto: ProdutoEntrega; favoritado: boolean; quantidade_no_carrinho: number }>(`/entregas/produtos/${id}`);
      if (ok) {
        setProduto(data.produto);
        setFavoritado(!!data.favoritado);
        setNoCarrinho(Number(data.quantidade_no_carrinho || 0));
        const minimo = Number(data.produto.quantidade_minima || 1);
        setQuantidade(minimo);
        if (!data.produto.aceita_retirada && data.produto.aceita_entrega) setRecebimento('entrega');
      } else {
        setProduto(null);
      }
    } catch {
      setProduto(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const minimo = Number(produto?.quantidade_minima || 1);
  const aceitaOnline = !!produto?.aceita_pagamento_online;
  const aceitaEntrega = produto?.aceita_entrega !== false;
  const aceitaRetirada = produto?.aceita_retirada !== false;

  const valorUnitario = Number(produto?.valor_final || 0);
  const valorProdutos = valorUnitario * quantidade;
  const taxaEntrega = recebimento === 'entrega' ? Number(produto?.taxa_entrega || 0) : 0;
  const total = valorProdutos + taxaEntrega;

  const enderecoCompleto = ['entrega_cep', 'entrega_rua', 'entrega_numero', 'entrega_bairro', 'entrega_cidade', 'entrega_estado']
    .every((campo) => String(endereco[campo as keyof typeof endereco] || '').trim() !== '');

  const pagamentoOk = modoPagamento === 'online' ? aceitaOnline && !!metodoOnline : !!modoPagamento;
  const recebimentoOk = recebimento === 'retirada' || enderecoCompleto;
  const podeComprar = !!modoPagamento && pagamentoOk && recebimentoOk && quantidade >= minimo && !enviando;

  const atualizarEndereco = (campo: keyof typeof ENDERECO_VAZIO, valor: string) => setEndereco((prev) => ({ ...prev, [campo]: valor }));

  const buscarCep = async (valor: string) => {
    const cep = valor.replace(/\D/g, '').slice(0, 8);
    atualizarEndereco('entrega_cep', cep);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await res.json();
      if (!json.erro) {
        setEndereco((prev) => ({
          ...prev,
          entrega_rua: json.logradouro || prev.entrega_rua,
          entrega_bairro: json.bairro || prev.entrega_bairro,
          entrega_cidade: json.localidade || prev.entrega_cidade,
          entrega_estado: json.uf || prev.entrega_estado,
        }));
      }
    } catch {
      // ViaCEP é um atalho: sem ele o usuário digita o endereço à mão.
    }
  };

  const alternarFavorito = async () => {
    if (!produto) return;
    const anterior = favoritado;
    setFavoritado(!anterior);
    const { ok, data } = await apiMobile<{ is_favorito: boolean }>('/favoritos/toggle', {
      method: 'POST', json: { tipo: 'produto_entrega', id: produto.id },
    });
    if (ok) setFavoritado(!!data.is_favorito);
    else { setFavoritado(anterior); mostrarToast('Não foi possível atualizar os favoritos.', 'erro'); }
  };

  const perguntarAoVendedor = async () => {
    if (!produto) return;
    const { ok, data } = await apiMobile<{ conversa_id: number }>('/mensagens/iniciar', {
      method: 'POST', json: { produto_entrega_id: produto.id },
    });
    if (ok && data.conversa_id) router.push({ pathname: '/mensagens/[id]' as never, params: { id: String(data.conversa_id) } });
    else mostrarToast(mensagemDeErro(data, 'Não foi possível abrir a conversa.'), 'erro');
  };

  const adicionarAoCarrinho = async () => {
    if (!produto) return;
    const { ok, data } = await apiMobile('/entregas/carrinho', {
      method: 'POST', json: { produto_entrega_id: produto.id, quantidade },
    });
    if (ok) {
      setNoCarrinho((v) => v + quantidade);
      mostrarToast('Produto adicionado ao carrinho.', 'sucesso');
    } else {
      mostrarToast(mensagemDeErro(data, 'Não foi possível adicionar ao carrinho.'), 'erro');
    }
  };

  const comprar = async () => {
    if (!produto || !modoPagamento) return;
    setEnviando(true);
    try {
      const payload: Record<string, unknown> = {
        produto_entrega_id: produto.id,
        quantidade,
        modo_recebimento: recebimento,
        modo_pagamento: modoPagamento,
        ...(modoPagamento === 'online' ? { metodo_pagamento: metodoOnline } : {}),
        ...(recebimento === 'entrega' ? endereco : {}),
      };

      const { ok, data } = await apiMobile<any>('/entregas/pedidos', { method: 'POST', json: payload });
      if (!ok) {
        alertar('Não foi possível registrar o pedido', mensagemDeErro(data, 'Tente novamente em instantes.'));
        return;
      }

      const pedidoId = data.pedido?.id;
      if (data.pagamento?.invoice_url) {
        await WebBrowser.openBrowserAsync(data.pagamento.invoice_url);
      }
      router.replace({ pathname: '/src/screens/EntregaConfirmacao' as never, params: { pedidoId: String(pedidoId) } });
    } catch {
      alertar('Sem conexão', 'Verifique sua internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const textoBotao = enviando
    ? 'Processando...'
    : !modoPagamento
      ? 'Escolha a forma de pagamento'
      : modoPagamento === 'online' && !aceitaOnline
        ? 'Pagamento online indisponível'
        : modoPagamento === 'online' && !metodoOnline
          ? 'Escolha Pix, cartão ou boleto'
          : !recebimentoOk
            ? 'Preencha o endereço de entrega'
            : modoPagamento === 'online' ? 'Comprar agora' : 'Reservar pedido';

  if (carregando) {
    return <SafeAreaView style={s.safe}><View style={s.centro}><ActivityIndicator color={C.accent} /></View></SafeAreaView>;
  }

  if (!produto) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centro}>
          <Ionicons name="alert-circle-outline" size={44} color={C.faint} />
          <Text style={s.vazioTxt}>Este produto não está disponível.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const desconto = produto.tem_promocao && Number(produto.valor_final) < Number(produto.valor);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topo}>
        <TouchableOpacity onPress={() => router.back()} style={s.botaoRedondo} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.topoTitulo} numberOfLines={1}>{produto.nome}</Text>
        <TouchableOpacity onPress={alternarFavorito} style={s.botaoRedondo} hitSlop={8}>
          <Ionicons name={favoritado ? 'heart' : 'heart-outline'} size={20} color={favoritado ? C.danger : C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.fotoBox}>
          <Image source={{ uri: produto.fotos?.[0] || 'https://placehold.co/800x800/f4f4f5/a1a1aa?text=Produto' }} style={s.foto} contentFit="cover" />
          {desconto && <View style={s.selo}><Text style={s.seloTxt}>Promoção</Text></View>}
        </View>

        <View style={s.bloco}>
          {!!produto.categoria && <Text style={s.categoria}>{produto.categoria}</Text>}
          <Text style={s.titulo}>{produto.nome}</Text>
          <View style={s.linhaPreco}>
            <Text style={s.preco}>{brl(produto.valor_final)}</Text>
            {!!produto.unidade_medida && <Text style={s.unidade}>/ {produto.unidade_medida}</Text>}
            {desconto && <Text style={s.precoAntigo}>{brl(produto.valor)}</Text>}
          </View>
          <View style={s.fichas}>
            {!!produto.marca && <Ficha rotulo="Marca" valor={produto.marca} />}
            {!!produto.peso_volume && <Ficha rotulo="Peso / volume" valor={produto.peso_volume} />}
            {!!produto.sku && <Ficha rotulo="Código" valor={produto.sku} />}
            {minimo > 1 && <Ficha rotulo="Mínimo" valor={`${minimo} un.`} />}
          </View>
          {!!produto.descricao && <Text style={s.descricao}>{produto.descricao}</Text>}
          {!!produto.tags?.length && (
            <View style={s.tags}>
              {produto.tags.map((tag) => <Text key={tag} style={s.tag}>#{tag}</Text>)}
            </View>
          )}
        </View>

        <View style={s.bloco}>
          <View style={s.linhaEntre}>
            <View>
              <Text style={s.tituloCard}>{produto.estabelecimento?.nome || produto.vendedor?.name || 'Vendedor independente'}</Text>
              {!!produto.estabelecimento && <Text style={s.subtitulo}>Local cadastrado na Lokyva</Text>}
            </View>
            <TouchableOpacity onPress={perguntarAoVendedor} style={s.botaoOutline}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.ink} />
              <Text style={s.botaoOutlineTxt}>Perguntar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!aceitaOnline && (
          <View style={s.aviso}>
            <Ionicons name="information-circle-outline" size={18} color="#92400E" />
            <Text style={s.avisoTxt}>
              Este vendedor ainda não recebe pagamentos online. Você pode pagar no local ou combinar o pagamento direto com ele.
            </Text>
          </View>
        )}

        <View style={s.bloco}>
          <Text style={s.passo}>1 · Quantidade</Text>
          <View style={s.linhaEntre}>
            <View style={s.contador}>
              <TouchableOpacity onPress={() => setQuantidade((q) => Math.max(minimo, q - 1))} style={s.botaoContador}>
                <Ionicons name="remove" size={18} color={C.ink} />
              </TouchableOpacity>
              <Text style={s.quantidade}>{quantidade}</Text>
              <TouchableOpacity onPress={() => setQuantidade((q) => Math.min(produto.estoque_disponivel, q + 1))} style={s.botaoContador}>
                <Ionicons name="add" size={18} color={C.ink} />
              </TouchableOpacity>
            </View>
            <Text style={s.info}>
              {produto.estoque_disponivel} disponíveis{noCarrinho > 0 ? ` · ${noCarrinho} no carrinho` : ''}
            </Text>
          </View>
        </View>

        <View style={s.bloco}>
          <Text style={s.passo}>2 · Forma de pagamento</Text>
          {MODOS_PAGAMENTO.map((m) => {
            const bloqueado = m.id === 'online' && !aceitaOnline;
            const ativo = modoPagamento === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                disabled={bloqueado}
                onPress={() => setModoPagamento(m.id)}
                style={[s.opcao, ativo && s.opcaoAtiva, bloqueado && { opacity: 0.4 }]}
              >
                <Ionicons name={m.icone} size={22} color={ativo ? C.accent : C.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTitulo}>{m.titulo}</Text>
                  <Text style={s.opcaoDesc}>{m.descricao}</Text>
                </View>
                <Ionicons name={ativo ? 'radio-button-on' : 'radio-button-off'} size={20} color={ativo ? C.accent : C.faint} />
              </TouchableOpacity>
            );
          })}
          {modoPagamento === 'online' && (
            <View style={s.linhaMetodos}>
              {METODOS_ONLINE.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => setMetodoOnline(m.id)} style={[s.chip, metodoOnline === m.id && s.chipAtivo]}>
                  <Text style={[s.chipTxt, metodoOnline === m.id && s.chipTxtAtivo]}>{m.titulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={s.bloco}>
          <Text style={s.passo}>3 · Como receber</Text>
          <View style={s.linhaMetodos}>
            {aceitaRetirada && (
              <TouchableOpacity onPress={() => setRecebimento('retirada')} style={[s.chip, recebimento === 'retirada' && s.chipAtivo]}>
                <Text style={[s.chipTxt, recebimento === 'retirada' && s.chipTxtAtivo]}>Buscar no local</Text>
              </TouchableOpacity>
            )}
            {aceitaEntrega && (
              <TouchableOpacity onPress={() => setRecebimento('entrega')} style={[s.chip, recebimento === 'entrega' && s.chipAtivo]}>
                <Text style={[s.chipTxt, recebimento === 'entrega' && s.chipTxtAtivo]}>Entregar em casa</Text>
              </TouchableOpacity>
            )}
          </View>

          {recebimento === 'retirada' ? (
            <View style={s.enderecoBox}>
              <Text style={s.rotuloPequeno}>ENDEREÇO PARA BUSCAR</Text>
              <Text style={s.enderecoTxt}>
                {[produto.endereco_rua, produto.endereco_numero].filter(Boolean).join(', ') || 'Endereço não informado'}
                {produto.endereco_bairro ? ` - ${produto.endereco_bairro}` : ''}
                {produto.endereco_cidade ? `, ${produto.endereco_cidade}/${produto.endereco_estado}` : ''}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 12 }}>
              <Text style={s.info}>Taxa de entrega: {taxaEntrega > 0 ? brl(taxaEntrega) : 'grátis'}. Informe o endereço completo.</Text>
              <View style={s.linhaCampos}>
                <Campo estreito placeholder="CEP" valor={endereco.entrega_cep} onChange={buscarCep} teclado="numeric" />
                <Campo placeholder="Rua / logradouro" valor={endereco.entrega_rua} onChange={(v) => atualizarEndereco('entrega_rua', v)} />
              </View>
              <View style={s.linhaCampos}>
                <Campo estreito placeholder="Número" valor={endereco.entrega_numero} onChange={(v) => atualizarEndereco('entrega_numero', v)} />
                <Campo placeholder="Complemento (apto, bloco)" valor={endereco.entrega_complemento} onChange={(v) => atualizarEndereco('entrega_complemento', v)} />
              </View>
              <View style={s.linhaCampos}>
                <Campo placeholder="Bairro" valor={endereco.entrega_bairro} onChange={(v) => atualizarEndereco('entrega_bairro', v)} />
                <Campo estreito placeholder="UF" valor={endereco.entrega_estado} maxLength={2} onChange={(v) => atualizarEndereco('entrega_estado', v.toUpperCase())} />
              </View>
              <Campo placeholder="Cidade" valor={endereco.entrega_cidade} onChange={(v) => atualizarEndereco('entrega_cidade', v)} />
              <Campo placeholder="Detalhes do local (ponto de referência, portão, andar)" valor={endereco.entrega_observacoes} onChange={(v) => atualizarEndereco('entrega_observacoes', v)} multilinha />
            </View>
          )}
        </View>

        <View style={s.resumo}>
          <View style={s.linhaEntre}><Text style={s.resumoTxt}>{quantidade}x {produto.nome}</Text><Text style={s.resumoTxt}>{brl(valorProdutos)}</Text></View>
          <View style={s.linhaEntre}><Text style={s.resumoTxt}>Taxa de entrega</Text><Text style={s.resumoTxt}>{taxaEntrega > 0 ? brl(taxaEntrega) : 'Grátis'}</Text></View>
          <View style={[s.linhaEntre, s.totalLinha]}><Text style={s.totalTxt}>Total</Text><Text style={s.totalValor}>{brl(total)}</Text></View>
          <Text style={s.resumoNota}>
            Você recebe um código de 6 dígitos em "Meus pedidos". Mostre ao vendedor na {recebimento === 'entrega' ? 'entrega' : 'busca'}: é ele que libera o pagamento.
          </Text>

          <TouchableOpacity onPress={comprar} disabled={!podeComprar} style={[s.botaoCompra, !podeComprar && { opacity: 0.4 }]}>
            <Text style={s.botaoCompraTxt}>{textoBotao}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={adicionarAoCarrinho} style={s.botaoSecundario}>
            <Ionicons name="bag-add-outline" size={18} color="#fff" />
            <Text style={s.botaoSecundarioTxt}>Adicionar ao carrinho</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAssinando(true)} style={[s.botaoSecundario, { marginTop: 8 }]}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={s.botaoSecundarioTxt}>Assinar entrega recorrente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={assinando} transparent animationType="fade" onRequestClose={() => setAssinando(false)}>
        <View style={s.assFundo}>
          <View style={s.assCaixa}>
            <Text style={s.passo}>Assinar entrega</Text>
            <Text style={s.info}>{produto.nome} · pause ou cancele quando quiser</Text>

            <Text style={s.rotuloAss}>FREQUÊNCIA</Text>
            <View style={s.linhaMetodos}>
              {[{ d: 7, t: 'Semanal' }, { d: 14, t: 'Quinzenal' }, { d: 30, t: 'Mensal' }].map((f) => (
                <TouchableOpacity key={f.d} onPress={() => setFreqAss(f.d)} style={[s.chip, freqAss === f.d && s.chipAtivo]}>
                  <Text style={[s.chipTxt, freqAss === f.d && s.chipTxtAtivo]}>{f.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.rotuloAss}>PAGAMENTO</Text>
            <View style={s.linhaMetodos}>
              {[{ id: 'local' as const, t: 'No local' }, { id: 'direto_vendedor' as const, t: 'Direto com o vendedor' }].map((p) => (
                <TouchableOpacity key={p.id} onPress={() => setPagAss(p.id)} style={[s.chip, pagAss === p.id && s.chipAtivo]}>
                  <Text style={[s.chipTxt, pagAss === p.id && s.chipTxtAtivo]}>{p.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.rotuloAss}>QUANTIDADE</Text>
            <View style={s.contador}>
              <TouchableOpacity onPress={() => setQtdAss((q) => Math.max(1, q - 1))} style={s.botaoContador}>
                <Ionicons name="remove" size={18} color={C.ink} />
              </TouchableOpacity>
              <Text style={s.quantidade}>{qtdAss}</Text>
              <TouchableOpacity onPress={() => setQtdAss((q) => Math.min(20, q + 1))} style={s.botaoContador}>
                <Ionicons name="add" size={18} color={C.ink} />
              </TouchableOpacity>
            </View>

            <Text style={s.info}>
              Recebimento: {recebimento === 'entrega' ? 'entrega em casa (usa o endereço preenchido acima)' : 'retirada no local'}.
            </Text>

            <View style={s.assAcoes}>
              <TouchableOpacity onPress={() => setAssinando(false)} style={[s.assBotao, { backgroundColor: C.canvas }]}>
                <Text style={[s.assBotaoTxt, { color: C.ink }]}>Depois</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={criarAssinatura} disabled={enviandoAss} style={[s.assBotao, { backgroundColor: C.accent }]}>
                <Text style={[s.assBotaoTxt, { color: '#fff' }]}>{enviandoAss ? 'Criando...' : 'Criar assinatura'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Ficha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={s.ficha}>
      <Text style={s.fichaRotulo}>{rotulo}</Text>
      <Text style={s.fichaValor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

function Campo({ placeholder, valor, onChange, estreito, multilinha, teclado, maxLength }: {
  placeholder: string; valor: string; onChange: (v: string) => void; estreito?: boolean; multilinha?: boolean;
  teclado?: 'default' | 'numeric'; maxLength?: number;
}) {
  return (
    <TextInput
      value={valor}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      keyboardType={teclado || 'default'}
      maxLength={maxLength}
      multiline={multilinha}
      style={[s.campo, estreito && { flex: 0.45 }, !estreito && { flex: 1 }, multilinha && { minHeight: 64, textAlignVertical: 'top' }]}
    />
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  vazioTxt: { color: C.muted, fontWeight: '600' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  topoTitulo: { flex: 1, marginHorizontal: 10, fontSize: 15, fontWeight: '800', color: C.ink, textAlign: 'center' },
  botaoRedondo: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingBottom: 60, gap: 14 },
  fotoBox: { width: '100%', aspectRatio: 1.3, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EDEDED' },
  foto: { width: '100%', height: '100%' },
  selo: { position: 'absolute', top: 12, left: 12, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  seloTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  bloco: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line, gap: 10 },
  categoria: { fontSize: 10, fontWeight: '900', color: C.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  titulo: { fontSize: 22, fontWeight: '900', color: C.ink },
  linhaPreco: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  preco: { fontSize: 28, fontWeight: '900', color: C.accent },
  unidade: { fontSize: 13, color: C.faint },
  precoAntigo: { fontSize: 13, color: C.faint, textDecorationLine: 'line-through' },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ficha: { backgroundColor: C.canvas, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: '45%' },
  fichaRotulo: { fontSize: 9, fontWeight: '800', color: C.faint, textTransform: 'uppercase' },
  fichaValor: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 2 },
  descricao: { fontSize: 13, color: C.muted, lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 11, fontWeight: '700', color: C.muted, backgroundColor: C.canvas, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tituloCard: { fontSize: 15, fontWeight: '800', color: C.ink },
  subtitulo: { fontSize: 11, color: C.faint, marginTop: 2 },
  botaoOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  botaoOutlineTxt: { fontSize: 12, fontWeight: '800', color: C.ink },
  aviso: { flexDirection: 'row', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  avisoTxt: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 17 },
  passo: { fontSize: 13, fontWeight: '900', color: C.ink },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  botaoContador: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  quantidade: { fontSize: 20, fontWeight: '900', color: C.ink, minWidth: 24, textAlign: 'center' },
  info: { fontSize: 12, color: C.faint, fontWeight: '600' },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  opcaoAtiva: { borderColor: C.accent, backgroundColor: C.accentSoft },
  opcaoTitulo: { fontSize: 14, fontWeight: '800', color: C.ink },
  opcaoDesc: { fontSize: 11, color: C.muted, marginTop: 2 },
  linhaMetodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipAtivo: { backgroundColor: C.ink, borderColor: C.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.muted },
  chipTxtAtivo: { color: '#fff' },
  enderecoBox: { backgroundColor: C.canvas, borderRadius: 14, padding: 12, marginTop: 10 },
  rotuloPequeno: { fontSize: 9, fontWeight: '800', color: C.faint },
  enderecoTxt: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 4 },
  linhaCampos: { flexDirection: 'row', gap: 8 },
  campo: { backgroundColor: C.canvas, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.line },
  resumo: { backgroundColor: C.ink, borderRadius: 20, padding: 18, gap: 8 },
  resumoTxt: { color: '#D4D4D8', fontSize: 13 },
  totalLinha: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10, marginTop: 4 },
  totalTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  totalValor: { color: '#fff', fontWeight: '900', fontSize: 24 },
  resumoNota: { color: '#A1A1AA', fontSize: 11, lineHeight: 16, marginTop: 4 },
  botaoCompra: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  botaoCompraTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  botaoSecundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 14, paddingVertical: 13 },
  botaoSecundarioTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  assFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  assCaixa: { width: '100%', backgroundColor: C.card, borderRadius: 22, padding: 20, gap: 12 },
  rotuloAss: { fontSize: 10, fontWeight: '800', color: C.faint, letterSpacing: 0.6, marginTop: 4 },
  assAcoes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  assBotao: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  assBotaoTxt: { fontWeight: '800', fontSize: 14 },
});
