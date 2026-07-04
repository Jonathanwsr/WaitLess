import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PagamentoScreen() {
  const [method, setMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [installments, setInstallments] = useState(1);

  const amount = 120.0; // valor do serviço

  const getMaxInstallments = () => {
    if (amount <= 50) return 3;
    if (amount <= 200) return 6;
    return 12;
  };

  const renderInstallments = () => {
    const max = getMaxInstallments();
    let options = [];

    for (let i = 1; i <= max; i++) {
      options.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.installmentButton,
            installments === i && styles.selectedInstallment,
          ]}
          onPress={() => setInstallments(i)}
        >
          <Text style={styles.installmentText}>
            {i}x de R$ {(amount / i).toFixed(2)}
          </Text>
        </TouchableOpacity>
      );
    }

    return options;
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <Text style={styles.title}>Pagamento</Text>

      {/* VALOR */}
      <View style={styles.card}>
        <Text style={styles.label}>Valor do serviço</Text>
        <Text style={styles.amount}>R$ {amount.toFixed(2)}</Text>
      </View>

      {/* MÉTODOS */}
      <View style={styles.card}>
        <Text style={styles.label}>Forma de pagamento</Text>

        <View style={styles.methods}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              method === 'pix' && styles.activeMethod,
            ]}
            onPress={() => setMethod('pix')}
          >
            <Ionicons name="qr-code" size={20} />
            <Text>PIX</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              method === 'card' && styles.activeMethod,
            ]}
            onPress={() => setMethod('card')}
          >
            <Ionicons name="card" size={20} />
            <Text>Cartão</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              method === 'boleto' && styles.activeMethod,
            ]}
            onPress={() => setMethod('boleto')}
          >
            <Ionicons name="document-text" size={20} />
            <Text>Boleto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CARTÃO */}
      {method === 'card' && (
        <View style={styles.card}>
          <Text style={styles.label}>Dados do cartão</Text>

          <TextInput style={styles.input} placeholder="Número do cartão" />
          <TextInput style={styles.input} placeholder="Nome no cartão" />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="MM/AA" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="CVV" />
          </View>

          <Text style={styles.label}>Parcelas</Text>
          <View style={styles.installmentsContainer}>
            {renderInstallments()}
          </View>
        </View>
      )}

      {/* PIX */}
      {method === 'pix' && (
        <View style={styles.card}>
          <Text style={styles.label}>Pagamento via PIX</Text>
          <Text style={styles.description}>
            Após confirmar, você receberá um QR Code para pagamento.
          </Text>
        </View>
      )}

      {/* BOLETO */}
      {method === 'boleto' && (
        <View style={styles.card}>
          <Text style={styles.label}>Pagamento via Boleto</Text>
          <Text style={styles.description}>
            O boleto será gerado após a confirmação.
          </Text>
        </View>
      )}

      {/* BOTÃO */}
      <TouchableOpacity style={styles.payButton}>
        <Text style={styles.payText}>Confirmar pagamento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  card: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    elevation: 2,
  },

  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },

  amount: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  methods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  methodButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 4,
  },

  activeMethod: {
    borderColor: '#000',
    backgroundColor: '#F3F4F6',
  },

  input: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  installmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  installmentButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    margin: 4,
  },

  selectedInstallment: {
    backgroundColor: '#000',
  },

  installmentText: {
    color: '#000',
  },

  description: {
    color: '#6B7280',
  },

  payButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  payText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
