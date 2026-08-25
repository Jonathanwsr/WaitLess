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
            margin: 18px 22px;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
            color: #2F2F2F;
            font-size: 11px;
            background: #ffffff;
        }

        body {
            line-height: 1.35;
        }

        .container {
            width: 100%;
            margin: 0;
            padding: 0;
        }

        /* =====================================================
           CABEÇALHO
        ====================================================== */

        .header {
            display: table;
            width: 100%;
            padding-bottom: 10px;
            margin-bottom: 13px;
            border-bottom: 2px solid #C9826A;
        }

        .brand {
            display: table-cell;
            width: 60%;
            vertical-align: middle;
        }

        /*
         * LOGO REMOVIDA PROPOSITALMENTE
         * Para evitar processamento de imagem pelo Dompdf/GD.
         */

        .logo-text {
            display: block;
            font-size: 22px;
            font-weight: bold;
            color: #C9826A;
            letter-spacing: 1px;
            line-height: 1;
        }

        .tagline {
            margin-top: 5px;
            font-size: 9px;
            color: #777777;
        }

        .reservation-code {
            display: table-cell;
            width: 40%;
            text-align: right;
            vertical-align: middle;
        }

        .reservation-code span {
            display: block;
            font-size: 8px;
            color: #888888;
            text-transform: uppercase;
        }

        .reservation-code strong {
            display: block;
            margin-top: 2px;
            font-size: 14px;
            color: #2F2F2F;
        }

        /* =====================================================
           TÍTULO
        ====================================================== */

        .title {
            margin-bottom: 12px;
        }

        .title h1 {
            margin: 0;
            font-size: 17px;
            color: #2F2F2F;
        }

        .title p {
            margin: 3px 0 0;
            color: #888888;
            font-size: 9px;
        }

        /* =====================================================
           CARDS
        ====================================================== */

        .section {
            margin-bottom: 11px;
            border: 1px solid #E9E4E1;
            border-radius: 6px;
            overflow: hidden;
        }

        .section-header {
            padding: 7px 9px;
            background: #F8F3EF;
            border-bottom: 1px solid #E9E4E1;
            color: #C9826A;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .section-body {
            padding: 5px 9px;
        }

        /* =====================================================
           TABELAS
        ====================================================== */

        .data-table {
            width: 100%;
            border-collapse: collapse;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .data-table td {
            padding: 5px 3px;
            border-bottom: 1px solid #F0EEEE;
            vertical-align: top;
        }

        .label {
            width: 34%;
            color: #888888;
            font-size: 9px;
        }

        .value {
            color: #2F2F2F;
            font-size: 10px;
            font-weight: 500;
        }

        /* =====================================================
           RESUMO DA RESERVA
        ====================================================== */

        .reservation-box {
            display: table;
            width: 100%;
            background: #FCF8F5;
            border: 1px solid #E6B8A2;
            border-radius: 6px;
            margin-bottom: 11px;
        }

        .reservation-item {
            display: table-cell;
            width: 33.33%;
            padding: 9px;
            text-align: center;
            border-right: 1px solid #E6B8A2;
        }

        .reservation-item:last-child {
            border-right: none;
        }

        .reservation-item span.label-small {
            display: block;
            font-size: 8px;
            color: #888888;
            text-transform: uppercase;
            margin-bottom: 3px;
        }

        .reservation-item strong {
            display: block;
            font-size: 11px;
            color: #2F2F2F;
        }

        /* =====================================================
           STATUS
        ====================================================== */

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
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
            background: #E5E7EB;
            color: #374151;
        }

        /* =====================================================
           STATUS PAGAMENTO
        ====================================================== */

        .paid {
            color: #059669;
            font-weight: bold;
        }

        .pending {
            color: #D97706;
            font-weight: bold;
        }

        .refunded {
            color: #DC2626;
            font-weight: bold;
        }

        /* =====================================================
           VALOR TOTAL
        ====================================================== */

        .total {
            width: 100%;
            margin-top: 5px;
            padding: 10px 12px;
            background: #F8F3EF;
            border-radius: 6px;
            text-align: right;
        }

        .total-label {
            font-size: 8px;
            color: #888888;
            text-transform: uppercase;
        }

        .total-value {
            margin-top: 2px;
            font-size: 19px;
            font-weight: bold;
            color: #C9826A;
        }

        /* =====================================================
           CHECK-IN
        ====================================================== */

        .checkin {
            margin-top: 11px;
            padding: 10px;
            text-align: center;
            border: 1.5px dashed #C9826A;
            border-radius: 6px;
            background: #FCF8F5;
        }

        .checkin-title {
            margin: 0;
            color: #777777;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .checkin-code {
            margin-top: 4px;
            font-size: 23px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #2F2F2F;
        }

        .checkin-text {
            margin: 3px 0 0;
            font-size: 8px;
            color: #888888;
        }

        /* =====================================================
           INFORMAÇÃO LOKYVA
        ====================================================== */

        .lokyva-info {
            margin-top: 11px;
            padding: 9px 11px;
            background: #F8F3EF;
            border-radius: 6px;
            text-align: center;
        }

        .lokyva-info-title {
            font-size: 9px;
            font-weight: bold;
            color: #C9826A;
        }

        .lokyva-info-text {
            margin-top: 3px;
            font-size: 8px;
            color: #777777;
            line-height: 1.4;
        }

        /* =====================================================
           RODAPÉ
        ====================================================== */

        .footer {
            margin-top: 13px;
            padding-top: 8px;
            border-top: 1px solid #E9E4E1;
            text-align: center;
            color: #999999;
            font-size: 7.5px;
            line-height: 1.4;
        }

        .footer strong {
            color: #C9826A;
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

<div class="container">

    {{-- =====================================================
         CABEÇALHO
    ====================================================== --}}

    <div class="header">

        <div class="brand">

            {{-- LOGO REMOVIDA --}}
            <div class="logo-text">
                LOKYVA
            </div>

            <div class="tagline">
                Reservas, serviços, hospedagens e locações em um só lugar
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
         TÍTULO
    ====================================================== --}}

    <div class="title">

        <h1>
            Comprovante de Reserva
        </h1>

        <p>
            Documento eletrônico referente à reserva realizada através do Lokyva.
        </p>

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

        if (str_contains($statusStr, 'CONCLU')) {

            $badgeClass = 'badge-concluido';

        } elseif (str_contains($statusStr, 'PEND')) {

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
                    ?? $agendamento->horario_inicio
                    ?? '--:--' }}

            </strong>

        </div>


        <div class="reservation-item">

            <span class="label-small">
                Status
            </span>

            <strong>

                <span class="badge {{ $badgeClass }}">
                    {{ str_replace('_', ' ', $statusStr) }}
                </span>

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

                {{-- CLIENTE --}}

                <tr>

                    <td class="label">
                        Cliente
                    </td>

                    <td class="value">

                        {{ $agendamento->usuario->name
                            ?? 'Usuário' }}

                    </td>

                </tr>


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
                                PAGAMENTO CONFIRMADO
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
                                PAGAMENTO ESTORNADO
                            </span>

                        @else

                            <span class="pending">
                                PAGAMENTO PENDENTE
                            </span>

                        @endif

                    </td>

                </tr>

            </table>


            {{-- TOTAL --}}

            <div class="total">

                <div class="total-label">
                    Valor total da reserva
                </div>

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


    {{-- =====================================================
         CHECK-IN
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