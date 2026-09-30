<?php

namespace App\Services\Carteira;

use App\Models\ContaBancariaRepasse;
use App\Models\Provider;
use App\Models\TransferenciaCarteira;
use App\Models\User;
use App\Services\AsaasWalletService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Tudo que mexe no dinheiro da carteira Asaas do proprietário passa por aqui:
 * repasse semanal, repasse antecipado (com taxa Lokyva) e o Pix de R$ 0,01 que
 * valida a conta cadastrada. Toda operação vira uma linha em
 * transferencias_carteira ANTES de falar com o Asaas, então nada some — nem
 * quando dá erro ou o Asaas demora a responder.
 */
class CarteiraService
{
    public function __construct(private AsaasWalletService $asaas) {}

    // ------------------------------------------------------------------ acesso

    /** Só o plano mais caro vê a carteira completa e saca antes do repasse semanal. */
    public function planoLiberaSaque(?User $user): bool
    {
        return $user
            && in_array($user->plano_assinatura, config('carteira.planos_saque'), true)
            && $user->plano_expira_em
            && $user->plano_expira_em->isFuture();
    }

    public function taxaAntecipacao(float $valor): float
    {
        $taxa = $valor * (float) config('carteira.taxa_antecipacao_percentual') / 100;

        return round(max($taxa, (float) config('carteira.taxa_antecipacao_minima')), 2);
    }

    // ------------------------------------------------------------------ painel

    /** Dados da tela "Carteira" do proprietário. */
    public function painel(User $user, ?Provider $provider): array
    {
        $liberado = $this->planoLiberaSaque($user);
        // Repasse automático toda segunda-feira: a próxima é a segunda que vem (nunca hoje).
        $proximoRepasse = \Carbon\Carbon::now()->next(\Carbon\Carbon::MONDAY);
        $base = [
            'proximo_repasse' => $proximoRepasse->toDateString(),
            'proximo_repasse_rotulo' => $proximoRepasse->locale('pt_BR')->translatedFormat('l, d/m'),
            'plano_libera_saque' => $liberado,
            'tem_conta_asaas' => (bool) ($provider && $provider->asaas_api_key),
            'regras' => [
                'taxa_percentual' => (float) config('carteira.taxa_antecipacao_percentual'),
                'taxa_minima' => (float) config('carteira.taxa_antecipacao_minima'),
                'saque_minimo' => (float) config('carteira.saque_minimo'),
            ],
        ];

        if (!$provider) {
            return $base + ['contas' => [], 'historico' => [], 'saldo_asaas' => null, 'extrato_asaas' => [], 'a_repassar' => 0, 'divida' => 0]
                + $this->movimentosVazios();
        }

        $contas = $provider->contasRepasse()->where('ativa', true)->orderByDesc('padrao')->orderBy('id')->get()
            ->map->paraTela()->values();

        $historico = $provider->transferenciasCarteira()->with('conta')
            ->where('tipo', '!=', TransferenciaCarteira::TIPO_VALIDACAO)
            ->latest('id')->limit(30)->get()->map->paraProprietario()->values();

        $base += [
            'contas' => $contas,
            'historico' => $historico,
            'a_repassar' => round((float) DB::table('providers')->where('id', $provider->id)->value('saldo'), 2),
            'divida' => $this->dividaDoUsuario($provider->user_id),
            'saldo_asaas' => null,
            'extrato_asaas' => [],
            'saldo_indisponivel' => false,
        ] + $this->movimentosDoProvider($provider);

        if ($liberado && $provider->asaas_api_key) {
            $saldo = $this->asaas->saldoProvider($provider->asaas_api_key);
            if ($saldo === null) {
                $base['saldo_indisponivel'] = true;
            } else {
                $base['saldo_asaas'] = round((float) ($saldo['balance'] ?? 0), 2);
                $base['extrato_asaas'] = $this->extratoAsaas($provider);
            }
        }

        return $base;
    }

    private function movimentosVazios(): array
    {
        return [
            'resumo' => ['recebido_30_dias' => 0, 'taxas_30_dias' => 0, 'estornado_30_dias' => 0, 'estornado_total' => 0, 'estornos_em_analise' => 0],
            'movimentos' => [],
            'estornos' => [],
        ];
    }

    /**
     * O que o proprietário quer ver na carteira: quanto entrou, quanto a plataforma reteve,
     * o que foi estornado e o que ainda está em análise, mais o histórico dessas movimentações.
     */
    private function movimentosDoProvider(Provider $provider): array
    {
        $desde = now()->subDays(30);
        $extrato = \App\Models\ExtratoProvider::where('provider_id', $provider->id);

        $credito30 = (clone $extrato)->where('tipo', 'credito')->where('created_at', '>=', $desde);
        $estorno = (clone $extrato)->where('tipo', 'estorno');

        $estornos = \App\Models\Estorno::with('cliente:id,name')
            ->where('prestador_id', $provider->user_id)
            ->latest()->limit(10)->get();

        return [
            'resumo' => [
                'recebido_30_dias' => round((float) (clone $credito30)->sum('valor_liquido'), 2),
                'taxas_30_dias' => round((float) (clone $credito30)->sum('taxa_plataforma'), 2),
                'estornado_30_dias' => round(abs((float) (clone $estorno)->where('created_at', '>=', $desde)->sum('valor_liquido')), 2),
                'estornado_total' => round(abs((float) (clone $estorno)->sum('valor_liquido')), 2),
                'estornos_em_analise' => \App\Models\Estorno::where('prestador_id', $provider->user_id)
                    ->whereIn('status', ['PENDENTE', 'EM_ANALISE'])->count(),
            ],
            'movimentos' => (clone $extrato)->latest('id')->limit(20)->get()->map(fn ($m) => [
                'id' => $m->id,
                'tipo' => $m->tipo,
                'descricao' => $m->descricao,
                'valor_bruto' => (float) $m->valor_bruto,
                'taxa' => (float) $m->taxa_plataforma,
                'valor_liquido' => (float) $m->valor_liquido,
                'status' => $m->status,
                'metodo' => $m->metodo_pagamento,
                'data' => optional($m->created_at)->toIso8601String(),
                'data_liberacao' => optional($m->data_liberacao)->toIso8601String(),
            ])->values()->all(),
            'estornos' => $estornos->map(fn ($e) => [
                'id' => $e->id,
                'codigo' => $e->codigo_estorno,
                'status' => $e->status,
                'cliente' => $e->cliente?->name,
                'valor_pago' => (float) $e->valor_pago,
                'valor_estornado' => (float) $e->valor_estornado,
                'motivo' => $e->motivo,
                'data' => optional($e->data_solicitacao ?? $e->created_at)->toIso8601String(),
            ])->values()->all(),
        ];
    }

    /** Movimentações reais da carteira (o "extrato" do Asaas). */
    public function extratoAsaas(Provider $provider, int $limite = 30): array
    {
        $r = $this->chamar($provider->asaas_api_key, 'GET', '/financialTransactions', ['limit' => $limite, 'offset' => 0]);
        if (!$r['ok']) {
            return [];
        }

        return collect($r['json']['data'] ?? [])->map(fn ($m) => [
            'id' => $m['id'] ?? null,
            'valor' => (float) ($m['value'] ?? 0),
            'saldo' => isset($m['balance']) ? (float) $m['balance'] : null,
            'tipo' => $m['type'] ?? null,
            'descricao' => $m['description'] ?? null,
            'data' => $m['date'] ?? null,
        ])->values()->all();
    }

    // ------------------------------------------------------------------ contas

    public function cadastrarConta(Provider $provider, array $dados): ContaBancariaRepasse
    {
        $documento = preg_replace('/\D/', '', (string) $dados['titular_documento']);
        $permitidos = array_filter([
            preg_replace('/\D/', '', (string) $provider->document),
            preg_replace('/\D/', '', (string) $provider->responsible_cpf),
        ]);
        if (!in_array($documento, $permitidos, true)) {
            throw new CarteiraException('Por segurança, só aceitamos contas em nome do titular da sua conta Lokyva (mesmo CPF/CNPJ do cadastro).');
        }

        return DB::transaction(function () use ($provider, $dados, $documento) {
            $primeira = !$provider->contasRepasse()->where('ativa', true)->exists();

            return ContaBancariaRepasse::create([
                'provider_id' => $provider->id,
                'user_id' => $provider->user_id,
                'apelido' => $dados['apelido'],
                'tipo' => $dados['tipo'],
                'pix_key_type' => $dados['tipo'] === 'PIX' ? $dados['pix_key_type'] : null,
                'pix_key' => $dados['tipo'] === 'PIX' ? trim($dados['pix_key']) : null,
                'banco_codigo' => $dados['banco_codigo'] ?? null,
                'banco_nome' => $dados['banco_nome'] ?? null,
                'agencia' => $dados['agencia'] ?? null,
                'conta' => $dados['conta'] ?? null,
                'conta_digito' => $dados['conta_digito'] ?? null,
                'tipo_conta' => $dados['tipo_conta'] ?? null,
                'titular_nome' => $dados['titular_nome'],
                'titular_documento' => $documento,
                'padrao' => $primeira,
            ]);
        });
    }

    /**
     * Espelha a chave Pix do cadastro do provider (usada no repasse semanal) na
     * tabela de contas, para que ela também passe pela validação de R$ 0,01.
     */
    public function sincronizarContaDoCadastro(Provider $provider): ?ContaBancariaRepasse
    {
        if (!$provider->pix_key) {
            return null;
        }

        $existente = $provider->contasRepasse()->where('tipo', 'PIX')->where('pix_key', $provider->pix_key)->first();
        if ($existente) {
            if (!$existente->ativa) {
                $existente->update(['ativa' => true]);
            }
            return $existente;
        }

        $conta = ContaBancariaRepasse::create([
            'provider_id' => $provider->id,
            'user_id' => $provider->user_id,
            'apelido' => 'Chave Pix do cadastro',
            'tipo' => 'PIX',
            'pix_key_type' => $provider->pix_key_type,
            'pix_key' => $provider->pix_key,
            'titular_nome' => $provider->name,
            'titular_documento' => preg_replace('/\D/', '', (string) $provider->document),
            'padrao' => true,
        ]);
        // Só uma conta padrão por proprietário.
        $provider->contasRepasse()->where('id', '!=', $conta->id)->update(['padrao' => false]);

        return $conta;
    }

    public function definirPadrao(ContaBancariaRepasse $conta): void
    {
        DB::transaction(function () use ($conta) {
            ContaBancariaRepasse::where('provider_id', $conta->provider_id)->update(['padrao' => false]);
            $conta->update(['padrao' => true]);
        });
    }

    public function removerConta(ContaBancariaRepasse $conta): void
    {
        $conta->update(['ativa' => false, 'padrao' => false]);
        $proxima = ContaBancariaRepasse::where('provider_id', $conta->provider_id)->where('ativa', true)->orderBy('id')->first();
        if ($proxima && !ContaBancariaRepasse::where('provider_id', $conta->provider_id)->where('padrao', true)->exists()) {
            $proxima->update(['padrao' => true]);
        }
    }

    // ------------------------------------------------------------- validação

    /**
     * Manda R$ 0,01 por Pix (da conta mãe da plataforma) para a conta cadastrada.
     * Se o dinheiro chegar, a conta existe e é real. Usa a chave mestra para não
     * exigir saldo na carteira do proprietário.
     */
    public function validarConta(ContaBancariaRepasse $conta): TransferenciaCarteira
    {
        $provider = $conta->provider;

        $conta->update(['status_validacao' => 'validando']);
        $conta->increment('tentativas_validacao');

        $t = $this->abrir($provider, TransferenciaCarteira::TIPO_VALIDACAO, 'automatico', (float) config('carteira.valor_validacao'), 0, $conta);

        $payload = $this->destinoPayload($conta, $provider) + [
            'value' => (float) config('carteira.valor_validacao'),
            'description' => 'Validação de conta Lokyva',
            'externalReference' => $t->external_reference,
        ];
        $t->update(['payload_enviado' => $payload, 'tentativas' => $t->tentativas + 1]);
        $conta->update(['validacao_transferencia_id' => $t->id]);

        $r = $this->chamar(config('services.asaas.key'), 'POST', '/transfers', $payload);
        $this->tratarRetornoTransferencia($t, $r, transferenciaDaPlataforma: true);

        return $t->fresh();
    }

    // ------------------------------------------------------------ saque

    /**
     * Repasse antecipado: o proprietário tira agora, pagando a taxa Lokyva.
     * Ele informa quanto quer tirar da carteira; recebe esse valor menos a taxa.
     */
    public function sacar(User $user, Provider $provider, ContaBancariaRepasse $conta, float $valor): TransferenciaCarteira
    {
        $valor = round($valor, 2);

        if (!$this->planoLiberaSaque($user)) {
            throw new CarteiraException('O repasse antecipado está disponível no plano Premium Sócio Anual.');
        }
        if ($conta->provider_id !== $provider->id || !$conta->ativa) {
            throw new CarteiraException('Conta de destino não encontrada.');
        }
        if (!$conta->estaValidada()) {
            throw new CarteiraException('Essa conta ainda não foi validada. Assim que o Pix de R$ 0,01 chegar nela, você poderá sacar.');
        }
        if (!$provider->asaas_api_key) {
            throw new CarteiraException('Crie sua conta para receber pagamentos online antes de sacar.');
        }
        if ($this->dividaDoUsuario($provider->user_id) > 0) {
            throw new CarteiraException('Você tem valores pendentes com a plataforma (estornos). O saque antecipado fica liberado quando eles forem quitados no próximo repasse semanal.');
        }

        $minimo = (float) config('carteira.saque_minimo');
        if ($valor < $minimo) {
            throw new CarteiraException('O valor mínimo para repasse antecipado é R$ ' . number_format($minimo, 2, ',', '.') . '.');
        }

        $taxa = $this->taxaAntecipacao($valor);
        $liquido = round($valor - $taxa, 2);
        if ($liquido < 1) {
            throw new CarteiraException('O valor é muito baixo para cobrir a taxa do repasse antecipado.');
        }

        $walletPlataforma = $this->walletPlataforma();
        if (!$walletPlataforma) {
            Log::error('Carteira: wallet da plataforma não configurada (ASAAS_PLATFORM_WALLET_ID); saque antecipado bloqueado.');
            throw new CarteiraException('O repasse antecipado está temporariamente indisponível. Tente novamente mais tarde.');
        }

        $lock = Cache::lock("carteira-saque-{$provider->id}", 60);
        if (!$lock->get()) {
            throw new CarteiraException('Já existe um saque sendo processado. Aguarde alguns segundos.');
        }

        try {
            $saldo = $this->asaas->saldoProvider($provider->asaas_api_key);
            if ($saldo === null) {
                throw new CarteiraException('Não conseguimos consultar seu saldo agora. Tente novamente em instantes.');
            }
            if ($valor > round((float) ($saldo['balance'] ?? 0), 2)) {
                throw new CarteiraException('Você não tem esse saldo disponível na carteira.');
            }

            $t = $this->abrir($provider, TransferenciaCarteira::TIPO_ANTECIPACAO, 'proprietario', $valor, $taxa, $conta);
            $t->update(['taxa_status' => 'pendente']);

            $payload = $this->destinoPayload($conta, $provider) + [
                'value' => $liquido,
                'description' => 'Repasse antecipado Lokyva',
                'externalReference' => $t->external_reference,
            ];
            $t->update(['payload_enviado' => $payload, 'tentativas' => 1]);

            $r = $this->chamar($provider->asaas_api_key, 'POST', '/transfers', $payload);
            $this->tratarRetornoTransferencia($t, $r);
            $t->refresh();

            if ($t->status !== 'falhou') {
                // Tira do saldo do repasse semanal para o mesmo dinheiro não sair duas vezes.
                $abatido = $this->debitarSaldoLocal($provider->id, $valor);
                $t->update(['saldo_local_debitado' => $abatido]);
                $this->cobrarTaxa($t, $provider);
            }

            return $t->fresh();
        } finally {
            $lock->release();
        }
    }

    // ---------------------------------------------------------- repasse semanal

    /**
     * Repasse semanal (ou manual do admin): envia o saldo do ledger local para a
     * conta padrão do proprietário, abatendo antes qualquer dívida de estorno.
     */
    public function repasseSemanal(int $providerId, ?float $valorEspecifico = null, string $origem = 'automatico'): ?TransferenciaCarteira
    {
        $provider = Provider::find($providerId);
        $saldoLocal = (float) DB::table('providers')->where('id', $providerId)->value('saldo');

        if (!$provider || $saldoLocal <= 0) {
            return null;
        }

        $conta = $provider->contasRepasse()->where('ativa', true)->where('padrao', true)->first();
        $temDestino = $conta || ($provider->pix_key && $provider->asaas_api_key);
        if (!$temDestino) {
            return null;
        }

        $bruto = round($valorEspecifico ?? $saldoLocal, 2);
        if ($bruto > $saldoLocal) {
            throw new CarteiraException('O valor solicitado (R$ ' . number_format($bruto, 2, ',', '.') . ') é maior que o saldo disponível na carteira.');
        }

        [$abatidoDivida, $liquido] = $this->abaterDivida($provider->user_id, $bruto);

        $t = $this->abrir($provider, TransferenciaCarteira::TIPO_REPASSE, $origem, $bruto, 0, $conta);
        $t->update(['valor_liquido' => $liquido]);

        if ($conta && $conta->status_validacao === 'falhou') {
            $this->falhar($t, new AsaasErro('conta_invalida', 'Sua conta de recebimento não passou na validação. Atualize os dados para receber o repasse — o saldo continua protegido na carteira.', 'Conta padrão com status_validacao=falhou.'));
            return $t->fresh();
        }

        if ($liquido > 0) {
            $destino = $conta
                ? $this->destinoPayload($conta, $provider)
                : ['pixAddressKey' => $provider->pix_key, 'pixAddressKeyType' => $this->tipoChaveAsaas($provider->pix_key_type), 'operationType' => 'PIX'];

            $payload = $destino + [
                'value' => $liquido,
                'description' => 'Repasse semanal Lokyva',
                'externalReference' => $t->external_reference,
            ];
            $t->update(['payload_enviado' => $payload, 'tentativas' => 1]);

            $r = $this->chamar($provider->asaas_api_key, 'POST', '/transfers', $payload);
            $this->tratarRetornoTransferencia($t, $r);
            $t->refresh();

            if ($t->status === 'falhou') {
                return $t; // nada saiu; o saldo continua intacto para a próxima tentativa
            }
        } else {
            $t->update(['status' => 'concluida', 'nome' => 'Repasse semanal (abatido em dívida)', 'processado_em' => now()]);
        }

        DB::transaction(function () use ($provider, $bruto, $liquido, $abatidoDivida, $t) {
            DB::table('providers')->where('id', $provider->id)->decrement('saldo', $bruto);
            $this->quitarDivida($provider->user_id, $abatidoDivida);
            $t->update(['saldo_local_debitado' => $liquido]);
        });

        Log::info("Repasse provider {$provider->id}: bruto {$bruto}, dívida abatida {$abatidoDivida}, enviado {$liquido}.");

        return $t->fresh();
    }

    // -------------------------------------------------------------- sincronia

    /** Rotina agendada: acompanha transferências em andamento, refaz validações e taxas pendentes. */
    public function sincronizar(): array
    {
        $r = ['atualizadas' => 0, 'validacoes_refeitas' => 0, 'taxas_refeitas' => 0];

        TransferenciaCarteira::where('status', 'processando')->orderBy('id')->limit(100)->get()
            ->each(function (TransferenciaCarteira $t) use (&$r) {
                if ($this->consultar($t)) {
                    $r['atualizadas']++;
                }
            });

        ContaBancariaRepasse::whereIn('status_validacao', ['pendente', 'validando'])
            ->where('ativa', true)->where('tentativas_validacao', '<', 3)
            ->where('updated_at', '<', now()->subMinutes(10))
            ->orderBy('id')->limit(50)->get()
            ->each(function (ContaBancariaRepasse $c) use (&$r) {
                // 'validando' com transferência ainda em andamento: espera o passo acima concluir.
                $t = $c->validacao_transferencia_id ? TransferenciaCarteira::find($c->validacao_transferencia_id) : null;
                if ($t && $t->emAndamento()) {
                    return;
                }
                $this->validarConta($c);
                $r['validacoes_refeitas']++;
            });

        TransferenciaCarteira::where('tipo', TransferenciaCarteira::TIPO_ANTECIPACAO)
            ->whereIn('taxa_status', ['pendente', 'falhou'])
            ->whereIn('status', ['processando', 'concluida'])
            ->where('tentativas', '<', 4)->limit(50)->get()
            ->each(function (TransferenciaCarteira $t) use (&$r) {
                $this->cobrarTaxa($t, $t->provider);
                $r['taxas_refeitas']++;
            });

        return $r;
    }

    /** Pergunta ao Asaas em que pé está uma transferência. */
    public function consultar(TransferenciaCarteira $t): bool
    {
        $chave = $t->tipo === TransferenciaCarteira::TIPO_VALIDACAO ? config('services.asaas.key') : $t->provider?->asaas_api_key;
        if (!$chave) {
            return false;
        }

        if ($t->asaas_transfer_id) {
            $resp = $this->chamar($chave, 'GET', "/transfers/{$t->asaas_transfer_id}");
            if ($resp['ok']) {
                $this->aplicarStatusAsaas($t, $resp['json']);
                return true;
            }
            return false;
        }

        // A chamada original não retornou (timeout): procura pela referência própria.
        $lista = $this->chamar($chave, 'GET', '/transfers', ['limit' => 50, 'offset' => 0]);
        if ($lista['ok']) {
            $achou = collect($lista['json']['data'] ?? [])->firstWhere('externalReference', $t->external_reference);
            if ($achou) {
                $this->aplicarStatusAsaas($t, $achou);
                return true;
            }
            if ($t->created_at->lt(now()->subMinutes(30))) {
                $this->falhar($t, new AsaasErro('nao_confirmada', 'Não recebemos a confirmação dessa transferência. Nenhum valor foi movimentado.', 'Sem retorno do Asaas após 30 minutos e sem registro na listagem de transferências.'));
                return true;
            }
        }

        return false;
    }

    // ---------------------------------------------------------------- internos

    private function abrir(Provider $provider, string $tipo, string $origem, float $valorBruto, float $taxa, ?ContaBancariaRepasse $conta): TransferenciaCarteira
    {
        return TransferenciaCarteira::create([
            'provider_id' => $provider->id,
            'user_id' => $provider->user_id,
            'conta_bancaria_id' => $conta?->id,
            'tipo' => $tipo,
            'nome' => TransferenciaCarteira::NOMES[$tipo],
            'origem' => $origem,
            'valor_bruto' => $valorBruto,
            'taxa_plataforma' => $taxa,
            'valor_liquido' => round($valorBruto - $taxa, 2),
            'status' => 'pendente',
            'taxa_asaas' => 0,
            'taxa_status' => 'nao_aplicavel',
            'saldo_local_debitado' => 0,
            'tentativas' => 0,
            'external_reference' => 'LKV-' . strtoupper(Str::random(14)),
        ]);
    }

    /** Interpreta a resposta do POST /transfers (ou a falta dela). */
    private function tratarRetornoTransferencia(TransferenciaCarteira $t, array $r, bool $transferenciaDaPlataforma = false): void
    {
        if ($r['ok']) {
            $this->aplicarStatusAsaas($t, $r['json']);
            return;
        }

        /** @var AsaasErro $erro */
        $erro = $r['erro'];

        // Validação usa o saldo da conta mãe: se faltar, o problema é nosso, não do usuário.
        if ($transferenciaDaPlataforma && $erro->codigo === 'saldo_insuficiente') {
            $erro = new AsaasErro('saldo_plataforma', 'Estamos concluindo a validação da sua conta. Isso pode levar alguns minutos.', $erro->detalhe);
        }

        if ($r['indefinido']) {
            // Não sabemos se o Asaas recebeu: não dá para afirmar que falhou. A rotina de sincronia decide.
            $t->update([
                'status' => 'processando',
                'erro_codigo' => $erro->codigo,
                'erro_mensagem' => 'Estamos confirmando essa transferência com o banco. Você será avisado do resultado.',
                'erro_detalhe' => $erro->detalhe,
            ]);
            return;
        }

        $this->falhar($t, $erro);
    }

    private function aplicarStatusAsaas(TransferenciaCarteira $t, array $json): void
    {
        $status = strtoupper((string) ($json['status'] ?? ''));

        $t->fill([
            'asaas_transfer_id' => $json['id'] ?? $t->asaas_transfer_id,
            'asaas_status' => $status ?: $t->asaas_status,
            'resposta_asaas' => $json,
            'taxa_asaas' => isset($json['transferFee']) ? (float) $json['transferFee'] : ($t->taxa_asaas ?? 0),
        ]);

        if ($status === 'DONE') {
            $this->concluir($t);
        } elseif (in_array($status, ['FAILED', 'CANCELLED'], true)) {
            $this->falhar($t, AsaasErro::deFalhaAsincrona($json['failReason'] ?? null));
        } else {
            $t->fill(['status' => 'processando', 'erro_codigo' => null, 'erro_mensagem' => null, 'erro_detalhe' => null])->save();
        }
    }

    private function concluir(TransferenciaCarteira $t): void
    {
        $t->fill([
            'status' => 'concluida',
            'processado_em' => now(),
            'erro_codigo' => null, 'erro_mensagem' => null, 'erro_detalhe' => null,
        ])->save();

        if ($t->tipo === TransferenciaCarteira::TIPO_VALIDACAO && $t->conta) {
            $t->conta->update([
                'status_validacao' => 'validada',
                'validada_em' => now(),
                'ultimo_erro_codigo' => null,
                'ultimo_erro_mensagem' => null,
            ]);
        }
    }

    private function falhar(TransferenciaCarteira $t, AsaasErro $erro): void
    {
        $jaFalhou = $t->status === 'falhou';

        $t->fill([
            'status' => 'falhou',
            'processado_em' => now(),
            'erro_codigo' => $erro->codigo,
            'erro_mensagem' => $erro->mensagem,
            'erro_detalhe' => $erro->detalhe,
        ])->save();

        Log::warning("Carteira: transferência #{$t->id} ({$t->tipo}) falhou [{$erro->codigo}] {$erro->detalhe}");

        if ($t->tipo === TransferenciaCarteira::TIPO_VALIDACAO && $t->conta) {
            $conta = $t->conta;
            $conta->update([
                // Erro do nosso lado ou instabilidade: tenta de novo depois. Erro dos dados: usuário precisa corrigir.
                'status_validacao' => ($erro->retentavel() && $conta->tentativas_validacao < 3) ? 'pendente' : 'falhou',
                'ultimo_erro_codigo' => $erro->codigo,
                'ultimo_erro_mensagem' => $erro->mensagem,
            ]);
        }

        if ($jaFalhou) {
            return;
        }

        // A transferência aceita falhou depois: devolve o saldo local e a taxa.
        if ((float) $t->saldo_local_debitado > 0) {
            DB::table('providers')->where('id', $t->provider_id)->increment('saldo', (float) $t->saldo_local_debitado);
            $t->update(['saldo_local_debitado' => 0]);
        }
        if ($t->taxa_status === 'cobrada') {
            $this->devolverTaxa($t);
        }
    }

    private function cobrarTaxa(TransferenciaCarteira $t, Provider $provider): void
    {
        $taxa = (float) $t->taxa_plataforma;
        $wallet = $this->walletPlataforma();
        $t->increment('tentativas');

        if ($taxa <= 0 || !$wallet) {
            $t->update(['taxa_status' => 'falhou', 'erro_detalhe' => trim(($t->erro_detalhe ?? '') . ' Taxa não cobrada: wallet da plataforma indisponível.')]);
            return;
        }

        $r = $this->chamar($provider->asaas_api_key, 'POST', '/transfers', [
            'value' => $taxa,
            'walletId' => $wallet,
            'description' => "Taxa de repasse antecipado Lokyva #{$t->id}",
            'externalReference' => 'TAXA-' . $t->external_reference,
        ]);

        if ($r['ok']) {
            $t->update(['taxa_status' => 'cobrada', 'asaas_taxa_transfer_id' => $r['json']['id'] ?? null]);
            return;
        }

        $t->update([
            'taxa_status' => 'falhou',
            'erro_detalhe' => trim(($t->erro_detalhe ?? '') . ' Taxa Lokyva não cobrada: ' . $r['erro']->detalhe),
        ]);
    }

    private function devolverTaxa(TransferenciaCarteira $t): void
    {
        $provider = $t->provider;
        if (!$provider?->asaas_wallet_id) {
            $t->update(['taxa_status' => 'devolucao_falhou']);
            return;
        }

        $r = $this->chamar(config('services.asaas.key'), 'POST', '/transfers', [
            'value' => (float) $t->taxa_plataforma,
            'walletId' => $provider->asaas_wallet_id,
            'description' => "Devolução da taxa do repasse antecipado #{$t->id}",
            'externalReference' => 'DEV-' . $t->external_reference,
        ]);

        $t->update($r['ok']
            ? ['taxa_status' => 'devolvida']
            : ['taxa_status' => 'devolucao_falhou', 'erro_detalhe' => trim(($t->erro_detalhe ?? '') . ' Devolução da taxa falhou: ' . $r['erro']->detalhe)]);
    }

    /** walletId da conta mãe: do .env, ou descoberto na própria API (cacheado). */
    public function walletPlataforma(): ?string
    {
        if ($configurado = config('carteira.wallet_plataforma')) {
            return $configurado;
        }

        return Cache::remember('asaas.wallet_plataforma', now()->addDay(), function () {
            $r = $this->chamar(config('services.asaas.key'), 'GET', '/wallets/');

            return $r['ok'] ? ($r['json']['data'][0]['id'] ?? null) : null;
        }) ?: null;
    }

    private function destinoPayload(ContaBancariaRepasse $conta, Provider $provider): array
    {
        if ($conta->tipo === 'PIX') {
            return [
                'operationType' => 'PIX',
                'pixAddressKey' => $conta->pix_key,
                'pixAddressKeyType' => $this->tipoChaveAsaas($conta->pix_key_type),
            ];
        }

        $conta_ = [
            'bank' => ['code' => $conta->banco_codigo],
            'accountName' => $conta->apelido,
            'ownerName' => $conta->titular_nome,
            'cpfCnpj' => $conta->titular_documento,
            'agency' => $conta->agencia,
            'account' => $conta->conta,
            'accountDigit' => $conta->conta_digito,
            'bankAccountType' => $conta->tipo_conta ?: 'CONTA_CORRENTE',
        ];
        if ($provider->person_type === 'FISICA' && $provider->birth_date) {
            $conta_['ownerBirthDate'] = date('Y-m-d', strtotime((string) $provider->birth_date));
        }

        return ['operationType' => 'PIX', 'bankAccount' => $conta_];
    }

    private function tipoChaveAsaas(?string $tipo): string
    {
        return $tipo === 'RANDOM' || !$tipo ? 'EVP' : $tipo;
    }

    /** Uma chamada ao Asaas que nunca lança exceção: devolve ok/erro/indefinido. */
    private function chamar(?string $chave, string $metodo, string $caminho, array $dados = []): array
    {
        if (!$chave) {
            return ['ok' => false, 'status' => 0, 'json' => null, 'indefinido' => false,
                'erro' => new AsaasErro('conta_nao_liberada', 'Sua conta de recebimento ainda não está configurada.', 'Chave de API ausente.')];
        }

        $url = rtrim(config('services.asaas.url'), '/') . $caminho;

        try {
            $req = Http::withHeaders(['access_token' => $chave, 'Accept' => 'application/json'])->timeout(20);
            $resp = $metodo === 'GET' ? $req->get($url, $dados) : $req->post($url, $dados);
        } catch (ConnectionException $e) {
            return ['ok' => false, 'status' => 0, 'json' => null, 'indefinido' => true, 'erro' => AsaasErro::deExcecao($e)];
        } catch (\Throwable $e) {
            Log::error('Carteira: erro inesperado ao chamar o Asaas. ' . $e->getMessage());
            return ['ok' => false, 'status' => 0, 'json' => null, 'indefinido' => true, 'erro' => AsaasErro::deExcecao($e)];
        }

        if ($resp->successful()) {
            return ['ok' => true, 'status' => $resp->status(), 'json' => $resp->json() ?? [], 'indefinido' => false, 'erro' => null];
        }

        return [
            'ok' => false,
            'status' => $resp->status(),
            'json' => $resp->json(),
            'indefinido' => $resp->status() >= 500,
            'erro' => AsaasErro::deResposta($resp),
        ];
    }

    // ------------------------------------------------------------ dívida/saldo

    public function dividaDoUsuario(int $userId): float
    {
        return round((float) DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimento_usuario.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('estabelecimento_usuario.usuario_id', $userId)
            ->sum('estabelecimentos.saldo_devedor'), 2);
    }

    /** @return array{0: float, 1: float} [abatido na dívida, líquido a enviar] */
    private function abaterDivida(int $userId, float $bruto): array
    {
        $divida = $this->dividaDoUsuario($userId);
        if ($divida <= 0) {
            return [0.0, $bruto];
        }
        $abatido = min($divida, $bruto);

        return [$abatido, round($bruto - $abatido, 2)];
    }

    /** Abate a dívida nos estabelecimentos do usuário, do primeiro ao último, até esgotar o valor. */
    private function quitarDivida(int $userId, float $valor): void
    {
        if ($valor <= 0) {
            return;
        }

        $estabs = DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimento_usuario.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('estabelecimento_usuario.usuario_id', $userId)
            ->where('estabelecimentos.saldo_devedor', '>', 0)
            ->orderBy('estabelecimentos.id')
            ->select('estabelecimentos.id', 'estabelecimentos.saldo_devedor')->get();

        foreach ($estabs as $e) {
            if ($valor <= 0) {
                break;
            }
            $parte = min((float) $e->saldo_devedor, $valor);
            DB::table('estabelecimentos')->where('id', $e->id)->decrement('saldo_devedor', $parte);
            $valor = round($valor - $parte, 2);
        }
    }

    /** Diminui providers.saldo até o limite do que existe; devolve quanto foi abatido. */
    private function debitarSaldoLocal(int $providerId, float $valor): float
    {
        $saldo = (float) DB::table('providers')->where('id', $providerId)->value('saldo');
        $abater = round(min($valor, max($saldo, 0)), 2);
        if ($abater > 0) {
            DB::table('providers')->where('id', $providerId)->decrement('saldo', $abater);
        }

        return $abater;
    }
}
