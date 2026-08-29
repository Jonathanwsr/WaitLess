import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}) {
    // Aqui pegamos o objeto 'profile' enviado pelo seu Controller
    const { profile, auth } = usePage().props;
    const user = auth.user;
    
    // Estados para liberar edição (Lápis)
    const [editarGeral, setEditarGeral] = useState(false);
    const [editarEndereco, setEditarEndereco] = useState(false);

    // Estado para Foto e Tipo de Documento
    const [fotoPreview, setFotoPreview] = useState(profile.foto_perfil || null);
    
    // Define se é CPF ou CNPJ baseado no que já vem do banco
    const documentoInicial = (profile.person_type === 'J' || (profile.cpf_cnpj && profile.cpf_cnpj.length > 14)) ? 'CNPJ' : 'CPF';
    const [tipoDocumento, setTipoDocumento] = useState(documentoInicial);

    // Inicializa o formulário COM OS DADOS DO BANCO
    const { data, setData, post, errors, processing, recentlySuccessful } =
        useForm({
            // Identificação e Pessoal
            name: profile.name || '',
            email: profile.email || '',
            cpf_cnpj: profile.cpf_cnpj || '',
            birth_date: profile.birth_date || '',
            telefone: profile.telefone || profile.mobile_phone || profile.phone || '',
            profissao: profile.profissao || '',
            idiomas: profile.idiomas || '',
            onde_moro: profile.onde_moro || '',
            onde_estudei: profile.onde_estudei || '',
            sobre_mim: profile.sobre_mim || '',

            // Endereço
            cep: profile.cep || profile.postal_code || '',
            endereco: profile.endereco || profile.address || '',
            address_number: profile.address_number || '',
            bairro: profile.bairro || profile.province || '',
            cidade: profile.cidade || '',
            estado: profile.estado || '',
            complement: profile.complement || '',
            referencia: profile.referencia || '',

            foto_perfil: null,
            _method: 'patch', // Necessário para upload de arquivos no Laravel usando método POST
        });

    const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData('foto_perfil', file);
            setFotoPreview(URL.createObjectURL(file));
        }
    };

    const submit = (e) => {
        e.preventDefault();

        // Fazemos um POST porque tem envio de arquivo (foto), mas enviamos _method: patch
        post(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => {
                setData('foto_perfil', null);
                setEditarGeral(false);
                setEditarEndereco(false);
            },
        });
    };

    const PencilIcon = () => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
    );

    return (
        <section className={`max-w-4xl space-y-8 ${className}`}>
            
            {/* CABEÇALHO */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5 dark:border-gray-700">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Informações do Perfil
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Gerencie seus dados pessoais, documento, contato e endereço.
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50">
                        <span>Dados gerais: alteração a cada 15 dias</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50">
                        <span>E-mail e Endereço: alteração a cada 30 dias</span>
                    </div>
                </div>
            </header>

            {/* SEÇÃO 0: INFORMAÇÕES DE CONTA (SOMENTE LEITURA) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase">Papel/Cargo</span>
                    <span className="block mt-1 font-semibold text-gray-900 dark:text-gray-100 capitalize">{profile.papel || 'Usuário Padrão'}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase">Plano Assinatura</span>
                    <span className="block mt-1 font-semibold text-gray-900 dark:text-gray-100">{profile.plano_assinatura || 'Gratuito'}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase">Pontos / Saldo</span>
                    <span className="block mt-1 font-semibold text-emerald-600 dark:text-emerald-400">{profile.pontos_saldo || 0} pts</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase">Serviços Feitos</span>
                    <span className="block mt-1 font-semibold text-gray-900 dark:text-gray-100">{profile.numero_servicos || 0}</span>
                </div>
            </div>

            {/* AVISO DE ERROS */}
            {(errors.geral || errors.endereco_email) && (
                <div className="rounded-md bg-red-50 p-4 border border-red-200 flex flex-col gap-2">
                    {errors.geral && <p className="text-sm font-medium text-red-800">{errors.geral}</p>}
                    {errors.endereco_email && <p className="text-sm font-medium text-red-800">{errors.endereco_email}</p>}
                </div>
            )}

            <form onSubmit={submit} className="space-y-8">
                
                {/* 1. FOTO DE PERFIL */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="relative group w-24 h-24 shrink-0">
                        <label className="cursor-pointer w-full h-full block rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-md group-hover:border-indigo-500 transition-all">
                            {fotoPreview ? (
                                <img src={fotoPreview} alt={data.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold uppercase">
                                    {data.name ? data.name.charAt(0) : 'U'}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-[10px] font-semibold uppercase tracking-wider">Alterar</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
                        </label>
                    </div>
                    <div>
                        <InputLabel value="Foto de Perfil" className="text-base font-semibold" />
                        <p className="text-xs text-gray-500">JPG, PNG ou WEBP (Máx. 2MB).</p>
                        <InputError className="mt-1" message={errors.foto_perfil} />
                    </div>
                </div>

                {/* 2. DADOS PESSOAIS */}
                <div className="space-y-4">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                        <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">Dados Pessoais</h3>
                        <button type="button" onClick={() => setEditarGeral(!editarGeral)} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                            <PencilIcon />
                            {editarGeral ? 'Cancelar Edição' : 'Editar Dados'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <InputLabel htmlFor="name" value="Nome Completo" />
                            <TextInput id="name" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.name} onChange={(e) => setData('name', e.target.value)} required disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.name} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4 mt-1">
                                <label className="inline-flex items-center">
                                    <input type="radio" className="form-radio text-indigo-600 disabled:opacity-50" name="tipo_doc" value="CPF" checked={tipoDocumento === 'CPF'} onChange={() => setTipoDocumento('CPF')} disabled={!editarGeral} />
                                    <span className="ml-2 text-sm text-gray-700">Pessoa Física</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input type="radio" className="form-radio text-indigo-600 disabled:opacity-50" name="tipo_doc" value="CNPJ" checked={tipoDocumento === 'CNPJ'} onChange={() => setTipoDocumento('CNPJ')} disabled={!editarGeral} />
                                    <span className="ml-2 text-sm text-gray-700">Pessoa Jurídica</span>
                                </label>
                            </div>
                            <InputLabel htmlFor="cpf_cnpj" value={tipoDocumento === 'CPF' ? 'Número do CPF' : 'Número do CNPJ'} />
                            <TextInput id="cpf_cnpj" className="block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.cpf_cnpj} onChange={(e) => setData('cpf_cnpj', e.target.value)} placeholder={tipoDocumento === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.cpf_cnpj} />
                        </div>

                        <div>
                            <InputLabel htmlFor="birth_date" value="Data de Nascimento" />
                            <TextInput id="birth_date" type="date" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.birth_date} onChange={(e) => setData('birth_date', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.birth_date} />
                        </div>

                        <div>
                            <InputLabel htmlFor="telefone" value="Telefone / Celular" />
                            <TextInput id="telefone" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.telefone} onChange={(e) => setData('telefone', e.target.value)} placeholder="(00) 00000-0000" disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.telefone} />
                        </div>
                    </div>
                </div>

                {/* 3. EMAIL E ENDEREÇO */}
                <div className="space-y-4">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                        <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">E-mail e Endereço</h3>
                        <button type="button" onClick={() => setEditarEndereco(!editarEndereco)} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                            <PencilIcon />
                            {editarEndereco ? 'Cancelar Edição' : 'Editar E-mail/Endereço'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-3">
                            <InputLabel htmlFor="email" value="E-mail" />
                            <TextInput id="email" type="email" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.email} onChange={(e) => setData('email', e.target.value)} required disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.email} />
                        </div>

                        <div>
                            <InputLabel htmlFor="cep" value="CEP" />
                            <TextInput id="cep" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.cep} onChange={(e) => setData('cep', e.target.value)} placeholder="00000-000" disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.cep} />
                        </div>

                        <div className="sm:col-span-2">
                            <InputLabel htmlFor="endereco" value="Logradouro / Rua" />
                            <TextInput id="endereco" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.endereco} onChange={(e) => setData('endereco', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.endereco} />
                        </div>

                        <div>
                            <InputLabel htmlFor="address_number" value="Número" />
                            <TextInput id="address_number" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.address_number} onChange={(e) => setData('address_number', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.address_number} />
                        </div>

                        <div>
                            <InputLabel htmlFor="bairro" value="Bairro" />
                            <TextInput id="bairro" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.bairro} onChange={(e) => setData('bairro', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.bairro} />
                        </div>

                        <div>
                            <InputLabel htmlFor="complement" value="Complemento" />
                            <TextInput id="complement" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.complement} onChange={(e) => setData('complement', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.complement} />
                        </div>

                        <div>
                            <InputLabel htmlFor="cidade" value="Cidade" />
                            <TextInput id="cidade" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.cidade} onChange={(e) => setData('cidade', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.cidade} />
                        </div>

                        <div>
                            <InputLabel htmlFor="estado" value="Estado (UF)" />
                            <TextInput id="estado" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.estado} onChange={(e) => setData('estado', e.target.value)} maxLength={2} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.estado} />
                        </div>

                        <div>
                            <InputLabel htmlFor="referencia" value="Ponto de Referência" />
                            <TextInput id="referencia" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.referencia} onChange={(e) => setData('referencia', e.target.value)} disabled={!editarEndereco} />
                            <InputError className="mt-1" message={errors.referencia} />
                        </div>
                    </div>
                </div>

                {/* 4. INFORMAÇÕES COMPLEMENTARES */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 pb-2">Sobre Você</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <InputLabel htmlFor="profissao" value="Profissão" />
                            <TextInput id="profissao" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.profissao} onChange={(e) => setData('profissao', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.profissao} />
                        </div>
                        <div>
                            <InputLabel htmlFor="idiomas" value="Idiomas" />
                            <TextInput id="idiomas" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.idiomas} onChange={(e) => setData('idiomas', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.idiomas} />
                        </div>
                        <div>
                            <InputLabel htmlFor="onde_moro" value="Onde Mora" />
                            <TextInput id="onde_moro" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.onde_moro} onChange={(e) => setData('onde_moro', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.onde_moro} />
                        </div>
                        <div>
                            <InputLabel htmlFor="onde_estudei" value="Onde Estudou" />
                            <TextInput id="onde_estudei" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-500" value={data.onde_estudei} onChange={(e) => setData('onde_estudei', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.onde_estudei} />
                        </div>
                        <div className="sm:col-span-2">
                            <InputLabel htmlFor="sobre_mim" value="Biografia / Sobre Mim" />
                            <textarea id="sobre_mim" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100 disabled:text-gray-500" rows={3} value={data.sobre_mim} onChange={(e) => setData('sobre_mim', e.target.value)} disabled={!editarGeral} />
                            <InputError className="mt-1" message={errors.sobre_mim} />
                        </div>
                    </div>
                </div>

                {/* BOTÃO DE SALVAR */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                    <PrimaryButton disabled={processing || (!editarGeral && !editarEndereco && !data.foto_perfil)} className="px-6 py-2.5">
                        Salvar Alterações
                    </PrimaryButton>

                    <Transition show={recentlySuccessful} enter="transition ease-in-out duration-300" enterFrom="opacity-0 translate-x-[-10px]" enterTo="opacity-100 translate-x-0" leave="transition ease-in-out duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <span className="text-sm font-semibold text-emerald-600">Perfil atualizado com sucesso!</span>
                    </Transition>
                </div>
            </form>
        </section>
    );
}