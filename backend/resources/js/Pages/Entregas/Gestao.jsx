import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import {
    TruckIcon, UserIcon, MapPinIcon, PhoneIcon, ArrowDownTrayIcon, CheckCircleIcon, KeyIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import CodigoSeisDigitos from '@/Components/Entregas/CodigoSeisDigitos';
import EnviarPosicao from '@/Components/Entregas/EnviarPosicao';

const STATUS = {
    pendente_pagamento: { rotulo: 'Aguardando pagamento', classe: 'bg-amber-50 text-amber-700' },
    pago: { rotulo: 'Pago · a entregar', classe: 'bg-blue-50 text-blue-700' },
    aguardando_confirmacao: { rotulo: 'A entregar', classe: 'bg-blue-50 text-blue-700' },
    concluido: { rotulo: 'Entregue', classe: 'bg-emerald-50 text-emerald-700' },
    cancelado: { rotulo: 'Cancelado', classe: 'bg-zinc-100 text-zinc-600' },
    estornado: { rotulo: 'Estornado', classe: 'bg-zinc-100 text-zinc-600' },
};

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

function Entrega({ pedido, funcionarios, aoAtualizar }) {
    const [codigo, setCodigo] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState(null);
    const status = STATUS[pedido.status] || { rotulo: pedido.status, classe: 'bg-zinc-100 text-zinc-600' };
    const ehDoLocal = funcionarios.filter((f) => f.estabelecimento_id === pedido.estabelecimento?.id);

    const finalizar = async () => {
        if (pedido.precisa_codigo && codigo.length !== 6) return;
        setOcupado(true);
        setErro(null);
        try {
            await axios.post(route('entregas.pedidos.liberar', pedido.id), pedido.precisa_codigo ? { codigo } : {});
            setCodigo('');
            aoAtualizar();
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível finalizar a entrega.');
        } finally {
            setOcupado(false);
        }
    };

    const cancelarPedido = async () => {
        const online = pedido.status === 'pago';
        const pergunta = online ? 'Cancelar este pedido e devolver o valor ao cliente?' : 'Cancelar este pedido?';
        if (!window.confirm(pergunta)) return;

        setOcupado(true);
        setErro(null);
        try {
            await axios.post(route('entregas.pedidos.cancelar-vendedor', pedido.id));
            aoAtualizar();
        } catch (e) {
            setErro(e.response?.data?.error || 'Não foi possível cancelar o pedido.');
        } finally {
            setOcupado(false);
        }
    };

    const atribuir = (valor) => {
        const corpo = valor === 'eu' ? { eu_mesmo: true } : valor ? { funcionario_id: Number(valor) } : {};
        router.post(route('entregas.pedidos.funcionario', pedido.id), corpo, {
            preserveScroll: true,
            onSuccess: aoAtualizar,
        });
    };

    const atual = pedido.eu_sou_entregador ? 'eu' : (pedido.funcionario_nome ? pedido.funcionario?.id ?? '' : '');

    return (
        <article className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-zinc-900">{pedido.produto?.nome || 'Produto removido'}</p>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${status.classe}`}>{status.rotulo}</span>
                        {pedido.monitoramento && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">Premium · rastreio ativo</span>}
                    </div>
                    <p className="text-xs text-zinc-400">{pedido.codigo_pedido} · {pedido.quantidade}x · {brl(pedido.valor_total)} · {pedido.forma_pagamento_label}</p>
                </div>
                <a href={route('entregas.pedidos.comprovante', pedido.id)} className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 whitespace-nowrap">
                    <ArrowDownTrayIcon className="w-4 h-4" /> Comprovante PDF
                </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 pb-5">
                <div className="bg-zinc-50 rounded-2xl p-4 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Cliente</p>
                    <p className="text-sm font-bold text-zinc-900">{pedido.cliente?.nome}</p>
                    {pedido.cliente?.telefone && <p className="text-xs text-zinc-600 flex items-center gap-1"><PhoneIcon className="w-3.5 h-3.5" /> {pedido.cliente.telefone}</p>}
                    <p className="text-xs text-zinc-500 flex items-start gap-1"><MapPinIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {pedido.endereco_recebimento}</p>
                    {pedido.entrega_observacoes && <p className="text-xs text-zinc-500">Detalhes: {pedido.entrega_observacoes}</p>}
                    <p className="text-[11px] font-bold text-zinc-500 pt-1">{pedido.modo_recebimento === 'entrega' ? 'Entrega em casa' : 'Retirada no local'}</p>
                </div>

                <div className="bg-zinc-50 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><TruckIcon className="w-3.5 h-3.5" /> Quem entrega</p>
                    {pedido.pode_atribuir ? (
                        <select value={atual} onChange={(e) => atribuir(e.target.value)} className="w-full rounded-xl border-zinc-200 text-sm focus:ring-[#FF5A00] focus:border-[#FF5A00]">
                            <option value="">Ninguém ainda</option>
                            <option value="eu">Eu mesmo (sócio)</option>
                            {ehDoLocal.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                    ) : (
                        <p className="text-sm font-bold text-zinc-900">{pedido.entregador_nome || pedido.funcionario_nome || 'Não definido'}</p>
                    )}
                    {pedido.eu_sou_entregador && <p className="text-xs text-emerald-700 font-bold">Você é o entregador deste pedido.</p>}
                    {pedido.pode_posicao && pedido.monitoramento && pedido.pode_finalizar && <EnviarPosicao pedido={pedido} />}
                </div>

                <div className="bg-zinc-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        {pedido.precisa_codigo ? <KeyIcon className="w-3.5 h-3.5" /> : <ShieldCheckIcon className="w-3.5 h-3.5" />} Finalizar
                    </p>
                    {pedido.pode_finalizar ? (
                        pedido.precisa_codigo ? (
                            <>
                                <p className="text-xs text-zinc-500">Pedido online: peça ao cliente o código de 6 dígitos.</p>
                                <CodigoSeisDigitos valor={codigo} onChange={setCodigo} desabilitado={ocupado} />
                                <button onClick={finalizar} disabled={ocupado || codigo.length !== 6} className="w-full bg-emerald-600 text-white font-black py-2.5 rounded-xl disabled:opacity-40">
                                    {ocupado ? 'Confirmando...' : 'Confirmar entrega'}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-zinc-500">Pagamento no local ou direto com o vendedor: basta marcar como finalizado.</p>
                                <button onClick={finalizar} disabled={ocupado} className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-black py-2.5 rounded-xl disabled:opacity-40">
                                    <CheckCircleIcon className="w-5 h-5" /> {ocupado ? 'Finalizando...' : 'Finalizado'}
                                </button>
                            </>
                        )
                    ) : (
                        <p className="text-xs text-zinc-500">{pedido.status === 'concluido' ? 'Entrega concluída.' : 'Não há ação pendente.'}</p>
                    )}
                    {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
                    {pedido.pode_cancelar && (
                        <button onClick={cancelarPedido} disabled={ocupado} className="w-full text-xs font-bold text-red-600 hover:underline disabled:opacity-40">
                            Cancelar pedido{pedido.status === 'pago' ? ' e devolver o valor' : ''}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function Gestao({ pedidos = [], funcionarios = [], papel = 'gestor' }) {
    const { auth } = usePage().props;
    const [filtro, setFiltro] = useState('abertos');

    const lista = pedidos.filter((p) => {
        if (filtro === 'abertos') return ['pago', 'aguardando_confirmacao'].includes(p.status);
        if (filtro === 'concluidos') return p.status === 'concluido';
        return true;
    });

    const atualizar = () => router.reload({ only: ['pedidos'] });

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Entregas" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#FF5A00]">{papel === 'funcionario' ? 'Suas entregas' : 'Gestão de entregas'}</p>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                            <TruckIcon className="w-8 h-8 text-[#FF5A00]" /> Entregas
                        </h1>
                        <p className="text-sm text-zinc-500 mt-1">
                            {papel === 'funcionario'
                                ? 'As entregas em que você foi designado, com os dados do cliente.'
                                : 'Escolha quem entrega, acompanhe em rota e finalize cada pedido.'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {[{ id: 'abertos', rotulo: 'Em aberto' }, { id: 'concluidos', rotulo: 'Concluídas' }, { id: 'todos', rotulo: 'Todas' }].map((f) => (
                            <button key={f.id} onClick={() => setFiltro(f.id)} className={`px-4 py-2 rounded-full text-sm font-bold ${filtro === f.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600'}`}>
                                {f.rotulo}
                            </button>
                        ))}
                    </div>
                </header>

                {lista.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-zinc-100">
                        <TruckIcon className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-400">
                            {papel === 'funcionario' ? 'Nenhuma entrega designada para você agora.' : 'Nenhuma entrega nesta lista.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lista.map((p) => <Entrega key={p.id} pedido={p} funcionarios={funcionarios} aoAtualizar={atualizar} />)}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
