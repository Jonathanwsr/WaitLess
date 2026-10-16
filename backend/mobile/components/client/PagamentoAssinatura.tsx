import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, Image, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { API_MOBILE, pegarToken } from '../../services/entregasApi';

type Forma = { tipo: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED'; rotulo: string; cartao: { bandeira: string | null; final: string | null; validade: string | null } | null };
type Fatura = { id: string; data_formatada: string | null; valor: number; status: string; tom: 'pago' | 'pendente' | 'vencida' | 'estornada'; forma: string | null; em_aberto: boolean; pdf: string | null };
type Painel = { tem_assinatura: boolean; forma: Forma | null; faturas: Fatura[]; erro: string | null; mensagem?: string };
type Pagar = { pix: { imagem: string; copia_e_cola: string } | null; boleto: { linha_digitavel: string | null; pdf: string | null } | null; fatura: string | null; erro?: string };

const so = (v: string) => v.replace(/\D/g, '');
const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const TOM: Record<string, { bg: string; cor: string }> = {
  pago: { bg: '#ECFDF5', cor: '#047857' }, pendente: { bg: '#FFFBEB', cor: '#B45309' }, vencida: { bg: '#FEF2F2', cor: '#B91C1C' }, estornada: { bg: '#F3F4F6', cor: '#4B5563' },
};

async function api<T>(caminho: string, metodo: 'GET' | 'POST' = 'GET', corpo?: unknown): Promise<T> {
  const token = await pegarToken();
  const r = await fetch(`${API_MOBILE}/assinatura/pagamento${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json?.errors && (Object.values(json.errors)[0] as string[])?.[0]) || json?.message || 'Não foi possível concluir agora.');
  return json as T;
}

function IconeForma({ forma }: { forma: Forma | null }) {
  if (forma?.tipo === 'PIX') return <View style={[s.icone, { backgroundColor: '#14B8A6' }]}><Ionicons name="qr-code" size={20} color="#fff" /></View>;
  if (forma?.tipo === 'BOLETO') return <View style={[s.icone, { backgroundColor: '#1F2937' }]}><Ionicons name="barcode-outline" size={22} color="#fff" /></View>;
  if (forma?.cartao?.bandeira === 'Mastercard') {
    return <View style={[s.icone, { flexDirection: 'row' }]}><View style={[s.circulo, { backgroundColor: '#EB001B' }]} /><View style={[s.circulo, { backgroundColor: '#F79E1B', marginLeft: -6, opacity: 0.9 }]} /></View>;
  }
  return <View style={s.icone}><Text style={s.iconeTxt}>{(forma?.cartao?.bandeira || 'Card').slice(0, 4).toUpperCase()}</Text></View>;
}

/** "Pagamento" da assinatura no app: forma padrão, adicionar/atualizar e faturas reais do Asaas. */
export default function PagamentoAssinatura({ cpfInicial = '' }: { cpfInicial?: string }) {
  const [dados, setDados] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [janela, setJanela] = useState<'metodo' | 'cartao' | Fatura | null>(null);
  const [aba, setAba] = useState<'cartao' | 'pix' | 'boleto'>('cartao');
  const [pagar, setPagar] = useState<Pagar | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [c, setC] = useState({ numero: '', titular: '', validade: '', cvv: '', cpf: cpfInicial, cep: '', numeroEnd: '', telefone: '' });
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    api<Painel>('').then((d) => { setDados(d); setErro(d.erro); }).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const aplicar = (d: Painel) => { setDados((x) => ({ ...(x as Painel), ...d })); setAviso(d.mensagem || null); setJanela(null); };

  const salvarCartao = async () => {
    const [mes, ano] = c.validade.split('/');
    setEnviando(true);
    try {
      aplicar(await api<Painel>('/cartao', 'POST', {
        cartao: { numero: so(c.numero), titular: c.titular.trim(), mes: Number(mes), ano: Number(ano), cvv: so(c.cvv) },
        titular: { cpf_cnpj: so(c.cpf), cep: so(c.cep), numero: c.numeroEnd, telefone: so(c.telefone) },
      }));
      setC((x) => ({ ...x, numero: '', cvv: '', validade: '' }));
    } catch (e: any) {
      setAviso(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const usarForma = async (forma: 'pix' | 'boleto') => {
    setEnviando(true);
    try { aplicar(await api<Painel>('/forma', 'POST', { forma })); } catch (e: any) { setAviso(e.message); } finally { setEnviando(false); }
  };

  const abrirPagar = async (f: Fatura) => {
    setJanela(f);
    setPagar(null);
    try { setPagar(await api<Pagar>(`/faturas/${f.id}`)); } catch (e: any) { setPagar({ pix: null, boleto: null, fatura: null, erro: e.message }); }
  };

  const copiar = async (texto: string) => { await Clipboard.setStringAsync(texto); setCopiado(texto); setTimeout(() => setCopiado(null), 2000); };

  if (dados && !dados.tem_assinatura) return null;
  const forma = dados?.forma ?? null;
  const faturaAberta = janela && typeof janela === 'object' ? janela : null;

  const formCartao = (
    <View style={{ gap: 10 }}>
      <Campo rotulo="Número do cartão" valor={c.numero} teclado="number-pad" onChange={(v) => setC({ ...c, numero: so(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ') })} />
      <Campo rotulo="Nome impresso no cartão" valor={c.titular} onChange={(v) => setC({ ...c, titular: v.toUpperCase() })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Campo rotulo="Validade (MM/AA)" valor={c.validade} teclado="number-pad" onChange={(v) => { const d = so(v).slice(0, 4); setC({ ...c, validade: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} /></View>
        <View style={{ flex: 1 }}><Campo rotulo="CVV" valor={c.cvv} teclado="number-pad" seguro onChange={(v) => setC({ ...c, cvv: so(v).slice(0, 4) })} /></View>
      </View>
      <Text style={s.secaoMini}>DADOS DO TITULAR (EXIGIDOS PELO BANCO)</Text>
      <Campo rotulo="CPF ou CNPJ" valor={c.cpf} teclado="number-pad" onChange={(v) => setC({ ...c, cpf: so(v).slice(0, 14) })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Campo rotulo="CEP" valor={c.cep} teclado="number-pad" onChange={(v) => setC({ ...c, cep: so(v).slice(0, 8) })} /></View>
        <View style={{ flex: 1 }}><Campo rotulo="Nº do endereço" valor={c.numeroEnd} onChange={(v) => setC({ ...c, numeroEnd: v.slice(0, 10) })} /></View>
      </View>
      <TouchableOpacity style={[s.botaoEscuro, enviando && { opacity: 0.6 }]} onPress={salvarCartao} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="lock-closed" size={16} color="#fff" /><Text style={s.botaoEscuroTxt}>Salvar cartão</Text></>}
      </TouchableOpacity>
      <Text style={s.nota}>O cartão fica guardado com segurança no Asaas. Nenhuma cobrança é feita agora.</Text>
    </View>
  );

  return (
    <View style={s.card}>
      <Text style={s.titulo}>Pagamento</Text>
      <Text style={s.sub}>Sua forma de pagamento padrão é cobrada nas renovações da assinatura.</Text>
      <TouchableOpacity style={s.botaoClaro} onPress={() => { setAba('cartao'); setJanela('metodo'); }}>
        <Text style={s.botaoClaroTxt}>Adicionar método de pagamento</Text>
      </TouchableOpacity>
      {!!aviso && <Text style={s.aviso}>{aviso}</Text>}

      {!dados ? <ActivityIndicator style={{ marginVertical: 16 }} /> : (
        <View style={s.forma}>
          <IconeForma forma={forma} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={s.formaNome}>{forma?.tipo === 'CREDIT_CARD' ? `${forma.cartao?.bandeira || 'Cartão'}${forma.cartao?.final ? ` •••• ${forma.cartao.final}` : ''}` : forma?.rotulo || 'A definir'}</Text>
              <Text style={s.padrao}>Padrão</Text>
            </View>
            <Text style={s.formaSub}>
              {forma?.tipo === 'CREDIT_CARD' ? (forma.cartao?.validade ? `Expira em ${forma.cartao.validade}` : 'Cobrado a cada renovação') : forma?.tipo === 'PIX' ? 'QR Code em cada fatura' : forma?.tipo === 'BOLETO' ? 'Boleto em cada fatura' : 'Escolha como prefere pagar'}
            </Text>
          </View>
          <TouchableOpacity style={s.botaoClaroPeq} onPress={() => { if (forma?.tipo === 'CREDIT_CARD') setJanela('cartao'); else { setAba(forma?.tipo === 'BOLETO' ? 'boleto' : 'pix'); setJanela('metodo'); } }}>
            <Text style={s.botaoClaroTxt}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[s.titulo, { marginTop: 22 }]}>Faturas</Text>
      {!!erro && <TouchableOpacity onPress={carregar}><Text style={s.erro}>{erro} Toque para tentar de novo.</Text></TouchableOpacity>}
      {dados && !erro && dados.faturas.length === 0 && <Text style={s.sub}>Ainda não há faturas. A primeira aparece aqui assim que for gerada.</Text>}
      {dados?.faturas.map((f) => (
        <View key={f.id} style={s.fatura}>
          <View style={{ flex: 1 }}>
            <Text style={s.faturaData}>{f.data_formatada}</Text>
            <Text style={s.faturaSub}>{brl(f.valor)}{f.forma ? ` · ${f.forma}` : ''}</Text>
          </View>
          <Text style={[s.status, { backgroundColor: TOM[f.tom]?.bg, color: TOM[f.tom]?.cor }]}>{f.status}</Text>
          <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 82 }}>
            {f.em_aberto && <TouchableOpacity onPress={() => abrirPagar(f)} style={s.acao}><Text style={s.pagar}>Pagar</Text></TouchableOpacity>}
            {!!f.pdf && <TouchableOpacity onPress={() => Linking.openURL(f.pdf!)} style={s.acao}><Text style={s.pdf}>Baixar PDF</Text></TouchableOpacity>}
          </View>
        </View>
      ))}

      <Modal visible={!!janela} transparent animationType="slide" onRequestClose={() => setJanela(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fundo}>
          <View style={s.folha}>
            <View style={s.folhaTopo}>
              <Text style={s.folhaTitulo}>{faturaAberta ? `Pagar fatura de ${brl(faturaAberta.valor)}` : janela === 'cartao' ? 'Atualizar cartão' : 'Método de pagamento'}</Text>
              <TouchableOpacity onPress={() => setJanela(null)} style={s.fechar} accessibilityLabel="Fechar"><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
              {janela === 'metodo' && (
                <>
                  <View style={s.abas}>
                    {([['cartao', 'Cartão', 'card-outline'], ['pix', 'Pix', 'qr-code-outline'], ['boleto', 'Boleto', 'barcode-outline']] as const).map(([id, r, ic]) => (
                      <TouchableOpacity key={id} style={[s.aba, aba === id && s.abaOn]} onPress={() => setAba(id)}>
                        <Ionicons name={ic} size={20} color={aba === id ? '#fff' : '#374151'} /><Text style={[s.abaTxt, aba === id && { color: '#fff' }]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {aba === 'cartao' ? formCartao : (
                    <View style={{ gap: 12 }}>
                      <Text style={s.sub}>{aba === 'pix' ? 'Cada fatura terá QR Code e Pix copia e cola. O aviso também chega no seu e-mail.' : 'Cada fatura terá boleto com linha digitável e PDF (até 3 dias úteis para compensar). Também chega no seu e-mail.'}</Text>
                      <TouchableOpacity style={[s.botaoEscuro, (enviando || forma?.tipo === aba.toUpperCase()) && { opacity: 0.5 }]} disabled={enviando || forma?.tipo === aba.toUpperCase()} onPress={() => usarForma(aba)}>
                        <Text style={s.botaoEscuroTxt}>{forma?.tipo === aba.toUpperCase() ? 'Esta já é a sua forma padrão' : `Usar ${aba === 'pix' ? 'Pix' : 'boleto'} como padrão`}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
              {janela === 'cartao' && formCartao}
              {faturaAberta && (
                !pagar ? <ActivityIndicator style={{ marginVertical: 40 }} /> : pagar.erro ? <Text style={s.erro}>{pagar.erro}</Text> : (
                  <View style={{ gap: 18 }}>
                    {pagar.pix && (
                      <View style={{ alignItems: 'center', gap: 8 }}>
                        <Text style={s.formaNome}>Pix: escaneie o QR Code</Text>
                        <Image source={{ uri: `data:image/png;base64,${pagar.pix.imagem}` }} style={{ width: 220, height: 220 }} accessibilityLabel="QR Code Pix" />
                        <Text style={s.sub}>ou use o Pix copia e cola</Text>
                        <View style={s.codigo}><Text style={s.codigoTxt} numberOfLines={2}>{pagar.pix.copia_e_cola}</Text></View>
                        <TouchableOpacity style={s.botaoEscuro} onPress={() => copiar(pagar.pix!.copia_e_cola)}>
                          <Ionicons name={copiado === pagar.pix.copia_e_cola ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /><Text style={s.botaoEscuroTxt}>{copiado === pagar.pix.copia_e_cola ? 'Copiado!' : 'Copiar código Pix'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {pagar.boleto && (
                      <View style={{ gap: 8 }}>
                        <Text style={s.formaNome}>Boleto</Text>
                        {!!pagar.boleto.linha_digitavel && (
                          <>
                            <View style={s.codigo}><Text style={s.codigoTxt}>{pagar.boleto.linha_digitavel}</Text></View>
                            <TouchableOpacity style={s.botaoClaroPeq} onPress={() => copiar(pagar.boleto!.linha_digitavel!)}><Text style={s.botaoClaroTxt}>{copiado === pagar.boleto.linha_digitavel ? 'Copiado!' : 'Copiar linha digitável'}</Text></TouchableOpacity>
                          </>
                        )}
                        {!!pagar.boleto.pdf && <TouchableOpacity onPress={() => Linking.openURL(pagar.boleto!.pdf!)}><Text style={s.pdf}>Baixar boleto (PDF)</Text></TouchableOpacity>}
                      </View>
                    )}
                    {!!pagar.fatura && <TouchableOpacity onPress={() => Linking.openURL(pagar.fatura!)}><Text style={[s.sub, { textAlign: 'center', textDecorationLine: 'underline' }]}>Ver fatura completa no Asaas</Text></TouchableOpacity>}
                  </View>
                )
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Campo({ rotulo, valor, onChange, teclado, seguro }: { rotulo: string; valor: string; onChange: (v: string) => void; teclado?: 'number-pad'; seguro?: boolean }) {
  return (
    <View>
      <Text style={s.campoRotulo}>{rotulo}</Text>
      <TextInput value={valor} onChangeText={onChange} keyboardType={teclado || 'default'} secureTextEntry={seguro} style={s.campo} autoCapitalize="characters" placeholderTextColor="#9CA3AF" />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 14, color: '#4B5563', marginTop: 4, lineHeight: 20 },
  botaoClaro: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12 },
  botaoClaroPeq: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  botaoClaroTxt: { fontSize: 14, fontWeight: '600', color: '#111827' },
  aviso: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 13, color: '#111827' },
  forma: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  icone: { width: 40, height: 40, borderRadius: 9, backgroundColor: '#1A1F36', alignItems: 'center', justifyContent: 'center' },
  iconeTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },
  circulo: { width: 15, height: 15, borderRadius: 8 },
  formaNome: { fontSize: 16, color: '#111827', fontWeight: '600' },
  padrao: { fontSize: 12, fontWeight: '600', color: '#075985', backgroundColor: '#E0F2FE', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  formaSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  erro: { fontSize: 13, color: '#B91C1C', marginTop: 8 },
  fatura: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  faturaData: { fontSize: 15, color: '#111827' },
  faturaSub: { fontSize: 13, color: '#6B7280' },
  status: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  acao: { minHeight: 30, justifyContent: 'center' },
  pagar: { fontSize: 14, fontWeight: '700', color: '#E8590C' },
  pdf: { fontSize: 14, color: '#075985', textDecorationLine: 'underline' },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  folha: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '92%' },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  folhaTitulo: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  abas: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  aba: { flex: 1, minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', gap: 3 },
  abaOn: { backgroundColor: '#111827', borderColor: '#111827' },
  abaTxt: { fontSize: 13, fontWeight: '600', color: '#374151' },
  secaoMini: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginTop: 4 },
  campoRotulo: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  campo: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 15, color: '#111827' },
  botaoEscuro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 12, backgroundColor: '#111827', alignSelf: 'stretch' },
  botaoEscuroTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nota: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  codigo: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, alignSelf: 'stretch' },
  codigoTxt: { fontSize: 12, color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
