import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { 
    MagnifyingGlassIcon, FunnelIcon, ShieldCheckIcon, UserGroupIcon, DocumentTextIcon, GiftIcon, PaperAirplaneIcon 
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/solid';

export default function Mensagens({ auth, conversas = [], conversaAtiva = null, mensagensFiltradas = [] }) {
    const [busca, setBusca] = useState('');
    const scrollRef = useRef(null);

    const { data, setData, post, reset, processing } = useForm({
        conteudo: '',
    });

    const conversasFiltradas = conversas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [mensagensFiltradas]);

    const enviarMensagem = (e) => {
        e.preventDefault();
        if (!data.conteudo.trim()) return;

        post(route('mensagens.enviar', { id: conversaAtiva.id }), {
            preserveScroll: true,
            onSuccess: () => reset('conteudo'),
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Conversas" />

            <div className="flex h-[calc(100vh-65px)] w-full overflow-hidden bg-[#FBF9F9]">
                
                {/* LADO ESQUERDO: BARRA LATERAL */}
                <div className="w-full md:w-[380px] flex flex-col bg-white border-r border-gray-100 h-full relative z-10 shadow-sm flex-shrink-0">
                    <div className="p-5 pb-4">
                        <h1 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">Conversas</h1>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mr-2" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar conversas ou contatos" 
                                    className="bg-transparent border-none p-0 text-sm w-full text-gray-700 outline-none focus:ring-0"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </div>
                            <button className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-400">
                                <FunnelIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-36 custom-scrollbar">
                        {conversasFiltradas.length === 0 ? (
                            <div className="text-center text-sm text-gray-400 mt-10">Nenhuma conversa encontrada.</div>
                        ) : (
                            conversasFiltradas.map((conversa) => (
                                <Link 
                                    key={conversa.id}
                                    href={route('mensagens.show', { id: conversa.id })} 
                                    className={`flex items-center gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors group ${conversaAtiva?.id === conversa.id ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        {conversa.avatar ? (
                                            <img src={conversa.avatar} alt={conversa.nome} className="w-11 h-11 rounded-full object-cover shadow-sm" />
                                        ) : (
                                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${conversa.bg_color}`}>
                                                {conversa.iniciais}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-sm font-bold truncate text-gray-900">{conversa.nome}</span>
                                            <span className="text-[11px] text-gray-400 font-medium">{conversa.tempo}</span>
                                        </div>
                                        <p className="text-[13px] truncate text-gray-500">{conversa.ultima_mensagem}</p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* LADO DIREITO */}
                <div className="hidden md:flex flex-col flex-1 bg-[#FBF9F9] relative h-full">
                    {!conversaAtiva ? (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.02)] border border-gray-100 p-12 text-center">
                                <div className="flex justify-center items-center gap-3 mb-8">
                                    <div className="bg-gray-100 text-gray-400 p-4 rounded-3xl rounded-br-none mt-6"><EllipsisHorizontalIcon className="w-8 h-8" /></div>
                                    <div className="bg-[#006B4D] text-white p-5 rounded-3xl rounded-bl-none mb-6"><EllipsisHorizontalIcon className="w-10 h-10" /></div>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecione uma conversa</h2>
                                <p className="text-sm text-gray-500 mb-12">Escolha uma conversa na lista ao lado para ver suas mensagens.</p>
                                <div className="grid grid-cols-3 gap-8">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><ShieldCheckIcon className="w-6 h-6 text-[#006B4D]" /></div>
                                        <h3 className="text-xs font-bold text-gray-900 mb-2">Protegido</h3>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><UserGroupIcon className="w-6 h-6 text-[#006B4D]" /></div>
                                        <h3 className="text-xs font-bold text-gray-900 mb-2">Conectado</h3>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><DocumentTextIcon className="w-6 h-6 text-[#006B4D]" /></div>
                                        <h3 className="text-xs font-bold text-gray-900 mb-2">Compartilhe</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-white shadow-sm border-x border-gray-100">
                            <div className="h-[72px] border-b border-gray-100 flex items-center px-6 bg-white flex-shrink-0 shadow-sm z-10">
                                <div className="flex items-center gap-3">
                                    {conversaAtiva.avatar ? (
                                        <img src={conversaAtiva.avatar} alt={conversaAtiva.nome} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${conversaAtiva.bg_color}`}>
                                            {conversaAtiva.iniciais}
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900">{conversaAtiva.nome}</h2>
                                        <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-[#FBF9F9] space-y-4 custom-scrollbar">
                                {mensagensFiltradas.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="bg-emerald-50 text-emerald-700 font-semibold px-4 py-2 rounded-full text-xs border border-emerald-100">Envie uma mensagem para iniciar a conversa!</span>
                                    </div>
                                ) : (
                                    mensagensFiltradas.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-[1.25rem] px-5 py-3 relative shadow-sm ${msg.is_mine ? 'bg-[#006B4D] text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                                                <p className="text-[13px] leading-relaxed">{msg.conteudo}</p>
                                                <span className={`text-[10px] block mt-1.5 text-right font-medium ${msg.is_mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                                                    {msg.horario}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
                                <form onSubmit={enviarMensagem} className="flex items-end gap-3">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-[#006B4D] transition-all">
                                        <textarea
                                            value={data.conteudo}
                                            onChange={e => setData('conteudo', e.target.value)}
                                            placeholder="Digite a sua mensagem..."
                                            className="w-full max-h-32 min-h-[44px] bg-transparent border-none text-sm text-gray-700 focus:ring-0 resize-none outline-none py-2 px-2 custom-scrollbar"
                                            rows="1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    enviarMensagem(e);
                                                }
                                            }}
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={processing || !data.conteudo.trim()}
                                        className="h-[60px] w-[60px] rounded-2xl bg-[#006B4D] hover:bg-[#00553D] text-white flex items-center justify-center flex-shrink-0 shadow-md transition disabled:opacity-50"
                                    >
                                        <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #E5E7EB; border-radius: 10px; }
            `}} />
        </AuthenticatedLayout>
    );
}