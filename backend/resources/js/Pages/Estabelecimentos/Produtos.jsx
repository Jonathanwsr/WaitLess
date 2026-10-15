import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ComoFunciona from '@/Components/ComoFunciona';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ShoppingBagIcon, TruckIcon, LinkIcon, CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import ProdutoManager from './ProdutoManager';
import ProdutoEntregaManager from './ProdutoEntregaManager';

/**
 * Tela única de produtos. Existem dois tipos, com regras diferentes, e cada um tem a sua aba:
 * - "Com serviço ou reserva": item extra oferecido junto de um agendamento ou locação (ou venda avulsa na loja).
 * - "Entrega e retirada": produto vendido sozinho, entregue em casa ou buscado no endereço do vendedor.
 */
const TIPOS = [
    {
        id: 'vinculados',
        titulo: 'Com serviço ou reserva',
        icone: LinkIcon,
        cor: 'text-indigo-600 bg-indigo-50',
        resumo: 'Itens extras oferecidos junto de um serviço ou de uma reserva.',
        detalhes: [
            'Aparecem para o cliente como adicional na hora de agendar o serviço ou reservar o item.',
            'Exemplos: pomada depois do corte, kit de churrasco com a quadra, toalha com a diária.',
            'Sem vínculo, o produto vira uma venda avulsa na vitrine do seu local.',
            'O pagamento vai junto com o do agendamento ou da reserva.',
        ],
    },
    {
        id: 'entrega',
        titulo: 'Entrega e retirada',
        icone: TruckIcon,
        cor: 'text-[#FF5A00] bg-orange-50',
        resumo: 'Produtos vendidos sozinhos, entregues em casa ou buscados no seu endereço.',
        detalhes: [
            'Aparecem no catálogo de produtos para entrega, com busca e filtros.',
            'Exemplos: botijão de gás, galão de água, itens de mercado, bebidas.',
            'O cliente paga online (liberado quando ele confirma o código de 6 dígitos), no local ou direto com você.',
            'Os pedidos aparecem em “Entregas”, onde você escolhe quem entrega e finaliza.',
        ],
    },
];

export default function Produtos({ aba = 'vinculados', podeEntrega = false, vinculados = {}, entrega = null }) {
    const { auth } = usePage().props;
    const [ativa, setAtiva] = useState(aba);
    const [explicacaoAberta, setExplicacaoAberta] = useState(true);

    const tipos = TIPOS.filter((t) => t.id !== 'entrega' || podeEntrega);

    const trocar = (id) => {
        setAtiva(id);
        // Guarda a aba na URL sem recarregar: depois de salvar um produto a página volta para a mesma aba.
        try {
            const url = new URL(window.location.href);
            if (id === 'entrega') url.searchParams.set('aba', 'entrega'); else url.searchParams.delete('aba');
            window.history.replaceState(window.history.state, '', url);
        } catch {
            // Sem acesso ao histórico: a aba só não fica lembrada.
        }
    };

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Produtos" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <ShoppingBagIcon className="w-8 h-8 text-[#FF5A00]" />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Produtos</h1>
                        <p className="text-sm text-gray-500">Todos os seus produtos num lugar só. Escolha o tipo abaixo.</p>
                    </div>
                </div>

                {/* EXPLICAÇÃO DOS TIPOS */}
                <div className="mt-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setExplicacaoAberta((v) => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                        aria-expanded={explicacaoAberta}
                    >
                        <span className="font-bold text-gray-900">Qual a diferença entre os tipos de produto?</span>
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition ${explicacaoAberta ? 'rotate-180' : ''}`} />
                    </button>
                    {explicacaoAberta && (
                        <div className={`grid gap-4 px-5 pb-5 ${tipos.length > 1 ? 'md:grid-cols-2' : ''}`}>
                            {tipos.map((t) => (
                                <div key={t.id} className="rounded-2xl border border-gray-100 p-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.cor}`}>
                                            <t.icone className="w-5 h-5" />
                                        </span>
                                        <div>
                                            <p className="font-black text-gray-900">{t.titulo}</p>
                                            <p className="text-xs text-gray-500">{t.resumo}</p>
                                        </div>
                                    </div>
                                    <ul className="mt-3 space-y-1.5">
                                        {t.detalhes.map((d) => (
                                            <li key={d} className="flex gap-2 text-sm text-gray-600">
                                                <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {d}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PASSO A PASSO DA ABA ESCOLHIDA */}
                <div className="mt-4">
                    {ativa === 'entrega' ? (
                        <ComoFunciona
                            chave="produtos_entrega"
                            titulo="Como vender produtos para entrega ou retirada"
                            passos={[
                                { titulo: 'Cadastre o produto', texto: 'Fotos, preço, estoque e se aceita entrega, retirada ou os dois.' },
                                { titulo: 'O cliente compra', texto: 'Ele paga online ou no local. Cada pessoa pode fazer 1 compra por minuto, para evitar robôs.' },
                                { titulo: 'Separe e entregue', texto: 'Em "Entregas" você escolhe quem leva e o cliente acompanha. Na retirada, ele mostra o código.' },
                                { titulo: 'Conclua e receba', texto: 'Com o código de confirmação o pedido é concluído e o valor online é liberado para você.' },
                            ]}
                            dicas={[
                                'Os pontos do cliente são proporcionais ao valor do produto.',
                                'Se você cancelar um pedido pago, o cliente recebe o dinheiro de volta.',
                                'Promoção e vendedor Premium aparecem antes no catálogo.',
                                'Pagamento online só para quem tem CNPJ (MEI serve). Sem CNPJ, o cliente paga no local.',
                            ]}
                        />
                    ) : (
                        <ComoFunciona
                            chave="produtos_vinculados"
                            titulo="Como funcionam os produtos com serviço ou reserva"
                            passos={[
                                { titulo: 'Cadastre o produto', texto: 'Ex.: pomada na barbearia, café da manhã na pousada, cadeirinha no aluguel de carro.' },
                                { titulo: 'Ligue ao serviço ou reserva', texto: 'Escolha em qual serviço ou item ele aparece. Use o filtro para ver os de cada um.' },
                                { titulo: 'O cliente adiciona', texto: 'Na hora de agendar ou reservar, ele marca o produto e o valor entra no mesmo pagamento.' },
                                { titulo: 'Você entrega no atendimento', texto: 'O produto aparece junto do agendamento ou da reserva para a equipe não esquecer.' },
                            ]}
                            dicas={[
                                'Bom para aumentar o valor de cada atendimento sem criar um pedido separado.',
                                'Produto inativo some para o cliente, mas os pedidos já feitos continuam valendo.',
                            ]}
                        />
                    )}
                </div>

                {/* ABAS */}
                {tipos.length > 1 && (
                    <div className="mt-5 flex bg-gray-200/70 rounded-2xl p-1" role="tablist">
                        {tipos.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={ativa === t.id}
                                onClick={() => trocar(t.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${ativa === t.id ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <t.icone className="w-4 h-4" /> {t.titulo}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-4">
                {ativa === 'entrega' && entrega ? (
                    <ProdutoEntregaManager {...entrega} embutido />
                ) : (
                    <ProdutoManager auth={auth} {...vinculados} embutido />
                )}
            </div>
        </AuthenticatedLayout>
    );
}
