<?php

namespace App\Mail;

use App\Models\Contrato;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ContratoParaClienteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Contrato $contrato)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Seu contrato — ' . $this->contrato->titulo,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.contrato_cliente',
            with: ['contrato' => $this->contrato],
        );
    }

    public function attachments(): array
    {
        $anexos = [];

        if ($this->contrato->arquivo_pdf && Storage::disk('public')->exists($this->contrato->arquivo_pdf)) {
            $anexos[] = Attachment::fromStorageDisk('public', $this->contrato->arquivo_pdf)
                ->as('contrato.pdf')
                ->withMime('application/pdf');
        }

        if ($this->contrato->arquivo_docx && Storage::disk('public')->exists($this->contrato->arquivo_docx)) {
            $anexos[] = Attachment::fromStorageDisk('public', $this->contrato->arquivo_docx)
                ->as('contrato.docx')
                ->withMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }

        return $anexos;
    }
}
