import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { Store, Scissors, KeyRound, Package, Check, ChevronDown, Lightbulb, ArrowRight } from 'lucide-react';

const TUTORIAIS = [
    {
        id: 'local',
        rotulo: 'Local',
        titulo: 'Cadastrar um local',
        icone: Store,
        tempo: '3 min',
        resumo: 'O local é o seu estabelecimento: é nele que ficam a fila, a equipe e os serviços.',
        botao: 'Criar meu local',
        passos: [
            { titulo: 'Abra o cadastro de local', texto: 'No menu lateral ou no Painel, clique em “Novo local”.' },
            {
                titulo: 'Preencha os dados da empresa',
                texto: 'Os campos com asterisco (*) são obrigatórios. O restante pode ser completado depois em Configurações.',
                campos: ['Nome *', 'CNPJ *', 'Razão social', 'Ramo de atuação', 'Telefone', 'Site', 'Descrição'],
                dica: 'Use o nome pelo qual seus clientes já conhecem você — é ele que aparece na busca.',
            },
            {
                titulo: 'Informe o endereço',
                texto: 'Digite o CEP: rua, bairro, cidade e UF são preenchidos automaticamente. Falta só o número.',
                campos: ['CEP', 'Rua', 'Número *', 'Complemento', 'Bairro', 'Cidade', 'UF'],
                dica: 'Endereço correto ajuda o cliente a encontrar você e aparece no filtro por estado.',
            },
            {
                titulo: 'Salve e complete o perfil',
                texto: 'Clique no botão verde para salvar. Depois, em Configurações → Perfil da Loja, adicione foto de perfil e banner.',
                dica: 'Confira como o cliente vê o seu local em “Minha vitrine”.',
            },
        ],
    },
    {
        id: 'servico',
        rotulo: 'Serviço',
        titulo: 'Cadastrar um serviço',
        icone: Scissors,
        tempo: '4 min',
        resumo: 'Serviço é o que o cliente agenda no seu local: corte, consulta, revisão, massagem…',
        botao: 'Criar meu serviço',
        passos: [
            { titulo: 'Tenha um local cadastrado', texto: 'Todo serviço pertence a um local. Se ainda não criou o seu, comece pelo tutorial “Local”.' },
            { titulo: 'Abra Configurações → Serviços', texto: 'No menu lateral clique em “Configurações” e escolha a aba de serviços (Catálogo de Serviços).' },
            {
                titulo: 'Descreva o serviço',
                texto: 'Diga o que é, quanto custa e quanto tempo leva. A duração define o tamanho de cada horário na agenda.',
                campos: ['Nome', 'Descrição', 'Valor', 'Duração (minutos)'],
                dica: 'Uma descrição curta e objetiva converte mais do que um texto longo.',
            },
            {
                titulo: 'Defina quando ele é oferecido',
                texto: 'Marque os dias da semana e inclua os horários de atendimento. Horários já ocupados somem da agenda do cliente automaticamente.',
                campos: ['Dias da semana', 'Horários de atendimento'],
            },
            {
                titulo: 'Adicione fotos e salve',
                texto: 'Envie fotos do serviço e clique no botão verde para publicar.',
                dica: 'Fotos reais do resultado do seu trabalho aumentam muito os agendamentos.',
            },
        ],
    },
    {
        id: 'reserva',
        rotulo: 'Reserva',
        titulo: 'Cadastrar uma reserva',
        icone: KeyRound,
        tempo: '5 min',
        resumo: 'Reservas (locações) são itens que você aluga por diária: quadra, sala, equipamento, veículo, imóvel…',
        botao: 'Criar minha reserva',
        passos: [
            { titulo: 'Abra Locações', texto: 'No menu lateral clique em “Locações” e depois em “Nova locação”.' },
            {
                titulo: 'Identifique o item',
                texto: 'Escolha a categoria correta: ela define se o cliente verá campos de retirada e entrega.',
                campos: ['Nome', 'Categoria', 'Valor da diária', 'Unidades disponíveis', 'Descrição'],
                dica: 'Só itens e veículos têm local de retirada/entrega. Espaços e hospedagens não pedem esse dado.',
            },
            {
                titulo: 'Configure pessoas e preço',
                texto: 'Informe a capacidade máxima e quantas pessoas já estão incluídas na diária. Acima disso, cobra-se o valor extra por pessoa.',
                campos: ['Capacidade', 'Pessoas incluídas', 'Valor por pessoa extra'],
            },
            {
                titulo: 'Marque as comodidades e a disponibilidade',
                texto: 'Selecione o que está incluso e escolha os dias em que o item pode ser reservado. Datas já reservadas ficam bloqueadas sozinhas, sem risco de reserva dupla.',
                campos: ['Comodidades', 'Datas disponíveis', 'Dias da semana'],
            },
            {
                titulo: 'Adicione fotos e publique',
                texto: 'Envie boas fotos e clique em “Criar locação”. A reserva aparece em Explorar → Reservas para os clientes.',
                dica: 'O cliente pode pagar no cartão em até 12x, e você recebe no próximo repasse semanal.',
            },
        ],
    },
    {
        id: 'produto',
        rotulo: 'Produto',
        titulo: 'Vender um produto',
        icone: Package,
        tempo: '6 min',
        resumo: 'Todos os produtos ficam em “Produtos”, separados em dois tipos: os que vão junto de um serviço ou reserva, e os vendidos com entrega ou retirada.',
        botao: 'Cadastrar meu produto',
        passos: [
            {
                titulo: 'Entenda os dois tipos de produto',
                texto: 'No menu lateral clique em “Produtos”. A tela tem duas abas: “Com serviço ou reserva” é o item extra oferecido na hora de agendar ou reservar (pomada depois do corte, kit com a quadra); “Entrega e retirada” é o produto vendido sozinho, entregue em casa ou buscado no seu endereço (gás, água, mercado).',
                campos: ['Com serviço ou reserva', 'Entrega e retirada'],
                dica: 'Na aba “Com serviço ou reserva” você filtra por serviço, por reserva ou pelos avulsos, e cada produto mostra a que está vinculado.',
            },
            {
                titulo: 'Produto junto de um serviço ou reserva',
                texto: 'Na aba “Com serviço ou reserva”, cadastre o produto e escolha em “Vincular a um serviço” ou “Vincular a uma reserva”. Sem vínculo, ele vira uma venda avulsa na vitrine do seu local.',
                campos: ['Nome', 'Categoria', 'Valor', 'Estoque', 'Vincular a um serviço', 'Vincular a uma reserva'],
                dica: 'O cliente paga o produto junto com o agendamento ou a reserva.',
            },
            { titulo: 'Produto para entrega ou retirada', texto: 'Na aba “Entrega e retirada”, clique em “Novo produto”. Os próximos passos mostram cada campo.' },
            {
                titulo: 'Identifique o produto',
                texto: 'Quanto mais completo, mais fácil o cliente encontra: a busca procura no nome, na descrição, na categoria e no nome do seu local.',
                campos: ['Nome do produto', 'Categoria', 'Marca', 'Peso ou volume', 'Unidade de medida', 'Código interno (SKU)', 'Tags', 'Descrição (opcional)'],
                dica: 'Escolha a categoria certa: o cliente filtra o catálogo por ela.',
            },
            {
                titulo: 'Defina preço e estoque',
                texto: 'Informe o valor e quantas unidades você tem. O estoque baixa sozinho a cada venda e volta quando um pedido é cancelado.',
                campos: ['Valor normal (R$)', 'Estoque disponível', 'Quantidade mínima por pedido', 'Em promoção', 'Valor promocional (R$)'],
                dica: 'Produtos em promoção ganham selo de desconto e aparecem no filtro “Em promoção”.',
            },
            {
                titulo: 'Escolha entrega, retirada ou os dois',
                texto: 'Marque se você entrega em casa, se o cliente pode buscar, ou ambos. Preencha o endereço de onde o produto sai.',
                campos: ['Entrego em casa', 'Aceito retirada no local', 'Taxa de entrega (R$)', 'Endereço de origem'],
                dica: 'A taxa de entrega só é cobrada quando o cliente escolhe receber em casa.',
            },
            {
                titulo: 'Vincule ao local, adicione fotos e publique',
                texto: 'Vincule a um local já cadastrado (ou deixe avulso), envie até 3 fotos e deixe “Ativo” marcado para aparecer no catálogo.',
                campos: ['Vincular a um local (opcional)', 'Fotos (até 3)', 'Ativo'],
                dica: 'Para receber pagamento online, configure sua carteira em Financeiro. Sem ela, o cliente paga no local ou direto com você.',
            },
            {
                titulo: 'Depois da venda: entregue e finalize',
                texto: 'Em “Entregas” você escolhe quem entrega (um funcionário ou você mesmo). Pedido pago online: peça ao cliente o código de 6 dígitos para liberar o pagamento. Pagamento no local: basta clicar em “Finalizado”.',
                dica: 'Precisa cancelar? Em “Entregas” use “Cancelar pedido”: quem pagou online recebe o valor de volta automaticamente.',
            },
        ],
    },
];

const PROXIMO = { local: 'servico', servico: 'reserva', reserva: 'produto' };

export default function Tutoriais({ auth, locais = [], progresso = {}, fluxoInicial = 'local' }) {
    const [ativo, setAtivo] = useState(fluxoInicial);
    const [aberto, setAberto] = useState(0);

    const tutorial = TUTORIAIS.find((t) => t.id === ativo);
    const concluidas = TUTORIAIS.filter((t) => progresso[t.id]).length;

    const destino = () => {
        if (ativo === 'local') return route('estabelecimentos.create');
        if (ativo === 'reserva') return route('locacoes.avulsas.index');
        if (ativo === 'produto') return route('produtos.meus', { aba: 'entrega' });
        if (locais.length === 0) return null;
        return route('estabelecimentos.configuracoes', locais[0].id) + '?aba=servicos';
    };
    const href = destino();

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Tutoriais" />

            <div className="bg-zinc-50 min-h-screen pb-20">
                <div className="max-w-3xl mx-auto px-4 py-8">
                    {/* HERO */}
                    <div className="rounded-3xl bg-gradient-to-br from-[#006837] to-emerald-600 text-white p-7 shadow-lg">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Comece a vender em {TUTORIAIS.length} passos</h1>
                        <p className="text-emerald-50 mt-2 text-sm md:text-base">Cadastre seu local, seus serviços, suas reservas e seus produtos. Cada tutorial leva poucos minutos.</p>
                        <div className="flex items-center mt-6">
                            {TUTORIAIS.map((t, i) => (
                                <div key={t.id} className="flex items-center flex-1 last:flex-none">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${progresso[t.id] ? 'bg-white text-[#006837]' : 'bg-white/25 text-white'}`}>
                                        {progresso[t.id] ? <Check className="w-5 h-5" /> : i + 1}
                                    </div>
                                    {i < TUTORIAIS.length - 1 && <div className={`flex-1 h-1 rounded mx-2 ${progresso[t.id] ? 'bg-white' : 'bg-white/25'}`} />}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-emerald-50 mt-3 font-semibold">{concluidas} de {TUTORIAIS.length} etapas concluídas</p>
                    </div>

                    {/* ABAS */}
                    <div className="mt-6 flex bg-zinc-200/70 rounded-2xl p-1">
                        {TUTORIAIS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => { setAtivo(t.id); setAberto(0); }}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${ativo === t.id ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                {t.rotulo}
                            </button>
                        ))}
                    </div>

                    {/* RESUMO */}
                    <div className="mt-4 bg-white rounded-3xl shadow-sm p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#006837] flex items-center justify-center">
                                <tutorial.icone className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-black text-gray-900">{tutorial.titulo}</h2>
                                <p className="text-xs text-gray-500 font-medium">
                                    {progresso[ativo] ? 'Você já concluiu esta etapa' : `${tutorial.passos.length} passos · cerca de ${tutorial.tempo}`}
                                </p>
                            </div>
                            {progresso[ativo] && <Check className="w-6 h-6 text-emerald-600" />}
                        </div>
                        <p className="text-sm text-gray-600 mt-3 leading-relaxed">{tutorial.resumo}</p>
                    </div>

                    {/* PASSOS */}
                    <div className="mt-4 space-y-3">
                        {tutorial.passos.map((p, i) => {
                            const on = aberto === i;
                            return (
                                <div key={p.titulo} className={`bg-white rounded-2xl shadow-sm border-2 transition ${on ? 'border-[#006837]' : 'border-transparent'}`}>
                                    <button type="button" onClick={() => setAberto(on ? -1 : i)} className="w-full flex items-center gap-3 p-4 text-left">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${on ? 'bg-[#006837] text-white' : 'bg-zinc-100 text-gray-500'}`}>{i + 1}</span>
                                        <span className="flex-1 font-bold text-gray-900">{p.titulo}</span>
                                        <ChevronDown className={`w-5 h-5 text-gray-400 transition ${on ? 'rotate-180' : ''}`} />
                                    </button>
                                    {on && (
                                        <div className="px-4 pb-4 pl-15 md:pl-[60px]">
                                            <p className="text-sm text-gray-700 leading-relaxed">{p.texto}</p>
                                            {p.campos && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {p.campos.map((c) => (
                                                        <span key={c} className="bg-zinc-100 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full">{c}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {p.dica && (
                                                <div className="mt-3 flex gap-2 bg-amber-50 text-amber-800 rounded-xl p-3 text-xs font-medium leading-relaxed">
                                                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <span>{p.dica}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* AÇÃO */}
                    {href ? (
                        <Link href={href} className="mt-6 flex items-center justify-center gap-2 h-14 rounded-full bg-[#006837] hover:bg-[#00552d] text-white font-black text-base transition">
                            {progresso[ativo] ? 'Cadastrar outro' : tutorial.botao} <ArrowRight className="w-5 h-5" />
                        </Link>
                    ) : (
                        <button type="button" onClick={() => setAtivo('local')} className="mt-6 w-full flex items-center justify-center gap-2 h-14 rounded-full bg-[#006837] text-white font-black text-base">
                            Crie um local primeiro <ArrowRight className="w-5 h-5" />
                        </button>
                    )}

                    {PROXIMO[ativo] && (
                        <button
                            type="button"
                            onClick={() => { setAtivo(PROXIMO[ativo]); setAberto(0); }}
                            className="w-full mt-3 py-3 text-sm font-bold text-gray-500 hover:text-gray-800"
                        >
                            Próximo tutorial: {TUTORIAIS.find((t) => t.id === PROXIMO[ativo]).rotulo.toLowerCase()}
                        </button>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
