<!DOCTYPE html>
<html lang="pt-BR">

<head>

    <meta charset="UTF-8">

    <title>
        Comprovante Lokyva #{{ $agendamento->codigo_reserva ?? $agendamento->id }}
    </title>

    <style>

        @page {
            size: A4 portrait;
            margin: 0;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            /* Fontes-núcleo do PDF (sempre embutidas, sem depender de cache
               de TTF em storage/fonts): garante um sans-serif limpo mesmo em
               negrito, em qualquer ambiente. */
            font-family: Helvetica, Arial, sans-serif;
            color: #334155;
            font-size: 11px;
            background: #ffffff;
        }

        body {
            line-height: 1.5;
        }

        .page {
            padding: 28px 32px 24px;
        }

        /* =====================================================
           FAIXA SUPERIOR DE MARCA
        ====================================================== */

        .brand-bar {
            display: table;
            width: 100%;
            background: #FF5A00;
            padding: 3px 0;
            margin: -28px -32px 22px;
        }

        /* =====================================================
           CABEÇALHO
        ====================================================== */

        .header {
            display: table;
            width: 100%;
            padding-bottom: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #E5E7EB;
        }

        .brand {
            display: table-cell;
            width: 58%;
            vertical-align: middle;
        }

        .logo-text {
            display: block;
            font-size: 23px;
            font-weight: bold;
            color: #16181D;
            letter-spacing: -0.3px;
            line-height: 1;
        }

        .logo-text span {
            color: #FF5A00;
        }

        .tagline {
            margin-top: 5px;
            font-size: 9px;
            color: #94A3B8;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .reservation-code {
            display: table-cell;
            width: 42%;
            text-align: right;
            vertical-align: middle;
        }

        .reservation-code span {
            display: block;
            font-size: 9px;
            color: #94A3B8;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 0.6px;
        }

        .reservation-code strong {
            display: block;
            margin-top: 4px;
            font-size: 17px;
            color: #16181D;
            font-weight: bold;
            letter-spacing: 0.5px;
        }

        /* =====================================================
           TÍTULO + BADGE DE STATUS
        ====================================================== */

        .title-row {
            display: table;
            width: 100%;
            margin-bottom: 18px;
        }

        .title-col {
            display: table-cell;
            vertical-align: middle;
        }

        .title-col h1 {
            margin: 0;
            font-size: 19px;
            color: #16181D;
            font-weight: bold;
            letter-spacing: -0.3px;
        }

        .title-col p {
            margin: 4px 0 0;
            color: #94A3B8;
            font-size: 10px;
        }

        .badge-col {
            display: table-cell;
            width: 150px;
            text-align: right;
            vertical-align: middle;
        }

        /* =====================================================
           CARDS / SEÇÕES
        ====================================================== */

        .section {
            margin-bottom: 12px;
            border: 1px solid #EDF0F4;
            border-radius: 10px;
            background-color: #FFFFFF;
        }

        .section-header {
            padding: 9px 14px;
            background: #FAFBFC;
            border-bottom: 1px solid #EDF0F4;
            color: #64748B;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
        }

        .section-body {
            padding: 4px 14px 8px;
        }

        /* =====================================================
           TABELAS DE DADOS
        ====================================================== */

        .data-table {
            width: 100%;
            border-collapse: collapse;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .data-table td {
            padding: 8px 4px;
            border-bottom: 1px solid #F1F4F8;
            vertical-align: middle;
        }

        .label {
            width: 38%;
            color: #94A3B8;
            font-size: 10px;
            font-weight: 600;
        }

        .value {
            color: #16181D;
            font-size: 11.5px;
            font-weight: bold;
        }

        /* =====================================================
           RESUMO DA RESERVA (TICKET)
        ====================================================== */

        .reservation-box {
            display: table;
            width: 100%;
            background: #FFF5EF;
            border: 1px solid #FFDCC4;
            border-radius: 10px;
            margin-bottom: 14px;
        }

        .reservation-item {
            display: table-cell;
            width: 33.33%;
            padding: 14px 10px;
            text-align: center;
            border-right: 1px dashed #FFD2B0;
        }

        .reservation-item:last-child {
            border-right: none;
        }

        .reservation-item span.label-small {
            display: block;
            font-size: 8.5px;
            color: #C2703F;
            text-transform: uppercase;
            font-weight: bold;
            margin-bottom: 5px;
            letter-spacing: 0.6px;
        }

        .reservation-item strong {
            display: block;
            font-size: 14px;
            color: #16181D;
            font-weight: bold;
        }

        /* =====================================================
           BADGES DE STATUS
        ====================================================== */

        .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 100px;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-pendente {
            background: #FEF3C7;
            color: #92400E;
        }

        .badge-concluido {
            background: #D1FAE5;
            color: #065F46;
        }

        .badge-cancelado {
            background: #FEE2E2;
            color: #991B1B;
        }

        .badge-default {
            background: #F1F4F8;
            color: #475569;
        }

        /* =====================================================
           STATUS DE PAGAMENTO
        ====================================================== */

        .paid {
            color: #065F46;
            font-weight: bold;
            background: #D1FAE5;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 10px;
        }

        .pending {
            color: #92400E;
            font-weight: bold;
            background: #FEF3C7;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 10px;
        }

        .refunded {
            color: #991B1B;
            font-weight: bold;
            background: #FEE2E2;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 10px;
        }

        /* =====================================================
           VALOR TOTAL
        ====================================================== */

        .total {
            display: table;
            width: 100%;
            margin-top: 10px;
            padding: 14px 16px;
            background: #16181D;
            border-radius: 10px;
        }

        .total-label-cell {
            display: table-cell;
            vertical-align: middle;
        }

        .total-value-cell {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
        }

        .total-label {
            font-size: 9.5px;
            color: #94A3B8;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 0.6px;
        }

        .total-value {
            font-size: 24px;
            font-weight: bold;
            color: #FFFFFF;
        }

        /* =====================================================
           CHECK-IN
        ====================================================== */

        .checkin {
            margin-top: 4px;
            margin-bottom: 12px;
            padding: 16px;
            text-align: center;
            border: 2px dashed #FF5A00;
            border-radius: 10px;
            background: #FFF5EF;
        }

        .checkin-title {
            margin: 0;
            color: #FF5A00;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1.2px;
        }

        .checkin-code {
            margin-top: 8px;
            font-size: 30px;
            font-weight: bold;
            letter-spacing: 10px;
            color: #16181D;
        }

        .checkin-text {
            margin: 8px 0 0;
            font-size: 9.5px;
            color: #94A3B8;
        }

        /* =====================================================
           INFORMAÇÃO LOKYVA
        ====================================================== */

        .lokyva-info {
            margin-top: 12px;
            padding: 12px 14px;
            background: #FAFBFC;
            border: 1px solid #EDF0F4;
            border-radius: 10px;
            text-align: center;
        }

        .lokyva-info-title {
            font-size: 10.5px;
            font-weight: bold;
            color: #475569;
        }

        .lokyva-info-text {
            margin-top: 4px;
            font-size: 9px;
            color: #94A3B8;
            line-height: 1.5;
        }

        /* =====================================================
           RODAPÉ
        ====================================================== */

        .footer {
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px solid #EDF0F4;
            text-align: center;
            color: #B4BDC9;
            font-size: 8px;
            line-height: 1.6;
        }

        .footer strong {
            color: #64748B;
            font-weight: bold;
        }

        /* =====================================================
           EVITAR QUEBRA
        ====================================================== */

        .avoid-break {
            page-break-inside: avoid;
        }

    </style>

</head>

<body>

<div class="page">

    {{-- =====================================================
         FAIXA DE MARCA
    ====================================================== --}}

    <div class="brand-bar">&nbsp;</div>

    {{-- =====================================================
         CABEÇALHO
    ====================================================== --}}

    <div class="header">

        <div class="brand">

            <div class="logo-text">
                LOK<span>Y</span>VA
            </div>

            <div class="tagline">
                Reservas, serviços, hospedagens e locações
            </div>

        </div>

        <div class="reservation-code">

            <span>
                Código da reserva
            </span>

            <strong>
                #{{ $agendamento->codigo_reserva ?? $agendamento->id }}
            </strong>

        </div>

    </div>


    {{-- =====================================================
         PREPARAÇÃO DOS STATUS
    ====================================================== --}}

    @php

        $statusStr = strtoupper(
            $agendamento->status ??
            $agendamento->status_geral ??
            'PENDENTE'
        );

        $badgeClass = 'badge-default';

        if (str_contains($statusStr, 'CONCLU') || str_contains($statusStr, 'FINALIZ')) {

            $badgeClass = 'badge-concluido';

        } elseif (str_contains($statusStr, 'PEND') || str_contains($statusStr, 'AGUARD')) {

            $badgeClass = 'badge-pendente';

        } elseif (str_contains($statusStr, 'CANC')) {

            $badgeClass = 'badge-cancelado';

        }


        $statusPagamento = strtolower(
            $pagamento->status ?? ''
        );


        /*
         * Valor que será mostrado no comprovante.
         *
         * Prioridade:
         * 1. valor_total do pagamento
         * 2. valor do agendamento
         * 3. valor_final
         * 4. zero
         */

        $valorTotal =
            $pagamento->valor_total
            ?? $agendamento->valor
            ?? $agendamento->valor_final
            ?? 0;

    @endphp


    {{-- =====================================================
         TÍTULO + STATUS
    ====================================================== --}}

    <div class="title-row">

        <div class="title-col">
            <h1>Comprovante de Reserva</h1>
            <p>Documento eletrônico referente à reserva realizada através do Lokyva.</p>
        </div>

        <div class="badge-col">
            <span class="badge {{ $badgeClass }}">
                {{ str_replace('_', ' ', $statusStr) }}
            </span>
        </div>

    </div>


    {{-- =====================================================
         RESUMO DA RESERVA
    ====================================================== --}}

    <div class="reservation-box avoid-break">

        <div class="reservation-item">

            <span class="label-small">
                Data
            </span>

            <strong>

                @if($agendamento->data_agendamento)

                    {{ \Carbon\Carbon::parse(
                        $agendamento->data_agendamento
                    )->format('d/m/Y') }}

                @else

                    Não definida

                @endif

            </strong>

        </div>


        <div class="reservation-item">

            <span class="label-small">
                Horário
            </span>

            <strong>

                {{ $agendamento->hora_agendamento
                    ? \Illuminate\Support\Str::of($agendamento->hora_agendamento)->substr(0, 5)
                    : ($agendamento->horario_inicio ?? '--:--') }}

            </strong>

        </div>


        <div class="reservation-item">

            <span class="label-small">
                Cliente
            </span>

            <strong>

                {{ $agendamento->usuario->name ?? 'Usuário' }}

            </strong>

        </div>

    </div>


    {{-- =====================================================
         LOCAL DA RESERVA
    ====================================================== --}}

    <div class="section avoid-break">

        <div class="section-header">
            Local da Reserva
        </div>

        <div class="section-body">

            <table class="data-table">

                {{-- ESTABELECIMENTO --}}

                <tr>

                    <td class="label">
                        Estabelecimento
                    </td>

                    <td class="value">

                        {{ $agendamento->estabelecimento->nome
                            ?? 'Não informado' }}

                    </td>

                </tr>


                {{-- ENDEREÇO --}}

                <tr>

                    <td class="label">
                        Endereço
                    </td>

                    <td class="value">

                        @if($agendamento->estabelecimento)

                            @if($agendamento->estabelecimento->rua)

                                {{ $agendamento->estabelecimento->rua }}

                            @endif


                            @if($agendamento->estabelecimento->numero)

                                , {{ $agendamento->estabelecimento->numero }}

                            @endif


                            @if($agendamento->estabelecimento->bairro)

                                — {{ $agendamento->estabelecimento->bairro }}

                            @endif

                        @else

                            Endereço não disponível

                        @endif

                    </td>

                </tr>


                {{-- CIDADE / ESTADO --}}

                <tr>

                    <td class="label">
                        Cidade / Estado
                    </td>

                    <td class="value">

                        {{ $agendamento->estabelecimento->cidade
                            ?? '' }}

                        @if(
                            $agendamento->estabelecimento &&
                            $agendamento->estabelecimento->estado
                        )

                            / {{ $agendamento->estabelecimento->estado }}

                        @endif

                    </td>

                </tr>

            </table>

        </div>

    </div>


    {{-- =====================================================
         DETALHES DA RESERVA
    ====================================================== --}}

    <div class="section avoid-break">

        <div class="section-header">
            Detalhes da Reserva
        </div>

        <div class="section-body">

            <table class="data-table">

                {{-- SERVIÇO --}}

                <tr>

                    <td class="label">
                        Serviço / Item
                    </td>

                    <td class="value">

                        {{ $agendamento->servico->nome
                            ?? $agendamento->titulo
                            ?? 'Serviço ou item reservado' }}

                    </td>

                </tr>


                {{-- FUNCIONÁRIO --}}

                @if($agendamento->funcionario)

                    <tr>

                        <td class="label">
                            Profissional
                        </td>

                        <td class="value">

                            {{ $agendamento->funcionario->nome }}

                        </td>

                    </tr>

                @endif

            </table>

        </div>

    </div>


    {{-- =====================================================
         PAGAMENTO
    ====================================================== --}}

    <div class="section avoid-break">

        <div class="section-header">
            Pagamento
        </div>

        <div class="section-body">

            <table class="data-table">

                {{-- MÉTODO --}}

                <tr>

                    <td class="label">
                        Método de pagamento
                    </td>

                    <td class="value">

                        {{ $pagamento->metodo_pagamento
                            ?? 'Não informado' }}

                    </td>

                </tr>


                {{-- DATA --}}

                <tr>

                    <td class="label">
                        Data do pagamento
                    </td>

                    <td class="value">

                        @if(
                            $pagamento &&
                            $pagamento->data_pagamento
                        )

                            {{ \Carbon\Carbon::parse(
                                $pagamento->data_pagamento
                            )->format('d/m/Y H:i') }}

                        @else

                            Não informado

                        @endif

                    </td>

                </tr>


                {{-- STATUS --}}

                <tr>

                    <td class="label">
                        Status
                    </td>

                    <td class="value">

                        @if(
                            in_array(
                                $statusPagamento,
                                [
                                    'pago',
                                    'paid',
                                    'confirmado',
                                    'confirmed'
                                ]
                            )
                        )

                            <span class="paid">
                                CONFIRMADO
                            </span>

                        @elseif(
                            in_array(
                                $statusPagamento,
                                [
                                    'estornado',
                                    'refunded',
                                    'refund'
                                ]
                            )
                        )

                            <span class="refunded">
                                ESTORNADO
                            </span>

                        @else

                            <span class="pending">
                                PENDENTE
                            </span>

                        @endif

                    </td>

                </tr>

            </table>


            {{-- TOTAL --}}

            <div class="total">
                <div class="total-label-cell">
                    <div class="total-label">Valor total da reserva</div>
                </div>
                <div class="total-value-cell">
                    <div class="total-value">
                        R$
                        {{ number_format(
                            $valorTotal,
                            2,
                            ',',
                            '.'
                        ) }}
                    </div>
                </div>
            </div>

        </div>

    </div>


    {{-- =====================================================
         CHECK-IN (MODIFICADO COM REGRA DE ROLE)
    ====================================================== --}}

    @if(
        $agendamento->codigo_verificacao
        &&
        !str_contains(
            strtoupper(
                $agendamento->status ?? ''
            ),
            'CANC'
        )
        &&
        (auth()->check() && auth()->user()->papel === 'user')
    )

        <div class="checkin avoid-break">

            <p class="checkin-title">
                Código de Check-in
            </p>

            <div class="checkin-code">

                {{ $agendamento->codigo_verificacao }}

            </div>

            <p class="checkin-text">

                Apresente este código ao estabelecimento
                para confirmar sua reserva.

            </p>

        </div>

    @endif


    {{-- =====================================================
         SOBRE O LOKYVA
    ====================================================== --}}

    <div class="lokyva-info avoid-break">

        <div class="lokyva-info-title">

            Sua reserva foi realizada pelo Lokyva

        </div>

        <div class="lokyva-info-text">

            O Lokyva conecta você a serviços, estabelecimentos,
            hospedagens, veículos, espaços e outras opções de
            reserva em um só lugar.

        </div>

    </div>


    {{-- =====================================================
         RODAPÉ
    ====================================================== --}}

    <div class="footer">

        Comprovante gerado eletronicamente pelo
        <strong>Lokyva</strong>
        em {{ now()->format('d/m/Y \à\s H:i') }}.

        <br>

        Este documento apresenta os dados da reserva
        registrados na plataforma.

        <br>

        <strong>Lokyva</strong> — Simplificando suas reservas e serviços.

    </div>

</div>

</body>

</html>
