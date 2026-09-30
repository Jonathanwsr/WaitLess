import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { useState } from 'react';
import { LightBulbIcon, FireIcon, CalendarDaysIcon, CheckCircleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';

const STATUS_ESTILO = {
    pendente: 'bg-amber-50 text-amber-700 border-amber-200',
    em_analise: 'bg-blue-50 text-blue-700 border-blue-200',
    respondida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    arquivada: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABEL = {
    pendente: 'Pendente',
    em_analise: 'Em análise',
    respondida: 'Respondida',
    arquivada: 'Arquivada',
};

function CardStat({ icone: Icone, cor, titulo, valor, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}1A` }}>
                <Icone className="w-6 h-6" style={{ color: cor }} />
            </div>
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">{titulo}</p>
                <p className="text-xl font-bold text-gray-900">{valor}</p>
                {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

function LinhaSugestao({ sugestao }) {
    const { flash = {} } = usePage().props;
    const [aberta, setAberta] = useState(false);
    const [status, setStatus] = useState(sugestao.status);
    const [resposta, setResposta] = useState(sugestao.resposta_admin || '');

    const salvar = () => {
        router.post(route('admin.gamificacao.sugestoes.responder', sugestao.id), {
            status,
            resposta_admin: resposta,
        }, { preserveScroll: true, onSuccess: () => setAberta(false) });
    };

    return (
        <div className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{sugestao.usuario?.name || 'Usuário removido'}</span>
                        <span className="text-xs text-gray-400">{sugestao.usuario?.email}</span>
                        {sugestao.categoria && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{sugestao.categoria}</span>
                        )}
                        {sugestao.pontos_concedidos > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-semibold">+{sugestao.pontos_concedidos} pts</span>
                        )}
                    </div>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{sugestao.texto}</p>
                    {sugestao.resposta_admin && (
                        <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg p-2"><strong>Resposta:</strong> {sugestao.resposta_admin}</p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${STATUS_ESTILO[sugestao.status]}`}>
                        {STATUS_LABEL[sugestao.status]}
                    </span>
                    <span className="text-[11px] text-gray-400">{new Date(sugestao.created_at).toLocaleDateString('pt-BR')}</span>
                    <button onClick={() => setAberta(!aberta)} className="text-xs font-semibold text-blue-600 hover:underline">
                        {aberta ? 'Fechar' : 'Responder'}
                    </button>
                </div>
            </div>

            {aberta && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <textarea
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        placeholder="Resposta interna / feedback para o usuário (opcional)"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                        rows={2}
                    />
                    <button onClick={salvar} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
                        Salvar
                    </button>
                </div>
            )}
        </div>
    );
}

export default function Gamificacao({ sugestoes, estatisticas, statusFiltro }) {
    const { flash = {} } = usePage().props;

    const filtrar = (status) => {
        router.get(route('admin.gamificacao.index'), status ? { status } : {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Gamificação" />

            <div className="p-4 md:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <LightBulbIcon className="w-7 h-7 text-amber-500" /> Gamificação
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Check-ins diários, sugestões enviadas no app e bônus mensal por plano premium.</p>
                </div>

                {flash.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-2">{flash.success}</div>
                )}

                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 md:p-5">
                    <h2 className="text-sm font-bold text-violet-900 flex items-center gap-2 mb-2">
                        <LightBulbIcon className="w-4 h-4" /> Como funciona
                    </h2>
                    <ul className="text-sm text-violet-800 space-y-1.5 list-disc list-inside">
                        <li><strong>Check-in diário</strong>: o cliente/sócio toca em "Estou usando" no app, 1 vez por dia. Trava por usuário+dia, não dá pra clicar duas vezes.</li>
                        <li><strong>Sugestão</strong>: enviada pelo app. Só a 1ª do dia concede pontos — as demais ficam salvas e aparecem aqui, só não pontuam de novo (evita spam).</li>
                        <li><strong>Bônus mensal</strong>: crédito automático (comando agendado, todo dia 1) para cada assinante com plano premium ativo, sem precisar de ação do usuário.</li>
                        <li><strong>Premium em dobro</strong>: check-in, sugestão e indicação de amigos saem em dobro para quem tem qualquer plano premium ativo — é automático, calculado no momento em que o ponto é concedido.</li>
                        <li>Todos os valores (pontos por ação, valor do bônus por plano) ficam em <code className="bg-violet-100 px-1 rounded">config/gamificacao.php</code>, editável sem tocar em código de lógica.</li>
                    </ul>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <CardStat icone={FireIcon} cor="#F97316" titulo="Check-ins hoje" valor={estatisticas.checkins_hoje} />
                    <CardStat icone={FireIcon} cor="#F97316" titulo="Pontos (check-in hoje)" valor={estatisticas.checkins_pontos_hoje} />
                    <CardStat icone={ChatBubbleLeftRightIcon} cor="#2563EB" titulo="Sugestões pendentes" valor={estatisticas.sugestoes_pendentes} />
                    <CardStat icone={ChatBubbleLeftRightIcon} cor="#2563EB" titulo="Sugestões (total)" valor={estatisticas.sugestoes_total} />
                    <CardStat icone={CalendarDaysIcon} cor="#7C3AED" titulo="Bônus mensal (mês)" valor={estatisticas.bonus_mensal_creditados} sub="usuários creditados" />
                    <CardStat icone={CheckCircleIcon} cor="#7C3AED" titulo="Pontos do bônus (mês)" valor={estatisticas.bonus_mensal_pontos} />
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => filtrar(null)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${!statusFiltro ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>Todas</button>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <button key={v} onClick={() => filtrar(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${statusFiltro === v ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>{l}</button>
                    ))}
                </div>

                <div className="space-y-3">
                    {sugestoes.data.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">Nenhuma sugestão encontrada.</p>
                    )}
                    {sugestoes.data.map((s) => <LinhaSugestao key={s.id} sugestao={s} />)}
                </div>

                {sugestoes.links && sugestoes.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {sugestoes.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url || '#'}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`text-xs px-3 py-1.5 rounded-lg border ${link.active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'} ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
