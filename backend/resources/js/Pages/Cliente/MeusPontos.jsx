import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    SparklesIcon, ArrowTrendingUpIcon, ArrowDownLeftIcon, ArrowUpRightIcon, BuildingStorefrontIcon,
    CalendarDaysIcon, StarIcon, ShoppingBagIcon, GiftIcon, CheckCircleIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const pts = (v) => Number(v || 0).toLocaleString('pt-BR');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const COMO_GANHAR = [
    { icone: CalendarDaysIcon, titulo: 'Agende e reserve', texto: 'Cada serviço ou reserva concluída rende pontos.' },
    { icone: ShoppingBagIcon, titulo: 'Compre produtos', texto: 'Pedidos entregues rendem pontos conforme o valor e o seu plano.' },
    { icone: StarIcon, titulo: 'Avalie', texto: 'Avaliar uma compra entregue rende pontos extras.' },
    { icone: GiftIcon, titulo: 'Promoções', texto: 'Campanhas e o plano premium dão pontos de bônus.' },
];

export default function MeusPontos({ saldo = 0, valorEmReais = 0, pontosPorReal = 1000, ganhosNoMes = 0, historico = [], porLocal = [], premium = {} }) {
    const { auth } = usePage().props;
    const [filtro, setFiltro] = useState('todos');

    const lista = useMemo(() => historico.filter((h) => filtro === 'todos' || (filtro === 'entradas' ? h.entrada : !h.entrada)), [historico, filtro]);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Meus pontos" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* SALDO */}
                <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-900 via-zinc-800 to-[#FF5A00] text-white p-7 sm:p-9 shadow-xl">
                    <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
                    <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-white/15 px-3 py-1.5 rounded-full">
                                <SparklesIcon className="w-4 h-4" /> Meus pontos
                            </p>
                            <p className="text-5xl sm:text-6xl font-black tracking-tight mt-4">{pts(saldo)}</p>
                            <p className="text-white/80 mt-1">valem <b className="text-white">{brl(valorEmReais)}</b> de desconto · {pts(pontosPorReal)} pontos = R$ 1,00</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 flex items-center gap-1"><ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Ganhos no mês</p>
                                <p className="text-xl font-black mt-0.5">+{pts(ganhosNoMes)}</p>
                            </div>
                            <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Plano</p>
                                <p className="text-xl font-black mt-0.5">{premium.ativo ? 'Premium' : 'Gratuito'}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ONDE USAR */}
                <section className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-white border border-zinc-100 p-5 shadow-sm">
                        <h2 className="font-black text-zinc-900">Onde usar seus pontos</h2>
                        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                            <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" /> Em serviços e reservas marcados com “Aceita pontos”, na hora de pagar.</li>
                            <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" /> Para trocar por cupons e recompensas na sua carteira.</li>
                            <li className={`flex gap-2 ${premium.ativo ? '' : 'text-zinc-400'}`}>
                                {premium.ativo ? <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" /> : <LockClosedIcon className="w-5 h-5 shrink-0" />}
                                <span><b>Premium:</b> use quantos pontos quiser em qualquer serviço ou reserva, mesmo onde o local não aceita pontos.</span>
                            </li>
                        </ul>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {route().has('cliente.carteira') && (
                                <Link href={route('cliente.carteira')} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-bold">Trocar por recompensas</Link>
                            )}
                            {!premium.ativo && route().has('assinatura.status') && (
                                <Link href={route('assinatura.status')} className="px-4 py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-bold">Conhecer o premium</Link>
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white border border-zinc-100 p-5 shadow-sm">
                        <h2 className="font-black text-zinc-900">Como ganhar mais</h2>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {COMO_GANHAR.map((c) => (
                                <div key={c.titulo} className="rounded-2xl bg-zinc-50 p-3">
                                    <c.icone className="w-5 h-5 text-[#FF5A00]" />
                                    <p className="text-sm font-bold text-zinc-900 mt-2">{c.titulo}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{c.texto}</p>
                                </div>
                            ))}
                        </div>
                        {premium.ativo && (
                            <p className="mt-3 text-xs font-semibold text-emerald-700">Seu plano premium rende mais pontos em cada compra.</p>
                        )}
                    </div>
                </section>

                {/* PONTOS POR LOCAL */}
                {porLocal.length > 0 && (
                    <section>
                        <h2 className="font-black text-zinc-900 mb-3">Pontos por local</h2>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                            {porLocal.map((l) => (
                                <div key={l.id} className="min-w-[180px] rounded-3xl bg-white border border-zinc-100 p-4 shadow-sm">
                                    {l.foto_perfil ? (
                                        <img src={l.foto_perfil} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><BuildingStorefrontIcon className="w-5 h-5 text-[#FF5A00]" /></div>
                                    )}
                                    <p className="text-sm font-bold text-zinc-900 mt-3 truncate">{l.nome}</p>
                                    <p className="text-lg font-black text-[#FF5A00]">{pts(l.total_pontos)} pts</p>
                                    {l.nivel && <p className="text-[11px] font-bold uppercase text-zinc-400">Nível {l.nivel}</p>}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* HISTÓRICO */}
                <section className="rounded-3xl bg-white border border-zinc-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100">
                        <h2 className="font-black text-zinc-900">Histórico</h2>
                        <div className="flex bg-zinc-100 rounded-xl p-1">
                            {[{ id: 'todos', r: 'Tudo' }, { id: 'entradas', r: 'Ganhos' }, { id: 'saidas', r: 'Usados' }].map((f) => (
                                <button key={f.id} onClick={() => setFiltro(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filtro === f.id ? 'bg-white text-zinc-900 shadow' : 'text-zinc-500'}`}>{f.r}</button>
                            ))}
                        </div>
                    </div>
                    {lista.length === 0 ? (
                        <p className="text-center text-sm text-zinc-400 py-14">Nenhuma movimentação ainda. Seus pontos aparecem aqui assim que você ganhar ou usar.</p>
                    ) : (
                        <ul className="divide-y divide-zinc-100">
                            {lista.map((h) => (
                                <li key={h.id} className="flex items-center gap-3 px-5 py-3.5">
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${h.entrada ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                        {h.entrada ? <ArrowDownLeftIcon className="w-5 h-5" /> : <ArrowUpRightIcon className="w-5 h-5" />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-zinc-900 truncate">{h.descricao || (h.entrada ? 'Pontos ganhos' : 'Pontos usados')}</p>
                                        <p className="text-xs text-zinc-500">{dataHora(h.data)}{h.local ? ` · ${h.local}` : ''}</p>
                                    </div>
                                    <span className={`text-sm font-black whitespace-nowrap ${h.entrada ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {h.entrada ? '+' : '−'}{pts(Math.abs(h.quantidade))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
