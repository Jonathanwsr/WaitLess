<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprovante Lokyva #{{ $aluguel->codigo_reserva ?? $aluguel->id }}</title>
    
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
        :root {
            --primary: #FF5A00;
            --primary-light: #FFF5EF;
            --primary-border: #FFDCC4;
            --text-main: #1E293B;
            --text-muted: #64748B;
            --text-light: #94A3B8;
            --bg-body: #F8FAFC;
            --bg-paper: #FFFFFF;
            --border-color: #E2E8F0;
            --dark-box: #0F172A;
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
            max-width: 210mm; /* Largura exata do A4 */
            min-height: 297mm; /* Altura exata do A4 */
            margin: 0 auto;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
        }

        .brand-bar {
            height: 8px;
            width: 100%;
            background: var(--primary);
        }

        .page-content {
            padding: 40px;
        }

        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
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
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .reservation-code {
            text-align: right;
        }

        .reservation-code span {
            display: block;
            font-size: 10px;
            color: var(--text-light);
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .reservation-code strong {
            display: block;
            margin-top: 4px;
            font-size: 20px;
            color: var(--text-main);
            font-weight: 800;
        }

        /* Title Row */
        .title-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
        }

        .title-col h1 {
            font-size: 22px;
            color: var(--text-main);
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
        }

        .title-col p {
            color: var(--text-muted);
            font-size: 12px;
        }

        /* Reservation Box */
        .reservation-box {
            display: flex;
            background: var(--primary-light);
            border: 1px solid var(--primary-border);
            border-radius: 12px;
            margin-bottom: 24px;
            overflow: hidden;
        }

        .reservation-item {
            flex: 1;
            padding: 16px;
            text-align: center;
            border-right: 1px dashed var(--primary-border);
        }

        .reservation-item:last-child {
            border-right: none;
        }

        .reservation-item .label-small {
            display: block;
            font-size: 10px;
            color: #C24100;
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
        }

        .reservation-item strong {
            display: block;
            font-size: 16px;
            color: var(--text-main);
            font-weight: 700;
        }

        /* Sections */
        .section {
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            background-color: var(--bg-paper);
            overflow: hidden;
        }

        .section-header {
            padding: 12px 20px;
            background: #F8FAFC;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section-body {
            padding: 8px 20px 16px;
        }

        /* Tables */
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }

        .data-table td {
            padding: 12px 4px;
            border-bottom: 1px solid #F1F5F9;
            vertical-align: top;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .data-table .label {
            width: 40%;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 600;
        }

        .data-table .value {
            color: var(--text-main);
            font-size: 13px;
            font-weight: 600;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 14px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-pendente { background: #FEF3C7; color: #92400E; }
        .badge-concluido { background: #D1FAE5; color: #065F46; }
        .badge-cancelado { background: #FEE2E2; color: #991B1B; }
        .badge-default { background: #F1F5F9; color: var(--text-muted); }

        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
        }
        .status-badge.paid { color: #065F46; background: #D1FAE5; }
        .status-badge.pending { color: #92400E; background: #FEF3C7; }
        .status-badge.canceled { color: #991B1B; background: #FEE2E2; }

        /* Total Box */
        .total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 16px;
            padding: 18px 24px;
            background: var(--dark-box);
            border-radius: 10px;
            color: white;
        }

        .total-label {
            font-size: 11px;
            color: #94A3B8;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .total-value {
            font-size: 26px;
            font-weight: 800;
        }

        /* Checkin Box */
        .checkin {
            margin: 24px 0;
            padding: 24px;
            text-align: center;
            border: 2px dashed var(--primary);
            border-radius: 12px;
            background: var(--primary-light);
        }

        .checkin-title {
            color: var(--primary);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .checkin-code {
            margin-top: 12px;
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 12px;
            color: var(--text-main);
        }

        .checkin-text {
            margin-top: 12px;
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 500;
        }

        /* Info Box */
        .lokyva-info {
            margin-top: 24px;
            padding: 16px;
            background: #F8FAFC;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            text-align: center;
        }

        .lokyva-info-title { 
            font-size: 12px; 
            font-weight: 700; 
            color: var(--text-main); 
        }
        
        .lokyva-info-text { 
            margin-top: 6px; 
            font-size: 11px; 
            color: var(--text-muted); 
        }

        /* Footer */
        .footer {
            margin-top: 32px;
            padding-top: 20px;
            border-top: 1px solid var(--border-color);
            text-align: center;
            color: var(--text-light);
            font-size: 10px;
            font-weight: 500;
        }

        .footer strong { 
            color: var(--text-muted); 
            font-weight: 700; 
        }

        .avoid-break { 
            page-break-inside: avoid; 
        }

        /* Responsive para celular (tela) */
        @media (max-width: 600px) {
            body { padding: 0; background: var(--bg-paper); }
            .a4-container { box-shadow: none; border-radius: 0; min-height: 100vh; }
            .page-content { padding: 20px; }
            .header { flex-direction: column; align-items: flex-start; gap: 16px; }
            .reservation-code { text-align: left; }
            .title-row { flex-direction: column; gap: 16px; }
            .reservation-box { flex-direction: column; }
            .reservation-item { border-right: none; border-bottom: 1px dashed var(--primary-border); padding: 12px; }
            .reservation-item:last-child { border-bottom: none; }
            .total { flex-direction: column; align-items: flex-start; gap: 8px; }
        }

        /* Configurações de Impressão */
        @page {
            size: A4 portrait;
            margin: 0;
        }

        @media print {
            body { padding: 0; background: white; }
            .a4-container { box-shadow: none; border-radius: 0; max-width: 100%; min-height: auto; }
            .page-content { padding: 15mm; }
        }
    </style>
</head>
<body>

<div class="a4-container">
    <div class="brand-bar"></div>

    <div class="page-content">
        <!-- Header -->
        <div class="header">
            <div class="brand">
                <div class="logo-text">LOK<span>Y</span>VA</div>
                <div class="tagline">Reservas, serviços, hospedagens e locações</div>
            </div>
            <div class="reservation-code">
                <span>Código da reserva</span>
                <strong>#{{ $aluguel->codigo_reserva ?? $aluguel->id }}</strong>
            </div>
        </div>

        @php
            $statusStr = strtoupper($aluguel->status ?? 'PENDENTE');
            $badgeClass = 'badge-default';

            if (str_contains($statusStr, 'FINALIZ') || str_contains($statusStr, 'CONFIRMAD')) {
                $badgeClass = 'badge-concluido';
            } elseif (str_contains($statusStr, 'PEND') || str_contains($statusStr, 'AGUARD')) {
                $badgeClass = 'badge-pendente';
            } elseif (str_contains($statusStr, 'CANC')) {
                $badgeClass = 'badge-cancelado';
            }

            $item = $aluguel->item;

            if ($aluguel->cep_retirada) {
                $enderecoRetirada = trim("{$aluguel->rua_retirada}, {$aluguel->numero_retirada} - {$aluguel->bairro_retirada}, {$aluguel->cidade_retirada}/{$aluguel->estado_retirada}");
            } else {
                $enderecoRetirada = $item->local_retirada ?? $item->endereco_completo ?? null;
            }

            if ($aluguel->cep_entrega) {
                $enderecoEntrega = trim("{$aluguel->rua_entrega}, {$aluguel->numero_entrega} - {$aluguel->bairro_entrega}, {$aluguel->cidade_entrega}/{$aluguel->estado_entrega}");
            } else {
                $enderecoEntrega = $item->local_entrega ?? null;
            }
        @endphp

        <!-- Title -->
        <div class="title-row">
            <div class="title-col">
                <h1>Comprovante de Locação</h1>
                <p>Documento eletrônico referente à locação realizada através do Lokyva.</p>
            </div>
            <div class="badge-col">
                <span class="badge {{ $badgeClass }}">{{ str_replace('_', ' ', $statusStr) }}</span>
            </div>
        </div>

        <!-- Reservation Highlights -->
        <div class="reservation-box avoid-break">
            <div class="reservation-item">
                <span class="label-small">Início</span>
                <strong>{{ \Carbon\Carbon::parse($aluguel->data_inicio)->format('d/m/Y') }}</strong>
            </div>
            <div class="reservation-item">
                <span class="label-small">Fim</span>
                <strong>{{ \Carbon\Carbon::parse($aluguel->data_fim)->format('d/m/Y') }}</strong>
            </div>
            <div class="reservation-item">
                <span class="label-small">Locatário</span>
                <strong>{{ $aluguel->locatario->name ?? 'Usuário' }}</strong>
            </div>
        </div>

        <!-- Section: Item -->
        <div class="section avoid-break">
            <div class="section-header">Item Alugado</div>
            <div class="section-body">
                <table class="data-table">
                    <tr>
                        <td class="label">Nome</td>
                        <td class="value">{{ $item->nome ?? 'Item não informado' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Categoria</td>
                        <td class="value">{{ ucfirst(str_replace('_', ' ', $item->categoria ?? '—')) }}</td>
                    </tr>
                    <tr>
                        <td class="label">Quantidade</td>
                        <td class="value">{{ $aluguel->quantidade }}</td>
                    </tr>
                    <tr>
                        <td class="label">Proprietário</td>
                        <td class="value">{{ $aluguel->proprietario->name ?? 'Não informado' }}</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Section: Location -->
        <div class="section avoid-break">
            <div class="section-header">Retirada e Entrega</div>
            <div class="section-body">
                <table class="data-table">
                    <tr>
                        <td class="label">Local de retirada</td>
                        <td class="value">{{ $enderecoRetirada ?: 'A combinar com o proprietário' }}</td>
                    </tr>
                    @if($item->horario_retirada)
                        <tr>
                            <td class="label">Horário de retirada</td>
                            <td class="value">{{ \Illuminate\Support\Str::of($item->horario_retirada)->substr(0, 5) }}</td>
                        </tr>
                    @endif
                    <tr>
                        <td class="label">Local de entrega</td>
                        <td class="value">{{ $enderecoEntrega ?: 'A combinar com o proprietário' }}</td>
                    </tr>
                    @if($item->horario_entrega)
                        <tr>
                            <td class="label">Horário de entrega</td>
                            <td class="value">{{ \Illuminate\Support\Str::of($item->horario_entrega)->substr(0, 5) }}</td>
                        </tr>
                    @endif
                </table>
            </div>
        </div>

        <!-- Section: Payment -->
        <div class="section avoid-break">
            <div class="section-header">Pagamento</div>
            <div class="section-body">
                <table class="data-table">
                    <tr>
                        <td class="label">Forma de pagamento</td>
                        <td class="value">{{ $aluguel->forma_pagamento === 'presencial' ? 'Presencial' : 'Online' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Status</td>
                        <td class="value">
                            @if($aluguel->status === 'cancelado')
                                <span class="status-badge canceled">CANCELADO</span>
                            @elseif(in_array($aluguel->status, ['confirmado', 'em_andamento', 'finalizado']))
                                <span class="status-badge paid">CONFIRMADO</span>
                            @else
                                <span class="status-badge pending">AGUARDANDO PAGAMENTO</span>
                            @endif
                        </td>
                    </tr>
                    @if($aluguel->valor_caucao > 0)
                        <tr>
                            <td class="label">Caução</td>
                            <td class="value">R$ {{ number_format($aluguel->valor_caucao, 2, ',', '.') }}</td>
                        </tr>
                    @endif
                </table>

                <div class="total">
                    <div class="total-label">Valor total da locação</div>
                    <div class="total-value">R$ {{ number_format($aluguel->valor_total, 2, ',', '.') }}</div>
                </div>
            </div>
        </div>

        <!-- Checkin Code -->
        @if($aluguel->codigo_reserva && $aluguel->status !== 'cancelado' && auth()->check() && auth()->id() === $aluguel->locatario_id)
            <div class="checkin avoid-break">
                <p class="checkin-title">Código de Verificação</p>
                <div class="checkin-code">{{ substr($aluguel->codigo_reserva, -4) }}</div>
                <p class="checkin-text">Apresente este código ao proprietário para confirmar a retirada.</p>
            </div>
        @endif

        <!-- Footer Info -->
        <div class="lokyva-info avoid-break">
            <div class="lokyva-info-title">Sua locação foi realizada pelo Lokyva</div>
            <div class="lokyva-info-text">
                O Lokyva conecta você a serviços, estabelecimentos, hospedagens, veículos, espaços e outras opções de reserva em um só lugar.
            </div>
        </div>

        <div class="footer avoid-break">
            Comprovante gerado eletronicamente pelo <strong>Lokyva</strong> em {{ now()->format('d/m/Y \à\s H:i') }}.
            <br>
            Este documento apresenta os dados da locação registrados na plataforma.
            <br><br>
            <strong>Lokyva</strong> — Simplificando suas reservas e serviços.
        </div>
    </div>
</div>

</body>
</html>