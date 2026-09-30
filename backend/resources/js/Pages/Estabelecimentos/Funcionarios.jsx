import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import {
    MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon,
    UserIcon, EnvelopeIcon, LockClosedIcon, BriefcaseIcon, BuildingOfficeIcon,
    PhoneIcon, EyeIcon, StarIcon, CurrencyDollarIcon, CalendarIcon, ChartBarIcon,
    UserPlusIcon, SparklesIcon, BoltIcon,
} from '@heroicons/react/24/solid';
import PrimaryButton from '@/Components/PrimaryButton';
import InputError from '@/Components/InputError';

const ACAO_COR = {
    chamou: 'text-blue-600 bg-blue-50',
    finalizou: 'text-green-600 bg-green-50',
    status_atualizado: 'text-amber-600 bg-amber-50',
    adiou: 'text-orange-600 bg-orange-50',
    pulou: 'text-red-600 bg-red-50',
};

export default function Funcionarios({ auth, funcionarios = [], meusEstabelecimentos = [], podeGerenciarEquipeAvancada = false, atividadesRecentes = [] }) {
    const [busca, setBusca] = useState('');
    const [atividades, setAtividades] = useState(atividadesRecentes);

    // Assina o canal de cada estabelecimento pra ver em tempo real quem da
    // equipe está fazendo o quê (chamou, finalizou, cancelou...).
    useEffect(() => {
        if (!window.Echo || meusEstabelecimentos.length === 0) return;

        meusEstabelecimentos.forEach((est) => {
            const canal = window.Echo.private(`atividade-equipe.${est.id}`);
            canal.listen('.atividade.registrada', (payload) => {
                setAtividades((atual) => [{ id: `live-${Date.now()}`, ...payload }, ...atual].slice(0, 30));
            });
        });

        return () => {
            meusEstabelecimentos.forEach((est) => window.Echo.leave(`atividade-equipe.${est.id}`));
        };
    }, [meusEstabelecimentos]);

    const formatarHora = (iso) => {
        try {
            return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    // Controle dos Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modoEdicao, setModoEdicao] = useState(false);
    const [mostrarExplicacaoPapeis, setMostrarExplicacaoPapeis] = useState(false);

    const [isModalDetalhesOpen, setIsModalDetalhesOpen] = useState(false);
    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);

    // Formulário do Inertia
    const { data, setData, put, delete: destroy, processing, errors, reset, clearErrors } = useForm({
        id: '',
        nome: '',
        email: '',
        password: '',
        telefone: '',
        cargo: 'Atendente', 
        estabelecimento_id: meusEstabelecimentos.length > 0 ? meusEstabelecimentos[0].id : '', 
        ativo: true,
    });

    // Filtro Seguro
    const funcionariosFiltrados = funcionarios.filter(f => {
        const nome = f.nome || '';
        const email = f.usuario?.email || '';
        const local = f.estabelecimento?.nome || '';
        const termoBusca = busca.toLowerCase();

        return nome.toLowerCase().includes(termoBusca) ||
               email.toLowerCase().includes(termoBusca) ||
               local.toLowerCase().includes(termoBusca);
    });

    // Formatadores
    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    const formatarData = (dataString) => {
        if (!dataString) return 'N/A';
        const data = new Date(dataString);
        return data.toLocaleDateString('pt-BR');
    };

    // Ações dos Modais
    const abrirModalNovo = () => {
        setModoEdicao(false);
        reset();
        clearErrors();
        if (meusEstabelecimentos.length > 0) setData('estabelecimento_id', meusEstabelecimentos[0].id);
        setIsModalOpen(true);
    };

    const abrirModalEdicao = (func) => {
        setModoEdicao(true);
        clearErrors();
        setData({
            id: func.id,
            nome: func.nome || '',
            email: func.usuario?.email || '',
            password: '', 
            telefone: func.telefone || '',
            cargo: func.cargo || 'Atendente',
            estabelecimento_id: func.estabelecimento_id,
            ativo: func.ativo,
        });
        setIsModalOpen(true);
    };

    // Função que redireciona para a tela cheia de edição ao clicar na foto
    const irParaTelaEditar = (id) => {
        router.get(`/funcionarios/${id}/edit`);
    };

    const abrirModalDetalhes = (func) => {
        setFuncionarioSelecionado(func);
        setIsModalDetalhesOpen(true);
    };

    const fecharModais = () => {
        setIsModalOpen(false);
        setIsModalDetalhesOpen(false);
        reset();
    };

    const submit = (e) => {
        e.preventDefault();
        if (modoEdicao) {
            put(route('funcionarios.update', data.id), { onSuccess: () => fecharModais() });
        } else if (data.cargo === 'Sócio') {
            // Sócio não vira uma linha na tabela de funcionários — vai pro endpoint próprio de convite.
            router.post(`/estabelecimentos/${data.estabelecimento_id}/socios`, data, {
                onSuccess: () => fecharModais()
            });
        } else {
            // Adicionado o router.post customizado com a URL dinâmica conforme solicitado
            router.post(`/estabelecimentos/${data.estabelecimento_id}/funcionarios`, data, {
                onSuccess: () => fecharModais()
            });
        }
    };

    const deletarFuncionario = (id) => {
        if (confirm('Tem certeza que deseja inativar este funcionário?')) {
            destroy(route('funcionarios.destroy', id));
        }
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-bold leading-tight text-gray-800">Equipe e Desempenho</h2>}
        >
            <Head title="Funcionários - WaitLess" />

            {/* --- ATIVIDADE DA EQUIPE EM TEMPO REAL --- */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 md:p-6 border-b border-gray-100 flex items-center gap-2">
                    <BoltIcon className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-gray-800">Atividade da equipe em tempo real</h3>
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> ao vivo
                    </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {atividades.length === 0 ? (
                        <p className="p-6 text-center text-sm text-gray-400">Nenhuma atividade registrada ainda. As ações da equipe na fila (chamar, finalizar, cancelar...) vão aparecer aqui.</p>
                    ) : (
                        atividades.map((a) => (
                            <div key={a.id} className="p-3 px-6 flex items-center gap-3 text-sm">
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${ACAO_COR[a.acao] || 'text-gray-600 bg-gray-100'}`}>
                                    {a.acao?.replace('_', ' ')}
                                </span>
                                <span className="text-gray-700 flex-1">{a.descricao}</span>
                                <span className="text-xs text-gray-400 shrink-0">{formatarHora(a.created_at)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

                {/* --- TOOLBAR --- */}
                <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
                    
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={abrirModalNovo}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition shadow-sm"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Novo membro da equipe
                        </button>

                        <button
                            onClick={() => setMostrarExplicacaoPapeis(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-gray-600 border border-gray-200 px-5 py-2.5 rounded-lg font-bold hover:bg-gray-50 transition shadow-sm"
                        >
                            <SparklesIcon className="w-4 h-4 text-indigo-500" />
                            Como funcionam os papéis
                        </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="text-gray-400 w-5 h-5" />
                        </div>
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition shadow-sm text-sm"
                            placeholder="Buscar por nome, e-mail ou loja..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                    </div>
                </div>

                {/* --- TABELA DE FUNCIONÁRIOS --- */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                <th className="p-4 whitespace-nowrap">Funcionário</th>
                                <th className="p-4 whitespace-nowrap">Local & Cargo</th>
                                <th className="p-4 whitespace-nowrap text-center">Atendimentos</th>
                                <th className="p-4 whitespace-nowrap text-center">Avaliação</th>
                                <th className="p-4 whitespace-nowrap text-center">Status</th>
                                <th className="p-4 whitespace-nowrap text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {funcionariosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        Nenhum funcionário encontrado.
                                    </td>
                                </tr>
                            ) : (
                                funcionariosFiltrados.map((func) => (
                                    /* Adicionado efeito hover de sombreamento e realce visual na linha abaixo */
                                    <tr key={func.id} className="hover:bg-slate-50/80 hover:scale-[1.002] transition-all duration-150 cursor-default">
                                        
                                        {/* Coluna 1: Foto (Clicável) e Nome/Contato */}
                                        <td className="p-4 flex items-center gap-3">
                                            <div 
                                                onClick={() => irParaTelaEditar(func.id)}
                                                title="Clique para editar este funcionário"
                                                className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold uppercase shrink-0 cursor-pointer hover:bg-indigo-200 hover:scale-105 transition-all shadow-sm"
                                            >
                                                {func.nome ? func.nome.charAt(0) : 'F'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{func.nome || 'Sem Nome'}</div>
                                                <div className="text-xs text-gray-500">{func.telefone || func.usuario?.email}</div>
                                            </div>
                                        </td>
                                        
                                        {/* Coluna 2: Estabelecimento e Cargo */}
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{func.estabelecimento?.nome || 'N/A'}</div>
                                            <div className="text-xs text-gray-500">{func.cargo || 'Atendente'}</div>
                                        </td>

                                        {/* Coluna 3: Atendimentos */}
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded-lg">
                                                <BriefcaseIcon className="w-4 h-4 mr-1 text-gray-400" />
                                                {func.total_atendimentos || 0}
                                            </span>
                                        </td>

                                        {/* Coluna 4: Avaliação */}
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1 font-bold">
                                                <StarIcon className="w-4 h-4 text-yellow-400" />
                                                {func.avaliacao_media ? Number(func.avaliacao_media).toFixed(1) : 'Novo'}
                                            </div>
                                        </td>

                                        {/* Coluna 5: Status */}
                                        <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                func.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {func.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>

                                        {/* Coluna 6: Ações */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => abrirModalDetalhes(func)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition" title="Ver Desempenho">
                                                    <EyeIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => abrirModalEdicao(func)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Editar em Bloco">
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                {func.ativo && (
                                                    <button onClick={() => deletarFuncionario(func.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Inativar">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL 1: DETALHES E DESEMPENHO --- */}
            {isModalDetalhesOpen && funcionarioSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-start text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center font-black text-2xl uppercase">
                                    {funcionarioSelecionado.nome.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{funcionarioSelecionado.nome}</h3>
                                    <p className="text-indigo-100 text-sm opacity-90">{funcionarioSelecionado.cargo} | {funcionarioSelecionado.estabelecimento?.nome}</p>
                                </div>
                            </div>
                            <button onClick={fecharModais} className="text-white/70 hover:text-white transition">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Métricas do Profissional</h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                                        <ChartBarIcon className="w-5 h-5" /> <span className="font-bold text-sm">Atendimentos</span>
                                    </div>
                                    <div className="text-2xl font-black text-gray-900">{funcionarioSelecionado.total_atendimentos || 0}</div>
                                </div>
                                
                                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                    <div className="flex items-center gap-2 text-green-600 mb-1">
                                        <CurrencyDollarIcon className="w-5 h-5" /> <span className="font-bold text-sm">Faturamento</span>
                                    </div>
                                    <div className="text-2xl font-black text-gray-900">{formatarMoeda(funcionarioSelecionado.faturamento_total)}</div>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-500 flex items-center gap-2"><StarIcon className="w-4 h-4 text-yellow-400" /> Avaliação Média</span>
                                    <span className="font-bold text-gray-900">{funcionarioSelecionado.avaliacao_media ? Number(funcionarioSelecionado.avaliacao_media).toFixed(1) : 'Sem avaliações'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-500 flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-gray-400" /> Contratado em</span>
                                    <span className="font-bold text-gray-900">{formatarData(funcionarioSelecionado.created_at)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-gray-500 flex items-center gap-2"><EnvelopeIcon className="w-4 h-4 text-gray-400" /> Acesso (Email)</span>
                                    <span className="font-bold text-gray-900">{funcionarioSelecionado.usuario?.email || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
                            <button onClick={fecharModais} className="text-indigo-600 font-bold hover:underline">Fechar Detalhes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: CRIAÇÃO / EDIÇÃO --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-gray-900">
                                {modoEdicao ? 'Editar Funcionário' : data.cargo === 'Sócio' ? 'Convidar sócio' : 'Novo membro da equipe'}
                            </h3>
                            <button onClick={fecharModais} className="text-gray-400 hover:text-gray-600 transition">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={submit} className="p-6 space-y-5">
                            {!modoEdicao && (
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <BuildingOfficeIcon className="w-5 h-5 text-gray-400" /> Estabelecimento
                                    </label>
                                    <select 
                                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" 
                                        value={data.estabelecimento_id} 
                                        onChange={e => setData('estabelecimento_id', e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Selecione um local...</option>
                                        {meusEstabelecimentos.map(est => (
                                            <option key={est.id} value={est.id}>{est.nome}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.estabelecimento_id} className="mt-1" />
                                </div>
                            )}

                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    <UserIcon className="w-5 h-5 text-gray-400" /> Nome Completo
                                </label>
                                <input type="text" className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.nome} onChange={e => setData('nome', e.target.value)} required />
                                <InputError message={errors.nome} className="mt-1" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <EnvelopeIcon className="w-5 h-5 text-gray-400" /> E-mail (Acesso)
                                    </label>
                                    <input type="email" className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.email} onChange={e => setData('email', e.target.value)} required />
                                    <InputError message={errors.email} className="mt-1" />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <PhoneIcon className="w-5 h-5 text-gray-400" /> Telefone
                                    </label>
                                    <input type="text" className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.telefone} onChange={e => setData('telefone', e.target.value)} placeholder="(DD) 99999-9999" />
                                    <InputError message={errors.telefone} className="mt-1" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <LockClosedIcon className="w-5 h-5 text-gray-400" /> Senha (Min. 8)
                                    </label>
                                    <input 
                                        type="password" 
                                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" 
                                        value={data.password} 
                                        onChange={e => setData('password', e.target.value)} 
                                        required={!modoEdicao} 
                                        placeholder={modoEdicao ? "Deixe em branco p/ manter" : "Mínimo 8 dígitos"} 
                                    />
                                    <InputError message={errors.password} className="mt-1" />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <BriefcaseIcon className="w-5 h-5 text-gray-400" /> Cargo
                                    </label>
                                    <select className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.cargo} onChange={e => setData('cargo', e.target.value)}>
                                        <option value="Atendente">Atendente</option>
                                        <option value="Gerente" disabled={!podeGerenciarEquipeAvancada}>
                                            Gerente{!podeGerenciarEquipeAvancada ? ' 🔒 (plano Sócio Premium)' : ''}
                                        </option>
                                        {!modoEdicao && (
                                            <option value="Sócio" disabled={!podeGerenciarEquipeAvancada}>
                                                Sócio{!podeGerenciarEquipeAvancada ? ' 🔒 (plano Sócio Premium)' : ''}
                                            </option>
                                        )}
                                    </select>
                                    <InputError message={errors.cargo} className="mt-1" />
                                    {!podeGerenciarEquipeAvancada && (
                                        <p className="text-xs text-gray-400 mt-1">Convidar gerentes e sócios é um recurso do plano Sócio Premium.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                                <button type="button" onClick={fecharModais} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                                <PrimaryButton className={`px-6 py-2 rounded-lg text-white ${data.cargo === 'Sócio' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700'}`} disabled={processing}>
                                    {processing ? 'Salvando...' : data.cargo === 'Sócio' ? 'Convidar sócio' : 'Salvar'}
                                </PrimaryButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: COMO FUNCIONAM OS PAPÉIS --- */}
            {mostrarExplicacaoPapeis && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-start bg-gradient-to-br from-indigo-600 to-violet-700 rounded-t-3xl text-white">
                            <div>
                                <h3 className="text-2xl font-extrabold flex items-center gap-2">
                                    <SparklesIcon className="w-6 h-6" /> Papéis na sua equipe
                                </h3>
                                <p className="text-indigo-100 text-sm mt-1">O que cada um pode fazer dentro da Lokyva.</p>
                            </div>
                            <button onClick={() => setMostrarExplicacaoPapeis(false)} className="text-white/80 hover:text-white transition">
                                <XMarkIcon className="w-7 h-7" />
                            </button>
                        </div>

                        <div className="p-6 sm:p-8 grid sm:grid-cols-3 gap-5">
                            <div className="rounded-2xl border border-gray-100 p-5 bg-gray-50/60">
                                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Atendente</h4>
                                <p className="text-xs text-indigo-600 font-semibold mb-3 uppercase tracking-wide">Todo plano, sem custo extra</p>
                                <ul className="text-sm text-gray-600 space-y-2">
                                    <li>• Atende a fila do dia a dia</li>
                                    <li>• Chama, finaliza e adia clientes</li>
                                    <li>• Não vê financeiro nem configurações</li>
                                </ul>
                            </div>

                            <div className="rounded-2xl border-2 border-indigo-200 p-5 bg-indigo-50/50 relative">
                                <span className="absolute -top-3 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Plano Sócio Premium</span>
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                                    <BriefcaseIcon className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Gerente</h4>
                                <p className="text-xs text-indigo-600 font-semibold mb-3 uppercase tracking-wide">Quase tudo que o sócio vê</p>
                                <ul className="text-sm text-gray-600 space-y-2">
                                    <li>• Administra agenda, equipe e catálogo</li>
                                    <li>• Vê relatórios, cupons e contratos</li>
                                    <li>• <strong>Não</strong> acessa a Carteira nem a assinatura</li>
                                </ul>
                            </div>

                            <div className="rounded-2xl border-2 border-emerald-200 p-5 bg-emerald-50/50 relative">
                                <span className="absolute -top-3 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Plano Sócio Premium</span>
                                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                                    <UserPlusIcon className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Sócio</h4>
                                <p className="text-xs text-emerald-600 font-semibold mb-3 uppercase tracking-wide">Acesso total, como você</p>
                                <ul className="text-sm text-gray-600 space-y-2">
                                    <li>• Administra tudo, sem restrições</li>
                                    <li>• Acessa a Carteira e o dinheiro recebido</li>
                                    <li>• Pode gerenciar a assinatura da plataforma</li>
                                </ul>
                            </div>
                        </div>

                        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800 flex items-start gap-2">
                                <LockClosedIcon className="w-4 h-4 mt-0.5 shrink-0" />
                                Criar gerentes e convidar sócios é um benefício exclusivo do plano <strong>Sócio Premium</strong>{!podeGerenciarEquipeAvancada && ' — assine em Minha assinatura para liberar'}.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}