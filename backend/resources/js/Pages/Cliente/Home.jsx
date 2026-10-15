import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { IoCutOutline } from 'react-icons/io5';
import { MdBrush } from 'react-icons/md';
import { FaSprayCan, FaTooth, FaBriefcaseMedical, FaPaw, FaBalanceScale, FaCalculator, FaDumbbell, FaCar, FaHome } from 'react-icons/fa';
import {
    FiSearch, FiMapPin, FiStar, FiTool, FiChevronLeft, FiChevronRight, FiLoader, FiMap, FiUsers, FiHeart,
    FiClock, FiBell, FiCheckCircle, FiNavigation, FiX, FiTrendingUp,
} from 'react-icons/fi';

const CATEGORIAS = [
    { icone: IoCutOutline, nome: 'Barbeiro', busca: 'barbearia' },
    { icone: FaSprayCan, nome: 'Salão de beleza', busca: 'salao' },
    { icone: MdBrush, nome: 'Manicure', busca: 'manicure' },
    { icone: FaTooth, nome: 'Dentista', busca: 'dentista' },
    { icone: FaBriefcaseMedical, nome: 'Fisioterapia', busca: 'fisioterapia' },
    { icone: FiTool, nome: 'Mecânico', busca: 'mecanica' },
    { icone: FaPaw, nome: 'Pet Shop', busca: 'pet' },
    { icone: FaBalanceScale, nome: 'Advogado', busca: 'advogado' },
    { icone: FaCalculator, nome: 'Contador', busca: 'contador' },
    { icone: FaDumbbell, nome: 'Academia', busca: 'academia' },
    { icone: FaCar, nome: 'Aluguel de carros', busca: 'aluguel-carros' },
    { icone: FaHome, nome: 'Aluguel de casas', busca: 'aluguel-casas' },
];

const MAIS_BUSCADOS = [['Barbeiro', 'barbearia'], ['Dentista', 'dentista'], ['Salão de beleza', 'salao'], ['Mecânico', 'mecanica']];

const RECURSOS = [
    { icone: FiUsers, titulo: 'Fila virtual', texto: 'Entre na fila de onde estiver, sem esperar no local.' },
    { icone: FiClock, titulo: 'Acompanhamento em tempo real', texto: 'Veja sua posição e quanto falta para a sua vez.' },
    { icone: FiBell, titulo: 'Notificações', texto: 'Avisamos quando estiver chegando a sua vez.' },
    { icone: FiStar, titulo: 'Avaliações reais', texto: 'Notas de quem já foi atendido para escolher melhor.' },
];

const CHAVES = { ENDERECO: 'waitless_formatted_address', DADOS: 'waitless_address_data', COORDS: 'waitless_coords' };
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

function lerJSON(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch { return null; }
}

/** Cartão de estabelecimento próximo (padrão da imagem: foto, selo, nota, distância, fila e "Entrar na fila"). */
function CartaoLocal({ local }) {
    const foto = local.foto_banner || local.foto_perfil;
    const abrir = () => router.visit(route('estabelecimentos.loja', local.id));
    return (
        <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <button type="button" onClick={abrir} className="relative aspect-[4/3] overflow-hidden bg-gray-100 text-left">
                {foto ? (
                    <img src={foto} alt={local.nome} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                    <span className="flex h-full w-full items-center justify-center text-4xl font-black text-gray-300">{local.nome.charAt(0)}</span>
                )}
                <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow"><FiHeart /></span>
                {local.foto_perfil && local.foto_banner && (
                    <img src={local.foto_perfil} alt="" className="absolute bottom-2 left-2 h-9 w-9 rounded-lg border-2 border-white object-cover shadow" />
                )}
                {local.premium && <span className="absolute left-2 top-2 rounded-full bg-[#E8590C] px-2 py-0.5 text-[10px] font-black uppercase text-white">Destaque</span>}
            </button>
            <div className="flex flex-1 flex-col p-3">
                <button type="button" onClick={abrir} className="truncate text-left text-sm font-bold text-gray-900 hover:underline">{local.nome}</button>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                        <FiStar className="fill-amber-400 text-amber-400" />
                        {local.avaliacao_media > 0 ? `${local.avaliacao_media.toFixed(1)} (${local.total_avaliacoes})` : 'Novo'}
                    </span>
                    {local.distancia !== null && <span className="inline-flex items-center gap-1"><FiMapPin /> {String(local.distancia).replace('.', ',')} km</span>}
                </div>
                <div className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${local.fila > 0 ? 'bg-orange-50 text-[#E8590C]' : 'bg-emerald-50 text-emerald-700'}`}>
                    <FiUsers /> {local.fila > 0 ? `Fila: ${local.fila} ${local.fila === 1 ? 'pessoa' : 'pessoas'}` : 'Sem fila agora'}
                </div>
                {local.a_partir_de !== null && <p className="mt-1.5 text-[11px] text-gray-400">A partir de <b className="text-gray-700">{brl(local.a_partir_de)}</b></p>}
                <button type="button" onClick={abrir} className="mt-3 w-full rounded-xl bg-[#E8590C] py-2 text-sm font-bold text-white transition hover:bg-[#D9480F]">
                    Entrar na fila
                </button>
            </div>
        </article>
    );
}

export default function Home() {
    const [locais, setLocais] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [endereco, setEndereco] = useState('Buscando sua localização...');
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState({ cep: '', logradouro: '', numero: '', bairro: '', cidadeUf: '' });
    const [erros, setErros] = useState({});
    const [salvando, setSalvando] = useState(false);
    const categoriasRef = useRef(null);
    const busca = useForm({ query: '' });

    const buscarLocais = async (params) => {
        setCarregando(true);
        try {
            const { data } = await axios.get('/api/nearby', { params: { ...params, radius: 15 } });
            setLocais(Array.isArray(data) ? data : []);
        } catch {
            setLocais([]);
        } finally {
            setCarregando(false);
        }
    };

    const usarGps = () => {
        setEditando(false);
        if (!('geolocation' in navigator)) {
            setEndereco('Informe seu endereço para ver os locais perto de você');
            return;
        }
        setCarregando(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                await buscarLocais({ lat: coords.latitude, lng: coords.longitude });
                const texto = 'Sua localização atual';
                setEndereco(texto);
                try {
                    localStorage.setItem(CHAVES.ENDERECO, texto);
                    localStorage.setItem(CHAVES.COORDS, JSON.stringify({ lat: coords.latitude, lng: coords.longitude }));
                    localStorage.removeItem(CHAVES.DADOS);
                } catch { /* sem storage */ }
            },
            () => {
                setEndereco('Informe seu endereço para ver os locais perto de você');
                setCarregando(false);
            },
        );
    };

    useEffect(() => {
        const coords = lerJSON(CHAVES.COORDS);
        const dados = lerJSON(CHAVES.DADOS);
        let texto = null;
        try { texto = localStorage.getItem(CHAVES.ENDERECO); } catch { /* sem storage */ }
        if (coords) {
            setEndereco(texto || 'Sua localização atual');
            buscarLocais({ lat: coords.lat, lng: coords.lng });
        } else if (dados) {
            setEndereco(texto || dados.cidadeUf);
            buscarLocais(dados);
        } else {
            usarGps();
        }
    }, []);

    const pesquisar = (e) => {
        e.preventDefault();
        if (busca.data.query.trim()) busca.get(route('cliente.explorar'));
    };
    const irParaCategoria = (termo) => router.get(route('cliente.explorar'), { query: termo });
    const rolarCategorias = (dir) => categoriasRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

    const mudarCampo = (e) => {
        const { name, value } = e.target;
        if (name === 'cep') {
            const d = value.replace(/\D/g, '').slice(0, 8);
            setForm((f) => ({ ...f, cep: d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }));
            if (d.length === 8) {
                fetch(`https://viacep.com.br/ws/${d}/json/`).then((r) => r.json()).then((r) => {
                    if (!r.erro) setForm((f) => ({ ...f, logradouro: r.logradouro || f.logradouro, bairro: r.bairro || f.bairro, cidadeUf: r.localidade ? `${r.localidade}/${r.uf}` : f.cidadeUf }));
                }).catch(() => {});
            }
            return;
        }
        setForm((f) => ({ ...f, [name]: value.slice(0, 120) }));
        if (erros[name]) setErros((x) => ({ ...x, [name]: null }));
    };

    const salvarEndereco = async (e) => {
        e.preventDefault();
        const novosErros = {};
        if (form.logradouro.trim().length < 5) novosErros.logradouro = 'Informe a rua ou avenida.';
        if (!form.numero.trim()) novosErros.numero = 'Informe o número.';
        if (!form.cidadeUf.trim()) novosErros.cidadeUf = 'Informe a cidade (o CEP preenche sozinho).';
        if (Object.keys(novosErros).length) { setErros(novosErros); return; }

        setSalvando(true);
        const dados = { logradouro: form.logradouro.trim(), numero: form.numero.trim(), bairro: form.bairro.trim(), cidadeUf: form.cidadeUf.trim() };
        try {
            await axios.post('/api/user/update-address', dados).catch(() => {});
            await buscarLocais(dados);
            const texto = `${dados.logradouro}, ${dados.numero}${dados.bairro ? ` - ${dados.bairro}` : ''}`;
            setEndereco(texto);
            setEditando(false);
            try {
                localStorage.setItem(CHAVES.ENDERECO, texto);
                localStorage.setItem(CHAVES.DADOS, JSON.stringify(dados));
                localStorage.removeItem(CHAVES.COORDS);
            } catch { /* sem storage */ }
        } finally {
            setSalvando(false);
        }
    };

    const comFilaCurta = locais.filter((l) => l.fila <= 2).length;
    const campo = 'w-full rounded-xl border-gray-200 text-sm focus:border-[#E8590C] focus:ring-[#E8590C]';

    return (
        <AuthenticatedLayout>
            <Head title="Início" />

            <div className="mx-auto max-w-7xl space-y-8">
                {/* ===== HERO ===== */}
                <section className="grid items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF4EC] via-white to-[#FFF8F3] p-5 sm:p-8 lg:grid-cols-2 lg:p-10">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#E8590C] shadow-sm">
                            <FiClock /> Sem filas. Mais tempo para você
                        </span>
                        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-gray-900 sm:text-4xl xl:text-5xl">
                            Encontre atendimento <span className="text-[#E8590C]">sem filas e sem complicação</span>
                        </h1>
                        <p className="mt-3 max-w-lg text-sm text-gray-600 sm:text-base">
                            Entre na fila virtual ou agende seu horário com praticidade e acompanhe tudo em tempo real.
                        </p>
                        <form onSubmit={pesquisar} className="mt-6 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:flex-row">
                            <label className="flex flex-1 items-center gap-2 px-3">
                                <FiSearch className="shrink-0 text-gray-400" />
                                <input
                                    type="search"
                                    value={busca.data.query}
                                    onChange={(e) => busca.setData('query', e.target.value)}
                                    placeholder="Buscar serviços (ex: barbeiro, dentista, mecânico...)"
                                    className="w-full border-0 bg-transparent py-2.5 text-sm focus:ring-0"
                                />
                            </label>
                            <button type="submit" className="rounded-xl bg-[#E8590C] px-6 py-3 text-sm font-bold text-white hover:bg-[#D9480F]">Buscar</button>
                        </form>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>Mais buscados:</span>
                            {MAIS_BUSCADOS.map(([rotulo, termo]) => (
                                <button key={termo} type="button" onClick={() => irParaCategoria(termo)} className="rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-700 hover:border-[#E8590C] hover:text-[#E8590C]">
                                    {rotulo}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative hidden lg:block">
                        <img src="/images/Home.png" alt="" className="h-[340px] w-full rounded-3xl object-cover shadow-xl" />
                        <div className="absolute -left-4 bottom-6 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FiTrendingUp /></span>
                            <div>
                                <p className="text-lg font-black leading-none text-gray-900">{carregando ? '…' : locais.length}</p>
                                <p className="text-[11px] text-gray-500">locais perto de você</p>
                            </div>
                        </div>
                        <div className="absolute -right-3 top-6 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#E8590C]"><FiClock /></span>
                            <div>
                                <p className="text-lg font-black leading-none text-gray-900">{carregando ? '…' : comFilaCurta}</p>
                                <p className="text-[11px] text-gray-500">com fila curta agora</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===== CATEGORIAS ===== */}
                <section>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-black text-gray-900">Categorias populares</h2>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => rolarCategorias(-1)} className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" aria-label="Anteriores"><FiChevronLeft /></button>
                            <button type="button" onClick={() => rolarCategorias(1)} className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" aria-label="Próximas"><FiChevronRight /></button>
                        </div>
                    </div>
                    <div ref={categoriasRef} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
                        {CATEGORIAS.map((c) => (
                            <button key={c.nome} type="button" onClick={() => irParaCategoria(c.busca)} className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-center shadow-sm transition hover:border-orange-200 hover:shadow">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-lg text-[#E8590C]"><c.icone /></span>
                                <span className="text-[11px] font-semibold leading-tight text-gray-700">{c.nome}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ===== ESTABELECIMENTOS PRÓXIMOS ===== */}
                <section>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Estabelecimentos próximos</h2>
                            {!editando && (
                                <button type="button" onClick={() => setEditando(true)} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900" title="Trocar endereço">
                                    <FiMapPin className="shrink-0 text-[#E8590C]" /> <span className="truncate">{endereco}</span> <FiChevronRight className="shrink-0 rotate-90" />
                                </button>
                            )}
                        </div>
                        <Link href={route('cliente.explorar')} className="text-sm font-bold text-[#E8590C] hover:underline">Ver todos</Link>
                    </div>

                    {editando && (
                        <form onSubmit={salvarEndereco} className="mb-4 grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-6">
                            <div className="flex items-center justify-between sm:col-span-6">
                                <p className="text-sm font-bold text-gray-900">Onde você está?</p>
                                <button type="button" onClick={() => setEditando(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Fechar"><FiX /></button>
                            </div>
                            <label className="text-xs font-semibold text-gray-600 sm:col-span-2">CEP
                                <input name="cep" inputMode="numeric" value={form.cep} onChange={mudarCampo} placeholder="00000-000" className={`mt-1 ${campo}`} autoFocus />
                            </label>
                            <label className="text-xs font-semibold text-gray-600 sm:col-span-4">Rua / avenida
                                <input name="logradouro" value={form.logradouro} onChange={mudarCampo} className={`mt-1 ${campo}`} />
                                {erros.logradouro && <span className="text-red-500">{erros.logradouro}</span>}
                            </label>
                            <label className="text-xs font-semibold text-gray-600 sm:col-span-1">Número
                                <input name="numero" value={form.numero} onChange={mudarCampo} className={`mt-1 ${campo}`} />
                                {erros.numero && <span className="text-red-500">{erros.numero}</span>}
                            </label>
                            <label className="text-xs font-semibold text-gray-600 sm:col-span-2">Bairro
                                <input name="bairro" value={form.bairro} onChange={mudarCampo} className={`mt-1 ${campo}`} />
                            </label>
                            <label className="text-xs font-semibold text-gray-600 sm:col-span-3">Cidade/UF
                                <input name="cidadeUf" value={form.cidadeUf} onChange={mudarCampo} placeholder="Recife/PE" className={`mt-1 ${campo}`} />
                                {erros.cidadeUf && <span className="text-red-500">{erros.cidadeUf}</span>}
                            </label>
                            <div className="flex flex-col gap-2 sm:col-span-6 sm:flex-row sm:justify-end">
                                <button type="button" onClick={usarGps} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
                                    <FiNavigation /> Usar minha localização
                                </button>
                                <button type="submit" disabled={salvando} className="rounded-xl bg-[#E8590C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#D9480F] disabled:opacity-60">
                                    {salvando ? 'Buscando…' : 'Salvar e buscar'}
                                </button>
                            </div>
                        </form>
                    )}

                    {carregando ? (
                        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center text-gray-500 shadow-sm">
                            <FiLoader className="animate-spin text-2xl text-[#E8590C]" />
                            <p className="text-sm font-semibold">Buscando os melhores locais perto de você…</p>
                        </div>
                    ) : locais.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {locais.map((l) => <CartaoLocal key={l.id} local={l} />)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm">
                            <FiMap className="text-3xl text-gray-300" />
                            <p className="font-bold text-gray-800">Não encontramos locais perto deste endereço.</p>
                            <p className="text-sm text-gray-500">Tente outro endereço ou veja todos os locais no Explorar.</p>
                            <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => setEditando(true)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700">Trocar endereço</button>
                                <Link href={route('cliente.explorar')} className="rounded-xl bg-[#E8590C] px-4 py-2 text-sm font-bold text-white">Ir para o Explorar</Link>
                            </div>
                        </div>
                    )}
                </section>

                {/* ===== RECURSOS + PREMIUM ===== */}
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {RECURSOS.map((r) => (
                        <div key={r.titulo} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E8590C]"><r.icone /></span>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{r.titulo}</p>
                                <p className="text-xs text-gray-500">{r.texto}</p>
                            </div>
                        </div>
                    ))}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E8590C] to-[#C2410C] p-4 text-white shadow-sm sm:col-span-2 lg:col-span-1">
                        <p className="text-sm font-black">Lokyva Premium</p>
                        <p className="mt-1 text-xs text-white/85">Use seus pontos em qualquer serviço, tenha acesso a ofertas exclusivas e mais benefícios.</p>
                        <Link href={route('assinatura.status')} className="mt-3 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#E8590C]">
                            <FiCheckCircle /> Conhecer planos
                        </Link>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
