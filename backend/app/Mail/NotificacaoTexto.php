<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Mailable genérico para as notificações que antes eram enviadas com
 * `Mail::raw(...)` (texto simples, montadas na hora dentro do controller).
 *
 * Existe só para permitir `->queue()` em vez de `->send()`: `Mail::raw()` não
 * tem uma versão "queue", porque não existe Mailable nenhum por trás — então
 * qualquer chamada a `Mail::raw()` SEMPRE bloqueia a resposta HTTP até o
 * e-mail terminar de ser enviado pelo servidor de SMTP/Brevo. Envolvendo o
 * mesmo texto neste Mailable, a mesma notificação pode ser despachada pra
 * fila (`Mail::to(...)->queue(new NotificacaoTexto(...))`), liberando a
 * resposta pro usuário na hora.
 */
class NotificacaoTexto extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $assunto,
        public string $corpo,
    ) {
    }

    public function build()
    {
        return $this
            ->subject($this->assunto)
            ->html('<div style="font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; white-space: pre-wrap; line-height: 1.5;">'
                . e($this->corpo)
                . '</div>');
    }
}
