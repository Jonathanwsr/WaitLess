import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { UsersIcon } from '@heroicons/react/24/solid';
import { Aviso, erroDe, fmtDia } from '@/Components/Viagem/util';

export default function Convite({ viagem, codigo, jaParticipa, viagemId }) {
    const [aviso, setAviso] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const entrar = async () => {
        setEnviando(true);
        try {
            const { data } = await axios.post(route('viagens.convite.entrar', codigo));
            router.visit(data.url);
        } catch (e) {
            setAviso({ tipo: 'erro', texto: erroDe(e) });
            setEnviando(false);
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="font-black text-xl text-gray-800">Convite para viagem</h2>}>
            <Head title="Convite para viagem" />
            <div className="max-w-lg mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
                <UsersIcon className="w-12 h-12 text-[#FF5A00] mx-auto" />
                <p className="text-sm text-gray-500">{viagem.criador} convidou você para</p>
                <h3 className="text-2xl font-black text-gray-900">{viagem.titulo}</h3>
                <p className="text-gray-600">{viagem.destino} · {fmtDia(viagem.data_inicio)} a {fmtDia(viagem.data_fim)}</p>
                <p className="text-sm text-gray-400">{viagem.membros} {viagem.membros === 1 ? 'pessoa' : 'pessoas'} no grupo</p>
                <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
                {jaParticipa ? (
                    <button onClick={() => router.visit(route('viagens.show', viagemId))} className="w-full py-3 rounded-xl bg-[#FF5A00] text-white font-black">Abrir viagem</button>
                ) : (
                    <button onClick={entrar} disabled={enviando} className="w-full py-3 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-60 text-white font-black transition">{enviando ? 'Entrando…' : 'Entrar no grupo'}</button>
                )}
                <p className="text-xs text-gray-400">Você não precisa de plano Premium para participar do grupo.</p>
            </div>
        </AuthenticatedLayout>
    );
}
