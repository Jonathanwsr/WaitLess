import { useMemo, useState } from 'react';
import {
    BuildingStorefrontIcon, Squares2X2Icon, ScissorsIcon, KeyIcon, MagnifyingGlassIcon, CheckCircleIcon, EyeIcon,
} from '@heroicons/react/24/solid';

const OPCOES = [
    { modo: 'loja', titulo: 'Só na loja', texto: 'Venda avulsa. Não aparece como adicional.', icone: BuildingStorefrontIcon, cor: 'text-gray-600 bg-gray-100' },
    { modo: 'local', titulo: 'Em todo o local', texto: 'Oferecido em qualquer serviço ou reserva deste local.', icone: Squares2X2Icon, cor: 'text-indigo-600 bg-indigo-50' },
    { modo: 'servico', titulo: 'Em um serviço', texto: 'Só quando o cliente agenda o serviço escolhido.', icone: ScissorsIcon, cor: 'text-[#FF5A00] bg-orange-50' },
    { modo: 'reserva', titulo: 'Em uma reserva', texto: 'Só em uma reserva (casa, carro, quadra, equipamento…).', icone: KeyIcon, cor: 'text-emerald-600 bg-emerald-50' },
];

export const modoInicial = (p) => {
    if (!(p?.atrelado_reservas == 1 || p?.atrelado_reservas === true) && !p?.servico_id && !p?.aluguel_id) return 'loja';
    if (p?.servico_id) return 'servico';
    if (p?.aluguel_id) return 'reserva';
    return 'local';
};

/**
 * "Onde este produto aparece?" — escolha clara do vínculo do produto, com busca e prévia do que o cliente vê.
 * onChange({ vinculo_modo, servico_id, aluguel_id, atrelado_reservas })
 */
export default function VinculoProduto({ modo, servicoId, aluguelId, servicos = [], reservas = [], estabelecimentoId, nomeProduto, onChange }) {
    const [busca, setBusca] = useState('');
    const servicosDoLocal = servicos.filter((s) => !s.estabelecimento_id || String(s.estabelecimento_id) === String(estabelecimentoId));
    const reservasDoLocal = reservas.filter((r) => r.avulsa || !r.estabelecimento_id || String(r.estabelecimento_id) === String(estabelecimentoId));

    const lista = useMemo(() => {
        const base = modo === 'servico' ? servicosDoLocal : modo === 'reserva' ? reservasDoLocal : [];
        const termo = busca.trim().toLowerCase();
        return termo ? base.filter((x) => x.nome.toLowerCase().includes(termo)) : base;
    }, [modo, busca, servicos, reservas, estabelecimentoId]);

    const escolhido = modo === 'servico' ? servicosDoLocal.find((s) => String(s.id) === String(servicoId))
        : modo === 'reserva' ? reservasDoLocal.find((r) => String(r.id) === String(aluguelId)) : null;

    const mudar = (novo) => onChange({
        vinculo_modo: novo.modo ?? modo,
        atrelado_reservas: (novo.modo ?? modo) !== 'loja',
        servico_id: (novo.modo ?? modo) === 'servico' ? (novo.servico_id ?? servicoId ?? '') : '',
        aluguel_id: (novo.modo ?? modo) === 'reserva' ? (novo.aluguel_id ?? aluguelId ?? '') : '',
    });

    const previa = {
        loja: 'Aparece só na sua loja, para compra avulsa.',
        local: 'Aparece como adicional em todos os serviços e reservas deste local.',
        servico: escolhido ? `Ao agendar "${escolhido.nome}", o cliente vê: "Leve junto: ${nomeProduto || 'este produto'}".` : 'Escolha o serviço abaixo.',
        reserva: escolhido ? `Ao reservar "${escolhido.nome}", o cliente vê: "Leve junto: ${nomeProduto || 'este produto'}".` : 'Escolha a reserva abaixo.',
    }[modo];

    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-lg font-bold text-gray-900">Onde este produto aparece?</h4>
                <p className="text-sm text-gray-500">Escolha se ele é vendido sozinho ou oferecido como adicional para o cliente na hora de agendar ou reservar.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Onde este produto aparece">
                {OPCOES.map((o) => {
                    const on = modo === o.modo;
                    const desabilitado = (o.modo === 'servico' && servicosDoLocal.length === 0) || (o.modo === 'reserva' && reservasDoLocal.length === 0);
                    return (
                        <button key={o.modo} type="button" role="radio" aria-checked={on} disabled={desabilitado} onClick={() => mudar({ modo: o.modo })}
                            className={`flex min-h-[72px] items-start gap-3 rounded-2xl border-2 bg-white p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-[#FF5A00] shadow-md ring-4 ring-orange-50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${o.cor}`}><o.icone className="h-5 w-5" /></span>
                            <span className="flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-black text-gray-900">{o.titulo} {on && <CheckCircleIcon className="h-4 w-4 text-[#FF5A00]" />}</span>
                                <span className="block text-xs leading-relaxed text-gray-500">{desabilitado ? (o.modo === 'servico' ? 'Cadastre um serviço neste local primeiro.' : 'Cadastre uma reserva primeiro.') : o.texto}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {(modo === 'servico' || modo === 'reserva') && (
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-50 px-3">
                        <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                        <span className="sr-only">Buscar</span>
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={modo === 'servico' ? 'Buscar serviço…' : 'Buscar reserva…'} className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0" />
                    </label>
                    <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto" role="listbox">
                        {lista.length === 0 && <li className="p-3 text-center text-sm text-gray-400">Nada encontrado.</li>}
                        {lista.map((x) => {
                            const on = String(x.id) === String(modo === 'servico' ? servicoId : aluguelId);
                            return (
                                <li key={x.id}>
                                    <button type="button" role="option" aria-selected={on} onClick={() => mudar(modo === 'servico' ? { servico_id: x.id } : { aluguel_id: x.id })}
                                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm transition ${on ? 'bg-orange-50 font-bold text-[#C2410C]' : 'hover:bg-gray-50'}`}>
                                        <span className="truncate">{x.nome}</span>
                                        <span className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
                                            {x.categoria_rotulo && <span>{x.categoria_rotulo}{x.avulsa ? ' · avulsa' : ''}</span>}
                                            {on && <CheckCircleIcon className="h-5 w-5 text-[#FF5A00]" />}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <p className="flex items-start gap-2 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900"><EyeIcon className="mt-0.5 h-4 w-4 shrink-0" /> {previa}</p>
        </div>
    );
}
