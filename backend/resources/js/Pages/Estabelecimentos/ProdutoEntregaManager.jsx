import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { Fragment, useState } from 'react';
import EnviarPosicao from '@/Components/Entregas/EnviarPosicao';
import CodigoSeisDigitos from '@/Components/Entregas/CodigoSeisDigitos';
import axios from 'axios';

function ComoFunciona() {
    const passos = [
        ['Vinculado a um local', 'O produto aparece na Loja e na vitrine daquele local. Sem local, ele é avulso e aparece só no catálogo Produtos. Você troca isso quando quiser, na própria tabela.'],
        ['Pagamento', 'Online (Asaas): o valor fica protegido até a entrega. No local ou direto com você: nada passa pela plataforma. O online só aparece se a sua conta de recebimento estiver cadastrada.'],
        ['Entrega ou retirada', 'Você escolhe se entrega em casa (com taxa, se quiser) e/ou aceita retirada no seu endereço de origem.'],
        ['Confirmação', 'O cliente mostra um código de 6 dígitos. Você o digita em "Pedidos recebidos" para confirmar a entrega e liberar o pagamento.'],
        ['Produtos vendidos', 'Cada entrega concluída soma no seu contador de produtos vendidos e no do local.'],
    ];

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <h3 className="font-black text-gray-900 flex items-center gap-2"><TruckIcon className="w-5 h-5 text-[#FF5A00]" /> Como funcionam os produtos para entrega</h3>
            <p className="text-sm text-gray-500 mt-1">Você cadastra o produto uma vez e ele passa a ser vendido no app com entrega ou retirada.</p>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {passos.map(([titulo, texto], i) => (
                    <li key={titulo} className="flex gap-3 bg-gray-50 rounded-2xl p-4">
                        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div>
                            <p className="font-bold text-sm text-gray-900">{titulo}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{texto}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}
import {
    TruckIcon, PlusIcon, TrashIcon, PencilIcon, XMarkIcon,
    CheckCircleIcon, PauseCircleIcon, PhotoIcon, UserGroupIcon,
} from '@heroicons/react/24/solid';

const CATEGORIAS = ['Gás e água', 'Alimentos', 'Bebidas', 'Mercado', 'Farmácia', 'Pet', 'Bazar', 'Outros'];
const UNIDADES = ['un', 'kg', 'g', 'L', 'mL', 'pacote', 'caixa', 'botijão'];

const STATUS_ESTILO = {
    pendente_pagamento: 'bg-amber-50 text-amber-700 border-amber-200',
    pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    aguardando_confirmacao: 'bg-blue-50 text-blue-700 border-blue-200',
    concluido: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelado: 'bg-red-50 text-red-700 border-red-200',
    estornado: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABEL = {
    pendente_pagamento: 'Aguardando pagamento',
    pago: 'Pago online · entregar e confirmar',
    aguardando_confirmacao: 'Pagamento no local · confirmar entrega',
    concluido: 'Entregue',
    cancelado: 'Cancelado',
    estornado: 'Estornado',
};

function ConfirmarEntrega({ pedido }) {
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    const online = pedido.modo_pagamento === 'online';

    const confirmar = async (e) => {
        e.preventDefault();
        setErro(null);
        setEnviando(true);
        try {
            await axios.post(route('entregas.pedidos.liberar', pedido.id), online ? { codigo } : {});
            router.reload({ only: ['pedidosRecebidos'] });
        } catch (err) {
            setErro(err.response?.data?.error || 'Não foi possível confirmar a entrega.');
        } finally {
            setEnviando(false);
        }
    };

    if (!online) {
        return (
            <form onSubmit={confirmar} className="mt-2 flex items-center gap-2">
                <button type="submit" disabled={enviando} className="text-xs font-bold px-3 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-40">
                    {enviando ? 'Finalizando...' : 'Finalizado'}
                </button>
                {erro && <span className="text-[11px] text-red-600">{erro}</span>}
            </form>
        );
    }

    return (
        <form onSubmit={confirmar} className="mt-2 space-y-2">
            <CodigoSeisDigitos valor={codigo} onChange={setCodigo} desabilitado={enviando} />
            <button type="submit" disabled={enviando || codigo.length !== 6} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">
                Confirmar entrega
            </button>
            {erro && <span className="block text-[11px] text-red-600">{erro}</span>}
        </form>
    );
}

function Campo({ label, children, hint }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
        </div>
    );
}

const inputClass = "block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#FF5A00] focus:border-[#FF5A00] transition-colors";
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

/**
 * Sozinha, a tela usa o layout completo. Embutida na tela única "Produtos", mostra só o cabeçalho
 * (com seus botões) numa faixa, sem repetir menu e título da página.
 */
function Moldura({ embutido, header, children, ...resto }) {
    if (!embutido) {
        return <AuthenticatedLayout header={header} {...resto}>{children}</AuthenticatedLayout>;
    }
    return (
        <div>
            {header && <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4">{header}</div>}
            {children}
        </div>
    );
}

export default function ProdutoEntregaManager({ produtos, estabelecimentos, funcionarios, pedidosRecebidos, embutido = false }) {
    const { flash = {} } = usePage().props;
    const [aba, setAba] = useState('produtos');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState(null);
    const [fotosExistentes, setFotosExistentes] = useState([]);
    const [novasFotos, setNovasFotos] = useState([]);

    const { data, setData, post, processing, errors, reset } = useForm({
        nome: '', descricao: '', categoria: '', marca: '', unidade_medida: 'un', peso_volume: '', sku: '', tags: '',
        quantidade_minima: '1', aceita_entrega: true, aceita_retirada: true,
        valor: '', tem_promocao: false, valor_promocional: '',
        taxa_entrega: '0', estoque_disponivel: '1', ativo: true, estabelecimento_id: '',
        endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '',
        endereco_bairro: '', endereco_cidade: '', endereco_estado: '',
        fotos: [], fotos_mantidas: [],
    });

    const abrirNovo = () => {
        setEditando(null);
        reset();
        setFotosExistentes([]);
        setNovasFotos([]);
        setFormAberto(true);
    };

    const abrirEdicao = (produto) => {
        setEditando(produto);
        setData({
            nome: produto.nome || '', descricao: produto.descricao || '', valor: produto.valor || '',
            categoria: produto.categoria || '', marca: produto.marca || '', unidade_medida: produto.unidade_medida || 'un',
            peso_volume: produto.peso_volume || '', sku: produto.sku || '', tags: (produto.tags || []).join(', '),
            quantidade_minima: produto.quantidade_minima || '1',
            aceita_entrega: produto.aceita_entrega !== false, aceita_retirada: produto.aceita_retirada !== false,
            tem_promocao: !!produto.tem_promocao, valor_promocional: produto.valor_promocional || '',
            taxa_entrega: produto.taxa_entrega || '0', estoque_disponivel: produto.estoque_disponivel ?? '1',
            ativo: !!produto.ativo, estabelecimento_id: produto.estabelecimento_id || '',
            endereco_cep: produto.endereco_cep || '', endereco_rua: produto.endereco_rua || '',
            endereco_numero: produto.endereco_numero || '', endereco_complemento: produto.endereco_complemento || '',
            endereco_bairro: produto.endereco_bairro || '', endereco_cidade: produto.endereco_cidade || '',
            endereco_estado: produto.endereco_estado || '', fotos: [], fotos_mantidas: produto.fotos || [],
        });
        setFotosExistentes(produto.fotos || []);
        setNovasFotos([]);
        setFormAberto(true);
    };

    const buscarCep = async (valor) => {
        const cep = valor.replace(/\D/g, '');
        setData('endereco_cep', cep);
        if (cep.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const json = await res.json();
                if (!json.erro) {
                    setData((prev) => ({
                        ...prev, endereco_cep: cep,
                        endereco_rua: json.logradouro || prev.endereco_rua,
                        endereco_bairro: json.bairro || prev.endereco_bairro,
                        endereco_cidade: json.localidade || prev.endereco_cidade,
                        endereco_estado: json.uf || prev.endereco_estado,
                    }));
                }
            } catch (e) { /* CEP opcional, segue sem preencher */ }
        }
    };

    const removerFotoExistente = (url) => {
        const restantes = fotosExistentes.filter((f) => f !== url);
        setFotosExistentes(restantes);
        setData('fotos_mantidas', restantes);
    };

    const adicionarFotos = (arquivos) => {
        const lista = Array.from(arquivos || []);
        const total = fotosExistentes.length + novasFotos.length + lista.length;
        if (total > 3) {
            alert('Você pode ter no máximo 3 fotos por produto.');
            return;
        }
        const atualizadas = [...novasFotos, ...lista];
        setNovasFotos(atualizadas);
        setData('fotos', atualizadas);
    };

    const removerFotoNova = (index) => {
        const atualizadas = novasFotos.filter((_, i) => i !== index);
        setNovasFotos(atualizadas);
        setData('fotos', atualizadas);
    };

    const submeter = (e) => {
        e.preventDefault();
        const url = editando ? route('produtos-entrega.update', editando.id) : route('produtos-entrega.store');
        post(url, {
            forceFormData: true,
            preserveScroll: true,
            transform: (dados) => ({
                ...dados,
                aceita_entrega: dados.aceita_entrega ? '1' : '0',
                aceita_retirada: dados.aceita_retirada ? '1' : '0',
            }),
            onSuccess: () => { setFormAberto(false); reset(); setFotosExistentes([]); setNovasFotos([]); },
        });
    };

    const produtosOrdenados = [...produtos].sort((a, b) => Number(!!b.estabelecimento_id) - Number(!!a.estabelecimento_id));

    const vincularLocal = (produto, estabelecimentoId) => {
        router.patch(route('produtos-entrega.vincular-local', produto.id), { estabelecimento_id: estabelecimentoId || null }, { preserveScroll: true });
    };

    const toggleAtivo = (produto) => {
        router.patch(route('produtos-entrega.toggle-ativo', produto.id), {}, { preserveScroll: true });
    };

    const excluir = (produto) => {
        if (!window.confirm(`Excluir o produto "${produto.nome}"? Essa ação não pode ser desfeita.`)) return;
        router.delete(route('produtos-entrega.destroy', produto.id), { preserveScroll: true });
    };

    const atribuirFuncionario = (pedido, funcionarioId) => {
        router.post(route('entregas.pedidos.funcionario', pedido.id), { funcionario_id: funcionarioId || null }, { preserveScroll: true });
    };

    const funcionariosDoLocal = (estabelecimentoId) => funcionarios.filter((f) => f.estabelecimento_id === estabelecimentoId);

    return (
        <Moldura
            embutido={embutido}
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-2">
                        <TruckIcon className="w-7 h-7 text-[#FF5A00]" />
                        {embutido ? 'Produtos para entrega ou retirada' : 'Entregas'}
                    </h2>
                    {aba === 'produtos' && (
                        <button
                            onClick={abrirNovo}
                            className="flex items-center gap-2 bg-[#FF5A00] hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
                        >
                            <PlusIcon className="w-4 h-4" /> Novo produto
                        </button>
                    )}
                </div>
            }
        >
            {!embutido && <Head title="Produtos para entrega" />}

            <div className="py-8">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
                    {flash?.success && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl text-sm font-semibold">{flash.success}</div>
                    )}
                    {flash?.error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-3 rounded-2xl text-sm font-semibold">{flash.error}</div>
                    )}

                    <div className="flex gap-2 bg-white rounded-2xl border border-gray-100 p-1.5 w-fit">
                        <button onClick={() => setAba('produtos')} className={`px-5 py-2 rounded-xl text-sm font-bold transition ${aba === 'produtos' ? 'bg-[#FF5A00] text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                            Meus produtos
                        </button>
                        <button onClick={() => setAba('pedidos')} className={`px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5 ${aba === 'pedidos' ? 'bg-[#FF5A00] text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                            Pedidos recebidos
                            {pedidosRecebidos.length > 0 && <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded-full">{pedidosRecebidos.length}</span>}
                        </button>
                    </div>

                    {aba === 'produtos' && formAberto && (
                        <form onSubmit={submeter} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">{editando ? 'Editar produto' : 'Novo produto para entrega'}</h3>
                                <button type="button" onClick={() => setFormAberto(false)} className="text-gray-400 hover:text-gray-600">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <Campo label="Nome do produto">
                                        <input className={inputClass} value={data.nome} onChange={(e) => setData('nome', e.target.value)} maxLength={255} placeholder="Ex: Botijão de Gás P13" required />
                                    </Campo>
                                    {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
                                </div>

                                <div className="sm:col-span-2">
                                    <Campo label="Descrição (opcional)">
                                        <textarea className={inputClass} rows={2} maxLength={2000} value={data.descricao} onChange={(e) => setData('descricao', e.target.value)} />
                                    </Campo>
                                </div>

                                <Campo label="Valor normal (R$)">
                                    <input type="number" step="0.01" min="0" className={inputClass} value={data.valor} onChange={(e) => setData('valor', e.target.value)} required />
                                </Campo>
                                <Campo label="Taxa de entrega (R$)" hint="Cobrada só quando o cliente escolhe receber em casa.">
                                    <input type="number" step="0.01" min="0" className={inputClass} value={data.taxa_entrega} onChange={(e) => setData('taxa_entrega', e.target.value)} />
                                </Campo>

                                <label className="flex items-center gap-2 sm:col-span-2">
                                    <input type="checkbox" checked={data.tem_promocao} onChange={(e) => setData('tem_promocao', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00]" />
                                    <span className="text-sm text-gray-700 font-semibold">Em promoção</span>
                                </label>

                                {data.tem_promocao && (
                                    <Campo label="Valor promocional (R$)">
                                        <input type="number" step="0.01" min="0" className={inputClass} value={data.valor_promocional} onChange={(e) => setData('valor_promocional', e.target.value)} />
                                    </Campo>
                                )}
                                {errors.valor_promocional && <p className="text-xs text-red-600 mt-1">{errors.valor_promocional}</p>}

                                <Campo label="Estoque disponível">
                                    <input type="number" min="0" className={inputClass} value={data.estoque_disponivel} onChange={(e) => setData('estoque_disponivel', e.target.value)} />
                                </Campo>

                                <Campo label="Categoria" hint="Usada para filtrar o produto no catálogo e nas lojas.">
                                    <select className={inputClass} value={data.categoria} onChange={(e) => setData('categoria', e.target.value)} required>
                                        <option value="">Escolha uma categoria</option>
                                        {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {errors.categoria && <p className="text-xs text-red-600 mt-1">{errors.categoria}</p>}
                                </Campo>

                                <Campo label="Marca">
                                    <input className={inputClass} value={data.marca} onChange={(e) => setData('marca', e.target.value)} maxLength={80} placeholder="Ex: Ultragaz" />
                                </Campo>

                                <Campo label="Unidade de medida">
                                    <select className={inputClass} value={data.unidade_medida} onChange={(e) => setData('unidade_medida', e.target.value)}>
                                        {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </Campo>

                                <Campo label="Peso ou volume">
                                    <input className={inputClass} value={data.peso_volume} onChange={(e) => setData('peso_volume', e.target.value)} maxLength={40} placeholder="Ex: 13 kg ou 20 L" />
                                </Campo>

                                <Campo label="Código interno (SKU)">
                                    <input className={inputClass} value={data.sku} onChange={(e) => setData('sku', e.target.value)} maxLength={60} />
                                </Campo>

                                <Campo label="Quantidade mínima por pedido">
                                    <input type="number" min="1" max="50" className={inputClass} value={data.quantidade_minima} onChange={(e) => setData('quantidade_minima', e.target.value)} />
                                </Campo>

                                <Campo label="Tags" hint="Separe por vírgula. Ex: gás, cilindro, entrega rápida">
                                    <input className={inputClass} value={data.tags} onChange={(e) => setData('tags', e.target.value)} maxLength={300} />
                                </Campo>

                                <div className="sm:col-span-2 flex flex-wrap gap-6">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <input type="checkbox" checked={data.aceita_entrega} onChange={(e) => setData('aceita_entrega', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00]" />
                                        Aceito entregar em casa
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <input type="checkbox" checked={data.aceita_retirada} onChange={(e) => setData('aceita_retirada', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00]" />
                                        Aceito retirada no local
                                    </label>
                                </div>

                                <Campo label="Vincular a um local já cadastrado (opcional)" hint="Deixe em branco para um produto avulso, sem local formal.">
                                    <select className={inputClass} value={data.estabelecimento_id} onChange={(e) => setData('estabelecimento_id', e.target.value)}>
                                        <option value="">Avulso (sem local)</option>
                                        {estabelecimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                    </select>
                                </Campo>

                                <label className="flex items-center gap-2 sm:col-span-2">
                                    <input type="checkbox" checked={data.ativo} onChange={(e) => setData('ativo', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00]" />
                                    <span className="text-sm text-gray-700 font-semibold">Ativo (visível para clientes)</span>
                                </label>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Endereço de origem</h4>
                                <p className="text-xs text-gray-400 mb-3">É de onde o produto parte — local de retirada quando o cliente busca, ou ponto de partida quando é entregue.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <Campo label="CEP">
                                        <input className={inputClass} value={data.endereco_cep} onChange={(e) => buscarCep(e.target.value)} maxLength={8} placeholder="Apenas números" required />
                                    </Campo>
                                    <div className="sm:col-span-2">
                                        <Campo label="Rua">
                                            <input className={inputClass} value={data.endereco_rua} onChange={(e) => setData('endereco_rua', e.target.value)} required />
                                        </Campo>
                                    </div>
                                    <Campo label="Número">
                                        <input className={inputClass} value={data.endereco_numero} onChange={(e) => setData('endereco_numero', e.target.value)} required />
                                    </Campo>
                                    <Campo label="Complemento">
                                        <input className={inputClass} value={data.endereco_complemento} onChange={(e) => setData('endereco_complemento', e.target.value)} />
                                    </Campo>
                                    <Campo label="Bairro">
                                        <input className={inputClass} value={data.endereco_bairro} onChange={(e) => setData('endereco_bairro', e.target.value)} required />
                                    </Campo>
                                    <Campo label="Cidade">
                                        <input className={inputClass} value={data.endereco_cidade} onChange={(e) => setData('endereco_cidade', e.target.value)} required />
                                    </Campo>
                                    <Campo label="UF">
                                        <input className={inputClass} value={data.endereco_estado} onChange={(e) => setData('endereco_estado', e.target.value.toUpperCase())} maxLength={2} required />
                                    </Campo>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Fotos (até 3)</h4>
                                <div className="flex flex-wrap gap-3">
                                    {fotosExistentes.map((url) => (
                                        <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                                            <img src={url} className="w-full h-full object-cover" alt="" />
                                            <button type="button" onClick={() => removerFotoExistente(url)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                                                <XMarkIcon className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                    {novasFotos.map((file, i) => (
                                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                                            <button type="button" onClick={() => removerFotoNova(i)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                                                <XMarkIcon className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                    {(fotosExistentes.length + novasFotos.length) < 3 && (
                                        <label className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#FF5A00] transition">
                                            <PhotoIcon className="w-7 h-7 text-gray-300" />
                                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => adicionarFotos(e.target.files)} />
                                        </label>
                                    )}
                                </div>
                                {errors.fotos && <p className="text-xs text-red-600 mt-2">{errors.fotos}</p>}
                            </div>

                            <button type="submit" disabled={processing} className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition disabled:opacity-50">
                                {processing ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
                            </button>
                        </form>
                    )}

                    {aba === 'produtos' && (
                        <div className="space-y-5">
                        <ComoFunciona />
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            {produtos.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <TruckIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-semibold">Nenhum produto para entrega cadastrado ainda.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="text-left px-5 py-3">Produto</th>
                                            <th className="text-left px-5 py-3">Local</th>
                                            <th className="text-left px-5 py-3">Preço</th>
                                            <th className="text-left px-5 py-3">Estoque</th>
                                            <th className="text-left px-5 py-3">Status</th>
                                            <th className="text-right px-5 py-3">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {produtosOrdenados.map((produto, indice) => (
                                            <Fragment key={produto.id}>
                                            {(indice === 0 || !!produtosOrdenados[indice - 1].estabelecimento_id !== !!produto.estabelecimento_id) && (
                                                <tr className="bg-gray-50/70">
                                                    <td colSpan={6} className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                                        {produto.estabelecimento_id ? 'Vinculados a um local' : 'Avulsos (sem local)'}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {produto.fotos?.[0] ? (
                                                            <img src={produto.fotos[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><PhotoIcon className="w-5 h-5 text-gray-300" /></div>
                                                        )}
                                                        <span className="font-semibold text-gray-900">{produto.nome}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <select
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50"
                                                        value={produto.estabelecimento_id || ''}
                                                        onChange={(e) => vincularLocal(produto, e.target.value)}
                                                        title="Vincular a um local ou deixar avulso"
                                                    >
                                                        <option value="">Avulso (sem local)</option>
                                                        {estabelecimentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">
                                                    {produto.tem_promocao && Number(produto.valor_promocional) < Number(produto.valor) ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="font-bold text-[#FF5A00]">{brl(produto.valor_promocional)}</span>
                                                            <span className="line-through text-gray-300 text-xs">{brl(produto.valor)}</span>
                                                        </span>
                                                    ) : brl(produto.valor)}
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">{produto.estoque_disponivel}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${produto.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                        {produto.ativo ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button onClick={() => toggleAtivo(produto)} title={produto.ativo ? 'Desativar' : 'Ativar'} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                            {produto.ativo ? <PauseCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                                                        </button>
                                                        <button onClick={() => abrirEdicao(produto)} title="Editar" className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => excluir(produto)} title="Excluir" className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        </div>
                    )}

                    {aba === 'pedidos' && (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            {pedidosRecebidos.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-semibold">Nenhum pedido recebido ainda.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="text-left px-5 py-3">Pedido</th>
                                            <th className="text-left px-5 py-3">Cliente</th>
                                            <th className="text-left px-5 py-3">Valor</th>
                                            <th className="text-left px-5 py-3">Status</th>
                                            <th className="text-left px-5 py-3">Funcionário</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {pedidosRecebidos.map((pedido) => (
                                            <tr key={pedido.id} className="hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <p className="font-semibold text-gray-900">{pedido.produto?.nome}</p>
                                                    <p className="text-xs text-gray-400">#{pedido.codigo_pedido} · {pedido.quantidade}x · {pedido.modo_recebimento === 'entrega' ? 'Entrega' : 'Retirada'}</p>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">
                                                    {pedido.cliente?.name}
                                                    {pedido.cliente?.mobile_phone && <span className="block text-xs text-gray-400">{pedido.cliente.mobile_phone}</span>}
                                                </td>
                                                <td className="px-5 py-3 font-semibold text-gray-900">{brl(pedido.valor_total)}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_ESTILO[pedido.status] || ''}`}>
                                                        {STATUS_LABEL[pedido.status] || pedido.status}
                                                    </span>
                                                    {['pago', 'aguardando_confirmacao'].includes(pedido.status) && <ConfirmarEntrega pedido={pedido} />}
                                                    {['pago', 'aguardando_confirmacao'].includes(pedido.status) && <div className="mt-2"><EnviarPosicao pedido={pedido} /></div>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {pedido.estabelecimento_id ? (
                                                        <select
                                                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50"
                                                            value={pedido.funcionario?.id || ''}
                                                            onChange={(e) => atribuirFuncionario(pedido, e.target.value)}
                                                        >
                                                            <option value="">Sem atribuição</option>
                                                            {funcionariosDoLocal(pedido.estabelecimento_id).map((f) => (
                                                                <option key={f.id} value={f.id}>{f.nome}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">Pedido avulso</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Moldura>
    );
}
