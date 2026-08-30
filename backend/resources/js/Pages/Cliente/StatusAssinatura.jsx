import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function StatusAssinatura({ auth, statusAssinatura }) {
    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Minha Assinatura</h2>}
        >
            <Head title="Minha Assinatura" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* Status da Assinatura Atual */}
                    <div className="bg-white shadow-sm sm:rounded-lg mb-8">
                        <div className="p-6 text-gray-900">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Detalhes do seu plano</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <p><strong>Plano Atual:</strong> <span className="uppercase font-semibold text-indigo-600">{statusAssinatura.plano_atual}</span></p>
                                <p><strong>Status:</strong> {statusAssinatura.status_acesso}</p>
                                <p><strong>Expira em:</strong> {statusAssinatura.expira_em || 'N/A'}</p>
                                <p><strong>Dias Restantes:</strong> {statusAssinatura.dias_restantes}</p>
                            </div>
                        </div>
                    </div>

                    {/* Propaganda / Oferta de Planos */}
                    <div className="mt-10">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                                Faça um Upgrade e Ganhe Mais!
                            </h2>
                            <p className="mt-4 text-lg text-gray-500">
                                Tenha acesso a pontos, descontos, promoções e serviços exclusivos.
                            </p>
                        </div>

                        <div className="flex flex-col md:flex-row justify-center gap-6 px-4 sm:px-0">
                            
                            {/* Plano de R$ 8,00 */}
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex-1 max-w-sm mx-auto hover:border-indigo-500 transition-colors">
                                <h3 className="text-xl font-semibold text-gray-900">Plano Básico</h3>
                                <p className="mt-4 flex items-baseline text-gray-900">
                                    <span className="text-4xl font-extrabold tracking-tight">R$ 8,00</span>
                                    <span className="ml-1 text-xl font-semibold text-gray-500">/mês</span>
                                </p>
                                <ul role="list" className="mt-6 space-y-4 text-gray-600">
                                    <li className="flex items-center">
                                        <span className="text-green-500 mr-2">✔</span> Acúmulo de pontos
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-green-500 mr-2">✔</span> Acesso a promoções
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-green-500 mr-2">✔</span> Descontos básicos
                                    </li>
                                </ul>
                                <button className="mt-8 block w-full bg-indigo-50 text-indigo-700 font-semibold text-center py-3 px-4 rounded-md hover:bg-indigo-100 transition">
                                    Assinar Básico
                                </button>
                            </div>

                            {/* Plano de R$ 14,99 */}
                            <div className="bg-gray-900 border border-gray-900 rounded-2xl shadow-xl p-8 flex-1 max-w-sm mx-auto relative md:-translate-y-4">
                                <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-3">
                                    <span className="bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                                        Mais Vantagens
                                    </span>
                                </div>
                                <h3 className="text-xl font-semibold text-white">Plano Premium</h3>
                                <p className="mt-4 flex items-baseline text-white">
                                    <span className="text-4xl font-extrabold tracking-tight">R$ 14,99</span>
                                    <span className="ml-1 text-xl font-semibold text-gray-400">/mês</span>
                                </p>
                                <ul role="list" className="mt-6 space-y-4 text-gray-300">
                                    <li className="flex items-center">
                                        <span className="text-indigo-400 mr-2">✔</span> <strong>Mais pontos</strong> acumulados
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-indigo-400 mr-2">✔</span> Promoções <strong>exclusivas</strong>
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-indigo-400 mr-2">✔</span> Descontos <strong>agressivos</strong>
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-indigo-400 mr-2">✔</span> <strong>Serviços Exclusivos</strong> apenas para assinantes
                                    </li>
                                </ul>
                                <button className="mt-8 block w-full bg-indigo-500 text-white font-semibold text-center py-3 px-4 rounded-md hover:bg-indigo-600 transition shadow-md">
                                    Assinar Premium
                                </button>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}