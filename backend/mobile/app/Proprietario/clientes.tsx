import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Vazio, Erro, api, brl, dataCompleta } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';

interface Cliente {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  foto_perfil: string | null;
  total_visitas: number;
  total_gasto: number;
  ultima_visita: string | null;
}

export default function ClientesSocio() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');

  const { dados, carregando, atualizando, erro, recarregar, atualizar } = useCarga<{ clientes: Cliente[] }>(
    () => api(`/proprietario/clientes?busca=${encodeURIComponent(termo)}`),
    [termo]
  );

  const clientes = dados?.clientes || [];

  return (
    <OwnerScreen titulo="Clientes" subtitulo="Quem já atendeu nos seus locais" carregando={carregando && !dados} atualizando={atualizando} onAtualizar={atualizar}>
      <View style={s.busca}>
        <Ionicons name="search" size={18} color={O.faint} />
        <TextInput
          style={s.buscaInput}
          placeholder="Buscar cliente pelo nome"
          placeholderTextColor={O.faint}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setTermo(busca.trim())}
          returnKeyType="search"
        />
        {!!busca && (
          <TouchableOpacity onPress={() => { setBusca(''); setTermo(''); }}>
            <Ionicons name="close-circle" size={18} color={O.faint} />
          </TouchableOpacity>
        )}
      </View>

      {erro && !dados ? (
        <Erro mensagem={erro} aoTentar={recarregar} />
      ) : clientes.length === 0 ? (
        <Card><Vazio icone="people-outline" titulo="Nenhum cliente encontrado" texto="Os clientes aparecem aqui depois do primeiro agendamento nos seus locais." /></Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {clientes.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              style={[s.linha, i < clientes.length - 1 && s.borda]}
              activeOpacity={0.6}
              onPress={() => router.push({ pathname: '/src/funcionario/DetalheCliente', params: { id: c.id } } as never)}
            >
              <View style={s.avatar}>
                {c.foto_perfil ? <Image source={{ uri: c.foto_perfil }} style={s.avatarImg} /> : <Text style={s.avatarTxt}>{c.nome.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nome} numberOfLines={1}>{c.nome}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {c.total_visitas} {c.total_visitas === 1 ? 'visita' : 'visitas'}{c.ultima_visita ? ` · última em ${dataCompleta(c.ultima_visita) || c.ultima_visita}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.gasto}>{brl(c.total_gasto)}</Text>
                <Text style={s.gastoRotulo}>gasto total</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  busca: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: O.card, borderWidth: 1, borderColor: O.line, borderRadius: 16, paddingHorizontal: 14, height: 50, marginBottom: 14 },
  buscaInput: { flex: 1, fontSize: 15, color: O.ink },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  borda: { borderBottomWidth: 1, borderBottomColor: O.line },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: 17, fontWeight: '700', color: O.muted },
  nome: { fontSize: 15, fontWeight: '700', color: O.ink },
  sub: { fontSize: 12, color: O.muted, marginTop: 2 },
  gasto: { fontSize: 14, fontWeight: '700', color: O.ink },
  gastoRotulo: { fontSize: 11, color: O.faint, marginTop: 2 },
});
