import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../../constants/AppColors';
import { alertar } from '../../services/alertar';

export default function CriarEstabelecimento() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [ramoAtuacao, setRamoAtuacao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [site, setSite] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [fotoBanner, setFotoBanner] = useState<string | null>(null);

  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
  // O endpoint real de criação vive em /v1/mobile/estabelecimentos (fora do
  // grupo "mobile" comum) — usar direto "<base>/estabelecimentos" batia num
  // 404/405, porque só existe GET nesse caminho (a rota de criação é outra).
  const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
  const API_URL = `${cleanBaseUrl}/v1/mobile/estabelecimentos`;

  const getToken = async () => {
    return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
  };

  // keyboardType="numeric" só troca o teclado exibido — não bloqueia colar
  // texto ou digitar por teclado físico/externo. Filtrar aqui garante que só
  // dígitos cheguem no back-end nesses campos.
  const handleCnpjChange = (texto: string) => setCnpj(texto.replace(/\D/g, '').slice(0, 14));
  const handleTelefoneChange = (texto: string) => setTelefone(texto.replace(/\D/g, '').slice(0, 15));

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
          alertar('Atenção', 'CEP não encontrado.');
        }
      } catch (error) {
        console.log('Erro ao buscar CEP', error);
      }
    }
  };

  const escolherFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alertar('Permissão necessária', 'Precisamos de acesso às fotos para continuar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setFotoPerfil(res.assets[0].uri);
    }
  };

  // Banner: usa o cortador nativo (allowsEditing + aspect) pra deixar o dono
  // escolher exatamente qual parte da imagem vai aparecer, na mesma proporção
  // 16:9 usada como capa do estabelecimento no app do cliente.
  const escolherBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alertar('Permissão necessária', 'Precisamos de acesso às fotos para continuar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setFotoBanner(res.assets[0].uri);
    }
  };

  const handleSalvar = async () => {
    if (!nome || !cnpj || !numero) {
      alertar('Erro', 'Nome, CNPJ e Número do endereço são campos obrigatórios.');
      return;
    }
    if (!fotoBanner) {
      alertar('Erro', 'A imagem de banner é obrigatória — ela é a primeira coisa que o cliente vê na sua loja.');
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
    if (fotoPerfil) {
      formData.append('foto_perfil', { uri: fotoPerfil, name: 'foto_perfil.jpg', type: 'image/jpeg' } as any);
    }
    if (fotoBanner) {
      formData.append('foto_banner', { uri: fotoBanner, name: 'foto_banner.jpg', type: 'image/jpeg' } as any);
    }
    formData.append('cep', cep);
    formData.append('rua', rua);
    formData.append('numero', numero);
    formData.append('complemento', complemento);
    formData.append('bairro', bairro);
    formData.append('cidade', cidade);
    formData.append('estado', estado);
    formData.append('ativo', '1');

    try {
      const token = await getToken();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData as any,
      });

      const json = await response.json();

      if (response.ok) {
        alertar('Sucesso!', 'Estabelecimento cadastrado com sucesso!');
        router.back();
      } else {
        alertar('Atenção', json.error || json.message || 'Erro ao cadastrar.');
      }
    } catch (error) {
      alertar('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Estabelecimento</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.descricao}>Preencha os dados da sua empresa abaixo.</Text>

          {/* BANNER + FOTO DE PERFIL (mesmo visual de capa+avatar usado no perfil da loja) */}
          <View style={styles.capaWrapper}>
            <TouchableOpacity style={styles.bannerBox} onPress={escolherBanner} activeOpacity={0.85}>
              {fotoBanner ? (
                <Image source={{ uri: fotoBanner }} style={styles.bannerPreview} />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Feather name="image" size={22} color={AppColors.textFaint} />
                  <Text style={styles.bannerPlaceholderText}>Adicionar banner da loja *</Text>
                </View>
              )}
              <View style={styles.bannerEditBadge}>
                <Feather name={fotoBanner ? 'edit-2' : 'plus'} size={13} color={AppColors.white} />
                <Text style={styles.bannerEditBadgeText}>{fotoBanner ? 'Trocar / recortar' : 'Escolher imagem'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fotoBox} onPress={escolherFoto}>
              {fotoPerfil ? (
                <Image source={{ uri: fotoPerfil }} style={styles.fotoPreview} />
              ) : (
                <View style={styles.fotoPlaceholder}>
                  <Feather name="camera" size={22} color={AppColors.textFaint} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bannerDicaBox}>
            <Feather name="info" size={13} color={'#282828'} />
            <Text style={styles.bannerDicaTexto}>
              Resolução recomendada: <Text style={{ fontWeight: '800' }}>1600 x 900px</Text> (proporção 16:9). Ao
              escolher a imagem, você pode cortar e reposicionar antes de confirmar.
            </Text>
          </View>

          {/* DADOS PRINCIPAIS */}
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Dados Principais</Text>

            <Text style={styles.label}>Nome do Estabelecimento *</Text>
            <View style={styles.inputWrap}>
              <Feather name="home" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Barbearia do João" placeholderTextColor={AppColors.textFaint} />
            </View>

            <Text style={styles.label}>CNPJ *</Text>
            <View style={styles.inputWrap}>
              <Feather name="file-text" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={cnpj} onChangeText={handleCnpjChange} placeholder="Apenas números" placeholderTextColor={AppColors.textFaint} keyboardType="numeric" maxLength={14} />
            </View>

            <Text style={styles.label}>Razão Social</Text>
            <View style={styles.inputWrap}>
              <Feather name="briefcase" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={razaoSocial} onChangeText={setRazaoSocial} placeholder="Nome jurídico da empresa" placeholderTextColor={AppColors.textFaint} />
            </View>

            <Text style={styles.label}>Ramo de Atuação</Text>
            <View style={styles.inputWrap}>
              <Feather name="tag" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={ramoAtuacao} onChangeText={setRamoAtuacao} placeholder="Ex: Salão de Beleza, Restaurante" placeholderTextColor={AppColors.textFaint} />
            </View>
          </View>

          {/* CONTATO */}
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Contato</Text>

            <Text style={styles.label}>Telefone</Text>
            <View style={styles.inputWrap}>
              <Feather name="phone" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={telefone} onChangeText={handleTelefoneChange} placeholder="Apenas números" placeholderTextColor={AppColors.textFaint} keyboardType="phone-pad" />
            </View>

            <Text style={styles.label}>Site (Opcional)</Text>
            <View style={styles.inputWrap}>
              <Feather name="globe" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={site} onChangeText={setSite} placeholder="Ex: www.meusite.com.br" placeholderTextColor={AppColors.textFaint} autoCapitalize="none" />
            </View>
          </View>

          {/* ENDEREÇO */}
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Endereço</Text>

            <Text style={styles.label}>CEP</Text>
            <View style={styles.inputWrap}>
              <Feather name="map-pin" size={18} color={AppColors.textFaint} style={styles.inputIcon} />
              <TextInput style={styles.input} value={cep} onChangeText={handleCepChange} placeholder="Digite para buscar" placeholderTextColor={AppColors.textFaint} keyboardType="numeric" maxLength={8} />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 10 }}>
                <Text style={styles.label}>Rua / Avenida</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={rua} onChangeText={setRua} placeholder="Ex: Rua das Flores" placeholderTextColor={AppColors.textFaint} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Número *</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="Nº" placeholderTextColor={AppColors.textFaint} keyboardType="numeric" />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Complemento</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={complemento} onChangeText={setComplemento} placeholder="Sala, Apto, Bloco (Opcional)" placeholderTextColor={AppColors.textFaint} />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Bairro</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={bairro} onChangeText={setBairro} placeholder="Bairro" placeholderTextColor={AppColors.textFaint} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cidade</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.input} value={cidade} onChangeText={setCidade} placeholder="Cidade" placeholderTextColor={AppColors.textFaint} />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Estado (UF)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={estado}
                onChangeText={setEstado}
                placeholder="Ex: SP, RJ"
                placeholderTextColor={AppColors.textFaint}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.botao} onPress={handleSalvar} disabled={loading}>
            {loading ? <ActivityIndicator color={AppColors.white} /> : <Text style={styles.botaoTexto}>Salvar Estabelecimento</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: AppColors.white,
    borderBottomWidth: 1, borderBottomColor: AppColors.borderLight,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: AppColors.borderLight, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: AppColors.text },
  content: { padding: 20, paddingBottom: 50 },
  descricao: { fontSize: 14, color: AppColors.textMuted, marginBottom: 20 },

  capaWrapper: { marginBottom: 16 },
  bannerBox: { width: '100%', aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden', backgroundColor: AppColors.white, position: 'relative' },
  bannerPreview: { width: '100%', height: '100%' },
  bannerPlaceholder: {
    flex: 1, borderWidth: 1.5, borderColor: AppColors.border, borderStyle: 'dashed',
    borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  bannerPlaceholderText: { fontSize: 13, fontWeight: '700', color: AppColors.textFaint },
  bannerEditBadge: {
    position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(17,24,39,0.75)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 100,
  },
  bannerEditBadgeText: { color: AppColors.white, fontSize: 11, fontWeight: '700' },

  fotoBox: { alignSelf: 'center', marginTop: -36 },
  fotoPreview: { width: 72, height: 72, borderRadius: 18, borderWidth: 3, borderColor: AppColors.white },
  fotoPlaceholder: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: AppColors.white,
    borderWidth: 3, borderColor: AppColors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },

  bannerDicaBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0F0F2',
    borderRadius: 14, padding: 12, marginBottom: 24,
  },
  bannerDicaTexto: { flex: 1, fontSize: 12, color: AppColors.text, lineHeight: 17 },

  card: {
    backgroundColor: AppColors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  subtitulo: { fontSize: 15, fontWeight: '800', color: AppColors.text, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: AppColors.borderLight, paddingBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: AppColors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: AppColors.text,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  botao: {
    backgroundColor: '#12A150',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#282828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  botaoTexto: { color: AppColors.white, fontSize: 16, fontWeight: '800' },
});
