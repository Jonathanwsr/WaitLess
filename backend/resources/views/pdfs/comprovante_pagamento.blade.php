<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 30px 0; }
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #18181b; margin: 0; }
        .folha { width: 380px; margin: 0 auto; }
        .marca { text-align: center; font-size: 24px; font-weight: bold; color: #FF7A00; letter-spacing: -0.5px; }
        .marca .ponto { color: #18181b; }
        .titulo { text-align: center; font-size: 15px; font-weight: bold; margin-top: 14px; }
        .quando { text-align: center; font-size: 11px; color: #71717a; margin-top: 3px; }
        .linha { border-top: 1px solid #d4d4d8; margin: 16px 0; }
        .rotulo { font-size: 10px; color: #71717a; margin-top: 12px; }
        .valor { font-size: 14px; margin-top: 2px; }
        .valor-grande { font-size: 24px; font-weight: bold; margin-top: 2px; }
        .secao { font-size: 13px; margin-top: 2px; }
        .mono { font-family: DejaVu Sans Mono, monospace; font-size: 12px; word-break: break-all; }
        .aviso { margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 11px; }
        .aviso.estorno { background: #fef2f2; color: #991b1b; }
        .aviso.recebedor { background: #f4f4f5; color: #3f3f46; }
        .aviso table { width: 100%; }
        .aviso td.dir { text-align: right; font-weight: bold; }
        .rodape { text-align: center; margin-top: 18px; }
        .rodape .central { font-size: 13px; }
        .rodape .miudo { font-size: 9px; color: #71717a; margin-top: 5px; line-height: 1.5; }
        .nova-pagina { page-break-before: always; }
    </style>
</head>
<body>
@php
    $moeda = fn ($v) => 'R$ ' . number_format((float) $v, 2, ',', '.');
@endphp
{{-- Um ou vários comprovantes (baixar todos de um cliente): cada um na sua página. --}}
@foreach ($comprovantes as $c)
@php extract($c); @endphp
<div class="folha {{ $loop->first ? '' : 'nova-pagina' }}">
    <div class="marca">Lokyva<span class="ponto">.</span></div>
    <div class="titulo">{{ $titulo }}</div>
    <div class="quando">{{ $data->format('d/m/Y - H:i:s') }}</div>

    <div class="linha"></div>

    <div class="rotulo" style="margin-top: 0;">{{ $rotulo_valor }}</div>
    <div class="valor-grande">{{ $moeda($valor) }}</div>

    <div class="rotulo">Forma de pagamento</div>
    <div class="valor">{{ $forma }}</div>

    <div class="rotulo">Informação do pagamento</div>
    <div class="valor">{{ $descricao }}</div>

    @if ($estornado)
        <div class="aviso estorno">
            <b>Pagamento estornado.</b>{{ $via === 'recebedor' ? ' Este valor foi devolvido ao cliente.' : '' }}
            @if ($valor_estornado > 0) Valor devolvido: {{ $moeda($valor_estornado) }}@endif
            @if ($data_estorno) em {{ $data_estorno->format('d/m/Y H:i') }}@endif
        </div>
    @endif

    <div class="linha"></div>

    <div class="secao">Dados do recebedor</div>
    <div class="rotulo">Para</div>
    <div class="valor">{{ $recebedor['nome'] }}</div>
    @if ($recebedor['local'])
        <div class="rotulo">Local</div>
        <div class="valor">{{ $recebedor['local'] }}</div>
    @endif
    <div class="rotulo">{{ $recebedor['documento_rotulo'] }}</div>
    <div class="valor">{{ $recebedor['documento'] }}</div>
    <div class="rotulo">Instituição</div>
    <div class="valor">{{ $processador }}</div>

    @if ($detalhe_recebedor)
        <div class="aviso recebedor">
            <table>
                <tr><td>Taxa da plataforma</td><td class="dir">- {{ $moeda($detalhe_recebedor['taxa']) }}</td></tr>
                <tr><td>Valor líquido para o recebedor</td><td class="dir">{{ $moeda($detalhe_recebedor['liquido']) }}</td></tr>
            </table>
        </div>
    @endif

    <div class="linha"></div>

    <div class="secao">Dados do pagador</div>
    <div class="rotulo">Pagador</div>
    <div class="valor">{{ $pagador['nome'] }}</div>
    <div class="rotulo">{{ $pagador['documento_rotulo'] }}</div>
    <div class="valor">{{ $pagador['documento'] }}</div>

    <div class="linha"></div>

    <div class="rotulo" style="margin-top: 0;">ID/Transação</div>
    <div class="valor mono">{{ $transacao }}</div>

    <div class="rotulo">Data e hora da transação</div>
    <div class="valor">{{ $data->format('d/m/Y - H:i:s') }}</div>

    <div class="rotulo">Código de autenticação</div>
    <div class="valor mono">{{ $codigo }}</div>

    <div class="linha"></div>

    <div class="rodape">
        <div class="central">Central de Atendimento Lokyva</div>
        <div class="miudo">
            {{ $contato }}<br>
            Confira a autenticidade deste comprovante em {{ $url_verificacao }} com o código acima.<br>
            {{ $via === 'recebedor' ? 'Via do recebedor' : 'Via do pagador' }} · documento individual · emitido em {{ $emitido_em->format('d/m/Y H:i') }}.
        </div>
    </div>
</div>
@endforeach
</body>
</html>
