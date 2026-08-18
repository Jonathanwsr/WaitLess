import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Configuração Base da API
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;

const ufsBrasil = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const cargosOpcoes = ['Atendente', 'Gerente', 'Administrador', 'Barbeiro', 'Mecânico', 'Outro'];

export default function ConfiguracoesMobile() {
  const router = useRouter();
  
  // Pegando o ID e o Nome que vêm do Dashboard
  const { id: estabelecimentoId, nome: estabelecimentoNome } = useLocalSearchParams<{ id: string, nome?: string }>(); 

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('U');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('detalhes');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Estados Base
  const [estabelecimento, setEstabelecimento] = useState<any>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [itensAluguel, setItensAluguel] = useState<any[]>([]);

  // Imagens
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState<string | null>(null);
  const [fotoBannerPreview, setFotoBannerPreview] = useState<string | null>(null);
  const [fotosServico, setFotosServico] = useState<string[]>([]);
  const [fotosItem, setFotosItem] = useState<string[]>([]);

  // ==========================================
  // FORM 1: DETALHES DA LOJA
  // ==========================================
  const [formDetalhes, setFormDetalhes] = useState({
    nome: '', cnpj: '', razao_social: '', site: '', ramo_atuacao: '', 
    telefone: '', cep: '', rua: '', numero: '',
    complemento: '', bairro: '', cidade: '', estado: 'PE',
  });

  // ==========================================
  // FORM 2: EQUIPE
  // ==========================================
  const [formFuncionario, setFormFuncionario] = useState({
    id: null as any, nome: '', telefone: '', cargo: 'Atendente', email: '', password: '',
  });

  // ==========================================
  // FORM 3: SERVIÇOS
  // ==========================================
  const [formServico, setFormServico] = useState({
    id: null as any, nome: '', tipo_servico: 'Geral', descricao: '', valor: '', duracao_minutos: '30',
    funcionario_id: '', dias_disponiveis: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as string[],
    horarios_disponiveis: [] as string[],
  });
  const [novoHorarioServico, setNovoHorarioServico] = useState('');

  // ==========================================
  // FORM 4: LOCAÇÕES
  // ==========================================
  const [formItem, setFormItem] = useState({
    id: null as any, nome: '', categoria: 'casa', quantidade: '1', marca: '', modelo: '', tipo: '',
    valor_diaria: '', valor_semanal: '', valor_mensal: '', valor_caucao: '',
    periodo_faturamento_padrao: 'diaria', permitir_pagamento: 'online',
    sempre_disponivel: true, tipo_disponibilidade: 'todos',
    horario_inicio: '', horario_fim: '', horario_limite_devolucao: '',
    antecedencia_reserva_horas: '0', duracao_minima_horas: '1', duracao_maxima_horas: '', intervalo_entre_reservas_minutos: '0',
    tem_promocao: false, tipo_desconto: 'percentual', valor_desconto: '',
    aceita_pontos: false, maximo_pontos_permitidos: '',
    exige_contrato: false, observacoes_disponibilidade: '',
    cep_retirada: '', rua_retirada: '', bairro_retirada: '', cidade_retirada: '', estado_retirada: ''
  });

  // ==========================================
  // FORM 5: FINANCEIRO
  // ==========================================
  const [formFinanceiro, setFormFinanceiro] = useState({
    nome_razao_social: '', email_financeiro: '', cpf_cnpj: '', banco_codigo: '',
    agencia: '', conta_numero: '', conta_digito: '', token_mercadopago: ''
  });

  const getHeaders = (isMultipart = false) => ({
    Authorization: `Bearer ${authToken}`,
    Accept: 'application/json',
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
  });

  const mostrarMensagem = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => setMensagemSucesso(''), 4000);
  };

  const handleApiResponse = async (res: Response) => {
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : {} };
    } catch (e) {
      return { ok: false, status: res.status, data: { message: 'Erro no servidor.' } };
    }
  };

  const fetchConfiguracoes = async () => {
    if (!estabelecimentoId) {
      Alert.alert('Erro', 'Nenhum estabelecimento foi selecionado para configuração.');
      router.back();
      return;
    }

    try {
      setLoading(true);
      let token = await AsyncStorage.getItem('@waitless_token');
      if (!token) token = await AsyncStorage.getItem('@lokyva_token'); 
      if (!token) { router.replace('/autenticacao/login'); return; }
      setAuthToken(token);

      // Carregar infos do Usuário para o Avatar
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        if (usuario.nome) setUserName(usuario.nome.split(' ')[0]);
        if (usuario.foto_perfil || usuario.foto) setUserPhoto(usuario.foto_perfil || usuario.foto);
      }

      const res = await fetch(`${cleanBaseUrl}/mobile/configuracoes/${estabelecimentoId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      
      const { ok, data } = await handleApiResponse(res);

      if (ok) {
        // Garantindo que pega os dados independente da estrutura da API (data.estabelecimento ou data direto)
        const est = data.estabelecimento || data; 
        
        if (est && est.id) {
          setEstabelecimento(est);
          setFormDetalhes({
            nome: est.nome || '', cnpj: est.cnpj || '', razao_social: est.razao_social || '',
            site: est.site || '', ramo_atuacao: est.ramo_atuacao || '', telefone: est.telefone || '',
            cep: est.cep || '', rua: est.rua || '', numero: est.numero || '', complemento: est.complemento || '',
            bairro: est.bairro || '', cidade: est.cidade || '', estado: est.estado || 'PE',
          });
          setFormFinanceiro({
            nome_razao_social: est.nome_razao_social || '', email_financeiro: est.email_financeiro || '',
            cpf_cnpj: est.cpf_cnpj || '', banco_codigo: est.banco_codigo || '',
            agencia: est.agencia || '', conta_numero: est.conta_numero || '',
            conta_digito: est.conta_digito || '', token_mercadopago: est.token_mercadopago || ''
          });
          setFotoPerfilPreview(est.foto_perfil || null);
          setFotoBannerPreview(est.foto_banner || null);
        }
        
        setFuncionarios(data.funcionarios || []);
        setServicos(data.servicos || []);
        setItensAluguel(data.itens_aluguel || []);
      } else if (data.status === 403) {
        Alert.alert('Acesso Negado', 'Você não tem permissão para editar esta loja.');
        router.back();
      }
    } catch (err) {
      Alert.alert('Erro', 'Verifique sua conexão com a internet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguracoes();
  }, [estabelecimentoId]);

  // Busca de Endereço Automático via CEP
  const buscarEnderecoPorCep = async (cepStr: string, formType: 'detalhes' | 'retirada') => {
    if (!cepStr) return;
    const cepLimpo = cepStr.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (formType === 'detalhes') {
          setFormDetalhes(prev => ({ ...prev, rua: data.logradouro, bairro: data.bairro, cidade: data.localidade, estado: data.uf }));
        } else if (formType === 'retirada') {
          setFormItem(prev => ({ ...prev, rua_retirada: data.logradouro, bairro_retirada: data.bairro, cidade_retirada: data.localidade, estado_retirada: data.uf }));
        }
      }
    } catch (err) {
      console.log('Erro no ViaCEP', err);
    }
  };

  const pickImage = async (tipo: 'perfil' | 'banner') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      if (tipo === 'perfil') setFotoPerfilPreview(res.assets[0].uri);
      if (tipo === 'banner') setFotoBannerPreview(res.assets[0].uri);
    }
  };

  const pickMultipleImages = async (tipo: 'servico' | 'item') => {
    const max = 5;
    const current = tipo === 'servico' ? fotosServico : fotosItem;
    if (current.length >= max) return Alert.alert('Limite', `Máximo ${max} fotos.`);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: max - current.length, quality: 0.8 });
    if (!res.canceled && res.assets) {
      const uris = res.assets.map((a) => a.uri);
      if (tipo === 'servico') setFotosServico((prev) => [...prev, ...uris].slice(0, 5));
      else setFotosItem((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  // =========================================================
  // SUBMITS (SALVANDO DADOS)
  // =========================================================

  const submitDetalhes = async () => {
    if (!estabelecimento?.id) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      Object.entries(formDetalhes).forEach(([k, v]) => formData.append(k, String(v)));
      formData.append('_method', 'PUT');

      if (fotoPerfilPreview && !fotoPerfilPreview.startsWith('http')) {
        formData.append('foto_perfil', { uri: fotoPerfilPreview, name: 'p.jpg', type: 'image/jpeg' } as any);
      }
      if (fotoBannerPreview && !fotoBannerPreview.startsWith('http')) {
        formData.append('foto_banner', { uri: fotoBannerPreview, name: 'b.jpg', type: 'image/jpeg' } as any);
      }
      const res = await fetch(`${cleanBaseUrl}/estabelecimentos/${estabelecimento.id}`, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok } = await handleApiResponse(res);
      if (ok) mostrarMensagem('Perfil da loja atualizado!');
    } catch { Alert.alert('Erro', 'Falha na atualização.'); } finally { setSubmitting(false); }
  };

  const toggleStatus = async () => {
    if (!estabelecimento?.id) return;
    try {
      const res = await fetch(`${cleanBaseUrl}/estabelecimentos/${estabelecimento.id}/toggle-status`, { method: 'PATCH', headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setEstabelecimento((p: any) => (p ? { ...p, ativo: data.ativo } : null));
        mostrarMensagem(data.ativo ? 'Loja Aberta!' : 'Loja Fechada!');
      }
    } catch {}
  };

  const submitFuncionario = async () => {
    const { nome, email, password, cargo } = formFuncionario;
    
    // Corrigido bug da validação (Removendo o .trim() para evitar quebras)
    if (!nome || !email || !password || !cargo) {
      return Alert.alert('Atenção', 'Nome, email, cargo e senha são campos obrigatórios e não podem ficar em branco.');
    }
    
    try {
      setSubmitting(true);
      const res = await fetch(`${cleanBaseUrl}/estabelecimentos/${estabelecimento.id}/funcionarios`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(formFuncionario) });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setFuncionarios(p => [...p, data.funcionario || data]);
        setFormFuncionario({ id: null, nome: '', telefone: '', cargo: 'Atendente', email: '', password: '' });
        mostrarMensagem('Profissional cadastrado e salvo!');
      } else {
        Alert.alert('Erro', data.message || 'Verifique se o email já está em uso na plataforma.');
      }
    } catch { Alert.alert('Erro', 'Falha na comunicação com o servidor.'); } finally { setSubmitting(false); }
  };

  const deleteFuncionario = async (id: any) => {
    try {
      const res = await fetch(`${cleanBaseUrl}/funcionarios/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) { setFuncionarios(p => p.filter(f => f.id !== id)); mostrarMensagem('Profissional removido!'); }
    } catch {}
  };

  const toggleDiaServico = (dia: string) => {
    const atuais = formServico.dias_disponiveis;
    const novos = atuais.includes(dia) ? atuais.filter(d => d !== dia) : [...atuais, dia];
    setFormServico({ ...formServico, dias_disponiveis: novos });
  };
  const addHorarioServico = () => {
    if(novoHorarioServico && !formServico.horarios_disponiveis.includes(novoHorarioServico)) {
      setFormServico({...formServico, horarios_disponiveis: [...formServico.horarios_disponiveis, novoHorarioServico].sort()});
      setNovoHorarioServico('');
    }
  };
  const rmHorarioServico = (h: string) => setFormServico({...formServico, horarios_disponiveis: formServico.horarios_disponiveis.filter(x => x !== h)});

  const submitServico = async () => {
    if (!estabelecimento?.id || !formServico.nome || !formServico.valor) return Alert.alert('Erro', 'Preencha nome e valor do serviço.');
    try {
      setSubmitting(true);
      const formData = new FormData();
      Object.entries(formServico).forEach(([k, v]) => {
        if(k === 'dias_disponiveis' || k === 'horarios_disponiveis') {
          (v as string[]).forEach(item => formData.append(`${k}[]`, item));
        } else if (v !== null) {
          formData.append(k, String(v));
        }
      });
      formData.append('estabelecimentos_ids[]', String(estabelecimento.id));
      fotosServico.forEach((uri, idx) => formData.append('fotos[]', { uri, name: `s_${idx}.jpg`, type: 'image/jpeg' } as any));

      const res = await fetch(`${cleanBaseUrl}/servicos`, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok, data } = await handleApiResponse(res);
      if (ok) { setServicos(p => [...p, data.servico || data]); setFotosServico([]); mostrarMensagem('Serviço salvo no catálogo!'); }
    } catch {} finally { setSubmitting(false); }
  };
  
  const deleteServico = async (id: any) => {
    try { const res = await fetch(`${cleanBaseUrl}/servicos/${id}`, { method: 'DELETE', headers: getHeaders() }); if (res.ok) setServicos(p => p.filter(s => s.id !== id)); } catch {}
  };

  const submitItem = async () => {
    if (!estabelecimento?.id || !formItem.nome) return Alert.alert('Erro', 'Nome é obrigatório.');
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('estabelecimento_id', String(estabelecimento.id));
      Object.entries(formItem).forEach(([k, v]) => {
        if(v !== null && typeof v !== 'object') formData.append(k, String(v));
        if(typeof v === 'boolean') formData.append(k, v ? '1' : '0');
      });
      fotosItem.forEach((uri, idx) => formData.append('fotos[]', { uri, name: `i_${idx}.jpg`, type: 'image/jpeg' } as any));
      const res = await fetch(`${cleanBaseUrl}/itens-aluguel`, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok, data } = await handleApiResponse(res);
      if (ok) { setItensAluguel(p => [...p, data.item || data]); setFotosItem([]); mostrarMensagem('Locação salva no sistema!'); }
    } catch {} finally { setSubmitting(false); }
  };

  const submitFinanceiro = async () => {
    if (!estabelecimento?.id) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${cleanBaseUrl}/providers/store`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ estabelecimento_id: estabelecimento.id, ...formFinanceiro }) });
      if (res.ok) mostrarMensagem('Dados de Pagamento salvos com sucesso!');
    } catch {} finally { setSubmitting(false); }
  };

  const tabsNav = [
    { id: 'detalhes', label: '1. Perfil da Loja', icon: 'business-outline' },
    { id: 'equipe', label: '2. Equipe', icon: 'people-outline' },
    { id: 'servicos', label: '3. Serviços', icon: 'construct-outline' },
    { id: 'reservas_alugueis', label: '4. Locações', icon: 'calendar-outline' },
    { id: 'financeiro', label: '5. Financeiro', icon: 'card-outline' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FF5A00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER SUPERIOR */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#334155" />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            {estabelecimentoNome ? `CONFIGURAÇÕES - ${estabelecimentoNome.toUpperCase()}` : 'CONFIGURAÇÕES'}
          </Text>

          {/* AVATAR DO USUÁRIO NO CANTO DIREITO */}
          <View style={styles.avatarMiniHeader}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarTextHeader}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollView}>
          {tabsNav.map((tab) => (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}>
              <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.id ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabButtonText, activeTab === tab.id && styles.tabButtonTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* TOAST DE FEEDBACK (VERDE) */}
      {!!mensagemSucesso && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>{mensagemSucesso}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.mainContent}>
        
        {/* ======================================================== */}
        {/* ABA 1: PERFIL */}
        {/* ======================================================== */}
        {activeTab === 'detalhes' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <View style={styles.row}>
                <TouchableOpacity style={styles.avatarContainer} onPress={() => pickImage('perfil')}>
                  {fotoPerfilPreview ? <Image source={{ uri: fotoPerfilPreview }} style={styles.avatarImage} /> : <Text style={styles.avatarPlaceholderText}>{estabelecimento?.nome?.charAt(0) || 'L'}</Text>}
                </TouchableOpacity>
                <View style={styles.columnFlex}>
                  <Text style={styles.sectionSubTitle}>Logo do Estabelecimento</Text>
                  <Text style={styles.helperText}>Toque para alterar a foto (Max 2MB).</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View>
                <Text style={styles.label}>Banner da Loja</Text>
                <TouchableOpacity style={styles.bannerContainer} onPress={() => pickImage('banner')}>
                  {fotoBannerPreview ? <Image source={{ uri: fotoBannerPreview }} style={styles.bannerImage} /> : <View style={styles.bannerPlaceholder}><Ionicons name="image-outline" size={32} color="#CBD5E1" /><Text style={styles.bannerPlaceholderText}>INSERIR BANNER</Text></View>}
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}><Text style={styles.label}>Nome do Estabelecimento *</Text><TextInput style={styles.input} value={formDetalhes.nome} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, nome: t })} /></View>
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>CNPJ</Text><TextInput style={styles.input} keyboardType="numeric" value={formDetalhes.cnpj} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, cnpj: t })} /></View>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>Telefone</Text><TextInput style={styles.input} keyboardType="phone-pad" value={formDetalhes.telefone} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, telefone: t })} /></View>
              </View>
              
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Razão Social</Text><TextInput style={styles.input} value={formDetalhes.razao_social} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, razao_social: t })} /></View>
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Site / Link Externo</Text><TextInput style={styles.input} autoCapitalize="none" value={formDetalhes.site} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, site: t })} placeholder="ex: www.sualoja.com.br" /></View>
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Ramo de Atuação</Text><TextInput style={styles.input} value={formDetalhes.ramo_atuacao} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, ramo_atuacao: t })} placeholder="Ex: Barbearia, Quadra..." /></View>
              
              <View style={styles.divider} />
              <Text style={styles.sectionSubTitle}>Endereço (Busca por CEP)</Text>

              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>CEP</Text>
                  <TextInput style={styles.input} value={formDetalhes.cep} keyboardType="numeric" onChangeText={(t) => setFormDetalhes({ ...formDetalhes, cep: t })} onBlur={() => buscarEnderecoPorCep(formDetalhes.cep, 'detalhes')} placeholder="Digite o CEP" />
                </View>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>Número</Text><TextInput style={styles.input} value={formDetalhes.numero} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, numero: t })} /></View>
              </View>

              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Rua / Avenida</Text><TextInput style={styles.input} value={formDetalhes.rua} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, rua: t })} /></View>
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Bairro</Text><TextInput style={styles.input} value={formDetalhes.bairro} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, bairro: t })} /></View>
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>Cidade</Text><TextInput style={styles.input} value={formDetalhes.cidade} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, cidade: t })} /></View>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>Complemento</Text><TextInput style={styles.input} value={formDetalhes.complemento} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, complemento: t })} /></View>
              </View>

              <Text style={styles.labelSmall}>Estado (UF)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                {ufsBrasil.map(uf => (
                  <TouchableOpacity key={uf} onPress={() => setFormDetalhes({...formDetalhes, estado: uf})} style={[styles.chip, formDetalhes.estado === uf && styles.chipActive]}>
                    <Text style={[styles.chipText, formDetalhes.estado === uf && styles.chipTextActive]}>{uf}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity style={styles.primaryButton} onPress={submitDetalhes} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>SALVAR ALTERAÇÕES</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>Status do Estabelecimento</Text>
              <TouchableOpacity style={styles.dangerButton} onPress={toggleStatus}>
                <Text style={styles.dangerButtonText}>{estabelecimento?.ativo ? 'Desativar Loja (Pausar Agendamentos)' : 'Ativar Loja'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 2: EQUIPE */}
        {/* ======================================================== */}
        {activeTab === 'equipe' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Novo Profissional</Text>
              
              <TextInput style={styles.input} placeholder="Nome Completo *" value={formFuncionario.nome} onChangeText={(t) => setFormFuncionario({ ...formFuncionario, nome: t })} />
              
              <Text style={styles.labelSmall}>Cargo / Papel no Sistema *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 6}}>
                {cargosOpcoes.map(cargo => (
                  <TouchableOpacity key={cargo} onPress={() => setFormFuncionario({...formFuncionario, cargo})} style={[styles.chip, formFuncionario.cargo === cargo && styles.chipActive]}>
                    <Text style={[styles.chipText, formFuncionario.cargo === cargo && styles.chipTextActive]}>{cargo}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput style={styles.input} placeholder="Email de Acesso *" autoCapitalize="none" keyboardType="email-address" value={formFuncionario.email} onChangeText={(t) => setFormFuncionario({ ...formFuncionario, email: t })} />
              <TextInput style={styles.input} placeholder="Senha Inicial *" secureTextEntry value={formFuncionario.password} onChangeText={(t) => setFormFuncionario({ ...formFuncionario, password: t })} />
              
              <TouchableOpacity style={styles.accentButton} onPress={submitFuncionario} disabled={submitting}>
                <Text style={styles.accentButtonText}>+ Cadastrar Membro</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {funcionarios.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: '#64748B' }}>Nenhum membro na equipe.</Text>}
              {funcionarios.map((func) => (
                <View key={func.id} style={styles.listItem}>
                  <View><Text style={styles.listItemTitle}>{func.nome}</Text><Text style={styles.listItemSub}>{func.cargo} • {func.email}</Text></View>
                  <TouchableOpacity onPress={() => deleteFuncionario(func.id)} style={styles.iconButton}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 3: SERVIÇOS */}
        {/* ======================================================== */}
        {activeTab === 'servicos' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Adicionar Novo Serviço</Text>
              <TextInput style={styles.input} placeholder="Nome do Serviço (Ex: Corte de Cabelo)" value={formServico.nome} onChangeText={(t) => setFormServico({ ...formServico, nome: t })} />
              <TextInput style={styles.input} placeholder="Descrição (Opcional)" value={formServico.descricao} onChangeText={(t) => setFormServico({ ...formServico, descricao: t })} />
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Valor (R$)" keyboardType="numeric" value={formServico.valor} onChangeText={(t) => setFormServico({ ...formServico, valor: t })} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Duração (min)" keyboardType="numeric" value={formServico.duracao_minutos} onChangeText={(t) => setFormServico({ ...formServico, duracao_minutos: t })} /></View>
              </View>

              <Text style={styles.labelSmall}>Dias da Semana Disponíveis</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                {['domingo','segunda','terca','quarta','quinta','sexta','sabado'].map(dia => {
                  const isSel = formServico.dias_disponiveis.includes(dia);
                  return (
                    <TouchableOpacity key={dia} onPress={() => toggleDiaServico(dia)} style={[styles.chip, isSel && styles.chipActive]}>
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{dia.substring(0,3).toUpperCase()}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <Text style={styles.labelSmall}>Horários de Atendimento</Text>
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Ex: 09:00" value={novoHorarioServico} onChangeText={setNovoHorarioServico} /></View>
                <TouchableOpacity style={[styles.accentButton, {paddingHorizontal: 16, paddingVertical: 0, justifyContent:'center'}]} onPress={addHorarioServico}><Text style={styles.accentButtonText}>Adicionar</Text></TouchableOpacity>
              </View>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
                {formServico.horarios_disponiveis.map(h => (
                  <View key={h} style={styles.badge}><Text style={styles.badgeText}>{h}</Text><TouchableOpacity onPress={()=>rmHorarioServico(h)}><Ionicons name="close" size={14} color="#FFF"/></TouchableOpacity></View>
                ))}
              </View>

              <View style={styles.imageUploadSection}>
                <Text style={styles.labelSmall}>Fotos (Até 5 fotos)</Text>
                <ScrollView horizontal style={styles.imageList}>
                  {fotosServico.length < 5 && <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('servico')}><Ionicons name="camera-outline" size={24} color="#64748B" /></TouchableOpacity>}
                  {fotosServico.map((uri, idx) => (<View key={idx} style={styles.imagePreviewContainer}><Image source={{ uri }} style={styles.imagePreview} /></View>))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitServico} disabled={submitting}>
                <Text style={styles.accentButtonText}>Salvar Serviço</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {servicos.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: '#64748B' }}>Nenhum serviço cadastrado.</Text>}
              {servicos.map((s) => (
                <View key={s.id} style={styles.listItem}>
                  <View><Text style={styles.listItemTitle}>{s.nome}</Text><Text style={styles.listItemSub}>R$ {s.valor} • {s.duracao_minutos} min</Text></View>
                  <TouchableOpacity onPress={() => deleteServico(s.id)} style={styles.iconButton}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 4: LOCAÇÕES */}
        {/* ======================================================== */}
        {activeTab === 'reservas_alugueis' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cadastrar Item de Locação</Text>
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <InputLabel text="Categoria *" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginTop: 4}}>
                    {[ {id: 'casa', label:'Espaço/Imóvel'}, {id:'carro', label:'Veículo'}, {id:'equipamento', label:'Equipamento'} ].map(cat => (
                      <TouchableOpacity key={cat.id} onPress={() => setFormItem({...formItem, categoria: cat.id})} style={[styles.chip, formItem.categoria === cat.id && styles.chipActive]}>
                        <Text style={[styles.chipText, formItem.categoria === cat.id && styles.chipTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <TextInput style={styles.input} placeholder="Título da Locação *" value={formItem.nome} onChangeText={(t) => setFormItem({ ...formItem, nome: t })} />
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Qtd Estoque" keyboardType="numeric" value={formItem.quantidade} onChangeText={(t) => setFormItem({ ...formItem, quantidade: t })} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Marca (Opcional)" value={formItem.marca} onChangeText={(t) => setFormItem({ ...formItem, marca: t })} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Modelo" value={formItem.modelo} onChangeText={(t) => setFormItem({ ...formItem, modelo: t })} /></View>
              </View>

              <View style={styles.divider} />
              
              <Text style={styles.sectionSubTitle}>Matriz Financeira (R$)</Text>
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Diária *" keyboardType="numeric" value={formItem.valor_diaria} onChangeText={(t) => setFormItem({ ...formItem, valor_diaria: t })} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Semanal" keyboardType="numeric" value={formItem.valor_semanal} onChangeText={(t) => setFormItem({ ...formItem, valor_semanal: t })} /></View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionSubTitle}>Regras da Plataforma</Text>
              
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Sempre Disponível</Text><Text style={styles.labelSmall}>Ignora as datas específicas.</Text></View>
                <Switch value={formItem.sempre_disponivel} onValueChange={(v) => setFormItem({...formItem, sempre_disponivel: v})} trackColor={{ false: "#CBD5E1", true: "#FF5A00" }} />
              </View>
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Promoção Ativa</Text><Text style={styles.labelSmall}>Ofereça desconto.</Text></View>
                <Switch value={formItem.tem_promocao} onValueChange={(v) => setFormItem({...formItem, tem_promocao: v})} trackColor={{ false: "#CBD5E1", true: "#FF5A00" }} />
              </View>

              <View style={styles.divider} />

              <View style={styles.imageUploadSection}>
                <Text style={styles.labelSmall}>Fotos da Locação (Max 5)</Text>
                <ScrollView horizontal style={styles.imageList}>
                  {fotosItem.length < 5 && <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('item')}><Ionicons name="camera-outline" size={24} color="#64748B" /></TouchableOpacity>}
                  {fotosItem.map((uri, idx) => (<View key={idx} style={styles.imagePreviewContainer}><Image source={{ uri }} style={styles.imagePreview} /></View>))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitItem} disabled={submitting}>
                <Text style={styles.accentButtonText}>Finalizar Cadastro da Locação</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 5: FINANCEIRO */}
        {/* ======================================================== */}
        {activeTab === 'financeiro' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dados do Provedor de Pagamento</Text>
              <TextInput style={styles.input} placeholder="Nome / Razão Social *" value={formFinanceiro.nome_razao_social} onChangeText={t => setFormFinanceiro({...formFinanceiro, nome_razao_social: t})} />
              <TextInput style={styles.input} placeholder="E-mail Financeiro *" autoCapitalize="none" keyboardType="email-address" value={formFinanceiro.email_financeiro} onChangeText={t => setFormFinanceiro({...formFinanceiro, email_financeiro: t})} />
              <TextInput style={styles.input} placeholder="CPF / CNPJ *" keyboardType="numeric" value={formFinanceiro.cpf_cnpj} onChangeText={t => setFormFinanceiro({...formFinanceiro, cpf_cnpj: t})} />
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Cód Banco *" keyboardType="numeric" value={formFinanceiro.banco_codigo} onChangeText={t => setFormFinanceiro({...formFinanceiro, banco_codigo: t})} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Agência *" keyboardType="numeric" value={formFinanceiro.agencia} onChangeText={t => setFormFinanceiro({...formFinanceiro, agencia: t})} /></View>
              </View>
              <View style={styles.rowGrid}>
                <View style={[styles.gridCol, {flex: 2}]}><TextInput style={styles.input} placeholder="Conta Número *" keyboardType="numeric" value={formFinanceiro.conta_numero} onChangeText={t => setFormFinanceiro({...formFinanceiro, conta_numero: t})} /></View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Dígito *" keyboardType="numeric" value={formFinanceiro.conta_digito} onChangeText={t => setFormFinanceiro({...formFinanceiro, conta_digito: t})} /></View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionSubTitle}>Integração de Pagamento Online</Text>
              <TextInput style={styles.input} placeholder="Token/Chave do Gateway (Opcional)" value={formFinanceiro.token_mercadopago} onChangeText={t => setFormFinanceiro({...formFinanceiro, token_mercadopago: t})} />
              
              <TouchableOpacity style={styles.primaryButton} onPress={submitFinanceiro} disabled={submitting}>
                <Text style={styles.primaryButtonText}>SALVAR DADOS BANCÁRIOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MENU INFERIOR */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.replace('/ProprietarioDashboard')}>
          <Feather name="grid" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="list" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="scissors" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconActiveBg}>
             <Feather name="settings" size={20} color="#FF5A00" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/src/screens/PerfilAnfitriao')}>
          <Feather name="user" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const InputLabel = ({ text }: { text: string }) => <Text style={styles.labelSmall}>{text}</Text>;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backButtonText: { fontSize: 12, fontWeight: '600', color: '#334155', marginLeft: 4 },
  headerTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  
  // Bolinha do Avatar no Canto Superior Direito
  avatarMiniHeader: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarTextHeader: { color: '#FF5A00', fontWeight: 'bold', fontSize: 14 },

  tabsScrollView: { flexDirection: 'row' },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  tabButtonActive: { backgroundColor: '#FF5A00', borderColor: '#FF5A00' },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: '#475569', marginLeft: 6 },
  tabButtonTextActive: { color: '#FFFFFF' },
  
  toast: { position: 'absolute', top: 100, left: 20, right: 20, zIndex: 999, backgroundColor: '#10B981', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  toastText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  
  mainContent: { padding: 16 },
  tabContainer: { gap: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  columnFlex: { flex: 1 },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholderText: { fontSize: 24, fontWeight: 'bold', color: '#64748B' },
  bannerContainer: { height: 100, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden', marginTop: 6 },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerPlaceholderText: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8' },
  sectionSubTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  helperText: { fontSize: 12, color: '#64748B' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  inputGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  labelSmall: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1E293B', backgroundColor: '#FFF' },
  rowGrid: { flexDirection: 'row', gap: 12 },
  gridCol: { flex: 1 },
  
  primaryButton: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  accentButton: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  accentButtonText: { color: '#FFF', fontWeight: 'bold' },
  
  dangerCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 16, gap: 8 },
  dangerTitle: { fontSize: 14, fontWeight: 'bold', color: '#991B1B' },
  dangerButton: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  dangerButtonText: { color: '#FFF', fontWeight: 'bold' },
  listCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  listItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  listItemSub: { fontSize: 12, color: '#64748B' },
  iconButton: { padding: 6 },
  imageUploadSection: { gap: 8 },
  imageList: { flexDirection: 'row' },
  addImageBtn: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  imagePreviewContainer: { width: 60, height: 60, borderRadius: 8, marginRight: 8, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#FFEDD5', borderColor: '#FF5A00' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
  chipTextActive: { color: '#EA580C' },
  
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF5A00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  
  bottomMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: 50 },
  menuIconActiveBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center' },
});