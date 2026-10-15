import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ArrowLeft, Calendar, Wallet, MapPin,
  ShieldCheck, Download, Navigation, XCircle,
  Megaphone, Briefcase, Building2, User, CheckCircle2,
  MessageSquare, Car, AlertTriangle, ExternalLink,
  Heart, FileText, FileSignature, CheckSquare, List, Loader,
  Star, Phone, Package, Info, CreditCard
} from 'lucide-react';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const dataCurta = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-');

const STATUS_TEXTO = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  FINALIZADO: 'Finalizado',
  CONCLUIDO: 'Concluído',
  CONCLUÍDO: 'Concluído',
  CANCELADO: 'Cancelado',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGA: 'Paga',
};

export default function DetalheAgendamento({ auth, dados }) {
  const { flash = {}, errors = {} } = usePage().props;
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [abrindoConversa, setAbrindoConversa] = useState(false);

  // Estado local para o botão de favoritar (Inicia com o valor vindo do BD)
  const [isFavorito, setIsFavorito] = useState(dados?.is_favorito || false);

  // Estado para exibir a mensagem flutuante (Toast)
  const [toast, setToast] = useState({ show: false, message: '' });

  // === ESTADOS PARA O RASTREAMENTO EM TEMPO REAL ===
  const [isRastreando, setIsRastreando] = useState(false);
  const watchIdRef = useRef(null); // Guarda o ID do GPS para poder cancelar depois

  // Limpa o rastreamento do GPS se o componente for desmontado (cliente fechar a tela)
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (!dados) {
    return (
      <AuthenticatedLayout user={auth.user}>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
          <XCircle className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800">Agendamento não encontrado</h2>
          <p className="text-gray-500 mt-2 text-center max-w-sm">Os detalhes deste pedido não puderam ser carregados ou ele não existe.</p>
          <button onClick={() => window.history.back()} className="mt-6 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-sm">
            Voltar para a lista
          </button>
        </div>
      </AuthenticatedLayout>
    );
  }

  const isConcluido = ['CONCLUÍDO', 'CONCLUIDO', 'FINALIZADO'].includes(dados.status_geral?.toUpperCase());
  const isPendente = dados.status_geral?.toUpperCase() === 'PENDENTE' || dados.status_geral?.toUpperCase() === 'AGUARDANDO_PAGAMENTO';
  const isCancelado = dados.status_geral?.toUpperCase() === 'CANCELADO';

  const statusStyles = {
    CONFIRMADO: "bg-blue-50 text-blue-700 border-blue-200",
    FINALIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CONCLUÍDO: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CONCLUIDO: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDENTE: "bg-amber-50 text-amber-700 border-amber-200",
    AGUARDANDO_PAGAMENTO: "bg-orange-50 text-orange-700 border-orange-200",
    CANCELADO: "bg-rose-50 text-rose-700 border-rose-200"
  };

  // Tratamento dinâmico dos Links de GPS
  const enderecoTexto = dados.estabelecimento?.endereco_completo || '';
  const lat = dados.estabelecimento?.latitude;
  const lng = dados.estabelecimento?.longitude;

  const googleMapsUrl = lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoTexto)}`;

  const wazeUrl = lat && lng
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(enderecoTexto)}&navigate=yes`;


  // Função para mostrar Toast
  const showToast = (mensagem) => {
      setToast({ show: true, message: mensagem });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // ==========================================================
  // LÓGICA DE FAVORITAR (Axios + Otimização Visual)
  // ==========================================================
  const handleToggleFavorito = async () => {
    // ⚠️ IMPORTANTE: Estamos pegando o ID do serviço/item, e não do agendamento
    const tipoItem = dados.tipo === 'aluguel' ? 'item_aluguel' : 'servico';
    const idItemAlvo = dados.servico_id || dados.item_aluguel_id || dados.item_id;

    if (!idItemAlvo) {
        showToast("Não foi possível identificar o item para favoritar.");
        return;
    }

    // Atualiza a tela instantaneamente
    setIsFavorito(!isFavorito);

    try {
        const response = await axios.post('/favoritos/toggle', {
            tipo: tipoItem,
            id: idItemAlvo
        });
        showToast(response.data.message);
    } catch (error) {
        console.error("Erro ao favoritar:", error);
        // Desfaz se der erro de conexão
        setIsFavorito(isFavorito);
        showToast("Ocorreu um erro ao atualizar.");
    }
  };

  // ==========================================================
  // FUNÇÃO: INICIAR / PARAR RASTREAMENTO GPS (ESTOU A CAMINHO)
  // ==========================================================
  const handleACaminho = () => {
    // SE JÁ ESTÁ RASTREANDO, O BOTÃO SERVE PARA PARAR
    if (isRastreando) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsRastreando(false);
      alert('Rastreamento de rota interrompido.');
      return;
    }

    // SE NÃO ESTÁ RASTREANDO, INICIA A TRANSMISSÃO
    setLoadingAcao(true);

    if (!("geolocation" in navigator)) {
      alert("Seu navegador ou dispositivo não suporta GPS.");
      setLoadingAcao(false);
      return;
    }

    // Pede permissão e começa a "escutar" o movimento do cliente
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
          // Envia as coordenadas a cada atualização para o Backend (que jogará no Websocket)
          await axios.post('/rastreamento/update', {
            agendamento_id: dados.id,
            lat: latitude,
            lng: longitude
          });

          // Se for a primeira vez que bate aqui, tira o loading e marca como ativo
          if (!isRastreando) {
             setIsRastreando(true);
             setLoadingAcao(false);
             alert('A transmissão começou! O estabelecimento está vendo você no mapa.');
          }
        } catch (error) {
          console.error("Erro ao enviar coordenadas:", error);
        }
      },
      (error) => {
        console.error("Erro no GPS:", error);
        alert("Não foi possível acessar seu GPS. Verifique se a localização está ativada no celular.");
        setIsRastreando(false);
        setLoadingAcao(false);
      },
      {
        enableHighAccuracy: true, // Força uso do chip de GPS real
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  // Abre (ou reaproveita) a conversa no chat do app com o dono do serviço ou da reserva.
  const handleEnviarMensagem = () => {
    if (!dados.mensagem) return;
    setAbrindoConversa(true);
    router.post(route('mensagens.iniciar'), dados.mensagem, {
      onFinish: () => setAbrindoConversa(false),
      onError: () => showToast('Não foi possível abrir a conversa agora.'),
    });
  };

  const telefoneLimpo = String(dados.contato?.telefone || '').replace(/\D/g, '');
  const whatsappUrl = telefoneLimpo
    ? `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(`Olá! Sobre meu pedido de ${dados.titulo} (#${dados.codigo_reserva || dados.id}).`)}`
    : null;

  // Reserva (locação): cancelar segue a política do item; o valor volta automaticamente.
  const cancelamento = dados.cancelamento;
  const [cancelandoReserva, setCancelandoReserva] = useState(false);
  const podeCancelarReserva = dados.tipo === 'aluguel' && !isCancelado && !['FINALIZADO', 'CONCLUIDO', 'CONCLUÍDO'].includes(dados.status_geral?.toUpperCase());

  const cancelarReserva = async () => {
    const simulacao = cancelamento?.se_cancelar_agora;
    const aviso = simulacao
      ? `Se cancelar agora, você recebe ${brl(simulacao.valor_reembolso)} de volta (${simulacao.explicacao})`
      : 'A reserva será cancelada.';
    if (!window.confirm(`Cancelar esta reserva?\n\n${aviso}`)) return;

    setCancelandoReserva(true);
    try {
      const { data } = await axios.delete(route('cliente.reservas.destroy', dados.id));
      showToast(data?.message || 'Reserva cancelada.');
      router.reload();
    } catch (e) {
      showToast(e.response?.data?.message || 'Não foi possível cancelar agora.');
    } finally {
      setCancelandoReserva(false);
    }
  };

  const cancelarAgendamento = () => {
    if (!window.confirm('Cancelar este agendamento? Se você pagou online, o valor é devolvido conforme a regra de cancelamento.')) return;
    router.post(route('cliente.agendamentos.cancelar', dados.id), {}, { preserveScroll: true });
  };

  // Mapa sem chave de API: OpenStreetMap com coordenadas, ou Google Maps pelo endereço.
  const mapaEmbed = lat && lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.006},${Number(lat) - 0.004},${Number(lng) + 0.006},${Number(lat) + 0.004}&layer=mapnik&marker=${lat},${lng}`
    : (enderecoTexto && enderecoTexto !== 'Endereço não informado' ? `https://maps.google.com/maps?q=${encodeURIComponent(enderecoTexto)}&z=15&output=embed` : null);

  const detalhes = Array.isArray(dados.detalhes) ? dados.detalhes : [];
  const itensExtras = Array.isArray(dados.itens_extras) ? dados.itens_extras : [];
  const cobranca = dados.cobranca;

  // Processamento seguro das comodidades (Para Reservas de Imóveis/Veículos)
  const comodidades = Array.isArray(dados.comodidades) ? dados.comodidades : [];

  return (
    <AuthenticatedLayout
      user={auth.user}
      header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Detalhes do Pedido</h2>}
    >
      <Head title={`Detalhes - ${dados.titulo}`} />

      <div className="pb-8 bg-slate-50/50 min-h-screen relative">

        {/* TOAST NOTIFICATION */}
        <AnimatePresence>
            {toast.show && (
                <motion.div
                    initial={{ opacity: 0, y: 50, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 50, x: '-50%' }}
                    className="fixed bottom-10 left-1/2 z-50 flex items-center gap-2 px-6 py-3 rounded-full shadow-lg bg-zinc-900 text-white font-medium text-sm"
                >
                    <Heart className={`w-4 h-4 ${toast.message.includes('Adicionado') ? 'fill-red-500 text-red-500' : ''}`} />
                    {toast.message}
                </motion.div>
            )}
        </AnimatePresence>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Topbar: trilha de navegação e favoritar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors group w-fit"
            >
              <span className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:border-gray-300">
                <ArrowLeft className="w-4 h-4" />
              </span>
              {dados.tipo === 'aluguel' ? 'Minhas reservas' : 'Meus agendamentos'} <span className="text-gray-300">›</span> <span className="text-gray-900">Detalhes</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleFavorito}
                className={`p-2 rounded-xl border transition-all shadow-sm flex items-center justify-center ${
                  isFavorito
                    ? 'bg-rose-50 border-rose-200 text-rose-500'
                    : 'bg-white border-gray-200 text-gray-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'
                }`}
                title={isFavorito ? "Remover dos Favoritos" : "Salvar nos Favoritos"}
              >
                <Heart className={`w-5 h-5 ${isFavorito ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-3 py-2 rounded-xl border border-gray-200/40 shadow-sm flex items-center h-full">
                ID: #{dados.codigo_reserva || dados.id}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">{dados.tipo === 'aluguel' ? 'Detalhes da Reserva' : 'Detalhes do Agendamento'}</h1>
            <p className="text-sm text-gray-500 mt-1">Visualize as informações completas {dados.tipo === 'aluguel' ? 'da sua reserva' : 'da sua sessão'}.</p>
          </div>

          {(flash.success || errors.error) && (
            <div className={`mb-6 rounded-2xl px-4 py-3 text-sm font-semibold ${errors.error ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {errors.error || flash.success}
            </div>
          )}

          {/* Banner Informativo Dinâmico */}
          {isPendente && dados.tipo !== 'aluguel' && (
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 shadow-md text-white border border-emerald-400/20">
              <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                  <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wide">Sua vez está próxima!</h2>
                  <p className="text-emerald-50/90 text-sm mt-0.5">Fique atento ao painel. Prepare-se para ser chamado à sala.</p>
                </div>
              </div>
              <button onClick={cancelarAgendamento} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm shadow-sm hover:scale-[1.02]">
                Cancelar Agendamento
              </button>
            </div>
          )}

          {isConcluido && (
            <div className="bg-white rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 mb-8 shadow-sm border border-emerald-100 bg-gradient-to-r from-white to-emerald-50/20">
              <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-bold text-slate-800">Atendimento Concluído</h2>
                <p className="text-gray-500 text-sm mt-0.5">Este serviço foi finalizado e registrado com sucesso.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* COLUNA ESQUERDA: Detalhes do Serviço / Reserva */}
            <div className="lg:col-span-8 space-y-6">

              {/* Card Principal */}
              <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm overflow-hidden">
                {dados.foto_principal && (
                  <div className="relative h-48 sm:h-60 bg-slate-100">
                    <img src={dados.foto_principal} alt={dados.titulo} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                )}
                <div className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {(dados.ramo || dados.tipo === 'aluguel') && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">{dados.tipo === 'aluguel' ? 'Reserva' : dados.ramo}</span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusStyles[dados.status_geral?.toUpperCase()] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {STATUS_TEXTO[dados.status_geral?.toUpperCase()] || dados.status_geral?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-[#E8590C] tracking-tight leading-tight">{dados.titulo}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 mt-1.5">
                      {dados.tipo === 'aluguel' ? <MapPin className="w-4 h-4 text-gray-400" /> : <User className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-medium">{dados.subtitulo}</span>
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="text-2xl font-black text-gray-900">{brl(dados.valor)}</p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${dados.pagamento_confirmado ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {dados.pagamento_confirmado ? 'Valor pago' : 'Valor a pagar'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3 bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
                    <span className="w-11 h-11 rounded-full bg-orange-50 text-[#E8590C] flex items-center justify-center shrink-0"><Calendar className="w-5 h-5" /></span>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data e horário</p>
                      <p className="text-gray-900 font-bold text-base">{dados.data_formatada}</p>
                      <p className="text-xs text-gray-500 font-medium">{dados.horario}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resumo Financeiro</p>
                    <div className="flex items-center gap-2 text-gray-900 font-extrabold text-base">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dados.valor || 0)}
                    </div>
                    <p className={`text-xs mt-1 font-semibold ${dados.pagamento_confirmado ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {dados.pagamento_confirmado ? '✓ Pagamento Confirmado' : '• Aguardando Pagamento'}
                    </p>
                    {dados.valor_caucao > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1">Caução: {brl(dados.valor_caucao)}</p>
                    )}
                  </div>
                </div>

                {detalhes.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                    {detalhes.map((d) => (
                      <div key={d.rotulo} className="rounded-2xl border border-gray-100 px-4 py-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.rotulo}</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{d.valor}</p>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>

              {/* ESTABELECIMENTO */}
              {dados.contato && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-5 sm:p-6 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-3">{dados.tipo === 'aluguel' ? 'Responsável' : 'Estabelecimento'}</h4>
                  <div className="flex items-center gap-4">
                    {dados.contato.foto ? (
                      <img src={dados.contato.foto} alt={dados.contato.nome} className="w-14 h-14 rounded-2xl object-cover border border-gray-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black text-lg">
                        {String(dados.contato.nome || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 uppercase truncate">{dados.contato.nome}</p>
                      {dados.ramo && <p className="text-xs text-gray-500 truncate">{dados.ramo}</p>}
                      {dados.contato.avaliacao && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {dados.contato.avaliacao}</p>
                      )}
                    </div>
                    {dados.estabelecimento_id && route().has('estabelecimentos.loja') && (
                      <Link href={route('estabelecimentos.loja', dados.estabelecimento_id)} className="shrink-0 px-4 py-2 rounded-xl border border-orange-200 text-[#E8590C] text-xs font-bold hover:bg-orange-50">
                        Ver perfil
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* SOBRE O SERVIÇO / RESERVA */}
              {(dados.descricao || dados.informacoes_extras) && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-6 sm:p-8 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                    <Info className="w-5 h-5 text-teal-600" />
                    {dados.tipo === 'aluguel' ? 'Sobre a reserva' : 'Sobre o serviço'}
                  </h4>
                  {dados.descricao && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{dados.descricao}</p>}
                  {dados.informacoes_extras && (
                    <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-4">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Informações e regras do local</p>
                      <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">{dados.informacoes_extras}</p>
                    </div>
                  )}
                </div>
              )}

              {/* POLÍTICA DE CANCELAMENTO (reservas) */}
              {dados.tipo === 'aluguel' && cancelamento && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-6 sm:p-8 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2 text-lg">
                    <ShieldCheck className="w-5 h-5 text-teal-600" /> Política de cancelamento: {cancelamento.nome}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{cancelamento.resumo}</p>

                  {cancelamento.valor_reembolsado !== null && isCancelado && (
                    <p className="mt-4 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">
                      Reserva cancelada. Valor devolvido: {brl(cancelamento.valor_reembolsado)}, na forma de pagamento original.
                    </p>
                  )}

                  {cancelamento.se_cancelar_agora && (
                    <div className="mt-4 rounded-2xl bg-slate-50 border border-gray-100 p-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Se cancelar agora</p>
                      <p className="text-xl font-black text-gray-900 mt-1">
                        Você recebe {brl(cancelamento.se_cancelar_agora.valor_reembolso)}
                        <span className="text-sm font-semibold text-gray-500"> ({cancelamento.se_cancelar_agora.percentual}% do valor)</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{cancelamento.se_cancelar_agora.explicacao}</p>
                    </div>
                  )}

                  {podeCancelarReserva && (
                    <button
                      onClick={cancelarReserva}
                      disabled={cancelandoReserva}
                      className="mt-4 w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 px-6 rounded-xl text-sm disabled:opacity-50"
                    >
                      {cancelandoReserva ? 'Cancelando...' : 'Cancelar reserva'}
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 mt-3">O valor volta sozinho na forma de pagamento original. Você não precisa pedir estorno.</p>
                </div>
              )}

              {/* PRODUTOS EXTRAS DO PEDIDO */}
              {itensExtras.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-6 sm:p-8 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-teal-600" /> Produtos incluídos
                  </h4>
                  <ul className="divide-y divide-gray-100">
                    {itensExtras.map((i, idx) => (
                      <li key={idx} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="font-semibold text-gray-800">{i.nome}{i.quantidade > 1 ? ` × ${i.quantidade}` : ''}</span>
                        <span className="font-bold text-gray-900">{brl(i.valor * (i.quantidade || 1))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* PAGAMENTO PARCELADO (cobrança enviada pelo local) */}
              {cobranca && (
                <div className="bg-white rounded-3xl border border-indigo-100 p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                      <CreditCard className="w-5 h-5 text-indigo-600" /> Pagamento parcelado
                    </h4>
                    <span className="text-xs font-bold text-gray-500">{cobranca.codigo}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {brl(cobranca.total)} em {cobranca.parcelas}x · {cobranca.pagas} paga(s)
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-indigo-50 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${cobranca.parcelas ? (cobranca.pagas / cobranca.parcelas) * 100 : 0}%` }} />
                  </div>
                  {cobranca.proxima && (
                    <p className="text-sm text-gray-800 mt-3">
                      Próxima: parcela {cobranca.proxima.numero} de <b>{brl(cobranca.proxima.valor)}</b>, vence em {dataCurta(cobranca.proxima.vencimento)}.
                    </p>
                  )}
                  <a href={route('cobrancas.minhas')} className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-indigo-700 hover:underline">
                    Ver parcelas e pagar <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* 📌 CARD DE COMODIDADES E DADOS DO ITEM (Apenas para Locação) */}
              {dados.tipo === 'aluguel' && comodidades.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-6 sm:p-8 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <List className="w-5 h-5 text-indigo-500" />
                    Comodidades e Especificações Inclusas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {comodidades.map((comodidade, index) => (
                      <span key={index} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {comodidade}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 📝 CARD DE CONTRATO DIGITAL (Apenas se o estabelecimento exigir) */}
              {dados.exige_contrato && (
                <div className="bg-white rounded-3xl border border-blue-200 p-6 sm:p-8 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                      <FileSignature className="w-6 h-6 text-blue-600" />
                      Documentação e Contrato
                    </h4>
                    {dados.status_contrato === 'assinado' ? (
                      <span className="bg-green-100 text-green-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3"/> Assinado
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                        <Loader className="w-3 h-3 animate-spin"/> Pendente
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-6">
                    {dados.status_contrato === 'assinado'
                      ? 'O contrato de locação já foi assinado digitalmente e possui validade jurídica. Você pode baixar uma cópia do documento oficial em PDF no botão abaixo.'
                      : 'O proprietário enviou um contrato digital para esta reserva. Para liberar o seu atendimento/produto, você deve assinar o documento através do link seguro.'}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {dados.status_contrato === 'assinado' ? (
                      <a
                        href={`/contratos/baixar/${dados.contrato_id}`}
                        target="_blank"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4"/> Baixar PDF Assinado
                      </a>
                    ) : (
                      <>
                        <a
                          href={dados.url_assinatura}
                          target="_blank"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm flex-1"
                        >
                          <FileText className="w-4 h-4"/> Assinar Contrato Agora
                        </a>
                        <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-xl transition-all shadow-sm text-sm">
                          Dúvidas sobre o texto?
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Card Código de Verificação (Check-in) */}
              {dados.codigo_verificacao && !isCancelado && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center sm:text-left">
                    Código Check-in de Atendimento
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex gap-2">
                      {String(dados.codigo_verificacao).split('').map((char, index) => (
                        <div key={index} className="w-12 h-14 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 font-black text-2xl flex items-center justify-center rounded-xl border border-gray-200 shadow-2xs">
                          {char}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 text-xs text-gray-500 leading-relaxed text-center sm:text-left border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-6 flex items-start gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 hidden sm:block" />
                      <span><strong>Segurança ativa:</strong> Apresente este código ao profissional apenas no momento exato em que seu atendimento for concluído.</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* COLUNA DIREITA: Mapa e Painel de Ações */}
            <div className="lg:col-span-4 space-y-6">

              {/* Card Mapa */}
              <div className="bg-white rounded-3xl border border-gray-200/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <h4 className="font-bold text-gray-900 text-base">{dados.estabelecimento?.tipo_local_label || 'Localização'}</h4>
                </div>

                <div className="w-full h-44 rounded-2xl mb-4 overflow-hidden relative shadow-inner border border-gray-100">
                  {mapaEmbed ? (
                    <iframe
                      title="Mapa do local"
                      src={mapaEmbed}
                      className="w-full h-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="w-full h-full relative">
                      <img
                        src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=400&auto=format&fit=crop"
                        alt="Mapa de Referência"
                        className="w-full h-full object-cover brightness-[0.85] contrast-[1.05]"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                        <AlertTriangle className="w-6 h-6 text-amber-400 mb-1" />
                        <span className="text-white font-bold text-xs">Rota por Endereço</span>
                        <span className="text-slate-200 text-[10px] mt-0.5 max-w-[180px]">Clique abaixo para traçar a rota com o endereço de texto.</span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 font-medium mb-4 leading-relaxed bg-slate-50 p-3 rounded-xl border border-gray-100">
                  {enderecoTexto || 'Endereço não informado pelo estabelecimento.'}
                </p>

                {/* BOTÕES DE GPS SEPARADOS */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 hover:border-gray-300 rounded-xl font-bold text-xs text-gray-700 hover:bg-slate-50 transition-all shadow-2xs"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                    Google Maps
                  </a>

                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 hover:border-gray-300 rounded-xl font-bold text-xs text-gray-700 hover:bg-slate-50 transition-all shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
                    Waze
                  </a>
                </div>
              </div>

              {/* QUEM ATENDE / DONO */}
              {dados.contato && (
                <div className="bg-white rounded-3xl border border-gray-200/70 p-5 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contato</p>
                  <button
                    onClick={handleEnviarMensagem}
                    disabled={abrindoConversa || !dados.mensagem}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-sm shadow-sm disabled:opacity-50"
                  >
                    {abrindoConversa ? <Loader className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    {dados.tipo === 'aluguel' ? 'Mensagem para o dono' : 'Mensagem para o local'}
                  </button>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 hover:bg-slate-50 rounded-xl font-bold text-xs text-gray-700">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Painel de Ações Operacionais */}
              <div className="space-y-3">
                {dados.tipo !== 'aluguel' && dados.servico_id && route().has('cliente.servicos.show') && (
                  <Link
                    href={route('cliente.servicos.show', dados.servico_id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-sm shadow-sm"
                  >
                    <Calendar className="w-4 h-4" /> Agendar novamente
                  </Link>
                )}

                {isPendente && dados.tipo !== 'aluguel' && (
                  <button
                    onClick={cancelarAgendamento}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-wide transition-all text-sm shadow-sm"
                  >
                    Cancelar serviço
                  </button>
                )}

                <a
                  href={dados.tipo === 'aluguel' ? `/alugueis/${dados.id}/comprovante-pdf` : `/agendamentos/${dados.id}/comprovante-pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl font-bold text-gray-700 transition-all text-sm shadow-2xs text-center"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  Baixar comprovante
                </a>

                {dados.pagamento_confirmado && (
                  <a
                    href={route('pagamentos.comprovante', dados.tipo === 'aluguel' ? { aluguel_id: dados.id } : { agendamento_id: dados.id })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl font-bold text-gray-700 transition-all text-sm shadow-2xs text-center"
                  >
                    <Download className="w-4 h-4 text-gray-500" />
                    Comprovante do pagamento
                  </a>
                )}

                {/* BOTÃO ESTOU A CAMINHO - MODIFICADO COM ESTADO */}
                {isPendente && dados.tipo !== 'aluguel' && (
                  <button
                    onClick={handleACaminho}
                    disabled={loadingAcao}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all text-sm shadow-sm disabled:opacity-50
                      ${isRastreando
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200'
                        : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                      }`}
                  >
                    {loadingAcao ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Conectando GPS...</>
                    ) : isRastreando ? (
                      <><XCircle className="w-4 h-4" /> Parar Transmissão GPS</>
                    ) : (
                      <><Car className="w-4 h-4" /> Estou a Caminho</>
                    )}
                  </button>
                )}

                {dados.estabelecimento_id && route().has('estabelecimentos.loja') && (
                  <Link
                    href={route('estabelecimentos.loja', dados.estabelecimento_id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl font-bold text-gray-700 transition-all text-sm shadow-2xs"
                  >
                    <Building2 className="w-4 h-4 text-gray-500" /> Ver o estabelecimento
                  </Link>
                )}

                {dados.mensagem && (
                  <button
                    type="button"
                    onClick={handleEnviarMensagem}
                    disabled={abrindoConversa}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-gray-800"
                  >
                    <Info className="w-3.5 h-3.5" /> Precisa de ajuda? <span className="font-bold text-[#E8590C]">Fale com {dados.tipo === 'aluguel' ? 'o responsável' : 'o local'}</span>
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </AuthenticatedLayout>
  );
}