<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #FF5A00;">Seu contrato está pronto 📄</h2>
    <p>Olá, {{ $contrato->aluguel->locatario->name ?? '' }}!</p>
    <p>Segue em anexo o contrato <strong>{{ $contrato->titulo }}</strong> referente à sua reserva <strong>{{ $contrato->aluguel->codigo_reserva }}</strong>, nos formatos PDF e Word.</p>
    <p>Qualquer dúvida, é só responder este e-mail ou falar direto com quem alugou pra você.</p>
    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Enviado automaticamente pela Lokyva.</p>
</div>
