import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    DocumentTextIcon, ArrowDownTrayIcon, BookOpenIcon, XMarkIcon, ClockIcon, CheckBadgeIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';

const dataHoraBr = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);
const dataBr = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null);

/**
 * Contrato da reserva para o cliente: ler na tela e baixar PDF/Word.
 * Vale para qualquer reserva (avulsa ou de um local). Sem contrato ainda, explica o que esperar.
 */
export default function ContratoDaReserva({ contrato: inicial, exigeContrato }) {
    const [lendo, setLendo] = useState(false);
    const [contrato, setContrato] = useState(inicial);
    const [marcado, setMarcado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    useEffect(() => setContrato(inicial), [inicial]);

    const aceitar = async () => {
        if (!marcado || enviando) return;
        setEnviando(true);
        setErro(null);
        try {
            const { data } = await axios.post(`/contratos/${contrato.id}/aceitar`, { aceito: true });
            setContrato(data.contrato);
            setLendo(false);
        } catch (e) {
            setErro(e.response?.data?.message || 'Não foi possível registrar o aceite. Tente de novo.');
        } finally {
            setEnviando(false);
        }
    };

    const blocoAceite = contrato?.pode_aceitar ? (
        <div className="rounded-2xl border border-indigo-200 bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm leading-relaxed text-gray-700">
                    <strong className="text-gray-900">Li e aceito</strong> os termos deste contrato. Fica registrado a data, a hora e o aparelho usado,
                    e o proprietário é avisado.
                </span>
            </label>
            {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}
            <button type="button" onClick={aceitar} disabled={!marcado || enviando} className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckBadgeIcon className="h-5 w-5" /> {enviando ? 'Registrando…' : 'Aceitar contrato'}
            </button>
        </div>
    ) : null;

    useEffect(() => {
        if (!lendo) return undefined;
        const fechar = (e) => e.key === 'Escape' && setLendo(false);
        window.addEventListener('keydown', fechar);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', fechar); document.body.style.overflow = ''; };
    }, [lendo]);

    if (!contrato) {
        if (!exigeContrato) return null;
        return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
                <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <DocumentTextIcon className="h-6 w-6 text-amber-600" /> Contrato da reserva
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Esta reserva tem contrato. O proprietário ainda vai gerar o documento; assim que ele fizer isso, o contrato aparece aqui para
                    você ler e baixar, e também pode chegar no seu e-mail.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <DocumentTextIcon className="h-6 w-6 text-indigo-600" /> Contrato da reserva
                    </h4>
                    {contrato.assinado ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-green-700"><CheckBadgeIcon className="h-3.5 w-3.5" /> Aceito</span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700"><ClockIcon className="h-3.5 w-3.5" /> {contrato.pode_aceitar ? 'Aguardando seu aceite' : 'Disponível'}</span>
                    )}
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-800">{contrato.titulo}</p>
                <p className="text-xs text-gray-500">
                    Nº {contrato.numero}{contrato.gerado_em ? ` · gerado em ${dataBr(contrato.gerado_em)}` : ''}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    Este é o contrato com as regras combinadas para esta reserva. Leia com atenção antes da data de início; se tiver dúvida, fale com o
                    proprietário pelo botão de mensagem.
                </p>

                {contrato.aceite && (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
                        <CheckBadgeIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                            Você aceitou em <strong>{dataHoraBr(contrato.aceite.em)}</strong>{contrato.aceite.aparelho ? ` · ${contrato.aceite.aparelho}` : ''}.
                            {contrato.aceite.codigo && <span className="block text-xs text-green-700/80">Código do aceite: {contrato.aceite.codigo}</span>}
                        </span>
                    </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    {contrato.texto && (
                        <button type="button" onClick={() => setLendo(true)} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700">
                            <BookOpenIcon className="h-5 w-5" /> Ler contrato
                        </button>
                    )}
                    {contrato.pdf_url && (
                        <a href={contrato.pdf_url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${contrato.texto ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                            <ArrowDownTrayIcon className="h-5 w-5" /> {contrato.texto ? 'Baixar PDF' : 'Abrir contrato (PDF)'}
                        </a>
                    )}
                    {contrato.docx_url && (
                        <a href={contrato.docx_url} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50">
                            Word
                        </a>
                    )}
                </div>
                {blocoAceite && <div className="mt-4">{blocoAceite}</div>}
            </div>

            {lendo && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={contrato.titulo} onClick={() => setLendo(false)}>
                    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                            <DocumentTextIcon className="h-6 w-6 shrink-0 text-indigo-600" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-black text-gray-900">{contrato.titulo}</p>
                                <p className="text-xs text-gray-500">Nº {contrato.numero}</p>
                            </div>
                            <button type="button" onClick={() => setLendo(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Fechar">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                            <p className="whitespace-pre-line text-[15px] leading-7 text-gray-800">{contrato.texto}</p>
                        </div>
                        {blocoAceite && <div className="border-t border-gray-100 bg-indigo-50/40 px-5 py-4">{blocoAceite}</div>}
                        <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center">
                            <p className="flex flex-1 items-center gap-1.5 text-xs text-gray-500"><InformationCircleIcon className="h-4 w-4 shrink-0" /> O PDF é a versão oficial do documento.</p>
                            {contrato.pdf_url && (
                                <a href={contrato.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700">
                                    <ArrowDownTrayIcon className="h-5 w-5" /> Baixar PDF
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
