import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, MapPinIcon, CalendarDaysIcon, UsersIcon, ShareIcon, ClockIcon, ArrowTopRightOnSquareIcon, MapIcon } from '@heroicons/react/24/solid';
import { AbasPlanejamento, fmt, fmtDia, pedirLocalizacao } from '@/Components/Viagem/Roteiro/comum';
import { distanciaKm, minutos } from '@/Components/Viagem/Roteiro/calculo';

export default function Roteiros({ roteiros = [], hoje = null }) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-black text-gray-800">Planejamento de viagem</h2>}>
            <Head title="Meus roteiros" />
            <div className="mx-auto max-w-6xl space-y-6 pb-16">
                <AbasPlanejamento ativa="roteiros" />

                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">Meus roteiros</h1>
                        <p className="text-sm text-gray-500">Pontos turísticos e locações do Lokyva, organizados dia a dia.</p>
                    </div>
                    <Link href={route('viagens.roteiros.novo')} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#FF7A00] px-5 font-black text-white shadow transition hover:bg-[#E8590C]">
                        <PlusIcon className="h-5 w-5" /> Novo roteiro
                    </Link>
                </div>

                {hoje && <CartaoHoje hoje={hoje} />}

                {roteiros.length === 0 ? (
                    <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50"><MapIcon className="h-8 w-8 text-[#FF7A00]" /></div>
                        <h3 className="mt-3 text-xl font-black text-gray-900">Nenhum roteiro ainda</h3>
                        <p className="mx-auto mt-1 max-w-md text-gray-500">Diga o destino e as datas: o Lokyva sugere o que ver, onde comer e onde ficar, dia a dia.</p>
                        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                            <Link href={route('viagens.roteiros.novo')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-gray-900 px-6 font-black text-white">Montar meu primeiro roteiro</Link>
                            <Link href={route('viagens.guia')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl px-6 font-bold text-gray-700 ring-1 ring-gray-200">Explorar o Guia do Local</Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {roteiros.map((r, i) => (
                            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                <Link href={route('viagens.roteiros.editar', r.id)} className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
                                    <div className="relative h-36 bg-gradient-to-br from-[#FF9A3D] to-[#7C2D12]">
                                        {r.capa && <img src={r.capa} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-105" />}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-3 left-4 right-4 text-white">
                                            <p className="flex items-center gap-1 text-xs font-bold text-white/85"><MapPinIcon className="h-3.5 w-3.5" /> {r.destino}{r.estado ? ` · ${r.estado}` : ''}</p>
                                            <h3 className="line-clamp-1 text-lg font-black">{r.titulo}</h3>
                                        </div>
                                        {r.compartilhado && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-gray-700"><ShareIcon className="h-3 w-3" /> Compartilhado</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 p-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1"><CalendarDaysIcon className="h-4 w-4 text-gray-400" /> {fmtDia(r.data_inicio)} – {fmtDia(r.data_fim)}</span>
                                        <span className="flex items-center gap-1"><UsersIcon className="h-4 w-4 text-gray-400" /> {r.pessoas}</span>
                                        <span>{r.dias} {r.dias === 1 ? 'dia' : 'dias'} · {r.itens} itens · {r.locacoes} no Lokyva</span>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

/** No dia da viagem: o próximo item do roteiro e, se o usuário permitir, a distância até ele. */
function CartaoHoje({ hoje }) {
    const [distancia, setDistancia] = useState(null);
    const [erro, setErro] = useState(null);
    const [explicar, setExplicar] = useState(false);
    const proximo = hoje.proximo;

    const medir = async () => {
        setExplicar(false);
        try {
            const p = await pedirLocalizacao();
            const km = distanciaKm(p, { lat: Number(proximo.latitude), lng: Number(proximo.longitude) });
            setDistancia(km);
        } catch (e) { setErro(e.message); }
    };

    const mapsUrl = proximo?.latitude ? `https://www.google.com/maps/dir/?api=1&destination=${proximo.latitude},${proximo.longitude}` : null;

    return (
        <section className="overflow-hidden rounded-3xl bg-gray-900 text-white shadow-lg">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-[#FF9A3D]">Hoje · Dia {hoje.dia?.numero} de {hoje.roteiro.titulo}</p>
                    {proximo ? (
                        <>
                            <p className="mt-1 text-sm text-white/70">Próximo da agenda{proximo.hora ? ` às ${proximo.hora}` : ''}</p>
                            <h2 className="text-2xl font-black">{proximo.titulo}</h2>
                            {proximo.aviso_horario && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-300"><ClockIcon className="h-4 w-4" /> {proximo.aviso_horario}</p>}
                            {distancia != null && <p className="mt-2 text-lg font-black text-emerald-300">Você está a {distancia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · cerca de {minutos(distancia)} min</p>}
                            {erro && <p className="mt-2 text-sm text-amber-300">{erro}</p>}
                            {explicar && (
                                <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm">
                                    <p>Usamos a sua localização só para calcular a distância agora. Ela não fica salva.</p>
                                    <div className="mt-2 flex gap-2">
                                        <button type="button" onClick={medir} className="min-h-[44px] rounded-xl bg-white px-4 font-black text-gray-900">Permitir</button>
                                        <button type="button" onClick={() => setExplicar(false)} className="min-h-[44px] rounded-xl px-4 font-bold text-white/80">Agora não</button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <h2 className="mt-1 text-xl font-black">Tudo feito por hoje. Bom descanso!</h2>
                    )}
                </div>
                <div className="flex flex-col gap-2 sm:w-56">
                    {proximo?.latitude && distancia == null && !explicar && (
                        <button type="button" onClick={() => setExplicar(true)} className="min-h-[48px] rounded-2xl bg-white/10 px-4 font-bold ring-1 ring-white/20 hover:bg-white/20">Ver distância até lá</button>
                    )}
                    {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-[#FF7A00] px-4 font-black">Como chegar <ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>}
                    <Link href={route('viagens.roteiros.editar', hoje.roteiro.id)} className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 text-sm font-bold text-white/80 hover:text-white">Ver o dia completo · {fmt(hoje.dia?.custo || 0)}</Link>
                </div>
            </div>
        </section>
    );
}
