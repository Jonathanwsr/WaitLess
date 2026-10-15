import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    BanknotesIcon, ChartBarIcon, PresentationChartLineIcon, DocumentArrowDownIcon, ClipboardDocumentListIcon,
    ReceiptPercentIcon, BoltIcon, ArrowRightIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';

/**
 * Central de relatórios do sócio/gerente: todos os relatórios num lugar só, cada um com uma frase
 * dizendo o que ele mostra. Só aparece o que a pessoa pode abrir.
 */
export default function Relatorios() {
    const { auth, menuPremium } = usePage().props;
    const papel = String(auth.user?.papel || '').toLowerCase();
    const ehSocio = ['socio', 'sócio', 'proprietario', 'proprietário', 'admin'].includes(papel);

    const grupos = [
        {
            titulo: 'Dinheiro',
            itens: [
                { rota: 'provider.financeiro', icone: BanknotesIcon, titulo: 'Extrato financeiro', texto: 'Entradas, taxas, estornos e repasses por período, com exportação.' },
                ehSocio && { rota: 'carteira.asaas', icone: ReceiptPercentIcon, titulo: 'Carteira e comprovantes', texto: 'Saldo, saques e comprovantes de recebimento por cliente e data.' },
                { rota: 'entregas.painel-vendas.page', icone: ChartBarIcon, titulo: 'Painel de vendas', texto: 'Faturamento, produtos mais vendidos e melhores horários.' },
            ],
        },
        {
            titulo: 'Atendimentos',
            itens: [
                { rota: 'gestao.pedidos.index', icone: DocumentArrowDownIcon, titulo: 'Histórico em PDF', texto: 'Todos os serviços e reservas do dia ou do mês, com cliente e situação.' },
                { rota: 'gestao.pedidos.index', icone: ClipboardDocumentListIcon, titulo: 'Pedidos da gestão', texto: 'O que foi pedido, a situação de cada um e quem está atendendo.' },
            ],
        },
        {
            titulo: 'Crescimento',
            itens: [
                { rota: 'relatorios.avancado', icone: PresentationChartLineIcon, titulo: 'Relatório avançado', texto: 'Clientes, retorno, ocupação e comparação entre períodos.', premium: true },
                { rota: 'gestao.flash-deals.index', icone: BoltIcon, titulo: 'Resultados dos Flash Deals', texto: 'Quantos foram avisados, abriram e compraram em cada oferta.' },
            ],
        },
    ].map((g) => ({ ...g, itens: g.itens.filter((i) => i && route().has(i.rota)) })).filter((g) => g.itens.length);

    return (
        <AuthenticatedLayout header={<h2 className="font-semibold text-xl text-gray-800">Relatórios</h2>}>
            <Head title="Relatórios" />

            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Relatórios</h1>
                    <p className="text-sm text-gray-500">Escolha o que você quer acompanhar. Tudo pode ser filtrado por período dentro de cada relatório.</p>
                </div>

                {grupos.map((g) => (
                    <section key={g.titulo}>
                        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">{g.titulo}</h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {g.itens.map((i) => {
                                const Icone = i.icone;
                                const bloqueado = i.premium && !menuPremium;
                                return (
                                    <Link
                                        key={i.titulo}
                                        href={route(i.rota)}
                                        className="group flex flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-sm hover:border-orange-200 hover:shadow-md transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF5A00]">
                                                <Icone className="h-6 w-6" />
                                            </span>
                                            {bloqueado && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-zinc-900">
                                                    <LockClosedIcon className="h-3 w-3" /> PREMIUM
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-3 font-bold text-gray-900">{i.titulo}</p>
                                        <p className="mt-1 flex-1 text-sm text-gray-500">{i.texto}</p>
                                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#FF5A00]">
                                            Abrir <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
