import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { OwnerScreen, Card, Rotulo, Segmentado, Vazio, Pilula, api, BASE, tokenDoUsuario, brl, dataCurta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { O } from '../../constants/OwnerTheme';
import { COMO_FUNCIONA, STATUS_PEDIDO, mensagemDeErro } from '../../services/entregasApi';

type Produto = any;

type Dados = {
  produtos: Produto[];
  estabelecimentos: { id: number; nome: string }[];
  categorias: string[];
  unidades: string[];
};

const VAZIO_FORM = {
  nome: '', descricao: '', categoria: '', marca: '', unidade_medida: 'un', peso_volume: '', sku: '', tags: '',
  quantidade_minima: '1', valor: '', tem_promocao: false, valor_promocional: '', taxa_entrega: '0',
  estoque_disponivel: '1', aceita_entrega: true, aceita_retirada: true, ativo: true, estabelecimento_id: '' as string,
  endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '', endereco_bairro: '',
  endereco_cidade: '', endereco_estado: '',
};

export default function ProdutosEntrega() {
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(async () => {
    const r = await api('/produtos-entrega');
    return { produtos: r.produtos || [], estabelecimentos: r.estabelecimentos || [], categorias: r.categorias || [], unidades: r.unidades || [] };
  });
  const [aba, setAba] = useState<'produtos' | 'pedidos'>('produtos');
  const [formulario, setFormulario] = useState<{ editando: Produto | null; valores: typeof VAZIO_FORM; fotos: string[] } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pedidos, setPedidos] = useState<any[] | null>(null);
  const [vinculando, setVinculando] = useState<Produto | null>(null);

  const produtos = dados?.produtos || [];
  const vinculados = produtos.filter((p) => p.estabelecimento_id);
  const avulsos = produtos.filter((p) => !p.estabelecimento_id);

  const carregarPedidos = async () => {
    try {
      const r = await api('/entregas/pedidos-recebidos');
      setPedidos(r.pedidos || []);
    } catch (e: any) {
      mostrarErro(e);
    }
  };

  const abrirNovo = () => setFormulario({ editando: null, valores: { ...VAZIO_FORM }, fotos: [] });

  const abrirEdicao = (p: Produto) => setFormulario({
    editando: p,
    fotos: p.fotos || [],
    valores: {
      nome: p.nome || '', descricao: p.descricao || '', categoria: p.categoria || '', marca: p.marca || '',
      unidade_medida: p.unidade_medida || 'un', peso_volume: p.peso_volume || '', sku: p.sku || '',
      tags: (p.tags || []).join(', '), quantidade_minima: String(p.quantidade_minima || 1),
      valor: String(p.valor ?? ''), tem_promocao: !!p.tem_promocao, valor_promocional: p.valor_promocional ? String(p.valor_promocional) : '',
      taxa_entrega: String(p.taxa_entrega ?? 0), estoque_disponivel: String(p.estoque_disponivel ?? 1),
      aceita_entrega: p.aceita_entrega !== false, aceita_retirada: p.aceita_retirada !== false, ativo: !!p.ativo,
      estabelecimento_id: p.estabelecimento_id ? String(p.estabelecimento_id) : '',
      endereco_cep: p.endereco_cep || '', endereco_rua: p.endereco_rua || '', endereco_numero: p.endereco_numero || '',
      endereco_complemento: p.endereco_complemento || '', endereco_bairro: p.endereco_bairro || '',
      endereco_cidade: p.endereco_cidade || '', endereco_estado: p.endereco_estado || '',
    },
  });

  const setCampo = (campo: keyof typeof VAZIO_FORM, valor: any) =>
    setFormulario((f) => (f ? { ...f, valores: { ...f.valores, [campo]: valor } } : f));

  const adicionarFotos = async () => {
    if (!formulario) return;
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return mostrarErro({ message: 'Permita o acesso às fotos para adicionar imagens.' });
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3 - formulario.fotos.length, quality: 0.8 });
    if (r.canceled) return;
    const novas = r.assets.map((a) => a.uri).slice(0, 3 - formulario.fotos.length);
    setFormulario((f) => (f ? { ...f, fotos: [...f.fotos, ...novas] } : f));
  };

  const salvar = async () => {
    if (!formulario) return;
    const v = formulario.valores;
    if (!v.nome.trim() || !v.categoria || !v.valor) return mostrarErro({ message: 'Preencha nome, categoria e preço.' });
    if (!v.endereco_rua || !v.endereco_numero || !v.endereco_bairro || !v.endereco_cidade || !v.endereco_estado || !v.endereco_cep) {
      return mostrarErro({ message: 'Informe o endereço de origem (de onde o produto sai) completo.' });
    }
    setSalvando(true);
    try {
      const token = await tokenDoUsuario();
      const corpo = new FormData();
      Object.entries(v).forEach(([chave, valor]) => {
        if (typeof valor === 'boolean') corpo.append(chave, valor ? '1' : '0');
        else if (valor !== '' && valor !== null) corpo.append(chave, String(valor));
      });
      formulario.fotos.filter((uri) => !uri.startsWith('http')).forEach((uri, i) => {
        corpo.append('fotos[]', { uri, name: `foto${i}.jpg`, type: 'image/jpeg' } as any);
      });
      formulario.fotos.filter((uri) => uri.startsWith('http')).forEach((uri) => corpo.append('fotos_mantidas[]', uri));

      const url = formulario.editando ? `${BASE}/produtos-entrega/${formulario.editando.id}` : `${BASE}/produtos-entrega`;
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: corpo });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return mostrarErro({ message: mensagemDeErro(json, 'Não foi possível salvar o produto.') });

      setFormulario(null);
      mostrarSucesso(formulario.editando ? 'Produto atualizado' : 'Produto cadastrado', json.message);
      recarregar();
    } catch (e: any) {
      mostrarErro(e);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (p: Produto) => {
    try {
      await api(`/produtos-entrega/${p.id}/toggle-ativo`, { method: 'PATCH' });
      recarregar();
    } catch (e: any) {
      mostrarErro(e);
    }
  };

  const excluir = async (p: Produto) => {
    try {
      await api(`/produtos-entrega/${p.id}`, { method: 'DELETE' });
      mostrarSucesso('Produto removido');
      recarregar();
    } catch (e: any) {
      mostrarErro(e, 'Não foi possível remover');
    }
  };

  const vincular = async (p: Produto, estabelecimentoId: number | null) => {
    try {
      await api(`/produtos-entrega/${p.id}/vincular-local`, { method: 'POST', body: { estabelecimento_id: estabelecimentoId } });
      setVinculando(null);
      recarregar();
    } catch (e: any) {
      mostrarErro(e);
    }
  };

  const confirmarEntrega = async (pedido: any, codigo: string) => {
    try {
      await api(`/entregas/pedidos/${pedido.id}/liberar`, { method: 'POST', body: { codigo } });
      mostrarSucesso('Entrega confirmada', 'O pagamento foi liberado.');
      carregarPedidos();
    } catch (e: any) {
      mostrarErro(e, 'Código não confirmado');
    }
  };

  const renderLinha = (p: Produto) => {
    const desconto = p.tem_promocao && Number(p.valor_promocional) < Number(p.valor);
    return (
      <Card key={p.id} style={{ gap: 10 }}>
        <View style={s.linha}>
          {p.fotos?.[0] ? <Image source={{ uri: p.fotos[0] }} style={s.foto} contentFit="cover" /> : (
            <View style={[s.foto, s.fotoVazia]}><Ionicons name="image-outline" size={22} color={O.faint} /></View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.nome} numberOfLines={2}>{p.nome}</Text>
            <Text style={s.meta}>{p.categoria || 'Sem categoria'} · estoque {p.estoque_disponivel}</Text>
            <View style={s.linha}>
              <Text style={s.preco}>{brl(desconto ? p.valor_promocional : p.valor)}</Text>
              {desconto && <Text style={s.precoAntigo}>{brl(p.valor)}</Text>}
            </View>
            <View style={s.linha}>
              <Pilula texto={p.ativo ? 'Ativo' : 'Inativo'} tom={p.ativo ? 'positivo' : 'neutro'} />
              <Pilula texto={p.aceita_pagamento_online === false ? 'Sem pagamento online' : 'Pagamento online'} tom="neutro" />
            </View>
          </View>
        </View>
        <View style={s.acoes}>
          <TouchableOpacity style={s.acao} onPress={() => setVinculando(p)}>
            <Ionicons name="location-outline" size={15} color={O.ink} />
            <Text style={s.acaoTxt}>{p.estabelecimento?.nome || 'Avulso'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acao} onPress={() => abrirEdicao(p)}>
            <Ionicons name="create-outline" size={15} color={O.ink} />
            <Text style={s.acaoTxt}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acao} onPress={() => alternarAtivo(p)}>
            <Ionicons name={p.ativo ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={O.ink} />
            <Text style={s.acaoTxt}>{p.ativo ? 'Desativar' : 'Ativar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acao} onPress={() => excluir(p)}>
            <Ionicons name="trash-outline" size={15} color={O.danger} />
            <Text style={[s.acaoTxt, { color: O.danger }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <OwnerScreen
      titulo="Produtos para entrega"
      subtitulo="Cadastre, vincule e confirme entregas"
      carregando={carregando}
      atualizando={atualizando}
      onAtualizar={() => { atualizar(); if (aba === 'pedidos') carregarPedidos(); }}
      direita={
        <TouchableOpacity onPress={abrirNovo} style={s.botaoNovo}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.botaoNovoTxt}>Novo</Text>
        </TouchableOpacity>
      }
    >
      {erro ? null : (
        <>
          <Card style={{ gap: 8 }}>
            <Text style={s.comoTitulo}>Como funcionam os produtos</Text>
            {COMO_FUNCIONA.map(([titulo, texto]) => (
              <Text key={titulo} style={s.comoTexto}><Text style={{ fontWeight: '800', color: O.ink }}>{titulo}: </Text>{texto}</Text>
            ))}
          </Card>

          <Segmentado
            opcoes={[{ id: 'produtos', rotulo: 'Produtos' }, { id: 'pedidos', rotulo: 'Pedidos' }]}
            valor={aba}
            aoMudar={(id) => { setAba(id as 'produtos' | 'pedidos'); if (id === 'pedidos' && pedidos === null) carregarPedidos(); }}
          />

          {aba === 'produtos' ? (
            produtos.length === 0 ? (
              <Vazio icone="cube-outline" titulo="Nenhum produto ainda" texto="Toque em Novo para cadastrar seu primeiro produto para entrega." />
            ) : (
              <>
                {vinculados.length > 0 && <Rotulo>Vinculados a um local</Rotulo>}
                {vinculados.map(renderLinha)}
                {avulsos.length > 0 && <Rotulo>Avulsos (sem local)</Rotulo>}
                {avulsos.map(renderLinha)}
              </>
            )
          ) : pedidos === null ? (
            <ActivityIndicator color={O.accent} style={{ marginTop: 30 }} />
          ) : pedidos.length === 0 ? (
            <Vazio icone="receipt-outline" titulo="Nenhum pedido recebido" texto="Quando um cliente comprar, o pedido aparece aqui." />
          ) : (
            pedidos.map((pedido) => (
              <PedidoRecebido key={pedido.id} pedido={pedido} onConfirmar={confirmarEntrega} />
            ))
          )}
        </>
      )}

      {/* FORMULÁRIO */}
      <Modal visible={!!formulario} animationType="slide" onRequestClose={() => setFormulario(null)}>
        {formulario && (
          <ScrollView contentContainerStyle={s.formulario}>
            <View style={s.linha}>
              <Text style={s.tituloForm}>{formulario.editando ? 'Editar produto' : 'Novo produto'}</Text>
              <TouchableOpacity onPress={() => setFormulario(null)} hitSlop={10}><Ionicons name="close" size={24} color={O.ink} /></TouchableOpacity>
            </View>

            <Campo rotulo="Nome do produto" valor={formulario.valores.nome} onChange={(t) => setCampo('nome', t)} />
            <Rotulo>Categoria</Rotulo>
            <Chips opcoes={dados?.categorias || []} valor={formulario.valores.categoria} aoMudar={(v) => setCampo('categoria', v)} />

            <View style={s.duas}>
              <View style={{ flex: 1 }}><Campo rotulo="Marca" valor={formulario.valores.marca} onChange={(t) => setCampo('marca', t)} /></View>
              <View style={{ flex: 1 }}><Campo rotulo="Peso ou volume" valor={formulario.valores.peso_volume} onChange={(t) => setCampo('peso_volume', t)} /></View>
            </View>
            <Rotulo>Unidade de medida</Rotulo>
            <Chips opcoes={dados?.unidades || ['un']} valor={formulario.valores.unidade_medida} aoMudar={(v) => setCampo('unidade_medida', v)} />
            <View style={s.duas}>
              <View style={{ flex: 1 }}><Campo rotulo="Código (SKU)" valor={formulario.valores.sku} onChange={(t) => setCampo('sku', t)} /></View>
              <View style={{ flex: 1 }}><Campo rotulo="Mínimo por pedido" teclado="numeric" valor={formulario.valores.quantidade_minima} onChange={(t) => setCampo('quantidade_minima', t)} /></View>
            </View>
            <Campo rotulo="Tags (separe por vírgula)" valor={formulario.valores.tags} onChange={(t) => setCampo('tags', t)} />
            <Campo rotulo="Descrição" valor={formulario.valores.descricao} onChange={(t) => setCampo('descricao', t)} multilinha />

            <View style={s.duas}>
              <View style={{ flex: 1 }}><Campo rotulo="Preço (R$)" teclado="decimal-pad" valor={formulario.valores.valor} onChange={(t) => setCampo('valor', t)} /></View>
              <View style={{ flex: 1 }}><Campo rotulo="Estoque" teclado="numeric" valor={formulario.valores.estoque_disponivel} onChange={(t) => setCampo('estoque_disponivel', t)} /></View>
            </View>
            <Interruptor rotulo="Em promoção" valor={formulario.valores.tem_promocao} onChange={(v) => setCampo('tem_promocao', v)} />
            {formulario.valores.tem_promocao && (
              <Campo rotulo="Preço promocional (R$)" teclado="decimal-pad" valor={formulario.valores.valor_promocional} onChange={(t) => setCampo('valor_promocional', t)} />
            )}
            <Campo rotulo="Taxa de entrega (R$)" teclado="decimal-pad" valor={formulario.valores.taxa_entrega} onChange={(t) => setCampo('taxa_entrega', t)} />
            <Interruptor rotulo="Entrego em casa" valor={formulario.valores.aceita_entrega} onChange={(v) => setCampo('aceita_entrega', v)} />
            <Interruptor rotulo="Aceito retirada no local" valor={formulario.valores.aceita_retirada} onChange={(v) => setCampo('aceita_retirada', v)} />
            <Interruptor rotulo="Produto ativo" valor={formulario.valores.ativo} onChange={(v) => setCampo('ativo', v)} />

            <Rotulo>Local de venda</Rotulo>
            <Chips
              opcoes={['', ...(dados?.estabelecimentos || []).map((e) => String(e.id))]}
              rotuloDe={(v) => (v ? dados?.estabelecimentos.find((e) => String(e.id) === v)?.nome || v : 'Avulso (sem local)')}
              valor={formulario.valores.estabelecimento_id}
              aoMudar={(v) => setCampo('estabelecimento_id', v)}
            />

            <Rotulo>Endereço de origem (de onde o produto sai)</Rotulo>
            <View style={s.duas}>
              <View style={{ flex: 1 }}><Campo rotulo="CEP" teclado="numeric" valor={formulario.valores.endereco_cep} onChange={(t) => setCampo('endereco_cep', t)} /></View>
              <View style={{ flex: 2 }}><Campo rotulo="Rua" valor={formulario.valores.endereco_rua} onChange={(t) => setCampo('endereco_rua', t)} /></View>
            </View>
            <View style={s.duas}>
              <View style={{ flex: 1 }}><Campo rotulo="Número" valor={formulario.valores.endereco_numero} onChange={(t) => setCampo('endereco_numero', t)} /></View>
              <View style={{ flex: 2 }}><Campo rotulo="Complemento" valor={formulario.valores.endereco_complemento} onChange={(t) => setCampo('endereco_complemento', t)} /></View>
            </View>
            <View style={s.duas}>
              <View style={{ flex: 2 }}><Campo rotulo="Bairro" valor={formulario.valores.endereco_bairro} onChange={(t) => setCampo('endereco_bairro', t)} /></View>
              <View style={{ flex: 1 }}><Campo rotulo="UF" valor={formulario.valores.endereco_estado} onChange={(t) => setCampo('endereco_estado', t.toUpperCase().slice(0, 2))} /></View>
            </View>
            <Campo rotulo="Cidade" valor={formulario.valores.endereco_cidade} onChange={(t) => setCampo('endereco_cidade', t)} />

            <Rotulo>Fotos (até 3)</Rotulo>
            <View style={s.linha}>
              {formulario.fotos.map((uri) => <Image key={uri} source={{ uri }} style={s.fotoForm} contentFit="cover" />)}
              {formulario.fotos.length < 3 && (
                <TouchableOpacity onPress={adicionarFotos} style={[s.fotoForm, s.fotoVazia]}><Ionicons name="add" size={22} color={O.muted} /></TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={salvar} disabled={salvando} style={[s.botaoSalvar, salvando && { opacity: 0.6 }]}>
              <Text style={s.botaoSalvarTxt}>{salvando ? 'Salvando...' : 'Salvar produto'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Modal>

      {/* VINCULAR A UM LOCAL */}
      <Modal visible={!!vinculando} transparent animationType="fade" onRequestClose={() => setVinculando(null)}>
        <View style={s.fundo}>
          <View style={s.caixa}>
            <Text style={s.tituloForm}>Onde vender "{vinculando?.nome}"?</Text>
            <Text style={s.comoTexto}>Vinculado ao local, o produto aparece na loja daquele local. Avulso, ele aparece só em Produtos.</Text>
            <TouchableOpacity onPress={() => vinculando && vincular(vinculando, null)} style={s.opcaoLocal}>
              <Ionicons name="pricetag-outline" size={18} color={O.ink} /><Text style={s.opcaoLocalTxt}>Avulso (sem local)</Text>
            </TouchableOpacity>
            {(dados?.estabelecimentos || []).map((e) => (
              <TouchableOpacity key={e.id} onPress={() => vinculando && vincular(vinculando, e.id)} style={s.opcaoLocal}>
                <Ionicons name="storefront-outline" size={18} color={O.ink} /><Text style={s.opcaoLocalTxt}>{e.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {aviso}
    </OwnerScreen>
  );
}

/** Equipe envia a localização do aparelho ao pedido em rota, para o cliente acompanhar. */
function EnviarPosicaoMobile({ pedidoId }: { pedidoId: number }) {
  const [estado, setEstado] = useState<string | null>(null);

  const enviar = async () => {
    setEstado('Obtendo localização...');
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (!permissao.granted) {
      setEstado('Permita o acesso à localização para enviar a posição.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api(`/entregas/pedidos/${pedidoId}/posicao`, { method: 'POST', body: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      setEstado('Posição enviada. O cliente já pode acompanhar.');
    } catch (e: any) {
      setEstado(e?.message || 'Não foi possível enviar a posição.');
    }
  };

  return (
    <View style={{ gap: 4 }}>
      <TouchableOpacity onPress={enviar} style={s.botaoConfirmar}>
        <Text style={s.botaoConfirmarTxt}>Enviar minha posição</Text>
      </TouchableOpacity>
      {estado && <Text style={s.meta}>{estado}</Text>}
    </View>
  );
}

function PedidoRecebido({ pedido, onConfirmar }: { pedido: any; onConfirmar: (p: any, codigo: string) => void }) {
  const [codigo, setCodigo] = useState('');
  const status = STATUS_PEDIDO[pedido.status] || { label: pedido.status, cor: O.muted, fundo: O.soft };
  const podeConfirmar = ['pago', 'aguardando_confirmacao'].includes(pedido.status);
  return (
    <Card style={{ gap: 8 }}>
      <View style={s.linha}>
        <Text style={s.nome} numberOfLines={1}>{pedido.produto?.nome || 'Produto removido'}</Text>
        <View style={[s.badge, { backgroundColor: status.fundo }]}><Text style={[s.badgeTxt, { color: status.cor }]}>{status.label}</Text></View>
      </View>
      <Text style={s.meta}>{pedido.codigo_pedido} · {pedido.quantidade}x · {brl(pedido.valor_total)} · {dataCurta(pedido.created_at)}</Text>
      <Text style={s.meta}>Cliente: {pedido.cliente?.name} {pedido.cliente?.mobile_phone ? `· ${pedido.cliente.mobile_phone}` : ''}</Text>
      <Text style={s.meta}>{pedido.modo_recebimento === 'entrega' ? 'Entrega' : 'Retirada'} · {pedido.modo_pagamento === 'online' ? 'Pago online (protegido)' : pedido.modo_pagamento === 'local' ? 'Pagamento no local' : 'Pagamento direto com você'}</Text>
      {podeConfirmar && <EnviarPosicaoMobile pedidoId={pedido.id} />}
      {podeConfirmar && (
        <View style={s.linha}>
          <TextInput
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="Código de 6 dígitos"
            placeholderTextColor={O.faint}
            style={s.campoCodigo}
          />
          <TouchableOpacity disabled={codigo.length !== 6} onPress={() => onConfirmar(pedido, codigo)} style={[s.botaoConfirmar, codigo.length !== 6 && { opacity: 0.4 }]}>
            <Text style={s.botaoConfirmarTxt}>Confirmar entrega</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

function Campo({ rotulo, valor, onChange, teclado, multilinha }: { rotulo: string; valor: string; onChange: (t: string) => void; teclado?: any; multilinha?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.rotuloCampo}>{rotulo}</Text>
      <TextInput value={valor} onChangeText={onChange} keyboardType={teclado || 'default'} multiline={multilinha} style={[s.campo, multilinha && { minHeight: 70, textAlignVertical: 'top' }]} placeholderTextColor={O.faint} />
    </View>
  );
}

function Chips({ opcoes, valor, aoMudar, rotuloDe }: { opcoes: string[]; valor: string; aoMudar: (v: string) => void; rotuloDe?: (v: string) => string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {opcoes.map((o) => (
        <TouchableOpacity key={o || 'vazio'} onPress={() => aoMudar(o)} style={[s.chip, valor === o && s.chipAtivo]}>
          <Text style={[s.chipTxt, valor === o && s.chipTxtAtivo]}>{rotuloDe ? rotuloDe(o) : o || 'Nenhum'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Interruptor({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[s.linha, { justifyContent: 'space-between' }]}>
      <Text style={s.rotuloCampo}>{rotulo}</Text>
      <Switch value={valor} onValueChange={onChange} trackColor={{ true: O.accent }} />
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  foto: { width: 64, height: 64, borderRadius: 12, backgroundColor: O.soft },
  fotoForm: { width: 84, height: 84, borderRadius: 12, backgroundColor: O.soft },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  nome: { flex: 1, fontSize: 15, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted },
  preco: { fontSize: 15, fontWeight: '900', color: O.ink },
  precoAntigo: { fontSize: 11, color: O.faint, textDecorationLine: 'line-through' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: O.line, paddingTop: 10 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: O.line, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  acaoTxt: { fontSize: 12, fontWeight: '700', color: O.ink },
  botaoNovo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: O.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  botaoNovoTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  comoTitulo: { fontSize: 14, fontWeight: '900', color: O.ink },
  comoTexto: { fontSize: 12, color: O.muted, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  campoCodigo: { flex: 1, minWidth: 140, borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, letterSpacing: 4, color: O.ink },
  botaoConfirmar: { backgroundColor: O.success, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  botaoConfirmarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  formulario: { padding: 20, paddingTop: 56, gap: 12, backgroundColor: O.canvas, minHeight: '100%' },
  tituloForm: { fontSize: 18, fontWeight: '900', color: O.ink, flex: 1 },
  duas: { flexDirection: 'row', gap: 10 },
  rotuloCampo: { fontSize: 12, fontWeight: '700', color: O.muted },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: O.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: O.line, backgroundColor: '#fff' },
  chipAtivo: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: O.muted },
  chipTxtAtivo: { color: '#fff' },
  botaoSalvar: { backgroundColor: O.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  botaoSalvarTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 10 },
  opcaoLocal: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: O.line, borderRadius: 12, padding: 12 },
  opcaoLocalTxt: { fontSize: 14, fontWeight: '700', color: O.ink },
});
