<?php

namespace App\Mail;

use App\Models\NotaFiscal;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotaFiscalEmitidaMail extends Mailable
{
    use Queueable, SerializesModels;

    public NotaFiscal $notaFiscal;

    public function __construct(NotaFiscal $notaFiscal)
    {
        $this->notaFiscal = $notaFiscal;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Sua nota fiscal Lokyva está disponível',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.nota_fiscal_emitida',
        );
    }
}
