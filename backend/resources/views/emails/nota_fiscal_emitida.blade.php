<div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #4f46e5;">Olá, {{ $notaFiscal->usuario->name ?? $notaFiscal->pagamento?->usuario?->name }}! 🧾</h2>
    <p>A nota fiscal referente a <strong>{{ $notaFiscal->descricao_servico }}</strong> (R$ {{ number_format($notaFiscal->valor, 2, ',', '.') }}) foi gerada com sucesso.</p>
    @if ($notaFiscal->pdf_url)
        <br>
        <a href="{{ $notaFiscal->pdf_url }}" style="background-color: #5be546; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Baixar Nota Fiscal (PDF)</a>
        <br><br>
    @else
        <p>Ela está sendo processada pela prefeitura e o PDF ficará disponível em breve.</p>
    @endif
    <p>Obrigado por confiar na Lokyva!</p>
</div>
