import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { 
    MagnifyingGlassIcon, 
    FunnelIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    DocumentTextIcon,
    GiftIcon
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/solid';

export default function MensagensIndex({ auth, conversas }) {
    const [busca, setBusca] = useState('');

    const conversasFiltradas = conversas.filter(c => 
        c.nome.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Mensagens" />

            {/* Container Principal que ocupa a tela toda (descontando o header se houver) */}
            <div className="flex h-[calc(100vh-73px)] w-full overflow-hidden bg-[#FBF9F9]">
                
                {/* ========================================== */}
                {/* SIDEBAR ESQUERDA - LISTA DE CONVERSAS */}
                {/* ========================================== */}
                <div className="w-full md:w-[380px] flex flex-col bg-white border-r border-gray-100 h-full relative z-10 shadow-sm">
                    
                    {/* Header do Sidebar */}
                    <div className="p-5 pb-4">
                        <h1 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">Conversas</h1>
                        
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mr-2" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar conversas ou contatos" 
                                    className="bg-transparent border-none p-0 text-sm w-full text-gray-700 placeholder-gray-400 focus:ring-0 outline-none"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </div>
                            <button className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-400 transition-colors shadow-sm">
                                <FunnelIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Lista de Chats (Rolável) */}
                    <div className="flex-1 overflow-y-auto px-2 pb-32">
                        {conversasFiltradas.map((conversa) => (
                            <Link 
                                href={route('mensagens.show', conversa.id)} 
                                key={conversa.id}
                                className="flex items-center gap-3 p-3 mx-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {conversa.avatar ? (
                                        <img src={conversa.avatar} alt={conversa.nome} className="w-11 h-11 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg ${conversa.bg_color}`}>
                                            {conversa.iniciais}
                                        </div>
                                    )}
                                </div>

                                {/* Textos */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <div className="flex items-center gap-1 truncate">
                                            <span className={`text-sm font-bold truncate ${conversa.nao_lidas > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                                {conversa.nome}
                                            </span>
                                            {conversa.is_verified && (
                                                <CheckBadgeIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        <span className={`text-[11px] whitespace-nowrap ml-2 font-medium ${conversa.nao_lidas > 0 ? 'text-emerald-500 font-bold' : 'text-gray-400'}`}>
                                            {conversa.tempo}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <p className={`text-[13px] truncate pr-2 ${conversa.nao_lidas > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                            {conversa.ultima_mensagem}
                                        </p>
                                        {conversa.nao_lidas > 0 && (
                                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                                                {conversa.nao_lidas}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Banner Fixo no Rodapé */}
                    <div className="absolute bottom-4 left-4 right-4 bg-emerald-50 rounded-2xl p-4 border border-emerald-100 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-0.5">Convide seus amigos</h4>
                                <p className="text-[11px] text-gray-600 leading-tight">Compartilhe o SaúdeMais e ganhe<br/>benefícios!</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <GiftIcon className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                        <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-sm transition-colors w-max">
                            Convidar amigos
                        </button>
                    </div>
                </div>

                {/* ========================================== */}
                {/* ÁREA DIREITA - PLACEHOLDER CENTRALIZADO */}
                {/* ========================================== */}
                <div className="hidden md:flex flex-1 items-center justify-center p-8 bg-[#FBF9F9]">
                    <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-12 text-center animate-fadeIn">
                        
                        {/* Ilustração das Bolhas de Chat */}
                        <div className="flex justify-center items-center gap-3 mb-8">
                            <div className="bg-gray-200 text-gray-400 p-4 rounded-3xl rounded-br-none mt-6 shadow-inner">
                                <EllipsisHorizontalIcon className="w-8 h-8" />
                            </div>
                            <div className="bg-emerald-600 text-white p-5 rounded-3xl rounded-bl-none shadow-lg mb-6">
                                <EllipsisHorizontalIcon className="w-10 h-10" />
                            </div>
                        </div>

                        {/* Título e Subtítulo */}
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecione uma conversa</h2>
                        <p className="text-sm text-gray-500 mb-12 max-w-sm mx-auto">
                            Escolha uma conversa na lista ao lado para ver as mensagens.
                        </p>

                        {/* Colunas de Features */}
                        <div className="grid grid-cols-3 gap-8">
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
                                    <ShieldCheckIcon className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-900 mb-2">Protegido</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed max-w-[140px]">
                                    Suas mensagens pessoais são protegidas com criptografia de ponta a ponta.
                                </p>
                            </div>

                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
                                    <UserGroupIcon className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-900 mb-2">Conectado</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed max-w-[140px]">
                                    Fale com seus contatos e mantenha-se sempre conectado.
                                </p>
                            </div>

                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
                                    <DocumentTextIcon className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-900 mb-2">Compartilhe</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed max-w-[140px]">
                                    Envie documentos, fotos, localizações e muito mais de forma rápida.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}