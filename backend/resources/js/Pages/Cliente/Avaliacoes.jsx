import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { 
    Star, ChevronRight, CheckCircle2, ChevronDown, Filter, 
    MoreHorizontal, Edit3, ImageOff, MapPin // <-- MapPin adicionado aqui!
} from 'lucide-react';

export default function Avaliacoes({ auth, item, avaliacoes, estatisticas, itemNaoEncontrado }) {
    const [filtroEstrela, setFiltroEstrela] = useState('Todas');

    if (itemNaoEncontrado || !item) {
        return (
            <AuthenticatedLayout user={auth?.user}>
                <Head title="Não Encontrado" />
                <div className="bg-[#FBF9F9] min-h-screen flex flex-col items-center justify-center font-sans p-4 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 max-w-md w-full flex flex-col items-center">
                        <ImageOff className="w-20 h-20 text-gray-300 mb-4" />
                        <h1 className="text-2xl font-black text-gray-900 mb-2">Serviço não encontrado</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Não foi possível encontrar as avaliações deste serviço, pois ele pode ter sido removido.
                        </p>
                        <Link href={route('cliente.explorar')} className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                            Voltar para Explorar
                        </Link>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    const calcularPorcentagem = (quantidade) => {
        if (!estatisticas.total || estatisticas.total === 0) return 0;
        return (quantidade / estatisticas.total) * 100;
    };

    const parseFotosSeguro = (fotosData) => {
        if (!fotosData) return [];
        if (typeof fotosData === 'string') {
            try { return JSON.parse(fotosData); } catch (e) { return []; }
        }
        return Array.isArray(fotosData) ? fotosData : [];
    };

    const ProgressBar = ({ label, quantidade }) => (
        <div className="flex items-center gap-4 text-sm mb-2">
            <span className="w-16 text-gray-600">{label} estrelas</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#FF5A00] rounded-full" 
                    style={{ width: `${calcularPorcentagem(quantidade)}%` }}
                ></div>
            </div>
            <span className="w-8 text-right text-gray-600 font-medium">{quantidade}</span>
        </div>
    );

    const CategoryScore = ({ icon: Icon, label, score }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-[#FF5A00]" />
                <span className="text-gray-800 font-medium">{label}</span>
            </div>
            <span className="font-bold text-gray-900">{Number(score || 0).toFixed(1)}</span>
        </div>
    );

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`Avaliações de ${item.nome}`} />

            <div className="bg-[#FBF9F9] min-h-screen pb-24 font-sans">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                    <div className="flex items-center text-sm text-gray-500 font-medium">
                        <Link href={route('dashboard')} className="hover:underline">Início</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <Link href={route('cliente.explorar')} className="hover:underline">Destinos</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="hover:underline cursor-pointer">{item.cidade}</span>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <Link href={route('itens.detalhes', item.id)} className="hover:underline">{item.nome}</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="text-gray-900 font-bold">Avaliações</span>
                    </div>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-gray-900 mb-2">Avaliações: {item.nome}</h1>
                        <p className="text-gray-500 font-medium">Veja o que os clientes que já utilizaram têm a dizer.</p>
                    </div>

                    <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-12 mb-8">
                        <div className="flex flex-col items-center justify-center shrink-0">
                            <span className="text-6xl font-black text-gray-900 tracking-tighter mb-2">
                                {Number(estatisticas.media_geral || 0).toFixed(1).replace('.', ',')}
                            </span>
                            <div className="flex text-[#FF5A00] mb-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} className={`w-5 h-5 ${star <= Math.round(estatisticas.media_geral || 0) ? 'fill-current' : 'text-gray-300'}`} />
                                ))}
                            </div>
                            <span className="font-bold text-gray-900 mb-0.5">
                                {estatisticas.media_geral >= 4.5 ? 'Excelente' : 'Bom'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">Baseado em {estatisticas.total} avaliações</span>
                        </div>

                        <div className="flex-1 w-full max-w-md border-l md:border-l-2 border-gray-100 md:pl-12">
                            <ProgressBar label="5" quantidade={estatisticas.estrelas['5'] || 0} />
                            <ProgressBar label="4" quantidade={estatisticas.estrelas['4'] || 0} />
                            <ProgressBar label="3" quantidade={estatisticas.estrelas['3'] || 0} />
                            <ProgressBar label="2" quantidade={estatisticas.estrelas['2'] || 0} />
                            <ProgressBar label="1" quantidade={estatisticas.estrelas['1'] || 0} />
                        </div>

                        <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-12">
                            <div className="bg-emerald-100 w-10 h-10 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-1">Avaliações verificadas</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                Todas as avaliações são de clientes que realmente utilizaram este serviço na plataforma.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-10">
                        <div className="lg:w-[70%]">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                                <div className="flex flex-wrap gap-2">
                                    {['Todas', '5 estrelas', '4 estrelas'].map(filtro => (
                                        <button key={filtro} onClick={() => setFiltroEstrela(filtro)} className={`px-5 py-2.5 rounded-full font-bold text-sm border transition-colors ${ filtroEstrela === filtro ? 'border-[#FF5A00] text-[#FF5A00] bg-[#FFF0E5]' : 'border-gray-300 text-gray-600 bg-white'}`}>
                                            {filtro} {filtro === 'Todas' ? `(${estatisticas.total})` : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                {!avaliacoes?.data || avaliacoes.data.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-3xl border border-gray-200">
                                        <h3 className="text-gray-900 font-bold text-lg mb-2">Ainda não há avaliações</h3>
                                        <p className="text-gray-500">Seja o primeiro a compartilhar sua experiência após utilizar o serviço.</p>
                                    </div>
                                ) : (
                                    avaliacoes.data.map(aval => {
                                        const fotosArray = parseFotosSeguro(aval.fotos);
                                        return (
                                            <div key={aval.id} className="border-b border-gray-200 pb-8 last:border-0">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                                                            {aval.usuario?.foto_perfil ? (
                                                                <img src={aval.usuario.foto_perfil} alt={aval.usuario.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 text-lg">
                                                                    {aval.usuario?.name?.charAt(0) || 'U'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-gray-900 text-base">{aval.usuario?.name}</h5>
                                                            <p className="text-xs text-gray-500">
                                                                {new Date(aval.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="flex text-[#FF5A00]">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`w-4 h-4 ${i < aval.nota ? 'fill-current' : 'text-gray-300'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="font-bold text-gray-900">{aval.nota},0</span>
                                                </div>

                                                <p className="text-gray-700 leading-relaxed mb-4">{aval.comentario}</p>

                                                {/* GALERIA DE FOTOS DA AVALIAÇÃO */}
                                                {fotosArray.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                        {fotosArray.map((fotoUrl, idx) => (
                                                            <div key={idx} className="w-32 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                                                                <img 
                                                                    src={fotoUrl} 
                                                                    alt="Foto da avaliação" 
                                                                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" 
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="lg:w-[30%] space-y-6">
                            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Notas por categoria</h3>
                                <div>
                                    <CategoryScore icon={Star} label="Limpeza" score={estatisticas.categorias.limpeza} />
                                    <CategoryScore icon={Star} label="Precisão" score={estatisticas.categorias.precisao} />
                                    <CategoryScore icon={Star} label="Comunicação" score={estatisticas.categorias.comunicacao} />
                                    <CategoryScore icon={MapPin} label="Localização" score={estatisticas.categorias.localizacao} />
                                    <CategoryScore icon={CheckCircle2} label="Check-in" score={estatisticas.categorias.checkin} />
                                    <CategoryScore icon={Star} label="Custo-benefício" score={estatisticas.categorias.custo_beneficio} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}