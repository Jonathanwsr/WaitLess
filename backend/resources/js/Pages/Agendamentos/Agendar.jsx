import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel'; 
import PrimaryButton from '@/Components/PrimaryButton'; 
import { Head, useForm, usePage, Link, router } from '@inertiajs/react'; 
import { useState, useEffect } from 'react';
import { CheckCircleIcon, ClockIcon, CreditCardIcon, CalendarIcon, ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/solid';

export default function Agendar({ auth, estabelecimento, servicos = [] }) {
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [diaDaSemanaSelecionado, setDiaDaSemanaSelecionado] = useState('');
    const [editandoDataHora, setEditandoDataHora] = useState(false);
    const [statusFinalizacao, setStatusFinalizacao] = useState(null); 
    
    // ESTADOS PARA CONTROLE DE PREÇO/CARRINHO
    const [totalPersonalizado, setTotalPersonalizado] = useState(null);
    const [qtdLocal, setQtdLocal] = useState(1); // Controla a quantidade diretamente nesta tela

    const { url } = usePage(); 
    const { flash = {} } = usePage().props; 

    const { data, setData, post, processing, errors } = useForm({
        servico_id: '',
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '',
        forma_pagamento: '', 
        valor_final: '', 
        quantidade: 1, // Envia para o backend a quantidade final
    });

    const diasSemanaMap = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };

    const parseJSONSeguro = (dados, fallback = []) => {
        if (!dados) return fallback;
        if (typeof dados === 'string') {
            try { return JSON.parse(dados); } catch (e) { return fallback; }
        }
        return dados;
    };

    // 1. O MOTOR DE AUTOPREENCHIMENTO
    useEffect(() => {
        const parametros = new URLSearchParams(window.location.search);
        const urlServicoId = parametros.get('servico_id');
        const urlData = parametros.get('data');
        const urlHora = parametros.get('hora');
        const urlQtd = parametros.get('quantidade_carrinho'); 

        let newState = { ...data };
        let mudouAlgo = false;

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

        if (urlData) {
            newState.data_agendamento = urlData;
            mudouAlgo = true;
        }

        if (urlHora) {
            newState.hora_agendamento = urlHora;
            mudouAlgo = true;
        }

        if (urlQtd) {
            const qtdNum = Number(urlQtd);
            setQtdLocal(qtdNum);
            newState.quantidade = qtdNum;
            mudouAlgo = true;
        }

        if (urlData && urlHora && urlServicoId) {
            setEditandoDataHora(false);
        } else {
            setEditandoDataHora(true); 
        }

        if (mudouAlgo) {
            setData(newState);
        }
    }, []); 

    // 2. DETETOR DE DIAS DA SEMANA
    useEffect(() => {
        if (data.data_agendamento) {
            const [ano, mes, dia] = data.data_agendamento.split('-');
            const dataObjeto = new Date(ano, mes - 1, dia);
            setDiaDaSemanaSelecionado(diasSemanaMap[dataObjeto.getDay()]);
        }
    }, [data.data_agendamento]);

    
    useEffect(() => {
        if (servicoSelecionado) {
            const valorCalculado = Number(servicoSelecionado.valor) * qtdLocal;
            setData(prev => ({ ...prev, valor_final: valorCalculado, quantidade: qtdLocal }));
        }
    }, [qtdLocal, servicoSelecionado]);

    // 4. MENSAGENS DE SUCESSO
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
        setQtdLocal(1); // Reseta a quantidade para 1 ao trocar de serviço
        setEditandoDataHora(true); 
        
        const tipo = extrairConfiguracoes(servico.configuracoes).tipoPagamentoRaw;
        if (tipo === 'presencial') setData('forma_pagamento', 'presencial');
        else setData('forma_pagamento', 'online_agora');
    };

    const alterarQuantidade = (valor) => {
        const novaQtd = qtdLocal + valor;
        if (novaQtd >= 1) {
            setQtdLocal(novaQtd);
        }
    };

    const submitAgendamento = (e) => {
        e.preventDefault();
        post(route('cliente.agendar.store', estabelecimento?.id));
    };

    const explorarOutroServico = (outroServico) => {
        if (servicoSelecionado) {
            localStorage.setItem('checkout_pendente_waitless', JSON.stringify({
                estabelecimento_id: estabelecimento.id,
                servico_id: data.servico_id,
                data: data.data_agendamento,
                hora: data.hora_agendamento
            }));
        }
        router.visit(route('estabelecimentos.loja', { estabelecimento: estabelecimento.id, open_servico: outroServico.id }));
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
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

    const textoBotao = processing ? 'A processar...' : 
        (data.forma_pagamento === 'online_agora' ? 'Ir para Pagamento Seguro' : 
        (data.forma_pagamento === 'online_depois' ? 'Reservar e Pagar Depois' : 'Confirmar Reserva no Local'));

    const servicosOutros = servicoSelecionado 
        ? servicos.filter(s => s.id !== servicoSelecionado.id).slice(0, 4) 
        : servicos.slice(0, 4);

    const valorAExibir = servicoSelecionado ? (Number(servicoSelecionado.valor) * qtdLocal) : 0;

    if (statusFinalizacao) {
        return (
            <AuthenticatedLayout header={<h2 className="text-xl font-bold text-gray-800">Pedido Finalizado</h2>}>
                <Head title="Agendamento Concluído" />
                <div className="max-w-2xl mx-auto mt-12 px-4 pb-20 animate-in zoom-in duration-500">
                    <div className="bg-white rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-gray-100">
                        {statusFinalizacao === 'sucesso_local' ? (
                            <>
                                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircleIcon className="w-16 h-16" />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-2">Reserva Confirmada!</h2>
                                <p className="text-gray-600 mb-8">Sua vaga para <strong>{dataApresentacao} às {data.hora_agendamento}</strong> está garantida. Apresente-se no local no horário marcado para realizar o pagamento.</p>
                            </>
                        ) : (
                            <>
                                <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <ClockIcon className="w-16 h-16" />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-2">Pedido Pendente</h2>
                                <p className="text-gray-600 mb-8">Sua vaga está reservada por <strong className="text-yellow-600">2 horas</strong>. Você precisa realizar o pagamento online no seu painel para não perder a vaga.</p>
                            </>
                        )}
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link href={route('dashboard')} className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md transition">Ver Meus Agendamentos</Link>
                            <Link href={route('estabelecimentos.loja', estabelecimento.id)} className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 font-bold rounded-xl transition">Voltar para a Loja</Link>
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
                        <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">Finalizar Agendamento</h2>
                        <p className="text-sm text-gray-500">{estabelecimento?.nome}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Finalizar Pedido - ${estabelecimento?.nome}`} />

            <div className="max-w-4xl mx-auto mt-6 px-4 pb-20">
                {flash?.error && <div className="mb-6 p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl">{flash.error}</div>}

                <form onSubmit={submitAgendamento} className="space-y-6">
                    
                    {/* RESUMO DO PEDIDO */}
                    {servicoSelecionado && data.hora_agendamento && !editandoDataHora ? (
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                            
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Resumo do Pedido</h3>
                                <button type="button" onClick={() => setEditandoDataHora(true)} className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition bg-indigo-50 px-3 py-1.5 rounded-lg">
                                    <PencilSquareIcon className="w-4 h-4" /> Alterar
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Serviço Escolhido</p>
                                    <h4 className="text-xl font-black text-gray-900">{servicoSelecionado.nome}</h4>
                                    
                                    {/* 👉 CONTROLO DE QUANTIDADE NO RESUMO */}
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-sm text-gray-600 font-medium">Quantidade:</span>
                                        <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                                            <button type="button" onClick={() => alterarQuantidade(-1)} disabled={qtdLocal <= 1} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 rounded-l-lg transition">-</button>
                                            <span className="w-8 text-center text-sm font-bold text-gray-900">{qtdLocal}</span>
                                            <button type="button" onClick={() => alterarQuantidade(1)} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-r-lg transition">+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-16 bg-gray-200"></div>
                                
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data e Hora</p>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-indigo-500" />
                                        <span className="text-lg font-bold text-gray-900">{dataApresentacao}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <ClockIcon className="w-5 h-5 text-indigo-500" />
                                        <span className="text-lg font-bold text-gray-900">{data.hora_agendamento}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ESCOLHA E EDIÇÃO MANUAL */
                        <div className="space-y-6">
                            
                            {/* Escolha de Serviço */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">1. Escolha o Serviço</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {servicos?.map(s => (
                                        <div key={s.id} onClick={() => handleSelectServico(s)} className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex justify-between items-center ${data.servico_id === s.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-gray-100 bg-white hover:border-indigo-200'}`}>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{s.nome}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{s.duracao_minutos} min</p>
                                            </div>
                                            <span className="font-bold text-indigo-600">{formatarMoeda(s.valor)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Escolha de Data e Hora */}
                            {servicoSelecionado && (
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b border-gray-100 pb-4 gap-4">
                                        <h3 className="text-lg font-bold text-gray-900">2. Defina os Detalhes</h3>
                                        
                                        {/* 👉 CONTROLO DE QUANTIDADE NA EDIÇÃO MANUAL */}
                                        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                            <span className="text-sm text-gray-700 font-bold">Quantidade:</span>
                                            <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                                                <button type="button" onClick={() => alterarQuantidade(-1)} disabled={qtdLocal <= 1} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 rounded-l-lg transition">-</button>
                                                <span className="w-8 text-center text-sm font-bold text-gray-900">{qtdLocal}</span>
                                                <button type="button" onClick={() => alterarQuantidade(1)} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-r-lg transition">+</button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-6">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" /> Qual dia?
                                        </h4>
                                        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                            {diasParaMostrar.length > 0 ? (
                                                diasParaMostrar.map(dia => {
                                                    const isSelected = data.data_agendamento === dia.dataOriginal;
                                                    return (
                                                        <button 
                                                            key={dia.dataOriginal}
                                                            type="button"
                                                            onClick={() => {
                                                                setData('data_agendamento', dia.dataOriginal);
                                                                setData('hora_agendamento', ''); 
                                                            }}
                                                            className={`flex flex-col items-center justify-center min-w-[70px] p-3 rounded-xl border transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-105' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                                        >
                                                            <span className={`text-xs font-bold uppercase mb-1 ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{dia.diaSemana}</span>
                                                            <span className="text-xl font-black">{dia.diaMes}</span>
                                                            <span className={`text-[10px] uppercase font-bold mt-1 ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>{dia.mes}</span>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-sm text-red-500">Nenhum dia disponível cadastrado.</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                            <ClockIcon className="w-4 h-4" /> Que horas?
                                        </h4>
                                        {!servicoDisponivelNesteDia ? (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">Serviço indisponível neste dia. Selecione outro acima.</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {horariosDoServico.length > 0 ? (
                                                    horariosDoServico.map(hora => {
                                                        const isSelected = data.hora_agendamento === hora;
                                                        return (
                                                            <button 
                                                                type="button" 
                                                                key={hora} 
                                                                onClick={() => { setData('hora_agendamento', hora); setEditandoDataHora(false); }} 
                                                                className={`px-4 py-2 text-sm font-bold rounded-xl border-2 transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                                            >
                                                                {hora}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-sm text-red-500">Nenhum horário cadastrado.</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CHECKOUT: MÉTODO DE PAGAMENTO E TOTAL */}
                    {servicoSelecionado && data.hora_agendamento && (
                        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-xl font-bold text-gray-900">Total a pagar</h3>
                                <div className="text-3xl font-black text-gray-900">
                                    <span className="text-lg text-gray-400 font-normal mr-1">R$</span>
                                    {Number(valorAExibir).toFixed(2).replace('.', ',')}
                                </div>
                            </div>

                            <h4 className="text-sm font-bold mb-4 text-gray-500 uppercase tracking-wider">Forma de Pagamento</h4>
                            <InputError message={errors.forma_pagamento} className="mb-4" />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                    <>
                                        <label className={`cursor-pointer border-2 rounded-xl p-5 flex flex-col items-center justify-center text-center transition relative overflow-hidden ${data.forma_pagamento === 'online_agora' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-gray-50'}`}>
                                            {data.forma_pagamento === 'online_agora' && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_agora" checked={data.forma_pagamento === 'online_agora'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                            <CreditCardIcon className="w-8 h-8 mb-3 text-indigo-500" />
                                            <span className="font-bold text-base">Cartão ou Pix</span>
                                            <span className="text-xs mt-1 text-gray-500 font-medium">Pagar agora, online</span>
                                        </label>

                                        <label className={`cursor-pointer border-2 rounded-xl p-5 flex flex-col items-center justify-center text-center transition relative overflow-hidden ${data.forma_pagamento === 'online_depois' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-gray-50'}`}>
                                            {data.forma_pagamento === 'online_depois' && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_depois" checked={data.forma_pagamento === 'online_depois'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                            <ClockIcon className="w-8 h-8 mb-3 text-yellow-500" />
                                            <span className="font-bold text-base">Pagar Depois</span>
                                            <span className="text-xs mt-1 text-gray-500 font-medium">Reservar por 2h</span>
                                        </label>
                                    </>
                                )}

                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'presencial') && (
                                    <label className={`cursor-pointer border-2 rounded-xl p-5 flex flex-col items-center justify-center text-center transition relative overflow-hidden ${data.forma_pagamento === 'presencial' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-gray-50'}`}>
                                        {data.forma_pagamento === 'presencial' && <div className="absolute top-0 right-0 w-8 h-8 bg-green-600 rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">✓</div>}
                                        <input type="radio" className="hidden" name="forma_pagamento" value="presencial" checked={data.forma_pagamento === 'presencial'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                        <span className="text-3xl mb-3">🤝</span>
                                        <span className="font-bold text-base">No Local</span>
                                        <span className="text-xs mt-1 text-gray-500 font-medium">Direto no Salão</span>
                                    </label>
                                )}
                            </div>

                            {/* BOTÃO FINAL GIGANTE */}
                            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-end animate-in fade-in slide-in-from-bottom-2">
                                <PrimaryButton className="w-full sm:w-auto px-12 py-5 text-xl font-bold bg-gray-900 rounded-xl shadow-xl hover:scale-[1.02] transition disabled:opacity-50 flex items-center justify-center gap-3" disabled={processing || !servicoDisponivelNesteDia || !data.forma_pagamento}>
                                    {processing && <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {textoBotao}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </form>

                {/* TELA DE BAIXO: SHOP SIMILAR */}
                {servicosOutros.length > 0 && (
                    <div className="mt-16 pt-12 border-t border-gray-200 animate-in fade-in">
                        <h2 className="text-3xl font-normal text-center text-gray-900 mb-10 font-serif">Aproveite e adicione...</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {servicosOutros.map((outroServico) => {
                                const fotosO = parseJSONSeguro(outroServico.fotos);
                                const fotoCapaO = fotosO.length > 0 ? fotosO[0] : 'https://placehold.co/400x400/e2e8f0/828ea8?text=Sem+Imagem';

                                return (
                                    <div 
                                        key={outroServico.id} 
                                        onClick={() => explorarOutroServico(outroServico)}
                                        className="cursor-pointer group flex flex-col items-center bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100"
                                    >
                                        <div className="w-full aspect-square bg-gray-200 rounded-md overflow-hidden mb-4">
                                            <img src={fotoCapaO} alt={outroServico.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                        </div>
                                        <div className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded mb-3">
                                            R$ {Number(outroServico.valor).toFixed(2)}
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-center">{outroServico.nome}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{outroServico.duracao_minutos} minutos</p>
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