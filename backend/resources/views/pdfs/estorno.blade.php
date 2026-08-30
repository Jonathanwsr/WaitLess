
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Comprovante de Estorno - {{ $estorno->codigo_estorno }}</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <style>
        @media print {
            @page {
                size: A4;
                margin: 12mm;
            }

            body {
                background: white !important;
                padding: 0 !important;
            }

            .no-print {
                display: none !important;
            }

            .receipt {
                box-shadow: none !important;
                border: none !important;
                max-width: 100% !important;
            }
        }

        body {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system,
                BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .receipt {
            max-width: 760px;
        }
    </style>
</head>

<body class="bg-[#f5f6f8] text-[#252525] p-6 md:p-10" onload="window.print()">

    <div class="receipt mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">

        <!-- ========================================= -->
        <!-- CABEÇALHO -->
        <!-- ========================================= -->

        <div class="px-8 pt-8 pb-6">

            <div class="flex items-start justify-between gap-6">

                <!-- Marca -->
                <div>
                    <div class="flex items-center gap-3">

                        <div class="w-11 h-11 rounded-xl bg-[#C9826A]
                                    flex items-center justify-center
                                    text-white font-black text-lg">
                            W
                        </div>

                        <div>
                            <h1 class="text-2xl font-black tracking-tight text-[#252525]">
                                LOKYVA
                            </h1>

                           
<p class="text-xs text-gray-500 mt-0.5">
    Plataforma digital de serviços, reservas e agendamentos,
    conectando clientes e estabelecimentos de forma simples,
    rápida e segura.
</p>
```

                        </div>

                    </div>
                </div>

                <!-- Status -->
                <div class="text-right">

                    <div class="inline-flex items-center gap-2
                                px-3 py-1.5 rounded-full
                                bg-green-50 border border-green-100">

                        <span class="w-2 h-2 rounded-full bg-green-500"></span>

                        <span class="text-xs font-bold text-green-700">
                            ESTORNO PROCESSADO
                        </span>

                    </div>

                    <p class="text-[11px] text-gray-400 mt-2">
                        Comprovante oficial
                    </p>

                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- PROTOCOLO -->
        <!-- ========================================= -->

        <div class="mx-8 mb-7 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">

            <div class="flex items-center justify-between gap-4">

                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400">
                        Protocolo do estorno
                    </p>

                    <p class="font-mono text-sm font-bold text-gray-800 mt-1">
                        {{ $estorno->codigo_estorno }}
                    </p>
                </div>

                <div class="text-right">
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400">
                        ID do Gateway
                    </p>

                    <p class="font-mono text-xs text-gray-600 mt-1">
                        {{ $estorno->id_estorno_asaas ?? $estorno->id_transacao_asaas ?? 'N/A' }}
                    </p>
                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- VALOR -->
        <!-- ========================================= -->

        <div class="mx-8 mb-8">

            <div class="rounded-2xl bg-[#fcf7f5]
                        border border-[#f0ddd7]
                        p-6">

                <p class="text-xs font-semibold text-gray-500">
                    Valor total reembolsado
                </p>

                <div class="flex items-end justify-between gap-4 mt-2">

                    <div>
                        <span class="text-sm font-medium text-gray-500">
                            BRL
                        </span>

                        <div class="text-4xl font-black tracking-tight
                                    text-[#252525]">
                            R$
                            {{ number_format($estorno->valor_estornado, 2, ',', '.') }}
                        </div>
                    </div>

                    <div class="text-right">
                        <p class="text-[10px] uppercase tracking-wider
                                  font-bold text-gray-400">
                            Status financeiro
                        </p>

                        <p class="text-sm font-bold text-green-600 mt-1">
                            Valor devolvido
                        </p>
                    </div>

                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- DETALHES DA TRANSAÇÃO -->
        <!-- ========================================= -->

        <div class="px-8">

            <div class="flex items-center gap-3 mb-5">

                <div class="w-8 h-8 rounded-lg bg-gray-100
                            flex items-center justify-center
                            text-gray-600 font-bold text-sm">
                    01
                </div>

                <div>
                    <h2 class="text-base font-bold text-gray-800">
                        Detalhes da transação
                    </h2>

                    <p class="text-xs text-gray-400">
                        Informações relacionadas ao pagamento original
                    </p>
                </div>

            </div>


            <div class="grid grid-cols-2 gap-x-8 gap-y-6">

                <!-- Estabelecimento -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Estabelecimento
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ $estorno->estabelecimento->nome ?? 'N/A' }}
                    </p>
                </div>


                <!-- Cliente -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Cliente
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ $estorno->cliente->name ?? 'N/A' }}
                    </p>
                </div>


                <!-- Pagamento -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Pagamento original
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ \Carbon\Carbon::parse($estorno->data_pagamento)->format('d/m/Y H:i') }}
                    </p>
                </div>


                <!-- Estorno -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Estorno realizado
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ \Carbon\Carbon::parse($estorno->data_estorno)->format('d/m/Y H:i') }}
                    </p>
                </div>


                <!-- Método -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Método de devolução
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ $estorno->forma_pagamento }}
                    </p>

                    <p class="text-[11px] text-gray-400 mt-0.5">
                        Processamento automático via gateway
                    </p>
                </div>


                <!-- Motivo -->
                <div>
                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-1">
                        Motivo do estorno
                    </p>

                    <p class="text-sm font-semibold text-gray-800">
                        {{ $estorno->motivo }}
                    </p>
                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- DIVISOR -->
        <!-- ========================================= -->

        <div class="mx-8 my-8 border-t border-dashed border-gray-200"></div>


        <!-- ========================================= -->
        <!-- INFORMAÇÃO DO REEMBOLSO -->
        <!-- ========================================= -->

        <div class="mx-8 mb-8">

            <div class="rounded-xl border border-gray-200 p-5">

                <div class="flex gap-4">

                    <div class="w-9 h-9 flex-shrink-0 rounded-lg
                                bg-green-50
                                flex items-center justify-center">

                        <span class="text-green-600 font-bold">
                            ✓
                        </span>

                    </div>

                    <div>

                        <h3 class="text-sm font-bold text-gray-800">
                            Reembolso confirmado
                        </h3>

                        <p class="text-xs leading-5 text-gray-500 mt-1">
                            O estorno foi processado e o valor foi encaminhado
                            para o meio de pagamento utilizado na transação.
                        </p>

                    </div>

                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- RODAPÉ -->
        <!-- ========================================= -->

        <div class="bg-[#fafafa] border-t border-gray-100 px-8 py-6">

            <div class="flex justify-between items-start gap-6">

                <div class="max-w-lg">

                    <p class="text-[10px] uppercase tracking-wider
                              font-bold text-gray-400 mb-2">
                        Informações importantes
                    </p>

                    <p class="text-[10px] leading-4 text-gray-400">
                        Este documento confirma o processamento do estorno
                        registrado na plataforma Lokyva. O prazo para
                        visualização do valor pode variar conforme a instituição
                        financeira, banco ou emissor do cartão.
                    </p>

                    <p class="text-[10px] leading-4 text-gray-400 mt-2">
                        Em alguns casos, o valor pode aparecer em até 72 horas
                        úteis ou em até duas faturas, dependendo do meio de
                        pagamento.
                    </p>

                </div>

                <div class="text-right flex-shrink-0">

                    <p class="text-[10px] text-gray-400">
                        Documento gerado em
                    </p>

                    <p class="text-[11px] font-semibold text-gray-600 mt-1">
                        {{ now()->format('d/m/Y H:i') }}
                    </p>

                </div>

            </div>

            <div class="mt-5 pt-4 border-t border-gray-200
                        flex justify-between items-center">

                <p class="text-[10px] text-gray-400">
                    Lokyva · Comprovante de Estorno
                </p>

                <p class="text-[10px] font-mono text-gray-400">
                    {{ $estorno->codigo_estorno }}
                </p>

            </div>

        </div>

    </div>

</body>
</html>

