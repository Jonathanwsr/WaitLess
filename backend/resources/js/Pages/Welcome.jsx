import { Link, Head } from '@inertiajs/react';
import { 
    HiGlobe, HiClock, HiGift, HiCheck, HiSearch, 
    HiCreditCard, HiBadgeCheck, HiStar 
} from 'react-icons/hi'; 

export default function Welcome({ auth, canLogin, canRegister }) {
    return (
        <>
            <Head title="WaitLess - O seu marketplace de serviços" />
            
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden">
                
                {/* --- NAVBAR --- */}
                <nav className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto relative z-20">
                    <div className="flex items-center gap-3">
                        {/* A SUA LOGO AQUI */}
                        <img 
                            src="/images/logo-waitlles.jpeg" 
                            alt="Logo WaitLess" 
                            className="w-10 h-10 rounded-xl shadow-sm object-cover"
                            onError={(e) => {
                                // Fallback caso a imagem não seja encontrada
                                e.target.outerHTML = '<div class="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xl">W</div>'
                            }}
                        />
                        <span className="text-2xl font-black tracking-tight text-gray-900">WaitLess</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {canLogin ? (
                            <>
                                {auth?.user ? (
                                    <Link
                                        href={route('dashboard')}
                                        className="font-bold text-gray-600 hover:text-emerald-600 transition"
                                    >
                                        Acessar Painel
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={route('login')}
                                            className="font-bold text-gray-600 hover:text-emerald-600 transition hidden sm:block"
                                        >
                                            Entrar
                                        </Link>

                                        {canRegister && (
                                            <Link
                                                href={route('register')}
                                                className="px-6 py-2.5 rounded-full bg-emerald-500 text-white font-black hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5"
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

                {/* --- HERO SECTION --- */}
                <main className="max-w-7xl mx-auto px-6 md:px-12 pt-12 pb-24 md:pt-20 md:pb-32 grid md:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-widest border border-emerald-200 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Revolução no Atendimento
                        </div>
                        
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-gray-900 leading-[1.05]">
                            O fim das filas <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">intermináveis.</span>
                        </h1>
                        
                        <p className="text-lg text-gray-500 max-w-lg leading-relaxed font-medium">
                            Vivemos num mundo acelerado. Esqueça a burocracia e as horas na sala de espera. O WaitLess permite que encontre, agende e pague por qualquer serviço num instante. Chegou, sentou!
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="px-8 py-4 rounded-2xl bg-gray-900 text-white font-black text-lg hover:bg-black transition shadow-xl shadow-gray-900/20 text-center hover:-translate-y-1"
                                >
                                    Sou Cliente
                                </Link>
                            )}
                            <button className="px-8 py-4 rounded-2xl bg-white text-gray-900 border-2 border-gray-200 font-black text-lg hover:border-emerald-500 hover:text-emerald-600 transition text-center hover:-translate-y-1 shadow-sm">
                                Explorar Serviços
                            </button>
                        </div>

                        <div className="pt-8 flex items-center gap-4 text-sm text-gray-500 font-medium border-t border-gray-200/60">
                            <div className="flex -space-x-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-gray-50 flex items-center justify-center text-xl">👱🏻‍♂️</div>
                                <div className="w-10 h-10 rounded-full bg-emerald-200 border-2 border-gray-50 flex items-center justify-center text-xl">👩🏽‍🦱</div>
                                <div className="w-10 h-10 rounded-full bg-yellow-200 border-2 border-gray-50 flex items-center justify-center text-xl">👨🏻‍🦰</div>
                            </div>
                            <p>Milhares de <strong className="text-gray-900">pessoas atendidas</strong> na hora exata.</p>
                        </div>
                    </div>

                    {/* Mockup Abstrato / App Preview */}
                    <div className="relative mt-10 md:mt-0">
                        {/* Luzes de Fundo Verdes */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-emerald-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
                        
                        <div className="relative bg-white/80 backdrop-blur-2xl border border-white/40 rounded-[2rem] p-8 shadow-2xl z-10 transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                                <div>
                                    <div className="h-4 w-32 bg-gray-200 rounded-full mb-2"></div>
                                    <div className="h-3 w-20 bg-emerald-100 rounded-full"></div>
                                </div>
                                <img src="/images/logo-waitlles.jpeg" alt="Logo" className="h-10 w-10 rounded-xl" onError={(e) => e.target.style.display = 'none'} />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm border border-emerald-100 ring-2 ring-emerald-500/20 transform scale-105 z-10 relative">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-lg">W</div>
                                        <div>
                                            <div className="h-4 w-28 bg-gray-900 rounded mb-2"></div>
                                            <div className="h-3 w-16 bg-gray-300 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-emerald-600 font-black text-xs uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">Na sua vez!</span>
                                </div>
                                <div className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm border border-gray-100 opacity-70">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">2</div>
                                        <div>
                                            <div className="h-4 w-24 bg-gray-300 rounded mb-2"></div>
                                            <div className="h-3 w-16 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                    <span className="text-gray-400 font-bold text-xs uppercase">Em Espera</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* --- NOVO: SOBRE O WAITLESS (VALOR DO APP) --- */}
                <section className="bg-emerald-50 py-24 border-t border-emerald-100 relative overflow-hidden">
                    {/* Elementos de fundo abstratos */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply opacity-50 blur-3xl -ml-20 -mt-20"></div>
                    <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply opacity-50 blur-3xl -mr-20 -mb-20"></div>

                    <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
                        
                        <div className="text-center mb-16 max-w-4xl mx-auto">
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-6">
                                Chegou o WaitLess — o jeito inteligente de contratar serviços!
                            </h2>
                            <p className="text-xl text-emerald-800 font-bold leading-relaxed mb-4">
                                Cansado de perder tempo esperando atendimento? O WaitLess veio para mudar isso de vez.
                            </p>
                            <p className="text-lg text-gray-600 font-medium">
                                Somos um marketplace de serviços completo, que conecta clientes e prestadores de forma rápida, organizada e sem complicação — em qualquer cidade e para qualquer tipo de serviço.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                            {/* Card Para Clientes */}
                            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300">
                                <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-100">
                                        <HiSearch className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">Para clientes</h3>
                                </div>
                                <ul className="space-y-5">
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Encontre serviços perto de você</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Compare preços e opções facilmente</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Agende horários em segundos</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Pague antecipadamente com segurança</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Acompanhe sua posição na fila em tempo real (adeus espera!)</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Card Para Prestadores */}
                            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300">
                                <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-100">
                                        <HiGlobe className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">Para prestadores</h3>
                                </div>
                                <ul className="space-y-5">
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Cadastre seu estabelecimento</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Organize sua agenda e atendimentos</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Gerencie serviços, preços e horários</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <HiCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-bold text-lg">Tenha mais controle, produtividade e clientes</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Banner Final da Seção Novo */}
                        <div className="mt-16 bg-gray-900 rounded-[2.5rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent"></div>
                            <div className="relative z-10">
                                <div className="flex flex-wrap justify-center gap-3 md:gap-6 mb-10">
                                    <span className="bg-gray-800 text-gray-300 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-700 flex items-center gap-2"><HiBadgeCheck className="text-emerald-400 w-5 h-5"/> Comunicação direta, sem ruídos</span>
                                    <span className="bg-gray-800 text-gray-300 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-700 flex items-center gap-2"><HiClock className="text-emerald-400 w-5 h-5"/> Atendimento rápido e eficiente</span>
                                    <span className="bg-gray-800 text-gray-300 px-5 py-2.5 rounded-full text-sm font-bold border border-gray-700 flex items-center gap-2"><HiGift className="text-emerald-400 w-5 h-5"/> Programa de pontos e descontos</span>
                                </div>
                                <p className="text-lg md:text-xl text-gray-300 font-medium max-w-4xl mx-auto mb-10 leading-relaxed">
                                    Tudo isso com a praticidade que você já conhece, inspirado nos melhores apps do mercado — agora aplicado a todos os tipos de serviço.
                                </p>
                                <h3 className="text-4xl md:text-5xl font-black text-white mb-10">
                                    WaitLess: <span className="text-emerald-400">menos espera, mais resultado.</span>
                                </h3>
                                <Link href={route('register')} className="inline-block bg-emerald-500 text-white font-black text-xl px-12 py-6 rounded-2xl hover:bg-emerald-400 transition shadow-xl shadow-emerald-500/20 hover:-translate-y-1 transform">
                                    Baixe, cadastre-se e comece agora!
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- A JORNADA DO CLIENTE (COMO FUNCIONA) --- */}
                <section className="bg-white py-24 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6 md:px-12">
                        <div className="text-center mb-16">
                            <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Como Funciona</h2>
                            <h3 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">O seu tempo é sagrado.</h3>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto mt-4 font-medium">Veja como é fácil pular a fila da sala de espera com o WaitLess.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
                            {/* Linha conectora visível apenas no Desktop */}
                            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-gray-100 via-emerald-200 to-gray-100 z-0"></div>

                            <StepCard 
                                step="1"
                                icon={<HiSearch className="w-8 h-8 text-white" />}
                                title="1. Encontre e Agende" 
                                desc="Pesquise barbearias, salões ou clínicas perto de si. Escolha o serviço, o profissional e o horário ideal na agenda ao vivo." 
                            />
                            <StepCard 
                                step="2"
                                icon={<HiCreditCard className="w-8 h-8 text-white" />}
                                title="2. Confirme a Vaga" 
                                desc="Pague online no app ou escolha pagar no local. Ao confirmar, você recebe um Cartão Dourado com um PIN exclusivo de 4 dígitos." 
                            />
                            <StepCard 
                                step="3"
                                icon={<HiBadgeCheck className="w-8 h-8 text-white" />}
                                title="3. Chegou, Sentou" 
                                desc="Vá ao estabelecimento apenas na hora marcada. Diga o seu PIN ao profissional e sente-se na cadeira. Sem perguntas, sem filas." 
                            />
                        </div>
                    </div>
                </section>

                {/* --- HISTÓRIAS DE USUÁRIOS --- */}
                <section className="bg-emerald-600 py-24 relative overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply opacity-50 blur-3xl"></div>
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply opacity-50 blur-3xl"></div>

                    <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
                        <div className="text-center mb-16">
                            <h2 className="text-emerald-200 font-black tracking-widest uppercase text-xs mb-3">Histórias de Usuários</h2>
                            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight">Quem usa, não volta para a fila.</h3>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            <TestimonialCard 
                                name="Ricardo Gomes"
                                role="Cliente Frequente"
                                text="Antes do WaitLess, eu perdia o meu sábado inteiro na barbearia. Agora, agendo na sexta à noite, chego no sábado de manhã, mostro o PIN e já corto o cabelo. Revolucionário!"
                            />
                            <TestimonialCard 
                                name="Juliana Martins"
                                role="Estudante"
                                text="Eu odiava ter de ligar para a clínica de estética para marcar horário. Agora faço tudo pelo app, pago com um clique e ainda ganho pontos de desconto. Perfeito para a minha rotina."
                            />
                            <TestimonialCard 
                                name="Marcos Oliveira"
                                role="Empresário"
                                text="Uso o aplicativo até para lavar o carro! Chego na hora certa, não espero na fila e já está pago. O recurso do PIN no balcão passa muita segurança. Recomendo muito."
                            />
                        </div>
                    </div>
                </section>

                {/* --- VANTAGENS / FEATURES --- */}
                <section className="bg-gray-50 py-24">
                    <div className="max-w-7xl mx-auto px-6 md:px-12">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Um marketplace diferente</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            <FeatureCard 
                                icon={<HiGlobe className="w-8 h-8 text-emerald-500" />}
                                title="Marketplace Global" 
                                desc="De beleza e estética a clínicas automotivas. Navegue, compare e agende em diversos segmentos em um só app." 
                            />
                            <FeatureCard 
                                icon={<HiClock className="w-8 h-8 text-emerald-500" />}
                                title="Transparência Real" 
                                desc="Acompanhe o painel do lojista ao vivo. Saiba exatamente quem está na cadeira e se há algum atraso antes de sair de casa." 
                            />
                            <FeatureCard 
                                icon={<HiGift className="w-8 h-8 text-emerald-500" />}
                                title="Clube de Benefícios" 
                                desc="Fidelidade que vale dinheiro. Acumule pontos avaliando serviços e utilize seus créditos como desconto na próxima visita." 
                            />
                        </div>
                    </div>
                </section>

                {/* --- SEÇÃO DO LOJISTA (B2B) --- */}
                <section className="bg-gray-900 py-24 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent"></div>
                    
                    <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-black uppercase tracking-widest mb-6 border border-gray-700">
                                    Para Empresas
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                                    Digitalize a sua loja e <span className="text-emerald-400">elimine o papel.</span>
                                </h2>
                                <p className="text-gray-400 text-lg mb-8 leading-relaxed font-medium">
                                    O WaitLess não é apenas uma agenda. É o seu gestor financeiro, controlador de filas e painel de avaliação de equipe. Aumente a sua produtividade e fidelize mais clientes.
                                </p>
                                
                                <ul className="space-y-6">
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                                            <HiCheck className="w-5 h-5" />
                                        </div>
                                        <p className="text-gray-300 font-medium"><strong className="text-white font-bold block text-lg">Mesa de Operação</strong> Validação por PIN anti-fraude para os seus funcionários garantirem o fechamento de caixa.</p>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                                            <HiCheck className="w-5 h-5" />
                                        </div>
                                        <p className="text-gray-300 font-medium"><strong className="text-white font-bold block text-lg">Gestão de Equipe</strong> Aprove folgas, veja quem produz mais e acompanhe a avaliação de cada barbeiro/atendente.</p>
                                    </li>
                                </ul>

                                <div className="mt-10">
                                    <Link href={route('register')} className="inline-block px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black text-lg hover:bg-emerald-400 transition shadow-xl shadow-emerald-500/20 hover:-translate-y-1">
                                        Cadastrar o meu Negócio
                                    </Link>
                                </div>
                            </div>
                            
                            {/* Gráfico/Elemento Visual B2B */}
                            <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl relative transform md:rotate-2">
                                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-[10px] uppercase tracking-widest font-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> Visão do Gerente
                                </div>
                                <h4 className="text-white font-black mb-6 text-xl border-b border-gray-700 pb-4">Extrato Financeiro</h4>
                                <div className="space-y-4">
                                    <div className="bg-gray-900 p-5 rounded-2xl border border-gray-700 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-white font-black border border-gray-700">M</div>
                                            <div>
                                                <p className="text-white font-bold">Mateus Silva</p>
                                                <p className="text-gray-400 text-xs font-bold uppercase mt-1">Corte + Barba</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-black text-lg">R$ 65,00</p>
                                            <span className="inline-block mt-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-[10px] font-black uppercase">Liquidado</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-900 p-5 rounded-2xl border border-gray-700 flex justify-between items-center opacity-60">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-white font-black border border-gray-700">L</div>
                                            <div>
                                                <p className="text-white font-bold">Lucas Oliveira</p>
                                                <p className="text-gray-400 text-xs font-bold uppercase mt-1">Sobrancelha</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-yellow-400 font-black text-lg">R$ 40,00</p>
                                            <span className="inline-block mt-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md text-[10px] font-black uppercase">Pendente</span>
                                        </div>
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

// Componente das Histórias de Usuários
function TestimonialCard({ name, role, text }) {
    return (
        <div className="bg-white rounded-3xl p-8 shadow-xl relative mt-4 transform hover:-translate-y-2 transition duration-300">
            <div className="flex gap-1 mb-4">
                <HiStar className="w-5 h-5 text-yellow-400" />
                <HiStar className="w-5 h-5 text-yellow-400" />
                <HiStar className="w-5 h-5 text-yellow-400" />
                <HiStar className="w-5 h-5 text-yellow-400" />
                <HiStar className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-gray-600 font-medium italic leading-relaxed mb-6">"{text}"</p>
            <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-lg">
                    {name.charAt(0)}
                </div>
                <div>
                    <h4 className="font-black text-gray-900">{name}</h4>
                    <p className="text-xs font-bold text-gray-400 uppercase">{role}</p>
                </div>
            </div>
        </div>
    );
}

// Componente das Cartas de Feature (Serviços)
function FeatureCard({ icon, title, desc }) {
    return (
        <div className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-xl hover:-translate-y-1 transition duration-300">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">{title}</h3>
            <p className="text-gray-500 font-medium leading-relaxed">{desc}</p>
        </div>
    );
}

// Componente para a Jornada do Cliente
function StepCard({ step, icon, title, desc }) {
    return (
        <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-gray-900 rounded-[2rem] shadow-xl flex items-center justify-center mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 relative">
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-400 text-gray-900 font-black rounded-full flex items-center justify-center text-sm border-4 border-white">
                    {step}
                </div>
                {icon}
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{title}</h3>
            <p className="text-gray-500 font-medium leading-relaxed max-w-sm">{desc}</p>
        </div>
    );
}