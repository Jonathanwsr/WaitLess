<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprovante de Estorno - {{ $estorno->codigo_estorno }}</title>

    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <style>
        :root {
            --primary: #FF5A00;
            --primary-light: #FFF5EF;
            --primary-border: #FFDCC4;
            --text-main: #1E293B;
            --text-muted: #64748B;
            --text-light: #94A3B8;
            --bg-body: #F1F5F9;
            --bg-paper: #FFFFFF;
            --border-color: #E2E8F0;
            --success-bg: #D1FAE5;
            --success-text: #065F46;
            --success-border: #A7F3D0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            line-height: 1.5;
            font-size: 12px;
            display: flex;
            justify-content: center;
            padding: 20px;
        }

        /* Container que simula a folha A4 na tela */
        .a4-container {
            background: var(--bg-paper);
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .brand-bar {
            height: 8px;
            width: 100%;
            background: var(--primary);
        }

        .page-content {
            padding: 40px;
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 24px;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
        }

        .brand .logo-text {
            font-size: 28px;
            font-weight: 800;
            color: var(--text-main);
            letter-spacing: -0.5px;
            line-height: 1;
        }

        .brand .logo-text span {
            color: var(--primary);
        }

        .brand .tagline {
            margin-top: 6px;
            font-size: 10px;
            color: var(--text-light);
            font-weight: 500;
            max-width: 280px;
            line-height: 1.4;
        }

        .status-container {
            text-align: right;
        }

        .badge-success {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background-color: var(--success-bg);
            border: 1px solid var(--success-border);
            border-radius: 100px;
            color: var(--success-text);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-success .dot {
            width: 6px;
            height: 6px;
            background-color: #10B981;
            border-radius: 50%;
        }

        .status-container p {
            margin-top: 8px;
            font-size: 10px;
            color: var(--text-light);
        }

        /* Protocol Box */
        .protocol-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #F8FAFC;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 24px;
        }

        .protocol-item {
            display: flex;
            flex-direction: column;
        }

        .protocol-item.right {
            text-align: right;
        }

        .label-small {
            font-size: 10px;
            color: var(--text-light);
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .protocol-value {
            font-family: monospace;
            font-size: 14px;
            font-weight: 700;
            color: var(--text-main);
        }

        .protocol-value.muted {
            font-size: 12px;
            color: var(--text-muted);
        }

        /* Value Box */
        .value-box {
            background-color: var(--primary-light);
            border: 1px solid var(--primary-border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .value-left .currency {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-muted);
        }

        .value-left .amount {
            font-size: 32px;
            font-weight: 800;
            color: var(--text-main);
            letter-spacing: -0.5px;
            line-height: 1.1;
            margin-top: 4px;
        }

        .value-right {
            text-align: right;
        }

        .value-right .status-text {
            font-size: 13px;
            font-weight: 700;
            color: var(--success-text);
            margin-top: 4px;
        }

        /* Details Section */
        .section-title {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }

        .section-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background-color: #F1F5F9;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-weight: 700;
            font-size: 12px;
        }

        .section-title h2 {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-main);
        }

        .section-title p {
            font-size: 11px;
            color: var(--text-light);
        }

        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
        }

        .detail-item .value {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-main);
            margin-top: 2px;
        }

        .detail-item .sub-value {
            font-size: 10px;
            color: var(--text-light);
            margin-top: 2px;
        }

        /* Divider */
        .divider {
            border-top: 1px dashed var(--border-color);
            margin: 0 0 32px 0;
        }

        /* Info Box */
        .info-box {
            display: flex;
            gap: 16px;
            padding: 20px;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            margin-bottom: auto; /* Empurra o footer para baixo */
        }

        .info-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background-color: var(--success-bg);
            color: var(--success-text);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 900;
            flex-shrink: 0;
        }

        .info-text h3 {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 4px;
        }

        .info-text p {
            font-size: 11px;
            color: var(--text-muted);
            line-height: 1.6;
        }

        /* Footer */
        .footer {
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
        }

        .footer-disclaimer {
            max-width: 400px;
        }

        .footer-disclaimer p {
            font-size: 9px;
            color: var(--text-light);
            line-height: 1.5;
            margin-bottom: 8px;
        }
        
        .footer-disclaimer p:last-child {
            margin-bottom: 0;
        }

        .footer-meta {
            text-align: right;
            flex-shrink: 0;
        }

        .footer-meta .date {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .footer-bottom {
            display: flex;
            justify-content: space-between;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #F1F5F9;
            font-size: 9px;
            color: var(--text-light);
        }

        /* Responsividade para Celulares */
        @media (max-width: 600px) {
            body { padding: 0; background: var(--bg-paper); }
            .a4-container { box-shadow: none; border-radius: 0; min-height: 100vh; }
            .page-content { padding: 24px; }
            .header { flex-direction: column; gap: 20px; }
            .status-container { text-align: left; }
            .protocol-box { flex-direction: column; align-items: flex-start; gap: 16px; }
            .protocol-item.right { text-align: left; }
            .value-box { flex-direction: column; align-items: flex-start; gap: 16px; }
            .value-right { text-align: left; }
            .details-grid { grid-template-columns: 1fr; gap: 20px; }
            .footer { flex-direction: column; align-items: flex-start; }
            .footer-meta { text-align: left; }
        }

        /* Regras de Impressão (Print/PDF) */
        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media print {
            body { padding: 0; background: white; }
            .a4-container { box-shadow: none; border-radius: 0; max-width: 100%; min-height: 297mm; }
            .page-content { padding: 15mm; }
        }
    </style>
</head>
<body onload="window.print()">

<div class="a4-container">
    <div class="brand-bar"></div>

    <div class="page-content">
        
        <!-- CABEÇALHO -->
        <div class="header">
            <div class="brand">
                <div class="logo-text">LOK<span>Y</span>VA</div>
                <div class="tagline">
                    Plataforma digital de serviços, reservas e agendamentos, conectando clientes e estabelecimentos de forma simples, rápida e segura.
                </div>
            </div>
            
            <div class="status-container">
                <div class="badge-success">
                    <span class="dot"></span>
                    ESTORNO PROCESSADO
                </div>
                <p>Comprovante oficial</p>
            </div>
        </div>

        <!-- PROTOCOLO -->
        <div class="protocol-box">
            <div class="protocol-item">
                <span class="label-small">Protocolo do estorno</span>
                <span class="protocol-value">{{ $estorno->codigo_estorno }}</span>
            </div>
            
            <div class="protocol-item right">
                <span class="label-small">ID do Gateway</span>
                <span class="protocol-value muted">{{ $estorno->id_estorno_asaas ?? $estorno->id_transacao_asaas ?? 'N/A' }}</span>
            </div>
        </div>

        <!-- VALOR -->
        <div class="value-box">
            <div class="value-left">
                <div class="label-small">Valor total reembolsado</div>
                <div class="amount">
                    <span class="currency">R$</span> 
                    {{ number_format($estorno->valor_estornado, 2, ',', '.') }}
                </div>
            </div>
            
            <div class="value-right">
                <div class="label-small">Status financeiro</div>
                <div class="status-text">Valor devolvido</div>
            </div>
        </div>

        <!-- DETALHES DA TRANSAÇÃO -->
        <div class="section-title">
            <div class="section-icon">01</div>
            <div>
                <h2>Detalhes da transação</h2>
                <p>Informações relacionadas ao pagamento original e devolução</p>
            </div>
        </div>

        <div class="details-grid">
            <div class="detail-item">
                <div class="label-small">Estabelecimento</div>
                <div class="value">{{ $estorno->estabelecimento->nome ?? 'N/A' }}</div>
            </div>

            <div class="detail-item">
                <div class="label-small">Cliente</div>
                <div class="value">{{ $estorno->cliente->name ?? 'N/A' }}</div>
            </div>

            <div class="detail-item">
                <div class="label-small">Pagamento original</div>
                <div class="value">{{ \Carbon\Carbon::parse($estorno->data_pagamento)->format('d/m/Y H:i') }}</div>
            </div>

            <div class="detail-item">
                <div class="label-small">Estorno realizado</div>
                <div class="value">{{ \Carbon\Carbon::parse($estorno->data_estorno)->format('d/m/Y H:i') }}</div>
            </div>

            <div class="detail-item">
                <div class="label-small">Método de devolução</div>
                <div class="value">{{ $estorno->forma_pagamento }}</div>
                <div class="sub-value">Processamento automático via gateway</div>
            </div>

            <div class="detail-item">
                <div class="label-small">Motivo do estorno</div>
                <div class="value">{{ $estorno->motivo }}</div>
            </div>
        </div>

        <div class="divider"></div>

        <!-- INFORMAÇÃO DO REEMBOLSO -->
        <div class="info-box">
            <div class="info-icon">✓</div>
            <div class="info-text">
                <h3>Reembolso confirmado</h3>
                <p>O estorno foi processado com sucesso na plataforma e o valor foi encaminhado para o meio de pagamento utilizado na transação original.</p>
            </div>
        </div>

        <!-- RODAPÉ -->
        <div class="footer">
            <div class="footer-disclaimer">
                <div class="label-small">Informações importantes</div>
                <p>Este documento confirma o processamento do estorno registrado na plataforma Lokyva. O prazo para visualização do valor pode variar conforme a instituição financeira, banco ou emissor do cartão.</p>
                <p>Em alguns casos, o valor pode aparecer em até 72 horas úteis ou em até duas faturas, dependendo do meio de pagamento e fechamento da fatura.</p>
            </div>
            
            <div class="footer-meta">
                <div class="label-small">Documento gerado em</div>
                <div class="date">{{ now()->format('d/m/Y H:i') }}</div>
            </div>
        </div>

        <div class="footer-bottom">
            <span>Lokyva · Comprovante de Estorno</span>
            <span style="font-family: monospace;">{{ $estorno->codigo_estorno }}</span>
        </div>

    </div>
</div>

</body>
</html>