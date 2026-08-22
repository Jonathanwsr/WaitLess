import React, { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  ArrowLeft, MapPin, Navigation, Clock, User, 
  Phone, AlertTriangle, CheckCircle2, Car, Search
} from 'lucide-react';

// ==========================================
// IMPORTANTE: Coloque seu Token do Mapbox
// ==========================================
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.SEU_TOKEN_PUBLICO_AQUI';

export default function MapaRastreamento({ auth, agendamentosAtivos }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerCliente = useRef(null);
  const markerLoja = useRef(null);

  // Coordenada Padrão (Primeiro cliente da lista ou Centro da Cidade)
  const coordPadrao = agendamentosAtivos && agendamentosAtivos.length > 0 
    ? [agendamentosAtivos[0].estabelecimento.longitude, agendamentosAtivos[0].estabelecimento.latitude]
    : [-34.88, -8.05]; 

  // Estados de Gerenciamento da Tela Unificada
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [filtroNome, setFiltroNome] = useState('');

  // Estados do Rastreamento
  const [statusConexao, setStatusConexao] = useState('Selecione um cliente para rastrear.');
  const [tempoChegada, setTempoChegada] = useState('-- min');
  const [distancia, setDistancia] = useState('-- km');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // 1. INICIALIZAR O MAPA BASE EM 3D
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1', // Estilo Navegação
      center: coordPadrao,
      zoom: 15,
      pitch: 65, // <-- EFEITO 3D: Inclinação da Câmera (Uber Style)
      bearing: -20, // Rotação leve
      antialias: true // Suaviza os contornos dos prédios 3D
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    // Quando o estilo do mapa carregar, injeta a camada de PRÉDIOS EM 3D
    map.current.on('style.load', () => {
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#e2e8f0', // Cor clara dos prédios
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.7
        }
      }, labelLayerId);
    });
  }, [coordPadrao]);

  // 2. CONECTAR NO WEBSOCKET DO CLIENTE SELECIONADO
  useEffect(() => {
    if (!clienteSelecionado) return;

    // Configura o Pino de Destino (Sua Loja)
    if (markerLoja.current) markerLoja.current.remove();
    const lojaCoords = [clienteSelecionado.estabelecimento.longitude, clienteSelecionado.estabelecimento.latitude];
    
    // Custom Marker da Loja (Estilo moderno)
    const elLoja = document.createElement('div');
    elLoja.className = 'custom-marker-loja';
    elLoja.innerHTML = `<div class="pino-loja"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-5 h-5"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg></div>`;

    markerLoja.current = new mapboxgl.Marker({ element: elLoja, anchor: 'bottom' })
      .setLngLat(lojaCoords)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong style="color:black">${clienteSelecionado.estabelecimento.nome}</strong>`))
      .addTo(map.current);

    // Reseta estado anterior
    setStatusConexao(`Aguardando sinal GPS de ${clienteSelecionado.usuario.name}...`);
    setTempoChegada('-- min');
    setDistancia('-- km');
    setUltimaAtualizacao(null);
    if (map.current.getSource('route')) {
       map.current.getSource('route').setData({ type: 'FeatureCollection', features: [] });
    }
    if (markerCliente.current) {
        markerCliente.current.remove();
        markerCliente.current = null;
    }

    // VOAR CÂMERA PARA A LOJA ATÉ O SINAL CHEGAR
    map.current.flyTo({ center: lojaCoords, zoom: 15, pitch: 65, essential: true });

    // === INICIA CONEXÃO LARAVEL REVERB ===
    if (!window.Echo) {
      console.error("Laravel Echo não detectado.");
      return;
    }

    const channelName = `rastreamento.${clienteSelecionado.id}`;
    
    window.Echo.private(channelName)
      .listen('.client.moved', (dados) => {
        setStatusConexao('Sinal GPS Ativo - Movendo-se');
        setUltimaAtualizacao(new Date().toLocaleTimeString());

        const novaPosicao = [dados.longitude, dados.latitude];
        atualizarPosicaoETrajeto(novaPosicao, lojaCoords);
      })
      .error((error) => {
        console.error("Erro no WebSocket:", error);
        setStatusConexao('Erro ao conectar ao rastreamento.');
      });

    return () => {
      window.Echo.leave(channelName);
    };
  }, [clienteSelecionado]);

  // 3. ATUALIZA CARRO, MAPA E ROTA COM EFEITO 3D UBER
  const atualizarPosicaoETrajeto = async (posicaoCliente, lojaCoords) => {
    
    // CRIA OU ATUALIZA O CARRINHO
    if (!markerCliente.current) {
      const elCarro = document.createElement('div');
      elCarro.className = 'custom-marker-carro';
      // Desenho do carro em HTML
      elCarro.innerHTML = `<div class="pino-carro ring-pulse"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" /><path fill-rule="evenodd" d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" clip-rule="evenodd" /></svg></div>`;
      
      markerCliente.current = new mapboxgl.Marker({ element: elCarro })
        .setLngLat(posicaoCliente)
        .addTo(map.current);
    } else {
      markerCliente.current.setLngLat(posicaoCliente);
    }

    try {
      // BUSCA A ROTA NO MAPBOX
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${posicaoCliente[0]},${posicaoCliente[1]};${lojaCoords[0]},${lojaCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
      const response = await axios.get(url);
      
      if (response.data.routes.length > 0) {
        const rota = response.data.routes[0];
        
        setTempoChegada(Math.round(rota.duration / 60) + ' min');
        setDistancia((rota.distance / 1000).toFixed(1) + ' km');

        const geojson = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: rota.geometry.coordinates }
        };

        // DESENHA A LINHA DA ROTA (EFEITO GLOW AZUL)
        if (map.current.getSource('route')) {
          map.current.getSource('route').setData(geojson);
        } else {
          map.current.addLayer({
            id: 'route-glow',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#60A5FA', 'line-width': 10, 'line-opacity': 0.4, 'line-blur': 4 } // Sombra
          });
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2563EB', 'line-width': 5, 'line-opacity': 1 } // Linha Principal
          });
        }

        // SEGUE O CARRO NO MODO 3D (EASETO) EM VEZ DE ACHATAR A TELA
        map.current.easeTo({
            center: posicaoCliente,
            pitch: 65, // Mantém o mapa inclinado
            zoom: 16,
            duration: 1500, // Animação suave
            essential: true
        });
      }
    } catch (error) {
      console.error("Erro ao traçar rota:", error);
    }
  };

  // Filtragem da lista da lateral
  const agendamentosFiltrados = (agendamentosAtivos || []).filter(item => 
    item.usuario?.name?.toLowerCase().includes(filtroNome.toLowerCase())
  );

  return (
    <AuthenticatedLayout
      user={auth.user}
      header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Painel de Acompanhamento (Ao Vivo)</h2>}
    >
      <Head title="Monitoramento 3D de Chegadas" />

      <div className="py-8 bg-slate-50 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <button 
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Menu
            </button>

            {clienteSelecionado && (
              <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                statusConexao.includes('Ativo') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {statusConexao.includes('Ativo') ? <CheckCircle2 className="w-4 h-4 animate-pulse"/> : <AlertTriangle className="w-4 h-4"/>}
                {statusConexao}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[75vh]">
            
            {/* BARRA LATERAL ESQUERDA: LISTA DE CLIENTES */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full bg-white rounded-3xl shadow-sm border border-gray-200/60 p-4">
              <div className="pb-4 border-b border-gray-100 shrink-0">
                <h3 className="font-bold text-gray-900 text-lg mb-2">Deslocamentos Ativos</h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input 
                    type="text" 
                    placeholder="Buscar cliente..." 
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {agendamentosFiltrados.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 mt-10">
                        Nenhum cliente agendado para hoje encontrado.
                    </div>
                ) : (
                    agendamentosFiltrados.map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => setClienteSelecionado(item)}
                            className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                                clienteSelecionado?.id === item.id 
                                    ? 'bg-emerald-50 border-emerald-500 shadow-md ring-1 ring-emerald-500/20' 
                                    : 'bg-white border-gray-100 hover:border-emerald-300 hover:shadow-sm'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                        clienteSelecionado?.id === item.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{item.usuario.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">ID #{item.id}</p>
                                    </div>
                                </div>
                                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded border border-gray-200">
                                    {item.horario}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                                <Car className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{item.titulo}</span>
                            </div>
                        </div>
                    ))
                )}
              </div>
            </div>

            {/* ÁREA DIREITA: MAPA 3D E DADOS DO CLIENTE */}
            <div className="lg:col-span-8 flex flex-col gap-4 h-full relative">
                
                {/* Painel Superior (ETA) flutuante */}
                {clienteSelecionado ? (
                    <div className="absolute top-4 left-4 right-4 z-10 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl text-white flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/30">
                                <Navigation className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">{clienteSelecionado.usuario.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> Destino: {clienteSelecionado.estabelecimento.nome}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-6 bg-black/40 px-5 py-2.5 rounded-xl border border-white/5">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Tempo</p>
                                <p className="font-black text-xl text-emerald-400 leading-none">{tempoChegada}</p>
                            </div>
                            <div className="w-[1px] bg-slate-600"></div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Distância</p>
                                <p className="font-black text-xl text-blue-400 leading-none">{distancia}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="absolute top-4 left-4 right-4 z-10 bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-white/10 text-center shadow-lg">
                        <p className="text-white font-medium text-sm">Selecione um cliente ao lado para iniciar a navegação 3D.</p>
                    </div>
                )}

                {/* Container do Mapa */}
                <div className="flex-1 bg-[#e2e8f0] rounded-3xl shadow-inner border border-gray-200/60 overflow-hidden relative">
                    <div ref={mapContainer} className="absolute inset-0" />
                    
                    {/* Badge Sincronização */}
                    {clienteSelecionado && ultimaAtualizacao && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur shadow-lg px-4 py-2 rounded-full border border-slate-700 text-xs font-bold text-white z-10 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400"/> Sincronizado às {ultimaAtualizacao}
                        </div>
                    )}
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* ESTILOS CSS INJETADOS PARA O MAPA E ICONES */}
      <style jsx="true">{`
        /* Scrollbar da lista */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 5px; }
        
        /* CSS DOS PINOS CUSTOMIZADOS DO MAPA */
        .custom-marker-loja {
            z-index: 1;
        }
        .pino-loja {
            background-color: #E04F36;
            border: 2px solid white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 15px rgba(224, 79, 54, 0.4);
            transform: translateY(-50%);
        }
        .pino-loja::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 8px 6px 0;
            border-style: solid;
            border-color: white transparent transparent transparent;
        }
        
        .custom-marker-carro {
            z-index: 2;
        }
        .pino-carro {
            background-color: white;
            color: #2563EB;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            border: 3px solid #2563EB;
        }
        
        /* Animação de pulso para simular tempo real (Onda azul do radar) */
        .ring-pulse::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: #2563EB;
            opacity: 0.5;
            z-index: -1;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        
        @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}