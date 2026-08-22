import React, { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  ArrowLeft, MapPin, Navigation, Clock, User, 
  Phone, AlertTriangle, CheckCircle2, Car
} from 'lucide-react';

// ==========================================
// IMPORTANTE: Coloque seu Token do Mapbox
// ==========================================
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.SEU_TOKEN_PUBLICO_AQUI';

export default function MapaRastreamento({ auth, agendamento }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerCliente = useRef(null);
  const markerLoja = useRef(null);

  // Estados da interface
  const [statusConexao, setStatusConexao] = useState('Aguardando sinal do cliente...');
  const [tempoChegada, setTempoChegada] = useState('-- min');
  const [distancia, setDistancia] = useState('-- km');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // Coordenadas fixas do estabelecimento (Destino)
  const lojaCoords = [agendamento.estabelecimento.longitude, agendamento.estabelecimento.latitude];

  // 1. INICIALIZAR O MAPA
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1', // Estilo de GPS mais limpo
      center: lojaCoords,
      zoom: 14
    });

    // Pino da Loja (Cor Primária / Vermelho)
    markerLoja.current = new mapboxgl.Marker({ color: '#E04F36' })
      .setLngLat(lojaCoords)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${agendamento.estabelecimento.nome}</strong>`))
      .addTo(map.current);

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, []);

  // 2. CONECTAR AO WEBSOCKET (LARAVEL REVERB)
  useEffect(() => {
    if (!window.Echo) {
      console.error("Laravel Echo não detectado.");
      return;
    }

    const channelName = `rastreamento.${agendamento.id}`;
    
    // Escuta as coordenadas enviadas pelo celular do cliente
    window.Echo.private(channelName)
      .listen('.client.moved', (dados) => {
        setStatusConexao('Sinal GPS Ativo - Cliente em movimento');
        setUltimaAtualizacao(new Date().toLocaleTimeString());

        const novaPosicao = [dados.longitude, dados.latitude];
        atualizarPosicaoCliente(novaPosicao);
      })
      .error((error) => {
        console.error("Erro no WebSocket:", error);
        setStatusConexao('Erro ao conectar ao rastreamento.');
      });

    return () => {
      window.Echo.leave(channelName);
    };
  }, [agendamento.id]);

  // 3. ATUALIZAR POSIÇÃO E TRAÇAR ROTA
  const atualizarPosicaoCliente = async (posicaoCliente) => {
    // Atualiza ou cria o pino do cliente
    if (!markerCliente.current) {
      markerCliente.current = new mapboxgl.Marker({ color: '#3B82F6' })
        .setLngLat(posicaoCliente)
        .addTo(map.current);
    } else {
      markerCliente.current.setLngLat(posicaoCliente);
    }

    // Chama a API de Rotas do Mapbox para desenhar a linha do trajeto
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${posicaoCliente[0]},${posicaoCliente[1]};${lojaCoords[0]},${lojaCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
      const response = await axios.get(url);
      
      if (response.data.routes.length > 0) {
        const rota = response.data.routes[0];
        
        // Atualiza painel com ETA (Tempo Estimado)
        setTempoChegada(Math.round(rota.duration / 60) + ' min');
        setDistancia((rota.distance / 1000).toFixed(1) + ' km');

        const geojson = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: rota.geometry.coordinates
          }
        };

        // Renderiza ou atualiza a linha azul no mapa
        if (map.current.getSource('route')) {
          map.current.getSource('route').setData(geojson);
        } else {
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3B82F6', 'line-width': 6, 'line-opacity': 0.8 }
          });
        }

        // Centraliza a câmera pegando o cliente e a loja
        const bounds = new mapboxgl.LngLatBounds(posicaoCliente, posicaoCliente);
        bounds.extend(lojaCoords);
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    } catch (error) {
      console.error("Erro ao traçar rota:", error);
    }
  };

  return (
    <AuthenticatedLayout
      user={auth.user}
      header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Acompanhamento de Chegada</h2>}
    >
      <Head title={`Rastreando - ${agendamento.usuario.name}`} />

      <div className="py-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Topbar: Voltar e Status */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            {/* O botão volta para a tela de dashboard ou gestão que você já tem no Proprietario */}
            <button 
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Painel
            </button>

            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
              statusConexao.includes('Ativo') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}>
              {statusConexao.includes('Ativo') ? <CheckCircle2 className="w-4 h-4 animate-pulse"/> : <AlertTriangle className="w-4 h-4"/>}
              {statusConexao}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* COLUNA ESQUERDA: Dados do Cliente e Trajeto */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Card do Cliente */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-gray-200">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{agendamento.usuario.name}</h3>
                    <p className="text-xs text-gray-500">Cliente • ID: #{agendamento.id}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Serviço Agendado</p>
                    <p className="font-semibold text-sm text-gray-800">{agendamento.titulo}</p>
                  </div>
                  {agendamento.usuario.telefone && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Contato</p>
                      <a href={`tel:${agendamento.usuario.telefone}`} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
                        <Phone className="w-3.5 h-3.5" />
                        {agendamento.usuario.telefone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Card do Tempo Estimado */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-lg text-white">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">
                  <Navigation className="w-4 h-4" />
                  Status da Rota
                </h3>

                <div className="space-y-6">
                  <div className="flex items-end gap-3">
                    <Clock className="w-8 h-8 text-emerald-400 mb-1" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Chega em aproximadamente</p>
                      <p className="text-3xl font-black text-white leading-none">{tempoChegada}</p>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <Car className="w-8 h-8 text-blue-400 mb-1" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Distância Restante</p>
                      <p className="text-3xl font-black text-white leading-none">{distancia}</p>
                    </div>
                  </div>
                </div>

                {ultimaAtualizacao && (
                  <div className="mt-6 pt-4 border-t border-slate-700/50">
                    <p className="text-[10px] text-slate-400 text-center">Sincronizado às {ultimaAtualizacao}</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: MAPA DO MAPBOX */}
            <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-gray-200/60 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-slate-50/50">
                <MapPin className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-gray-800">Visualização do Trajeto ao Vivo</h3>
              </div>
              <div className="w-full flex-1 relative min-h-[500px]">
                <div ref={mapContainer} className="absolute inset-0" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}