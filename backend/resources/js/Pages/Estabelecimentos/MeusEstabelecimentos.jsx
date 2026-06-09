import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

export default function MeusEstabelecimentos({ auth, estabelecimentos, metricas }) {
    // Estados para os filtros
    const [busca, setBusca] = useState('');
    const [statusAtivo, setStatusAtivo] = useState('Todos os status');

    // Estados para o Modal do "Olho"
    const [lojaSelecionada, setLojaSelecionada] = useState(null);
    const [modalAberto, setModalAberto] = useState(false);

    // Estado para o Menu de Três Pontinhos (Dropdown)
    const [menuAbertoId, setMenuAbertoId] = useState(null);

    const listaLojas = estabelecimentos?.data || [];

    const lojasFiltradas = listaLojas.filter((loja) => {
        const termo = busca.toLowerCase();
        const nomeMatch = loja.nome ? loja.nome.toLowerCase().includes(termo) : false;
        const enderecoMatch = loja.endereco ? loja.endereco.toLowerCase().includes(termo) : false;
        const passouNaBusca = nomeMatch || enderecoMatch;

        let passouNoStatus = true;
        if (statusAtivo === 'Ativos') passouNoStatus = loja.status === 'Ativo' || !loja.status;
        if (statusAtivo === 'Inativos') passouNoStatus = loja.status === 'Inativo';

        return passouNaBusca && passouNoStatus;
    });

    const stats = metricas || {
        ativos: 0,
        faturamento: 'R$ 0,00',
        crescimento_faturamento: '0%',
        aguardando: 0,
        funcionarios_ativos: 0
    };

    // Funções do Modal
    const abrirModal = (loja) => {
        setLojaSelecionada(loja);
        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setLojaSelecionada(null);
    };

    // Função para alternar o Menu de três pontos
    const toggleMenu = (id) => {
        setMenuAbertoId(menuAbertoId === id ? null : id);
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Meus Estabelecimentos - WaitLess" />

            {/* Overlay invisível para fechar o dropdown ao clicar fora */}
            {menuAbertoId && (
                <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setMenuAbertoId(null)}
                ></div>
            )}

            <div className="min-h-screen bg-[#FBF9F9] pt-8 pb-12 font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* --- CABEÇALHO --- */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                                Meus Estabelecimentos
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Acompanhe o desempenho de todos os seus estabelecimentos em tempo real.
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Link href={route('estabelecimentos.create')} className="flex items-center gap-2 bg-black border border-black text-white hover:bg-gray-800 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm relative z-20">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                Novo estabelecimento
                            </Link>
                        </div>
                    </div>

                    {/* --- CARDS DE MÉTRICAS --- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-0">
                        {/* Card 1 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-black flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V10l-9-4-9 4v11m18 0h-4v-5H9v5H5m14 0H5"></path></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estabelecimentos ativos</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.ativos}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 2 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-black flex items-center justify-center shrink-0 font-bold text-xl">
                                    $
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento hoje</p>
                                    <h3 className="text-2xl font-black text-gray-900">{stats.faturamento}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 3 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-black flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pessoas aguardando</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.aguardando}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 4 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-black flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Funcionários ativos</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.funcionarios_ativos}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- ÁREA DA LISTA --- */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible relative z-0">
                        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-gray-900">Lista de estabelecimentos</h2>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar estabelecimento..." 
                                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black w-full sm:w-64"
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                    />
                                </div>
                                <select 
                                    className="border border-gray-200 text-gray-600 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-1 focus:ring-black focus:border-black cursor-pointer"
                                    value={statusAtivo}
                                    onChange={(e) => setStatusAtivo(e.target.value)}
                                >
                                    <option value="Todos os status">Todos os status</option>
                                    <option value="Ativos">Ativos</option>
                                    <option value="Inativos">Inativos</option>
                                </select>
                            </div>
                        </div>

                        {lojasFiltradas.length > 0 && (
                            <div className="overflow-x-auto min-h-[250px]">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Estabelecimento</th>
                                            <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-center">Aguardando</th>
                                            <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-center">Funcionários</th>
                                            <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {lojasFiltradas.map((loja) => (
                                            <tr key={loja.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                                                            {loja.nome.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900">{loja.nome}</p>
                                                            <p className="text-xs text-gray-500">{loja.status || 'Ativo'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-gray-900">{loja.aguardando || 0}</td>
                                                <td className="px-6 py-4 text-center font-bold text-gray-900">{loja.funcionarios_ativos || 0}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1 relative z-20">
                                                        {/* Botão Olho */}
                                                        <button 
                                                            onClick={() => abrirModal(loja)}
                                                            className="p-2 text-gray-400 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" 
                                                            title="Visualizar painel rápido"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                                        </button>
                                                        
                                                        {/* Botão Três Pontinhos + Menu */}
                                                        <div className="relative">
                                                            <button 
                                                                onClick={() => toggleMenu(loja.id)}
                                                                className="p-2 text-gray-400 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" 
                                                                title="Opções"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                                            </button>

                                                            {/* Menu Suspenso (Dropdown) */}
                                                            {menuAbertoId === loja.id && (
                                                                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                                                                    <Link 
                                                                        href={route('estabelecimentos.edit', loja.id)} 
                                                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-black font-medium transition-colors"
                                                                    >
                                                                        Editar
                                                                    </Link>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODAL (Abre ao clicar no olho) --- */}
            {modalAberto && lojaSelecionada && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative transform scale-100 transition-transform">
                        {/* Botão Fechar Modal */}
                        <button 
                            onClick={fecharModal} 
                            className="absolute top-4 right-4 text-gray-400 hover:text-black hover:bg-gray-100 p-2 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-bold text-xl">
                                {lojaSelecionada.nome.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-gray-900 leading-tight">{lojaSelecionada.nome}</h3>
                                <p className="text-xs text-green-600 font-semibold mt-0.5">Visão em Tempo Real</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm text-gray-600 font-medium">Clientes aguardando</span>
                                <span className="text-xl font-black text-black">{lojaSelecionada.aguardando || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm text-gray-600 font-medium">Funcionários Ativos</span>
                                <span className="text-xl font-black text-black">{lojaSelecionada.funcionarios_ativos || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-black text-white rounded-xl shadow-md">
                                <span className="text-sm font-medium opacity-90">Trabalhando agora</span>
                                <span className="text-xl font-black">{lojaSelecionada.funcionarios_trabalhando || 0}</span>
                            </div>
                        </div>

                        <Link href={`/estabelecimentos/${lojaSelecionada.id}`} className="mt-6 w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-black py-3 rounded-xl font-bold transition-colors">
                            Ir para o painel completo
                        </Link>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}