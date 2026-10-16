import { TruckIcon, ClockIcon, MapPinIcon, ShieldCheckIcon, BoltIcon } from '@heroicons/react/24/outline';

export const MODALIDADES = [
    { valor: 'no_local', rotulo: 'No estabelecimento', dica: 'O cliente vai até você.' },
    { valor: 'a_domicilio', rotulo: 'Vai até o cliente', dica: 'Guincho, borracharia móvel, a domicílio. O cliente informa onde está.' },
    { valor: 'ambos', rotulo: 'No local ou até o cliente', dica: 'O cliente escolhe; a taxa só entra se ele pedir em casa.' },
    { valor: 'online', rotulo: 'Online', dica: 'Atendimento por vídeo ou chamada.' },
];

export const TIPOS_PRECO = [
    { valor: 'fixo', rotulo: 'Preço fixo' },
    { valor: 'a_partir_de', rotulo: 'A partir de' },
    { valor: 'por_hora', rotulo: 'Por hora' },
    { valor: 'por_km', rotulo: 'Por km rodado' },
    { valor: 'sob_orcamento', rotulo: 'Sob orçamento' },
];

/** Valores iniciais do formulário e leitura de um serviço salvo. */
export const camposAtendimentoVazios = {
    modalidade_atendimento: 'no_local', atende_24h: false, raio_atendimento_km: '', taxa_deslocamento: '',
    tempo_chegada_minutos: '', tipo_preco: 'fixo', o_que_inclui: '', como_se_preparar: '', garantia_dias: '',
};

export const camposAtendimentoDe = (s = {}) => ({
    modalidade_atendimento: s.modalidade_atendimento || 'no_local',
    atende_24h: s.atende_24h === true || s.atende_24h === 1,
    raio_atendimento_km: s.raio_atendimento_km ?? '',
    taxa_deslocamento: s.taxa_deslocamento ?? '',
    tempo_chegada_minutos: s.tempo_chegada_minutos ?? '',
    tipo_preco: s.tipo_preco || 'fixo',
    o_que_inclui: s.o_que_inclui || '',
    como_se_preparar: s.como_se_preparar || '',
    garantia_dias: s.garantia_dias ?? '',
});

/** Ajustes para enviar no formulário (só o que muda: booleano como 1/0). */
export const camposAtendimentoParaEnvio = (d) => ({ atende_24h: d.atende_24h ? 1 : 0 });

const campo = 'mt-1 w-full rounded-xl border-gray-300 text-sm shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]';

/** Seção "Atendimento" do cadastro de serviço (site). */
export default function CamposAtendimento({ dados, setData, errors = {} }) {
    const vaiAte = ['a_domicilio', 'ambos'].includes(dados.modalidade_atendimento);
    const erro = (k) => errors[k] && <p className="mt-1 text-xs font-semibold text-red-600">{errors[k]}</p>;

    return (
        <div className="md:col-span-2 space-y-5 rounded-2xl border border-orange-100 bg-orange-50/40 p-5">
            <div>
                <h4 className="flex items-center gap-2 font-black text-gray-900"><TruckIcon className="h-5 w-5 text-[#FF5A00]" /> Como é o atendimento</h4>
                <p className="text-xs text-gray-500">Essas informações aparecem para o cliente no Explorar, nos detalhes do serviço e na hora de agendar.</p>
            </div>

            <div>
                <p className="text-sm font-bold text-gray-700">Onde o serviço é feito?</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MODALIDADES.map((m) => (
                        <button key={m.valor} type="button" onClick={() => setData('modalidade_atendimento', m.valor)}
                            className={`rounded-xl border p-3 text-left transition ${dados.modalidade_atendimento === m.valor ? 'border-[#FF5A00] bg-white ring-2 ring-[#FF5A00]/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                            <span className="block text-sm font-bold text-gray-900">{m.rotulo}</span>
                            <span className="block text-xs text-gray-500">{m.dica}</span>
                        </button>
                    ))}
                </div>
                {erro('modalidade_atendimento')}
            </div>

            {vaiAte && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="block text-sm font-semibold text-gray-700">
                        <span className="flex items-center gap-1"><MapPinIcon className="h-4 w-4" /> Raio de atendimento (km)</span>
                        <input type="number" min="1" max="1000" className={campo} value={dados.raio_atendimento_km} onChange={(e) => setData('raio_atendimento_km', e.target.value)} placeholder="Ex: 30" />
                        {erro('raio_atendimento_km')}
                    </label>
                    <label className="block text-sm font-semibold text-gray-700">
                        Taxa de deslocamento (R$)
                        <input type="number" min="0" step="0.01" className={campo} value={dados.taxa_deslocamento} onChange={(e) => setData('taxa_deslocamento', e.target.value)} placeholder="0 = sem taxa" />
                        <span className="mt-1 block text-xs font-normal text-gray-500">Somada ao valor quando você vai até o cliente.</span>
                        {erro('taxa_deslocamento')}
                    </label>
                    <label className="block text-sm font-semibold text-gray-700">
                        <span className="flex items-center gap-1"><BoltIcon className="h-4 w-4" /> Tempo médio de chegada (min)</span>
                        <input type="number" min="1" max="1440" className={campo} value={dados.tempo_chegada_minutos} onChange={(e) => setData('tempo_chegada_minutos', e.target.value)} placeholder="Ex: 40" />
                        {erro('tempo_chegada_minutos')}
                    </label>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block text-sm font-semibold text-gray-700">
                    Como o preço é cobrado
                    <select className={campo} value={dados.tipo_preco} onChange={(e) => setData('tipo_preco', e.target.value)}>
                        {TIPOS_PRECO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-gray-500">"Sob orçamento": o valor vira um preço inicial.</span>
                </label>
                <label className="block text-sm font-semibold text-gray-700">
                    <span className="flex items-center gap-1"><ShieldCheckIcon className="h-4 w-4" /> Garantia (dias)</span>
                    <input type="number" min="0" max="3650" className={campo} value={dados.garantia_dias} onChange={(e) => setData('garantia_dias', e.target.value)} placeholder="Ex: 90" />
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:mt-6">
                    <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" checked={!!dados.atende_24h} onChange={(e) => setData('atende_24h', e.target.checked)} />
                    <span className="text-sm">
                        <span className="flex items-center gap-1 font-bold text-gray-900"><ClockIcon className="h-4 w-4" /> Atende 24 horas</span>
                        <span className="block text-xs text-gray-500">Emergências, socorro, plantão.</span>
                    </span>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-gray-700">
                    O que está incluído
                    <textarea rows="3" maxLength={2000} className={campo} value={dados.o_que_inclui} onChange={(e) => setData('o_que_inclui', e.target.value)} placeholder="Ex: reboque até 50 km, troca de pneu, mão de obra" />
                </label>
                <label className="block text-sm font-semibold text-gray-700">
                    Como o cliente deve se preparar
                    <textarea rows="3" maxLength={2000} className={campo} value={dados.como_se_preparar} onChange={(e) => setData('como_se_preparar', e.target.value)} placeholder="Ex: ter o documento do veículo em mãos e o estepe" />
                </label>
            </div>
        </div>
    );
}
