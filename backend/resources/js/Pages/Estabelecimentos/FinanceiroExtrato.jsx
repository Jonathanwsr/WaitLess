import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, TrendingDown, DollarSign, CreditCard, Receipt, 
    Calendar, Download, ChevronLeft, ChevronRight, MoreVertical 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import axios from 'axios';

// Cores para os gráficos
const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#6B7280'];

export default function FinanceiroExtrato() {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);

    // Filtros
    const [filtros, setFiltros] = useState({
        data_inicio: '',
        data_fim: '',
        pagina: 1
    });

    useEffect(() => {
        carregarDados();
    }, [filtros]);

    const carregarDados = async () => {
        setLoading(true);
        setErro(null);
        try {
            // Rota atualizada para bater no web.php sem o /api/
            const response = await axios.get('/financeiro/dashboard-dados', { params: filtros });
            setDados(response.data);
        } catch (err) {
            setErro(err.response?.data?.erro || 'Erro ao carregar os dados financeiros.');
        } finally {
            setLoading(false);
        }
    };

    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // Prepara dados para os gráficos do Recharts
    const prepararDadosGrafico = (objetoDados) => {
        if (!objetoDados) return [];
        return Object.entries(objetoDados).map(([nome, valor]) => ({ name: nome, value: Number(valor) }));
    };

    if (loading && !dados) return <div className="flex justify-center items-center h-screen">Carregando...</div>;
    if (erro) return <div className="p-4 bg-red-100 text-red-700 rounded-md m-6">{erro}</div>;

    const { kpis, periodo, graficos, movimentacoes } = dados;

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen font-sans">
            
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Extrato Financeiro Geral</h1>
                    <p className="text-sm text-gray-500">Visão consolidada de todas as movimentações financeiras da plataforma.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-600 w-full md:w-auto">
                        <Calendar className="w-4 h-4 mr-2" />
                        {periodo.inicio} - {periodo.fim}
                    </div>
                    <button className="flex items-center bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* CARDS DE KPI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <KpiCard title="RECEITA TOTAL" value={kpis.receita_total} icon={<TrendingUp className="text-emerald-500" />} bgColor="bg-emerald-100" />
                <KpiCard title="DESPESAS TOTAIS" value={kpis.despesas_totais} icon={<TrendingDown className="text-rose-500" />} bgColor="bg-rose-100" />
                <KpiCard title="LUCRO LÍQUIDO" value={kpis.lucro_liquido} icon={<DollarSign className="text-blue-500" />} bgColor="bg-blue-100" />
                <KpiCard title="TRANSAÇÕES" value={kpis.transacoes} isCurrency={false} icon={<Receipt className="text-purple-500" />} bgColor="bg-purple-100" />
                <KpiCard title="TICKET MÉDIO" value={kpis.ticket_medio} icon={<CreditCard className="text-amber-500" />} bgColor="bg-amber-100" />
            </div>

            {/* FILTROS */}
            <div className="flex flex-wrap gap-3 mb-6">
                {['Todos os estabelecimentos', 'Todos os funcionários', 'Todos os tipos', 'Todas as formas de pagamento'].map((filtro, idx) => (
                    <select key={idx} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2">
                        <option>{filtro}</option>
                    </select>
                ))}
            </div>

            {/* LAYOUT PRINCIPAL */}
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* LADO ESQUERDO: Tabela de Movimentações */}
                <div className="w-full lg:w-2/3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800">
                            Movimentações <span className="text-sm font-normal text-gray-500 ml-2">{movimentacoes.total} registros</span>
                        </h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3">Data / Hora</th>
                                    <th className="px-6 py-3">Tipo</th>
                                    <th className="px-6 py-3">Descrição</th>
                                    <th className="px-6 py-3">Estabelecimento / Funcionário</th>
                                    <th className="px-6 py-3">Forma de Pagamento</th>
                                    <th className="px-6 py-3">Valor</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {movimentacoes.data.map((mov) => (
                                    <tr key={mov.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{new Date(mov.created_at).toLocaleDateString('pt-BR')}</div>
                                            <div className="text-xs text-gray-500">{new Date(mov.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-md font-medium ${['credito', 'repasse'].includes(mov.tipo) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {mov.tipo === 'credito' ? 'Receita' : mov.tipo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{mov.descricao}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{mov.provider?.estabelecimento?.nome || 'N/A'}</div>
                                            <div className="text-xs text-gray-500">{mov.usuario?.nome || 'Cliente'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-gray-700 capitalize">
                                                {mov.metodo_pagamento}
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 font-semibold whitespace-nowrap ${['credito', 'repasse'].includes(mov.tipo) ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {['credito', 'repasse'].includes(mov.tipo) ? '' : '- '}
                                            {formatarMoeda(mov.valor_liquido || mov.valor_bruto)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 text-xs rounded-md capitalize">
                                                {mov.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right cursor-pointer text-gray-400 hover:text-gray-700">
                                            <MoreVertical className="w-5 h-5" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação */}
                    <div className="p-4 flex items-center justify-between border-t border-gray-200 text-sm">
                        <span className="text-gray-500">Mostrando {movimentacoes.from} a {movimentacoes.to} de {movimentacoes.total} registros</span>
                        <div className="flex items-center gap-1">
                            <button 
                                disabled={!movimentacoes.prev_page_url}
                                onClick={() => setFiltros({...filtros, pagina: filtros.pagina - 1})}
                                className="p-1 border rounded-md disabled:opacity-50">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md font-medium">{movimentacoes.current_page}</span>
                            <button 
                                disabled={!movimentacoes.next_page_url}
                                onClick={() => setFiltros({...filtros, pagina: filtros.pagina + 1})}
                                className="p-1 border rounded-md disabled:opacity-50">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* LADO DIREITO: Gráficos e Resumo */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    
                    {/* Card: Resumo do Período */}
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <h3 className="text-base font-semibold text-gray-800 mb-4">Resumo do período</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Receitas</span>
                                <span className="text-emerald-500 font-medium">{formatarMoeda(kpis.receita_total)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Despesas</span>
                                <span className="text-rose-500 font-medium">- {formatarMoeda(kpis.despesas_totais)}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-gray-800 font-medium">Lucro líquido</span>
                                <span className="text-emerald-500 font-bold">{formatarMoeda(kpis.lucro_liquido)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Ticket médio</span>
                                <span className="text-gray-800 font-medium">{formatarMoeda(kpis.ticket_medio)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Transações</span>
                                <span className="text-gray-800 font-medium">{kpis.transacoes}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card: Receitas por Estabelecimento (Gráfico de Rosca) */}
                    <GraficoRosca 
                        titulo="Receitas por estabelecimento" 
                        dados={prepararDadosGrafico(graficos.receitas_por_estabelecimento)} 
                        total={kpis.receita_total} 
                        formatarMoeda={formatarMoeda}
                    />

                    {/* Card: Receitas por Forma de Pagamento (Gráfico de Rosca) */}
                    <GraficoRosca 
                        titulo="Receitas por forma de pagamento" 
                        dados={prepararDadosGrafico(graficos.receitas_por_pagamento)} 
                        total={kpis.receita_total} 
                        formatarMoeda={formatarMoeda}
                    />

                </div>
            </div>
        </div>
    );
}

// ================= COMPONENTES AUXILIARES =================

const KpiCard = ({ title, value, isCurrency = true, icon, bgColor }) => {
    const formattedValue = isCurrency 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
        : value;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-full ${bgColor}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">{title}</p>
                <h3 className="text-xl font-bold text-gray-800">{formattedValue}</h3>
            </div>
        </div>
    );
};

const GraficoRosca = ({ titulo, dados, total, formatarMoeda }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4">{titulo}</h3>
            <div className="flex items-center">
                
                {/* Gráfico Recharts */}
                <div className="w-1/3 h-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dados}
                                innerRadius={35}
                                outerRadius={50}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                            >
                                {dados.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatarMoeda(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Legenda Customizada */}
                <div className="w-2/3 pl-4">
                    <ul className="space-y-2 text-xs">
                        {dados.map((item, index) => {
                            const percentual = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                            return (
                                <li key={index} className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                        <span className="text-gray-600 truncate max-w-[100px]" title={item.name}>{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400">{formatarMoeda(item.value)}</span>
                                        <span className="text-gray-800 font-medium w-8 text-right">{percentual}%</span>
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