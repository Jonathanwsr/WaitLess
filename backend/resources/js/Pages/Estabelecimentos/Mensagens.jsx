import React, { useState, useEffect, useRef, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import {
    MagnifyingGlassIcon, PaperAirplaneIcon, PaperClipIcon, FaceSmileIcon,
    ChatBubbleLeftRightIcon, ChevronLeftIcon, StarIcon as StarOutlineIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const PAPEIS_EQUIPE = ['admin', 'socio', 'sócio', 'gerente', 'proprietario', 'proprietário', 'atendente', 'funcionario', 'funcionário', 'profissional'];

const ABAS = [
    { id: 'todas', label: 'Todas' },
    { id: 'nao_lidas', label: 'Não lidas' },
    { id: 'favoritas', label: 'Favoritas' },
];

function formatarSeparadorData(dataStr) {
    if (!dataStr) return '';
    const [d, m, y] = dataStr.split('/').map(Number);
    const data = new Date(y, m - 1, d);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const mesmoDia = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const extenso = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (mesmoDia(data, hoje)) return `Hoje, ${extenso}`;
    if (mesmoDia(data, ontem)) return `Ontem, ${extenso}`;
    return extenso;
}

export default function Mensagens({ auth, conversas = [], conversaAtiva = null, mensagensFiltradas = [] }) {
    const [busca, setBusca] = useState('');
    const [aba, setAba] = useState('todas');
    const scrollRef = useRef(null);

    const { data, setData, post, reset, processing } = useForm({ conteudo: '' });

    const souEquipe = PAPEIS_EQUIPE.includes(String(auth.user?.papel || '').toLowerCase());

    const contagem = useMemo(() => ({
        todas: conversas.length,
        nao_lidas: conversas.filter((c) => c.nao_lidas > 0).length,
        favoritas: conversas.filter((c) => c.favorito).length,
    }), [conversas]);

    const conversasFiltradas = useMemo(() => {
        let lista = conversas;
        if (aba === 'nao_lidas') lista = lista.filter((c) => c.nao_lidas > 0);
        if (aba === 'favoritas') lista = lista.filter((c) => c.favorito);
        if (busca.trim()) {
            const termo = busca.trim().toLowerCase();
            lista = lista.filter((c) =>
                c.nome.toLowerCase().includes(termo) ||
                (c.contexto || '').toLowerCase().includes(termo) ||
                (c.ultima_mensagem || '').toLowerCase().includes(termo)
            );
        }
        return lista;
    }, [conversas, aba, busca]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [mensagensFiltradas]);

    // Tempo real: mesmo canal privado que já alimenta o sino de notificações
    // em AuthenticatedLayout — ao chegar mensagem nova (de qualquer
    // conversa), atualiza a lista e, se for a conversa aberta, a thread
    // também (o reload também marca as mensagens como lidas, já que revisita
    // a mesma rota mensagens.show).
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;

        const canal = window.Echo.private(`App.Models.User.${auth.user.id}`);
        canal.listen('.mensagem.recebida', () => {
            router.reload({ only: ['conversas', 'mensagensFiltradas'], preserveScroll: true, preserveState: true });
        });

        return () => window.Echo.leave(`App.Models.User.${auth.user.id}`);
    }, [auth.user?.id]);

    const enviarMensagem = (e) => {
        e.preventDefault();
        if (!data.conteudo.trim() || !conversaAtiva) return;

        post(route('mensagens.enviar', { id: conversaAtiva.id }), {
            preserveScroll: true,
            onSuccess: () => reset('conteudo'),
        });
    };

    const alternarFavorito = (conversaId) => {
        router.post(route('mensagens.favoritar', conversaId), {}, { preserveScroll: true, preserveState: true });
    };

    const subtitulo = souEquipe
        ? 'Converse com seus clientes e tire dúvidas sobre os serviços.'
        : 'Converse com os proprietários e tire suas dúvidas sobre os serviços.';

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Mensagens" />

            <div className="flex h-[calc(100vh-73px)] w-full overflow-hidden bg-gray-50">

                {/* LISTA DE CONVERSAS */}
                <div className={`w-full md:w-[380px] lg:w-[400px] flex flex-col bg-white border-r border-gray-100 h-full flex-shrink-0 ${conversaAtiva ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-5 pb-4 border-b border-gray-50">
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mensagens</h1>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{subtitulo}</p>

                        <div className="flex items-center gap-2 mt-4 overflow-x-auto custom-scrollbar pb-0.5">
                            {ABAS.map(({ id, label }) => (
                                <button
                                    key={id}
                                    onClick={() => setAba(id)}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap shrink-0 ${
                                        aba === id ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {label}
                                    {contagem[id] > 0 && (
                                        <span className={`min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] ${
                                            aba === id ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
                                        }`}>
                                            {contagem[id]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mt-4 focus-within:ring-2 focus-within:ring-[#FF5A00]/20 focus-within:border-[#FF5A00] transition-all">
                            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                            <input
                                type="text"
                                placeholder="Buscar conversa..."
                                className="bg-transparent border-none p-0 text-sm w-full text-gray-700 placeholder-gray-400 focus:ring-0 outline-none"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
                        {conversasFiltradas.length === 0 ? (
                            <div className="text-center text-sm text-gray-400 mt-10 px-6">
                                {aba === 'favoritas' ? 'Nenhuma conversa favoritada.' : aba === 'nao_lidas' ? 'Nenhuma mensagem não lida.' : 'Nenhuma conversa ainda.'}
                            </div>
                        ) : (
                            conversasFiltradas.map((conversa) => (
                                <div
                                    key={conversa.id}
                                    className={`relative group mx-1 mb-1 rounded-xl transition-colors ${conversaAtiva?.id === conversa.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                                >
                                    <Link href={route('mensagens.show', conversa.id)} className="flex items-center gap-3 p-3 pr-10">
                                        <div className="relative flex-shrink-0">
                                            {conversa.avatar ? (
                                                <img src={conversa.avatar} alt={conversa.nome} className="w-12 h-12 rounded-full object-cover" />
                                            ) : (
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${conversa.bg_color}`}>
                                                    {conversa.iniciais}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className={`text-sm truncate ${conversa.nao_lidas > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                                    {conversa.nome}
                                                </span>
                                                <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{conversa.tempo}</span>
                                            </div>

                                            {(conversa.contexto || conversa.funcionario_nome) && (
                                                <p className="text-[11px] text-[#FF5A00] font-semibold truncate mt-0.5">
                                                    {conversa.contexto}
                                                    {conversa.contexto && conversa.funcionario_nome && ' · '}
                                                    {conversa.funcionario_nome}
                                                </p>
                                            )}

                                            <div className="flex justify-between items-center mt-0.5">
                                                <p className={`text-[13px] truncate pr-2 ${conversa.nao_lidas > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                    {conversa.ultima_mensagem}
                                                </p>
                                                {conversa.nao_lidas > 0 && (
                                                    <span className="w-5 h-5 rounded-full bg-[#FF5A00] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {conversa.nao_lidas}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>

                                    <button
                                        onClick={() => alternarFavorito(conversa.id)}
                                        title={conversa.favorito ? 'Remover dos favoritos' : 'Favoritar conversa'}
                                        className={`absolute top-3 right-2 p-1.5 rounded-full transition ${conversa.favorito ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-gray-100`}
                                    >
                                        {conversa.favorito ? <StarSolidIcon className="w-4 h-4 text-amber-400" /> : <StarOutlineIcon className="w-4 h-4 text-gray-300" />}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* THREAD ATIVA */}
                <div className={`flex-col flex-1 bg-gray-50 relative h-full ${conversaAtiva ? 'flex' : 'hidden md:flex'}`}>
                    {!conversaAtiva ? (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="max-w-md text-center">
                                <div className="w-20 h-20 rounded-3xl bg-orange-50 flex items-center justify-center mx-auto mb-6">
                                    <ChatBubbleLeftRightIcon className="w-10 h-10 text-[#FF5A00]" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Selecione uma conversa</h2>
                                <p className="text-sm text-gray-500">Escolha uma conversa na lista ao lado para ver as mensagens.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="border-b border-gray-100 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-white flex-shrink-0 shadow-sm z-10">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Link href={route('mensagens.index')} className="md:hidden text-gray-400 hover:text-gray-700 shrink-0">
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </Link>
                                    {conversaAtiva.avatar ? (
                                        <img src={conversaAtiva.avatar} alt={conversaAtiva.nome} className="w-10 h-10 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${conversaAtiva.bg_color}`}>
                                            {conversaAtiva.iniciais}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-bold text-gray-900 truncate">{conversaAtiva.nome}</h2>
                                        {(conversaAtiva.contexto || conversaAtiva.funcionario_nome) && (
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {conversaAtiva.contexto}
                                                {conversaAtiva.contexto && conversaAtiva.funcionario_nome && ' · '}
                                                {conversaAtiva.funcionario_nome}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => alternarFavorito(conversaAtiva.id)}
                                        className="p-2 rounded-lg hover:bg-gray-100 transition"
                                        title={conversaAtiva.favorito ? 'Remover dos favoritos' : 'Favoritar conversa'}
                                    >
                                        {conversaAtiva.favorito ? <StarSolidIcon className="w-5 h-5 text-amber-400" /> : <StarOutlineIcon className="w-5 h-5 text-gray-400" />}
                                    </button>
                                    {conversaAtiva.perfil_href && (
                                        <Link
                                            href={conversaAtiva.perfil_href}
                                            className="text-xs font-bold text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition whitespace-nowrap"
                                        >
                                            Ver perfil
                                        </Link>
                                    )}
                                </div>
                            </div>

                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                                {mensagensFiltradas.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="bg-white text-gray-500 font-medium px-4 py-2 rounded-full text-xs border border-gray-200 shadow-sm">
                                            Envie uma mensagem para iniciar a conversa!
                                        </span>
                                    </div>
                                ) : (
                                    mensagensFiltradas.map((msg, idx) => {
                                        const anterior = mensagensFiltradas[idx - 1];
                                        const mostrarSeparador = !anterior || anterior.data !== msg.data;
                                        return (
                                            <React.Fragment key={msg.id}>
                                                {mostrarSeparador && (
                                                    <div className="flex justify-center my-4">
                                                        <span className="bg-white text-gray-500 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                                                            {formatarSeparadorData(msg.data)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className={`flex mb-2 ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                                    <div
                                                        className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                                            msg.is_mine ? 'bg-[#FFE9DB] text-gray-900 rounded-br-md' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md'
                                                        }`}
                                                    >
                                                        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>
                                                        <span className="text-[10px] block mt-1 text-right font-medium text-gray-400">{msg.horario}</span>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>

                            <div className="p-3 sm:p-4 bg-white border-t border-gray-100 flex-shrink-0">
                                <form onSubmit={enviarMensagem} className="flex items-center gap-2">
                                    <span className="text-gray-300 p-2 shrink-0 hidden sm:inline-flex" title="Anexos em breve">
                                        <PaperClipIcon className="w-5 h-5" />
                                    </span>
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 flex items-center focus-within:ring-2 focus-within:ring-[#FF5A00]/20 focus-within:border-[#FF5A00] transition-all">
                                        <input
                                            type="text"
                                            value={data.conteudo}
                                            onChange={(e) => setData('conteudo', e.target.value)}
                                            placeholder="Digite sua mensagem..."
                                            className="w-full bg-transparent border-none text-sm text-gray-700 focus:ring-0 outline-none py-3"
                                        />
                                    </div>
                                    <span className="text-gray-300 p-2 shrink-0 hidden sm:inline-flex" title="Emojis em breve">
                                        <FaceSmileIcon className="w-5 h-5" />
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={processing || !data.conteudo.trim()}
                                        className="h-11 w-11 rounded-full bg-[#FF5A00] hover:bg-orange-600 text-white flex items-center justify-center flex-shrink-0 shadow-md transition disabled:opacity-50"
                                    >
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #E5E7EB; border-radius: 10px; }
            ` }} />
        </AuthenticatedLayout>
    );
}
