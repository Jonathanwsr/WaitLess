import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        nome: '',
        ramo_atuacao: '',
        telefone: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('estabelecimentos.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                        Novo Estabelecimento
                    </h2>
                    <Link
                        href={route('dashboard')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
                    >
                        ← Voltar ao Dashboard
                    </Link>
                </div>
            }
        >
            <Head title="Criar Estabelecimento - WaitLess" />

            <div className="max-w-4xl mx-auto mt-8 mb-12">
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
                    
                    <div className="mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl mb-4">
                            🏢
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastrar Local</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Preencha as informações do negócio. Apenas o nome é estritamente obrigatório, mas dados completos ajudam na gestão.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-8">
                        
                        {/* --- SEÇÃO 1: Informações Básicas --- */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações Básicas</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Nome ocupa a linha toda no mobile, e 2 colunas no desktop */}
                                <div className="md:col-span-2">
                                    <InputLabel htmlFor="nome" value="Nome do Estabelecimento *" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="nome"
                                        type="text"
                                        value={data.nome}
                                        className="mt-1 block w-full py-3"
                                        isFocused={true}
                                        onChange={(e) => setData('nome', e.target.value)}
                                        placeholder="Ex: Barbearia Central"
                                    />
                                    <InputError message={errors.nome} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="ramo_atuacao" value="Ramo de Atuação" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="ramo_atuacao"
                                        type="text"
                                        value={data.ramo_atuacao}
                                        className="mt-1 block w-full py-3"
                                        onChange={(e) => setData('ramo_atuacao', e.target.value)}
                                        placeholder="Ex: Clínica Médica"
                                    />
                                    <InputError message={errors.ramo_atuacao} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="telefone" value="Telefone de Contato" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="telefone"
                                        type="text"
                                        value={data.telefone}
                                        className="mt-1 block w-full py-3"
                                        onChange={(e) => setData('telefone', e.target.value)}
                                        placeholder="(00) 00000-0000"
                                    />
                                    <InputError message={errors.telefone} className="mt-2" />
                                </div>
                            </div>
                        </div>

                   
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Localização</h4>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                
                                <div className="md:col-span-2">
                                    <InputLabel htmlFor="cep" value="CEP" />
                                    <TextInput
                                        id="cep"
                                        type="text"
                                        value={data.cep}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('cep', e.target.value)}
                                        placeholder="00000-000"
                                    />
                                    <InputError message={errors.cep} className="mt-2" />
                                </div>

                                <div className="md:col-span-4">
                                    <InputLabel htmlFor="rua" value="Rua / Avenida" />
                                    <TextInput
                                        id="rua"
                                        type="text"
                                        value={data.rua}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('rua', e.target.value)}
                                        placeholder="Ex: Av. Principal"
                                    />
                                    <InputError message={errors.rua} className="mt-2" />
                                </div>

                                <div className="md:col-span-2">
                                    <InputLabel htmlFor="numero" value="Número" />
                                    <TextInput
                                        id="numero"
                                        type="text"
                                        value={data.numero}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('numero', e.target.value)}
                                        placeholder="123"
                                    />
                                    <InputError message={errors.numero} className="mt-2" />
                                </div>

                                <div className="md:col-span-4">
                                    <InputLabel htmlFor="complemento" value="Complemento" />
                                    <TextInput
                                        id="complemento"
                                        type="text"
                                        value={data.complemento}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('complemento', e.target.value)}
                                        placeholder="Sala, Loja, Andar..."
                                    />
                                    <InputError message={errors.complemento} className="mt-2" />
                                </div>

                                <div className="md:col-span-2">
                                    <InputLabel htmlFor="bairro" value="Bairro" />
                                    <TextInput
                                        id="bairro"
                                        type="text"
                                        value={data.bairro}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('bairro', e.target.value)}
                                        placeholder="Centro"
                                    />
                                    <InputError message={errors.bairro} className="mt-2" />
                                </div>

                                <div className="md:col-span-3">
                                    <InputLabel htmlFor="cidade" value="Cidade" />
                                    <TextInput
                                        id="cidade"
                                        type="text"
                                        value={data.cidade}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('cidade', e.target.value)}
                                        placeholder="Ex: Vitória de Santo Antão"
                                    />
                                    <InputError message={errors.cidade} className="mt-2" />
                                </div>

                                <div className="md:col-span-1">
                                    <InputLabel htmlFor="estado" value="UF" />
                                    <TextInput
                                        id="estado"
                                        type="text"
                                        value={data.estado}
                                        className="mt-1 block w-full uppercase"
                                        maxLength="2"
                                        onChange={(e) => setData('estado', e.target.value.toUpperCase())}
                                        placeholder="PE"
                                    />
                                    <InputError message={errors.estado} className="mt-2" />
                                </div>
                            </div>
                        </div>

                        {/* --- Botões de Ação --- */}
                        <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center gap-4">
                            <Link
                                href={route('dashboard')}
                                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
                            >
                                Cancelar
                            </Link>
                            <PrimaryButton 
                                className="px-8 py-3 text-base bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 rounded-xl" 
                                disabled={processing}
                            >
                                {processing ? 'Salvando...' : 'Finalizar Cadastro'}
                            </PrimaryButton>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}