import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Interfaces TypeScript
interface Funcionario {
  id: number | string;
  nome: string;
  cargo?: string;
  email?: string;
}

interface Servico {
  id: number | string;
  nome: string;
  valor: string | number;
  duracao_minutos: string | number;
}

interface ItemAluguel {
  id: number | string;
  nome: string;
  categoria: string;
  valor_diaria: string | number;
  descricao?: string;
  quantidade?: number | string;
}

interface Estabelecimento {
  id: number | string;
  nome?: string;
  ramo_atuacao?: string;
  telefone?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  token_mercadopago?: string;
  foto_perfil?: string;
  foto_banner?: string;
  ativo?: boolean;
}

interface ConfiguracoesMobileProps {
  estabelecimento?: Estabelecimento;
  funcionarios?: Funcionario[];
  servicos?: Servico[];
  itens_aluguel?: ItemAluguel[];
  onBack?: () => void;
  onSaveDetalhes?: (data: any) => Promise<void> | void;
  onToggleStatus?: () => void;
  onSaveFuncionario?: (data: any) => Promise<void> | void;
  onDeleteFuncionario?: (id: number | string) => void;
  onSaveServico?: (data: any) => Promise<void> | void;
  onDeleteServico?: (id: number | string) => void;
  onSaveItemAluguel?: (data: any) => Promise<void> | void;
  onSaveFinanceiro?: (data: any) => Promise<void> | void;
}

export default function ConfiguracoesMobile({
  estabelecimento,
  funcionarios = [],
  servicos = [],
  itens_aluguel = [],
  onBack,
  onSaveDetalhes,
  onToggleStatus,
  onSaveFuncionario,
  onDeleteFuncionario,
  onSaveServico,
  onDeleteServico,
  onSaveItemAluguel,
  onSaveFinanceiro,
}: ConfiguracoesMobileProps) {
  // 1. Estado para Aba Ativa
  const [activeTab, setActiveTab] = useState('detalhes');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const mostrarMensagem = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => setMensagemSucesso(''), 4000);
  };

  // Lista de Abas Superiores
  const tabsNav = [
    { id: 'detalhes', label: '1. Perfil da Loja', icon: 'business-outline' },
    { id: 'equipe', label: '2. Equipe / Profissionais', icon: 'people-outline' },
    { id: 'servicos', label: '3. Catálogo de Serviços', icon: 'construct-outline' },
    { id: 'reservas_alugueis', label: '4. Reservas / Locações', icon: 'calendar-outline' },
    { id: 'financeiro', label: '5. Financeiro / Mercado Pago', icon: 'card-outline' },
  ];

  // ==========================================
  // LÓGICA DE FOTOS MÚLTIPLAS (SERVIÇOS E RESERVAS)
  // ==========================================
  const [fotosServico, setFotosServico] = useState<string[]>([]);
  const [fotosItem, setFotosItem] = useState<string[]>([]);

  const pickMultipleImages = async (tipo: 'servico' | 'item') => {
    const maxFotos = tipo === 'servico' ? 5 : 10;
    const currentFotos = tipo === 'servico' ? fotosServico : fotosItem;

    if (currentFotos.length >= maxFotos) {
      Alert.alert('Limite atingido', `Você pode enviar no máximo ${maxFotos} fotos.`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'É preciso permitir acesso às fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxFotos - currentFotos.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((asset) => asset.uri);
      
      if (tipo === 'servico') {
        setFotosServico((prev) => [...prev, ...newUris].slice(0, 5));
      } else {
        setFotosItem((prev) => [...prev, ...newUris].slice(0, 10));
      }
    }
  };

  const removeFoto = (tipo: 'servico' | 'item', index: number) => {
    if (tipo === 'servico') {
      setFotosServico((prev) => prev.filter((_, i) => i !== index));
    } else {
      setFotosItem((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // ==========================================
  // FORM 1: DETALHES DA LOJA (PERFIL)
  // ==========================================
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState<string | null>(
    estabelecimento?.foto_perfil || null
  );
  const [fotoBannerPreview, setFotoBannerPreview] = useState<string | null>(
    estabelecimento?.foto_banner || null
  );

  const [formDetalhes, setFormDetalhes] = useState({
    nome: estabelecimento?.nome || '',
    ramo_atuacao: estabelecimento?.ramo_atuacao || '',
    telefone: estabelecimento?.telefone || '',
    cep: estabelecimento?.cep || '',
    rua: estabelecimento?.rua || '',
    numero: estabelecimento?.numero || '',
    complemento: estabelecimento?.complemento || '',
    bairro: estabelecimento?.bairro || '',
    cidade: estabelecimento?.cidade || '',
    estado: estabelecimento?.estado || 'SP',
  });

  const pickImage = async (tipo: 'perfil' | 'banner') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'É preciso permitir acesso às fotos para alterar a imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (tipo === 'perfil') setFotoPerfilPreview(uri);
      if (tipo === 'banner') setFotoBannerPreview(uri);
    }
  };

  const submitDetalhes = async () => {
    if (onSaveDetalhes) {
      await onSaveDetalhes({ ...formDetalhes, fotoPerfilPreview, fotoBannerPreview });
    }
    mostrarMensagem('Perfil atualizado com sucesso!');
  };

  const toggleStatus = () => {
    Alert.alert(
      'Alterar Status',
      'Deseja realmente alterar o status deste estabelecimento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            if (onToggleStatus) onToggleStatus();
            mostrarMensagem('Status alterado!');
          },
        },
      ]
    );
  };

  // ==========================================
  // FORM 2: EQUIPE / FUNCIONÁRIOS
  // ==========================================
  const [isEditingFuncionario, setIsEditingFuncionario] = useState(false);
  const [formFuncionario, setFormFuncionario] = useState({
    id: null as number | string | null,
    nome: '',
    telefone: '',
    cargo: 'Atendente',
    email: '',
    password: '',
  });

  const submitFuncionario = async () => {
    if (onSaveFuncionario) {
      await onSaveFuncionario(formFuncionario);
    }
    setFormFuncionario({ id: null, nome: '', telefone: '', cargo: 'Atendente', email: '', password: '' });
    setIsEditingFuncionario(false);
    mostrarMensagem(isEditingFuncionario ? 'Funcionário atualizado!' : 'Funcionário cadastrado!');
  };

  // ==========================================
  // FORM 3: SERVIÇOS
  // ==========================================
  const [formServico, setFormServico] = useState({
    id: null as number | string | null,
    nome: '',
    tipo_servico: '',
    descricao: '',
    valor: '',
    duracao_minutos: '30',
  });

  const submitServico = async () => {
    try {
      if (onSaveServico) {
        // Envia os dados do serviço junto com o Array de fotos selecionadas
        await onSaveServico({ ...formServico, fotos: fotosServico });
      }
      setFormServico({ id: null, nome: '', tipo_servico: '', descricao: '', valor: '', duracao_minutos: '30' });
      setFotosServico([]); // Limpa as fotos
      mostrarMensagem('Serviço criado com sucesso!');
    } catch (error: any) {
      // TRATATIVA DO ERRO DA HIVE AI (Ou outro erro de upload)
      Alert.alert('Aviso', 'Ops, você não pode enviar esse tipo de arquivo.');
    }
  };

  // ==========================================
  // FORM 4: ITENS DE LOCAÇÃO
  // ==========================================
  const [formItem, setFormItem] = useState({
    id: null as number | string | null,
    nome: '',
    categoria: 'casa',
    valor_diaria: '',
    descricao: '',
    quantidade: '1',
  });

  const submitItem = async () => {
    try {
      if (onSaveItemAluguel) {
        // Envia os dados da reserva/item junto com o Array de fotos selecionadas
        await onSaveItemAluguel({ ...formItem, fotos: fotosItem });
      }
      setFormItem({ id: null, nome: '', categoria: 'casa', valor_diaria: '', descricao: '', quantidade: '1' });
      setFotosItem([]); // Limpa as fotos
      mostrarMensagem('Item de locação salvo!');
    } catch (error: any) {
      // TRATATIVA DO ERRO DA HIVE AI (Ou outro erro de upload)
      Alert.alert('Aviso', 'Ops, você não pode enviar esse tipo de arquivo.');
    }
  };

  // ==========================================
  // FORM 5: FINANCEIRO / MERCADO PAGO
  // ==========================================
  const [tokenMercadoPago, setTokenMercadoPago] = useState(estabelecimento?.token_mercadopago || '');

  const submitFinanceiro = async () => {
    if (onSaveFinanceiro) {
      await onSaveFinanceiro({ token_mercadopago: tokenMercadoPago });
    }
    mostrarMensagem('Configurações financeiras salvas!');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER FIXO SUPERIOR */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={16} color="#334155" />
            <Text style={styles.backButtonText}>Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>
        </View>

        {/* MENU DE ABAS DESLIZANTE NO TOPO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollView}>
          {tabsNav.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#FFFFFF' : '#64748B'}
                />
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* NOTIFICAÇÃO DE SUCESSO */}
      {!!mensagemSucesso && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>{mensagemSucesso}</Text>
        </View>
      )}

      {/* CONTEÚDO PRINCIPAL (SCROLLVIEW) */}
      <ScrollView contentContainerStyle={styles.mainContent}>
        {/* ABA 1: PERFIL DA LOJA */}
        {activeTab === 'detalhes' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              {/* LOGO DO ESTABELECIMENTO */}
              <View style={styles.row}>
                <TouchableOpacity style={styles.avatarContainer} onPress={() => pickImage('perfil')}>
                  {fotoPerfilPreview ? (
                    <Image source={{ uri: fotoPerfilPreview }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarPlaceholderText}>
                      {estabelecimento?.nome?.charAt(0) || 'E'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.columnFlex}>
                  <Text style={styles.sectionSubTitle}>Logo do Estabelecimento</Text>
                  <Text style={styles.helperText}>Exibida nas buscas e agendamentos. (Toque para alterar)</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* BANNER DA LOJA */}
              <View>
                <Text style={styles.label}>Banner da Loja</Text>
                <Text style={styles.helperText}>Exibido na parte superior da página pública.</Text>
                <TouchableOpacity style={styles.bannerContainer} onPress={() => pickImage('banner')}>
                  {fotoBannerPreview ? (
                    <Image source={{ uri: fotoBannerPreview }} style={styles.bannerImage} />
                  ) : (
                    <View style={styles.bannerPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                      <Text style={styles.bannerPlaceholderText}>INSERIR BANNER DA VITRINE</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* NOME E RAMO */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Estabelecimento *</Text>
                <TextInput
                  style={styles.input}
                  value={formDetalhes.nome}
                  onChangeText={(text) => setFormDetalhes({ ...formDetalhes, nome: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ramo de Atuação</Text>
                <TextInput
                  style={styles.input}
                  value={formDetalhes.ramo_atuacao}
                  onChangeText={(text) => setFormDetalhes({ ...formDetalhes, ramo_atuacao: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone de Contato</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={formDetalhes.telefone}
                  onChangeText={(text) => setFormDetalhes({ ...formDetalhes, telefone: text })}
                />
              </View>

              {/* SEÇÃO ENDEREÇO */}
              <Text style={styles.sectionHeaderTitle}>Endereço</Text>
              
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>CEP</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formDetalhes.cep}
                    onChangeText={(text) => setFormDetalhes({ ...formDetalhes, cep: text })}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>Número</Text>
                  <TextInput
                    style={styles.input}
                    value={formDetalhes.numero}
                    onChangeText={(text) => setFormDetalhes({ ...formDetalhes, numero: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.labelSmall}>Rua / Avenida</Text>
                <TextInput
                  style={styles.input}
                  value={formDetalhes.rua}
                  onChangeText={(text) => setFormDetalhes({ ...formDetalhes, rua: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.labelSmall}>Complemento</Text>
                <TextInput
                  style={styles.input}
                  value={formDetalhes.complemento}
                  onChangeText={(text) => setFormDetalhes({ ...formDetalhes, complemento: text })}
                />
              </View>

              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={formDetalhes.cidade}
                    onChangeText={(text) => setFormDetalhes({ ...formDetalhes, cidade: text })}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelSmall}>UF</Text>
                  <TextInput
                    style={styles.input}
                    maxLength={2}
                    autoCapitalize="characters"
                    value={formDetalhes.estado}
                    onChangeText={(text) => setFormDetalhes({ ...formDetalhes, estado: text })}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={submitDetalhes}>
                <Text style={styles.primaryButtonText}>SALVAR ALTERAÇÕES</Text>
              </TouchableOpacity>
            </View>

            {/* CAIXA DE DESATIVAÇÃO */}
            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>Desativar Estabelecimento</Text>
              <Text style={styles.dangerText}>
                Ao desativar, a sua loja deixará de aparecer para os clientes e não aceitará novos agendamentos.
              </Text>
              <TouchableOpacity style={styles.dangerButton} onPress={toggleStatus}>
                <Text style={styles.dangerButtonText}>
                  {estabelecimento?.ativo ? 'Desativar Estabelecimento' : 'Ativar Estabelecimento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ABA 2: EQUIPE / FUNCIONÁRIOS */}
        {activeTab === 'equipe' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {isEditingFuncionario ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Nome completo"
                placeholderTextColor="#94A3B8"
                value={formFuncionario.nome}
                onChangeText={(text) => setFormFuncionario({ ...formFuncionario, nome: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="E-mail de acesso"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formFuncionario.email}
                onChangeText={(text) => setFormFuncionario({ ...formFuncionario, email: text })}
              />

              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Cargo"
                    placeholderTextColor="#94A3B8"
                    value={formFuncionario.cargo}
                    onChangeText={(text) => setFormFuncionario({ ...formFuncionario, cargo: text })}
                  />
                </View>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={formFuncionario.password}
                    onChangeText={(text) => setFormFuncionario({ ...formFuncionario, password: text })}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitFuncionario}>
                <Text style={styles.accentButtonText}>
                  {isEditingFuncionario ? 'Atualizar' : '+ Cadastrar Membro'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {funcionarios.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum funcionário cadastrado.</Text>
              ) : (
                funcionarios.map((func) => (
                  <View key={func.id} style={styles.listItem}>
                    <View>
                      <Text style={styles.listItemTitle}>{func.nome}</Text>
                      <Text style={styles.listItemSub}>
                        {func.cargo} • {func.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onDeleteFuncionario && onDeleteFuncionario(func.id)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ABA 3: CATÁLOGO DE SERVIÇOS */}
        {activeTab === 'servicos' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Novo Serviço</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome do Serviço"
                placeholderTextColor="#94A3B8"
                value={formServico.nome}
                onChangeText={(text) => setFormServico({ ...formServico, nome: text })}
              />
              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Valor (R$)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formServico.valor.toString()}
                    onChangeText={(text) => setFormServico({ ...formServico, valor: text })}
                  />
                </View>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Duração (min)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formServico.duracao_minutos.toString()}
                    onChangeText={(text) => setFormServico({ ...formServico, duracao_minutos: text })}
                  />
                </View>
              </View>

              {/* UPLOAD MULTIPLO DE FOTOS PARA SERVIÇO */}
              <View style={styles.imageUploadSection}>
                <Text style={styles.labelSmall}>
                  Fotos do Serviço (Até 5 fotos - Max 2MB cada). A 1ª será a capa.
                </Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
                  {/* Botão de Adicionar */}
                  {fotosServico.length < 5 && (
                    <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('servico')}>
                      <Ionicons name="camera-outline" size={24} color="#64748B" />
                      <Text style={styles.addImageText}>Add Foto</Text>
                    </TouchableOpacity>
                  )}

                  {/* Fotos Selecionadas */}
                  {fotosServico.map((uri, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri }} style={styles.imagePreview} />
                      {index === 0 && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>CAPA</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeFoto('servico', index)}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitServico}>
                <Text style={styles.accentButtonText}>Salvar Serviço</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {servicos.map((s) => (
                <View key={s.id} style={styles.listItem}>
                  <View>
                    <Text style={styles.listItemTitle}>{s.nome}</Text>
                    <Text style={styles.listItemSub}>
                      R$ {s.valor} • {s.duracao_minutos} min
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onDeleteServico && onDeleteServico(s.id)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ABA 4: RESERVAS / LOCAÇÕES */}
        {activeTab === 'reservas_alugueis' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cadastrar Item de Locação</Text>
              <TextInput
                style={styles.input}
                placeholder="Título do Item (ex: Casa de Praia, Carro)"
                placeholderTextColor="#94A3B8"
                value={formItem.nome}
                onChangeText={(text) => setFormItem({ ...formItem, nome: text })}
              />

              <View style={styles.rowGrid}>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Categoria"
                    placeholderTextColor="#94A3B8"
                    value={formItem.categoria}
                    onChangeText={(text) => setFormItem({ ...formItem, categoria: text })}
                  />
                </View>
                <View style={styles.gridCol}>
                  <TextInput
                    style={styles.input}
                    placeholder="Diária (R$)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formItem.valor_diaria.toString()}
                    onChangeText={(text) => setFormItem({ ...formItem, valor_diaria: text })}
                  />
                </View>
              </View>

              <TextInput
                style={[styles.input, { height: 70 }]}
                placeholder="Descrição"
                placeholderTextColor="#94A3B8"
                multiline
                value={formItem.descricao}
                onChangeText={(text) => setFormItem({ ...formItem, descricao: text })}
              />

              {/* UPLOAD MULTIPLO DE FOTOS PARA RESERVAS */}
              <View style={styles.imageUploadSection}>
                <Text style={styles.labelSmall}>
                  Fotos da Locação (Até 10 fotos - Max 2MB cada). A 1ª será a capa.
                </Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageList}>
                  {/* Botão de Adicionar */}
                  {fotosItem.length < 10 && (
                    <TouchableOpacity style={styles.addImageBtn} onPress={() => pickMultipleImages('item')}>
                      <Ionicons name="camera-outline" size={24} color="#64748B" />
                      <Text style={styles.addImageText}>Add Foto</Text>
                    </TouchableOpacity>
                  )}

                  {/* Fotos Selecionadas */}
                  {fotosItem.map((uri, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri }} style={styles.imagePreview} />
                      {index === 0 && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>CAPA</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeFoto('item', index)}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.accentButton} onPress={submitItem}>
                <Text style={styles.accentButtonText}>Salvar Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ABA 5: FINANCEIRO / MERCADO PAGO */}
        {activeTab === 'financeiro' && (
          <View style={styles.tabContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Integração Mercado Pago</Text>
              <Text style={styles.helperText}>
                Insira seu Access Token do Mercado Pago para receber pagamentos diretamente em sua conta.
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Access Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="APP_USR-..."
                  placeholderTextColor="#94A3B8"
                  value={tokenMercadoPago}
                  onChangeText={setTokenMercadoPago}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={submitFinanceiro}>
                <Text style={styles.primaryButtonText}>SALVAR CONFIGURAÇÕES</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos Nativos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  tabsScrollView: {
    flexDirection: 'row',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 6,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99,
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  mainContent: {
    padding: 16,
  },
  tabContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  columnFlex: {
    flex: 1,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sectionSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  helperText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  bannerContainer: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  inputGroup: {
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 4,
    marginTop: 8,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCol: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accentButton: {
    backgroundColor: '#F97316',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  accentButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
  },
  dangerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  dangerText: {
    fontSize: 11,
    color: '#DC2626',
    marginVertical: 6,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  listItem: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  listItemSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  iconButton: {
    padding: 6,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 24,
  },
  // NOVOS ESTILOS PARA FOTOS MÚLTIPLAS
  imageUploadSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  imageList: {
    flexDirection: 'row',
    marginTop: 8,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addImageText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 10,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(249, 115, 22, 0.85)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});