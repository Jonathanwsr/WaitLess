<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BemVindoAssinaturaMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $plano;

    public function __construct($user, $plano)
    {
        $this->user = $user;
        $this->plano = strtoupper($plano);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Bem-vindo ao WaitLess ' . $this->plano . '!',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.boas_vindas_assinatura',
        );
    }
}