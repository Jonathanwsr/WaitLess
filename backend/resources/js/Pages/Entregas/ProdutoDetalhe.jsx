import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import {
    TruckIcon, QrCodeIcon, CreditCardIcon, DocumentTextIcon, MapPinIcon, MinusIcon, PlusIcon,
    HeartIcon, ShoppingBagIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ExclamationTriangleIcon,
    BuildingStorefrontIcon, ArrowLeftIcon, FireIcon, BanknotesIcon, ShieldCheckIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import AssinarEntregaModal from '@/Components/Entregas/AssinarEntregaModal';
import {
    brl, temDesconto, percentualDesconto, nomeVendedor,
    alternarFavoritoProduto, adicionarAoCarrinhoProduto, perguntarAoDono,
} from '@/lib/produtosEntrega';

const MODOS_PAGAMENTO = [
    { id: 'online', label: 'Online', descricao: 'Pagamento protegido pela Lokyva até a entrega.', icone: ShieldCheckIcon, exige: 'aceita_pagamento_online' },
    { id: 'local', label: 'No local', descricao: 'Pague ao buscar ou receber o produto.', icone: BanknotesIcon },
    { id: 'direto_vendedor', label: 'Direto com o vendedor', descricao: 'Combine o pagamento direto com o vendedor.', icone: ChatBubbleLeftRightIcon },
];

const METODOS_ONLINE = [
    { id: 'pix', label: 'Pix', icone: QrCodeIcon },
    { id: 'cartao', label: 'Cartão', icone: CreditCardIcon },
    { id: 'boleto', label: 'Boleto', icone: DocumentTextIcon },
];

const ENDERECO_VAZIO = {
    entrega_cep: '', entrega_rua: '', entrega_numero: '', entrega_complemento: '',
    entrega_bairro: '', entrega_cidade: '', entrega_estado: '', entrega_observacoes: '',
};

function Etapa({ numero, titulo, concluida, children }) {
    return (
        <section className="bg-white rounded-3xl border border-zinc-100 p-5 sm:p-6 shadow-sm">
            <header className="flex items-center gap-3 mb-4">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${concluida ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-white'}`}>
                    {concluida ? <CheckCircleIcon className="w-4 h-4" /> : numero}
                </span>
                <h2 className="font-bold text-zinc-900">{titulo}</h2>
            </header>
            {children}
        </section>
    );
}

export default function ProdutoDetalhe({ produto, favoritado: favoritadoInicial = false, quantidadeNoCarrinho = 0 }) {
    const aceitaOnline = Boolean(produto.aceita_pagamento_online);
    const aceitaEntrega = produto.aceita_entrega !== false;
    const aceitaRetirada = produto.aceita_retirada !== false;
    const minimo = Number(produto.quantidade_minima || 1);
    const descontoAtivo = temDesconto(produto);

    const [quantidade, setQuantidade] = useState(minimo);
    const [modoPagamento, setModoPagamento] = useState(null);
    const [metodoOnline, setMetodoOnline] = useState(null);
    const [modo, setModo] = useState(aceitaRetirada ? 'retirada' : 'entrega');
    const [endereco, setEndereco] = useState(ENDERECO_VAZIO);
    const [favoritado, setFavoritado] = useState(favoritadoInicial);
    const [assinando, setAssinando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);
    const [aviso, setAviso] = useState(null);

    const valorProdutos = Number(produto.valor_final) * quantidade;
    const taxaEntrega = modo === 'entrega' ? Number(produto.taxa_entrega || 0) : 0;
    const total = valorProdutos + taxaEntrega;

    const enderecoCompleto = ['entrega_cep', 'entrega_rua', 'entrega_numero', 'entrega_bairro', 'entrega_cidade', 'entrega_estado']
        .every((campo) => String(endereco[campo] || '').trim() !== '');

    const pagamentoOk = modoPagamento === 'online' ? aceitaOnline && Boolean(metodoOnline) : Boolean(modoPagamento);
    const recebimentoOk = modo === 'retirada' || enderecoCompleto;
    const podeComprar = Boolean(modoPagamento) && pagamentoOk && recebimentoOk && quantidade >= minimo && !enviando;

    const atualizarEndereco = (campo, valor) => setEndereco((prev) => ({ ...prev, [campo]: valor }));

    const buscarCep = async (valor) => {
        const cep = valor.replace(/\D/g, '').slice(0, 8);
        atualizarEndereco('entrega_cep', cep);
        if (cep.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const json = await res.json();
            if (!json.erro) {
                setEndereco((prev) => ({
                    ...prev,
                    entrega_rua: json.logradouro || prev.entrega_rua,
                    entrega_bairro: json.bairro || prev.entrega_bairro,
                    entrega_cidade: json.localidade || prev.entrega_cidade,
                    entrega_estado: json.uf || prev.entrega_estado,
                }));
            }
        } catch (e) {
            // ViaCEP é um atalho: sem ele o usuário digita o endereço à mão.
        }
    };

    const comprar = async () => {
        setErro(null);
        setEnviando(true);

        try {
            const payload = {
                produto_entrega_id: produto.id,
                quantidade,
                modo_recebimento: modo,
                modo_pagamento: modoPagamento,
                ...(modoPagamento === 'online' ? { metodo_pagamento: metodoOnline } : {}),
                ...(modo === 'entrega' ? endereco : {}),
            };

            const { data } = await axios.post(route('entregas.pedidos.store'), payload);
            window.location.href = data.pagamento?.invoice_url || route('entregas.pedidos.show', data.pedido.id);
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível registrar o pedido agora. Tente novamente.');
            setEnviando(false);
        }
    };

    const alternarFavorito = async () => {
        try {
            setFavoritado(await alternarFavoritoProduto(produto.id));
        } catch (e) {
            setErro('Não foi possível atualizar os favoritos agora.');
        }
    };

    const adicionarAoCarrinho = () => {
        setErro(null);
        setAviso(null);
        adicionarAoCarrinhoProduto(produto.id, quantidade, {
            onSuccess: () => setAviso('Produto adicionado ao carrinho.'),
            onError: () => setErro('Não foi possível adicionar ao carrinho.'),
        });
    };

    const textoBotao = enviando
        ? 'Processando...'
        : !modoPagamento
            ? 'Escolha a forma de pagamento'
            : modoPagamento === 'online' && !aceitaOnline
                ? 'Pagamento online indisponível'
                : modoPagamento === 'online' && !metodoOnline
                    ? 'Escolha Pix, cartão ou boleto'
                    : !recebimentoOk
                        ? 'Preencha o endereço de entrega'
                        : modoPagamento === 'online' ? 'Comprar agora' : 'Reservar pedido';

    return (
        <AuthenticatedLayout>
            <Head title={produto.nome} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24">
                <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
                    <Link href={route('entregas.index')} className="flex items-center gap-1 hover:text-[#FF5A00] font-semibold">
                        <ArrowLeftIcon className="w-4 h-4" /> Produtos
                    </Link>
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-900 font-semibold truncate">{produto.nome}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    {/* COLUNA ESQUERDA: produto e vendedor */}
                    <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-5">
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-zinc-100 shadow-sm">
                            <img
                                src={produto.fotos?.[0] || 'https://placehold.co/800x800/f4f4f5/a1a1aa?text=Sem+Imagem'}
                                alt={produto.nome}
                                className="w-full h-full object-cover"
                            />
                            {descontoAtivo && (
                                <span className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black uppercase px-3 py-1.5 rounded-xl shadow flex items-center gap-1">
                                    <FireIcon className="w-4 h-4" /> -{percentualDesconto(produto)}%
                                </span>
                            )}
                            <button
                                onClick={alternarFavorito}
                                aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/95 backdrop-blur shadow flex items-center justify-center hover:scale-105 transition"
                            >
                                <HeartIcon className={`w-5 h-5 ${favoritado ? 'fill-red-500 text-red-500' : 'text-zinc-500'}`} />
                            </button>
                        </div>

                        <div className="bg-white rounded-3xl border border-zinc-100 p-5 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Vendedor</p>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#FF5A00] flex items-center justify-center">
                                    <BuildingStorefrontIcon className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-zinc-900 truncate">{nomeVendedor(produto)}</p>
                                    {produto.estabelecimento && (
                                        <Link href={route('estabelecimentos.loja', produto.estabelecimento.id)} className="text-xs font-semibold text-[#FF5A00]">
                                            Ver loja
                                        </Link>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => perguntarAoDono(produto.id)}
                                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition"
                            >
                                <ChatBubbleLeftRightIcon className="w-5 h-5" /> Perguntar ao vendedor
                            </button>
                        </div>
                    </div>

                    {/* COLUNA DIREITA: detalhes e compra */}
                    <div className="lg:col-span-3 space-y-5">
                        <div>
                            {produto.categoria && (
                                <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#FF5A00] bg-orange-50 px-2.5 py-1 rounded-lg mb-3">{produto.categoria}</span>
                            )}
                            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">{produto.nome}</h1>
                            <div className="flex items-baseline gap-3 mt-3">
                                <span className="text-4xl font-black text-[#FF5A00]">{brl(produto.valor_final)}</span>
                                {descontoAtivo && <span className="text-base text-zinc-300 line-through">{brl(produto.valor)}</span>}
                                {produto.unidade_medida && <span className="text-sm text-zinc-400">/ {produto.unidade_medida}</span>}
                            </div>

                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                                {produto.marca && <Ficha rotulo="Marca" valor={produto.marca} />}
                                {produto.peso_volume && <Ficha rotulo="Peso / volume" valor={produto.peso_volume} />}
                                {produto.sku && <Ficha rotulo="Código" valor={produto.sku} />}
                                {minimo > 1 && <Ficha rotulo="Quantidade mínima" valor={`${minimo} un.`} />}
                            </dl>

                            {produto.descricao && <p className="text-sm text-zinc-500 mt-5 leading-relaxed whitespace-pre-line">{produto.descricao}</p>}
                            {produto.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {produto.tags.map((tag) => (
                                        <span key={tag} className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!aceitaOnline && (
                            <div className="flex gap-3 bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-2xl p-4">
                                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                                <p className="text-sm">
                                    Este vendedor ainda não recebe pagamentos online. Você pode pagar no local ou combinar o pagamento direto com ele.
                                </p>
                            </div>
                        )}

                        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-2xl">{erro}</div>}
                        {aviso && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-3 rounded-2xl">{aviso}</div>}

                        <Etapa numero={1} titulo="Quantidade" concluida={quantidade >= minimo}>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setQuantidade((q) => Math.max(minimo, q - 1))}
                                        className="w-11 h-11 rounded-2xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                                        aria-label="Diminuir"
                                    >
                                        <MinusIcon className="w-4 h-4" />
                                    </button>
                                    <span className="font-black text-2xl w-10 text-center">{quantidade}</span>
                                    <button
                                        onClick={() => setQuantidade((q) => Math.min(produto.estoque_disponivel, q + 1))}
                                        className="w-11 h-11 rounded-2xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                                        aria-label="Aumentar"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className="text-xs font-semibold text-zinc-400">
                                    {produto.estoque_disponivel} disponíveis
                                    {quantidadeNoCarrinho > 0 && ` · ${quantidadeNoCarrinho} no carrinho`}
                                </span>
                            </div>
                        </Etapa>

                        <Etapa numero={2} titulo="Forma de pagamento" concluida={pagamentoOk}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {MODOS_PAGAMENTO.map((m) => {
                                    const bloqueado = m.exige === 'aceita_pagamento_online' && !aceitaOnline;
                                    const ativo = modoPagamento === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            disabled={bloqueado}
                                            onClick={() => setModoPagamento(m.id)}
                                            className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                                ativo ? 'border-[#FF5A00] bg-orange-50 ring-2 ring-[#FF5A00]/20' : 'border-zinc-200 hover:border-zinc-300'
                                            }`}
                                        >
                                            <m.icone className={`w-6 h-6 ${ativo ? 'text-[#FF5A00]' : 'text-zinc-500'}`} />
                                            <span className="font-bold text-sm text-zinc-900">{m.label}</span>
                                            <span className="text-[11px] leading-snug text-zinc-400">{m.descricao}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {modoPagamento === 'online' && (
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {METODOS_ONLINE.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMetodoOnline(m.id)}
                                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                                                metodoOnline === m.id ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                                            }`}
                                        >
                                            <m.icone className="w-4 h-4" /> {m.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Etapa>

                        <Etapa numero={3} titulo="Como receber" concluida={recebimentoOk}>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {aceitaRetirada && (
                                    <button
                                        onClick={() => setModo('retirada')}
                                        className={`py-3.5 rounded-2xl text-sm font-bold border transition ${modo === 'retirada' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                                    >
                                        Buscar no local
                                    </button>
                                )}
                                {aceitaEntrega && (
                                    <button
                                        onClick={() => setModo('entrega')}
                                        className={`py-3.5 rounded-2xl text-sm font-bold border transition flex items-center justify-center gap-2 ${modo === 'entrega' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                                    >
                                        <TruckIcon className="w-4 h-4" /> Entregar em casa
                                    </button>
                                )}
                            </div>

                            {modo === 'retirada' ? (
                                <div className="flex gap-3 bg-zinc-50 rounded-2xl p-4">
                                    <MapPinIcon className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Endereço para buscar</p>
                                        <p className="text-sm font-semibold text-zinc-800 mt-1">
                                            {[produto.endereco_rua, produto.endereco_numero].filter(Boolean).join(', ') || 'Endereço não informado'}
                                            {produto.endereco_bairro ? ` - ${produto.endereco_bairro}` : ''}
                                            {produto.endereco_cidade ? `, ${produto.endereco_cidade}/${produto.endereco_estado}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-zinc-500">
                                        Taxa de entrega: <strong className="text-zinc-800">{taxaEntrega > 0 ? brl(taxaEntrega) : 'grátis'}</strong>. Informe o endereço completo.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                                        <input className="sm:col-span-2 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="CEP" inputMode="numeric" value={endereco.entrega_cep} onChange={(e) => buscarCep(e.target.value)} />
                                        <input className="sm:col-span-4 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Rua / logradouro" value={endereco.entrega_rua} onChange={(e) => atualizarEndereco('entrega_rua', e.target.value)} />
                                        <input className="sm:col-span-2 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Número" value={endereco.entrega_numero} onChange={(e) => atualizarEndereco('entrega_numero', e.target.value)} />
                                        <input className="sm:col-span-4 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Complemento (apto, bloco)" value={endereco.entrega_complemento} onChange={(e) => atualizarEndereco('entrega_complemento', e.target.value)} />
                                        <input className="sm:col-span-3 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Bairro" value={endereco.entrega_bairro} onChange={(e) => atualizarEndereco('entrega_bairro', e.target.value)} />
                                        <input className="sm:col-span-2 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="Cidade" value={endereco.entrega_cidade} onChange={(e) => atualizarEndereco('entrega_cidade', e.target.value)} />
                                        <input className="sm:col-span-1 rounded-2xl border-zinc-200 px-4 py-3 text-sm uppercase focus:ring-[#FF5A00] focus:border-[#FF5A00]" placeholder="UF" maxLength={2} value={endereco.entrega_estado} onChange={(e) => atualizarEndereco('entrega_estado', e.target.value.toUpperCase())} />
                                        <textarea className="sm:col-span-6 rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" rows={2} placeholder="Detalhes do local (ponto de referência, portão, andar, como chegar)" value={endereco.entrega_observacoes} onChange={(e) => atualizarEndereco('entrega_observacoes', e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </Etapa>

                        {/* RESUMO E AÇÕES */}
                        <section className="bg-zinc-900 text-white rounded-3xl p-6 shadow-xl">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-zinc-300">
                                    <span>{quantidade}x {produto.nome}</span>
                                    <span>{brl(valorProdutos)}</span>
                                </div>
                                <div className="flex justify-between text-zinc-300">
                                    <span>Taxa de entrega</span>
                                    <span>{taxaEntrega > 0 ? brl(taxaEntrega) : 'Grátis'}</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-3 border-t border-white/10 mt-3">
                                    <span className="font-bold">Total</span>
                                    <span className="text-3xl font-black">{brl(total)}</span>
                                </div>
                            </div>

                            <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                                Ao confirmar, você recebe um código de 6 dígitos em <strong className="text-zinc-200">Meus pedidos</strong>.
                                Mostre-o ao vendedor na {modo === 'entrega' ? 'entrega' : 'busca'}: é ele que libera o pagamento.
                            </p>

                            <button
                                onClick={comprar}
                                disabled={!podeComprar}
                                className="w-full mt-5 bg-[#FF5A00] hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {textoBotao}
                            </button>

                            <button
                                onClick={adicionarAoCarrinho}
                                className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/20 text-sm font-bold hover:bg-white/5 transition"
                            >
                                <ShoppingBagIcon className="w-5 h-5" /> Adicionar ao carrinho
                            </button>
                            <button
                                onClick={() => setAssinando(true)}
                                className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/10 text-sm font-bold hover:bg-white/20 transition"
                            >
                                <CalendarDaysIcon className="w-5 h-5" /> Assinar entrega recorrente
                            </button>
                        </section>

                        {assinando && (
                            <AssinarEntregaModal
                                produto={produto}
                                onFechar={() => setAssinando(false)}
                                onCriada={() => { window.location.href = route('entregas.assinaturas.page'); }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Ficha({ rotulo, valor }) {
    return (
        <div className="bg-zinc-50 rounded-2xl px-4 py-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{rotulo}</dt>
            <dd className="text-sm font-semibold text-zinc-800 mt-0.5 truncate">{valor}</dd>
        </div>
    );
}
