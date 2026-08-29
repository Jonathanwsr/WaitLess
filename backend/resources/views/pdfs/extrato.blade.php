<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>{{ $titulo }}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        /* Base e Reset */
        body { 
            font-family: 'Inter', Arial, sans-serif; 
            font-size: 12px; 
            color: #374151; 
            background-color: #f3f4f6; /* Fundo cinza bem clarinho */
            margin: 0; 
            padding: 20px; 
        }
        
        /* Container principal estilo 'Cartão' */
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        /* Cabeçalho */
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding-bottom: 20px; 
            border-bottom: 1px solid #e5e7eb; 
        }
        .header h1 { 
            margin: 0 0 10px 0; 
            color: #111827; 
            font-size: 24px; 
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .header p { 
            margin: 5px 0 0; 
            color: #6b7280; 
            font-size: 13px; 
        }
        .header .destaque {
            color: #4f46e5; /* Cor de destaque (Indigo) */
            font-weight: 600;
        }

        /* Cartões de KPI */
        .kpi-container { 
            width: 100%; 
            margin-bottom: 30px; 
            border-collapse: separate; 
            border-spacing: 12px; /* Espaço entre os cartões */
        }
        .kpi-box { 
            background: #ffffff; 
            border: 1px solid #e5e7eb; 
            border-radius: 10px; 
            padding: 20px; 
            text-align: left; 
            width: 33.33%;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .kpi-title { 
            font-size: 11px; 
            color: #6b7280; 
            text-transform: uppercase; 
            font-weight: 700; 
            margin-bottom: 8px; 
            display: block;
            letter-spacing: 0.5px;
        }
        .kpi-value { 
            font-size: 18px; 
            font-weight: 700; 
        }
        
        /* Cores de Texto para KPIs */
        .text-green { color: #10b981; }
        .text-red { color: #ef4444; }
        .text-blue { color: #3b82f6; }
        .text-purple { color: #8b5cf6; }
        .text-dark { color: #111827; }

        /* Tabela de Dados */
        table.tabela-dados { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
        }
        .tabela-dados th { 
            background-color: #f8fafc; 
            border-bottom: 2px solid #e2e8f0; 
            padding: 12px 8px; 
            text-align: left; 
            color: #64748b; 
            font-size: 11px; 
            text-transform: uppercase; 
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .tabela-dados td { 
            border-bottom: 1px solid #f1f5f9; 
            padding: 12px 8px; 
            color: #475569; 
            vertical-align: middle;
        }
        /* Efeito Zebra para linhas pares */
        .tabela-dados tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }
        
        /* Ajustes de tipografia na tabela */
        .tabela-dados td strong { color: #1e293b; font-weight: 600; }
        .tipo-badge {
            font-size: 10px;
            padding: 3px 6px;
            background: #e2e8f0;
            border-radius: 4px;
            font-weight: 600;
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <h1>{{ $titulo }}</h1>
            <p>Olá, <strong class="destaque">{{ $primeiro_nome }}</strong>! Aqui está o resumo financeiro atualizado.</p>
            <p>Período: <strong>{{ $data_inicio }} - {{ $data_fim }}</strong> | Filtro: <strong>{{ $filtro_estabelecimento }}</strong></p>
        </div>

        <table class="kpi-container">
            <tr>
                <td class="kpi-box">
                    <span class="kpi-title">Receita Total</span>
                    <span class="kpi-value text-green">R$ {{ number_format($receita_total, 2, ',', '.') }}</span>
                </td>
                <td class="kpi-box">
                    <span class="kpi-title">Despesas Totais</span>
                    <span class="kpi-value text-red">R$ {{ number_format($despesas_totais, 2, ',', '.') }}</span>
                </td>
                <td class="kpi-box">
                    <span class="kpi-title">Lucro Líquido</span>
                    <span class="kpi-value text-blue">R$ {{ number_format($lucro_liquido, 2, ',', '.') }}</span>
                </td>
            </tr>
            <tr>
                <td class="kpi-box">
                    <span class="kpi-title">Saldo Asaas</span>
                    <span class="kpi-value text-purple">R$ {{ number_format($saldo_asaas, 2, ',', '.') }}</span>
                </td>
                <td class="kpi-box">
                    <span class="kpi-title">Transações</span>
                    <span class="kpi-value text-dark">{{ $transacoes }}</span>
                </td>
                <td class="kpi-box">
                    <span class="kpi-title">Ticket Médio</span>
                    <span class="kpi-value text-dark">R$ {{ number_format($ticket_medio, 2, ',', '.') }}</span>
                </td>
            </tr>
        </table>

        <table class="tabela-dados">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Estabelecimento</th>
                    <th>Cliente</th>
                    <th>Pagamento</th>
                    <th style="text-align: right;">Valor</th>
                </tr>
            </thead>
            <tbody>
                @forelse($movimentacoes as $mov)
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($mov->created_at)->format('d/m/Y H:i') }}</td>
                        <td><span class="tipo-badge">{{ strtoupper($mov->tipo) }}</span></td>
                        <td><strong>{{ $mov->descricao }}</strong></td>
                        <td>{{ $mov->origem->estabelecimento->nome ?? 'Sem Vínculo' }}</td>
                        <td>{{ $mov->usuario->name ?? 'Cliente Avulso' }}</td>
                        <td>{{ str_replace('_', ' ', strtoupper($mov->metodo_pagamento ?? 'N/A')) }}</td>
                        <td style="text-align: right; font-weight: 700; color: {{ in_array($mov->tipo, ['credito', 'repasse']) ? '#10b981' : '#ef4444' }}">
                            {{ in_array($mov->tipo, ['credito', 'repasse']) ? '+ ' : '- ' }}
                            R$ {{ number_format($mov->valor_liquido ?? $mov->valor_bruto, 2, ',', '.') }}
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">
                            Nenhuma movimentação encontrada para estes filtros.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

</body>
</html>