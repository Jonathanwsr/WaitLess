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
    const [viagemSelecionadaId, setViagemSelecionadaId] = useState(null);

    // Carregar viagens existentes ao abrir a página
    useEffect(() => {
        carregarMinhasViagens();
    }, []);

    const carregarMinhasViagens = async () => {
        try {
            const res = await axios.get('/api/viagens');
            setMinhasViagens(res.data);
        } catch (err) {
            console.error("Erro ao buscar viagens do usuário", err);
        }
    };

    // Buscar por texto digitado
    const handleBuscaTexto = async (e) => {
        e.preventDefault();
        if (!busca) return;
        executarBusca(`/api/travel-assistant/search?busca=${busca}&dias=${dias}&pessoas=${pessoas}`);
    };

    // Buscar por Localização do GPS (Latitude e Longitude)
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
                alert("Não foi possível acessar seu GPS. Digite o local manualmente.");
            }
        );
    };

    const executarBusca = async (url) => {
        setCarregando(true);
        try {
            const res = await axios.get(url);
            setResultado(res.data);
        } catch (err) {
            console.error("Erro na busca de destino", err);
        } finally {
            setCarregando(false);
        }
    };

    // Salvar planejamento como uma viagem oficial no Banco de Dados
    const handleCriarViagem = async (e) => {
        e.preventDefault();
        if (!tituloViagem || !resultado) return;

        try {
            const dadosNovaViagem = {
                titulo: tituloViagem,
                destino: resultado.destino_detectado,
                data_inicio: new Date().toISOString().split('T')[0], // Hoje
                data_fim: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Hoje + N dias
                orcamento_limite: orcamentoLimite || resultado.orcamento_estimado.total_estimado,
                quantidade_pessoas: pessoas,
                gastos_planejados: resultado.orcamento_estimado.itens_orcamento.map(item => ({
                    item: item.categoria,
                    valor: item.valor_total
                }))
            };

            await axios.post('/api/viagens', dadosNovaViagem);
            alert("Viagem salva com sucesso!");
            setTituloViagem('');
            setOrcamentoLimite('');
            carregarMinhasViagens();
        } catch (err) {
            console.error("Erro ao criar viagem", err);
        }
    };

    // Convidar amigo por email para a viagem
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
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Cabeçalho */}
                <header className="flex justify-between items-center border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                            Waitless Assistente Inteligente
                        </h1>
                        <p className="text-slate-400 mt-1">Planeje sua próxima rota, descubra segredos e economize.</p>
                    </div>
                </header>

                {/* Grid Superior: Buscador e Painel de Configurações */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4 lg:col-span-1">
                        <h2 className="text-xl font-bold text-teal-400 mb-2">Para onde vamos?</h2>
                        <form onSubmit={handleBuscaTexto} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Destino</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Maceió, Alagoas, Portugal..." 
                                    value={busca} 
                                    onChange={(e) => setBusca(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dias</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={dias} 
                                        onChange={(e) => setDias(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pessoas</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={pessoas} 
                                        onChange={(e) => setPessoas(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg transition shadow-lg shadow-teal-500/20">
                                    Pesquisar
                                </button>
                                <button type="button" onClick={handleBuscaGPS} className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-2.5 rounded-lg transition" title="Usar meu GPS">
                                    📍 GPS
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Banner do Destino / Unsplash Destaque */}
                    <div className="lg:col-span-2 relative h-64 lg:h-auto min-h-[250px] rounded-2xl overflow-hidden shadow-xl border border-slate-700">
                        {resultado?.galeria_unsplash?.length > 0 ? (
                            <img 
                                src={resultado.galeria_unsplash[0].url} 
                                alt="Destino" 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                                <span className="text-slate-500">Aguardando pesquisa de destino...</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent flex items-end p-6">
                            {resultado && (
                                <div>
                                    <span className="bg-teal-500 text-slate-950 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Destino Encontrado</span>
                                    <h2 className="text-3xl font-extrabold text-white mt-2 drop-shadow-md">{resultado.destino_detectado}</h2>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Seções de Resultados obtidos */}
                {carregando && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
                        <p className="text-slate-400 mt-4">Montando o seu guia inteligente personalizado...</p>
                    </div>
                )}

                {!carregando && resultado && (
                    <div className="space-y-8 animate-fadeIn">
                        
                        {/* Seção Wikipedia (Cultura) */}
                        {resultado.resumo_wikipedia && (
                            <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                                <h3 className="text-xl font-bold text-teal-400 flex items-center gap-2 mb-4">
                                    📚 Cultura & História do Local
                                </h3>
                                <p className="text-slate-300 leading-relaxed text-base">
                                    {resultado.resumo_wikipedia.resumo}
                                </p>
                                <a href={resultado.resumo_wikipedia.link} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300 inline-block mt-3 font-semibold transition text-sm">
                                    Saiba mais na Wikipedia →
                                </a>
                            </section>
                        )}

                        {/* Orçamento Automático */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-teal-400 mb-4">📊 Orçamento Estimado ({dias} dias / {pessoas} pessoas)</h3>
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead>
                                            <tr className="border-b border-slate-700">
                                                <th className="py-2 font-semibold">Categoria</th>
                                                <th className="py-2 text-right font-semibold">Valor Estimado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultado.orcamento_estimado.itens_orcamento.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-700/50">
                                                    <td className="py-3">{item.categoria}</td>
                                                    <td className="py-3 text-right">R$ {parseFloat(item.valor_total).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="border-t border-slate-700 mt-4 pt-4 flex justify-between items-center">
                                    <span className="text-slate-400 font-medium">Total Estimado:</span>
                                    <span className="text-2xl font-black text-emerald-400">R$ {parseFloat(resultado.orcamento_estimado.total_estimado).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Salvar nos Meus Roteiros */}
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                                <h3 className="text-xl font-bold text-teal-400 mb-4">💾 Deseja Salvar esta Viagem?</h3>
                                <p className="text-sm text-slate-400 mb-4">Salve esse destino no seu perfil para convidar amigos por email e controlar os seus gastos reais.</p>
                                <form onSubmit={handleCriarViagem} className="space-y-4">
                                    <div>
                                        <input 
                                            type="text" 
                                            placeholder="Dê um nome para a viagem (Ex: Férias com a Galera)" 
                                            value={tituloViagem}
                                            onChange={(e) => setTituloViagem(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="number" 
                                            placeholder="Defina um limite de gastos (Opcional)" 
                                            value={orcamentoLimite}
                                            onChange={(e) => setOrcamentoLimite(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-2.5 rounded-lg transition">
                                        Criar Meu Planejamento
                                    </button>
                                </form>
                            </div>
                        </section>

                        {/* Recomendações de Locais e Serviços no Banco */}
                        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                            <h3 className="text-xl font-bold text-teal-400 mb-4">🌟 Serviços & Aluguéis Recomendados da Região</h3>
                            {resultado.recomendacoes_locais?.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {resultado.recomendacoes_locais.map((servico) => (
                                        <div key={servico.id} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-850 hover:border-slate-700 transition flex flex-col justify-between">
                                            <div className="p-4">
                                                <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">{servico.categoria}</span>
                                                <h4 className="text-lg font-bold text-white mt-1">{servico.nome}</h4>
                                                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{servico.descricao}</p>
                                            </div>
                                            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                                                <div>
                                                    <span className="text-xs text-slate-500 block">Diária</span>
                                                    <span className="text-lg font-extrabold text-emerald-400">R$ {parseFloat(servico.valor_diaria).toFixed(2)}</span>
                                                </div>
                                                <a href={`/produto/${servico.id}`} className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg transition">
                                                    Ver Detalhes
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Nenhum serviço parceiro do Waitless cadastrado nessa cidade ainda. Que tal ser o primeiro?</p>
                            )}
                        </section>

                        {/* Galeria de Fotos Adicionais do Unsplash */}
                        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                            <h3 className="text-xl font-bold text-teal-400 mb-4">📸 Galeria Fotográfica do Destino</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {resultado.galeria_unsplash.slice(1).map((img, idx) => (
                                    <div key={idx} className="relative group overflow-hidden rounded-xl h-40 border border-slate-700">
                                        <img src={img.url} alt={img.descricao} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-end p-3 transition duration-300">
                                            <p className="text-xs text-slate-300">Por {img.autor}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                )}

                {/* --- SEÇÃO COMPARTILHADA / PAINEL DE VIAGENS ATIVAS --- */}
                <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl mt-12">
                    <h2 className="text-2xl font-black text-teal-400 mb-6">✈️ Meus Roteiros Colaborativos</h2>
                    {minhasViagens.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {minhasViagens.map((viagem) => (
                                <div key={viagem.id} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{viagem.titulo}</h3>
                                            <span className="text-xs text-teal-400">Destino: {viagem.destino}</span>
                                        </div>
                                        <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">
                                            Orçamento: R$ {parseFloat(viagem.orcamento_limite).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Lista de Colaboradores */}
                                    <div className="pt-2 border-t border-slate-900">
                                        <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Membros do Planejamento</span>
                                        <div className="flex flex-wrap gap-1">
                                            {viagem.membros?.map((membro) => (
                                                <span key={membro.id} className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300" title={membro.email}>
                                                    {membro.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Formulário de convite */}
                                    <form onSubmit={(e) => handleConvidarAmigo(e, viagem.id)} className="flex gap-2">
                                        <input 
                                            type="email" 
                                            placeholder="E-mail do amigo" 
                                            value={viagemSelecionadaId === viagem.id ? conviteEmail : ''}
                                            onChange={(e) => {
                                                setViagemSelecionadaId(viagem.id);
                                                setConviteEmail(e.target.value);
                                            }}
                                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                                            required
                                        />
                                        <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                                            Convidar Amigo
                                        </button>
                                    </form>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-6">Você ainda não salvou nenhuma viagem. Faça uma busca para criar seu primeiro roteiro!</p>
                    )}
                </section>

            </div>
        </div>
    );
}