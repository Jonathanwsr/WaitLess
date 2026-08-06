import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function CriarEstabelecimento() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Estados dos campos da tabela
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Substitua pelo token salvo no AsyncStorage ou Contexto
  const USER_TOKEN = 'seu-token-aqui'; 
  const API_URL = 'https://sua-api.com/api/mobile/proprietario/estabelecimentos';

  const handleSalvar = async () => {
    if (!nome) {
      Alert.alert('Erro', 'O nome do estabelecimento é obrigatório.');
      return;
    }

    setLoading(true);

    // Como pode ter foto, precisamos usar FormData
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('cnpj', cnpj);
    formData.append('telefone', telefone);
    formData.append('cep', cep);
    formData.append('rua', rua);
    formData.append('numero', numero);
    formData.append('bairro', bairro);
    formData.append('cidade', cidade);
    formData.append('estado', estado);
    
    // Se for usar expo-image-picker futuramente:
    // formData.append('foto_perfil', { uri: imageUri, name: 'foto.jpg', type: 'image/jpeg' } as any);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          // Não coloque 'Content-Type': 'multipart/form-data', o fetch define sozinho quando enviamos FormData
        },
        body: formData,
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Sucesso!', 'Estabelecimento cadastrado com sucesso!');
        router.back(); // Volta para o Dashboard
      } else {
        Alert.alert('Atenção', json.error || 'Erro ao cadastrar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Novo Estabelecimento</Text>
      
      <Text style={styles.label}>Nome do Estabelecimento *</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Barbearia do João" />

      <Text style={styles.label}>CNPJ (Opcional)</Text>
      <TextInput style={styles.input} value={cnpj} onChangeText={setCnpj} placeholder="Apenas números" keyboardType="numeric" />

      <Text style={styles.label}>Telefone</Text>
      <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} placeholder="Apenas números" keyboardType="phone-pad" />

      <Text style={styles.subtitulo}>Endereço</Text>
      
      <Text style={styles.label}>CEP</Text>
      <TextInput style={styles.input} value={cep} onChangeText={setCep} placeholder="Ex: 00000000" keyboardType="numeric" />

      <Text style={styles.label}>Rua e Número</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 2, marginRight: 10 }]} value={rua} onChangeText={setRua} placeholder="Rua/Avenida" />
        <TextInput style={[styles.input, { flex: 1 }]} value={numero} onChangeText={setNumero} placeholder="Nº" keyboardType="numeric" />
      </View>

      <Text style={styles.label}>Bairro e Cidade</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} value={bairro} onChangeText={setBairro} placeholder="Bairro" />
        <TextInput style={[styles.input, { flex: 1 }]} value={cidade} onChangeText={setCidade} placeholder="Cidade" />
      </View>

      <Text style={styles.label}>Estado (UF)</Text>
      <TextInput style={styles.input} value={estado} onChangeText={setEstado} placeholder="Ex: SP, RJ" maxLength={2} autoCapitalize="characters" />

      <TouchableOpacity style={styles.botao} onPress={handleSalvar} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.botaoTexto}>Salvar Estabelecimento</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { padding: 20, paddingBottom: 50 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  subtitulo: { fontSize: 18, fontWeight: 'bold', color: '#555', marginTop: 10, marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 5 },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  botao: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  botaoTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});