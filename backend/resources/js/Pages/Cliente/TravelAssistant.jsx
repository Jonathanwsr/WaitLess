import React, { useState, useEffect } from 'react';
import axios from 'axios'; 

export default function TravelAssistant() {
    // Estados de busca
    const [busca, setBusca] = useState('');
    const [dias, setDias] = useState(5);
    const [pessoas, setPessoas] = useState(2);
    const [carregando, setCarregando] = useState(false);

    // Estados do retorno da API
    const [resultado, setResultado] = useState(null);

    // Estados para criação de uma nova viagem persistente no BD
    const [tituloViagem, setTituloViagem] = useState('');
    const [orcamentoLimite, setOrcamentoLimite] = useState('');
    const [minhasViagens, setMinhasViagens] = useState([]);
    const [conviteEmail, setConviteEmail] = useState('');

    // Estado para controlar a exibição do Modal de Cadastro Completo
    const [exibirModalCadastro, setExibirModalCadastro] = useState(false);

    // Estado para controle de rotação automática de destinos
    const [indiceInicial, setIndiceInicial] = useState(0);

    // Banco de dados interno de destinos para troca automática
    const todosDestinos = [
        { city: "Rio de Janeiro, RJ", tag: "Praia", desc: "Praias incríveis, cultura vibrante e paisagens deslumbrantes.", img: "https://images.unsplash.com/photo-1483729558449-99ef09a8c025?auto=format&fit=crop&w=600&q=80" },
        { city: "São Paulo, SP", tag: "Cidade", desc: "Gastronomia, cultura e entretenimento sem igual.", img: "https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?auto=format&fit=crop&w=600&q=80" },
        { city: "Gramado, RS", tag: "Montanha", desc: "Clima europeu, natureza exuberante e muito charme.", img: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&w=600&q=80" },
        { city: "Fernando de Noronha, PE", tag: "Praia", desc: "Um paraíso preservado de águas cristalinas.", img: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80" },
        { city: "Salvador, BA", tag: "Histórico", desc: "Energia contagiante, história viva e culinária única.", img: "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=600&q=80" },
        { city: "Florianópolis, SC", tag: "Praia", desc: "A ilha da magia com praias paradisíacas e muita natureza.", img: "https://images.unsplash.com/photo-1516815431888-c782a2083652?auto=format&fit=crop&w=600&q=80" }
    ];

    // Efeito para carregar dados iniciais e ativar automações
    useEffect(() => {
        carregarMinhasViagens();
        obterLocalizacaoAutomatica();

        // Intervalo para trocar os lugares automaticamente a cada 4 segundos
        const intervaloDestinos = setInterval(() => {
            setIndiceInicial((prev) => (prev + 1) % todosDestinos.length);
        }, 4000);

        return () => clearInterval(intervaloDestinos);
    }, []);

    // Geração da lista rotativa de 4 destinos baseada no índice atual
    const destinosExibidos = Array.from({ length: 4 }, (_, i) => 
        todosDestinos[(indiceInicial + i) % todosDestinos.length]
    );

    // Função nativa da janela para retornar à última tela do usuário
    const handleVoltar = () => {
        if (typeof window !== 'undefined') {
            window.history.back();
        }
    };

    // Captura automática de localização via API Web do navegador
    const obterLocalizacaoAutomatica = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    executarBusca(`/api/travel-assistant/search?latitude=${latitude}&longitude=${longitude}&dias=${dias}&pessoas=${pessoas}`);
                },
                (error) => {
                    console.warn("Permissão de localização não concedida ou indisponível no momento.");
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        }
    };

    const carregarMinhasViagens = async () => {
        try {
            const res = await axios.get(`/api/viagens?_t=${Date.now()}`);
            setMinhasViagens(res.data);
        } catch (err) {
            console.error("Erro ao buscar viagens do usuário", err);
        }
    };

    const handleBuscaTexto = async (e) => {
        e.preventDefault();
        if (!busca) return;
        executarBusca(`/api/travel-assistant/search?busca=${busca}&dias=${dias}&pessoas=${pessoas}`);
    };

    const handleBuscaGPS = () => {
        if (!navigator.geolocation) {
            alert("Geolocalização não é suportada pelo seu navegador.");
            return;
        }

        setCarregando(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                executarBusca(`/api/travel-assistant/search?latitude=${latitude}&longitude=${longitude}&dias=${dias}&pessoas=${pessoas}`);
            },
            (error) => {
                setCarregando(false);
                alert("Não foi possível acessar sua localização. Digite o local manualmente.");
            },
            { enableHighAccuracy: true }
        );
    };

    const executarBusca = async (url) => {
        setCarregando(true);
        try {
            const caractereConexao = url.includes('?') ? '&' : '?';
            const urlFinal = `${url}${caractereConexao}_t=${Date.now()}`;
            const res = await axios.get(urlFinal);
            setResultado(res.data);
        } catch (err) {
            console.error("Erro na busca de destino", err);
        } finally {
            setCarregando(false);
        }
    };

    const handleCriarViagem = async (e) => {
        e.preventDefault();
        if (!tituloViagem) return;

        try {
            const dadosNovaViagem = {
                titulo: tituloViagem,
                destino: resultado?.destino_detectado || busca || 'Destino Personalizado',
                data_inicio: new Date().toISOString().split('T')[0],
                data_fim: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                orcamento_limite: orcamentoLimite || resultado?.orcamento_estimado?.total_estimado || 0,
                quantidade_pessoas: pessoas,
                gastos_planejados: resultado?.orcamento_estimado?.itens_orcamento?.map(item => ({
                    item: item.categoria,
                    valor: item.valor_total
                })) || []
            };

            await axios.post('/api/viagens', dadosNovaViagem);
            alert("Viagem salva com sucesso!");
            setTituloViagem('');
            setOrcamentoLimite('');
            setExibirModalCadastro(false);
            carregarMinhasViagens();
        } catch (err) {
            console.error("Erro ao criar viagem", err);
            alert("Ocorreu um erro ao salvar sua viagem.");
        }
    };

    const handleConvidarAmigo = async (e, viagemId) => {
        e.preventDefault();
        if (!conviteEmail) return;

        try {
            await axios.post(`/api/viagens/${viagemId}/adicionar-amigo`, { email: conviteEmail });
            alert("Amigo adicionado à sua viagem!");
            setConviteEmail('');
            carregarMinhasViagens();
        } catch (err) {
            alert(err.response?.data?.message || "Erro ao convidar.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16 antialiased relative">
            
            {/* Cabeçalho Modernizado */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    
                    <div className="flex items-center gap-4">
                        {/* Botão de Voltar Minimalista */}
                        <button 
                            onClick={handleVoltar}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-600 rounded-xl transition-all duration-200 flex items-center justify-center group"
                            aria-label="Voltar para a tela anterior"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>

                        {/* Logo */}
                        <div className="flex items-center gap-1.5 cursor-pointer">
                            <span className="text-orange-600 text-2xl font-black tracking-tight">w</span>
                            <span className="text-slate-900 text-xl font-bold tracking-tight">waitless</span>
                        </div>
                        
                        {/* Menu de Navegação */}
                        <nav className="hidden lg:flex gap-6 text-sm font-semibold text-slate-500 ml-6">
                            <span className="text-orange-600 border-b-2 border-orange-600 pb-1 cursor-pointer">Explorar</span>
                            <span className="hover:text-slate-900 transition cursor-pointer">Hospedagens</span>
                            <span className="hover:text-slate-900 transition cursor-pointer">Restaurantes</span>
                            <span className="hover:text-slate-900 transition cursor-pointer">Serviços</span>
                            <span className="hover:text-slate-900 transition cursor-pointer">Ofertas</span>
                        </nav>
                    </div>

                    {/* Perfil e Notificações */}
                    <div className="flex items-center gap-5">
                        <span className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer hover:text-orange-600 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                            </svg>
                            Favoritos
                        </span>
                        
                        <div className="relative p-2 cursor-pointer hover:bg-slate-50 rounded-full transition">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                            <span className="absolute top-1.5 right-1.5 bg-red-500 w-2 h-2 rounded-full"></span>
                        </div>
                        
                        <div className="flex items-center gap-2.5 border-l pl-5 border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                                J
                            </div>
                            <div className="hidden sm:block text-xs">
                                <p className="font-bold text-slate-900">Olá, Jonathan</p>
                                <p className="text-slate-400 font-medium">Cliente</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Banner Principal */}
            <div className="relative bg-gradient-to-r from-orange-500 to-amber-600 text-white overflow-hidden py-20 px-6 md:px-12">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1500&q=80')] bg-cover bg-center opacity-20 mix-blend-multiply"></div>
                <div className="relative max-w-7xl mx-auto space-y-3">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight drop-shadow-sm">
                        Encontre o lugar perfeito para sua viagem
                    </h1>
                    <p className="max-w-xl text-base md:text-lg text-slate-100/90">
                        Pesquise por destinos, datas e descubra as melhores opções dinâmicas perto de você ou ao redor do mundo.
                    </p>
                </div>
            </div>

            {/* Buscador Inteligente Flutuante */}
            <div className="max-w-7xl mx-auto px-6 -mt-10 relative z-20">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 p-6 transition-all duration-300">
                    <form onSubmit={handleBuscaTexto} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        
                        {/* Destino */}
                        <div className="lg:col-span-4 space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Para onde você vai?</label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-3.5 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.603 10.602z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="País, estado, cidade, CEP ou local" 
                                    value={busca} 
                                    onChange={(e) => setBusca(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition duration-200"
                                />
                            </div>
                        </div>

                        {/* Duração */}
                        <div className="lg:col-span-2 space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Duração (Dias)</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={dias} 
                                onChange={(e) => setDias(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition duration-200"
                            />
                        </div>

                        {/* Pessoas */}
                        <div className="lg:col-span-3 space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Hóspedes / Pessoas</label>
                            <div className="relative flex items-center">
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={pessoas} 
                                    onChange={(e) => setPessoas(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-24 py-3 text-slate-800 font-medium focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setExibirModalCadastro(true)}
                                    className="absolute right-2 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors duration-200"
                                >
                                    + Cadastrar
                                </button>
                            </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="lg:col-span-3 flex gap-2">
                            <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 shadow-lg shadow-orange-600/20 flex items-center justify-center">
                                <span>Buscar lugares</span>
                            </button>
                            <button 
                                type="button" 
                                onClick={handleBuscaGPS} 
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3.5 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 font-semibold text-sm" 
                                title="Usar minha localização atual"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25z" />
                                </svg>
                                GPS
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Categorias Rápidas */}
            <div className="max-w-7xl mx-auto px-6 mt-8">
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    {["Praias", "Montanhas", "Cidades", "Campo", "Romântico", "Família", "Luxo", "Econômico"].map((cat) => (
                        <button key={cat} className="px-4 py-2 bg-white rounded-full border border-slate-200/80 hover:border-orange-500 hover:text-orange-600 transition duration-200 shadow-sm font-semibold">
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-12 space-y-12">
                
                {/* Loader */}
                {carregando && (
                    <div className="text-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-600 mx-auto"></div>
                        <p className="text-slate-400 mt-4 font-semibold text-sm">Montando o seu guia inteligente personalizado...</p>
                    </div>
                )}

                {/* Exibição Rotativa Automática dos Resultados */}
                {!carregando && !resultado && (
                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Destinos populares em destaque</h2>
                                <p className="text-sm text-slate-400 font-medium">Lugares atualizados dinamicamente baseados nas principais tendências</p>
                            </div>
                            <button className="border border-slate-200 hover:border-orange-500 hover:bg-orange-50 text-slate-700 hover:text-orange-600 text-xs font-bold px-4 py-2 rounded-lg transition duration-200">
                                Ver todos os destinos
                            </button>
                        </div>

                        {/* Grid dos Cards com Transições Suaves */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-500">
                            {destinosExibidos.map((item, idx) => (
                                <div key={`${item.city}-${idx}`} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transform transition duration-300 flex flex-col justify-between">
                                    <div className="relative h-48 bg-slate-200">
                                        <img src={item.img} alt={item.city} className="w-full h-full object-cover" />
                                        <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider uppercase">
                                            {item.tag}
                                        </span>
                                        <button className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-slate-700 hover:text-red-500 hover:bg-white transition duration-200 shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-1.5 text-slate-900 mb-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-orange-600">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25z" />
                                                </svg>
                                                <h4 className="font-bold tracking-tight">{item.city}</h4>
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-medium">{item.desc}</p>
                                        </div>
                                        <button className="w-full mt-4 border border-orange-200 hover:border-orange-500 text-slate-700 hover:text-orange-600 hover:bg-orange-50 text-xs font-bold py-2.5 rounded-xl transition duration-200">
                                            Descrição detalhada
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Exibição dos Resultados da Busca */}
                {!carregando && resultado && (
                    <div className="space-y-8 animate-fadeIn">
                        
                        {/* Seção Informações Culturais */}
                        {resultado?.resumo_wikipedia && (
                            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                                    Cultura & História do Local
                                </h3>
                                <p className="text-slate-500 leading-relaxed text-sm font-medium">
                                    {resultado.resumo_wikipedia?.resumo}
                                </p>
                                <a href={resultado.resumo_wikipedia?.link} target="_blank" rel="noreferrer" className="text-orange-600 hover:text-orange-700 inline-block mt-3 font-bold transition text-sm">
                                    Saiba mais na Wikipedia &rarr;
                                </a>
                            </section>
                        )}

                        {/* Grid de Orçamentos e Ações */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Orçamento Estimado ({dias} dias / {pessoas} pessoas)</h3>
                                    <table className="w-full text-left text-sm text-slate-500">
                                        <thead>
                                            <tr className="border-b border-slate-100 pb-2 font-bold text-slate-400 text-xs uppercase tracking-wider">
                                                <th className="py-2">Categoria</th>
                                                <th className="py-2 text-right">Valor Estimado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultado?.orcamento_estimado?.itens_orcamento?.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-50 font-medium">
                                                    <td className="py-3 text-slate-700">{item.categoria}</td>
                                                    <td className="py-3 text-right text-slate-900">R$ {parseFloat(item.valor_total).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between items-center">
                                    <span className="text-slate-400 font-bold text-sm uppercase">Total Estimado:</span>
                                    <span className="text-xl font-black text-orange-600">R$ {parseFloat(resultado?.orcamento_estimado?.total_estimado || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Criação de Roteiro */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">Deseja Salvar esta Viagem?</h3>
                                <p className="text-sm text-slate-400 mb-4 font-medium">Salve esse destino no seu perfil para convidar amigos e controlar os seus gastos reais.</p>
                                <form onSubmit={handleCriarViagem} className="space-y-4">
                                    <input 
                                        type="text" 
                                        placeholder="Nome do planejamento (Ex: Férias de Verão)" 
                                        value={tituloViagem}
                                        onChange={(e) => setTituloViagem(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 text-sm font-medium"
                                        required
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Defina um limite de gastos (Opcional)" 
                                        value={orcamentoLimite}
                                        onChange={(e) => setOrcamentoLimite(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 text-sm font-medium"
                                    />
                                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-orange-600/15">
                                        Criar Meu Planejamento
                                    </button>
                                </form>
                            </div>
                        </section>
                    </div>
                )}

                {/* Roteiros Ativos/Colaborativos */}
                <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h2 className="text-xl font-black text-slate-900 mb-4 tracking-tight">Meus Roteiros Colaborativos</h2>
                    {minhasViagens.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {minhasViagens.map((viagem) => (
                                <div key={viagem.id} className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900 tracking-tight">{viagem.titulo}</h3>
                                            <span className="text-xs text-orange-600 font-bold">Destino: {viagem.destino}</span>
                                        </div>
                                        <span className="text-xs font-bold bg-orange-100 text-orange-600 px-3 py-1 rounded-full">
                                            Limite: R$ {parseFloat(viagem.orcamento_limite).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Formulário para Convidar Amigos */}
                                    <form onSubmit={(e) => handleConvidarAmigo(e, viagem.id)} className="flex gap-2">
                                        <input 
                                            type="email" 
                                            placeholder="E-mail do amigo" 
                                            value={conviteEmail}
                                            onChange={(e) => setConviteEmail(e.target.value)}
                                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500 font-medium"
                                            required
                                        />
                                        <button 
                                            type="submit" 
                                            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition duration-200"
                                        >
                                            Convidar
                                        </button>
                                    </form>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm font-semibold text-center py-6">
                            Você não possui viagens planejadas no momento. Experimente criar uma acima!
                        </p>
                    )}
                </section>
            </div>

            {/* Modal de Cadastro Completo (Overlay) */}
            {exibirModalCadastro && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-w-md w-full mx-4 relative animate-scaleUp">
                        {/* Botão de Fechar */}
                        <button 
                            onClick={() => setExibirModalCadastro(false)} 
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Novo Roteiro</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">Configure os dados iniciais do seu planejamento rápido de viagem.</p>
                            </div>

                            <form onSubmit={handleCriarViagem} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título do Planejamento</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: Eurotrip de Férias 2026" 
                                        value={tituloViagem}
                                        onChange={(e) => setTituloViagem(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-medium"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orçamento Máximo Recomendado (R$)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Ex: 10000" 
                                        value={orcamentoLimite}
                                        onChange={(e) => setOrcamentoLimite(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-medium"
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-600/20 transition duration-200"
                                >
                                    Salvar Planejamento
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}