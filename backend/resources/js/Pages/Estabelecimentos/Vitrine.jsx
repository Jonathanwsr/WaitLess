import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Eye, MapPin, Star, ImageOff, Tag, Clock, Lock, Store, Briefcase, KeyRound, ShoppingBag, Ticket } from 'lucide-react';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function SeloVagas({ status, restantes }) {
    if (!status) return null;
    return (
        <span className={`absolute top-3 left-3 z-10 text-xs font-bold px-3 py-1.5 rounded-xl shadow ${status === 'esgotado' ? 'bg-red-600 text-white' : 'bg-amber-400 text-zinc-900'}`}>
            {status === 'esgotado' ? 'Esgotado hoje' : `Últimas vagas hoje (${restantes})`}
        </span>
    );
}

function Foto({ src, alt }) {
    return src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
    ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-100"><ImageOff className="w-10 h-10 text-zinc-300" /></div>
    );
}

export default function Vitrine({ auth, vitrine, divulgacao = null }) {
    const [aba, setAba] = useState('servicos');
    const [copiado, setCopiado] = useState(false);

    const copiarLink = async () => {
        try {
            await navigator.clipboard.writeText(divulgacao.link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            window.prompt('Copie o link:', divulgacao.link);
        }
    };

    if (!vitrine) {
        return (
            <AuthenticatedLayout user={auth?.user}>
                <Head title="Minha vitrine" />
                <div className="max-w-2xl mx-auto px-4 py-20 text-center">
                    <Store className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-gray-900">Você ainda não tem um local</h1>
                    <p className="text-gray-500 mt-2">Cadastre seu primeiro local para ver como a vitrine aparece para os clientes.</p>
                    <Link href={route('estabelecimentos.create')} className="mt-6 inline-flex px-6 py-3 rounded-xl bg-[#006837] text-white font-bold">Novo local</Link>
                </div>
            </AuthenticatedLayout>
        );
    }

    const { estabelecimento: est, locais, servicos, reservas, produtos, cupons, avaliacoes } = vitrine;
    const abas = [
        { id: 'servicos', rotulo: 'Serviços', qtd: servicos.length, icone: Briefcase },
        { id: 'reservas', rotulo: 'Reservas', qtd: reservas.length, icone: KeyRound },
        { id: 'produtos', rotulo: 'Produtos', qtd: produtos.length, icone: ShoppingBag },
        { id: 'cupons', rotulo: 'Cupons', qtd: cupons.length, icone: Ticket },
    ];

    const local = [est.bairro, est.cidade, est.estado].filter(Boolean).join(', ');

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Minha vitrine" />

            <div className="bg-zinc-50 min-h-screen pb-20">
                <div className="bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 flex flex-wrap items-center justify-center gap-3">
                    <span className="inline-flex items-center gap-2"><Eye className="w-4 h-4" /> Prévia: é assim que seus clientes veem o seu local</span>
                    {locais.length > 1 && (
                        <select
                            value={est.id}
                            onChange={(e) => router.get(route('vitrine.dono'), { estabelecimento_id: e.target.value })}
                            className="bg-white/10 border border-white/20 rounded-lg text-sm py-1 pl-3 pr-8 text-white"
                        >
                            {locais.map((l) => <option key={l.id} value={l.id} className="text-gray-900">{l.nome}</option>)}
                        </select>
                    )}
                </div>

                {divulgacao && (
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                        <div className="bg-white rounded-3xl shadow-sm border border-orange-100 p-4 sm:p-5 flex flex-wrap items-center gap-4">
                            <img src={divulgacao.qr_url} alt="QR Code do seu local" className="w-24 h-24 rounded-xl border border-gray-100" />
                            <div className="flex-1 min-w-[220px]">
                                <p className="font-black text-gray-900">Divulgue seu local e traga clientes</p>
                                <p className="text-sm text-gray-500 mt-0.5">Compartilhe este link no Instagram e no WhatsApp ou imprima o QR Code para o balcão. O cliente agenda sem ligar.</p>
                                <p className="text-xs text-gray-400 mt-2 truncate">{divulgacao.link}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={copiarLink} className="px-4 py-2.5 rounded-full bg-[#FF5A00] hover:bg-orange-600 text-white text-sm font-bold transition">{copiado ? 'Link copiado!' : 'Copiar link'}</button>
                                <a href={`https://wa.me/?text=${encodeURIComponent(divulgacao.mensagem)}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition">WhatsApp</a>
                                <a href={divulgacao.qr_url} download="qrcode-agendamento.png" className="px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition">Baixar QR</a>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative h-48 sm:h-64 rounded-b-3xl overflow-hidden bg-zinc-200">
                        <Foto src={est.foto_banner || est.foto_perfil} alt={est.nome} />
                    </div>

                    <div className="-mt-10 relative flex items-end gap-4 px-2">
                        <div className="w-24 h-24 rounded-3xl border-4 border-white bg-white overflow-hidden shadow-lg shrink-0"><Foto src={est.foto_perfil} alt={est.nome} /></div>
                        <div className="pb-2 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">{est.nome}</h1>
                            <p className="text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
                                {est.ramo_atuacao && <span className="font-semibold">{est.ramo_atuacao}</span>}
                                {local && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {local}</span>}
                                {avaliacoes.total > 0 && <span className="inline-flex items-center gap-1 font-bold text-gray-800"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {String(avaliacoes.media).replace('.', ',')} ({avaliacoes.total})</span>}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
                        {abas.map(({ id, rotulo, qtd, icone: Icone }) => (
                            <button key={id} onClick={() => setAba(id)} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap border transition ${aba === id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                <Icone className="w-4 h-4" /> {rotulo} <span className={`text-xs px-1.5 rounded-full ${aba === id ? 'bg-white/20' : 'bg-gray-100'}`}>{qtd}</span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-6">
                        {aba === 'servicos' && (
                            servicos.length === 0 ? <Vazio texto="Nenhum serviço ativo. Cadastre serviços nas configurações do local." /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {servicos.map((sv) => (
                                        <div key={sv.id} className="bg-white rounded-3xl overflow-hidden border border-zinc-100 shadow-sm">
                                            <div className="relative h-44 bg-zinc-100">
                                                <Foto src={sv.foto} alt={sv.nome} />
                                                <SeloVagas status={sv.vagas_status} restantes={sv.vagas_restantes} />
                                                {sv.somente_premium && <span className="absolute top-3 right-3 bg-black/80 text-yellow-400 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><Lock className="w-3 h-3" /> PREMIUM</span>}
                                            </div>
                                            <div className="p-5">
                                                <h3 className="font-bold text-lg text-gray-900 leading-tight">{sv.nome}</h3>
                                                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {sv.duracao_minutos} min</p>
                                                <div className="mt-4 flex items-end justify-between">
                                                    <div>
                                                        {sv.em_promocao && <p className="text-xs text-gray-400 line-through">{brl(sv.valor)}</p>}
                                                        <p className="text-2xl font-black text-gray-900">{brl(sv.preco_final)}</p>
                                                    </div>
                                                    {sv.em_promocao && <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1"><Tag className="w-3 h-3" /> PROMO</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {aba === 'reservas' && (
                            reservas.length === 0 ? <Vazio texto="Nenhuma reserva (locação) ativa. Cadastre em Locações Avulsas." /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {reservas.map((r) => (
                                        <Link key={r.id} href={route('itens.detalhes', r.id)} className="bg-white rounded-3xl overflow-hidden border border-zinc-100 shadow-sm hover:shadow-lg transition block">
                                            <div className="relative h-44 bg-zinc-100">
                                                <Foto src={r.foto} alt={r.nome} />
                                                <SeloVagas status={r.vagas_status} restantes={r.vagas_restantes} />
                                            </div>
                                            <div className="p-5">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{String(r.categoria || '').replace(/_/g, ' ')}</p>
                                                <h3 className="font-bold text-lg text-gray-900 leading-tight mt-1">{r.nome}</h3>
                                                <p className="text-sm text-gray-500 mt-1">{[r.cidade, r.estado].filter(Boolean).join(' - ')}{r.capacidade_pessoas ? ` · até ${r.capacidade_pessoas} pessoas` : ''}</p>
                                                <div className="mt-4 flex items-end justify-between">
                                                    <div>
                                                        {r.em_promocao && <p className="text-xs text-gray-400 line-through">{brl(r.valor_diaria)}</p>}
                                                        <p className="text-2xl font-black text-gray-900">{brl(r.preco_final)}<span className="text-sm font-semibold text-gray-400"> / dia</span></p>
                                                    </div>
                                                    {r.em_promocao && <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg">PROMO</span>}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )
                        )}

                        {aba === 'produtos' && (
                            produtos.length === 0 ? <Vazio texto="Nenhum produto vinculado a serviços ou reservas com estoque." /> : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                    {produtos.map((p) => (
                                        <div key={p.id} className="bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm">
                                            <div className="h-36 bg-zinc-100"><Foto src={p.foto} alt={p.nome} /></div>
                                            <div className="p-4">
                                                <h3 className="font-bold text-gray-900 text-sm leading-tight">{p.nome}</h3>
                                                <p className="text-lg font-black text-gray-900 mt-2">{brl(p.valor_final)}</p>
                                                {p.somente_premium && <p className="text-[10px] font-bold text-amber-600 mt-1">Exclusivo Premium</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {aba === 'cupons' && (
                            cupons.length === 0 ? <Vazio texto="Nenhum cupom ativo. Crie cupons em Cupons e marketing." /> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {cupons.map((c) => (
                                        <div key={c.id} className="bg-white rounded-2xl border border-dashed border-emerald-300 p-5 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{c.titulo}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {c.tipo_desconto === 'percentual' ? `${c.valor_desconto}% de desconto` : `${brl(c.valor_desconto)} de desconto`}
                                                    {c.alvo ? ` · só em ${c.alvo}` : ' · em todo o local'}
                                                    {c.apenas_plus ? ' · Premium' : ''}
                                                </p>
                                            </div>
                                            <span className="font-mono text-sm font-black bg-gray-900 text-white px-3 py-1.5 rounded-lg tracking-widest shrink-0">{c.codigo}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    {avaliacoes.previa.length > 0 && (
                        <div className="mt-12">
                            <h2 className="text-xl font-black text-gray-900 mb-4">O que os clientes dizem</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {avaliacoes.previa.map((a, i) => (
                                    <div key={i} className="bg-white rounded-2xl border border-zinc-100 p-5">
                                        <div className="flex items-center justify-between"><span className="font-bold text-gray-900 text-sm">{a.autor}</span><span className="text-sm font-bold text-amber-500">★ {String(a.nota).replace('.', ',')}</span></div>
                                        <p className="text-xs text-gray-400 capitalize">{a.data}</p>
                                        {a.comentario && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{a.comentario}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Vazio({ texto }) {
    return <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center text-gray-500">{texto}</div>;
}
