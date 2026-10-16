import { ClockIcon, MapPinIcon, ShieldCheckIcon, BoltIcon, VideoCameraIcon, CheckCircleIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const ICONES = { '24h': ClockIcon, domicilio: MapPinIcon, online: VideoCameraIcon, chegada: BoltIcon, garantia: ShieldCheckIcon };
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Selos curtos (cards do Explorar, lista de serviços da loja). */
export function SelosAtendimento({ atendimento, max = 3, className = '' }) {
    const selos = atendimento?.selos || [];
    if (!selos.length) return null;
    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {selos.slice(0, max).map((s) => {
                const Icone = ICONES[s.id] || CheckCircleIcon;
                const forte = s.id === '24h';
                return (
                    <span key={s.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${forte ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-[#C2410C]'}`}>
                        <Icone className="h-3.5 w-3.5" /> {s.texto}
                    </span>
                );
            })}
        </div>
    );
}

/** Preço com o jeito de cobrar: "A partir de R$ 80", "R$ 5,00 /km", "Sob orçamento". */
export function precoComTipo(valor, atendimento) {
    const v = brl(valor);
    if (!atendimento) return v;
    if (atendimento.sob_orcamento) return Number(valor) > 0 ? `Sob orçamento · a partir de ${v}` : 'Sob orçamento';
    return `${atendimento.preco_prefixo ? atendimento.preco_prefixo + ' ' : ''}${v}${atendimento.preco_sufixo ? ' ' + atendimento.preco_sufixo : ''}`;
}

/** Bloco completo para a página do serviço e a tela de agendar. */
export default function InfoAtendimento({ atendimento, className = '' }) {
    if (!atendimento) return null;
    const temDetalhe = atendimento.o_que_inclui || atendimento.como_se_preparar || atendimento.pede_endereco || atendimento.atende_24h
        || atendimento.garantia_dias || atendimento.tipo_preco !== 'fixo' || atendimento.modalidade !== 'no_local';
    if (!temDetalhe) return null;

    const linhas = [
        ['Atendimento', atendimento.modalidade_rotulo],
        atendimento.raio_atendimento_km && ['Raio de atendimento', `até ${atendimento.raio_atendimento_km} km`],
        atendimento.taxa_deslocamento && ['Taxa de deslocamento', brl(atendimento.taxa_deslocamento)],
        atendimento.tempo_chegada_minutos && ['Tempo médio de chegada', `${atendimento.tempo_chegada_minutos} min`],
        atendimento.tipo_preco !== 'fixo' && ['Cobrança', atendimento.tipo_preco_rotulo],
        atendimento.garantia_dias && ['Garantia', `${atendimento.garantia_dias} dias`],
    ].filter(Boolean);

    return (
        <section className={`rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
            <h3 className="text-lg font-black text-gray-900">Como funciona o atendimento</h3>
            <SelosAtendimento atendimento={atendimento} max={5} className="mt-3" />
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {linhas.map(([r, v]) => (
                    <div key={r} className="flex justify-between gap-3 border-b border-gray-50 py-1.5">
                        <dt className="text-gray-500">{r}</dt>
                        <dd className="text-right font-semibold text-gray-900">{v}</dd>
                    </div>
                ))}
            </dl>
            {atendimento.o_que_inclui && (
                <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800"><CheckCircleIcon className="h-4 w-4 text-green-600" /> O que está incluído</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">{atendimento.o_que_inclui}</p>
                </div>
            )}
            {atendimento.como_se_preparar && (
                <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800"><ClipboardDocumentListIcon className="h-4 w-4 text-[#FF5A00]" /> Como se preparar</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">{atendimento.como_se_preparar}</p>
                </div>
            )}
        </section>
    );
}
