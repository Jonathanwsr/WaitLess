import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    TruckIcon, MagnifyingGlassIcon, FireIcon, HeartIcon, ShoppingBagIcon, ShieldCheckIcon, MapPinIcon, SparklesIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    brl, temDesconto, percentualDesconto, nomeVendedor,
    alternarFavoritoProduto, adicionarAoCarrinhoProduto,
} from '@/lib/produtosEntrega';
import AbasCliente from '@/Components/Entregas/AbasCliente';

const ICONE_CATEGORIA = {
    '': '✨',
    'Gás e água': '💧',
    Alimentos: '🍞',
    Bebidas: '🥤',
    Mercado: '🛒',
    Farmácia: '💊',
    Pet: '🐾',
    Bazar: '🧺',
    Outros: '📦',
};

const ORDENACOES = [
    { id: '', rotulo: 'Mais relevantes' },
    { id: 'menor_preco', rotulo: 'Menor preço' },
    { id: 'maior_preco', rotulo: 'Maior preço' },
    { id: 'mais_vendidos', rotulo: 'Mais vendidos' },
    { id: 'recentes', rotulo: 'Mais recentes' },
];

export default function Catalogo({ categorias = [] }) {
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');
    const [apenasPromocoes, setApenasPromocoes] = useState(false);
    const [apenasPremium, setApenasPremium] = useState(false);
    const [ordenar, setOrdenar] = useState('');
    const [precoMin, setPrecoMin] = useState('');
    const [precoMax, setPrecoMax] = useState('');
    const [total, setTotal] = useState(0);
    const [produtos, setProdutos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [favoritos, setFavoritos] = useState({});

    useEffect(() => {
        const t = setTimeout(() => {
            setCarregando(true);
            const params = new URLSearchParams();
            if (busca.trim()) params.set('busca', busca.trim());
            if (categoria) params.set('categoria', categoria);
            if (apenasPromocoes) params.set('apenas_promocoes', '1');
            if (apenasPremium) params.set('apenas_premium', '1');
            if (ordenar) params.set('ordenar', ordenar);
            if (precoMin !== '' && Number(precoMin) >= 0) params.set('preco_min', precoMin);
            if (precoMax !== '' && Number(precoMax) >= 0) params.set('preco_max', precoMax);

            fetch(`/entregas/catalogo?${params.toString()}`, { headers: { Accept: 'application/json' } })
                .then((r) => r.json())
                .then((data) => {
                    const lista = Array.isArray(data.data) ? data.data : [];
                    setProdutos(lista);
                    setTotal(Number(data.total ?? lista.length));
                    setFavoritos(Object.fromEntries(lista.map((p) => [p.id, Boolean(p.favoritado)])));
                })
                .catch(() => { setProdutos([]); setTotal(0); })
                .finally(() => setCarregando(false));
        }, 300);
        return () => clearTimeout(t);
    }, [busca, categoria, apenasPromocoes, apenasPremium, ordenar, precoMin, precoMax]);

    const temFiltro = Boolean(busca || categoria || apenasPromocoes || apenasPremium || ordenar || precoMin || precoMax);
    const limparFiltros = () => {
        setBusca(''); setCategoria(''); setApenasPromocoes(false); setApenasPremium(false);
        setOrdenar(''); setPrecoMin(''); setPrecoMax('');
    };

    const favoritar = async (e, produtoId) => {
        e.preventDefault();
        e.stopPropagation();
        const anterior = favoritos[produtoId];
        setFavoritos((prev) => ({ ...prev, [produtoId]: !anterior }));
        try {
            const agora = await alternarFavoritoProduto(produtoId);
            setFavoritos((prev) => ({ ...prev, [produtoId]: agora }));
        } catch (err) {
            setFavoritos((prev) => ({ ...prev, [produtoId]: anterior }));
        }
    };

    const carrinho = (e, produto) => {
        e.preventDefault();
        e.stopPropagation();
        adicionarAoCarrinhoProduto(produto.id, Number(produto.quantidade_minima || 1));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Produtos para entrega" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24">
                <div className="mb-5"><AbasCliente ativa="produtos" /></div>

                {/* HERO */}
                <div className="relative overflow-hidden rounded-[2rem] bg-zinc-900 p-7 sm:p-10 text-white shadow-xl">
                    <img src="/images/explorar_produtos.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-right" />
                    {/* Escurece o lado do texto para a leitura, deixando a foto aparecer à direita */}
                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/70 to-zinc-950/10" />
                    <div className="relative max-w-2xl">
                        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-white/15 px-3 py-1.5 rounded-full">
                            <TruckIcon className="w-4 h-4" /> Entrega ou retirada
                        </p>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-4">Compre do vendedor da sua região</h1>
                        <p className="text-white/80 mt-2 text-sm sm:text-base">Gás, água, mercado e muito mais. Pague online com proteção ou combine direto com o vendedor.</p>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <label className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-lg">
                                <MagnifyingGlassIcon className="w-5 h-5 text-zinc-400" />
                                <input
                                    className="flex-1 outline-none text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent"
                                    placeholder="Buscar botijão de gás, água, cerveja..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </label>
                            <button
                                onClick={() => setApenasPromocoes(!apenasPromocoes)}
                                className={`px-5 py-3.5 rounded-2xl text-sm font-bold transition ${apenasPromocoes ? 'bg-[#FF5A00] text-white' : 'bg-white/15 text-white hover:bg-white/25'}`}
                            >
                                Promoções
                            </button>
                        </div>
                    </div>
                </div>

                <details className="mt-5 bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 group">
                    <summary className="cursor-pointer list-none font-bold text-sm text-zinc-900 flex items-center justify-between">
                        Como funcionam os produtos
                        <span className="text-xs text-zinc-400 group-open:rotate-180 transition">▼</span>
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-600 leading-relaxed list-disc pl-5">
                        <li>Cada produto é vendido por um vendedor. Pode estar em um local (loja) ou ser avulso.</li>
                        <li><strong>Pague online</strong> (protegido até a entrega), <strong>no local</strong> ou <strong>direto com o vendedor</strong>. O pagamento online só aparece quando o vendedor recebe pela plataforma.</li>
                        <li>Escolha entrega em casa ou retirada no endereço do vendedor. Você informa o endereço completo no pedido.</li>
                        <li>Na entrega, mostre o <strong>código de 6 dígitos</strong> de "Meus pedidos" ao vendedor. Só com ele o pagamento é liberado.</li>
                        <li>Pedidos, comprovante em PDF, contato com o vendedor e estornos ficam em "Meus pedidos" e "Estornos".</li>
                    </ul>
                </details>

                {/* CATEGORIAS + FILTROS: barra fixa no topo ao rolar */}
                <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mt-4 bg-zinc-50/90 backdrop-blur-md border-b border-zinc-200/60 space-y-3">
                    <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                        {['', ...categorias].map((c) => (
                            <button
                                key={c || 'todas'}
                                onClick={() => setCategoria(c)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition ${categoria === c ? 'bg-zinc-900 text-white shadow-md' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                            >
                                <span aria-hidden="true">{ICONE_CATEGORIA[c] || '🛍️'}</span> {c || 'Todas'}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={ordenar}
                                onChange={(e) => setOrdenar(e.target.value)}
                                aria-label="Ordenar por"
                                className="rounded-xl border-zinc-200 text-sm font-semibold text-zinc-700 focus:ring-[#FF5A00] focus:border-[#FF5A00]"
                            >
                                {ORDENACOES.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                            </select>
                            <button
                                onClick={() => setApenasPromocoes(!apenasPromocoes)}
                                className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition ${apenasPromocoes ? 'bg-red-600 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                            >
                                <FireIcon className="w-4 h-4" /> Em promoção
                            </button>
                            <button
                                onClick={() => setApenasPremium(!apenasPremium)}
                                className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition ${apenasPremium ? 'bg-amber-500 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                            >
                                <SparklesIcon className="w-4 h-4" /> Vendedor premium
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-400 uppercase">Preço</span>
                            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Mín." value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} className="w-24 rounded-xl border-zinc-200 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" />
                            <span className="text-zinc-300">–</span>
                            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Máx." value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} className="w-24 rounded-xl border-zinc-200 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]" />
                        </div>
                        <div className="flex items-center gap-3 lg:ml-auto">
                            {!carregando && <span className="text-sm text-zinc-500">{total} produto(s)</span>}
                            {temFiltro && (
                                <button onClick={limparFiltros} className="text-sm font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1">
                                    <XMarkIcon className="w-4 h-4" /> Limpar filtros
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="h-5" />

                {carregando ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, i) => <div key={i} className="aspect-[3/4] bg-zinc-100 rounded-3xl animate-pulse" />)}
                    </div>
                ) : produtos.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-zinc-100">
                        <TruckIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">Nenhum produto encontrado com esses filtros.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                        {produtos.map((produto) => {
                            const desconto = temDesconto(produto);
                            const favoritado = Boolean(favoritos[produto.id]);
                            return (
                                <div
                                    key={produto.id}
                                    onClick={() => router.visit(route('entregas.produto', produto.id))}
                                    className="group cursor-pointer bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="relative aspect-square bg-zinc-100 overflow-hidden">
                                        <img
                                            src={produto.fotos?.[0] || 'https://placehold.co/400x400/f4f4f5/a1a1aa?text=Sem+Imagem'}
                                            alt={produto.nome}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                        {desconto && (
                                            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-lg flex items-center gap-1">
                                                <FireIcon className="w-3 h-3" /> -{percentualDesconto(produto)}%
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => favoritar(e, produto.id)}
                                            aria-label={favoritado ? 'Remover dos favoritos' : 'Favoritar'}
                                            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 backdrop-blur shadow flex items-center justify-center hover:scale-110 transition"
                                        >
                                            <HeartIcon className={`w-4 h-4 ${favoritado ? 'fill-red-500 text-red-500' : 'text-zinc-500'}`} />
                                        </button>
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {produto.categoria && <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF5A00]">{produto.categoria}</p>}
                                            {produto.vendedor_premium && (
                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                                    <SparklesIcon className="w-3 h-3" /> Premium
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-bold text-zinc-900 text-sm leading-snug line-clamp-2 mt-1">{produto.nome}</p>
                                        <p className="text-xs text-zinc-400 truncate mt-1 flex items-center gap-1">
                                            <MapPinIcon className="w-3.5 h-3.5 flex-shrink-0" /> {nomeVendedor(produto)}
                                        </p>

                                        <div className="flex items-baseline gap-2 mt-3">
                                            <span className="text-lg font-black text-zinc-900">{brl(produto.valor_final)}</span>
                                            {desconto && <span className="text-xs text-zinc-300 line-through">{brl(produto.valor)}</span>}
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${produto.aceita_pagamento_online ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                <ShieldCheckIcon className="w-3 h-3" /> {produto.aceita_pagamento_online ? 'Pague online' : 'Pague no local'}
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-zinc-100 text-zinc-500">
                                                {Number(produto.taxa_entrega) > 0 ? `Entrega + ${brl(produto.taxa_entrega)}` : 'Entrega grátis'}
                                            </span>
                                        </div>

                                        <button
                                            onClick={(e) => carrinho(e, produto)}
                                            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-zinc-900 text-white text-xs font-bold hover:bg-[#FF5A00] transition"
                                        >
                                            <ShoppingBagIcon className="w-4 h-4" /> Adicionar ao carrinho
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
