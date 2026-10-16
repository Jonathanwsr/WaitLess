import { useState } from 'react';
import {
    DocumentTextIcon, PencilSquareIcon, BoltIcon, EnvelopeIcon, EyeIcon,
    ChevronDownIcon, InformationCircleIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const PASSOS = [
    { icone: PencilSquareIcon, titulo: 'Crie um modelo', texto: 'Escreva o texto do contrato uma vez. Você pode ter um modelo por tipo de reserva (casa, carro, equipamento…) e um modelo padrão para o resto.' },
    { icone: BoltIcon, titulo: 'Gere para a reserva', texto: 'Quando chega uma reserva, toque em "Gerar contrato". Os dados do cliente, do item, das datas e do valor entram sozinhos no texto.' },
    { icone: EnvelopeIcon, titulo: 'Envie ao cliente', texto: 'O contrato sai em PDF e em Word. Você baixa os arquivos ou manda direto para o e-mail do cliente com um clique.' },
    { icone: EyeIcon, titulo: 'O cliente lê no app', texto: 'O contrato fica disponível nos detalhes da reserva do cliente, no site e no app, para ele ler e baixar quando quiser.' },
];

export const VARIAVEIS = [
    ['{{LOCADOR_NOME}}', 'Seu nome (dono da reserva)'],
    ['{{LOCADOR_DOCUMENTO}}', 'Seu CPF ou CNPJ'],
    ['{{LOCATARIO_NOME}}', 'Nome do cliente'],
    ['{{LOCATARIO_DOCUMENTO}}', 'CPF do cliente'],
    ['{{LOCATARIO_EMAIL}}', 'E-mail do cliente'],
    ['{{ITEM_NOME}}', 'Nome do item ou imóvel reservado'],
    ['{{VALOR_TOTAL}}', 'Valor total da reserva'],
    ['{{DATA_INICIO}}', 'Data de início'],
    ['{{DATA_FIM}}', 'Data de término'],
];

const PERGUNTAS = [
    ['Para quais reservas posso gerar contrato?', 'Para qualquer reserva: as avulsas (locações direto com você) e as reservas cadastradas nos seus locais.'],
    ['O contrato tem assinatura eletrônica?', 'Ainda não. O Lokyva gera o documento em PDF e Word; se precisar de assinatura com validade de certificado, use o arquivo Word ou o PDF numa plataforma de assinatura da sua preferência.'],
    ['O cliente precisa aceitar?', 'O contrato fica visível para o cliente na reserva. Combine com ele como prefere formalizar: assinatura no papel na retirada, por e-mail ou por plataforma de assinatura.'],
    ['Posso mudar o texto de um contrato só?', 'Sim. Ao gerar, você pode editar o texto daquela reserva sem mudar o modelo.'],
    ['Quem pode usar?', 'Contratos é um recurso dos planos Premium de sócio. Qualquer sócio ou gerente de um local com dono Premium também pode usar.'],
];

/**
 * Explicação do recurso Contratos: o que é, como funciona e o que o cliente vê.
 * Aparece para todos os sócios (inclusive sem plano), para entenderem antes de assinar.
 */
export default function ComoFuncionamContratos({ aberto: abertoInicial = true, compacto = false }) {
    const [aberto, setAberto] = useState(abertoInicial);
    const [pergunta, setPergunta] = useState(null);

    return (
        <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm">
            <button
                type="button"
                onClick={() => setAberto((a) => !a)}
                className="flex w-full items-center gap-3 p-5 text-left sm:p-6"
                aria-expanded={aberto}
            >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                    <InformationCircleIcon className="h-6 w-6" />
                </span>
                <span className="flex-1">
                    <span className="block text-lg font-black text-gray-900">O que são os contratos e como funcionam</span>
                    <span className="block text-sm text-gray-500">Proteja suas reservas com um documento com as regras combinadas com o cliente.</span>
                </span>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <div className="space-y-6 px-5 pb-6 sm:px-6">
                    <div className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-gray-600 ring-1 ring-gray-100">
                        <p>
                            <b className="text-gray-900">O que é:</b> um documento que registra o que foi combinado na reserva: quem aluga, o que está sendo
                            alugado, por quanto tempo, por qual valor e as suas regras (caução, multa por atraso, cuidados com o bem, cancelamento…).
                            Ele dá segurança para você e para o cliente se surgir alguma dúvida ou problema.
                        </p>
                    </div>

                    <div className={`grid gap-3 ${compacto ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
                        {PASSOS.map((p, i) => (
                            <div key={p.titulo} className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-700">{i + 1}</span>
                                    <p.icone className="h-5 w-5 text-indigo-600" />
                                </div>
                                <p className="mt-3 font-bold text-gray-900">{p.titulo}</p>
                                <p className="mt-1 text-sm leading-relaxed text-gray-500">{p.texto}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
                        <p className="flex items-center gap-2 font-bold text-gray-900"><DocumentTextIcon className="h-5 w-5 text-indigo-600" /> Campos que se preenchem sozinhos</p>
                        <p className="mt-1 text-sm text-gray-500">Escreva estes códigos no modelo e eles viram os dados reais de cada reserva:</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {VARIAVEIS.map(([codigo, rotulo]) => (
                                <div key={codigo} className="flex flex-col rounded-xl bg-gray-50 px-3 py-2">
                                    <code className="text-xs font-bold text-indigo-700">{codigo}</code>
                                    <span className="text-xs text-gray-500">{rotulo}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="flex items-center gap-2 font-bold text-gray-900"><ShieldCheckIcon className="h-5 w-5 text-indigo-600" /> Perguntas frequentes</p>
                        <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100">
                            {PERGUNTAS.map(([q, r], i) => (
                                <div key={q}>
                                    <button type="button" onClick={() => setPergunta(pergunta === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50" aria-expanded={pergunta === i}>
                                        {q}
                                        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition ${pergunta === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    {pergunta === i && <p className="px-4 pb-4 text-sm leading-relaxed text-gray-500">{r}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
