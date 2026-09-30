import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
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
import { alertar } from '../../services/alertar';

// Configuração Base da API
// EXPO_PUBLIC_API_URL já termina em "/mobile" — as rotas de gestão de
// estabelecimento (criar/editar loja, equipe, serviços, itens de aluguel)
// vivem todas sob "/api/v1/mobile", um prefixo à parte do "/api/mobile"
// comum. Usar só "cleanBaseUrl" direto (como este arquivo fazia antes)
// batia em rotas inexistentes em quase toda ação de salvar desta tela.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const baseSemMobile = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const cleanBaseUrl = `${baseSemMobile}/mobile`;
const v1MobileUrl = `${baseSemMobile}/v1/mobile`;

const ufsBrasil = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const cargosOpcoes = ['Atendente', 'Gerente', 'Administrador', 'Barbeiro', 'Mecânico', 'Outro'];

export default function ConfiguracoesMobile() {
  const router = useRouter();
  
  // Pegando o ID e o Nome que vêm do Dashboard
  const { id: estabelecimentoId, nome: estabelecimentoNome, aba: abaInicial } = useLocalSearchParams<{ id: string, nome?: string, aba?: string }>(); 

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('U');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState(['detalhes', 'equipe', 'servicos', 'reservas_alugueis', 'financeiro'].includes(String(abaInicial)) ? String(abaInicial) : 'detalhes');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Estados Base
  const [estabelecimento, setEstabelecimento] = useState<any>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [itensAluguel, setItensAluguel] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

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
  // Categoria é obrigatória e vem do servidor (mesma lista dos filtros do Explorar do cliente).
  const [categoriasServicos, setCategoriasServicos] = useState<{ valor: string; icone: string; cor: string }[]>([]);
  const [editandoServicoId, setEditandoServicoId] = useState<number | null>(null);
  const [formServico, setFormServico] = useState({
    id: null as any, nome: '', tipo_servico: '', descricao: '', valor: '', gratuito: false, duracao_minutos: '30', vagas_por_horario: '1',
    funcionario_id: '', dias_disponiveis: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as string[],
    horarios_disponiveis: [] as string[],
    tipo_pagamento: 'hibrido',
    somente_premium: false, tem_promocao: false, tipo_desconto: 'percentual', valor_desconto: '',
    aceita_pontos: false, maximo_pontos_permitidos: '',
    produtos_vinculados: [] as number[],
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
    cep_retirada: '', rua_retirada: '', bairro_retirada: '', cidade_retirada: '', estado_retirada: '',
    somente_premium: false,
    produtos_vinculados: [] as number[],
  });

  // ==========================================
  // FORM 5: FINANCEIRO
  // ==========================================
  // A conta de recebimento (Asaas) é cadastrada uma vez só pelo usuário, na
  // RegisterProviderScreen (tela dedicada, com todos os campos que o
  // gateway exige). Aqui só mostramos o status dela e deixamos configurar a
  // chave PIX reserva específica deste estabelecimento.
  const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);
  const [financeiroCarregado, setFinanceiroCarregado] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{
    has_profile: boolean;
    provider: { name: string; email: string; pix_key_type: string; pix_key: string; asaas_status: string | null } | null;
    contas_pagamento: { estabelecimento_id: number; chave_pix: string | null }[];
  } | null>(null);
  const [chavePixReserva, setChavePixReserva] = useState('');

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
      alertar('Erro', 'Nenhum estabelecimento foi selecionado para configuração.');
      (router.canGoBack() ? router.back() : router.replace('/Proprietario/dashboard' as never));
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

      const res = await fetch(`${cleanBaseUrl}/configuracoes/${estabelecimentoId}`, {
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
          setFotoPerfilPreview(est.foto_perfil || null);
          setFotoBannerPreview(est.foto_banner || null);
        }
        
        setFuncionarios(data.funcionarios || []);
        setServicos(data.servicos || []);
        setItensAluguel(data.itens_aluguel || []);
        setProdutos(data.produtos || []);
      } else if (res.status === 403) {
        alertar('Acesso Negado', 'Você não tem permissão para editar esta loja.');
        (router.canGoBack() ? router.back() : router.replace('/Proprietario/dashboard' as never));
      } else {
        alertar('Erro', data?.message || 'Não foi possível carregar os dados desta loja.');
        (router.canGoBack() ? router.back() : router.replace('/Proprietario/dashboard' as never));
      }
    } catch (err) {
      alertar('Erro', 'Verifique sua conexão com a internet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguracoes();
  }, [estabelecimentoId]);

  useEffect(() => {
    if (!authToken) return;
    (async () => {
      try {
        const res = await fetch(`${v1MobileUrl}/categorias-servicos`, { headers: getHeaders() });
        const { ok, data } = await handleApiResponse(res);
        if (ok && Array.isArray(data)) setCategoriasServicos(data);
      } catch {
        // sem categorias carregadas, o campo fica vazio e o usuário tenta de novo ao salvar
      }
    })();
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'financeiro' && !financeiroCarregado && estabelecimento?.id) {
      carregarStatusFinanceiro();
    }
  }, [activeTab, estabelecimento?.id]);

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
    if (current.length >= max) return alertar('Limite', `Máximo ${max} fotos.`);
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
      // A rota real (ConfiguracoesMobileController::updateEstabelecimento) é
      // registrada como POST puro, não PUT — mandar "_method=PUT" aqui fazia
      // o Laravel reescrever o verbo e cair num "PUT não suportado" (só existe
      // POST nessa rota), quebrando o salvamento mesmo com a URL certa.

      if (fotoPerfilPreview && !fotoPerfilPreview.startsWith('http')) {
        formData.append('foto_perfil', { uri: fotoPerfilPreview, name: 'p.jpg', type: 'image/jpeg' } as any);
      }
      if (fotoBannerPreview && !fotoBannerPreview.startsWith('http')) {
        formData.append('foto_banner', { uri: fotoBannerPreview, name: 'b.jpg', type: 'image/jpeg' } as any);
      }
      const res = await fetch(`${v1MobileUrl}/estabelecimentos/${estabelecimento.id}`, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        mostrarMensagem('Perfil da loja atualizado!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível salvar o perfil da loja.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); } finally { setSubmitting(false); }
  };

  const toggleStatus = async () => {
    if (!estabelecimento?.id) return;
    try {
      const res = await fetch(`${v1MobileUrl}/estabelecimentos/${estabelecimento.id}/toggle-status`, { method: 'PATCH', headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setEstabelecimento((p: any) => (p ? { ...p, ativo: data.ativo } : null));
        mostrarMensagem(data.ativo ? 'Loja Aberta!' : 'Loja Fechada!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível alterar o status da loja.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); }
  };

  const submitFuncionario = async () => {
    const { nome, email, password, cargo } = formFuncionario;
    
    // Corrigido bug da validação (Removendo o .trim() para evitar quebras)
    if (!nome || !email || !password || !cargo) {
      return alertar('Atenção', 'Nome, email, cargo e senha são campos obrigatórios e não podem ficar em branco.');
    }
    
    try {
      setSubmitting(true);
      const res = await fetch(`${v1MobileUrl}/estabelecimentos/${estabelecimento.id}/funcionarios`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(formFuncionario) });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setFuncionarios(p => [...p, data.funcionario || data]);
        setFormFuncionario({ id: null, nome: '', telefone: '', cargo: 'Atendente', email: '', password: '' });
        mostrarMensagem('Profissional cadastrado e salvo!');
      } else {
        alertar('Erro', data.message || 'Verifique se o email já está em uso na plataforma.');
      }
    } catch { alertar('Erro', 'Falha na comunicação com o servidor.'); } finally { setSubmitting(false); }
  };

  const deleteFuncionario = async (id: any) => {
    try {
      const res = await fetch(`${v1MobileUrl}/funcionarios/${id}`, { method: 'DELETE', headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setFuncionarios(p => p.filter(f => f.id !== id));
        mostrarMensagem('Profissional removido!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível remover o profissional.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); }
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

  const FORM_SERVICO_INICIAL = {
    id: null as any, nome: '', tipo_servico: '', descricao: '', valor: '', gratuito: false, duracao_minutos: '30', vagas_por_horario: '1',
    funcionario_id: '', dias_disponiveis: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as string[],
    horarios_disponiveis: [] as string[],
    tipo_pagamento: 'hibrido',
    somente_premium: false, tem_promocao: false, tipo_desconto: 'percentual', valor_desconto: '',
    aceita_pontos: false, maximo_pontos_permitidos: '',
    produtos_vinculados: [] as number[],
  };

  const cancelarEdicaoServico = () => {
    setEditandoServicoId(null);
    setFormServico(FORM_SERVICO_INICIAL);
    setFotosServico([]);
  };

  /** Preenche o formulário com um serviço já cadastrado. A edição no app cobre os mesmos campos
   * aceitos por updateServico no servidor — dias/horários/fotos continuam só na criação. */
  const editarServicoClick = (s: any) => {
    setEditandoServicoId(s.id);
    setFormServico({
      ...FORM_SERVICO_INICIAL,
      id: s.id,
      nome: s.nome || '',
      tipo_servico: s.tipo_servico || '',
      descricao: s.descricao || '',
      valor: String(s.valor ?? ''),
      gratuito: Number(s.valor ?? 0) === 0,
      duracao_minutos: String(s.duracao_minutos ?? '30'),
      vagas_por_horario: String(s.vagas_por_horario ?? '1'),
      somente_premium: !!s.somente_premium,
      tem_promocao: !!s.tem_promocao,
      tipo_desconto: s.tipo_desconto || 'percentual',
      valor_desconto: s.valor_desconto != null ? String(s.valor_desconto) : '',
      aceita_pontos: !!s.aceita_pontos,
      maximo_pontos_permitidos: s.maximo_pontos_permitidos != null ? String(s.maximo_pontos_permitidos) : '',
    });
    setFotosServico([]);
  };

  const submitServico = async () => {
    if (!estabelecimento?.id || !formServico.nome || (!formServico.gratuito && !formServico.valor)) return alertar('Erro', 'Preencha nome e valor do serviço (ou marque como gratuito).');
    if (!formServico.tipo_servico) return alertar('Erro', 'Escolha a categoria do serviço.');
    try {
      setSubmitting(true);
      const formData = new FormData();
      // Gratuito: garante valor 0 e desliga promoção (não tem o que descontar de graça).
      const dadosServico = {
        ...formServico,
        valor: formServico.gratuito ? '0' : formServico.valor,
        tem_promocao: formServico.gratuito ? false : formServico.tem_promocao,
      };
      Object.entries(dadosServico).forEach(([k, v]) => {
        if (k === 'dias_disponiveis' || k === 'horarios_disponiveis' || k === 'produtos_vinculados') {
          (v as (string | number)[]).forEach(item => formData.append(`${k}[]`, String(item)));
        } else if (v !== null) {
          formData.append(k, String(v));
        }
      });
      formData.append('estabelecimentos_ids[]', String(estabelecimento.id));
      fotosServico.forEach((uri, idx) => formData.append('fotos[]', { uri, name: `s_${idx}.jpg`, type: 'image/jpeg' } as any));

      const editando = editandoServicoId;
      if (editando) formData.append('_method', 'PUT');
      const url = editando ? `${v1MobileUrl}/servicos/${editando}` : `${v1MobileUrl}/servicos`;
      const res = await fetch(url, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        if (editando) {
          const atualizado = data.servico || data;
          setServicos((p) => p.map((item: any) => (item.id === editando ? { ...item, ...atualizado } : item)));
          mostrarMensagem('Serviço atualizado com sucesso!');
        } else {
          const criado = Array.isArray(data.data) ? data.data[0] : (data.servico || data);
          setServicos((p) => [...p, criado]);
          mostrarMensagem('Serviço salvo no catálogo!');
        }
        cancelarEdicaoServico();
      } else {
        alertar('Erro', data?.message || 'Não foi possível salvar o serviço.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); } finally { setSubmitting(false); }
  };

  const deleteServico = async (id: any) => {
    try {
      const res = await fetch(`${v1MobileUrl}/servicos/${id}`, { method: 'DELETE', headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setServicos(p => p.filter(s => s.id !== id));
        mostrarMensagem('Serviço removido!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível remover o serviço.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); }
  };

  const submitItem = async () => {
    if (!estabelecimento?.id || !formItem.nome) return alertar('Erro', 'Nome é obrigatório.');
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('estabelecimento_id', String(estabelecimento.id));
      Object.entries(formItem).forEach(([k, v]) => {
        if (k === 'produtos_vinculados') {
          (v as (string | number)[]).forEach(item => formData.append(`${k}[]`, String(item)));
        } else if (typeof v === 'boolean') {
          formData.append(k, v ? '1' : '0');
        } else if (v !== null && typeof v !== 'object') {
          formData.append(k, String(v));
        }
      });
      fotosItem.forEach((uri, idx) => formData.append('fotos[]', { uri, name: `i_${idx}.jpg`, type: 'image/jpeg' } as any));
      const res = await fetch(`${v1MobileUrl}/itens-aluguel`, { method: 'POST', headers: getHeaders(true), body: formData });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setItensAluguel(p => [...p, data.data || data.item || data]);
        setFotosItem([]);
        mostrarMensagem('Locação salva no sistema!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível salvar a locação.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); } finally { setSubmitting(false); }
  };

  const deleteItem = async (id: any) => {
    try {
      const res = await fetch(`${v1MobileUrl}/itens-aluguel/${id}`, { method: 'DELETE', headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setItensAluguel(p => p.filter((i: any) => i.id !== id));
        mostrarMensagem('Locação removida!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível remover a locação.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); }
  };

  const carregarStatusFinanceiro = async () => {
    setCarregandoFinanceiro(true);
    try {
      const res = await fetch(`${cleanBaseUrl}/provider`, { headers: getHeaders() });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        setProviderStatus(data);
        const contaDaLoja = (data.contas_pagamento || []).find((c: any) => c.estabelecimento_id === estabelecimento?.id);
        setChavePixReserva(contaDaLoja?.chave_pix || '');
      }
    } catch { /* segue mostrando o CTA de configurar, não é crítico */ } finally {
      setCarregandoFinanceiro(false);
      setFinanceiroCarregado(true);
    }
  };

  const submitChavePixReserva = async () => {
    if (!estabelecimento?.id || !providerStatus?.provider) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${cleanBaseUrl}/provider`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          pix_key_type: providerStatus.provider.pix_key_type,
          pix_key: providerStatus.provider.pix_key,
          estabelecimento_id: estabelecimento.id,
          chave_pix_reserva: chavePixReserva || null,
        }),
      });
      const { ok, data } = await handleApiResponse(res);
      if (ok) {
        mostrarMensagem('Chave PIX desta loja atualizada!');
      } else {
        alertar('Erro', data?.message || 'Não foi possível salvar a chave PIX.');
      }
    } catch { alertar('Erro de Conexão', 'Verifique sua internet e tente novamente.'); } finally { setSubmitting(false); }
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
        <ActivityIndicator size="large" color='#FF7A00' />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER SUPERIOR */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#282828" />
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
              <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.id ? '#FFFFFF' : '#6A6C72'} />
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
                  {fotoBannerPreview ? <Image source={{ uri: fotoBannerPreview }} style={styles.bannerImage} /> : <View style={styles.bannerPlaceholder}><Ionicons name="image-outline" size={32} color="#E1E2E5" /><Text style={styles.bannerPlaceholderText}>INSERIR BANNER</Text></View>}
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}><Text style={styles.label}>Nome do Estabelecimento *</Text><TextInput style={styles.input} value={formDetalhes.nome} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, nome: t })} /></View>
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>CNPJ</Text><TextInput style={styles.input} keyboardType="numeric" value={formDetalhes.cnpj} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, cnpj: t.replace(/\D/g, '').slice(0, 14) })} /></View>
                <View style={styles.gridCol}><Text style={styles.labelSmall}>Telefone</Text><TextInput style={styles.input} keyboardType="phone-pad" value={formDetalhes.telefone} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, telefone: t.replace(/\D/g, '').slice(0, 15) })} /></View>
              </View>
              
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Razão Social</Text><TextInput style={styles.input} value={formDetalhes.razao_social} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, razao_social: t })} /></View>
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Site / Link Externo</Text><TextInput style={styles.input} autoCapitalize="none" value={formDetalhes.site} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, site: t })} placeholder="ex: www.sualoja.com.br" /></View>
              <View style={styles.inputGroup}><Text style={styles.labelSmall}>Ramo de Atuação</Text><TextInput style={styles.input} value={formDetalhes.ramo_atuacao} onChangeText={(t) => setFormDetalhes({ ...formDetalhes, ramo_atuacao: t })} placeholder="Ex: Barbearia, Quadra..." /></View>
              
              <View style={styles.divider} />
              <Text style={styles.sectionSubTitle}>Endereço (Busca por CEP)</Text>

              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>CEP</Text>
                  <TextInput style={styles.input} value={formDetalhes.cep} keyboardType="numeric" onChangeText={(t) => setFormDetalhes({ ...formDetalhes, cep: t.replace(/\D/g, '').slice(0, 8) })} onBlur={() => buscarEnderecoPorCep(formDetalhes.cep, 'detalhes')} placeholder="Digite o CEP" />
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
              
              <TouchableOpacity style={styles.saveButton} onPress={submitDetalhes} disabled={submitting}>
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
              {funcionarios.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: '#6A6C72' }}>Nenhum membro na equipe.</Text>}
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
              <Text style={styles.cardTitle}>{editandoServicoId ? 'Editar Serviço' : 'Adicionar Novo Serviço'}</Text>

              <Text style={styles.labelSmall}>Categoria do Serviço *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {categoriasServicos.map((c) => {
                  const isSel = formServico.tipo_servico === c.valor;
                  return (
                    <TouchableOpacity
                      key={c.valor}
                      onPress={() => setFormServico({ ...formServico, tipo_servico: c.valor })}
                      style={[styles.chip, styles.chipCategoria, isSel && { backgroundColor: c.cor, borderColor: c.cor }]}
                    >
                      <Ionicons name={c.icone as any} size={14} color={isSel ? '#FFF' : c.cor} style={{ marginRight: 5 }} />
                      <Text style={[styles.chipText, isSel && styles.chipTextActive, isSel && { color: '#FFF' }]}>{c.valor}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {categoriasServicos.length === 0 && <Text style={styles.labelSmall}>Carregando categorias…</Text>}

              <TextInput style={styles.input} placeholder="Nome do Serviço (Ex: Corte de Cabelo)" value={formServico.nome} onChangeText={(t) => setFormServico({ ...formServico, nome: t })} />
              <TextInput style={styles.input} placeholder="Descrição (Opcional)" value={formServico.descricao} onChangeText={(t) => setFormServico({ ...formServico, descricao: t })} />
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <TextInput
                    style={[styles.input, formServico.gratuito && { backgroundColor: '#F1F2F4', color: '#9CA0A6' }]}
                    placeholder="Valor (R$)"
                    keyboardType="numeric"
                    editable={!formServico.gratuito}
                    value={formServico.gratuito ? '0' : formServico.valor}
                    onChangeText={(t) => setFormServico({ ...formServico, valor: t })}
                  />
                </View>
                <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Duração (min)" keyboardType="numeric" value={formServico.duracao_minutos} onChangeText={(t) => setFormServico({ ...formServico, duracao_minutos: t })} /></View>
              </View>
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Este serviço é gratuito</Text><Text style={styles.labelSmall}>Vale pra qualquer tipo de reserva — de mesa de restaurante a serviço de salão. Reserva sem cobrar nada.</Text></View>
                <Switch value={formServico.gratuito} onValueChange={(v) => setFormServico({...formServico, gratuito: v})} trackColor={{ false: "#E1E2E5", true: '#22C55E' }} />
              </View>
              <Text style={styles.labelSmall}>Vagas por horário</Text>
              <TextInput style={styles.input} placeholder="Quantos cabem ao mesmo tempo (ex: número de cadeiras numa mesa)" keyboardType="numeric" value={formServico.vagas_por_horario} onChangeText={(t) => setFormServico({ ...formServico, vagas_por_horario: t.replace(/[^0-9]/g, '') })} />
              <Text style={styles.labelSmall}>Quando as vagas de um horário acabam, ele some para novos clientes.</Text>

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
                  {fotosServico.length < 5 && <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('servico')}><Ionicons name="camera-outline" size={24} color="#6A6C72" /></TouchableOpacity>}
                  {fotosServico.map((uri, idx) => (<View key={idx} style={styles.imagePreviewContainer}><Image source={{ uri }} style={styles.imagePreview} /></View>))}
                </ScrollView>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionSubTitle}>Oferta Exclusiva Premium</Text>

              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Somente Assinantes Premium</Text><Text style={styles.labelSmall}>Só aparece liberado para clientes Premium.</Text></View>
                <Switch value={formServico.somente_premium} onValueChange={(v) => setFormServico({...formServico, somente_premium: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>
              <View style={[styles.switchRow, formServico.gratuito && { opacity: 0.5 }]}>
                <View style={{flex:1}}><Text style={styles.label}>Desconto Promocional</Text><Text style={styles.labelSmall}>{formServico.gratuito ? 'Não se aplica a um serviço gratuito.' : 'Aparece na tela de Ofertas Premium.'}</Text></View>
                <Switch value={!formServico.gratuito && formServico.tem_promocao} disabled={formServico.gratuito} onValueChange={(v) => setFormServico({...formServico, tem_promocao: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>
              {!formServico.gratuito && formServico.tem_promocao && (
                <View style={styles.rowGrid}>
                  <View style={styles.gridCol}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                      {[{id:'percentual', label:'%'}, {id:'fixo', label:'R$'}].map(t => (
                        <TouchableOpacity key={t.id} onPress={() => setFormServico({...formServico, tipo_desconto: t.id})} style={[styles.chip, formServico.tipo_desconto === t.id && styles.chipActive]}>
                          <Text style={[styles.chipText, formServico.tipo_desconto === t.id && styles.chipTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.gridCol}><TextInput style={styles.input} placeholder="Valor do Desconto" keyboardType="numeric" value={formServico.valor_desconto} onChangeText={(t) => setFormServico({ ...formServico, valor_desconto: t })} /></View>
                </View>
              )}
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Aceitar Pontos LOKYVA</Text><Text style={styles.labelSmall}>Permite desconto usando a carteira do app.</Text></View>
                <Switch value={formServico.aceita_pontos} onValueChange={(v) => setFormServico({...formServico, aceita_pontos: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>
              {formServico.aceita_pontos && (
                <TextInput style={styles.input} placeholder="Máximo de Pontos Permitidos" keyboardType="numeric" value={formServico.maximo_pontos_permitidos} onChangeText={(t) => setFormServico({ ...formServico, maximo_pontos_permitidos: t })} />
              )}

              {produtos.length > 0 && (
                <>
                  <Text style={styles.labelSmall}>Vincular Produtos já Cadastrados</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 6}}>
                    {produtos.map((p) => {
                      const sel = formServico.produtos_vinculados.includes(p.id);
                      return (
                        <TouchableOpacity key={p.id} onPress={() => {
                          const lista = sel ? formServico.produtos_vinculados.filter(id => id !== p.id) : [...formServico.produtos_vinculados, p.id];
                          setFormServico({...formServico, produtos_vinculados: lista});
                        }} style={[styles.chip, sel && styles.chipActive]}>
                          <Text style={[styles.chipText, sel && styles.chipTextActive]}>{p.nome}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editandoServicoId && (
                  <TouchableOpacity style={[styles.accentButton, { flex: 1, backgroundColor: '#E6E7E9' }]} onPress={cancelarEdicaoServico} disabled={submitting}>
                    <Text style={[styles.accentButtonText, { color: '#282828' }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.accentButton, { flex: 1 }]} onPress={submitServico} disabled={submitting}>
                  <Text style={styles.accentButtonText}>{submitting ? 'Salvando…' : editandoServicoId ? 'Salvar Alterações' : 'Salvar Serviço'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.listCard}>
              {servicos.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: '#6A6C72' }}>Nenhum serviço cadastrado.</Text>}
              {servicos.map((s) => (
                <View key={s.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                      <Text style={styles.listItemTitle}>{s.nome}</Text>
                      {!!s.tipo_servico && (
                        <View style={[styles.badge, { backgroundColor: '#F0F0F2' }]}>
                          <Ionicons name={(categoriasServicos.find((c) => c.valor === s.tipo_servico)?.icone || 'pricetag-outline') as any} size={11} color="#6A6C72" />
                          <Text style={[styles.badgeText, { color: '#6A6C72' }]}>{s.tipo_servico}</Text>
                        </View>
                      )}
                      {!!s.somente_premium && <View style={styles.badge}><Text style={styles.badgeText}>Premium</Text></View>}
                      {!!s.tem_promocao && <View style={[styles.badge, {backgroundColor: '#DC2626'}]}><Text style={styles.badgeText}>Promoção</Text></View>}
                    </View>
                    <Text style={styles.listItemSub}>{Number(s.valor) === 0 ? 'Grátis' : `R$ ${s.valor}`} • {s.duracao_minutos} min • {s.vagas_por_horario || 1} {(s.vagas_por_horario || 1) === 1 ? 'vaga' : 'vagas'} por horário</Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => editarServicoClick(s)} style={styles.iconButton}><Ionicons name="create-outline" size={18} color="#FF7A00" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteServico(s.id)} style={styles.iconButton}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                  </View>
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
                <Switch value={formItem.sempre_disponivel} onValueChange={(v) => setFormItem({...formItem, sempre_disponivel: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Somente Assinantes Premium</Text><Text style={styles.labelSmall}>Só aparece liberado para clientes Premium.</Text></View>
                <Switch value={formItem.somente_premium} onValueChange={(v) => setFormItem({...formItem, somente_premium: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>
              {produtos.length > 0 && (
                <>
                  <Text style={styles.labelSmall}>Vincular Produtos já Cadastrados</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 6}}>
                    {produtos.map((p) => {
                      const sel = formItem.produtos_vinculados.includes(p.id);
                      return (
                        <TouchableOpacity key={p.id} onPress={() => {
                          const lista = sel ? formItem.produtos_vinculados.filter(id => id !== p.id) : [...formItem.produtos_vinculados, p.id];
                          setFormItem({...formItem, produtos_vinculados: lista});
                        }} style={[styles.chip, sel && styles.chipActive]}>
                          <Text style={[styles.chipText, sel && styles.chipTextActive]}>{p.nome}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
              <View style={styles.switchRow}>
                <View style={{flex:1}}><Text style={styles.label}>Promoção Ativa</Text><Text style={styles.labelSmall}>Ofereça desconto.</Text></View>
                <Switch value={formItem.tem_promocao} onValueChange={(v) => setFormItem({...formItem, tem_promocao: v})} trackColor={{ false: "#E1E2E5", true: '#FF7A00' }} />
              </View>

              <View style={styles.divider} />

              <View style={styles.imageUploadSection}>
                <Text style={styles.labelSmall}>Fotos da Locação (Max 5)</Text>
                <ScrollView horizontal style={styles.imageList}>
                  {fotosItem.length < 5 && <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('item')}><Ionicons name="camera-outline" size={24} color="#6A6C72" /></TouchableOpacity>}
                  {fotosItem.map((uri, idx) => (<View key={idx} style={styles.imagePreviewContainer}><Image source={{ uri }} style={styles.imagePreview} /></View>))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitItem} disabled={submitting}>
                <Text style={styles.accentButtonText}>Finalizar Cadastro da Locação</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {itensAluguel.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: '#6A6C72' }}>Nenhuma locação cadastrada.</Text>}
              {itensAluguel.map((it: any) => (
                <View key={it.id} style={styles.listItem}>
                  <View>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                      <Text style={styles.listItemTitle}>{it.nome}</Text>
                      {!!it.somente_premium && <View style={styles.badge}><Text style={styles.badgeText}>Premium</Text></View>}
                      {!!it.tem_promocao && <View style={[styles.badge, {backgroundColor: '#DC2626'}]}><Text style={styles.badgeText}>Promoção</Text></View>}
                    </View>
                    <Text style={styles.listItemSub}>R$ {it.valor_diaria || it.valor_mensal || '0,00'} / diária</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteItem(it.id)} style={styles.iconButton}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 5: FINANCEIRO */}
        {/* ======================================================== */}
        {activeTab === 'financeiro' && (
          <View style={styles.tabContainer}>
            {carregandoFinanceiro ? (
              <ActivityIndicator size="large" color='#FF7A00' style={{ marginTop: 40 }} />
            ) : !providerStatus?.has_profile ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Conta de recebimento</Text>
                <Text style={{ color: '#6A6C72', marginBottom: 16, lineHeight: 20 }}>
                  Você ainda não tem uma conta de recebimento configurada. Ela é única pra sua conta (não por
                  loja) e é onde caem os repasses das suas reservas.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push('/Proprietario/RegisterProviderScreen' as never)}
                >
                  <Text style={styles.primaryButtonText}>CONFIGURAR CONTA DE RECEBIMENTO</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sua conta de recebimento</Text>
                  <View style={{ gap: 6, marginBottom: 4 }}>
                    <Text style={{ color: '#282828', fontWeight: '700' }}>{providerStatus.provider?.name}</Text>
                    <Text style={{ color: '#6A6C72' }}>{providerStatus.provider?.email}</Text>
                    <Text style={{ color: '#6A6C72' }}>
                      Chave PIX principal: {providerStatus.provider?.pix_key_type} — {providerStatus.provider?.pix_key}
                    </Text>
                    <Text style={{ color: '#6A6C72' }}>
                      Status no gateway: {providerStatus.provider?.asaas_status || 'Pendente'}
                    </Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Chave PIX reserva desta loja</Text>
                  <Text style={{ color: '#6A6C72', marginBottom: 12, lineHeight: 20 }}>
                    Opcional. Use se quiser que o repasse desta loja específica caia numa chave PIX diferente da
                    sua principal.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Chave PIX reserva (opcional)"
                    value={chavePixReserva}
                    onChangeText={setChavePixReserva}
                  />
                  <TouchableOpacity style={styles.saveButton} onPress={submitChavePixReserva} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>SALVAR CHAVE PIX DESTA LOJA</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* MENU INFERIOR */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.replace('/Proprietario/dashboard' as never)}>
          <Feather name="grid" size={22} color="#A0A2A8" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push(`/src/funcionario/Painel-funcioanario?origem=socio&estabelecimento_id=${estabelecimentoId}` as never)}
        >
          <Feather name="list" size={22} color="#A0A2A8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('servicos')}>
          <Feather name="scissors" size={22} color="#A0A2A8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconActiveBg}>
             <Feather name="settings" size={20} color="#282828" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/Proprietario/perfil' as never)}>
          <Feather name="user" size={22} color="#A0A2A8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const InputLabel = ({ text }: { text: string }) => <Text style={styles.labelSmall}>{text}</Text>;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E6E7E9', paddingVertical: 12, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backButtonText: { fontSize: 12, fontWeight: '600', color: '#282828', marginLeft: 4 },
  headerTitle: { fontSize: 10, fontWeight: '700', color: '#A0A2A8', letterSpacing: 0.5 },
  
  // Bolinha do Avatar no Canto Superior Direito
  avatarMiniHeader: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarTextHeader: { color: '#282828', fontWeight: 'bold', fontSize: 14 },

  tabsScrollView: { flexDirection: 'row' },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  tabButtonActive: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: '#6A6C72', marginLeft: 6 },
  tabButtonTextActive: { color: '#FFFFFF' },
  
  toast: { position: 'absolute', top: 100, left: 20, right: 20, zIndex: 999, backgroundColor: '#282828', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  toastText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  
  mainContent: { padding: 16 },
  tabContainer: { gap: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#282828' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  columnFlex: { flex: 1 },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E6E7E9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholderText: { fontSize: 24, fontWeight: 'bold', color: '#6A6C72' },
  bannerContainer: { height: 100, backgroundColor: '#F0F0F2', borderRadius: 8, overflow: 'hidden', marginTop: 6 },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerPlaceholderText: { fontSize: 10, fontWeight: 'bold', color: '#A0A2A8' },
  sectionSubTitle: { fontSize: 14, fontWeight: 'bold', color: '#282828' },
  helperText: { fontSize: 12, color: '#6A6C72' },
  divider: { height: 1, backgroundColor: '#E6E7E9', marginVertical: 4 },
  inputGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#6A6C72' },
  labelSmall: { fontSize: 11, color: '#6A6C72', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#E1E2E5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#282828', backgroundColor: '#FFF' },
  rowGrid: { flexDirection: 'row', gap: 12 },
  gridCol: { flex: 1 },
  
  primaryButton: { backgroundColor: '#FF7A00', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveButton: { backgroundColor: '#12A150', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  accentButton: { backgroundColor: '#12A150', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  accentButtonText: { color: '#FFF', fontWeight: 'bold' },
  
  dangerCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 14, padding: 16, gap: 8 },
  dangerTitle: { fontSize: 14, fontWeight: 'bold', color: '#991B1B' },
  dangerButton: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  dangerButtonText: { color: '#FFF', fontWeight: 'bold' },
  listCard: { backgroundColor: '#FFF', borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F2' },
  listItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#282828' },
  listItemSub: { fontSize: 12, color: '#6A6C72' },
  iconButton: { padding: 6 },
  imageUploadSection: { gap: 8 },
  imageList: { flexDirection: 'row' },
  addImageBtn: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#E1E2E5', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  imagePreviewContainer: { width: 60, height: 60, borderRadius: 8, marginRight: 8, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F0F0F2', borderWidth: 1, borderColor: '#E6E7E9' },
  chipCategoria: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  chipActive: { backgroundColor: '#FFEDD5', borderColor: '#282828' },
  chipText: { fontSize: 12, color: '#6A6C72', fontWeight: 'bold' },
  chipTextActive: { color: '#EA580C' },
  
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#282828', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, gap: 6 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F2' },
  
  bottomMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F2' },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: 50 },
  menuIconActiveBg: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center' },
});