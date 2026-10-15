import InputError from '@/Components/InputError';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import {
    EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, GiftIcon, UserIcon, IdentificationIcon,
    DevicePhoneMobileIcon, CalendarDaysIcon, BriefcaseIcon, AcademicCapIcon, HomeModernIcon,
    ChatBubbleBottomCenterTextIcon, MapPinIcon, ShieldCheckIcon, UserCircleIcon, BuildingStorefrontIcon,
    CheckIcon, SparklesIcon, KeyIcon, LanguageIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';

const LARANJA = '#FF5A00';

const listaIdiomas = [
    'Português (Brasil)', 'Português (Portugal)',
    'Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano', 'Outro',
];

const ufs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO',
];

const BENEFICIOS = [
    'Agende serviços e reserve carros, quartos e espaços em um só lugar',
    'Ganhe pontos em cada reserva e troque por descontos',
    'Pagamento protegido: o valor só é liberado depois do atendimento',
];

const campoBase =
    'block w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition focus:border-[#FF5A00] focus:outline-none focus:ring-4 focus:ring-[#FF5A00]/10';

/** Campo com ícone à esquerda (padrão das telas novas). */
function Campo({ rotulo, icone: Icone, erro, children, className = '' }) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <label className="text-xs font-semibold text-gray-600">{rotulo}</label>
            <div className="relative">
                {Icone && <Icone className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />}
                {children}
            </div>
            <InputError message={erro} className="text-xs" />
        </div>
    );
}

/** Cartão de seção: ícone laranja + título, como "Dados da viagem" e "Resumo do orçamento". */
function Secao({ icone: Icone, titulo, subtitulo, numero, children }) {
    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] sm:p-6">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[#FF5A00]">
                    <Icone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A00]">Etapa {numero}</p>
                    <h4 className="text-base font-bold text-gray-900">{titulo}</h4>
                    {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        // Código de indicação de um amigo (vem do link ?ref=CODIGO); opcional.
        codigo_indicacao: (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
        papel: '',
        person_type: 'FISICA',
        cpf_cnpj: '',
        birth_date: '',
        mobile_phone: '',
        phone: '',
        notification_disabled: false,
        postal_code: '',
        address: '',
        address_number: '',
        complement: '',
        province: '',
        city: '',
        state: '',
        onde_estudei: '',
        onde_moro: '',
        idiomas: '',
        profissao: '',
        sobre_mim: '',
        termo_compromisso_aceito: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [selectedIdiomas, setSelectedIdiomas] = useState([]);
    const [buscandoCep, setBuscandoCep] = useState(false);

    // Pessoa Jurídica só pode se cadastrar como Proprietário (sócio); zera CPF/CNPJ ao mudar o tipo de pessoa
    useEffect(() => {
        if (data.person_type === 'JURIDICA') {
            setData('papel', 'socio');
            setData('birth_date', '');
        }
        setData('cpf_cnpj', '');
    }, [data.person_type]);

    // Atualiza a string de idiomas no useForm sempre que o array local mudar
    useEffect(() => {
        setData('idiomas', selectedIdiomas.join(', '));
    }, [selectedIdiomas]);

    const toggleIdioma = (idioma) => {
        setSelectedIdiomas((atual) => (atual.includes(idioma) ? atual.filter((i) => i !== idioma) : [...atual, idioma]));
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Remove emojis e números
    const cleanText = (text) => text
        .replace(/[0-9]/g, '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    const handleProfissao = (e) => {
        let val = cleanText(e.target.value);
        if (val.length > 0) val = val.charAt(0).toUpperCase() + val.slice(1);
        setData('profissao', val);
    };

    const handleCpfCnpj = (e) => {
        let value = e.target.value.replace(/\D/g, '');
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
        const cep = e.target.value.replace(/\D/g, '');
        setData('postal_code', cep);

        if (cep.length === 8) {
            setBuscandoCep(true);
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
                console.error('Erro ao buscar CEP:', error);
            } finally {
                setBuscandoCep(false);
            }
        }
    };

    // Quanto do cadastro já foi preenchido (barra de progresso no topo).
    const progresso = useMemo(() => {
        const obrigatorios = [
            data.email, data.papel, data.password, data.password_confirmation, data.name, data.cpf_cnpj, data.mobile_phone,
            data.person_type === 'FISICA' ? data.birth_date : 'ok', data.profissao, data.onde_estudei, data.onde_moro,
            data.idiomas, data.sobre_mim, data.postal_code, data.address, data.address_number, data.province, data.city,
            data.state, data.termo_compromisso_aceito ? 'ok' : '',
        ];
        return Math.round((obrigatorios.filter(Boolean).length / obrigatorios.length) * 100);
    }, [data]);

    const perfis = [
        { valor: 'user', titulo: 'Sou cliente', texto: 'Quero agendar serviços e fazer reservas', icone: UserCircleIcon, so: 'FISICA' },
        { valor: 'socio', titulo: 'Sou proprietário', texto: 'Quero anunciar meus serviços, itens e espaços', icone: BuildingStorefrontIcon },
    ].filter((p) => !p.so || p.so === data.person_type);

    const senha = (valor, campo, mostrar, setMostrar, placeholder) => (
        <>
            <input
                type={mostrar ? 'text' : 'password'}
                value={valor}
                className={`${campoBase} pl-11 pr-11`}
                placeholder={placeholder}
                minLength={campo === 'password' ? 8 : undefined}
                onChange={(e) => setData(campo, e.target.value)}
                required
            />
            <button type="button" onClick={() => setMostrar(!mostrar)} className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600" aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}>
                {mostrar ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
        </>
    );

    return (
        <div className="min-h-screen bg-[#F7F7F8] font-sans selection:bg-[#FF5A00] selection:text-white">
            <Head title="Crie sua conta" />

            <div className="mx-auto flex min-h-screen max-w-7xl lg:gap-8 lg:p-6 xl:p-8">
                {/* --- PAINEL ESQUERDO: MARCA --- */}
                <aside className="relative hidden w-5/12 overflow-hidden rounded-[2rem] lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col">
                    <img src="/images/cadastro.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FF5A00]/95 via-[#FF7A1A]/85 to-[#B83A00]/90" />
                    <div className="relative flex h-full flex-col justify-between p-10 text-white">
                        <Link href="/" className="flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg">
                                <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-8 w-8 object-contain" />
                            </span>
                            <span className="text-2xl font-black tracking-tight">Lokyva</span>
                        </Link>

                        <div className="space-y-6">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                                <SparklesIcon className="h-4 w-4" /> Você viaja, a gente conecta o resto
                            </span>
                            <h1 className="text-4xl font-black leading-tight xl:text-5xl">Crie sua conta e comece em poucos minutos</h1>
                            <ul className="space-y-3">
                                {BENEFICIOS.map((b) => (
                                    <li key={b} className="flex items-start gap-3 text-sm text-white/95">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#FF5A00]">
                                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
                                        </span>
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl bg-white/15 p-4 backdrop-blur">
                            <GiftIcon className="h-8 w-8 shrink-0" />
                            <p className="text-sm"><b>Bônus de boas-vindas:</b> clientes novos já começam com 100 pontos.</p>
                        </div>
                    </div>
                </aside>

                {/* --- FORMULÁRIO --- */}
                <main className="w-full px-4 py-6 sm:px-8 lg:w-7/12 lg:px-0 lg:py-0">
                    <div className="mx-auto max-w-2xl space-y-5">
                        <div className="flex items-center justify-between lg:hidden">
                            <Link href="/" className="flex items-center gap-2">
                                <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-9 w-9 object-contain" />
                                <span className="text-lg font-black">Lokyva</span>
                            </Link>
                            <Link href={route('login')} className="text-sm font-bold text-[#FF5A00]">Entrar</Link>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-gray-900">Crie sua conta</h2>
                                <p className="mt-1 text-sm text-gray-500">Preencha seus dados. Leva poucos minutos e é tudo protegido.</p>
                            </div>
                            <div>
                                <div className="mb-1.5 flex justify-between text-xs font-semibold">
                                    <span className="text-gray-500">Cadastro preenchido</span>
                                    <span className="text-[#FF5A00]">{progresso}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                                    <div className="h-full rounded-full bg-[#FF5A00] transition-all duration-500" style={{ width: `${progresso}%` }} />
                                </div>
                            </div>
                        </div>

                        {Object.keys(errors).length > 0 && (
                            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                                Encontramos um erro no cadastro. Verifique as informações destacadas abaixo.
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            {/* ETAPA 1: PERFIL E ACESSO */}
                            <Secao numero={1} icone={KeyIcon} titulo="Perfil e acesso" subtitulo="Como você vai usar a Lokyva e seus dados de login">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600">Tipo de pessoa</label>
                                        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                                            {[['FISICA', 'Pessoa física (CPF)'], ['JURIDICA', 'Pessoa jurídica (CNPJ)']].map(([valor, rotulo]) => (
                                                <button
                                                    key={valor}
                                                    type="button"
                                                    onClick={() => setData('person_type', valor)}
                                                    className={`rounded-xl py-2.5 text-sm font-bold transition ${data.person_type === valor ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    {rotulo}
                                                </button>
                                            ))}
                                        </div>
                                        <InputError message={errors.person_type} className="text-xs" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600">Como você vai usar</label>
                                        <div className={`grid gap-3 ${perfis.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                                            {perfis.map((p) => {
                                                const ativo = data.papel === p.valor;
                                                const Icone = p.icone;
                                                return (
                                                    <button
                                                        key={p.valor}
                                                        type="button"
                                                        onClick={() => setData('papel', p.valor)}
                                                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${ativo ? 'border-[#FF5A00] bg-[#FFF6F1] ring-4 ring-[#FF5A00]/10' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                                    >
                                                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ativo ? 'bg-[#FF5A00] text-white' : 'bg-[#FFF1E8] text-[#FF5A00]'}`}>
                                                            <Icone className="h-6 w-6" />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-bold text-gray-900">{p.titulo}</span>
                                                            <span className="block text-xs text-gray-500">{p.texto}</span>
                                                        </span>
                                                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${ativo ? 'border-[#FF5A00] bg-[#FF5A00]' : 'border-gray-300'}`}>
                                                            {ativo && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <InputError message={errors.papel} className="text-xs" />
                                    </div>

                                    {data.papel === 'socio' && (
                                        <div className="space-y-2 rounded-2xl bg-[#FFF6F1] p-4 text-xs text-[#8A3200]">
                                            <p className="text-sm font-bold">Tem CNPJ? Veja o que muda</p>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl bg-white p-3">
                                                    <p className="font-bold text-gray-900">Sem CNPJ</p>
                                                    <p className="text-gray-600">Você usa a Lokyva normalmente. O cliente paga no local.</p>
                                                </div>
                                                <div className="rounded-xl bg-white p-3">
                                                    <p className="font-bold text-gray-900">Com CNPJ (MEI serve)</p>
                                                    <p className="text-gray-600">Você recebe pagamento online (Pix, cartão e boleto), tem carteira e aparece antes nas buscas.</p>
                                                </div>
                                            </div>
                                            <p>Pode começar sem CNPJ e cadastrar depois.</p>
                                        </div>
                                    )}

                                    <Campo rotulo="E-mail" icone={EnvelopeIcon} erro={errors.email}>
                                        <input type="email" value={data.email} className={`${campoBase} pl-11 pr-4`} placeholder="seu@email.com" onChange={(e) => setData('email', e.target.value)} required />
                                    </Campo>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Campo rotulo="Senha" icone={LockClosedIcon} erro={errors.password}>
                                            {senha(data.password, 'password', showPassword, setShowPassword, 'Mínimo de 8 caracteres')}
                                        </Campo>
                                        <Campo rotulo="Confirmar senha" icone={LockClosedIcon} erro={errors.password_confirmation}>
                                            {senha(data.password_confirmation, 'password_confirmation', showConfirmPassword, setShowConfirmPassword, 'Repita a senha')}
                                        </Campo>
                                    </div>

                                    <Campo rotulo="Código de indicação (opcional)" icone={GiftIcon} erro={errors.codigo_indicacao}>
                                        <input
                                            type="text"
                                            value={data.codigo_indicacao}
                                            maxLength={12}
                                            className={`${campoBase} pl-11 pr-4 uppercase tracking-widest`}
                                            placeholder="Código de um amigo: vocês dois ganham pontos"
                                            onChange={(e) => setData('codigo_indicacao', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                        />
                                    </Campo>
                                </div>
                            </Secao>

                            {/* ETAPA 2: DADOS CADASTRAIS */}
                            <Secao numero={2} icone={IdentificationIcon} titulo="Seus dados" subtitulo="Usados para pagamentos, contratos e para te identificar">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Campo rotulo={data.person_type === 'JURIDICA' ? 'Razão social' : 'Nome completo'} icone={UserIcon} erro={errors.name} className="sm:col-span-2">
                                        <input type="text" value={data.name} className={`${campoBase} pl-11 pr-4`} placeholder={data.person_type === 'JURIDICA' ? 'Nome da empresa' : 'Seu nome completo'} onChange={(e) => setData('name', e.target.value)} required />
                                    </Campo>

                                    <Campo rotulo={data.person_type === 'FISICA' ? 'CPF' : 'CNPJ'} icone={IdentificationIcon} erro={errors.cpf_cnpj}>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={data.cpf_cnpj}
                                            className={`${campoBase} pl-11 pr-4`}
                                            placeholder={data.person_type === 'FISICA' ? '000.000.000-00' : '00.000.000/0000-00'}
                                            maxLength={data.person_type === 'FISICA' ? 14 : 18}
                                            onChange={handleCpfCnpj}
                                            required
                                        />
                                    </Campo>

                                    <Campo rotulo="Celular (com DDD)" icone={DevicePhoneMobileIcon} erro={errors.mobile_phone}>
                                        <input type="text" inputMode="numeric" value={data.mobile_phone} className={`${campoBase} pl-11 pr-4`} placeholder="Ex: 81999999999" maxLength={11} onChange={(e) => setData('mobile_phone', e.target.value.replace(/\D/g, ''))} required />
                                    </Campo>

                                    {data.person_type === 'FISICA' && (
                                        <Campo rotulo="Data de nascimento" icone={CalendarDaysIcon} erro={errors.birth_date}>
                                            <input type="date" value={data.birth_date} max={new Date().toISOString().split('T')[0]} className={`${campoBase} pl-11 pr-4`} onChange={(e) => setData('birth_date', e.target.value)} required />
                                        </Campo>
                                    )}

                                    <Campo rotulo="Profissão" icone={BriefcaseIcon} erro={errors.profissao}>
                                        <input type="text" value={data.profissao} className={`${campoBase} pl-11 pr-4`} placeholder="Ex: Engenheiro" onChange={handleProfissao} required />
                                    </Campo>
                                </div>
                            </Secao>

                            {/* ETAPA 3: SOBRE VOCÊ */}
                            <Secao numero={3} icone={ChatBubbleBottomCenterTextIcon} titulo="Sobre você" subtitulo="Aparece no seu perfil e ajuda anfitriões e clientes a te conhecer">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Campo rotulo="Onde estudei" icone={AcademicCapIcon} erro={errors.onde_estudei}>
                                        <input type="text" value={data.onde_estudei} className={`${campoBase} pl-11 pr-4`} placeholder="Escola, faculdade, etc." onChange={(e) => setData('onde_estudei', cleanText(e.target.value))} required />
                                    </Campo>

                                    <Campo rotulo="Onde moro" icone={HomeModernIcon} erro={errors.onde_moro}>
                                        <select value={data.onde_moro} className={`${campoBase} pl-11 pr-10`} onChange={(e) => setData('onde_moro', e.target.value)} required>
                                            <option value="" disabled hidden>Selecione</option>
                                            <option value="Casa">Casa</option>
                                            <option value="Apartamento">Apartamento</option>
                                            <option value="Sítio">Sítio / Chácara</option>
                                            <option value="Flat">Flat / Studio</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </Campo>

                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                                            <LanguageIcon className="h-4 w-4 text-gray-400" /> Idiomas que falo
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {listaIdiomas.map((idioma) => {
                                                const ativo = selectedIdiomas.includes(idioma);
                                                return (
                                                    <button
                                                        key={idioma}
                                                        type="button"
                                                        onClick={() => toggleIdioma(idioma)}
                                                        className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${ativo ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#FF5A00] hover:text-[#FF5A00]'}`}
                                                    >
                                                        {ativo && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
                                                        {idioma}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <input type="hidden" value={data.idiomas} required />
                                        <InputError message={errors.idiomas} className="text-xs" />
                                    </div>

                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-xs font-semibold text-gray-600">Sobre mim</label>
                                        <div className="relative">
                                            <textarea
                                                value={data.sobre_mim}
                                                rows="4"
                                                maxLength={1000}
                                                className={`${campoBase} resize-none px-4`}
                                                placeholder="Conte um pouco sobre você, seus interesses..."
                                                onChange={(e) => setData('sobre_mim', e.target.value)}
                                                required
                                            />
                                            <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-gray-400">{data.sobre_mim.length}/1000</span>
                                        </div>
                                        <InputError message={errors.sobre_mim} className="text-xs" />
                                    </div>
                                </div>
                            </Secao>

                            {/* ETAPA 4: ENDEREÇO */}
                            <Secao numero={4} icone={MapPinIcon} titulo="Endereço" subtitulo="Digite o CEP e completamos o resto para você">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                                    <Campo rotulo="CEP" icone={MapPinIcon} erro={errors.postal_code} className="sm:col-span-2">
                                        <input type="text" inputMode="numeric" value={data.postal_code} className={`${campoBase} pl-11 pr-4`} placeholder="Só números" maxLength={8} onChange={handleCepChange} required />
                                        {buscandoCep && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#FF5A00]">Buscando…</span>}
                                    </Campo>

                                    <Campo rotulo="Rua / logradouro" erro={errors.address} className="sm:col-span-4">
                                        <input type="text" value={data.address} className={`${campoBase} px-4`} onChange={(e) => setData('address', e.target.value)} required />
                                    </Campo>

                                    <Campo rotulo="Número" erro={errors.address_number} className="sm:col-span-2">
                                        <input type="text" value={data.address_number} className={`${campoBase} px-4`} onChange={(e) => setData('address_number', e.target.value)} required />
                                    </Campo>

                                    <Campo rotulo="Complemento (opcional)" erro={errors.complement} className="sm:col-span-4">
                                        <input type="text" value={data.complement} className={`${campoBase} px-4`} placeholder="Apto, bloco, referência" onChange={(e) => setData('complement', e.target.value)} />
                                    </Campo>

                                    <Campo rotulo="Bairro" erro={errors.province} className="sm:col-span-2">
                                        <input type="text" value={data.province} className={`${campoBase} px-4`} onChange={(e) => setData('province', e.target.value)} required />
                                    </Campo>

                                    <Campo rotulo="Cidade" erro={errors.city} className="sm:col-span-3">
                                        <input type="text" value={data.city} className={`${campoBase} px-4`} onChange={(e) => setData('city', e.target.value)} required />
                                    </Campo>

                                    <Campo rotulo="UF" erro={errors.state} className="sm:col-span-1">
                                        <select value={data.state} className={`${campoBase} px-3`} onChange={(e) => setData('state', e.target.value)} required>
                                            <option value="" disabled hidden>UF</option>
                                            {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                                        </select>
                                    </Campo>
                                </div>
                            </Secao>

                            {/* PREFERÊNCIAS E TERMO */}
                            <section className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] sm:p-6">
                                <label className="flex cursor-pointer select-none items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={data.notification_disabled}
                                        onChange={(e) => setData('notification_disabled', e.target.checked)}
                                        className="mt-0.5 h-5 w-5 rounded-md border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]"
                                    />
                                    <span className="text-sm text-gray-600">Não desejo receber e-mails/SMS de cobrança do parceiro de pagamentos sobre minhas faturas.</span>
                                </label>
                                <InputError message={errors.notification_disabled} className="text-xs" />

                                <label className="flex cursor-pointer select-none items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={data.termo_compromisso_aceito}
                                        onChange={(e) => setData('termo_compromisso_aceito', e.target.checked)}
                                        className="mt-0.5 h-5 w-5 rounded-md border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]"
                                    />
                                    <span className="text-sm text-gray-600">
                                        Li e aceito o{' '}
                                        <Link href={route('legal.termos')} target="_blank" className="font-bold text-[#FF5A00] hover:underline">Termo de Compromisso</Link>{' '}
                                        da Lokyva.
                                    </span>
                                </label>
                                <InputError message={errors.termo_compromisso_aceito} className="text-xs" />
                            </section>

                            <div className="flex items-center gap-3 rounded-2xl bg-[#FFF6F1] p-4">
                                <ShieldCheckIcon className="h-6 w-6 shrink-0" style={{ color: LARANJA }} />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Seus dados estão protegidos</p>
                                    <p className="text-xs text-gray-600">Usamos suas informações só para sua conta, seus pagamentos e contratos.</p>
                                </div>
                            </div>

                            <div className="space-y-2 pb-2">
                                <button
                                    type="submit"
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF5A00] px-4 py-4 text-base font-bold text-white shadow-[0_10px_25px_-8px_rgba(255,90,0,0.6)] transition hover:bg-[#E85200] focus:outline-none focus:ring-4 focus:ring-[#FF5A00]/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={processing || selectedIdiomas.length === 0 || !data.termo_compromisso_aceito}
                                >
                                    <LockClosedIcon className="h-5 w-5" />
                                    {processing ? 'Criando sua conta…' : 'Criar minha conta'}
                                    {!processing && <ArrowRightIcon className="h-5 w-5" />}
                                </button>
                                {selectedIdiomas.length === 0 && !processing && (
                                    <p className="text-center text-xs font-medium text-red-500">Selecione pelo menos um idioma para continuar.</p>
                                )}
                                {selectedIdiomas.length > 0 && !data.termo_compromisso_aceito && !processing && (
                                    <p className="text-center text-xs font-medium text-red-500">Você precisa aceitar o Termo de Compromisso para continuar.</p>
                                )}
                            </div>
                        </form>

                        <p className="pb-10 text-center text-sm font-medium text-gray-600">
                            Já tem uma conta?{' '}
                            <Link href={route('login')} className="inline-flex items-center gap-1 font-bold text-[#FF5A00] hover:text-[#E85200]">
                                Entrar <ArrowRightIcon className="h-4 w-4" />
                            </Link>
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
