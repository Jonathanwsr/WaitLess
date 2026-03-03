import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, Link, usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import { GiftIcon, StarIcon, TicketIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/solid';

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
        setData({
            id: cupom.id,
            codigo: cupom.codigo,
            titulo: cupom.titulo,
            descricao: cupom.descricao || '',
            tipo_desconto: cupom.tipo_desconto,
            valor_desconto: cupom.valor_desconto,
            pontos_custo: cupom.pontos_custo,
            apenas_plus: cupom.apenas_plus,
            data_validade: cupom.data_validade ? cupom.data_validade.substring(0, 16) : '', // Formato input datetime-local
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
        if (window.confirm('Tem certeza que deseja apagar este cupom permanentemente?')) {
            router.delete(route('cupons.destroy', id), { preserveScroll: true });
        }
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

            <div className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 pb-12">
                
                {flash?.success && (
                    <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-800 font-bold rounded-xl shadow-sm animate-in fade-in">
                        ✅ {flash.success}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* LADO ESQUERDO: FORMULÁRIO DE CRIAÇÃO */}
                    <div className="w-full lg:w-1/3 shrink-0">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 sticky top-24">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <GiftIcon className="w-6 h-6 text-orange-500" />
                                {isEditing ? 'Editar Recompensa' : 'Criar Novo Cupom'}
                            </h3>
                            
                            <form onSubmit={submit} className="space-y-5">
                                <div>
                                    <InputLabel value="Código do Cupom *" />
                                    <TextInput className="mt-1 w-full uppercase font-mono tracking-wider" value={data.codigo} onChange={e => setData('codigo', e.target.value.toUpperCase())} placeholder="Ex: VERAO20" required />
                                    <InputError message={errors.codigo} />
                                </div>

                                <div>
                                    <InputLabel value="Título da Promoção *" />
                                    <TextInput className="mt-1 w-full" value={data.titulo} onChange={e => setData('titulo', e.target.value)} placeholder="Ex: 20% OFF no primeiro corte" required />
                                    <InputError message={errors.titulo} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <InputLabel value="Tipo" />
                                        <select className="mt-1 w-full border-gray-300 dark:bg-gray-900 dark:border-gray-700 rounded-lg shadow-sm focus:border-indigo-500" value={data.tipo_desconto} onChange={e => setData('tipo_desconto', e.target.value)}>
                                            <option value="percentual">Porcentagem (%)</option>
                                            <option value="fixo">Valor Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <InputLabel value="Valor *" />
                                        <TextInput type="number" step="0.01" className="mt-1 w-full" value={data.valor_desconto} onChange={e => setData('valor_desconto', e.target.value)} required />
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                                    <h4 className="text-sm font-bold text-orange-800 dark:text-orange-400 flex items-center gap-1 mb-2">
                                        <StarIcon className="w-4 h-4" /> Gamificação (Pontos)
                                    </h4>
                                    <InputLabel value="Custo em Pontos (0 = Cupom Grátis)" className="text-xs" />
                                    <TextInput type="number" className="mt-1 w-full" value={data.pontos_custo} onChange={e => setData('pontos_custo', e.target.value)} min="0" />
                                    <p className="text-[10px] text-orange-600 mt-1">Se colocar mais que 0, o cliente terá que gastar pontos da carteira dele para resgatar este desconto.</p>
                                </div>

                                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                            <span className="bg-black text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">PLUS</span>
                                            Exclusivo
                                        </h4>
                                        <p className="text-xs text-gray-500">Apenas assinantes R$ 9,90</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={data.apenas_plus} onChange={e => setData('apenas_plus', e.target.checked)} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    {isEditing && (
                                        <button type="button" onClick={cancelarEdicao} className="px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition w-full">
                                            Cancelar
                                        </button>
                                    )}
                                    <PrimaryButton className="w-full justify-center py-3 bg-orange-600 hover:bg-orange-700 rounded-xl text-sm" disabled={processing}>
                                        {isEditing ? 'Salvar Alterações' : 'Criar Recompensa'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                Recompensas Ativas ({cupons.length})
                            </h3>

                            {cupons.length === 0 ? (
                                <div className="text-center py-12">
                                    <span className="text-5xl opacity-50 block mb-4">🎟️</span>
                                    <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">Nenhum cupom criado ainda</h4>
                                    <p className="text-sm text-gray-500 mt-1">Crie descontos ou recompensas de gamificação ao lado para fidelizar seus clientes.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {cupons.map(cupom => (
                                        <div key={cupom.id} className={`relative p-5 rounded-2xl border-2 transition-all ${cupom.ativo ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                                            
                                            {/* Etiqueta Superior */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-2">
                                                    <span className="font-mono text-xs font-black bg-gray-900 text-white px-2 py-1 rounded tracking-wider">
                                                        {cupom.codigo}
                                                    </span>
                                                    {cupom.apenas_plus && (
                                                        <span className="text-[10px] font-black bg-black text-yellow-400 px-2 py-1 rounded uppercase tracking-wider shadow-sm">
                                                            Plus
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => editarCupom(cupom)} className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition"><PencilSquareIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => deletarCupom(cupom.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition"><TrashIcon className="w-4 h-4"/></button>
                                                </div>
                                            </div>

                                            <h4 className="font-bold text-lg text-gray-900 mb-1">{cupom.titulo}</h4>
                                            
                                            <div className="flex items-center gap-2 mt-3 text-sm">
                                                <span className="font-black text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                                    {cupom.tipo_desconto === 'percentual' ? `${Number(cupom.valor_desconto)}% OFF` : `R$ ${Number(cupom.valor_desconto).toFixed(2)} OFF`}
                                                </span>
                                                <span className="text-gray-400">•</span>
                                                {cupom.pontos_custo > 0 ? (
                                                    <span className="flex items-center gap-1 font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                                                        <StarIcon className="w-3 h-3" /> Custa {cupom.pontos_custo} pts
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                                        Cupom Grátis (Público)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}