import { Link } from '@inertiajs/react';
import {
    UserGroupIcon, BookOpenIcon, MapIcon, HomeModernIcon, TruckIcon, SparklesIcon, MapPinIcon,
    BuildingStorefrontIcon, PencilSquareIcon, BoltIcon, StarIcon,
} from '@heroicons/react/24/solid';

export { fmt, fmtDia, fmtDiaLongo } from '@/Components/Viagem/util';

/** Abas da área de Planejamento de Viagem (as viagens em grupo continuam iguais; Guia e Roteiros foram acrescentados). */
export function AbasPlanejamento({ ativa }) {
    const abas = [
        { id: 'viagens', rotulo: 'Viagens em grupo', href: route('viagens.index'), icone: UserGroupIcon },
        { id: 'guia', rotulo: 'Guia do Local', href: route('viagens.guia'), icone: BookOpenIcon },
        { id: 'roteiros', rotulo: 'Meus Roteiros', href: route('viagens.roteiros'), icone: MapIcon },
    ];
    return (
        <nav aria-label="Planejamento de viagem" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex min-w-full gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-gray-100 sm:min-w-0">
                {abas.map((a) => (
                    <Link
                        key={a.id}
                        href={a.href}
                        aria-current={ativa === a.id ? 'page' : undefined}
                        className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition sm:flex-none ${ativa === a.id ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <a.icone className="h-4 w-4" /> {a.rotulo}
                    </Link>
                ))}
            </div>
        </nav>
    );
}

export const CATEGORIAS = {
    hospedagem: { rotulo: 'Hospedagem', icone: HomeModernIcon, cor: 'bg-indigo-50 text-indigo-700' },
    restaurantes: { rotulo: 'Restaurantes e bares', icone: BuildingStorefrontIcon, cor: 'bg-rose-50 text-rose-700' },
    passeios: { rotulo: 'Passeios e experiências', icone: SparklesIcon, cor: 'bg-emerald-50 text-emerald-700' },
    veiculos: { rotulo: 'Veículos', icone: TruckIcon, cor: 'bg-sky-50 text-sky-700' },
    bem_estar: { rotulo: 'Spa, beleza e bem-estar', icone: SparklesIcon, cor: 'bg-fuchsia-50 text-fuchsia-700' },
    servicos: { rotulo: 'Outros serviços', icone: StarIcon, cor: 'bg-amber-50 text-amber-700' },
    espacos: { rotulo: 'Espaços e equipamentos', icone: MapPinIcon, cor: 'bg-gray-100 text-gray-700' },
    ponto_turistico: { rotulo: 'Ponto turístico', icone: MapPinIcon, cor: 'bg-orange-50 text-[#E8590C]' },
    anotacao: { rotulo: 'Anotação', icone: PencilSquareIcon, cor: 'bg-yellow-50 text-yellow-700' },
};

export const INTERESSES = [
    ['praia', 'Praia', '🏖️'], ['natureza', 'Natureza', '🌿'], ['gastronomia', 'Gastronomia', '🍽️'], ['cultura', 'Cultura', '🏛️'],
    ['aventura', 'Aventura', '🧗'], ['compras', 'Compras', '🛍️'], ['vida_noturna', 'Vida noturna', '🌙'], ['pet', 'Viagem com pet', '🐾'],
];

export const PERIODOS = [['manha', 'Manhã', '☀️'], ['tarde', 'Tarde', '🌤️'], ['noite', 'Noite', '🌙']];

/** Link para a tela da locação no Lokyva. */
export const linkLocacao = (tipo, id) => (tipo === 'servico' ? route('cliente.servicos.show', id) : `/itens/${id}/detalhes`);

/** Erro amigável de qualquer resposta (validação, 403, 404 com "mensagem"…). */
export const erroAmigavel = (e) =>
    Object.values(e?.response?.data?.errors || {})[0]?.[0]
    || e?.response?.data?.mensagem
    || (e?.response?.status === 429 ? 'Muitas buscas seguidas. Espere um minutinho e tente de novo.' : null)
    || (e?.response?.status === 403 ? 'Você não tem acesso a este roteiro.' : null)
    || 'Não conseguimos concluir agora. Verifique a internet e tente de novo.';

export function SeloRanking({ l }) {
    return (
        <div className="flex flex-wrap gap-1">
            {l.destaque_premium && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800">Premium</span>}
            {l.aceita_pontos && <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-violet-800">Aceita pontos</span>}
            {l.flash_deal && <span className="inline-flex items-center gap-0.5 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-700"><BoltIcon className="h-3 w-3" /> -{l.flash_deal.percentual}%</span>}
        </div>
    );
}

/** Cartão de uma locação do Lokyva (Guia do Local e sugestões do roteiro). */
export function CartaoLocacao({ l, acao }) {
    const Icone = (CATEGORIAS[l.categoria] || CATEGORIAS.servicos).icone;
    return (
        <article className="group flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="relative aspect-[16/10] bg-gray-100">
                {l.foto
                    ? <img src={l.foto} alt={l.titulo} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-gray-300"><Icone className="h-10 w-10" /></div>}
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-gray-700 shadow">{Number(l.distancia_km).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</span>
            </div>
            <div className="flex flex-1 flex-col p-3">
                <SeloRanking l={l} />
                <h4 className="mt-1 line-clamp-2 text-sm font-black text-gray-900">{l.titulo}</h4>
                {l.local?.nome && <p className="truncate text-xs text-gray-500">{l.local.nome}</p>}
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div>
                        {l.tem_promocao && <span className="block text-[11px] text-gray-400 line-through">{Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                        <span className="text-sm font-black text-gray-900">{Number(l.valor_com_promocao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span className="text-[11px] text-gray-500"> {l.unidade}</span>
                    </div>
                    {acao}
                </div>
            </div>
        </article>
    );
}

export function Skeleton({ className = '' }) {
    return <div className={`animate-pulse rounded-2xl bg-gray-200/70 ${className}`} aria-hidden="true" />;
}

/** Pede a localização só quando o usuário toca no botão, explicando antes para que serve. */
export function pedirLocalizacao() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Seu navegador não oferece localização. Busque pelo nome do lugar.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => reject(new Error('Não conseguimos sua localização. Você pode buscar pelo nome da cidade ou do ponto turístico.')),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
    });
}
