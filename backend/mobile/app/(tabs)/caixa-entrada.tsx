import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  black: '#000000',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface Conversa {
  id: number | string;
  nome: string;
  ultima_mensagem: string;
  tempo: string;
  avatar?: string | null;
  iniciais: string;
  contexto?: string | null;
  funcionario_nome?: string | null;
  nao_lidas?: number;
}

export default function CaixaEntrada() {
  const router = useRouter();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarConversas = useCallback(async (mostrarLoading = true) => {
    if (mostrarLoading) setLoading(true);
    try {
      const token = (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
      const res = await fetch(`${API_URL}/mensagens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setConversas(json.conversas || []);
    } catch (e) {
      console.log('Erro ao carregar conversas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarConversas(conversas.length === 0);
    }, [carregarConversas])
  );

  const aoAtualizar = () => {
    setRefreshing(true);
    carregarConversas(false);
  };

  const abrirConversa = (id: number | string) => {
    router.push(`/mensagens/${id}`);
  };

  const renderItem = ({ item }: { item: Conversa }) => (
    <TouchableOpacity style={styles.item} onPress={() => abrirConversa(item.id)} activeOpacity={0.7}>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{item.iniciais}</Text>
        </View>
      )}

      <View style={styles.itemTextos}>
        <Text style={styles.itemNome} numberOfLines={1}>{item.nome}</Text>
        {(item.contexto || item.funcionario_nome) ? (
          <Text style={styles.itemContexto} numberOfLines={1}>
            {item.contexto ? `Sobre: ${item.contexto}` : ''}
            {item.contexto && item.funcionario_nome ? ' · ' : ''}
            {item.funcionario_nome ? `com ${item.funcionario_nome}` : ''}
          </Text>
        ) : null}
        <Text style={styles.itemUltimaMensagem} numberOfLines={1}>{item.ultima_mensagem}</Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {item.tempo ? <Text style={styles.itemTempo}>{item.tempo}</Text> : null}
        {!!item.nao_lidas && item.nao_lidas > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.nao_lidas}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Mensagens</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : conversas.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={60} color={COLORS.gray} />
          <Text style={styles.emptyStateTitle}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptyStateDesc}>
            Quando você conversar com um estabelecimento, as mensagens aparecem aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversas}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={aoAtualizar} tintColor={COLORS.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  headerBar: {
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.secondary,
    marginTop: 16,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 68,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.lightGray,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  itemTextos: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  itemNome: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 3,
  },
  itemUltimaMensagem: {
    fontSize: 13,
    color: COLORS.gray,
  },
  itemTempo: {
    fontSize: 12,
    color: COLORS.gray,
  },
  itemContexto: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
