import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    CalendarIcon, 
    ArrowDownTrayIcon, 
    ArrowTrendingUpIcon, 
    ArrowTrendingDownIcon,
    EllipsisVerticalIcon,
    CreditCardIcon,
    ArrowsRightLeftIcon,
    DevicePhoneMobileIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

// Os parâmetros vêm diretamente do ExtratoProviderController
export default function DashboardFinanceiro({ auth, extrato = {}, resumoCards = {}, filtrosDados = {}, filtrosAtuais = {}, dadosGraficos = {} }) {
    
    // Configura os estados com os valores que vieram da URL (se houver) para manter o filtro ativo
    const [filtroDataInicio, setFiltroDataInicio] = useState(filtrosAtuais.data_inicio || '');
    const [filtroDataFim, setFiltroDataFim] = useState(filtrosAtuais.data_fim || '');
    const [filtroEstabelecimento, setFiltroEstabelecimento] = useState(filtrosAtuais.estabelecimento_id || 'todos');
    const [filtroTipo, setFiltroTipo] = useState(filtrosAtuais.tipo || 'todos');
    const [filtroFormaPgto, setFiltroFormaPgto] = useState(filtrosAtuais.metodo_pagamento || 'todos');

    // Mapeamento visual das cores do status
    const formatarStatus = (status) => {
        const cores = {
            'liberado': 'bg-emerald-100 text-emerald-700',
            'pendente': 'bg-yellow-100 text-yellow-700',
            'estornado': 'bg-rose-100 text-rose-700',
            'cancelado': 'bg-gray-100 text-gray-600',
        };
        return cores[status] || 'bg-gray-100 text-gray-600';
    };

    // Função que dispara a busca no Laravel e recarrega a tela via Inertia
    const aplicarFiltros = () => {
        router.get(route('provider.financeiro'), {
            data_inicio: filtroDataInicio,
            data_fim: filtroDataFim,
            estabelecimento_id: filtroEstabelecimento,
            tipo: filtroTipo,
            metodo_pagamento: filtroFormaPgto,
        }, { preserveState: true });
    };

    // Exportação do CSV
    const exportarRelatorio = () => {
        window.open(route('provider.financeiro.export', {
            data_inicio: filtroDataInicio,
            data_fim: filtroDataFim,
            estabelecimento_id: filtroEstabelecimento,
            tipo: filtroTipo,
            metodo_pagamento: filtroFormaPgto,
        }));
    };

    // Dispara a busca sempre que um filtro dropdown mudar (Auto-submit)
    useEffect(() => {
        // Evita rodar no mount inicial
        if (filtroEstabelecimento !== (filtrosAtuais.estabelecimento_id || 'todos') ||
            filtroTipo !== (filtrosAtuais.tipo || 'todos') ||
            filtroFormaPgto !== (filtrosAtuais.metodo_pagamento || 'todos')) {
            aplicarFiltros();
        }
    }, [filtroEstabelecimento, filtroTipo, filtroFormaPgto]);


    return (
        <AuthenticatedLayout header={false}>
            <Head title="Extrato Financeiro Geral" />

            <div className="min-h-screen bg-[#F8FAFC] pb-12 pt-6">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Extrato Financeiro Geral</h1>
                            <p className="text-sm text-gray-500 mt-1">Visão consolidada de todas as movimentações financeiras da plataforma.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-sm px-2">
                                <CalendarIcon className="w-4 h-4 text-gray-400 ml-2" />
                                <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="border-0 text-sm focus:ring-0 text-gray-600 w-[130px]" />
                                <span className="text-gray-300">-</span>
                                <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="border-0 text-sm focus:ring-0 text-gray-600 w-[130px]" />
                                <button onClick={aplicarFiltros} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition">
                                    <MagnifyingGlassIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <button onClick={exportarRelatorio} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm">
                                <ArrowDownTrayIcon className="w-4 h-4 text-gray-500" />
                                Exportar CSV
                            </button>
                        </div>
                    </div>

                    {/* CARDS DE KPI (Integração Viva) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Receita Total Bruta</p>
                                <p className="text-xl font-black text-gray-900">R$ {resumoCards.receita_total}</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                <ArrowTrendingDownIcon className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Taxas e Estornos</p>
                                <p className="text-xl font-black text-gray-900">- R$ {resumoCards.despesas_totais}</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0"></div>
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lucro Líquido</p>
                                <p className="text-xl font-black text-gray-900">R$ {resumoCards.lucro_liquido}</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                                <div className="w-4 h-4 bg-purple-200 rounded-sm"></div>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transações</p>
                                <p className="text-xl font-black text-gray-900">{resumoCards.transacoes_count}</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center shrink-0">
                                <div className="w-4 h-3 bg-yellow-400 rounded-sm"></div>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ticket Médio</p>
                                <p className="text-xl font-black text-gray-900">R$ {resumoCards.ticket_medio}</p>
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS COM DROPDOWNS */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <select value={filtroEstabelecimento} onChange={e => setFiltroEstabelecimento(e.target.value)} className="border-gray-200 text-sm rounded-lg text-gray-600 focus:ring-emerald-500 focus:border-emerald-500 py-2 min-w-[200px]">
                            <option value="todos">Todos os estabelecimentos</option>
                            {filtrosDados.estabelecimentos?.map(est => (
                                <option key={est.id} value={est.id}>{est.nome}</option>
                            ))}
                        </select>

                        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="border-gray-200 text-sm rounded-lg text-gray-600 focus:ring-emerald-500 focus:border-emerald-500 py-2">
                            <option value="todos">Todos os tipos (Crédito/Estorno)</option>
                            <option value="credito">Entradas (Créditos)</option>
                            <option value="estorno">Devoluções (Estornos)</option>
                            <option value="repasse">Repasses Recebidos</option>
                        </select>

                        <select value={filtroFormaPgto} onChange={e => setFiltroFormaPgto(e.target.value)} className="border-gray-200 text-sm rounded-lg text-gray-600 focus:ring-emerald-500 focus:border-emerald-500 py-2">
                            <option value="todos">Todas as formas de pagamento</option>
                            <option value="pix">PIX</option>
                            <option value="cartao_credito">Cartão de Crédito</option>
                            <option value="boleto">Boleto Bancário</option>
                        </select>
                    </div>

                    {/* CONTEÚDO PRINCIPAL (TABELA + SIDEBAR) */}
                    <div className="flex flex-col xl:flex-row gap-6">
                        
                        {/* TABELA ESQUERDA (DADOS VIVOS) */}
                        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-gray-50 flex items-center gap-3">
                                <h2 className="text-lg font-bold text-gray-900">Movimentações</h2>
                                <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">{extrato.total} registros encontrados</span>
                            </div>
                            
                            <div className="overflow-x-auto min-h-[400px]">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data / Hora</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descrição</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cliente Pagador</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Método</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Líquido (88%)</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {extrato.data?.map((item) => {
                                            const dataObj = new Date(item.created_at);
                                            const isCredito = item.tipo === 'credito';
                                            
                                            // Ícones Condicionais de Pagamento
                                            let MetodoIcon = CreditCardIcon;
                                            if(item.metodo_pagamento === 'pix') MetodoIcon = DevicePhoneMobileIcon;
                                            if(item.metodo_pagamento === 'boleto') MetodoIcon = DocumentTextIcon;

                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition">
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <p className="text-sm font-semibold text-gray-900">{dataObj.toLocaleDateString('pt-BR')}</p>
                                                        <p className="text-xs text-gray-400 font-medium">{dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${isCredito ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {item.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-semibold text-gray-900">{item.descricao}</p>
                                                        <p className="text-xs text-gray-500 font-medium">Ref: {item.origem_type.includes('Aluguel') ? 'Reserva de Locação' : 'Serviço Agendado'}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-semibold text-gray-900">{item.usuario?.name || 'Sistema'}</p>
                                                        <p className="text-xs text-gray-400 font-medium">ID: {item.origem_id}</p>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <MetodoIcon className={`w-4 h-4 ${item.metodo_pagamento === 'pix' ? 'text-teal-500' : 'text-gray-400'}`} />
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-700 capitalize">{item.metodo_pagamento?.replace('_', ' ')}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <p className={`text-sm font-bold ${isCredito ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {isCredito ? '' : '- '}R$ {item.valor_liquido?.toFixed(2).replace('.', ',')}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${formatarStatus(item.status)}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {extrato.data?.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="px-5 py-16 text-center text-gray-400 font-medium">Nenhum registro encontrado para este filtro.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Links de Paginação do Laravel via Inertia */}
                            <div className="p-5 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between mt-auto gap-4">
                                <p className="text-xs text-gray-500 font-medium">
                                    Mostrando {extrato.from || 0} a {extrato.to || 0} de {extrato.total || 0} registros
                                </p>
                                <div className="flex flex-wrap items-center gap-1">
                                    {extrato.links?.map((link, index) => (
                                        <button 
                                            key={index}
                                            onClick={() => { if(link.url) router.get(link.url, {}, { preserveScroll: true }) }}
                                            disabled={!link.url}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                            className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-all ${link.active ? 'bg-emerald-50 text-emerald-600 font-bold border border-emerald-100' : 'text-gray-500 hover:bg-gray-100 border border-transparent'} ${!link.url && 'opacity-30 cursor-not-allowed'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SIDEBAR DIREITA (GRÁFICOS E RESUMOS LATERAIS) */}
                        <div className="w-full xl:w-[350px] flex flex-col gap-6">
                            
                            <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 mb-5">Resumo do período</h3>
                                <div className="space-y-3 text-sm border-b border-gray-100 pb-4 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Total Bruto</span>
                                        <span className="font-bold text-emerald-600">R$ {resumoCards.receita_total}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Taxas e Estornos</span>
                                        <span className="font-bold text-rose-600">- R$ {resumoCards.despesas_totais}</span>
                                    </div>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-900 font-bold">Líquido Final</span>
                                        <span className="font-black text-emerald-600">R$ {resumoCards.lucro_liquido}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Ticket médio</span>
                                        <span className="font-bold text-gray-900">R$ {resumoCards.ticket_medio}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Transações</span>
                                        <span className="font-bold text-gray-900">{resumoCards.transacoes_count}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Gráfico Donut de Receitas por Meio de Pagamento */}
                            <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 mb-6">Receitas por método (Via Asaas)</h3>
                                
                                {dadosGraficos.formas_pagamento?.length > 0 ? (
                                    <div className="flex flex-col sm:flex-row xl:flex-col sm:items-center xl:items-stretch gap-6 mb-2">
                                        <div className="relative w-20 h-20 rounded-full flex items-center justify-center shrink-0 mx-auto" 
                                            // Este gradiente é apenas ilustrativo por falta de lib de gráficos, numa versão em prod use Recharts
                                            style={{ background: 'conic-gradient(#10B981 0% 44%, #3B82F6 44% 82%, #8B5CF6 82% 92%, #F59E0B 92% 100%)' }}>
                                            <div className="w-12 h-12 bg-white rounded-full"></div>
                                        </div>
                                        
                                        <div className="flex-1 space-y-3 text-xs w-full">
                                            {dadosGraficos.formas_pagamento.map((graf, idx) => (
                                                <div key={idx} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${graf.metodo_pagamento === 'pix' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                                        <span className="text-gray-600 font-bold capitalize">{graf.metodo_pagamento.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="text-gray-900 font-black">R$ {Number(graf.total).toFixed(2).replace('.', ',')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-center text-gray-400 py-6">Sem dados suficientes.</p>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}