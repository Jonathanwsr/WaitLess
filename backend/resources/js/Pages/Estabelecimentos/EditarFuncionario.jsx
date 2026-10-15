import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { ChevronRight, Trash2, Check, Mail, Phone, Calendar, UserSquare2, Briefcase, Building2, Star, Activity, X, Lock } from 'lucide-react';

// O que cada função pode fazer (mesma regra do backend e da tela "Como funcionam os papéis").
const PERMISSOES = {
  Atendente: ['Atender a fila do dia', 'Chamar e finalizar clientes', 'Adiar atendimentos', 'Ver os próprios agendamentos'],
  Gerente: ['Tudo do atendente', 'Administrar agenda e equipe', 'Editar catálogo e serviços', 'Ver relatórios', 'Criar cupons', 'Sem acesso à carteira'],
};

const dataBr = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : null);
const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null);
const campo = 'w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-sm';

export default function EditarFuncionario({ funcionario, estabelecimentos = [], resumo = {}, podeGerenciarEquipeAvancada = false }) {
  const { flash = {} } = usePage().props;
  const [verFuncoes, setVerFuncoes] = useState(false);
  const usuario = funcionario?.usuario || {};

  const { data, setData, put, processing, errors } = useForm({
    nome: funcionario?.nome || '',
    telefone: funcionario?.telefone || '',
    cargo: funcionario?.cargo || 'Atendente',
    email: usuario.email || '',
    password: '',
    birth_date: usuario.birth_date ? String(usuario.birth_date).slice(0, 10) : '',
    estabelecimento_id: funcionario?.estabelecimento_id || estabelecimentos[0]?.id || '',
  });

  const salvar = (e) => {
    e.preventDefault();
    put(route('funcionarios.update', funcionario.id), { preserveScroll: true });
  };

  const desativar = () => {
    if (confirm('Tem certeza que deseja inativar este funcionário? Ele perde o acesso à fila.')) {
      router.delete(route('funcionarios.destroy', funcionario.id));
    }
  };

  const ativo = funcionario?.ativo !== false;
  const permissoes = PERMISSOES[data.cargo] || PERMISSOES.Atendente;

  return (
    <AuthenticatedLayout>
      <Head title="Editar funcionário" />

      <form onSubmit={salvar} className="max-w-[1200px] mx-auto text-gray-800">
        {/* CABEÇALHO */}
        <div className="mb-6">
          <div className="flex items-center text-xs text-gray-500 mb-2">
            <Link href={route('funcionarios.index')} className="hover:text-gray-800">Funcionários</Link>
            <ChevronRight className="w-3.5 h-3.5 mx-1" />
            <span className="font-semibold text-gray-900">Editar funcionário</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">Editar Funcionário</h1>
          <p className="text-gray-500 text-sm mt-1">Atualize as informações e permissões do funcionário.</p>
        </div>

        {flash.success && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{flash.success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* PERFIL */}
          <aside className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
              {usuario.foto_perfil ? (
                <img src={usuario.foto_perfil.startsWith('http') ? usuario.foto_perfil : `/storage/${usuario.foto_perfil}`} alt="" className="w-24 h-24 rounded-full object-cover border border-gray-100" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl font-black">
                  {(data.nome || 'F').charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="mt-3 text-lg font-bold text-gray-900 text-center">{data.nome || 'Funcionário'}</h2>
              <span className="text-sm text-gray-500">{funcionario?.cargo || 'Atendente'}</span>

              <div className="w-full space-y-3 mt-5 pt-5 border-t border-gray-100 text-sm text-gray-600">
                <p className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{data.email || 'Sem e-mail'}</span></p>
                <p className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400 shrink-0" />{data.telefone || usuario.mobile_phone || 'Sem telefone'}</p>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{dataBr(funcionario?.created_at) || '-'}</p>
                    <p className="text-xs text-gray-400">Data de admissão</p>
                  </div>
                </div>
                <p className="flex items-center gap-3"><Building2 className="w-4 h-4 text-gray-400 shrink-0" />{funcionario?.estabelecimento?.nome || '-'}</p>
              </div>

              <div className="w-full mt-5 pt-5 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${ativo ? 'text-emerald-600' : 'text-red-600'}`}>{ativo ? 'Ativo' : 'Inativo'}</p>
                    <p className="text-xs text-gray-400">Status do funcionário</p>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div>
                      <p className="text-lg font-black text-gray-900">{resumo.atendimentos ?? 0}</p>
                      <p className="text-[10px] text-gray-400">atendimentos</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900 inline-flex items-center gap-0.5">{resumo.avaliacao ?? '—'}{resumo.avaliacao && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}</p>
                      <p className="text-[10px] text-gray-400">avaliação</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Última atividade</p>
                  {resumo.ultima_atividade ? (
                    <>
                      <p className="text-sm font-bold text-gray-900">{quando(resumo.ultima_atividade.em)}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{resumo.ultima_atividade.descricao}</p>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-gray-900">Nenhuma ainda</p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* FORMULÁRIOS */}
          <div className="lg:col-span-8 space-y-5">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-5">Informações pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
                  <input type="text" value={data.nome} onChange={(e) => setData('nome', e.target.value)} className={campo} required />
                  {errors.nome && <span className="text-red-500 text-xs">{errors.nome}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de nascimento</label>
                  <input type="date" value={data.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData('birth_date', e.target.value)} className={campo} />
                  {errors.birth_date && <span className="text-red-500 text-xs">{errors.birth_date}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Local de trabalho</label>
                  <select value={data.estabelecimento_id} onChange={(e) => setData('estabelecimento_id', e.target.value)} className={campo}>
                    {estabelecimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                  {errors.estabelecimento_id && <span className="text-red-500 text-xs">{errors.estabelecimento_id}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                  <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className={campo} />
                  {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                  <input type="text" value={data.telefone} onChange={(e) => setData('telefone', e.target.value)} placeholder="(DD) 99999-9999" className={campo} />
                  {errors.telefone && <span className="text-red-500 text-xs">{errors.telefone}</span>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova senha de acesso <span className="font-normal text-gray-400">(opcional)</span></label>
                  <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} placeholder="Deixe em branco para manter a atual" className={campo} autoComplete="new-password" />
                  {errors.password && <span className="text-red-500 text-xs">{errors.password}</span>}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-5">Função e permissões</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Função atual</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                    <UserSquare2 className="w-4 h-4 text-gray-400" /> {funcionario?.cargo || 'Atendente'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Alterar função</label>
                  <select value={data.cargo} onChange={(e) => setData('cargo', e.target.value)} className={campo}>
                    <option value="Atendente">Atendente</option>
                    <option value="Gerente" disabled={!podeGerenciarEquipeAvancada && funcionario?.cargo !== 'Gerente'}>
                      Gerente{!podeGerenciarEquipeAvancada && funcionario?.cargo !== 'Gerente' ? ' (plano Sócio Premium)' : ''}
                    </option>
                  </select>
                  {errors.cargo && <span className="text-red-500 text-xs">{errors.cargo}</span>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 mb-5">
                <p className="flex items-start gap-3 text-sm text-gray-600">
                  <Briefcase className="w-5 h-5 text-gray-500 shrink-0" />
                  Ao alterar a função, as permissões de acesso serão atualizadas automaticamente conforme o perfil selecionado.
                </p>
                <button type="button" onClick={() => setVerFuncoes(true)} className="shrink-0 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Ver detalhes das funções
                </button>
              </div>

              <h4 className="text-sm font-bold text-gray-900">Permissões atribuídas</h4>
              <p className="text-sm text-gray-500 mb-3">Essas são as principais permissões do perfil {data.cargo === 'Gerente' ? 'de gerente' : 'de atendente'}.</p>
              <div className="flex flex-wrap gap-2">
                {permissoes.map((perm) => (
                  <span key={perm} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-700">
                    {perm.startsWith('Sem') ? <Lock className="w-3.5 h-3.5 text-gray-400" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    {perm}
                  </span>
                ))}
              </div>
            </section>

            {/* AÇÕES */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              {ativo ? (
                <button type="button" onClick={desativar} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" /> Desativar funcionário
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button type="button" onClick={() => window.history.back()} className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={processing} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60">
                  <Check className="w-4 h-4" /> {processing ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {verFuncoes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setVerFuncoes(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">O que cada função pode fazer</h3>
              <button type="button" onClick={() => setVerFuncoes(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(PERMISSOES).map(([funcao, lista]) => (
                <div key={funcao} className={`rounded-2xl border p-4 ${data.cargo === funcao ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-100'}`}>
                  <p className="font-bold text-gray-900">{funcao}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
                    {lista.map((p) => <li key={p} className="flex gap-2">{p.startsWith('Sem') ? <Lock className="w-4 h-4 text-gray-400 shrink-0" /> : <Check className="w-4 h-4 text-emerald-600 shrink-0" />}{p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">Gerente é um recurso do plano Sócio Premium. Sócios são convidados pela tela de Funcionários.</p>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
