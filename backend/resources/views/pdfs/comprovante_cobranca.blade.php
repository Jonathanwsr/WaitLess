<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #18181b; font-size: 11px; margin: 0; }
        .topo { background: #18181b; color: #fff; padding: 18px 24px; }
        .topo table { width: 100%; }
        .topo h1 { margin: 0; font-size: 17px; }
        .topo .sub { margin-top: 4px; color: #a1a1aa; font-size: 10px; }
        .topo .codigo-doc { text-align: right; font-size: 13px; font-weight: bold; color: #fb923c; }
        .bloco { padding: 12px 24px; border-bottom: 1px solid #e4e4e7; }
        .bloco h2 { font-size: 10px; text-transform: uppercase; color: #71717a; letter-spacing: 1px; margin: 0 0 8px; }
        table.grade { width: 100%; border-collapse: collapse; }
        table.grade td { padding: 3px 0; vertical-align: top; }
        table.grade td.rotulo { color: #71717a; width: 30%; }
        table.colunas td { width: 50%; padding-right: 14px; }
        table.tabela th { text-align: left; font-size: 9px; text-transform: uppercase; color: #71717a; border-bottom: 1px solid #e4e4e7; padding: 4px 0; }
        table.tabela td { padding: 5px 0; border-bottom: 1px solid #f4f4f5; }
        table.tabela td.num, table.tabela th.num { text-align: right; }
        .resumo td { padding: 3px 0; }
        .resumo td.num { text-align: right; font-weight: bold; }
        .total td { font-weight: bold; font-size: 13px; padding-top: 8px; border-top: 1px solid #18181b; }
        .explicacao { background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 12px; border-radius: 6px; line-height: 1.6; }
        .paga { color: #047857; font-weight: bold; }
        .aberta { color: #b45309; font-weight: bold; }
        .cancelada { color: #71717a; }
        .aviso { font-size: 9px; color: #71717a; line-height: 1.5; }
        .rodape { padding: 14px 24px; font-size: 9px; color: #71717a; }
    </style>
</head>
<body>
@php
    $fmt = fn ($data) => $data ? \Carbon\Carbon::parse($data)->timezone('America/Sao_Paulo')->format('d/m/Y H:i') : '—';
    $dia = fn ($data) => $data ? \Carbon\Carbon::parse($data)->format('d/m/Y') : '—';
    $moeda = fn ($v) => 'R$ ' . number_format((float) $v, 2, ',', '.');
    $cpfCnpjMascara = function ($doc) {
        $n = preg_replace('/\D/', '', (string) $doc);
        if (strlen($n) === 11) return substr($n, 0, 3) . '.' . substr($n, 3, 3) . '.' . substr($n, 6, 3) . '-' . substr($n, 9);
        if (strlen($n) === 14) return substr($n, 0, 2) . '.' . substr($n, 2, 3) . '.' . substr($n, 5, 3) . '/' . substr($n, 8, 4) . '-' . substr($n, 12);
        return $doc ?: '—';
    };
    $c = $cobranca;
    $rotulosParcela = [
        'pendente' => 'A pagar', 'atrasado' => 'Atrasada', 'pago' => 'Paga',
        'cancelado' => 'Cancelada', 'estornado' => 'Estornada',
    ];
    $rotulosCobranca = [
        'aguardando_aceite' => 'Aguardando aceite do cliente', 'aceita' => 'Aceita — em andamento',
        'quitada' => 'Quitada', 'recusada' => 'Recusada pelo cliente', 'cancelada' => 'Cancelada',
    ];
    $online = $c->modo === 'online';
@endphp

<div class="topo">
    <table>
        <tr>
            <td>
                <h1>Comprovante de cobrança parcelada</h1>
                <div class="sub">Emitido pela plataforma Lokyva em {{ $emitidoEm->format('d/m/Y H:i') }}</div>
            </td>
            <td class="codigo-doc">{{ $c->codigo }}</td>
        </tr>
    </table>
</div>

<div class="bloco">
    <h2>O que é esta cobrança</h2>
    <div class="explicacao">
        <p style="margin: 0 0 6px 0;">
            <b>{{ $c->estabelecimento?->nome }}</b> enviou para <b>{{ $c->cliente?->name }}</b> uma cobrança referente a:
            <b>{{ $c->itens->pluck('descricao')->implode('; ') }}</b>.
            O valor total de <b>{{ $moeda($c->valor_total) }}</b> foi dividido em <b>{{ $c->parcelas->count() }}x</b>, com vencimento mensal a partir de {{ $dia($c->parcelas->first()?->vencimento) }}.
            Este documento mostra a situação de cada parcela na data de emissão.
        </p>
        @if ($online)
            <p style="margin: 0;">
                <b>Como pagar:</b> cada parcela tem um link de pagamento (PIX, boleto ou cartão), processado pelo Asaas.
                Do valor pago, <b>{{ str_replace('.', ',', $parteDoSocioPercentual) }}%</b> vai direto para o estabelecimento e
                <b>{{ str_replace('.', ',', $c->taxa_percentual) }}%</b> é a taxa da plataforma Lokyva.
            </p>
        @else
            <p style="margin: 0;">
                <b>Como pagar:</b> o pagamento é feito diretamente ao estabelecimento, de forma presencial, e cada parcela paga é marcada por ele.
                O cliente não paga nada além do valor da parcela. A taxa de <b>{{ str_replace('.', ',', $c->taxa_percentual) }}%</b> da plataforma Lokyva é cobrada do estabelecimento.
            </p>
        @endif
    </div>
</div>

<div class="bloco">
    <h2>Partes</h2>
    <table class="grade colunas">
        <tr>
            <td>
                <table class="grade">
                    <tr><td class="rotulo">Estabelecimento</td><td>{{ $c->estabelecimento?->nome ?: '—' }}</td></tr>
                    <tr><td class="rotulo">CNPJ / razão social</td><td>{{ $c->estabelecimento?->cnpj ?: '—' }} {{ $c->estabelecimento?->razao_social ? '· ' . $c->estabelecimento->razao_social : '' }}</td></tr>
                    <tr><td class="rotulo">Telefone</td><td>{{ $c->estabelecimento?->telefone ?: '—' }}</td></tr>
                    <tr><td class="rotulo">Enviada por</td><td>{{ $c->criador?->name ?: '—' }}</td></tr>
                </table>
            </td>
            <td>
                <table class="grade">
                    <tr><td class="rotulo">Cliente</td><td>{{ $c->cliente?->name }}</td></tr>
                    <tr><td class="rotulo">CPF/CNPJ</td><td>{{ $cpfCnpjMascara($c->cliente?->cpf_cnpj) }}</td></tr>
                    <tr><td class="rotulo">E-mail</td><td>{{ $c->cliente?->email ?: '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

<div class="bloco">
    <h2>Serviços e reserva combinados</h2>
    <table class="tabela" style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr>
                <th>Item</th>
                <th>Quem atende</th>
                <th class="num">Valor</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($c->itens as $item)
                <tr>
                    <td>{{ $item->descricao }}</td>
                    <td>{{ $item->funcionario?->nome ?: '—' }}</td>
                    <td class="num">{{ $moeda($item->valor) }}</td>
                </tr>
            @endforeach
            <tr class="total">
                <td colspan="2">Total</td>
                <td class="num">{{ $moeda($c->valor_total) }}</td>
            </tr>
        </tbody>
    </table>
</div>

<div class="bloco">
    <h2>Parcelas</h2>
    <table class="tabela" style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th class="num">Valor</th>
                <th>Situação</th>
                <th>Pago em</th>
                <th>Forma</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($c->parcelas as $p)
                @php
                    $classe = match ($p->status) { 'pago' => 'paga', 'cancelado', 'estornado' => 'cancelada', default => 'aberta' };
                @endphp
                <tr>
                    <td>{{ $p->numero }}/{{ $c->parcelas->count() }}</td>
                    <td>{{ $dia($p->vencimento) }}</td>
                    <td class="num">{{ $moeda($p->valor) }}</td>
                    <td class="{{ $classe }}">{{ $rotulosParcela[$p->status] ?? $p->status }}</td>
                    <td>{{ $p->pago_em ? $fmt($p->pago_em) : '—' }}{{ $p->baixa_manual ? ' (baixa manual)' : '' }}</td>
                    <td>{{ $p->forma_pagamento === 'online' ? 'Online' : 'Presencial' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="bloco">
    <h2>Resumo</h2>
    <table class="resumo" style="width: 100%;">
        <tr><td>Situação da cobrança</td><td class="num">{{ $rotulosCobranca[$c->status] ?? $c->status }}</td></tr>
        <tr><td>Enviada em</td><td class="num">{{ $fmt($c->created_at) }}</td></tr>
        @if ($c->aceita_em)
            <tr><td>Aceita em</td><td class="num">{{ $fmt($c->aceita_em) }}</td></tr>
        @endif
        <tr><td>Parcelas pagas</td><td class="num">{{ $parcelasPagas }} de {{ $c->parcelas->count() }}</td></tr>
        <tr><td>Total já pago</td><td class="num paga">{{ $moeda($totalPago) }}</td></tr>
        <tr><td>Em aberto</td><td class="num aberta">{{ $moeda($totalEmAberto) }}</td></tr>
    </table>
</div>

<div class="rodape">
    <p class="aviso" style="margin: 0 0 6px 0;">
        Documento emitido eletronicamente pela plataforma Lokyva a partir dos registros da cobrança {{ $c->codigo }}.
        A situação das parcelas reflete o momento da emissão e pode mudar depois, por isso confira no app antes de tomar decisões.
    </p>
</div>
</body>
</html>
