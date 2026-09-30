<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\User;
use App\Services\AsaasService; // 👈 Alterado para o Serviço do Asaas
use App\Services\CupomService;
use App\Services\PagamentoService;
use App\Exceptions\CobrancaRecusadaException;
use App\Exceptions\CarteiraAsaasNaoConfiguradaException;
use App\Services\PontosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;
use Exception;

class ClienteAgendamentoMobileController extends Controller
{
    protected $asaasService; // 👈 Atualizado

    public function __construct(AsaasService $asaasService, private CupomService $cupomService) // 👈 Atualizado
    {
        $this->asaasService = $asaasService;
    }

    // ==========================================
    // 🔍 PARTE 1: BUSCAS E LISTAGENS (GET)
    // ==========================================

    public function obterDadosAgendamento($estabelecimentoId)
    {
        // Corrigido: $estabelecimentoId é o ID de um Estabelecimento, não de um
        // User — buscar em User sempre retornava "não localizado" (a menos que
        // os IDs coincidissem por acaso), quebrando esta tela por completo.
        $estabelecimento = Estabelecimento::where('id', $estabelecimentoId)->where('ativo', true)->first();

        if (!$estabelecimento) {
            return response()->json(['error' => 'Estabelecimento não localizado.'], 404);
        }

        // Busca serviços ativos vinculados ao salão/estabelecimento
        $servicos = DB::table('servicos')
            ->where('estabelecimento_id', $estabelecimento->id)
            ->where('ativo', true)
            ->get();

        return response()->json([
            'estabelecimento' => [
                'id' => $estabelecimento->id,
                'nome' => $estabelecimento->nome,
                'foto_perfil' => $estabelecimento->foto_perfil ?? null,
                'bairro' => $estabelecimento->bairro ?? null,
                'cidade' => $estabelecimento->cidade ?? null,
                'estado' => $estabelecimento->estado ?? null,
                'telefone' => $estabelecimento->telefone ?? null,
            ],
            'servicos' => $servicos
        ]);
    }

    public function obterDadosReserva($itemId)
    {
        $item = DB::table('itens_aluguel')
            ->where('id', $itemId)
            ->where('ativo', true)
            ->where('disponivel', true)
            ->first();

        if (!$item) {
            return response()->json(['error' => 'Item de reserva indisponível ou não localizado.'], 404);
        }

        $estabelecimento = Estabelecimento::where('id', $item->estabelecimento_id)
            ->select('id', 'nome', 'foto_perfil', 'avaliacao_media', 'total_avaliacoes', 'cidade', 'estado', 'created_at')
            ->first();

        $avaliacoes = DB::table('avaliacoes')
            ->join('users', 'users.id', '=', 'avaliacoes.usuario_id')
            ->where('avaliacoes.estabelecimento_id', $item->estabelecimento_id)
            ->where('avaliacoes.publica', true)
            ->latest('avaliacoes.created_at')
            ->take(3)
            ->select('avaliacoes.*', 'users.name as usuario_nome', 'users.foto_perfil as usuario_foto_perfil')
            ->get();

        // Veio via DB::table (não é o model Eloquent), então os campos JSON ainda estão como string.
        $item->fotos = json_decode((string) $item->fotos, true) ?? [];
        $item->recursos_oferecidos = json_decode((string) $item->recursos_oferecidos, true) ?? [];

        $item->permite_entrega = \App\Models\ItemAluguel::categoriaPermiteEntrega($item->categoria);

        $itemModelo = \App\Models\ItemAluguel::find($itemId);
        $item->datas_indisponiveis = $itemModelo ? app(\App\Services\Locacao\DisponibilidadeService::class)->datasEsgotadas($itemModelo) : [];

        $reputacao = app(\App\Services\ReputacaoAnfitriaoService::class)->resumo((int) $item->estabelecimento_id);

        return response()->json([
            'item' => $item,
            'estabelecimento' => $estabelecimento,
            'avaliacoes_previa' => $avaliacoes,
            'reputacao' => $reputacao['avaliacoes'],
            'anfitriao' => $reputacao['anfitriao'],
        ]);
    }

    // ==========================================
    // 📅 PARTE 2: AGENDAMENTO DE SERVIÇOS (STORE)
    // ==========================================

    public function agendarServico(Request $request, $estabelecimentoId)
    {
        $validated = $request->validate([
            'servico_id'       => 'required|exists:servicos,id',
            'data_agendamento' => 'required|date|after_or_equal:today',
            'hora_agendamento' => 'required|string',
            'forma_pagamento'  => 'required|string|in:online_agora,online_depois,presencial',
            'pontos_utilizados' => 'nullable|integer|min:0',
            'cupom_codigo'     => 'nullable|string|max:60',
            'funcionario_id'   => 'nullable|integer',
            'metodo_pagamento' => 'nullable|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12',
            'cartao'           => 'nullable|required_if:metodo_pagamento,cartao|array',
            'cartao.numero'    => 'required_with:cartao|string|min:13|max:23',
            'cartao.titular'   => 'required_with:cartao|string|max:100',
            'cartao.mes'       => 'required_with:cartao|integer|between:1,12',
            'cartao.ano'       => 'required_with:cartao|integer|min:26|max:2099',
            'cartao.cvv'       => 'required_with:cartao|digits_between:3,4',
        ]);

        $estabelecimento = Estabelecimento::findOrFail($estabelecimentoId);

        $dataHoraAgendada = Carbon::parse($validated['data_agendamento'] . ' ' . $validated['hora_agendamento']);
        if ($dataHoraAgendada->isPast()) {
            return response()->json(['error' => 'Não é possível agendar em um horário que já passou!'], 422);
        }

        $servico = DB::table('servicos')->where('estabelecimento_id', $estabelecimento->id)->where('id', $validated['servico_id'])->first();
        if (!$servico) {
            return response()->json(['error' => 'Serviço não pertence a este estabelecimento.'], 404);
        }

        // 🚫 VAGAS: até `servicos.vagas_por_horario` clientes no mesmo dia+horário (ver VagasServicoService).
        $vagasServico = app(\App\Services\Agendamento\VagasServicoService::class);
        if ($vagasServico->vagasLivres($servico, $validated['data_agendamento'], $validated['hora_agendamento']) <= 0) {
            $horaFormatada = substr($validated['hora_agendamento'], 0, 5);
            $dataFormatada = $dataHoraAgendada->format('d/m/Y');
            return response()->json([
                'error' => "Esgotado: não há mais vagas para {$servico->nome} às {$horaFormatada} do dia {$dataFormatada}. Escolha outro horário.",
                'horario_ocupado' => true,
                'esgotado' => true,
            ], 409);
        }

        $configuracoes = is_string($servico->configuracoes) ? json_decode($servico->configuracoes, true) : ((array) $servico->configuracoes ?? []);
        $funcionarioId = $configuracoes['funcionario_padrao'] ?? null;

        // O cliente pode escolher o profissional; sem escolha vale o padrão do serviço.
        if (!empty($validated['funcionario_id'])) {
            $escolhido = \App\Models\Funcionario::where('id', $validated['funcionario_id'])
                ->where('estabelecimento_id', $estabelecimento->id)->where('ativo', true)->first();
            if (!$escolhido) {
                return response()->json(['error' => 'Este profissional não atende neste local.'], 422);
            }
            $funcionarioId = $escolhido->id;
        }
        $tipoPagamentoServico = $configuracoes['tipo_pagamento'] ?? 'hibrido';

        if ($validated['forma_pagamento'] === 'presencial' && $tipoPagamentoServico === 'online') {
            return response()->json(['error' => 'Este serviço aceita apenas pagamento online.'], 422);
        }

        try {
            DB::beginTransaction();

            $formaEscolhida = $validated['forma_pagamento'];
            $isPresencial = ($formaEscolhida === 'presencial');

            $valorTotal = $servico->valor;
            $user = Auth::user();

            // Pontos de fidelidade (saldo GLOBAL, users.pontos_saldo).
            $pontosAplicados = 0;
            $valorDescontoPontos = 0.0;
            if (($servico->aceita_pontos ?? false) && $request->filled('pontos_utilizados')) {
                $pontosSolicitados = (int) $validated['pontos_utilizados'];
                if (!empty($servico->maximo_pontos_permitidos)) {
                    $pontosSolicitados = min($pontosSolicitados, (int) $servico->maximo_pontos_permitidos);
                }
                $pontosAplicados = PontosService::pontosAplicaveis($user, $pontosSolicitados, $valorTotal);
                if ($pontosAplicados > 0) {
                    $valorDescontoPontos = PontosService::pontosParaValor($pontosAplicados);
                    $valorTotal = max(0, $valorTotal - $valorDescontoPontos);
                }
            }

            // Cupom (App\Models\Cupom).
            $cupomAplicado = null;
            $valorDescontoCupom = 0.0;
            if ($request->filled('cupom_codigo')) {
                try {
                    $cupomAplicado = $this->cupomService->buscarValidoParaUsuario($validated['cupom_codigo'], $user, $estabelecimento->id, $servico->id);
                } catch (ValidationException $e) {
                    DB::rollBack();
                    return response()->json(['error' => collect($e->errors())->collapse()->first() ?? 'Cupom inválido.'], 422);
                }
                $valorDescontoCupom = $this->cupomService->calcularDesconto($cupomAplicado, $valorTotal);
                $valorTotal = max(0, $valorTotal - $valorDescontoCupom);
            }

            // Serviço gratuito (ou que zerou com cupom/pontos/desconto): não existe o
            // que cobrar, então não faz sentido gerar PIX/boleto/cartão — a reserva
            // já nasce confirmada, sem passar pelo gateway de pagamento.
            $ehGratuito = $valorTotal <= 0;

            $valorTaxaApp = ($isPresencial || $ehGratuito) ? 0 : round($valorTotal * \App\Support\Taxas::fracao(), 2);
            $valorLiquidoSalao = $valorTotal - $valorTaxaApp;

            $codigoPin = ($isPresencial || $ehGratuito) ? (string) mt_rand(1000, 9999) : null;

            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'funcionario_id'     => $funcionarioId,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                'status'             => $ehGratuito ? 'confirmado' : ($isPresencial ? 'pendente' : 'aguardando_pagamento'),
                'status_pagamento'   => $ehGratuito ? 'pago' : ($isPresencial ? 'presencial' : 'pendente'),
                'valor_final'        => $valorTotal,
                'pontos_utilizados'  => $pontosAplicados,
                'valor_desconto_pontos' => $pontosAplicados > 0 ? $valorDescontoPontos : null,
                'cupom_id'           => $cupomAplicado?->id,
                'valor_desconto_cupom' => $cupomAplicado ? $valorDescontoCupom : null,
                'codigo_verificacao' => $codigoPin,
            ]);

            if ($pontosAplicados > 0) {
                $user->decrement('pontos_saldo', $pontosAplicados);
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => null,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'uso',
                    'descricao'          => "Desconto de R$ " . number_format($valorDescontoPontos, 2, ',', '.') . " usando {$pontosAplicados} pontos",
                    'quantidade'         => $pontosAplicados,
                    'created_at'         => now()
                ]);
            }

            if ($cupomAplicado) {
                $this->cupomService->marcarUsado($user, $cupomAplicado);
            }

            // 📊 Contador de atividade do cliente na tabela users (numero_reservas)
            Auth::user()->increment('numero_reservas');

            $pagamento = Pagamento::create([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $estabelecimento->id,
                'agendamento_id'     => $agendamento->id,
                'gateway_pagamento'  => ($isPresencial || $ehGratuito) ? null : 'asaas', // 👈 Ajustado para o Asaas
                'valor'              => $valorTotal,
                'taxa'               => $valorTaxaApp,
                'valor_liquido'      => $valorLiquidoSalao,
                'status'             => $ehGratuito ? 'pago' : 'pendente',
                'metodo_pagamento'   => $ehGratuito ? 'gratuito' : ($isPresencial ? 'presencial' : 'online'),
            ]);

            $linkPagamento = null;
            $pagoAgora = $ehGratuito;
            $pixQrCode = null;
            if (!$ehGratuito && $formaEscolhida === 'online_agora' && !empty($validated['metodo_pagamento'])) {
                // Cobrança real no Asaas (Pix, boleto ou cartão com parcelas), igual ao site.
                $pagamento->delete();
                $ps = app(PagamentoService::class);
                $ehCartao = $validated['metodo_pagamento'] === 'cartao';
                $cobranca = $ps->criarCobrancaAsaas(
                    $agendamento,
                    $validated['metodo_pagamento'],
                    $ps->garantirClienteAsaas($user),
                    $ehCartao ? (int) ($validated['parcelas'] ?? 1) : 1,
                    $ehCartao ? ($validated['cartao'] ?? null) : null,
                    $user,
                    $request->ip()
                );
                $linkPagamento = $cobranca['invoice_url'] ?? null;
                $pixQrCode = $cobranca['pix_qr_code'] ?? null;
                $pagoAgora = !empty($cobranca['aprovado']);
                $codigoPin = $agendamento->fresh()->codigo_verificacao;
            } elseif (!$ehGratuito && $formaEscolhida === 'online_agora') {
                $tokenSalao = $estabelecimento->token_asaas ?? null; // 👈 Certifique-se de usar a coluna correta do BD

                // 👈 Chamada atualizada para o AsaasService
                $checkoutAsaas = $this->asaasService->criarCheckout($agendamento, $servico, $valorTaxaApp, $tokenSalao);

                // O Asaas geralmente retorna a URL no campo 'invoiceUrl' ou 'bankSlipUrl'
                if (!isset($checkoutAsaas['invoiceUrl'])) {
                    throw new Exception('A API de pagamento do Asaas falhou em gerar o link.');
                }

                $pagamento->update(['id_transacao_gateway' => $checkoutAsaas['id']]);
                $linkPagamento = $checkoutAsaas['invoiceUrl']; // 👈 Pega a URL correta do Asaas
            }

            DB::commit();

            return response()->json([
                'message' => 'Agendamento registrado com sucesso!',
                'tipo' => 'servico',
                'forma_pagamento' => $formaEscolhida,
                'agendamento_id' => $agendamento->id,
                'codigo_verificacao' => $codigoPin,
                'payment_url' => $linkPagamento, // 👈 Retorna o link para o front-end
                'pago' => $pagoAgora,
                'pix_qr_code' => $pixQrCode,
            ], 201);

        } catch (CobrancaRecusadaException $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage(), 'cobranca_recusada' => true], 422);
        } catch (CarteiraAsaasNaoConfiguradaException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Este estabelecimento ainda não recebe pagamentos online. Escolha pagar no local.'], 422);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha interna ao processar agendamento: ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 🚗 PARTE 3: RESERVA / ALUGUEL DE ITENS (STORE)
    // ==========================================

    public function reservarItem(Request $request, $itemId)
    {
        $validated = $request->validate([
            'tipo_periodo'        => 'required|in:diaria,semanal,mensal',
            'quantidade_periodos' => 'required|integer|min:1',
            'data_inicio'         => 'required|date|after_or_equal:today',
            'pessoas'             => 'nullable|integer|min:1',
            'forma_pagamento'     => 'required|string',
            'metodo_pagamento' => 'nullable|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12',
            'cartao'           => 'nullable|required_if:metodo_pagamento,cartao|array',
            'cartao.numero'    => 'required_with:cartao|string|min:13|max:23',
            'cartao.titular'   => 'required_with:cartao|string|max:100',
            'cartao.mes'       => 'required_with:cartao|integer|between:1,12',
            'cartao.ano'       => 'required_with:cartao|integer|min:26|max:2099',
            'cartao.cvv'       => 'required_with:cartao|digits_between:3,4',

            'cep_retirada'         => 'nullable|string|max:10',
            'rua_retirada'         => 'nullable|string|max:255',
            'numero_retirada'      => 'nullable|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada'      => 'nullable|string|max:255',
            'cidade_retirada'      => 'nullable|string|max:255',
            'estado_retirada'      => 'nullable|string|max:2',

            'cep_entrega'          => 'nullable|string|max:10',
            'rua_entrega'          => 'nullable|string|max:255',
            'numero_entrega'       => 'nullable|string|max:20',
            'complemento_entrega'  => 'nullable|string|max:255',
            'bairro_entrega'       => 'nullable|string|max:255',
            'cidade_entrega'       => 'nullable|string|max:255',
            'estado_entrega'       => 'nullable|string|max:2',

            'pontos_utilizados'    => 'nullable|integer|min:0',
            'cupom_codigo'         => 'nullable|string|max:60',
        ]);

        $item = DB::table('itens_aluguel')->where('id', $itemId)->where('ativo', true)->first();
        if (!$item || !$item->disponivel) {
            return response()->json(['error' => 'Este item não está disponível para locação.'], 422);
        }

        $dataInicio = Carbon::parse($validated['data_inicio']);
        $dataFim = $dataInicio->copy();

        if ($validated['tipo_periodo'] === 'diaria') {
            $dataFim->addDays($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_diaria;
        } elseif ($validated['tipo_periodo'] === 'semanal') {
            $dataFim->addWeeks($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_semanal ?? ($item->valor_diaria * 7);
        } else {
            $dataFim->addMonths($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_mensal ?? ($item->valor_diaria * 30);
        }

        if (!$valorUnitario) {
            return response()->json(['error' => 'A precificação para esta modalidade de período não foi configurada.'], 422);
        }

        $pessoas = max(1, (int) ($validated['pessoas'] ?? 1));
        $capacidadePessoas = max(1, (int) ($item->capacidade_pessoas ?: $item->lugares ?: $pessoas));
        if ($pessoas > $capacidadePessoas) {
            return response()->json(['error' => "Este local comporta no máximo {$capacidadePessoas} pessoa(s)."], 422);
        }

        // Impede reservar em cima de outra já existente: soma as unidades ocupadas no período.
        $itemModelo = \App\Models\ItemAluguel::find($itemId);
        try {
            app(\App\Services\Locacao\DisponibilidadeService::class)->verificar($itemModelo, $dataInicio, $dataFim, 1);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => collect($e->errors())->collapse()->first() ?? 'Esgotado para essas datas.',
                'esgotado' => true,
            ], 409);
        }

        // Preço por pessoa: "pacote" só cobra quem passa da franquia incluída; "por_pessoa" multiplica tudo pelas pessoas.
        if (($item->modelo_precificacao ?? 'pacote') === 'por_pessoa') {
            $valorUnitario = $valorUnitario * $pessoas;
        } else {
            $incluidas = max(1, (int) ($item->pessoas_incluidas ?: $capacidadePessoas));
            $pessoasExtras = max(0, $pessoas - $incluidas);
            $valorUnitario += $pessoasExtras * (float) ($item->valor_pessoa_extra ?? 0);
        }

        try {
            DB::beginTransaction();

            $user = Auth::user();
            $valorBruto = $valorUnitario * $validated['quantidade_periodos'];

            // Pontos de fidelidade (saldo GLOBAL, users.pontos_saldo).
            $pontosAplicados = 0;
            $valorDescontoPontos = 0.0;
            if (($item->aceita_pontos ?? false) && $request->filled('pontos_utilizados')) {
                $pontosSolicitados = (int) $validated['pontos_utilizados'];
                if (!empty($item->maximo_pontos_permitidos)) {
                    $pontosSolicitados = min($pontosSolicitados, (int) $item->maximo_pontos_permitidos);
                }
                $pontosAplicados = PontosService::pontosAplicaveis($user, $pontosSolicitados, $valorBruto);
                if ($pontosAplicados > 0) {
                    $valorDescontoPontos = PontosService::pontosParaValor($pontosAplicados);
                }
            }

            // Cupom (App\Models\Cupom).
            $cupomAplicado = null;
            $valorDescontoCupom = 0.0;
            if ($request->filled('cupom_codigo')) {
                try {
                    $cupomAplicado = $this->cupomService->buscarValidoParaUsuario($validated['cupom_codigo'], $user, $item->estabelecimento_id, null, $item->id);
                } catch (ValidationException $e) {
                    DB::rollBack();
                    return response()->json(['error' => collect($e->errors())->collapse()->first() ?? 'Cupom inválido.'], 422);
                }
                $subtotalAntesDoCupom = max(0, $valorBruto - $valorDescontoPontos);
                $valorDescontoCupom = $this->cupomService->calcularDesconto($cupomAplicado, $subtotalAntesDoCupom);
            }

            $valorBrutoComDesconto = max(0, $valorBruto - $valorDescontoPontos - $valorDescontoCupom);
            $valorCaucao = $item->valor_caucao ?? 0.00;
            $taxaServico = round($valorBrutoComDesconto * \App\Support\Taxas::fracao(), 2);
            $valorTotalFinal = $valorBrutoComDesconto + $valorCaucao + $taxaServico;

            if ($pontosAplicados > 0) {
                $user->decrement('pontos_saldo', $pontosAplicados);
            }
            if ($cupomAplicado) {
                $this->cupomService->marcarUsado($user, $cupomAplicado);
            }

            $aluguelId = DB::table('alugueis')->insertGetId([
                'codigo_reserva'      => 'RES-' . strtoupper(Str::random(8)),
                'numero_contracto'    => null,
                'estabelecimento_id'  => $item->estabelecimento_id,
                'item_aluguel_id'     => $item->id,
                'servico_id'          => $item->servico_id,
                'proprietario_id'     => $item->estabelecimento_id,
                'locatario_id'        => Auth::id(),
                'tipo_periodo'        => $validated['tipo_periodo'],
                'quantidade_periodos' => $validated['quantidade_periodos'],
                'data_inicio'         => $dataInicio,
                'data_fim'            => $dataFim,
                'quantidade'          => 1,
                'quantidade_pessoas'  => $pessoas,
                'valor_unitario'      => $valorUnitario,
                'valor_caucao'        => $valorCaucao,
                'taxa_servico'        => $taxaServico,
                'valor_bruto'         => $valorBruto,
                'valor_desconto_pontos' => $pontosAplicados > 0 ? $valorDescontoPontos : 0,
                'pontos_utilizados'   => $pontosAplicados,
                'cupom_id'            => $cupomAplicado?->id,
                'valor_desconto_cupom' => $cupomAplicado ? $valorDescontoCupom : 0,
                'valor_total'         => $valorTotalFinal,
                'forma_pagamento'     => $validated['forma_pagamento'],
                'status'              => 'pendente',
                'created_at'          => now(),
                'updated_at'          => now(),

                'cep_retirada'         => $validated['cep_retirada'] ?? null,
                'rua_retirada'         => $validated['rua_retirada'] ?? null,
                'numero_retirada'      => $validated['numero_retirada'] ?? null,
                'complemento_retirada' => $validated['complemento_retirada'] ?? null,
                'bairro_retirada'      => $validated['bairro_retirada'] ?? null,
                'cidade_retirada'      => $validated['cidade_retirada'] ?? null,
                'estado_retirada'      => $validated['estado_retirada'] ?? null,

                'cep_entrega'          => $validated['cep_entrega'] ?? null,
                'rua_entrega'          => $validated['rua_entrega'] ?? null,
                'numero_entrega'       => $validated['numero_entrega'] ?? null,
                'complemento_entrega'  => $validated['complemento_entrega'] ?? null,
                'bairro_entrega'       => $validated['bairro_entrega'] ?? null,
                'cidade_entrega'       => $validated['cidade_entrega'] ?? null,
                'estado_entrega'       => $validated['estado_entrega'] ?? null,
            ]);

            if ($pontosAplicados > 0) {
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => null,
                    'tipo'               => 'uso',
                    'descricao'          => "Desconto de R$ " . number_format($valorDescontoPontos, 2, ',', '.') . " usando {$pontosAplicados} pontos",
                    'quantidade'         => $pontosAplicados,
                    'created_at'         => now()
                ]);
            }

            $pagoAgora = false;
            $linkPagamento = null;
            $pixQrCode = null;
            if ($validated['forma_pagamento'] === 'online_agora' && !empty($validated['metodo_pagamento'])) {
                $ps = app(PagamentoService::class);
                $ehCartao = $validated['metodo_pagamento'] === 'cartao';
                $cobranca = $ps->criarCobrancaAsaas(
                    \App\Models\Aluguel::find($aluguelId),
                    $validated['metodo_pagamento'],
                    $ps->garantirClienteAsaas($user),
                    $ehCartao ? (int) ($validated['parcelas'] ?? 1) : 1,
                    $ehCartao ? ($validated['cartao'] ?? null) : null,
                    $user,
                    $request->ip()
                );
                $linkPagamento = $cobranca['invoice_url'] ?? null;
                $pixQrCode = $cobranca['pix_qr_code'] ?? null;
                $pagoAgora = !empty($cobranca['aprovado']);
            }

            DB::commit();

            return response()->json([
                'message' => $pagoAgora ? 'Pagamento aprovado! Reserva confirmada.' : 'Reserva efetuada com sucesso e aguardando triagem!',
                'pago' => $pagoAgora,
                'payment_url' => $linkPagamento,
                'pix_qr_code' => $pixQrCode,
                'tipo' => 'reserva_aluguel',
                'aluguel_id' => $aluguelId,
                'valor_total' => $valorTotalFinal,
                'data_entrega_prevista' => $dataInicio->toDateTimeString(),
                'data_devolucao_prevista' => $dataFim->toDateTimeString()
            ], 201);

        } catch (CobrancaRecusadaException $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage(), 'cobranca_recusada' => true], 422);
        } catch (CarteiraAsaasNaoConfiguradaException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Este anfitrião ainda não recebe pagamentos online. Escolha pagar no local.'], 422);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha interna ao criar reserva: ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 💳 PARTE 4: RETORNOS EXTERNOS DO ASAAS (WEBHOOK/CALLBACK)
    // ==========================================

    public function callbackAsaas(Request $request)
    {
        // 👈 O Asaas envia os dados principais através do campo 'payment' e do 'event'
        $evento = $request->input('event');
        $pagamentoData = $request->input('payment');

        // Normalmente mandamos o ID do agendamento no externalReference do Asaas na hora de criar
        $agendamentoId = $pagamentoData['externalReference'] ?? $request->query('external_reference');

        $agendamento = Agendamento::find($agendamentoId);

        if (!$agendamento) {
            return response()->json(['error' => 'Agendamento externo não localizado.'], 404);
        }

        // 👈 O Asaas usa PAYMENT_RECEIVED (Cartão/Pix) ou PAYMENT_CONFIRMED (Boleto)
        if ($evento === 'PAYMENT_RECEIVED' || $evento === 'PAYMENT_CONFIRMED' || $request->query('status') === 'approved') {

            if ($agendamento->status_pagamento !== 'pago_online') {
                DB::transaction(function () use ($agendamento, $pagamentoData, $request) {
                    $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();

                    $agendamento->update([
                        'status' => 'pendente',
                        'status_pagamento' => 'pago_online',
                        'pagamento_id' => $pagamento ? $pagamento->id : null,
                        'codigo_verificacao' => (string) mt_rand(1000, 9999),
                    ]);

                    if ($pagamento) {
                        $pagamento->update([
                            'status' => 'pago',
                            'id_transacao_gateway' => $pagamentoData['id'] ?? $request->payment_id,
                            'metodo_pagamento' => $pagamentoData['billingType'] ?? 'online', // Asaas envia como 'CREDIT_CARD', 'PIX', etc.
                            'data_pagamento' => now(),
                        ]);
                    }
                });
            }
            return response()->json(['success' => 'Pagamento capturado e aprovado!', 'pin_liberado' => true]);
        }

        return response()->json(['status' => $evento ?? 'PENDING', 'message' => 'O status do pagamento mudou, falhou ou está aguardando.']);
    }
}