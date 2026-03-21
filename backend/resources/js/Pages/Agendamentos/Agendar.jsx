import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton'; 
import { Head, useForm, usePage, Link, router } from '@inertiajs/react'; 
import { useState, useEffect } from 'react';
import { CheckCircleIcon, ClockIcon, CreditCardIcon, CalendarIcon, ArrowLeftIcon, PencilSquareIcon, TagIcon, InformationCircleIcon, StarIcon } from '@heroicons/react/24/solid';

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
        forma_pagamento: '', 
        valor_final: 0, 
        quantidade: 1, 
        cupom_codigo: '', // Envia o código para o backend
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
                newState.forma_pagamento = config.tipoPagamentoRaw === 'presencial' ? 'presencial' : 'online_agora';
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
        setData('servico_id', servico.id);
        setData('hora_agendamento', ''); 
        setQtdLocal(1); 
        setEditandoDataHora(true); 
        
        const tipo = extrairConfiguracoes(servico.configuracoes).tipoPagamentoRaw;
        if (tipo === 'presencial') setData('forma_pagamento', 'presencial');
        else setData('forma_pagamento', 'online_agora');
    };

    const alterarQuantidade = (valor) => {
        const novaQtd = qtdLocal + valor;
        if (novaQtd >= 1) setQtdLocal(novaQtd);
    };

    const submitAgendamento = (e) => {
        e.preventDefault();
        post(route('cliente.agendar.store', estabelecimento?.id));
    };

    const explorarOutroServico = (outroServico) => {
        if (servicoSelecionado) {
            localStorage.setItem('checkout_pendente_waitless', JSON.stringify({
                estabelecimento_id: estabelecimento?.id,
                servico_id: data.servico_id,
                data: data.data_agendamento,
                hora: data.hora_agendamento
            }));
        }
        router.visit(route('estabelecimentos.loja', { estabelecimento: estabelecimento?.id, open_servico: outroServico.id }));
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
    const dataApresentacao = data.data_agendamento ? new Date(data.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    let servicoDisponivelNesteDia = false;
    let horariosDoServico = [];
    let tipoPagamentoAtual = 'hibrido';
    let diasParaMostrar = [];

    if (servicoSelecionado) {
        const configExtraida = extrairConfiguracoes(servicoSelecionado.configuracoes);
        tipoPagamentoAtual = configExtraida.tipoPagamentoRaw;
        servicoDisponivelNesteDia = configExtraida.diasArray.includes(diaDaSemanaSelecionado);
        diasParaMostrar = gerarDiasProximos(configExtraida.diasArray);
        
        let horas = servicoSelecionado.horarios_disponiveis || [];
        if (typeof horas === 'string') { try { horas = JSON.parse(horas); } catch (e) {} }
        horariosDoServico = horas;
    }

    const textoBotao = data.forma_pagamento === 'online_agora' ? 'Ir para Pagamento Seguro' : 
        (data.forma_pagamento === 'online_depois' ? 'Reservar e Pagar Depois' : 'Confirmar Reserva no Local');

    const servicosOutros = servicoSelecionado 
        ? servicos.filter(s => s.id !== servicoSelecionado.id).slice(0, 4) 
        : servicos.slice(0, 4);

    const valorOriginalBruto = servicoSelecionado ? ((Number(servicoSelecionado.valor) || 0) * qtdLocal) : 0;
    const temDescontoVisivel = cupomAtivo && valorOriginalBruto > (Number(data.valor_final) || 0);

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
                <div className="flex items-center gap-3">
                    <Link href={route('estabelecimentos.loja', estabelecimento?.id)} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-700 transition">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">Agendar Atendimento</h2>
                        <p className="text-sm text-gray-500">{estabelecimento?.nome}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Finalizar Pedido - ${estabelecimento?.nome}`} />

            <div className={`max-w-4xl mx-auto mt-6 px-4 pb-24 transition-opacity duration-300 ${processing ? 'opacity-30 pointer-events-none' : ''}`}>
                {flash?.error && <div className="mb-6 p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl font-medium">{flash.error}</div>}

                <form onSubmit={submitAgendamento} className="space-y-8">
                    
                    {cupomAtivo && (
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-6 shadow-lg text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0 border border-white/30">
                                    <TagIcon className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-black text-xl tracking-tight">Cupom {cupomAtivo.codigo} Aplicado!</p>
                                    <p className="text-emerald-50 text-sm font-medium">Os preços abaixo já estão com o seu desconto calculado.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!editandoDataHora && servicoSelecionado && data.hora_agendamento ? (
                        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden animate-in fade-in">
                            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Resumo da Reserva</h3>
                                <button type="button" onClick={() => setEditandoDataHora(true)} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition bg-indigo-50 px-4 py-2 rounded-xl">
                                    <PencilSquareIcon className="w-4 h-4" /> Alterar
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Serviço Escolhido</p>
                                    <h4 className="text-2xl font-black text-gray-900 mb-4">{servicoSelecionado.nome}</h4>
                                    
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Quantidade:</span>
                                        <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                            <button type="button" onClick={() => alterarQuantidade(-1)} disabled={qtdLocal <= 1 || processing} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition">-</button>
                                            <span className="w-10 text-center text-sm font-bold text-gray-900 bg-gray-50 h-10 flex items-center justify-center border-x border-gray-100">{qtdLocal}</span>
                                            <button type="button" onClick={() => alterarQuantidade(1)} disabled={processing} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden md:block w-px h-20 bg-gray-200"></div>
                                <div className="flex-1 md:text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data e Hora</p>
                                    <div className="flex items-center md:justify-end gap-3 mb-2">
                                        <CalendarIcon className="w-5 h-5 text-indigo-400" />
                                        <span className="text-lg font-bold text-gray-900">{dataApresentacao}</span>
                                    </div>
                                    <div className="flex items-center md:justify-end gap-3">
                                        <ClockIcon className="w-5 h-5 text-indigo-400" />
                                        <span className="text-xl font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{data.hora_agendamento}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">1</span> 
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
                                        // 👉 ADICIONADO AQUI O CÁLCULO DA MÉDIA
                                        const mediaServico = Number(s.avaliacao_media) || 0;

                                        return (
                                            <div key={s.id} onClick={() => { if(!processing) handleSelectServico(s); }} className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${isSelected ? 'border-indigo-500 bg-indigo-50 shadow-md ring-4 ring-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'}`}>
                                                <div>
                                                    <h4 className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>{s.nome}</h4>
                                                    
                                                    {/* 👉 AVALIAÇÃO EM ESTRELAS APARECE AQUI! */}
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                                                        <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5"/> {s.duracao_minutos} min</span>
                                                        
                                                        {mediaServico > 0 ? (
                                                            <span className="flex items-center gap-1 text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded">
                                                                <StarIcon className="w-3.5 h-3.5 text-yellow-500" /> {mediaServico.toFixed(1)} <span className="font-normal text-gray-400">({s.total_avaliacoes})</span>
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
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 border-b border-gray-100 pb-6 gap-4">
                                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">2</span> 
                                            Defina Data e Hora
                                        </h3>
                                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                                            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Pessoas:</span>
                                            <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                <button type="button" onClick={() => alterarQuantidade(-1)} disabled={qtdLocal <= 1 || processing} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition">-</button>
                                                <span className="w-8 text-center text-sm font-bold text-gray-900 bg-gray-50 h-8 flex items-center justify-center border-x border-gray-100">{qtdLocal}</span>
                                                <button type="button" onClick={() => alterarQuantidade(1)} disabled={processing} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 transition">+</button>
                                            </div>
                                        </div>
                                    </div>
                                    
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
                                                            key={dia.dataOriginal}
                                                            type="button"
                                                            disabled={processing}
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
                                                                type="button" 
                                                                key={hora} 
                                                                disabled={processing}
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

                    {servicoSelecionado && data.hora_agendamento && !editandoDataHora && (
                        <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-100 shadow-xl animate-in fade-in slide-in-from-bottom-8">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-gray-100 pb-8 gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">3</span> 
                                        Finalização
                                    </h3>
                                    <p className="text-sm text-gray-500">Escolha como prefere pagar sua reserva.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total a pagar</p>
                                    <div className="flex items-center justify-end gap-3">
                                        {temDescontoVisivel && (
                                            <span className="text-xl text-gray-400 line-through font-medium">
                                                R$ {(Number(valorOriginalBruto) || 0).toFixed(2).replace('.', ',')}
                                            </span>
                                        )}
                                        <div className={`text-5xl font-black tracking-tight ${temDescontoVisivel ? 'text-emerald-600' : 'text-gray-900'}`}>
                                            <span className="text-2xl font-normal mr-1 opacity-50">R$</span>
                                            {(Number(data.valor_final) || 0).toFixed(2).replace('.', ',')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <InputError message={errors.forma_pagamento} className="mb-4" />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                    <>
                                        <label className={`cursor-pointer border-2 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${data.forma_pagamento === 'online_agora' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-4 ring-indigo-50' : 'border-gray-100 text-gray-600 hover:border-indigo-200 hover:bg-gray-50'}`}>
                                            {data.forma_pagamento === 'online_agora' && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_agora" checked={data.forma_pagamento === 'online_agora'} onChange={e => setData('forma_pagamento', e.target.value)} disabled={processing} />
                                            <CreditCardIcon className={`w-10 h-10 mb-3 ${data.forma_pagamento === 'online_agora' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-lg">Cartão / Pix</span>
                                            <span className="text-xs mt-1 text-gray-500 font-medium">Pagar online pelo App</span>
                                        </label>

                                        <label className={`cursor-pointer border-2 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${data.forma_pagamento === 'online_depois' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-4 ring-indigo-50' : 'border-gray-100 text-gray-600 hover:border-indigo-200 hover:bg-gray-50'}`}>
                                            {data.forma_pagamento === 'online_depois' && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_depois" checked={data.forma_pagamento === 'online_depois'} onChange={e => setData('forma_pagamento', e.target.value)} disabled={processing} />
                                            <ClockIcon className={`w-10 h-10 mb-3 ${data.forma_pagamento === 'online_depois' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                            <span className="font-bold text-lg">Pagar Depois</span>
                                            <span className="text-xs mt-1 text-gray-500 font-medium">Reserva de 2h</span>
                                        </label>
                                    </>
                                )}

                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'presencial') && (
                                    <label className={`cursor-pointer border-2 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${data.forma_pagamento === 'presencial' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-4 ring-emerald-50' : 'border-gray-100 text-gray-600 hover:border-emerald-200 hover:bg-gray-50'}`}>
                                        {data.forma_pagamento === 'presencial' && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                        <input type="radio" className="hidden" name="forma_pagamento" value="presencial" checked={data.forma_pagamento === 'presencial'} onChange={e => setData('forma_pagamento', e.target.value)} disabled={processing} />
                                        <span className={`text-4xl mb-3 opacity-80 ${data.forma_pagamento === 'presencial' ? '' : 'grayscale'}`}>🤝</span>
                                        <span className="font-bold text-lg">No Local</span>
                                        <span className="text-xs mt-1 text-gray-500 font-medium">Direto no Salão</span>
                                    </label>
                                )}
                            </div>

                            {cupomAtivo && (
                                <div className="mb-6 flex items-start gap-3 bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 text-sm">
                                    <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                    <p><strong>Atenção:</strong> Ao confirmar, o cupom <strong>{cupomAtivo.codigo}</strong> será consumido.</p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-100 flex flex-col items-end">
                                <PrimaryButton 
                                    className={`w-full sm:w-auto px-12 py-5 text-xl font-bold rounded-2xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 ${temDescontoVisivel && !processing ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' : 'bg-gray-900 hover:bg-black text-white'}`} 
                                    disabled={!data.forma_pagamento || processing}
                                >
                                    {temDescontoVisivel ? 'Confirmar c/ Desconto!' : 'Confirmar Reserva'}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </form>

                {servicosOutros.length > 0 && (
                    <div className="mt-20 pt-16 border-t border-gray-200 animate-in fade-in">
                        <h2 className="text-3xl font-normal text-center text-gray-900 mb-10 font-serif">Aproveite e adicione...</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {servicosOutros.map((outroServico) => {
                                const fotosO = parseJSONSeguro(outroServico.fotos);
                                const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x400/e2e8f0/828ea8?text=Sem+Imagem';

                                return (
                                    <div 
                                        key={outroServico.id} 
                                        onClick={() => explorarOutroServico(outroServico)}
                                        className="cursor-pointer group flex flex-col items-center bg-white p-5 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-indigo-100 hover:-translate-y-1"
                                    >
                                        <div className="w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-5">
                                            <img src={fotoCapaO} alt={outroServico.nome} className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-out"/>
                                        </div>
                                        <div className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg mb-3 tracking-wider">
                                            R$ {(Number(outroServico.valor) || 0).toFixed(2).replace('.', ',')}
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-center text-lg">{outroServico.nome}</h4>
                                        <p className="text-xs text-gray-500 mt-1 font-medium">{outroServico.duracao_minutos} minutos</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}