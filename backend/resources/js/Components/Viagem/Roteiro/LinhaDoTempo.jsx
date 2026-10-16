import { useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    ArrowUpIcon, ArrowDownIcon, TrashIcon, ArrowsRightLeftIcon, ClockIcon, ArrowTopRightOnSquareIcon,
    PlusIcon, Bars2Icon, ExclamationTriangleIcon, PencilSquareIcon,
} from '@heroicons/react/24/solid';
import { CATEGORIAS, PERIODOS, fmt, linkLocacao } from './comum';

/**
 * Linha do tempo de um dia: cartões por período (Manhã, Tarde, Noite) com a distância até o próximo item.
 * Modo edição: arrastar e soltar (mouse), botões ↑ ↓, "mover para…" e remover (toque e teclado).
 */
export default function LinhaDoTempo({ dia, dias = [], editavel = false, onMover, onRemover, onAnotar, onAdicionar }) {
    const [arrastando, setArrastando] = useState(null);
    const [alvo, setAlvo] = useState(null);

    const soltar = (periodo, indice) => {
        if (arrastando) onMover?.(arrastando, dia.numero - 1, periodo, indice);
        setArrastando(null);
        setAlvo(null);
    };

    return (
        <div className="space-y-5">
            {PERIODOS.map(([periodo, rotulo, emoji]) => {
                const itens = dia.periodos[periodo] || [];
                return (
                    <section
                        key={periodo}
                        aria-label={rotulo}
                        onDragOver={editavel ? (e) => { e.preventDefault(); if (!itens.length) setAlvo(`${periodo}:0`); } : undefined}
                        onDrop={editavel ? (e) => { e.preventDefault(); if (!itens.length) soltar(periodo, 0); } : undefined}
                        className={`rounded-3xl bg-white p-4 shadow-sm ring-1 transition sm:p-5 ${alvo?.startsWith(periodo) && arrastando ? 'ring-2 ring-[#FF7A00]' : 'ring-gray-100'}`}
                    >
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-500">
                                <span aria-hidden="true">{emoji}</span> {rotulo}
                            </h4>
                            {editavel && (
                                <button type="button" onClick={() => onAdicionar?.(dia.numero - 1, periodo)} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3 text-xs font-black text-[#E8590C] hover:bg-orange-50">
                                    <PlusIcon className="h-4 w-4" /> Adicionar
                                </button>
                            )}
                        </div>

                        {itens.length === 0 && (
                            <p className="rounded-2xl border-2 border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                                {editavel ? 'Período livre. Arraste um item para cá ou toque em Adicionar.' : 'Período livre.'}
                            </p>
                        )}

                        <ol className="space-y-2">
                            {itens.map((item, idx) => (
                                <li
                                    key={item._k || item.id || idx}
                                    draggable={editavel}
                                    onDragStart={editavel ? () => setArrastando(item._k) : undefined}
                                    onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                                    onDragOver={editavel ? (e) => { e.preventDefault(); e.stopPropagation(); setAlvo(`${periodo}:${idx}`); } : undefined}
                                    onDrop={editavel ? (e) => { e.preventDefault(); e.stopPropagation(); soltar(periodo, idx); } : undefined}
                                    className={alvo === `${periodo}:${idx}` && arrastando && arrastando !== item._k ? 'border-t-4 border-[#FF7A00] pt-1' : ''}
                                >
                                    {item.distancia_km != null && item.numero > 1 && (
                                        <p className="mb-1 ml-12 text-[11px] font-semibold text-gray-400">
                                            ↓ {item.distancia_km.toLocaleString('pt-BR')} km · {item.minutos} min {item.modo === 'a_pe' ? 'a pé' : 'de carro'}
                                        </p>
                                    )}
                                    <CartaoItem
                                        item={item}
                                        editavel={editavel}
                                        arrastando={arrastando === item._k}
                                        primeiro={idx === 0}
                                        ultimo={idx === itens.length - 1}
                                        dias={dias}
                                        diaAtual={dia.numero - 1}
                                        periodo={periodo}
                                        onSubir={() => onMover?.(item._k, dia.numero - 1, periodo, idx - 1)}
                                        onDescer={() => onMover?.(item._k, dia.numero - 1, periodo, idx + 2)}
                                        onMoverPara={(d, p) => onMover?.(item._k, d, p, Number.MAX_SAFE_INTEGER)}
                                        onRemover={() => onRemover?.(item._k)}
                                        onAnotar={() => onAnotar?.(item._k)}
                                    />
                                </li>
                            ))}
                        </ol>
                    </section>
                );
            })}
        </div>
    );
}

function CartaoItem({ item, editavel, arrastando, primeiro, ultimo, dias, diaAtual, periodo, onSubir, onDescer, onMoverPara, onRemover, onAnotar }) {
    const [moverAberto, setMoverAberto] = useState(false);
    const meta = CATEGORIAS[item.tipo === 'locacao' ? item.categoria : item.tipo] || CATEGORIAS.servicos;
    const foto = item.imagem || item.locacao?.foto;
    const indisponivel = item.locacao && !item.locacao.disponivel;

    return (
        <div className={`flex gap-3 rounded-2xl p-2 transition ${arrastando ? 'opacity-40' : ''} ${editavel ? 'hover:bg-gray-50' : ''}`}>
            <div className="flex w-9 shrink-0 flex-col items-center">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white shadow ${item.tipo === 'ponto_turistico' ? 'bg-[#E8590C]' : item.tipo === 'anotacao' ? 'bg-yellow-500' : 'bg-gray-900'}`}>
                    {item.numero ?? '•'}
                </span>
                {editavel && <Bars2Icon className="mt-2 hidden h-4 w-4 cursor-grab text-gray-300 sm:block" aria-hidden="true" />}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex gap-3">
                    {foto && <img src={foto} alt="" loading="lazy" className="hidden h-16 w-20 shrink-0 rounded-xl object-cover min-[420px]:block" />}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {item.hora && <span className="text-xs font-black text-gray-900">{item.hora}</span>}
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${meta.cor}`}>
                                <meta.icone className="h-3 w-3" /> {item.tipo === 'locacao' ? 'Lokyva · ' + meta.rotulo : meta.rotulo}
                            </span>
                        </div>
                        <p className="mt-0.5 font-black leading-snug text-gray-900">{item.titulo}</p>
                        {item.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.descricao}</p>}
                        {item.anotacao && <p className="mt-1 rounded-lg bg-yellow-50 px-2 py-1 text-xs text-yellow-900">📝 {item.anotacao}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {item.aviso_horario && <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><ClockIcon className="h-3.5 w-3.5" /> {item.aviso_horario}</span>}
                            {item.custo_estimado > 0 && <span className="font-bold text-gray-700">{fmt(item.custo_estimado)}</span>}
                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[28px] items-center gap-0.5 font-bold text-[#E8590C]">Wikipédia <ArrowTopRightOnSquareIcon className="h-3 w-3" /></a>}
                            {item.locacao && !indisponivel && <Link href={linkLocacao(item.locacao.tipo, item.locacao.id)} className="inline-flex min-h-[28px] items-center font-bold text-[#E8590C]">Ver no Lokyva</Link>}
                            {item.locacao?.horario_a_combinar && <span className="font-semibold text-sky-700">Horário a combinar com o local</span>}
                        </div>
                        {indisponivel && <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-600"><ExclamationTriangleIcon className="h-4 w-4" /> Não está mais disponível</p>}
                    </div>
                </div>

                {editavel && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                        <BotaoIcone rotulo="Subir" onClick={onSubir} disabled={primeiro}><ArrowUpIcon className="h-4 w-4" /></BotaoIcone>
                        <BotaoIcone rotulo="Descer" onClick={onDescer} disabled={ultimo}><ArrowDownIcon className="h-4 w-4" /></BotaoIcone>
                        <BotaoIcone rotulo="Mover para outro dia ou período" onClick={() => setMoverAberto((a) => !a)}><ArrowsRightLeftIcon className="h-4 w-4" /></BotaoIcone>
                        <BotaoIcone rotulo="Anotação" onClick={onAnotar}><PencilSquareIcon className="h-4 w-4" /></BotaoIcone>
                        <BotaoIcone rotulo="Remover" onClick={onRemover} perigo><TrashIcon className="h-4 w-4" /></BotaoIcone>
                    </div>
                )}
                {editavel && moverAberto && (
                    <div className="mt-2 flex flex-wrap gap-2 rounded-2xl bg-gray-50 p-2">
                        <label className="sr-only" htmlFor={`mover-${item._k}`}>Mover para</label>
                        <select
                            id={`mover-${item._k}`}
                            defaultValue={`${diaAtual}|${periodo}`}
                            onChange={(e) => { const [d, p] = e.target.value.split('|'); onMoverPara(Number(d), p); setMoverAberto(false); }}
                            className="min-h-[44px] flex-1 rounded-xl border-gray-200 text-sm"
                        >
                            {dias.map((d, i) => PERIODOS.map(([p, r]) => (
                                <option key={`${i}|${p}`} value={`${i}|${p}`}>Dia {d.numero} · {r}</option>
                            )))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}

function BotaoIcone({ rotulo, onClick, disabled, perigo, children }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={rotulo} title={rotulo}
            className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition disabled:opacity-30 ${perigo ? 'text-red-600 ring-red-100 hover:bg-red-50' : 'text-gray-600 ring-gray-200 hover:bg-white'}`}>
            {children}
        </button>
    );
}
