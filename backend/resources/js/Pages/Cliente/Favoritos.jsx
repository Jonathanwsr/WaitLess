import React, { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Heart, MapPin, Star, ImageOff, Calendar, Compass } from 'lucide-react';

export default function Favoritos({ estabelecimentos = [], servicos = [], reservas = {} }) {
    // 1. Pegamos o auth de forma global e segura através do usePage()
    const { auth } = usePage().props;
    const [abaAtiva, setAbaAtiva] = useState('estabelecimentos');

    const totalFavoritos = estabelecimentos.length + servicos.length;

    const handleToggleFavorito = (tipo, id) => {
        router.post('/api/favoritos/toggle', { tipo, id }, {
            preserveScroll: true,
            onSuccess: () => {
                // A página recarrega os dados atualizados
            }
        });
    };

    const enderecoResumido = (est) => {
        if (est.rua) return `${est.rua}${est.numero ? ', ' + est.numero : ''}${est.bairro ? ' - ' + est.bairro : ''}`;
        if (est.cidade) return `${est.cidade}${est.estado ? '/' + est.estado : ''}`;
        return 'Endereço não informado';
    };

    const statusCores = {
        pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
        em_atendimento: 'bg-teal-100 text-teal-800 border-teal-200',
        finalizado: 'bg-green-100 text-green-800 border-green-200',
        cancelado: 'bg-red-100 text-red-800 border-red-200',
        estornado: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const abas = [
        { id: 'estabelecimentos', label: 'Estabelecimentos', count: estabelecimentos.length },
        { id: 'servicos', label: 'Serviços', count: servicos.length },
        { id: 'reservas', label: 'Reservas', count: null },
    ];

    return (
        <AuthenticatedLayout
            // 2. Usamos o ponto de interrogação (auth?.user) para evitar erros caso o usuário não esteja logado no momento do carregamento
            user={auth?.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Meus Favoritos e Reservas</h2>}
        >
            <Head title="Meus Favoritos e Reservas" />

            <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

                <div className="mb-6 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">
                            {totalFavoritos} {totalFavoritos === 1 ? 'item salvo' : 'itens salvos'}
                        </p>
                        <p className="text-xs text-gray-500">Acompanhe os lugares e serviços que você salvou para depois.</p>
                    </div>
                </div>

                <div className="mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <nav className="flex space-x-3" aria-label="Tabs">
                        {abas.map(({ id, label, count }) => (
                            <button
                                key={id}
                                onClick={() => setAbaAtiva(id)}
                                className={`
                                    whitespace-nowrap py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-300 flex items-center gap-2
                                    ${abaAtiva === id
                                        ? 'bg-orange-600 text-white shadow-md'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-orange-600'
                                    }
                                `}
                            >
                                {label}
                                {count !== null && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${abaAtiva === id ? 'bg-white/20' : 'bg-gray-100'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {abaAtiva === 'estabelecimentos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {estabelecimentos.length > 0 ? (
                            estabelecimentos.map((est) => (
                                <div key={est.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
                                    <Link href={route('estabelecimentos.loja', est.id)} className="block h-44 bg-gray-50 relative overflow-hidden">
                                        {est.foto_perfil ? (
                                            <img
                                                src={est.foto_perfil.startsWith('http') ? est.foto_perfil : `/storage/${est.foto_perfil}`}
                                                alt={est.nome}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageOff className="w-8 h-8 text-gray-300" />
                                            </div>
                                        )}
                                        {Number(est.avaliacao_media) > 0 && (
                                            <span className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                {Number(est.avaliacao_media).toFixed(1)}
                                            </span>
                                        )}
                                    </Link>
                                    <div className="p-6 flex flex-col flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{est.nome}</h3>
                                        {est.ramo_atuacao && (
                                            <span className="inline-block w-fit text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-2">
                                                {est.ramo_atuacao}
                                            </span>
                                        )}
                                        <div className="text-gray-500 text-sm mt-3 flex-grow flex items-start gap-2 leading-relaxed">
                                            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                            {enderecoResumido(est)}
                                        </div>
                                        <button
                                            onClick={() => handleToggleFavorito('estabelecimento', est.id)}
                                            className="mt-6 w-full bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors duration-300"
                                        >
                                            Remover Favorito
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Heart className="w-7 h-7 text-gray-300" />
                                </div>
                                <p className="text-gray-500 text-lg mb-6">Você ainda não tem estabelecimentos favoritos.</p>
                                <Link href={route('cliente.explorar')} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors">
                                    <Compass className="w-4 h-4" /> Explorar agora
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {abaAtiva === 'servicos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {servicos.length > 0 ? (
                            servicos.map((serv) => {
                                const foto = serv.fotos?.[0] || serv.estabelecimento?.foto_perfil;
                                return (
                                    <div key={serv.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
                                        <div className="h-44 bg-gray-50 relative overflow-hidden">
                                            {foto ? (
                                                <img
                                                    src={foto.startsWith?.('http') ? foto : `/storage/${foto}`}
                                                    alt={serv.nome}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageOff className="w-8 h-8 text-gray-300" />
                                                </div>
                                            )}
                                            {Number(serv.avaliacao_media) > 0 && (
                                                <span className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                    {Number(serv.avaliacao_media).toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-6 flex flex-col flex-1">
                                            <div className="flex justify-between items-start gap-4">
                                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors leading-tight">{serv.nome}</h3>
                                                <span className="font-extrabold text-orange-700 bg-orange-50 px-3 py-1 rounded-lg whitespace-nowrap text-sm">
                                                    R$ {Number(serv.valor || 0).toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                            {serv.estabelecimento?.nome && (
                                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-1">{serv.estabelecimento.nome}</p>
                                            )}
                                            <p className="text-gray-500 text-sm mt-3 flex-grow leading-relaxed line-clamp-2">{serv.descricao}</p>
                                            <button
                                                onClick={() => handleToggleFavorito('servico', serv.id)}
                                                className="mt-6 w-full bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-colors duration-300"
                                            >
                                                Remover Favorito
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Heart className="w-7 h-7 text-gray-300" />
                                </div>
                                <p className="text-gray-500 text-lg mb-6">Você ainda não tem serviços favoritos.</p>
                                <Link href={route('cliente.explorar')} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors">
                                    <Compass className="w-4 h-4" /> Explorar agora
                                </Link>
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
                                                    <Calendar className="w-4 h-4 text-blue-400" />
                                                    <span className="font-medium">{new Date(reserva.data_agendamento).toLocaleString('pt-BR')}</span>
                                                </div>

                                                <div className="flex items-center text-sm text-gray-600 mt-2 gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
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
