import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { StarIcon, ClockIcon, UserGroupIcon, CreditCardIcon, CalendarIcon, ShoppingBagIcon, ChevronRightIcon, ShareIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';

export default function Loja({ auth, estabelecimento, servicosPaginados }) {
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [fotoAtualIndex, setFotoAtualIndex] = useState(0);

    const [dataSelecionada, setDataSelecionada] = useState('');
    const [horaSelecionada, setHoraSelecionada] = useState('');

    // Estado para o botão de Adicionar ao Carrinho
    const [adicionandoAoCarrinho, setAdicionandoAoCarrinho] = useState(false);

    const servicos = servicosPaginados.data;
    const { flash = {} } = usePage().props;

    const isAdminOuGerente = ['admin', 'socio', 'gerente'].includes(auth.user?.papel);

    const parseJSONSeguro = (dados, fallback = []) => {
        if (!dados) return fallback;
        if (typeof dados === 'string') {
            try { return JSON.parse(dados); } catch (e) { return fallback; }
        }
        return dados;
    };

    // Estado para saber se há um checkout pausado
    const [checkoutPendente, setCheckoutPendente] = useState(null);

    useEffect(() => {
        // 1. Verifica se há um carrinho salvo no localStorage
        const salvo = localStorage.getItem('checkout_pendente_waitless');
        if (salvo) setCheckoutPendente(JSON.parse(salvo));
        
        // 2. Verifica se a URL mandou abrir um serviço específico (Veio do "Shop Similar")
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_servico');
        if (openId) {
            const serv = servicos.find(s => s.id.toString() === openId);
            if (serv) abrirDetalhes(serv);
        }
    }, [servicos]);

    const voltarParaCheckout = () => {
        if (checkoutPendente) {
            router.visit(route('cliente.agendar', {
                estabelecimento: checkoutPendente.estabelecimento_id,
                servico_id: checkoutPendente.servico_id,
                data: checkoutPendente.data,
                hora: checkoutPendente.hora
            }));
        }
    };

    const abrirDetalhes = (servico) => {
        setServicoSelecionado(servico);
        setFotoAtualIndex(0);
        setDataSelecionada(''); // Limpa seleções ao trocar de serviço
        setHoraSelecionada('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fecharDetalhes = () => {
        setServicoSelecionado(null);
    };

    const proximaFoto = (totalFotos) => setFotoAtualIndex((prev) => (prev + 1) % totalFotos);
    const fotoAnterior = (totalFotos) => setFotoAtualIndex((prev) => (prev - 1 + totalFotos) % totalFotos);

    const editarServico = () => {
        localStorage.setItem('waitless_active_tab', 'servicos');
        router.visit(route('estabelecimentos.configuracoes', estabelecimento.id));
    };

    const getTextoPagamento = (tipo) => {
        if (tipo === 'online') return 'Apenas Online (Cartão/Pix)';
        if (tipo === 'presencial' || tipo === 'local') return 'Apenas no Local';
        return 'Online ou no Local';
    };

    const gerarDiasProximos = (diasPermitidosBanco) => {
        if (!diasPermitidosBanco || diasPermitidosBanco.length === 0) return [];
        
        const diasMapa = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
        const diasGerados = [];
        let dataAtual = new Date();

        for (let i = 0; i < 15; i++) {
            const diaSemanaStr = diasMapa[dataAtual.getDay()];
            
            if (diasPermitidosBanco.includes(diaSemanaStr)) {
                const year = dataAtual.getFullYear();
                const month = String(dataAtual.getMonth() + 1).padStart(2, '0');
                const day = String(dataAtual.getDate()).padStart(2, '0');
                
                diasGerados.push({
                    dataOriginal: `${year}-${month}-${day}`,
                    diaSemana: diaSemanaStr.substring(0, 3), 
                    diaMes: dataAtual.getDate(),
                    mes: dataAtual.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') 
                });
            }
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return diasGerados;
    };

    const adicionarAoCarrinho = () => {
        if (!servicoSelecionado) return;

        setAdicionandoAoCarrinho(true);

        router.post(route('cliente.carrinho.store'), {
            servico_id: servicoSelecionado.id,
            estabelecimento_id: estabelecimento.id,
            data_agendamento: dataSelecionada || null,
            hora_agendamento: horaSelecionada || null,
        }, {
            preserveScroll: true,
            onFinish: () => setAdicionandoAoCarrinho(false),
        });
    };

    const servicosOutros = servicoSelecionado 
        ? servicos.filter(s => s.id !== servicoSelecionado.id).slice(0, 4) 
        : [];

    // Fallbacks para Imagens do topo
    const bannerUrl = estabelecimento.banner || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1920&q=80'; // Fallback elegante de clínica médica/estética se vazio
    const logoUrl = estabelecimento.logo || 'https://placehold.co/150x150/e2e8f0/828ea8?text=Sem+Logo';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link 
                            href={route('cliente.explorar')} 
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm font-bold"
                            title="Voltar"
                        >
                            ←
                        </Link>
                        <div>
                            <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                Exploração de Estabelecimentos
                            </h2>
                        </div>
                    </div>
                    {isAdminOuGerente && (
                        <button onClick={editarServico} className="text-sm font-bold text-gray-600 hover:text-indigo-600 bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2">
                            ⚙️ Modo Edição
                        </button>
                    )}
                </div>
            }
        >
            <Head title={`Loja - ${estabelecimento.nome}`} />

            {/* SEÇÃO DO BANNER E PERFIL (ESTILO IGUAL À IMAGEM) */}
            <div className="relative w-full h-64 md:h-[340px] bg-gray-200 overflow-hidden">
                <img 
                    src={bannerUrl} 
                    alt="Banner do estabelecimento" 
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Conteúdo flutuante interno sobre o banner */}
                <div className="absolute bottom-0 inset-x-0 pb-6 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-start md:items-center gap-4">
                        {/* Logo Quadrada Arredondada */}
                        <div className="bg-white p-2 rounded-2xl shadow-md w-20 h-20 md:w-28 md:h-28 flex items-center justify-center border border-gray-100 flex-shrink-0">
                            <img src={logoUrl} alt={estabelecimento.nome} className="w-full h-full object-contain rounded-xl" />
                        </div>
                        
                        {/* Informações da Clínica */}
                        <div className="text-white">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{estabelecimento.nome}</h1>
                                <span className="bg-emerald-500 text-white rounded-full p-0.5 flex items-center justify-center w-5 h-5 text-xs shadow" title="Verificado">✓</span>
                                {isAdminOuGerente && (
                                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Visão Gerencial</span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-gray-200 mt-1 flex-wrap">
                                <span className="text-yellow-400 flex items-center font-bold">4.8 ★★★★★</span>
                                <span>(256 avaliações)</span>
                                <span>•</span>
                                <span>{estabelecimento.bairro ? `${estabelecimento.bairro}, ` : ''}{estabelecimento.cidade}</span>
                            </div>

                            {/* Tags de características */}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">Profissionais qualificados</span>
                                <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">Ambiente moderno</span>
                                <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">Atendimento humanizado</span>
                            </div>
                        </div>
                    </div>

                    {/* Botão de Compartilhar */}
                    <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-2 self-start md:self-auto">
                        <ShareIcon className="w-4 h-4" /> Compartilhar
                    </button>
                </div>
            </div>

            {/* PAINEL DE CONTADORES / ESTÁTISTICAS */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6 grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-2 divide-gray-100 md:divide-x">
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">📊</div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">{servicosPaginados.total || servicos.length}</div>
                            <div className="text-xs text-gray-400 font-medium">Serviços oferecidos</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">👥</div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">24</div>
                            <div className="text-xs text-gray-400 font-medium">Profissionais na equipe</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500">⭐</div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">4,8 <span className="text-xs font-normal text-gray-400">/ 5</span></div>
                            <div className="text-xs text-gray-400 font-medium">Avaliação média</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-red-50 p-2.5 rounded-xl text-red-500">❤️</div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">12</div>
                            <div className="text-xs text-gray-400 font-medium">Promoções ativas</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">🪙</div>
                        <div>
                            <div className="text-xl font-bold text-gray-900">2.450 <span className="text-xs font-normal text-gray-400">pts</span></div>
                            <div className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer">Meu saldo</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso de Checkout Pendente (Posicionado de forma elegante abaixo dos contadores) */}
            {checkoutPendente && !isAdminOuGerente && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex flex-col sm:flex-row justify-between items-center shadow-sm gap-3 animate-pulse">
                        <span className="text-sm font-bold flex items-center gap-2">🛒 Você tem um agendamento pendente em andamento!</span>
                        <button onClick={voltarParaCheckout} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-sm w-full sm:w-auto text-center">
                            Voltar para o Checkout
                        </button>
                    </div>
                </div>
            )}

            {/* Mensagens Flash de Sucesso */}
            {flash?.success && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-sm text-sm font-bold">
                        ✅ {flash.success}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 pb-24">
                
                {/* TELA 1: CATALOGO / GRID PRINCIPAL DOS SERVIÇOS */}
                {!servicoSelecionado && (
                    <div className="space-y-6">
                        
                        {/* FILTROS E BUSCA (ESTILO IGUAL À IMAGEM) */}
                        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                            <div className="w-full lg:max-w-md relative">
                                <MagnifyingGlassIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar serviço, especialidade ou profissional..." 
                                    className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:ring-orange-500 focus:border-orange-500 text-sm shadow-sm placeholder:text-gray-400"
                                />
                            </div>

                            <div className="w-full lg:w-auto flex flex-wrap items-center gap-2 justify-end">
                                <select className="bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 focus:ring-orange-500 focus:border-orange-500 shadow-sm">
                                    <option>Todas as categorias</option>
                                </select>
                                <select className="bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 focus:ring-orange-500 focus:border-orange-500 shadow-sm">
                                    <option>Todos os tipos</option>
                                </select>
                                <select className="bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 focus:ring-orange-500 focus:border-orange-500 shadow-sm">
                                    <option>% Descontos com pontos</option>
                                </select>
                                <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition">
                                    Ordenar: Relevância
                                </button>
                            </div>
                        </div>

                        {/* GRID DOS CARDS DE SERVIÇOS */}
                        {servicos.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                                <span className="text-4xl">🛒</span>
                                <h3 className="text-lg font-bold text-gray-700 mt-4">Nenhum serviço disponível</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {servicos.map((servico) => {
                                    const fotos = parseJSONSeguro(servico.fotos);
                                    const fotoCapa = fotos.length > 0 ? fotos[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                    return (
                                        <div 
                                            key={servico.id} 
                                            onClick={() => abrirDetalhes(servico)} 
                                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:shadow-md transition-all duration-300"
                                        >
                                            {/* Container da Imagem com os Badges */}
                                            <div className="w-full aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                                <img 
                                                    src={fotoCapa} 
                                                    alt={servico.nome} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                                                />
                                                
                                                {/* Badge de Nota (Canto Superior Esquerdo) */}
                                                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-900 flex items-center gap-1 shadow-sm">
                                                    <span className="text-orange-500 text-sm">★</span> 
                                                    {(Number(servico.avaliacao_media) || 4.9).toFixed(1)}
                                                </div>

                                                {/* Badge Opcional de Promoção (Exemplo da Imagem) */}
                                                {servico.valor < 150 && (
                                                    <div className="absolute top-3 right-3 bg-teal-800 text-white text-[10px] font-black px-2 py-1 rounded-md tracking-wider uppercase">
                                                        PROMOÇÃO
                                                    </div>
                                                )}
                                            </div>

                                            {/* Informações do Card */}
                                            <div className="p-4 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-1">
                                                        {servico.tipo_servico || 'CONSULTAS'}
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 text-base leading-snug group-hover:text-orange-500 transition-colors line-clamp-1">
                                                        {servico.nome}
                                                    </h4>
                                                    <p className="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                                                        {servico.descricao || "Avaliação completa com profissionais especialistas dedicados ao seu bem estar."}
                                                    </p>
                                                </div>

                                                {/* Rodapé do Card (Preço e Seta de Ação) */}
                                                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-[10px] text-gray-400 font-semibold leading-none">A partir de</div>
                                                        <div className="text-gray-900 font-black text-lg mt-0.5">
                                                            R$ {Number(servico.valor).toFixed(2).replace('.', ',')}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Botão de detalhe redondo laranja */}
                                                    <div className="w-8 h-8 rounded-full bg-orange-50 group-hover:bg-orange-500 flex items-center justify-center text-orange-500 group-hover:text-white transition-all shadow-sm">
                                                        <ChevronRightIcon className="w-4 h-4 stroke-[3]" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TELA 2: DETALHES DO SERVIÇO SELECIONADO */}
                {servicoSelecionado && (
                    <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm animate-in fade-in duration-300">
                        
                        <div className="flex items-center gap-2 mb-8 text-sm text-gray-500 font-medium">
                            <button onClick={fecharDetalhes} className="hover:text-orange-500 transition-colors">Catálogo</button>
                            <span>›</span>
                            <span className="text-gray-900">{servicoSelecionado.tipo_servico}</span>
                            <span>›</span>
                            <span className="text-gray-900 underline decoration-orange-400 underline-offset-4">{servicoSelecionado.nome}</span>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
                            
                            {/* ESQUERDA: GALERIA DE FOTOS DO SERVIÇO */}
                            <div className="w-full lg:w-1/2 relative bg-gray-100 aspect-square rounded-2xl overflow-hidden group border border-gray-200 shadow-sm">
                                {(() => {
                                    const fotosServico = parseJSONSeguro(servicoSelecionado.fotos);
                                    const hasFotos = fotosServico.length > 0;
                                    const totalFotos = fotosServico.length;
                                    
                                    return (
                                        <>
                                            <img src={hasFotos ? fotosServico[fotoAtualIndex] : 'https://placehold.co/600x600/e2e8f0/828ea8?text=Imagem+do+Serviço'} alt={servicoSelecionado.nome} className="w-full h-full object-cover" />
                                            
                                            {totalFotos > 1 && (
                                                <>
                                                    <button onClick={() => fotoAnterior(totalFotos)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-10 h-10 flex items-center justify-center rounded-full shadow-lg border border-gray-200 font-bold opacity-0 group-hover:opacity-100 transition">‹</button>
                                                    <button onClick={() => proximaFoto(totalFotos)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-10 h-10 flex items-center justify-center rounded-full shadow-lg border border-gray-200 font-bold opacity-0 group-hover:opacity-100 transition">›</button>
                                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                                                        {fotosServico.map((_, idx) => (
                                                            <button key={idx} onClick={() => setFotoAtualIndex(idx)} className={`h-2 rounded-full transition-all shadow-sm ${idx === fotoAtualIndex ? 'w-6 bg-orange-500' : 'w-2 bg-white/70 hover:bg-white'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* DIREITA: DETALHAMENTO E SELEÇÃO DE HORÁRIOS */}
                            <div className="w-full lg:w-1/2 py-2">
                                <span className="text-xs text-orange-500 font-extrabold uppercase tracking-widest">{servicoSelecionado.tipo_servico}</span>
                                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1 mb-2 tracking-tight">
                                    {servicoSelecionado.nome}
                                </h1>

                                <div className="flex items-center justify-between border-b border-gray-100 pb-6 mb-6 mt-4">
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1 font-bold text-amber-500">
                                            <StarIcon className="w-5 h-5 text-amber-400" />
                                            <span className="text-base">{(Number(servicoSelecionado.avaliacao_media) || 4.9).toFixed(1)}</span>
                                            <span className="text-xs text-gray-400 ml-1 font-normal">({servicoSelecionado.total_avaliacoes || 24} avaliações)</span>
                                        </div>
                                        <span className="text-gray-300">|</span>
                                        <span className="flex items-center gap-1 text-gray-700 font-medium"><ClockIcon className="w-4 h-4 text-gray-400"/> {servicoSelecionado.duracao_minutos} minutos</span>
                                    </div>
                                    
                                    {/* Botão de Adicionar ao Carrinho */}
                                    {!isAdminOuGerente && (
                                        <button 
                                            onClick={adicionarAoCarrinho}
                                            disabled={adicionandoAoCarrinho}
                                            title="Adicionar ao Carrinho"
                                            className="h-11 w-11 flex items-center justify-center bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-500 border border-gray-200 hover:border-orange-200 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            {adicionandoAoCarrinho ? (
                                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : (
                                                <ShoppingBagIcon className="w-5 h-5" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                <p className="text-gray-600 text-sm leading-relaxed mb-8">
                                    {servicoSelecionado.descricao || "Este serviço não possui uma descrição detalhada cadastrada. Em caso de dúvida, entre em contato."}
                                </p>

                                {!isAdminOuGerente && (() => {
                                    const config = parseJSONSeguro(servicoSelecionado.configuracoes);
                                    const diasDisponiveisBanco = config.dias_disponiveis || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
                                    const horariosDisponiveisBanco = parseJSONSeguro(servicoSelecionado.horarios_disponiveis).length > 0 
                                        ? parseJSONSeguro(servicoSelecionado.horarios_disponiveis) 
                                        : ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
                                    const diasParaMostrar = gerarDiasProximos(diasDisponiveisBanco);

                                    return (
                                        <>
                                            <div className="mb-8 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4 text-orange-500" /> 1. Escolha o Dia
                                                </h4>
                                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                                    {diasParaMostrar.length > 0 ? (
                                                        diasParaMostrar.map(dia => {
                                                            const isSelected = dataSelecionada === dia.dataOriginal;
                                                            return (
                                                                <button 
                                                                    key={dia.dataOriginal}
                                                                    type="button"
                                                                    onClick={() => setDataSelecionada(dia.dataOriginal)}
                                                                    className={`flex flex-col items-center justify-center min-w-[72px] p-3 rounded-xl border transition-all ${isSelected ? 'border-orange-500 bg-orange-500 text-white shadow-md scale-105' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/50'}`}
                                                                >
                                                                    <span className={`text-[10px] font-bold uppercase mb-1 ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>{dia.diaSemana}</span>
                                                                    <span className="text-xl font-black">{dia.diaMes}</span>
                                                                    <span className={`text-[9px] uppercase font-bold mt-1 ${isSelected ? 'text-orange-100' : 'text-gray-500'}`}>{dia.mes}</span>
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-sm text-red-500">Nenhum dia disponível cadastrado.</span>
                                                    )}
                                                </div>

                                                <h4 className="text-sm font-bold text-gray-900 mt-5 mb-3 flex items-center gap-2">
                                                    <ClockIcon className="w-4 h-4 text-orange-500" /> 2. Escolha o Horário
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {horariosDisponiveisBanco.length > 0 ? (
                                                        horariosDisponiveisBanco.map(h => {
                                                            const isSelected = horaSelecionada === h;
                                                            return (
                                                                <button 
                                                                    key={h}
                                                                    type="button"
                                                                    onClick={() => setHoraSelecionada(h)}
                                                                    className={`px-4 py-2 font-bold text-xs rounded-xl transition-all border ${isSelected ? 'border-orange-500 bg-orange-500 text-white shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'}`}
                                                                >
                                                                    {h}
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-sm text-red-500">Nenhum horário cadastrado.</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-sm border-t border-gray-100 py-4 mb-4">
                                                <div className="flex items-center gap-2 text-gray-700">
                                                    <CreditCardIcon className="w-4 h-4 text-orange-500" />
                                                    <span className="font-bold">Pagamento aceito:</span>
                                                </div>
                                                <span className="text-gray-600 text-xs font-semibold bg-gray-100 px-3 py-1 rounded-lg">
                                                    {getTextoPagamento(config.tipo_pagamento)}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* Bloco Final: Preço e Ação de Agendamento */}
                                <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <span className="text-xs text-gray-400 font-medium">Valor do serviço</span>
                                        <div className="text-3xl font-black text-gray-900 mt-0.5">
                                            <span className="text-lg font-bold mr-1 text-gray-500">R$</span>
                                            {Number(servicoSelecionado.valor).toFixed(2).replace('.', ',')}
                                        </div>
                                    </div>
                                    
                                    {!isAdminOuGerente && (
                                        <div className="flex flex-col w-full sm:w-auto">
                                            <Link 
                                                href={route('cliente.agendar', { 
                                                    estabelecimento: estabelecimento.id, 
                                                    servico_id: servicoSelecionado.id,
                                                    data: dataSelecionada || undefined,
                                                    hora: horaSelecionada || undefined
                                                })}
                                                className={`text-center font-bold py-3.5 px-8 rounded-xl shadow-md transition-all text-sm ${(!dataSelecionada || !horaSelecionada) ? 'bg-gray-900 text-white hover:bg-black' : 'bg-orange-500 text-white hover:bg-orange-600 scale-105'}`}
                                            >
                                                {dataSelecionada && horaSelecionada ? 'Avançar para Pagamento' : 'Agendar agora'}
                                            </Link>
                                            {(!dataSelecionada || !horaSelecionada) && (
                                                <span className="text-center text-[11px] text-gray-400 mt-2">Escolha data e hora acima para agilizar</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* OUTROS SERVIÇOS DA LOJA (SHOP SIMILAR) */}
                        {servicosOutros.length > 0 && (
                            <div className="mt-20 pt-12 border-t border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900 mb-8">Outros serviços recomendados nesta clínica</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {servicosOutros.map((outroServico) => {
                                        const fotosO = parseJSONSeguro(outroServico.fotos);
                                        const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                        return (
                                            <div 
                                                key={outroServico.id} 
                                                onClick={() => abrirDetalhes(outroServico)}
                                                className="cursor-pointer group flex flex-col bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
                                            >
                                                <div className="w-full aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden mb-3">
                                                    <img src={fotoCapaO} alt={outroServico.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                                </div>
                                                <div className="text-orange-500 font-black text-sm mb-1">
                                                    R$ {Number(outroServico.valor).toFixed(2).replace('.', ',')}
                                                </div>
                                                <h4 className="font-bold text-gray-900 text-sm line-clamp-1 group-hover:text-orange-500 transition-colors">{outroServico.nome}</h4>
                                                
                                                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                                                    <span className="font-medium">{outroServico.duracao_minutos} min</span>
                                                    <span>•</span>
                                                    <div className="flex items-center gap-0.5 font-bold text-amber-500">
                                                        <span>★</span> {(Number(outroServico.avaliacao_media) || 4.9).toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}