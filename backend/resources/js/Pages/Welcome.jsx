import { Link, Head } from '@inertiajs/react';

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="WaitLess - Gerenciamento Inteligente de Filas" />
            
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-500 selection:text-white">
                
                {/* --- Navbar --- */}
                <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center gap-2">
                        {/* Ícone Simples do Logo */}
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                            W
                        </div>
                        <span className="text-xl font-bold tracking-tight text-gray-900">WaitLess</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {canLogin ? (
                            <>
                                {auth?.user ? (
                                    <Link
                                        href={route('dashboard')}
                                        className="font-semibold text-gray-600 hover:text-indigo-600 transition"
                                    >
                                        Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={route('login')}
                                            className="font-medium text-gray-600 hover:text-indigo-600 transition"
                                        >
                                            Entrar
                                        </Link>

                                        {canRegister && (
                                            <Link
                                                href={route('register')}
                                                className="px-5 py-2.5 rounded-full bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition shadow-lg shadow-gray-900/20"
                                            >
                                                Criar Conta
                                            </Link>
                                        )}
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>
                </nav>

                {/* --- Hero Section --- */}
                <main className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-12 items-center">
                    
                    {/* Texto e CTA */}
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold border border-indigo-100">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                            Novidade: Painel em Tempo Real
                        </div>
                        
                        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
                            O fim das filas <br />
                            <span className="text-indigo-600">intermináveis.</span>
                        </h1>
                        
                        <p className="text-lg text-gray-600 max-w-lg leading-relaxed">
                            Otimize o atendimento do seu negócio com o WaitLess. 
                            Gerenciamento de senhas, métricas em tempo real e integração futura com mobile.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="px-8 py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 text-center"
                                >
                                    Começar Agora
                                </Link>
                            )}
                            <button className="px-8 py-4 rounded-xl bg-white text-gray-700 border border-gray-200 font-bold text-lg hover:bg-gray-50 transition text-center">
                                Ver Demonstração
                            </button>
                        </div>

                        <div className="pt-8 flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex -space-x-2">
                                {/* Avatares fake para prova social */}
                                <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white"></div>
                                <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></div>
                                <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-white"></div>
                            </div>
                            <p>Mais de <strong className="text-gray-900">500 atendimentos</strong> gerenciados hoje.</p>
                        </div>
                    </div>

                    {/* Ilustração / Mockup Abstrato */}
                    <div className="relative">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                        
                        <div className="relative bg-white/60 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
                            {/* Simulando interface do app */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                                <div className="h-8 w-8 bg-indigo-100 rounded-full"></div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">A</div>
                                        <div>
                                            <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                            <div className="h-2 w-12 bg-gray-100 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-green-600 font-bold">Chamando</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 opacity-60">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">B</div>
                                        <div>
                                            <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                            <div className="h-2 w-12 bg-gray-100 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-gray-400 font-bold">Na Fila</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 opacity-40">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">C</div>
                                        <div>
                                            <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                            <div className="h-2 w-12 bg-gray-100 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-gray-400 font-bold">Na Fila</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* --- Features Grid --- */}
                <section className="bg-white py-24 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6 md:px-12">
                        <div className="grid md:grid-cols-3 gap-8">
                            <FeatureCard 
                                icon="⚡"
                                title="Tempo Real" 
                                desc="Atualizações instantâneas via React e Laravel, sem recarregar a página." 
                            />
                            <FeatureCard 
                                icon="📊"
                                title="Métricas Claras" 
                                desc="Saiba o tempo médio de espera e gargalos do seu atendimento." 
                            />
                            <FeatureCard 
                                icon="📱"
                                title="Multiplataforma" 
                                desc="Pronto para integração futura com app mobile Flutter." 
                            />
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

// Pequeno componente auxiliar para os cards (pode separar depois)
function FeatureCard({ icon, title, desc }) {
    return (
        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-100 hover:shadow-lg transition duration-300">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl mb-4">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 leading-relaxed">{desc}</p>
        </div>
    );
}