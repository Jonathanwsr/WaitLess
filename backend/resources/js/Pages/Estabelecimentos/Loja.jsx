import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { StarIcon, ClockIcon, UserGroupIcon, CreditCardIcon, CalendarIcon, ShoppingBagIcon } from '@heroicons/react/24/solid';

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

    // 👉 FUNÇÃO: Adicionar ao Carrinho
    const adicionarAoCarrinho = () => {
        if (!servicoSelecionado) return;

        setAdicionandoAoCarrinho(true);

        router.post(route('cliente.carrinho.store'), {
            servico_id: servicoSelecionado.id,
            estabelecimento_id: estabelecimento.id,
            // Pode enviar data e hora se quiser que o item no carrinho já tenha essa preferência
            data_agendamento: dataSelecionada || null,
            hora_agendamento: horaSelecionada || null,
        }, {
            preserveScroll: true,
            onFinish: () => setAdicionandoAoCarrinho(false),
            // Opcional: Se o seu backend retornar with('success', '...'), o layout base cuida disso, 
            // ou você pode tratar um alert visual aqui.
        });
    };

    const servicosOutros = servicoSelecionado 
        ? servicos.filter(s => s.id !== servicoSelecionado.id).slice(0, 4) 
        : [];

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
                            <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                {estabelecimento.nome}
                                {isAdminOuGerente && (
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-2">Visão Gerencial</span>
                                )}
                            </h2>
                            <p className="text-sm text-gray-500">{estabelecimento.bairro ? `${estabelecimento.bairro}, ` : ''}{estabelecimento.cidade}</p>
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

            {/* Aviso de Checkout Pendente */}
            {checkoutPendente && !isAdminOuGerente && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-in slide-in-from-top-4">
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex flex-col sm:flex-row justify-between items-center shadow-sm gap-3">
                        <span className="text-sm font-bold flex items-center gap-2">🛒 Você tem um pedido em andamento!</span>
                        <button onClick={voltarParaCheckout} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-sm w-full sm:w-auto text-center">
                            Voltar para Checkout
                        </button>
                    </div>
                </div>
            )}

            {/* Mensagens Flash (Para o sucesso do carrinho) */}
            {flash?.success && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-in fade-in">
                    <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-sm text-sm font-bold">
                        ✅ {flash.success}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12">
                
                {/* TELA 1: GRID PRINCIPAL DOS SERVIÇOS */}
                {!servicoSelecionado && (
                    <div className="animate-in fade-in duration-300">
                        {!isAdminOuGerente && (
                            <div className="mb-8 flex justify-center">
                                <div className="w-full max-w-2xl relative">
                                    <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
                                    <input 
                                        type="text" 
                                        placeholder={`Buscar serviços em ${estabelecimento.nome}...`} 
                                        className="w-full bg-white border border-gray-200 rounded-full py-3 pl-12 pr-4 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">Catálogo de Serviços</h3>

                        {servicos.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                                <span className="text-4xl">🛒</span>
                                <h3 className="text-lg font-bold text-gray-700 mt-4">Nenhum serviço disponível</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
                                {servicos.map((servico) => {
                                    const fotos = parseJSONSeguro(servico.fotos);
                                    const fotoCapa = fotos.length > 0 ? fotos[0] : 'https://placehold.co/400x400/e2e8f0/828ea8?text=Sem+Imagem';

                                    return (
                                        <div key={servico.id} onClick={() => abrirDetalhes(servico)} className="flex flex-col cursor-pointer group">
                                            <div className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden mb-4 relative">
                                                <img src={fotoCapa} alt={servico.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                                            </div>
                                            <div className="flex-1 flex flex-col items-center text-center">
                                                <div className="text-indigo-600 font-bold text-lg mb-1">R$ {Number(servico.valor).toFixed(2).replace('.', ',')}</div>
                                                <h4 className="font-bold text-gray-900 leading-tight">{servico.nome}</h4>
                                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{servico.tipo_servico}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TELA 2: DETALHES DO SERVIÇO */}
                {servicoSelecionado && (
                    <div className="animate-in fade-in duration-300">
                        
                        <div className="flex items-center gap-2 mb-8 text-sm text-gray-500 font-medium">
                            <button onClick={fecharDetalhes} className="hover:text-indigo-600">Catálogo</button>
                            <span>›</span>
                            <span className="text-gray-900">{servicoSelecionado.tipo_servico}</span>
                            <span>›</span>
                            <span className="text-gray-900 underline decoration-indigo-300 underline-offset-4">{servicoSelecionado.nome}</span>
                        </div>

                        <div className="flex flex-col md:flex-row gap-10 lg:gap-16 items-start">
                            
                            {/* ESQUERDA: GALERIA DE FOTOS */}
                            <div className="w-full md:w-1/2 relative bg-gray-100 aspect-square rounded-xl overflow-hidden group border border-gray-200 shadow-sm">
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
                                                            <button key={idx} onClick={() => setFotoAtualIndex(idx)} className={`h-2 rounded-full transition-all shadow-sm ${idx === fotoAtualIndex ? 'w-6 bg-indigo-600' : 'w-2 bg-white/70 hover:bg-white'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* DIREITA: INFORMAÇÕES */}
                            <div className="w-full md:w-1/2 py-2">
                                <h1 className="text-4xl lg:text-5xl font-normal text-gray-900 mb-2 font-serif tracking-tight">
                                    {servicoSelecionado.nome}
                                </h1>
                                <p className="text-lg font-bold text-gray-800 mb-6">
                                    {servicoSelecionado.tipo_servico}
                                </p>

                                {/* Avaliação e Tempo + 👉 BOTÃO DE CARRINHO (Wireframe Amarelo) */}
                                <div className="flex items-center justify-between border-b border-gray-200 pb-6 mb-6">
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <StarIcon className="w-4 h-4 text-gray-800" /><StarIcon className="w-4 h-4 text-gray-800" /><StarIcon className="w-4 h-4 text-gray-800" /><StarIcon className="w-4 h-4 text-gray-800" /><StarIcon className="w-4 h-4 text-gray-300" />
                                        </div>
                                        <span className="text-gray-400">|</span>
                                        <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4"/> {servicoSelecionado.duracao_minutos} minutos</span>
                                    </div>
                                    
                                    {/* 👉 BOTÃO ADICIONAR AO CARRINHO (Icone) */}
                                    {!isAdminOuGerente && (
                                        <button 
                                            onClick={adicionarAoCarrinho}
                                            disabled={adicionandoAoCarrinho}
                                            title="Adicionar ao Carrinho"
                                            className="h-10 w-10 flex items-center justify-center bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-600 rounded-full transition-colors disabled:opacity-50"
                                        >
                                            {adicionandoAoCarrinho ? (
                                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : (
                                                <ShoppingBagIcon className="w-5 h-5" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                <p className="text-gray-600 text-[15px] leading-relaxed mb-8">
                                    {servicoSelecionado.descricao || "Este serviço não possui uma descrição detalhada cadastrada. Em caso de dúvida, entre em contato."}
                                </p>

                                {!isAdminOuGerente && (() => {
                                    const config = parseJSONSeguro(servicoSelecionado.configuracoes);
                                    const diasDisponiveisBanco = config.dias_disponiveis || [];
                                    const horariosDisponiveisBanco = parseJSONSeguro(servicoSelecionado.horarios_disponiveis);
                                    const diasParaMostrar = gerarDiasProximos(diasDisponiveisBanco);

                                    return (
                                        <>
                                            <div className="mb-8">
                                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4 text-indigo-500" /> 1. Escolha o Dia
                                                </h4>
                                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                                    {diasParaMostrar.length > 0 ? (
                                                        diasParaMostrar.map(dia => {
                                                            const isSelected = dataSelecionada === dia.dataOriginal;
                                                            return (
                                                                <button 
                                                                    key={dia.dataOriginal}
                                                                    type="button"
                                                                    onClick={() => setDataSelecionada(dia.dataOriginal)}
                                                                    className={`flex flex-col items-center justify-center min-w-[70px] p-3 rounded-xl border transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-105' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                                                >
                                                                    <span className={`text-xs font-bold uppercase mb-1 ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{dia.diaSemana}</span>
                                                                    <span className="text-xl font-black">{dia.diaMes}</span>
                                                                    <span className={`text-[10px] uppercase font-bold mt-1 ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>{dia.mes}</span>
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-sm text-red-500">Nenhum dia disponível cadastrado.</span>
                                                    )}
                                                </div>

                                                <h4 className="text-sm font-bold text-gray-900 mt-4 mb-3 flex items-center gap-2">
                                                    <ClockIcon className="w-4 h-4 text-indigo-500" /> 2. Escolha o Horário
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
                                                                    className={`px-4 py-2 font-bold text-sm rounded-lg transition-all border ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
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

                                            <div className="flex items-center justify-between text-sm border-t border-gray-200 py-4 mb-4">
                                                <div className="flex items-center gap-2 text-gray-700">
                                                    <CreditCardIcon className="w-5 h-5 text-indigo-500" />
                                                    <span className="font-bold">Pagamento aceito:</span>
                                                </div>
                                                <span className="text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-md">
                                                    {getTextoPagamento(config.tipo_pagamento)}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* Bloco Final: Preço e Botão de Agendar */}
                                <div className="border-t border-b border-gray-200 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="text-4xl font-normal text-gray-900 font-serif">
                                        <span className="text-xl text-gray-500 font-sans mr-1">R$</span>
                                        {Number(servicoSelecionado.valor).toFixed(2).replace('.', ',')}
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
                                                className={`text-center font-bold py-4 px-10 rounded-xl shadow-md transition-all text-lg ${(!dataSelecionada || !horaSelecionada) ? 'bg-gray-800 text-gray-200 hover:bg-gray-900' : 'bg-indigo-600 text-white hover:bg-indigo-700 scale-105'}`}
                                            >
                                                {dataSelecionada && horaSelecionada ? 'Avançar para Pagamento' : 'Agendar agora'}
                                            </Link>
                                            {(!dataSelecionada || !horaSelecionada) && (
                                                <span className="text-center text-xs text-gray-400 mt-2">Escolha data e hora acima para agilizar</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SHOP SIMILAR */}
                        {servicosOutros.length > 0 && (
                            <div className="mt-20 pt-16 border-t border-gray-200 bg-gray-50/50 rounded-b-3xl pb-10">
                                <h2 className="text-3xl font-normal text-center text-gray-900 mb-12 font-serif">Outros serviços da loja</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 px-4 sm:px-10">
                                    {servicosOutros.map((outroServico) => {
                                        const fotosO = parseJSONSeguro(outroServico.fotos);
                                        const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x400/e2e8f0/828ea8?text=Sem+Imagem';

                                        return (
                                            <div 
                                                key={outroServico.id} 
                                                onClick={() => abrirDetalhes(outroServico)}
                                                className="cursor-pointer group flex flex-col items-center bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100"
                                            >
                                                <div className="w-full aspect-square bg-gray-200 rounded-md overflow-hidden mb-4">
                                                    <img src={fotoCapaO} alt={outroServico.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                                </div>
                                                <div className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded mb-3">
                                                    R$ {Number(outroServico.valor).toFixed(2)}
                                                </div>
                                                <h4 className="font-bold text-gray-900 text-center">{outroServico.nome}</h4>
                                                <p className="text-xs text-gray-500 mt-1">{outroServico.duracao_minutos} min</p>
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