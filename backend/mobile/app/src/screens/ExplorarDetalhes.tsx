import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ExplorarDetalhes() {
  const router = useRouter();
  const { id, tipo } = useLocalSearchParams(); // ID do estabelecimento ou serviço

  // Estados de UI e Carregamento
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  // Estados do Agendamento
  const [dias, setDias] = useState<any[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState('');
  
  const [horarios, setHorarios] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');

  // Estados Financeiros
  const [formaPagamento, setFormaPagamento] = useState(''); // 'online_agora' ou 'presencial'
  const [metodoPagamento, setMetodoPagamento] = useState(''); // 'pix', 'cartao', 'boleto', 'local'
  const [parcelas, setParcelas] = useState(1);

  // Dados Mockados do Serviço (Na prática, viria da API verEstabelecimento)
  const servicoInfo = {
    nome: tipo === 'aluguel' ? 'Equipamento Profissional' : 'Corte de Cabelo e Barba',
    valor: 150.00,
    duracao: '60 min'
  };

  useEffect(() => {
    // 1. Gera os próximos 15 dias para o calendário horizontal
    const gerarDias = () => {
      let diasGerados = [];
      let dataAtual = new Date();
      const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

      for (let i = 0; i < 15; i++) {
        diasGerados.push({
          dataIso: dataAtual.toISOString().split('T')[0],
          diaSemana: diasSemana[dataAtual.getDay()],
          diaMes: dataAtual.getDate(),
          mesText: meses[dataAtual.getMonth()]
        });
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      setDias(diasGerados);
      setDataSelecionada(diasGerados[0].dataIso);
    };

    gerarDias();
  }, []);

  useEffect(() => {
    // 2. Busca os horários disponíveis sempre que a data mudar
    if (!dataSelecionada) return;
    
    setCarregando(true);
    setHorarioSelecionado('');
    
    // Simulação da chamada da API: /api/mobile/servicos/{id}/horarios?data=YYYY-MM-DD
    setTimeout(() => {
      setHorarios(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
      setCarregando(false);
    }, 600);
  }, [dataSelecionada]);

  // Função para lidar com a seleção do método de pagamento
  const handleSelecionarMetodo = (metodo: string) => {
    if (metodo === 'local') {
      setFormaPagamento('presencial');
      setMetodoPagamento('local');
    } else {
      setFormaPagamento('online_agora');
      setMetodoPagamento(metodo);
      setParcelas(1); // Reseta parcelas
    }
  };

  // 👉 A LÓGICA DE FINALIZAÇÃO (CONECTADA AOS SEUS CONTROLLERS)
  const handleConfirmar = async () => {
    if (!horarioSelecionado) {
      Alert.alert("Ação Necessária", "Por favor, selecione um horário para o seu agendamento.");
      return;
    }
    if (!metodoPagamento) {
      Alert.alert("Ação Necessária", "Escolha como deseja realizar o pagamento da sua reserva.");
      return;
    }

    setProcessando(true);

    try {
      // ================================================================
      // PASSO 1: CRIA A RESERVA (MobileAgendamentoController)
      // POST /api/mobile/agendar/{estabelecimento_id}
      // payload: { servico_id, data_agendamento, hora_agendamento, forma_pagamento }
      // ================================================================
      
      // Simulando a resposta de sucesso da criação da reserva:
      const agendamentoMockId = 123;

      // ================================================================
      // PASSO 2: PROCESSA O PAGAMENTO (PagamentoMobileController)
      // POST /api/mobile/pagamento/processar
      // payload: { agendamento_id, metodo_pagamento, parcelas }
      // ================================================================
      
      setTimeout(() => {
        setProcessando(false);

        if (formaPagamento === 'presencial') {
          // O backend retornará o PIN. Mostramos a tela de sucesso.
          Alert.alert("Reserva Confirmada!", "Sua vaga está garantida. Realize o pagamento diretamente no balcão.", [
            { text: "Ver Meus Agendamentos", onPress: () => router.push('/agendamentos') }
          ]);
        } else {
          // O backend retornará a URL de pagamento da Asaas (invoice_url).
          // Abrimos o navegador ou WebView para o cliente pagar.
          Alert.alert("Quase lá!", "Você será redirecionado para o ambiente seguro de pagamento.", [
            { 
              text: "Pagar Agora", 
              onPress: () => {
                // Exemplo real: Linking.openURL(respostaAPI.invoice_url);
                router.push('/agendamentos'); // Redireciona pro app após abrir
              }
            }
          ]);
        }
      }, 1500);

    } catch (error) {
      setProcessando(false);
      Alert.alert("Ops!", "Ocorreu um erro ao processar sua solicitação.");
    }
  };

  if (carregando && dias.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C85A17" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* CABEÇALHO DO SERVIÇO */}
        <View style={styles.cardHeader}>
          <Text style={styles.categoriaText}>{tipo === 'aluguel' ? 'Locação' : 'Serviço Presencial'}</Text>
          <Text style={styles.titulo}>{servicoInfo.nome}</Text>
          <View style={styles.headerRow}>
            <Text style={styles.preco}>R$ {servicoInfo.valor.toFixed(2).replace('.', ',')}</Text>
            <View style={styles.badgeDuracao}>
              <Text style={styles.badgeText}>{servicoInfo.duracao}</Text>
            </View>
          </View>
        </View>

        {/* 1. SELEÇÃO DE DATA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Escolha a Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowDates}>
            {dias.map((dia) => {
              const isSelected = dataSelecionada === dia.dataIso;
              return (
                <TouchableOpacity
                  key={dia.dataIso}
                  style={[styles.botaoData, isSelected && styles.botaoDataSelecionado]}
                  onPress={() => setDataSelecionada(dia.dataIso)}
                >
                  <Text style={[styles.textoDiaSemana, isSelected && styles.textoBranco]}>{dia.diaSemana}</Text>
                  <Text style={[styles.textoDiaMes, isSelected && styles.textoBranco]}>{dia.diaMes}</Text>
                  <Text style={[styles.textoMes, isSelected && styles.textoBranco]}>{dia.mesText}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. SELEÇÃO DE HORÁRIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Horários Disponíveis</Text>
          {carregando ? (
            <ActivityIndicator size="small" color="#C85A17" style={{ alignSelf: 'flex-start', marginVertical: 20 }} />
          ) : (
            <View style={styles.gridHorarios}>
              {horarios.length > 0 ? (
                horarios.map((hora) => {
                  const isSelected = horarioSelecionado === hora;
                  return (
                    <TouchableOpacity
                      key={hora}
                      style={[styles.botaoHora, isSelected && styles.botaoHoraSelecionado]}
                      onPress={() => setHorarioSelecionado(hora)}
                    >
                      <Text style={[styles.textoHora, isSelected && styles.textoBranco]}>{hora}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.textoVazio}>Nenhum horário disponível nesta data.</Text>
              )}
            </View>
          )}
        </View>

        {/* 3. OPÇÕES DE PAGAMENTO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Como deseja pagar?</Text>
          
          <TouchableOpacity 
            style={[styles.cardPagamento, metodoPagamento === 'pix' && styles.cardPagamentoSelecionado]}
            onPress={() => handleSelecionarMetodo('pix')}
          >
            <Text style={[styles.tituloPagamento, metodoPagamento === 'pix' && styles.textoPagamentoSelecionado]}>PIX Instantâneo</Text>
            <Text style={styles.descPagamento}>Aprovação imediata e online</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.cardPagamento, metodoPagamento === 'cartao' && styles.cardPagamentoSelecionado]}
            onPress={() => handleSelecionarMetodo('cartao')}
          >
            <Text style={[styles.tituloPagamento, metodoPagamento === 'cartao' && styles.textoPagamentoSelecionado]}>Cartão de Crédito</Text>
            <Text style={styles.descPagamento}>Parcele em até 12x</Text>
            
            {metodoPagamento === 'cartao' && (
              <View style={styles.parcelasContainer}>
                {[1, 2, 3].map((num) => (
                  <TouchableOpacity 
                    key={num} 
                    style={[styles.botaoParcela, parcelas === num && styles.botaoParcelaSelecionado]}
                    onPress={() => setParcelas(num)}
                  >
                    <Text style={[styles.textoParcela, parcelas === num && styles.textoBranco]}>{num}x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.cardPagamento, metodoPagamento === 'local' && styles.cardPagamentoSelecionado]}
            onPress={() => handleSelecionarMetodo('local')}
          >
            <Text style={[styles.tituloPagamento, metodoPagamento === 'local' && styles.textoPagamentoSelecionado]}>Pagar no Local</Text>
            <Text style={styles.descPagamento}>Pague no balcão ao finalizar o serviço</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* RODAPÉ FIXO DE CHECKOUT */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.footerTotalLabel}>Total a pagar</Text>
            <Text style={styles.footerTotalValor}>R$ {servicoInfo.valor.toFixed(2).replace('.', ',')}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.botaoPrincipal, (!horarioSelecionado || !metodoPagamento || processando) && styles.botaoDesabilitado]} 
            onPress={handleConfirmar}
            disabled={!horarioSelecionado || !metodoPagamento || processando}
          >
            {processando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.botaoPrincipalTexto}>
                {formaPagamento === 'presencial' ? 'Confirmar' : 'Ir para o Pagamento'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  
  // Header
  cardHeader: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  categoriaText: { fontSize: 11, color: '#C85A17', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  titulo: { fontSize: 26, fontWeight: '900', color: '#111827', marginBottom: 12, lineHeight: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preco: { fontSize: 24, fontWeight: '900', color: '#111827' },
  badgeDuracao: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },

  // Sections
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 16, letterSpacing: -0.5 },
  
  // Datas Horizontal
  rowDates: { gap: 12, paddingRight: 20 },
  botaoData: { width: 75, height: 95, backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  botaoDataSelecionado: { backgroundColor: '#111827', borderColor: '#111827' },
  textoDiaSemana: { fontSize: 10, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  textoDiaMes: { fontSize: 24, fontWeight: '900', color: '#111827' },
  textoMes: { fontSize: 10, fontWeight: '700', color: '#6B7280', marginTop: 4 },
  textoBranco: { color: '#FFF' },

  // Grid Horários
  gridHorarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  botaoHora: { width: '30%', paddingVertical: 14, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  botaoHoraSelecionado: { backgroundColor: '#111827', borderColor: '#111827' },
  textoHora: { color: '#374151', fontWeight: '800', fontSize: 15 },
  textoVazio: { color: '#9CA3AF', fontStyle: 'italic' },

  // Pagamento
  cardPagamento: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  cardPagamentoSelecionado: { borderColor: '#C85A17', backgroundColor: '#FFF8F5' },
  tituloPagamento: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  textoPagamentoSelecionado: { color: '#C85A17' },
  descPagamento: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  
  // Parcelas
  parcelasContainer: { flexDirection: 'row', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  botaoParcela: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#F3F4F6' },
  botaoParcelaSelecionado: { backgroundColor: '#C85A17' },
  textoParcela: { fontWeight: '800', color: '#374151' },

  // Footer / Checkout Sticky
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 10 : 0 },
  footerTotalLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
  footerTotalValor: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 2 },
  
  botaoPrincipal: { backgroundColor: '#C85A17', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  botaoDesabilitado: { backgroundColor: '#E5E7EB' },
  botaoPrincipalTexto: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});