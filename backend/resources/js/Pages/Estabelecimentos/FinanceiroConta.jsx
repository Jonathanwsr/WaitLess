import React, { useState, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function FinanceiroConta({ auth, userToken }) {
  const [formData, setFormData] = useState({
    person_type: 'FISICA',
    name: '',
    email: '',
    document: '',
    birth_date: '', // Agora usará máscara DD/MM/AAAA
    income_value: '', // 🚀 Novo campo de Renda/Faturamento
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

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const addressNumberRef = useRef(null);

  // --- MÁSCARAS DE DIGITAÇÃO ---
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
    else if (type === 'birth_date') { // 🚀 Máscara para Data de Nascimento
      v = v.replace(/\D/g, "");
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      v = v.substring(0, 10);
    }
    else if (type === 'income_value') { // 🚀 Máscara para Renda/Faturamento
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
    // 🚀 Incluídos birth_date e income_value nas máscaras
    if (['document', 'responsible_cpf', 'mobile_phone', 'postal_code', 'birth_date', 'income_value'].includes(name)) {
      finalValue = applyMask(value, name, formData.person_type);
    } else {
      finalValue = sanitizeText(value, name);
    }

    setFormData({ ...formData, [name]: finalValue });
  };

  // --- BUSCA AUTOMÁTICA DE CEP (VIACEP) ---
  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, ''); 
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        
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

    // 🚀 Converte a data DD/MM/AAAA para AAAA-MM-DD antes de enviar para a API
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
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify(payload)
      });

      // 🚀 CAPTURA SEGURA DO JSON (Evita quebrar se o Laravel cuspir HTML no erro 500)
      let data;
      try {
        data = await response.json();
      } catch (jsonParseError) {
        throw new Error('O servidor retornou um erro interno crítico (500). Nossa equipe já foi notificada.');
      }

      // 🚀 TRATAMENTO DE ERROS MELHORADO
      if (!response.ok) {
        
        // 1. Erro de Validação do Laravel (Status 422 - Ex: Faltou campo obrigatório)
        if (response.status === 422 && data.errors) {
          // Pega a primeira mensagem de erro da lista retornada pelo Laravel
          const firstErrorKey = Object.keys(data.errors)[0];
          const firstErrorMessage = data.errors[firstErrorKey][0];
          throw new Error(firstErrorMessage);
        }

        // 2. Erros Customizados do nosso Controller (Status 400 ou 500)
        if (data.error) {
          throw new Error(data.error);
        }

        // 3. Fallback (Se tiver mensagem, mostra, se não, exibe o genérico)
        throw new Error(data.message || 'Ocorreu um erro inesperado ao salvar seus dados. Por favor, tente novamente.');
      }

      setMessage({ type: 'success', text: data.message || 'Conta criada com sucesso!' });
      
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthenticatedLayout
      user={auth.user}
      header={
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Configurações Financeiras
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie os dados para recebimento dos seus pagamentos.
          </p>
        </div>
      }
    >
      <Head title="Financeiro - Conta" />

      <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 sm:p-8 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
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

              {/* 🚀 MELHORIA: Data como texto com máscara (muito mais fácil de digitar o ano) */}
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

              {/* 🚀 NOVO CAMPO: Renda Mensal com Máscara Monetária */}
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
      </div>
    </AuthenticatedLayout>
  );
}