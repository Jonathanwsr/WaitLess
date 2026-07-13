import React, { useState } from 'react';

export default function Suporte() {
  // Estado para controlar qual pergunta do FAQ está aberta
  const [faqAberto, setFaqAberto] = useState(null);

  const toggleFaq = (index) => {
    setFaqAberto(faqAberto === index ? null : index);
  };

  const faqs = [
    {
      pergunta: "Como redefinir a senha de acesso?",
      resposta: "Para redefinir sua senha, clique em 'Esqueci minha senha' na tela de login, insira seu e-mail cadastrado e siga as instruções enviadas para a sua caixa de entrada."
    },
    {
      pergunta: "Como cadastrar um novo estabelecimento?",
      resposta: "Acesse o menu Configurações > Estabelecimentos e clique no botão 'Adicionar Novo'. Preencha os dados obrigatórios (CNPJ, Nome Fantasia e Endereço) e salve."
    },
    {
      pergunta: "Como adicionar um novo funcionário?",
      resposta: "Vá até a aba 'Equipe' ou 'Usuários', clique em 'Convidar Membro', insira o e-mail do funcionário e defina o nível de permissão que ele terá no sistema."
    },
    {
      pergunta: "Como gerar relatórios?",
      resposta: "Navegue até a seção de 'Relatórios' no menu lateral, escolha o tipo de relatório desejado (Financeiro, Vendas ou Acessos), selecione o período e clique em 'Exportar PDF/Excel'."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans antialiased p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#0f172a]">Suporte</h1>
          <p className="text-sm text-[#64748b] mt-1">Estamos aqui para ajudar você.</p>
        </div>

        {/* Banner principal */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#edf4ff] to-[#f4f8ff] border border-[#e2e8f0] rounded-2xl p-6 md:p-8 flex items-center justify-between">
          <div className="flex items-center gap-4 z-10">
            {/* Ícone Headset Esquerdo */}
            <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-sm text-[#2563eb]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6M3 10.5h1.5M21 10.5h1.5m-16.5 0a7.5 7.5 0 1115 0V18a3 3 0 01-3 3h-1.5m-9-10.5a7.5 7.5 0 00-7.5 7.5V18a3 3 0 003 3h1.5m9-6h3.75m-16.5 0h3.75m0 0v2.25M14.25 15v2.25" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1e3a8a]">Precisa de ajuda?</h2>
              <p className="text-sm text-[#475569] mt-1">Nossa equipe de suporte está pronta para te atender pelos canais abaixo.</p>
            </div>
          </div>
          
          {/* Ilustração grande de Headset ao fundo direito */}
          <div className="absolute right-[-20px] bottom-[-20px] text-[#2563eb] opacity-10 pointer-events-none hidden md:block">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-48 h-48">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-6-3.75H3.375A1.125 1.125 0 012.25 18v-2.25a3.375 3.375 0 013.375-3.375h1.5a1.125 1.125 0 011.125 1.125v3.375A3.375 3.375 0 015.625 21H6M18 18.75h2.625A1.125 1.125 0 0021.75 17.625V15.375A3.375 3.375 0 0018.375 12h-1.5a1.125 1.125 0 00-1.125 1.125v3.375A3.375 3.375 0 0019.125 21H18zM12 3a9 9 0 019 9v1.5M12 3a9 9 0 00-9 9v1.5" />
            </svg>
          </div>
        </div>

        {/* Seção: Canais de Atendimento */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#0f172a]">Canais de atendimento</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CARD 1: Telefone / WhatsApp */}
            <div className="bg-white border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[250px]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#eef2ff] text-[#4f46e5] rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.47-5.112-3.758-6.58-6.58l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1e293b]">Telefone / WhatsApp</h4>
                    <p className="text-xs text-[#94a3b8]">Fale com nossa equipe</p>
                  </div>
                </div>
                
                <div className="mt-6 space-y-2 text-[#1d4ed8] font-semibold text-sm">
                  <p className="hover:underline cursor-pointer">(11) 4002-8922</p>
                  <div className="flex items-center gap-2">
                    <p className="hover:underline cursor-pointer">(11) 9 8765-4321</p>
                    <span className="bg-[#dcfce7] text-[#166534] text-[10px] font-bold px-2 py-0.5 rounded-md">WhatsApp</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-xs text-[#94a3b8] border-t border-[#f1f5f9] pt-4 mt-4">
                Segunda a sexta, das 8h às 18h
              </div>
            </div>

            {/* CARD 2: E-mail */}
            <div className="bg-white border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[250px]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#f0fdf4] text-[#16a34a] rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1e293b]">E-mail</h4>
                    <p className="text-xs text-[#94a3b8]">Envie sua dúvida ou solicitação</p>
                  </div>
                </div>
                
                <div className="mt-8 text-[#1d4ed8] font-semibold text-sm hover:underline cursor-pointer break-all">
                  suporte@minhaempresa.com.br
                </div>
              </div>
              
              <div className="text-center text-xs text-[#94a3b8] border-t border-[#f1f5f9] pt-4 mt-4">
                Resposta em até 24h úteis
              </div>
            </div>

            {/* CARD 3: Chat Online */}
            <div className="bg-white border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[250px]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#fff7ed] text-[#ea580c] rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1e293b]">Chat Online</h4>
                    <p className="text-xs text-[#94a3b8]">Fale com nossa equipe agora</p>
                  </div>
                </div>
                
                <div className="mt-5">
                  <button className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition shadow-sm">
                    Abrir chat
                  </button>
                </div>
              </div>
              
              <div className="text-center text-xs text-[#94a3b8] border-t border-[#f1f5f9] pt-4 mt-4">
                Disponível em horário comercial
              </div>
            </div>

          </div>
        </div>

        {/* Seção: Perguntas Frequentes (FAQ) */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#0f172a]">Perguntas frequentes</h3>
          
          <div className="bg-white border border-[#f1f5f9] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#f1f5f9]">
            {faqs.map((faq, index) => (
              <div key={index} className="transition-colors hover:bg-[#fafafa]">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    {/* Balão azul com '?' */}
                    <div className="flex items-center justify-center w-7 h-7 bg-[#eff6ff] text-[#2563eb] rounded-full text-xs font-bold shrink-0">
                      ?
                    </div>
                    <span className="text-sm font-medium text-[#334155]">
                      {faq.pergunta}
                    </span>
                  </div>
                  
                  {/* Seta Chevron */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 text-[#94a3b8] transition-transform duration-200 ${
                      faqAberto === index ? 'rotate-180' : ''
                    }`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                
                {/* Área de resposta expansível */}
                {faqAberto === index && (
                  <div className="px-16 pb-5 text-xs text-[#64748b] leading-relaxed animate-fadeIn">
                    {faq.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}