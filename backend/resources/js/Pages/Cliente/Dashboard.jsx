import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import TextInput from '@/Components/TextInput';

export default function ClienteDashboard({ auth, agendamentos = [], usuario }) {
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');

    const fazerBusca = (e) => {
        e.preventDefault();
        if (route().has('cliente.explorar')) {
            router.get(route('cliente.explorar'), { busca, categoria });
        } else {
            alert('A rota de explorar ainda não foi configurada no web.php!');
        }
    };

    const formatarMoeda = (valor) => {
        if (!valor) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return '';
        const partes = dataStr.split(' ')[0].split('-'); 
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataStr;
    };

    const nomeUsuario = usuario?.name || auth?.user?.name || 'Cliente';
    const primeiroNome = nomeUsuario.split(' ')[0];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                    Olá, {primeiroNome} 👋
                </h2>
            }
        >
            <Head title="Meu Painel - WaitLess" />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12 space-y-10">
                
                {/* --- SEÇÃO 1: BARRA DE PESQUISA RÁPIDA --- */}
                <div className="bg-indigo-600 rounded-3xl p-8 shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-extrabold text-white mb-2">
                            Encontre e agende um serviço
                        </h3>
                        <p className="text-indigo-100 mb-6 text-sm">
                            Pesquise por nome da loja, cidade, ou escolha uma categoria.
                        </p>
                        
                        <form onSubmit={fazerBusca} className="flex flex-col md:flex-row gap-3">
                            <TextInput 
                                type="text" 
                                className="w-full py-3 px-6 rounded-xl border-0 shadow-sm text-gray-900" 
                                placeholder="Ex: Barbearia do João, Recife..." 
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                            
                            <select 
                                className="w-full md:w-64 py-3 px-4 border-0 rounded-xl shadow-sm text-gray-700"
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                            >
                                <option value="">Todas as Categorias</option>
                                <option value="Beleza e Estética">Beleza e Estética</option>
                                <option value="Saúde e Bem-Estar">Saúde e Bem-Estar</option>
                                <option value="Serviços Automotivos">Serviços Automotivos</option>
                                <option value="Assistência Técnica e Manutenção">Assistência Técnica</option>
                                <option value="Gastronomia e Reservas">Gastronomia</option>
                                <option value="Serviços para Pets">Serviços para Pets</option>
                                <option value="Serviços para Pets">Serviços de passeios</option>
                            </select>

                            <button type="submit" className="bg-gray-900 text-white px-8 py-3 font-bold rounded-xl shadow-md hover:bg-gray-800 transition whitespace-nowrap">
                                Procurar
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- SEÇÃO 2: MEUS AGENDAMENTOS E FILA VIRTUAL --- */}
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        📅 Acompanhar Minha Fila
                    </h3>

                    {!agendamentos || agendamentos.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                            <div className="text-6xl mb-4">🎫</div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Você não está em nenhuma fila no momento!
                            </h4>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                                Que tal explorar os estabelecimentos parceiros e marcar um horário agora mesmo para evitar esperas desnecessárias?
                            </p>
                            
                            {route().has('cliente.explorar') && (
                                <Link 
                                    href={route('cliente.explorar')}
                                    className="inline-block px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition transform hover:scale-105"
                                >
                                    Explorar Estabelecimentos
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {agendamentos.map((agendamento) => (
                                <div key={agendamento.id} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                                    
                                    {/* CABEÇALHO DO CARD (DESTAQUE DA FILA) */}
                                    <div className={`${agendamento.pessoas_na_frente === 0 ? 'bg-green-500 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30'} p-5 border-b border-gray-100 dark:border-gray-700`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className={`text-sm font-medium ${agendamento.pessoas_na_frente === 0 ? 'text-green-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                    Status da Fila
                                                </p>
                                                <h4 className={`text-2xl font-extrabold ${agendamento.pessoas_na_frente === 0 ? 'text-white animate-pulse' : 'text-gray-900 dark:text-white'}`}>
                                                    {agendamento.pessoas_na_frente === 0 
                                                        ? 'Sua vez é a próxima! 🎉' 
                                                        : `${agendamento.pessoas_na_frente} pessoas na frente`}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${agendamento.pessoas_na_frente === 0 ? 'text-green-200' : 'text-gray-500'}`}>
                                                    Chamada às
                                                </p>
                                                <span className={`text-xl font-bold py-1 px-3 rounded-lg ${agendamento.pessoas_na_frente === 0 ? 'bg-white/20' : 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white'}`}>
                                                    {agendamento.hora_agendamento ? agendamento.hora_agendamento.substring(0, 5) : '--:--'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CORPO DO CARD (DADOS DA LOJA E SERVIÇO) */}
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="mb-4">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                                                {agendamento.estabelecimento?.nome || 'Loja Indisponível'}
                                            </h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                                📍 {agendamento.estabelecimento?.cidade || '-'} - {agendamento.estabelecimento?.estado || '-'}
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {agendamento.servico?.nome || 'Serviço Indisponível'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Duração aprox: {agendamento.servico?.duracao_minutos || 0} min
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                    {formatarMoeda(agendamento.valor_final)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* --- MOSTRAR O PIN AO CLIENTE --- */}
                                        {agendamento.codigo_verificacao && (
                                            <div className="mb-4 p-4 border border-dashed border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider mb-1">
                                                        PIN de Liberação
                                                    </p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 pr-2">
                                                        Forneça este código apenas quando finalizar o serviço adquirido, para liberar o pagamento.
                                                    </p>
                                                </div>
                                                <div className="text-3xl font-black text-indigo-700 dark:text-indigo-400 tracking-widest pl-4">
                                                    {agendamento.codigo_verificacao}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mt-auto pt-2">
                                            <div className="text-sm text-gray-500 font-medium">
                                                Data: {formatarData(agendamento.data_agendamento)}
                                            </div>
                                            <button className="text-red-500 hover:text-red-700 text-sm font-bold transition underline underline-offset-2">
                                                Cancelar Vaga
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </AuthenticatedLayout>
    );
}