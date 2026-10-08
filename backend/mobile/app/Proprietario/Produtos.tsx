import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { OwnerScreen, Card, Rotulo, Vazio, Erro, Segmentado, api, BASE, tokenDoUsuario, brl } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { useAviso } from '../../components/owner/Aviso';
import { O } from '../../constants/OwnerTheme';
import { alertar } from '../../services/alertar';

type Produto = {
  id: number; nome: string; descricao?: string | null; categoria?: string | null;
  valor_normal: string | number; valor_promocional?: string | number | null; valor_final?: string | number | null;
  is_promocao?: boolean | number; estoque_disponivel: number; somente_premium?: boolean | number;
  estabelecimento_id: number; servico_id?: number | null; aluguel_id?: number | null;
  servico_nome?: string | null; reserva_nome?: string | null; fotos?: string[] | string | null;
};
type Dados = {
  produtos: Produto[];
  estabelecimentos: { id: number; nome: string }[];
  servicos: { id: number; nome: string; estabelecimento_id: number }[];
  reservas: { id: number; nome: string }[];
};

const TIPOS = [
  { id: 'vinculados', rotulo: 'Com serviço ou reserva' },
  { id: 'entrega', rotulo: 'Entrega e retirada' },
];

const VINCULOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'servico', rotulo: 'Com serviço' },
  { id: 'reserva', rotulo: 'Com reserva' },
  { id: 'avulso', rotulo: 'Avulsos' },
];

const FORM_VAZIO = {
  id: null as number | null, nome: '', descricao: '', categoria: '', valor_normal: '', valor_promocional: '', is_promocao: false,
  estoque_disponivel: '', estabelecimento_id: null as number | null, servico_id: null as number | null, aluguel_id: null as number | null,
  somente_premium: false, fotos: [] as string[],
};

const primeiraFoto = (fotos: Produto['fotos']) => {
  let lista: any = fotos;
  if (typeof lista === 'string') { try { lista = JSON.parse(lista); } catch { lista = [lista]; } }
  const f = Array.isArray(lista) && lista[0] ? String(lista[0]) : null;
  return f && !f.startsWith('http') ? null : f;
};
const numero = (v: string) => v.replace(',', '.').replace(/[^0-9.]/g, '');

export default function Produtos() {
  const router = useRouter();
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();
  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<Dados>(() => api('/meus-produtos'));
  const [tipo, setTipo] = useState('vinculados');
  const [explicacao, setExplicacao] = useState(true);
  const [vinculo, setVinculo] = useState('todos');
  const [alvo, setAlvo] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<typeof FORM_VAZIO | null>(null);
  const [salvando, setSalvando] = useState(false);

  const produtos = dados?.produtos || [];
  const contagem: Record<string, number> = {
    todos: produtos.length,
    servico: produtos.filter((p) => p.servico_id).length,
    reserva: produtos.filter((p) => p.aluguel_id).length,
    avulso: produtos.filter((p) => !p.servico_id && !p.aluguel_id).length,
  };

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (vinculo === 'servico' && !p.servico_id) return false;
      if (vinculo === 'reserva' && !p.aluguel_id) return false;
      if (vinculo === 'avulso' && (p.servico_id || p.aluguel_id)) return false;
      if (alvo.startsWith('s:') && String(p.servico_id) !== alvo.slice(2)) return false;
      if (alvo.startsWith('r:') && String(p.aluguel_id) !== alvo.slice(2)) return false;
      if (termo && !`${p.nome} ${p.categoria || ''} ${p.servico_nome || ''} ${p.reserva_nome || ''}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [produtos, vinculo, alvo, busca]);

  const abrirNovo = () => setForm({ ...FORM_VAZIO, estabelecimento_id: dados?.estabelecimentos[0]?.id ?? null });
  const abrirEdicao = (p: Produto) => setForm({
    id: p.id, nome: p.nome, descricao: p.descricao || '', categoria: p.categoria || '',
    valor_normal: String(p.valor_normal ?? ''), valor_promocional: p.valor_promocional ? String(p.valor_promocional) : '',
    is_promocao: !!Number(p.is_promocao), estoque_disponivel: String(p.estoque_disponivel ?? ''),
    estabelecimento_id: p.estabelecimento_id, servico_id: p.servico_id ?? null, aluguel_id: p.aluguel_id ?? null,
    somente_premium: !!Number(p.somente_premium), fotos: [],
  });

  const escolherFotos = async () => {
    if (!form) return;
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 - form.fotos.length, quality: 0.8 });
    if (!r.canceled) setForm({ ...form, fotos: [...form.fotos, ...r.assets.map((a) => a.uri)].slice(0, 5) });
  };

  const salvar = async () => {
    if (!form) return;
    if (!form.nome.trim() || !form.estabelecimento_id || !form.valor_normal) {
      mostrarErro({ message: 'Preencha nome, local e preço.' });
      return;
    }
    setSalvando(true);
    try {
      const corpo = new FormData();
      const campos: Record<string, string> = {
        nome: form.nome.trim(), descricao: form.descricao, categoria: form.categoria,
        valor_normal: numero(form.valor_normal), valor_promocional: numero(form.valor_promocional),
        is_promocao: form.is_promocao ? '1' : '0', estoque_disponivel: form.estoque_disponivel || '0',
        estabelecimento_id: String(form.estabelecimento_id), somente_premium: form.somente_premium ? '1' : '0',
        servico_id: form.servico_id ? String(form.servico_id) : '', aluguel_id: form.aluguel_id ? String(form.aluguel_id) : '',
      };
      Object.entries(campos).forEach(([k, v]) => corpo.append(k, v));
      // Fotos só no cadastro (a edição do servidor altera os dados, não as fotos).
      if (!form.id) form.fotos.forEach((uri, i) => corpo.append('fotos[]', { uri, name: `foto${i}.jpg`, type: 'image/jpeg' } as any));

      const token = await tokenDoUsuario();
      const res = await fetch(`${BASE}/produtos${form.id ? `/${form.id}` : ''}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: corpo,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Não foi possível salvar o produto.');

      mostrarSucesso(form.id ? 'Produto atualizado' : 'Produto cadastrado');
      setForm(null);
      recarregar();
    } catch (e) {
      mostrarErro(e);
    } finally {
      setSalvando(false);
    }
  };

  const apagar = (p: Produto) => {
    alertar('Apagar produto?', `"${p.nome}" será removido.`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          try {
            await api(`/produtos/${p.id}`, { method: 'DELETE' });
            mostrarSucesso('Produto apagado');
            recarregar();
          } catch (e) {
            mostrarErro(e);
          }
        },
      },
    ]);
  };

  const servicosDoLocal = (dados?.servicos || []).filter((sv) => !form?.estabelecimento_id || sv.estabelecimento_id === form.estabelecimento_id);

  const adicionar = tipo === 'vinculados' ? (
    <TouchableOpacity onPress={abrirNovo} style={s.botaoNovo} accessibilityLabel="Novo produto"><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity>
  ) : undefined;

  return (
    <OwnerScreen titulo="Produtos" subtitulo="Todos os seus produtos num lugar só" direita={adicionar} carregando={carregando} atualizando={atualizando} onAtualizar={atualizar}>
      {aviso}
      {erro ? <Erro mensagem={erro} aoTentar={recarregar} /> : (
        <>
          {/* EXPLICAÇÃO */}
          <Card>
            <TouchableOpacity onPress={() => setExplicacao((v) => !v)} style={s.linhaEntre}>
              <Text style={s.forte}>Qual a diferença entre os tipos?</Text>
              <Ionicons name={explicacao ? 'chevron-up' : 'chevron-down'} size={18} color={O.muted} />
            </TouchableOpacity>
            {explicacao && (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={s.tipo}>
                  <Ionicons name="link-outline" size={20} color={O.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.forte}>Com serviço ou reserva</Text>
                    <Text style={s.meta}>Item extra que o cliente vê ao agendar ou reservar (pomada depois do corte, kit com a quadra). Sem vínculo, vira venda avulsa na vitrine. É pago junto com o agendamento ou a reserva.</Text>
                  </View>
                </View>
                <View style={s.tipo}>
                  <Ionicons name="bicycle-outline" size={20} color={O.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.forte}>Entrega e retirada</Text>
                    <Text style={s.meta}>Produto vendido sozinho, entregue em casa ou buscado no seu endereço (gás, água, mercado). O cliente paga online, no local ou direto com você; os pedidos vão para “Entregas”.</Text>
                  </View>
                </View>
              </View>
            )}
          </Card>

          <Segmentado opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />

          {tipo === 'entrega' ? (
            <Card>
              <Text style={s.forte}>Produtos para entrega ou retirada</Text>
              <Text style={[s.meta, { marginTop: 4 }]}>Cadastre, defina preço, estoque, taxa de entrega e endereço de origem, e acompanhe os pedidos recebidos.</Text>
              <TouchableOpacity onPress={() => router.push('/Proprietario/ProdutosEntrega' as never)} style={[s.botao, { marginTop: 14 }]}>
                <Ionicons name="bicycle-outline" size={18} color="#fff" />
                <Text style={s.botaoTxt}>Abrir produtos para entrega</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/Proprietario/EntregasGestao' as never)} style={[s.botao, s.botaoClaro, { marginTop: 8 }]}>
                <Ionicons name="list-outline" size={18} color={O.ink} />
                <Text style={[s.botaoTxt, { color: O.ink }]}>Ver pedidos e entregas</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <>
              {/* FILTROS */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                {VINCULOS.map((v) => (
                  <TouchableOpacity key={v.id} onPress={() => { setVinculo(v.id); setAlvo(''); }} style={[s.chip, vinculo === v.id && s.chipAtivo]}>
                    <Text style={[s.chipTxt, vinculo === v.id && s.chipTxtAtivo]}>{v.rotulo} ({contagem[v.id]})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {(vinculo === 'servico' || vinculo === 'reserva') && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                  <TouchableOpacity onPress={() => setAlvo('')} style={[s.chipP, !alvo && s.chipAtivo]}>
                    <Text style={[s.chipTxt, !alvo && s.chipTxtAtivo]}>Qualquer {vinculo === 'servico' ? 'serviço' : 'reserva'}</Text>
                  </TouchableOpacity>
                  {(vinculo === 'servico' ? (dados?.servicos || []).map((x) => ({ id: `s:${x.id}`, nome: x.nome })) : (dados?.reservas || []).map((x) => ({ id: `r:${x.id}`, nome: x.nome }))).map((x) => (
                    <TouchableOpacity key={x.id} onPress={() => setAlvo(x.id)} style={[s.chipP, alvo === x.id && s.chipAtivo]}>
                      <Text style={[s.chipTxt, alvo === x.id && s.chipTxtAtivo]}>{x.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={s.busca}>
                <Ionicons name="search" size={16} color={O.faint} />
                <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar produto, serviço ou reserva" placeholderTextColor={O.faint} style={s.buscaInput} />
              </View>

              {lista.length === 0 ? (
                <Card><Vazio icone="bag-handle-outline" titulo="Nenhum produto aqui" texto="Toque em + para cadastrar um produto e vincular a um serviço ou reserva." /></Card>
              ) : lista.map((p) => {
                const foto = primeiraFoto(p.fotos);
                const promo = !!Number(p.is_promocao);
                return (
                  <Card key={p.id}>
                    <View style={s.produto}>
                      {foto ? <Image source={{ uri: foto }} style={s.foto} contentFit="cover" /> : <View style={[s.foto, s.fotoVazia]}><Ionicons name="image-outline" size={22} color={O.faint} /></View>}
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={s.forte} numberOfLines={2}>{p.nome}</Text>
                        {!!p.categoria && <Text style={s.meta}>{p.categoria}</Text>}
                        <Text style={s.preco}>{brl(promo ? (p.valor_promocional ?? p.valor_final) : (p.valor_final ?? p.valor_normal))}{promo ? '  · promoção' : ''}</Text>
                        <Text style={[s.meta, p.estoque_disponivel <= 0 && { color: O.danger }]}>{p.estoque_disponivel <= 0 ? 'Esgotado' : `Estoque: ${p.estoque_disponivel}`}</Text>
                      </View>
                    </View>
                    <View style={s.vinculos}>
                      {!!p.servico_nome && <View style={[s.selo, { backgroundColor: O.infoBg }]}><Text style={[s.seloTxt, { color: O.info }]}>Serviço: {p.servico_nome}</Text></View>}
                      {!!p.reserva_nome && <View style={[s.selo, { backgroundColor: O.successBg }]}><Text style={[s.seloTxt, { color: O.success }]}>Reserva: {p.reserva_nome}</Text></View>}
                      {!p.servico_id && !p.aluguel_id && <View style={[s.selo, { backgroundColor: O.soft }]}><Text style={s.seloTxt}>Venda avulsa</Text></View>}
                      {!!Number(p.somente_premium) && <View style={[s.selo, { backgroundColor: O.warningBg }]}><Text style={[s.seloTxt, { color: O.warning }]}>Só premium</Text></View>}
                    </View>
                    <View style={s.acoes}>
                      <TouchableOpacity onPress={() => abrirEdicao(p)} style={s.acao}><Ionicons name="create-outline" size={15} color={O.ink} /><Text style={s.acaoTxt}>Editar</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => apagar(p)} style={s.acao}><Ionicons name="trash-outline" size={15} color={O.danger} /><Text style={[s.acaoTxt, { color: O.danger }]}>Apagar</Text></TouchableOpacity>
                    </View>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {/* FORMULÁRIO */}
      <Modal visible={!!form} animationType="slide" onRequestClose={() => setForm(null)}>
        {form && (
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: O.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.modalTopo}>
              <TouchableOpacity onPress={() => setForm(null)} hitSlop={8}><Ionicons name="close" size={24} color={O.ink} /></TouchableOpacity>
              <Text style={s.modalTitulo}>{form.id ? 'Editar produto' : 'Novo produto'}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Rotulo>Local</Rotulo>
              <View style={s.chipsWrap}>
                {(dados?.estabelecimentos || []).map((e) => (
                  <TouchableOpacity key={e.id} onPress={() => setForm({ ...form, estabelecimento_id: e.id, servico_id: null })} style={[s.chip, form.estabelecimento_id === e.id && s.chipAtivo]}>
                    <Text style={[s.chipTxt, form.estabelecimento_id === e.id && s.chipTxtAtivo]}>{e.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Campo rotulo="Nome do produto" valor={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
              <Campo rotulo="Categoria" valor={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} />
              <Campo rotulo="Descrição" valor={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} multiline />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Campo rotulo="Preço (R$)" valor={form.valor_normal} onChange={(v) => setForm({ ...form, valor_normal: v })} teclado="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Campo rotulo="Estoque" valor={form.estoque_disponivel} onChange={(v) => setForm({ ...form, estoque_disponivel: v.replace(/\D/g, '') })} teclado="number-pad" /></View>
              </View>
              <View style={s.switch}><Text style={s.forte}>Em promoção</Text><Switch value={form.is_promocao} onValueChange={(v) => setForm({ ...form, is_promocao: v })} trackColor={{ false: O.line, true: O.accent }} /></View>
              {form.is_promocao && <Campo rotulo="Preço promocional (R$)" valor={form.valor_promocional} onChange={(v) => setForm({ ...form, valor_promocional: v })} teclado="decimal-pad" />}
              <View style={s.switch}><Text style={s.forte}>Só para clientes premium</Text><Switch value={form.somente_premium} onValueChange={(v) => setForm({ ...form, somente_premium: v })} trackColor={{ false: O.line, true: O.accent }} /></View>

              <Rotulo>Vincular a um serviço</Rotulo>
              <View style={s.chipsWrap}>
                <TouchableOpacity onPress={() => setForm({ ...form, servico_id: null })} style={[s.chipP, !form.servico_id && s.chipAtivo]}><Text style={[s.chipTxt, !form.servico_id && s.chipTxtAtivo]}>Nenhum</Text></TouchableOpacity>
                {servicosDoLocal.map((sv) => (
                  <TouchableOpacity key={sv.id} onPress={() => setForm({ ...form, servico_id: sv.id })} style={[s.chipP, form.servico_id === sv.id && s.chipAtivo]}><Text style={[s.chipTxt, form.servico_id === sv.id && s.chipTxtAtivo]}>{sv.nome}</Text></TouchableOpacity>
                ))}
              </View>
              <Rotulo>Vincular a uma reserva</Rotulo>
              <View style={s.chipsWrap}>
                <TouchableOpacity onPress={() => setForm({ ...form, aluguel_id: null })} style={[s.chipP, !form.aluguel_id && s.chipAtivo]}><Text style={[s.chipTxt, !form.aluguel_id && s.chipTxtAtivo]}>Nenhuma</Text></TouchableOpacity>
                {(dados?.reservas || []).map((r) => (
                  <TouchableOpacity key={r.id} onPress={() => setForm({ ...form, aluguel_id: r.id })} style={[s.chipP, form.aluguel_id === r.id && s.chipAtivo]}><Text style={[s.chipTxt, form.aluguel_id === r.id && s.chipTxtAtivo]}>{r.nome}</Text></TouchableOpacity>
                ))}
              </View>
              <Text style={s.meta}>Vinculado, o produto aparece como adicional na hora de agendar ou reservar. Sem vínculo, é uma venda avulsa.</Text>

              {!form.id && (
                <>
                  <Rotulo>Fotos (até 5)</Rotulo>
                  <View style={s.chipsWrap}>
                    {form.fotos.map((uri) => (
                      <TouchableOpacity key={uri} onPress={() => setForm({ ...form, fotos: form.fotos.filter((f) => f !== uri) })}>
                        <Image source={{ uri }} style={s.miniatura} contentFit="cover" />
                      </TouchableOpacity>
                    ))}
                    {form.fotos.length < 5 && (
                      <TouchableOpacity onPress={escolherFotos} style={[s.miniatura, s.fotoVazia]}><Ionicons name="add" size={24} color={O.muted} /></TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              <TouchableOpacity disabled={salvando} onPress={salvar} style={[s.botao, { height: 52, marginTop: 6 }, salvando && { opacity: 0.5 }]}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>{form.id ? 'Salvar alterações' : 'Cadastrar produto'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </OwnerScreen>
  );
}

function Campo({ rotulo, valor, onChange, multiline, teclado }: { rotulo: string; valor: string; onChange: (v: string) => void; multiline?: boolean; teclado?: 'decimal-pad' | 'number-pad' }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.rotuloCampo}>{rotulo}</Text>
      <TextInput value={valor} onChangeText={onChange} multiline={multiline} keyboardType={teclado} style={[s.campo, multiline && { minHeight: 80, textAlignVertical: 'top' }]} placeholderTextColor={O.faint} />
    </View>
  );
}

const s = StyleSheet.create({
  botaoNovo: { width: 44, height: 44, borderRadius: 22, backgroundColor: O.accent, alignItems: 'center', justifyContent: 'center' },
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forte: { fontSize: 14, fontWeight: '800', color: O.ink },
  meta: { fontSize: 12, color: O.muted, lineHeight: 17 },
  tipo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  chips: { gap: 8, paddingBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: O.card, borderWidth: 1, borderColor: O.line },
  chipP: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: O.soft },
  chipAtivo: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 12, fontWeight: '700', color: O.muted },
  chipTxtAtivo: { color: '#fff' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: O.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: O.line, marginBottom: 14 },
  buscaInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: O.ink },
  produto: { flexDirection: 'row', gap: 12 },
  foto: { width: 72, height: 72, borderRadius: 14, backgroundColor: O.soft },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  preco: { fontSize: 15, fontWeight: '900', color: O.ink },
  vinculos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  selo: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  seloTxt: { fontSize: 11, fontWeight: '700', color: O.ink },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: O.line, paddingTop: 10 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: O.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  acaoTxt: { fontSize: 12, fontWeight: '700', color: O.ink },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: O.ink, borderRadius: 14, height: 48 },
  botaoClaro: { backgroundColor: O.soft },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, backgroundColor: O.card, borderBottomWidth: 1, borderBottomColor: O.line },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: O.ink },
  rotuloCampo: { fontSize: 13, fontWeight: '700', color: O.ink },
  campo: { backgroundColor: O.card, borderWidth: 1, borderColor: O.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: O.ink },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: O.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: O.line },
  miniatura: { width: 64, height: 64, borderRadius: 12, backgroundColor: O.soft },
});
