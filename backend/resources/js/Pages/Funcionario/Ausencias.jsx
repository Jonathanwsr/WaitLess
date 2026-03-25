import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage, Link, router } from '@inertiajs/react';
import { 
    CalendarIcon, CheckCircleIcon, XCircleIcon, 
    ArrowLeftIcon, BuildingStorefrontIcon, TrashIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

export default function AusenciasFuncionario({ auth, funcionarios, ausencias }) {
    const { flash = {} } = usePage().props;
    
    // Formulário blindado
    const { data, setData, post, processing, reset, errors } = useForm({
        funcionario_id: funcionarios && funcionarios.length > 0 ? funcionarios[0].id : '',
        data_ausencia: '',
        motivo: ''
    });

    const submit = (e) => {
        e.preventDefault();
        
        // Validação extra de segurança no front
        if (!data.data_ausencia) {
            alert("Por favor, escolha uma data.");
            return;
        }

        post(route('funcionario.ausencias.store'), { 
            onSuccess: () => reset('data_ausencia', 'motivo'),
            preserveScroll: true
        });
    };

    const cancelarAusencia = (id) => {
        if(window.confirm('Deseja cancelar esta ausência e reabrir a sua agenda?')) {
            router.delete(route('funcionario.ausencias.destroy', id), {
                preserveScroll: true
            });
        }
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-2xl font-black text-gray-900 tracking-tight">Agenda e Horários</h2>}>
            <Head title="Ausências - WaitLess" />

            <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 pb-24 mt-6 font-sans">
                
                {/* --- CABEÇALHO SUPERIOR --- */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href={route('funcionario.dashboard')} className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl flex items-center justify-center text-gray-700 transition shadow-sm">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Gestão de Faltas e Folgas</h3>
                        <p className="text-sm text-gray-500 font-medium mt-0.5">Bloqueie a sua agenda para dias em que não estará disponível.</p>
                    </div>
                </div>

                {/* --- ALERTAS E SUCESSO --- */}
                {flash?.success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl shadow-sm flex items-center gap-3 animate-in fade-in">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                        <span className="font-bold text-sm tracking-tight">{flash.success}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* ========================================== */}
                    {/* FORMULÁRIO DE REGISTRO */}
                    {/* ========================================== */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm h-max relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
                        
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 shadow-inner">
                                <CalendarIcon className="w-5 h-5"/>
                            </div>
                            <h3 className="text-lg font-black text-gray-900">Nova Ausência</h3>
                        </div>

                        <form onSubmit={submit} className="space-y-5 relative z-10">
                            
                            {/* SELETOR DE LOJA (Apenas se tiver mais de uma) */}
                            {funcionarios && funcionarios.length > 1 && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Unidade / Loja</label>
                                    <select 
                                        value={data.funcionario_id} onChange={e => setData('funcionario_id', e.target.value)}
                                        className={`w-full bg-gray-50 border ${errors.funcionario_id ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-700 font-bold focus:ring-indigo-500`} required
                                    >
                                        {funcionarios.map(f => <option key={f.id} value={f.id}>{f.estabelecimento?.nome || 'Loja Indefinida'}</option>)}
                                    </select>
                                    {errors.funcionario_id && <p className="text-red-500 text-xs font-bold mt-1 flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3"/>{errors.funcionario_id}</p>}
                                </div>
                            )}

                            {/* DATA */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Data da Falta/Folga</label>
                                <input 
                                    type="date" value={data.data_ausencia} onChange={e => setData('data_ausencia', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]} // Impede de escolher datas no passado
                                    className={`w-full bg-gray-50 border ${errors.data_ausencia ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-700 font-bold focus:ring-indigo-500`} required
                                />
                                {errors.data_ausencia && <p className="text-red-500 text-xs font-bold mt-1 flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3"/>{errors.data_ausencia}</p>}
                            </div>

                            {/* MOTIVO */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Motivo da Ausência</label>
                                <select 
                                    value={data.motivo} onChange={e => setData('motivo', e.target.value)}
                                    className={`w-full bg-gray-50 border ${errors.motivo ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-700 font-bold focus:ring-indigo-500`} required
                                >
                                    <option value="" disabled>Selecione um motivo...</option>
                                    <option value="Folga Programada">Folga Programada</option>
                                    <option value="Motivos de Saúde">Motivos de Saúde</option>
                                    <option value="Assuntos Pessoais">Assuntos Pessoais</option>
                                    <option value="Férias">Férias</option>
                                </select>
                                {errors.motivo && <p className="text-red-500 text-xs font-bold mt-1 flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3"/>{errors.motivo}</p>}
                            </div>

                            {/* BOTÃO SALVAR */}
                            <button disabled={processing} className="w-full py-4 mt-2 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-lg shadow-gray-900/20 transition-all disabled:opacity-50 hover:-translate-y-0.5">
                                {processing ? 'Salvando...' : 'Bloquear Minha Agenda'}
                            </button>
                        </form>
                    </div>

                    {/* ========================================== */}
                    {/* LISTA DE AUSÊNCIAS PROGRAMADAS */}
                    {/* ========================================== */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-500" /> Ausências Agendadas
                            </h3>
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                                {ausencias ? ausencias.length : 0} Registos
                            </span>
                        </div>

                        {!ausencias || ausencias.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 flex flex-col items-center">
                                <CheckCircleIcon className="w-12 h-12 mb-3 text-emerald-400 opacity-50" />
                                <p className="font-bold text-gray-500">A sua agenda está 100% disponível.</p>
                                <p className="text-xs mt-1">Não tem faltas ou folgas marcadas para o futuro.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {ausencias.map(ausencia => (
                                    <div key={ausencia.id} className="bg-white border border-gray-200 hover:border-indigo-200 p-4 rounded-2xl flex items-center justify-between shadow-sm transition-colors group">
                                        <div>
                                            <p className="font-black text-lg text-gray-900 tracking-tight">
                                                {new Date(ausencia.data_ausencia + 'T00:00:00').toLocaleDateString('pt-BR')}
                                            </p>
                                            <p className="text-sm font-bold text-red-600 flex items-center gap-1.5 mt-0.5">
                                                <XCircleIcon className="w-4 h-4"/> {ausencia.motivo}
                                            </p>
                                            {funcionarios && funcionarios.length > 1 && (
                                                <p className="text-[10px] font-bold text-gray-500 uppercase mt-2 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded w-max border border-gray-100">
                                                    <BuildingStorefrontIcon className="w-3 h-3"/> {ausencia.loja}
                                                </p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => cancelarAusencia(ausencia.id)} 
                                            title="Cancelar Folga"
                                            className="w-10 h-10 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl flex items-center justify-center transition-all shadow-sm"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}