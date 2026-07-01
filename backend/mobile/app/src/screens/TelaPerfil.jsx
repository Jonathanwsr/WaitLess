import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';

export default function TelaPerfil() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        {/* Info do Usuário */}
        <View style={styles.userInfoContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>JONATHAN WILLIAN SILVA ROCHA</Text>
            <View style={styles.tagDigital}>
              <Text style={styles.tagText}>Digital</Text>
            </View>
          </View>
        </View>

        {/* Nome de Exibição */}
        <View style={styles.displayNameCard}>
          <Text style={styles.label}>Nome de exibição</Text>
          <Text style={styles.displayName}>JONATHAN WILLIAN SILVA ROCHA</Text>
        </View>

        {/* Ações Rápidas (Horizontal) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard}><Text style={styles.actionText}>Dados Bancários</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}><Text style={styles.actionText}>Informe de rendimentos</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}><Text style={styles.actionText}>Meu Crédito</Text></TouchableOpacity>
        </ScrollView>

        {/* Central de Segurança */}
        <Text style={styles.sectionTitle}>Central de Segurança</Text>
        <View style={styles.securityContainer}>
          <TouchableOpacity style={styles.securityCard}>
            <Text style={styles.cardTitle}>Meus Limites</Text>
            <Text style={styles.cardSubtitle}>Gestão de limites diários</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.securityCard}>
            <Text style={styles.cardTitle}>Token e Autorização</Text>
            <Text style={styles.cardSubtitle}>Autenticar com QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Configurações */}
        <View style={styles.listContainer}>
          <TouchableOpacity style={styles.listItem}><Text style={styles.listText}>Meus benefícios</Text></TouchableOpacity>
          <TouchableOpacity style={styles.listItem}><Text style={styles.listText}>Perfil do Fórum</Text></TouchableOpacity>
          <TouchableOpacity style={styles.listItem}><Text style={styles.listText}>Atualização cadastral</Text></TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  userInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 30 },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  tagDigital: { backgroundColor: '#E2725B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, alignSelf: 'flex-start' },
  tagText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  displayNameCard: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, marginBottom: 25 },
  label: { fontSize: 12, color: '#777', marginBottom: 5 },
  displayName: { fontSize: 16, color: '#333' },
  quickActions: { flexDirection: 'row', marginBottom: 25 },
  actionCard: { width: 120, height: 100, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 15, marginRight: 15, justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '500', color: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  securityContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  securityCard: { flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 15, marginHorizontal: 5 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  cardSubtitle: { fontSize: 12, color: '#666' },
  listContainer: { marginTop: 10, paddingBottom: 40 },
  listItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  listText: { fontSize: 16, color: '#333', fontWeight: '500' }
});