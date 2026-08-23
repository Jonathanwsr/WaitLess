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
    
    // Estados para o preview das imagens
    const [previewLogo, setPreviewLogo] = useState(null);
    const [previewBanner, setPreviewBanner] = useState(null);

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
        bio: '',
        foto_perfil: null,
        foto_banner: null,
        latitude: '',
        longitude: '',
    });

    useEffect(() => {
        if (flash?.error) {
            setFriendlyError(flash.error);
        }
    }, [flash]);

    const handleCepChange = async (e) => {
        const rawValue = e.target.value;
        const maskedValue = rawValue.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
        
        setData((prev) => ({ ...prev, cep: maskedValue }));
        const cleanCep = rawValue.replace(/\D/g, '');

        if (cleanCep.length === 8) {
            setLoadingCep(true);
            setFriendlyError(null);
            
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
                
                if (response.ok) {
                    const resData = await response.json();
                    
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

    const handleCnpjChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
        
        setData('cnpj', value.substring(0, 18));
    };

    const handleTelefoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        
        setData('telefone', value.substring(0, 15));
    };

    // Funções para lidar com as imagens e gerar o preview
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData('foto_perfil', file);
            setPreviewLogo(URL.createObjectURL(file));
        }
    };

    const handleBannerChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData('foto_banner', file);
            setPreviewBanner(URL.createObjectURL(file));
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
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
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
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastrar Local</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">
                            Preencha as informações do negócio. Apenas o nome é estritamente obrigatório, mas dados completos ajudam na gestão.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-10">
                        
                        {/* Logo do Estabelecimento */}
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <label 
                                htmlFor="foto_perfil" 
                                className="relative shrink-0 w-36 h-36 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer overflow-hidden group"
                            >
                                {previewLogo ? (
                                    <img src={previewLogo} alt="Preview Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-semibold text-slate-400 group-hover:text-slate-500 transition">C</span>
                                )}
                                <input
                                    id="foto_perfil"
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                />
                            </label>
                            <div className="flex flex-col justify-center sm:pt-4">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Logo do Estabelecimento</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                                    Esta imagem será exibida para os clientes na tela de agendamento e buscas. Formatos: JPG, PNG, WEBP (Max: 2MB).
                                </p>
                                <InputError message={errors.foto_perfil} className="mt-2" />
                            </div>
                        </div>

                        {/* Banner da Loja */}
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-8">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">Banner da Loja</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
                                Este banner será exibido na parte superior da página pública do seu estabelecimento.
                            </p>
                            
                            <label 
                                htmlFor="foto_banner" 
                                className="relative w-full h-48 sm:h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer overflow-hidden group"
                            >
                                {previewBanner ? (
                                    <img src={previewBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-slate-500 transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="font-bold tracking-wider text-sm uppercase">Inserir Banner da Vitrine</span>
                                    </div>
                                )}
                                <input
                                    id="foto_banner"
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    className="hidden"
                                    onChange={handleBannerChange}
                                />
                            </label>
                            <InputError message={errors.foto_banner} className="mt-2" />
                        </div>
                    </div>

                    <form onSubmit={submit} className="space-y-12" encType="multipart/form-data">
                        
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
                                        onChange={handleCnpjChange}
                                        placeholder="00.000.000/0001-00"
                                    />
                                    <InputError message={errors.cnpj} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="ramo_atuacao" value="Ramo de Atuação" className="text-gray-700 dark:text-gray-300" />
                                    <select
                                        id="ramo_atuacao"
                                        value={data.ramo_atuacao}
                                        onChange={(e) => setData('ramo_atuacao', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm py-2.5 sm:py-3"
                                    >
                                        <option value="">Selecione o ramo de atuação...</option>
                                        <option value="Barbearia">Barbearia</option>
                                        <option value="Salão de Beleza">Salão de Beleza</option>
                                        <option value="Clínica Médica/Odontológica">Clínica Médica / Odontológica</option>
                                        <option value="Restaurante/Lanchonete">Restaurante / Lanchonete</option>
                                        <option value="Oficina Mecânica">Oficina Mecânica</option>
                                        <option value="Pet Shop">Pet Shop</option>
                                        <option value="Estética">Estética / Spa</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                    <InputError message={errors.ramo_atuacao} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="telefone" value="Telefone de Contato" className="text-gray-700 dark:text-gray-300" />
                                    <TextInput
                                        id="telefone"
                                        type="text"
                                        value={data.telefone}
                                        className="mt-1 block w-full py-2.5 sm:py-3"
                                        onChange={handleTelefoneChange}
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

                                <div className="sm:col-span-2">
                                    <InputLabel htmlFor="bio" value="Sobre o Estabelecimento (Bio)" className="text-gray-700 dark:text-gray-300" />
                                    <textarea
                                        id="bio"
                                        value={data.bio}
                                        onChange={(e) => setData('bio', e.target.value)}
                                        maxLength="1000"
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm"
                                        rows="4"
                                        placeholder="Descreva brevemente o seu negócio..."
                                    ></textarea>
                                    <div className="text-right text-xs text-gray-500 mt-1">
                                        {data.bio.length}/1000
                                    </div>
                                    <InputError message={errors.bio} className="mt-2" />
                                </div>

                            </div>
                        </div>

                        {/* --- SEÇÃO 2: Localização --- */}
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
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
                                    <select
                                        id="estado"
                                        value={data.estado}
                                        onChange={(e) => setData('estado', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm py-2.5 sm:py-3"
                                    >
                                        <option value="">--</option>
                                        <option value="AC">AC</option>
                                        <option value="AL">AL</option>
                                        <option value="AP">AP</option>
                                        <option value="AM">AM</option>
                                        <option value="BA">BA</option>
                                        <option value="CE">CE</option>
                                        <option value="DF">DF</option>
                                        <option value="ES">ES</option>
                                        <option value="GO">GO</option>
                                        <option value="MA">MA</option>
                                        <option value="MT">MT</option>
                                        <option value="MS">MS</option>
                                        <option value="MG">MG</option>
                                        <option value="PA">PA</option>
                                        <option value="PB">PB</option>
                                        <option value="PR">PR</option>
                                        <option value="PE">PE</option>
                                        <option value="PI">PI</option>
                                        <option value="RJ">RJ</option>
                                        <option value="RN">RN</option>
                                        <option value="RS">RS</option>
                                        <option value="RO">RO</option>
                                        <option value="RR">RR</option>
                                        <option value="SC">SC</option>
                                        <option value="SP">SP</option>
                                        <option value="SE">SE</option>
                                        <option value="TO">TO</option>
                                    </select>
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