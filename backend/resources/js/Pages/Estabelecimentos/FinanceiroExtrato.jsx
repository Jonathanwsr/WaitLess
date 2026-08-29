import React, { useState } from 'react';
import { router, usePage, Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { 
    TrendingUp, TrendingDown, DollarSign, CreditCard, Receipt, 
    Calendar, Download, ChevronLeft, ChevronRight, MoreVertical, 
    Info, FileText, FileSpreadsheet, Wallet
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#6B7280'];

export default function FinanceiroExtrato({ auth, dados, filtros_atuais }) {
    const { errors } = usePage().props;
    const user = auth.user;

    // 1. BLOQUEIO DE ACESSO (Apenas Admin ou Premium)
    const isPremium = user?.plano_assinatura?.toLowerCase() === 'premium';
    const isAdmin = user?.tipo === 'admin';

    if (!isPremium && !isAdmin) {
        return (
            <AuthenticatedLayout 
                user={user} 
                header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Extrato Financeiro</h2>}
            >
                <Head title="Extrato Financeiro" />
                <div className="p-6 md:p-12 flex justify-center items-center h-[60vh]">
                    <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-lg border border-red-100">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DollarSign className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Exclusivo Premium</h2>
                        <p className="text-gray-600 mb-6">Esta funcionalidade de controle financeiro avançado está disponível apenas para usuários Premium ou Administradores.</p>
                        <button onClick={() => router.get('/planos')} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-md transition-colors w-full md:w-auto">
                            Fazer Upgrade Agora
                        </button>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    // 2. ESTADOS DE FILTROS E MENU DE EXPORTAÇÃO
    const [filtros, setFiltros] = useState({
        data_inicio: filtros_atuais?.data_inicio || '',
        data_fim: filtros_atuais?.data_fim || '',
        estabelecimento_id: filtros_atuais?.estabelecimento_id || '',
        funcionario_id: filtros_atuais?.funcionario_id || '',
        tipo: filtros_atuais?.tipo || '',
        metodo_pagamento: filtros_atuais?.metodo_pagamento || ''
    });

    const [mostrarExportacao, setMostrarExportacao] = useState(false);

    // Dispara a requisição Inertia ao mudar um filtro
    const aplicarFiltro = (campo, valor) => {
        const novosFiltros = { ...filtros, [campo]: valor, pagina: 1 };
        setFiltros(novosFiltros);
        
        router.get('/meu-extrato', novosFiltros, {
            preserveState: true,
            preserveScroll: true,
            only: ['dados', 'filtros_atuais']
        });
    };

    const mudarPagina = (novaPagina) => {
        aplicarFiltro('pagina', novaPagina);
    };

    const exportarDados = (formato) => {
        const queryParams = new URLSearchParams({ ...filtros, formato }).toString();
        window.location.href = `/meu-extrato/exportar?${queryParams}`;
        setMostrarExportacao(false);
    };

    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    const prepararDadosGrafico = (objetoDados) => {
        if (!objetoDados) return [];
        return Object.entries(objetoDados).map(([nome, valor]) => ({ name: nome, value: Number(valor) }));
    };

    if (errors?.erro) {
        return (
           <AuthenticatedLayout 
                user={user} 
                header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Erro no Extrato</h2>}
            >
                <div className="p-4 bg-red-100 text-red-700 rounded-md m-6 shadow-sm border border-red-200">
                    {errors.erro}
                </div>
            </AuthenticatedLayout>
        );
    }

    if (!dados) {
        return (
            <AuthenticatedLayout user={user}>
                <div className="flex justify-center items-center h-screen text-gray-500 font-medium">
                    <div className="animate-pulse flex items-center gap-2">
                        <div className="w-4 h-4 bg-emerald-500 rounded-full"></div>
                        Carregando dados financeiros...
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    const { kpis, periodo, graficos, movimentacoes, filtros_disponiveis, mensagem_proprietario } = dados;

    return (
        <AuthenticatedLayout 
            user={user} 
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Extrato Financeiro</h2>}
        >
            <Head title="Extrato Financeiro Geral" />
            
            <div className="p-4 md:p-6 bg-gray-50 min-h-screen font-sans">
                
                {/* MENSAGEM AMIGÁVEL DO PROPRIETÁRIO */}
                {mensagem_proprietario && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-3 shadow-sm">
                        <Info className="w-6 h-6 text-blue-500 shrink-0 mt-1 md:mt-0" />
                        <p className="font-medium text-sm md:text-base">{mensagem_proprietario}</p>
                    </div>
                )}

                {/* CABEÇALHO DA TELA */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Visão Geral</h1>
                        <p className="text-xs md:text-sm text-gray-500">Consolidado de movimentações e saúde financeira da plataforma.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto relative">
                        <div className="flex items-center justify-center bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-600 w-full sm:w-auto">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {periodo?.inicio} - {periodo?.fim}
                        </div>
                        
                        {/* BOTAO DE EXPORTAÇÃO (DROPDOWN) */}
                        <div className="relative w-full sm:w-auto">
                            <button 
                                onClick={() => setMostrarExportacao(!mostrarExportacao)}
                                className="flex items-center justify-center bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </button>
                            
                            {mostrarExportacao && (
                                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50">
                                    <div className="py-1">
                                        <button onClick={() => exportarDados('pdf')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <FileText className="w-4 h-4 mr-3 text-red-500" /> Baixar em PDF
                                        </button>
                                        <button onClick={() => exportarDados('csv')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <FileSpreadsheet className="w-4 h-4 mr-3 text-emerald-500" /> Baixar em Excel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* CARDS DE KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                    <KpiCard title="RECEITA TOTAL" value={kpis?.receita_total || 0} icon={<TrendingUp className="text-emerald-500" />} bgColor="bg-emerald-100" />
                    
                    {/* CARD DESPESAS COM EXPLICAÇÃO */}
                    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm relative">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-rose-100 shrink-0">
                                    <TrendingDown className="text-rose-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <p className="text-[10px] md:text-xs text-gray-500 font-medium uppercase">DESPESAS TOTAIS</p>
                                        <span title="Inclui a taxa de 12% da plataforma e o saldo devedor de pagamentos presenciais (retidos até o pagamento online)." className="cursor-help">
                                            <Info className="w-3 h-3 text-gray-400" />
                                        </span>
                                    </div>
                                    <h3 className="text-lg md:text-xl font-bold text-gray-800 break-all">{formatarMoeda(kpis?.despesas_totais || 0)}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <KpiCard title="LUCRO LÍQUIDO" value={kpis?.lucro_liquido || 0} icon={<DollarSign className="text-blue-500" />} bgColor="bg-blue-100" />
                    <KpiCard title="SALDO ASAAS" value={kpis?.saldo_asaas || 0} icon={<Wallet className="text-indigo-500" />} bgColor="bg-indigo-100" tooltip="Saldo atual disponível na sua carteira Asaas." />
                    <KpiCard title="TRANSAÇÕES" value={kpis?.transacoes || 0} isCurrency={false} icon={<Receipt className="text-purple-500" />} bgColor="bg-purple-100" />
                    <KpiCard title="TICKET MÉDIO" value={kpis?.ticket_medio || 0} icon={<CreditCard className="text-amber-500" />} bgColor="bg-amber-100" />
                </div>

                {/* FILTROS INTERATIVOS */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <select value={filtros.estabelecimento_id} onChange={(e) => aplicarFiltro('estabelecimento_id', e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-2 w-full sm:w-auto flex-grow">
                        <option value="">Todos os estabelecimentos</option>
                        {filtros_disponiveis?.estabelecimentos?.map(est => (
                            <option key={est.id} value={est.id}>{est.nome}</option>
                        ))}
                    </select>

                    <select value={filtros.funcionario_id} onChange={(e) => aplicarFiltro('funcionario_id', e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-2 w-full sm:w-auto flex-grow">
                        <option value="">Todos os funcionários</option>
                        {filtros_disponiveis?.funcionarios?.map(func => (
                            <option key={func.id} value={func.id}>{func.nome} ({func.cargo})</option>
                        ))}
                    </select>

                    <select value={filtros.tipo} onChange={(e) => aplicarFiltro('tipo', e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-2 w-full sm:w-auto flex-grow">
                        <option value="">Todos os Tipos (Receitas e Despesas)</option>
                        <option value="receita">Apenas Receitas</option>
                        <option value="despesa">Apenas Despesas / Estornos</option>
                    </select>

                    <select value={filtros.metodo_pagamento} onChange={(e) => aplicarFiltro('metodo_pagamento', e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-2 w-full sm:w-auto flex-grow">
                        <option value="">Todas as formas de pagamento</option>
                        <option value="pix">PIX</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="dinheiro">Dinheiro (Presencial)</option>
                    </select>
                </div>

                {/* LAYOUT PRINCIPAL: TABELA E GRÁFICOS */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* LADO ESQUERDO: Tabela de Movimentações */}
                    <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="p-4 md:p-5 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-base md:text-lg font-semibold text-gray-800">
                                Movimentações <span className="text-xs md:text-sm font-normal text-gray-500 ml-2">{movimentacoes?.total || 0} registros</span>
                            </h2>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 md:px-6 py-3 whitespace-nowrap">Data / Hora</th>
                                        <th className="px-4 md:px-6 py-3">Tipo</th>
                                        <th className="px-4 md:px-6 py-3">Descrição</th>
                                        <th className="px-4 md:px-6 py-3">Estabelecimento / Cliente</th>
                                        <th className="px-4 md:px-6 py-3">Pagamento</th>
                                        <th className="px-4 md:px-6 py-3">Valor</th>
                                        <th className="px-4 md:px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimentacoes?.data?.map((mov) => (
                                        <tr key={mov.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{new Date(mov.created_at).toLocaleDateString('pt-BR')}</div>
                                                <div className="text-xs text-gray-500">{new Date(mov.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-md font-medium whitespace-nowrap ${['credito', 'repasse'].includes(mov.tipo) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {mov.tipo === 'credito' ? 'Receita' : mov.tipo}
                                                </span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className="font-medium text-gray-900 min-w-[120px]">{mov.descricao}</div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className="font-medium text-gray-900 min-w-[120px]">{mov.origem?.estabelecimento?.nome || 'Sem Vínculo'}</div>
                                                <div className="text-xs text-gray-500">{mov.usuario?.name || 'Cliente Avulso'}</div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className="flex items-center text-gray-700 uppercase text-xs font-medium whitespace-nowrap">
                                                    {mov.metodo_pagamento ? mov.metodo_pagamento.replace('_', ' ') : 'N/A'}
                                                </div>
                                            </td>
                                            <td className={`px-4 md:px-6 py-4 font-semibold whitespace-nowrap ${['credito', 'repasse'].includes(mov.tipo) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {['credito', 'repasse'].includes(mov.tipo) ? '+ ' : '- '}
                                                {formatarMoeda(mov.valor_liquido || mov.valor_bruto)}
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-md capitalize border whitespace-nowrap
                                                    ${mov.status === 'liberado' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                                                      mov.status === 'pendente' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                                      'bg-gray-50 text-gray-600 border-gray-200'}`
                                                }>
                                                    {mov.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!movimentacoes?.data || movimentacoes.data.length === 0) && (
                                        <tr>
                                            <td colSpan="7" className="text-center py-8 text-gray-500">Nenhuma movimentação encontrada para estes filtros.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {movimentacoes?.total > 0 && (
                            <div className="p-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 text-sm gap-4">
                                <span className="text-gray-500 text-center sm:text-left">Mostrando {movimentacoes.from} a {movimentacoes.to} de {movimentacoes.total} registros</span>
                                <div className="flex items-center gap-1">
                                    <button 
                                        disabled={!movimentacoes.prev_page_url}
                                        onClick={() => mudarPagina(movimentacoes.current_page - 1)}
                                        className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-100 transition-colors cursor-pointer">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-md font-medium">{movimentacoes.current_page}</span>
                                    <button 
                                        disabled={!movimentacoes.next_page_url}
                                        onClick={() => mudarPagina(movimentacoes.current_page + 1)}
                                        className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-100 transition-colors cursor-pointer">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LADO DIREITO: Gráficos e Resumo */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-6">
                        
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                            <h3 className="text-base font-semibold text-gray-800 mb-4">Resumo do Filtro Atual</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Receitas Totais</span>
                                    <span className="text-emerald-500 font-medium break-all text-right ml-4">{formatarMoeda(kpis?.receita_total || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                    <span className="text-gray-500">Despesas / Taxas</span>
                                    <span className="text-rose-500 font-medium break-all text-right ml-4">- {formatarMoeda(kpis?.despesas_totais || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-gray-800 font-medium">Lucro Líquido Real</span>
                                    <span className="text-emerald-600 font-bold text-base md:text-lg break-all text-right ml-4">{formatarMoeda(kpis?.lucro_liquido || 0)}</span>
                                </div>
                            </div>
                        </div>

                        <GraficoRosca 
                            titulo="Receitas por estabelecimento" 
                            dados={prepararDadosGrafico(graficos?.receitas_por_estabelecimento)} 
                            total={kpis?.receita_total || 0} 
                            formatarMoeda={formatarMoeda}
                        />

                        <GraficoRosca 
                            titulo="Receitas por forma de pagamento" 
                            dados={prepararDadosGrafico(graficos?.receitas_por_pagamento)} 
                            total={kpis?.receita_total || 0} 
                            formatarMoeda={formatarMoeda}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// ================= COMPONENTES AUXILIARES =================

const KpiCard = ({ title, value, isCurrency = true, icon, bgColor, tooltip }) => {
    const formattedValue = isCurrency 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
        : value;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-full ${bgColor} shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] md:text-xs text-gray-500 font-medium uppercase truncate">{title}</p>
                    {tooltip && (
                        <span title={tooltip} className="cursor-help shrink-0">
                            <Info className="w-3 h-3 text-gray-400" />
                        </span>
                    )}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-800 truncate" title={formattedValue}>{formattedValue}</h3>
            </div>
        </div>
    );
};

const GraficoRosca = ({ titulo, dados, total, formatarMoeda }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
            <h3 className="text-sm md:text-base font-semibold text-gray-800 mb-4">{titulo}</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                
                <div className="w-full sm:w-1/3 h-32 relative">
                    {dados.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={dados} innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" stroke="none">
                                    {dados.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => formatarMoeda(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex justify-center items-center h-full text-xs text-gray-400 text-center bg-gray-50 rounded-full">
                            Sem dados
                        </div>
                    )}
                </div>
                
                <div className="w-full sm:w-2/3">
                    <ul className="space-y-2 text-xs md:text-sm">
                        {dados.map((item, index) => {
                            const percentual = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                            return (
                                <li key={index} className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 truncate min-w-[50%]">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                        <span className="text-gray-600 truncate" title={item.name}>{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-gray-400">{formatarMoeda(item.value)}</span>
                                        <span className="text-gray-800 font-medium min-w-[40px] text-right">{percentual}%</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-semibold text-gray-800">{formatarMoeda(total)}</span>
            </div>
        </div>
    );
};