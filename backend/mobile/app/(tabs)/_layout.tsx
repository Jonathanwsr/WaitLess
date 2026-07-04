import { Tabs } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Esconde o cabeçalho padrão do Expo
        tabBarActiveTintColor: '#2563EB', // Cor azul para o menu ativo
        tabBarInactiveTintColor: '#0F172A', // Cor escura para os menus inativos
        tabBarStyle: {
          height: 110, // O tamanho 110 que funcionou perfeito!
          paddingBottom: 25, // Empurra o texto e os ícones para cima dos botões do sistema
          paddingTop: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0', // Linha sutil separando a barra do app
          elevation: 5, // Sombra suave no Android
          shadowOpacity: 0.1, // Sombra suave no iOS
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* 1. HOME / INÍCIO (Aponta para o arquivo home.tsx) */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={24} color={color} />
          ),
        }}
      />

      {/* 2. DESCUBRA */}
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Descubra',
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={24} color={color} />
          ),
        }}
      />

      {/* 3. CARTEIRA */}
      <Tabs.Screen
        name="carteira"
        options={{
          title: 'Carteira',
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet-outline" size={26} color={color} />
          ),
        }}
      />

      {/* 4. CAIXA DE ENTRADA (COM NOTIFICAÇÃO) */}
      <Tabs.Screen
        name="caixa-entrada"
        options={{
          title: 'Caixa de ent...',
          tabBarBadge: 4, // Bolinha azul com o número "4"
          tabBarBadgeStyle: {
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            fontSize: 10
          },
          tabBarIcon: ({ color }) => (
            <Feather name="mail" size={24} color={color} />
          ),
        }}
      />

      {/* 5. AGENDAMENTOS / RESERVAS */}
      <Tabs.Screen
        name="reservas"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
