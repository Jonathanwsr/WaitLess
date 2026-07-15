import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Head, useForm, usePage, Link, router } from '@inertiajs/react'; 
import { useState, useEffect } from 'react';
import { 
    CheckCircleIcon, 
    ClockIcon, 
    CreditCardIcon, 
    CalendarIcon, 
    ArrowLeftIcon, 
    TagIcon, 
    StarIcon,
    QrCodeIcon,
    DocumentTextIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    LockClosedIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/solid';

export default function Agendar({ auth, estabelecimento, servicos = [] }) {
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [diaDaSemanaSelecionado, setDiaDaSemanaSelecionado] = useState('');
    const [editandoDataHora, setEditandoDataHora] = useState(false);
    const [statusFinalizacao, setStatusFinalizacao] = useState(null); 
    
    // ESTADOS PARA CONTROLE DE PREÇO E CUPOM
    const [qtdLocal, setQtdLocal] = useState(1); 
    const [cupomAtivo, setCupomAtivo] = useState(null); 

    const { flash = {} } = usePage().props; 

    const { data, setData, post, processing, errors } = useForm({
        servico_id: '',
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '',
        forma_pagamento: '', // online_agora, online_depois, presencial
        metodo_pagamento: '', // pix, cartao, boleto
        parcelas: 1,
        valor_final: 0, 
        quantidade: 1, 
        cupom_codigo: '', 
    });

    const diasSemanaMap = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };

    const parseJSONSeguro = (dados, fallback = []) => {
        if (!dados) return fallback;
        if (typeof dados === 'string') {
            try { return JSON.parse(dados); } catch (e) { return fallback; }
        }
        return dados;
    };

    useEffect(() => {
        const parametros = new URLSearchParams(window.location.search);
        const urlServicoId = parametros.get('servico_id');
        const urlData = parametros.get('data');
        const urlHora = parametros.get('hora');
        const urlQtd = parametros.get('quantidade_carrinho'); 
        
        const urlCupom = parametros.get('cupom');
        const urlDesconto = parametros.get('desconto');
        const urlTipoDesconto = parametros.get('tipo_desconto');

        let newState = { ...data };
        let mudouAlgo = false;

        if (urlCupom && urlDesconto) {
            setCupomAtivo({
                codigo: urlCupom,
                valor: Number(urlDesconto) || 0,
                tipo: urlTipoDesconto || 'percentual'
            });
            newState.cupom_codigo = urlCupom;
            mudouAlgo = true;
        }

        if (urlServicoId) {
            const servicoEncontrado = servicos.find(s => s.id.toString() === urlServicoId);
            if (servicoEncontrado) {
                setServicoSelecionado(servicoEncontrado);
                newState.servico_id = servicoEncontrado.id;
                mudouAlgo = true;

                const config = extrairConfiguracoes(servicoEncontrado.configuracoes);
                // Pre-seleciona um método dependendo da configuração
                newState.forma_pagamento = config.tipoPagamentoRaw === 'presencial' ? 'presencial' : 'online_agora';
                newState.metodo_pagamento = config.tipoPagamentoRaw === 'presencial' ? '' : 'pix';
            }
        }

        if (urlData) { newState.data_agendamento = urlData; mudouAlgo = true; }
        if (urlHora) { newState.hora_agendamento = urlHora; mudouAlgo = true; }
        if (urlQtd) {
            const qtdNum = Number(urlQtd) || 1;
            setQtdLocal(qtdNum);
            newState.quantidade = qtdNum;
            mudouAlgo = true;
        }

        if (urlData && urlHora && urlServicoId) {
            setEditandoDataHora(false);
        } else {
            setEditandoDataHora(true); 
        }

        if (mudouAlgo) setData(newState);
    }, []); 

    useEffect(() => {
        if (data.data_agendamento) {
            const [ano, mes, dia] = data.data_agendamento.split('-');
            const dataObjeto = new Date(ano, mes - 1, dia);
            setDiaDaSemanaSelecionado(diasSemanaMap[dataObjeto.getDay()]);
        }
    }, [data.data_agendamento]);

    useEffect(() => {
        if (servicoSelecionado) {
            let valorCalculado = (Number(servicoSelecionado.valor) || 0) * qtdLocal;

            if (cupomAtivo) {
                if (cupomAtivo.tipo === 'percentual') {
                    valorCalculado = valorCalculado - (valorCalculado * ((Number(cupomAtivo.valor) || 0) / 100));
                } else {
                    valorCalculado = valorCalculado - (Number(cupomAtivo.valor) || 0);
                }
            }

            if (valorCalculado < 0) valorCalculado = 0; 
            setData(prev => ({ ...prev, valor_final: valorCalculado, quantidade: qtdLocal }));
        }
    }, [qtdLocal, servicoSelecionado, cupomAtivo]);

    useEffect(() => {
        if (flash.success && flash.success.includes('PIN')) {
            setStatusFinalizacao('sucesso_local'); 
            localStorage.removeItem('checkout_pendente_waitless'); 
        } else if (flash.warning && flash.warning.includes('reservada')) {
            setStatusFinalizacao('pendente_online'); 
            localStorage.removeItem('checkout_pendente_waitless'); 
        }
    }, [flash]);

    const extrairConfiguracoes = (configRaw) => {
        let config = configRaw || {};
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) { config = {}; }
        }
        const tipoPagamentoRaw = config.tipo_pagamento || 'hibrido';
        const tipoPagamentoExibicao = tipoPagamentoRaw === 'hibrido' ? 'Presencial ou Online' : (tipoPagamentoRaw === 'online' ? 'Somente Online' : 'Somente no Local');
        const dias = config.dias_disponiveis || [];
        return { tipoPagamentoExibicao, tipoPagamentoRaw, diasArray: dias };
    };

    const gerarDiasProximos = (diasPermitidosBanco) => {
        if (!diasPermitidosBanco || diasPermitidosBanco.length === 0) return [];
        const diasGerados = [];
        let dataAtual = new Date();

        for (let i = 0; i < 15; i++) {
            const diaSemanaStr = diasSemanaMap[dataAtual.getDay()];
            if (diasPermitidosBanco.includes(diaSemanaStr)) {
                const year = dataAtual.getFullYear();
                const month = String(dataAtual.getMonth() + 1).padStart(2, '0');
                const day = String(dataAtual.getDate()).padStart(2, '0');
                
                diasGerados.push({
                    dataOriginal: `${year}-${month}-${day}`,
                    diaSemana: diaSemanaStr.substring(0, 3), 
                    diaMes: dataAtual.getDate(),
                    mes: dataAtual.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') 
                });
            }
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return diasGerados;
    };

    const handleSelectServico = (servico) => {
        setServicoSelecionado(servico);
        setData(prev => ({
            ...prev,
            servico_id: servico.id,
            hora_agendamento: '',
            forma_pagamento: extrairConfiguracoes(servico.configuracoes).tipoPagamentoRaw === 'presencial' ? 'presencial' : 'online_agora',
            metodo_pagamento: extrairConfiguracoes(servico.configuracoes).tipoPagamentoRaw === 'presencial' ? '' : 'pix'
        }));
        setQtdLocal(1); 
        setEditandoDataHora(true); 
    };

    const alterarQuantidade = (valor) => {
        const novaQtd = qtdLocal + valor;
        if (novaQtd >= 1) setQtdLocal(novaQtd);
    };

    const selecionarMetodoPagamento = (forma, metodo) => {
        setData(prev => ({ ...prev, forma_pagamento: forma, metodo_pagamento: metodo }));
    };

    const submitAgendamento = (e) => {
        e.preventDefault();
        post(route('cliente.agendar.store', estabelecimento?.id));
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
    const dataApresentacao = data.data_agendamento ? new Date(data.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    let servicoDisponivelNesteDia = false;
    let horariosDoServico = [];
    let tipoPagamentoAtual = 'hibrido';
    let diasParaMostrar = [];
    let fotoServico = 'https://placehold.co/600x400/f3f4f6/9ca3af?text=Serviço';

    if (servicoSelecionado) {
        const configExtraida = extrairConfiguracoes(servicoSelecionado.configuracoes);
        tipoPagamentoAtual = configExtraida.tipoPagamentoRaw;
        servicoDisponivelNesteDia = configExtraida.diasArray.includes(diaDaSemanaSelecionado);
        diasParaMostrar = gerarDiasProximos(configExtraida.diasArray);
        
        let horas = servicoSelecionado.horarios_disponiveis || [];
        if (typeof horas === 'string') { try { horas = JSON.parse(horas); } catch (e) {} }
        horariosDoServico = horas;

        const fotosObj = parseJSONSeguro(servicoSelecionado.fotos);
        if (fotosObj.length > 0) fotoServico = fotosObj[0];
    }

    const valorOriginalBruto = servicoSelecionado ? ((Number(servicoSelecionado.valor) || 0) * qtdLocal) : 0;
    const valorDesconto = valorOriginalBruto - (Number(data.valor_final) || 0);
    const temDescontoVisivel = cupomAtivo && valorDesconto > 0;

    // ==========================================
    // TELA DE SUCESSO / CONCLUSÃO
    // ==========================================
    if (statusFinalizacao) {
        return (
            <AuthenticatedLayout header={<h2 className="text-xl font-bold text-gray-800">Pedido Finalizado</h2>}>
                <Head title="Agendamento Concluído" />
                <div className="max-w-2xl mx-auto mt-12 px-4 pb-20 animate-in zoom-in duration-500">
                    <div className="bg-white rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-gray-100">
                        {statusFinalizacao === 'sucesso_local' ? (
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircleIcon className="w-16 h-16" />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-2">Reserva Confirmada!</h2>
                                <p className="text-gray-600 mb-8">Sua vaga para <strong>{dataApresentacao} às {data.hora_agendamento}</strong> está garantida. Apresente-se no local no horário marcado para realizar o pagamento.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <ClockIcon className="w-16 h-16" />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-2">Pedido Pendente</h2>
                                <p className="text-gray-600 mb-8">Sua vaga está reservada por <strong className="text-yellow-600">2 horas</strong>. Você precisa realizar o pagamento online no seu painel para não perder a vaga.</p>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link href={route('dashboard')} className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md transition">Ver Meus Agendamentos</Link>
                            <Link href={route('estabelecimentos.loja', estabelecimento?.id)} className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 font-bold rounded-xl transition">Voltar para a Loja</Link>
                        </div>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <Link href={route('estabelecimentos.loja', estabelecimento?.id)} className="w-10 h-10 bg-white shadow-sm border border-gray-200 hover:bg-gray-50 rounded-full flex items-center justify-center text-gray-700 transition">
                            <ArrowLeftIcon className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-xl font-bold leading-tight text-gray-900">Finalizar Reserva</h2>
                            <p className="text-sm text-gray-500">{estabelecimento?.nome}</p>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={`Finalizar Pedido - ${estabelecimento?.nome}`} />

            <div className={`max-w-7xl mx-auto mt-6 px-4 pb-24 transition-opacity duration-300 ${processing ? 'opacity-40 pointer-events-none' : ''}`}>
                {flash?.error && <div className="mb-6 p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl font-medium shadow-sm">{flash.error}</div>}
                
                <form onSubmit={submitAgendamento}>
                    {/* ============================================================== */}
                    {/* PASSO 1: SELEÇÃO DE DATA E HORA (APARECE SE editandoDataHora) */}
                    {/* ============================================================== */}
                    {editandoDataHora && (
                        <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in">
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black">1</span> 
                                    Escolha o Serviço
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {servicos?.map(s => {
                                        let precoOriginal = Number(s.valor) || 0;
                                        let precoComDesconto = precoOriginal;
                                        if (cupomAtivo) {
                                            if (cupomAtivo.tipo === 'percentual') precoComDesconto -= precoComDesconto * ((Number(cupomAtivo.valor) || 0) / 100);
                                            else precoComDesconto -= (Number(cupomAtivo.valor) || 0);
                                            if (precoComDesconto < 0) precoComDesconto = 0;
                                        }

                                        const isSelected = data.servico_id === s.id;
                                        return (
                                            <div key={s.id} onClick={() => { if(!processing) handleSelectServico(s); }} className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-md ring-4 ring-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'}`}>
                                                <div>
                                                    <h4 className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>{s.nome}</h4>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                                                        <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5"/> {s.duracao_minutos} min</span>
                                                        {Number(s.avaliacao_media) > 0 ? (
                                                            <span className="flex items-center gap-1 text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded">
                                                                <StarIcon className="w-3.5 h-3.5 text-yellow-500" /> {Number(s.avaliacao_media).toFixed(1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Novo</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {cupomAtivo && precoComDesconto < precoOriginal ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-gray-400 line-through mb-0.5">{formatarMoeda(precoOriginal)}</span>
                                                            <span className="font-black text-emerald-600 text-lg bg-emerald-50 px-2 py-0.5 rounded-lg">{formatarMoeda(precoComDesconto)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="font-bold text-indigo-600 text-lg">{formatarMoeda(precoOriginal)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {servicoSelecionado && (
                                <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black">2</span> 
                                        Defina Data e Hora
                                    </h3>
                                    
                                    <div className="mb-8">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <CalendarIcon className="w-5 h-5 text-gray-400" /> Selecione o Dia
                                        </h4>
                                        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                                            {diasParaMostrar.length > 0 ? (
                                                diasParaMostrar.map(dia => {
                                                    const isSelected = data.data_agendamento === dia.dataOriginal;
                                                    return (
                                                        <button 
                                                            key={dia.dataOriginal} type="button" disabled={processing}
                                                            onClick={() => { setData('data_agendamento', dia.dataOriginal); setData('hora_agendamento', ''); }}
                                                            className={`snap-start flex flex-col items-center justify-center min-w-[80px] p-4 rounded-2xl border-2 transition-all disabled:opacity-50 ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-105' : 'border-gray-100 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50'}`}
                                                        >
                                                            <span className={`text-xs font-bold uppercase mb-1 ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{dia.diaSemana}</span>
                                                            <span className="text-2xl font-black">{dia.diaMes}</span>
                                                            <span className={`text-[10px] uppercase font-bold mt-1 tracking-widest ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{dia.mes}</span>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 w-full text-center">Nenhum dia disponível cadastrado.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <ClockIcon className="w-5 h-5 text-gray-400" /> Selecione o Horário
                                        </h4>
                                        {!servicoDisponivelNesteDia ? (
                                            <div className="p-4 bg-yellow-50 text-yellow-700 rounded-2xl text-sm border border-yellow-200 text-center font-medium">Serviço indisponível neste dia. Selecione outra data.</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-3">
                                                {horariosDoServico.length > 0 ? (
                                                    horariosDoServico.map(hora => {
                                                        const isSelected = data.hora_agendamento === hora;
                                                        return (
                                                            <button 
                                                                type="button" key={hora} disabled={processing}
                                                                onClick={() => { setData('hora_agendamento', hora); setEditandoDataHora(false); }} 
                                                                className={`px-5 py-3 text-sm font-black rounded-2xl border-2 transition-all disabled:opacity-50 ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'}`}
                                                            >
                                                                {hora}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-4 bg-gray-50 text-gray-500 rounded-2xl text-sm w-full text-center">Nenhum horário cadastrado para este dia.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* PASSO 2: CHECKOUT SPLIT LAYOUT (APARECE SE !editandoDataHora) */}
                    {/* ============================================================== */}
                    {!editandoDataHora && servicoSelecionado && data.hora_agendamento && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-8">
                            
                            {/* COLUNA ESQUERDA: RESUMO DA RESERVA (FIXO) */}
                            <div className="lg:col-span-4 lg:col-start-1 order-2 lg:order-1">
                                <div className="sticky top-24 space-y-6">
                                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-gray-100">
                                            <h3 className="text-xl font-bold text-gray-900 mb-6">Resumo da reserva</h3>
                                            <div className="flex gap-4 mb-6">
                                                <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-gray-100">
                                                    <img src={fotoServico} alt="Serviço" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-col justify-center">
                                                    <h4 className="font-bold text-gray-900 text-base leading-tight mb-1">{servicoSelecionado.nome}</h4>
                                                    <p className="text-sm text-gray-500">{estabelecimento?.nome}</p>
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 font-bold">
                                                        <ClockIcon className="w-3.5 h-3.5" /> {servicoSelecionado.duracao_minutos} min
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pb-6">
                                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">Data</p>
                                                    <p className="font-bold text-gray-900 text-sm">{dataApresentacao}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">Horário</p>
                                                    <p className="font-bold text-gray-900 text-sm">{data.hora_agendamento}</p>
                                                </div>
                                            </div>

                                            {/* Controle de Quantidade Integrado */}
                                            <div className="flex items-center justify-between pb-6">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm flex items-center gap-2"><UserGroupIcon className="w-4 h-4 text-gray-400"/> Quantidade</p>
                                                    <p className="text-xs text-gray-500">Vagas / Pessoas</p>
                                                </div>
                                                <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                    <button type="button" onClick={() => alterarQuantidade(-1)} disabled={qtdLocal <= 1 || processing} className="w-9 h-9 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition">-</button>
                                                    <span className="w-9 text-center text-sm font-bold text-gray-900 bg-gray-50 h-9 flex items-center justify-center border-x border-gray-100">{qtdLocal}</span>
                                                    <button type="button" onClick={() => alterarQuantidade(1)} disabled={processing} className="w-9 h-9 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition">+</button>
                                                </div>
                                            </div>

                                            <button type="button" onClick={() => setEditandoDataHora(true)} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition">
                                                Alterar Data ou Serviço
                                            </button>
                                        </div>

                                        <div className="p-6 bg-gray-50/50">
                                            <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                                                <span>Subtotal ({qtdLocal}x {formatarMoeda(servicoSelecionado.valor)})</span>
                                                <span>{formatarMoeda(valorOriginalBruto)}</span>
                                            </div>
                                            {temDescontoVisivel && (
                                                <div className="flex justify-between items-center text-sm text-emerald-600 font-bold mb-3">
                                                    <span className="flex items-center gap-1"><TagIcon className="w-4 h-4"/> Cupom Aplicado</span>
                                                    <span>- {formatarMoeda(valorDesconto)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-200 my-4"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-gray-900 text-lg">Total da reserva</span>
                                                <span className="font-black text-2xl text-gray-900">{formatarMoeda(data.valor_final)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Security Badge */}
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                                        <ShieldCheckIcon className="w-6 h-6 text-emerald-600 shrink-0" />
                                        <div>
                                            <h4 className="text-sm font-bold text-emerald-900">Ambiente 100% seguro</h4>
                                            <p className="text-xs text-emerald-700 mt-0.5">Seus dados e pagamentos estão protegidos com criptografia de ponta a ponta.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUNA DIREITA: OPÇÕES DE PAGAMENTO E CHECKOUT */}
                            <div className="lg:col-span-8 lg:col-start-5 order-1 lg:order-2">
                                <div className="mb-8 flex justify-between items-end">
                                    <div>
                                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Confirme o pagamento</h2>
                                        <p className="text-gray-500">Escolha como deseja pagar sua reserva de forma rápida e segura.</p>
                                    </div>
                                    <div className="hidden sm:block text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Valor Total</p>
                                        <p className="text-3xl font-black text-orange-600">{formatarMoeda(data.valor_final)}</p>
                                    </div>
                                </div>

                                <InputError message={errors.forma_pagamento} className="mb-4" />
                                <InputError message={errors.metodo_pagamento} className="mb-4" />

                                <h3 className="text-lg font-bold text-gray-900 mb-4">Escolha a forma de pagamento</h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                    {/* CARD CARTÃO DE CRÉDITO */}
                                    {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                        <label className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col justify-center transition-all relative min-h-[120px] ${data.metodo_pagamento === 'cartao' ? 'border-orange-500 bg-orange-50/30 text-orange-900 ring-2 ring-orange-100 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-200 bg-white hover:shadow-sm'}`}>
                                            <input type="radio" className="hidden" name="metodo" value="cartao" checked={data.metodo_pagamento === 'cartao'} onChange={() => selecionarMetodoPagamento('online_agora', 'cartao')} disabled={processing} />
                                            <CreditCardIcon className={`w-8 h-8 mb-3 ${data.metodo_pagamento === 'cartao' ? 'text-orange-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-gray-900 text-sm">Pagar Online</span>
                                            <span className="text-xs text-gray-500 mt-1">Cartão de crédito</span>
                                        </label>
                                    )}

                                    {/* CARD PIX */}
                                    {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                        <label className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col justify-center transition-all relative min-h-[120px] ${data.metodo_pagamento === 'pix' ? 'border-indigo-500 bg-indigo-50/30 text-indigo-900 ring-2 ring-indigo-100 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-indigo-200 bg-white hover:shadow-sm'}`}>
                                            <input type="radio" className="hidden" name="metodo" value="pix" checked={data.metodo_pagamento === 'pix'} onChange={() => selecionarMetodoPagamento('online_agora', 'pix')} disabled={processing} />
                                            <QrCodeIcon className={`w-8 h-8 mb-3 ${data.metodo_pagamento === 'pix' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-gray-900 text-sm">Pagar com Pix</span>
                                            <span className="text-xs text-gray-500 mt-1">Aprovação imediata</span>
                                        </label>
                                    )}

                                    {/* CARD BOLETO */}
                                    {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                        <label className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col justify-center transition-all relative min-h-[120px] ${data.metodo_pagamento === 'boleto' ? 'border-indigo-500 bg-indigo-50/30 text-indigo-900 ring-2 ring-indigo-100 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-indigo-200 bg-white hover:shadow-sm'}`}>
                                            <input type="radio" className="hidden" name="metodo" value="boleto" checked={data.metodo_pagamento === 'boleto'} onChange={() => selecionarMetodoPagamento('online_agora', 'boleto')} disabled={processing} />
                                            <DocumentTextIcon className={`w-8 h-8 mb-3 ${data.metodo_pagamento === 'boleto' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-gray-900 text-sm">Boleto Bancário</span>
                                            <span className="text-xs text-gray-500 mt-1">Aprovação em até 3 dias</span>
                                        </label>
                                    )}

                                    {/* CARD NO LOCAL */}
                                    {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'presencial') && (
                                        <label className={`cursor-pointer border-2 rounded-2xl p-5 flex flex-col justify-center transition-all relative min-h-[120px] ${data.forma_pagamento === 'presencial' ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 ring-2 ring-emerald-100 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-emerald-200 bg-white hover:shadow-sm'}`}>
                                            <input type="radio" className="hidden" name="metodo" value="local" checked={data.forma_pagamento === 'presencial'} onChange={() => selecionarMetodoPagamento('presencial', '')} disabled={processing} />
                                            <BuildingStorefrontIcon className={`w-8 h-8 mb-3 ${data.forma_pagamento === 'presencial' ? 'text-emerald-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-gray-900 text-sm">Pagar no Local</span>
                                            <span className="text-xs text-gray-500 mt-1">Pague no estabelecimento</span>
                                        </label>
                                    )}
                                </div>

                                {/* SEÇÃO DINÂMICA DE DADOS DO PAGAMENTO (PARCELAMENTO) */}
                                {data.forma_pagamento === 'online_agora' && data.metodo_pagamento === 'cartao' && (
                                    <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Dados do pagamento</h3>
                                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Opções de Parcelamento</label>
                                            <select 
                                                value={data.parcelas}
                                                onChange={e => setData('parcelas', Number(e.target.value))}
                                                className="w-full rounded-xl border-gray-300 text-sm font-bold text-gray-800 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white py-3"
                                            >
                                                {[...Array(12)].map((_, i) => {
                                                    const numParcela = i + 1;
                                                    const valorParcela = data.valor_final / numParcela;
                                                    return (
                                                        <option key={numParcela} value={numParcela}>
                                                            {numParcela}x de {formatarMoeda(valorParcela)} sem juros
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                                                <LockClosedIcon className="w-3.5 h-3.5" /> Os dados sensíveis do seu cartão serão solicitados com segurança na próxima etapa.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* BOTÃO FINALIZAR */}
                                <div className="pt-6 border-t border-gray-200 mt-8">
                                    <button 
                                        type="submit"
                                        disabled={!data.forma_pagamento || processing}
                                        className="w-full py-4 text-lg font-black rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 bg-[#F95E1F] hover:bg-[#E04D13] text-white flex items-center justify-center gap-3"
                                    >
                                        <LockClosedIcon className="w-5 h-5 opacity-80" />
                                        {processing ? 'Processando ambiente seguro...' : 'Confirmar pagamento'}
                                    </button>
                                    <p className="text-center text-xs text-gray-500 mt-4 font-medium">Você será redirecionado para a página de confirmação.</p>
                                </div>

                            </div>
                        </div>
                    )}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}