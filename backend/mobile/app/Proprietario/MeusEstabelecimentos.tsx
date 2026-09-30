import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Pilula, Segmentado, Vazio, Erro, api } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { alertar } from '../../services/alertar';

interface Local {
  id: number;
  nome: string;
  foto_perfil: string | null;
  avaliacao_media: number;
  ativo: boolean;
  fila_agora: number;
  funcionarios_count: number;
}

export default function MeusEstabelecimentos() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<{ estabelecimentos: Local[] }>(() => api('/proprietario/dashboard'));

  const todos = dados?.estabelecimentos || [];
  const lista = todos.filter((l) => {
    if (filtro === 'ativos' && !l.ativo) return false;
    if (filtro === 'inativos' && l.ativo) return false;
    return l.nome.toLowerCase().includes(busca.trim().toLowerCase());
  });

  const alternarStatus = (l: Local) => {
    const acao = l.ativo ? 'desativar' : 'reativar';
    alertar(`${l.ativo ? 'Desativar' : 'Reativar'} local`, `Deseja ${acao} "${l.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: l.ativo ? 'Desativar' : 'Reativar',
        style: l.ativo ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await api(`/proprietario/estabelecimentos/${l.id}/status`, { method: 'PATCH' });
            recarregar();
          } catch (e: any) {
            alertar('Não foi possível alterar', e.message);
          }
        },
      },
    ]);
  };

  return (
    <OwnerScreen
      titulo="Meus locais"
      subtitulo={`${todos.length} ${todos.length === 1 ? 'estabelecimento' : 'estabelecimentos'}`}
      carregando={carregando && !dados}
      atualizando={atualizando}
      onAtualizar={atualizar}
      direita={
        <TouchableOpacity style={s.novo} onPress={() => router.push('/Proprietario/CriarEstabelecimento' as never)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.novoTxt}>Novo</Text>
        </TouchableOpacity>
      }
    >
      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : (
        <>
          <View style={s.busca}>
            <Ionicons name="search" size={18} color={O.faint} />
            <TextInput style={s.buscaInput} placeholder="Buscar local" placeholderTextColor={O.faint} value={busca} onChangeText={setBusca} />
          </View>

          <Segmentado
            opcoes={[{ id: 'todos', rotulo: 'Todos' }, { id: 'ativos', rotulo: 'Ativos' }, { id: 'inativos', rotulo: 'Inativos' }]}
            valor={filtro}
            aoMudar={setFiltro}
          />

          {lista.length === 0 ? (
            <Card>
              <Vazio
                icone="storefront-outline"
                titulo={todos.length === 0 ? 'Nenhum local cadastrado' : 'Nenhum resultado'}
                texto={todos.length === 0 ? 'Cadastre seu primeiro estabelecimento para começar a receber reservas.' : 'Ajuste a busca ou o filtro.'}
              />
            </Card>
          ) : (
            lista.map((l) => (
              <Card key={l.id}>
                <View style={s.topo}>
                  <View style={s.foto}>
                    {l.foto_perfil ? <Image source={{ uri: l.foto_perfil }} style={s.fotoImg} contentFit="cover" /> : <Text style={s.inicial}>{l.nome.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome} numberOfLines={1}>{l.nome}</Text>
                    <Text style={s.sub}>Nota {Number(l.avaliacao_media || 0).toFixed(1)} · {l.funcionarios_count} {l.funcionarios_count === 1 ? 'membro' : 'membros'}</Text>
                  </View>
                  <Pilula texto={l.ativo ? 'Ativo' : 'Inativo'} tom={l.ativo ? 'positivo' : 'negativo'} />
                </View>

                <View style={s.fila}>
                  <Text style={s.filaRotulo}>Na fila agora</Text>
                  <Text style={s.filaValor}>{l.fila_agora || 0}</Text>
                </View>

                <View style={s.acoes}>
                  {[
                    { t: 'Fila', i: 'list-outline', r: `/src/funcionario/Painel-funcioanario?origem=socio&estabelecimento_id=${l.id}` },
                    { t: 'Equipe', i: 'people-outline', r: `/Proprietario/FuncionariosScreen?id=${l.id}` },
                    { t: 'Agenda', i: 'calendar-outline', r: `/src/funcionario/AgendaEquipe?estabelecimento_id=${l.id}` },
                    { t: 'Ajustes', i: 'options-outline', r: `/Proprietario/ConfiguracoesMobile?id=${l.id}&nome=${encodeURIComponent(l.nome)}` },
                  ].map((b) => (
                    <TouchableOpacity key={b.t} style={s.btn} onPress={() => router.push(b.r as never)} activeOpacity={0.7}>
                      <Ionicons name={b.i as any} size={17} color={O.ink} />
                      <Text style={s.btnTxt}>{b.t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={s.status} onPress={() => alternarStatus(l)} activeOpacity={0.7}>
                  <Ionicons name={l.ativo ? 'pause-circle-outline' : 'play-circle-outline'} size={17} color={l.ativo ? O.danger : O.success} />
                  <Text style={[s.statusTxt, { color: l.ativo ? O.danger : O.success }]}>{l.ativo ? 'Desativar temporariamente' : 'Reativar local'}</Text>
                </TouchableOpacity>
              </Card>
            ))
          )}
        </>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  novo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: O.accent, paddingHorizontal: 14, height: 40, borderRadius: 20 },
  novoTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: O.card, borderWidth: 1, borderColor: O.line, borderRadius: 16, paddingHorizontal: 14, height: 50, marginBottom: 12 },
  buscaInput: { flex: 1, fontSize: 15, color: O.ink },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 52, height: 52, borderRadius: 16, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%' },
  inicial: { fontSize: 20, fontWeight: '700', color: O.muted },
  nome: { fontSize: 16, fontWeight: '700', color: O.ink },
  sub: { fontSize: 12, color: O.muted, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: O.soft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  filaRotulo: { fontSize: 13, color: O.muted, fontWeight: '600' },
  filaValor: { fontSize: 20, fontWeight: '800', color: O.ink },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: O.line },
  btnTxt: { fontSize: 11, fontWeight: '600', color: O.ink },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: O.line },
  statusTxt: { fontSize: 13, fontWeight: '600' },
});
