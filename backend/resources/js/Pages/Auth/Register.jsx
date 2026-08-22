import InputError from '@/Components/InputError';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        papel: '',
        person_type: 'FISICA',
        cpf_cnpj: '',
        mobile_phone: '',
        phone: '',
        postal_code: '',
        address: '',
        address_number: '',
        complement: '',
        province: '',
        city: '',
        state: '',
        // Novos campos
        onde_estudei: '',
        onde_moro: '',
        idiomas: '', 
        profissao: '',
        sobre_mim: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [selectedIdiomas, setSelectedIdiomas] = useState([]);

    // Lista de idiomas para o seletor moderno
    const listaIdiomas = [
        "Português (Brasil)", "Português (Portugal)", 
        "Inglês", "Espanhol", "Francês", "Alemão", "Italiano", "Outro"
    ];

    // Atualiza opções de papel e zera CPF/CNPJ ao mudar o tipo de pessoa
    useEffect(() => {
        if (data.person_type === 'JURIDICA') {
            setData('papel', 'socio');
        } else if (data.person_type === 'FISICA' && data.papel === 'socio') {
            setData('papel', '');
        }
        setData('cpf_cnpj', '');
    }, [data.person_type]);

    // Atualiza a string de idiomas no useForm sempre que o array local mudar
    useEffect(() => {
        setData('idiomas', selectedIdiomas.join(', '));
    }, [selectedIdiomas]);

    const toggleIdioma = (idioma) => {
        if (selectedIdiomas.includes(idioma)) {
            setSelectedIdiomas(selectedIdiomas.filter(i => i !== idioma));
        } else {
            setSelectedIdiomas([...selectedIdiomas, idioma]);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Remove emojis e números
    const cleanText = (text) => {
        return text
            .replace(/[0-9]/g, '')
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    };

    const handleProfissao = (e) => {
        let val = cleanText(e.target.value);
        if (val.length > 0) val = val.charAt(0).toUpperCase() + val.slice(1);
        setData('profissao', val);
    };

    const handleOndeEstudei = (e) => {
        setData('onde_estudei', cleanText(e.target.value));
    };

    const handleCpfCnpj = (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Apenas números
        if (data.person_type === 'FISICA') {
            value = value.slice(0, 11);
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            value = value.slice(0, 14);
            value = value.replace(/^(\d{2})(\d)/, '$1.$2');
            value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
            value = value.replace(/(\d{4})(\d)/, '$1-$2');
        }
        setData('cpf_cnpj', value);
    };

    const handleCepChange = async (e) => {
        let cep = e.target.value.replace(/\D/g, '');
        setData('postal_code', cep);

        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const result = await response.json();

                if (!result.erro) {
                    setData((prev) => ({
                        ...prev,
                        address: result.logradouro || '',
                        province: result.bairro || '',
                        city: result.localidade || '',
                        state: result.uf || '',
                    }));
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    };

    const ufs = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
        "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
        "SP", "SE", "TO"
    ];

    // Ícones SVG para mostrar/ocultar senha
    const EyeIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
    const EyeSlashIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 lg:p-4 xl:p-8 font-sans selection:bg-[#F26522] selection:text-white">
            <Head title="Crie sua conta - Lokyva" />

            <div className="w-full h-full min-h-screen lg:min-h-0 lg:h-[95vh] lg:max-h-[1000px] max-w-7xl bg-white lg:rounded-[2rem] lg:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] flex flex-col lg:flex-row overflow-hidden lg:border lg:border-gray-100 relative">
                
                {/* --- PAINEL ESQUERDO: IMAGEM --- */}
                <div className="hidden lg:flex lg:w-4/12 xl:w-5/12 relative overflow-hidden bg-[#FFF9F5] border-r border-gray-100">
                    <img 
                        src="/images/cadastro.png" 
                        alt="Fundo de Cadastro Lokyva" 
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                </div>

                {/* --- PAINEL DIREITO: FORMULÁRIO --- */}
                <div className="w-full h-full lg:w-8/12 xl:w-7/12 flex flex-col px-6 py-8 sm:px-10 md:px-12 bg-white overflow-y-auto custom-scrollbar">
                    <div className="max-w-3xl w-full mx-auto space-y-6 my-auto lg:my-0">
                        
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-4">
                                <Link href="/">
                                    <img src="/images/logo_lokyva.png" alt="Logo Lokyva" className="h-14 w-auto object-contain" />
                                </Link>
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-xl font-black tracking-tight text-gray-900">Lokyva</h2>
                                <p className="text-[10px] font-bold text-[#F26522] tracking-wider uppercase">Você viaja, a gente conecta o resto.</p>
                            </div>
                            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-6">Crie sua conta</h3>
                        </div>

                        {/* Aviso geral de erros no cadastro */}
                        {Object.keys(errors).length > 0 && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-semibold">
                                Encontramos um erro no cadastro. Verifique as informações preenchidas abaixo.
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-8">
                            
                            {/* SEÇÃO 1: ACESSO */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">1. Dados de Acesso</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">E-mail</label>
                                        <input
                                            type="email"
                                            value={data.email}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="seu@email.com"
                                            onChange={(e) => setData('email', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.email} className="text-xs" />
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Pessoa</label>
                                        <select
                                            value={data.person_type}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('person_type', e.target.value)}
                                        >
                                            <option value="FISICA">Pessoa Física</option>
                                            <option value="JURIDICA">Pessoa Jurídica</option>
                                        </select>
                                        <InputError message={errors.person_type} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Usuário</label>
                                        <select
                                            value={data.papel}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('papel', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled hidden>Selecione</option>
                                            {data.person_type === 'FISICA' && (
                                                <>
                                                    <option value="user">Cliente</option>
                                                    <option value="atendente">Funcionário</option>
                                                </>
                                            )}
                                            {data.person_type === 'JURIDICA' && (
                                                <option value="socio">Proprietário</option>
                                            )}
                                        </select>
                                        <InputError message={errors.papel} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Senha</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={data.password}
                                                className="block w-full px-4 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                                placeholder="••••••••"
                                                minLength={8}
                                                onChange={(e) => setData('password', e.target.value)}
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
                                            >
                                                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                            </button>
                                        </div>
                                        <InputError message={errors.password} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Confirmar Senha</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={data.password_confirmation}
                                                className="block w-full px-4 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                                placeholder="••••••••"
                                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                                required
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
                                            >
                                                {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                            </button>
                                        </div>
                                        <InputError message={errors.password_confirmation} className="text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 2: DADOS PESSOAIS/EMPRESA */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">2. Dados Cadastrais</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Nome Completo / Razão Social</label>
                                        <input
                                            type="text"
                                            value={data.name}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="Nome da empresa"
                                            onChange={(e) => setData('name', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.name} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">
                                            {data.person_type === 'FISICA' ? 'CPF' : 'CNPJ'}
                                        </label>
                                        <input
                                            type="text"
                                            value={data.cpf_cnpj}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder={data.person_type === 'FISICA' ? '000.000.000-00' : '00.000.000/0000-00'}
                                            maxLength={data.person_type === 'FISICA' ? 14 : 18}
                                            onChange={handleCpfCnpj}
                                            required
                                        />
                                        <InputError message={errors.cpf_cnpj} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Celular (com DDD)</label>
                                        <input
                                            type="text"
                                            value={data.mobile_phone}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="Ex: 81999999999"
                                            maxLength={11}
                                            onChange={(e) => setData('mobile_phone', e.target.value.replace(/\D/g, ''))}
                                            required
                                        />
                                        <InputError message={errors.mobile_phone} className="text-xs" />
                                    </div>

                                    {/* Novos Campos Adicionados */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Profissão</label>
                                        <input
                                            type="text"
                                            value={data.profissao}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="Ex: Engenheiro"
                                            onChange={handleProfissao}
                                            required
                                        />
                                        <InputError message={errors.profissao} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Onde Estudei</label>
                                        <input
                                            type="text"
                                            value={data.onde_estudei}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="Nome da escola, faculdade, etc"
                                            onChange={handleOndeEstudei}
                                            required
                                        />
                                        <InputError message={errors.onde_estudei} className="text-xs" />
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Onde Moro (Tipo de Habitação)</label>
                                        <select
                                            value={data.onde_moro}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('onde_moro', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled hidden>Selecione onde mora</option>
                                            <option value="Casa">Casa</option>
                                            <option value="Apartamento">Apartamento</option>
                                            <option value="Sítio">Sítio / Chácara</option>
                                            <option value="Flat">Flat / Studio</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                        <InputError message={errors.onde_moro} className="text-xs" />
                                    </div>

                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Idiomas que Falo</label>
                                        <div className="flex flex-wrap gap-2">
                                            {listaIdiomas.map((idioma) => (
                                                <button
                                                    key={idioma}
                                                    type="button"
                                                    onClick={() => toggleIdioma(idioma)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                        selectedIdiomas.includes(idioma) 
                                                        ? 'bg-[#F26522] text-white border-[#F26522]' 
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#F26522] hover:text-[#F26522]'
                                                    }`}
                                                >
                                                    {idioma}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Validação manual para garantir que escolheu idioma */}
                                        <input type="hidden" value={data.idiomas} required />
                                        <InputError message={errors.idiomas} className="text-xs" />
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Sobre Mim</label>
                                        <textarea
                                            value={data.sobre_mim}
                                            rows="3"
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors resize-none"
                                            placeholder="Conte um pouco sobre você, seus interesses..."
                                            onChange={(e) => setData('sobre_mim', e.target.value)}
                                            required
                                        ></textarea>
                                        <InputError message={errors.sobre_mim} className="text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 3: ENDEREÇO */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">3. Endereço</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1 sm:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">CEP</label>
                                        <input
                                            type="text"
                                            value={data.postal_code}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            placeholder="Apenas números"
                                            maxLength={8}
                                            onChange={handleCepChange}
                                            required
                                        />
                                        <InputError message={errors.postal_code} className="text-xs" />
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Rua / Logradouro</label>
                                        <input
                                            type="text"
                                            value={data.address}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('address', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.address} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Número</label>
                                        <input
                                            type="text"
                                            value={data.address_number}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('address_number', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.address_number} className="text-xs" />
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Complemento (Opcional)</label>
                                        <input
                                            type="text"
                                            value={data.complement}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('complement', e.target.value)}
                                        />
                                        <InputError message={errors.complement} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Bairro</label>
                                        <input
                                            type="text"
                                            value={data.province}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('province', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.province} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Cidade</label>
                                        <input
                                            type="text"
                                            value={data.city}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('city', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.city} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">UF</label>
                                        <select
                                            value={data.state}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-[#F26522] focus:border-[#F26522] transition-colors"
                                            onChange={(e) => setData('state', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled hidden>UF</option>
                                            {ufs.map((uf) => (
                                                <option key={uf} value={uf}>{uf}</option>
                                            ))}
                                        </select>
                                        <InputError message={errors.state} className="text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* Botão de Envio */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-[#111111] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors disabled:opacity-70 cursor-pointer"
                                    disabled={processing || selectedIdiomas.length === 0}
                                >
                                    {processing ? 'Verifique os erros ou processando...' : 'Criar minha conta agora'}
                                </button>
                                {selectedIdiomas.length === 0 && !processing && (
                                    <p className="text-center text-xs text-red-500 mt-2 font-medium">Selecione pelo menos um idioma para continuar.</p>
                                )}
                            </div>
                        </form>

                        <div className="pt-6 pb-8 text-center border-t border-gray-100 mt-6">
                            <p className="text-sm font-medium text-gray-600">
                                Já tem uma conta?{' '}
                                <Link
                                    href={route('login')}
                                    className="font-bold text-[#F26522] hover:text-[#d95a1e] transition inline-flex items-center gap-0.5"
                                >
                                    Faça login <span className="text-sm font-normal">→</span>
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}