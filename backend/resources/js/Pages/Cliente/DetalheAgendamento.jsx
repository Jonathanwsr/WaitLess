import React from 'react';
import { 
  ArrowLeft, Calendar, Wallet, MapPin, 
  ShieldCheck, Download, Navigation, XCircle, 
  Megaphone, Briefcase, Building2, User 
} from 'lucide-react';

// Com o Inertia, os dados do Controller entram direto aqui como Props!
const DetalheAgendamento = ({ dados }) => {

  // Caso aconteça algum imprevisto e os dados não cheguem
  if (!dados) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Ops!</h2>
        <p className="text-gray-500 mt-2">Não foi possível carregar os detalhes do agendamento.</p>
        <button onClick={() => window.history.back()} className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFCFC] p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto">
        
        {/* Breadcrumb e Voltar */}
        <div className="flex items-center gap-3 mb-8 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <button 
            onClick={() => window.history.back()}
            className="p-2 bg-blue-50/50 rounded-full hover:bg-blue-100 transition-colors text-blue-900"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span>Meus {dados.tipo === 'aluguel' ? 'Aluguéis' : 'Agendamentos'} &gt; Detalhes</span>
        </div>

        {/* Banner Informativo */}
        <div className="bg-[#bbf7d0] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 shadow-sm border border-green-200">
            <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-700">
                    <Megaphone className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-green-950 uppercase">Sua vez de ser atendido!</h2>
                    <p className="text-green-800 text-sm font-medium mt-1">Você está sendo chamado. Por favor, dirija-se à sala.</p>
                </div>
            </div>
            <button className="bg-[#ff1a1a] hover:bg-red-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm shadow-md">
                Cancelar
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA (Detalhes principais) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Card Serviço Principal */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                        <Briefcase className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-gray-900">{dados.titulo}</h3>
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-blue-100 uppercase tracking-wider">
                                {dados.status_geral}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 mt-1">
                            <User className="w-4 h-4" />
                            <span className="text-sm font-medium">{dados.subtitulo}</span>
                        </div>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data e Hora</p>
                  <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
                      <Calendar className="w-4 h-4 text-[#b97a57]" />
                      {dados.data_formatada}
                  </div>
                  <p className="text-sm text-gray-500 pl-6">{dados.horario}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Valor do Serviço</p>
                  <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
                      <Wallet className="w-4 h-4 text-teal-600" />
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dados.valor)}
                  </div>
                  <p className="text-sm text-gray-500 pl-6">
                      {dados.pagamento_confirmado ? 'Pagamento Confirmado' : 'Pagamento Pendente'}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Estabelecimento */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-400">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estabelecimento</p>
                        <p className="font-bold text-gray-900 uppercase tracking-wide">{dados.estabelecimento?.nome}</p>
                    </div>
                </div>
                <button className="text-[#a65d37] text-sm font-bold flex items-center gap-1 hover:underline">
                    Ver Perfil →
                </button>
            </div>

            {/* Card Código de Verificação */}
            {dados.codigo_verificacao && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 text-center md:text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Código de verificação de atendimento</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 text-[#a65d37]">
                            <ShieldCheck className="w-10 h-10 opacity-40" />
                            <span className="text-5xl font-black tracking-widest">{dados.codigo_verificacao}</span>
                        </div>
                    </div>
                    <div className="flex-1 text-sm text-gray-500 leading-relaxed border-l-0 md:border-l md:pl-6 border-gray-100 text-center md:text-left">
                        Só forneça o código quando o prestador finalizar o serviço. Este código garante que o atendimento foi realizado.
                    </div>
                </div>
            )}

          </div>

          {/* COLUNA DIREITA (Sidebar: Localização e Botões) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Card Localização com Mapa */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-[#a65d37]" />
                    <h4 className="font-bold text-gray-900 text-lg">Localização</h4>
                </div>
                
                <div className="w-full h-40 bg-gray-200 rounded-xl mb-4 overflow-hidden relative">
                    {dados.estabelecimento?.latitude && dados.estabelecimento?.longitude ? (
                      <img 
                          src={`https://maps.googleapis.com/maps/api/staticmap?center=${dados.estabelecimento.latitude},${dados.estabelecimento.longitude}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${dados.estabelecimento.latitude},${dados.estabelecimento.longitude}&key=SUA_API_KEY_AQUI`} 
                          alt="Mapa de Localização" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = 'https://www.transparenttextures.com/patterns/cubes.png'; e.target.className = 'w-full h-full object-cover bg-gray-200 opacity-50' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">Mapa indisponível</div>
                    )}
                </div>

                <p className="text-sm text-gray-600 font-medium mb-5 leading-relaxed">
                    {dados.estabelecimento?.endereco_completo}
                </p>
                
                <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${dados.estabelecimento?.latitude},${dados.estabelecimento?.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl font-bold text-[#a65d37] hover:bg-orange-50 transition-colors text-sm"
                >
                    <Navigation className="w-4 h-4" />
                    Como Chegar
                </a>
            </div>

            {/* Ações / Botões */}
            <button className="w-full flex items-center justify-center gap-2 py-3.5 border border-gray-200 bg-white rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors text-sm shadow-sm">
                <Download className="w-4 h-4" />
                Baixar Comprovante
            </button>

            <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#964B00] rounded-xl font-bold text-white hover:bg-[#7a3d00] transition-colors text-sm shadow-sm">
                A CAMINHO
            </button>

            <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#a5f3e9] text-teal-900 rounded-xl font-bold hover:bg-[#8de8dd] transition-colors text-sm shadow-sm">
                MENSAGEM
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};

export default DetalheAgendamento;