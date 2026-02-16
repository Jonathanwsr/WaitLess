import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function Configuracoes({ auth, estabelecimento, meusEstabelecimentos, funcionarios, servicos }) {
    const [activeTab, setActiveTab] = useState('detalhes'); // Inicia na aba de perfil
    const [isEditingFuncionario, setIsEditingFuncionario] = useState(false);

    // ==========================================
    // ESTADOS PARA PAGINAÇÃO DAS FILIAIS
    // ==========================================
    const itensPorPagina = 4;
    const [paginaFiliais, setPaginaFiliais] = useState(1);
    const totalPaginasFiliais = Math.ceil(meusEstabelecimentos.length / itensPorPagina);
    const filiaisPaginadas = meusEstabelecimentos.slice((paginaFiliais - 1) * itensPorPagina, paginaFiliais * itensPorPagina);

    // ==========================================
    // FORM 1: DETALHES DO ESTABELECIMENTO
    // ==========================================
    const formDetalhes = useForm({
        nome: estabelecimento.nome || '',
        ramo_atuacao: estabelecimento.ramo_atuacao || '',
        telefone: estabelecimento.telefone || '',
        cep: estabelecimento.cep || '',
        rua: estabelecimento.rua || '',
        numero: estabelecimento.numero || '',
        complemento: estabelecimento.complemento || '',
        bairro: estabelecimento.bairro || '',
        cidade: estabelecimento.cidade || '',
        estado: estabelecimento.estado || '',
    });

    const submitDetalhes = (e) => {
        e.preventDefault();
        formDetalhes.put(route('estabelecimentos.update', estabelecimento.id), {
            preserveScroll: true,
        });
    };

    // Função que chama o banco de dados para ligar/desligar o estabelecimento
    const toggleStatusEstabelecimento = () => {
        const acao = estabelecimento.ativo ? 'desativar' : 'ativar';
        if (confirm(`Tem a certeza que deseja ${acao} este estabelecimento?`)) {
            router.patch(route('estabelecimentos.toggle-status', estabelecimento.id), {}, { preserveScroll: true });
        }
    };

    // ==========================================
    // FORM 2: SERVIÇOS
    // ==========================================
    const formServico = useForm({
        nome: '',
        descricao: '',
        valor: '',
        duracao_minutos: '30',
        funcionario_id: '',
        tipo_pagamento: 'hibrido',
        dias_disponiveis: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
        estabelecimentos_ids: [estabelecimento.id],
    });

    const submitServico = (e) => {
        e.preventDefault();
        formServico.post(route('servicos.store'), {
            preserveScroll: true,
            onSuccess: () => formServico.reset('nome', 'descricao', 'valor'),
        });
    };

    // ==========================================
    // FORM 3: EQUIPE / FUNCIONÁRIOS
    // ==========================================
    const formFuncionario = useForm({
        id: null,
        nome: '',
        telefone: '',
        cargo: 'Atendente',
        email: '',
        password: '',
    });

    const submitFuncionario = (e) => {
        e.preventDefault();
        if (isEditingFuncionario) {
            formFuncionario.put(route('funcionarios.update', formFuncionario.data.id), {
                preserveScroll: true,
                onSuccess: () => cancelarEdicaoFuncionario(),
            });
        } else {
            formFuncionario.post(route('funcionarios.store', estabelecimento.id), {
                preserveScroll: true,
                onSuccess: () => formFuncionario.reset('nome', 'telefone', 'email', 'password'),
            });
        }
    };

    const editarFuncionario = (func) => {
        setIsEditingFuncionario(true);
        formFuncionario.setData({
            id: func.id,
            nome: func.nome,
            telefone: func.telefone || '',
            cargo: func.cargo || 'Atendente',
            email: '', 
            password: '', 
        });
    };

    const cancelarEdicaoFuncionario = () => {
        setIsEditingFuncionario(false);
        formFuncionario.reset();
        formFuncionario.clearErrors();
    };

    const deletarFuncionario = (id) => {
        if (confirm('Tem certeza que deseja desativar/remover este funcionário?')) {
            router.delete(route('funcionarios.destroy', id), { preserveScroll: true });
        }
    };

    const handleDiaToggle = (dia) => {
        const novosDias = formServico.data.dias_disponiveis.includes(dia)
            ? formServico.data.dias_disponiveis.filter(d => d !== dia)
            : [...formServico.data.dias_disponiveis, dia];
        formServico.setData('dias_disponiveis', novosDias);
    };

    const handleFilialToggle = (id) => {
        const novasFiliais = formServico.data.estabelecimentos_ids.includes(id)
            ? formServico.data.estabelecimentos_ids.filter(estId => estId !== id)
            : [...formServico.data.estabelecimentos_ids, id];
        formServico.setData('estabelecimentos_ids', novasFiliais);
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
                                Configurações
                                {estabelecimento.ativo ? (
                                    <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 uppercase tracking-wider">
                                        Loja Ativa
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full border border-red-200 uppercase tracking-wider">
                                        Desativado
                                    </span>
                                )}
                            </h2>
                            <p className="text-sm text-gray-500">{estabelecimento.nome}</p>
                        </div>
                    </div>
                    <Link href={route('estabelecimentos.fila', estabelecimento.id)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg transition">
                        Ver Fila →
                    </Link>
                </div>
            }
        >
            <Head title={`Configurações - ${estabelecimento.nome}`} />

            <div className="max-w-7xl mx-auto mt-6 flex flex-col md:flex-row gap-8 pb-12">
                
                {/* --- MENU LATERAL (TABS) --- */}
                <aside className="w-full md:w-64 shrink-0">
                    <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
                        <button 
                            onClick={() => setActiveTab('detalhes')}
                            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'detalhes' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            1. Perfil da Loja
                        </button>
                        <button 
                            onClick={() => setActiveTab('equipe')}
                            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'equipe' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            2. Equipe / Profissionais
                        </button>
                        <button 
                            onClick={() => setActiveTab('servicos')}
                            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === 'servicos' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            3. Catálogo de Serviços
                        </button>
                    </nav>
                </aside>

                {/* --- CONTEÚDO PRINCIPAL --- */}
                <main className="flex-1 min-w-0">

                    {/* =========================================
                        ABA 1: DETALHES DA LOJA E NAVEGAÇÃO
                    ========================================= */}
                    {activeTab === 'detalhes' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            
                            {/* Formulário de Perfil */}
                            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Informações Básicas</h3>
                                
                                <form onSubmit={submitDetalhes} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <InputLabel value="Nome do Estabelecimento *" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.nome} onChange={e => formDetalhes.setData('nome', e.target.value)} required />
                                            <InputError message={formDetalhes.errors.nome} />
                                        </div>
                                        <div>
                                            <InputLabel value="Ramo de Atuação" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.ramo_atuacao} onChange={e => formDetalhes.setData('ramo_atuacao', e.target.value)} placeholder="Ex: Barbearia" />
                                            <InputError message={formDetalhes.errors.ramo_atuacao} />
                                        </div>
                                        <div>
                                            <InputLabel value="Telefone de Contato" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.telefone} onChange={e => formDetalhes.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                            <InputError message={formDetalhes.errors.telefone} />
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-8 mb-4 pt-6 border-t border-gray-100 dark:border-gray-700">Endereço</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                        <div className="md:col-span-2">
                                            <InputLabel value="CEP" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.cep} onChange={e => formDetalhes.setData('cep', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-4">
                                            <InputLabel value="Rua / Avenida" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.rua} onChange={e => formDetalhes.setData('rua', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputLabel value="Número" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.numero} onChange={e => formDetalhes.setData('numero', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-4">
                                            <InputLabel value="Complemento" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.complemento} onChange={e => formDetalhes.setData('complemento', e.target.value)} placeholder="Sala, Loja, etc." />
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputLabel value="Bairro" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.bairro} onChange={e => formDetalhes.setData('bairro', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <InputLabel value="Cidade" />
                                            <TextInput className="mt-1 w-full" value={formDetalhes.data.cidade} onChange={e => formDetalhes.setData('cidade', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-1">
                                            <InputLabel value="UF" />
                                            <TextInput className="mt-1 w-full uppercase" maxLength="2" value={formDetalhes.data.estado} onChange={e => formDetalhes.setData('estado', e.target.value.toUpperCase())} />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-6">
                                        <PrimaryButton className="px-8 py-3 bg-indigo-600 rounded-xl shadow-lg" disabled={formDetalhes.processing}>
                                            Salvar Alterações
                                        </PrimaryButton>
                                    </div>
                                </form>
                            </div>

                            {/* ZONA DE PERIGO (ATIVAR / DESATIVAR) */}
                            <div className={`p-6 sm:p-8 rounded-2xl shadow-sm border ${estabelecimento.ativo ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
                                <h3 className={`text-lg font-bold mb-2 ${estabelecimento.ativo ? 'text-red-800 dark:text-red-400' : 'text-green-800 dark:text-green-400'}`}>
                                    {estabelecimento.ativo ? 'Desativar Estabelecimento' : 'Ativar Estabelecimento'}
                                </h3>
                                <p className={`text-sm mb-6 ${estabelecimento.ativo ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}`}>
                                    {estabelecimento.ativo 
                                        ? 'Ao desativar, a sua loja deixará de aparecer para os clientes e não aceitará mais agendamentos. Pode reativar a qualquer momento.' 
                                        : 'A sua loja está fechada ao público. Clique no botão abaixo para ativar a loja e voltar a receber agendamentos online.'}
                                </p>
                                
                                <button 
                                    onClick={toggleStatusEstabelecimento}
                                    className={`px-6 py-3 text-sm font-bold rounded-xl shadow-sm transition text-white ${estabelecimento.ativo ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'}`}
                                >
                                    {estabelecimento.ativo ? 'Desativar Estabelecimento' : 'Ativar Estabelecimento'}
                                </button>
                            </div>

                            {/* NAVEGAÇÃO ENTRE AS FILIAIS DO USUÁRIO */}
                            {meusEstabelecimentos.length > 1 && (
                                <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mt-8">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Navegar entre minhas lojas</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filiaisPaginadas.map(est => (
                                            <div key={est.id} className={`p-4 rounded-xl border ${est.id === estabelecimento.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-gray-900 dark:text-white truncate pr-2">{est.nome}</span>
                                                    {est.ativo ? (
                                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase">Ativo</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-md uppercase">Inativo</span>
                                                    )}
                                                </div>
                                                {est.id === estabelecimento.id ? (
                                                    <span className="text-xs font-semibold text-indigo-600">📍 Você está aqui</span>
                                                ) : (
                                                    <Link href={route('estabelecimentos.configuracoes', est.id)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
                                                        Acessar Configurações →
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Controles de Paginação */}
                                    {totalPaginasFiliais > 1 && (
                                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <span className="text-sm text-gray-500">Página {paginaFiliais} de {totalPaginasFiliais}</span>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setPaginaFiliais(p => Math.max(1, p - 1))}
                                                    disabled={paginaFiliais === 1}
                                                    className="px-4 py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                                                >
                                                    Anterior
                                                </button>
                                                <button 
                                                    onClick={() => setPaginaFiliais(p => Math.min(totalPaginasFiliais, p + 1))}
                                                    disabled={paginaFiliais === totalPaginasFiliais}
                                                    className="px-4 py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                                                >
                                                    Próxima
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    )}


                    {/* =========================================
                        ABA 2: EQUIPE E PROFISSIONAIS
                    ========================================= */}
                    {activeTab === 'equipe' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            
                            {/* Formulário de Funcionário */}
                            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                                    {isEditingFuncionario ? '✏️ Editar Profissional' : '👨‍🔧 Cadastrar Novo Profissional (Com Acesso)'}
                                </h3>
                                
                                <form onSubmit={submitFuncionario} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-1">
                                            <InputLabel value="Nome Completo *" />
                                            <TextInput className="mt-1 w-full" value={formFuncionario.data.nome} onChange={e => formFuncionario.setData('nome', e.target.value)} required />
                                            <InputError message={formFuncionario.errors.nome} />
                                        </div>
                                        <div className="md:col-span-1">
                                            <InputLabel value="Telefone (Opcional)" />
                                            <TextInput className="mt-1 w-full" value={formFuncionario.data.telefone} onChange={e => formFuncionario.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                            <InputError message={formFuncionario.errors.telefone} />
                                        </div>
                                        <div className="md:col-span-1">
                                            <InputLabel value="Cargo / Papel no Sistema *" />
                                            <select className="mt-1 w-full py-3 border-gray-300 dark:bg-gray-900 dark:border-gray-700 rounded-lg shadow-sm focus:border-indigo-500" value={formFuncionario.data.cargo} onChange={e => formFuncionario.setData('cargo', e.target.value)} required>
                                                <option value="Atendente">Atendente / Recepção</option>
                                                <option value="Barbeiro">Barbeiro / Cabeleireiro</option>
                                                <option value="Médico">Médico(a) / Especialista</option>
                                                <option value="Mecânico">Mecânico</option>
                                                <option value="Gerente">Gerente</option>
                                                <option value="Socio">Sócio</option>
                                                <option value="Outro">Outro</option>
                                            </select>
                                            <InputError message={formFuncionario.errors.cargo} />
                                        </div>
                                        <div className="md:col-span-2 border-t border-gray-100 dark:border-gray-700 pt-6">
                                            <InputLabel value="E-mail de Acesso *" />
                                            <TextInput type="email" className="mt-1 w-full" value={formFuncionario.data.email} onChange={e => formFuncionario.setData('email', e.target.value)} required={!isEditingFuncionario} placeholder="email@exemplo.com" />
                                            <InputError message={formFuncionario.errors.email} />
                                        </div>
                                        <div className="md:col-span-1 border-t border-gray-100 dark:border-gray-700 pt-6">
                                            <InputLabel value="Senha de Acesso *" />
                                            <TextInput type="password" className="mt-1 w-full" value={formFuncionario.data.password} onChange={e => formFuncionario.setData('password', e.target.value)} required={!isEditingFuncionario} placeholder="Mínimo 8 caracteres" />
                                            <InputError message={formFuncionario.errors.password} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4 gap-4">
                                        {isEditingFuncionario && (
                                            <button type="button" onClick={cancelarEdicaoFuncionario} className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition">Cancelar</button>
                                        )}
                                        <PrimaryButton className="px-8 py-3 bg-indigo-600 rounded-xl shadow-lg" disabled={formFuncionario.processing}>
                                            {isEditingFuncionario ? 'Salvar Alterações' : '+ Cadastrar e Criar Acesso'}
                                        </PrimaryButton>
                                    </div>
                                </form>
                            </div>

                            {/* Lista de Equipe com Status Visual */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Equipe Atual ({funcionarios.length})</h3>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {funcionarios.length === 0 ? (
                                        <p className="p-6 text-gray-500 text-center">Nenhum profissional cadastrado.</p>
                                    ) : (
                                        funcionarios.map(func => (
                                            <div key={func.id} className={`p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center transition ${func.ativo ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-red-50/50 dark:bg-red-900/10 opacity-75'}`}>
                                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold uppercase ${func.ativo ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                                                        {func.nome.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className={`font-bold ${func.ativo ? 'text-gray-900 dark:text-white' : 'text-gray-500 line-through'}`}>{func.nome}</h4>
                                                            {func.ativo ? (
                                                                <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Ativo</span>
                                                            ) : (
                                                                <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Desativado</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 font-medium">{func.cargo} {func.telefone && `• ${func.telefone}`}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                                                    <button onClick={() => editarFuncionario(func)} className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg transition">Editar</button>
                                                    {func.ativo && (
                                                        <button onClick={() => deletarFuncionario(func.id)} className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg transition">Remover</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* =========================================
                        ABA 3: CATÁLOGO DE SERVIÇOS 
                    ========================================= */}
                    {activeTab === 'servicos' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Adicionar Novo Serviço</h3>
                                <form onSubmit={submitServico} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <InputLabel value="Nome do Serviço" />
                                            <TextInput className="mt-1 w-full" value={formServico.data.nome} onChange={e => formServico.setData('nome', e.target.value)} required />
                                            <InputError message={formServico.errors.nome} />
                                        </div>
                                        <div>
                                            <InputLabel value="Valor (R$)" />
                                            <TextInput type="number" step="0.01" className="mt-1 w-full" value={formServico.data.valor} onChange={e => formServico.setData('valor', e.target.value)} required />
                                            <InputError message={formServico.errors.valor} />
                                        </div>
                                        <div>
                                            <InputLabel value="Duração Estimada (minutos)" />
                                            <TextInput type="number" className="mt-1 w-full" value={formServico.data.duracao_minutos} onChange={e => formServico.setData('duracao_minutos', e.target.value)} required />
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputLabel value="Profissional Responsável (Opcional)" />
                                            <select className="mt-1 w-full border-gray-300 dark:bg-gray-900 dark:border-gray-700 rounded-lg shadow-sm" value={formServico.data.funcionario_id} onChange={e => formServico.setData('funcionario_id', e.target.value)}>
                                                <option value="">Qualquer profissional disponível</option>
                                                {funcionarios.map(func => (<option key={func.id} value={func.id}>{func.nome} ({func.cargo})</option>))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputLabel value="Dias Disponíveis para este serviço" className="mb-2" />
                                            <div className="flex flex-wrap gap-2">
                                                {['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].map(dia => (
                                                    <button type="button" key={dia} onClick={() => handleDiaToggle(dia)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors border ${formServico.data.dias_disponiveis.includes(dia) ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{dia.substring(0, 3)}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputLabel value="Regra de Pagamento" className="mb-2" />
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900 w-full transition"><input type="radio" name="pagamento" value="hibrido" checked={formServico.data.tipo_pagamento === 'hibrido'} onChange={e => formServico.setData('tipo_pagamento', e.target.value)} className="text-indigo-600" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente escolhe</span></label>
                                                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900 w-full transition"><input type="radio" name="pagamento" value="online" checked={formServico.data.tipo_pagamento === 'online'} onChange={e => formServico.setData('tipo_pagamento', e.target.value)} className="text-indigo-600" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Obrigatório Online</span></label>
                                            </div>
                                        </div>
                                        {meusEstabelecimentos.length > 1 && (
                                            <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800">
                                                <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-2">💡 Oferece este serviço em outras filiais?</h4>
                                                <div className="flex flex-wrap gap-4">
                                                    {meusEstabelecimentos.map(est => (
                                                        <label key={est.id} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={formServico.data.estabelecimentos_ids.includes(est.id)} onChange={() => handleFilialToggle(est.id)} disabled={est.id === estabelecimento.id} /><span className="text-sm font-bold text-gray-700 dark:text-gray-300">{est.nome}</span></label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <PrimaryButton className="px-8 py-3 bg-indigo-600 rounded-xl shadow-lg" disabled={formServico.processing}>+ Salvar Serviço</PrimaryButton>
                                    </div>
                                </form>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Serviços Ativos neste Local ({servicos.length})</h3>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {servicos.length === 0 ? (
                                        <p className="p-6 text-gray-500 text-center">Nenhum serviço cadastrado ainda.</p>
                                    ) : (
                                        servicos.map(s => (
                                            <div key={s.id} className="p-6 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{s.nome}</h4>
                                                    <p className="text-sm text-gray-500 font-medium">{s.duracao_minutos} min • R$ {s.valor}</p>
                                                </div>
                                                <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg transition">Editar</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </AuthenticatedLayout>
    );
}