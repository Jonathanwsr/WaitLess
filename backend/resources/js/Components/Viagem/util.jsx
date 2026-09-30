import {
    HomeModernIcon, TruckIcon, SparklesIcon, MapPinIcon, ClockIcon, StarIcon,
} from '@heroicons/react/24/solid';

export const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const parseDia = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`) : null);
export const fmtDia = (d, opts = { day: '2-digit', month: 'short' }) => (d ? parseDia(d).toLocaleDateString('pt-BR', opts) : '');
export const fmtDiaLongo = (d) => fmtDia(d, { weekday: 'long', day: '2-digit', month: 'long' });
export const fmtHora = (h) => (h ? String(h).slice(0, 5) : '');
export const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export const TIPOS = {
    hospedagem: { nome: 'Hospedagem', icone: HomeModernIcon, cor: 'bg-indigo-50 text-indigo-600' },
    transporte: { nome: 'Veículo', icone: TruckIcon, cor: 'bg-sky-50 text-sky-600' },
    servico: { nome: 'Serviço', icone: SparklesIcon, cor: 'bg-orange-50 text-[#FF5A00]' },
    atracao: { nome: 'Passeio', icone: MapPinIcon, cor: 'bg-emerald-50 text-emerald-600' },
    livre: { nome: 'Tempo livre', icone: ClockIcon, cor: 'bg-gray-100 text-gray-500' },
    personalizado: { nome: 'Compromisso', icone: StarIcon, cor: 'bg-amber-50 text-amber-600' },
};

export const STATUS_ITEM = {
    sugerido: { texto: 'Sugerido', classe: 'bg-gray-100 text-gray-600' },
    reservado: { texto: 'Reservado', classe: 'bg-amber-50 text-amber-700' },
    confirmado: { texto: 'Confirmado', classe: 'bg-green-50 text-green-700' },
    cancelado: { texto: 'Cancelado', classe: 'bg-red-50 text-red-700' },
};

export const PRESENCA = {
    confirmado: { texto: 'Vou', classe: 'bg-green-50 text-green-700 border-green-200' },
    talvez: { texto: 'Talvez', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    recusado: { texto: 'Não vou', classe: 'bg-red-50 text-red-700 border-red-200' },
    pendente: { texto: 'Aguardando', classe: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** Mensagem de erro amigável a partir de uma resposta do axios. */
export const erroDe = (e) =>
    e?.response?.data?.erro
    || Object.values(e?.response?.data?.errors || {})[0]?.[0]
    || e?.response?.data?.message
    || 'Não conseguimos concluir agora. Tente novamente em instantes.';

export const inputClasse = 'w-full rounded-xl border-gray-200 focus:border-[#FF5A00] focus:ring-[#FF5A00] text-sm';

export function Aviso({ aviso, onFechar }) {
    if (!aviso) return null;
    const ok = aviso.tipo === 'ok';
    return (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold flex items-start justify-between gap-3 ${ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={onFechar} className="opacity-60 hover:opacity-100">✕</button>
        </div>
    );
}

/** Agrupa itens por dia; hospedagem/veículo (com data_fim) ficam num bloco "Durante toda a viagem". */
export function agruparPorDia(itens) {
    const fixos = itens.filter((i) => ['hospedagem', 'transporte'].includes(i.tipo) && i.data_fim && i.data_fim !== i.dia);
    const porDia = {};
    itens.filter((i) => !fixos.includes(i)).forEach((i) => {
        const chave = i.dia || 'sem-data';
        (porDia[chave] = porDia[chave] || []).push(i);
    });
    Object.values(porDia).forEach((lista) => lista.sort((a, b) => (a.hora_inicio || '99').localeCompare(b.hora_inicio || '99') || a.ordem - b.ordem));
    const dias = Object.keys(porDia).sort();
    return { fixos, dias: dias.map((d) => ({ dia: d, itens: porDia[d] })) };
}
