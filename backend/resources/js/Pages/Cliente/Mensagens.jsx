import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { SparklesIcon, TicketIcon, BellAlertIcon, StarIcon, MapPinIcon, ScissorsIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';

export default function MensagensSugestoes({ auth, meusCupons = [], sugestoesLojas = [], pontosAtuais = 0 }) {
    const { flash = {} } = usePage().props;
    const [processandoResgate, setProcessandoResgate] = useState(null); // Trava para evitar cliques múltiplos

    const resgatarCupom = (cupom) => {
        if (window.confirm(`Deseja investir ${cupom.pontos_custo} pontos para resgatar "${cupom.titulo}"?`)) {
            setProcessandoResgate(cupom.id);
            router.post(route('cliente.resgatar.cupom', cupom.id), {}, { 
                preserveScroll: true,
                onFinish: () => setProcessandoResgate(null)
            });
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BellAlertIcon className="w-6 h-6 text-indigo-600" /> Mensagens & Sugestões</h2>}>
            <Head title="Avisos e Recompensas - WaitLess" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20 space-y-8">
                
                {/* AVISOS DO SISTEMA */}
                {flash?.success && <div className="p-4 text-green-800 bg-green-100 border border-green-200 rounded-xl shadow-sm animate-in fade-in">✨ {flash.success}</div>}
                {flash?.error && <div className="p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl shadow-sm animate-in fade-in">❌ {flash.error}</div>}
                {flash?.warning && <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-xl shadow-sm animate-in fade-in">⚠️ {flash.warning}</div>}

                {/* HEADER GAMIFICADO */}
                <div className="bg-gray-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                    <SparklesIcon className="absolute -top-10 -right-10 w-48 h-48 text-yellow-500 opacity-20 pointer-events-none animate-pulse" />
                    <div className="relative z-10">
                        <h3 className="text-2xl font-black mb-2 tracking-tight">O seu inventário está pronto!</h3>
                        <p className="text-gray-400">Aqui ficam os cupons que você já resgatou e sugestões de onde usar o seu saldo.</p>
                    </div>
                    <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl text-center shrink-0">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Seu Saldo</p>
                        <p className="text-3xl font-black text-yellow-400 flex items-center justify-center gap-1">
                            {pontosAtuais} <StarIcon className="w-6 h-6 text-yellow-500" />
                        </p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* ============================================================== */}
                    {/* LADO ESQUERDO: MEUS CUPONS (PARA USAR NA LOJA)                 */}
                    {/* ============================================================== */}
                    <div className="w-full lg:w-5/12 space-y-6">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-200 pb-3">
                            <TicketIcon className="w-6 h-6 text-indigo-500" /> Prontos para Uso
                        </h3>

                        {meusCupons.length === 0 ? (
                            <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-10 text-center shadow-sm">
                                <span className="text-5xl opacity-30 block mb-4">🎟️</span>
                                <h4 className="text-lg font-bold text-gray-700">Seus bolsos estão vazios</h4>
                                <p className="text-sm text-gray-500 mt-2">Você ainda não resgatou nenhum cupom com os seus pontos. Veja as sugestões ao lado!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {meusCupons.map(cupom => (
                                    <div key={cupom.id} className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg shadow-sm">Ativo</div>
                                        
                                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">{cupom.estabelecimento?.nome}</p>
                                        <h4 className="font-black text-gray-900 text-lg leading-tight mb-4">{cupom.titulo}</h4>
                                        
                                        <div className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-3 text-center mb-4">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Seu Código Exclusivo</p>
                                            <span className="font-mono text-2xl font-black text-indigo-700 tracking-[0.2em]">{cupom.codigo}</span>
                                        </div>

                                        {/* 👉 BOTÃO "USAR AGORA" COM DADOS NA URL */}
                                        <Link 
                                            href={route('cliente.agendar', {
                                                estabelecimento: cupom.estabelecimento_id,
                                                cupom: cupom.codigo,
                                                desconto: cupom.valor_desconto,
                                                tipo_desconto: cupom.tipo_desconto
                                            })}
                                            className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-center text-sm font-bold rounded-xl shadow-sm transition transform hover:-translate-y-0.5"
                                        >
                                            Usar Cupom Agora 🚀
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ============================================================== */}
                    {/* LADO DIREITO: SUGESTÕES INTELIGENTES DA PLATAFORMA             */}
                    {/* ============================================================== */}
                    <div className="flex-1 space-y-6">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 border-b border-gray-200 pb-3">
                            <SparklesIcon className="w-6 h-6 text-yellow-500" /> Recomendados para si
                        </h3>

                        {sugestoesLojas.length === 0 ? (
                            <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
                                <h4 className="text-lg font-bold text-gray-700">Sem sugestões no momento.</h4>
                                <p className="text-sm text-gray-500 mt-2">Continue a fazer agendamentos para o nosso algoritmo lhe recomendar as melhores ofertas!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {sugestoesLojas.map(loja => {
                                    // Pega um cupom dessa loja que o cliente consiga comprar
                                    const cupomDestaque = loja.cupons.find(c => c.pontos_custo <= pontosAtuais);
                                    if (!cupomDestaque) return null;

                                    const isResgatando = processandoResgate === cupomDestaque.id;

                                    return (
                                        <div key={loja.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
                                            <div className="p-5 border-b border-gray-50">
                                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                                    <ScissorsIcon className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <h4 className="font-black text-lg text-gray-900 leading-tight">{loja.nome}</h4>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPinIcon className="w-3 h-3"/> Veja o que preparamos para si!</p>
                                            </div>
                                            
                                            <div className="p-5 bg-orange-50/30 flex-1 flex flex-col justify-between border-b border-orange-100">
                                                <div>
                                                    <span className="inline-block bg-orange-100 text-orange-800 text-[10px] font-black uppercase px-2 py-0.5 rounded mb-2">Desconto Disponível</span>
                                                    <h5 className="font-bold text-gray-900 text-md leading-tight">{cupomDestaque.titulo}</h5>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cupomDestaque.descricao}</p>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-orange-100/50 flex justify-between items-center">
                                                    <span className="font-black text-orange-600 flex items-center gap-1">
                                                        <StarIcon className="w-4 h-4"/> {cupomDestaque.pontos_custo} pts
                                                    </span>
                                                    <span className="font-black text-green-600 text-sm">
                                                        {cupomDestaque.tipo_desconto === 'percentual' ? `${Number(cupomDestaque.valor_desconto)}% OFF` : `R$ ${Number(cupomDestaque.valor_desconto).toFixed(0)} OFF`}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="p-3 bg-white text-center">
                                                {/* 👉 TRAVA DE CLIQUE: Botão fica desativado enquanto o Inertia faz o post */}
                                                <button 
                                                    onClick={() => resgatarCupom(cupomDestaque)} 
                                                    disabled={isResgatando || processandoResgate !== null}
                                                    className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex justify-center items-center gap-2"
                                                >
                                                    {isResgatando ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                            Resgatando...
                                                        </>
                                                    ) : 'Resgatar Agora'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}