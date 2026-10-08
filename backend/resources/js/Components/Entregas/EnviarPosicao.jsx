import { useState } from 'react';
import axios from 'axios';

/** Equipe envia a posição atual do entregador para o cliente acompanhar. */
export default function EnviarPosicao({ pedido }) {
    const [estado, setEstado] = useState(null);

    const enviar = () => {
        if (!navigator.geolocation) {
            setEstado('Seu navegador não informa a localização.');
            return;
        }
        setEstado('Obtendo localização...');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await axios.post(route('entregas.pedidos.posicao.store', pedido.id), {
                        lat: pos.coords.latitude, lng: pos.coords.longitude,
                    });
                    setEstado('Posição enviada. O cliente já pode acompanhar.');
                } catch (e) {
                    setEstado(e.response?.data?.error || 'Não foi possível enviar a posição.');
                }
            },
            () => setEstado('Permita o acesso à localização para enviar a posição.'),
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    return (
        <div className="space-y-1">
            <button onClick={enviar} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-900 text-white">
                Enviar minha posição
            </button>
            {estado && <p className="text-[11px] text-zinc-500">{estado}</p>}
        </div>
    );
}
