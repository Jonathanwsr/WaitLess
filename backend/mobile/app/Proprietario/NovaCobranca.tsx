import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OwnerScreen, Card, Rotulo, Segmentado, Vazio, api, brl } from '../../components/owner/ui';
import { useAviso } from '../../components/owner/Aviso';
import { O } from '../../constants/OwnerTheme';

type Opcoes = {
  servicos: { id: number; nome: string; valor: string | number }[];
  reservas: { id: number; cliente_id: number; servico_nome?: string; data: string; hora: string; valor: number; funcionario_nome?: string | null }[];
  funcionarios: { id: number; nome: string }[];
  carteira_configurada: boolean;
  taxa_percentual: number;
  parte_do_socio_percentual: number;
};
type Cliente = { id: number; name: string; email: string };

const pct = (v: number) => String(v).replace('.', ',');
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const dataBR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');

const ATALHOS_VENCIMENTO = [
  { rotulo: 'Hoje', dias: 0 },
  { rotulo: 'Em 7 dias', dias: 7 },
  { rotulo: 'Em 15 dias', dias: 15 },
  { rotulo: 'Em 30 dias', dias: 30 },
];

export default function NovaCobranca() {
  const router = useRouter();
  const { aviso, mostrarErro, mostrarSucesso } = useAviso();

  const [estabelecimentos, setEstabelecimentos] = useState<{ id: number; nome: string }[]>([]);
  const [estabelecimentoId, setEstabelecimentoId] = useState<number | null>(null);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);

  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [servicos, setServicos] = useState<number[]>([]);
  const [reservas, setReservas] = useState<number[]>([]);
  const [funcionarioPorServico, setFuncionarioPorServico] = useState<Record<number, number | null>>({});
  const [parcelas, setParcelas] = useState(1);
  const [vencimento, setVencimento] = useState(emDias(0));
  const [calendario, setCalendario] = useState(false);
  const [modo, setModo] = useState<'online' | 'presencial'>('online');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api('/cobrancas')
      .then((d) => {
        setEstabelecimentos(d.estabelecimentos || []);
        if (d.estabelecimentos?.[0]) setEstabelecimentoId(d.estabelecimentos[0].id);
      })
      .catch((e) => mostrarErro(e));
  }, [mostrarErro]);

  useEffect(() => {
    if (!estabelecimentoId) return;
    setCarregandoOpcoes(true);
    setServicos([]);
    setReservas([]);
    api(`/cobrancas/opcoes?estabelecimento_id=${estabelecimentoId}`)
      .then((d: Opcoes) => {
        setOpcoes(d);
        if (!d.carteira_configurada) setModo('presencial');
      })
      .catch((e) => mostrarErro(e))
      .finally(() => setCarregandoOpcoes(false));
  }, [estabelecimentoId, mostrarErro]);

  useEffect(() => {
    if (termo.trim().length < 3) { setResultados([]); return; }
    const t = setTimeout(() => {
      api(`/cobrancas/buscar-clientes?q=${encodeURIComponent(termo.trim())}`)
        .then((d) => setResultados(d.clientes || []))
        .catch(() => setResultados([]));
    }, 350);
    return () => clearTimeout(t);
  }, [termo]);

  const reservasDoCliente = useMemo(
    () => (opcoes && cliente ? opcoes.reservas.filter((r) => r.cliente_id === cliente.id) : []),
    [opcoes, cliente],
  );

  const total = useMemo(() => {
    if (!opcoes) return 0;
    const somaServicos = opcoes.servicos.filter((sv) => servicos.includes(sv.id)).reduce((a, sv) => a + Number(sv.valor), 0);
    const somaReservas = reservasDoCliente.filter((r) => reservas.includes(r.id)).reduce((a, r) => a + Number(r.valor), 0);
    return Math.round((somaServicos + somaReservas) * 100) / 100;
  }, [opcoes, servicos, reservas, reservasDoCliente]);

  // Mesma regra do servidor: até 12x e nenhuma parcela abaixo de R$ 20.
  const maximo = Math.max(1, Math.min(12, Math.floor(total / 20)));
  useEffect(() => { if (parcelas > maximo) setParcelas(maximo); }, [maximo, parcelas]);
  const valorParcela = total > 0 ? Math.floor((total / parcelas) * 100) / 100 : 0;
  const ultima = Math.round((total - valorParcela * (parcelas - 1)) * 100) / 100;

  const alternar = (lista: number[], definir: (v: number[]) => void, id: number) =>
    definir(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const enviar = async () => {
    if (!cliente || !estabelecimentoId) return;
    setEnviando(true);
    try {
      const r = await api('/cobrancas', {
        method: 'POST',
        body: {
          estabelecimento_id: estabelecimentoId,
          cliente_id: cliente.id,
          modo,
          parcelas,
          primeiro_vencimento: vencimento,
          descricao: descricao.trim() || null,
          itens: [
            ...servicos.map((id) => ({ tipo: 'servico', id, funcionario_id: funcionarioPorServico[id] ?? null })),
            ...reservas.map((id) => ({ tipo: 'reserva', id })),
          ],
        },
      });
      mostrarSucesso('Cobrança enviada', r?.message || 'O cliente precisa aceitar para os pagamentos começarem.');
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      const primeiro = e?.erros ? Object.values(e.erros as Record<string, string[]>)[0]?.[0] : null;
      mostrarErro(primeiro ? { message: primeiro } : e);
    } finally {
      setEnviando(false);
    }
  };

  const podeEnviar = !!cliente && total > 0 && servicos.length + reservas.length > 0 && !enviando;

  return (
    <OwnerScreen titulo="Nova cobrança" subtitulo="Serviços ou reserva em parcelas">
      {aviso}

      <Card style={{ backgroundColor: O.infoBg }}>
        <Text style={s.infoTxt}>
          O cliente vê tudo e precisa aceitar antes. Online: você recebe {pct(opcoes?.parte_do_socio_percentual ?? 99.5)}% de cada parcela na carteira. Presencial: a taxa de {pct(opcoes?.taxa_percentual ?? 0.5)}% sai do seu próximo repasse.
        </Text>
      </Card>

      {estabelecimentos.length > 1 && (
        <>
          <Rotulo>1. Local</Rotulo>
          <View style={s.chips}>
            {estabelecimentos.map((e) => (
              <TouchableOpacity key={e.id} onPress={() => setEstabelecimentoId(e.id)} style={[s.chip, estabelecimentoId === e.id && s.chipAtivo]}>
                <Text style={[s.chipTxt, estabelecimentoId === e.id && s.chipTxtAtivo]}>{e.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Rotulo>Cliente</Rotulo>
      <Card>
        {cliente ? (
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={s.forte}>{cliente.name}</Text>
              <Text style={s.meta}>{cliente.email}</Text>
            </View>
            <TouchableOpacity onPress={() => { setCliente(null); setReservas([]); }}><Text style={s.link}>Trocar</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.busca}>
              <Ionicons name="search" size={16} color={O.faint} />
              <TextInput value={termo} onChangeText={setTermo} placeholder="Nome ou e-mail (mín. 3 letras)" placeholderTextColor={O.faint} style={s.buscaInput} autoCapitalize="none" />
            </View>
            {resultados.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => { setCliente(c); setTermo(''); setResultados([]); }} style={s.resultado}>
                <Text style={s.forte}>{c.name}</Text>
                <Text style={s.meta}>{c.email}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </Card>

      {carregandoOpcoes && <ActivityIndicator color={O.accent} style={{ marginVertical: 12 }} />}

      {cliente && opcoes && (
        <>
          <Rotulo>O que será cobrado</Rotulo>
          <Card>
            <Text style={s.sub}>Serviços</Text>
            {opcoes.servicos.length === 0 && <Text style={s.meta}>Nenhum serviço cadastrado neste local.</Text>}
            {opcoes.servicos.map((sv) => {
              const marcado = servicos.includes(sv.id);
              return (
                <View key={sv.id} style={s.opcao}>
                  <TouchableOpacity onPress={() => alternar(servicos, setServicos, sv.id)} style={s.linha}>
                    <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={22} color={marcado ? O.accent : O.faint} />
                    <Text style={[s.forte, { flex: 1 }]}>{sv.nome}</Text>
                    <Text style={s.forte}>{brl(sv.valor)}</Text>
                  </TouchableOpacity>
                  {marcado && opcoes.funcionarios.length > 0 && (
                    <View style={[s.chips, { marginTop: 8 }]}>
                      <Text style={s.meta}>Quem atende:</Text>
                      {opcoes.funcionarios.map((f) => {
                        const ativo = funcionarioPorServico[sv.id] === f.id;
                        return (
                          <TouchableOpacity key={f.id} onPress={() => setFuncionarioPorServico({ ...funcionarioPorServico, [sv.id]: ativo ? null : f.id })} style={[s.chipP, ativo && s.chipAtivo]}>
                            <Text style={[s.chipTxt, ativo && s.chipTxtAtivo]}>{f.nome}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={[s.sub, { marginTop: 12 }]}>Reservas deste cliente (últimos 30 dias)</Text>
            {reservasDoCliente.length === 0 && <Text style={s.meta}>Este cliente não tem reservas recentes.</Text>}
            {reservasDoCliente.map((r) => {
              const marcado = reservas.includes(r.id);
              return (
                <TouchableOpacity key={r.id} onPress={() => alternar(reservas, setReservas, r.id)} style={[s.opcao, s.linha]}>
                  <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={22} color={marcado ? O.accent : O.faint} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.forte}>{r.servico_nome || 'Atendimento'}</Text>
                    <Text style={s.meta}>{r.data} às {r.hora}{r.funcionario_nome ? ` · com ${r.funcionario_nome}` : ''}</Text>
                  </View>
                  <Text style={s.forte}>{brl(r.valor)}</Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        </>
      )}

      {cliente && !opcoes && !carregandoOpcoes && <Card><Vazio icone="alert-circle-outline" titulo="Não foi possível carregar os serviços" /></Card>}

      {total > 0 && (
        <>
          <Rotulo>Parcelas</Rotulo>
          <Card>
            <View style={s.chips}>
              {Array.from({ length: maximo }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity key={n} onPress={() => setParcelas(n)} style={[s.chipP, parcelas === n && s.chipAtivo]}>
                  <Text style={[s.chipTxt, parcelas === n && s.chipTxtAtivo]}>{n}x</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.sub, { marginTop: 12 }]}>1º vencimento: {dataBR(vencimento)}</Text>
            <View style={s.chips}>
              {ATALHOS_VENCIMENTO.map((a) => {
                const valor = emDias(a.dias);
                return (
                  <TouchableOpacity key={a.dias} onPress={() => setVencimento(valor)} style={[s.chipP, vencimento === valor && s.chipAtivo]}>
                    <Text style={[s.chipTxt, vencimento === valor && s.chipTxtAtivo]}>{a.rotulo}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity onPress={() => setCalendario(true)} style={s.chipP}>
                <Text style={s.chipTxt}>Outra data</Text>
              </TouchableOpacity>
            </View>
            {calendario && (
              <DateTimePicker
                value={new Date(`${vencimento}T12:00:00`)}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => {
                  setCalendario(Platform.OS === 'ios');
                  if (d) setVencimento(isoLocal(d));
                }}
              />
            )}
            <View style={s.resumo}>
              <Text style={s.forte}>Total: {brl(total)}</Text>
              <Text style={s.meta}>{parcelas}x de {brl(valorParcela)}{parcelas > 1 ? ` (a última é ${brl(ultima)})` : ''}, uma por mês.</Text>
            </View>
          </Card>

          <Rotulo>Como o cliente vai pagar</Rotulo>
          <Segmentado
            opcoes={[{ id: 'online', rotulo: 'Online (link)' }, { id: 'presencial', rotulo: 'Presencial' }]}
            valor={modo}
            aoMudar={(id) => {
              if (id === 'online' && opcoes && !opcoes.carteira_configurada) {
                mostrarErro({ message: 'Configure sua carteira Asaas antes de cobrar online.' });
                return;
              }
              setModo(id as 'online' | 'presencial');
            }}
          />
          <Card>
            <TextInput value={descricao} onChangeText={setDescricao} maxLength={500} placeholder="Observação para o cliente (opcional)" placeholderTextColor={O.faint} style={s.campo} multiline />
          </Card>

          <TouchableOpacity disabled={!podeEnviar} onPress={enviar} style={[s.enviar, !podeEnviar && { opacity: 0.4 }]}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            <Text style={s.enviarTxt}>{enviando ? 'Enviando...' : 'Enviar para o cliente'}</Text>
          </TouchableOpacity>
          <Text style={[s.meta, { textAlign: 'center', marginTop: 8 }]}>Nada é cobrado até o cliente aceitar.</Text>
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  infoTxt: { fontSize: 12, color: O.ink, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: O.card, borderWidth: 1, borderColor: O.line },
  chipP: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: O.soft },
  chipAtivo: { backgroundColor: O.ink, borderColor: O.ink },
  chipTxt: { fontSize: 13, fontWeight: '700', color: O.muted },
  chipTxtAtivo: { color: '#fff' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  forte: { fontSize: 14, fontWeight: '700', color: O.ink },
  meta: { fontSize: 12, color: O.muted },
  sub: { fontSize: 12, fontWeight: '800', color: O.muted, marginBottom: 6 },
  link: { fontSize: 13, fontWeight: '800', color: O.accent },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: O.soft, borderRadius: 12, paddingHorizontal: 12 },
  buscaInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: O.ink },
  resultado: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: O.line },
  opcao: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: O.line },
  resumo: { marginTop: 12, backgroundColor: O.soft, borderRadius: 12, padding: 12, gap: 2 },
  campo: { fontSize: 14, color: O.ink, minHeight: 44 },
  enviar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: O.ink, borderRadius: 16, height: 52, marginTop: 4 },
  enviarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
