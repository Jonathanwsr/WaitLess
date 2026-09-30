<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $titulo }} - Lokyva</title>

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
            --success-text: #059669;
            --danger-text: #DC2626;
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
            line-height: 1.6;
            font-size: 13px;
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

        /* Header Padrão Lokyva */
        .header-brand {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
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
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .periodo-badge {
            background-color: #F8FAFC;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 8px 16px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: 0.3px;
        }

        /* Saudação / Título Principal */
        .greeting {
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
        }

        .greeting h1 {
            font-size: 24px;
            font-weight: 800;
            color: var(--text-main);
            letter-spacing: -0.5px;
            margin-bottom: 8px;
        }

        .greeting p {
            font-size: 14px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .greeting strong {
            color: var(--text-main);
        }

        /* Cards de Resumo */
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background-color: var(--bg-paper);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background-color: var(--border-color);
        }

        .stat-card.highlight::before {
            background-color: var(--primary);
        }

        .stat-card h3 {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .stat-card p {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .text-green { color: var(--success-text); }
        .text-orange { color: var(--primary); }
        .text-red { color: var(--danger-text); }

        /* Tabelas Modernas */
        .section-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section-title::before {
            content: '';
            display: block;
            width: 16px;
            height: 4px;
            background-color: var(--primary);
            border-radius: 2px;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
        }

        .data-table th {
            text-align: left;
            padding: 12px 16px;
            background-color: #F8FAFC;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--border-color);
            border-top: 1px solid var(--border-color);
        }

        .data-table td {
            padding: 16px;
            border-bottom: 1px dashed var(--border-color);
            font-size: 13px;
            color: var(--text-main);
            font-weight: 500;
        }

        .data-table tr:last-child td {
            border-bottom: 1px solid var(--border-color);
        }

        .data-table td.col-center { text-align: center; color: var(--text-muted); }
        .data-table td.col-right { text-align: right; font-weight: 700; }

        /* Linha de Lucro Destacada */
        .linha-lucro td {
            background-color: var(--primary-light);
            border-bottom: none !important;
            padding: 20px 16px;
        }

        .linha-lucro td:first-child {
            border-top-left-radius: 8px;
            border-bottom-left-radius: 8px;
            color: var(--text-main);
            font-size: 14px;
            font-weight: 800;
        }

        .linha-lucro td:last-child {
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
            font-size: 18px;
        }

        /* Rodapé */
        .footer {
            margin-top: auto;
            padding-top: 32px;
            border-top: 1px solid var(--border-color);
            text-align: center;
        }

        .footer p {
            font-size: 10px;
            color: var(--text-light);
            line-height: 1.6;
            margin-bottom: 12px;
        }

        .footer p strong {
            color: var(--text-muted);
        }

        .footer-date {
            display: inline-block;
            background-color: #F8FAFC;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted);
            border: 1px solid var(--border-color);
        }

        /* Responsividade para Celulares */
        @media (max-width: 600px) {
            body { padding: 0; background: var(--bg-paper); }
            .a4-container { box-shadow: none; border-radius: 0; min-height: 100vh; }
            .page-content { padding: 24px; }
            .header-brand { flex-direction: column; gap: 16px; align-items: flex-start; }
            .stats-grid { grid-template-columns: 1fr; }
            
            /* Ajuste de tabela para celular */
            .data-table, .data-table tbody, .data-table tr, .data-table td { display: block; width: 100%; }
            .data-table thead { display: none; }
            .data-table tr { padding: 12px 0; border-bottom: 1px dashed var(--border-color); }
            .data-table td { padding: 4px 0; border: none; text-align: left !important; }
            .data-table td.col-center { text-align: left !important; font-size: 11px; margin-bottom: 4px; }
            
            .linha-lucro td { display: flex; justify-content: space-between; align-items: center; padding: 16px !important; }
        }

        /* Regras de Impressão */
        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media print {
            body { padding: 0; background: white; }
            .a4-container { box-shadow: none; border-radius: 0; max-width: 100%; min-height: 297mm; }
            .page-content { padding: 15mm; }
            .stat-card { border: 1px solid #CBD5E1; }
        }
    </style>
</head>
<body onload="window.print()">

<div class="a4-container">
    <div class="brand-bar"></div>

    <div class="page-content">
        
        <!-- Header da Marca -->
        <div class="header-brand">
            <div class="brand">
                <div class="logo-text">LOK<span>Y</span>VA</div>
                <div class="tagline">Relatório Financeiro Semanal</div>
            </div>
            
            <div class="periodo-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {{ $data_inicio }} a {{ $data_fim }}
            </div>
        </div>

        <!-- Título e Saudação -->
        <div class="greeting">
            <h1>{{ $titulo }}</h1>
            <p>Olá, <strong>{{ $usuario_nome }}</strong>. Aqui está o resumo financeiro completo da sua semana.</p>
        </div>

        <!-- Cards de Resumo -->
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Receita Bruta</h3>
                <p class="text-green">R$ {{ number_format($relatorio->receita_bruta_total, 2, ',', '.') }}</p>
            </div>
            
            <div class="stat-card highlight">
                <h3>Receita Líquida</h3>
                <p class="text-orange">R$ {{ number_format($relatorio->receita_liquida_total, 2, ',', '.') }}</p>
            </div>
        </div>

        <!-- Detalhamento por Origem -->
        <div class="section-title">Detalhamento por origem</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Categoria / Origem</th>
                    <th style="text-align: center;">Volume</th>
                    <th style="text-align: right;">Total Bruto</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Agendamentos de serviço</td>
                    <td class="col-center">{{ $relatorio->total_agendamentos }} atendimento(s)</td>
                    <td class="col-right">R$ {{ number_format($relatorio->receita_agendamentos, 2, ',', '.') }}</td>
                </tr>
                <tr>
                    <td>Locações (via estabelecimento)</td>
                    <td class="col-center">{{ $relatorio->total_alugueis_estabelecimento }} locação(ões)</td>
                    <td class="col-right">R$ {{ number_format($relatorio->receita_alugueis_estabelecimento, 2, ',', '.') }}</td>
                </tr>
                <tr>
                    <td>Locações avulsas</td>
                    <td class="col-center">{{ $relatorio->total_locacoes_avulsas }} locação(ões)</td>
                    <td class="col-right">R$ {{ number_format($relatorio->receita_locacoes_avulsas, 2, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>

        <!-- Resumo Financeiro (Descontos e Liquidez) -->
        <div class="section-title">Resumo Financeiro</div>
        <table class="data-table" style="margin-bottom: 0;">
            <thead>
                <tr>
                    <th>Descrição</th>
                    <th style="text-align: right;">Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Taxa da plataforma Lokyva</td>
                    <td class="col-right text-red">- R$ {{ number_format($relatorio->taxa_plataforma_total, 2, ',', '.') }}</td>
                </tr>
                <tr class="linha-lucro">
                    <td>Receita líquida da semana</td>
                    <td class="col-right text-orange">R$ {{ number_format($relatorio->receita_liquida_total, 2, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>

        <!-- Rodapé -->
        <div class="footer">
            <p>
                Este é um comunicado automático enviado toda semana para assinantes do plano <strong>Premium</strong>.<br>
                Cancele quando quiser na sua tela de assinatura — o envio será interrompido automaticamente.
            </p>
            <div class="footer-date">
                Emitido eletronicamente em: {{ \Carbon\Carbon::now()->format('d/m/Y \à\s H:i') }}
            </div>
        </div>

    </div>
</div>

</body>
</html>