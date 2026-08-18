import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, ScrollView, 
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useRouter } from 'expo-router';

export default function CriarEstabelecimento() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Estados dos campos
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [ramoAtuacao, setRamoAtuacao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [site, setSite] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');

  // Estados de Endereço
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
  const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
  const API_URL = `${cleanBaseUrl}/estabelecimentos`; 
  const USER_TOKEN = 'SEU_TOKEN_AQUI'; 

  const handleCepChange = async (textoCep: string) => {
    const cepLimpo = textoCep.replace(/\D/g, '');
    setCep(cepLimpo);

    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setRua(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setEstado(data.uf || '');
        } else {
          Alert.alert('Atenção', 'CEP não encontrado.');
        }
      } catch (error) {
        console.log('Erro ao buscar CEP', error);
      }
    }
  };

  const handleSalvar = async () => {
    if (!nome || !cnpj || !numero) {
      Alert.alert('Erro', 'Nome, CNPJ e Número do endereço são campos obrigatórios.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('cnpj', cnpj);
    formData.append('razao_social', razaoSocial);
    formData.append('ramo_atuacao', ramoAtuacao);
    formData.append('telefone', telefone);
    formData.append('site', site);
    formData.append('foto_perfil', fotoPerfil);
    formData.append('cep', cep);
    formData.append('rua', rua);
    formData.append('numero', numero);
    formData.append('complemento', complemento);
    formData.append('bairro', bairro);
    formData.append('cidade', cidade);
    formData.append('estado', estado);
    formData.append('ativo', '1');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
        },
        body: formData as any,
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Sucesso!', 'Estabelecimento cadastrado com sucesso!');
        router.back();
      } else {
        Alert.alert('Atenção', json.error || json.message || 'Erro ao cadastrar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>Novo Estabelecimento</Text>
        <Text style={styles.descricao}>Preencha os dados da sua empresa abaixo.</Text>
        
        {/* DADOS PRINCIPAIS */}
        <View style={styles.card}>
          <Text style={styles.subtitulo}>Dados Principais</Text>

          <Text style={styles.label}>Nome do Estabelecimento *</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Barbearia do João" />

          <Text style={styles.label}>CNPJ *</Text>
          <TextInput style={styles.input} value={cnpj} onChangeText={setCnpj} placeholder="Apenas números" keyboardType="numeric" maxLength={14} />

          <Text style={styles.label}>Razão Social</Text>
          <TextInput style={styles.input} value={razaoSocial} onChangeText={setRazaoSocial} placeholder="Nome jurídico da empresa" />

          <Text style={styles.label}>Ramo de Atuação</Text>
          <TextInput style={styles.input} value={ramoAtuacao} onChangeText={setRamoAtuacao} placeholder="Ex: Salão de Beleza, Restaurante" />

          <Text style={styles.label}>Foto de Perfil (URL da Imagem) *</Text>
          <TextInput style={styles.input} value={fotoPerfil} onChangeText={setFotoPerfil} placeholder="https://link-da-imagem.com/foto.png" autoCapitalize="none" />
        </View>

        {/* CONTATO */}
        <View style={styles.card}>
          <Text style={styles.subtitulo}>Contato</Text>

          <Text style={styles.label}>Telefone</Text>
          <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} placeholder="Apenas números" keyboardType="phone-pad" />

          <Text style={styles.label}>Site (Opcional)</Text>
          <TextInput style={styles.input} value={site} onChangeText={setSite} placeholder="Ex: www.meusite.com.br" autoCapitalize="none" />
        </View>

        {/* ENDEREÇO */}
        <View style={styles.card}>
          <Text style={styles.subtitulo}>Endereço</Text>
          
          <Text style={styles.label}>CEP</Text>
          <TextInput style={styles.input} value={cep} onChangeText={handleCepChange} placeholder="Digite para buscar" keyboardType="numeric" maxLength={8} />

          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.label}>Rua / Avenida</Text>
              <TextInput style={styles.input} value={rua} onChangeText={setRua} placeholder="Ex: Rua das Flores" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Número *</Text>
              <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="Nº" keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>Complemento</Text>
          <TextInput style={styles.input} value={complemento} onChangeText={setComplemento} placeholder="Sala, Apto, Bloco (Opcional)" />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Bairro</Text>
              <TextInput style={styles.input} value={bairro} onChangeText={setBairro} placeholder="Bairro" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cidade</Text>
              <TextInput style={styles.input} value={cidade} onChangeText={setCidade} placeholder="Cidade" />
            </View>
          </View>

          <Text style={styles.label}>Estado (UF)</Text>
          <TextInput 
            style={styles.input} 
            value={estado} 
            onChangeText={setEstado} 
            placeholder="Ex: SP, RJ" 
            maxLength={2} 
            autoCapitalize="characters" 
          />
        </View>

        <TouchableOpacity style={styles.botao} onPress={handleSalvar} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.botaoTexto}>Salvar Estabelecimento</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 50 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginTop: 10 },
  descricao: { fontSize: 14, color: '#666', marginBottom: 20 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  subtitulo: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  botao: {
    backgroundColor: '#0056D2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0056D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: 'bold' }
});