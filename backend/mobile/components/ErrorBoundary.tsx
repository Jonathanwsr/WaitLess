import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Estado { temErro: boolean }

/**
 * Rede de segurança do app: um erro inesperado ao desenhar qualquer tela não derruba mais
 * o app inteiro — o usuário vê esta tela e pode tentar de novo.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, Estado> {
  state: Estado = { temErro: false };

  static getDerivedStateFromError(): Estado {
    return { temErro: true };
  }

  componentDidCatch(erro: unknown, info: unknown) {
    console.error('Erro não tratado na tela:', erro, info);
  }

  render() {
    if (!this.state.temErro) return this.props.children;

    return (
      <View style={s.tela}>
        <View style={s.icone}><Ionicons name="warning-outline" size={38} color="#FF7A00" /></View>
        <Text style={s.titulo}>Ops, algo deu errado</Text>
        <Text style={s.texto}>Tivemos um problema ao abrir esta tela. Seus dados estão seguros. Toque abaixo para tentar de novo.</Text>
        <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={() => this.setState({ temErro: false })}>
          <Text style={s.btnTxt}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', padding: 32 },
  icone: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  titulo: { fontSize: 22, fontWeight: '800', color: '#282828', letterSpacing: -0.4 },
  texto: { fontSize: 14, color: '#6A6C72', textAlign: 'center', lineHeight: 21, marginTop: 8 },
  btn: { marginTop: 24, height: 52, paddingHorizontal: 32, borderRadius: 26, backgroundColor: '#FF7A00', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
