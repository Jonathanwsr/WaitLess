<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <style>
        /* Margem inferior maior para o rodapé fixo, que aparece em todas as páginas. */
        @page { margin: 18px 22px 34px 22px; }
        .rodape-fixo { position: fixed; bottom: -22px; left: 0; right: 0; height: 14px; font-size: 8px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 3px; }
        .rodape-fixo .pagina:after { content: "Página " counter(page) " de " counter(pages); }
        /* Muitos registros: as tabelas continuam nas próximas páginas, repetindo o cabeçalho
           das colunas, e nenhuma linha é cortada entre duas páginas. */
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        h2 { page-break-after: avoid; }
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #18181b; font-size: 9px; margin: 0; }
        .topo { background: #18181b; color: #fff; padding: 14px 18px; }
        .topo table { width: 100%; }
        .topo h1 { margin: 0; font-size: 15px; }
        .topo .sub { margin-top: 3px; color: #a1a1aa; font-size: 9px; }
        .topo .periodo { text-align: right; font-size: 12px; font-weight: bold; color: #fb923c; }
        .bloco { padding: 10px 4px; }
        h2 { font-size: 10px; text-transform: uppercase; color: #71717a; letter-spacing: 1px; margin: 0 0 6px; }
        table.resumo { width: 100%; border-collapse: separate; border-spacing: 6px 0; }
        table.resumo td { background: #f4f4f5; padding: 7px 8px; width: 16.6%; vertical-align: top; }
        .num { font-size: 13px; font-weight: bold; }
        .rotulo { color: #71717a; font-size: 8px; text-transform: uppercase; }
        table.lista { width: 100%; border-collapse: collapse; }
        table.lista th { text-align: left; font-size: 8px; text-transform: uppercase; color: #71717a; border-bottom: 1px solid #d4d4d8; padding: 4px 3px; }
        table.lista td { padding: 4px 3px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
        table.lista td.dir, table.lista th.dir { text-align: right; }
        .ok { color: #047857; font-weight: bold; }
        .cancelado { color: #b91c1c; font-weight: bold; }
        .aberto { color: #b45309; font-weight: bold; }
        .vazio { color: #a1a1aa; padding: 8px 0; }
        .rodape { padding: 8px 4px; font-size: 8px; color: #71717a; }
        .contato { color: #71717a; font-size: 8px; }
    </style>
</head>
<body>
<div class="rodape-fixo">
    <table style="width: 100%;"><tr>
        <td>Histórico de serviços e reservas · {{ $periodo['rotulo'] }}</td>
        <td style="text-align: right;"><span class="pagina"></span></td>
    </tr></table>
</div>
@php
    $moeda = fn ($v) => 'R$ ' . number_format((float) $v, 2, ',', '.');
    $classe = fn ($status) => match ($status) {
        'finalizado' => 'ok',
        'cancelado' => 'cancelado',
        default => 'aberto',
    };
@endphp

<div class="topo">
    <table>
        <tr>
            <td>
                <h1>Histórico de serviços e reservas</h1>
                <div class="sub">{{ $locais->implode(' · ') }} · emitido por {{ $responsavel }} em {{ $emitidoEm->format('d/m/Y H:i') }}</div>
            </td>
            <td class="periodo">{{ $periodo['rotulo'] }}</td>
        </tr>
    </table>
</div>

<div class="bloco">
    <h2>Resumo</h2>
    <table class="resumo">
        <tr>
            <td><div class="rotulo">Serviços</div><div class="num">{{ $resumo['servicos_total'] }}</div></td>
            <td><div class="rotulo">Concluídos</div><div class="num ok">{{ $resumo['servicos_concluidos'] }}</div></td>
            <td><div class="rotulo">Cancelados</div><div class="num cancelado">{{ $resumo['servicos_cancelados'] }}</div></td>
            <td><div class="rotulo">Em aberto</div><div class="num aberto">{{ $resumo['servicos_abertos'] }}</div></td>
            <td><div class="rotulo">Faturado (concluídos)</div><div class="num">{{ $moeda($resumo['servicos_faturado']) }}</div></td>
            <td></td>
        </tr>
    </table>
    <table class="resumo" style="margin-top: 6px;">
        <tr>
            <td><div class="rotulo">Reservas</div><div class="num">{{ $resumo['reservas_total'] }}</div></td>
            <td><div class="rotulo">Concluídas</div><div class="num ok">{{ $resumo['reservas_concluidas'] }}</div></td>
            <td><div class="rotulo">Canceladas</div><div class="num cancelado">{{ $resumo['reservas_canceladas'] }}</div></td>
            <td><div class="rotulo">Em aberto</div><div class="num aberto">{{ $resumo['reservas_abertas'] }}</div></td>
            <td><div class="rotulo">Valor (confirmadas e concluídas)</div><div class="num">{{ $moeda($resumo['reservas_faturado']) }}</div></td>
            <td><div class="rotulo">Reembolsado</div><div class="num">{{ $moeda($resumo['reservas_reembolsado']) }}</div></td>
        </tr>
    </table>
</div>

<div class="bloco">
    <h2>Serviços ({{ $servicos->count() }})</h2>
    @if ($servicos->isEmpty())
        <p class="vazio">Nenhum serviço no período.</p>
    @else
        <table class="lista">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Serviço</th>
                    <th>Local</th>
                    <th>Profissional</th>
                    <th>Situação</th>
                    <th>Pagamento</th>
                    <th class="dir">Descontos</th>
                    <th class="dir">Valor</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($servicos as $s)
                    <tr>
                        <td>#{{ $s['id'] }}</td>
                        <td>{{ $s['data'] }}</td>
                        <td>{{ $s['hora'] }}</td>
                        <td>{{ $s['cliente'] }}@if ($s['contato'])<br><span class="contato">{{ $s['contato'] }}</span>@endif</td>
                        <td>{{ $s['servico'] }}</td>
                        <td>{{ $s['local'] }}</td>
                        <td>{{ $s['profissional'] }}</td>
                        <td class="{{ $classe($s['status']) }}">{{ $s['status_rotulo'] }}</td>
                        <td>{{ $s['pagamento'] }}</td>
                        <td class="dir">{{ $s['descontos'] > 0 ? $moeda($s['descontos']) : '—' }}</td>
                        <td class="dir">{{ $moeda($s['valor']) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>

<div class="bloco">
    <h2>Reservas ({{ $reservas->count() }})</h2>
    @if ($reservas->isEmpty())
        <p class="vazio">Nenhuma reserva começando no período.</p>
    @else
        <table class="lista">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Cliente</th>
                    <th>Item</th>
                    <th>Responsável</th>
                    <th>Situação</th>
                    <th>Pagamento</th>
                    <th class="dir">Caução</th>
                    <th class="dir">Reembolsado</th>
                    <th class="dir">Valor</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($reservas as $r)
                    <tr>
                        <td>{{ $r['codigo'] ?: '#' . $r['id'] }}</td>
                        <td>{{ $r['inicio'] }}</td>
                        <td>{{ $r['fim'] }}</td>
                        <td>{{ $r['cliente'] }}@if ($r['contato'])<br><span class="contato">{{ $r['contato'] }}</span>@endif</td>
                        <td>{{ $r['item'] }}</td>
                        <td>{{ $r['responsavel'] }}</td>
                        <td class="{{ $classe($r['status']) }}">{{ $r['status_rotulo'] }}</td>
                        <td>{{ $r['pagamento'] }}</td>
                        <td class="dir">{{ $r['caucao'] > 0 ? $moeda($r['caucao']) : '—' }}</td>
                        <td class="dir">{{ $r['reembolsado'] !== null ? $moeda($r['reembolsado']) : '—' }}</td>
                        <td class="dir">{{ $moeda($r['valor']) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>

<div class="rodape">
    Serviços pela data do atendimento; reservas pela data de início. Documento gerado pela plataforma Lokyva a partir dos registros do sistema na data de emissão.
</div>
</body>
</html>
