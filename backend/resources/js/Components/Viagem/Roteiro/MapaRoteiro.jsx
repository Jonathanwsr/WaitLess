import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COR = { ponto_turistico: '#E8590C', locacao: '#111827', anotacao: '#CA8A04', centro: '#2563EB' };

/**
 * Mapa com os pontos do dia numerados na ordem (OpenStreetMap, sem chave de API).
 * pontos: [{ numero, titulo, latitude, longitude, tipo }]
 */
export default function MapaRoteiro({ pontos = [], centro = null, altura = 'h-80', ligarPontos = true, rotulo = 'Mapa do roteiro' }) {
    const caixa = useRef(null);
    const mapa = useRef(null);
    const camada = useRef(null);

    useEffect(() => {
        if (!caixa.current || mapa.current) return undefined;
        mapa.current = L.map(caixa.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa.current);
        camada.current = L.layerGroup().addTo(mapa.current);

        return () => { mapa.current?.remove(); mapa.current = null; };
    }, []);

    useEffect(() => {
        if (!mapa.current || !camada.current) return;
        camada.current.clearLayers();
        const validos = pontos.filter((p) => p.latitude != null && p.longitude != null);
        const coords = validos.map((p) => [Number(p.latitude), Number(p.longitude)]);

        validos.forEach((p, i) => {
            const cor = COR[p.tipo] || COR.locacao;
            const icone = L.divIcon({
                className: '',
                html: `<div style="background:${cor};color:#fff;width:30px;height:30px;border-radius:15px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:800 12px system-ui">${p.numero ?? i + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            });
            L.marker(coords[i], { icon: icone, title: p.titulo, alt: p.titulo }).bindPopup(`<strong>${(p.numero ?? i + 1)}. ${escapar(p.titulo)}</strong>`).addTo(camada.current);
        });
        if (ligarPontos && coords.length > 1) {
            L.polyline(coords, { color: '#FF7A00', weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(camada.current);
        }
        if (centro && !coords.length) {
            L.circleMarker([centro.lat, centro.lng], { radius: 9, color: COR.centro, fillOpacity: 0.6 }).addTo(camada.current);
        }

        if (coords.length > 1) mapa.current.fitBounds(coords, { padding: [30, 30], maxZoom: 15 });
        else if (coords.length === 1) mapa.current.setView(coords[0], 15);
        else if (centro) mapa.current.setView([centro.lat, centro.lng], 13);
        else mapa.current.setView([-14.2, -51.9], 4);
        setTimeout(() => mapa.current?.invalidateSize(), 50);
    }, [JSON.stringify(pontos.map((p) => [p.latitude, p.longitude, p.numero])), centro?.lat, centro?.lng]);

    return <div ref={caixa} role="region" aria-label={rotulo} className={`z-0 w-full overflow-hidden rounded-2xl ring-1 ring-gray-200 ${altura}`} />;
}

function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
