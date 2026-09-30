// --- CORREÇÃO DO DOMEXCEPTION PARA O HERMES ---
if (typeof globalThis.DOMException === 'undefined') {
  (globalThis as any).DOMException = Error;
}
// ----------------------------------------------
import type { ColorValue } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { obterPapel, ehCliente, rotaInicialDoPapel } from '../../services/papel';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconeAba = React.ComponentProps<typeof Ionicons>['name'];

// Ícone contornado quando inativo e preenchido quando ativo (padrão dos apps
// de mercado); a cor ativa é a tinta escura, sem laranja de fundo.
const aba = (ativo: IconeAba, inativo: IconeAba) => ({ color, focused }: { color: ColorValue; focused: boolean }) => (
  <Ionicons name={focused ? ativo : inativo} size={24} color={color} />
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [papel, setPapel] = useState<string | null>(null);

  useEffect(() => {
    obterPapel().then(setPapel);
  }, []);

  // As abas são a área do CLIENTE. Sócio/gerente, equipe e admin que caírem
  // aqui (ex.: pós-cadastro) são mandados pra própria área.
  if (papel === null) return null;
  if (!ehCliente(papel)) return <Redirect href={rotaInicialDoPapel(papel) as never} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF7A00',
        tabBarInactiveTintColor: '#8E8E99',
        tabBarStyle: {
          height: 60 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEEF2',
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: aba('home', 'home-outline') }} />
      <Tabs.Screen name="explorar" options={{ title: 'Descubra', tabBarIcon: aba('compass', 'compass-outline') }} />
      <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: aba('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="caixa-entrada" options={{ title: 'Mensagens', tabBarIcon: aba('chatbubble', 'chatbubble-outline') }} />
      <Tabs.Screen name="reservas" options={{ title: 'Reservas', tabBarIcon: aba('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: aba('menu', 'menu-outline') }} />
    </Tabs>
  );
}
