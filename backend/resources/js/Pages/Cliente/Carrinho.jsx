import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function Carrinho({ auth, itensCarrinho = [] }) {
    
    // 1. BLINDAGEM DO ARRAY: Garante que temos sempre uma lista, mesmo se o Laravel mandar paginado
    const arrayCarrinho = Array.isArray(itensCarrinho) ? itensCarrinho : (itensCarrinho.data || []);
    
    // 2. BLINDAGEM DE SOFT DELETE: Filtra apenas os itens cujo serviço ainda existe no banco
    const itensValidos = arrayCarrinho.filter(item => item && item.servico);
    const itensApagados = arrayCarrinho.length - itensValidos.length;

    // --- ESTADOS DE PAGINAÇÃO ---
    const [paginaAtual, setPaginaAtual] = useState(1);
    const itensPorPagina = 5;
    
    // --- CONTROLE DE GALERIA ---
    const [fotoIndices, setFotoIndices] = useState({});

    const parseJSONSeguro = (dados, fallback = []) => {
        if (!dados) return fallback;
        if (typeof dados === 'string') {
            try { return JSON.parse(dados); } catch (e) { return fallback; }
        }
        return Array.isArray(dados) ? dados : fallback;
    };

    // Calcular o total apenas dos itens VÁLIDOS (multiplicado pela quantidade)
    const totalCarrinho = itensValidos.reduce((acc, item) => {
        return acc + (Number(item.servico.valor) * (item.quantidade || 1));
    }, 0);

    // 👉 NOVA FUNÇÃO: Atualizar Quantidade via PUT
    const atualizarQuantidade = (id, novaQuantidade) => {
        if (novaQuantidade < 1) return; // Não permite baixar de 1
        
        router.put(route('cliente.carrinho.update', id), {
            quantidade: novaQuantidade
        }, {
            preserveScroll: true,
        });
    };

    // 👉 ATUALIZADO: Confirmação antes de remover
    const removerDoCarrinho = (id) => {
        if (window.confirm('Realmente você quer remover esse serviço do carrinho?')) {
            router.delete(route('cliente.carrinho.destroy', id), {
                preserveScroll: true,
            });
        }
    };

    const moverFoto = (itemId, direcao, totalFotos, e) => {
        e.preventDefault(); 
        setFotoIndices(prev => {
            const indexAtual = prev[itemId] || 0;
            let novoIndex = indexAtual + direcao;
            if (novoIndex < 0) novoIndex = totalFotos - 1;
            if (novoIndex >= totalFotos) novoIndex = 0;
            return { ...prev, [itemId]: novoIndex };
        });
    };

    // Lógica da Paginação
    const indiceUltimoItem = paginaAtual * itensPorPagina;
    const indicePrimeiroItem = indiceUltimoItem - itensPorPagina;
    const itensVisiveis = itensValidos.slice(indicePrimeiroItem, indiceUltimoItem);
    const totalPaginas = Math.ceil(itensValidos.length / itensPorPagina);
    

    // 👉 AQUI ESTÁ A CORREÇÃO DA ROTA MÁGICA:
    // Pegamos o primeiro item do carrinho para saber de qual loja é o agendamento
    const primeiroItem = itensValidos.length > 0 ? itensValidos[0] : null;

    // Calcula a quantidade total do carrinho
    const quantidadeTotalCarrinho = itensValidos.reduce((acc, item) => acc + (item.quantidade || 1), 0);
    
    const urlCheckout = primeiroItem 
        ? route('cliente.agendar', { 
            estabelecimento: primeiroItem.estabelecimento_id, 
            servico_id: primeiroItem.servico_id,
            total_carrinho: totalCarrinho,
            quantidade_carrinho: quantidadeTotalCarrinho // 👉 ESTA É A NOVA LINHA MÁGICA
          }) 
        : '#';

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>🛒</span> Meu Carrinho
                </h2>
            }
        >
            <Head title="Carrinho - WaitLess" />

            <div className="max-w-7xl mx-auto pb-12 mt-6 px-4 sm:px-6 lg:px-8">
                
                {/* Aviso se o dono da loja tiver apagado algum serviço que estava no carrinho do cliente */}
                {itensApagados > 0 && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl shadow-sm animate-in fade-in">
                        <strong>Aviso:</strong> {itensApagados} serviço(s) que estavam no seu carrinho foram removidos pelo estabelecimento e não estão mais disponíveis.
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* ======================================================= */}
                    {/* LADO ESQUERDO: LISTA DE SERVIÇOS NO CARRINHO */}
                    {/* ======================================================= */}
                    <div className="flex-1">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                            
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Serviços Selecionados ({itensValidos.length})
                                </h3>
                                {itensValidos.length > 0 && (
                                    <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                                        Página {paginaAtual} de {totalPaginas}
                                    </span>
                                )}
                            </div>

                            {itensValidos.length === 0 ? (
                                <div className="text-center py-16">
                                    <span className="text-6xl mb-4 block opacity-50">🛒</span>
                                    <h3 className="text-xl font-bold text-gray-700">Seu carrinho está vazio</h3>
                                    <p className="text-gray-500 text-sm mt-2 mb-8">Explore os estabelecimentos e adicione serviços para agendar o seu horário.</p>
                                    <Link href={route('cliente.explorar')} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-md hover:bg-indigo-700 transition">
                                        Explorar Serviços
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {itensVisiveis.map((item) => {
                                        const fotos = parseJSONSeguro(item.servico.fotos);
                                        const temFotos = fotos.length > 0;
                                        const fotoIndexAtual = fotoIndices[item.id] || 0;
                                        const qtde = item.quantidade || 1;

                                        return (
                                            <div key={item.id} className="flex flex-col md:flex-row items-stretch gap-6 pb-8 border-b border-gray-100 last:border-0 last:pb-0 group">
                                                
                                                {/* ÁREA DA IMAGEM E CARROSSEL */}
                                                <div className="w-full md:w-64 h-48 md:h-56 shrink-0 relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-200">
                                                    {temFotos ? (
                                                        <>
                                                            <img 
                                                                src={fotos[fotoIndexAtual]} 
                                                                alt={item.servico.nome} 
                                                                className="w-full h-full object-cover transition-all duration-300" 
                                                            />
                                                            {fotos.length > 1 && (
                                                                <>
                                                                    <button onClick={(e) => moverFoto(item.id, -1, fotos.length, e)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">‹</button>
                                                                    <button onClick={(e) => moverFoto(item.id, 1, fotos.length, e)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">›</button>
                                                                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                                                                        {fotos.map((_, idx) => (
                                                                            <span key={idx} className={`h-1 rounded-full ${idx === fotoIndexAtual ? 'w-3 bg-white' : 'w-1.5 bg-white/50'}`}></span>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                            <span className="text-3xl mb-2">📷</span>
                                                            <span className="text-xs font-medium uppercase tracking-wider">Sem Imagem</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ÁREA DE INFORMAÇÕES E CONTROLES */}
                                                <div className="flex-1 flex flex-col justify-between">
                                                    <div>
                                                        {item.estabelecimento && (
                                                            <Link href={route('estabelecimentos.loja', item.estabelecimento.id)} className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md mb-2 hover:bg-indigo-100 transition">
                                                                📍 {item.estabelecimento.nome}
                                                            </Link>
                                                        )}
                                                        
                                                        <h4 className="font-black text-2xl text-gray-900 leading-tight">
                                                            {item.servico.nome}
                                                        </h4>
                                                        
                                                        <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 font-medium">
                                                            <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">⏱️ {item.servico.duracao_minutos} min</span>
                                                            <span>•</span>
                                                            <span>{item.servico.tipo_servico}</span>
                                                        </div>

                                                        {item.servico.descricao && (
                                                            <p className="text-gray-500 text-sm mt-4 line-clamp-2 leading-relaxed">
                                                                {item.servico.descricao}
                                                            </p>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-6 gap-4 border-t border-gray-50 pt-4">
                                                        
                                                        {/* 👉 CONTROLE DE QUANTIDADE E REMOÇÃO */}
                                                        <div className="flex flex-col gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-bold text-gray-700">Quantidade:</span>
                                                                <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200">
                                                                    <button onClick={() => atualizarQuantidade(item.id, qtde - 1)} disabled={qtde <= 1} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-200 transition disabled:opacity-30 rounded-l-lg">-</button>
                                                                    <span className="w-10 text-center font-bold text-gray-900">{qtde}</span>
                                                                    <button onClick={() => atualizarQuantidade(item.id, qtde + 1)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-200 transition rounded-r-lg">+</button>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => removerDoCarrinho(item.id)} className="text-sm font-bold text-red-500 hover:text-red-700 transition flex items-center gap-1 w-max">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                Remover do carrinho
                                                            </button>
                                                        </div>

                                                        {/* PREÇO */}
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Subtotal Item</p>
                                                            <p className="text-3xl font-black text-green-600">
                                                                <span className="text-lg text-gray-500 font-normal mr-1">R$</span>
                                                                {Number(item.servico.valor * qtde).toFixed(2).replace('.', ',')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* --- CONTROLES DE PAGINAÇÃO --- */}
                            {totalPaginas > 1 && (
                                <div className="mt-10 pt-6 border-t border-gray-100 flex justify-center gap-4">
                                    <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition">Anterior</button>
                                    <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition">Próxima</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ======================================================= */}
                    {/* LADO DIREITO: RESUMO DO PEDIDO E BOTÃO DE AGENDAR */}
                    {/* ======================================================= */}
                    {itensValidos.length > 0 && (
                        <div className="w-full lg:w-[350px] shrink-0">
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 sticky top-24">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Resumo do Pedido</h3>
                                
                                <div className="space-y-4 mb-6 text-sm text-gray-600 font-medium">
                                    <div className="flex justify-between items-center">
                                        <span>Subtotal ({itensValidos.reduce((acc, item) => acc + (item.quantidade || 1), 0)} itens)</span>
                                        <span className="text-gray-900">R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-green-600">
                                        <span>Taxa de Serviço</span>
                                        <span className="font-bold bg-green-50 px-2 py-1 rounded">Grátis</span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-6 mb-8">
                                    <div className="flex justify-between items-end">
                                        <span className="font-bold text-gray-900">Total a Pagar</span>
                                        <div className="text-right">
                                            <span className="text-sm font-normal text-gray-500 mr-1">R$</span>
                                            <span className="font-black text-3xl text-indigo-600">
                                                {totalCarrinho.toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 👉 BOTÃO AGORA REDIRECIONA PARA A TELA DE AGENDAR COM O ESTABELECIMENTO E TOTAL CORRETOS */}
                                <Link 
                                    href={urlCheckout} 
                                    className="block text-center w-full bg-gray-900 hover:bg-gray-800 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02]"
                                >
                                    Agendar Horários
                                </Link>
                                
                                <Link href={route('cliente.explorar')} className="block w-full text-center mt-5 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition">
                                    Adicionar mais serviços
                                </Link>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}