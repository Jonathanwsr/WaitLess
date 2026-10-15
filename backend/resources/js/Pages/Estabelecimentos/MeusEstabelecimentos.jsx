import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    BuildingStorefrontIcon, CurrencyDollarIcon, UserIcon, UsersIcon, MagnifyingGlassIcon, PlusIcon, EyeIcon,
    EllipsisVerticalIcon, ArrowUpIcon, ArrowDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon,
} from '@heroicons/react/24/outline';

const fmtPct = (v) => `${Math.abs(v).toFixed(1).replace('.', ',')}%`;

/** "↑ 18,6% vs ontem" (verde) / "↓ 3,2% vs ontem" (vermelho) / "novo hoje" quando ontem foi zero. */
function Variacao({ valor, pequeno = false }) {
    const tam = pequeno ? 'text-[11px]' : 'text-xs';
    if (valor === null || valor === undefined) return <span className={`${tam} font-semibold text-emerald-600`}>primeiro faturamento</span>;
    if (valor === 0) return <span className={`${tam} text-gray-400`}>igual a ontem</span>;
    const sobe = valor > 0;
    const Icone = sobe ? ArrowUpIcon : ArrowDownIcon;
    return (
        <span className={`${tam} inline-flex items-center gap-0.5 font-semibold ${sobe ? 'text-emerald-600' : 'text-red-500'}`}>
            <Icone className="h-3 w-3" strokeWidth={2.5} /> {fmtPct(valor)} <span className="font-normal text-gray-400">vs ontem</span>
        </span>
    );
}

function Indicador({ icone: Icone, rotulo, valor, rodape }) {
    return (
        <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1E8] text-[#FF5A00]">
                    <Icone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm text-gray-500">{rotulo}</p>
                    <p className="truncate text-2xl font-black text-gray-900 sm:text-[28px]">{valor}</p>
                </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">{rodape}</div>
        </div>
    );
}

function Foto({ loja, tamanho = 'h-11 w-11' }) {
    return loja.foto_perfil ? (
        <img src={loja.foto_perfil} alt="" className={`${tamanho} shrink-0 rounded-xl border border-gray-100 object-cover`} />
    ) : (
        <span className={`${tamanho} flex shrink-0 items-center justify-center rounded-xl bg-gray-900 text-base font-bold text-white`}>
            {(loja.nome || 'E').charAt(0).toUpperCase()}
        </span>
    );
}

function Status({ loja }) {
    return (
        <div>
            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${loja.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {loja.ativo ? 'Ativo' : 'Inativo'}
            </span>
            <p className="mt-1 text-xs text-gray-400">
                {loja.fechado_hoje ? 'Fechado hoje' : loja.horario_hoje ? `Aberto até ${loja.horario_hoje}` : 'Horário não informado'}
            </p>
        </div>
    );
}

/** Menu de ações (três pontinhos) com os atalhos mais usados do local. */
function MenuAcoes({ loja, aberto, aoAlternar, aoFechar }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!aberto) return undefined;
        const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) aoFechar(); };
        document.addEventListener('mousedown', fora);
        return () => document.removeEventListener('mousedown', fora);
    }, [aberto, aoFechar]);

    const itens = [
        { rotulo: 'Fila de atendimento', href: route().has('estabelecimentos.fila') ? route('estabelecimentos.fila', loja.id) : null },
        { rotulo: 'Painel da fila (TV)', href: route('estabelecimentos.fila.painel', loja.id) },
        { rotulo: 'Cupons e marketing', href: route().has('estabelecimentos.cupons') ? route('estabelecimentos.cupons', loja.id) : null },
        { rotulo: 'Configurações', href: `/estabelecimentos/${loja.id}/configuracoes` },
    ].filter((i) => i.href);

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={aoAlternar} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900" title="Mais opções" aria-label="Mais opções">
                <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            {aberto && (
                <div className="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 text-left shadow-xl">
                    {itens.map((i) => (
                        <Link key={i.rotulo} href={i.href} className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900">
                            {i.rotulo}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function MeusEstabelecimentos({ auth, estabelecimentos, metricas, filtros = {} }) {
    const [busca, setBusca] = useState(filtros.busca || '');
    const [status, setStatus] = useState(filtros.status || 'Todos os status');
    const [menuAbertoId, setMenuAbertoId] = useState(null);
    const [lojaSelecionada, setLojaSelecionada] = useState(null);
    const primeiraVez = useRef(true);

    const pagina = estabelecimentos?.data ? estabelecimentos : { data: Array.isArray(estabelecimentos) ? estabelecimentos : [] };
    const lojas = pagina.data || [];
    const stats = metricas || { ativos: 0, total: 0, faturamento: 'R$ 0,00', variacao_faturamento: 0, aguardando: 0, funcionarios_ativos: 0 };

    // Busca e filtro no servidor (a lista é paginada), com espera curta enquanto digita.
    useEffect(() => {
        if (primeiraVez.current) { primeiraVez.current = false; return undefined; }
        const t = setTimeout(() => {
            router.get(route('estabelecimentos.index'), { busca: busca || undefined, status: status !== 'Todos os status' ? status : undefined }, { preserveState: true, preserveScroll: true, replace: true });
        }, 350);
        return () => clearTimeout(t);
    }, [busca, status]);

    const semNenhum = lojas.length === 0 && !busca && status === 'Todos os status';

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Meus Estabelecimentos" />

            <div className="mx-auto max-w-7xl space-y-5">
                {/* CABEÇALHO */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-[28px]">Meus Estabelecimentos</h1>
                        <p className="text-sm text-gray-500">Acompanhe o desempenho de todos os seus estabelecimentos em tempo real.</p>
                    </div>
                    <Link href={route('estabelecimentos.create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#16A34A]">
                        <PlusIcon className="h-5 w-5" strokeWidth={2.5} /> Novo estabelecimento
                    </Link>
                </div>

                {/* INDICADORES */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Indicador icone={BuildingStorefrontIcon} rotulo="Estabelecimentos ativos" valor={stats.ativos}
                        rodape={stats.ativos === stats.total ? 'Todos em funcionamento' : `${(stats.total || 0) - stats.ativos} inativo(s)`} />
                    <Indicador icone={CurrencyDollarIcon} rotulo="Faturamento total hoje" valor={stats.faturamento}
                        rodape={<Variacao valor={stats.variacao_faturamento} />} />
                    <Indicador icone={UserIcon} rotulo="Pessoas aguardando" valor={stats.aguardando} rodape="Em todas as unidades" />
                    <Indicador icone={UsersIcon} rotulo="Funcionários ativos" valor={stats.funcionarios_ativos} rodape="Na sua equipe" />
                </div>

                {semNenhum ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
                        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1E8] text-[#FF5A00]">
                            <BuildingStorefrontIcon className="h-8 w-8" />
                        </span>
                        <h2 className="text-xl font-bold text-gray-900">Você ainda não tem estabelecimentos</h2>
                        <p className="mb-6 mt-1 max-w-md text-sm text-gray-500">Crie o primeiro para começar a receber agendamentos, organizar a fila e acompanhar o faturamento.</p>
                        <Link href={route('estabelecimentos.create')} className="inline-flex items-center gap-2 rounded-xl bg-[#22C55E] px-6 py-3 font-bold text-white hover:bg-[#16A34A]">
                            <PlusIcon className="h-5 w-5" /> Criar estabelecimento
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                        {/* TÍTULO E FILTROS */}
                        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <h2 className="text-base font-bold text-gray-900">Lista de estabelecimentos</h2>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="search"
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                        placeholder="Buscar estabelecimento..."
                                        className="w-full rounded-lg border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] sm:w-64"
                                    />
                                </div>
                                <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border-gray-200 py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-[#FF5A00] focus:ring-[#FF5A00]">
                                    <option>Todos os status</option>
                                    <option>Ativos</option>
                                    <option>Inativos</option>
                                </select>
                            </div>
                        </div>

                        {lojas.length === 0 ? (
                            <p className="p-10 text-center text-sm text-gray-500">Nenhum estabelecimento encontrado com esses filtros.</p>
                        ) : (
                            <>
                                {/* TABELA (computador) */}
                                <div className="hidden md:block">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                                <th className="px-5 py-3">Estabelecimento</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Faturamento hoje</th>
                                                <th className="px-4 py-3">Aguardando</th>
                                                <th className="px-4 py-3">Funcionários</th>
                                                <th className="px-5 py-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {lojas.map((loja) => (
                                                <tr key={loja.id} className="transition hover:bg-gray-50/60">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <Foto loja={loja} />
                                                            <div className="min-w-0">
                                                                <p className="truncate font-bold text-gray-900">{loja.nome}</p>
                                                                <p className="max-w-[280px] truncate text-xs text-gray-500">{loja.endereco}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5"><Status loja={loja} /></td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-gray-900">{loja.faturamento_hoje}</p>
                                                        <Variacao valor={loja.variacao_hoje} pequeno />
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-gray-900">{loja.aguardando}</p>
                                                        <p className="text-[11px] text-gray-400">Aguardando</p>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-gray-900">{loja.funcionarios}</p>
                                                        <p className="text-[11px] text-gray-400">Funcionários</p>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button type="button" onClick={() => setLojaSelecionada(loja)} className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Ver resumo" aria-label="Ver resumo">
                                                                <EyeIcon className="h-4 w-4" />
                                                            </button>
                                                            <MenuAcoes loja={loja} aberto={menuAbertoId === loja.id} aoAlternar={() => setMenuAbertoId(menuAbertoId === loja.id ? null : loja.id)} aoFechar={() => setMenuAbertoId(null)} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* CARTÕES (celular) */}
                                <ul className="divide-y divide-gray-100 md:hidden">
                                    {lojas.map((loja) => (
                                        <li key={loja.id} className="space-y-3 p-4">
                                            <div className="flex items-start gap-3">
                                                <Foto loja={loja} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-bold text-gray-900">{loja.nome}</p>
                                                    <p className="truncate text-xs text-gray-500">{loja.endereco}</p>
                                                </div>
                                                <MenuAcoes loja={loja} aberto={menuAbertoId === loja.id} aoAlternar={() => setMenuAbertoId(menuAbertoId === loja.id ? null : loja.id)} aoFechar={() => setMenuAbertoId(null)} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{loja.faturamento_hoje}</p>
                                                    <p className="text-[10px] text-gray-400">hoje</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{loja.aguardando}</p>
                                                    <p className="text-[10px] text-gray-400">aguardando</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{loja.funcionarios}</p>
                                                    <p className="text-[10px] text-gray-400">funcionários</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Status loja={loja} />
                                                <button type="button" onClick={() => setLojaSelecionada(loja)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700">
                                                    <EyeIcon className="h-4 w-4" /> Resumo
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                {/* PAGINAÇÃO */}
                                {pagina.last_page > 1 && (
                                    <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 p-4">
                                        {(pagina.links || []).map((l, i) => {
                                            const primeiro = i === 0;
                                            const ultimo = i === pagina.links.length - 1;
                                            const conteudo = primeiro ? <ChevronLeftIcon className="h-4 w-4" /> : ultimo ? <ChevronRightIcon className="h-4 w-4" /> : l.label;
                                            const classe = `flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold ${l.active ? 'bg-[#FF8A00] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'} ${!l.url ? 'pointer-events-none opacity-40' : ''}`;
                                            return l.url ? (
                                                <Link key={i} href={l.url} preserveScroll className={classe}>{conteudo}</Link>
                                            ) : (
                                                <span key={i} className={classe}>{conteudo}</span>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* RESUMO (olho) */}
            {lojaSelecionada && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setLojaSelecionada(null)}>
                    <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setLojaSelecionada(null)} className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900" aria-label="Fechar">
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                        <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
                            <Foto loja={lojaSelecionada} tamanho="h-14 w-14" />
                            <div className="min-w-0">
                                <h3 className="truncate text-lg font-black text-gray-900">{lojaSelecionada.nome}</h3>
                                <p className="text-xs text-gray-500">{lojaSelecionada.ramo_atuacao || 'Resumo de hoje'}</p>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                                <span className="text-sm font-bold text-emerald-800">Faturamento hoje</span>
                                <div className="text-right">
                                    <span className="block text-lg font-black text-emerald-700">{lojaSelecionada.faturamento_hoje}</span>
                                    <Variacao valor={lojaSelecionada.variacao_hoje} pequeno />
                                </div>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"><MapPinIcon className="h-3.5 w-3.5" /> Endereço</span>
                                <span className="text-sm text-gray-800">{lojaSelecionada.endereco}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="rounded-xl bg-gray-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Aguardando</p>
                                    <p className="text-xl font-black text-gray-900">{lojaSelecionada.aguardando}</p>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Equipe ativa</p>
                                    <p className="text-xl font-black text-gray-900">{lojaSelecionada.funcionarios_ativos}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <span className="text-sm font-bold text-gray-600">Situação</span>
                                <Status loja={lojaSelecionada} />
                            </div>
                        </div>
                        <Link href={`/estabelecimentos/${lojaSelecionada.id}/configuracoes`} className="mt-5 flex w-full items-center justify-center rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-black">
                            Abrir configurações
                        </Link>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
