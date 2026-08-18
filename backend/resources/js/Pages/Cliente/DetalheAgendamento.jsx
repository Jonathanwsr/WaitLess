import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { 
  ArrowLeft, Calendar, Wallet, MapPin, 
  ShieldCheck, Download, Navigation, XCircle, 
  Megaphone, Briefcase, Building2, User, CheckCircle2,
  MessageSquare, Car, AlertTriangle, ExternalLink,
  Heart, FileText, FileSignature, CheckSquare, List
} from 'lucide-react';

export default function DetalheAgendamento({ auth, dados }) {
  const [loadingAcao, setLoadingAcao] = useState(false);
  
  // Estado local para o botão de favoritar (Inicia com o valor vindo do BD)
  const [isFavorito, setIsFavorito] = useState(dados?.is_favorito || false);

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

  const isConcluido = dados.status_geral?.toUpperCase() === 'CONCLUÍDO' || dados.status_geral?.toUpperCase() === 'CONCLUIDO';
  const isPendente = dados.status_geral?.toUpperCase() === 'PENDENTE' || dados.status_geral?.toUpperCase() === 'AGUARDANDO_PAGAMENTO';
  const isCancelado = dados.status_geral?.toUpperCase() === 'CANCELADO';

  const statusStyles = {
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

  // Lógica de Favoritar que salva no Banco de Dados
  const handleToggleFavorito = () => {
    setIsFavorito(!isFavorito);
    // Dispara a requisição para a sua rota do Laravel
    router.post(route('favoritos.toggle'), {
      item_id: dados.id,
      tipo: dados.tipo // 'aluguel' ou 'agendamento'
    }, { preserveScroll: true });
  };

  // Funções de Interação Operacional
  const handleACaminho = () => {
    setLoadingAcao(true);
    alert('Notificação enviada ao estabelecimento! Eles sabem que você está a caminho.');
    setTimeout(() => setLoadingAcao(false), 1000);
  };

  const handleEnviarMensagem = () => {
    const mensagem = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido de ${dados.titulo} (ID: #${dados.id}).`);
    window.open(`https://api.whatsapp.com/send?text=${mensagem}`, '_blank');
  };

  // Processamento seguro das comodidades (Para Reservas de Imóveis/Veículos)
  const comodidades = Array.isArray(dados.comodidades) ? dados.comodidades : [];

  return (
    <AuthenticatedLayout
      user={auth.user}
      header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Detalhes do Pedido</h2>}
    >
      <Head title={`Detalhes - ${dados.titulo}`} />

      <div className="py-8 bg-slate-50/50 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Topbar: Voltar e Favoritar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <button 
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors group w-fit"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-200/60 group-hover:border-gray-300 transition-all">
                <ArrowLeft className="w-4 h-4" />
              </div>
              Voltar para Meus Pedidos
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
                <Heart className={`w-5 h-5 ${isFavorito ? 'fill-current' : ''}`} />
              </button>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-3 py-2 rounded-xl border border-gray-200/40 shadow-sm flex items-center h-full">
                ID: #{dados.codigo_reserva || dados.id}
              </span>
            </div>
          </div>

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
              <button className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm shadow-sm hover:scale-[1.02]">
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
              <div className="bg-white rounded-3xl border border-gray-200/70 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${dados.tipo === 'aluguel' ? 'bg-indigo-50/50 text-indigo-600 border-indigo-100' : 'bg-gradient-to-br from-teal-500/10 to-emerald-500/10 text-teal-600 border-teal-500/20'}`}>
                      {dados.tipo === 'aluguel' ? <Building2 className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{dados.titulo}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusStyles[dados.status_geral?.toUpperCase()] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {dados.status_geral?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 mt-1.5">
                        {dados.tipo === 'aluguel' ? <MapPin className="w-4 h-4 text-gray-400" /> : <User className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm font-medium">{dados.subtitulo}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data e Horário</p>
                    <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      {dados.data_formatada}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{dados.horario}</p>
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
                      <p className="text-[10px] text-gray-500 mt-1">Caução: R$ {dados.valor_caucao}</p>
                    )}
                  </div>
                </div>
              </div>

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
                        <ClockIcon className="w-3 h-3"/> Pendente
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
                  {lat && lng ? (
                    <img 
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=SUA_API_KEY_AQUI`} 
                      alt="Mapa Real" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
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

              {/* Painel de Ações Operacionais */}
              <div className="space-y-3">
                <a 
                  href={`/agendamentos/${dados.id}/comprovante-pdf`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl font-bold text-gray-700 transition-all text-sm shadow-2xs text-center"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  Baixar Comprovante
                </a>

                {isPendente && dados.tipo !== 'aluguel' && (
                  <button 
                    onClick={handleACaminho}
                    disabled={loadingAcao}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all text-sm shadow-sm disabled:opacity-50"
                  >
                    <Car className="w-4 h-4 text-emerald-200" />
                    {loadingAcao ? 'Notificando...' : 'Estou a Caminho'}
                  </button>
                )}

                <button 
                  onClick={handleEnviarMensagem}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-sm shadow-sm"
                >
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  Falar com Suporte / Local
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </AuthenticatedLayout>
  );
}