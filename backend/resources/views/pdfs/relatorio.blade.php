<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>{{ $titulo }}</title>
    <!-- Fonte moderna (Inter) -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* Base e Reset */
        body { 
            font-family: 'Inter', Arial, sans-serif; 
            font-size: 14px; 
            color: #374151; 
            background-color: #f3f4f6; /* Fundo geral cinza claro */
            margin: 0; 
            padding: 40px 20px; 
        }

        /* Container Principal */
        .container {
            max-width: 600px; /* Ideal para e-mails e relatórios diretos */
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            padding: 40px;
            border-top: 5px solid #4f46e5; /* Detalhe colorido no topo (Indigo) */
        }

        /* Cabeçalho */
        .header { 
            text-align: center; 
            margin-bottom: 35px; 
        }
        .header h1 { 
            margin: 0 0 15px 0; 
            color: #111827; 
            font-size: 24px; 
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .header p { 
            margin: 0 0 5px 0; 
            color: #6b7280; 
            font-size: 14px; 
            line-height: 1.5;
        }
        .periodo-badge {
            display: inline-block;
            background-color: #f3f4f6;
            color: #4b5563;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 10px;
        }

        /* Cartões de KPI */
        .box-container { 
            width: 100%; 
            border-collapse: separate; 
            border-spacing: 15px 0; 
            margin-bottom: 35px; 
            margin-left: -7.5px; /* Compensa o border-spacing para alinhar */
            margin-right: -7.5px;
        }
        .box { 
            padding: 20px; 
            background-color: #ffffff; 
            border: 1px solid #e5e7eb; 
            border-radius: 10px; 
            text-align: center; 
            width: 50%; 
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        }
        .box h3 { 
            margin: 0 0 10px 0; 
            font-size: 12px; 
            color: #6b7280; 
            text-transform: uppercase; 
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .box p { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 700; 
        }

        /* Cores */
        .text-green { color: #10b981; }
        .text-red { color: #ef4444; }
        .text-blue { color: #4f46e5; } /* Indigo mais moderno que o azul padrão */

        /* Tabela de Detalhamento */
        .summary { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
        }
        .summary th { 
            text-align: left; 
            padding: 0 0 15px 0; 
            border-bottom: 2px solid #e5e7eb; 
            color: #111827; 
            font-size: 16px; 
            font-weight: 600;
        }
        .summary td { 
            padding: 16px 10px; 
            border-bottom: 1px solid #f3f4f6; 
            font-size: 14px; 
            color: #4b5563; 
        }
        
        /* Destaque para a linha de Lucro */
        .linha-lucro td {
            background-color: #eef2ff; /* Fundo indigo super claro */
            color: #111827;
            border-bottom: none;
            border-radius: 6px;
        }
        .linha-lucro td:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
        .linha-lucro td:last-child { border-top-right-radius: 6px; border-bottom-right-radius: 6px; }

        /* Rodapé */
        .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #9ca3af; 
            padding-top: 25px; 
            border-top: 1px solid #e5e7eb; 
            line-height: 1.6;
        }
    </style>
</head>
<body>

    <div class="container">
        
        <!-- Cabeçalho -->
        <div class="header">
            <h1>{{ $titulo }}</h1>
            <p>Olá, <strong>{{ $usuario_nome }}</strong>. Aqui está o balanço financeiro da sua operação.</p>
            <div class="periodo-badge">
                🗓️ {{ $data_inicio }} a {{ $data_fim }}
            </div>
        </div>

        <!-- Cards de Resumo lado a lado -->
        <table class="box-container">
            <tr>
                <td class="box">
                    <h3>Receitas Totais</h3>
                    <p class="text-green">R$ {{ number_format($receita, 2, ',', '.') }}</p>
                </td>
                <td class="box">
                    <h3>Despesas e Estornos</h3>
                    <p class="text-red">- R$ {{ number_format($despesa, 2, ',', '.') }}</p>
                </td>
            </tr>
        </table>

        <!-- Detalhamento -->
        <table class="summary">
            <thead>
                <tr>
                    <th colspan="2">Desempenho no Período</th>
                </tr>
            </thead>
            <tbody>
                <tr class="linha-lucro">
                    <td><strong>Lucro Líquido Real</strong></td>
                    <td style="text-align: right;" class="text-blue">
                        <strong>R$ {{ number_format($receita - $despesa, 2, ',', '.') }}</strong>
                    </td>
                </tr>
                <tr>
                    <td>Volume de Transações</td>
                    <td style="text-align: right; font-weight: 500;">{{ $transacoes }}</td>
                </tr>
                <tr>
                    <td>Ticket Médio</td>
                    <td style="text-align: right; font-weight: 500;">
                        R$ {{ $transacoes > 0 ? number_format($receita / $transacoes, 2, ',', '.') : '0,00' }}
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Rodapé -->
        <div class="footer">
            Este é um comunicado automático gerado de forma segura pelo sistema <strong>Lokyva</strong>.<br>
            Emitido em: {{ \Carbon\Carbon::now()->format('d/m/Y \à\s H:i') }}
        </div>

    </div>

</body>
</html>