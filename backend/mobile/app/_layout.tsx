import React from 'react';
import { Platform, View } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ToastHost from '../components/ToastHost';
import AlertaHost from '../components/AlertaHost';
import ErrorBoundary from '../components/ErrorBoundary';
import { instalarFetchSeguro } from '../services/fetchSeguro';
import { mostrarToast } from '../services/toast';

instalarFetchSeguro();

// Em produção, um erro não fatal de JavaScript (ex.: dentro de um callback) vira um aviso em vez de derrubar o app.
if (!__DEV__ && (globalThis as any).ErrorUtils) {
  const ErrorUtils = (globalThis as any).ErrorUtils;
  const padrao = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((erro: unknown, fatal?: boolean) => {
    console.error('Erro global:', erro);
    if (fatal) padrao(erro, fatal);
    else mostrarToast('Algo deu errado. Tente novamente.', 'erro');
  });
}

/**
 * Layout raiz. Reproduz o padrão implícito do expo-router (SafeAreaView no iOS + Slot)
 * e acrescenta o <ToastHost /> (avisos rápidos, ex.: favoritos) e o <AlertaHost /> (janelas de
 * alerta/confirmação no lugar do Alert nativo), disponíveis em qualquer tela.
 */
export default function RootLayout() {
  const conteudo = (
    <View style={{ flex: 1 }}>
      <ErrorBoundary>
        <Slot />
      </ErrorBoundary>
      <ToastHost />
      <AlertaHost />
    </View>
  );

  return Platform.OS === 'android' ? conteudo : <SafeAreaView style={{ flex: 1 }}>{conteudo}</SafeAreaView>;
}
