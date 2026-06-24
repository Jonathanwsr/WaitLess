import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { 
  ChevronRight, Trash2, Check, Camera, Mail, Phone, 
  Calendar, UserSquare2, Briefcase
} from 'lucide-react';

export default function EditarFuncionario({ auth, funcionario, estabelecimentos }) {
  // Estado para a foto de perfil
  const [fotoPerfil, setFotoPerfil] = useState(
    funcionario?.foto_perfil || "https://i.pravatar.cc/150?u=" + (funcionario?.id || 'lucas')
  ); 

  // Inicializa o formulário com os dados do funcionário
  const { data, setData, put, processing, errors } = useForm({
    nome: funcionario?.nome || '',
    telefone: funcionario?.telefone || '',
    cargo: funcionario?.cargo || 'Atendente', // Valor padrão atualizado
    email: funcionario?.usuario?.email || '',
    password: '', 
    estabelecimento_id: funcionario?.estabelecimento_id || (estabelecimentos?.[0]?.id || ''),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Envia o PUT para a rota do Laravel (funcionarios.update)
    put(`/funcionarios/${funcionario?.id || 1}`);
  };

  const handleDesativar = () => {
    if (confirm('Tem certeza que deseja inativar este funcionário?')) {
      router.delete(`/funcionarios/${funcionario?.id || 1}`);
    }
  };

  return (
    <AuthenticatedLayout
      user={auth?.user}
      header={<h2 className="hidden">Editar Funcionário</h2>}
    >
      <Head title="Editar Funcionário" />

      {/* Fundo aplicado conforme solicitado FBF9F9 */}
      <div className="min-h-screen bg-[#FBF9F9] p-4 md:p-8 font-sans text-gray-800">
        <form onSubmit={handleSubmit} className="max-w-[1200px] mx-auto">
          
          {/* Header & Breadcrumbs */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <span>Funcionários</span>
                <ChevronRight className="w-4 h-4 mx-1" />
                <span className="font-medium text-gray-900">Editar funcionário</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Editar Funcionário</h1>
              <p className="text-gray-500 text-sm mt-1">Atualize as informações e permissões do funcionário.</p>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => window.history.back()}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              
              <button 
                type="button"
                onClick={handleDesativar}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Desativar funcionário
              </button>

              {/* Botão Salvar Ativo */}
              <button 
                type="submit"
                disabled={processing}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${
                  processing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Check className="w-4 h-4" />
                {processing ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Coluna Esquerda - Resumo do Perfil */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center">
                
                {/* Foto de Perfil */}
                <div className="relative mb-3 group cursor-pointer">
                  <img 
                    src={fotoPerfil} 
                    alt="Foto do Funcionário" 
                    className="w-24 h-24 rounded-full object-cover border border-gray-100"
                  />
                  <div className="absolute bottom-0 right-0 bg-white border border-gray-200 p-1.5 rounded-full shadow-sm hover:bg-gray-50 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                </div>
                <span className="text-xs text-gray-500 font-medium mb-5 cursor-pointer hover:text-gray-700">Trocar foto</span>

                <h2 className="text-lg font-bold text-gray-900">{data.nome || 'Nome do Funcionário'}</h2>
                <span className="text-sm text-gray-500 mb-6">{data.cargo || 'Cargo não definido'}</span>

                <div className="w-full space-y-4 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate">{data.email || 'Sem e-mail cadastrado'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{data.telefone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {/* Se você tiver a data de criação vindo do backend, pode colocar aqui */}
                        15/03/2022
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Data de admissão</p>
                    </div>
                  </div>
                </div>

                <div className="w-full mt-6 space-y-4 pt-5 border-t border-gray-100">
                  <div>
                    <p className={`text-sm font-bold ${funcionario?.ativo !== false ? 'text-green-600' : 'text-red-600'}`}>
                      {funcionario?.ativo !== false ? 'Ativo' : 'Inativo'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Status do funcionário</p>
                  </div>
                  
                  <div className="bg-[#FAFAFA] rounded-xl p-4 border border-gray-100 w-full mt-4">
                    <p className="text-xs text-gray-400 mb-1">Último acesso</p>
                    <p className="text-sm font-bold text-gray-900">N/A</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Coluna Direita - Formulários */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Card 1: Informações Pessoais */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Informações pessoais</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome completo</label>
                    <input 
                      type="text" 
                      value={data.nome}
                      onChange={(e) => setData('nome', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                    {errors.nome && <span className="text-red-500 text-xs mt-1">{errors.nome}</span>}
                  </div>
                  
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data de nascimento</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        defaultValue="12/06/1990"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                      />
                      <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Espaçador invisível para empurrar o resto para baixo na grid como na imagem */}
                  <div className="hidden md:block"></div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                    <input 
                      type="email" 
                      value={data.email}
                      onChange={(e) => setData('email', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                    {errors.email && <span className="text-red-500 text-xs mt-1">{errors.email}</span>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input 
                      type="text" 
                      value={data.telefone}
                      onChange={(e) => setData('telefone', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                    {errors.telefone && <span className="text-red-500 text-xs mt-1">{errors.telefone}</span>}
                  </div>
                </div>
              </div>

              {/* Card 2: Função e Permissões */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Função e permissões</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Função atual</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserSquare2 className="h-4 w-4 text-gray-400" />
                      </div>
                      <select 
                        disabled
                        className="w-full pl-10 pr-10 py-2.5 appearance-none rounded-lg border border-gray-200 bg-[#FAFAFA] text-gray-600 focus:outline-none text-sm cursor-not-allowed"
                      >
                        {/* Exibe o cargo salvo no banco, se não tiver mostra o do formulário */}
                        <option>{funcionario?.cargo || data.cargo}</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronRight className="h-4 w-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alterar função</label>
                    <div className="relative">
                      <select 
                        value={data.cargo}
                        onChange={(e) => setData('cargo', e.target.value)}
                        className="w-full px-4 pr-10 py-2.5 appearance-none rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm bg-white"
                      >
                        <option value="" disabled>Selecione uma nova função</option>
                        {/* Opções ajustadas conforme solicitado */}
                        <option value="Atendente">Atendente</option>
                        <option value="Gerente">Gerente</option>
                        <option value="Proprietário">Proprietário</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronRight className="h-4 w-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                    {errors.cargo && <span className="text-red-500 text-xs mt-1">{errors.cargo}</span>}
                  </div>
                </div>

                {/* Caixa Informativa (Alerta) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-gray-200 rounded-xl p-4 mb-8 gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <Briefcase className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed max-w-sm">
                      Ao alterar a função, as permissões de acesso serão atualizadas automaticamente conforme o perfil selecionado.
                    </p>
                  </div>
                  <button type="button" className="shrink-0 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                    Ver detalhes das funções
                  </button>
                </div>

                {/* Permissões Atribuídas */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Permissões atribuídas</h4>
                  <p className="text-sm text-gray-500 mb-4">Essas são as principais permissões do perfil atual.</p>
                  
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      "Gerenciar agendamentos",
                      "Cadastrar clientes",
                      "Visualizar serviços",
                      "Gerenciar pagamentos",
                      "Emitir relatórios"
                    ].map((perm, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-sm">
                        <Check className="w-3.5 h-3.5 text-gray-500" />
                        {perm}
                      </div>
                    ))}
                    <div className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500 shadow-sm">
                      + 3 permissões
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  );
}