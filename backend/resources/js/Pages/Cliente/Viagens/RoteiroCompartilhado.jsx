import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { MapPinIcon, CalendarDaysIcon, UsersIcon, DocumentArrowDownIcon, MapIcon, ChevronDownIcon, EyeIcon } from '@heroicons/react/24/solid';
import LinhaDoTempo from '@/Components/Viagem/Roteiro/LinhaDoTempo';
import MapaRoteiro from '@/Components/Viagem/Roteiro/MapaRoteiro';
import { fmt, fmtDia, fmtDiaLongo } from '@/Components/Viagem/Roteiro/comum';
import { PERIODOS_ORDEM } from '@/Components/Viagem/Roteiro/calculo';

/** Roteiro aberto pelo link compartilhado: somente leitura, sem login. */
export default function RoteiroCompartilhado({ dados, token }) {
    const { roteiro, dias, resumo } = dados;
    const [diaAtivo, setDiaAtivo] = useState(0);
    const [mapaAberto, setMapaAberto] = useState(false);
    const dia = dias[diaAtivo];
    const pontos = useMemo(() => PERIODOS_ORDEM.flatMap((p) => dia.periodos[p]).filter((i) => i.numero), [dia]);

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased">
            <Head title={`${roteiro.titulo} · Roteiro`} />
            <header className="bg-gray-900 text-white">
                <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
                    <a href="/" className="inline-block text-2xl font-black text-[#FF7A00]">Lokyva<span className="text-white">.</span></a>
                    <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80"><EyeIcon className="h-3.5 w-3.5" /> Roteiro compartilhado · somente leitura</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{roteiro.titulo}</h1>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><MapPinIcon className="h-3.5 w-3.5" /> {roteiro.destino}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {fmtDia(roteiro.data_inicio)} – {fmtDia(roteiro.data_fim)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><UsersIcon className="h-3.5 w-3.5" /> {roteiro.pessoas} {roteiro.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Custo estimado</p>
                            <p className="text-3xl font-black">{fmt(resumo.total)}</p>
                            <p className="text-xs text-white/70">{fmt(resumo.por_pessoa)} por pessoa</p>
                        </div>
                        <a href={route('roteiro.compartilhado.pdf', token)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#FF7A00] px-5 font-black text-white"><DocumentArrowDownIcon className="h-5 w-5" /> Baixar PDF</a>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Dias do roteiro">
                    {dias.map((d, i) => (
                        <button key={d.numero} type="button" role="tab" aria-selected={diaAtivo === i} onClick={() => setDiaAtivo(i)}
                            className={`min-h-[56px] shrink-0 rounded-2xl px-4 text-left ${diaAtivo === i ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>
                            <span className="block text-xs font-black">Dia {d.numero}</span>
                            <span className={`block text-[11px] capitalize ${diaAtivo === i ? 'text-white/70' : 'text-gray-500'}`}>{fmtDia(d.data, { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                        </button>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-black capitalize text-gray-900">{fmtDiaLongo(dia.data)}</h2>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-gray-700 ring-1 ring-gray-200">{fmt(dia.custo)} no dia</span>
                        </div>
                        <div className="lg:hidden">
                            <button type="button" onClick={() => setMapaAberto((a) => !a)} aria-expanded={mapaAberto} className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white px-4 font-bold text-gray-800 ring-1 ring-gray-200">
                                <span className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-[#FF7A00]" /> Ver o dia no mapa</span>
                                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${mapaAberto ? 'rotate-180' : ''}`} />
                            </button>
                            {mapaAberto && <div className="mt-2"><MapaRoteiro pontos={pontos} centro={{ lat: roteiro.latitude, lng: roteiro.longitude }} altura="h-72" /></div>}
                        </div>
                        <LinhaDoTempo dia={dia} dias={dias} />
                    </div>
                    <aside className="hidden lg:block"><div className="sticky top-4"><MapaRoteiro pontos={pontos} centro={{ lat: roteiro.latitude, lng: roteiro.longitude }} altura="h-[520px]" /></div></aside>
                </div>

                <footer className="rounded-2xl bg-white p-4 text-xs text-gray-500 ring-1 ring-gray-100">
                    Valores estimados com os preços atuais do Lokyva. Descrições dos pontos turísticos: Wikipédia/Wikivoyage (CC BY-SA 4.0).
                    <a href="/register" className="ml-1 font-bold text-[#E8590C]">Crie a sua conta no Lokyva</a> para montar os seus roteiros.
                </footer>
            </main>
        </div>
    );
}
