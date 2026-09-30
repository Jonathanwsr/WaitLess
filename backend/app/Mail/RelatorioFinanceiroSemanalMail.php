<?php

namespace App\Mail;

use App\Models\RelatorioFinanceiroSemanal;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RelatorioFinanceiroSemanalMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public RelatorioFinanceiroSemanal $relatorio,
        public string $pdfBinario,
    ) {
    }

    public function envelope(): Envelope
    {
        $periodo = $this->relatorio->semana_inicio->format('d/m') . ' a ' . $this->relatorio->semana_fim->format('d/m');

        return new Envelope(
            subject: "Seu resumo financeiro da semana ({$periodo}) — Lokyva",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.relatorio_financeiro_semanal',
            with: ['relatorio' => $this->relatorio],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfBinario, 'relatorio-semanal-lokyva.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
