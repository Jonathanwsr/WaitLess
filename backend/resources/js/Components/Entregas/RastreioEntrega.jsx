import { useEffect, useState } from 'react';
import axios from 'axios';
import { TruckIcon } from '@heroicons/react/24/outline';

function tempoAtras(iso) {
    if (!iso) return '';
    const segundos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (segundos < 60) return 'agora há pouco';
    if (segundos < 3600) return `há ${Math.round(segundos / 60)} min`;
    return `há ${Math.round(segundos / 3600)} h`;
}

/** Acompanha o entregador: consulta a última posição a cada 15 segundos enquanto o pedido está em rota. */
export default function RastreioEntrega({ pedido }) {
    const [posicao, setPosicao] = useState(null);

    useEffect(() => {
        let ativo = true;
        const buscar = () => axios.get(route('entregas.pedidos.posicao', pedido.id))
            .then((r) => { if (ativo) setPosicao(r.data); })
            .catch(() => {});
        buscar();
        const timer = setInterval(buscar, 15000);
        return () => { ativo = false; clearInterval(timer); };
    }, [pedido.id]);

    if (!pedido.em_rota && !posicao?.em_rota) return null;

    const mapa = posicao?.lat
        ? `https://www.openstreetmap.org/?mlat=${posicao.lat}&mlon=${posicao.lng}#map=17/${posicao.lat}/${posicao.lng}`
        : null;

    return (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                <TruckIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-emerald-900">Entregador a caminho</p>
                <p className="text-xs text-emerald-700">
                    {posicao?.lat ? `Última posição ${tempoAtras(posicao.atualizada_em)}.` : 'Aguardando a primeira posição.'}
                </p>
            </div>
            {mapa && (
                <a href={mapa} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-800 underline whitespace-nowrap">
                    Ver no mapa
                </a>
            )}
        </div>
    );
}
