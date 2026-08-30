import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    StarIcon, 
    ClockIcon, 
    UserGroupIcon, 
    CreditCardIcon, 
    CalendarIcon, 
    ChevronRightIcon,
    ChevronLeftIcon,
    ShareIcon, 
    MagnifyingGlassIcon,
    ArrowLeftIcon,
    Cog6ToothIcon,
    CheckIcon,
    ChartBarIcon,
    HeartIcon,
    WalletIcon,
    ShoppingCartIcon,
    CheckCircleIcon,
    ShoppingBagIcon,
    TagIcon,
    FireIcon
} from '@heroicons/react/24/solid';

export default function Loja({ auth, estabelecimento, servicosPaginados }) {
    // Abas e Listagem
    const [abaAtiva, setAbaAtiva] = useState('servicos'); // 'servicos' | 'produtos'
    const [produtos, setProdutos] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(false);

    // Estados de Seleção
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [fotoAtualIndex, setFotoAtualIndex] = useState(0);

    // Estados de Agendamento/Carrinho
    const [dataSelecionada, setDataSelecionada] = useState('');
    const [horaSelecionada, setHoraSelecionada] = useState('');
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

    const [checkoutPendente, setCheckoutPendente] = useState(null);

    useEffect(() => {
        const salvo = localStorage.getItem('checkout_pendente_waitless');
        if (salvo) setCheckoutPendente(JSON.parse(salvo));
        
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_servico');
        if (openId) {
            const serv = servicos.find(s => s.id.toString() === openId);
            if (serv) abrirDetalhes(serv);
        }

        // Buscar produtos ao carregar a página
        fetchProdutosDisponiveis();
    }, [servicos, estabelecimento.id]);

    const fetchProdutosDisponiveis = async () => {
        setCarregandoProdutos(true);
        try {
            const response = await fetch(`/estabelecimentos/${estabelecimento.id}/produtos/cliente`);
            if (response.ok) {
                const data = await response.json();
                setProdutos(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Erro ao buscar produtos:", error);
        } finally {
            setCarregandoProdutos(false);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: estabelecimento.nome,
            text: `Conheça os serviços e produtos do estabelecimento ${estabelecimento.nome}!`,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link da loja copiado para a área de transferência!');
            }
        } catch (error) {
            console.error('Erro ao compartilhar', error);
        }
    };

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
        setProdutoSelecionado(null);
        setServicoSelecionado(servico);
        setFotoAtualIndex(0);
        setDataSelecionada(''); 
        setHoraSelecionada('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const abrirDetalhesProduto = (produto) => {
        setServicoSelecionado(null);
        setProdutoSelecionado(produto);
        setFotoAtualIndex(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fecharDetalhes = () => {
        setServicoSelecionado(null);
        setProdutoSelecionado(null);
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
        if (!servicoSelecionado && !produtoSelecionado) return;
        setAdicionandoAoCarrinho(true);

        if (servicoSelecionado) {
            router.post(route('cliente.carrinho.store'), {
                servico_id: servicoSelecionado.id,
                estabelecimento_id: estabelecimento.id,
                data_agendamento: dataSelecionada || null,
                hora_agendamento: horaSelecionada || null,
            }, {
                preserveScroll: true,
                onFinish: () => setAdicionandoAoCarrinho(false),
            });
        } else if (produtoSelecionado) {
            router.post(route('cliente.carrinho.store_produto'), {
                produto_id: produtoSelecionado.id,
                estabelecimento_id: estabelecimento.id,
                quantidade: 1
            }, {
                preserveScroll: true,
                onFinish: () => setAdicionandoAoCarrinho(false),
            });
        }
    };

    const servicosOutros = servicoSelecionado 
        ? servicos.filter(s => s.id !== servicoSelecionado.id).slice(0, 4) 
        : [];

    const produtosOutros = produtoSelecionado 
        ? produtos.filter(p => p.id !== produtoSelecionado.id).slice(0, 4) 
        : [];

    const bannerUrl = estabelecimento.banner || estabelecimento.foto_banner || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1920&q=80'; 
    const logoUrl = estabelecimento.logo || 'https://placehold.co/150x150/e2e8f0/828ea8?text=Sem+Logo';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link 
                            href={route('cliente.explorar')} 
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm font-bold"
                            title="Voltar"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                Exploração de Estabelecimentos
                            </h2>
                        </div>
                    </div>
                    {isAdminOuGerente && (
                        <button onClick={editarServico} className="text-sm font-bold text-gray-600 hover:text-indigo-600 bg-white border border-gray-300 px-4 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2">
                            <Cog6ToothIcon className="w-5 h-5" /> Modo Edição
                        </button>
                    )}
                </div>
            }
        >
            <Head title={`Loja - ${estabelecimento.nome}`} />

            {/* HEADER BANNER E PERFIL */}
            <div className="relative w-full h-72 md:h-[380px] bg-gray-900 overflow-hidden">
                <img 
                    src={bannerUrl} 
                    alt="Banner do estabelecimento" 
                    className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
                
                <div className="absolute bottom-0 inset-x-0 pb-8 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-start md:items-center gap-5">
                        <div className="bg-white p-1.5 rounded-2xl shadow-xl w-24 h-24 md:w-32 md:h-32 flex items-center justify-center border border-gray-100 flex-shrink-0 z-10">
                            <img src={logoUrl} alt={estabelecimento.nome} className="w-full h-full object-contain rounded-xl" />
                        </div>
                        
                        <div className="text-white">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">{estabelecimento.nome}</h1>
                                <span className="bg-emerald-500 text-white rounded-full p-1 flex items-center justify-center shadow-sm" title="Verificado">
                                    <CheckIcon className="w-3 h-3" strokeWidth={3} />
                                </span>
                                {isAdminOuGerente && (
                                    <span className="text-[10px] bg-indigo-600/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">Visão Gerencial</span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-gray-300 mt-2 flex-wrap">
                                <div className="flex items-center text-amber-400 gap-1 font-bold">
                                    <StarIcon className="w-4 h-4" /> 4.8
                                </div>
                                <span className="text-gray-400">(256 avaliações)</span>
                                <span className="text-gray-500">•</span>
                                <span>{estabelecimento.bairro ? `${estabelecimento.bairro}, ` : ''}{estabelecimento.cidade}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-4 flex-wrap hidden md:flex">
                                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium tracking-wide">Profissionais qualificados</span>
                                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium tracking-wide">Ambiente moderno</span>
                                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium tracking-wide">Atendimento humanizado</span>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleShare} className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2 w-full md:w-auto">
                        <ShareIcon className="w-4 h-4" /> Compartilhar Loja
                    </button>
                </div>
            </div>

            {/* MÉTRICAS E INDICADORES (Desktop) */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 hidden sm:block">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 grid grid-cols-2 md:grid-cols-5 gap-y-6 gap-x-4 divide-gray-100 md:divide-x">
                    <div className="flex items-center gap-4 px-3">
                        <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                            <ChartBarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">{servicosPaginados.total || servicos.length}</div>
                            <div className="text-xs text-gray-500 font-medium mt-1">Serviços</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-3">
                        <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                            <ShoppingBagIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">{produtos.length}</div>
                            <div className="text-xs text-gray-500 font-medium mt-1">Produtos</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-3">
                        <div className="bg-amber-50 p-3 rounded-xl text-amber-500">
                            <StarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">4,8 <span className="text-sm font-medium text-gray-400">/ 5</span></div>
                            <div className="text-xs text-gray-500 font-medium mt-1">Avaliação</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-3">
                        <div className="bg-red-50 p-3 rounded-xl text-red-500">
                            <HeartIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">12</div>
                            <div className="text-xs text-gray-500 font-medium mt-1">Promoções</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-3">
                        <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                            <WalletIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-gray-900 leading-none">2.450</div>
                            <div className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer mt-1">Meus Pontos</div>
                        </div>
                    </div>
                </div>
            </div>

            {checkoutPendente && !isAdminOuGerente && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                    <div className="bg-green-100 border-2 border-green-500 text-green-900 px-5 py-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center shadow-lg shadow-green-500/20 gap-4 animate-pulse">
                        <span className="text-base font-extrabold flex items-center gap-2">
                            <ShoppingCartIcon className="w-6 h-6 text-green-700" /> Você tem um agendamento pendente em andamento!
                        </span>
                        <button onClick={voltarParaCheckout} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm w-full sm:w-auto text-center">
                            Continuar Checkout
                        </button>
                    </div>
                </div>
            )}

            {flash?.success && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    <div className="bg-green-50 border border-green-200 text-green-800 px-5 py-4 rounded-2xl shadow-sm text-sm font-bold flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" /> {flash.success}
                    </div>
                </div>
            )}

            {/* CONTEÚDO PRINCIPAL (VITRINE) */}
            <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 pb-24">
                
                {/* Se não houver nada selecionado, mostra o Catálogo com Abas */}
                {!servicoSelecionado && !produtoSelecionado && (
                    <div className="space-y-6">
                        
                        {/* CONTROLES E ABAS DE NAVEGAÇÃO */}
                        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex gap-4 w-full lg:w-auto border-b border-gray-100">
                                <button 
                                    onClick={() => setAbaAtiva('servicos')} 
                                    className={`pb-3 font-black text-sm transition-all flex items-center gap-2 px-2 ${abaAtiva === 'servicos' ? 'border-b-2 border-[#FF5A00] text-[#FF5A00]' : 'text-gray-400 hover:text-gray-700 border-b-2 border-transparent'}`}
                                >
                                    <ChartBarIcon className="w-4 h-4" /> Serviços
                                </button>
                                <button 
                                    onClick={() => setAbaAtiva('produtos')} 
                                    className={`pb-3 font-black text-sm transition-all flex items-center gap-2 px-2 ${abaAtiva === 'produtos' ? 'border-b-2 border-[#FF5A00] text-[#FF5A00]' : 'text-gray-400 hover:text-gray-700 border-b-2 border-transparent'}`}
                                >
                                    <ShoppingBagIcon className="w-4 h-4" /> Produtos da Loja
                                </button>
                            </div>

                            <div className="w-full lg:w-auto flex flex-wrap items-center gap-3 justify-end">
                                <div className="relative w-full sm:w-auto">
                                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder={`Buscar ${abaAtiva}...`}
                                        className="w-full sm:w-64 bg-gray-50 border-transparent rounded-xl py-2.5 pl-10 pr-4 focus:bg-white focus:ring-2 focus:ring-[#FF5A00] focus:border-transparent text-sm transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <button className="bg-gray-900 hover:bg-black text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition w-full sm:w-auto">
                                    Filtrar
                                </button>
                            </div>
                        </div>

                        {/* LISTAGEM DE SERVIÇOS */}
                        {abaAtiva === 'servicos' && (
                            <>
                                {servicos.length === 0 ? (
                                    <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                                        <ShoppingCartIcon className="w-16 h-16 text-gray-300 mb-4" />
                                        <h3 className="text-xl font-bold text-gray-900">Nenhum serviço disponível</h3>
                                        <p className="text-gray-500 mt-2 text-sm">Este estabelecimento ainda não cadastrou serviços.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                        {servicos.map((servico) => {
                                            const fotos = parseJSONSeguro(servico.fotos);
                                            const fotoCapa = fotos.length > 0 ? fotos[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                            return (
                                                <div 
                                                    key={servico.id} 
                                                    onClick={() => abrirDetalhes(servico)} 
                                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                                >
                                                    <div className="w-full aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                                        <img 
                                                            src={fotoCapa} 
                                                            alt={servico.nome} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                                        />
                                                        
                                                        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-900 flex items-center gap-1 shadow-sm">
                                                            <StarIcon className="w-4 h-4 text-amber-500" />
                                                            {(Number(servico.avaliacao_media) || 4.9).toFixed(1)}
                                                        </div>

                                                        {servico.valor < 150 && (
                                                            <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg tracking-wider uppercase shadow-sm flex items-center gap-1">
                                                                <FireIcon className="w-3 h-3"/> Oferta
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-5 flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <div className="text-[10px] text-[#FF5A00] font-extrabold uppercase tracking-widest mb-1.5">
                                                                {servico.tipo_servico || 'SERVIÇO'}
                                                            </div>
                                                            <h4 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-[#FF5A00] transition-colors line-clamp-2">
                                                                {servico.nome}
                                                            </h4>
                                                            <p className="text-gray-500 text-xs mt-2 line-clamp-2 leading-relaxed">
                                                                {servico.descricao || "Avaliação completa com profissionais dedicados ao seu bem estar."}
                                                            </p>
                                                        </div>

                                                        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                                            <div>
                                                                <div className="text-[10px] text-gray-400 font-semibold leading-none uppercase tracking-wide">A partir de</div>
                                                                <div className="text-gray-900 font-black text-xl mt-1 flex items-baseline">
                                                                    <span className="text-sm font-bold text-gray-500 mr-1">R$</span>
                                                                    {Number(servico.valor).toFixed(2).replace('.', ',')}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="w-10 h-10 rounded-xl bg-orange-50 group-hover:bg-[#FF5A00] flex items-center justify-center text-[#FF5A00] group-hover:text-white transition-all shadow-sm">
                                                                <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LISTAGEM DE PRODUTOS */}
                        {abaAtiva === 'produtos' && (
                            <>
                                {carregandoProdutos ? (
                                    <div className="flex justify-center items-center py-24">
                                        <svg className="animate-spin h-10 w-10 text-[#FF5A00]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    </div>
                                ) : produtos.length === 0 ? (
                                    <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                                        <ShoppingBagIcon className="w-16 h-16 text-gray-300 mb-4" />
                                        <h3 className="text-xl font-bold text-gray-900">Nenhum produto na loja</h3>
                                        <p className="text-gray-500 mt-2 text-sm">Este estabelecimento ainda não cadastrou produtos para venda.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                        {produtos.map((produto) => {
                                            const fotos = parseJSONSeguro(produto.fotos);
                                            const fotoCapa = fotos.length > 0 ? fotos[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                            return (
                                                <div 
                                                    key={produto.id} 
                                                    onClick={() => abrirDetalhesProduto(produto)} 
                                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative"
                                                >
                                                    <div className="w-full aspect-square bg-gray-50 relative overflow-hidden flex items-center justify-center">
                                                        <img 
                                                            src={fotoCapa} 
                                                            alt={produto.nome} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                                        />
                                                        
                                                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                                                            {produto.promocao == 1 && (
                                                                <span className="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                                                    <FireIcon className="w-3 h-3"/> Oferta
                                                                </span>
                                                            )}
                                                            {produto.somente_premium == 1 && (
                                                                <span className="bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                                                    <StarIcon className="w-3 h-3"/> VIP
                                                                </span>
                                                            )}
                                                        </div>

                                                        {produto.estoque_disponivel <= 0 && (
                                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                                                                <span className="bg-red-600 text-white text-xs font-black uppercase px-3 py-1.5 rounded-lg shadow-lg border border-red-500">
                                                                    Esgotado
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-5 flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-1.5 flex justify-between items-center">
                                                                <span>{produto.categoria || 'PRODUTO'}</span>
                                                                {produto.estoque_disponivel > 0 && (
                                                                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Estoque: {produto.estoque_disponivel}</span>
                                                                )}
                                                            </div>
                                                            <h4 className="font-bold text-gray-900 text-base leading-snug group-hover:text-[#FF5A00] transition-colors line-clamp-2">
                                                                {produto.nome}
                                                            </h4>
                                                        </div>

                                                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col">
                                                            {produto.promocao == 1 ? (
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs text-gray-400 line-through">R$ {Number(produto.valor_normal).toFixed(2).replace('.', ',')}</span>
                                                                    <p className="text-xl font-black text-green-600 tracking-tight flex items-baseline">
                                                                        <span className="text-xs mr-1">R$</span>{Number(produto.valor_promocional || produto.valor_final).toFixed(2).replace('.', ',')}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xl font-black text-gray-900 tracking-tight flex items-baseline">
                                                                    <span className="text-xs text-gray-500 mr-1">R$</span>{Number(produto.valor_normal || produto.valor_final).toFixed(2).replace('.', ',')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* TELA DE DETALHES DO SERVIÇO */}
                {servicoSelecionado && (
                    <div className="bg-white rounded-3xl p-6 md:p-8 lg:p-10 border border-gray-100 shadow-xl shadow-gray-200/40 animate-in fade-in duration-500 slide-in-from-bottom-4">
                        
                        <div className="flex items-center gap-2 mb-8 text-sm text-gray-500 font-medium overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
                            <button onClick={fecharDetalhes} className="hover:text-[#FF5A00] transition-colors flex items-center gap-1">
                                <ArrowLeftIcon className="w-4 h-4" /> Catálogo
                            </button>
                            <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                            <span className="text-gray-600">{servicoSelecionado.tipo_servico}</span>
                            <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                            <span className="text-gray-900 font-bold">{servicoSelecionado.nome}</span>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
                            <div className="w-full lg:w-1/2 relative bg-gray-50 aspect-square rounded-3xl overflow-hidden group border border-gray-100 shadow-inner">
                                {(() => {
                                    const fotosServico = parseJSONSeguro(servicoSelecionado.fotos);
                                    const hasFotos = fotosServico.length > 0;
                                    const totalFotos = fotosServico.length;
                                    
                                    return (
                                        <>
                                            <img src={hasFotos ? fotosServico[fotoAtualIndex] : 'https://placehold.co/600x600/e2e8f0/828ea8?text=Imagem+do+Serviço'} alt={servicoSelecionado.nome} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                                            
                                            {totalFotos > 1 && (
                                                <>
                                                    <button onClick={() => fotoAnterior(totalFotos)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-gray-100 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                                        <ChevronLeftIcon className="w-6 h-6" />
                                                    </button>
                                                    <button onClick={() => proximaFoto(totalFotos)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-gray-100 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                                        <ChevronRightIcon className="w-6 h-6" />
                                                    </button>
                                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                                                        {fotosServico.map((_, idx) => (
                                                            <button key={idx} onClick={() => setFotoAtualIndex(idx)} className={`h-2.5 rounded-full transition-all shadow-sm ${idx === fotoAtualIndex ? 'w-8 bg-[#FF5A00]' : 'w-2.5 bg-white/80 hover:bg-white'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="w-full lg:w-1/2 pb-24 lg:pb-0">
                                <span className="text-sm text-[#FF5A00] font-extrabold uppercase tracking-widest">{servicoSelecionado.tipo_servico}</span>
                                
                                <div className="flex items-start justify-between gap-4 mt-2 mb-4">
                                    <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                                        {servicoSelecionado.nome}
                                    </h1>
                                    
                                    {!isAdminOuGerente && (
                                        <button 
                                            onClick={adicionarAoCarrinho}
                                            disabled={adicionandoAoCarrinho}
                                            title="Adicionar ao Carrinho"
                                            className="flex-shrink-0 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center bg-white hover:bg-orange-50 text-gray-700 hover:text-[#FF5A00] border-2 border-gray-100 hover:border-orange-200 rounded-2xl transition-all disabled:opacity-50 shadow-sm"
                                        >
                                            {adicionandoAoCarrinho ? (
                                                <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : (
                                                <ShoppingCartIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-gray-100 pb-6 mb-6">
                                    <div className="flex items-center gap-1 font-bold text-gray-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                        <StarIcon className="w-5 h-5 text-amber-500" />
                                        <span>{(Number(servicoSelecionado.avaliacao_media) || 4.9).toFixed(1)}</span>
                                        <span className="text-xs text-amber-700/60 ml-1 font-medium">({servicoSelecionado.total_avaliacoes || 24} avaliações)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-700 font-medium bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">
                                        <ClockIcon className="w-5 h-5 text-gray-400"/> 
                                        <span>{servicoSelecionado.duracao_minutos} minutos</span>
                                    </div>
                                </div>

                                <p className="text-gray-600 text-base leading-relaxed mb-8">
                                    {servicoSelecionado.descricao || "Este serviço não possui uma descrição detalhada cadastrada. Em caso de dúvida, entre em contato para mais informações."}
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
                                            <div className="mb-8">
                                                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <CalendarIcon className="w-5 h-5 text-[#FF5A00]" /> 1. Escolha o Dia
                                                </h4>
                                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                                                    {diasParaMostrar.length > 0 ? (
                                                        diasParaMostrar.map(dia => {
                                                            const isSelected = dataSelecionada === dia.dataOriginal;
                                                            return (
                                                                <button 
                                                                    key={dia.dataOriginal}
                                                                    type="button"
                                                                    onClick={() => setDataSelecionada(dia.dataOriginal)}
                                                                    className={`flex flex-col items-center justify-center min-w-[80px] p-4 rounded-2xl border-2 transition-all snap-start ${isSelected ? 'border-[#FF5A00] bg-[#FF5A00] text-white shadow-lg shadow-orange-500/30 scale-105' : 'border-gray-100 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'}`}
                                                                >
                                                                    <span className={`text-[11px] font-bold uppercase mb-1 tracking-wider ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>{dia.diaSemana}</span>
                                                                    <span className="text-2xl font-black">{dia.diaMes}</span>
                                                                    <span className={`text-[10px] uppercase font-bold mt-1 tracking-wider ${isSelected ? 'text-orange-100' : 'text-gray-500'}`}>{dia.mes}</span>
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">Nenhum dia disponível cadastrado.</span>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 className="text-base font-bold text-gray-900 mt-6 mb-4 flex items-center gap-2">
                                                <ClockIcon className="w-5 h-5 text-[#FF5A00]" /> 2. Escolha o Horário
                                            </h4>
                                            <div className="flex flex-wrap gap-3">
                                                {horariosDisponiveisBanco.length > 0 ? (
                                                    horariosDisponiveisBanco.map(h => {
                                                        const isSelected = horaSelecionada === h;
                                                        return (
                                                            <button 
                                                                key={h}
                                                                type="button"
                                                                onClick={() => setHoraSelecionada(h)}
                                                                className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all border-2 ${isSelected ? 'border-[#FF5A00] bg-[#FF5A00] text-white shadow-lg shadow-orange-500/30' : 'border-gray-100 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'}`}
                                                            >
                                                                {h}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">Nenhum horário cadastrado.</span>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-8 mb-6 gap-4">
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                                                        <CreditCardIcon className="w-5 h-5 text-[#FF5A00]" />
                                                    </div>
                                                    <span className="font-bold">Pagamento aceito:</span>
                                                </div>
                                                <span className="text-gray-800 text-sm font-bold bg-white border border-gray-200 px-4 py-2 rounded-xl text-center shadow-sm">
                                                    {getTextoPagamento(config.tipo_pagamento)}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Barra fixa no mobile (Sticky Bottom Bar) / Bloco final no Desktop */}
                        <div className="fixed sm:relative bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto bg-white sm:bg-transparent border-t sm:border-t-0 border-gray-200 sm:border-transparent p-4 sm:p-0 sm:pt-8 sm:mt-8 flex flex-row items-center justify-between gap-4 z-50 sm:z-auto shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] sm:shadow-none">
                            <div className="flex-1 sm:flex-none">
                                <span className="text-[11px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Total</span>
                                <div className="text-2xl sm:text-4xl font-black text-gray-900 leading-none flex items-baseline">
                                    <span className="text-sm sm:text-xl font-bold mr-1 text-gray-500">R$</span>
                                    {Number(servicoSelecionado.valor).toFixed(2).replace('.', ',')}
                                </div>
                            </div>
                            
                            {!isAdminOuGerente && (
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Link 
                                        href={route('cliente.agendar', { 
                                            estabelecimento: estabelecimento.id, 
                                            servico_id: servicoSelecionado.id,
                                            data: dataSelecionada || undefined,
                                            hora: horaSelecionada || undefined
                                        })}
                                        className={`flex-1 sm:flex-none text-center font-bold py-3.5 sm:py-4 px-6 sm:px-10 rounded-2xl shadow-lg transition-all text-sm sm:text-base w-full ${(!dataSelecionada || !horaSelecionada) ? 'bg-gray-900 text-white hover:bg-black shadow-gray-900/20' : 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] shadow-green-600/30'}`}
                                    >
                                        {dataSelecionada && horaSelecionada ? 'Avançar para Pagamento' : 'Agendar agora'}
                                    </Link>
                                </div>
                            )}
                        </div>
                        
                        {!isAdminOuGerente && (!dataSelecionada || !horaSelecionada) && (
                            <div className="hidden sm:block text-right mt-3 text-xs font-medium text-gray-400">
                                Selecione uma data e horário acima para continuar
                            </div>
                        )}

                        {servicosOutros.length > 0 && (
                            <div className="mt-24 pt-12 border-t border-gray-100">
                                <h2 className="text-2xl font-extrabold text-gray-900 mb-8">Outros serviços recomendados</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {servicosOutros.map((outroServico) => {
                                        const fotosO = parseJSONSeguro(outroServico.fotos);
                                        const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                        return (
                                            <div 
                                                key={outroServico.id} 
                                                onClick={() => abrirDetalhes(outroServico)}
                                                className="cursor-pointer group flex flex-col bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                            >
                                                <div className="w-full aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden mb-4 relative">
                                                    <img src={fotoCapaO} alt={outroServico.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                                                </div>
                                                <div className="text-gray-900 font-black text-lg mb-1.5 flex items-baseline">
                                                    <span className="text-xs text-gray-400 font-bold mr-1">R$</span> {Number(outroServico.valor).toFixed(2).replace('.', ',')}
                                                </div>
                                                <h4 className="font-bold text-gray-700 text-sm line-clamp-2 group-hover:text-[#FF5A00] transition-colors leading-snug">{outroServico.nome}</h4>
                                                
                                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500 font-medium">
                                                    <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4 text-gray-400" /> {outroServico.duracao_minutos}m</span>
                                                    <div className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                                                        <StarIcon className="w-3.5 h-3.5" /> {(Number(outroServico.avaliacao_media) || 4.9).toFixed(1)}
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

                {/* TELA DE DETALHES DO PRODUTO */}
                {produtoSelecionado && (
                    <div className="bg-white rounded-3xl p-6 md:p-8 lg:p-10 border border-gray-100 shadow-xl shadow-gray-200/40 animate-in fade-in duration-500 slide-in-from-bottom-4">
                        
                        <div className="flex items-center gap-2 mb-8 text-sm text-gray-500 font-medium overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
                            <button onClick={fecharDetalhes} className="hover:text-[#FF5A00] transition-colors flex items-center gap-1">
                                <ArrowLeftIcon className="w-4 h-4" /> Catálogo
                            </button>
                            <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                            <span className="text-gray-600">Produtos</span>
                            <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                            <span className="text-gray-900 font-bold">{produtoSelecionado.nome}</span>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
                            <div className="w-full lg:w-1/2 relative bg-gray-50 aspect-square rounded-3xl overflow-hidden group border border-gray-100 shadow-inner">
                                {(() => {
                                    const fotosProduto = parseJSONSeguro(produtoSelecionado.fotos);
                                    const hasFotos = fotosProduto.length > 0;
                                    const totalFotos = fotosProduto.length;
                                    
                                    return (
                                        <>
                                            <img src={hasFotos ? fotosProduto[fotoAtualIndex] : 'https://placehold.co/600x600/e2e8f0/828ea8?text=Imagem+do+Produto'} alt={produtoSelecionado.nome} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                                            
                                            {totalFotos > 1 && (
                                                <>
                                                    <button onClick={() => fotoAnterior(totalFotos)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-gray-100 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                                        <ChevronLeftIcon className="w-6 h-6" />
                                                    </button>
                                                    <button onClick={() => proximaFoto(totalFotos)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-gray-100 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                                        <ChevronRightIcon className="w-6 h-6" />
                                                    </button>
                                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                                                        {fotosProduto.map((_, idx) => (
                                                            <button key={idx} onClick={() => setFotoAtualIndex(idx)} className={`h-2.5 rounded-full transition-all shadow-sm ${idx === fotoAtualIndex ? 'w-8 bg-[#FF5A00]' : 'w-2.5 bg-white/80 hover:bg-white'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="w-full lg:w-1/2 pb-24 lg:pb-0">
                                <span className="text-sm text-[#FF5A00] font-extrabold uppercase tracking-widest">{produtoSelecionado.categoria || 'PRODUTO'}</span>
                                
                                <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mt-2 mb-4">
                                    {produtoSelecionado.nome}
                                </h1>

                                <div className="flex gap-4 items-center mb-6">
                                    {produtoSelecionado.promocao == 1 && (
                                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-red-100">
                                            <FireIcon className="w-4 h-4"/> Preço Promocional
                                        </span>
                                    )}
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-100">
                                        Estoque: {produtoSelecionado.estoque_disponivel}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {produtoSelecionado.cor && (
                                        <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Cor</span>
                                            <span className="text-gray-900 font-medium">{produtoSelecionado.cor}</span>
                                        </div>
                                    )}
                                    {produtoSelecionado.tamanho && (
                                        <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Especificação / Tamanho</span>
                                            <span className="text-gray-900 font-medium">{produtoSelecionado.tamanho}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-8">
                                    <h4 className="text-base font-bold text-gray-900 mb-2">Sobre o Produto</h4>
                                    <p className="text-gray-600 text-base leading-relaxed">
                                        {produtoSelecionado.descricao || "Este produto não possui uma descrição detalhada cadastrada. Em caso de dúvida, entre em contato para mais informações."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Barra fixa no mobile (Sticky Bottom Bar) / Bloco final no Desktop para Produto */}
                        <div className="fixed sm:relative bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto bg-white sm:bg-transparent border-t sm:border-t-0 border-gray-200 sm:border-transparent p-4 sm:p-0 sm:pt-8 sm:mt-8 flex flex-row items-center justify-between gap-4 z-50 sm:z-auto shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] sm:shadow-none">
                            <div className="flex-1 sm:flex-none">
                                <span className="text-[11px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Valor do Produto</span>
                                {produtoSelecionado.promocao == 1 ? (
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-400 line-through">R$ {Number(produtoSelecionado.valor_normal).toFixed(2).replace('.', ',')}</span>
                                        <div className="text-2xl sm:text-4xl font-black text-green-600 leading-none flex items-baseline">
                                            <span className="text-sm sm:text-xl font-bold mr-1">R$</span>
                                            {Number(produtoSelecionado.valor_promocional || produtoSelecionado.valor_final).toFixed(2).replace('.', ',')}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-2xl sm:text-4xl font-black text-gray-900 leading-none flex items-baseline mt-1">
                                        <span className="text-sm sm:text-xl font-bold mr-1 text-gray-500">R$</span>
                                        {Number(produtoSelecionado.valor_normal || produtoSelecionado.valor_final).toFixed(2).replace('.', ',')}
                                    </div>
                                )}
                            </div>
                            
                            {!isAdminOuGerente && (
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button 
                                        onClick={adicionarAoCarrinho}
                                        disabled={adicionandoAoCarrinho || produtoSelecionado.estoque_disponivel <= 0}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-center font-bold py-3.5 sm:py-4 px-6 sm:px-10 rounded-2xl shadow-lg transition-all text-sm sm:text-base w-full ${produtoSelecionado.estoque_disponivel <= 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] shadow-green-600/30'}`}
                                    >
                                        {adicionandoAoCarrinho ? (
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : produtoSelecionado.estoque_disponivel <= 0 ? (
                                            'Produto Esgotado'
                                        ) : (
                                            <>
                                                <ShoppingCartIcon className="w-5 h-5" />
                                                Adicionar ao Carrinho
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {produtosOutros.length > 0 && (
                            <div className="mt-24 pt-12 border-t border-gray-100">
                                <h2 className="text-2xl font-extrabold text-gray-900 mb-8">Outros produtos que você pode gostar</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {produtosOutros.map((outroProduto) => {
                                        const fotosO = parseJSONSeguro(outroProduto.fotos);
                                        const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x300/e2e8f0/828ea8?text=Sem+Imagem';

                                        return (
                                            <div 
                                                key={outroProduto.id} 
                                                onClick={() => abrirDetalhesProduto(outroProduto)}
                                                className="cursor-pointer group flex flex-col bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                            >
                                                <div className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-4 relative flex items-center justify-center">
                                                    <img src={fotoCapaO} alt={outroProduto.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                                                    {outroProduto.promocao == 1 && (
                                                        <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-sm">
                                                            Oferta
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-gray-900 font-black text-lg mb-1.5 flex items-baseline">
                                                    <span className="text-xs text-gray-400 font-bold mr-1">R$</span> {Number(outroProduto.valor_final || outroProduto.valor_normal).toFixed(2).replace('.', ',')}
                                                </div>
                                                <h4 className="font-bold text-gray-700 text-sm line-clamp-2 group-hover:text-[#FF5A00] transition-colors leading-snug">{outroProduto.nome}</h4>
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