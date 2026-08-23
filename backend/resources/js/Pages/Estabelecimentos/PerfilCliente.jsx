import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import React, { useState } from 'react';


import { 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  CreditCard, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

export default function PerfilCliente({ cliente = {}, agendamentos = [], pagamentos = [] }) {
  const [activeTab, setActiveTab] = useState('detalhes');

  const getInitials = (name) => (name ? name.charAt(0).toUpperCase() : 'C');

  // Badge de status estilo Ant Design (Tags)
  const renderStatusTag = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'pendente') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
          <Clock size={13} /> Pendente
        </span>
      );
    }
    if (s === 'cancelado') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
          <XCircle size={13} /> Cancelado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <CheckCircle2 size={13} /> Concluído
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12 font-sans antialiased text-slate-800">
      {/* Banner Superior Sleek (Substituindo a barra azul) */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 h-48 sm:h-56 w-full">
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-xl transition-all duration-200 text-sm font-medium border border-white/10"
          >
            <ArrowLeft size={18} />
            <span>Voltar</span>
          </button>
        </div>
      </div>

      {/* Container Principal */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20">
        {/* Cartão de Perfil Principal (Ant Design Card Style) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            
            {/* Foto / Avatar */}
            <div className="relative -mt-16 sm:-mt-20 flex-shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white p-1.5 shadow-md border border-slate-100">
                {cliente.foto ? (
                  <img
                    src={cliente.foto}
                    alt={cliente.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-3xl font-bold border border-slate-200/50">
                    {getInitials(cliente.name)}
                  </div>
                )}
              </div>
            </div>

            {/* Dados do Cabeçalho */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {cliente.name || 'Cliente'}
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                    Pessoa {cliente.person_type === 'FISICA' ? 'Física' : 'Jurídica'}
                  </p>
                </div>
                <span className="inline-flex items-center self-center sm:self-start px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  • Ativo
                </span>
              </div>

              {/* Bloco de Estatísticas em Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-100">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Agendamentos</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {cliente.numero_reservas || agendamentos.length}
                  </p>
                </div>
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pagamentos</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{pagamentos.length}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Investido</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    R$ {pagamentos.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navegação por Abas */}
          <div className="flex gap-2 mt-8 border-b border-slate-200/80 overflow-x-auto no-scrollbar">
            {[
              { id: 'detalhes', label: 'Detalhes do Perfil' },
              { id: 'historico', label: `Agendamentos (${agendamentos.length})` },
              { id: 'pagamentos', label: `Pagamentos (${pagamentos.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-3 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo das Abas */}
        <div className="mt-6">
          {/* ABA: DETALHES */}
          {activeTab === 'detalhes' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <User size={18} className="text-slate-400" />
                Informações de Contato & Cadastro
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <Mail size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">E-mail</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{cliente.email || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <Phone size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Telefone / Celular</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {cliente.telefone || cliente.mobile_phone || cliente.phone || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <FileText size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">CPF / CNPJ</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{cliente.cpf_cnpj || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <MapPin size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Endereço</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {cliente.address ? `${cliente.address}, ` : ''}
                      {cliente.city && cliente.state ? `${cliente.city} - ${cliente.state}` : 'Endereço não informado'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: AGENDAMENTOS */}
          {activeTab === 'historico' && (
            <div className="space-y-3">
              {agendamentos.length > 0 ? (
                agendamentos.map((agendamento) => (
                  <div
                    key={agendamento.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')} às{' '}
                          {agendamento.hora_agendamento?.substring(0, 5)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Valor: <span className="font-semibold text-slate-800">R$ {parseFloat(agendamento.valor_final || 0).toFixed(2).replace('.', ',')}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-slate-100">
                      {renderStatusTag(agendamento.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-slate-500">
                  <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Nenhum agendamento encontrado para este cliente.</p>
                </div>
              )}
            </div>
          )}

          {/* ABA: PAGAMENTOS */}
          {activeTab === 'pagamentos' && (
            <div className="space-y-3">
              {pagamentos.length > 0 ? (
                pagamentos.map((pagamento) => (
                  <div
                    key={pagamento.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          R$ {parseFloat(pagamento.valor || 0).toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {pagamento.agendamento?.servico?.nome || 'Serviço prestado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-slate-100">
                      <span className="text-xs px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {pagamento.status?.toUpperCase() || 'PAGO'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-slate-500">
                  <CreditCard size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Nenhum pagamento registrado para este cliente.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}