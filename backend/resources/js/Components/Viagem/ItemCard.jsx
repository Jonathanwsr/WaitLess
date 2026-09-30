import { Link } from '@inertiajs/react';
import { StarIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { TIPOS, STATUS_ITEM, PRESENCA, fmt, fmtHora } from './util';

/**
 * Cartão de um item do roteiro. `previa` = modo prévia (sem reserva/presença);
 * `onRemover` aparece na prévia e para editores.
 */
export default function ItemCard({ item, previa = false, onRemover, onPresenca, euId }) {
    const tipo = TIPOS[item.tipo] || TIPOS.personalizado;
    const Icone = tipo.icone;
    const status = STATUS_ITEM[item.status] || STATUS_ITEM.sugerido;
    const reserva = item.reserva;

    return (
        <div className="group flex gap-3">
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tipo.cor}`}><Icone className="w-5 h-5" /></div>
                <div className="flex-1 w-px bg-gray-200 mt-1" />
            </div>

            <div className="flex-1 pb-5 min-w-0">
                {item.deslocamento_min != null && (
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <ArrowRightIcon className="w-3 h-3" /> {item.deslocamento_min} min de deslocamento{item.distancia_km != null ? ` · ${String(item.distancia_km).replace('.', ',')} km` : ''}
                    </p>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                                {tipo.nome}{item.hora_inicio ? ` · ${fmtHora(item.hora_inicio)}${item.hora_fim && item.tipo !== 'hospedagem' ? `–${fmtHora(item.hora_fim)}` : ''}` : ''}
                            </p>
                            <h4 className="font-black text-gray-900 leading-snug">{item.titulo}</h4>
                        </div>
                        <div className="text-right shrink-0">
                            {item.custo_estimado > 0 && <p className="font-black text-gray-900">{fmt(item.custo_estimado)}</p>}
                            {!previa && <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${status.classe}`}>{status.texto}</span>}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.destaque_premium && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <StarIcon className="w-3 h-3" /> Recomendado Premium
                            </span>
                        )}
                    </div>

                    {item.descricao && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.descricao}</p>}
                    {item.endereco && <p className="text-xs text-gray-400 mt-1">{item.endereco}</p>}

                    {reserva && (
                        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600">
                            <b>{reserva.por}</b> reservou · {reserva.quando}{reserva.codigo ? ` · cód. ${reserva.codigo}` : ''}
                        </div>
                    )}

                    {!previa && item.presencas && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {['confirmado', 'talvez', 'recusado'].map((s) => (
                                <button key={s} type="button" onClick={() => onPresenca?.(item, s)}
                                    className={`text-xs font-bold px-3 py-1 rounded-full border transition ${item.minha_presenca === s ? PRESENCA[s].classe : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                                    {PRESENCA[s].texto}
                                </button>
                            ))}
                            {item.presencas.length > 0 && (
                                <span className="text-xs text-gray-400 ml-1">
                                    {item.presencas.filter((p) => p.status === 'confirmado').map((p) => (p.usuario_id === euId ? 'Você' : p.nome.split(' ')[0])).join(', ') || '—'} {item.presencas.some((p) => p.status === 'confirmado') ? 'vai' : ''}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold">
                        {!previa && !reserva && item.servico_id && item.estabelecimento_id && (
                            <Link href={route('cliente.agendar', item.estabelecimento_id)} className="text-[#FF5A00] hover:underline">Reservar</Link>
                        )}
                        {!previa && !reserva && item.item_aluguel_id && (
                            <Link href={route('itens.detalhes', item.item_aluguel_id)} className="text-[#FF5A00] hover:underline">Reservar</Link>
                        )}
                        {onRemover && <button type="button" onClick={() => onRemover(item)} className="text-gray-400 hover:text-red-600 ml-auto">Remover</button>}
                    </div>
                </div>
            </div>
        </div>
    );
}
