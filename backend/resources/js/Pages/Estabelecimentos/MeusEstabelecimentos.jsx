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

  
    const listaLojas = estabelecimentos?.data || (Array.isArray(estabelecimentos) ? estabelecimentos : []);

    const lojasFiltradas = listaLojas.filter((loja) => {
        const termo = busca.toLowerCase();
        const nomeMatch = loja?.nome ? loja.nome.toLowerCase().includes(termo) : false;
        const enderecoMatch = loja?.rua ? loja.rua.toLowerCase().includes(termo) : false;
        const passouNaBusca = nomeMatch || enderecoMatch;

        let passouNoStatus = true;
        const statusLoja = loja?.ativo !== false ? 'Ativo' : 'Inativo'; 
        
        if (statusAtivo === 'Ativos') passouNoStatus = statusLoja === 'Ativo';
        if (statusAtivo === 'Inativos') passouNoStatus = statusLoja === 'Inativo';

        return passouNaBusca && passouNoStatus;
    });

    // Métricas com valores padrão
    const stats = metricas || {
        ativos: 0,
        faturamento: 'R$ 0,00',
        crescimento_faturamento: '0%',
        aguardando: 0,
        funcionarios_ativos: 0
    };

    // Funções do Modal
    const abrirModal = (e, loja) => {
        e.preventDefault();
        e.stopPropagation();
        setLojaSelecionada(loja);
        setModalAberto(true);
        setMenuAbertoId(null);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setLojaSelecionada(null);
    };

    // Função para alternar o Menu de três pontos
    const toggleMenu = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAbertoId(menuAbertoId === id ? null : id);
    };

    const isStateVazio = listaLojas.length === 0;

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Meus Estabelecimentos - WaitLess" />

            {/* Overlay invisível para fechar o dropdown ao clicar fora (z-30) */}
            {menuAbertoId && (
                <div 
                    className="fixed inset-0 z-30" 
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
                            <Link href={route('estabelecimentos.create')} className="flex items-center gap-2 bg-[#10B981] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                Novo estabelecimento
                            </Link>
                        </div>
                    </div>

                    {/* --- CARDS DE MÉTRICAS --- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Card 1 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-[#FFF1EB] text-[#FF7A00] flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V10l-9-4-9 4v11m18 0h-4v-5H9v5H5m14 0H5"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Ativos</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.ativos}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 2 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 font-bold text-xl">$</div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Faturamento hoje</p>
                                    <h3 className="text-2xl font-black text-gray-900">{stats.faturamento}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 3 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Aguardando</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.aguardando}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Card 4 */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Funcionários</p>
                                    <h3 className="text-3xl font-black text-gray-900">{stats.funcionarios_ativos}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- CONTEÚDO PRINCIPAL --- */}
                    {isStateVazio ? (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V10l-9-4-9 4v11m18 0h-4v-5H9v5H5m14 0H5"></path>
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum estabelecimento encontrado</h2>
                            <p className="text-gray-500 max-w-md mb-8">
                                Crie seu primeiro estabelecimento para começar a gerenciar sua fila e faturamento.
                            </p>
                            <Link href={route('estabelecimentos.create')} className="bg-[#10B981] hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                Criar estabelecimento
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible relative">
                            {/* Filtros */}
                            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h2 className="text-lg font-bold text-gray-900">Lista de estabelecimentos</h2>
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="relative w-full sm:w-auto">
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
                                        className="w-full sm:w-auto border border-gray-200 text-gray-600 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-1 focus:ring-black focus:border-black cursor-pointer"
                                        value={statusAtivo}
                                        onChange={(e) => setStatusAtivo(e.target.value)}
                                    >
                                        <option value="Todos os status">Todos os status</option>
                                        <option value="Ativos">Ativos</option>
                                        <option value="Inativos">Inativos</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tabela */}
                            {lojasFiltradas.length > 0 ? (
                                <div className="overflow-x-auto min-h-[250px] pb-10">
                                    <table className="w-full text-left whitespace-nowrap relative">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Estabelecimento</th>
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Faturamento Hoje</th>
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-center">Aguardando</th>
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-center">Funcionários</th>
                                                <th className="px-6 py-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {lojasFiltradas.map((loja) => (
                                                <tr key={loja?.id || Math.random()} className="hover:bg-gray-50/50 transition-colors">
                                                    
                                                    {/* Estabelecimento */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            {loja?.foto_perfil ? (
                                                                <img src={loja.foto_perfil} alt={loja.nome} className="h-10 w-10 rounded-lg object-cover bg-gray-100 border border-gray-200" />
                                                            ) : (
                                                                <div className="h-10 w-10 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-white shadow-sm">
                                                                    {loja?.nome ? loja.nome.charAt(0).toUpperCase() : 'E'}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-bold text-gray-900">{loja?.nome || 'Sem nome'}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {loja?.rua ? `${loja.rua}, ${loja.numero || 'S/N'}` : 'Endereço não cadastrado'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${loja?.ativo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                {loja?.ativo !== false ? 'Ativo' : 'Inativo'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Faturamento */}
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <p className="font-bold text-gray-900">R$ {loja?.faturamento_hoje || '0,00'}</p>
                                                            <p className="text-xs font-semibold text-green-500 flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                                                                {loja?.crescimento_hoje || '0%'}
                                                            </p>
                                                        </div>
                                                    </td>

                                                    {/* Numéricos */}
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="font-bold text-gray-900 block">{loja?.clientes_aguardando || loja?.aguardando || 0}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="font-bold text-gray-900 block">{loja?.funcionarios_ativos || 0}</span>
                                                    </td>

                                                    {/* Ações (Com elevação de camada ao abrir menu) */}
                                                    <td className="px-6 py-4 text-right">
                                                        <div className={`flex items-center justify-end gap-1 ${menuAbertoId === loja.id ? 'relative z-40' : ''}`}>
                                                            {/* Botão Olho */}
                                                            <button 
                                                                onClick={(e) => abrirModal(e, loja)}
                                                                className="p-2 text-gray-400 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" 
                                                                title="Visualizar Resumo"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                                            </button>
                                                            
                                                            {/* Três Pontinhos */}
                                                            <div className="relative">
                                                                <button 
                                                                    onClick={(e) => toggleMenu(e, loja.id)}
                                                                    className="p-2 text-gray-400 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" 
                                                                    title="Opções"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                                                </button>

                                                                {/* Menu Suspenso (Dropdown) - z-50 para ficar sempre por cima */}
                                                                {menuAbertoId === loja.id && (
                                                                    <div className="absolute right-0 top-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50 overflow-hidden">
                                                                        <Link 
                                                                            href={`/estabelecimentos/${loja.id}/configuracoes`}
                                                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-black font-medium transition-colors"
                                                                        >
                                                                            Editar Configurações
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
                            ) : (
                                <div className="p-12 text-center text-gray-500 min-h-[200px] flex flex-col items-center justify-center">
                                    <p>Nenhum estabelecimento encontrado para "<strong>{busca}</strong>".</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODAL DO OLHO (Com mais informações) --- */}
            {modalAberto && lojaSelecionada && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative">
                        {/* Botão Fechar */}
                        <button 
                            onClick={fecharModal} 
                            className="absolute top-4 right-4 text-gray-400 hover:text-black hover:bg-gray-100 p-2 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <div className="flex items-center gap-3 mb-6 border-b pb-4 mt-2">
                            {lojaSelecionada?.foto_perfil ? (
                                <img src={lojaSelecionada.foto_perfil} alt={lojaSelecionada.nome} className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                            ) : (
                                <div className="w-14 h-14 bg-gray-900 text-white rounded-xl flex items-center justify-center font-bold text-2xl">
                                    {lojaSelecionada?.nome ? lojaSelecionada.nome.charAt(0).toUpperCase() : 'E'}
                                </div>
                            )}
                            <div>
                                <h3 className="text-xl font-extrabold text-gray-900 leading-tight">{lojaSelecionada?.nome || 'Estabelecimento'}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Visão Geral Detalhada</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            {/* Faturamento Box */}
                            <div className="flex items-center justify-between p-3 bg-green-50/50 border border-green-100 rounded-xl">
                                <span className="text-sm text-green-800 font-bold">Faturamento hoje</span>
                                <div className="text-right">
                                    <span className="text-lg font-black text-green-700 block">R$ {lojaSelecionada?.faturamento_hoje || '0,00'}</span>
                                    <span className="text-[10px] text-green-600 font-bold">{lojaSelecionada?.crescimento_hoje || '0%'} vs ontem</span>
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="flex flex-col p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Endereço</span>
                                <span className="text-sm text-gray-800 font-medium">
                                    {lojaSelecionada?.rua ? `${lojaSelecionada.rua}, ${lojaSelecionada.numero || 'S/N'}` : 'Endereço não cadastrado'}
                                </span>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <span className="text-sm text-gray-600 font-bold">Status da Unidade</span>
                                <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wide font-bold ${lojaSelecionada?.ativo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {lojaSelecionada?.ativo !== false ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>

                            {/* Clientes Aguardando */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <span className="text-sm text-gray-600 font-bold">Clientes na Fila</span>
                                <span className="text-xl font-black text-black">{lojaSelecionada?.clientes_aguardando || lojaSelecionada?.aguardando || 0}</span>
                            </div>

                            {/* Funcionários Trabalhando */}
                            <div className="flex items-center justify-between p-3 bg-black text-white rounded-xl shadow-md">
                                <div>
                                    <span className="text-sm font-bold block">Funcionários Ativos</span>
                                    <span className="text-[10px] opacity-70">Trabalhando no momento</span>
                                </div>
                                <span className="text-2xl font-black">{lojaSelecionada?.funcionarios_ativos || 0}</span>
                            </div>
                        </div>

                        <button 
                            onClick={fecharModal}
                            className="mt-6 w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-black py-3 rounded-xl font-bold transition-colors"
                        >
                            Fechar Resumo
                        </button>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}