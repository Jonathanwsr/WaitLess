import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    BanknotesIcon, 
    CommandLineIcon, 
    ExclamationTriangleIcon, 
    EnvelopeIcon,
    PaperAirplaneIcon,
    ArrowPathIcon,
    UserCircleIcon,
    CalendarDaysIcon,
    ArrowsRightLeftIcon,
    XMarkIcon,
    BuildingOfficeIcon,
    BriefcaseIcon,
    UsersIcon,
    StarIcon
} from '@heroicons/react/24/outline';

export default function FinanceiroMaster({ auth, provedores = [], filaJobs = [], filaFalhados = [], ultimasTransacoes = [], proximoRepasse }) {
    
    // Controles de Modais
    const [abrirPainelEmail, setAbrirPainelEmail] = useState(false);
    const [modalRepasse, setModalRepasse] = useState({ open: false, provider: null, valor: '' });

    // === NOVOS ESTADOS PARA INTEGRAR OS DADOS GERAIS DO ADMIN ===
    const [loadingGerais, setLoadingGerais] = useState(false);
    const [paginasAtuais, setPaginasAtuais] = useState({
        estabelecimentos_page: 1,
        servicos_page: 1,
        funcionarios_page: 1,
        pontos_page: 1
    });
    const [dadosGerais, setDadosGerais] = useState({
        metricas_gerais: {
            total_estabelecimentos: 0,
            total_servicos: 0,
            total_funcionarios: 0,
            total_pagamentos: 0,
            total_pontos_gerados: 0
        },
        dados: {
            estabelecimentos: { data: [], links: [] },
            servicos: { data: [], links: [] },
            funcionarios: { data: [], links: [] },
            pontos_usuarios: { data: [], links: [] }
        }
    });

    // Função assíncrona para buscar as métricas gerais e tabelas paginadas do admin
    const buscarDadosGeraisComFiltros = async (novasPaginas = paginasAtuais) => {
        setLoadingGerais(true);
        try {
            const params = new URLSearchParams();
            Object.entries(novasPaginas).forEach(([key, val]) => {
                params.append(key, val);
            });
            const response = await fetch(`/api/admin/dashboard-geral?${params.toString()}`);
            if (response.ok) {
                const resJson = await response.json();
                if (resJson.success) {
                    setDadosGerais(resJson);
                }
            }
        } catch (error) {
            console.error("Erro ao obter dados gerais:", error);
        } finally {
            setLoadingGerais(false);
        }
    };

    // Carrega na montagem do componente
    useEffect(() => {
        buscarDadosGeraisComFiltros();
    }, []);

    // Atualiza apenas a página selecionada sem alterar o estado de paginação das outras tabelas
    const irParaPagina = (tipoPageKey, url) => {
        if (!url) return;
        try {
            const urlObj = new URL(url, window.location.origin);
            const pageNum = urlObj.searchParams.get(tipoPageKey);
            if (pageNum) {
                const proximasPaginas = {
                    ...paginasAtuais,
                    [tipoPageKey]: pageNum
                };
                setPaginasAtuais(proximasPaginas);
                buscarDadosGeraisComFiltros(proximasPaginas);
            }
        } catch (e) {
            const match = url.match(new RegExp(`[?&]${tipoPageKey}=(\\d+)`));
            if (match && match[1]) {
                const proximasPaginas = {
                    ...paginasAtuais,
                    [tipoPageKey]: match[1]
                };
                setPaginasAtuais(proximasPaginas);
                buscarDadosGeraisComFiltros(proximasPaginas);
            }
        }
    };

    // Form do Email
    const { data: dataEmail, setData: setDataEmail, post: postEmail, processing: processingEmail, reset: resetEmail, errors: errorsEmail } = useForm({
        email_destino: '',
        assunto: '',
        mensagem: ''
    });

    const iniciarEmailParaProvedor = (email) => {
        setDataEmail('email_destino', email);
        setAbrirPainelEmail(true);
    };

    const submeterEmail = (e) => {
        e.preventDefault();
        postEmail(route('admin.financeiro.email'), {
            onSuccess: () => {
                resetEmail();
                setAbrirPainelEmail(false);
            }
        });
    };

    // Form do Repasse Customizado
    const { data: dataRepasse, setData: setDataRepasse, post: postRepasse, processing: processingRepasse } = useForm({
        valor_repasse: ''
    });

    const abrirModalRepasse = (provider) => {
        setModalRepasse({ open: true, provider: provider });
        setDataRepasse('valor_repasse', ''); // Começa vazio (significa que quer sacar tudo)
    };

    const submeterRepasse = (e) => {
        e.preventDefault();
        postRepasse(route('admin.financeiro.repassar', modalRepasse.provider.id), {
            onSuccess: () => setModalRepasse({ open: false, provider: null })
        });
    };

    return (
        <AuthenticatedLayout 
            header={
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                            <CommandLineIcon className="w-7 h-7 text-indigo-600" />
                            Painel Financeiro Master 
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Monitoramento contábil e repasses da plataforma.
                        </p>
                    </div>
                    {/* Badge do Próximo Repasse Automático */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-2 flex items-center gap-3">
                        <CalendarDaysIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                            <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Próximo Repasse Automático</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{proximoRepasse || 'Sem data'}</p>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title="Painel Contábil Administrador" />

            <div className="bg-[#FBF9F9] dark:bg-gray-900 min-h-screen -m-4 sm:-m-8 p-4 sm:p-8 space-y-8 animate-fadeIn">
                
                {/* --- SEÇÃO 1: MONITOR DE SALDOS --- */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Saldos de Provedores</h3>
                                <p className="text-xs text-gray-400">Valores líquidos retidos aguardando repasse.</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/70 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Proprietário</th>
                                    <th className="px-6 py-4">Chave PIX</th>
                                    <th className="px-6 py-4">Saldo Acumulado</th>
                                    <th className="px-6 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-sm">
                                {provedores.map((prov) => (
                                    <tr key={prov.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition">
                                        <td className="px-6 py-4 font-bold text-gray-400">#{prov.id}</td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-gray-900 dark:text-white">{prov.proprietario_nome}</p>
                                            <p className="text-xs text-gray-400">{prov.proprietario_email}</p>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-gray-600 dark:text-gray-300">
                                            {prov.pix_key || <span className="text-rose-500">Pendente</span>}
                                        </td>
                                        <td className="px-6 py-4 font-black text-gray-900 dark:text-white">
                                            R$ {Number(prov.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => abrirModalRepasse(prov)}
                                                    disabled={Number(prov.saldo) <= 0 || !prov.pix_key}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <BanknotesIcon className="w-3.5 h-3.5" /> Repassar PIX
                                                </button>
                                                <button 
                                                    onClick={() => iniciarEmailParaProvedor(prov.proprietario_email)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl"
                                                >
                                                    <EnvelopeIcon className="w-3.5 h-3.5" /> E-mail
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- SEÇÃO 2: TABELAS DE AUDITORIA --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Últimas Transações da Plataforma */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6 lg:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                                <ArrowsRightLeftIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Extrato Global (Últimas Transações)</h3>
                                <p className="text-xs text-gray-400">Movimentações de todos os lojistas da plataforma.</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                                        <th className="pb-3">Data</th>
                                        <th className="pb-3">Lojista</th>
                                        <th className="pb-3">Tipo</th>
                                        <th className="pb-3">Descrição</th>
                                        <th className="pb-3 text-right">Valor Líquido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {ultimasTransacoes.map((tx) => (
                                        <tr key={tx.id} className="text-gray-600 dark:text-gray-300">
                                            <td className="py-3">{new Date(tx.created_at).toLocaleString('pt-BR')}</td>
                                            <td className="py-3 font-semibold text-gray-900 dark:text-white">{tx.proprietario_nome}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] tracking-wider ${tx.tipo === 'repasse' || tx.tipo === 'estorno' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {tx.tipo}
                                                </span>
                                            </td>
                                            <td className="py-3 truncate max-w-[200px]">{tx.descricao}</td>
                                            <td className={`py-3 text-right font-bold ${tx.valor_liquido < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                R$ {Number(tx.valor_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                    {ultimasTransacoes.length === 0 && (
                                        <tr><td colSpan="5" className="text-center py-6 text-gray-400">Sem transações recentes.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Fila Ativa */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Jobs em Processamento</h3>
                        </div>
                        <table className="w-full text-left text-xs">
                            <tbody className="divide-y divide-gray-50">
                                {filaJobs.map((job) => (
                                    <tr key={job.id}>
                                        <td className="py-2 font-mono">#{job.id}</td>
                                        <td className="py-2 text-amber-600 font-bold">{job.attempts} / 10</td>
                                    </tr>
                                ))}
                                {filaJobs.length === 0 && <tr><td className="py-4 text-center text-gray-400">Fila vazia.</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Fila Falhada */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Falhas Críticas (Failed)</h3>
                        </div>
                        <table className="w-full text-left text-xs">
                            <tbody className="divide-y divide-gray-50">
                                {filaFalhados.map((failed) => (
                                    <tr key={failed.id}>
                                        <td className="py-2 font-mono text-rose-500">#{failed.id}</td>
                                        <td className="py-2">{new Date(failed.failed_at).toLocaleString('pt-BR')}</td>
                                    </tr>
                                ))}
                                {filaFalhados.length === 0 && <tr><td className="py-4 text-center text-emerald-600 font-bold">Nenhum erro registrado.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- SEÇÃO 3: NOVO - MÉTRICAS GERAIS DE ADMINISTRAÇÃO --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Card 1: Estabelecimentos */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                            <BuildingOfficeIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Estabelecimentos</p>
                            <p className="text-2xl font-black text-gray-950 dark:text-white">
                                {loadingGerais ? '...' : dadosGerais.metricas_gerais.total_estabelecimentos}
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Serviços */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl">
                            <BriefcaseIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Serviços Ativos</p>
                            <p className="text-2xl font-black text-gray-950 dark:text-white">
                                {loadingGerais ? '...' : dadosGerais.metricas_gerais.total_servicos}
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Funcionários */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Colaboradores</p>
                            <p className="text-2xl font-black text-gray-950 dark:text-white">
                                {loadingGerais ? '...' : dadosGerais.metricas_gerais.total_funcionarios}
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Lançamentos de Pagamentos */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <BanknotesIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Lançamentos</p>
                            <p className="text-2xl font-black text-gray-950 dark:text-white">
                                {loadingGerais ? '...' : dadosGerais.metricas_gerais.total_pagamentos}
                            </p>
                        </div>
                    </div>

                    {/* Card 5: Pontos Gerados */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl">
                            <StarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Pontos Totais</p>
                            <p className="text-2xl font-black text-gray-950 dark:text-white">
                                {loadingGerais ? '...' : Number(dadosGerais.metricas_gerais.total_pontos_gerados).toLocaleString('pt-BR')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- SEÇÃO 4: NOVO - TABELAS DE GESTÃO DO ADMINISTRADOR (PAGINADAS INDEPENDENTES) --- */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    {/* Tabela de Estabelecimentos */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[440px]">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <BuildingOfficeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Estabelecimentos</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Filiais e empresas registradas no sistema.</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3">ID</th>
                                            <th className="pb-3">Nome</th>
                                            <th className="pb-3">CNPJ</th>
                                            <th className="pb-3">Cadastrado em</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {dadosGerais.dados.estabelecimentos.data.map((est) => (
                                            <tr key={est.id} className="text-gray-600 dark:text-gray-300">
                                                <td className="py-3 font-mono font-bold text-gray-400">#{est.id}</td>
                                                <td className="py-3 font-semibold text-gray-900 dark:text-white">{est.nome}</td>
                                                <td className="py-3 font-mono">{est.cnpj || 'Não cadastrado'}</td>
                                                <td className="py-3">{est.created_at ? new Date(est.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                                            </tr>
                                        ))}
                                        {dadosGerais.dados.estabelecimentos.data.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-6 text-gray-400">Nenhum estabelecimento encontrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Paginação do Estabelecimento */}
                        {dadosGerais.dados.estabelecimentos.links && dadosGerais.dados.estabelecimentos.links.length > 3 && (
                            <div className="flex items-center justify-center gap-1 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4 flex-wrap">
                                {dadosGerais.dados.estabelecimentos.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url || loadingGerais}
                                        onClick={() => irParaPagina('estabelecimentos_page', link.url)}
                                        className={`px-3 py-1.5 text-xs rounded-xl transition ${link.active ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 text-gray-700 dark:text-gray-300'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabela de Serviços */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[440px]">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                    <BriefcaseIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Serviços Oferecidos</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Lista completa de serviços e seus valores.</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3">ID</th>
                                            <th className="pb-3">Nome do Serviço</th>
                                            <th className="pb-3">Estabelecimento</th>
                                            <th className="pb-3 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {dadosGerais.dados.servicos.data.map((srv) => (
                                            <tr key={srv.id} className="text-gray-600 dark:text-gray-300">
                                                <td className="py-3 font-mono font-bold text-gray-400">#{srv.id}</td>
                                                <td className="py-3 font-semibold text-gray-900 dark:text-white">{srv.nome}</td>
                                                <td className="py-3 text-gray-500">{srv.estabelecimento_nome}</td>
                                                <td className="py-3 text-right font-bold text-gray-950 dark:text-white">
                                                    R$ {Number(srv.valor || srv.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                        {dadosGerais.dados.servicos.data.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-6 text-gray-400">Nenhum serviço registrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Paginação dos Serviços */}
                        {dadosGerais.dados.servicos.links && dadosGerais.dados.servicos.links.length > 3 && (
                            <div className="flex items-center justify-center gap-1 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4 flex-wrap">
                                {dadosGerais.dados.servicos.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url || loadingGerais}
                                        onClick={() => irParaPagina('servicos_page', link.url)}
                                        className={`px-3 py-1.5 text-xs rounded-xl transition ${link.active ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 text-gray-700 dark:text-gray-300'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabela de Colaboradores */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[440px]">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Equipe de Colaboradores</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Funcionários ativos e permissões.</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3">Nome</th>
                                            <th className="pb-3">E-mail</th>
                                            <th className="pb-3">Cargo</th>
                                            <th className="pb-3">Estabelecimento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {dadosGerais.dados.funcionarios.data.map((func) => (
                                            <tr key={func.id} className="text-gray-600 dark:text-gray-300">
                                                <td className="py-3 font-semibold text-gray-900 dark:text-white">{func.funcionario_nome}</td>
                                                <td className="py-3 font-mono">{func.funcionario_email}</td>
                                                <td className="py-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-gray-900 dark:text-slate-300">
                                                        {func.tipo}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-gray-500">{func.estabelecimento_nome}</td>
                                            </tr>
                                        ))}
                                        {dadosGerais.dados.funcionarios.data.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-6 text-gray-400">Nenhum funcionário cadastrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Paginação dos Funcionários */}
                        {dadosGerais.dados.funcionarios.links && dadosGerais.dados.funcionarios.links.length > 3 && (
                            <div className="flex items-center justify-center gap-1 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4 flex-wrap">
                                {dadosGerais.dados.funcionarios.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url || loadingGerais}
                                        onClick={() => irParaPagina('funcionarios_page', link.url)}
                                        className={`px-3 py-1.5 text-xs rounded-xl transition ${link.active ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 text-gray-700 dark:text-gray-300'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabela de Pontos / Fidelidade */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex flex-col justify-between min-h-[440px]">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                                    <StarIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Fidelidade e Pontuações</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Pontos gerados por usuários em estabelecimentos.</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3">Usuário</th>
                                            <th className="pb-3">Estabelecimento</th>
                                            <th className="pb-3 text-right">Pontos Acumulados</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {dadosGerais.dados.pontos_usuarios.data.map((pnt) => (
                                            <tr key={pnt.id} className="text-gray-600 dark:text-gray-300">
                                                <td className="py-3 font-semibold text-gray-900 dark:text-white">{pnt.usuario_nome}</td>
                                                <td className="py-3 text-gray-500">{pnt.estabelecimento_nome}</td>
                                                <td className="py-3 text-right font-black text-rose-600 dark:text-rose-400">
                                                    {Number(pnt.total_pontos || pnt.total_points || 0).toLocaleString('pt-BR')} pts
                                                </td>
                                            </tr>
                                        ))}
                                        {dadosGerais.dados.pontos_usuarios.data.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="text-center py-6 text-gray-400">Nenhuma pontuação encontrada.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Paginação dos Pontos */}
                        {dadosGerais.dados.pontos_usuarios.links && dadosGerais.dados.pontos_usuarios.links.length > 3 && (
                            <div className="flex items-center justify-center gap-1 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4 flex-wrap">
                                {dadosGerais.dados.pontos_usuarios.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url || loadingGerais}
                                        onClick={() => irParaPagina('pontos_page', link.url)}
                                        className={`px-3 py-1.5 text-xs rounded-xl transition ${link.active ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 text-gray-700 dark:text-gray-300'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* --- MODAL DE REPASSE CUSTOMIZADO --- */}
                {modalRepasse.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl p-6 relative animate-slideUp">
                            <button onClick={() => setModalRepasse({ open: false, provider: null })} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Opções de Repasse</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Saldo disponível de <strong>{modalRepasse.provider.proprietario_nome}</strong>: <br/>
                                <span className="text-lg font-black text-gray-900 dark:text-white">R$ {Number(modalRepasse.provider.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </p>
                            
                            <form onSubmit={submeterRepasse} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor do Repasse (Deixe em branco para sacar tudo)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 font-bold text-gray-400">R$</span>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            max={modalRepasse.provider.saldo}
                                            className="w-full pl-9 rounded-xl border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                                            placeholder="Ex: 50.00"
                                            value={dataRepasse.valor_repasse}
                                            onChange={e => setDataRepasse('valor_repasse', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={processingRepasse} className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50 transition">
                                    {processingRepasse ? 'Processando na API Asaas...' : 'Confirmar Transferência PIX'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- PAINEL DE EMAIL (BREVO) --- */}
                {abrirPainelEmail && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 rounded-2xl shadow-md p-6 animate-slideUp">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-6">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <EnvelopeIcon className="w-6 h-6 text-indigo-600" /> Disparo via Brevo SMTP
                            </h3>
                            <button onClick={() => setAbrirPainelEmail(false)} className="text-gray-400 font-bold text-sm">Fechar</button>
                        </div>
                        <form onSubmit={submeterEmail} className="space-y-4">
                            <input 
                                type="email" required className="w-full rounded-xl border-gray-200 text-sm" placeholder="Destinatário"
                                value={dataEmail.email_destino} onChange={e => setDataEmail('email_destino', e.target.value)}
                            />
                            <input 
                                type="text" required className="w-full rounded-xl border-gray-200 text-sm" placeholder="Assunto"
                                value={dataEmail.assunto} onChange={e => setDataEmail('assunto', e.target.value)}
                            />
                            <textarea 
                                rows="4" required className="w-full rounded-xl border-gray-200 text-sm" placeholder="Mensagem"
                                value={dataEmail.mensagem} onChange={e => setDataEmail('mensagem', e.target.value)}
                            />
                            <div className="text-right">
                                <button type="submit" disabled={processingEmail} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-50 hover:bg-indigo-700">
                                    {processingEmail ? 'Enviando...' : 'Enviar E-mail'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}