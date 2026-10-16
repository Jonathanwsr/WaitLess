<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 22px 26px 40px 26px; }
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #18181b; font-size: 10px; margin: 0; }
        .rodape-fixo { position: fixed; bottom: -26px; left: 0; right: 0; height: 16px; font-size: 8px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 4px; }
        .rodape-fixo .pagina:after { content: "Página " counter(page) " de " counter(pages); }
        .topo { background: #18181b; color: #fff; padding: 16px 18px; border-radius: 6px; }
        .topo table { width: 100%; }
        .marca { font-size: 20px; font-weight: bold; color: #FF7A00; letter-spacing: -0.5px; }
        .marca .ponto { color: #fff; }
        .topo h1 { margin: 6px 0 0; font-size: 17px; }
        .topo .sub { margin-top: 3px; color: #d4d4d8; font-size: 10px; }
        .topo .total { text-align: right; vertical-align: bottom; }
        .topo .total .valor { font-size: 18px; font-weight: bold; color: #fb923c; }
        .topo .total .rot { font-size: 8px; color: #a1a1aa; text-transform: uppercase; }
        .aviso { margin-top: 8px; background: #fef3c7; color: #92400e; padding: 6px 8px; border-radius: 4px; font-size: 9px; }
        .dia { margin-top: 14px; page-break-inside: auto; }
        .dia-topo { border-bottom: 2px solid #FF7A00; padding-bottom: 4px; margin-bottom: 6px; }
        .dia-topo table { width: 100%; }
        .dia-titulo { font-size: 13px; font-weight: bold; }
        .dia-custo { text-align: right; color: #71717a; }
        .periodo { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #FF7A00; font-weight: bold; margin: 8px 0 3px; }
        table.itens { width: 100%; border-collapse: collapse; }
        table.itens td { padding: 5px 4px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
        tr { page-break-inside: avoid; }
        .num { width: 18px; }
        .bola { display: inline-block; width: 16px; height: 16px; line-height: 16px; border-radius: 8px; background: #18181b; color: #fff; text-align: center; font-size: 8px; font-weight: bold; }
        .hora { width: 34px; font-weight: bold; }
        .titulo { font-weight: bold; font-size: 10px; }
        .meta { color: #71717a; font-size: 8px; margin-top: 1px; }
        .tag { display: inline-block; font-size: 7px; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; background: #f4f4f5; color: #52525b; }
        .tag.loc { background: #fff1e4; color: #c2570a; }
        .valor { text-align: right; white-space: nowrap; width: 70px; }
        .fonte { margin-top: 16px; font-size: 8px; color: #71717a; }
    </style>
</head>
<body>
@php
    $r = $dados['roteiro'];
    $resumo = $dados['resumo'];
    $moeda = fn ($v) => 'R$ ' . number_format((float) $v, 2, ',', '.');
    $data = fn ($d) => \Carbon\Carbon::parse($d)->locale('pt_BR')->translatedFormat('d \d\e F');
    $diaSemana = fn ($d) => \Carbon\Carbon::parse($d)->locale('pt_BR')->translatedFormat('l, d/m');
    $temPonto = false;
@endphp
<div class="rodape-fixo">
    <table style="width: 100%;"><tr>
        <td>Lokyva · Roteiro de viagem · {{ $r['destino'] }}</td>
        <td style="text-align: right;"><span class="pagina"></span></td>
    </tr></table>
</div>

<div class="topo">
    <table><tr>
        <td>
            <div class="marca">Lokyva<span class="ponto">.</span></div>
            <h1>{{ $r['titulo'] }}</h1>
            <div class="sub">{{ $r['destino'] }}{{ $r['estado'] ? ' · ' . $r['estado'] : '' }} · {{ $data($r['data_inicio']) }} a {{ $data($r['data_fim']) }} · {{ $r['pessoas'] }} {{ $r['pessoas'] == 1 ? 'pessoa' : 'pessoas' }}</div>
        </td>
        <td class="total">
            <div class="rot">Custo estimado</div>
            <div class="valor">{{ $moeda($resumo['total']) }}</div>
            <div class="rot">{{ $moeda($resumo['por_pessoa']) }} por pessoa{{ $resumo['orcamento'] ? ' · orçamento ' . $moeda($resumo['orcamento']) : '' }}</div>
        </td>
    </tr></table>
</div>

@foreach ($dados['avisos'] as $aviso)
    <div class="aviso">{{ $aviso }}</div>
@endforeach

@foreach ($dados['dias'] as $dia)
    <div class="dia">
        <div class="dia-topo"><table><tr>
            <td class="dia-titulo">Dia {{ $dia['numero'] }} · {{ ucfirst($diaSemana($dia['data'])) }}</td>
            <td class="dia-custo">{{ $moeda($dia['custo']) }} no dia</td>
        </tr></table></div>

        @foreach ($periodos as $chave => $rotulo)
            @if (!empty($dia['periodos'][$chave]))
                <div class="periodo">{{ $rotulo }}</div>
                <table class="itens">
                    @foreach ($dia['periodos'][$chave] as $item)
                        @php if ($item['tipo'] === 'ponto_turistico') { $temPonto = true; } @endphp
                        <tr>
                            <td class="num">@if ($item['numero'])<span class="bola">{{ $item['numero'] }}</span>@endif</td>
                            <td class="hora">{{ $item['hora'] ?? '' }}</td>
                            <td>
                                <div class="titulo">{{ $item['titulo'] }}</div>
                                <div class="meta">
                                    @if ($item['tipo'] === 'locacao')<span class="tag loc">Lokyva</span>@elseif ($item['tipo'] === 'ponto_turistico')<span class="tag">Ponto turístico</span>@else<span class="tag">Anotação</span>@endif
                                    @if ($item['distancia_km'] !== null) · {{ number_format($item['distancia_km'], 1, ',', '.') }} km ({{ $item['minutos'] }} min {{ $item['modo'] === 'a_pe' ? 'a pé' : 'de carro' }}) @endif
                                    @if ($item['aviso_horario']) · {{ $item['aviso_horario'] }} @endif
                                </div>
                                @if (!empty($item['anotacao']))<div class="meta">Anotação: {{ $item['anotacao'] }}</div>@endif
                            </td>
                            <td class="valor">{{ $item['custo_estimado'] > 0 ? $moeda($item['custo_estimado']) : '' }}</td>
                        </tr>
                    @endforeach
                </table>
            @endif
        @endforeach
    </div>
@endforeach

<div class="fonte">
    Valores estimados com os preços atuais do Lokyva; podem mudar até a reserva.
    @if ($temPonto) Descrições dos pontos turísticos: Wikipédia/Wikivoyage (CC BY-SA 4.0). @endif
    Gerado em {{ now()->format('d/m/Y H:i') }}.
</div>
</body>
</html>
