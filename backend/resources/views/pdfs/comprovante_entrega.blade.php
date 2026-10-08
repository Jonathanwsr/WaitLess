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
        .topo .codigo-pedido { text-align: right; font-size: 13px; font-weight: bold; color: #fb923c; }
        .bloco { padding: 12px 24px; border-bottom: 1px solid #e4e4e7; }
        .bloco h2 { font-size: 10px; text-transform: uppercase; color: #71717a; letter-spacing: 1px; margin: 0 0 8px; }
        table.grade { width: 100%; border-collapse: collapse; }
        table.grade td { padding: 3px 0; vertical-align: top; }
        table.grade td.rotulo { color: #71717a; width: 32%; }
        table.colunas td { width: 50%; padding-right: 14px; }
        table.itens th { text-align: left; font-size: 9px; text-transform: uppercase; color: #71717a; border-bottom: 1px solid #e4e4e7; padding: 4px 0; }
        table.itens td { padding: 5px 0; border-bottom: 1px solid #f4f4f5; }
        table.itens td.num, table.itens th.num { text-align: right; }
        .total td { font-weight: bold; font-size: 13px; padding-top: 8px; border-top: 1px solid #18181b; }
        .linha-tempo td { padding: 2px 0; }
        .marcador { color: #ea580c; font-weight: bold; }
        .codigo { font-size: 22px; font-weight: bold; letter-spacing: 6px; color: #ea580c; }
        .aviso { font-size: 9px; color: #71717a; line-height: 1.5; }
        .tag { display: inline-block; background: #f4f4f5; color: #3f3f46; padding: 2px 6px; border-radius: 4px; margin: 0 3px 3px 0; font-size: 9px; }
        .rodape { padding: 14px 24px; font-size: 9px; color: #71717a; }
    </style>
</head>
<body>
@php
    $fmt = fn ($data) => $data ? \Carbon\Carbon::parse($data)->timezone('America/Sao_Paulo')->format('d/m/Y H:i') : '—';
    $moeda = fn ($v) => 'R$ ' . number_format((float) $v, 2, ',', '.');
    $cpfCnpjMascara = function ($doc) {
        $n = preg_replace('/\D/', '', (string) $doc);
        if (strlen($n) === 11) return substr($n, 0, 3) . '.' . substr($n, 3, 3) . '.' . substr($n, 6, 3) . '-' . substr($n, 9);
        if (strlen($n) === 14) return substr($n, 0, 2) . '.' . substr($n, 2, 3) . '.' . substr($n, 5, 3) . '/' . substr($n, 8, 4) . '-' . substr($n, 12);
        return $doc ?: '—';
    };
    $subtotalProdutos = (float) $pedido->valor_unitario * (int) $pedido->quantidade;
    $statusTexto = [
        'pendente_pagamento' => 'Aguardando pagamento', 'pago' => 'Pago · aguardando entrega',
        'aguardando_confirmacao' => 'Aguardando entrega', 'concluido' => 'Entregue',
        'cancelado' => 'Cancelado', 'estornado' => 'Estornado',
    ][$pedido->status] ?? $pedido->status;
    $enderecoOrigem = trim(($pedido->origem_rua ?? '') . ', ' . ($pedido->origem_numero ?? '') . ' ' . ($pedido->origem_complemento ? '— ' . $pedido->origem_complemento : ''), ', ');
@endphp

    <div class="topo">
        <table>
            <tr>
                <td>
                    <h1>Comprovante de pedido</h1>
                    <div class="sub">Lokyva Entregas · emitido em {{ now('America/Sao_Paulo')->format('d/m/Y H:i') }}</div>
                </td>
                <td class="codigo-pedido">{{ $pedido->codigo_pedido }}</td>
            </tr>
        </table>
    </div>

    <div class="bloco">
        <h2>Resumo do pedido</h2>
        <table class="grade colunas">
            <tr>
                <td>
                    <table class="grade">
                        <tr><td class="rotulo">Situação</td><td><strong>{{ $statusTexto }}</strong></td></tr>
                        <tr><td class="rotulo">Pedido feito em</td><td>{{ $fmt($pedido->created_at) }}</td></tr>
                        <tr><td class="rotulo">Entregue em</td><td>{{ $fmt($pedido->data_conclusao) }}</td></tr>
                        @if ($pedido->data_cancelamento)
                            <tr><td class="rotulo">Cancelado em</td><td>{{ $fmt($pedido->data_cancelamento) }}</td></tr>
                        @endif
                    </table>
                </td>
                <td>
                    <table class="grade">
                        <tr><td class="rotulo">Recebimento</td><td>{{ $pedido->modo_recebimento === 'entrega' ? 'Entrega em casa' : 'Retirada no local' }}</td></tr>
                        <tr><td class="rotulo">Forma de pagamento</td><td>{{ $formasPagamento[$pedido->modo_pagamento] ?? $pedido->modo_pagamento }}</td></tr>
                        <tr><td class="rotulo">Local</td><td>{{ $pedido->estabelecimento?->nome ?? $pedido->vendedor?->name }}</td></tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>

    <div class="bloco">
        <h2>Produto</h2>
        <table class="grade">
            <tr><td class="rotulo">Produto</td><td><strong>{{ $pedido->produto?->nome ?? 'Produto removido' }}</strong></td></tr>
            @if ($pedido->produto?->descricao)
                <tr><td class="rotulo">Descrição</td><td>{{ \Illuminate\Support\Str::limit($pedido->produto->descricao, 240) }}</td></tr>
            @endif
            <tr><td class="rotulo">Categoria</td><td>{{ $pedido->produto?->categoria ?? '—' }}</td></tr>
            <tr><td class="rotulo">Marca</td><td>{{ $pedido->produto?->marca ?? '—' }}</td></tr>
            <tr><td class="rotulo">Peso / volume</td><td>{{ $pedido->produto?->peso_volume ?? '—' }}</td></tr>
            <tr><td class="rotulo">Código interno (SKU)</td><td>{{ $pedido->produto?->sku ?? '—' }}</td></tr>
            @if (!empty($pedido->produto?->tags))
                <tr><td class="rotulo">Tags</td><td>@foreach ($pedido->produto->tags as $tag)<span class="tag">{{ $tag }}</span>@endforeach</td></tr>
            @endif
        </table>

        <table class="itens" style="width: 100%; margin-top: 10px;">
            <thead>
                <tr><th>Item</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>{{ $pedido->produto?->nome ?? 'Produto removido' }} {{ $pedido->produto?->unidade_medida ? '(' . $pedido->produto->unidade_medida . ')' : '' }}</td>
                    <td class="num">{{ $pedido->quantidade }}</td>
                    <td class="num">{{ $moeda($pedido->valor_unitario) }}</td>
                    <td class="num">{{ $moeda($subtotalProdutos) }}</td>
                </tr>
            </tbody>
        </table>

        <table class="grade" style="margin-top: 10px;">
            <tr><td class="rotulo">Produtos</td><td>{{ $moeda($subtotalProdutos) }}</td></tr>
            <tr><td class="rotulo">Taxa de entrega</td><td>{{ $moeda($pedido->taxa_entrega) }}</td></tr>
            <tr class="total"><td>Total pago</td><td>{{ $moeda($pedido->valor_total) }}</td></tr>
        </table>
    </div>

    <div class="bloco">
        <h2>Pagamento</h2>
        <table class="grade colunas">
            <tr>
                <td>
                    <table class="grade">
                        <tr><td class="rotulo">Forma</td><td>{{ $formasPagamento[$pedido->modo_pagamento] ?? $pedido->modo_pagamento }}</td></tr>
                        @if ($pedido->modo_pagamento === 'online')
                            <tr><td class="rotulo">Método</td><td>{{ strtoupper($pedido->metodo_pagamento ?? '—') }}</td></tr>
                            <tr><td class="rotulo">Pago em</td><td>{{ $fmt($pedido->pagamento?->data_pagamento) }}</td></tr>
                            <tr><td class="rotulo">Identificação Asaas</td><td>{{ $pedido->pagamento?->id_transacao_gateway ?? 'aguardando' }}</td></tr>
                        @endif
                    </table>
                </td>
                <td>
                    @if ($pedido->modo_pagamento === 'online')
                        <table class="grade">
                            <tr><td class="rotulo">Situação do repasse</td><td>{{ $pedido->pagamento?->status_repasse === 'liberado' ? 'Liberado ao vendedor' : 'Retido até a entrega' }}</td></tr>
                            <tr><td class="rotulo">Liberado em</td><td>{{ $fmt($pedido->liberado_em) }}</td></tr>
                        </table>
                    @else
                        <p class="aviso">Pagamento combinado diretamente entre cliente e vendedor, sem passar pela plataforma.</p>
                    @endif
                </td>
            </tr>
        </table>

        @if ($mostrarFinanceiro && $pedido->modo_pagamento === 'online' && $pedido->pagamento)
            <table class="grade" style="margin-top: 10px;">
                <tr><td class="rotulo">Valor bruto recebido</td><td>{{ $moeda($pedido->pagamento->valor) }}</td></tr>
                <tr><td class="rotulo">Taxa da plataforma</td><td>{{ $moeda($pedido->pagamento->taxa) }}</td></tr>
                <tr class="total"><td>Valor líquido do vendedor</td><td>{{ $moeda($pedido->pagamento->valor_liquido) }}</td></tr>
            </table>
        @endif
    </div>

    <div class="bloco">
        <h2>{{ $pedido->modo_recebimento === 'entrega' ? 'Endereço de entrega' : 'Endereço para busca' }}</h2>
        <table class="grade">
            @if ($pedido->modo_recebimento === 'entrega')
                <tr><td class="rotulo">CEP</td><td>{{ $pedido->entrega_cep }}</td></tr>
                <tr><td class="rotulo">Logradouro</td><td>{{ $pedido->entrega_rua }}, {{ $pedido->entrega_numero }} {{ $pedido->entrega_complemento ? '— ' . $pedido->entrega_complemento : '' }}</td></tr>
                <tr><td class="rotulo">Bairro / cidade</td><td>{{ $pedido->entrega_bairro }} — {{ $pedido->entrega_cidade }}/{{ $pedido->entrega_estado }}</td></tr>
                <tr><td class="rotulo">Detalhes do local</td><td>{{ $pedido->entrega_observacoes ?: '—' }}</td></tr>
            @else
                <tr><td class="rotulo">Local</td><td>{{ $pedido->estabelecimento?->nome ?? $pedido->vendedor?->name }}</td></tr>
                <tr><td class="rotulo">Logradouro</td><td>{{ $enderecoOrigem }}</td></tr>
                <tr><td class="rotulo">Bairro / cidade</td><td>{{ $pedido->origem_bairro }} — {{ $pedido->origem_cidade }}/{{ $pedido->origem_estado }}</td></tr>
                <tr><td class="rotulo">CEP</td><td>{{ $pedido->origem_cep }}</td></tr>
            @endif
        </table>
    </div>

    <div class="bloco">
        <h2>Partes envolvidas</h2>
        <table class="grade colunas">
            <tr>
                <td>
                    <p class="aviso" style="margin: 0 0 4px; font-weight: bold; color: #18181b;">Cliente</p>
                    <table class="grade">
                        <tr><td class="rotulo">Nome</td><td>{{ $pedido->cliente?->name }}</td></tr>
                        @if ($mostrarDocumentoCliente)
                            <tr><td class="rotulo">CPF / CNPJ</td><td>{{ $cpfCnpjMascara($pedido->cliente?->cpf_cnpj) }}</td></tr>
                        @endif
                        <tr><td class="rotulo">E-mail</td><td>{{ $pedido->cliente?->email }}</td></tr>
                        <tr><td class="rotulo">Telefone</td><td>{{ $pedido->cliente?->mobile_phone ?: '—' }}</td></tr>
                    </table>
                </td>
                <td>
                    <p class="aviso" style="margin: 0 0 4px; font-weight: bold; color: #18181b;">Vendedor</p>
                    <table class="grade">
                        <tr><td class="rotulo">Nome</td><td>{{ $pedido->vendedor?->name }}</td></tr>
                        <tr><td class="rotulo">CPF / CNPJ</td><td>{{ $cpfCnpjMascara($vendedorCadastro?->document) }}</td></tr>
                        @if ($pedido->estabelecimento)
                            <tr><td class="rotulo">Estabelecimento</td><td>{{ $pedido->estabelecimento->nome }}{{ $pedido->estabelecimento->razao_social ? ' · ' . $pedido->estabelecimento->razao_social : '' }}</td></tr>
                            <tr><td class="rotulo">CNPJ do local</td><td>{{ $cpfCnpjMascara($pedido->estabelecimento->cnpj) }}</td></tr>
                        @endif
                        <tr><td class="rotulo">E-mail</td><td>{{ $pedido->vendedor?->email }}</td></tr>
                        <tr><td class="rotulo">Telefone</td><td>{{ $pedido->vendedor?->mobile_phone ?: ($pedido->estabelecimento?->telefone ?: '—') }}</td></tr>
                        @if ($pedido->funcionario)
                            <tr><td class="rotulo">Atendido por</td><td>{{ $pedido->funcionario->nome }}</td></tr>
                        @endif
                    </table>
                </td>
            </tr>
        </table>
    </div>

    @if ($pedido->disputa_status)
        <div class="bloco">
            <h2>Estorno / disputa</h2>
            <table class="grade">
                <tr><td class="rotulo">Situação</td><td>{{ ['solicitado' => 'Em análise', 'aprovado' => 'Aprovado', 'reprovado' => 'Não aprovado'][$pedido->disputa_status] ?? $pedido->disputa_status }}</td></tr>
                <tr><td class="rotulo">Motivo</td><td>{{ $pedido->disputa_motivo }}</td></tr>
                <tr><td class="rotulo">Solicitado em</td><td>{{ $fmt($pedido->updated_at) }}</td></tr>
                <tr><td class="rotulo">Decidido em</td><td>{{ $fmt($pedido->disputa_resolvida_em) }}</td></tr>
            </table>
        </div>
    @endif

    @if ($mostrarCodigo && $pedido->codigo_confirmacao && in_array($pedido->status, ['pago', 'aguardando_confirmacao', 'concluido'], true))
        <div class="bloco">
            <h2>Código de confirmação da entrega</h2>
            <div class="codigo">{{ $pedido->codigo_confirmacao }}</div>
            <p class="aviso">Apresente este código ao vendedor no momento da entrega ou busca. Ele libera o pagamento.</p>
        </div>
    @endif

    <div class="rodape">
        <p class="aviso" style="margin: 0 0 6px;">
            Documento gerado pela Lokyva Entregas para registro da compra. Pagamentos online ficam em custódia até a confirmação
            da entrega pelo código de 6 dígitos; estornos seguem a análise da plataforma. Os dados pessoais exibidos são
            restritos às partes do pedido.
        </p>
        <p class="aviso">Código do pedido: {{ $pedido->codigo_pedido }} · ID interno {{ $pedido->id }}</p>
    </div>
</body>
</html>
