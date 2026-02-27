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
    const user = usePage().props.auth.user;

    // Estado para a prévia da foto
    const [fotoPreview, setFotoPreview] = useState(user.foto_perfil || null);

    // 👉 IMPORTANTE: Mudamos de "patch" para "post" na desestruturação
    const { data, setData, post, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
            foto_perfil: null,
            _method: 'patch', // 👈 TRUQUE DO INERTIA: Finge que é PATCH para o Laravel aceitar a foto
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

        // Usamos post em vez de patch para suportar o upload (multipart/form-data)
        post(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => {
                // Limpa o arquivo após sucesso para não reenviar à toa se salvar de novo
                setData('foto_perfil', null);
            }
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Informações do Perfil
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Atualize as informações do seu perfil e o endereço de e-mail.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                
              
                <div className="flex items-center gap-6">
                    <div className="relative group cursor-pointer w-20 h-20 shrink-0">
                        <label className="cursor-pointer w-full h-full block rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                            {fotoPreview ? (
                                <img 
                                    src={fotoPreview} 
                                    alt={`Foto de ${data.name}`} 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-3xl font-bold uppercase">
                                    {data.name ? data.name.charAt(0) : 'U'}
                                </div>
                            )}
                            
                            {/* Efeito de Hover */}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-[10px] font-bold uppercase tracking-wider">Alterar</span>
                            </div>
                            
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFotoChange} 
                            />
                        </label>
                    </div>
                    <div>
                        <InputLabel value="Sua Foto" />
                        <p className="text-xs text-gray-500 mt-1">Formatos: JPG, PNG, WEBP. Max: 2MB.</p>
                        <InputError className="mt-2" message={errors.foto_perfil} />
                    </div>
                </div>

                {/* Campos Originais */}
                <div>
                    <InputLabel htmlFor="name" value="Nome Completo" />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="E-mail" />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div>
                        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                            Seu endereço de e-mail não está verificado.
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-100 dark:focus:ring-offset-gray-800"
                            >
                                Clique aqui para reenviar o e-mail de verificação.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                                Um novo link de verificação foi enviado para o seu endereço de e-mail.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Salvar Alterações</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            Salvo com sucesso!
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}