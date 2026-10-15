<div style="background:#f6f6f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececec;">
        <div style="background:#FF5A00;padding:20px 24px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Lokyva</p>
        </div>
        <div style="padding:28px 24px;">
            <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Vamos criar uma nova senha</h1>
            <p style="margin:0 0 18px;font-size:15px;color:#4b5563;line-height:1.6;">
                Olá, {{ $nome }}! Recebemos um pedido para redefinir a senha da sua conta. Toque no botão abaixo para escolher a nova senha.
            </p>

            <p style="text-align:center;margin:26px 0;">
                <a href="{{ $link }}" style="display:inline-block;background:#FF5A00;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:15px;">Criar nova senha</a>
            </p>

            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">O link vale por {{ $minutos }} minutos e só pode ser usado uma vez.</p>
            <p style="margin:0 0 18px;font-size:12px;color:#9ca3af;line-height:1.6;word-break:break-all;">
                Se o botão não abrir, copie e cole este endereço no navegador:<br>{{ $link }}
            </p>

            <div style="border-top:1px solid #f0f0f0;padding-top:16px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                    Não foi você? Pode ignorar este e-mail: sua senha continua a mesma. Nunca pedimos sua senha por e-mail ou mensagem.
                </p>
            </div>
        </div>
    </div>
</div>
