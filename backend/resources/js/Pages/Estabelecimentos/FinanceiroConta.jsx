import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios'; // <-- Importando axios

export default function FinanceiroConta({ auth, userToken }) {
  const [formData, setFormData] = useState({
    person_type: 'FISICA',
    name: '',
    email: '',
    document: '',
    birth_date: '', 
    income_value: '', 
    mobile_phone: '',
    postal_code: '',
    address: '',
    address_number: '',
    complement: '',
    province: '',
    company_type: 'MEI', 
    responsible_name: '',
    responsible_cpf: '',
    pix_key_type: 'CPF',
    pix_key: ''
  });

  const [pageLoading, setPageLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [providerData, setProviderData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const addressNumberRef = useRef(null);

  // --- CARREGAR DADOS INICIAIS USANDO AXIOS ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/api/provider', {
          headers: {
            'Authorization': `Bearer ${userToken}`,
          }
        });

        // O axios já valida o status 2xx, e entrega os dados em response.data
        if (response.data.has_profile) {
          setHasProfile(true);
          setProviderData(response.data.provider);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do provedor:", error);
      } finally {
        setPageLoading(false);
      }
    };

    fetchProfile();
  }, [userToken]);

  // --- AUXILIARES DE FORMATAÇÃO PARA EXIBIÇÃO ---
  const formatDateToBR = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDocument = (doc, type) => {
    if (!doc) return '';
    const v = doc.replace(/\D/g, "");
    if (type === 'FISICA' || v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const v = phone.replace(/\D/g, "");
    return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const formatCep = (cep) => {
    if (!cep) return '';
    const v = cep.replace(/\D/g, "");
    return v.replace(/(\d{5})(\d{3})/, "$1-$2");
  };

  // --- MÁSCARAS DE DIGITAÇÃO DO FORMULÁRIO ---
  const applyMask = (value, type, personType = 'FISICA') => {
    let v = value || ''; 

    if (type === 'document') {
      v = v.replace(/\D/g, ""); 
      if (personType === 'FISICA') {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      } else {
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
      }
    } 
    else if (type === 'responsible_cpf') {
      v = v.replace(/\D/g, "");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    else if (type === 'mobile_phone') {
      v = v.replace(/\D/g, "");
      v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
      v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    } 
    else if (type === 'postal_code') {
      v = v.replace(/\D/g, "");
      v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    }
    else if (type === 'birth_date') { 
      v = v.replace(/\D/g, "");
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      v = v.substring(0, 10);
    }
    else if (type === 'income_value') { 
      v = v.replace(/\D/g, "");
      if (v !== "") {
        v = (parseInt(v) / 100).toFixed(2).replace(".", ",");
        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        v = `R$ ${v}`;
      }
    }

    return v;
  };

  const sanitizeText = (value, type) => {
    if (!value) return ''; 
    let sanitized = value.replace(/[<>]/g, ''); 
    sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FAB0}-\u{1FABF}\u{1FAC0}-\u{1FACF}\u{1FAD0}-\u{1FADF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    if (type === 'name' || type === 'responsible_name') {
      sanitized = sanitized.replace(/[^a-zA-ZÀ-ÿ\s]/g, ''); 
    }
    return sanitized;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'person_type') {
      setFormData({ ...formData, person_type: value, document: '' });
      return;
    }

    let finalValue = value;
    if (['document', 'responsible_cpf', 'mobile_phone', 'postal_code', 'birth_date', 'income_value'].includes(name)) {
      finalValue = applyMask(value, name, formData.person_type);
    } else {
      finalValue = sanitizeText(value, name);
    }

    setFormData({ ...formData, [name]: finalValue });
  };

  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, ''); 
    if (cep.length === 8) {
      try {
        const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        const data = res.data;
        
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            province: data.bairro || prev.province,
            complement: data.complemento || prev.complement,
          }));
          
          if (addressNumberRef.current) {
            addressNumberRef.current.focus();
          }
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    let formattedBirthDate = formData.birth_date;
    if (formattedBirthDate.includes('/')) {
      const [dia, mes, ano] = formattedBirthDate.split('/');
      if (dia && mes && ano) {
        formattedBirthDate = `${ano}-${mes}-${dia}`;
      }
    }

    const payload = {
      ...formData,
      birth_date: formattedBirthDate
    };

    try {
      // ENVIANDO O POST USANDO AXIOS
      const response = await axios.post('/api/provider', payload, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      const data = response.data;

      if (data.provider) {
        setProviderData(data.provider);
        setHasProfile(true);
      }
      
    } catch (error) {
      // Tratamento de erros do axios
      if (error.response) {
        // O servidor respondeu com um status fora do range 2xx
        if (error.response.status === 422 && error.response.data.errors) {
          const firstErrorKey = Object.keys(error.response.data.errors)[0];
          const firstErrorMessage = error.response.data.errors[firstErrorKey][0];
          setMessage({ type: 'error', text: firstErrorMessage });
        } else if (error.response.data.error) {
          setMessage({ type: 'error', text: error.response.data.error });
        } else {
          setMessage({ type: 'error', text: error.response.data.message || 'Ocorreu um erro ao salvar seus dados.' });
        }
      } else {
        // Erro de rede ou outro erro
        setMessage({ type: 'error', text: 'Ocorreu um erro inesperado. Por favor, tente novamente.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // --- HEADER PADRÃO COMPARTILHADO ---
  const headerContent = (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Configurações Financeiras
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Gerencie os dados para recebimento dos seus pagamentos.
      </p>
    </div>
  );

  // 1. TELA DE CARREGAMENTO INICIAL
  if (pageLoading) {
    return (
      <AuthenticatedLayout user={auth.user} header={headerContent}>
        <Head title="Financeiro - Carregando" />
        <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006837] mb-3"></div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Carregando dados da sua conta...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout user={auth.user} header={headerContent}>
      <Head title="Financeiro - Conta" />

      <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          
          {/* 2. MODO EXIBIÇÃO */}
          {hasProfile && providerData ? (
            <div className="space-y-6">
              
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm sm:text-base shadow-sm">
                💡 Esses são os dados de sua conta no provedor financeiro, agora você pode receber pagamentos. Comece a criar seus serviços ou reservas.
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm space-y-8">
                
                <div>
                  <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-[#006837]/10 text-[#006837] dark:bg-[#006837]/20 dark:text-[#008f4c]">
                      {providerData.person_type === 'FISICA' ? 'CPF' : 'CNPJ'}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Informações Cadastrais</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Nome Completo / Razão Social</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{providerData.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">{providerData.person_type === 'FISICA' ? 'CPF' : 'CNPJ'}</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatDocument(providerData.document, providerData.person_type)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Data de Nascimento / Fundação</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatDateToBR(providerData.birth_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">{providerData.person_type === 'FISICA' ? 'Renda Mensal' : 'Faturamento Mensal'}</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatCurrency(providerData.income_value)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">E-mail Comercial</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 break-all">{providerData.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Celular de Contato</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatPhone(providerData.mobile_phone)}</p>
                    </div>
                  </div>
                </div>

                {providerData.person_type === 'JURIDICA' && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Estrutura Societária</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Tipo de Empresa</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{providerData.company_type}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Responsável Legal</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{providerData.responsible_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">CPF do Responsável</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{formatDocument(providerData.responsible_cpf, 'FISICA')}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Endereço Comercial</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">CEP</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatCep(providerData.postal_code)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Logradouro / Rua</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{providerData.address}, Nº {providerData.address_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Bairro</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{providerData.province}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Complemento</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{providerData.complement || 'Não informado'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#006837]/5 dark:bg-[#006837]/10 rounded-2xl border border-[#006837]/10">
                  <h3 className="text-base font-bold text-[#006837] dark:text-[#008f4c] mb-2">Chave Pix Ativa para Recebimento</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="text-xs font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded mr-2">
                        {providerData.pix_key_type}
                      </span>
                      <span className="font-mono text-gray-800 dark:text-gray-200 font-semibold">{providerData.pix_key}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full self-start sm:self-auto">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Integrado com Asaas
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            
            // 3. MODO CRIAÇÃO
            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Perfil Financeiro</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Preencha seus dados para habilitar o recebimento automático na sua conta.
              </p>
              
              {message.text && (
                <div className={`p-4 mb-8 rounded-xl font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* --- TIPO DE CONTA --- */}
                <div className="flex flex-wrap gap-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="person_type" value="FISICA" checked={formData.person_type === 'FISICA'} onChange={handleChange} className="form-radio text-[#006837] focus:ring-[#006837]" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Pessoa Física (CPF)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="person_type" value="JURIDICA" checked={formData.person_type === 'JURIDICA'} onChange={handleChange} className="form-radio text-[#006837] focus:ring-[#006837]" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Pessoa Jurídica (CNPJ)</span>
                  </label>
                </div>

                {/* --- DADOS BÁSICOS --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo / Razão Social</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{formData.person_type === 'FISICA' ? 'CPF' : 'CNPJ'}</label>
                    <input 
                      type="text" 
                      name="document" 
                      value={formData.document} 
                      onChange={handleChange} 
                      required 
                      maxLength={formData.person_type === 'FISICA' ? 14 : 18} 
                      placeholder={formData.person_type === 'FISICA' ? '000.000.000-00' : '00.000.000/0000-00'}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Nascimento / Fundação</label>
                    <input 
                      type="text" 
                      name="birth_date" 
                      value={formData.birth_date} 
                      onChange={handleChange} 
                      required 
                      placeholder="DD/MM/AAAA"
                      maxLength="10"
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {formData.person_type === 'FISICA' ? 'Renda Mensal' : 'Faturamento Mensal'}
                    </label>
                    <input 
                      type="text" 
                      name="income_value" 
                      value={formData.income_value} 
                      onChange={handleChange} 
                      required 
                      placeholder="R$ 0,00"
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Celular (com DDD)</label>
                    <input type="text" name="mobile_phone" value={formData.mobile_phone} onChange={handleChange} required maxLength="15" placeholder="(00) 00000-0000" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                </div>

                {/* --- CAMPOS CONDICIONAIS PARA PJ --- */}
                {formData.person_type === 'JURIDICA' && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-100 dark:border-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-5 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Empresa</label>
                      <select name="company_type" value={formData.company_type} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]">
                        <option value="MEI">MEI</option>
                        <option value="LTDA">LTDA</option>
                        <option value="EI">EI</option>
                        <option value="EIRELI">EIRELI</option>
                        <option value="SA">S.A.</option>
                        <option value="ANY_OTHER">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Sócio</label>
                      <input type="text" name="responsible_name" value={formData.responsible_name} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPF do Sócio</label>
                      <input type="text" name="responsible_cpf" value={formData.responsible_cpf} onChange={handleChange} required maxLength="14" placeholder="000.000.000-00" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                    </div>
                  </div>
                )}

                {/* --- ENDEREÇO --- */}
                <h3 className="text-lg font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Endereço</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CEP</label>
                    <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} onBlur={handleCepBlur} required maxLength="9" placeholder="00000-000" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                  <div className="col-span-1 sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rua / Logradouro</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número</label>
                    <input 
                      type="text" 
                      name="address_number" 
                      value={formData.address_number} 
                      onChange={handleChange} 
                      ref={addressNumberRef} 
                      required 
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Complemento</label>
                    <input type="text" name="complement" value={formData.complement} onChange={handleChange} placeholder="Apto, Sala..." className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bairro</label>
                    <input type="text" name="province" value={formData.province} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                </div>

                {/* --- PIX --- */}
                <h3 className="text-lg font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Recebimento via Pix</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Chave</label>
                    <select name="pix_key_type" value={formData.pix_key_type} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]">
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="PHONE">Telefone</option>
                      <option value="RANDOM">Chave Aleatória</option>
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sua Chave Pix</label>
                    <input type="text" name="pix_key" value={formData.pix_key} onChange={handleChange} required placeholder="Digite sua chave" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 focus:ring-[#006837] focus:border-[#006837]" />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full mt-8 bg-[#006837] text-white font-bold py-3.5 px-4 rounded-xl hover:bg-[#00522b] transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? 'Processando dados...' : 'Criar Perfil de Recebimento'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  );
}