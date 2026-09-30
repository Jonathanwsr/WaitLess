import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, Pilula, LinhaMenu, Erro, api, dataCompleta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { alertar } from '../../services/alertar';
import { irParaLoginSemVoltar } from '../../services/sessao';

interface Usuario {
  name: string;
  email: string;
  papel: string;
  telefone: string | null;
  cpf_cnpj: string | null;
  foto_perfil: string | null;
  data_nascimento: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  profissao: string | null;
  idiomas: string | null;
  onde_estudei: string | null;
  onde_moro: string | null;
  sobre_mim: string | null;
  membro_desde: string | null;
  plano_atual: string;
  assinatura: { status: string } | null;
  pontos_saldo?: number;
}

const PAPEL: Record<string, string> = {
  socio: 'Sócio',
  proprietario: 'Proprietário',
  gerente: 'Gerente',
  admin: 'Administrador',
};

const soDigitos = (v?: string | null) => String(v || '').replace(/\D/g, '');

const telefone = (v?: string | null) => {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || '';
};

const documento = (v?: string | null) => {
  const d = soDigitos(v);
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.***/****-${d.slice(12)}`;
  return '';
};

function Dado({ icone, rotulo, valor, ultimo }: { icone: string; rotulo: string; valor: string; ultimo?: boolean }) {
  return (
    <View style={[s.dado, !ultimo && s.dadoBorda]}>
      <View style={s.dadoIcone}><Ionicons name={icone as any} size={17} color={O.ink} /></View>
      <Text style={s.dadoRotulo}>{rotulo}</Text>
      <Text style={s.dadoValor} numberOfLines={2}>{valor}</Text>
    </View>
  );
}

export default function PerfilSocio() {
  const router = useRouter();

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<{ usuario: Usuario; locais: number }>(async () => {
    const [me, painel] = await Promise.all([api('/me'), api('/proprietario/dashboard').catch(() => null)]);
    return { usuario: me.user as Usuario, locais: painel?.estabelecimentos?.length ?? 0 };
  });

  const u = dados?.usuario;
  const plano = String(u?.plano_atual || 'gratuito');
  const planoAtivo = plano !== 'gratuito' && u?.assinatura?.status === 'ativa';

  const endereco = u ? [[u.endereco, u.numero].filter(Boolean).join(', '), u.bairro].filter(Boolean).join(' - ') : '';
  const cidade = u ? [u.cidade, u.estado].filter(Boolean).join(' - ') : '';

  const sair = () => {
    alertar('Sair da conta', 'Tem certeza de que deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/logout', { method: 'POST' });
          } catch {
            // encerra localmente mesmo sem conexão
          }
          await AsyncStorage.multiRemove(['@waitless_token', '@lokyva_token']);
          await SecureStore.deleteItemAsync('userData');
          irParaLoginSemVoltar(router);
        },
      },
    ]);
  };

  const dadosPessoais: { icone: string; rotulo: string; valor: string }[] = u
    ? [
        { icone: 'mail-outline', rotulo: 'E-mail', valor: u.email },
        u.telefone ? { icone: 'call-outline', rotulo: 'Telefone', valor: telefone(u.telefone) } : null,
        u.data_nascimento ? { icone: 'calendar-outline', rotulo: 'Nascimento', valor: dataCompleta(u.data_nascimento + 'T12:00:00') } : null,
        documento(u.cpf_cnpj) ? { icone: 'card-outline', rotulo: 'CPF / CNPJ', valor: documento(u.cpf_cnpj) } : null,
        endereco ? { icone: 'home-outline', rotulo: 'Endereço', valor: endereco } : null,
        cidade ? { icone: 'location-outline', rotulo: 'Cidade', valor: cidade } : null,
        u.profissao ? { icone: 'briefcase-outline', rotulo: 'Profissão', valor: u.profissao } : null,
        u.idiomas ? { icone: 'language-outline', rotulo: 'Idiomas', valor: u.idiomas } : null,
        u.onde_estudei ? { icone: 'school-outline', rotulo: 'Formação', valor: u.onde_estudei } : null,
        u.onde_moro ? { icone: 'map-outline', rotulo: 'Onde mora', valor: u.onde_moro } : null,
      ].filter(Boolean) as { icone: string; rotulo: string; valor: string }[]
    : [];

  return (
    <OwnerScreen titulo="Meu perfil" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : u && (
        <>
          {/* CABEÇALHO DO PERFIL */}
          <View style={s.hero}>
            <View style={s.avatar}>
              {u.foto_perfil ? <Image source={{ uri: u.foto_perfil }} style={s.avatarImg} contentFit="cover" /> : <Text style={s.avatarTxt}>{u.name.charAt(0).toUpperCase()}</Text>}
            </View>
            <Text style={s.nome} numberOfLines={1}>{u.name}</Text>
            <Text style={s.email} numberOfLines={1}>{u.email}</Text>
            <View style={{ marginTop: 10 }}><Pilula texto={PAPEL[String(u.papel).toLowerCase()] || u.papel} /></View>

            <TouchableOpacity style={s.editar} onPress={() => router.push('/src/screens/EditarPerfil' as never)} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={17} color="#fff" />
              <Text style={s.editarTxt}>Editar perfil</Text>
            </TouchableOpacity>
          </View>

          {/* INDICADORES */}
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statValor}>{dados?.locais ?? 0}</Text>
              <Text style={s.statRotulo}>{(dados?.locais ?? 0) === 1 ? 'Local' : 'Locais'}</Text>
            </View>
            <View style={s.statDivisor} />
            <TouchableOpacity style={s.stat} onPress={() => router.push('/src/screens/MeusPontos' as never)} activeOpacity={0.7}>
              <Text style={s.statValor}>{u.pontos_saldo ?? 0}</Text>
              <Text style={s.statRotulo}>Pontos</Text>
            </TouchableOpacity>
            <View style={s.statDivisor} />
            <View style={s.stat}>
              <Text style={[s.statValor, planoAtivo && { color: O.success }]} numberOfLines={1}>{plano.toUpperCase()}</Text>
              <Text style={s.statRotulo}>Plano</Text>
            </View>
            <View style={s.statDivisor} />
            <View style={s.stat}>
              <Text style={s.statValor}>{u.membro_desde ? new Date(u.membro_desde + 'T12:00:00').getFullYear() : '-'}</Text>
              <Text style={s.statRotulo}>Desde</Text>
            </View>
          </View>

          {/* INFORMAÇÕES PESSOAIS */}
          <Rotulo>Informações pessoais</Rotulo>
          <Card style={{ paddingVertical: 4 }}>
            {dadosPessoais.map((d, i) => (
              <Dado key={d.rotulo} icone={d.icone} rotulo={d.rotulo} valor={d.valor} ultimo={i === dadosPessoais.length - 1} />
            ))}
          </Card>

          {!!u.sobre_mim && (
            <>
              <Rotulo>Sobre mim</Rotulo>
              <Card><Text style={s.sobre}>{u.sobre_mim}</Text></Card>
            </>
          )}

          {/* CONTA E NEGÓCIO */}
          <Rotulo>Conta e negócio</Rotulo>
          <Card style={{ paddingVertical: 2 }}>
            <LinhaMenu icone="ribbon-outline" titulo="Minha assinatura" descricao={planoAtivo ? `Plano ${plano}` : 'Conheça os planos e vantagens'} aoPressionar={() => router.push('/assinatura' as never)} />
            <LinhaMenu icone="card-outline" titulo="Conta de recebimento" descricao="Dados bancários e chave PIX" aoPressionar={() => router.push('/Proprietario/RegisterProviderScreen' as never)} />
            <LinhaMenu icone="storefront-outline" titulo="Meus locais" descricao="Gerencie seus estabelecimentos" aoPressionar={() => router.push('/Proprietario/MeusEstabelecimentos' as never)} />
            <LinhaMenu icone="flash-outline" titulo="Ganhe pontos usando o app" descricao="Check-in diário e sugestões" aoPressionar={() => router.push('/src/screens/Gamificacao' as never)} />
            <LinhaMenu icone="chatbubbles-outline" titulo="Mensagens" descricao="Conversas com clientes" aoPressionar={() => router.push('/mensagens' as never)} />
            <LinhaMenu icone="help-buoy-outline" titulo="Suporte" descricao="Fale com a equipe Lokyva" aoPressionar={() => router.push('/src/screens/TelaSuporte' as never)} />
            <LinhaMenu icone="document-text-outline" titulo="Termos e compromissos" aoPressionar={() => router.push('/src/screens/TermosCompromisso' as never)} ultimo />
          </Card>

          {/* AÇÕES DA CONTA */}
          <Rotulo>Ações da conta</Rotulo>
          <Card style={{ paddingVertical: 2 }}>
            <LinhaMenu icone="log-out-outline" titulo="Sair da conta" descricao="Encerrar sessão neste aparelho" aoPressionar={sair} />
            <TouchableOpacity style={s.apagar} onPress={() => router.push('/src/screens/TelaSuporte' as never)} activeOpacity={0.7}>
              <View style={[s.dadoIcone, { backgroundColor: O.dangerBg }]}><Ionicons name="trash-outline" size={17} color={O.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.apagarTitulo}>Apagar minha conta</Text>
                <Text style={s.apagarDesc}>Fale com o suporte para excluir sua conta e dados</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={O.faint} />
            </TouchableOpacity>
          </Card>
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', backgroundColor: O.card, borderRadius: 26, padding: 22, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: O.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14 },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: '#fff', fontSize: 36, fontWeight: '700' },
  nome: { fontSize: 22, fontWeight: '800', color: O.ink, letterSpacing: -0.4 },
  email: { fontSize: 13, color: O.muted, marginTop: 3 },
  editar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', backgroundColor: O.accent, height: 48, borderRadius: 16, marginTop: 18 },
  editarTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  stats: { flexDirection: 'row', backgroundColor: O.card, borderRadius: 20, paddingVertical: 16, marginBottom: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statValor: { fontSize: 18, fontWeight: '800', color: O.ink },
  statRotulo: { fontSize: 11, color: O.muted, marginTop: 3, fontWeight: '600' },
  statDivisor: { width: 1, backgroundColor: O.line },

  dado: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  dadoBorda: { borderBottomWidth: 1, borderBottomColor: O.line },
  dadoIcone: { width: 34, height: 34, borderRadius: 11, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  dadoRotulo: { fontSize: 14, color: O.muted, fontWeight: '500', width: 84 },
  dadoValor: { flex: 1, fontSize: 14, color: O.ink, fontWeight: '600', textAlign: 'right' },
  sobre: { fontSize: 14, lineHeight: 22, color: O.ink },

  apagar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: O.line },
  apagarTitulo: { fontSize: 15, fontWeight: '600', color: O.danger },
  apagarDesc: { fontSize: 12, color: O.muted, marginTop: 2 },
});
