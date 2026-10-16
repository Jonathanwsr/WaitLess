import { useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon, CreditCardIcon, QrCodeIcon, DocumentTextIcon, ClipboardDocumentIcon, CheckIcon, ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number(v) % 1 ? 2 : 0 });
const so = (v) => String(v || '').replace(/\D/g, '');
const erroDe = (e) => Object.values(e?.response?.data?.errors || {})[0]?.[0] || e?.response?.data?.message || 'Não foi possível concluir agora. Tente de novo.';

const TONS = {
    pago: 'bg-emerald-50 text-emerald-700',
    pendente: 'bg-amber-50 text-amber-700',
    vencida: 'bg-red-50 text-red-700',
    estornada: 'bg-gray-100 text-gray-600',
};

/** Ícone da bandeira (círculos da Mastercard, texto nas demais) num quadrado escuro, como no extrato de cartões. */
function IconeBandeira({ bandeira, tipo }) {
    if (tipo === 'PIX') return <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white"><QrCodeIcon className="h-5 w-5" /></span>;
    if (tipo === 'BOLETO') return <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-white"><DocumentTextIcon className="h-5 w-5" /></span>;
    if (bandeira === 'Mastercard') {
        return (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1F36]" aria-label="Mastercard">
                <span className="h-4 w-4 rounded-full bg-[#EB001B]" /><span className="-ml-1.5 h-4 w-4 rounded-full bg-[#F79E1B] opacity-90" />
            </span>
        );
    }
    return <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1F36] text-[9px] font-black uppercase text-white">{(bandeira || 'Cartão').slice(0, 4)}</span>;
}

function Copiar({ texto, rotulo = 'Copiar' }) {
    const [ok, setOk] = useState(false);
    return (
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sem permissão */ } }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            {ok ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <ClipboardDocumentIcon className="h-4 w-4" />} {ok ? 'Copiado' : rotulo}
        </button>
    );
}

function Janela({ titulo, onFechar, children }) {
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && onFechar();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, []);
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titulo} onClick={onFechar}>
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
                    <button type="button" onClick={onFechar} aria-label="Fechar" className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FormularioCartao({ cpfInicial, onSalvo, rotaBase }) {
    const [c, setC] = useState({ numero: '', titular: '', validade: '', cvv: '', cpf: cpfInicial || '', cep: '', numeroEnd: '', telefone: '' });
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);
    const campo = 'mt-1 w-full rounded-lg border-gray-300 text-sm focus:border-gray-900 focus:ring-gray-900';

    const enviar = async (e) => {
        e.preventDefault();
        const [mes, ano] = c.validade.split('/');
        setEnviando(true);
        setErro(null);
        try {
            const { data } = await axios.post(`${rotaBase}/cartao`, {
                cartao: { numero: so(c.numero), titular: c.titular.trim(), mes: Number(mes), ano: Number(ano), cvv: so(c.cvv) },
                titular: { cpf_cnpj: so(c.cpf), cep: so(c.cep), numero: c.numeroEnd, telefone: so(c.telefone) },
            });
            onSalvo(data);
        } catch (err) {
            setErro(erroDe(err));
        } finally {
            setEnviando(false);
        }
    };

    return (
        <form onSubmit={enviar} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Número do cartão
                <input inputMode="numeric" autoComplete="cc-number" required value={c.numero} placeholder="0000 0000 0000 0000" maxLength={23}
                    onChange={(e) => setC({ ...c, numero: so(e.target.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ') })} className={campo} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Nome impresso no cartão
                <input autoComplete="cc-name" required value={c.titular} onChange={(e) => setC({ ...c, titular: e.target.value.toUpperCase() })} className={campo} />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">Validade
                    <input inputMode="numeric" autoComplete="cc-exp" required placeholder="MM/AA" value={c.validade}
                        onChange={(e) => { const d = so(e.target.value).slice(0, 4); setC({ ...c, validade: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} className={campo} />
                </label>
                <label className="block text-sm font-medium text-gray-700">CVV
                    <input inputMode="numeric" autoComplete="cc-csc" required placeholder="123" value={c.cvv} onChange={(e) => setC({ ...c, cvv: so(e.target.value).slice(0, 4) })} className={campo} />
                </label>
            </div>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Dados do titular (exigidos pelo banco)</p>
            <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block text-sm font-medium text-gray-700">CPF ou CNPJ
                    <input inputMode="numeric" required value={c.cpf} onChange={(e) => setC({ ...c, cpf: so(e.target.value).slice(0, 14) })} className={campo} />
                </label>
                <label className="block text-sm font-medium text-gray-700">CEP
                    <input inputMode="numeric" required value={c.cep} onChange={(e) => setC({ ...c, cep: so(e.target.value).slice(0, 8) })} className={campo} />
                </label>
                <label className="block text-sm font-medium text-gray-700">Nº do endereço
                    <input required value={c.numeroEnd} onChange={(e) => setC({ ...c, numeroEnd: e.target.value.slice(0, 10) })} className={campo} />
                </label>
                <label className="col-span-2 block text-sm font-medium text-gray-700">Celular (opcional)
                    <input inputMode="tel" value={c.telefone} onChange={(e) => setC({ ...c, telefone: so(e.target.value).slice(0, 11) })} className={campo} />
                </label>
            </div>
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</p>}
            <button type="submit" disabled={enviando} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-gray-900 font-semibold text-white hover:bg-black disabled:opacity-60">
                <LockClosedIcon className="h-4 w-4" /> {enviando ? 'Salvando…' : 'Salvar cartão'}
            </button>
            <p className="text-center text-xs text-gray-500">O cartão fica guardado com segurança no Asaas. Nenhuma cobrança é feita agora.</p>
        </form>
    );
}

/**
 * "Pagamento" da assinatura: forma padrão (cartão/Pix/boleto), adicionar ou atualizar, e as faturas com PDF.
 * Dados reais do Asaas, carregados por /minha-assinatura/pagamento.
 */
export default function PagamentoAssinatura({ cpfInicial = '', rotaBase = '/minha-assinatura/pagamento' }) {
    const [dados, setDados] = useState(null);
    const [erro, setErro] = useState(null);
    const [janela, setJanela] = useState(null); // 'metodo' | 'cartao' | {pagar: fatura}
    const [aba, setAba] = useState('cartao');
    const [aviso, setAviso] = useState(null);
    const [pagamento, setPagamento] = useState(null);

    const carregar = () => axios.get(rotaBase).then(({ data }) => { setDados(data); setErro(data.erro); }).catch((e) => setErro(erroDe(e)));
    useEffect(() => { carregar(); }, []);

    const salvo = (data) => { setDados((d) => ({ ...d, ...data })); setAviso(data.mensagem); setJanela(null); };
    const usarForma = async (forma) => {
        try { salvo((await axios.post(`${rotaBase}/forma`, { forma })).data); } catch (e) { setAviso(erroDe(e)); }
    };
    const abrirPagamento = async (f) => {
        setJanela({ pagar: f });
        setPagamento(null);
        try { setPagamento((await axios.get(`${rotaBase}/faturas/${f.id}`)).data); } catch (e) { setPagamento({ erro: erroDe(e) }); }
    };

    if (dados && !dados.tem_assinatura) return null;
    const forma = dados?.forma;

    return (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8" aria-label="Pagamento">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Pagamento</h2>
                    <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-gray-600">Sua forma de pagamento padrão é cobrada nas renovações da assinatura.</p>
                </div>
                <button type="button" onClick={() => { setAba('cartao'); setJanela('metodo'); }} className="min-h-[44px] shrink-0 rounded-xl border border-gray-200 bg-white px-4 text-[15px] font-medium text-gray-900 shadow-sm hover:bg-gray-50">
                    Adicionar método de pagamento
                </button>
            </div>

            {aviso && <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-800" role="status">{aviso}</p>}

            {/* Forma padrão */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {!dados ? (
                    <div className="h-12 w-72 animate-pulse rounded-lg bg-gray-100" />
                ) : (
                    <div className="flex items-start gap-3">
                        <IconeBandeira bandeira={forma?.cartao?.bandeira} tipo={forma?.tipo} />
                        <div>
                            <p className="flex flex-wrap items-center gap-2 text-[17px] text-gray-900">
                                {forma?.tipo === 'CREDIT_CARD'
                                    ? <>{forma.cartao?.bandeira || 'Cartão'} {forma.cartao?.final ? <span className="tracking-wider">•••• {forma.cartao.final}</span> : null}</>
                                    : forma?.rotulo || 'A definir'}
                                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-sm font-medium text-sky-800">Padrão</span>
                            </p>
                            <p className="text-[15px] text-gray-400">
                                {forma?.tipo === 'CREDIT_CARD' ? (forma.cartao?.validade ? `Expira em ${forma.cartao.validade}` : 'Cobrado automaticamente a cada renovação')
                                    : forma?.tipo === 'PIX' ? 'QR Code e copia e cola em cada fatura (também chega no e-mail)'
                                    : forma?.tipo === 'BOLETO' ? 'Boleto em cada fatura (também chega no e-mail)' : 'Escolha como prefere pagar'}
                            </p>
                        </div>
                    </div>
                )}
                {dados && (
                    <button type="button" onClick={() => { if (forma?.tipo === 'CREDIT_CARD') { setJanela('cartao'); } else { setAba(forma?.tipo === 'BOLETO' ? 'boleto' : 'pix'); setJanela('metodo'); } }}
                        className="min-h-[44px] self-start rounded-xl border border-gray-200 bg-white px-5 text-[15px] font-medium text-gray-900 shadow-sm hover:bg-gray-50 sm:self-auto">
                        Atualizar
                    </button>
                )}
            </div>

            {/* Faturas */}
            <h3 className="mt-10 text-xl font-semibold text-gray-900">Faturas</h3>
            {erro && <p className="mt-3 flex items-center gap-2 text-sm text-red-600">{erro} <button type="button" onClick={carregar} className="inline-flex items-center gap-1 font-semibold underline"><ArrowPathIcon className="h-4 w-4" /> Tentar de novo</button></p>}
            {dados && !erro && dados.faturas.length === 0 && <p className="mt-3 text-sm text-gray-500">Ainda não há faturas. A primeira aparece aqui assim que for gerada.</p>}

            {dados && dados.faturas.length > 0 && (
                <div className="mt-4">
                    <div className="hidden grid-cols-[1.6fr_1fr_1fr_1.2fr] gap-4 pb-3 text-[15px] font-medium text-gray-900 sm:grid">
                        <span>Data</span><span>Total</span><span>Status</span><span>Ações</span>
                    </div>
                    <ul className="divide-y divide-gray-100 sm:divide-y-0">
                        {dados.faturas.map((f) => (
                            <li key={f.id} className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-[15px] text-gray-800 sm:grid-cols-[1.6fr_1fr_1fr_1.2fr] sm:items-center sm:gap-4 sm:py-2.5">
                                <span className="col-span-2 font-medium sm:col-span-1 sm:font-normal">{f.data_formatada}{f.forma && <span className="ml-2 text-xs text-gray-400">· {f.forma}</span>}</span>
                                <span>{moeda(f.valor)}</span>
                                <span><span className={`rounded-md px-2 py-0.5 text-sm font-medium ${TONS[f.tom] || TONS.pendente}`}>{f.status}</span></span>
                                <span className="col-span-2 flex flex-wrap items-center gap-4 sm:col-span-1">
                                    {f.em_aberto && <button type="button" onClick={() => abrirPagamento(f)} className="min-h-[36px] font-semibold text-[#E8590C] underline-offset-4 hover:underline">Pagar</button>}
                                    {f.pdf && <a href={f.pdf} target="_blank" rel="noopener noreferrer" className="min-h-[36px] leading-9 text-sky-800 underline underline-offset-4 decoration-sky-300 hover:decoration-sky-800">Baixar PDF</a>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Adicionar / trocar método */}
            {janela === 'metodo' && (
                <Janela titulo="Método de pagamento" onFechar={() => setJanela(null)}>
                    <div className="mb-5 grid grid-cols-3 gap-2" role="tablist">
                        {[['cartao', 'Cartão', CreditCardIcon], ['pix', 'Pix', QrCodeIcon], ['boleto', 'Boleto', DocumentTextIcon]].map(([id, rotulo, Icone]) => (
                            <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
                                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold ${aba === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                <Icone className="h-5 w-5" /> {rotulo}
                            </button>
                        ))}
                    </div>
                    {aba === 'cartao' && <FormularioCartao cpfInicial={cpfInicial} onSalvo={salvo} rotaBase={rotaBase} />}
                    {aba !== 'cartao' && (
                        <div className="space-y-4">
                            <p className="text-[15px] leading-relaxed text-gray-600">
                                {aba === 'pix'
                                    ? 'Cada fatura terá um QR Code e um código copia e cola. Você paga pelo app do seu banco em segundos. O aviso também chega no seu e-mail.'
                                    : 'Cada fatura terá um boleto com linha digitável e PDF. Pode levar até 3 dias úteis para compensar. O boleto também chega no seu e-mail.'}
                            </p>
                            <button type="button" onClick={() => usarForma(aba)} disabled={forma?.tipo === aba.toUpperCase()}
                                className="min-h-[48px] w-full rounded-lg bg-gray-900 font-semibold text-white hover:bg-black disabled:opacity-50">
                                {forma?.tipo === aba.toUpperCase() ? 'Esta já é a sua forma padrão' : `Usar ${aba === 'pix' ? 'Pix' : 'boleto'} como padrão`}
                            </button>
                        </div>
                    )}
                </Janela>
            )}
            {janela === 'cartao' && (
                <Janela titulo="Atualizar cartão" onFechar={() => setJanela(null)}>
                    <FormularioCartao cpfInicial={cpfInicial} onSalvo={salvo} rotaBase={rotaBase} />
                </Janela>
            )}

            {/* Pagar fatura em aberto */}
            {janela?.pagar && (
                <Janela titulo={`Pagar fatura de ${moeda(janela.pagar.valor)}`} onFechar={() => setJanela(null)}>
                    {!pagamento && <div className="h-64 animate-pulse rounded-xl bg-gray-100" />}
                    {pagamento?.erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{pagamento.erro}</p>}
                    {pagamento && !pagamento.erro && (
                        <div className="space-y-5">
                            {pagamento.pix && (
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-900">Pix: escaneie o QR Code</p>
                                    <img src={`data:image/png;base64,${pagamento.pix.imagem}`} alt="QR Code Pix da fatura" className="mx-auto mt-2 h-56 w-56 rounded-xl border border-gray-100" />
                                    <p className="mt-3 text-sm text-gray-500">ou use o Pix copia e cola:</p>
                                    <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                                        <code className="min-w-0 flex-1 truncate text-left text-xs text-gray-700">{pagamento.pix.copia_e_cola}</code>
                                        <Copiar texto={pagamento.pix.copia_e_cola} />
                                    </div>
                                </div>
                            )}
                            {pagamento.boleto && (
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Boleto</p>
                                    {pagamento.boleto.linha_digitavel && (
                                        <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                                            <code className="min-w-0 flex-1 break-all text-xs text-gray-700">{pagamento.boleto.linha_digitavel}</code>
                                            <Copiar texto={pagamento.boleto.linha_digitavel} rotulo="Copiar linha" />
                                        </div>
                                    )}
                                    {pagamento.boleto.pdf && <a href={pagamento.boleto.pdf} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-sky-800 underline">Baixar boleto (PDF)</a>}
                                </div>
                            )}
                            {pagamento.fatura && <a href={pagamento.fatura} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-gray-500 underline">Ver fatura completa no Asaas</a>}
                        </div>
                    )}
                </Janela>
            )}
        </section>
    );
}
