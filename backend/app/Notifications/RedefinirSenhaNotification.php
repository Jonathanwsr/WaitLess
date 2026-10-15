<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mail de "Esqueci minha senha" do site, em português e com a marca Lokyva.
 * Sai pelo e-mail configurado no .env (SMTP da Brevo) na hora, sem depender de fila.
 */
class RedefinirSenhaNotification extends Notification
{
    public function __construct(public string $token)
    {
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $link = url(route('password.reset', ['token' => $this->token, 'email' => $notifiable->getEmailForPasswordReset()], false));
        $minutos = (int) config('auth.passwords.' . config('auth.defaults.passwords') . '.expire', 60);

        return (new MailMessage())
            ->subject('Redefinir sua senha na Lokyva')
            ->view('emails.redefinir_senha', [
                'nome' => $notifiable->name,
                'link' => $link,
                'minutos' => $minutos,
            ]);
    }
}
