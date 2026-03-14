import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, Link, usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import { GiftIcon, StarIcon, TicketIcon, TrashIcon, PencilSquareIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';

export default function Cupons({ auth, estabelecimento, cupons = [] }) {
    const { flash = {} } = usePage().props;
    const [isEditing, setIsEditing] = useState(false);

    const { data, setData, post, put, reset, clearErrors, processing, errors } = useForm({
        id: null,
        codigo: '',
        titulo: '',
        descricao: '',
        tipo_desconto: 'percentual',
        valor_desconto: '',
        pontos_custo: 0, // Se 0, é grátis. Se > 0, vira recompensa de gamificação
        apenas_plus: false,
        data_validade: '',
        ativo: true,
    });

    // Função para gerar código aleatório para facilitar a vida do lojista
    const gerarCodigoAleatorio = () => {
        const codigo = 'WL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        setData('codigo', codigo);
    };

    const submit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(route('cupons.update', data.id), {
                preserveScroll: true,
                onSuccess: () => cancelarEdicao(),
            });
        } else {
            post(route('cupons.store', estabelecimento.id), {
                preserveScroll: true,
                onSuccess: () => reset(),
            });
        }
    };

    const editarCupom = (cupom) => {
        setIsEditing(true);
        clearErrors();
        setData({
            id: cupom.id,
            codigo: cupom.codigo,
            titulo: cupom.titulo,
            descricao: cupom.descricao || '',
            tipo_desconto: cupom.tipo_desconto,
            valor_desconto: cupom.valor_desconto,
            pontos_custo: cupom.pontos_custo,
            apenas_plus: cupom.apenas_plus,
            data_validade: cupom.data_validade ? cupom.data_validade.substring(0, 10) : '', // Formato DATE padrão (YYYY-MM-DD)
            ativo: cupom.ativo,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicao = () => {
        setIsEditing(false);
        reset();
        clearErrors();
    };

    const deletarCupom = (id) => {
        if (window.confirm('Tem certeza que deseja apagar esta recompensa/cupom permanentemente?')) {
            router.delete(route('cupons.destroy', id), { preserveScroll: true });
        }
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return 'Sem validade';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('estabelecimentos.configuracoes', estabelecimento.id)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm font-bold">
                            ←
                        </Link>
                        <div>
                            <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white flex items-center gap-2">
                                Marketing & Fidelização
                            </h2>
                            <p className="text-sm text-gray-500">{estabelecimento.nome}</p>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={`Marketing - ${estabelecimento.nome}`} />

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-20">
                
                {flash?.success && (
                    <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-800 font-bold rounded-xl shadow-sm animate-in fade-in flex items-center gap-2">
                        <CheckBadgeIcon className="w-6 h-6" /> {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ❌ {flash.error}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* ========================================================== */}
                    {/* LADO ESQUERDO: FORMULÁRIO DE CRIAÇÃO/EDIÇÃO                */}
                    {/* ========================================================== */}
                    <div className="w-full lg:w-1/3 shrink-0">
                        <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border dark:border-gray-700 sticky top-24 transition-colors duration-300 ${isEditing ? 'border-orange-300 shadow-orange-100 ring-4 ring-orange-50' : 'border-gray-200'}`}>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <GiftIcon className={`w-6 h-6 ${isEditing ? 'text-orange-500' : 'text-indigo-500'}`} />
                                {isEditing ? 'Editando Recompensa' : 'Criar Nova Recompensa'}
                            </h3>
                            
                            <form onSubmit={submit} className="space-y-5">
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <InputLabel value="Código do Cupom *" />
                                        <button type="button" onClick={gerarCodigoAleatorio} className="text-[10px] font-bold text-indigo-600 hover:underline">Gerar Aleatório</button>
                                    </div>
                                    <TextInput className="w-full uppercase font-mono tracking-wider font-bold text-center text-lg" value={data.codigo} onChange={e => setData('codigo', e.target.value.toUpperCase())} placeholder="Ex: VERAO20" required />
                                    <InputError message={errors.codigo} />
                                </div>

                                <div>
                                    <InputLabel value="Título da Promoção *" />
                                    <TextInput className="mt-1 w-full" value={data.titulo} onChange={e => setData('titulo', e.target.value)} placeholder="Ex: 20% OFF no primeiro corte" required />
                                    <InputError message={errors.titulo} />
                                </div>

                                <div>
                                    <InputLabel value="Descrição (Opcional)" />
                                    <textarea 
                                        className="mt-1 w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg shadow-sm text-sm" 
                                        rows="2" 
                                        value={data.descricao} 
                                        onChange={e => setData('descricao', e.target.value)} 
                                        placeholder="Ex: Válido para cortes de cabelo e barba..."
                                    />
                                    <InputError message={errors.descricao} />
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div>
                                        <InputLabel value="Tipo" />
                                        <select className="mt-1 w-full border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600 rounded-lg shadow-sm focus:border-indigo-500 text-sm font-bold" value={data.tipo_desconto} onChange={e => setData('tipo_desconto', e.target.value)}>
                                            <option value="percentual">Desconto (%)</option>
                                            <option value="fixo">Valor Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <InputLabel value="Valor *" />
                                        <div className="relative mt-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 font-bold">{data.tipo_desconto === 'percentual' ? '%' : 'R$'}</span>
                                            </div>
                                            <TextInput type="number" step="0.01" min="0.1" className="w-full pl-9" value={data.valor_desconto} onChange={e => setData('valor_desconto', e.target.value)} required />
                                        </div>
                                        <InputError message={errors.valor_desconto} />
                                    </div>
                                </div>

                                {/* 👉 ÁREA DE GAMIFICAÇÃO */}
                                <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl relative overflow-hidden">
                                    <StarIcon className="absolute -right-4 -bottom-4 w-20 h-20 text-orange-200 dark:text-orange-900/30 opacity-50 pointer-events-none" />
                                    <h4 className="text-sm font-bold text-orange-800 dark:text-orange-400 flex items-center gap-1 mb-3 relative z-10">
                                        <StarIcon className="w-5 h-5 text-orange-500" /> Preço em Pontos
                                    </h4>
                                    <div className="relative z-10">
                                        <TextInput type="number" className="w-full font-bold text-orange-700 bg-white border-orange-300 focus:border-orange-500 focus:ring-orange-500" value={data.pontos_custo} onChange={e => setData('pontos_custo', e.target.value)} min="0" required />
                                        <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-2 font-medium leading-tight">Se colocar "0", o cupom é público e gratuito. Se colocar mais que "0", ele vai para a Loja de Recompensas e o cliente precisa gastar os pontos acumulados para resgatar.</p>
                                    </div>
                                </div>

                                {/* 👉 TRAVA PLUS */}
                                <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 transition">
                                    <div className="flex items-center h-5">
                                        <input type="checkbox" className="w-5 h-5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500 dark:border-gray-600 dark:bg-gray-800 mt-0.5" checked={data.apenas_plus} onChange={e => setData('apenas_plus', e.target.checked)} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                            Exclusivo para Assinantes
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Se marcado, apenas clientes VIP (Plano Plus) poderão visualizar e resgatar este cupom.</p>
                                    </div>
                                    <CheckBadgeIcon className="w-6 h-6 text-yellow-500 shrink-0" />
                                </label>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <InputLabel value="Data de Validade" />
                                        <TextInput type="date" className="mt-1 w-full text-sm" value={data.data_validade} onChange={e => setData('data_validade', e.target.value)} />
                                    </div>
                                    <div>
                                        <InputLabel value="Status" />
                                        <select className="mt-1 w-full border-gray-300 dark:bg-gray-900 dark:text-white dark:border-gray-700 rounded-lg shadow-sm focus:border-indigo-500 text-sm font-bold" value={data.ativo} onChange={e => setData('ativo', e.target.value === 'true')}>
                                            <option value="true">Ativo</option>
                                            <option value="false">Inativo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    {isEditing && (
                                        <button type="button" onClick={cancelarEdicao} className="px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 transition w-full">
                                            Cancelar
                                        </button>
                                    )}
                                    <PrimaryButton className={`w-full justify-center py-3 rounded-xl text-sm font-bold shadow-md transition ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`} disabled={processing}>
                                        {processing ? 'A processar...' : (isEditing ? 'Salvar Alterações' : 'Criar Recompensa')}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ========================================================== */}
                    {/* LADO DIREITO: LISTA DE CUPONS E RECOMPENSAS                */}
                    {/* ========================================================== */}
                    <div className="flex-1">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <TicketIcon className="w-8 h-8 text-indigo-500" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Suas Recompensas Ativas ({cupons.length})
                                </h3>
                            </div>

                            {cupons.length === 0 ? (
                                <div className="text-center py-16 px-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <span className="text-5xl opacity-40 block mb-4">🎁</span>
                                    <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">Nenhum cupom criado</h4>
                                    <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">Crie recompensas ao lado para permitir que seus clientes troquem pontos por descontos na sua loja.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    {cupons.map(cupom => {
                                        const isGratis = Number(cupom.pontos_custo) === 0;
                                        
                                        return (
                                            <div key={cupom.id} className={`relative rounded-2xl border-2 transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                                                !cupom.ativo ? 'border-gray-200 bg-gray-100 opacity-60 grayscale' : 
                                                cupom.apenas_plus ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-900/20' : 
                                                !isGratis ? 'border-orange-200 bg-orange-50/30' : 
                                                'border-indigo-100 bg-white'
                                            }`}>
                                                
                                                {/* ETIQUETA SUPERIOR (PLUS OU GRÁTIS) */}
                                                <div className="flex justify-between items-start p-5 pb-0">
                                                    <div className="flex flex-col gap-2 items-start">
                                                        <div className="flex gap-2">
                                                            {cupom.apenas_plus && (
                                                                <span className="text-[9px] font-black bg-black text-yellow-400 px-2 py-1 rounded uppercase tracking-wider shadow-sm flex items-center gap-1">
                                                                    <CheckBadgeIcon className="w-3 h-3" /> VIP Plus
                                                                </span>
                                                            )}
                                                            {!cupom.ativo && (
                                                                <span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-1 rounded uppercase tracking-wider">Inativo</span>
                                                            )}
                                                            {isGratis && cupom.ativo && (
                                                                <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded uppercase tracking-wider">Cupom Público</span>
                                                            )}
                                                        </div>
                                                        <span className="font-mono text-sm font-black bg-gray-900 text-white px-3 py-1.5 rounded tracking-widest shadow-inner">
                                                            {cupom.codigo}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1 bg-white/80 backdrop-blur rounded-lg p-1 border border-gray-100 shadow-sm">
                                                        <button onClick={() => editarCupom(cupom)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"><PencilSquareIcon className="w-4 h-4"/></button>
                                                        <button onClick={() => deletarCupom(cupom.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition"><TrashIcon className="w-4 h-4"/></button>
                                                    </div>
                                                </div>

                                                <div className="p-5">
                                                    <h4 className="font-black text-xl text-gray-900 leading-tight mb-2">{cupom.titulo}</h4>
                                                    {cupom.descricao && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{cupom.descricao}</p>}
                                                    
                                                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200/60">
                                                        <div className="flex-1">
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Desconto</p>
                                                            <p className="font-black text-xl text-green-600">
                                                                {cupom.tipo_desconto === 'percentual' ? `${Number(cupom.valor_desconto)}%` : `R$ ${Number(cupom.valor_desconto).toFixed(2)}`}
                                                            </p>
                                                        </div>
                                                        <div className="w-px h-8 bg-gray-200 mx-2"></div>
                                                        <div className="flex-1 text-right">
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Custo (Cliente)</p>
                                                            {isGratis ? (
                                                                <p className="font-black text-lg text-indigo-600">Grátis</p>
                                                            ) : (
                                                                <p className="font-black text-lg text-orange-600 flex items-center justify-end gap-1">
                                                                    {cupom.pontos_custo} <StarIcon className="w-4 h-4" />
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-gray-100/50 py-2 px-5 border-t border-gray-100">
                                                    <p className="text-[10px] text-gray-400 font-medium text-center uppercase tracking-widest">
                                                        {cupom.data_validade ? `Expira em: ${formatarData(cupom.data_validade)}` : 'Validade Vitalícia'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}