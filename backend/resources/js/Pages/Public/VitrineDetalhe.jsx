import { useState } from 'react';
import { Link, Head } from '@inertiajs/react';
import {
    HiArrowLeft,
    HiArrowRight,
    HiOutlineLocationMarker,
    HiOutlineClock,
    HiOutlineTag,
    HiOutlinePhotograph,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiStar,
    HiOutlineStar,
    HiOutlineChatAlt2,
    HiOutlineShieldCheck,
    HiOutlineBadgeCheck,
    HiOutlineChatAlt,
    HiOutlineSparkles,
} from 'react-icons/hi';

function formatarPreco(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function Estrelas({ nota, tamanho = 'w-4 h-4' }) {
    const cheias = Math.round(nota || 0);

    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((posicao) =>
                posicao <= cheias ? (
                    <HiStar key={posicao} className={`${tamanho} text-orange-500`} />
                ) : (
                    <HiOutlineStar key={posicao} className={`${tamanho} text-gray-300`} />
                )
            )}
        </div>
    );
}

function Galeria({ fotos, nome, categoria }) {
    const [indice, setIndice] = useState(0);
    const temFotos = fotos && fotos.length > 0;

    return (
        <div className="relative w-full h-[280px] sm:h-[380px] md:h-[520px] rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 shadow-sm">
            {temFotos ? (
                <img
                    src={fotos[indice]}
                    alt={nome}
                    className="w-full h-full object-cover animate-[fadeIn_0.5s_ease]"
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <HiOutlinePhotograph className="w-16 h-16 text-orange-300" />
                    <span className="text-sm font-medium text-orange-300">Sem fotos disponíveis ainda</span>
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

            {categoria && (
                <span className="absolute top-4 left-4 bg-white/90 backdrop-blur text-[#F26522] text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full shadow-sm">
                    {categoria}
                </span>
            )}

            {temFotos && fotos.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => setIndice((atual) => (atual - 1 + fotos.length) % fotos.length)}
                        aria-label="Foto anterior"
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-lg transition hover:scale-105"
                    >
                        <HiOutlineChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIndice((atual) => (atual + 1) % fotos.length)}
                        aria-label="Próxima foto"
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-lg transition hover:scale-105"
                    >
                        <HiOutlineChevronRight className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {fotos.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setIndice(i)}
                                aria-label={`Ver foto ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === indice ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function Pilula({ icon: Icone, children }) {
    return (
        <span className="inline-flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-full px-4 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">
            <Icone className="w-4 h-4 text-[#F26522] flex-shrink-0" />
            {children}
        </span>
    );
}

export default function VitrineDetalhe({ item, avaliacoes = [], canRegister = true }) {
    return (
        <>
            <Head title={`${item.nome} - Lokyva`} />

            <div className="min-h-screen bg-[#FFF9F5] text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
                <nav className="sticky top-0 z-30 backdrop-blur-xl bg-[#FFF9F5]/80 border-b border-orange-100/60">
                    <div className="max-w-6xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
                            <img
                                src="/images/logo_lokyva.png"
                                alt="Logo Lokyva"
                                className="h-8 w-auto object-contain transform group-hover:scale-105 transition"
                            />
                            <span className="text-lg font-bold text-gray-900 tracking-tight">Lokyva</span>
                        </Link>

                        <div className="flex items-center gap-3 md:gap-5">
                            <Link
                                href="/"
                                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-orange-500 transition"
                            >
                                <HiArrowLeft className="w-4 h-4" />
                                Voltar ao catálogo
                            </Link>
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="bg-[#F26522] hover:bg-[#d95a1e] hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300 text-white px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap"
                                >
                                    Criar conta
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>

                <main className="max-w-6xl mx-auto px-6 md:px-12 py-8 md:py-10 pb-24">
                    <Galeria
                        fotos={item.fotos}
                        nome={item.nome}
                        categoria={item.tipo === 'aluguel' ? 'Aluguel' : 'Serviço'}
                    />

                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-2">
                            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                                {item.nome}
                            </h1>

                            <div className="flex flex-wrap items-center gap-3 mb-8">
                                {item.total_avaliacoes > 0 ? (
                                    <Pilula icon={HiStar}>
                                        {item.avaliacao_media.toFixed(1)} · {item.total_avaliacoes} avaliação{item.total_avaliacoes > 1 ? 'ões' : ''}
                                    </Pilula>
                                ) : (
                                    <Pilula icon={HiOutlineSparkles}>Novidade por aqui</Pilula>
                                )}

                                {item.duracao_minutos && (
                                    <Pilula icon={HiOutlineClock}>{item.duracao_minutos} min</Pilula>
                                )}

                                {(item.estabelecimento || item.endereco) && (
                                    <Pilula icon={HiOutlineLocationMarker}>
                                        {[item.estabelecimento, item.endereco].filter(Boolean).join(' • ')}
                                    </Pilula>
                                )}
                            </div>

                            {item.descricao && (
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 mb-10">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">Sobre</h2>
                                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{item.descricao}</p>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <HiOutlineChatAlt2 className="w-5 h-5 text-[#F26522]" />
                                        Avaliações
                                    </h2>

                                    {item.total_avaliacoes > 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-extrabold text-gray-900">
                                                {item.avaliacao_media.toFixed(1)}
                                            </span>
                                            <Estrelas nota={item.avaliacao_media} />
                                        </div>
                                    )}
                                </div>

                                {avaliacoes.length > 0 ? (
                                    <div className="space-y-5">
                                        {avaliacoes.map((avaliacao) => (
                                            <div
                                                key={avaliacao.id}
                                                className="border border-gray-100 bg-white rounded-2xl p-5 hover:shadow-md hover:shadow-orange-500/5 transition-shadow"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        {avaliacao.foto_usuario ? (
                                                            <img
                                                                src={avaliacao.foto_usuario}
                                                                alt={avaliacao.usuario}
                                                                className="w-10 h-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center font-bold text-sm">
                                                                {(avaliacao.usuario || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-sm">{avaliacao.usuario || 'Cliente Lokyva'}</p>
                                                            <p className="text-xs text-gray-400">{avaliacao.criado_em}</p>
                                                        </div>
                                                    </div>
                                                    <Estrelas nota={avaliacao.nota} tamanho="w-3.5 h-3.5" />
                                                </div>

                                                {avaliacao.comentario && (
                                                    <p className="text-gray-600 text-sm leading-relaxed mt-2">{avaliacao.comentario}</p>
                                                )}

                                                {avaliacao.resposta_anfitriao && (
                                                    <div className="mt-3 ml-4 pl-4 border-l-2 border-orange-200 flex gap-2">
                                                        <HiOutlineChatAlt className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-500 mb-1">Resposta do estabelecimento</p>
                                                            <p className="text-sm text-gray-600">{avaliacao.resposta_anfitriao}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                                        Este item ainda não recebeu avaliações públicas.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-1">
                            <div className="sticky top-24 p-[1.5px] bg-gradient-to-br from-orange-300 via-orange-100 to-white rounded-3xl shadow-lg shadow-orange-500/5">
                                <div className="bg-white rounded-[calc(1.5rem-1.5px)] p-6 md:p-7">
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <HiOutlineTag className="w-5 h-5 text-[#F26522]" />
                                        <span className="text-3xl font-extrabold text-gray-900">{formatarPreco(item.valor)}</span>
                                        {item.periodo && <span className="text-sm text-gray-400">/{item.periodo}</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Preço de referência informado pelo estabelecimento parceiro.
                                    </p>

                                    {canRegister && (
                                        <Link
                                            href={route('register')}
                                            className="w-full inline-flex items-center justify-center gap-2 bg-[#F26522] hover:bg-[#d95a1e] hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] transition-all duration-300 text-white px-6 py-3.5 rounded-xl font-semibold"
                                        >
                                            Reservar
                                            <HiArrowRight className="w-4 h-4" />
                                        </Link>
                                    )}
                                    <p className="text-xs text-gray-400 text-center mt-3 mb-6">
                                        Crie sua conta grátis para concluir a reserva.
                                    </p>

                                    <div className="space-y-3 pt-5 border-t border-gray-100">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <HiOutlineShieldCheck className="w-4 h-4 text-[#F26522] flex-shrink-0" />
                                            Pagamento processado com segurança
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <HiOutlineBadgeCheck className="w-4 h-4 text-[#F26522] flex-shrink-0" />
                                            Estabelecimento verificado pela Lokyva
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <HiOutlineSparkles className="w-4 h-4 text-[#F26522] flex-shrink-0" />
                                            Ganhe pontos a cada reserva concluída
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="border-t border-orange-100 py-8 px-6 md:px-12">
                    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
                        <span>&copy; 2026 Lokyva Tecnologia S.A. Todos os direitos reservados.</span>
                        <Link href="/" className="font-semibold text-[#F26522] hover:underline">
                            Explorar mais serviços e aluguéis
                        </Link>
                    </div>
                </footer>
            </div>
        </>
    );
}
