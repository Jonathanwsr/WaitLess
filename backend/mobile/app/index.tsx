import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TelaEntrada() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Como o fundo agora é claro, usamos ícones escuros na barra de status */}
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Hero Image no topo, sem overlay pesado */}
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000&auto=format&fit=crop' }}
        style={styles.heroImage}
      />

      {/* Container principal com bordas arredondadas subindo sobre a imagem */}
      <View style={styles.contentContainer}>

        {/* SEÇÃO SUPERIOR: Logo e Textos */}
        <View style={styles.header}>
          <Text style={styles.logoIcon}>W</Text>
          <View>
            <Text style={styles.title}>Bem-vindo ao Waitless</Text>
            <Text style={styles.subtitle}>Reserve mais. Espere menos.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Como você deseja acessar?</Text>

        {/* Cards de Seleção Modernos */}
        <View style={styles.cardsRow}>
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <FontAwesome5 name="user-alt" size={24} color="#b24b2b" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Cliente</Text>
            <Text style={styles.cardSubtitle}>Reservar e aproveitar serviços</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <FontAwesome5 name="briefcase" size={24} color="#b24b2b" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Prestador</Text>
            <Text style={styles.cardSubtitle}>Oferecer serviços e gerir filas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        {/* SEÇÃO INFERIOR: Botões de Ação */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.push('/autenticacao/login')}
          >
            <Text style={styles.primaryButtonText}>Entrar na minha conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => router.push('/autenticacao/cadastro')}
          >
            <Text style={styles.secondaryButtonText}>Criar nova conta</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  heroImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
  },
  contentContainer: {
    flex: 1,
    marginTop: 280, // Faz o container branco "subir" e sobrepor a imagem
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    // Sombra para dar destaque sobre a imagem
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 56,
    fontWeight: '900',
    color: '#b24b2b',
    letterSpacing: -3,
    marginRight: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#222',
  },
  subtitle: {
    fontSize: 15,
    color: '#717171',
    marginTop: 4,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#717171',
    lineHeight: 16,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  actionContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#b24b2b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#222',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
});
