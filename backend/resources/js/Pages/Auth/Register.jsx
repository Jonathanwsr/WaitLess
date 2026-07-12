import InputError from '@/Components/InputError';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        papel: '',
        // Novos campos
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
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Preenchimento automático de Endereço via CEP
    const handleCepChange = async (e) => {
        let cep = e.target.value.replace(/\D/g, ''); // Remove tudo que não for número
        setData('postal_code', cep);

        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const result = await response.json();

                if (!result.erro) {
                    setData((prevData) => ({
                        ...prevData,
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

    // Estados Brasileiros (26 + DF)
    const ufs = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
        "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
        "SP", "SE", "TO"
    ];

    return (
        <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
            <Head title="Crie sua conta - Waitless" />

            <div className="w-full max-w-6xl bg-white rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-[750px] max-h-[95vh]">
                
                {/* --- PAINEL ESQUERDO: IMAGEM --- */}
                <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gray-100 border-r border-gray-100">
                    <img 
                        src="/images/cadastro.png" 
                        alt="Fundo de Cadastro Waitless" 
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                </div>

                {/* --- PAINEL DIREITO: FORMULÁRIO --- */}
                <div className="w-full lg:w-7/12 flex flex-col px-6 py-8 sm:px-10 md:px-12 bg-white overflow-y-auto">
                    <div className="max-w-2xl w-full mx-auto space-y-6">
                        
                        {/* Cabeçalho */}
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl shadow-sm text-white font-black text-xl">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Waitless</h2>
                                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Simplifique. Agende. Conquiste.</p>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-4">Crie sua conta</h3>
                        </div>

                        <form onSubmit={submit} className="space-y-6">
                            
                            {/* SEÇÃO 1: ACESSO */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Dados de Acesso</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">E-mail</label>
                                        <input
                                            type="email"
                                            value={data.email}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="seu@email.com"
                                            onChange={(e) => setData('email', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.email} className="text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Usuário</label>
                                        <select
                                            value={data.papel}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            onChange={(e) => setData('papel', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled hidden>Selecione</option>
                                            <option value="user">Cliente</option>
                                            <option value="socio">Proprietário</option>
                                            <option value="atendente">Funcionário</option>
                                        </select>
                                        <InputError message={errors.papel} className="text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Senha</label>
                                        <input
                                            type="password"
                                            value={data.password}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="••••••••"
                                            minLength={8}
                                            onChange={(e) => setData('password', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.password} className="text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Confirmar Senha</label>
                                        <input
                                            type="password"
                                            value={data.password_confirmation}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="••••••••"
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.password_confirmation} className="text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 2: DADOS PESSOAIS/EMPRESA */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Dados Cadastrais</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Nome Completo / Razão Social</label>
                                        <input
                                            type="text"
                                            value={data.name}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="Seu nome"
                                            onChange={(e) => setData('name', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.name} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Pessoa</label>
                                        <select
                                            value={data.person_type}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            onChange={(e) => setData('person_type', e.target.value)}
                                        >
                                            <option value="FISICA">Pessoa Física</option>
                                            <option value="JURIDICA">Pessoa Jurídica</option>
                                        </select>
                                        <InputError message={errors.person_type} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">CPF ou CNPJ</label>
                                        <input
                                            type="text"
                                            value={data.cpf_cnpj}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="Apenas números"
                                            maxLength={18}
                                            onChange={(e) => setData('cpf_cnpj', e.target.value.replace(/\D/g, ''))}
                                            required
                                        />
                                        <InputError message={errors.cpf_cnpj} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Celular (com DDD)</label>
                                        <input
                                            type="text"
                                            value={data.mobile_phone}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="Ex: 81999999999"
                                            maxLength={11}
                                            onChange={(e) => setData('mobile_phone', e.target.value.replace(/\D/g, ''))}
                                            required
                                        />
                                        <InputError message={errors.mobile_phone} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Telefone Fixo (Opcional)</label>
                                        <input
                                            type="text"
                                            value={data.phone}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            placeholder="Ex: 8133333333"
                                            maxLength={11}
                                            onChange={(e) => setData('phone', e.target.value.replace(/\D/g, ''))}
                                        />
                                        <InputError message={errors.phone} className="text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 3: ENDEREÇO */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Endereço</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1 sm:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">CEP</label>
                                        <input
                                            type="text"
                                            value={data.postal_code}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
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
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
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
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
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
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            onChange={(e) => setData('complement', e.target.value)}
                                        />
                                        <InputError message={errors.complement} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Bairro</label>
                                        <input
                                            type="text"
                                            value={data.province}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
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
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                            onChange={(e) => setData('city', e.target.value)}
                                            required
                                        />
                                        <InputError message={errors.city} className="text-xs" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">UF</label>
                                        <select
                                            value={data.state}
                                            className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
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
                                    className="w-full py-3.5 px-4 bg-black hover:bg-slate-900 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition-all duration-150 disabled:opacity-50"
                                    disabled={processing}
                                >
                                    {processing ? 'Processando cadastro...' : 'Criar minha conta agora'}
                                </button>
                            </div>
                        </form>

                        <div className="pt-4 pb-8 text-center">
                            <p className="text-xs font-medium text-gray-500">
                                Já tem uma conta?{' '}
                                <Link
                                    href={route('login')}
                                    className="font-bold text-[#10B981] hover:text-emerald-600 transition inline-flex items-center gap-0.5"
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