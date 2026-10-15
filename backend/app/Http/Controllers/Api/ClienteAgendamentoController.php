<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Pagamento;
use App\Services\Agendamento\VagasServicoService;
use App\Services\CupomService;
use App\Services\PagamentoService;
use App\Services\PontosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;
use Inertia\Inertia;
use Exception;

class ClienteAgendamentoController extends Controller
{
    protected $pagamentoService;


    public function __construct(
        PagamentoService $pagamentoService,
        private CupomService $cupomService
    ) {
        $this->pagamentoService = $pagamentoService;
    }

    public function show(Estabelecimento $estabelecimento, Request $request)
    {
        if (!$estabelecimento->ativo) abort(404, 'Este estabelecimento está fechado.');

        // Compra avulsa de produto (via AgendamentoController::storeProdutoCarrinho):
        // cria um Agendamento "casca" sem serviço, só com os produtos vinculados,
        // e redireciona pra cá com o id para o cliente finalizar o pagamento.
        $pedidoProdutoPendente = null;
        if ($request->filled('agendamento_id')) {
            $pendente = Agendamento::where('id', $request->agendamento_id)
                ->where('usuario_id', Auth::id())
                ->where('estabelecimento_id', $estabelecimento->id)
                ->whereNull('servico_id')
                ->whereIn('status', ['pendente', 'aguardando_pagamento'])
                ->first();

            if ($pendente) {
                $itens = DB::table('itens_aluguel')
                    ->where('agendamento_id', $pendente->id)
                    ->whereNotNull('produto_id')
                    ->get(['id', 'nome', 'quantidade', 'valor_diaria']);

                $pedidoProdutoPendente = [
                    'agendamento_id' => $pendente->id,
                    'valor_total'    => (float) $pendente->valor_final,
                    'itens'          => $itens,
                ];
            }
        }

        return Inertia::render('Agendamentos/Agendar', [
            'estabelecimento' => $estabelecimento->only(['id', 'nome', 'foto_perfil', 'bairro', 'cidade', 'estado', 'telefone']),
            'servicos' => $estabelecimento->servicos()->where('ativo', true)->get(),
            'pedidoProdutoPendente' => $pedidoProdutoPendente,
            // Sócio sem carteira Asaas: só pagamento no local.
            'aceitaPagamentoOnline' => app(\App\Services\PagamentoService::class)->estabelecimentoTemCarteiraAsaas($estabelecimento->id),
            'funcionarios' => \App\Models\Funcionario::where('estabelecimento_id', $estabelecimento->id)->where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'cargo']),
            'cuponsRecomendados' => $this->cupomService->recomendados(Auth::user(), $estabelecimento->id, $estabelecimento->servicos()->where('ativo', true)->pluck('id')->all()),
        ]);
    }

    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'servico_id'       => 'required|exists:servicos,id',
            'data_agendamento' => 'required|date|after_or_equal:today',
            'hora_agendamento' => 'required|string',
            'forma_pagamento'  => 'required|string|in:online_agora,online_depois,presencial',
            'metodo_pagamento' => 'nullable|required_if:forma_pagamento,online_agora|string|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12',
            'desconto_id'      => 'nullable|exists:descontos,id',
            'pontos_utilizados' => 'nullable|integer|min:0',
            'cupom_codigo'     => 'nullable|string|max:60',
            'viagem_id'        => 'nullable|integer|exists:viagens,id',
            'funcionario_id'   => 'nullable|integer',
        ]);

        $dataHoraAgendada = Carbon::parse($validated['data_agendamento'] . ' ' . $validated['hora_agendamento']);
        if ($dataHoraAgendada->isPast()) return back()->withErrors(['hora_agendamento' => 'Não é possível agendar no passado!']);

        $servico = $estabelecimento->servicos()->findOrFail($validated['servico_id']);
        if ($servico->horarioACombinar()) {
            return back()->withErrors(['hora_agendamento' => 'Este serviço é com horário a combinar: fale com o proprietário pelo chat ou telefone para marcar.']);
        }

        $configuracoes = is_string($servico->configuracoes) ? json_decode($servico->configuracoes, true) : ($servico->configuracoes ?? []);
        $funcionarioId = $configuracoes['funcionario_padrao'] ?? null;

        // O cliente pode escolher o profissional; sem escolha vale o padrão do serviço.
        if (!empty($validated['funcionario_id'])) {
            $escolhido = \App\Models\Funcionario::where('id', $validated['funcionario_id'])
                ->where('estabelecimento_id', $estabelecimento->id)->where('ativo', true)->first();
            if (!$escolhido) {
                return back()->withErrors(['funcionario_id' => 'Este profissional não atende neste local.']);
            }
            $funcionarioId = $escolhido->id;
        }
        $aceitaOnline = app(\App\Services\PagamentoService::class)->estabelecimentoTemCarteiraAsaas($estabelecimento->id);
        $tipoPagamentoServico = app(\App\Services\PagamentoService::class)->tipoPagamentoEfetivo($configuracoes['tipo_pagamento'] ?? null, $aceitaOnline);

        if ($validated['forma_pagamento'] !== 'presencial' && !$aceitaOnline) {
            return back()->withErrors(['forma_pagamento' => 'Este local ainda não recebe pagamentos online. Escolha pagar no local.']);
        }

        if ($validated['forma_pagamento'] === 'presencial' && $tipoPagamentoServico === 'online') {
            return back()->withErrors(['forma_pagamento' => 'Este serviço aceita apenas pagamento online.']);
        }

        try {
            app(VagasServicoService::class)->verificar($servico, $validated['data_agendamento'], $validated['hora_agendamento']);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        try {
            DB::beginTransaction();

            $formaEscolhida = $validated['forma_pagamento'];
            $isPresencial = ($formaEscolhida === 'presencial');

            // Valor com a promoção cadastrada no serviço (a tela mostra o mesmo).
            $valorTotal = app(\App\Services\PrecificacaoService::class)->comPromocao((float) $servico->valor, (bool) ($servico->tem_promocao ?? false), $servico->tipo_desconto ?? null, $servico->valor_desconto ?? null);
            $pontosNecessarios = 0;

            if ($request->filled('desconto_id')) {
                $desconto = DB::table('descontos')
                    ->where('id', $request->desconto_id)
                    ->where('estabelecimento_id', $estabelecimento->id)
                    ->where('ativo', true)
                    ->first();

                if ($desconto && $desconto->tipo === 'pontos') {
                    $pontosNecessarios = $desconto->pontos_necessarios ?? 1000;

                    $saldoPontosLocal = DB::table('pontos_usuario_estabelecimento')
                        ->where('usuario_id', Auth::id())
                        ->where('estabelecimento_id', $estabelecimento->id)
                        ->value('total_pontos') ?? 0;

                    if ($saldoPontosLocal < $pontosNecessarios) {
                        return back()->withErrors(['error' => 'Saldo de pontos insuficiente neste estabelecimento para obter este desconto.']);
                    }

                    DB::table('pontos_usuario_estabelecimento')
                        ->where('usuario_id', Auth::id())
                        ->where('estabelecimento_id', $estabelecimento->id)
                        ->decrement('total_pontos', $pontosNecessarios);

                    $valorTotal = max(0, $valorTotal - $desconto->valor);
                }
            }

            // Pontos de fidelidade (saldo GLOBAL, users.pontos_saldo): se o serviço aceita pontos,
            // ou se o cliente é premium (com limite), ver PontosService::limiteDePontos.
            $user = Auth::user();
            $pontosAplicados = 0;
            $valorDescontoPontos = 0.0;
            if ($request->filled('pontos_utilizados')) {
                $pontosAplicados = PontosService::pontosParaPedido($user, $servico, (int) $validated['pontos_utilizados'], $valorTotal);
                if ($pontosAplicados > 0) {
                    $valorDescontoPontos = PontosService::pontosParaValor($pontosAplicados);
                    $valorTotal = max(0, $valorTotal - $valorDescontoPontos);
                }
            }

            // Cupom (App\Models\Cupom) — valida código, aplica desconto e só
            // marca como usado depois que o agendamento é criado com sucesso.
            $cupomAplicado = null;
            $valorDescontoCupom = 0.0;
            if ($request->filled('cupom_codigo')) {
                $cupomAplicado = $this->cupomService->buscarValidoParaUsuario($validated['cupom_codigo'], $user, $estabelecimento->id, $servico->id);
                $valorDescontoCupom = $this->cupomService->calcularDesconto($cupomAplicado, $valorTotal);
                $valorTotal = max(0, $valorTotal - $valorDescontoCupom);
            }

            // Desconto de grupo: se outro membro da mesma viagem colaborativa já
            // reservou este mesmo serviço (dentro do período da viagem), o grupo
            // reservando junto ganha desconto extra — e pontos de bônus mais à frente.
            $viagemDoGrupo = null;
            $descontoGrupo = 0.0;
            $participantesGrupo = 0;
            if ($request->filled('viagem_id')) {
                $viagemCandidata = \App\Models\Viagem::find($validated['viagem_id']);
                if ($viagemCandidata && $viagemCandidata->temMembro($user->id)) {
                    $grupo = app(\App\Services\Viagem\DescontoGrupoService::class)
                        ->calcular($viagemCandidata, $valorTotal, $servico->id, null, $user->id);
                    if ($grupo['elegivel']) {
                        $descontoGrupo = $grupo['desconto'];
                        $participantesGrupo = $grupo['participantes'];
                        $valorTotal = $grupo['valor_final'];
                        $viagemDoGrupo = $viagemCandidata;
                    }
                }
            }

            // Serviço gratuito (ou que zerou com cupom/pontos/desconto): não existe o
            // que cobrar, então não faz sentido gerar PIX/boleto/cartão — a reserva
            // já nasce confirmada, sem passar pelo gateway de pagamento.
            $ehGratuito = $valorTotal <= 0;

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

            if ($pontosNecessarios > 0) {
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'uso',
                    'descricao'          => "Desconto de R$ " . number_format($desconto->valor, 2, ',', '.') . " aplicado via resgate de pontos",
                    'quantidade'         => $pontosNecessarios,
                    'created_at'         => now()
                ]);
            }

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

            // Bônus por reservar em grupo com a viagem: pontos extras, e a reserva já
            // entra sozinha na agenda compartilhada da viagem (sem precisar compartilhar na mão).
            if ($viagemDoGrupo) {
                $pontosBonusGrupo = \App\Services\Viagem\DescontoGrupoService::PONTOS_BONUS;
                $user->increment('pontos_saldo', $pontosBonusGrupo);
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => $user->id,
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'ganho',
                    'descricao'          => "Bônus por reservar em grupo com a viagem \"{$viagemDoGrupo->titulo}\" ({$participantesGrupo} pessoas)",
                    'quantidade'         => $pontosBonusGrupo,
                    'created_at'         => now()
                ]);

                try {
                    app(\App\Services\Viagem\ViagemService::class)
                        ->compartilharReserva($viagemDoGrupo, $user, 'agendamento', $agendamento->id);
                } catch (\Throwable $e) {
                    Log::warning('Falha ao vincular reserva em grupo à viagem: ' . $e->getMessage());
                }
            }

            if ($isPresencial) {
                Pagamento::create([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'gateway_pagamento'  => null,
                    'valor'              => $valorTotal,
                    'taxa'               => round($valorTotal * \App\Support\Taxas::fracao(), 2),
                    'valor_liquido'      => $valorTotal - round($valorTotal * \App\Support\Taxas::fracao(), 2),
                    'status'             => 'pendente',
                    'metodo_pagamento'   => 'presencial',
                ]);
            } elseif ($ehGratuito) {
                Pagamento::create([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'gateway_pagamento'  => null,
                    'valor'              => 0,
                    'taxa'               => 0,
                    'valor_liquido'      => 0,
                    'status'             => 'pago',
                    'metodo_pagamento'   => 'gratuito',
                ]);
            }

            $cobrancaAsaas = null;
            if (!$ehGratuito && $formaEscolhida === 'online_agora') {
                $user = Auth::user();
                $cobrancaAsaas = $this->pagamentoService->criarCobrancaAsaas(
                    $agendamento,
                    $validated['metodo_pagamento'],
                    $user->asaas_customer_id,
                    $validated['parcelas'] ?? 1
                );
            }

            DB::commit();

            $avisoGrupo = $viagemDoGrupo
                ? " Desconto de grupo aplicado: R$ " . number_format($descontoGrupo, 2, ',', '.') . " por vocês {$participantesGrupo} estarem reservando juntos na viagem \"{$viagemDoGrupo->titulo}\"!"
                : '';

            if ($ehGratuito) {
                return redirect()->route('dashboard')->with('success', 'Reserva gratuita confirmada! O seu PIN de segurança foi gerado.' . $avisoGrupo);
            }

            if ($formaEscolhida === 'online_agora' && !empty($cobrancaAsaas['invoice_url'])) {
                return Inertia::location($cobrancaAsaas['invoice_url']);
            }

            if ($formaEscolhida === 'online_depois') {
                return redirect()->route('dashboard')->with('warning', 'Vaga reservada! Pague online pelo painel antes do prazo expirar.' . $avisoGrupo);
            }

            return redirect()->route('dashboard')->with('success', 'Agendamento confirmado! O seu PIN de segurança foi gerado para pagamento no local.' . $avisoGrupo);

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return back()->withErrors($e->errors());
        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Erro no processamento do agendamento: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha ao processar o agendamento no gateway Asaas. Tente novamente.']);
        }
    }

    public function pagarNovamente($id, Request $request)
    {
        $request->validate([
            'metodo_pagamento' => 'required|string|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12'
        ]);

        try {
            $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);
            if (!$agendamento) return back()->with('error', 'Agendamento não encontrado.');
            if ($agendamento->usuario_id != Auth::id()) return back()->with('error', 'Acesso negado.');
            if ($agendamento->status_pagamento === 'pago') return back()->with('success', 'Já está pago!');
            if ($agendamento->status === 'cancelado') return back()->with('error', 'Já foi cancelado.');

            $dataAgendamento = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
            $limite = ($agendamento->created_at ?: now())->diffInHours($dataAgendamento) > 2 ? $dataAgendamento->copy()->subHours(2) : $dataAgendamento;

            if (now()->isAfter($limite)) {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                return back()->with('error', 'Tempo limite expirado. Agendamento cancelado.');
            }

            if (!$agendamento->servico) return back()->with('error', 'Serviço inexistente.');

            $user = Auth::user();

            Pagamento::where('agendamento_id', $agendamento->id)->where('status', 'pendente')->delete();

            $cobrancaAsaas = $this->pagamentoService->criarCobrancaAsaas(
                $agendamento,
                $request->metodo_pagamento,
                $user->asaas_customer_id,
                $request->parcelas ?? 1
            );

            if (empty($cobrancaAsaas['invoice_url'])) {
                return back()->with('error', 'Serviço de faturamento indisponível no momento.');
            }

            return Inertia::location($cobrancaAsaas['invoice_url']);

        } catch (Exception $e) {
            Log::error("Erro ao tentar pagar novamente agendamento #{$id}: " . $e->getMessage());
            return back()->with('error', 'Erro temporário ao gerar link de pagamento. Tente novamente.');
        }
    }

    /**
     * 👉 CANCELAMENTO DE AGENDAMENTO (SERVIÇOS)
     * Regra: Devolve 100% se for até 30min antes. Devolve 98% (2% p/ App) se for depois.
     */
    public function cancelar($id)
    {
        $agendamento = Agendamento::find($id);

        if (!$agendamento) return back()->with('error', 'Agendamento não encontrado.');
        if ($agendamento->usuario_id != Auth::id()) return back()->with('error', 'Você não tem permissão para cancelar este agendamento.');
        if ($agendamento->status === 'cancelado') return back()->with('warning', 'Este agendamento já se encontra cancelado.');

        try {
            // Centralizado em PagamentoService::processarCancelamentoAgendamento
            // (mesma regra usada pelo app mobile): até 30 min antes devolve
            // 100%, depois disso retém a taxa de cancelamento tardio — e o
            // estorno fica registrado na mesma tabela/tela que o admin usa
            // pra acompanhar disputas, não só um status solto no pagamento.
            $resultado = $this->pagamentoService->processarCancelamentoAgendamento($agendamento);
        } catch (Exception $e) {
            Log::error("Erro ao cancelar o agendamento #{$id}: " . $e->getMessage());
            return back()->with('error', $e->getMessage() ?: 'Ocorreu um erro ao tentar cancelar. Tente novamente.');
        }

        return back()->with('success', $resultado['message']);
    }

    /**
     * 👉 CANCELAMENTO DE ALUGUEL (LOCAÇÃO)
     * Regra: Devolve 100% se for até 24 HORAS (1 dia) antes. Devolve 98% se for depois.
     * (O endpoint realmente usado pelo cliente hoje é AgendamentoController::destroyAluguel;
     * este fica aqui por nome/semântica e já delega pra mesma lógica central.)
     */
    public function cancelarAluguel($id)
    {
        $aluguel = Aluguel::find($id);

        if (!$aluguel) return back()->with('error', 'Locação não encontrada.');
        if ($aluguel->locatario_id != Auth::id()) return back()->with('error', 'Permissão negada.');
        if ($aluguel->status === 'cancelado') return back()->with('warning', 'Esta locação já está cancelada.');

        try {
            $resultado = $this->pagamentoService->processarCancelamentoAluguel($aluguel, Auth::id());
        } catch (Exception $e) {
            Log::error("Erro ao cancelar o aluguel #{$id}: " . $e->getMessage());
            return back()->with('error', $e->getMessage() ?: 'Ocorreu um erro ao cancelar. Tente novamente.');
        }

        return back()->with('success', $resultado['message']);
    }
}