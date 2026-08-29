import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { 
    TrashIcon, PlusIcon, MinusIcon, 
    ShoppingBagIcon, MapPinIcon, ClockIcon, 
    ChevronLeftIcon, ChevronRightIcon 
} from '@heroicons/react/24/outline';

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

    // 👉 LÓGICA MANTIDA: Atualizar Quantidade via PUT
    const atualizarQuantidade = (id, novaQuantidade) => {
        if (novaQuantidade < 1) return; // Não permite baixar de 1
        
        router.put(route('cliente.carrinho.update', id), {
            quantidade: novaQuantidade
        }, {
            preserveScroll: true,
        });
    };

    // 👉 LÓGICA MANTIDA: Confirmação antes de remover
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
    

    // 👉 LÓGICA MANTIDA DA ROTA MÁGICA:
    // Pegamos o primeiro item do carrinho para saber de qual loja é o agendamento
    const primeiroItem = itensValidos.length > 0 ? itensValidos[0] : null;

    // Calcula a quantidade total do carrinho
    const quantidadeTotalCarrinho = itensValidos.reduce((acc, item) => acc + (item.quantidade || 1), 0);
    
    const urlCheckout = primeiroItem 
        ? route('cliente.agendar', { 
            estabelecimento: primeiroItem.estabelecimento_id, 
            servico_id: primeiroItem.servico_id,
            total_carrinho: totalCarrinho,
            quantidade_carrinho: quantidadeTotalCarrinho
          }) 
        : '#';

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-black leading-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
                    <ShoppingBagIcon className="w-7 h-7 text-indigo-600" /> Meu Carrinho
                </h2>
            }
        >
            <Head title="Carrinho - LOKYVA" />

            <div className="max-w-[1400px] w-full mx-auto pb-20 mt-8 px-4 sm:px-6 lg:px-8 font-sans">
                
                {/* Aviso se o dono da loja tiver apagado algum serviço que estava no carrinho do cliente */}
                {itensApagados > 0 && (
                    <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl shadow-sm animate-in fade-in text-sm font-medium">
                        <strong>Aviso:</strong> {itensApagados} serviço(s) que estavam no seu carrinho foram removidos pelo estabelecimento e não estão mais disponíveis.
                    </div>
                )}

                {itensValidos.length === 0 ? (
                    // =======================================================
                    // 👉 ESTADO VAZIO: COMO NA SEGUNDA IMAGEM OK
                    // =======================================================
                    <div className="flex flex-col items-center justify-center text-center pt-24 pb-32">
                        <div className="bg-gray-100 p-8 rounded-full mb-10 border border-gray-200">
                            <ShoppingBagIcon className="w-20 h-20 text-gray-400 stroke-1" />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tight">Seu carrinho está vazio</h3>
                        <p className="text-gray-500 text-base mt-3 mb-12 max-w-lg leading-relaxed font-medium">
                            Navegue pelos estabelecimentos e adicione serviços ao carrinho para agendar o seu horário de atendimento sem filas.
                        </p>
                        <Link 
                            href={route('cliente.explorar')} 
                            className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-lg font-bold shadow-lg hover:bg-indigo-700 transition active:scale-98"
                        >
                            Explorar Serviços
                        </Link>
                    </div>
                ) : (
                    // =======================================================
                    // 👉 ESTADO ATIVO: COMO NA PRIMEIRA IMAGEM OK
                    // =======================================================
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        
                        {/* LISTA DE SERVIÇOS NO CARRINHO */}
                        <div className="flex-1 space-y-6">
                            {itensVisiveis.map((item) => {
                                const fotos = parseJSONSeguro(item.servico.fotos);
                                const temFotos = fotos.length > 0;
                                const fotoIndexAtual = fotoIndices[item.id] || 0;
                                const qtde = item.quantidade || 1;

                                return (
                                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row items-stretch gap-6 relative group">
                                        
                                        {/* ÁREA DA IMAGEM E CARROSSEL */}
                                        <div className="w-full sm:w-56 h-40 sm:h-auto shrink-0 relative bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                                            {temFotos ? (
                                                <>
                                                    <img 
                                                        src={fotos[fotoIndexAtual]} 
                                                        alt={item.servico.nome} 
                                                        className="w-full h-full object-cover transition-all duration-300" 
                                                    />
                                                    {fotos.length > 1 && (
                                                        <>
                                                            <button onClick={(e) => moverFoto(item.id, -1, fotos.length, e)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <ChevronLeftIcon className="w-5 h-5" />
                                                            </button>
                                                            <button onClick={(e) => moverFoto(item.id, 1, fotos.length, e)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <ChevronRightIcon className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100/50">
                                                    <ShoppingBagIcon className="w-10 h-10 mb-2 opacity-50" />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Sem Imagem</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* ÁREA DE INFORMAÇÕES E CONTROLES */}
                                        <div className="flex-1 flex flex-col justify-between pt-1">
                                            <div className="relative">
                                                {/* 👉 REMOÇÃO MOVIDA PARA O CANTO SUPERIOR DIREITO COMO NA IMAGEM */}
                                                <button 
                                                    onClick={() => removerDoCarrinho(item.id)} 
                                                    className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remover serviço"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>

                                                {item.estabelecimento && (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                        <MapPinIcon className="w-4 h-4" /> {item.estabelecimento.nome}
                                                    </div>
                                                )}
                                                
                                                <h4 className="font-black text-2xl text-gray-950 leading-tight pr-8">
                                                    {item.servico.nome}
                                                </h4>
                                                
                                                <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 font-medium">
                                                    <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded text-gray-700">
                                                        <ClockIcon className="w-4 h-4" /> {item.servico.duracao_minutos} min
                                                    </span>
                                                    <span>{item.servico.tipo_servico}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-6 gap-5 pt-5 border-t border-gray-100/70">
                                                
                                                {/* 👉 CONTROLE DE QUANTIDADE ESTILIZADO COMO NA IMAGEM */}
                                                <div className="flex items-center bg-gray-100 rounded-full border border-gray-200 w-max overflow-hidden">
                                                    <button 
                                                        onClick={() => atualizarQuantidade(item.id, qtde - 1)} 
                                                        disabled={qtde <= 1} 
                                                        className="w-11 h-11 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-200 transition disabled:opacity-30 rounded-l-full"
                                                    >
                                                        <MinusIcon className="w-4 h-4" />
                                                    </button>
                                                    <span className="w-10 text-center font-black text-lg text-gray-950 tabular-nums">{qtde}</span>
                                                    <button 
                                                        onClick={() => atualizarQuantidade(item.id, qtde + 1)} 
                                                        className="w-11 h-11 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-200 transition rounded-r-full"
                                                    >
                                                        <PlusIcon className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* 👉 PREÇO GRANDE E VERDE COMO NA IMAGEM */}
                                                <div className="text-right flex items-baseline gap-1.5">
                                                    <span className="text-base text-gray-500 font-semibold">R$</span>
                                                    <p className="text-4xl font-black text-green-600 tracking-tight">
                                                        {Number(item.servico.valor * qtde).toFixed(2).replace('.', ',')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}

                            {/* CONTROLES DE PAGINAÇÃO */}
                            {totalPaginas > 1 && (
                                <div className="flex justify-center gap-3 pt-6">
                                    <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition shadow-sm">Anterior</button>
                                    <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition shadow-sm">Próxima</button>
                                </div>
                            )}
                        </div>

                        {/* RESUMO DO PEDIDO E BOTÕES LADO DIREITO */}
                        <div className="w-full lg:w-[350px] shrink-0 sticky top-28">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">Resumo</h3>
                                
                                <div className="space-y-4 mb-8 text-base text-gray-600 font-medium">
                                    <div className="flex justify-between items-center">
                                        <span>Serviços ({quantidadeTotalCarrinho})</span>
                                        <span className="text-gray-950 font-semibold">R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-green-600 font-bold">
                                        <span>Taxa de Agendamento</span>
                                        <span className="bg-green-50 px-2 py-0.5 rounded-md">Grátis</span>
                                    </div>
                                    
                                    <div className="h-px w-full bg-gray-100 my-5"></div>
                                    
                                    <div className="flex justify-between items-end">
                                        <span className="font-bold text-gray-900 text-lg">Total</span>
                                        <div className="text-right">
                                            <span className="font-black text-3xl text-indigo-600 tracking-tight">
                                                <span className="text-xl font-bold mr-1">R$</span> {totalCarrinho.toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 👉 BOTÃO AGORA COMO NA IMAGEM */}
                                <Link 
                                    href={urlCheckout} 
                                    className="block text-center w-full bg-gray-950 hover:bg-gray-800 text-white text-xl font-bold py-5 rounded-2xl shadow-lg transition transform active:scale-98"
                                >
                                    Agendar Horários
                                </Link>
                                
                                {/* 👉 PARTE DE ADICIONAR MAIS SERVIÇOS OK */}
                                <Link href={route('cliente.explorar')} className="flex items-center justify-center gap-2 w-full mt-6 text-base font-bold text-indigo-600 hover:text-indigo-800 transition">
                                    <PlusIcon className="w-4 h-4" /> Adicionar mais serviços
                                </Link>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}