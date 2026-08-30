import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Favoritos({ estabelecimentos = [], servicos = [], reservas = {} }) {
    // 1. Pegamos o auth de forma global e segura através do usePage()
    const { auth } = usePage().props;
    const [abaAtiva, setAbaAtiva] = useState('estabelecimentos');

    const handleToggleFavorito = (tipo, id) => {
        router.post('/api/favoritos/toggle', { tipo, id }, {
            preserveScroll: true,
            onSuccess: () => {
                // A página recarrega os dados atualizados
            }
        });
    };

    const statusCores = {
        pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
        em_atendimento: 'bg-teal-100 text-teal-800 border-teal-200',
        finalizado: 'bg-green-100 text-green-800 border-green-200',
        cancelado: 'bg-red-100 text-red-800 border-red-200',
        estornado: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
        <AuthenticatedLayout
            // 2. Usamos o ponto de interrogação (auth?.user) para evitar erros caso o usuário não esteja logado no momento do carregamento
            user={auth?.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Meus Favoritos e Reservas</h2>}
        >
            <Head title="Meus Favoritos e Reservas" />

            <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                
                <div className="mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <nav className="flex space-x-3" aria-label="Tabs">
                        {['estabelecimentos', 'servicos', 'reservas'].map((aba) => (
                            <button
                                key={aba}
                                onClick={() => setAbaAtiva(aba)}
                                className={`
                                    whitespace-nowrap py-2.5 px-6 rounded-full font-semibold text-sm capitalize transition-all duration-300
                                    ${abaAtiva === aba
                                        ? 'bg-orange-600 text-white shadow-md'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-orange-600'
                                    }
                                `}
                            >
                                {aba}
                            </button>
                        ))}
                    </nav>
                </div>

                {abaAtiva === 'estabelecimentos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {estabelecimentos.length > 0 ? (
                            estabelecimentos.map((est) => (
                                <div key={est.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
                                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{est.nome}</h3>
                                    <div className="text-gray-500 text-sm mt-3 flex-grow flex items-start gap-2 leading-relaxed">
                                        <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        {est.endereco}
                                    </div>
                                    <button 
                                        onClick={() => handleToggleFavorito('estabelecimento', est.id)}
                                        className="mt-6 w-full bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors duration-300"
                                    >
                                        Remover Favorito
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                                <p className="text-gray-500 text-lg">Você ainda não tem estabelecimentos favoritos.</p>
                            </div>
                        )}
                    </div>
                )}

                {abaAtiva === 'servicos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {servicos.length > 0 ? (
                            servicos.map((serv) => (
                                <div key={serv.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
                                    <div className="flex justify-between items-start gap-4">
                                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{serv.nome}</h3>
                                        <span className="font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg whitespace-nowrap">
                                            R$ {serv.preco}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-4 flex-grow leading-relaxed">{serv.descricao}</p>
                                    <button 
                                        onClick={() => handleToggleFavorito('servico', serv.id)}
                                        className="mt-6 w-full bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors duration-300"
                                    >
                                        Remover Favorito
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                                <p className="text-gray-500 text-lg">Você ainda não tem serviços favoritos.</p>
                            </div>
                        )}
                    </div>
                )}

                {abaAtiva === 'reservas' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">Próximas Reservas</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {reservas.proximas?.length > 0 ? (
                                    reservas.proximas.map((reserva) => (
                                        <div key={reserva.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all duration-300 hover:shadow-md hover:border-blue-100">
                                            <div className="flex flex-col">
                                                <h4 className="text-lg font-bold text-gray-900">{reserva.servico?.nome || 'Serviço indisponível'}</h4>
                                                
                                                <div className="flex items-center text-sm text-gray-500 mt-3 gap-2">
                                                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                    <span className="font-medium">{new Date(reserva.data_agendamento).toLocaleString('pt-BR')}</span>
                                                </div>
                                                
                                                <div className="flex items-center text-sm text-gray-600 mt-2 gap-2">
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                                    <span>{reserva.estabelecimento?.nome}</span>
                                                </div>
                                            </div>
                                            <div className="self-start sm:self-center">
                                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${statusCores[reserva.status] || statusCores.pendente}`}>
                                                    {reserva.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                                        <p className="text-gray-500 text-lg">Nenhuma reserva próxima agendada.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}