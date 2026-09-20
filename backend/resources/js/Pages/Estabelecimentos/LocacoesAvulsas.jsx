import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import {
    Plus, Home, Car, Package, Crown, Tag, Coins, Pencil, Trash2, X,
    ImageOff, Clock, User as UserIcon, Building2,
} from 'lucide-react';

const formatarMoeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const ICONE_GRUPO = {
    'Imóveis': Home,
    'Veículos': Car,
    'Espaços': Building2,
    'Equipamentos': Package,
    'Outros': Package,
};

function CardLocacao({ item, onEditar, onExcluir }) {
    const fotos = Array.isArray(item.fotos) ? item.fotos : [];
    const capa = fotos[0] || null;

    return (
        <div className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition">
            <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                {capa ? (
                    <img src={capa} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageOff className="w-10 h-10" />
                    </div>
                )}

                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {item.somente_premium && (
                        <span className="inline-flex items-center gap-1 bg-[#FF5A00] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Crown className="w-3 h-3" /> Premium
                        </span>
                    )}
                    {item.tem_promocao && (
                        <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Tag className="w-3 h-3" /> Promoção
                        </span>
                    )}
                    {item.aceita_pontos && (
                        <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            <Coins className="w-3 h-3" /> Pontos
                        </span>
                    )}
                </div>

                {!item.ativo && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xs font-black uppercase tracking-wider">Inativo</span>
                    </div>
                )}

                <div className="absolute top-3 right-3 flex gap-1.5">
                    <button onClick={() => onEditar(item)} className="bg-white/95 hover:bg-white p-2 rounded-full shadow" aria-label="Editar">
                        <Pencil className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={() => onExcluir(item)} className="bg-white/95 hover:bg-white p-2 rounded-full shadow" aria-label="Excluir">
                        <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{item.categoria}</span>
                <h3 className="font-black text-gray-900 text-base leading-tight mb-1 line-clamp-2">{item.nome}</h3>
                {item.descricao && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.descricao}</p>}

                <div className="mt-auto pt-2">
                    <span className="text-[11px] text-gray-400 font-bold uppercase block">Diária</span>
                    <span className="text-xl font-black text-[#FF5A00]">R$ {formatarMoeda(item.valor_diaria)}</span>
                </div>
            </div>
        </div>
    );
}

function ModalFormulario({ aberto, onFechar, itemEditando, categorias }) {
    const editando = !!itemEditando;

    const { data, setData, post, processing, errors, reset } = useForm({
        nome: itemEditando?.nome || '',
        categoria: itemEditando?.categoria || '',
        descricao: itemEditando?.descricao || '',
        valor_diaria: itemEditando?.valor_diaria || '',
        quantidade: itemEditando?.quantidade || 1,
        somente_premium: itemEditando?.somente_premium || false,
        tem_promocao: itemEditando?.tem_promocao || false,
        tipo_desconto: itemEditando?.tipo_desconto || 'percentual',
        valor_desconto: itemEditando?.valor_desconto || '',
        aceita_pontos: itemEditando?.aceita_pontos || false,
        maximo_pontos_permitidos: itemEditando?.maximo_pontos_permitidos || '',
        ativo: itemEditando?.ativo ?? true,
        fotos: [],
    });

    if (!aberto) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const opcoes = {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { reset(); onFechar(); },
        };

        if (editando) {
            post(route('locacoes.avulsas.update', itemEditando.id), { ...opcoes, data: { ...data, _method: 'put' } });
        } else {
            post(route('locacoes.avulsas.store'), opcoes);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl my-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-black text-gray-900">{editando ? 'Editar Locação' : 'Nova Locação Avulsa'}</h3>
                    <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Nome</label>
                            <input type="text" value={data.nome} onChange={e => setData('nome', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" placeholder="Ex: Apartamento na praia, Honda CG 160..." />
                            {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Categoria</label>
                            <select value={data.categoria} onChange={e => setData('categoria', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30">
                                <option value="">Selecione...</option>
                                {Object.entries(categorias).map(([grupo, opcoes]) => (
                                    <optgroup label={grupo} key={grupo}>
                                        {opcoes.map(op => <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                            {errors.categoria && <p className="text-xs text-red-600 mt-1">{errors.categoria}</p>}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Valor da diária (R$)</label>
                            <input type="number" step="0.01" min="0" value={data.valor_diaria} onChange={e => setData('valor_diaria', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                            {errors.valor_diaria && <p className="text-xs text-red-600 mt-1">{errors.valor_diaria}</p>}
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Descrição</label>
                            <textarea value={data.descricao} onChange={e => setData('descricao', e.target.value)} rows={3}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Fotos (até 6)</label>
                            <input type="file" multiple accept="image/*" onChange={e => setData('fotos', Array.from(e.target.files))}
                                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-orange-50 file:text-[#FF5A00] file:font-bold" />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-5 space-y-4">
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                            <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Crown className="w-4 h-4 text-[#FF5A00]" /> Somente para clientes Premium</span>
                            <input type="checkbox" checked={data.somente_premium} onChange={e => setData('somente_premium', e.target.checked)} className="w-5 h-5 accent-[#FF5A00]" />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                            <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Tag className="w-4 h-4 text-red-600" /> Tem promoção / desconto</span>
                            <input type="checkbox" checked={data.tem_promocao} onChange={e => setData('tem_promocao', e.target.checked)} className="w-5 h-5 accent-[#FF5A00]" />
                        </label>

                        {data.tem_promocao && (
                            <div className="grid grid-cols-2 gap-4 pl-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Tipo</label>
                                    <select value={data.tipo_desconto} onChange={e => setData('tipo_desconto', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                                        <option value="percentual">% Percentual</option>
                                        <option value="fixo">R$ Fixo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Valor do desconto</label>
                                    <input type="number" step="0.01" min="0" value={data.valor_desconto} onChange={e => setData('valor_desconto', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                                </div>
                            </div>
                        )}

                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                            <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><Coins className="w-4 h-4 text-blue-600" /> Aceita pontos como desconto</span>
                            <input type="checkbox" checked={data.aceita_pontos} onChange={e => setData('aceita_pontos', e.target.checked)} className="w-5 h-5 accent-[#FF5A00]" />
                        </label>

                        {data.aceita_pontos && (
                            <div className="pl-3">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Máximo de pontos permitidos</label>
                                <input type="number" min="0" value={data.maximo_pontos_permitidos} onChange={e => setData('maximo_pontos_permitidos', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm sm:w-48" />
                            </div>
                        )}

                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                            <span className="text-sm font-bold text-gray-700">Ativo (visível para clientes)</span>
                            <input type="checkbox" checked={data.ativo} onChange={e => setData('ativo', e.target.checked)} className="w-5 h-5 accent-[#FF5A00]" />
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onFechar} className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">Cancelar</button>
                        <button type="submit" disabled={processing} className="flex-1 py-3 rounded-xl bg-[#FF5A00] hover:bg-orange-600 text-white font-bold shadow-lg transition disabled:opacity-60">
                            {processing ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar locação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function LocacoesAvulsas({ auth, itens = [], emUsoAgora = [], categorias = {} }) {
    const [modalAberto, setModalAberto] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);

    const abrirCriacao = () => { setItemEditando(null); setModalAberto(true); };
    const abrirEdicao = (item) => { setItemEditando(item); setModalAberto(true); };
    const fecharModal = () => { setModalAberto(false); setItemEditando(null); };

    const excluir = (item) => {
        if (!confirm(`Excluir "${item.nome}"? Essa ação não pode ser desfeita.`)) return;
        router.delete(route('locacoes.avulsas.destroy', item.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-2xl text-gray-800 leading-tight">Locações Avulsas</h2>}
        >
            <Head title="Locações Avulsas" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Suas locações, sem estabelecimento</h1>
                        <p className="text-gray-500 mt-1 max-w-2xl text-sm">
                            Cadastre imóveis, veículos e equipamentos e alugue direto para os clientes, com promoções, desconto por pontos e itens exclusivos Premium.
                        </p>
                    </div>
                    <button onClick={abrirCriacao} className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg transition">
                        <Plus className="w-5 h-5" /> Nova Locação
                    </button>
                </div>

                {emUsoAgora.length > 0 && (
                    <div className="mb-10 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                        <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[#FF5A00]" /> Em uso agora
                        </h2>
                        <div className="space-y-3">
                            {emUsoAgora.map(u => (
                                <div key={u.id} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{u.item_nome}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><UserIcon className="w-3.5 h-3.5" /> {u.locatario}</p>
                                    </div>
                                    <div className="text-right text-xs text-gray-500">
                                        <span className="block">até</span>
                                        <span className="font-bold text-gray-700">{u.data_fim ? new Date(u.data_fim).toLocaleDateString('pt-BR') : '—'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {itens.length === 0 ? (
                    <div className="text-center py-24 text-gray-400 bg-white rounded-3xl border border-gray-100">
                        <Home className="w-10 h-10 mx-auto mb-3" />
                        <p className="font-bold">Você ainda não cadastrou nenhuma locação avulsa.</p>
                        <p className="text-sm">Clique em "Nova Locação" para começar a alugar direto pros clientes.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-16">
                        {itens.map(item => (
                            <CardLocacao key={item.id} item={item} onEditar={abrirEdicao} onExcluir={excluir} />
                        ))}
                    </div>
                )}
            </div>

            <ModalFormulario aberto={modalAberto} onFechar={fecharModal} itemEditando={itemEditando} categorias={categorias} />
        </AuthenticatedLayout>
    );
}
