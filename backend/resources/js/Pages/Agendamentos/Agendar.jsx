import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Agendar({ auth, estabelecimento, servicos }) {
    const [servicoSelecionado, setServicoSelecionado] = useState(null);
    const [diaDaSemanaSelecionado, setDiaDaSemanaSelecionado] = useState('');

    // O Inertia useForm substitui o Axios perfeitamente
    const { data, setData, post, processing, errors } = useForm({
        servico_id: '',
        data_agendamento: new Date().toISOString().split('T')[0],
        hora_agendamento: '',
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

    const handleSelectServico = (servico) => {
        setServicoSelecionado(servico);
        setData('servico_id', servico.id);
        setData('hora_agendamento', ''); 
    };

    // ENVIA PARA O BACKEND E O INERTIA REDIRECIONA PARA O MERCADO PAGO
    const submitAgendamento = (e) => {
        e.preventDefault();
        post(route('cliente.agendar.store', estabelecimento.id));
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

    const extrairConfiguracoes = (configRaw) => {
        let config = configRaw || {};
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) { config = {}; }
        }
        const tipoPagamento = config.tipo_pagamento === 'hibrido' ? 'Presencial ou Online' : 'Somente Online';
        const dias = config.dias_disponiveis || [];
        const diasFormatados = dias.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
        return { tipoPagamento, diasFormatados, diasArray: dias };
    };

    let servicoDisponivelNesteDia = false;
    let horariosDoServico = [];

    if (servicoSelecionado) {
        const configExtraida = extrairConfiguracoes(servicoSelecionado.configuracoes);
        servicoDisponivelNesteDia = configExtraida.diasArray.includes(diaDaSemanaSelecionado);
        let horas = servicoSelecionado.horarios_disponiveis || [];
        if (typeof horas === 'string') { try { horas = JSON.parse(horas); } catch (e) {} }
        horariosDoServico = horas;
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                        {estabelecimento.nome.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">{estabelecimento.nome}</h2>
                        <p className="text-sm text-gray-500">{estabelecimento.bairro}, {estabelecimento.cidade}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Agendar - ${estabelecimento.nome}`} />

            <div className="max-w-4xl mx-auto mt-6 px-4 pb-20">
                
                <form onSubmit={submitAgendamento} className="space-y-8 animate-in fade-in duration-500">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">1. O que você precisa hoje?</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {servicos.map(s => {
                                const { tipoPagamento, diasFormatados } = extrairConfiguracoes(s.configuracoes);
                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => handleSelectServico(s)}
                                        className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col h-full ${
                                            data.servico_id === s.id 
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-md' 
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md uppercase">{s.tipo_servico || 'Serviço'}</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{formatarMoeda(s.valor)}</span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-xl mb-1">{s.nome}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow line-clamp-2">{s.descricao || 'Sem descrição.'}</p>
                                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1">
                                            <p className="text-gray-600 dark:text-gray-400">⏱️ Duração: <strong className="text-gray-900 dark:text-white">{s.duracao_minutos} min</strong></p>
                                            <p className="text-gray-600 dark:text-gray-400">💳 Pagamento: <strong className="text-gray-900 dark:text-white">{tipoPagamento}</strong></p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <InputError message={errors.servico_id} className="mt-2" />
                    </div>

                    {servicoSelecionado && (
                        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">2. Escolha o melhor momento</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <InputLabel value="Data do Agendamento" className="mb-2" />
                                    <input type="date" className="w-full border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 rounded-xl p-3 focus:ring-indigo-500" value={data.data_agendamento} min={new Date().toISOString().split('T')[0]} onChange={e => setData('data_agendamento', e.target.value)} required />
                                    <InputError message={errors.data_agendamento} className="mt-2" />
                                </div>
                                <div>
                                    <InputLabel value="Horários Disponíveis" className="mb-2" />
                                    {!servicoDisponivelNesteDia ? (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-sm border border-red-100">Este serviço não atende neste dia da semana.</div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {horariosDoServico.map(hora => (
                                                <button type="button" key={hora} onClick={() => setData('hora_agendamento', hora)} className={`py-2 text-sm font-bold rounded-lg border-2 transition ${data.hora_agendamento === hora ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200'}`}>{hora}</button>
                                            ))}
                                        </div>
                                    )}
                                    <InputError message={errors.hora_agendamento} className="mt-2" />
                                </div>
                            </div>
                        </div>
                    )}

                    {servicoSelecionado && (
                        <div className="flex justify-end pt-4">
                            <PrimaryButton 
                                className="w-full sm:w-auto px-8 py-4 text-lg bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl shadow-xl hover:scale-[1.02] transition disabled:opacity-50" 
                                disabled={processing || !data.hora_agendamento || !servicoDisponivelNesteDia}
                            >
                                {processing ? 'A gerar pagamento...' : 'Confirmar e Pagar Agora'}
                            </PrimaryButton>
                        </div>
                    )}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}