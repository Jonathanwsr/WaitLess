import { useState, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import {
    Plus, Home, Car, Package, Crown, Tag, Coins, Pencil, Trash2, X,
    ImageOff, Clock, User as UserIcon, Building2, Users, Wifi, Wind,
    Sofa, Dog, Waves, Flame as FlameIcon, CalendarDays,
} from 'lucide-react';

const formatarMoeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// Checklist fixo de comodidades: cada uma vira um item de texto em `recursos_oferecidos`
// (a mesma lista que a tela do cliente já exibe) quando marcada.
const COMODIDADES_FIXAS = [
    ['possui_wifi', 'Wi-Fi', Wifi],
    ['possui_ar_condicionado', 'Ar-condicionado', Wind],
    ['mobiliado', 'Mobiliado', Sofa],
    ['aceita_pet', 'Aceita pets', Dog],
    ['piscina', 'Piscina', Waves],
    ['churrasqueira', 'Churrasqueira', FlameIcon],
];
const ROTULOS_COMODIDADES_FIXAS = Object.fromEntries(COMODIDADES_FIXAS.map(([, rotulo]) => [rotulo, true]));

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

function grupoDaCategoria(categoria, categorias) {
    for (const [grupo, opcoes] of Object.entries(categorias)) {
        if (opcoes.includes(categoria)) return grupo;
    }
    return null;
}

function ModalFormulario({ aberto, onFechar, itemEditando, categorias }) {
    const editando = !!itemEditando;

    // recursos_oferecidos guarda tanto as comodidades do checklist fixo (como texto) quanto
    // as que o dono digitou — separamos as duas coisas de volta pra reabrir o formulário.
    const recursosAtuais = Array.isArray(itemEditando?.recursos_oferecidos) ? itemEditando.recursos_oferecidos : [];
    const comodidadesExtraIniciais = recursosAtuais.filter((r) => !ROTULOS_COMODIDADES_FIXAS[r]);

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
        local_retirada: itemEditando?.local_retirada || '',
        local_entrega: itemEditando?.local_entrega || '',
        horario_retirada: itemEditando?.horario_retirada || '',
        horario_entrega: itemEditando?.horario_entrega || '',
        informacoes_extras: itemEditando?.informacoes_extras || '',
        fotos: [],
        fotos_mantidas: Array.isArray(itemEditando?.fotos) ? itemEditando.fotos : [],

        // Pessoas e preço (App\Services\PrecificacaoService)
        capacidade_pessoas: itemEditando?.capacidade_pessoas || 2,
        modelo_precificacao: itemEditando?.modelo_precificacao || 'pacote',
        pessoas_incluidas: itemEditando?.pessoas_incluidas || 2,
        valor_pessoa_extra: itemEditando?.valor_pessoa_extra || '',

        // Comodidades
        possui_wifi: !!itemEditando?.possui_wifi,
        possui_ar_condicionado: !!itemEditando?.possui_ar_condicionado,
        mobiliado: !!itemEditando?.mobiliado,
        aceita_pet: !!itemEditando?.aceita_pet,
        piscina: !!itemEditando?.piscina,
        churrasqueira: !!itemEditando?.churrasqueira,
        comodidades_extra: comodidadesExtraIniciais,

        // Disponibilidade
        sempre_disponivel: itemEditando?.sempre_disponivel ?? true,
        data_inicio_disponibilidade: itemEditando?.data_inicio_disponibilidade?.slice(0, 10) || '',
        data_fim_disponibilidade: itemEditando?.data_fim_disponibilidade?.slice(0, 10) || '',
        dias_semana_disponiveis: Array.isArray(itemEditando?.dias_semana_disponiveis) ? itemEditando.dias_semana_disponiveis.map(Number) : [],
    });

    const [novaComodidade, setNovaComodidade] = useState('');
    const adicionarComodidadeExtra = () => {
        const texto = novaComodidade.trim();
        if (!texto || data.comodidades_extra.includes(texto)) return;
        setData('comodidades_extra', [...data.comodidades_extra, texto]);
        setNovaComodidade('');
    };
    const removerComodidadeExtra = (texto) => setData('comodidades_extra', data.comodidades_extra.filter((c) => c !== texto));
    const alternarDiaSemana = (dia) => setData('dias_semana_disponiveis',
        data.dias_semana_disponiveis.includes(dia) ? data.dias_semana_disponiveis.filter((d) => d !== dia) : [...data.dias_semana_disponiveis, dia]);

    const grupo = grupoDaCategoria(data.categoria, categorias);
    // Local de retirada/entrega só faz sentido para bens móveis (veículos, equipamentos…).
    const permiteEntrega = ['Veículos', 'Equipamentos', 'Outros'].includes(grupo);
    const maxFotos = grupo === 'Imóveis' ? 10 : 5;
    const totalFotos = data.fotos_mantidas.length + data.fotos.length;

    const removerFotoExistente = (url) => {
        setData('fotos_mantidas', data.fotos_mantidas.filter(f => f !== url));
    };

    const removerFotoNova = (idx) => {
        setData('fotos', data.fotos.filter((_, i) => i !== idx));
    };

    const adicionarFotos = (arquivos) => {
        const espacoLivre = maxFotos - data.fotos_mantidas.length - data.fotos.length;
        if (espacoLivre <= 0) return;
        setData('fotos', [...data.fotos, ...arquivos.slice(0, espacoLivre)]);
    };

    // Gera as prévias das fotos novas uma única vez por arquivo (não a cada
    // render) e libera a URL temporária quando o arquivo é removido ou o
    // modal fecha, pra não vazar memória do navegador.
    const previewsFotosNovas = useMemo(
        () => data.fotos.map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) })),
        [data.fotos]
    );

    useEffect(() => {
        return () => {
            previewsFotosNovas.forEach((p) => URL.revokeObjectURL(p.url));
        };
    }, [previewsFotosNovas]);

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

    // O retorno antecipado fica DEPOIS de todos os hooks (useMemo/useEffect acima); antes, abrir o
    // modal mudava a quantidade de hooks e o React derrubava a tela inteira.
    if (!aberto) return null;

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

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Unidades disponíveis</label>
                            <input type="number" min="1" value={data.quantidade} onChange={e => setData('quantidade', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                            {errors.quantidade && <p className="text-xs text-red-600 mt-1">{errors.quantidade}</p>}
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Descrição</label>
                            <textarea value={data.descricao} onChange={e => setData('descricao', e.target.value)} rows={3}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Informações extras</label>
                            <textarea value={data.informacoes_extras} onChange={e => setData('informacoes_extras', e.target.value)} rows={2}
                                placeholder="Regras da casa, o que está incluso, observações gerais..."
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>

                        {permiteEntrega && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Local de retirada</label>
                            <input type="text" value={data.local_retirada} onChange={e => setData('local_retirada', e.target.value)}
                                placeholder="Endereço ou ponto de retirada"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>
                        )}
        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">{permiteEntrega ? 'Horário de retirada' : 'Horário de chegada'}</label>
                            <input type="time" value={data.horario_retirada} onChange={e => setData('horario_retirada', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>

                        {permiteEntrega && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Local de entrega</label>
                            <input type="text" value={data.local_entrega} onChange={e => setData('local_entrega', e.target.value)}
                                placeholder="Endereço ou ponto de devolução"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">{permiteEntrega ? 'Horário de devolução' : 'Horário de saída'}</label>
                            <input type="time" value={data.horario_entrega} onChange={e => setData('horario_entrega', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                                Fotos ({totalFotos}/{maxFotos}{grupo ? ` — ${grupo}` : ''})
                            </label>

                            {data.fotos_mantidas.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {data.fotos_mantidas.map((url) => (
                                        <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                                            <img src={url} alt="Foto" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removerFotoExistente(url)}
                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                <X className="w-5 h-5 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {previewsFotosNovas.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {previewsFotosNovas.map(({ url }, idx) => (
                                        <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                                            <img src={url} alt="Nova foto" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removerFotoNova(idx)}
                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                <X className="w-5 h-5 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {totalFotos < maxFotos && (
                                <input type="file" multiple accept="image/*" onChange={e => adicionarFotos(Array.from(e.target.files))}
                                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-orange-50 file:text-[#FF5A00] file:font-bold" />
                            )}
                            {errors.fotos && <p className="text-xs text-red-600 mt-1">{errors.fotos}</p>}
                        </div>
                    </div>

                    {/* PESSOAS E PREÇO */}
                    <div className="border-t border-gray-100 pt-5 space-y-4">
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-[#FF5A00]" /> Pessoas e preço</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Capacidade máxima (pessoas)</label>
                                <input type="number" min="1" value={data.capacidade_pessoas} onChange={e => setData('capacidade_pessoas', e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                {errors.capacidade_pessoas && <p className="text-xs text-red-600 mt-1">{errors.capacidade_pessoas}</p>}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Como cobrar por pessoa</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setData('modelo_precificacao', 'pacote')}
                                        className={`py-2.5 rounded-xl text-xs font-bold border transition ${data.modelo_precificacao === 'pacote' ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>
                                        Valor fixo até um limite
                                    </button>
                                    <button type="button" onClick={() => setData('modelo_precificacao', 'por_pessoa')}
                                        className={`py-2.5 rounded-xl text-xs font-bold border transition ${data.modelo_precificacao === 'por_pessoa' ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>
                                        Valor por pessoa
                                    </button>
                                </div>
                            </div>

                            {data.modelo_precificacao === 'pacote' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Pessoas incluídas no valor da diária</label>
                                        <input type="number" min="1" value={data.pessoas_incluidas} onChange={e => setData('pessoas_incluidas', e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                        <p className="text-[11px] text-gray-400 mt-1">Ex.: diária de R$ 300 já cobre até {data.pessoas_incluidas || 0} pessoas.</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Valor por pessoa extra / dia (R$)</label>
                                        <input type="number" step="0.01" min="0" value={data.valor_pessoa_extra} onChange={e => setData('valor_pessoa_extra', e.target.value)}
                                            placeholder="0,00"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                    </div>
                                </>
                            ) : (
                                <div className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                                    O valor da diária informado acima será cobrado <b>por pessoa</b>. Ex.: diária de R$ {formatarMoeda(data.valor_diaria || 0)} para 3 pessoas = R$ {formatarMoeda((Number(data.valor_diaria) || 0) * 3)}/dia.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COMODIDADES */}
                    <div className="border-t border-gray-100 pt-5 space-y-4">
                        <h4 className="text-sm font-black text-gray-900">Comodidades</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {COMODIDADES_FIXAS.map(([campo, rotulo, Icone]) => (
                                <label key={campo} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-sm font-semibold transition ${data[campo] ? 'bg-orange-50 border-[#FF5A00] text-[#C74B27]' : 'bg-gray-50 border-transparent text-gray-600'}`}>
                                    <input type="checkbox" checked={data[campo]} onChange={e => setData(campo, e.target.checked)} className="w-4 h-4 accent-[#FF5A00]" />
                                    <Icone className="w-4 h-4 shrink-0" /> {rotulo}
                                </label>
                            ))}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Outras comodidades</label>
                            <div className="flex gap-2">
                                <input type="text" value={novaComodidade} onChange={e => setNovaComodidade(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarComodidadeExtra(); } }}
                                    placeholder="Ex.: Vista para o mar" maxLength={60}
                                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                <button type="button" onClick={adicionarComodidadeExtra} className="px-4 rounded-xl bg-gray-900 text-white text-sm font-bold">Adicionar</button>
                            </div>
                            {data.comodidades_extra.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {data.comodidades_extra.map((c) => (
                                        <span key={c} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full">
                                            {c}
                                            <button type="button" onClick={() => removerComodidadeExtra(c)}><X className="w-3.5 h-3.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DISPONIBILIDADE */}
                    <div className="border-t border-gray-100 pt-5 space-y-4">
                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#FF5A00]" /> Disponibilidade</h4>
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                            <span className="text-sm font-bold text-gray-700">Sempre disponível para reserva</span>
                            <input type="checkbox" checked={data.sempre_disponivel} onChange={e => setData('sempre_disponivel', e.target.checked)} className="w-5 h-5 accent-[#FF5A00]" />
                        </label>

                        {!data.sempre_disponivel && (
                            <div className="pl-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Disponível a partir de</label>
                                        <input type="date" value={data.data_inicio_disponibilidade} onChange={e => setData('data_inicio_disponibilidade', e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Disponível até</label>
                                        <input type="date" value={data.data_fim_disponibilidade} onChange={e => setData('data_fim_disponibilidade', e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Dias de chegada permitidos</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DIAS_SEMANA.map((rotulo, dia) => (
                                            <button key={dia} type="button" onClick={() => alternarDiaSemana(dia)}
                                                className={`w-12 py-2 rounded-lg text-xs font-bold border transition ${data.dias_semana_disponiveis.includes(dia) ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-600 border-gray-200'}`}>
                                                {rotulo}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1">Nenhum dia marcado = qualquer dia da semana serve.</p>
                                </div>
                            </div>
                        )}
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
                        <button type="submit" disabled={processing} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg transition disabled:opacity-60">
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
