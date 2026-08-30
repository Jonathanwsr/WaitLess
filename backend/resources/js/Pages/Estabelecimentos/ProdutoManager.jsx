import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
  ShoppingBagIcon,
  PlusIcon,
  TagIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  SwatchIcon,
  ArrowsRightLeftIcon,
  FolderIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  LinkIcon,
  StarIcon,
  FireIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  TrashIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  FunnelIcon
} from '@heroicons/react/24/solid';

export default function ProdutoManager({ auth, estabelecimentoId, estabelecimentos = [], listaServicos = [] }) {
  const [produtos, setProdutos] = useState([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState(listaServicos);
  
  const [showForm, setShowForm] = useState(false);
  const [isEditingProduto, setIsEditingProduto] = useState(false);

  // Estados de Filtro e Paginação
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Gerenciamento das 5 fotos em quadrados
  const [quadradosFotosProduto, setQuadradosFotosProduto] = useState([null, null, null, null, null]);

  const defaultEstabelecimentoId = estabelecimentoId || (estabelecimentos.length > 0 ? estabelecimentos[0].id : '');

  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    descricao: '',
    cor: '',
    tamanho: '',
    categoria: '',
    sub_categoria: '',
    valor_normal: '',
    valor_promocional: '',
    estoque_disponivel: 0,
    estabelecimento_id: defaultEstabelecimentoId,
    promocao: false,
    atrelado_reservas: false,
    somente_premium: false,
    servico_id: '',
    fotos_existentes: []
  });

  useEffect(() => {
    fetchProdutos();
    if (servicosDisponiveis.length === 0) {
      fetchServicos();
    }
  }, []);

  const fetchProdutos = async () => {
    try {
      const response = await axios.get('/meus-produtos/json');
      setProdutos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  const fetchServicos = async () => {
    try {
      const response = await axios.get('/meus-servicos/json');
      setServicosDisponiveis(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao buscar serviços:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFotoProdutoQuadrado = (index, arquivoSelecionado) => {
    if (!arquivoSelecionado) return;
    const novaLista = [...quadradosFotosProduto];
    novaLista[index] = arquivoSelecionado;
    setQuadradosFotosProduto(novaLista);
  };

  const removerFotoProdutoQuadrado = (index) => {
    const novaLista = [...quadradosFotosProduto];
    novaLista[index] = null;
    setQuadradosFotosProduto(novaLista);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dataToSend = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'fotos_existentes') {
        const fotosExistentes = quadradosFotosProduto.filter(f => typeof f === 'string' && f !== null);
        dataToSend.append('fotos_existentes', JSON.stringify(fotosExistentes));
      } else if (typeof formData[key] === 'boolean') {
        dataToSend.append(key, formData[key] ? 1 : 0);
      } else if (formData[key] !== null && formData[key] !== '') {
        dataToSend.append(key, formData[key]);
      }
    });

    const arquivosNovos = quadradosFotosProduto.filter(f => f instanceof File);
    arquivosNovos.forEach((foto, index) => {
      dataToSend.append(`fotos[${index}]`, foto);
    });

    if (isEditingProduto) {
      dataToSend.append('_method', 'PUT'); 
    }

    const url = isEditingProduto ? `/produtos/${formData.id}` : '/produtos';

    try {
      await axios.post(url, dataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert(isEditingProduto ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!');
      fetchProdutos();
      cancelarEdicaoProduto();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      if (error.response?.status === 419) {
        alert('Sessão expirada. Recarregue a página (F5) e tente novamente.');
      } else {
        alert(error.response?.data?.error || error.response?.data?.message || 'Erro ao processar o formulário. Verifique os dados inseridos.');
      }
    }
  };

  const editarProduto = (produto) => {
    setIsEditingProduto(true);
    setShowForm(true);

    let parsedFotos = [];
    try {
      parsedFotos = produto.fotos ? JSON.parse(produto.fotos) : [];
    } catch (e) {
      parsedFotos = [];
    }

    const newQuadrados = [null, null, null, null, null];
    parsedFotos.forEach((url, i) => { if (i < 5) newQuadrados[i] = url; });
    setQuadradosFotosProduto(newQuadrados);

    setFormData({
      id: produto.id,
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      cor: produto.cor || '',
      tamanho: produto.tamanho || '',
      categoria: produto.categoria || '',
      sub_categoria: produto.sub_categoria || '',
      valor_normal: produto.valor_normal || produto.valor_final || '',
      valor_promocional: produto.valor_promocional || '',
      estoque_disponivel: produto.estoque_disponivel || 0,
      estabelecimento_id: produto.estabelecimento_id || defaultEstabelecimentoId,
      promocao: produto.promocao == 1 || produto.promocao === true || produto.is_promocao == 1,
      atrelado_reservas: produto.atrelado_reservas == 1 || produto.atrelado_reservas === true,
      somente_premium: produto.somente_premium == 1 || produto.somente_premium === true,
      servico_id: produto.servico_id || '',
      fotos_existentes: parsedFotos
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicaoProduto = () => {
    setIsEditingProduto(false);
    setShowForm(false);
    setQuadradosFotosProduto([null, null, null, null, null]);
    setFormData({
      id: null, nome: '', descricao: '', cor: '', tamanho: '', categoria: '', sub_categoria: '',
      valor_normal: '', valor_promocional: '', estoque_disponivel: 0,
      estabelecimento_id: defaultEstabelecimentoId, promocao: false, atrelado_reservas: false, somente_premium: false, servico_id: '', fotos_existentes: []
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Atenção! Tem certeza que deseja excluir este produto permanentemente?")) return;

    try {
      await axios.delete(`/produtos/${id}`);
      fetchProdutos();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Erro ao excluir produto.");
    }
  };

  const handleAddEstoque = async (id) => {
    const qtd = prompt("Quantas unidades deseja adicionar ao estoque?");
    if (!qtd || isNaN(qtd) || qtd <= 0) return;

    try {
      await axios.patch(`/produtos/${id}/estoque`, { quantidade: parseInt(qtd) });
      fetchProdutos();
      alert("Estoque atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar estoque:", error);
      alert("Erro ao atualizar estoque.");
    }
  };

  // --- LÓGICA DE FILTROS E PAGINAÇÃO ---
  const categoriasUnicas = ['Todas', ...new Set(produtos.map(p => p.categoria || 'Outros').filter(Boolean))];
  
  const produtosFiltrados = categoriaFiltro === 'Todas' 
    ? produtos 
    : produtos.filter(p => (p.categoria || 'Outros') === categoriaFiltro);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = produtosFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(produtosFiltrados.length / itemsPerPage);

  const mudarCategoria = (cat) => {
    setCategoriaFiltro(cat);
    setCurrentPage(1);
  };

  return (
    <AuthenticatedLayout
      user={auth?.user}
      header={
        <h2 className="font-semibold text-xl text-gray-800 leading-tight flex items-center gap-2">
          <ShoppingBagIcon className="w-6 h-6 text-[#FF5A00]" />
          Gestão de Produtos
        </h2>
      }
    >
      <Head title="Meus Produtos" />

      <div className="py-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          
          {/* CABEÇALHO DA PÁGINA */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-4 sm:px-0">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo da Loja</h1>
              <p className="text-sm text-gray-500 mt-1">Gerencie os produtos, valores e disponibilidade de estoque.</p>
            </div>
            {!showForm && (
              <button 
                onClick={() => setShowForm(true)} 
                className="w-full md:w-auto bg-[#FF5A00] hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <PlusIcon className="w-5 h-5" /> Adicionar Produto
              </button>
            )}
          </div>

          {/* FORMULÁRIO (CRIAR / EDITAR) */}
          {showForm && (
            <div className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-gray-100 mb-8 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                  <TagIcon className="w-8 h-8 text-[#FF5A00]" />
                  {isEditingProduto ? 'Editar Informações do Produto' : 'Cadastrar Novo Produto'}
                </h3>
                <button onClick={cancelarEdicaoProduto} className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 hover:bg-red-50 rounded-full">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* INFORMAÇÕES PRINCIPAIS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* SELEÇÃO DO ESTABELECIMENTO */}
                  {estabelecimentos.length > 0 && (
                    <div className="md:col-span-3 bg-orange-50/40 p-4 rounded-2xl border border-orange-100">
                      <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <BriefcaseIcon className="w-4 h-4 text-[#FF5A00]" /> Estabelecimento Pertencente *
                      </label>
                      <select
                        required
                        name="estabelecimento_id"
                        value={formData.estabelecimento_id}
                        onChange={handleInputChange}
                        className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm outline-none bg-white font-medium"
                      >
                        <option value="">-- Selecione o Estabelecimento --</option>
                        {estabelecimentos.map(est => (
                          <option key={est.id} value={est.id}>
                            {est.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Produto *</label>
                    <input required type="text" name="nome" maxLength={100} value={formData.nome} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none" placeholder="Ex: Cera Modeladora, Camiseta, etc." />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><ArchiveBoxIcon className="w-4 h-4 text-gray-400" /> Estoque Inicial *</label>
                    <input required type="number" min="0" max="99999" name="estoque_disponivel" value={formData.estoque_disponivel} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none" placeholder="0" />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><SwatchIcon className="w-4 h-4 text-gray-400" /> Cor (Opcional)</label>
                    <input type="text" name="cor" maxLength={30} value={formData.cor} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none" placeholder="Ex: Preto, Azul" />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><ArrowsRightLeftIcon className="w-4 h-4 text-gray-400" /> Tamanho (Opcional)</label>
                    <input type="text" name="tamanho" maxLength={30} value={formData.tamanho} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none" placeholder="Ex: 50cm, M, G, 500ml" />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FolderIcon className="w-4 h-4 text-gray-400" /> Categoria</label>
                    <input type="text" name="categoria" maxLength={50} value={formData.categoria} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none" placeholder="Ex: Cosméticos, Bebidas" />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Descrição Completa</label>
                    <textarea name="descricao" maxLength={500} rows="3" value={formData.descricao} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm transition-shadow outline-none resize-none" placeholder="Detalhes, ingredientes ou instruções do produto..."></textarea>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* PRECIFICAÇÃO E PROMOÇÃO */}
                <div className="bg-orange-50/50 p-6 md:p-8 rounded-3xl border border-orange-100 space-y-6">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><CurrencyDollarIcon className="w-6 h-6 text-[#FF5A00]" /> Valores e Precificação</h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Valor Base (R$) *</label>
                      <input required type="number" step="0.01" min="0" name="valor_normal" value={formData.valor_normal} onChange={handleInputChange} className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm outline-none" placeholder="0.00" />
                    </div>

                    <div className="pb-3">
                      <label className="flex items-center gap-3 font-bold text-gray-800 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input type="checkbox" name="promocao" checked={formData.promocao} onChange={handleInputChange} className="w-6 h-6 text-green-600 rounded-md border-gray-300 focus:ring-green-500 cursor-pointer" />
                        </div>
                        <span className="flex items-center gap-2 group-hover:text-green-700 transition-colors"><FireIcon className="w-5 h-5 text-green-500"/> Ativar Preço Promocional?</span>
                      </label>
                    </div>

                    {formData.promocao && (
                      <div className="animate-in fade-in slide-in-from-top-4">
                        <label className="block text-sm font-bold text-green-700 mb-2">Valor com Desconto (R$) *</label>
                        <input required type="number" step="0.01" min="0" name="valor_promocional" value={formData.valor_promocional} onChange={handleInputChange} className="w-full border-2 border-green-400 bg-green-50 rounded-xl p-3 text-sm focus:border-green-600 focus:ring-green-500 shadow-sm outline-none transition-colors" placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* GALERIA DE FOTOS */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-bold text-gray-900 flex items-center gap-2"><PhotoIcon className="w-5 h-5 text-gray-400"/> Galeria de Fotos (Máximo 5)</label>
                    <p className="text-xs text-gray-500 mt-1">Carregue imagens com boa iluminação. A primeira foto da lista será a capa principal na loja.</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    {[0, 1, 2, 3, 4].map((index) => {
                      const arquivo = quadradosFotosProduto[index];
                      const previewUrl = arquivo instanceof File ? URL.createObjectURL(arquivo) : arquivo;
                      const isCapa = index === 0;
                      return (
                        <div key={index} className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 group">
                          {arquivo ? (
                            <>
                              <img src={previewUrl} className={`w-full h-full object-cover rounded-2xl shadow-sm ${isCapa ? 'border-2 border-[#FF5A00]' : 'border border-gray-200'}`} alt={`Upload ${index}`} />
                              {isCapa && <div className="absolute bottom-0 left-0 w-full bg-[#FF5A00]/95 text-white text-[10px] font-bold text-center py-1.5 rounded-b-2xl uppercase tracking-widest backdrop-blur-sm">Capa Principal</div>}
                              <button type="button" onClick={() => removerFotoProdutoQuadrado(index)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-md z-10 transition-transform hover:scale-110"><XMarkIcon className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <label className={`cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-colors ${isCapa ? 'border-orange-300 bg-orange-50/50 hover:border-[#FF5A00] hover:bg-orange-100/50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'}`}>
                              <span className={`text-2xl font-light mb-1 ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400'}`}><PlusIcon className="w-6 h-6" /></span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400'}`}>{isCapa ? 'Adicionar Capa' : `Foto ${index + 1}`}</span>
                              <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={(e) => handleFotoProdutoQuadrado(index, e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* VÍNCULOS E REGRAS */}
                <div className="flex flex-col gap-8 bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-200">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><BriefcaseIcon className="w-6 h-6 text-gray-500" /> Regras e Integrações</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex items-start gap-4 cursor-pointer bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-300 transition-colors">
                      <div className="pt-1">
                        <input type="checkbox" name="atrelado_reservas" checked={formData.atrelado_reservas} onChange={handleInputChange} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-gray-900 block flex items-center gap-2"><LinkIcon className="w-4 h-4 text-blue-500"/> Permitir Vínculo a Serviços/Reservas</span>
                        <span className="text-xs text-gray-500 mt-1 block leading-relaxed">Permite que os clientes adicionem este produto como um "Item Extra" durante o agendamento ou aluguel.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-4 cursor-pointer bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-amber-300 transition-colors">
                      <div className="pt-1">
                        <input type="checkbox" name="somente_premium" checked={formData.somente_premium} onChange={handleInputChange} className="w-5 h-5 text-amber-500 rounded border-gray-300 focus:ring-amber-500" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-gray-900 block flex items-center gap-2"><StarIcon className="w-4 h-4 text-amber-500"/> Exclusivo para Assinantes Premium</span>
                        <span className="text-xs text-gray-500 mt-1 block leading-relaxed">Oculta o produto do público geral. Somente clientes com planos de assinatura ativos poderão comprar.</span>
                      </div>
                    </label>
                  </div>

                  {/* Vínculo a Serviço Específico */}
                  <div className="w-full md:w-1/2 pt-2">
                    <label className="block text-sm font-bold text-gray-900 mb-2">Vincular a um Serviço Específico</label>
                    <select
                      name="servico_id"
                      className="w-full border-gray-200 rounded-xl p-3.5 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] shadow-sm outline-none bg-white"
                      value={formData.servico_id}
                      onChange={handleInputChange}
                    >
                      <option value="">Nenhum - Venda Avulsa</option>
                      {servicosDisponiveis && servicosDisponiveis.map(servico => (
                        <option key={servico.id} value={servico.id}>
                          {servico.nome}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><InformationCircleIcon className="w-4 h-4" /> Caso selecione um serviço, a venda deste item será atrelada a ele.</p>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="flex flex-col-reverse sm:flex-row justify-end pt-4 gap-4">
                  <button type="button" onClick={cancelarEdicaoProduto} className="w-full sm:w-auto px-8 py-4 text-gray-600 font-bold bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="w-full sm:w-auto px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95">
                    <CheckCircleIcon className="w-5 h-5" />
                    {isEditingProduto ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FILTRO DE CATEGORIAS */}
          {!showForm && produtos.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-6 mb-2 scrollbar-hide px-4 sm:px-0">
              <div className="flex items-center gap-2 text-gray-400 pr-2">
                <FunnelIcon className="w-5 h-5" />
              </div>
              {categoriasUnicas.map(cat => (
                <button
                  key={cat}
                  onClick={() => mudarCategoria(cat)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border shadow-sm ${categoriaFiltro === cat ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* GRID DE PRODUTOS CADASTRADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4 sm:px-0 mb-12">
            {produtosFiltrados.length === 0 && !showForm ? (
              <div className="col-span-full bg-white text-center py-20 rounded-3xl border border-gray-200 border-dashed text-gray-500 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBagIcon className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum produto encontrado</h3>
                <p className="text-sm">Tente selecionar outra categoria ou adicione um novo produto.</p>
              </div>
            ) : (
              currentItems.map(produto => {
                let fotoUrl = null;
                if (produto.fotos) {
                  try {
                    const parsed = JSON.parse(produto.fotos);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      const primeiraFoto = parsed[0];
                      fotoUrl = primeiraFoto.startsWith('http') ? primeiraFoto : `/storage/${primeiraFoto}`;
                    }
                  } catch (e) {
                    fotoUrl = null;
                  }
                }

                return (
                  <div key={produto.id} className="bg-white border border-gray-100 rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">

                    <div className="relative h-56 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={produto.nome} className="object-cover w-full h-full group-hover:scale-110 transition duration-700 ease-in-out" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-300">
                          <PhotoIcon className="w-12 h-12 mb-2" />
                          <span className="text-xs font-bold tracking-widest uppercase">Sem Foto</span>
                        </div>
                      )}

                      {/* Tags Dinâmicas */}
                      <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
                        {(produto.promocao == 1 || produto.is_promocao == 1) && (
                          <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5"><FireIcon className="w-3 h-3"/> Oferta</span>
                        )}
                        {produto.somente_premium == 1 && (
                          <span className="bg-amber-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5"><StarIcon className="w-3 h-3"/> Premium</span>
                        )}
                      </div>

                      <div className="absolute top-3 right-3">
                        {produto.estoque_disponivel <= 0 ? (
                          <span className="bg-red-600/90 backdrop-blur text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 border border-red-500"><ExclamationCircleIcon className="w-3.5 h-3.5"/> Esgotado</span>
                        ) : (
                          <span className="bg-white/90 backdrop-blur text-gray-800 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-md shadow-sm border border-gray-200">Estoque: <span className="text-blue-600">{produto.estoque_disponivel}</span></span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-black text-gray-900 mb-1 text-lg leading-tight line-clamp-2">{produto.nome}</h3>
                      <p className="text-[11px] font-bold text-gray-400 mb-4 line-clamp-1 uppercase tracking-wider">
                        {produto.categoria} {produto.tamanho ? `• ${produto.tamanho}` : ''} {produto.cor ? `• ${produto.cor}` : ''}
                      </p>

                      <div className="mt-auto pt-2 border-t border-gray-50">
                        {(produto.promocao == 1 || produto.is_promocao == 1) ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 line-through">R$ {Number(produto.valor_normal).toFixed(2).replace('.', ',')}</span>
                            <p className="text-2xl font-black text-green-600 tracking-tight">
                              R$ {Number(produto.valor_promocional || produto.valor_final).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                        ) : (
                          <p className="text-2xl font-black text-gray-800 tracking-tight mt-4">
                            R$ {Number(produto.valor_normal || produto.valor_final).toFixed(2).replace('.', ',')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 p-3 bg-gray-50/80 flex items-center justify-between">
                      <button onClick={() => handleAddEstoque(produto.id)} className="text-blue-600 hover:text-white hover:bg-blue-600 bg-white border border-blue-200 hover:border-transparent transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm" title="Adicionar ao Estoque">
                        <PlusIcon className="w-3.5 h-3.5"/> Repor
                      </button>

                      <div className="flex gap-1.5">
                        <button onClick={() => editarProduto(produto)} className="bg-white border border-gray-200 text-gray-600 hover:text-[#FF5A00] hover:border-[#FF5A00] transition-colors p-2 rounded-lg shadow-sm" title="Editar Produto">
                          <DocumentTextIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(produto.id)} className="bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-600 hover:bg-red-50 transition-colors p-2 rounded-lg shadow-sm" title="Excluir Produto Permanente">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PAGINAÇÃO */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white p-5 border border-gray-200 rounded-2xl shadow-sm mx-4 sm:mx-0">
              <span className="text-sm font-bold text-gray-500">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-40 transition-colors">Voltar</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-40 transition-colors">Avançar</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  );
}