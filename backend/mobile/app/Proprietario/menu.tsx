import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Rotulo, LinhaMenu, api } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { alertar } from '../../services/alertar';
import { irParaLoginSemVoltar } from '../../services/sessao';

interface Grupo {
  titulo: string;
  itens: { icone: string; titulo: string; descricao: string; rota: string; badge?: number; premium?: boolean }[];
}

export default function MenuSocio() {
  const router = useRouter();

  // Precisa de um local para abrir telas que são "por local" (fila, equipe, ajustes...).
  const { dados } = useCarga<{ estabelecimentos: { id: number; nome: string }[]; premium?: boolean }>(() => api('/proprietario/dashboard'));
  const locais = dados?.estabelecimentos || [];

  const porLocal = (montarRota: (id: number) => string) => () => {
    if (locais.length === 1) {
      router.push(montarRota(locais[0].id) as never);
    } else if (locais.length === 0) {
      alertar('Nenhum local', 'Cadastre seu primeiro local para usar este recurso.');
    } else {
      router.push('/Proprietario/MeusEstabelecimentos' as never);
    }
  };

  const ir = (rota: string) => () => router.push(rota as never);

  const grupos: Grupo[] = [
    {
      titulo: 'Operação',
      itens: [
        { icone: 'list-outline', titulo: 'Fila de atendimento', descricao: 'Acompanhe quem está na fila agora', rota: 'local:/src/funcionario/Painel-funcioanario?origem=socio&estabelecimento_id=' },
        { icone: 'calendar-outline', titulo: 'Agenda e produção da equipe', descricao: 'Reservas do dia por profissional', rota: 'local:/src/funcionario/AgendaEquipe?estabelecimento_id=' },
        { icone: 'navigate-outline', titulo: 'Rastreamento ao vivo', descricao: 'Clientes a caminho dos seus locais', rota: '/Proprietario/MapaRastreamento', premium: true },
        { icone: 'megaphone-outline', titulo: 'Divulgar meu local', descricao: 'Link e QR Code para trazer clientes', rota: '/Proprietario/divulgar' },
        { icone: 'storefront-outline', titulo: 'Minha vitrine', descricao: 'Veja seu local como os clientes veem', rota: '/Proprietario/vitrine' },
        { icone: 'key-outline', titulo: 'Locações avulsas', descricao: 'Itens que você aluga diretamente', rota: '/Proprietario/LocacoesAvulsas' },
      ],
    },
    {
      titulo: 'Gestão',
      itens: [
        { icone: 'storefront-outline', titulo: 'Meus locais', descricao: 'Estabelecimentos e status', rota: '/Proprietario/MeusEstabelecimentos' },
        { icone: 'people-outline', titulo: 'Equipe', descricao: 'Funcionários e permissões', rota: 'local:/Proprietario/FuncionariosScreen?id=' },
        { icone: 'options-outline', titulo: 'Serviços e catálogo', descricao: 'Serviços, itens e preços', rota: 'local:/Proprietario/ConfiguracoesMobile?id=' },
        { icone: 'document-text-outline', titulo: 'Contratos', descricao: 'Modelos e contratos das reservas', rota: '/Proprietario/contratos', premium: true },
        { icone: 'add-circle-outline', titulo: 'Novo estabelecimento', descricao: 'Cadastrar outro local', rota: '/Proprietario/CriarEstabelecimento' },
      ],
    },
    {
      titulo: 'Carteira',
      itens: [
        { icone: 'wallet-outline', titulo: 'Carteira', descricao: 'Saldo, próximo repasse, taxas e estornos', rota: '/Proprietario/financeiro' },
        { icone: 'business-outline', titulo: 'Contas e saque', descricao: 'Contas de destino e repasse antecipado', rota: '/Proprietario/carteira-contas' },
        { icone: 'return-up-back-outline', titulo: 'Estornos', descricao: 'Solicitações e contestações', rota: '/Proprietario/estornos' },
        { icone: 'help-circle-outline', titulo: 'Como funcionam os pagamentos', descricao: 'Taxas, repasse e quem processa', rota: '/src/screens/ComoFuncionamPagamentos?perfil=dono' },
      ],
    },
    {
      titulo: 'Relacionamento',
      itens: [
        { icone: 'star-outline', titulo: 'Avaliações', descricao: 'Veja e responda seus clientes', rota: '/Proprietario/avaliacoes' },
        { icone: 'person-outline', titulo: 'Clientes', descricao: 'Histórico de quem já atendeu', rota: '/Proprietario/clientes' },
        { icone: 'chatbubbles-outline', titulo: 'Mensagens', descricao: 'Conversas com clientes', rota: '/mensagens' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { icone: 'ribbon-outline', titulo: 'Minha assinatura', descricao: 'Plano e cobrança', rota: '/assinatura' },
        { icone: 'person-circle-outline', titulo: 'Meu perfil', descricao: 'Dados pessoais e senha', rota: '/Proprietario/perfil' },
        { icone: 'school-outline', titulo: 'Tutoriais', descricao: 'Como criar local, serviço e reserva', rota: '/Proprietario/tutorial' },
        { icone: 'help-buoy-outline', titulo: 'Suporte', descricao: 'Fale com a equipe Lokyva', rota: '/src/screens/TelaSuporte' },
      ],
    },
  ];

  const sair = () => {
    alertar('Sair da conta', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['@waitless_token', '@lokyva_token']);
          await SecureStore.deleteItemAsync('userData');
          irParaLoginSemVoltar(router);
        },
      },
    ]);
  };

  return (
    <OwnerScreen titulo="Menu" subtitulo="Tudo o que você gerencia" semVoltar aba="menu">
      {grupos.map((g) => (
        <View key={g.titulo}>
          <Rotulo>{g.titulo}</Rotulo>
          <Card style={{ paddingVertical: 2 }}>
            {g.itens.map((it, i) => (
              <LinhaMenu
                key={it.titulo}
                icone={it.icone}
                titulo={it.titulo}
                descricao={it.descricao}
                ultimo={i === g.itens.length - 1}
                bloqueado={!!it.premium && dados?.premium === false}
                aoPressionar={
                  it.rota.startsWith('local:')
                    ? porLocal((id) => `${it.rota.slice(6)}${id}`)
                    : ir(it.rota)
                }
              />
            ))}
          </Card>
        </View>
      ))}

      <TouchableOpacity style={s.sair} onPress={sair} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={O.danger} />
        <Text style={s.sairTxt}>Sair da conta</Text>
      </TouchableOpacity>
    </OwnerScreen>
  );
}

const s = StyleSheet.create({
  sair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: O.dangerBg, marginTop: 6 },
  sairTxt: { color: O.danger, fontWeight: '700', fontSize: 14 },
});
