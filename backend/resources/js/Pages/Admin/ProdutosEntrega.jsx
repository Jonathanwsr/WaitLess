import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { TruckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { brl } from '@/lib/produtosEntrega';

const ABAS = [
    { id: 'produtos', label: 'Produtos' },
    { id: 'estornos', label: 'Estornos online' },
    { id: 'disputas', label: 'Disputas (fora da plataforma)' },
];

const ESTORNO_FINALIZADO = ['ESTORNADO', 'REPROVADO', 'CANCELADO'];

export default function ProdutosEntrega({ produtos = [], estornosOnline = [], disputasForaDaPlataforma = [] }) {
    const [aba, setAba] = useState('produtos');
    const [removendo, setRemovendo] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [erro, setErro] = useState(null);

    const removerProduto = () => {
        if (!removendo || motivo.trim().length < 5) return;
        router.delete(route('admin.produtos-entrega.destroy', removendo.id), {
            data: { motivo },
            preserveScroll: true,
            onSuccess: () => { setRemovendo(null); setMotivo(''); },
        });
    };

    const decidirEstorno = async (estorno, aprovar) => {
        setErro(null);
        let motivoReprovacao = null;
        if (!aprovar) {
            motivoReprovacao = window.prompt('Motivo da reprovação (mínimo 5 caracteres):');
            if (!motivoReprovacao || motivoReprovacao.trim().length < 5) return;
        }
        try {
            await axios.post(
                aprovar ? `/api/admin/estornos/${estorno.id}/aprovar` : `/api/admin/estornos/${estorno.id}/reprovar`,
                aprovar ? {} : { motivo: motivoReprovacao }
            );
            router.reload({ only: ['estornosOnline'] });
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível concluir a ação.');
        }
    };

    const decidirDisputa = (pedido, decisao) => {
        const resposta = window.prompt(decisao === 'aprovar' ? 'Mensagem para as partes (opcional):' : 'Motivo da recusa:', '');
        if (resposta === null) return;
        router.post(route('admin.produtos-entrega.disputa', pedido.id), { decisao, resposta }, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Produtos para entrega · Admin" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24">
                <header className="mb-6">
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <TruckIcon className="w-8 h-8 text-[#FF5A00]" /> Produtos para entrega
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Remova produtos, acompanhe estornos e decida disputas de produtos.</p>
                </header>

                <div className="flex gap-2 overflow-x-auto mb-6">
                    {ABAS.map((a) => (
                        <button
                            key={a.id}
                            onClick={() => setAba(a.id)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${aba === a.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                        >
                            {a.label}
                            {a.id === 'estornos' && estornosOnline.length > 0 && <span className="ml-2 text-[10px] bg-[#FF5A00] text-white px-1.5 py-0.5 rounded-full">{estornosOnline.length}</span>}
                            {a.id === 'disputas' && disputasForaDaPlataforma.length > 0 && <span className="ml-2 text-[10px] bg-[#FF5A00] text-white px-1.5 py-0.5 rounded-full">{disputasForaDaPlataforma.length}</span>}
                        </button>
                    ))}
                </div>

                {erro && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-2xl">{erro}</div>}

                {aba === 'produtos' && (
                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-400">
                                <tr>
                                    <th className="px-5 py-3">Produto</th>
                                    <th className="px-5 py-3">Vendedor</th>
                                    <th className="px-5 py-3">Categoria</th>
                                    <th className="px-5 py-3 text-right">Preço</th>
                                    <th className="px-5 py-3 text-right">Pedidos</th>
                                    <th className="px-5 py-3">Situação</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {produtos.map((p) => (
                                    <tr key={p.id} className={p.deleted_at ? 'opacity-60' : ''}>
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-zinc-900">{p.nome}</p>
                                            <p className="text-xs text-zinc-400">{p.estabelecimento?.nome || 'Avulso'}</p>
                                        </td>
                                        <td className="px-5 py-3 text-zinc-600">{p.vendedor?.name}<span className="block text-xs text-zinc-400">{p.vendedor?.email}</span></td>
                                        <td className="px-5 py-3 text-zinc-600">{p.categoria || '—'}</td>
                                        <td className="px-5 py-3 text-right font-semibold">{brl(p.valor)}</td>
                                        <td className="px-5 py-3 text-right text-zinc-600">{p.pedidos_count}</td>
                                        <td className="px-5 py-3">
                                            {p.deleted_at
                                                ? <span className="text-xs font-bold text-red-600">Removido: {p.motivo_remocao}</span>
                                                : <span className="text-xs font-bold text-emerald-600">Ativo</span>}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {!p.deleted_at && (
                                                <button onClick={() => { setRemovendo(p); setMotivo(''); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700">
                                                    <TrashIcon className="w-4 h-4" /> Remover
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {produtos.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-zinc-400">Nenhum produto cadastrado.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {aba === 'estornos' && (
                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-400">
                                <tr>
                                    <th className="px-5 py-3">Código</th>
                                    <th className="px-5 py-3">Cliente</th>
                                    <th className="px-5 py-3">Motivo</th>
                                    <th className="px-5 py-3 text-right">Valor</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {estornosOnline.map((e) => {
                                    const finalizado = ESTORNO_FINALIZADO.includes(e.status);
                                    return (
                                        <tr key={e.id}>
                                            <td className="px-5 py-3 font-mono text-xs text-zinc-500">{e.codigo_estorno || `#${e.id}`}</td>
                                            <td className="px-5 py-3">{e.cliente?.name}<span className="block text-xs text-zinc-400">{e.pedido_entrega?.produto?.nome}</span></td>
                                            <td className="px-5 py-3 text-zinc-600 max-w-xs truncate">{e.motivo}</td>
                                            <td className="px-5 py-3 text-right font-semibold">{brl(e.valor_pago)}</td>
                                            <td className="px-5 py-3 text-xs font-bold text-zinc-700">{e.status}</td>
                                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                                {!finalizado && (
                                                    <>
                                                        <button onClick={() => decidirEstorno(e, true)} className="text-xs font-bold text-emerald-700 mr-3">Aprovar</button>
                                                        <button onClick={() => decidirEstorno(e, false)} className="text-xs font-bold text-red-600">Reprovar</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {estornosOnline.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-400">Nenhum estorno de produto.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {aba === 'disputas' && (
                    <div className="space-y-3">
                        {disputasForaDaPlataforma.map((p) => (
                            <div key={p.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-zinc-900">{p.produto?.nome} <span className="text-xs font-normal text-zinc-400">· {p.codigo_pedido}</span></p>
                                    <p className="text-xs text-zinc-500 mt-0.5">Cliente {p.cliente?.name} · vendedor {p.vendedor?.name} · {brl(p.valor_total)}</p>
                                    <p className="text-sm text-zinc-700 mt-2"><strong>{p.disputa_motivo}</strong> — {p.disputa_descricao}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.disputa_status === 'solicitado' ? (
                                        <>
                                            <button onClick={() => decidirDisputa(p, 'aprovar')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 text-white">Aprovar</button>
                                            <button onClick={() => decidirDisputa(p, 'reprovar')} className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-100 text-zinc-700">Reprovar</button>
                                        </>
                                    ) : (
                                        <span className="text-xs font-bold text-zinc-500 uppercase">{p.disputa_status}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {disputasForaDaPlataforma.length === 0 && <p className="text-center text-zinc-400 py-12">Nenhuma disputa de pagamento fora da plataforma.</p>}
                    </div>
                )}
            </div>

            {removendo && (
                <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-zinc-900">Remover "{removendo.nome}"</h3>
                            <button onClick={() => setRemovendo(null)} className="text-zinc-400 hover:text-zinc-600" aria-label="Fechar"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-zinc-600 mb-4">
                            Pedidos em aberto serão cancelados. Quem já pagou online recebe o valor de volta, e o vendedor é avisado com o motivo.
                        </p>
                        <textarea
                            className="w-full rounded-2xl border-zinc-200 px-4 py-3 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]"
                            rows={3}
                            placeholder="Motivo (mínimo 5 caracteres)"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />
                        <button
                            onClick={removerProduto}
                            disabled={motivo.trim().length < 5}
                            className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-2xl transition disabled:opacity-40"
                        >
                            Remover produto
                        </button>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
