
import React, { useState } from 'react';

const FinanceiroConta = ({ userToken }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    document: '',
    pix_key_type: 'CPF',
    pix_key: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Função utilitária para remover emojis e tags HTML
  const sanitizeInput = (value, type) => {
    // 1. Remove tags HTML (<script>, <b>, etc)
    let sanitized = value.replace(/[<>]/g, ''); 
    
    // 2. Remove Emojis usando faixas Unicode
    sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FAB0}-\u{1FABF}\u{1FAC0}-\u{1FACF}\u{1FAD0}-\u{1FADF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // 3. Regras Específicas por campo
    if (type === 'name') {
      // Permite apenas letras e espaços
      sanitized = sanitized.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    }
    if (type === 'document') {
      // Permite apenas números, pontos, traços e barras (formatação visual)
      sanitized = sanitized.replace(/[^0-9.\-\/]/g, '');
    }

    return sanitized;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const cleanValue = sanitizeInput(value, name);
    
    setFormData({ ...formData, [name]: cleanValue });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:8000/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        // Captura os erros de validação estritos do Laravel
        const errorMsg = data.errors ? Object.values(data.errors).flat()[0] : (data.message || 'Erro ao realizar o cadastro.');
        throw new Error(errorMsg);
      }

      setMessage({ type: 'success', text: data.message });
      
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 border rounded shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dados para Recebimento</h2>
      
      {message.text && (
        <div className={`p-4 mb-4 rounded ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome Completo / Razão Social</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required maxLength="100" className="mt-1 block w-full border border-gray-300 rounded p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required maxLength="150" className="mt-1 block w-full border border-gray-300 rounded p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Seu CPF ou CNPJ</label>
          <input type="text" name="document" value={formData.document} onChange={handleChange} required maxLength="18" className="mt-1 block w-full border border-gray-300 rounded p-2" />
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-800">Como você quer receber? (Pix)</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Tipo de Chave</label>
            <select name="pix_key_type" value={formData.pix_key_type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white">
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
              <option value="RANDOM">Chave Aleatória</option>
            </select>
          </div>
          
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Sua Chave Pix</label>
            <input type="text" name="pix_key" value={formData.pix_key} onChange={handleChange} required maxLength="255" placeholder="Digite a chave selecionada" className="mt-1 block w-full border border-gray-300 rounded p-2" />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Dados de Recebimento'}
        </button>
      </form>
    </div>
  );
};

export default FinanceiroConta;