import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { 
    Share, Heart, Users, BedDouble, Bath, Wifi, Wind, MapPin, 
    ImageOff, ChevronRight, CheckCircle2, ChevronDown, Calendar,
    Award, ShieldCheck, Map, Clock, Ban, Dog, Star, Car, Tv,
    Coffee, Flame, Fan
} from 'lucide-react';

export default function DetalhesItem({ auth, item }) {
    const [isSaved, setIsSaved] = useState(false);

    // --- FORM INERTIA (Para enviar a reserva) ---
    // Define hoje e amanhã para os valores padrão dos inputs de data
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data, setData, post, processing, errors } = useForm({
        data_inicio: today,
        data_fim: tomorrow,
        hospedes: 1,
        forma_pagamento: 'online', // Default
        pontos_utilizados: 0,
    });

    // --- LÓGICA DE CÁLCULO DINÂMICO DE DATAS E PREÇO ---
    const checkIn = new Date(data.data_inicio);
    const checkOut = new Date(data.data_fim);
    const diffTime = checkOut - checkIn;
    const totalDiasCalculado = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 1;
    
    const valorDiaria = Number(item.valor_diaria || 0);
    const precoSubtotal = valorDiaria * totalDiasCalculado;
    
    // Lógica para mostrar desconto com pontos (Exemplo: Sugere abater 10% se tiver saldo)
    const desconto10Porcento = precoSubtotal * 0.10;
    const pontosNecessarios10Porcento = Math.floor(desconto10Porcento * 100); 
    const pontosUsuario = auth.user?.pontos_saldo || 0;
    const podeUsarPontos = pontosUsuario >= pontosNecessarios10Porcento && item.aceita_pontos;

    // --- FORMATAÇÃO DE DADOS ---
    const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorDiaria);
    const precoTotalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoSubtotal);
    const enderecoCompleto = `${item.endereco}, ${item.numero} ${item.complemento ? '- ' + item.complemento : ''}, ${item.bairro} - ${item.cidade}, ${item.estado} - CEP: ${item.cep}`;
    
    // --- LÓGICA DO MAPA ---
    const googleMapsUrl = item.latitude && item.longitude 
        ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.endereco}, ${item.numero}, ${item.cidade} - ${item.estado}`)}`;

    // --- LÓGICA DE FOTOS (FALLBACK PARA SEM IMAGEM) ---
    const fotos = item.fotos && item.fotos.length > 0 ? item.fotos : [];
    const imagensExibicao = Array.from({ length: 6 }).map((_, index) => {
        return fotos[index] || null; 
    });

    // --- FUNÇÕES DE SUBMIT DA RESERVA ---
    const realizarReserva = (usarPontos = false) => {
        let payload = { ...data };
        
        if (usarPontos && podeUsarPontos) {
            payload.pontos_utilizados = pontosNecessarios10Porcento;
        } else {
            payload.pontos_utilizados = 0;
        }

        // Chama a rota criada no backend
        post(route('itens.reservar', item.id), {
            data: payload,
            preserveScroll: true,
        });
    };

    // --- MAPEAMENTO DE ÍCONES PARA COMODIDADES ---
    const getIconForComodidade = (nome) => {
        const n = nome.toLowerCase();
        if (n.includes('wifi') || n.includes('wi-fi')) return <Wifi className="w-5 h-5" />;
        if (n.includes('ar')) return <Wind className="w-5 h-5" />;
        if (n.includes('tv')) return <Tv className="w-5 h-5" />;
        if (n.includes('vaga') || n.includes('estacionamento') || n.includes('garagem')) return <Car className="w-5 h-5" />;
        if (n.includes('pet')) return <Dog className="w-5 h-5" />;
        if (n.includes('churrasqueira')) return <Flame className="w-5 h-5" />;
        if (n.includes('cama')) return <BedDouble className="w-5 h-5" />;
        return <CheckCircle2 className="w-5 h-5" />;
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`${item.nome} em ${item.cidade} - WaitLess`} />

            <div className="bg-white min-h-screen pb-24 font-sans text-gray-900">
                
                {/* --- BREADCRUMBS --- */}
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                    <div className="flex items-center text-sm text-gray-500 font-medium">
                        <Link href={route('dashboard')} className="hover:underline">Início</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <Link href={route('cliente.explorar')} className="hover:underline">Destinos</Link>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="hover:underline cursor-pointer">{item.cidade}</span>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="text-gray-900">{item.tipo}</span>
                    </div>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* --- GALERIA DE FOTOS --- */}
                    <div className="relative mb-8">
                        {/* Imagem Principal (Topo) */}
                        <div className="w-full h-[400px] md:h-[500px] rounded-t-3xl overflow-hidden bg-gray-100 relative mb-2">
                            {imagensExibicao[0] ? (
                                <img src={imagensExibicao[0]} alt={item.nome} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200/60">
                                    <ImageOff className="w-12 h-12 mb-3 text-gray-300" />
                                    <span className="font-bold text-lg">Sem imagem</span>
                                </div>
                            )}

                            {/* Badges Flutuantes na Imagem Principal */}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <div className="bg-[#00A699] text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5" /> Superhost
                                </div>
                                <div className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5">
                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> 
                                    4,9 <span className="text-gray-500 font-medium">(128 avaliações)</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setIsSaved(!isSaved)}
                                className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                            >
                                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                            </button>
                        </div>

                        {/* Grade de 5 Imagens Menores (Embaixo) */}
                        <div className="grid grid-cols-5 gap-2 h-28 md:h-36">
                            {[1, 2, 3, 4, 5].map((index) => (
                                <div key={index} className={`relative bg-gray-100 overflow-hidden ${index === 1 ? 'rounded-bl-3xl' : ''} ${index === 5 ? 'rounded-br-3xl' : ''}`}>
                                    {imagensExibicao[index] ? (
                                        <img src={imagensExibicao[index]} alt={`Foto ${index}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200/60 border border-white/50">
                                            <ImageOff className="w-5 h-5 mb-1 text-gray-300" />
                                            <span className="font-bold text-[10px]">Sem foto</span>
                                        </div>
                                    )}
                                    {/* Overlay "+24 fotos" na última miniatura */}
                                    {index === 5 && (
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white cursor-pointer hover:bg-black/50 transition-colors">
                                            <span className="font-bold text-lg">+24</span>
                                            <span className="text-xs font-medium">fotos</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- CONTEÚDO PRINCIPAL (SPLIT LAYOUT) --- */}
                    <div className="flex flex-col lg:flex-row gap-12">
                        
                        {/* LADO ESQUERDO (Detalhes do Local) - 65% */}
                        <div className="lg:w-[65%]">
                            
                            {/* Título e Botões de Ação */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
                                        {item.nome} em {item.cidade}
                                    </h1>
                                    <p className="text-gray-600 font-medium">
                                        {item.cidade}, {item.estado}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors">
                                        <Share className="w-4 h-4" /> Compartilhar
                                    </button>
                                    <button 
                                        onClick={() => setIsSaved(!isSaved)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-colors"
                                    >
                                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} /> Salvar
                                    </button>
                                </div>
                            </div>

                            {/* Ficha Rápida (Quartos, Camas, Hóspedes) */}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700 font-medium pb-8 border-b border-gray-200">
                                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {item.capacidade_pessoas || 2} hóspedes</span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {item.numero_quartos || 1} quartos</span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {item.numero_suites || 1} camas</span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {item.numero_banheiros || 1} banheiros</span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><Wifi className="w-4 h-4" /> Wi-Fi</span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><Wind className="w-4 h-4" /> Ar-condicionado</span>
                            </div>

                            {/* Sobre o espaço */}
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Sobre o espaço</h3>
                                <p className="text-gray-600 leading-relaxed mb-4">
                                    {item.descricao || 'Desfrute de dias incríveis neste apartamento moderno com vista panorâmica. O espaço é completo, confortável e perfeito para famílias ou casais que buscam relaxar com estilo.'}
                                </p>
                                <button className="text-[#FF5A00] font-bold text-sm hover:underline flex items-center gap-1">
                                    Mostrar mais <ChevronRight className="w-4 h-4" />
                                </button>
                                
                                {/* Grid de Destaques (Mini cards) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                                    <div className="border border-gray-200 rounded-2xl p-4 flex items-start gap-4">
                                        <Coffee className="w-6 h-6 text-gray-700 shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">Cozinha completa</h4>
                                            <p className="text-xs text-gray-500">Utensílios e eletrodomésticos</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded-2xl p-4 flex items-start gap-4">
                                        <Car className="w-6 h-6 text-gray-700 shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">Estacionamento</h4>
                                            <p className="text-xs text-gray-500">{item.numero_vagas} vaga gratuita</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Localização com Mapa */}
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Localização</h3>
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <p className="text-gray-800 font-medium">{item.endereco}, {item.numero}</p>
                                        <p className="text-gray-500 text-sm mb-4">{item.cidade} - {item.estado}, {item.cep}</p>
                                        
                                        {/* Redirecionamento Dinâmico para Maps/Waze */}
                                        <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="block relative w-full h-48 bg-blue-50 rounded-2xl overflow-hidden border border-gray-200 group">
                                            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <MapPin className="w-10 h-10 text-[#FF5A00] drop-shadow-md group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div className="absolute bottom-3 left-3">
                                                <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-gray-50">
                                                    <Map className="w-4 h-4" /> Ver no mapa
                                                </button>
                                            </div>
                                        </a>
                                    </div>
                                    
                                    {/* Distâncias */}
                                    <div className="w-full md:w-64 space-y-4 pt-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="flex items-center gap-2 text-gray-700 font-medium"><MapPin className="w-4 h-4 text-emerald-500" /> Praia</span>
                                            <span className="text-gray-500">3 min (200 m)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="flex items-center gap-2 text-gray-700 font-medium"><Coffee className="w-4 h-4 text-emerald-500" /> Restaurantes</span>
                                            <span className="text-gray-500">5 min (350 m)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="flex items-center gap-2 text-gray-700 font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mercado</span>
                                            <span className="text-gray-500">6 min (450 m)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comodidades */}
                            <div className="py-8 border-b border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">Comodidades</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                                    {item.recursos_oferecidos && item.recursos_oferecidos.length > 0 ? (
                                        item.recursos_oferecidos.map((recurso, idx) => (
                                            <div key={idx} className="flex items-center gap-3 text-gray-700 border border-gray-100 p-3 rounded-xl">
                                                {getIconForComodidade(recurso)}
                                                <span className="text-sm font-medium">{recurso}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-3 text-gray-500 text-sm">Nenhuma comodidade específica listada.</div>
                                    )}
                                </div>
                                <button className="mt-6 text-[#FF5A00] font-bold text-sm hover:underline text-right block w-full">
                                    Ver todas as comodidades
                                </button>
                            </div>

                            {/* Avaliações */}
                            <div className="py-8">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">Avaliações dos hóspedes</h3>
                                        <div className="flex items-end gap-3">
                                            <span className="text-5xl font-black text-gray-900 tracking-tighter">4,9</span>
                                            <div className="pb-1">
                                                <div className="flex text-yellow-400 mb-0.5">
                                                    <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
                                                </div>
                                                <span className="text-sm text-gray-500 font-medium">128 avaliações</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link 
                          href={route('avaliacoes.pagina', item.estabelecimento_id || item.id)} 
                                 className="text-[#FF5A00] font-bold text-sm hover:underline"
>
    Ver todas as avaliações
</Link>
                                </div>

                                {/* Barras de Progresso */}
                                <div className="grid grid-cols-2 gap-x-12 gap-y-3 mb-8">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">Limpeza</span>
                                        <div className="flex items-center gap-3 w-1/2">
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-900 w-[98%]"></div></div>
                                            <span className="font-bold text-gray-900">4,9</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">Localização</span>
                                        <div className="flex items-center gap-3 w-1/2">
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-900 w-[98%]"></div></div>
                                            <span className="font-bold text-gray-900">4,9</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">Precisão</span>
                                        <div className="flex items-center gap-3 w-1/2">
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-900 w-[98%]"></div></div>
                                            <span className="font-bold text-gray-900">4,9</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">Custo-benefício</span>
                                        <div className="flex items-center gap-3 w-1/2">
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-900 w-[96%]"></div></div>
                                            <span className="font-bold text-gray-900">4,8</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card de Review Simulado */}
                                <div className="bg-gray-50 p-5 rounded-2xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
                                                <Users className="w-6 h-6 text-gray-500" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-gray-900 text-sm">Mariana Souza</h5>
                                                <p className="text-xs text-gray-500">Maio de 2026</p>
                                            </div>
                                        </div>
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    </div>
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        Lugar incrível! Vista perfeita, tudo muito limpo e organizado. Voltaremos com certeza!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ============================================================== */}
                        {/* LADO DIREITO (Sidebar Sticky - Formulário de Reserva) - 35% */}
                        {/* ============================================================== */}
                        <div className="lg:w-[35%]">
                            <div className="sticky top-8 space-y-6">
                                
                                {/* CAIXA DE RESERVA PRINCIPAL (O FORMULÁRIO) */}
                                <div className="bg-white border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl p-6">
                                    <div className="mb-6">
                                        <span className="text-2xl font-black text-gray-900">{precoFormatado}</span>
                                        <span className="text-gray-500 font-medium"> / {item.periodo_faturamento_padrao === 'diaria' ? 'noite' : 'período'}</span>
                                    </div>

                                    {/* Banner de Desconto com Pontos dinâmico */}
                                    {item.aceita_pontos && (
                                        <div className="bg-[#FFF5F0] border border-[#FFE4D6] rounded-xl p-4 flex items-start gap-3 mb-6">
                                            <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                                <Award className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-[#D04A02]">10% de desconto com pontos</h4>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    Use {pontosNecessarios10Porcento} pts e economize R$ {desconto10Porcento.toFixed(2).replace('.', ',')}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- INPUTS REAIS DO INERTIA MAS COM O DESIGN DA IMAGEM --- */}
                                    <div className="border border-gray-300 rounded-xl overflow-hidden mb-4 focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-all">
                                        <div className="flex border-b border-gray-300">
                                            <div className="flex-1 p-3 border-r border-gray-300 bg-white hover:bg-gray-50 transition-colors relative">
                                                <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">Check-in</label>
                                                <input 
                                                    type="date" 
                                                    value={data.data_inicio}
                                                    min={today}
                                                    onChange={e => setData('data_inicio', e.target.value)}
                                                    className="w-full border-0 p-0 text-sm text-gray-900 font-medium focus:ring-0 cursor-pointer bg-transparent"
                                                />
                                                {errors.data_inicio && <span className="text-red-500 text-xs">{errors.data_inicio}</span>}
                                            </div>
                                            <div className="flex-1 p-3 bg-white hover:bg-gray-50 transition-colors relative">
                                                <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">Check-out</label>
                                                <input 
                                                    type="date" 
                                                    value={data.data_fim}
                                                    min={data.data_inicio}
                                                    onChange={e => setData('data_fim', e.target.value)}
                                                    className="w-full border-0 p-0 text-sm text-gray-900 font-medium focus:ring-0 cursor-pointer bg-transparent"
                                                />
                                                {errors.data_fim && <span className="text-red-500 text-xs">{errors.data_fim}</span>}
                                            </div>
                                        </div>
                                        
                                        <div className="p-3 bg-white hover:bg-gray-50 transition-colors relative">
                                            <label className="block text-[10px] font-bold text-gray-800 uppercase mb-0.5">Hóspedes / Quantidade</label>
                                            <div className="flex justify-between items-center text-sm text-gray-900 font-medium">
                                                <select 
                                                    value={data.hospedes}
                                                    onChange={e => setData('hospedes', e.target.value)}
                                                    className="w-full border-0 p-0 focus:ring-0 cursor-pointer bg-transparent appearance-none"
                                                >
                                                    {[...Array(item.capacidade_pessoas || 5)].map((_, i) => (
                                                        <option key={i+1} value={i+1}>{i+1} hóspede{i > 0 ? 's' : ''}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none absolute right-3" />
                                            </div>
                                            {errors.hospedes && <span className="text-red-500 text-xs">{errors.hospedes}</span>}
                                        </div>
                                    </div>

                                    {/* Resumo dinâmico do Total */}
                                    <div className="flex justify-between items-center mb-6 text-gray-600 font-medium">
                                        <span className="underline cursor-help">{precoFormatado} x {totalDiasCalculado} noite{totalDiasCalculado > 1 ? 's' : ''}</span>
                                        <span>{precoTotalFormatado}</span>
                                    </div>

                                    <div className="space-y-3">
                                        <button 
                                            disabled={processing}
                                            onClick={() => realizarReserva(false)} 
                                            className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                        >
                                            {processing ? 'Processando...' : 'Fazer reserva'}
                                        </button>
                                        
                                        {item.aceita_pontos && (
                                            <button 
                                                disabled={processing || !podeUsarPontos}
                                                onClick={() => realizarReserva(true)} 
                                                className="w-full bg-[#FFF0E5] hover:bg-[#FFE4D6] text-[#FF5A00] py-3.5 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                                                title={!podeUsarPontos ? "Saldo insuficiente" : "Usar pontos para desconto"}
                                            >
                                                Reservar com pontos
                                            </button>
                                        )}
                                    </div>
                                    
                                    <p className="text-center text-xs text-gray-500 font-medium mt-4">
                                        Você tem <span className="text-[#FF5A00] font-bold">{pontosUsuario} pts</span> disponíveis
                                    </p>
                                </div>

                                {/* BOX: Acumule pontos */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1 text-sm">Acumule pontos nesta reserva</h4>
                                        <p className="font-black text-base text-gray-900">Você ganha {Math.floor(precoSubtotal)} pts</p>
                                        <p className="text-xs text-gray-500 mt-1">Ao completar sua estadia</p>
                                    </div>
                                    <div className="w-12 h-12 bg-[#FFF0E5] rounded-full flex items-center justify-center shrink-0">
                                        <Award className="w-6 h-6 text-[#FF5A00]" />
                                    </div>
                                </div>

                                {/* BOX: Por que amam */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-5">Por que os hóspedes amam</h4>
                                    <div className="space-y-4">
                                        <div className="flex gap-3">
                                            <Heart className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">Vista incrível</p>
                                                <p className="text-xs text-gray-500">100% dos hóspedes recomendam</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">Limpeza impecável</p>
                                                <p className="text-xs text-gray-500">Avaliação 4,9 de limpeza</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <MapPin className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">Localização perfeita</p>
                                                <p className="text-xs text-gray-500">Perto da praia e comércios</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BOX: Descontos e benefícios */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-5">Descontos e benefícios</h4>
                                    <div className="space-y-4">
                                        {item.aceita_pontos && (
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                    <Award className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">10% OFF com pontos</p>
                                                    <p className="text-xs text-gray-500">Use seus pontos e economize</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                                                <ShieldCheck className="w-4 h-4 text-yellow-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">5% OFF à vista</p>
                                                <p className="text-xs text-gray-500">Pagando no Pix ou boleto</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4 text-[#FF5A00]" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">Estadias longas</p>
                                                <p className="text-xs text-gray-500">Desconto progressivo</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BOX: Políticas */}
                                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-5">Políticas da propriedade</h4>
                                    <div className="space-y-3 text-sm text-gray-700 font-medium">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-[#FF5A00]" /> Check-in: {item.horario_inicio || '14h às 22h'}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-[#FF5A00]" /> Check-out: até {item.horario_fim || '11h'}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Ban className="w-4 h-4 text-[#FF5A00]" /> Não é permitido festas ou eventos
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Ban className="w-4 h-4 text-[#FF5A00]" /> Não é permitido fumar
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {item.aceita_pet ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Ban className="w-4 h-4 text-[#FF5A00]" />}
                                            {item.aceita_pet ? 'Pets são bem-vindos' : 'Pets não permitidos'}
                                        </div>
                                    </div>
                                    <button className="mt-5 text-[#FF5A00] font-bold text-sm hover:underline">
                                        Ver todas as regras
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}