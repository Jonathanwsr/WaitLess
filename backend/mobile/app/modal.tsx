import { router } from 'expo-router';
import { StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ModalScreen() {
  // Função para fechar a modal e navegar para a tela desejada
  const handleNavigate = (path: string) => {
    if (router.canDismiss()) {
      router.dismiss();
    }
    router.push(path as any);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        {/* Botão de fechar no canto superior direito */}
        <Pressable 
          style={styles.closeButton} 
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Ionicons name="close" size={20} color="#000000" />
        </Pressable>

        {/* Ícone principal em destaque */}
        <View style={styles.iconBadge}>
          <Ionicons name="grid-outline" size={32} color="#000000" />
        </View>

        {/* Textos do Modal */}
        <ThemedText type="title" style={styles.title}>
          Navegação Rápida
        </ThemedText>
        
        <ThemedText style={styles.description}>
          Escolha para qual tela você deseja ir:
        </ThemedText>

        {/* Lista de Navegação para as telas da pasta screens */}
        <View style={styles.menuContainer}>
          {/* 1. Home (Início) */}
          <Pressable style={styles.menuItem} onPress={() => handleNavigate('/(tabs)/home')}>
            <Ionicons name="home-outline" size={20} color="#000000" />
            <ThemedText style={styles.menuText}>Início / Home</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#A0A2A8" />
          </Pressable>

          {/* 2. Explorar */}
          <Pressable style={styles.menuItem} onPress={() => handleNavigate('/(tabs)/explorar')}>
            <Ionicons name="compass-outline" size={20} color="#000000" />
            <ThemedText style={styles.menuText}>Explorar</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#A0A2A8" />
          </Pressable>

          {/* 3. Meus Agendamentos */}
          <Pressable style={styles.menuItem} onPress={() => handleNavigate('/src/screens/MeusAgendamentos')}>
            <Ionicons name="calendar-outline" size={20} color="#000000" />
            <ThemedText style={styles.menuText}>Meus Agendamentos</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#A0A2A8" />
          </Pressable>

          {/* 4. Favoritos */}
          <Pressable style={styles.menuItem} onPress={() => handleNavigate('/src/screens/FavoritosDashboard')}>
            <Ionicons name="heart-outline" size={20} color="#000000" />
            <ThemedText style={styles.menuText}>Favoritos</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#A0A2A8" />
          </Pressable>

          {/* 5. Perfil (Último item - TelaPerfil) */}
          <Pressable style={[styles.menuItem, styles.profileItem]} onPress={() => handleNavigate('/src/screens/TelaPerfil')}>
            <Ionicons name="person-outline" size={20} color="#000000" />
            <ThemedText style={[styles.menuText, styles.profileText]}>Meu Perfil</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#000000" />
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6E7E9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F2',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F0F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#282828',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6A6C72',
    textAlign: 'center',
    marginBottom: 20,
  },
  menuContainer: {
    width: '100%',
    gap: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F0F0F2',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#3A3A3A',
    marginLeft: 12,
  },
  profileItem: {
    backgroundColor: '#F0F0F2',
    borderColor: '#E6E7E9',
    marginTop: 4,
  },
  profileText: {
    fontWeight: '700',
    color: '#000000',
  },
});