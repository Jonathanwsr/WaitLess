import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Create() {
    const { flash } = usePage().props;
    const [friendlyError, setFriendlyError] = useState(null);
    const [loadingCep, setLoadingCep] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        nome: '',
        razao_social: '',
        cnpj: '',
        site: '',
        ramo_atuacao: '',
        telefone: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        // Campos ocultos que serão preenchidos automaticamente
        latitude: '',
        longitude: '',
    });

    useEffect(() => {
        if (flash?.error) {
            setFriendlyError(flash.error);
        }
    }, [flash]);

    // Função que busca o CEP e as Coordenadas diretamente no Front-end
    const handleCepChange = async (e) => {
        const rawValue = e.target.value;
        // Aplica máscara visual automática (00000-000)
        const maskedValue = rawValue.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
        
        // Atualiza o campo de CEP primeiro
        setData((prev) => ({ ...prev, cep: maskedValue }));

        const cleanCep = rawValue.replace(/\D/g, '');

        // Quando o CEP atingir os 8 dígitos, faz a busca na API
        if (cleanCep.length === 8) {
            setLoadingCep(true);
            setFriendlyError(null);
            
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
                
                if (response.ok) {
                    const resData = await response.json();
                    
                    // Preenche todos os campos de endereço e as coordenadas ocultas de uma vez
                    setData((prev) => ({
                        ...prev,
                        rua: resData.street || '',
                        bairro: resData.neighborhood || '',
                        cidade: resData.city || '',
                        estado: resData.state || '',
                        latitude: resData.location?.coordinates?.latitude || '',
                        longitude: resData.location?.coordinates?.longitude || '',
                    }));
                } else {
                    setFriendlyError('CEP não encontrado. Por favor, verifique o número ou digite o endereço manualmente.');
                }
            } catch (error) {
                setFriendlyError('Não foi possível autocompletar o endereço devido a uma falha de conexão.');
            } finally {
                setLoadingCep(false);
            }
        }
    };

    const submit = (e) => {
        e.preventDefault();
        setFriendlyError(null);

        post(route('estabelecimentos.store'), {
            onError: (err) => {
                if (err.status === 500) {
                    setFriendlyError('Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.');
                } else if (err.status === 403) {
                    setFriendlyError('Você não tem permissão para realizar esta ação.');
                } else if (err.status === 404) {
                    setFriendlyError('O recurso solicitado não foi encontrado.');
                } else if (err.status === 401) {
                    setFriendlyError('Sua sessão expirou. Por favor, faça login novamente.');
                }
            }
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-200">
                        Novo Estabelecimento
                    </h2>
                    <Link
                        href={route('dashboard')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
                    >
                        Voltar ao Dashboard
                    </Link>
                </div>
            }
        >
            <Head title="Criar Estabelecimento - WaitLess" />

            <div className="max-w-4xl mx-auto mt-4 sm:mt-8 mb-6 sm:mb-12 px-4 sm:px-0">
                
                {friendlyError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
                        {friendlyError}
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-8">
                    
                    <div className="mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg mb-4">
                            W
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastrar Local</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">
                            Preencha as informações do negócio. Apenas o nome é estritamente obrigatório, mas dados completos ajudam na gestão.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-8">
                        
                        {/* --- SEÇÃO 1: Informações Básicas --- */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações Básicas</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                
                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="nome" value="Nome do Estabelecimento *" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="nome"
                                        type="text"
                                        value={data.nome}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        isFocused={true}
                                        onChange={(e) => setData('nome', e.target.value)}
                                        placeholder="Ex: Barbearia Central"
                                    />
                                    <InputError message={errors.nome} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="razao_social" value="Razão Social" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="razao_social"
                                        type="text"
                                        value={data.razao_social}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('razao_social', e.target.value)}
                                        placeholder="Ex: Nome Empresarial LTDA"
                                    />
                                    <InputError message={errors.razao_social} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="cnpj" value="CNPJ" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="cnpj"
                                        type="text"
                                        value={data.cnpj}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('cnpj', e.target.value)}
                                        placeholder="00.000.000/0001-00"
                                    />
                                    <InputError message={errors.cnpj} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="ramo_atuacao" value="Ramo de Atuação" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="ramo_atuacao"
                                        type="text"
                                        value={data.ramo_atuacao}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
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
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('telefone', e.target.value)}
                                        placeholder="(00) 00000-0000"
                                    />
                                    <InputError message={errors.telefone} className="mt-2" />
                                </div>

                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="site" value="Site / Link" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="site"
                                        type="url"
                                        value={data.site}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('site', e.target.value)}
                                        placeholder="https://seusite.com.br"
                                    />
                                    <InputError message={errors.site} className="mt-2" />
                                </div>
                            </div>
                        </div>

                        {/* --- SEÇÃO 2: Localização --- */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Localização {loadingCep && <span className="text-sm font-normal text-gray-400 ml-2 animate-pulse">Buscando endereço...</span>}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 sm:gap-6">
                                
                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="cep" value="CEP" />
                                    <TextInput
                                        id="cep"
                                        type="text"
                                        value={data.cep}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={handleCepChange}
                                        placeholder="00000-000"
                                    />
                                    <InputError message={errors.cep} className="mt-2" />
                                </div>

                                <div className="sm:col-span-4">
                                    <InputLabel htmlFor="rua" value="Rua / Avenida" />
                                    <TextInput
                                        id="rua"
                                        type="text"
                                        value={data.rua}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('rua', e.target.value)}
                                        placeholder="Ex: Av. Principal"
                                    />
                                    <InputError message={errors.rua} className="mt-2" />
                                </div>

                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="numero" value="Número" />
                                    <TextInput
                                        id="numero"
                                        type="text"
                                        value={data.numero}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('numero', e.target.value)}
                                        placeholder="123"
                                    />
                                    <InputError message={errors.numero} className="mt-2" />
                                </div>

                                <div className="sm:col-span-4">
                                    <InputLabel htmlFor="complemento" value="Complemento" />
                                    <TextInput
                                        id="complemento"
                                        type="text"
                                        value={data.complemento}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('complemento', e.target.value)}
                                        placeholder="Sala, Loja, Andar..."
                                    />
                                    <InputError message={errors.complemento} className="mt-2" />
                                </div>

                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="bairro" value="Bairro" />
                                    <TextInput
                                        id="bairro"
                                        type="text"
                                        value={data.bairro}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('bairro', e.target.value)}
                                        placeholder="Centro"
                                    />
                                    <InputError message={errors.bairro} className="mt-2" />
                                </div>

                                <div className="sm:col-span-3">
                                    <InputLabel htmlFor="cidade" value="Cidade" />
                                    <TextInput
                                        id="cidade"
                                        type="text"
                                        value={data.cidade}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={(e) => setData('cidade', e.target.value)}
                                        placeholder="Ex: Vitória de Santo Antão"
                                    />
                                    <InputError message={errors.cidade} className="mt-2" />
                                </div>

                                <div className="sm:col-span-1">
                                    <InputLabel htmlFor="estado" value="UF" />
                                    <TextInput
                                        id="estado"
                                        type="text"
                                        value={data.estado}
                                        className="mt-1 block w-full uppercase py-2.5 sm:py-3"
                                        maxLength="2"
                                        onChange={(e) => setData('estado', e.target.value.toUpperCase())}
                                        placeholder="PE"
                                    />
                                    <InputError message={errors.estado} className="mt-2" />
                                </div>
                            </div>
                        </div>

                        {/* --- Botões de Ação --- */}
                        <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col-reverse sm:flex-row justify-end items-center gap-3 sm:gap-4">
                            <Link
                                href={route('dashboard')}
                                className="w-full sm:w-auto text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-2.5"
                            >
                                Cancelar
                            </Link>
                            <PrimaryButton 
                                className="w-full sm:w-auto px-8 py-3 text-base justify-center bg-green-600 hover:bg-green-700 focus:bg-green-700 active:bg-green-800 focus:ring-green-500 text-white shadow-md rounded-xl transition font-semibold" 
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