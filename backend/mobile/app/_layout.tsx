import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import type * as NotificationsTipos from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import ToastHost from '../components/ToastHost';
import AlertaHost from '../components/AlertaHost';
import ErrorBoundary from '../components/ErrorBoundary';
import { instalarFetchSeguro } from '../services/fetchSeguro';
import { mostrarToast } from '../services/toast';
import { apiMobile } from '../services/entregasApi';

instalarFetchSeguro();

// No Expo Go (SDK 53+) o simples import de 'expo-notifications' lança erro e derruba o layout
// inteiro (o app nem abre). Carrega sob demanda e só fora do Expo Go; no development build e
// no app publicado o toque na notificação funciona normalmente. Mesmo cuidado do login.
function carregarNotifications(): typeof NotificationsTipos | null {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

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
  const router = useRouter();

  // Toque numa notificação: abre a tela indicada em data.rota (ex.: oferta de viagem → detalhes do item)
  // e, se for uma oferta da venda cruzada, registra o clique.
  useEffect(() => {
    const Notifications = carregarNotifications();
    if (!Notifications) return;

    const abrir = (resposta: NotificationsTipos.NotificationResponse | null) => {
      const dados = (resposta?.notification.request.content.data || {}) as Record<string, unknown>;
      const { rota, oferta_id: ofertaId, flash_deal_id: flashDealId, ...params } = dados;
      if (ofertaId) apiMobile(`/ofertas-viagem/${ofertaId}/clique`, { method: 'POST' }).catch(() => {});
      if (flashDealId) apiMobile(`/flash-deals/${flashDealId}/clique`, { method: 'POST' }).catch(() => {});
      if (typeof rota === 'string' && rota.startsWith('/')) {
        const texto = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
        setTimeout(() => router.push({ pathname: rota as never, params: texto }), 300);
      }
    };

    Notifications.getLastNotificationResponseAsync().then(abrir).catch(() => {});
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, [router]);

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
