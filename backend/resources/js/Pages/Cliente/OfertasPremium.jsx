import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Crown, Lock, Sparkles, Tag, Coins, Store, ImageOff, Search, MapPin, Tags, X } from 'lucide-react';

const formatarMoeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function ModalPlanoBloqueado({ oferta, planoAtual, onClose }) {
    const fotos = Array.isArray(oferta.fotos) ? oferta.fotos : [];
    const capa = fotos[0] || null;
    const planoNecessario = oferta.tipo === 'produto' ? 'Premium Plus' : 'Premium';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="aspect-[16/10] bg-gray-100 relative">
                    {capa ? (
                        <img src={capa} alt={oferta.nome} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageOff className="w-12 h-12" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="bg-white/95 p-4 rounded-full shadow-lg">
                            <Lock className="w-8 h-8 text-[#FF5A00]" />
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="absolute top-3 right-3 bg-white/90 hover:bg-white p-2 rounded-full shadow" aria-label="Fechar">
                        <X className="w-4 h-4 text-gray-700" />
                    </button>
                </div>

                <div className="p-6 text-center">
                    <h3 className="text-xl font-black text-gray-900 leading-tight">{oferta.nome}</h3>
                    <p className="mt-3 text-base font-black text-[#FF5A00]">Mude de plano para reservar</p>
                    <p className="mt-2 text-sm text-gray-500">
                        Este item não faz parte do seu plano{planoAtual ? <> atual (<strong>{planoAtual}</strong>)</> : ''}. Ele fica liberado a partir do plano <strong>{planoNecessario}</strong>.
                    </p>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => router.visit(route('assinatura.status', { mudar: 1 }))}
                            className="w-full py-3.5 rounded-2xl bg-[#FF5A00] hover:bg-orange-600 text-white font-bold shadow-lg transition"
                        >
                            Ver meus planos
                        </button>
                        <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">
                            Agora não
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CardOferta({ oferta, onBloqueado }) {
    const fotos = Array.isArray(oferta.fotos) ? oferta.fotos : [];
    const capa = fotos[0] || null;
    const temDesconto = oferta.tem_promocao && Number(oferta.valor_com_desconto) < Number(oferta.valor_original);
    const classes = "relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg hover:border-orange-200 transition";

    const conteudo = (
        <>
            <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                {capa ? (
                    <img src={capa} alt={oferta.nome} className={`w-full h-full object-cover transition ${oferta.bloqueado ? 'blur-sm scale-105' : 'group-hover:scale-105'}`} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageOff className="w-10 h-10" />
                    </div>
                )}

                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {oferta.somente_premium && (
                        <span className="inline-flex items-center gap-1 bg-[#FF5A00] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Crown className="w-3 h-3" /> Premium
                        </span>
                    )}
                    {temDesconto && (
                        <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Tag className="w-3 h-3" /> Desconto
                        </span>
                    )}
                    {oferta.aceita_pontos && (
                        <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Coins className="w-3 h-3" /> Pontos
                        </span>
                    )}
                </div>

                {oferta.bloqueado && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
                        <Lock className="w-7 h-7 mb-2" />
                        <span className="text-xs font-black uppercase tracking-wider">Exclusivo Premium</span>
                        <span className="text-[10px] text-white/80 mt-1">Toque para assinar</span>
                    </div>
                )}
            </div>

            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <Store className="w-3.5 h-3.5" />
                    {oferta.estabelecimento?.name || 'Estabelecimento'}
                </div>
                <h3 className="font-black text-gray-900 text-base leading-tight mb-1 line-clamp-2">{oferta.nome}</h3>
                {oferta.descricao && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{oferta.descricao}</p>
                )}

                <div className="mt-auto flex items-end justify-between pt-2">
                    <div>
                        {temDesconto && !oferta.bloqueado && (
                            <span className="block text-xs text-gray-400 line-through">R$ {formatarMoeda(oferta.valor_original)}</span>
                        )}
                        <span className="text-xl font-black text-[#FF5A00]">
                            R$ {formatarMoeda(oferta.bloqueado ? oferta.valor_original : oferta.valor_com_desconto)}
                        </span>
                    </div>
                    {oferta.maximo_pontos_permitidos > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 text-right">
                            até {oferta.maximo_pontos_permitidos} pts<br/>de desconto
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    if (oferta.bloqueado) {
        return (
            <button type="button" onClick={() => onBloqueado(oferta)} className={`${classes} text-left w-full`}>
                {conteudo}
            </button>
        );
    }

    return (
        <Link href={oferta.url} className={classes}>
            {conteudo}
        </Link>
    );
}

function Secao({ titulo, itens, onBloqueado }) {
    if (!itens || itens.length === 0) return null;
    return (
        <div className="mb-12">
            <h2 className="text-lg font-black text-gray-900 mb-5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF5A00]" /> {titulo}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {itens.map(oferta => (
                    <CardOferta key={`${oferta.tipo}-${oferta.id}`} oferta={oferta} onBloqueado={onBloqueado} />
                ))}
            </div>
        </div>
    );
}

export default function OfertasPremium({
    auth,
    isPremium,
    isPremiumPlus,
    planoAtual,
    servicos = [],
    itensAluguel = [],
    produtos = [],
    filtros = {},
}) {
    const totalOfertas = servicos.length + itensAluguel.length + produtos.length;
    const temFiltroAtivo = !!(filtros.busca || filtros.categoria || filtros.cidade);

    const [busca, setBusca] = useState(filtros.busca || '');
    const [categoria, setCategoria] = useState(filtros.categoria || '');
    const [cidade, setCidade] = useState(filtros.cidade || '');
    const [buscando, setBuscando] = useState(false);
    const [ofertaBloqueada, setOfertaBloqueada] = useState(null);

    const aplicarFiltros = (novosFiltros = {}) => {
        setBuscando(true);
        router.get(route('cliente.ofertas_premium'), {
            busca: novosFiltros.busca ?? busca,
            categoria: novosFiltros.categoria ?? categoria,
            cidade: novosFiltros.cidade ?? cidade,
        }, {
            preserveState: true,
            preserveScroll: true,
            only: ['servicos', 'itensAluguel', 'produtos', 'filtros'],
            onFinish: () => setBuscando(false),
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        aplicarFiltros();
    };

    const limparFiltros = () => {
        setBusca('');
        setCategoria('');
        setCidade('');
        aplicarFiltros({ busca: '', categoria: '', cidade: '' });
    };

    const produtosBloqueados = produtos.some(p => p.bloqueado);

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Ofertas Premium" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-orange-50 text-[#FF5A00] px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3">
                        <Crown className="w-4 h-4" /> Ofertas Premium
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Explore descontos exclusivos</h1>
                    <p className="text-gray-500 mt-2 max-w-2xl">
                        Serviços, reservas e produtos com condições especiais para assinantes Premium, além de promoções abertas a todos os clientes. Toque em qualquer oferta para ver os detalhes e agendar ou comprar.
                    </p>
                </div>

                {/* BUSCA: nome, categoria e cidade/endereço */}
                <form onSubmit={handleSubmit} className="mb-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            placeholder="Buscar por nome..."
                            className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
                        />
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <Tags className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={categoria}
                            onChange={e => setCategoria(e.target.value)}
                            placeholder="Categoria (ex: beleza, carro...)"
                            className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
                        />
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={cidade}
                            onChange={e => setCidade(e.target.value)}
                            placeholder="Cidade / endereço"
                            className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
                        />
                    </div>
                    <div className="flex gap-2">
                        {temFiltroAtivo && (
                            <button type="button" onClick={limparFiltros} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition flex items-center gap-1.5 text-sm font-bold">
                                <X className="w-4 h-4" /> Limpar
                            </button>
                        )}
                        <button type="submit" disabled={buscando} className="px-6 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-orange-600 text-white font-bold text-sm shadow-lg transition disabled:opacity-60 whitespace-nowrap">
                            {buscando ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>
                </form>

                {!isPremium && (
                    <div className="mb-10 bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-[#FF5A00]/20 p-3 rounded-2xl">
                                <Lock className="w-6 h-6 text-[#FF5A00]" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg">Desbloqueie as ofertas exclusivas</h3>
                                <p className="text-sm text-gray-300 mt-1 max-w-md">
                                    Assine o plano Premium e libere na hora os descontos e itens marcados com o selo <strong className="text-[#FF5A00]">Premium</strong> nesta página.
                                </p>
                            </div>
                        </div>
                        <Link href={route('assinatura.status')} className="shrink-0 px-6 py-3 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg transition whitespace-nowrap">
                            Assinar Premium
                        </Link>
                    </div>
                )}

                {isPremium && !isPremiumPlus && produtosBloqueados && (
                    <div className="mb-10 bg-gradient-to-r from-orange-50 to-orange-100/60 border border-orange-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-white p-3 rounded-2xl shadow-sm">
                                <Crown className="w-6 h-6 text-[#FF5A00]" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-gray-900">Alguns produtos exigem o plano superior</h3>
                                <p className="text-sm text-gray-600 mt-1 max-w-md">
                                    No plano <strong>{planoAtual}</strong> você já vê serviços e reservas exclusivas. Produtos marcados como Premium ficam liberados apenas no plano mais completo.
                                </p>
                            </div>
                        </div>
                        <Link href={route('assinatura.status')} className="shrink-0 px-6 py-3 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg transition whitespace-nowrap">
                            Fazer upgrade
                        </Link>
                    </div>
                )}

                {isPremiumPlus && planoAtual && (
                    <div className="mb-10 bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl px-5 py-3 text-sm font-bold flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Você está no plano {planoAtual} — todas as ofertas exclusivas, inclusive produtos, já estão liberadas para você.
                    </div>
                )}

                {totalOfertas === 0 ? (
                    <div className="text-center py-24 text-gray-400">
                        <Sparkles className="w-10 h-10 mx-auto mb-3" />
                        <p className="font-bold">
                            {temFiltroAtivo ? 'Nenhuma oferta encontrada para essa busca.' : 'Nenhuma oferta exclusiva disponível no momento.'}
                        </p>
                        <p className="text-sm">{temFiltroAtivo ? 'Tente outro termo, categoria ou cidade.' : 'Volte em breve para conferir novidades.'}</p>
                    </div>
                ) : (
                    <>
                        <Secao titulo="Serviços em Destaque" itens={servicos} onBloqueado={setOfertaBloqueada} />
                        <Secao titulo="Reservas e Locações" itens={itensAluguel} onBloqueado={setOfertaBloqueada} />
                        <Secao titulo="Produtos" itens={produtos} onBloqueado={setOfertaBloqueada} />
                    </>
                )}
            </div>

            {ofertaBloqueada && (
                <ModalPlanoBloqueado oferta={ofertaBloqueada} planoAtual={planoAtual} onClose={() => setOfertaBloqueada(null)} />
            )}
        </AuthenticatedLayout>
    );
}
