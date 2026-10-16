import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { router } from '@inertiajs/react';
import { MapPin, Navigation } from 'lucide-react';
import { useIdioma } from '@/i18n';

/**
 * Resultados do Explorar num mapa (OpenStreetMap, sem chave). Cada pino mostra o preço;
 * tocar abre um cartão com foto, nome e o botão para ver detalhes. "Perto de mim" centraliza
 * na posição do navegador (nada é salvo).
 * itens: [{ id, nome, subtitulo, preco, foto, latitude, longitude, link }]
 */
export default function MapaExplorar({ itens = [] }) {
    const caixa = useRef(null);
    const mapa = useRef(null);
    const camada = useRef(null);
    const [selecionado, setSelecionado] = useState(null);
    const { t } = useIdioma();

    const comPosicao = useMemo(
        () => itens.filter((i) => i.latitude != null && i.longitude != null && !Number.isNaN(Number(i.latitude)) && Number(i.latitude) !== 0),
        [itens],
    );
    const semPosicao = itens.length - comPosicao.length;

    useEffect(() => {
        if (!caixa.current || mapa.current) return undefined;
        mapa.current = L.map(caixa.current, { zoomControl: true, scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa.current);
        camada.current = L.layerGroup().addTo(mapa.current);
        mapa.current.on('click', () => setSelecionado(null));

        return () => { mapa.current?.remove(); mapa.current = null; };
    }, []);

    useEffect(() => {
        if (!mapa.current || !camada.current) return;
        camada.current.clearLayers();
        const coords = comPosicao.map((i) => [Number(i.latitude), Number(i.longitude)]);

        comPosicao.forEach((item, idx) => {
            const ativo = selecionado?.id === item.id;
            const texto = escapar(item.preco || item.nome || '');
            const icone = L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%,-100%);white-space:nowrap;background:${ativo ? '#111827' : '#FF5A00'};color:#fff;padding:6px 10px;border-radius:999px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3);font:800 12px system-ui;max-width:180px;overflow:hidden;text-overflow:ellipsis">${texto}</div>`,
                iconSize: [0, 0],
            });
            L.marker(coords[idx], { icon: icone, title: item.nome, alt: item.nome, zIndexOffset: ativo ? 1000 : 0, keyboard: true })
                .on('click', (e) => { L.DomEvent.stopPropagation(e); setSelecionado(item); })
                .addTo(camada.current);
        });

        if (!selecionado) {
            if (coords.length > 1) mapa.current.fitBounds(coords, { padding: [50, 50], maxZoom: 15 });
            else if (coords.length === 1) mapa.current.setView(coords[0], 14);
            else mapa.current.setView([-14.2, -51.9], 4);
        }
        setTimeout(() => mapa.current?.invalidateSize(), 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comPosicao, selecionado?.id]);

    const pertoDeMim = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const ponto = [pos.coords.latitude, pos.coords.longitude];
                mapa.current?.setView(ponto, 13);
                L.circleMarker(ponto, { radius: 8, color: '#2563EB', fillColor: '#3B82F6', fillOpacity: 0.8 }).addTo(camada.current);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 8000 },
        );
    };

    return (
        <div className="relative">
            <div ref={caixa} role="region" aria-label="Mapa dos resultados" className="z-0 h-[65vh] min-h-[420px] w-full overflow-hidden rounded-3xl ring-1 ring-zinc-200 dark:ring-zinc-800" />

            <button type="button" onClick={pertoDeMim} className="absolute right-3 top-3 z-[400] inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-zinc-800 shadow-lg hover:bg-zinc-50">
                <Navigation className="h-4 w-4" /> {t('Perto de mim')}
            </button>

            {selecionado && (
                <div className="absolute inset-x-3 bottom-3 z-[400] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl dark:bg-zinc-900">
                    {selecionado.foto ? (
                        <img src={selecionado.foto} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF5A00]"><MapPin className="h-6 w-6" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-zinc-900 dark:text-white">{selecionado.nome}</p>
                        {selecionado.subtitulo && <p className="truncate text-xs text-zinc-500">{selecionado.subtitulo}</p>}
                        {selecionado.preco && <p className="mt-0.5 text-sm font-bold text-[#FF5A00]">{selecionado.preco}</p>}
                    </div>
                    <button type="button" onClick={() => router.visit(selecionado.link)} className="min-h-[44px] shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-black">
                        {t('Ver')}
                    </button>
                </div>
            )}

            {semPosicao > 0 && (
                <p className="mt-3 text-xs text-zinc-500">
                    {semPosicao === itens.length
                        ? t('Os resultados desta página ainda não têm localização no mapa. Use a lista para vê-los.')
                        : (t('{n} resultado(s) desta página sem localização aparecem só na lista.', { n: semPosicao }))}
                </p>
            )}
        </div>
    );
}

function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
