import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';

// Mock de dados simulando o retorno do método index() e indexAlugueis()
const dadosFake = [
  { id: '1', titulo: 'Corte de Cabelo Premium', local: 'Barbearia WaitLess', data: '12/10/2026', hora: '14:30', status: 'pendente', pagamento: 'Pendente presencial', tipo: 'servico' },
  { id: '2', titulo: 'Locação Carro Executivo', local: 'RentAtivos S.A.', data: '15/10/2026', hora: '09:00', status: 'ativo', pagamento: 'Pago Online', tipo: 'aluguel' },
  { id: '3', titulo: 'Limpeza de Pele', local: 'Estética Express', data: '01/06/2026', hora: '10:00', status: 'finalizado', pagamento: 'Pago presencial', tipo: 'servico' },
];

export default function MeusAgendamentos() {
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('ativos');
  const [lista, setLista] = useState(dadosFake);

  // Filtra de acordo com a aba selecionada de forma moderna
  const dadosFiltrados = lista.filter(item =>
    abaAtiva === 'ativos'
      ? ['pendente', 'ativo', 'confirmado', 'em_atendimento'].includes(item.status)
      : ['finalizado', 'cancelado'].includes(item.status)
  );

  // Integração visual com o método destroyAluguel ou updateStatus para 'cancelado'
  const handleCancelar = (id: string) => {
    Alert.alert(
      "Cancelar Agendamento",
      "Tem certeza que deseja cancelar esta reserva?",
      [
        { text: "Voltar", style: "cancel" },
        { text: "Confirmar Cancelamento", style: "destructive", onPress: () => {
            setLista(prev => prev.map(item => item.id === id ? { ...item, status: 'cancelado' } : item));
          }
        }
      ]
    );
  };

  const renderCard = ({ item }: { item: typeof dadosFake[0] }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitulo}>{item.titulo}</Text>
        <View style={[styles.badge, { backgroundColor: item.status === 'finalizado' ? '#DEF7EC' : item.status === 'cancelado' ? '#FDE8E8' : '#FEF08A' }]}>
          <Text style={[styles.badgeText, { color: item.status === 'finalizado' ? '#03543F' : item.status === 'cancelado' ? '#9B1C1C' : '#713F12' }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.cardSub}>{item.local}</Text>

      <View style={styles.divisor} />

      <View style={styles.detalhesLinha}>
        <Text style={styles.detalheText}>📅 {item.data} às {item.hora}</Text>
        <Text style={styles.detalheText}>💳 {item.pagamento}</Text>
      </View>

      {/* Só exibe botão de cancelar se estiver na aba de Ativos */}
      {abaAtiva === 'ativos' && (
        <TouchableOpacity style={styles.botaoCancelar} onPress={() => handleCancelar(item.id)}>
          <Text style={styles.botaoCancelarTexto}>Cancelar Reserva</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Subdivisão Moderna (Tabs) */}
      <View style={styles.containerAbas}>
        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'ativos' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('ativos')}
        >
          <Text style={[styles.abaTexto, abaAtiva === 'ativos' && styles.abaTextoAtivo]}>Em Aberto</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'historico' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('historico')}
        >
          <Text style={[styles.abaTexto, abaAtiva === 'historico' && styles.abaTextoAtivo]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={dadosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum agendamento encontrado nesta seção.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 20 },
  containerAbas: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 20 },
  aba: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  abaAtiva: { backgroundColor: '#C85A17' }, // Laranja Telha em Destaque
  abaTexto: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  abaTextoAtivo: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitulo: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', flex: 1, marginRight: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  divisor: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  detalhesLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  detalheText: { fontSize: 12, color: '#334155', fontWeight: '500' },
  botaoCancelar: { marginTop: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FDE8E8', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  botaoCancelarTexto: { color: '#DC2626', fontSize: 13, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 14 }
});
