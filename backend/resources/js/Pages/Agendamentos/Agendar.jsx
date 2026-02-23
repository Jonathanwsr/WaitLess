import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, useForm, usePage } from '@inertiajs/react'; 
import { useState, useEffect } from 'react';

export default function Agendar({ auth, estabelecimento, servicos = [] }) {
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [diaDaSemanaSelecionado, setDiaDaSemanaSelecionado] = useState('');
    const { flash = {} } = usePage().props; 

    const { data, setData, post, processing, errors } = useForm({
        servico_id: '',
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '',
        forma_pagamento: '', // Nova variável!
    });

    const diasSemanaMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

    useEffect(() => {
        if (data.data_agendamento) {
            const [ano, mes, dia] = data.data_agendamento.split('-');
            const dataObjeto = new Date(ano, mes - 1, dia);
            setDiaDaSemanaSelecionado(diasSemanaMap[dataObjeto.getDay()]);
            setData('hora_agendamento', '');
        }
    }, [data.data_agendamento]);

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

    const handleSelectServico = (servico) => {
        setServicoSelecionado(servico);
        setData('servico_id', servico.id);
        setData('hora_agendamento', ''); 
        
        // Define a forma de pagamento padrão com base no JSON
        const tipo = extrairConfiguracoes(servico.configuracoes).tipoPagamentoRaw;
        if (tipo === 'presencial') setData('forma_pagamento', 'presencial');
        else setData('forma_pagamento', 'online_agora');
    };

    const submitAgendamento = (e) => {
        e.preventDefault();
        post(route('cliente.agendar.store', estabelecimento?.id));
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

    let servicoDisponivelNesteDia = false;
    let horariosDoServico = [];
    let tipoPagamentoAtual = 'hibrido';

    if (servicoSelecionado) {
        const configExtraida = extrairConfiguracoes(servicoSelecionado.configuracoes);
        tipoPagamentoAtual = configExtraida.tipoPagamentoRaw;
        servicoDisponivelNesteDia = configExtraida.diasArray.includes(diaDaSemanaSelecionado);
        let horas = servicoSelecionado.horarios_disponiveis || [];
        if (typeof horas === 'string') { try { horas = JSON.parse(horas); } catch (e) {} }
        horariosDoServico = horas;
    }

    // Texto do botão dinâmico
    const textoBotao = processing ? 'Aguarde...' : 
        (data.forma_pagamento === 'online_agora' ? 'Pagar no Mercado Pago' : 
        (data.forma_pagamento === 'online_depois' ? 'Reservar Vaga (Pagar Depois)' : 'Confirmar Agendamento (Local)'));

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {estabelecimento?.nome ? estabelecimento.nome.charAt(0) : '?'}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">{estabelecimento?.nome}</h2>
                        <p className="text-sm text-gray-500">{estabelecimento?.bairro}, {estabelecimento?.cidade}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Agendar - ${estabelecimento?.nome || 'Estabelecimento'}`} />

            <div className="max-w-4xl mx-auto mt-6 px-4 pb-20">
                {flash?.success && <div className="mb-6 p-4 text-green-800 bg-green-100 border border-green-200 rounded-xl">{flash.success}</div>}
                {flash?.warning && <div className="mb-6 p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-xl">{flash.warning}</div>}
                {flash?.error && <div className="mb-6 p-4 text-red-800 bg-red-100 border border-red-200 rounded-xl">{flash.error}</div>}

                <form onSubmit={submitAgendamento} className="space-y-6 animate-in fade-in duration-500">
                    
                    {/* PASSO 1 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">1. O que você precisa hoje?</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {servicos?.map(s => {
                                const config = extrairConfiguracoes(s.configuracoes);
                                return (
                                    <div key={s.id} onClick={() => handleSelectServico(s)} className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col h-full ${data.servico_id === s.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md uppercase">{s.tipo_servico || 'Serviço'}</span>
                                            <span className="font-bold text-indigo-600 text-lg">{formatarMoeda(s.valor)}</span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-xl mb-1">{s.nome}</h4>
                                        <p className="text-sm text-gray-600 mb-4 flex-grow line-clamp-2">{s.descricao || 'Sem descrição.'}</p>
                                        <div className="mt-auto pt-4 border-t border-gray-100 text-xs space-y-1">
                                            <p className="text-gray-600">⏱️ Duração: <strong className="text-gray-900">{s.duracao_minutos} min</strong></p>
                                            <p className="text-gray-600">💳 Pagamento: <strong className="text-gray-900">{config.tipoPagamentoExibicao}</strong></p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* PASSO 2 */}
                    {servicoSelecionado && (
                        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 text-gray-900">2. Escolha o melhor momento</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <InputLabel value="Data do Agendamento" className="mb-2" />
                                    <input type="date" className="w-full border-gray-300 rounded-xl p-3 focus:ring-indigo-500" value={data.data_agendamento} min={new Date().toISOString().split('T')[0]} onChange={e => setData('data_agendamento', e.target.value)} required />
                                </div>
                                <div>
                                    <InputLabel value="Horários Disponíveis" className="mb-2" />
                                    {!servicoDisponivelNesteDia ? (
                                        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">Este serviço não atende neste dia da semana.</div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {horariosDoServico.map(hora => (
                                                <button type="button" key={hora} onClick={() => setData('hora_agendamento', hora)} className={`py-2 text-sm font-bold rounded-lg border-2 transition ${data.hora_agendamento === hora ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>{hora}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASSO 3: MÁGICA DO PAGAMENTO */}
                    {servicoSelecionado && data.hora_agendamento && (
                        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-lg font-bold mb-4 text-gray-900">3. Como deseja pagar?</h3>
                            <InputError message={errors.forma_pagamento} className="mb-4" />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'online') && (
                                    <>
                                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition ${data.forma_pagamento === 'online_agora' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_agora" checked={data.forma_pagamento === 'online_agora'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                            <span className="text-2xl mb-2">💳</span>
                                            <span className="font-bold text-sm">Pagar Agora</span>
                                            <span className="text-xs mt-1 opacity-75">Via Mercado Pago</span>
                                        </label>
                                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition ${data.forma_pagamento === 'online_depois' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                                            <input type="radio" className="hidden" name="forma_pagamento" value="online_depois" checked={data.forma_pagamento === 'online_depois'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                            <span className="text-2xl mb-2">⏳</span>
                                            <span className="font-bold text-sm">Pagar Depois</span>
                                            <span className="text-xs mt-1 opacity-75">Até 2h antes</span>
                                        </label>
                                    </>
                                )}
                                {(tipoPagamentoAtual === 'hibrido' || tipoPagamentoAtual === 'presencial') && (
                                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition ${data.forma_pagamento === 'presencial' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                                        <input type="radio" className="hidden" name="forma_pagamento" value="presencial" checked={data.forma_pagamento === 'presencial'} onChange={e => setData('forma_pagamento', e.target.value)} />
                                        <span className="text-2xl mb-2">🤝</span>
                                        <span className="font-bold text-sm">Pagar no Local</span>
                                        <span className="text-xs mt-1 opacity-75">Direto no Salão</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {servicoSelecionado && data.hora_agendamento && data.forma_pagamento && (
                        <div className="flex justify-end pt-4">
                            <PrimaryButton className="w-full sm:w-auto px-8 py-4 text-lg bg-gray-900 rounded-xl shadow-xl hover:scale-[1.02] transition disabled:opacity-50" disabled={processing || !servicoDisponivelNesteDia}>
                                {textoBotao}
                            </PrimaryButton>
                        </div>
                    )}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}