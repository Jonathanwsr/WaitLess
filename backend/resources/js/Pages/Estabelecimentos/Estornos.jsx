import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';

export default function EstornosEstabelecimento({ auth }) {
    const [estornos, setEstornos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('');

    // Busca os dados na API quando o componente monta ou o filtro muda
    useEffect(() => {
        carregarEstornos();
    }, [filtroStatus]);

    const carregarEstornos = async () => {
        setLoading(true);
        try {
            // Usa a mesma rota da API, mas o backend já filtra para trazer onde ele é o prestador_id
            const url = filtroStatus 
                ? `/api/estornos/lista?status=${filtroStatus}` 
                : '/api/estornos/lista';
            
            const response = await axios.get(url);
            setEstornos(response.data.data);
        } catch (error) {
            console.error("Erro ao buscar estornos do estabelecimento:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status) => {
        const cores = {
            PENDENTE: 'bg-yellow-100 text-yellow-800',
            APROVADO: 'bg-green-100 text-green-800', // Aprovado (Dinheiro saiu do estabel.)
            REPROVADO: 'bg-red-100 text-red-800',   // Reprovado (Dinheiro ficou com o estabel.)
            CONTESTADO: 'bg-orange-100 text-orange-800'
        };
        const cor = cores[status?.toUpperCase()] || 'bg-gray-100 text-gray-800';
        
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cor}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <Head title="Gestão de Estornos" />

            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Gestão de Estornos</h1>
                        <p className="text-sm text-gray-500 mt-1">Solicitações de reembolso feitas por seus clientes.</p>
                    </div>
                    
                    {/* Filtro de Status */}
                    <select 
                        className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                    >
                        <option value="">Todos os status</option>
                        <option value="PENDENTE">Aguardando sua ação (Pendentes)</option>
                        <option value="CONTESTADO">Em Análise pela Plataforma</option>
                        <option value="APROVADO">Devolvidos ao Cliente</option>
                        <option value="REPROVADO">A favor do Estabelecimento (Reprovados)</option>
                    </select>
                </div>

                {/* Lista / Tabela */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">Carregando solicitações...</div>
                    ) : estornos.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            Nenhum estorno solicitado pelos seus clientes.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Data do Pedido
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Cliente / Referência
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Motivo Alegado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {estornos.map((estorno) => (
                                    <tr key={estorno.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(estorno.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            {/* Nota: O Controller (minhasSolicitacoes) precisa carregar o cliente para mostrar o nome aqui */}
                                            <div className="text-sm font-bold text-gray-900">
                                                ID Pagamento: #{estorno.pagamento_id}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {estorno.categoria === 'SERVICO' 
                                                    ? estorno.servico?.nome 
                                                    : estorno.item_aluguel?.nome}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 truncate max-w-xs" title={estorno.motivo}>
                                                {estorno.motivo}
                                            </div>
                                            {/* Indicador visual se o dono ainda não viu */}
                                            {!estorno.prestador_visualizou && estorno.status === 'PENDENTE' && (
                                                <span className="text-xs text-red-600 font-bold">Novo!</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderStatusBadge(estorno.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button 
                                                onClick={() => alert(`Aguardando tela de Análise/Contestação para o ID: ${estorno.id}`)}
                                                className={`${
                                                    estorno.status === 'PENDENTE' 
                                                    ? 'text-orange-600 hover:text-orange-900' 
                                                    : 'text-blue-600 hover:text-blue-900'
                                                } font-semibold`}
                                            >
                                                {estorno.status === 'PENDENTE' ? 'Analisar e Contestar' : 'Ver Detalhes'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}