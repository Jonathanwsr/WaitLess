import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';

export default function Favoritos({ estabelecimentos = [], servicos = [], reservas = {} }) {
    const [abaAtiva, setAbaAtiva] = useState('estabelecimentos');

    // Função para remover dos favoritos
    const handleToggleFavorito = (tipo, id) => {
        router.post('/api/favoritos/toggle', { tipo, id }, {
            preserveScroll: true,
            onSuccess: () => {
                // A página recarrega os dados atualizados automaticamente via Inertia
            }
        });
    };

    // Cores para os status das reservas
    const statusCores = {
        pendente: 'bg-yellow-100 text-yellow-800',
        confirmado: 'bg-blue-100 text-blue-800',
        em_atendimento: 'bg-indigo-100 text-indigo-800',
        finalizado: 'bg-green-100 text-green-800',
        cancelado: 'bg-red-100 text-red-800',
        estornado: 'bg-gray-100 text-gray-800',
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <Head title="Meus Favoritos e Reservas" />

            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Meus Favoritos e Reservas</h1>

                {/* Navegação por Abas */}
                <div className="border-b border-gray-200 mb-8">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {['estabelecimentos', 'servicos', 'reservas'].map((aba) => (
                            <button
                                key={aba}
                                onClick={() => setAbaAtiva(aba)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                                    ${abaAtiva === aba
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                {aba}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Conteúdo: Estabelecimentos */}
                {abaAtiva === 'estabelecimentos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {estabelecimentos.length > 0 ? (
                            estabelecimentos.map((est) => (
                                <div key={est.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex flex-col transition hover:shadow-md">
                                    <h3 className="text-lg font-semibold text-gray-900">{est.nome}</h3>
                                    <p className="text-gray-500 text-sm mt-1 flex-grow">{est.endereco}</p>
                                    <button 
                                        onClick={() => handleToggleFavorito('estabelecimento', est.id)}
                                        className="mt-4 w-full bg-red-50 text-red-600 font-medium py-2 rounded-md hover:bg-red-100 transition"
                                    >
                                        Remover Favorito
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 col-span-full">Você ainda não tem estabelecimentos favoritos.</p>
                        )}
                    </div>
                )}

                {/* Conteúdo: Serviços */}
                {abaAtiva === 'servicos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {servicos.length > 0 ? (
                            servicos.map((serv) => (
                                <div key={serv.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex flex-col transition hover:shadow-md">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-semibold text-gray-900">{serv.nome}</h3>
                                        <span className="font-bold text-indigo-600">R$ {serv.preco}</span>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1 flex-grow">{serv.descricao}</p>
                                    <button 
                                        onClick={() => handleToggleFavorito('servico', serv.id)}
                                        className="mt-4 w-full bg-red-50 text-red-600 font-medium py-2 rounded-md hover:bg-red-100 transition"
                                    >
                                        Remover Favorito
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 col-span-full">Você ainda não tem serviços favoritos.</p>
                        )}
                    </div>
                )}

                {/* Conteúdo: Reservas */}
                {abaAtiva === 'reservas' && (
                    <div className="space-y-8">
                        {/* Exemplo mapeando as reservas "Próximas" - você pode replicar para em_andamento, concluidas, etc. */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Próximas Reservas</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {reservas.proximas?.length > 0 ? (
                                    reservas.proximas.map((reserva) => (
                                        <div key={reserva.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{reserva.servico?.nome || 'Serviço indisponível'}</h4>
                                                <p className="text-sm text-gray-500">{new Date(reserva.data_agendamento).toLocaleString('pt-BR')}</p>
                                                <p className="text-sm text-gray-600 mt-1">{reserva.estabelecimento?.nome}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCores[reserva.status] || statusCores.pendente}`}>
                                                {reserva.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500">Nenhuma reserva próxima.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}