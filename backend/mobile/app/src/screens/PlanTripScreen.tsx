import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

interface Gasto {
  id: string;
  categoria: string;
  subtext: string;
  valor: number;
  icone: keyof typeof Ionicons.glyphMap;
  corBg: string;
  corIcon: string;
}

interface PlanTripScreenProps {
  navigation?: {
    goBack: () => void;
  };
}

export default function PlanTripScreen({ navigation }: PlanTripScreenProps) {
  const [nomeViagem, setNomeViagem] = useState<string>('Férias em Porto de Galinhas');
  const [destino, setDestino] = useState<string>('Porto de Galinhas, PE');
  const [dataIda, setDataIda] = useState<string>('20/06/2025');
  const [dataVolta, setDataVolta] = useState<string>('27/06/2025');
  const [orcamentoPrevisto, setOrcamentoPrevisto] = useState<string>('3500.00');
  const [descricao, setDescricao] = useState<string>(
    'Viagem em família para aproveitar as praias de Porto de Galinhas. Hospedagem com café da manhã incluso e passeios de buggy e piscinas naturais.'
  );

  const [gastos, setGastos] = useState<Gasto[]>([
    { id: '1', categoria: 'Hospedagem', subtext: '20 a 27 jun, 2025', valor: 980.0, icone: 'bed', corBg: '#FFF0E6', corIcon: '#FF6B00' },
    { id: '2', categoria: 'Transporte', subtext: '18/06/2025', valor: 420.0, icone: 'bus-sharp', corBg: '#FEF9C3', corIcon: '#CA8A04' },
    { id: '3', categoria: 'Alimentação', subtext: '20 a 27 jun, 2025', valor: 350.0, icone: 'restaurant', corBg: '#DCFCE7', corIcon: '#16A34A' },
    { id: '4', categoria: 'Passeios', subtext: '22/06/2025', valor: 280.0, icone: 'camera', corBg: '#F3E8FF', corIcon: '#9333EA' },
    { id: '5', categoria: 'Compras', subtext: '25/06/2025', valor: 120.0, icone: 'bag-handle', corBg: '#E0F2FE', corIcon: '#0284C7' },
  ]);

  const totalGasto: number = gastos.reduce((acc, item) => acc + item.valor, 0);
  const orcamentoNum: number = parseFloat(orcamentoPrevisto) || 0;
  const restante: number = orcamentoNum - totalGasto;
  const porcentagemGasta: number = orcamentoNum > 0 ? Math.min(Math.round((totalGasto / orcamentoNum) * 100), 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planejar Viagem</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerSubtitle}>
          Organize sua viagem, controle seus gastos e aproveite cada momento.
        </Text>

        {/* Card 1: Dados da Viagem */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleWithIcon}>
              <Feather name="briefcase" size={18} color="#FF5500" />
              <Text style={styles.cardTitle}>Dados da viagem</Text>
            </View>
            <TouchableOpacity style={styles.btnEditar}>
              <Feather name="edit-2" size={14} color="#FF5500" />
              <Text style={styles.btnEditarText}>Editar</Text>
            </TouchableOpacity>
          </View>

          {/* Nome da Viagem */}
          <Text style={styles.label}>Nome da viagem</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={nomeViagem}
              onChangeText={setNomeViagem}
              placeholder="Ex: Férias de Verão"
            />
            <Feather name="edit-2" size={16} color="#9CA3AF" />
          </View>

          {/* Destino */}
          <Text style={styles.label}>Destino</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={18} color="#4B5563" style={styles.inputLeftIcon} />
            <TextInput style={[styles.input, { paddingLeft: 30 }]} value={destino} onChangeText={setDestino} />
            <Feather name="chevron-right" size={18} color="#9CA3AF" />
          </View>

          {/* Datas */}
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Data de ida</Text>
              <View style={styles.inputContainer}>
                <Feather name="calendar" size={16} color="#4B5563" style={styles.inputLeftIcon} />
                <TextInput style={[styles.input, { paddingLeft: 28 }]} value={dataIda} onChangeText={setDataIda} />
              </View>
            </View>
            <View style={{ width: 12 }} />
            <View style={styles.flex1}>
              <Text style={styles.label}>Data de volta</Text>
              <View style={styles.inputContainer}>
                <Feather name="calendar" size={16} color="#4B5563" style={styles.inputLeftIcon} />
                <TextInput style={[styles.input, { paddingLeft: 28 }]} value={dataVolta} onChangeText={setDataVolta} />
              </View>
            </View>
          </View>

          {/* Orçamento Previsto */}
          <Text style={styles.label}>Orçamento previsto</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="wallet-outline" size={18} color="#4B5563" style={styles.inputLeftIcon} />
            <TextInput
              style={[styles.input, { paddingLeft: 30, fontWeight: 'bold' }]}
              value={`R$ ${orcamentoPrevisto}`}
              onChangeText={(text: string) => setOrcamentoPrevisto(text.replace('R$ ', ''))}
              keyboardType="numeric"
            />
            <Feather name="edit-2" size={16} color="#9CA3AF" />
          </View>
        </View>

        {/* Card 2: Resumo do Orçamento */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitleBold}>Resumo do orçamento</Text>
            <TouchableOpacity style={styles.rowCenter}>
              <Text style={styles.btnLinkText}>Ver detalhes</Text>
              <Feather name="chevron-right" size={16} color="#FF5500" />
            </TouchableOpacity>
          </View>

          <View style={styles.rowSpaceBetween}>
            <View>
              <Text style={styles.metricLabel}>Total gasto</Text>
              <Text style={styles.metricGasto}>R$ {totalGasto.toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.metricSub}>{porcentagemGasta}% do orçamento</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metricLabel}>Restante</Text>
              <Text style={styles.metricRestante}>R$ {restante.toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>

          {/* Barra de Progresso */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${porcentagemGasta}%` }]} />
          </View>
          <Text style={styles.progressPercentageText}>{porcentagemGasta}%</Text>
        </View>

        {/* Card 3: Gastos da Viagem */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleWithIcon}>
              <Feather name="folder" size={18} color="#FF5500" />
              <Text style={styles.cardTitle}>Gastos da viagem</Text>
            </View>
            <TouchableOpacity style={styles.btnOrangeSmall}>
              <Text style={styles.btnOrangeSmallText}>+ Adicionar gasto</Text>
            </TouchableOpacity>
          </View>

          {gastos.map((item: Gasto) => (
            <View key={item.id} style={styles.gastoItem}>
              <View style={styles.rowCenter}>
                <View style={[styles.gastoIconContainer, { backgroundColor: item.corBg }]}>
                  <Ionicons name={item.icone} size={18} color={item.corIcon} />
                </View>
                <View style={styles.gastoInfo}>
                  <Text style={styles.gastoCategoria}>{item.categoria}</Text>
                  <Text style={styles.gastoData}>{item.subtext}</Text>
                </View>
              </View>

              <View style={styles.rowCenter}>
                <Text style={styles.gastoValor}>
                  R$ {item.valor.toFixed(2).replace('.', ',')}
                </Text>
                <TouchableOpacity style={styles.actionIconBtn}>
                  <Feather name="edit-2" size={14} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="trash-2" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Card 4: Descrição / Roteiro */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleWithIcon}>
              <Feather name="align-left" size={18} color="#FF5500" />
              <Text style={styles.cardTitle}>Descrição / Roteiro</Text>
            </View>
            <TouchableOpacity style={styles.btnEditar}>
              <Feather name="edit-2" size={14} color="#FF5500" />
              <Text style={styles.btnEditarText}>Editar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.descricaoText}>{descricao}</Text>
        </View>

        {/* Botão Salvar */}
        <TouchableOpacity style={styles.btnSalvar}>
          <Ionicons name="save-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnSalvarText}>Salvar planejamento</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  iconBtn: {
    padding: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  cardTitleBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  btnEditar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnEditarText: {
    fontSize: 13,
    color: '#FF5500',
    fontWeight: '600',
    marginLeft: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    position: 'relative',
  },
  inputLeftIcon: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  btnLinkText: {
    fontSize: 13,
    color: '#FF5500',
    fontWeight: '600',
    marginRight: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  metricGasto: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF5500',
    marginVertical: 2,
  },
  metricRestante: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF5500',
    borderRadius: 4,
  },
  progressPercentageText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  btnOrangeSmall: {
    backgroundColor: '#FF5500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnOrangeSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gastoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  gastoInfo: {
    justifyContent: 'center',
  },
  gastoCategoria: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  gastoData: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  gastoValor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 8,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  descricaoText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  btnSalvar: {
    backgroundColor: '#FF5500',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnSalvarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});