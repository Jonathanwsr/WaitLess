import { Link, Head } from '@inertiajs/react';
import { HiGlobe, HiClock, HiGift, HiCheck } from 'react-icons/hi'; // Importando os ícones

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="WaitLess - O seu marketplace de serviços" />
            
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-500 selection:text-white">
                
               
                <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center gap-2">
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

              
                <main className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-12 items-center">
                    
                   
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold border border-indigo-100">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                             Serviços rapidos
                        </div>
                        
                        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
                            O fim das filas <br />
                            <span className="text-indigo-600">intermináveis.</span>
                        </h1>
                        
                        <p className="text-lg text-gray-600 max-w-lg leading-relaxed">
                            Vivemos em um mundo acelerado. Chega de burocracia, ligações ou tempo perdido na sala de espera. O WaitLess permite que você pesquise, agende e pague antecipadamente por qualquer serviço.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="px-8 py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 text-center"
                                >
                                    Quero me Cadastrar
                                </Link>
                            )}
                            <button className="px-8 py-4 rounded-xl bg-white text-gray-700 border border-gray-200 font-bold text-lg hover:bg-gray-50 transition text-center">
                                Explorar Serviços
                            </button>
                        </div>

                        <div className="pt-8 flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white"></div>
                                <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></div>
                                <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-white"></div>
                            </div>
                            <p>Milhares de <strong className="text-gray-900">pessoas atendidas</strong> na hora exata.</p>
                        </div>
                    </div>

                    {/* Ilustração / Mockup Abstrato */}
                    <div className="relative">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                        
                        <div className="relative bg-white/60 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
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
                                    <span className="text-green-600 font-bold">Na sua vez!</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 opacity-60">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">B</div>
                                        <div>
                                            <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                            <div className="h-2 w-12 bg-gray-100 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-gray-400 font-bold">Em Espera</span>
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
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">A melhor experiência para o cliente</h2>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Tudo que você precisa em um único marketplace global. Rápido, intuitivo e sem intermediários.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            {/* Passando os ícones da Heroicons como componentes */}
                            <FeatureCard 
                                icon={<HiGlobe className="w-8 h-8 text-indigo-600" />}
                                title="Marketplace Global" 
                                desc="De hotéis e turismo a clínicas e estúdios automotivos. Navegue, compare e agende em diversos segmentos em um só app." 
                            />
                            <FeatureCard 
                                icon={<HiClock className="w-8 h-8 text-indigo-600" />}
                                title="Zero Tempo de Espera" 
                                desc="Garanta sua vaga pagando antecipadamente. Acompanhe sua posição na fila em tempo real e chegue apenas na hora exata." 
                            />
                            <FeatureCard 
                                icon={<HiGift className="w-8 h-8 text-indigo-600" />}
                                title="Clube de Benefícios" 
                                desc="Fidelidade que vale a pena. Acumule pontos e utilize seus créditos de desconto em qualquer segmento dentro da plataforma." 
                            />
                        </div>
                    </div>
                </section>

                {/* --- Seção do Prestador de Serviços --- */}
                <section className="bg-gray-900 py-24 relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                                    A solução completa para <span className="text-indigo-400">digitalizar o seu negócio.</span>
                                </h2>
                                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                                    O WaitLess não é apenas um sistema de agendamento. É o fim dos processos manuais, das ligações perdidas e do controle no papel. Aumente sua produtividade e eleve a experiência do seu cliente.
                                </p>
                                
                                <ul className="space-y-5">
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                                            <HiCheck className="w-4 h-4" />
                                        </div>
                                        <p className="text-gray-300"><strong className="text-white">Gestão Total:</strong> Cadastre serviços, defina regras, preços e descrições facilmente.</p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                                            <HiCheck className="w-4 h-4" />
                                        </div>
                                        <p className="text-gray-300"><strong className="text-white">Fila em Tempo Real:</strong> Controle quem entra e quem é atendido com organização impecável.</p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                                            <HiCheck className="w-4 h-4" />
                                        </div>
                                        <p className="text-gray-300"><strong className="text-white">Pagamento Seguro:</strong> Receba antecipadamente, reduzindo faltas e garantindo seu faturamento.</p>
                                    </li>
                                </ul>

                                <div className="mt-10">
                                    <Link href={route('register')} className="inline-block px-8 py-4 rounded-xl bg-white text-gray-900 font-bold text-lg hover:bg-gray-100 transition shadow-lg">
                                        Cadastrar meu Estabelecimento
                                    </Link>
                                </div>
                            </div>
                            
                            {/* Gráfico/Elemento Visual B2B */}
                            <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl relative">
                                <div className="absolute -top-4 -right-4 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">Visão do Lojista</div>
                                <h4 className="text-white font-bold mb-6 text-xl border-b border-gray-700 pb-4">Fila de Hoje</h4>
                                <div className="space-y-4">
                                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
                                            <div>
                                                <p className="text-white font-medium">Carlos Silva</p>
                                                <p className="text-gray-400 text-sm">Corte Masculino - R$ 45,00</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/20">Pago</span>
                                    </div>
                                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600 flex justify-between items-center opacity-70">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
                                            <div>
                                                <p className="text-white font-medium">Amanda Costa</p>
                                                <p className="text-gray-400 text-sm">Limpeza de Pele - R$ 120,00</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold border border-yellow-500/20">Aguardando</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
            </div>
        </>
    );
}


function FeatureCard({ icon, title, desc }) {
    return (
        <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
            <p className="text-gray-600 leading-relaxed">{desc}</p>
        </div>
    );
}