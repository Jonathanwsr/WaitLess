import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { PlusIcon, MapPinIcon, UsersIcon, CalendarDaysIcon, SparklesIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import { Aviso, erroDe, fmtDia } from '@/Components/Viagem/util';

export default function Index({ viagens, premium }) {
    const [aviso, setAviso] = useState(null);
    const convites = viagens.filter((v) => v.minha_presenca === 'pendente');
    const lista = viagens.filter((v) => v.minha_presenca !== 'pendente');

    const responder = async (v, status) => {
        try {
            await axios.post(route('viagens.presenca', v.id), { status });
            router.reload({ only: ['viagens'] });
        } catch (e) { setAviso({ tipo: 'erro', texto: erroDe(e) }); }
    };

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">Minhas viagens</h2>}>
            <Head title="Minhas viagens" />
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-gray-500">Roteiros, reservas e gastos do grupo em um só lugar.</p>
                    <Link href={route('viagens.nova')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] text-white font-black transition">
                        {premium ? <PlusIcon className="w-5 h-5" /> : <LockClosedIcon className="w-4 h-4" />} Nova viagem
                    </Link>
                </div>

                <Aviso aviso={aviso} onFechar={() => setAviso(null)} />

                {convites.length > 0 && (
                    <section className="space-y-3">
                        <h3 className="font-black text-gray-900">Convites para você</h3>
                        {convites.map((v) => (
                            <div key={v.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-black text-gray-900">{v.titulo}</p>
                                    <p className="text-sm text-gray-600">{v.destino} · {fmtDia(v.data_inicio)} a {fmtDia(v.data_fim)} · {v.membros.join(', ')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => responder(v, 'confirmado')} className="px-4 py-2 rounded-xl bg-[#FF5A00] text-white text-sm font-black">Confirmar presença</button>
                                    <button onClick={() => responder(v, 'recusado')} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">Não vou</button>
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {lista.length === 0 && convites.length === 0 && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
                        <SparklesIcon className="w-12 h-12 text-[#FF5A00] mx-auto mb-3" />
                        <h3 className="text-xl font-black text-gray-900">Nenhuma viagem por aqui ainda</h3>
                        <p className="text-gray-500 mt-1 mb-5">Diga a cidade, as datas e o orçamento — o Lokyva monta o roteiro para o seu grupo.</p>
                        <Link href={route('viagens.nova')} className="inline-block px-6 py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] text-white font-black transition">Montar meu primeiro roteiro</Link>
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                    {lista.map((v) => (
                        <Link key={v.id} href={route('viagens.show', v.id)} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#FF5A00]/30 transition block">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-black text-gray-900 text-lg leading-snug">{v.titulo}</h3>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize shrink-0">{v.status}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5"><MapPinIcon className="w-4 h-4" /> {v.destino}</p>
                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><CalendarDaysIcon className="w-4 h-4" /> {fmtDia(v.data_inicio)} a {fmtDia(v.data_fim)}</p>
                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><UsersIcon className="w-4 h-4" /> {v.membros.length} {v.membros.length === 1 ? 'pessoa' : 'pessoas'} · {v.itens} itens na agenda</p>
                        </Link>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
