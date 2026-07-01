import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Image } from 'react-native';

export default function TelaExplorar() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        {/* Barra de Pesquisa */}
        <View style={styles.searchRow}>
          <View style={styles.avatarMini}><Text>JR</Text></View>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produtos..."
            placeholderTextColor="#888"
          />
          <Text style={styles.iconMock}>🔔</Text>
        </View>

        {/* Endereço */}
        <Text style={styles.addressText}>📍 Rua Professora Eunice de Vasconcelos Xavier 100 ❯</Text>

        {/* Menu de Categorias */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesMenu}>
          {['Tudo', 'Moda', 'Beleza', 'Celulares', 'Veículos', 'Lar'].map((cat, i) => (
            <Text key={i} style={styles.categoryItem}>{cat}</Text>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.bodyContainer}>
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>COLECIONÁVEIS DA COPA</Text>
          <TouchableOpacity style={styles.bannerBtn}><Text style={styles.bannerBtnText}>CONHEÇA</Text></TouchableOpacity>
        </View>

        {/* Ícones de Atalho */}
        <View style={styles.shortcutsGrid}>
          {['Ofertaço', 'Cupons', 'Afiliados', 'Lojas oficiais'].map((item, i) => (
            <View key={i} style={styles.shortcutItem}>
              <View style={styles.shortcutIcon} />
              <Text style={styles.shortcutText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Seção de Ofertas Relâmpago */}
        <View style={styles.offersSection}>
          <View style={styles.flashHeader}>
            <Text style={styles.flashTitle}>OFERTAS RELÂMPAGO</Text>
          </View>

          <View style={styles.productsGrid}>
            {/* Produto 1 */}
            <View style={styles.productCard}>
              <View style={styles.productImagePlaceholder} />
              <Text style={styles.productOldPrice}>R$ 4.499</Text>
              <Text style={styles.productPrice}>R$ 2.826</Text>
              <Text style={styles.productDiscount}>37% OFF</Text>
            </View>

            {/* Produto 2 */}
            <View style={styles.productCard}>
              <View style={styles.productImagePlaceholder} />
              <Text style={styles.productName}>Panela De Pressão 3 Litros</Text>
              <Text style={styles.productPrice}>R$ 64,90</Text>
              <Text style={styles.productDiscount}>20% OFF</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#C85A17' }, // Cor de telha no fundo da SafeArea
  headerContainer: { backgroundColor: '#C85A17', padding: 15, paddingBottom: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatarMini: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  searchInput: { flex: 1, height: 40, backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 15, marginRight: 10 },
  iconMock: { fontSize: 20 },
  addressText: { color: '#FFF', fontSize: 13, marginBottom: 15, fontWeight: '500' },
  categoriesMenu: { flexDirection: 'row', marginBottom: 15 },
  categoryItem: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginRight: 20 },
  bodyContainer: { flex: 1, backgroundColor: '#F5F5F5' }, // Fundo cinza claro para o resto do app
  banner: { backgroundColor: '#A00', margin: 15, height: 120, borderRadius: 10, padding: 15, justifyContent: 'center' },
  bannerText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', fontStyle: 'italic', marginBottom: 10 },
  bannerBtn: { backgroundColor: '#FFF', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  bannerBtnText: { color: '#A00', fontWeight: 'bold', fontSize: 12 },
  shortcutsGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: '#FFF', marginBottom: 15 },
  shortcutItem: { alignItems: 'center' },
  shortcutIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0E0E0', marginBottom: 5 },
  shortcutText: { fontSize: 12, color: '#333' },
  offersSection: { padding: 15 },
  flashHeader: { backgroundColor: '#FFD700', padding: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  flashTitle: { fontWeight: 'bold', fontSize: 16, fontStyle: 'italic' },
  productsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  productCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 10, padding: 10, elevation: 2 },
  productImagePlaceholder: { height: 100, backgroundColor: '#EEE', borderRadius: 5, marginBottom: 10 },
  productOldPrice: { fontSize: 12, textDecorationLine: 'line-through', color: '#999' },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  productDiscount: { color: '#C85A17', fontWeight: 'bold', fontSize: 12, marginTop: 3 },
  productName: { fontSize: 12, color: '#555', marginBottom: 5 }
});

