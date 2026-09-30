import React, { useState, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import { 
    DocumentTextIcon, DocumentCheckIcon, PlusIcon, 
    PencilSquareIcon, EyeIcon, ArrowDownTrayIcon, 
    XMarkIcon, CheckBadgeIcon, ShieldCheckIcon,
    BuildingOfficeIcon, ChevronRightIcon,
    ArrowLeftIcon, ArchiveBoxIcon, ClockIcon, 
    CheckCircleIcon, ArrowTopRightOnSquareIcon, 
    TrashIcon, UserGroupIcon, DocumentDuplicateIcon,
    BoltIcon, SparklesIcon
} from '@heroicons/react/24/solid';

function ContratosConteudo({ auth, estabelecimento, templates = [], contratosGerados = { data: [] }, reservasPendentes = [] }) {
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
        { desc: 'Nome Locador', tag: '{{LOCADOR_NOME}}' },
        { desc: 'Doc Locador', tag: '{{LOCADOR_DOCUMENTO}}' },
        { desc: 'Nome Locatário', tag: '{{LOCATARIO_NOME}}' },
        { desc: 'CPF Locatário', tag: '{{LOCATARIO_DOCUMENTO}}' },
        { desc: 'E-mail Locatário', tag: '{{LOCATARIO_EMAIL}}' },
        { desc: 'Nome do Item', tag: '{{ITEM_NOME}}' },
        { desc: 'Valor Total', tag: '{{VALOR_TOTAL}}' },
        { desc: 'Data Início', tag: '{{DATA_INICIO}}' },
        { desc: 'Data Término', tag: '{{DATA_FIM}}' },
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

<h3>4. DO VALOR E FORMA DE PAGAMENTO</h3>
<p>O valor total da locação é de <strong>R$ {{VALOR_TOTAL}}</strong>, sendo o aluguel mensal no valor de R$ {{VALOR_MENSAL}} ({{VALOR_MENSAL_EXTENSO}}).</p>

<br><br><br>

<div style="text-align: center; margin-top: 60px;">
    <p>Local e Data: {{CIDADE}}, {{DATA_ATUAL}}.</p>
    
    <p style="margin-top: 40px;">_________________________________________________________</p>
    <p><strong>{{LOCADOR_NOME}}</strong><br>Locador(a) - CPF: {{LOCADOR_DOCUMENTO}}</p>
    
    <br><br>
    
    <p>_________________________________________________________</p>
    <p><strong>{{LOCATARIO_NOME}}</strong><br>Locatário(a) - CPF: {{LOCATARIO_DOCUMENTO}}</p>
</div>
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
                locatarioDoc = reserva.locatario?.cpf_cnpj || locatarioDoc;
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

        const erroSeguranca = validarSeguranca(formTemplate.data.conteudo);
        if (erroSeguranca) {
            alert(erroSeguranca);
            return;
        }

        if (formTemplate.data.aplicabilidade === 'especifica' && formTemplate.data.aluguel_id) {
            router.post(route('reservas.gerar-contrato', formTemplate.data.aluguel_id), {
                conteudo_customizado: formTemplate.data.conteudo,
                titulo: formTemplate.data.titulo
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicao();
                    mostrarMensagem('Contrato gerado com sucesso! Envie para o cliente na aba "Contratos Gerados".');
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
                    mostrarMensagem('Modelo atualizado com sucesso na biblioteca!');
                }
            });
        } else {
            formTemplate.post(route('contratos.templates.store', lojaSegura.id), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicao();
                    mostrarMensagem('Novo modelo salvo com sucesso na biblioteca!');
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
        if (window.confirm("Tem certeza que deseja excluir permanentemente este modelo de contrato?")) {
            router.delete(route('contratos.templates.destroy', id), {
                preserveScroll: true,
                onSuccess: () => mostrarMensagem('Modelo de contrato removido com sucesso.')
            });
        }
    };

    const deletarContratoGerado = (id) => {
        if (window.confirm("Atenção: A exclusão removerá o histórico deste contrato. O cliente perderá o acesso. Deseja continuar?")) {
            router.delete(route('contratos.gerados.destroy', id), {
                preserveScroll: true,
                onSuccess: () => mostrarMensagem('Histórico do contrato removido com sucesso.')
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
            htmlRenderizado = htmlRenderizado.replace(regex, `<span style="background-color: #FEF3C7; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #92400E; border: 1px solid #FDE68A;">${dadosAtuais[tag]}</span>`);
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
                    <title>Visualização de Contrato</title>
                    <style>
                        body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; padding: 40px; color: #1F2937; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                        h1 { text-align: center; color: #111827; text-transform: uppercase; font-size: 22px; border-bottom: 2px solid #E5E7EB; padding-bottom: 12px; margin-bottom: 30px;}
                        .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 20px; font-weight: bold; }
                        span { background-color: transparent !important; color: #000 !important; font-weight: normal !important; border: none !important; padding: 0 !important; }
                    </style>
                </head>
                <body>
                    <h1>${formTemplate.data.titulo || 'Contrato de Locação'}</h1>
                    <div>${previewHtml}</div>
                    <div class="footer">Documento gerado eletronicamente via plataforma Lokyva</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col max-w-6xl mx-auto w-full">
                    {/* BREADCRUMB */}
                    <div className="text-xs text-gray-500 font-semibold mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                        <BuildingOfficeIcon className="w-3.5 h-3.5"/> Estabelecimentos 
                        <ChevronRightIcon className="w-3 h-3 text-gray-300"/> 
                        {lojaSegura.id && (
                            <Link href={route('estabelecimentos.configuracoes', lojaSegura.id)} className="hover:text-indigo-600 transition">Configurações</Link> 
                        )}
                        <ChevronRightIcon className="w-3 h-3 text-gray-300"/> 
                        <span className="text-indigo-600 font-bold">Contratos</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black leading-tight text-gray-900 flex items-center gap-3 tracking-tight">
                                <DocumentCheckIcon className="w-8 h-8 text-indigo-600" /> Gestor de Contratos
                            </h2>
                            <p className="text-sm text-gray-500 mt-1.5 font-medium">Crie, gerencie e envie termos jurídicos de forma automatizada.</p>
                        </div>
                        {lojaSegura.id && (
                            <Link href={route('estabelecimentos.configuracoes', lojaSegura.id)} className="inline-flex items-center justify-center gap-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition shadow-sm w-full sm:w-auto">
                                <ArrowLeftIcon className="w-4 h-4"/> Voltar
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Gestor de Contratos - Lokyva" />

            <div className="bg-gray-50/50 min-h-screen pb-16">
                
                {/* NOTIFICAÇÕES TOAST */}
                {(mensagemSucesso || flash?.success || flash?.error) && (
                    <div className="max-w-6xl mx-auto pt-6 px-4 sm:px-6 lg:px-8">
                        {(mensagemSucesso || flash?.success) && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-2xl shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                                <CheckBadgeIcon className="w-6 h-6 text-emerald-500 shrink-0" /> 
                                <span className="text-sm font-medium"><strong className="font-bold">Sucesso!</strong> {mensagemSucesso || flash.success}</span>
                            </div>
                        )}
                        {flash?.error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl shadow-sm flex items-center gap-3 animate-in fade-in">
                                <ShieldCheckIcon className="w-6 h-6 text-red-500 shrink-0" /> 
                                <span className="text-sm font-medium"><strong className="font-bold">Ação bloqueada:</strong> {flash.error}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="max-w-6xl mx-auto mt-6 px-4 sm:px-6 lg:px-8">
                    
                    {/* TABS (Segmented Control) */}
                    <div className="flex p-1 space-x-1 bg-gray-200/60 rounded-xl max-w-md mb-8 shadow-inner">
                        <button 
                            onClick={() => setActiveTab('modelos')} 
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'modelos' ? 'bg-white text-indigo-700 shadow shadow-gray-200/50 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/80'}`}
                        >
                            <PencilSquareIcon className="w-4 h-4" /> Criador de Modelos
                        </button>
                        <button 
                            onClick={() => setActiveTab('assinados')} 
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'assinados' ? 'bg-white text-indigo-700 shadow shadow-gray-200/50 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/80'}`}
                        >
                            <DocumentTextIcon className="w-4 h-4" /> Contratos Gerados
                        </button>
                    </div>

                    {/* ======================================================== */}
                    {/* ABA 1: MODELOS DE CONTRATO                               */}
                    {/* ======================================================== */}
                    {activeTab === 'modelos' && (
                        <div className="space-y-8 animate-in fade-in">
                            
                            {/* EDITOR DE CONTRATOS */}
                            <div className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-gray-100 ring-1 ring-gray-900/5">
                                <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-8 gap-5 border-b border-gray-100 pb-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
                                            {isEditing ? <><PencilSquareIcon className="w-7 h-7 text-indigo-500"/> Editando Modelo Salvo</> : <><PlusIcon className="w-7 h-7 text-indigo-500"/> Redigir Novo Contrato</>}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1.5">Escreva os termos jurídicos e utilize as variáveis para preenchimento inteligente.</p>
                                    </div>
                                    <button 
                                        onClick={carregarTextoPadrao} 
                                        type="button" 
                                        className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-xl shadow-md shadow-gray-900/10 transition-transform active:scale-95 flex items-center justify-center gap-2 shrink-0"
                                    >
                                        <BoltIcon className="w-4 h-4 text-yellow-400"/> Carregar Padrão Lokyva
                                    </button>
                                </div>

                                <form onSubmit={submitTemplate} className="space-y-8">
                                    
                                    {/* APLICABILIDADE (Radio Cards) */}
                                    <div>
                                        <InputLabel value="Objetivo deste contrato *" className="mb-3 text-gray-900 font-bold" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <label className={`relative flex cursor-pointer rounded-2xl border p-5 focus:outline-none transition-all duration-200 ${formTemplate.data.aplicabilidade === 'padrao' ? 'bg-indigo-50/50 border-indigo-600 ring-1 ring-indigo-600 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                                                <div className="flex items-start gap-4 w-full">
                                                    <div className="flex items-center h-6">
                                                        <input type="radio" name="aplicabilidade" value="padrao" checked={formTemplate.data.aplicabilidade === 'padrao'} onChange={() => formTemplate.setData('aplicabilidade', 'padrao')} className="h-5 w-5 rounded-full border-gray-300 text-indigo-600 focus:ring-indigo-600"/>
                                                    </div>
                                                    <div className="flex flex-col flex-1">
                                                        <span className={`block text-sm font-bold ${formTemplate.data.aplicabilidade === 'padrao' ? 'text-indigo-900' : 'text-gray-900'}`}>Salvar na Biblioteca</span>
                                                        <span className="block text-xs text-gray-500 mt-1 leading-relaxed">Crie um modelo reutilizável para que o sistema o anexe automaticamente a futuras reservas.</span>
                                                    </div>
                                                    <ArchiveBoxIcon className={`w-6 h-6 shrink-0 ${formTemplate.data.aplicabilidade === 'padrao' ? 'text-indigo-600' : 'text-gray-300'}`} />
                                                </div>
                                            </label>

                                            <label className={`relative flex cursor-pointer rounded-2xl border p-5 focus:outline-none transition-all duration-200 ${formTemplate.data.aplicabilidade === 'especifica' ? 'bg-orange-50/50 border-orange-500 ring-1 ring-orange-500 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                                                <div className="flex items-start gap-4 w-full">
                                                    <div className="flex items-center h-6">
                                                        <input type="radio" name="aplicabilidade" value="especifica" checked={formTemplate.data.aplicabilidade === 'especifica'} onChange={() => formTemplate.setData('aplicabilidade', 'especifica')} className="h-5 w-5 rounded-full border-gray-300 text-orange-600 focus:ring-orange-600"/>
                                                    </div>
                                                    <div className="flex flex-col flex-1">
                                                        <span className={`block text-sm font-bold ${formTemplate.data.aplicabilidade === 'especifica' ? 'text-orange-900' : 'text-gray-900'}`}>Uso Único (Enviar para Reserva)</span>
                                                        <span className="block text-xs text-gray-500 mt-1 leading-relaxed">Redija um contrato personalizado e envie diretamente a um cliente que possui uma reserva pendente.</span>
                                                    </div>
                                                    <DocumentTextIcon className={`w-6 h-6 shrink-0 ${formTemplate.data.aplicabilidade === 'especifica' ? 'text-orange-500' : 'text-gray-300'}`} />
                                                </div>
                                            </label>
                                        </div>

                                        {/* Dropdown de Reservas Pendentes com Animação */}
                                        <div className={`transition-all duration-300 overflow-hidden ${formTemplate.data.aplicabilidade === 'especifica' ? 'max-h-40 mt-5 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="bg-orange-50/50 border border-orange-200 p-5 rounded-xl">
                                                <InputLabel value="Selecione o Cliente / Reserva pendente *" className="text-orange-900" />
                                                <select 
                                                    className="w-full mt-2 border-orange-200 rounded-xl text-sm focus:border-orange-500 focus:ring-orange-500 bg-white shadow-sm py-2.5" 
                                                    value={formTemplate.data.aluguel_id} 
                                                    onChange={e => formTemplate.setData('aluguel_id', e.target.value)}
                                                    required={formTemplate.data.aplicabilidade === 'especifica'}
                                                >
                                                    <option value="">Selecione uma reserva vinculada...</option>
                                                    {listaPendentes.map(res => (
                                                        <option key={res.id} value={res.id}>
                                                            ID: {res.codigo_reserva} — Cliente: {res.locatario?.name} (Item: {res.item?.nome})
                                                        </option>
                                                    ))}
                                                </select>
                                                {listaPendentes.length === 0 && <p className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1"><ShieldCheckIcon className="w-4 h-4"/> Nenhuma reserva aguardando contrato no momento.</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                        <div className="md:col-span-2">
                                            <InputLabel value="Título de Identificação (Visível apenas para você) *" />
                                            <TextInput 
                                                className="w-full mt-2 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl" 
                                                value={formTemplate.data.titulo} 
                                                onChange={e => formTemplate.setData('titulo', e.target.value)} 
                                                placeholder="Ex: Contrato Padrão - Imóveis Comerciais 2026" 
                                                required 
                                            />
                                        </div>
                                        
                                        {formTemplate.data.aplicabilidade === 'padrao' && (
                                            <>
                                                <div>
                                                    <InputLabel value="Vincular a qual tipo de serviço? *" />
                                                    <select 
                                                        className="w-full mt-2 border-gray-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm py-2.5" 
                                                        value={formTemplate.data.tipo_reserva} 
                                                        onChange={e => formTemplate.setData('tipo_reserva', e.target.value)} 
                                                        required
                                                    >
                                                        <option value="geral">Geral (Padrão para todos)</option>
                                                        <option value="carro">Veículos / Frota</option>
                                                        <option value="casa">Imóveis / Espaços</option>
                                                        <option value="equipamento">Máquinas e Equipamentos</option>
                                                    </select>
                                                </div>

                                                <div className="flex items-end">
                                                    <label className="flex items-center gap-3 cursor-pointer bg-gray-50 px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition w-full h-[42px]">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 w-4 h-4" 
                                                            checked={formTemplate.data.padrao} 
                                                            onChange={e => formTemplate.setData('padrao', e.target.checked)} 
                                                        />
                                                        <span className="text-sm font-bold text-gray-700">Tornar Modelo Padrão da Categoria</span>
                                                    </label>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* ÁREA DO EDITOR E VARIÁVEIS */}
                                    <div className="pt-2">
                                        <div className="border border-gray-200 bg-gray-50 rounded-t-2xl border-b-0 p-5">
                                            <div className="flex justify-between items-center mb-4">
                                                <InputLabel value="Variáveis Dinâmicas (Auto-Preenchimento)" className="text-gray-800 font-bold" />
                                                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest hidden sm:block">Clique para inserir no texto</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                                {variaveisMagicas.map(v => (
                                                    <button 
                                                        type="button" 
                                                        key={v.tag} 
                                                        onClick={() => insertTag(v.tag)} 
                                                        className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition group" 
                                                        title="Inserir Variável"
                                                    >
                                                        <span className="text-[10px] font-bold uppercase text-center mb-1 text-gray-500 group-hover:text-indigo-600">{v.desc}</span>
                                                        <span className="text-[11px] font-mono font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">{v.tag}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="relative group">
                                            <textarea 
                                                ref={textareaRef}
                                                className="w-full border-gray-200 rounded-b-2xl focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm leading-relaxed p-6 bg-white min-h-[450px] shadow-inner transition-colors resize-y" 
                                                value={formTemplate.data.conteudo || ''} 
                                                onChange={e => formTemplate.setData('conteudo', e.target.value)} 
                                                placeholder="Pelo presente instrumento, a locadora {{LOCADOR_NOME}}..."
                                                required
                                            ></textarea>
                                            
                                            <div className="absolute top-4 right-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    type="button" 
                                                    onClick={gerarPreview} 
                                                    disabled={!formTemplate.data.conteudo} 
                                                    className="text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
                                                >
                                                    <EyeIcon className="w-4 h-4 text-indigo-500"/> Ver Prévia Visual
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AÇÕES FINAIS */}
                                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-gray-100">
                                        {isEditing && (
                                            <button type="button" onClick={cancelarEdicao} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition">
                                                Cancelar Edição
                                            </button>
                                        )}
                                        
                                        {formTemplate.data.aplicabilidade === 'especifica' ? (
                                            <PrimaryButton className="px-8 py-3.5 bg-green-600 hover:bg-green-700 focus:bg-green-700 active:bg-green-800 rounded-xl shadow-md text-base flex justify-center items-center gap-2 transition" disabled={formTemplate.processing || !formTemplate.data.aluguel_id}>
                                                <DocumentCheckIcon className="w-5 h-5"/> Enviar Contrato ao Cliente
                                            </PrimaryButton>
                                        ) : (
                                            <PrimaryButton className="px-8 py-3.5 bg-green-600 hover:bg-green-700 focus:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md text-base flex justify-center items-center gap-2 transition" disabled={formTemplate.processing}>
                                                <ArchiveBoxIcon className="w-5 h-5"/> {isEditing ? 'Atualizar Modelo' : 'Salvar na Biblioteca'}
                                            </PrimaryButton>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* BIBLIOTECA DE TEMPLATES */}
                            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden mt-10">
                                <div className="p-6 sm:p-8 border-b border-gray-100 flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl">
                                        <DocumentDuplicateIcon className="w-6 h-6 text-indigo-600"/>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 text-xl">Sua Biblioteca de Modelos</h3>
                                        <p className="text-sm text-gray-500">Acesse, edite ou apague os contratos padrões da sua loja.</p>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50/30">
                                    {listaTemplates.length === 0 ? (
                                        <div className="p-16 flex flex-col items-center justify-center text-center">
                                            <ArchiveBoxIcon className="w-16 h-16 text-gray-200 mb-4" />
                                            <h4 className="text-lg font-bold text-gray-900">Nenhum modelo salvo</h4>
                                            <p className="text-sm text-gray-500 mt-1 max-w-sm">Você ainda não possui modelos na biblioteca. Utilize o editor acima para criar o primeiro.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6 gap-6">
                                            {listaTemplates.map(tpl => (
                                                <div key={tpl.id} className="p-6 border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-900/5 transition-all bg-white flex flex-col h-full group relative">
                                                    
                                                    {tpl.padrao === 1 && (
                                                        <div className="absolute -top-3 -right-3 bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                                                            Padrão
                                                        </div>
                                                    )}

                                                    <h4 className="font-black text-gray-900 text-lg leading-tight mb-2 pr-4">{tpl.titulo}</h4>
                                                    
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-6">
                                                        <TagIcon className="w-3.5 h-3.5" /> {tpl.tipo_reserva}
                                                    </p>
                                                    
                                                    <div className="flex gap-2 mt-auto">
                                                        <button 
                                                            onClick={() => { formTemplate.setData('conteudo', tpl.conteudo); gerarPreview(); }} 
                                                            className="flex-1 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2.5 rounded-xl transition flex justify-center items-center gap-1.5"
                                                        >
                                                            <EyeIcon className="w-4 h-4"/> LER
                                                        </button>
                                                        <button 
                                                            onClick={() => editarTemplate(tpl)} 
                                                            className="flex-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 py-2.5 rounded-xl transition flex justify-center items-center gap-1.5"
                                                        >
                                                            <PencilSquareIcon className="w-4 h-4"/> EDITAR
                                                        </button>
                                                        <button 
                                                            onClick={() => deletarTemplate(tpl.id)} 
                                                            className="w-11 flex-shrink-0 text-xs font-bold text-red-500 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 py-2.5 rounded-xl transition flex justify-center items-center"
                                                            title="Excluir"
                                                        >
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
                        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
                            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hidden sm:block">
                                        <UserGroupIcon className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-black text-gray-900">Histórico de Contratos</h3>
                                        <p className="text-sm text-gray-500 mt-1">Consulte, baixe ou reenvie contratos vinculados a clientes.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white text-gray-400 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4">Protocolo / Reserva</th>
                                            <th className="px-6 py-4">Cliente (Locatário)</th>
                                            <th className="px-6 py-4">Serviço Vinculado</th>
                                            <th className="px-6 py-4">Status de Envio</th>
                                            <th className="px-6 py-4 text-right">Opções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {listaContratos.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-20 text-center text-gray-400">
                                                    <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-200"/>
                                                    <span className="font-bold text-base text-gray-500">Nenhum contrato foi gerado para clientes ainda.</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            listaContratos.map(contrato => (
                                                <tr key={contrato.id} className="hover:bg-gray-50/80 transition group">
                                                    <td className="px-6 py-4 font-mono text-xs font-bold text-gray-500">
                                                        #{contrato.numero_contrato || contrato.aluguel?.codigo_reserva}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-gray-900">
                                                        {contrato.aluguel?.locatario?.name || 'Não Informado'}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-600">
                                                        <div className="truncate max-w-[200px]" title={contrato.aluguel?.item?.nome}>
                                                            {contrato.aluguel?.item?.nome || 'Item Removido/N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {contrato.enviado_em ? (
                                                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1.5 rounded-md uppercase tracking-wider border border-emerald-200">
                                                                <CheckCircleIcon className="w-3.5 h-3.5"/> Enviado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1.5 rounded-md uppercase tracking-wider border border-amber-200">
                                                                <ClockIcon className="w-3.5 h-3.5"/> Pendente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                                                        {contrato.arquivo_pdf && (
                                                            <a href={'/storage/' + contrato.arquivo_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition" title="Baixar PDF">
                                                                <span className="text-[10px] font-black tracking-tighter">PDF</span>
                                                            </a>
                                                        )}

                                                        {contrato.arquivo_docx && (
                                                            <a href={'/storage/' + contrato.arquivo_docx} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition" title="Baixar Word (DOCX)">
                                                                <span className="text-[10px] font-black tracking-tighter">DOC</span>
                                                            </a>
                                                        )}

                                                        {contrato.aluguel?.locatario?.email && (
                                                            <button
                                                                onClick={() => router.post(route('contratos.enviar-email', contrato.id), {}, {
                                                                    preserveScroll: true,
                                                                    onSuccess: () => mostrarMensagem('Contrato enviado com sucesso para o e-mail do cliente!'),
                                                                })}
                                                                className="inline-flex items-center justify-center w-8 h-8 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                                                title="Reenviar por E-mail"
                                                            >
                                                                <ArrowTopRightOnSquareIcon className="w-4 h-4"/>
                                                            </button>
                                                        )}

                                                        {contrato.aluguel?.locatario?.telefone && contrato.arquivo_pdf && (
                                                            <a
                                                                href={`https://api.whatsapp.com/send?phone=55${contrato.aluguel.locatario.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá, ${contrato.aluguel.locatario.name}! Segue o seu contrato referente à reserva na Lokyva: ${window.location.origin}/storage/${contrato.arquivo_pdf}`)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center justify-center w-8 h-8 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition"
                                                                title="Enviar via WhatsApp"
                                                            >
                                                                {/* Simula icone simples whatsapp usando formato de balao Heroicons ou SVG puro */}
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                                            </a>
                                                        )}

                                                        <button 
                                                            onClick={() => deletarContratoGerado(contrato.id)} 
                                                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 bg-transparent rounded-lg hover:bg-red-50 hover:text-red-600 transition ml-2" 
                                                            title="Excluir Histórico"
                                                        >
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
                    <div className="bg-gray-100 w-full max-w-4xl h-[95vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-gray-300 ring-1 ring-white/20">
                        
                        {/* Header do Preview */}
                        <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0">
                            <div>
                                <h3 className="font-black text-gray-900 flex items-center gap-2 text-lg"><EyeIcon className="w-6 h-6 text-indigo-500"/> Validador Visual de Contrato</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">Os campos em destaque (amarelo) simulam as informações do sistema para conferência.</p>
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                <button onClick={imprimirPreview} className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-black transition shadow-md">
                                    <PrinterIcon className="w-4 h-4"/> Imprimir PDF
                                </button>
                                <button onClick={() => setShowPreview(false)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition bg-gray-50 border border-gray-200">
                                    <XMarkIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>

                        {/* Corpo do Modal - Simula Papel A4 */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-gray-200 flex justify-center custom-scrollbar">
                            <div 
                                className="bg-white shadow-xl p-8 sm:p-12 md:p-16 w-full max-w-[794px] text-[14px] text-gray-800 leading-[1.8] border border-gray-300 mx-auto"
                                style={{ minHeight: '1122px' }} /* Altura proporcional a A4 (794x1122) */
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Global Adicional para Scrollbar do modal */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}} />
        </AuthenticatedLayout>
    );
}

// Sem plano Premium: mostra o convite para assinar em vez da tela de contratos.
export default function Contratos(props) {
    if (props.premiumNecessario) {
        return (
            <AuthenticatedLayout user={props.auth?.user}>
                <Head title="Contratos" />
                <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                    <div className="mx-auto w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                        <SparklesIcon className="w-10 h-10 text-[#FF5A00]" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Contratos é um recurso Premium</h1>
                    <p className="mt-4 text-gray-500 leading-relaxed">
                        Com o plano Premium você cria modelos de contrato, gera o documento de cada reserva em PDF e Word e envia direto para o e-mail do cliente.
                    </p>
                    <ul className="mt-8 space-y-3 text-left max-w-md mx-auto text-gray-700 font-medium">
                        <li className="flex items-start gap-3"><DocumentTextIcon className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" /> Modelos de contrato personalizados com variáveis automáticas</li>
                        <li className="flex items-start gap-3"><ArrowDownTrayIcon className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" /> Geração em PDF e Word para cada reserva</li>
                        <li className="flex items-start gap-3"><CheckCircleIcon className="w-5 h-5 text-[#FF5A00] shrink-0 mt-0.5" /> Envio por e-mail ao cliente com um clique</li>
                    </ul>
                    <Link
                        href={route('assinatura.status')}
                        className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold shadow-lg transition"
                    >
                        <SparklesIcon className="w-5 h-5" /> Seja Premium
                    </Link>
                </div>
            </AuthenticatedLayout>
        );
    }

    return <ContratosConteudo {...props} />;
}
