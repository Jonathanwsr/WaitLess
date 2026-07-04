import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Carteira() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sua Carteira</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#111827' }
});
