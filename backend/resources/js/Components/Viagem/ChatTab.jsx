import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { erroDe, fmtDataHora } from './util';

/**
 * Chat do grupo. Tempo real pelo canal privado viagem.{id} (Reverb/Echo) e,
 * como garantia, consulta mensagens novas a cada poucos segundos.
 */
export default function ChatTab({ painel, notificar }) {
    const viagemId = painel.viagem.id;
    const eu = painel.eu;
    const [mensagens, setMensagens] = useState(painel.mensagens);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const fim = useRef(null);
    const ultimoId = useRef(0);

    const juntar = (novas) => setMensagens((atual) => {
        const ids = new Set(atual.map((m) => m.id));
        const extra = novas.filter((m) => !ids.has(m.id));
        return extra.length ? [...atual, ...extra].sort((a, b) => a.id - b.id) : atual;
    });

    useEffect(() => { ultimoId.current = mensagens.length ? mensagens[mensagens.length - 1].id : 0; }, [mensagens]);
    useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [mensagens.length]);

    useEffect(() => {
        const buscar = () => axios.get(route('viagens.mensagens.index', viagemId), { params: { apos: ultimoId.current } }).then(({ data }) => data.length && juntar(data)).catch(() => {});
        const t = setInterval(() => !document.hidden && buscar(), 6000);

        let canal;
        if (window.Echo) {
            canal = window.Echo.private(`viagem.${viagemId}`).listen('.mensagem.nova', (m) => juntar([m]));
        }

        return () => { clearInterval(t); if (canal) window.Echo.leave(`viagem.${viagemId}`); };
    }, [viagemId]);

    const enviar = async (e) => {
        e.preventDefault();
        const conteudo = texto.trim();
        if (!conteudo) return;
        setEnviando(true);
        try {
            const { data } = await axios.post(route('viagens.mensagens.store', viagemId), { conteudo });
            juntar([data]);
            setTexto('');
        } catch (err) {
            notificar({ tipo: 'erro', texto: erroDe(err) });
        } finally { setEnviando(false); }
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[560px]">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {mensagens.length === 0 && <p className="text-sm text-gray-400 text-center mt-10">Comece a conversa do grupo.</p>}
                {mensagens.map((m) => (m.tipo === 'sistema' ? (
                    <p key={m.id} className="text-center text-xs text-gray-400">{m.conteudo}</p>
                ) : (
                    <div key={m.id} className={`flex ${m.usuario_id === eu.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.usuario_id === eu.id ? 'bg-[#FF5A00] text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
                            {m.usuario_id !== eu.id && <p className="text-xs font-black text-[#C74B27] mb-0.5">{m.autor}</p>}
                            <p className="text-sm whitespace-pre-wrap break-words">{m.conteudo}</p>
                            <p className={`text-[10px] mt-1 ${m.usuario_id === eu.id ? 'text-white/70' : 'text-gray-400'}`}>{fmtDataHora(m.criado_em)}</p>
                        </div>
                    </div>
                )))}
                <div ref={fim} />
            </div>
            <form onSubmit={enviar} className="border-t border-gray-100 p-3 flex gap-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} placeholder="Escreva para o grupo…" className="flex-1 rounded-xl border-gray-200 focus:border-[#FF5A00] focus:ring-[#FF5A00] text-sm" />
                <button disabled={enviando || !texto.trim()} className="px-4 rounded-xl bg-[#FF5A00] hover:bg-[#C74B27] disabled:opacity-50 text-white transition" title="Enviar"><PaperAirplaneIcon className="w-5 h-5" /></button>
            </form>
        </div>
    );
}
