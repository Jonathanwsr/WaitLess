@php
    $nota = $notaFiscal;
    $nome = $nota->usuario->name ?? $nota->pagamento?->usuario?->name ?? 'cliente';
    $titulo = match ($nota->tipo) {
        'comissao' => 'Nota fiscal da comissão Lokyva',
        'assinatura' => 'Nota fiscal da sua assinatura',
        default => 'Nota fiscal da sua compra',
    };
    $explicacao = match ($nota->tipo) {
        'comissao' => 'Esta nota é da comissão de intermediação da Lokyva. O valor da venda foi direto para a sua carteira; esta nota vale como despesa da sua empresa com a plataforma.',
        'assinatura' => 'Esta nota é referente à cobrança do seu plano Lokyva.',
        default => 'Esta nota foi emitida pelo estabelecimento onde você comprou, pela plataforma Lokyva.',
    };
@endphp
<div style="background:#f6f6f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececec;">
        <div style="background:#FF5A00;padding:20px 24px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Lokyva</p>
        </div>
        <div style="padding:24px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">{{ $titulo }}</h1>
            <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">Olá, {{ $nome }}. {{ $explicacao }}</p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
                <tr><td style="padding:8px 0;color:#6b7280;">Descrição</td><td style="padding:8px 0;text-align:right;color:#111827;">{{ $nota->descricao_servico }}</td></tr>
                @if ($nota->numero)
                    <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #f0f0f0;">Número</td><td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0;">{{ $nota->numero }}</td></tr>
                @endif
                @if ($nota->tipo === 'comissao' && $nota->valor_operacao)
                    <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #f0f0f0;">Valor da venda</td><td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0;">R$ {{ number_format($nota->valor_operacao, 2, ',', '.') }}</td></tr>
                @endif
                <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #f0f0f0;">Valor da nota</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:16px;border-top:1px solid #f0f0f0;">R$ {{ number_format($nota->valor, 2, ',', '.') }}</td></tr>
            </table>

            @if ($nota->pdf_url)
                <a href="{{ $nota->pdf_url }}" style="display:inline-block;background:#FF5A00;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;">Baixar nota (PDF)</a>
                @if ($nota->xml_url)
                    <a href="{{ $nota->xml_url }}" style="display:inline-block;margin-left:8px;color:#374151;padding:12px 8px;text-decoration:underline;font-size:14px;">Baixar XML</a>
                @endif
            @else
                <p style="font-size:14px;color:#4b5563;">A prefeitura está processando a nota. O PDF fica disponível em instantes na área <b>Notas fiscais</b> da sua conta.</p>
            @endif

            <p style="margin:24px 0 0;font-size:13px;color:#4b5563;">
                @if ($nota->tipo === 'comissao')
                    Todas as notas que a Lokyva emite para você ficam em <b>Menu → Gestão → Notas fiscais</b>, na aba <b>Comissões Lokyva</b>.
                @else
                    Suas notas também ficam na área <b>Notas fiscais</b> da sua conta Lokyva.
                @endif
                <a href="{{ route('notas-fiscais.index', $nota->tipo === 'comissao' ? ['tipo' => 'comissao'] : []) }}" style="color:#FF5A00;font-weight:bold;">Ver minhas notas</a>
            </p>
        </div>
    </div>
</div>
