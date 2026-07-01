import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Exemplo de integração com os métodos do seu novo Controller Mobile
export default function ExplorarDetalhes() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams(); // 'servico' ou 'aluguel'

  const [carregando, setCarregando] = useState(true);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');

  useEffect(() => {
    // Simulando a chamada do método: obtenerHorariosDisponiveis(Request $request, $id)
    // No seu app real, use: axios.get(`/servicos/${id}/horarios?data=2026-07-01`)
    setTimeout(() => {
      setHorarios(['08:00', '09:00', '10:00', '14:00', '15:00', '16:00']);
      setCarregando(false);
    }, 1000);
  }, [id]);

  const handleConfirmar = async () => {
    if (!horarioSelecionado) {
      Alert.alert("Atenção", "Por favor, selecione um horário antes de continuar.");
      return;
    }

    // Aqui dispararia o método 'remarcarServico' ou 'storeAluguel' via API
    Alert.alert("Sucesso", "Solicitação enviada com sucesso!", [
      { text: "OK", onPress: () => router.push('/src/screens/MeusAgendamentos') }
    ]);
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C85A17" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.categoriaText}>{tipo === 'aluguel' ? 'Locação de Ativo' : 'Serviço Presencial'}</Text>
        <Text style={styles.titulo}>Nome do Procedimento / Item</Text>
        <Text style={styles.preco}>R$ 150,00</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Localização e Atendimento</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Estabelecimento:</Text>
          <Text style={styles.infoValue}>WaitLess Headquarters</Text>
          <Text style={styles.infoLabel}>Endereço:</Text>
          <Text style={styles.infoValue}>Av. Principal, 1000 - Centro</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selecione o Horário Disponível</Text>
        <View style={styles.gridHorarios}>
          {horarios.map((hora) => (
            <TouchableOpacity
              key={hora}
              style={[
                styles.botaoHora,
                horarioSelecionado === hora && styles.botaoHoraSelecionado
              ]}
              onPress={() => setHorarioSelecionado(hora)}
            >
              <Text style={[
                styles.textoHora,
                horarioSelecionado === hora && styles.textoHoraSelecionado
              ]}>{hora}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.botaoPrincipal} onPress={handleConfirmar}>
        <Text style={styles.botaoPrincipalTexto}>Confirmar Agendamento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardHeader: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderLeftWidth: 5, borderLeftColor: '#C85A17', marginBottom: 20, elevation: 2 },
  categoriaText: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginTop: 5 },
  preco: { fontSize: 20, fontWeight: 'bold', color: '#C85A17', marginTop: 10 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 10 },
  infoBox: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { fontSize: 12, color: '#94A3B8', marginTop: 5 },
  infoValue: { fontSize: 14, color: '#334155', fontWeight: '500' },
  gridHorarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  botaoHora: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  botaoHoraSelecionado: { backgroundColor: '#C85A17', borderColor: '#C85A17' },
  textoHora: { color: '#334155', fontWeight: 'bold' },
  textoHoraSelecionado: { color: '#FFF' },
  botaoPrincipal: { backgroundColor: '#C85A17', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  botaoPrincipalTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
