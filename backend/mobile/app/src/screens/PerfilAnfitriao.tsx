import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = { primary: '#E11D48', secondary: '#111827', gray: '#6B7280', white: '#FFFFFF', border: '#E5E7EB' };
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function PerfilAnfitriao() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    const fetchDados = async () => {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/catalogo/estabelecimentos/${id}`, { headers: { 'Authorization': `Bearer ${token}` }});
      setDados(await res.json());
    };
    fetchDados();
  }, [id]);

  if (!dados) return <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator color={COLORS.primary}/></View>;

  const { anfitriao, servicos_oferecidos, todas_avaliacoes } = dados;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
      </TouchableOpacity>

      {/* CARD DO ANFITRIÃO */}
      <View style={styles.hostCard}>
        <View style={styles.hostMain}>
          <Image source={{ uri: anfitriao.foto_perfil || 'https://via.placeholder.com/100' }} style={styles.avatar} />
          <Text style={styles.hostName}>{anfitriao.nome}</Text>
          <Text style={styles.superHost}><Ionicons name="trophy" size={12}/> Parceiro Verificado</Text>
        </View>
        <View style={styles.hostStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{anfitriao.total_avaliacoes}</Text>
            <Text style={styles.statLabel}>avaliações</Text>
          </View>
          <View style={styles.statBoxCenter}>
            <Text style={styles.statNumber}>{anfitriao.avaliacao_media} <Ionicons name="star" size={14}/></Text>
            <Text style={styles.statLabel}>estrelas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{new Date().getFullYear() - anfitriao.membro_desde}</Text>
            <Text style={styles.statLabel}>anos no app</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoList}>
        <Text style={styles.infoItem}><Ionicons name="location-outline" size={18}/> De: {anfitriao.cidade}, {anfitriao.estado}</Text>
        <Text style={styles.infoItem}><Ionicons name="shield-checkmark-outline" size={18}/> Identidade verificada</Text>
      </View>

      <View style={styles.divider} />

      {/* OUTROS SERVIÇOS DO ANFITRIÃO */}
      <Text style={styles.sectionTitle}>Serviços de {anfitriao.nome}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 24, marginBottom: 30 }}>
        {servicos_oferecidos.map((serv: any) => (
          <TouchableOpacity 
            key={serv.id} 
            style={styles.serviceCard}
            onPress={() => router.push({ pathname: '/src/screens/ServicoDetalhes', params: { id: serv.id } })}
          >
            <Image source={{ uri: 'https://via.placeholder.com/200' }} style={styles.serviceImg} />
            <Text style={styles.serviceName} numberOfLines={1}>{serv.nome}</Text>
            <Text style={styles.servicePrice}>R$ {Number(serv.valor).toFixed(2).replace('.', ',')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  backBtn: { padding: 24, marginTop: 20 },
  hostCard: { marginHorizontal: 24, backgroundColor: COLORS.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, flexDirection: 'row', alignItems: 'center' },
  hostMain: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: COLORS.border, paddingRight: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  hostName: { fontSize: 22, fontWeight: '900', color: COLORS.secondary },
  superHost: { fontSize: 12, fontWeight: '700', color: COLORS.secondary, marginTop: 4 },
  hostStats: { flex: 1, paddingLeft: 16, gap: 12 },
  statBox: { paddingVertical: 4 },
  statBoxCenter: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  statNumber: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },
  statLabel: { fontSize: 10, color: COLORS.gray, textTransform: 'uppercase' },
  infoList: { padding: 24, gap: 16 },
  infoItem: { fontSize: 16, color: COLORS.secondary },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, marginLeft: 24, marginBottom: 16 },
  serviceCard: { width: 160, marginRight: 16 },
  serviceImg: { width: '100%', height: 160, borderRadius: 16, marginBottom: 12 },
  serviceName: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  servicePrice: { fontSize: 14, color: COLORS.gray, marginTop: 4 }
});