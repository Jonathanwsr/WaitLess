import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ClockIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { ArrowLeftIcon, ArrowsPointingOutIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

export default function FilaPainel({ estabelecimento, locais = [] }) {
    const voltar = () => (window.history.length > 1 ? window.history.back() : router.visit(route('dashboard')));
    const trocarLocal = (id) => router.visit(route('estabelecimentos.fila.painel', id));
    const telaCheia = () => Promise.resolve(document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch(() => {});

    const [atual, setAtual] = useState(null);
    const [proximos, setProximos] = useState([]);
    const [hora, setHora] = useState(new Date());
    const [carregado, setCarregado] = useState(false);

    const buscarDados = async () => {
        try {
            const res = await fetch(route('estabelecimentos.fila.painel.dados', estabelecimento.id), {
                headers: { Accept: 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                setAtual(data.atual);
                setProximos(data.proximos || []);
            }
        } catch (e) {
            // tela de TV: nunca derruba a tela por uma falha de rede passageira
        } finally {
            setCarregado(true);
        }
    };

    useEffect(() => {
        buscarDados();
        const intervalo = setInterval(buscarDados, 10000);
        return () => clearInterval(intervalo);
    }, []);

    useEffect(() => {
        const relogio = setInterval(() => setHora(new Date()), 1000);
        return () => clearInterval(relogio);
    }, []);

    return (
        <div className="min-h-screen bg-[#111111] text-white flex flex-col">
            <Head title={`Fila - ${estabelecimento.nome}`} />

            {/* Controles: voltar, trocar o local exibido e tela cheia. Discretos para não poluir a TV. */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-10 pt-4 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button type="button" onClick={voltar} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-bold">
                    <ArrowLeftIcon className="w-4 h-4" /> Voltar
                </button>
                <div className="flex items-center gap-2">
                    {locais.length > 1 && (
                        <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 pl-3 text-sm font-bold">
                            <BuildingStorefrontIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Local exibido:</span>
                            <select
                                value={estabelecimento.id}
                                onChange={(e) => trocarLocal(e.target.value)}
                                className="bg-transparent border-0 text-white text-sm font-bold focus:ring-0 pr-8 py-2"
                            >
                                {locais.map((l) => <option key={l.id} value={l.id} className="text-gray-900">{l.nome}</option>)}
                            </select>
                        </label>
                    )}
                    <button type="button" onClick={telaCheia} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-bold">
                        <ArrowsPointingOutIcon className="w-4 h-4" /> Tela cheia
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between px-10 py-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                    {estabelecimento.foto_perfil && (
                        <img src={estabelecimento.foto_perfil} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                    )}
                    <h1 className="text-3xl font-black tracking-tight">{estabelecimento.nome}</h1>
                </div>
                <div className="flex items-center gap-3 text-2xl font-bold text-white/70">
                    <ClockIcon className="w-7 h-7" />
                    {hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 p-10">
                {/* AGORA ATENDENDO */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center bg-gradient-to-br from-[#FF5A00] to-[#C74B27] rounded-[2.5rem] p-12 text-center shadow-2xl">
                    <div className="flex items-center gap-2 text-white/80 font-black uppercase tracking-[0.3em] text-sm mb-6">
                        <SparklesIcon className="w-5 h-5" /> Agora Atendendo
                    </div>
                    {atual ? (
                        <>
                            <p className="text-6xl sm:text-7xl font-black tracking-tight mb-4">{atual.usuario?.name}</p>
                            <p className="text-2xl font-bold text-white/85">{atual.servico?.nome}</p>
                            {atual.funcionario?.nome && (
                                <p className="text-lg font-semibold text-white/60 mt-3">com {atual.funcionario.nome}</p>
                            )}
                        </>
                    ) : (
                        <p className="text-3xl font-bold text-white/60">
                            {carregado ? 'Nenhum atendimento em andamento' : 'Carregando...'}
                        </p>
                    )}
                </div>

                {/* PRÓXIMOS */}
                <div className="lg:col-span-2 bg-white/5 rounded-[2.5rem] p-8 flex flex-col">
                    <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-6">Próximos</h2>
                    {proximos.length === 0 ? (
                        <p className="text-white/40 font-semibold text-lg">Nenhum cliente aguardando.</p>
                    ) : (
                        <div className="space-y-3 overflow-y-auto">
                            {proximos.map((item, i) => (
                                <div key={item.id} className="flex items-center gap-4 bg-white/5 rounded-2xl px-5 py-4">
                                    <div className="w-9 h-9 rounded-full bg-[#FF5A00] flex items-center justify-center font-black text-sm flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-lg truncate">{item.usuario?.name}</p>
                                        <p className="text-sm text-white/50 truncate flex items-center gap-1">
                                            <UserIcon className="w-3.5 h-3.5" /> {item.servico?.nome} · {item.hora_agendamento?.slice(0, 5)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center pb-6 text-xs font-bold text-white/30 uppercase tracking-widest">
                Lokyva · Painel de Fila
            </div>
        </div>
    );
}
