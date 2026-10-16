import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
    SparklesIcon, MapPinIcon, CalendarDaysIcon, UsersIcon, BanknotesIcon, CheckIcon, ShareIcon, DocumentArrowDownIcon,
    ShoppingCartIcon, MapIcon, XMarkIcon, ExclamationTriangleIcon, MinusIcon, PlusIcon, DocumentDuplicateIcon, TrashIcon,
    BoltIcon, ChevronDownIcon, ArrowLeftIcon,
} from '@heroicons/react/24/solid';
import { AbasPlanejamento, CartaoLocacao, INTERESSES, PERIODOS, Skeleton, erroAmigavel, fmt, fmtDia, fmtDiaLongo, pedirLocalizacao } from '@/Components/Viagem/Roteiro/comum';
import LinhaDoTempo from '@/Components/Viagem/Roteiro/LinhaDoTempo';
import MapaRoteiro from '@/Components/Viagem/Roteiro/MapaRoteiro';
import { PERIODOS_ORDEM, comChaves, novaChave, paraSalvar, recalcular } from '@/Components/Viagem/Roteiro/calculo';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function RoteiroEditor({ inicial = null, destinoInicial = '' }) {
    const [roteiro, setRoteiro] = useState(inicial?.roteiro || null);
    const [dias, setDias] = useState(inicial ? comChaves(inicial.dias) : []);
    const [avisosServidor, setAvisosServidor] = useState(inicial?.avisos || []);
    const [sugestoesFlash, setSugestoesFlash] = useState([]);
    const [guia, setGuia] = useState(null);
    const [diaAtivo, setDiaAtivo] = useState(0);
    const [alterado, setAlterado] = useState(false);
    const [ocupado, setOcupado] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [mapaAberto, setMapaAberto] = useState(false);
    const [adicionar, setAdicionar] = useState(null); // { dia, periodo }
    const [pedido, setPedido] = useState(null);
    const [link, setLink] = useState(inicial?.roteiro?.link_compartilhamento || null);
    const [compartilharAberto, setCompartilharAberto] = useState(false);

    // Avisa antes de sair com alterações não salvas.
    useEffect(() => {
        const antes = (e) => { if (alterado) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', antes);
        return () => window.removeEventListener('beforeunload', antes);
    }, [alterado]);

    const calculado = useMemo(() => (roteiro ? recalcular(roteiro, dias) : null), [roteiro, dias]);
    const dia = calculado?.dias[diaAtivo];
    const pontosDoDia = useMemo(() => (dia ? PERIODOS_ORDEM.flatMap((p) => dia.periodos[p]).filter((i) => i.numero) : []), [dia]);

    const mensagem = (tipo, texto) => { setAviso({ tipo, texto }); window.clearTimeout(window.__avisoRoteiro); window.__avisoRoteiro = window.setTimeout(() => setAviso(null), 6000); };

    const aplicarTela = (tela) => {
        setRoteiro(tela.roteiro);
        setDias(comChaves(tela.dias));
        setAvisosServidor(tela.avisos || []);
        if (tela.sugestoes_flash) setSugestoesFlash(tela.sugestoes_flash);
        if (tela.guia !== undefined) setGuia(tela.guia);
        if (tela.roteiro?.link_compartilhamento !== undefined) setLink(tela.roteiro.link_compartilhamento);
    };

    const gerar = async (pedidoGeracao) => {
        setOcupado('gerar');
        try {
            const { data } = await axios.post(route('viagens.api.roteiros.gerar'), pedidoGeracao);
            aplicarTela(data);
            setDiaAtivo(0);
            setAlterado(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            mensagem('erro', erroAmigavel(e));
        } finally {
            setOcupado(null);
        }
    };

    /** Salva (cria ou atualiza). Devolve o id salvo. */
    const salvar = async (silencioso = false) => {
        setOcupado('salvar');
        try {
            const corpo = paraSalvar(roteiro, dias);
            const { data } = roteiro.id
                ? await axios.put(route('viagens.api.roteiros.update', roteiro.id), corpo)
                : await axios.post(route('viagens.api.roteiros.store'), corpo);
            aplicarTela(data);
            setAlterado(false);
            if (!roteiro.id) window.history.replaceState({}, '', route('viagens.roteiros.editar', data.roteiro.id));
            if (!silencioso) mensagem('ok', data.mensagem || 'Roteiro salvo.');
            return data.roteiro.id;
        } catch (e) {
            mensagem('erro', erroAmigavel(e));
            return null;
        } finally {
            setOcupado(null);
        }
    };

    const garantirSalvo = async () => (roteiro.id && !alterado ? roteiro.id : salvar(true));

    const reservarTudo = async () => {
        const id = await garantirSalvo();
        if (!id) return;
        setOcupado('reservar');
        try {
            const { data } = await axios.post(route('viagens.api.roteiros.reservar', id));
            setPedido({ ...data.pedido, mensagem: data.mensagem });
        } catch (e) {
            mensagem('erro', erroAmigavel(e));
        } finally {
            setOcupado(null);
        }
    };

    const compartilhar = async () => {
        const id = await garantirSalvo();
        if (!id) return;
        setOcupado('compartilhar');
        try {
            const { data } = await axios.post(route('viagens.api.roteiros.compartilhar', id));
            setLink(data.link);
            setCompartilharAberto(true);
        } catch (e) {
            mensagem('erro', erroAmigavel(e));
        } finally {
            setOcupado(null);
        }
    };

    const baixarPdf = async () => {
        const id = await garantirSalvo();
        if (id) window.open(route('viagens.api.roteiros.pdf', id), '_blank', 'noopener');
    };

    const duplicar = async () => {
        const id = await garantirSalvo();
        if (!id) return;
        try {
            const { data } = await axios.post(route('viagens.api.roteiros.duplicar', id));
            router.visit(route('viagens.roteiros.editar', data.id));
        } catch (e) { mensagem('erro', erroAmigavel(e)); }
    };

    const excluir = async () => {
        if (!roteiro.id || !window.confirm('Excluir este roteiro? Essa ação não pode ser desfeita.')) return;
        try {
            await axios.delete(route('viagens.api.roteiros.destroy', roteiro.id));
            setAlterado(false);
            router.visit(route('viagens.roteiros'));
        } catch (e) { mensagem('erro', erroAmigavel(e)); }
    };

    // ---------------------------------------------------------------- edição
    const alterar = (fn) => { setDias((atual) => fn(atual.map((d) => ({ ...d, periodos: { ...d.periodos } })))); setAlterado(true); };

    const mover = (chave, diaDestino, periodoDestino, indice) => alterar((ds) => {
        let item = null;
        let origem = null;
        ds.forEach((d, di) => PERIODOS_ORDEM.forEach((p) => {
            const pos = d.periodos[p].findIndex((i) => i._k === chave);
            if (pos >= 0) { item = d.periodos[p][pos]; origem = { di, p, pos }; d.periodos[p] = d.periodos[p].filter((i) => i._k !== chave); }
        }));
        if (!item) return ds;
        let destino = indice;
        if (origem.di === diaDestino && origem.p === periodoDestino && origem.pos < indice) destino -= 1;
        const lista = [...ds[diaDestino].periodos[periodoDestino]];
        lista.splice(Math.max(0, Math.min(destino, lista.length)), 0, item);
        ds[diaDestino].periodos[periodoDestino] = lista;
        return ds;
    });

    const remover = (chave) => alterar((ds) => ds.map((d) => ({ ...d, periodos: Object.fromEntries(PERIODOS_ORDEM.map((p) => [p, d.periodos[p].filter((i) => i._k !== chave)])) })));

    const anotar = (chave) => {
        const atual = dias.flatMap((d) => PERIODOS_ORDEM.flatMap((p) => d.periodos[p])).find((i) => i._k === chave);
        const texto = window.prompt('Sua anotação para este item:', atual?.anotacao || '');
        if (texto === null) return;
        alterar((ds) => ds.map((d) => ({ ...d, periodos: Object.fromEntries(PERIODOS_ORDEM.map((p) => [p, d.periodos[p].map((i) => (i._k === chave ? { ...i, anotacao: texto.slice(0, 2000) || null } : i))])) })));
    };

    const inserir = (item) => {
        const { dia: d, periodo } = adicionar;
        alterar((ds) => { ds[d].periodos[periodo] = [...ds[d].periodos[periodo], { ...item, periodo, _k: novaChave() }]; return ds; });
        setAdicionar(null);
        mensagem('ok', `"${item.titulo}" entrou no dia ${d + 1}. Salve para atualizar os custos oficiais.`);
    };

    // ---------------------------------------------------------------- tela
    if (!roteiro) {
        return (
            <Casca>
                <FormularioGeracao destinoInicial={destinoInicial} ocupado={ocupado === 'gerar'} onGerar={gerar} aviso={aviso} />
            </Casca>
        );
    }

    const resumo = calculado.resumo;
    const avisos = [...new Set([...(avisosServidor || []).filter((a) => !a.includes('orçamento')), ...(resumo.passou_orcamento ? [`O roteiro passou do orçamento em ${fmt(-resumo.diferenca)}. Remova ou troque alguma locação para economizar.`] : [])])];
    const usoOrcamento = resumo.orcamento ? Math.min(100, (resumo.total / resumo.orcamento) * 100) : null;

    return (
        <Casca titulo={roteiro.titulo}>
            {/* CABEÇALHO */}
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-[#7C2D12] text-white shadow-lg">
                <div className="relative p-5 sm:p-7">
                    {guia?.imagem && <img src={guia.imagem} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
                    <div className="relative">
                        <Link href={route('viagens.roteiros')} className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-white/70 hover:text-white"><ArrowLeftIcon className="h-4 w-4" /> Meus roteiros</Link>
                        <label className="sr-only" htmlFor="titulo-roteiro">Nome do roteiro</label>
                        <input id="titulo-roteiro" value={roteiro.titulo} onChange={(e) => { setRoteiro({ ...roteiro, titulo: e.target.value.slice(0, 200) }); setAlterado(true); }}
                            className="mt-1 w-full border-0 bg-transparent p-0 text-2xl font-black tracking-tight text-white placeholder-white/50 focus:ring-0 sm:text-3xl" />
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                            <Pilula icone={MapPinIcon}>{roteiro.destino}{roteiro.estado ? ` · ${roteiro.estado}` : ''}</Pilula>
                            <Pilula icone={CalendarDaysIcon}>{fmtDia(roteiro.data_inicio)} – {fmtDia(roteiro.data_fim)}</Pilula>
                            <Pilula icone={UsersIcon}>{roteiro.pessoas} {roteiro.pessoas === 1 ? 'pessoa' : 'pessoas'}</Pilula>
                        </div>
                        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Custo estimado</p>
                                <p className="text-3xl font-black">{fmt(resumo.total)}</p>
                                <p className="text-xs text-white/70">{fmt(resumo.por_pessoa)} por pessoa · {resumo.locacoes} locações do Lokyva</p>
                            </div>
                            {usoOrcamento != null && (
                                <div className="w-full max-w-xs">
                                    <div className="flex justify-between text-[11px] font-bold text-white/70"><span>Orçamento</span><span>{fmt(resumo.orcamento)}</span></div>
                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"><div className={`h-full rounded-full ${resumo.passou_orcamento ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${usoOrcamento}%` }} /></div>
                                    <p className={`mt-1 text-xs font-bold ${resumo.passou_orcamento ? 'text-red-300' : 'text-emerald-300'}`}>{resumo.passou_orcamento ? `Passou ${fmt(-resumo.diferenca)}` : `Sobram ${fmt(resumo.diferenca)}`}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {aviso && <Mensagem aviso={aviso} onFechar={() => setAviso(null)} />}
            {avisos.map((a) => (
                <div key={a} className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-500" /> {a}</div>
            ))}
            {alterado && <p className="text-xs font-bold text-amber-700">Alterações ainda não salvas.</p>}

            {/* AÇÕES (desktop) */}
            <div className="hidden flex-wrap gap-2 lg:flex">
                <Acoes ocupado={ocupado} salvo={!!roteiro.id} onSalvar={() => salvar()} onReservar={reservarTudo} onCompartilhar={compartilhar} onPdf={baixarPdf} />
                {roteiro.id && (
                    <>
                        <button type="button" onClick={duplicar} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"><DocumentDuplicateIcon className="h-4 w-4" /> Duplicar</button>
                        <button type="button" onClick={excluir} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-red-600 ring-1 ring-red-100 hover:bg-red-50"><TrashIcon className="h-4 w-4" /> Excluir</button>
                    </>
                )}
            </div>

            {/* ABAS DOS DIAS */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Dias do roteiro">
                {calculado.dias.map((d, i) => (
                    <button key={d.numero} type="button" role="tab" aria-selected={diaAtivo === i} onClick={() => setDiaAtivo(i)}
                        className={`min-h-[56px] shrink-0 rounded-2xl px-4 text-left transition ${diaAtivo === i ? 'bg-gray-900 text-white shadow' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                        <span className="block text-xs font-black">Dia {d.numero}</span>
                        <span className={`block text-[11px] capitalize ${diaAtivo === i ? 'text-white/70' : 'text-gray-500'}`}>{fmtDia(d.data, { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                    </button>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-black capitalize text-gray-900">{fmtDiaLongo(dia.data)}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-gray-700 ring-1 ring-gray-200">{fmt(dia.custo)} no dia</span>
                    </div>

                    {/* MAPA no celular: recolhível */}
                    <div className="lg:hidden">
                        <button type="button" onClick={() => setMapaAberto((a) => !a)} aria-expanded={mapaAberto} className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white px-4 font-bold text-gray-800 ring-1 ring-gray-200">
                            <span className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-[#FF7A00]" /> Ver o dia no mapa</span>
                            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${mapaAberto ? 'rotate-180' : ''}`} />
                        </button>
                        {mapaAberto && <div className="mt-2"><MapaRoteiro pontos={pontosDoDia} centro={{ lat: roteiro.latitude, lng: roteiro.longitude }} altura="h-72" /></div>}
                    </div>

                    <motion.div key={diaAtivo} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                        <LinhaDoTempo dia={dia} dias={calculado.dias} editavel onMover={mover} onRemover={remover} onAnotar={anotar} onAdicionar={(d, p) => setAdicionar({ dia: d, periodo: p })} />
                    </motion.div>

                    {sugestoesFlash.length > 0 && (
                        <section className="rounded-3xl bg-red-50 p-4 ring-1 ring-red-100">
                            <h4 className="flex items-center gap-2 font-black text-red-800"><BoltIcon className="h-5 w-5" /> Ofertas relâmpago perto do roteiro</h4>
                            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                                {sugestoesFlash.map((l) => (
                                    <CartaoLocacao key={l.chave} l={l} acao={<button type="button" onClick={() => setAdicionar({ dia: diaAtivo, periodo: 'tarde', preSelecionado: l })} className="inline-flex min-h-[40px] items-center rounded-xl bg-gray-900 px-3 text-xs font-black text-white">Incluir</button>} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* MAPA no desktop: fixo ao lado */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <MapaRoteiro pontos={pontosDoDia} centro={{ lat: roteiro.latitude, lng: roteiro.longitude }} altura="h-[520px]" />
                        <p className="text-xs text-gray-500">Os números seguem a ordem do dia. Distâncias são estimativas em linha reta com tempo aproximado.</p>
                        {guia && <p className="text-xs text-gray-500">Pontos turísticos: <a href={guia.link} target="_blank" rel="noopener noreferrer" className="font-bold underline">{guia.fonte}</a></p>}
                    </div>
                </aside>
            </div>

            {/* AÇÕES fixas no rodapé (celular) */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
                    <AcaoRodape icone={CheckIcon} rotulo={ocupado === 'salvar' ? 'Salvando…' : 'Salvar'} onClick={() => salvar()} destaque={alterado} disabled={!!ocupado} />
                    <AcaoRodape icone={ShoppingCartIcon} rotulo="Reservar" onClick={reservarTudo} disabled={!!ocupado} />
                    <AcaoRodape icone={ShareIcon} rotulo="Compartilhar" onClick={compartilhar} disabled={!!ocupado} />
                    <AcaoRodape icone={DocumentArrowDownIcon} rotulo="PDF" onClick={baixarPdf} disabled={!!ocupado} />
                </div>
            </div>
            <div className="h-20 lg:hidden" />

            <AnimatePresence>
                {adicionar && (
                    <PainelAdicionar
                        roteiro={roteiro}
                        alvo={adicionar}
                        onFechar={() => setAdicionar(null)}
                        onEscolher={inserir}
                    />
                )}
                {pedido && <ModalPedido pedido={pedido} onFechar={() => setPedido(null)} />}
                {compartilharAberto && link && (
                    <ModalCompartilhar link={link} titulo={roteiro.titulo} onFechar={() => setCompartilharAberto(false)}
                        onParar={async () => {
                            try { await axios.delete(route('viagens.api.roteiros.descompartilhar', roteiro.id)); setLink(null); setCompartilharAberto(false); mensagem('ok', 'O link antigo deixou de funcionar.'); } catch (e) { mensagem('erro', erroAmigavel(e)); }
                        }} />
                )}
            </AnimatePresence>
        </Casca>
    );
}

// ====================================================================== partes

function Casca({ titulo = 'Novo roteiro', children }) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-black text-gray-800">Planejamento de viagem</h2>}>
            <Head title={titulo} />
            <div className="mx-auto max-w-6xl space-y-5 pb-10">
                <AbasPlanejamento ativa="roteiros" />
                {children}
            </div>
        </AuthenticatedLayout>
    );
}

function FormularioGeracao({ destinoInicial, ocupado, onGerar, aviso }) {
    const [destino, setDestino] = useState(destinoInicial);
    const [coords, setCoords] = useState(null);
    const [ida, setIda] = useState(somarDias(hojeIso(), 7));
    const [volta, setVolta] = useState(somarDias(hojeIso(), 9));
    const [pessoas, setPessoas] = useState(2);
    const [orcamento, setOrcamento] = useState('');
    const [interesses, setInteresses] = useState([]);
    const [partida, setPartida] = useState('centro');
    const [partidaCoords, setPartidaCoords] = useState(null);
    const [hospedagem, setHospedagem] = useState(true);
    const [veiculo, setVeiculo] = useState(false);
    const [erroLocal, setErroLocal] = useState(null);
    const [explicar, setExplicar] = useState(null); // 'destino' | 'partida'

    const usarLocalizacao = async (para) => {
        setExplicar(null);
        setErroLocal(null);
        try {
            const p = await pedirLocalizacao();
            if (para === 'destino') { setCoords(p); setDestino(''); } else { setPartidaCoords(p); setPartida('localizacao'); }
        } catch (e) {
            setErroLocal(e.message);
            if (para === 'partida') setPartida('centro');
        }
    };

    const dias = Math.max(1, Math.round((new Date(`${volta}T12:00:00`) - new Date(`${ida}T12:00:00`)) / 86400000) + 1);
    const enviar = (e) => {
        e.preventDefault();
        onGerar({
            destino: coords ? undefined : destino.trim(),
            latitude: coords?.lat, longitude: coords?.lng,
            data_inicio: ida, data_fim: volta, pessoas, orcamento: orcamento ? Number(String(orcamento).replace(',', '.')) : undefined,
            interesses, partida,
            partida_latitude: partida === 'localizacao' ? partidaCoords?.lat : undefined,
            partida_longitude: partida === 'localizacao' ? partidaCoords?.lng : undefined,
            precisa_hospedagem: hospedagem, precisa_veiculo: veiculo,
        });
    };

    return (
        <form onSubmit={enviar} className="space-y-4">
            <section className="rounded-3xl bg-gradient-to-br from-[#FF9A3D] to-[#E8590C] p-5 text-white shadow-lg sm:p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">Roteiro de viagem</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Monte o seu dia a dia de viagem</h1>
                <p className="mt-1 max-w-2xl text-sm text-white/90">Juntamos os pontos turísticos do destino com hospedagem, restaurantes e passeios do Lokyva — agrupados por proximidade para você andar menos.</p>
            </section>

            {(aviso || erroLocal) && <Mensagem aviso={aviso || { tipo: 'erro', texto: erroLocal }} />}

            <div className="grid gap-4 lg:grid-cols-2">
                <Bloco n={1} titulo="Para onde?">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="flex min-h-[48px] flex-1 items-center gap-2 rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-[#FF7A00]">
                            <MapPinIcon className="h-5 w-5 text-gray-400" />
                            <span className="sr-only">Destino</span>
                            <input value={destino} onChange={(e) => { setDestino(e.target.value); setCoords(null); }} placeholder={coords ? 'Usando a sua localização' : 'Cidade ou ponto turístico'} className="w-full border-0 bg-transparent p-0 focus:ring-0" maxLength={120} required={!coords} />
                        </label>
                        <button type="button" onClick={() => setExplicar('destino')} className={`min-h-[48px] rounded-2xl px-4 text-sm font-bold ring-1 ${coords ? 'bg-[#FF7A00] text-white ring-[#FF7A00]' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}>{coords ? '✓ Minha localização' : 'Usar minha localização'}</button>
                    </div>
                    {explicar === 'destino' && <ExplicarLocal texto="Montamos o roteiro na região onde você está agora. A localização é usada só nesta consulta e não fica salva." onSim={() => usarLocalizacao('destino')} onNao={() => setExplicar(null)} />}
                </Bloco>

                <Bloco n={2} titulo="Quando?">
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-bold text-gray-500">Ida
                            <input type="date" value={ida} min={hojeIso()} onChange={(e) => { setIda(e.target.value); if (volta < e.target.value) setVolta(e.target.value); }} className="mt-1 min-h-[48px] w-full rounded-2xl border-gray-200 text-sm text-gray-900" required />
                        </label>
                        <label className="text-xs font-bold text-gray-500">Volta
                            <input type="date" value={volta} min={ida} max={somarDias(ida, 29)} onChange={(e) => setVolta(e.target.value)} className="mt-1 min-h-[48px] w-full rounded-2xl border-gray-200 text-sm text-gray-900" required />
                        </label>
                    </div>
                    <p className="mt-2 text-xs font-bold text-[#E8590C]">{dias} {dias === 1 ? 'dia' : 'dias'} de viagem</p>
                </Bloco>

                <Bloco n={3} titulo="Quem vai e quanto gastar">
                    <div className="flex flex-wrap items-center gap-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500">Pessoas</p>
                            <div className="mt-1 flex items-center gap-2">
                                <button type="button" aria-label="Menos uma pessoa" onClick={() => setPessoas((p) => Math.max(1, p - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100"><MinusIcon className="h-5 w-5" /></button>
                                <span className="w-8 text-center text-xl font-black" aria-live="polite">{pessoas}</span>
                                <button type="button" aria-label="Mais uma pessoa" onClick={() => setPessoas((p) => Math.min(50, p + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100"><PlusIcon className="h-5 w-5" /></button>
                            </div>
                        </div>
                        <label className="min-w-[180px] flex-1 text-xs font-bold text-gray-500">Orçamento total (opcional)
                            <div className="mt-1 flex min-h-[48px] items-center gap-2 rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200">
                                <BanknotesIcon className="h-5 w-5 text-gray-400" /><span className="text-gray-400">R$</span>
                                <input inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="0,00" className="w-full border-0 bg-transparent p-0 text-base font-black text-gray-900 focus:ring-0" />
                            </div>
                        </label>
                    </div>
                </Bloco>

                <Bloco n={4} titulo="Do que vocês gostam?">
                    <div className="flex flex-wrap gap-2">
                        {INTERESSES.map(([id, rotulo, emoji]) => {
                            const on = interesses.includes(id);
                            return (
                                <button key={id} type="button" aria-pressed={on} onClick={() => setInteresses(on ? interesses.filter((x) => x !== id) : [...interesses, id])}
                                    className={`min-h-[44px] rounded-full px-4 text-sm font-bold transition ${on ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'}`}>
                                    <span aria-hidden="true">{emoji}</span> {rotulo}
                                </button>
                            );
                        })}
                    </div>
                </Bloco>
            </div>

            <Bloco n={5} titulo="Detalhes">
                <div className="grid gap-4 md:grid-cols-2">
                    <fieldset>
                        <legend className="text-xs font-bold text-gray-500">Cada dia começa…</legend>
                        <div className="mt-2 space-y-2">
                            {[['centro', 'No centro do destino'], ['hospedagem', 'Na hospedagem escolhida'], ['localizacao', 'Na minha localização atual']].map(([v, r]) => (
                                <label key={v} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl px-3 ring-1 ${partida === v ? 'bg-orange-50 ring-[#FF7A00]' : 'ring-gray-200'}`}>
                                    <input type="radio" name="partida" value={v} checked={partida === v} onChange={() => (v === 'localizacao' ? setExplicar('partida') : setPartida(v))} className="text-[#FF7A00] focus:ring-[#FF7A00]" />
                                    <span className="text-sm font-semibold text-gray-800">{r}</span>
                                </label>
                            ))}
                        </div>
                        {explicar === 'partida' && <ExplicarLocal texto="Calculamos as distâncias a partir de onde você está agora. A localização não fica salva no roteiro." onSim={() => usarLocalizacao('partida')} onNao={() => setExplicar(null)} />}
                    </fieldset>
                    <div className="space-y-2">
                        <Alternar rotulo="Incluir hospedagem do Lokyva" descricao="Sugerimos onde ficar perto dos passeios." ligado={hospedagem} onChange={setHospedagem} />
                        <Alternar rotulo="Incluir aluguel de veículo" descricao="Carro, moto ou van para todos os dias." ligado={veiculo} onChange={setVeiculo} />
                    </div>
                </div>
            </Bloco>

            <button type="submit" disabled={ocupado || (!destino.trim() && !coords)} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 text-lg font-black text-white shadow-lg transition hover:bg-black disabled:opacity-50">
                {ocupado ? <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Montando o roteiro…</> : <><SparklesIcon className="h-6 w-6 text-[#FF9A3D]" /> Gerar roteiro</>}
            </button>
            {ocupado && <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
        </form>
    );
}

function PainelAdicionar({ roteiro, alvo, onFechar, onEscolher }) {
    const [aba, setAba] = useState(alvo.preSelecionado ? 'locacao' : 'ponto');
    const [dados, setDados] = useState(null);
    const [erro, setErro] = useState(null);
    const [nota, setNota] = useState({ titulo: '', hora: '', anotacao: '', custo: '' });

    useEffect(() => {
        if (alvo.preSelecionado) { escolherLocacao(alvo.preSelecionado); return; }
        axios.get(route('viagens.api.guia'), { params: { lat: roteiro.latitude, lng: roteiro.longitude } })
            .then(({ data }) => setDados(data))
            .catch((e) => setErro(erroAmigavel(e)));
    }, []);

    const escolherLocacao = (l) => onEscolher({
        tipo: 'locacao', titulo: l.titulo, descricao: l.descricao, categoria: l.categoria, latitude: l.lat, longitude: l.lng,
        servico_id: l.tipo === 'servico' ? l.id : null, item_aluguel_id: l.tipo === 'item_aluguel' ? l.id : null,
        custo_estimado: l.tipo === 'servico' ? l.valor_com_promocao * roteiro.pessoas : l.valor_com_promocao, hora: null,
        locacao: { tipo: l.tipo, id: l.id, foto: l.foto, disponivel: true },
    });

    const rotuloPeriodo = PERIODOS.find(([p]) => p === alvo.periodo)?.[1];
    const locacoes = Object.values(dados?.locacoes_proximas || {}).flatMap((g) => g.itens);

    return (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} role="dialog" aria-modal="true" aria-label="Adicionar ao roteiro">
            <motion.div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-gray-50 sm:rounded-3xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-4">
                    <div className="flex-1">
                        <p className="font-black text-gray-900">Adicionar ao dia {alvo.dia + 1} · {rotuloPeriodo}</p>
                        <p className="text-xs text-gray-500">Perto de {roteiro.destino}</p>
                    </div>
                    <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <div className="flex gap-1 bg-white px-4 pb-3" role="tablist">
                    {[['ponto', 'Ponto turístico'], ['locacao', 'Locação Lokyva'], ['nota', 'Anotação']].map(([id, r]) => (
                        <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold ${aba === id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{r}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {erro && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{erro}</p>}
                    {!dados && !erro && aba !== 'nota' && <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}

                    {aba === 'ponto' && dados && (
                        dados.pontos_turisticos.length === 0
                            ? <p className="p-6 text-center text-sm text-gray-500">Não conseguimos carregar pontos turísticos agora.</p>
                            : <ul className="space-y-2">{dados.pontos_turisticos.map((p) => (
                                <li key={p.titulo} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-gray-100">
                                    {p.imagem ? <img src={p.imagem} alt="" className="h-14 w-16 rounded-xl object-cover" /> : <div className="flex h-14 w-16 items-center justify-center rounded-xl bg-gray-100"><MapPinIcon className="h-6 w-6 text-gray-300" /></div>}
                                    <div className="min-w-0 flex-1"><p className="truncate font-bold text-gray-900">{p.titulo}</p><p className="text-xs text-gray-500">{p.distancia_km} km do centro</p></div>
                                    <button type="button" onClick={() => onEscolher({ tipo: 'ponto_turistico', titulo: p.titulo, descricao: p.resumo, categoria: 'ponto_turistico', latitude: p.coordenadas.lat, longitude: p.coordenadas.lng, link: p.link, imagem: p.imagem, custo_estimado: 0, hora: null })}
                                        className="min-h-[44px] rounded-xl bg-[#FF7A00] px-4 text-sm font-black text-white">Incluir</button>
                                </li>
                            ))}</ul>
                    )}

                    {aba === 'locacao' && dados && (
                        locacoes.length === 0
                            ? <p className="p-6 text-center text-sm text-gray-500">Não há locações do Lokyva por perto.</p>
                            : <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">{locacoes.map((l) => (
                                <CartaoLocacao key={l.chave} l={l} acao={<button type="button" onClick={() => escolherLocacao(l)} className="inline-flex min-h-[40px] items-center rounded-xl bg-gray-900 px-3 text-xs font-black text-white">Incluir</button>} />
                            ))}</div>
                    )}

                    {aba === 'nota' && (
                        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!nota.titulo.trim()) return; onEscolher({ tipo: 'anotacao', titulo: nota.titulo.trim(), anotacao: nota.anotacao.trim() || null, hora: nota.hora || null, custo_estimado: Number(String(nota.custo).replace(',', '.')) || 0, latitude: null, longitude: null }); }}>
                            <label className="block text-xs font-bold text-gray-500">Título
                                <input value={nota.titulo} onChange={(e) => setNota({ ...nota, titulo: e.target.value })} maxLength={250} required placeholder="Ex.: Comprar lembrancinhas" className="mt-1 min-h-[48px] w-full rounded-2xl border-gray-200" />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-bold text-gray-500">Horário
                                    <input type="time" value={nota.hora} onChange={(e) => setNota({ ...nota, hora: e.target.value })} className="mt-1 min-h-[48px] w-full rounded-2xl border-gray-200" />
                                </label>
                                <label className="block text-xs font-bold text-gray-500">Custo (opcional)
                                    <input inputMode="decimal" value={nota.custo} onChange={(e) => setNota({ ...nota, custo: e.target.value.replace(/[^\d,.]/g, '') })} placeholder="R$ 0,00" className="mt-1 min-h-[48px] w-full rounded-2xl border-gray-200" />
                                </label>
                            </div>
                            <label className="block text-xs font-bold text-gray-500">Anotação
                                <textarea value={nota.anotacao} onChange={(e) => setNota({ ...nota, anotacao: e.target.value })} maxLength={2000} rows={3} className="mt-1 w-full rounded-2xl border-gray-200" />
                            </label>
                            <button type="submit" className="min-h-[48px] w-full rounded-2xl bg-gray-900 font-black text-white">Adicionar anotação</button>
                        </form>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function ModalPedido({ pedido, onFechar }) {
    return (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} role="dialog" aria-modal="true" aria-label="Pedido criado">
            <motion.div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><CheckIcon className="h-8 w-8 text-emerald-600" /></div>
                <h3 className="mt-3 text-center text-xl font-black text-gray-900">Pedido {pedido.codigo}</h3>
                <p className="mt-1 text-center text-sm text-gray-600">{pedido.mensagem}</p>
                <ul className="mt-4 divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-100">
                    {pedido.reservas.map((r) => (
                        <li key={`${r.tipo}${r.id}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                            <div><p className="font-bold text-gray-900">{r.titulo}</p><p className="text-xs text-gray-500">{fmtDia(r.data)}{r.data_fim ? ` – ${fmtDia(r.data_fim)}` : ''}{r.hora ? ` · ${r.hora}` : ''}</p></div>
                            <span className="font-black text-gray-900">{fmt(r.valor)}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-right text-sm font-black text-gray-900">Total {fmt(pedido.total)}</p>
                {pedido.nao_reservados?.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-black">Não foi possível reservar:</p>
                        <ul className="mt-1 list-disc pl-5">{pedido.nao_reservados.map((n) => <li key={n.titulo}><b>{n.titulo}</b>: {n.motivo}</li>)}</ul>
                    </div>
                )}
                <p className="mt-4 rounded-2xl bg-gray-50 p-3 text-xs text-gray-600">As reservas foram criadas para <b>pagar no local</b>. Nos detalhes de cada uma, você pode pagar online onde o local aceita.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link href={route('dashboard')} className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-gray-900 font-black text-white">Ver minhas reservas</Link>
                    <button type="button" onClick={onFechar} className="min-h-[48px] flex-1 rounded-2xl font-bold text-gray-600 ring-1 ring-gray-200">Voltar ao roteiro</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function ModalCompartilhar({ link, titulo, onFechar, onParar }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); } catch { setCopiado(false); } };
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Nosso roteiro "${titulo}": ${link}`)}`;
    return (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar} role="dialog" aria-modal="true" aria-label="Compartilhar roteiro">
            <motion.div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-black text-gray-900">Compartilhar com quem vai junto</h3>
                <p className="mt-1 text-sm text-gray-500">Quem abrir o link vê o roteiro completo, mas não consegue editar.</p>
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-200">
                    <input readOnly value={link} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-gray-700 focus:ring-0" onFocus={(e) => e.target.select()} aria-label="Link do roteiro" />
                    <button type="button" onClick={copiar} className="min-h-[44px] rounded-xl bg-gray-900 px-4 text-sm font-black text-white">{copiado ? 'Copiado!' : 'Copiar'}</button>
                </div>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl bg-[#25D366] font-black text-white">Enviar pelo WhatsApp</a>
                <button type="button" onClick={onParar} className="mt-2 min-h-[44px] w-full rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50">Parar de compartilhar</button>
            </motion.div>
        </motion.div>
    );
}

function Acoes({ ocupado, salvo, onSalvar, onReservar, onCompartilhar, onPdf }) {
    const base = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:opacity-50';
    return (
        <>
            <button type="button" onClick={onSalvar} disabled={!!ocupado} className={`${base} bg-gray-900 text-white hover:bg-black`}><CheckIcon className="h-4 w-4" /> {ocupado === 'salvar' ? 'Salvando…' : salvo ? 'Salvar alterações' : 'Salvar roteiro'}</button>
            <button type="button" onClick={onReservar} disabled={!!ocupado} className={`${base} bg-[#FF7A00] text-white hover:bg-[#E8590C]`}><ShoppingCartIcon className="h-4 w-4" /> {ocupado === 'reservar' ? 'Reservando…' : 'Reservar tudo'}</button>
            <button type="button" onClick={onCompartilhar} disabled={!!ocupado} className={`${base} bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50`}><ShareIcon className="h-4 w-4" /> Compartilhar</button>
            <button type="button" onClick={onPdf} disabled={!!ocupado} className={`${base} bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50`}><DocumentArrowDownIcon className="h-4 w-4" /> PDF</button>
        </>
    );
}

function AcaoRodape({ icone: Icone, rotulo, onClick, destaque, disabled }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${destaque ? 'bg-[#FF7A00] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Icone className="h-5 w-5" /> {rotulo}
        </button>
    );
}

function Bloco({ n, titulo, children }) {
    return (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-3 flex items-center gap-2 font-black text-gray-900"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-xs font-black text-[#E8590C]">{n}</span> {titulo}</h2>
            {children}
        </section>
    );
}

function Alternar({ rotulo, descricao, ligado, onChange }) {
    return (
        <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left ring-1 ring-gray-200 hover:bg-gray-50">
            <span className="flex-1"><span className="block text-sm font-bold text-gray-900">{rotulo}</span><span className="block text-xs text-gray-500">{descricao}</span></span>
            <span className={`relative h-7 w-12 rounded-full transition ${ligado ? 'bg-[#FF7A00]' : 'bg-gray-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${ligado ? 'left-6' : 'left-1'}`} /></span>
        </button>
    );
}

function ExplicarLocal({ texto, onSim, onNao }) {
    return (
        <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-100">
            <p>{texto}</p>
            <div className="mt-2 flex gap-2">
                <button type="button" onClick={onSim} className="min-h-[44px] rounded-xl bg-sky-600 px-4 font-black text-white">Permitir</button>
                <button type="button" onClick={onNao} className="min-h-[44px] rounded-xl px-4 font-bold text-sky-800">Agora não</button>
            </div>
        </div>
    );
}

function Pilula({ icone: Icone, children }) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1"><Icone className="h-3.5 w-3.5" /> {children}</span>;
}

function Mensagem({ aviso, onFechar }) {
    const ok = aviso.tipo === 'ok';
    return (
        <div role={ok ? 'status' : 'alert'} className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <span>{aviso.texto}</span>
            {onFechar && <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="opacity-60 hover:opacity-100"><XMarkIcon className="h-5 w-5" /></button>}
        </div>
    );
}
