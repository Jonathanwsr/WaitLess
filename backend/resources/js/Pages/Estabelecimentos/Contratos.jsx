import React, { useState, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import { 
    DocumentTextIcon, DocumentCheckIcon, PlusIcon, 
    PencilSquareIcon, EyeIcon, ArrowDownTrayIcon, 
    XMarkIcon, CheckBadgeIcon, ShieldCheckIcon,
    BuildingOfficeIcon, ChevronRightIcon,
    PrinterIcon, ArrowLeftIcon,
    ArchiveBoxIcon, ClockIcon, CheckCircleIcon, 
    ArrowTopRightOnSquareIcon, TrashIcon, UserGroupIcon
} from '@heroicons/react/24/solid';

export default function Contratos({ auth, estabelecimento, templates = [], contratosGerados = { data: [] }, reservasPendentes = [] }) {
    const { flash = {} } = usePage().props;
    const [activeTab, setActiveTab] = useState('modelos'); 
    const [mensagemSucesso, setMensagemSucesso] = useState('');
    const textareaRef = useRef(null);

    const listaTemplates = Array.isArray(templates) ? templates : [];
    const listaContratos = contratosGerados?.data || [];
    const listaPendentes = Array.isArray(reservasPendentes) ? reservasPendentes : [];
    const lojaSegura = estabelecimento || {};

    // ========================================================
    // ESTADOS DO MODAL DE PRÉ-VISUALIZAÇÃO
    // ========================================================
    const [showPreview, setShowPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const mostrarMensagem = (msg) => {
        setMensagemSucesso(msg);
        setTimeout(() => setMensagemSucesso(''), 5000);
    };

    // ========================================================
    // LÓGICA E REGRAS DE SEGURANÇA (ANTISPAM, ANTI-HACKER, ANTI-PALAVRÃO)
    // ========================================================
    const validarSeguranca = (texto) => {
        if (!texto) return null;
        
        // Bloqueia Emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        if (emojiRegex.test(texto)) return "Alerta: Não é permitido o uso de emojis na redação do contrato.";

        // Bloqueia Injeção de Código (XSS)
        const xssRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>|on[a-z]+\s*=/gi;
        if (xssRegex.test(texto)) return "Segurança: Código malicioso ou tags de script não são permitidas.";

        // Bloqueia Palavrões e Termos de Cunho Sexual
        const profanityRegex = /\b(puta|caralho|merda|porra|foda|cu|piroca|boceta|cacete|buceta|pica|rola|arrombado|sexo|prostituta)\b/i;
        if (profanityRegex.test(texto)) return "Moderação: O texto contém palavras de baixo calão ou conteúdo impróprio. Mantenha um linguajar profissional.";

        return null;
    };

    // ========================================================
    // FORMULÁRIO DO TEMPLATE E VARIÁVEIS MÁGICAS
    // ========================================================
    const [isEditing, setIsEditing] = useState(false);
    const formTemplate = useForm({
        id: null,
        titulo: '',
        conteudo: '',
        tipo_reserva: 'geral',
        aplicabilidade: 'padrao', 
        aluguel_id: '', 
        padrao: false,
    });

    const variaveisMagicas = [
        { desc: 'Nome do Locador', tag: '{{LOCADOR_NOME}}' },
        { desc: 'Documento do Locador', tag: '{{LOCADOR_DOCUMENTO}}' },
        { desc: 'Nome do Locatário', tag: '{{LOCATARIO_NOME}}' },
        { desc: 'CPF do Locatário', tag: '{{LOCATARIO_DOCUMENTO}}' },
        { desc: 'E-mail do Locatário', tag: '{{LOCATARIO_EMAIL}}' },
        { desc: 'Nome do Item/Imóvel', tag: '{{ITEM_NOME}}' },
        { desc: 'Valor Total', tag: '{{VALOR_TOTAL}}' },
        { desc: 'Data de Início', tag: '{{DATA_INICIO}}' },
        { desc: 'Data de Término', tag: '{{DATA_FIM}}' },
    ];

    const textoContratoPadrao = `
<h2 style="text-align: center; font-weight: 900; margin-bottom: 30px; font-size: 1.4em;">CONTRATO PARTICULAR DE LOCAÇÃO RESIDENCIAL / BENS</h2>

<p style="text-align: center; margin-bottom: 30px;"><strong>Instrumento Particular de Locação</strong><br>
Regido pela Lei nº 8.245/1991 (Lei do Inquilinato) e pelo Código Civil Brasileiro (Lei nº 10.406/2002).</p>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas, de livre e espontânea vontade, celebram o presente <strong>Contrato Particular de Locação</strong>, que se regerá pelas cláusulas e condições a seguir estipuladas:</p>

<h3>1. DAS PARTES</h3>
<p><strong>LOCADOR(A):</strong> {{LOCADOR_NOME}}, {{LOCADOR_QUALIFICACAO}}, inscrito(a) no CPF/CNPJ sob o nº {{LOCADOR_DOCUMENTO}}, residente e domiciliado(a) à {{LOCADOR_ENDERECO}}.</p>
<p><strong>LOCATÁRIO(A):</strong> {{LOCATARIO_NOME}}, {{LOCATARIO_QUALIFICACAO}}, inscrito(a) no CPF sob o nº {{LOCATARIO_DOCUMENTO}}, portador(a) do RG nº {{LOCATARIO_RG}}, e-mail {{LOCATARIO_EMAIL}}, residente e domiciliado(a) à {{LOCATARIO_ENDERECO}}.</p>

<p>As partes acima qualificadas declaram possuir plena capacidade civil para celebrar o presente contrato.</p>

<h3>2. DO OBJETO</h3>
<p>O LOCADOR é legítimo proprietário do bem descrito como <strong>{{ITEM_NOME}}</strong>, localizado em {{ITEM_ENDERECO}}, conforme especificações detalhadas no Anexo I (Termo de Vistoria e Descrição do Bem), que passa a integrar o presente instrumento.</p>
<p>O bem é destinado exclusivamente para uso residencial / particular do LOCATÁRIO, sendo vedada qualquer utilização comercial, industrial ou diversa da contratada, sob pena de rescisão imediata.</p>

<h3>3. DO PRAZO DA LOCAÇÃO</h3>
<p>A locação terá início em <strong>{{DATA_INICIO}}</strong> e término em <strong>{{DATA_FIM}}</strong>, perfazendo o prazo total de {{PRAZO_DIAS}} dias/meses.</p>
<p><strong>Parágrafo Primeiro:</strong> Findo o prazo estipulado, caso o LOCATÁRIO permaneça no imóvel/posse do bem por mais de 30 (trinta) dias sem oposição expressa do LOCADOR, a locação prorrogar-se-á automaticamente por prazo indeterminado, nos termos do art. 47 da Lei nº 8.245/1991, mantidas as demais cláusulas e condições contratuais.</p>
<p><strong>Parágrafo Segundo:</strong> Qualquer das partes poderá denunciar o contrato a qualquer tempo, mediante aviso prévio por escrito de 30 (trinta) dias, respeitado o prazo mínimo de vigência.</p>

<h3>4. DO VALOR E FORMA DE PAGAMENTO</h3>
<p>O valor total da locação é de <strong>R$ {{VALOR_TOTAL}}</strong>, sendo o aluguel mensal no valor de R$ {{VALOR_MENSAL}} ({{VALOR_MENSAL_EXTENSO}}).</p>
<p><strong>Parágrafo Primeiro:</strong> Os pagamentos serão realizados até o dia {{DIA_VENCIMENTO}} de cada mês, mediante {{FORMA_PAGAMENTO}} (PIX, transferência bancária ou outro meio acordado), em favor do LOCADOR.</p>
<p><strong>Parágrafo Segundo:</strong> O atraso no pagamento acarretará, independentemente de notificação:</p>
<ul>
  <li>Multa moratória de 10% (dez por cento) sobre o valor devido;</li>
  <li>Juros de mora de 1% (um por cento) ao mês, pro rata die;</li>
  <li>Correção monetária pelo IPCA ou índice oficial que o substitua.</li>
</ul>
<p><strong>Parágrafo Terceiro:</strong> O LOCATÁRIO arcará com todas as despesas ordinárias de condomínio, IPTU, contas de consumo (água, luz, gás, internet etc.), salvo disposição expressa em contrário.</p>

<h3>5. DA ENTREGA, CONSERVAÇÃO E VISTORIA</h3>
<p>O bem é entregue ao LOCATÁRIO em perfeito estado de conservação, limpeza e funcionamento, conforme Termo de Vistoria Inicial assinado pelas partes (Anexo I).</p>
<p><strong>Parágrafo Primeiro:</strong> O LOCATÁRIO obriga-se a manter o bem em perfeito estado, realizando, às suas expensas, todas as reparações e conservações necessárias, exceto as decorrentes de desgaste natural ou vício oculto.</p>
<p><strong>Parágrafo Segundo:</strong> O LOCADOR ou seu representante poderá realizar vistorias periódicas, mediante aviso prévio de 24 (vinte e quatro) horas, respeitando a privacidade do LOCATÁRIO.</p>
<p><strong>Parágrafo Terceiro:</strong> Ao final da locação, o LOCATÁRIO deverá devolver o bem no mesmo estado em que o recebeu, ressalvado o desgaste natural, sob pena de retenção da caução e cobrança de indenização por danos.</p>

<h3>6. DA CAUÇÃO / GARANTIA</h3>
<p>O LOCATÁRIO prestou garantia no valor equivalente a {{MESES_CAUCAO}} mês(es) de aluguel, no montante de R$ {{VALOR_CAUCAO}}, mediante {{TIPO_GARANTIA}} (depósito em dinheiro, fiança, seguro fiança etc.).</p>
<p>A caução será devolvida ao LOCATÁRIO no prazo máximo de 30 (trinta) dias após a entrega do bem, deduzidos eventuais débitos, multas ou danos.</p>

<h3>7. DAS OBRIGAÇÕES E PROIBIÇÕES DO LOCATÁRIO</h3>
<ul>
  <li>Não sublocar, ceder ou transferir o bem, no todo ou em parte, sem prévia autorização escrita do LOCADOR;</li>
  <li>Não realizar reformas, alterações ou pinturas sem consentimento prévio e por escrito do LOCADOR;</li>
  <li>Não permitir a utilização do bem por terceiros não autorizados;</li>
  <li>Manter o bem seguro e protegido contra sinistros;</li>
  <li>Comunicar imediatamente ao LOCADOR qualquer defeito ou necessidade de reparo;</li>
  <li>Respeitar as normas de convivência e regulamentos aplicáveis.</li>
</ul>

<h3>8. DA RESCISÃO E MULTA RESCISÓRIA</h3>
<p>Qualquer descumprimento das obrigações contratuais autorizará a parte inocente a rescindir o contrato de pleno direito, mediante notificação extrajudicial, sem prejuízo da cobrança de multas, aluguéis atrasados e indenizações por danos.</p>
<p><strong>Parágrafo Único:</strong> Em caso de rescisão antecipada por iniciativa do LOCATÁRIO, este pagará multa rescisória equivalente a 3 (três) meses de aluguel, proporcionalmente ao tempo restante de contrato, conforme jurisprudência e boa-fé contratual.</p>

<h3>9. DAS DESPESAS E TRIBUTOS</h3>
<p>Todas as despesas ordinárias e extraordinárias relativas ao bem durante a locação serão de responsabilidade do LOCATÁRIO, exceto as que por lei ou convenção forem atribuídas ao LOCADOR.</p>

<h3>10. DO FORO E DISPOSIÇÕES GERAIS</h3>
<p>As partes elegem o foro da Comarca de {{CIDADE_FORO}} para dirimir quaisquer controvérsias oriundas deste contrato, renunciando a qualquer outro, por mais privilegiado que seja.</p>
<p><strong>Parágrafo Primeiro:</strong> Este contrato obriga as partes, seus herdeiros e sucessores.</p>
<p><strong>Parágrafo Segundo:</strong> Os anexos (Termo de Vistoria, Comprovantes de Pagamento etc.) integram o presente instrumento para todos os fins de direito.</p>
<p><strong>Parágrafo Terceiro:</strong> Fica expressamente vedada a compensação de aluguéis com eventuais créditos do LOCATÁRIO.</p>

<br><br><br>

<div style="text-align: center; margin-top: 60px;">
    <p>Local e Data: {{CIDADE}}, {{DATA_ATUAL}}.</p>
    
    <p style="margin-top: 40px;">_________________________________________________________</p>
    <p><strong>{{LOCADOR_NOME}}</strong><br>Locador(a) - CPF: {{LOCADOR_DOCUMENTO}}</p>
    
    <br><br>
    
    <p>_________________________________________________________</p>
    <p><strong>{{LOCATARIO_NOME}}</strong><br>Locatário(a) - CPF: {{LOCATARIO_DOCUMENTO}}</p>
    
    <br><br>
    
    <p><strong>Testemunhas:</strong></p>
    
    <p>_________________________________________________________</p>
    <p>Nome: ______________________________ CPF: ________________</p>
    
    <p>_________________________________________________________</p>
    <p>Nome: ______________________________ CPF: ________________</p>
</div>

<p style="font-size: 0.9em; margin-top: 50px; text-align: center;">
    <strong>Anexos:</strong> I – Termo de Vistoria e Descrição do Bem | II – Comprovante de Pagamento da Caução (se aplicável)
</p>
    `;

    const carregarTextoPadrao = () => {
        if (formTemplate.data.conteudo && !window.confirm("Isso irá substituir o texto atual. Deseja continuar?")) {
            return;
        }
        formTemplate.setData('conteudo', textoContratoPadrao.trim());
    };

    const getDadosFicticios = () => {
        let locatarioNome = 'João Cliente da Silva';
        let locatarioDoc = '123.456.789-00';
        let locatarioEmail = 'joao.cliente@email.com';
        let itemNome = 'Corolla XEI 2.0 / Flat Beira Mar';
        let valorTotal = '1.450,00';
        let dataInicio = '10/12/2026';
        let dataFim = '15/12/2026';

        if (formTemplate.data.aplicabilidade === 'especifica' && formTemplate.data.aluguel_id) {
            const reserva = listaPendentes.find(r => r.id.toString() === formTemplate.data.aluguel_id.toString());
            if (reserva) {
                locatarioNome = reserva.locatario?.name || locatarioNome;
                locatarioDoc = reserva.locatario?.cpf || locatarioDoc;
                locatarioEmail = reserva.locatario?.email || locatarioEmail;
                itemNome = reserva.item?.nome || itemNome;
                valorTotal = Number(reserva.valor_total).toFixed(2);
                dataInicio = new Date(reserva.data_inicio).toLocaleDateString('pt-BR');
                dataFim = new Date(reserva.data_fim).toLocaleDateString('pt-BR');
            }
        }

        return {
            '{{LOCADOR_NOME}}': lojaSegura?.nome_razao_social || lojaSegura?.nome || 'Estabelecimento Exemplo',
            '{{LOCADOR_DOCUMENTO}}': lojaSegura?.cpf_cnpj || '00.000.000/0001-00',
            '{{LOCATARIO_NOME}}': locatarioNome,
            '{{LOCATARIO_DOCUMENTO}}': locatarioDoc,
            '{{LOCATARIO_EMAIL}}': locatarioEmail,
            '{{ITEM_NOME}}': itemNome,
            '{{VALOR_TOTAL}}': valorTotal,
            '{{DATA_INICIO}}': dataInicio,
            '{{DATA_FIM}}': dataFim,
        };
    };

    const insertTag = (tag) => {
        const conteudoAtual = formTemplate.data.conteudo || '';
        const cursorPosition = textareaRef.current ? textareaRef.current.selectionStart : conteudoAtual.length;
        const textBefore = conteudoAtual.substring(0, cursorPosition);
        const textAfter = conteudoAtual.substring(cursorPosition);
        
        formTemplate.setData('conteudo', textBefore + tag + textAfter);
        
        setTimeout(() => {
            if(textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.selectionEnd = cursorPosition + tag.length;
            }
        }, 50);
    };

    const submitTemplate = (e) => {
        e.preventDefault();

        // Roda as validações de segurança cibernética
        const erroSeguranca = validarSeguranca(formTemplate.data.conteudo);
        if (erroSeguranca) {
            alert(erroSeguranca);
            return;
        }

        if (formTemplate.data.aplicabilidade === 'especifica' && formTemplate.data.aluguel_id) {
            router.post(route('reservas.gerar-assinafy-custom', formTemplate.data.aluguel_id), {
                conteudo_customizado: formTemplate.data.conteudo,
                titulo: formTemplate.data.titulo
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicao();
                    mostrarMensagem('Contrato gerado e enviado para o cliente selecionado!');
                    setActiveTab('assinados');
                }
            });
            return;
        }

        if (isEditing) {
            formTemplate.put(route('contratos.templates.update', formTemplate.data.id), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicao();
                    mostrarMensagem('Modelo atualizado com sucesso!');
                }
            });
        } else {
            formTemplate.post(route('contratos.templates.store', lojaSegura.id), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicao();
                    mostrarMensagem('Novo modelo salvo com sucesso!');
                }
            });
        }
    };

    const editarTemplate = (tpl) => {
        setIsEditing(true);
        formTemplate.setData({
            id: tpl.id,
            titulo: tpl.titulo || '',
            conteudo: tpl.conteudo || '',
            tipo_reserva: tpl.tipo_reserva || 'geral',
            aplicabilidade: 'padrao',
            aluguel_id: '',
            padrao: tpl.padrao === 1 || tpl.padrao === true,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deletarTemplate = (id) => {
        if (window.confirm("Tem certeza que deseja apagar este modelo de contrato?")) {
            router.delete(route('contratos.templates.destroy', id), {
                preserveScroll: true,
                onSuccess: () => mostrarMensagem('Modelo de contrato apagado.')
            });
        }
    };

    const deletarContratoGerado = (id) => {
        if (window.confirm("Atenção: Apagar este registro removerá o histórico do contrato. O cliente já não poderá acessá-lo. Continuar?")) {
            router.delete(route('contratos.gerados.destroy', id), {
                preserveScroll: true,
                onSuccess: () => mostrarMensagem('Histórico do contrato apagado.')
            });
        }
    };

    const cancelarEdicao = () => {
        setIsEditing(false);
        formTemplate.reset();
        formTemplate.clearErrors();
    };

    // ========================================================
    // PRÉ-VISUALIZAÇÃO (PREVIEW) E IMPRESSÃO
    // ========================================================
    const gerarPreview = () => {
        let htmlRenderizado = formTemplate.data.conteudo || '';
        const dadosAtuais = getDadosFicticios();
        
        Object.keys(dadosAtuais).forEach(tag => {
            const regex = new RegExp(tag, 'g');
            htmlRenderizado = htmlRenderizado.replace(regex, `<span style="background-color: #fef08a; padding: 0 4px; border-radius: 4px; font-weight: bold; color: #854d0e;">${dadosAtuais[tag]}</span>`);
        });

        htmlRenderizado = htmlRenderizado.replace(/\n/g, '<br/>');
        setPreviewHtml(htmlRenderizado);
        setShowPreview(true);
    };

    const imprimirPreview = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Contrato Digital</title>
                    <style>
                        body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                        h1 { text-align: center; color: #0F172A; text-transform: uppercase; font-size: 20px; border-bottom: 2px solid #EEE; padding-bottom: 10px; margin-bottom: 30px;}
                        .footer { margin-top: 50px; font-size: 11px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; font-weight: bold; }
                        span { background-color: transparent !important; color: #000 !important; font-weight: normal !important; }
                    </style>
                </head>
                <body>
                    <h1>${formTemplate.data.titulo || 'Contrato de Locação'}</h1>
                    <div>
                        ${previewHtml}
                    </div>
                    <div class="footer">
                        Contrato digital via Waitless
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col max-w-5xl mx-auto w-full">
                    <div className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3"/> Estabelecimentos <ChevronRightIcon className="w-3 h-3"/> 
                        {lojaSegura.id && (
                            <Link href={route('estabelecimentos.configuracoes', lojaSegura.id)} className="hover:text-orange-500 transition">Configurações</Link> 
                        )}
                        <ChevronRightIcon className="w-3 h-3"/> <span className="text-gray-900">Contratos Assinafy</span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <div>
                            <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-3">
                                <DocumentCheckIcon className="w-7 h-7 text-blue-600" /> Gestor de Contratos
                            </h2>
                            <p className="text-sm text-gray-500">Centralize as regras de negócio e assinaturas de {lojaSegura.nome || 'Loja'}</p>
                        </div>
                        {lojaSegura.id && (
                            <Link href={route('estabelecimentos.configuracoes', lojaSegura.id)} className="text-sm font-bold text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm">
                                <ArrowLeftIcon className="w-4 h-4"/> Voltar
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Gestor de Contratos - Assinafy" />

            <div className="bg-[#FBF9F9] min-h-screen pb-12">
                
                {(mensagemSucesso || flash?.success || flash?.error) && (
                    <div className="max-w-5xl mx-auto mt-4 px-4 sm:px-6 lg:px-8 space-y-2">
                        {(mensagemSucesso || flash?.success) && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                                <CheckBadgeIcon className="w-5 h-5" /> <strong className="font-bold">Sucesso!</strong> {mensagemSucesso || flash.success}
                            </div>
                        )}
                        {flash?.error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 animate-in fade-in">
                                <ShieldCheckIcon className="w-5 h-5" /> <strong className="font-bold">Erro:</strong> {flash.error}
                            </div>
                        )}
                    </div>
                )}

                {/* CONTAINER CENTRALIZADO */}
                <div className="max-w-5xl mx-auto mt-6 px-4 sm:px-6 lg:px-8">
                    
                    <div className="flex space-x-2 border-b border-gray-200 mb-8 overflow-x-auto">
                        <button onClick={() => setActiveTab('modelos')} className={`pb-4 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'modelos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <PencilSquareIcon className="w-5 h-5" /> Criador de Modelos
                        </button>
                        <button onClick={() => setActiveTab('assinados')} className={`pb-4 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'assinados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <DocumentTextIcon className="w-5 h-5" /> Tabela de Assinaturas
                        </button>
                    </div>

                    {/* ======================================================== */}
                    {/* ABA 1: MODELOS DE CONTRATO                               */}
                    {/* ======================================================== */}
                    {activeTab === 'modelos' && (
                        <div className="space-y-8 animate-in fade-in">
                            
                            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-gray-200">
                                <div className="flex flex-col md:flex-row justify-between md:items-start mb-6 gap-4">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                            {isEditing ? <><PencilSquareIcon className="w-6 h-6 text-blue-500"/> Editando Modelo</> : <><PlusIcon className="w-6 h-6 text-blue-500"/> Redigir Novo Contrato</>}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">Escreva os termos jurídicos e use as variáveis para auto-completar nomes e datas.</p>
                                    </div>
                                    <button onClick={carregarTextoPadrao} type="button" className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2 shrink-0">
                                        <DocumentTextIcon className="w-4 h-4"/> Usar Padrão Profissional
                                    </button>
                                </div>

                                <form onSubmit={submitTemplate} className="space-y-8">
                                    
                                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                        <InputLabel value="Onde este contrato será usado? *" className="mb-3 text-gray-800" />
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <label className={`flex-1 border p-4 rounded-xl cursor-pointer transition ${formTemplate.data.aplicabilidade === 'padrao' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500' : 'bg-white hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    <input type="radio" name="aplicabilidade" value="padrao" checked={formTemplate.data.aplicabilidade === 'padrao'} onChange={() => formTemplate.setData('aplicabilidade', 'padrao')} className="text-blue-600 focus:ring-blue-500"/>
                                                    <span className="font-bold text-gray-900">Salvar na Biblioteca</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 ml-6">Deixar pronto para que o sistema use automaticamente no futuro.</p>
                                            </label>

                                            <label className={`flex-1 border p-4 rounded-xl cursor-pointer transition ${formTemplate.data.aplicabilidade === 'especifica' ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-500' : 'bg-white hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    <input type="radio" name="aplicabilidade" value="especifica" checked={formTemplate.data.aplicabilidade === 'especifica'} onChange={() => formTemplate.setData('aplicabilidade', 'especifica')} className="text-orange-600 focus:ring-orange-500"/>
                                                    <span className="font-bold text-gray-900">Enviar para Reserva Pendente</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 ml-6">Criar este texto e enviá-lo diretamente a um cliente que está à espera.</p>
                                            </label>
                                        </div>

                                        {formTemplate.data.aplicabilidade === 'especifica' && (
                                            <div className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in slide-in-from-top-2">
                                                <InputLabel value="Selecione o Cliente / Reserva *" />
                                                <select 
                                                    className="w-full mt-1 border-orange-300 rounded-xl text-sm focus:border-orange-500 focus:ring-orange-500 bg-white" 
                                                    value={formTemplate.data.aluguel_id} 
                                                    onChange={e => formTemplate.setData('aluguel_id', e.target.value)}
                                                    required={formTemplate.data.aplicabilidade === 'especifica'}
                                                >
                                                    <option value="">Selecione uma reserva que exige contrato...</option>
                                                    {listaPendentes.map(res => (
                                                        <option key={res.id} value={res.id}>
                                                            {res.codigo_reserva} - Cliente: {res.locatario?.name} (Item: {res.item?.nome})
                                                        </option>
                                                    ))}
                                                </select>
                                                {listaPendentes.length === 0 && <p className="text-xs text-orange-600 mt-2">Você não possui reservas pendentes de contrato no momento.</p>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <InputLabel value="Título de Identificação (Visível para você) *" />
                                            <TextInput className="w-full mt-1 focus:border-blue-500 focus:ring-blue-500" value={formTemplate.data.titulo} onChange={e => formTemplate.setData('titulo', e.target.value)} placeholder="Ex: Contrato de Imóveis Padrão 2026" required />
                                        </div>
                                        
                                        {formTemplate.data.aplicabilidade === 'padrao' && (
                                            <>
                                                <div>
                                                    <InputLabel value="Vincular a qual tipo de reserva? *" />
                                                    <select className="w-full mt-1 border-gray-300 rounded-xl text-sm focus:border-blue-500 focus:ring-blue-500" value={formTemplate.data.tipo_reserva} onChange={e => formTemplate.setData('tipo_reserva', e.target.value)} required>
                                                        <option value="geral">Geral (Todos os Itens)</option>
                                                        <option value="carro">Veículos / Carros</option>
                                                        <option value="casa">Imóveis / Espaços</option>
                                                        <option value="equipamento">Máquinas e Equipamentos</option>
                                                    </select>
                                                </div>

                                                <div className="flex items-center pt-6">
                                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border hover:bg-gray-100 transition w-full">
                                                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5" checked={formTemplate.data.padrao} onChange={e => formTemplate.setData('padrao', e.target.checked)} />
                                                        <span className="text-sm font-bold text-gray-700">Tornar Modelo Padrão Oficial</span>
                                                    </label>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 👉 UI MÁGICA REFORMULADA COMO PEDIDO (Título em cima, código em baixo) */}
                                    <div>
                                        <div className="border border-blue-200 bg-blue-50/50 p-6 rounded-t-2xl border-b-0">
                                            <div className="flex justify-between items-center mb-4">
                                                <InputLabel value="Variáveis de Auto-Preenchimento" className="text-blue-900 font-black text-base" />
                                                <span className="text-[10px] uppercase font-bold text-blue-500 tracking-widest">Clique no card para inserir no texto</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {variaveisMagicas.map(v => (
                                                    <button 
                                                        type="button" 
                                                        key={v.tag} 
                                                        onClick={() => insertTag(v.tag)} 
                                                        className="flex flex-col items-center justify-center p-3 bg-white border border-blue-200 text-blue-800 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition group" 
                                                        title="Inserir Variável"
                                                    >
                                                        <span className="text-[11px] font-black uppercase text-center mb-1 group-hover:text-blue-100">{v.desc}</span>
                                                        <span className="text-xs font-mono font-bold">{v.tag}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <textarea 
                                                ref={textareaRef}
                                                className="w-full border-gray-300 rounded-b-2xl focus:border-blue-500 focus:ring-blue-500 font-mono text-sm leading-relaxed p-6 bg-white min-h-[400px] shadow-inner" 
                                                value={formTemplate.data.conteudo || ''} 
                                                onChange={e => formTemplate.setData('conteudo', e.target.value)} 
                                                placeholder="Pelo presente instrumento, a locadora {{LOCADOR_NOME}}..."
                                                required
                                            ></textarea>
                                            
                                            <div className="absolute top-4 right-4">
                                                <button type="button" onClick={gerarPreview} disabled={!formTemplate.data.conteudo} className="text-xs font-bold text-white bg-gray-900 hover:bg-black px-4 py-2 rounded-lg flex items-center gap-2 shadow-md disabled:opacity-50 transition">
                                                    <EyeIcon className="w-4 h-4"/> Ver Prévia
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 👉 BOTÃO VERDE COMO SOLICITADO */}
                                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                        {isEditing && <button type="button" onClick={cancelarEdicao} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-800 transition">Cancelar Edição</button>}
                                        
                                        {formTemplate.data.aplicabilidade === 'especifica' ? (
                                            <PrimaryButton className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl shadow-lg text-lg flex items-center gap-2 transition" disabled={formTemplate.processing || (formTemplate.data.aplicabilidade === 'especifica' && !formTemplate.data.aluguel_id)}>
                                                <DocumentCheckIcon className="w-5 h-5"/> Enviar Contrato ao Cliente
                                            </PrimaryButton>
                                        ) : (
                                            <PrimaryButton className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl shadow-lg text-lg flex items-center gap-2 transition" disabled={formTemplate.processing}>
                                                <ArchiveBoxIcon className="w-5 h-5"/> {isEditing ? 'Atualizar Modelo na Biblioteca' : 'Salvar Novo Modelo'}
                                            </PrimaryButton>
                                        )}
                                    </div>
                                </form>
                            </div>

                            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                                <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                                    <ArchiveBoxIcon className="w-6 h-6 text-gray-400"/>
                                    <h3 className="font-black text-gray-900 text-lg">Sua Biblioteca de Contratos</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {listaTemplates.length === 0 ? (
                                        <p className="p-12 text-center text-sm text-gray-500 font-medium">Você ainda não salvou nenhum modelo padrão.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 p-4 gap-4">
                                            {listaTemplates.map(tpl => (
                                                <div key={tpl.id} className="p-5 border border-gray-100 rounded-2xl hover:border-blue-300 hover:shadow-md transition bg-white flex flex-col h-full">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <h4 className="font-black text-gray-900 text-base leading-tight pr-4">{tpl.titulo}</h4>
                                                        {tpl.padrao === 1 && <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0">Padrão</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 font-bold mb-4 uppercase tracking-widest bg-gray-50 inline-block px-3 py-1 rounded-md self-start">
                                                        Uso: {tpl.tipo_reserva}
                                                    </p>
                                                    <div className="flex gap-2 mt-auto border-t border-gray-50 pt-4">
                                                        <button onClick={() => { formTemplate.setData('conteudo', tpl.conteudo); gerarPreview(); }} className="flex-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition flex justify-center items-center gap-1">
                                                            <EyeIcon className="w-4 h-4"/> LER
                                                        </button>
                                                        <button onClick={() => editarTemplate(tpl)} className="flex-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 py-2.5 rounded-xl transition flex justify-center items-center gap-1">
                                                            <PencilSquareIcon className="w-4 h-4"/> EDITAR
                                                        </button>
                                                        <button onClick={() => deletarTemplate(tpl.id)} className="w-10 flex-shrink-0 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 py-2.5 rounded-xl transition flex justify-center items-center">
                                                            <TrashIcon className="w-4 h-4"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* ABA 2: CONTRATOS GERADOS E ASSINADOS                     */}
                    {/* ======================================================== */}
                    {activeTab === 'assinados' && (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900">Documentos Assinados e Pendentes</h3>
                                    <p className="text-sm text-gray-500 mt-1">Gerencie todos os contratos que já foram enviados aos clientes.</p>
                                </div>
                                <UserGroupIcon className="w-10 h-10 text-gray-300 hidden md:block" />
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-200">
                                        <tr>
                                            <th className="p-5">ID / Localizador</th>
                                            <th className="p-5">Locatário</th>
                                            <th className="p-5">Item Resumo</th>
                                            <th className="p-5">Situação Jurídica</th>
                                            <th className="p-5 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {listaContratos.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-16 text-center text-gray-400">
                                                    <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                                                    <span className="font-bold text-base">Ainda não enviou nenhum contrato.</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            listaContratos.map(contrato => (
                                                <tr key={contrato.id} className="hover:bg-gray-50 transition group">
                                                    <td className="p-5 font-mono text-xs font-bold text-gray-500">{contrato.numero_contrato || contrato.aluguel?.codigo_reserva}</td>
                                                    <td className="p-5 font-black text-gray-900">{contrato.aluguel?.locatario?.name || 'Desconhecido'}</td>
                                                    <td className="p-5 font-medium text-gray-600 truncate max-w-[200px]" title={contrato.aluguel?.item?.nome}>
                                                        {contrato.aluguel?.item?.nome || 'N/A'}
                                                    </td>
                                                    <td className="p-5">
                                                        {contrato.assinado ? (
                                                            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border border-green-200">
                                                                <CheckCircleIcon className="w-4 h-4"/> Assinado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border border-amber-200">
                                                                <ClockIcon className="w-4 h-4"/> Aguardando
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-5 text-right space-x-2">
                                                        {contrato.arquivo_pdf && (
                                                            <a href={'/' + contrato.arquivo_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200 hover:bg-blue-100 transition shadow-sm">
                                                                <ArrowDownTrayIcon className="w-4 h-4"/> Obter PDF
                                                            </a>
                                                        )}
                                                        {!contrato.assinado && contrato.url_assinatura && (
                                                            <a href={contrato.url_assinatura} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-100 transition shadow-sm">
                                                                <ArrowTopRightOnSquareIcon className="w-4 h-4"/> Ver Link
                                                            </a>
                                                        )}
                                                        <button onClick={() => deletarContratoGerado(contrato.id)} className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-white border border-red-100 px-3 py-2 rounded-xl hover:bg-red-50 hover:text-red-700 transition opacity-0 group-hover:opacity-100">
                                                            <TrashIcon className="w-4 h-4"/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ======================================================== */}
            {/* MODAL DE PRÉ-VISUALIZAÇÃO (SIMULA FOLHA A4)              */}
            {/* ======================================================== */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
                    <div className="bg-gray-100 w-full max-w-4xl h-[95vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-gray-300">
                        
                        <div className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-black text-gray-900 flex items-center gap-2 text-lg"><EyeIcon className="w-6 h-6 text-blue-500"/> Validador de Contrato</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">Os campos marcados em amarelo simulam as informações reais para verificação.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={imprimirPreview} className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-black transition shadow-md">
                                    <ArrowDownTrayIcon className="w-4 h-4"/> Imprimir / Salvar PDF
                                </button>
                                <button onClick={() => setShowPreview(false)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition bg-gray-100">
                                    <XMarkIcon className="w-6 h-6"/>
                                </button>
                            </div>
                        </div>

                        {/* Corpo do Modal - Simula Papel A4 com scroll independente */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-gray-200 flex justify-center">
                            <div 
                                className="bg-white shadow-xl p-10 md:p-16 w-full max-w-[800px] text-[15px] text-gray-800 leading-[1.8] border border-gray-300"
                                style={{ minHeight: '1122px' }} /* Altura proporcional a A4 */
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                    </div>
                </div>
            )}

        </AuthenticatedLayout>
    );
}