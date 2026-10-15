<?php

namespace App\Services;

use App\Mail\NotaFiscalEmitidaMail;
use App\Models\Assinatura;
use App\Models\CobrancaParcela;
use App\Models\NotaFiscal;
use App\Models\Pagamento;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Emissão automática de Nota Fiscal de Serviço (NFS-e) via Asaas, em três frentes:
 *
 * 1. VENDA: a nota do SÓCIO para o cliente, pelo valor total da venda. Sai da subconta
 *    Asaas do próprio sócio (a venda é dele), com o cliente cadastrado na subconta e a
 *    configuração fiscal do sócio. Automática para o plano Sócio Premium.
 *
 * 2. COMISSÃO: a nota da LOKYVA para o sócio, só pelo valor da taxa de intermediação
 *    (6% em reservas, 1% em produtos, 0,5% em parcelas). Sai da conta principal. É o
 *    documento que comprova que a receita da Lokyva é a comissão, e não o valor da venda,
 *    que vai direto para a carteira do sócio pelo split. Emitida para todo sócio.
 *
 * 3. ASSINATURA: a nota da LOKYVA para quem assina um plano premium.
 *
 * As notas nascem "agendadas" no Asaas e são autorizadas pela prefeitura depois; o status, o
 * número, o PDF e o XML chegam pelo webhook de notas ou pelo comando notas:sincronizar.
 * O e-mail com a nota vai quando ela é autorizada. Estornos cancelam as notas do pagamento.
 *
 * Nada aqui derruba o fluxo de pagamento: toda falha fica registrada na própria nota
 * (ERRO ou NAO_CONFIGURADO), visível na tela de notas fiscais com "Tentar novamente".
 */
class NotaFiscalService
{
    public const VENDA = 'venda';
    public const COMISSAO = 'comissao';
    public const ASSINATURA = 'assinatura';

    private const STATUS_FINAIS = ['AUTORIZADA', 'CANCELADA'];

    // ------------------------------------------------------------------ pagamentos

    /**
     * Pagamento online confirmado: emite a nota da comissão da Lokyva para o sócio e, se ele
     * for Sócio Premium, a nota da venda para o cliente. Devolve a nota de venda (ou null).
     */
    public function emitirParaPagamento(Pagamento $pagamento): ?NotaFiscal
    {
        $this->emitirComissaoDoPagamento($pagamento);

        return $this->emitirVendaDoPagamento($pagamento);
    }

    /** Nota da venda: o sócio emite para o cliente, pela subconta Asaas dele. */
    public function emitirVendaDoPagamento(Pagamento $pagamento): ?NotaFiscal
    {
        if (!$pagamento->id_transacao_gateway || !$pagamento->estabelecimento_id) {
            return null;
        }
        if ($this->jaExiste(['pagamento_id' => $pagamento->id], self::VENDA)) {
            return null;
        }

        $provider = $this->resolverProvider($pagamento->estabelecimento_id);
        if (!$provider || !$provider->asaas_api_key || !$this->elegivel($provider)) {
            return null;
        }

        $valor = $this->valorDe($pagamento);
        $descricao = $this->descreverServico($pagamento);
        $dados = [
            'pagamento_id' => $pagamento->id,
            'provider_id' => $provider->id,
            'usuario_id' => $pagamento->usuario_id,
            'tipo' => self::VENDA,
            'referencia_cobranca' => $pagamento->id_transacao_gateway,
        ];

        if (!$this->temConfiguracaoFiscal($provider)) {
            return $this->registrarFalha($dados, $valor, $descricao, 'NAO_CONFIGURADO',
                'Falta a configuração fiscal: informe o serviço municipal e as alíquotas em Notas fiscais → Configuração fiscal.');
        }

        $cliente = User::find($pagamento->usuario_id);
        $clienteAsaas = $cliente ? $this->clienteNaSubconta($provider, $cliente) : ['erro' => 'Cliente da venda não encontrado.'];
        if (isset($clienteAsaas['erro'])) {
            return $this->registrarFalha($dados, $valor, $descricao, 'ERRO', $clienteAsaas['erro']);
        }

        return $this->emitir(
            apiKey: $provider->asaas_api_key,
            corpo: ['customer' => $clienteAsaas['id'], 'externalReference' => "LKY-VENDA-{$pagamento->id}"] + $this->fiscalDoSocio($provider),
            valor: $valor,
            descricao: $descricao,
            observacoes: $provider->nfse_observacoes ?: 'Venda realizada pela plataforma Lokyva.',
            dados: $dados,
        );
    }

    /** Nota da comissão: a Lokyva emite para o sócio, só pelo valor da taxa de intermediação. */
    public function emitirComissaoDoPagamento(Pagamento $pagamento): ?NotaFiscal
    {
        if (!$pagamento->id_transacao_gateway || !$pagamento->estabelecimento_id || !$this->comissaoAtiva()) {
            return null;
        }
        if ($this->jaExiste(['pagamento_id' => $pagamento->id], self::COMISSAO)) {
            return null;
        }

        $taxa = $this->taxaDe($pagamento);
        if ($taxa < (float) config('notas_fiscais.comissao_valor_minimo', 0.01)) {
            return null;
        }

        $provider = $this->resolverProvider($pagamento->estabelecimento_id);
        if (!$provider) {
            return null;
        }

        $venda = $this->valorDe($pagamento);
        $percentual = $venda > 0 ? round($taxa / $venda * 100, 2) : null;
        $descricao = sprintf(
            'Comissão de intermediação Lokyva%s sobre a venda #%d de R$ %s (%s), em %s.',
            $percentual !== null ? ' (' . $this->porcento($percentual) . ')' : '',
            $pagamento->id,
            number_format($venda, 2, ',', '.'),
            $this->nomeDoQueFoiVendido($pagamento),
            $pagamento->created_at?->format('d/m/Y') ?? now()->format('d/m/Y'),
        );

        return $this->emitirComissao($provider, $taxa, $venda, $percentual, $descricao, [
            'pagamento_id' => $pagamento->id,
            'provider_id' => $provider->id,
            'usuario_id' => $provider->user_id,
            'tipo' => self::COMISSAO,
            'referencia_cobranca' => $pagamento->id_transacao_gateway,
        ], "LKY-COMISSAO-{$pagamento->id}");
    }

    /** Nota da comissão de uma parcela de cobrança paga online (a taxa saiu no split). */
    public function emitirComissaoDaParcela(CobrancaParcela $parcela): ?NotaFiscal
    {
        if (!$parcela->asaas_payment_id || !$this->comissaoAtiva()) {
            return null;
        }
        if ($this->jaExiste(['cobranca_parcela_id' => $parcela->id], self::COMISSAO)) {
            return null;
        }

        $taxa = (float) $parcela->taxa_plataforma;
        if ($taxa < (float) config('notas_fiscais.comissao_valor_minimo', 0.01)) {
            return null;
        }

        $cobranca = $parcela->cobranca;
        $provider = $cobranca ? $this->resolverProvider((int) $cobranca->estabelecimento_id) : null;
        if (!$provider) {
            return null;
        }

        $venda = (float) $parcela->valor;
        $percentual = (float) $cobranca->taxa_percentual ?: ($venda > 0 ? round($taxa / $venda * 100, 2) : null);
        $descricao = sprintf(
            'Comissão de intermediação Lokyva (%s) sobre a parcela %s da cobrança #%d, de R$ %s.',
            $this->porcento((float) $percentual),
            $parcela->numero ?? $parcela->id,
            $cobranca->id,
            number_format($venda, 2, ',', '.'),
        );

        return $this->emitirComissao($provider, $taxa, $venda, $percentual, $descricao, [
            'cobranca_parcela_id' => $parcela->id,
            'provider_id' => $provider->id,
            'usuario_id' => $provider->user_id,
            'tipo' => self::COMISSAO,
            'referencia_cobranca' => $parcela->asaas_payment_id,
        ], "LKY-COMISSAO-PARCELA-{$parcela->id}");
    }

    private function emitirComissao(Provider $provider, float $taxa, float $venda, ?float $percentual, string $descricao, array $dados, string $referencia): NotaFiscal
    {
        $dados += ['valor_operacao' => $venda, 'percentual' => $percentual];

        $masterKey = config('services.asaas.key');
        if (!$masterKey) {
            return $this->registrarFalha($dados, $taxa, $descricao, 'NAO_CONFIGURADO', 'Chave da conta principal do Asaas não configurada.');
        }

        $tomador = $this->socioComoClienteDaPlataforma($provider);
        if (isset($tomador['erro'])) {
            return $this->registrarFalha($dados, $taxa, $descricao, 'ERRO', $tomador['erro']);
        }

        return $this->emitir(
            apiKey: $masterKey,
            corpo: ['customer' => $tomador['id'], 'externalReference' => $referencia] + $this->fiscalDaPlataforma(),
            valor: $taxa,
            descricao: $descricao,
            observacoes: (string) config('notas_fiscais.observacoes'),
            dados: $dados,
        );
    }

    // ------------------------------------------------------------------ assinatura

    /** Nota da Lokyva para o assinante de um plano premium (uma por cobrança da assinatura). */
    public function emitirParaAssinatura(Assinatura $assinatura, User $user): ?NotaFiscal
    {
        if (!$assinatura->fatura_id) {
            return null;
        }
        if (NotaFiscal::where('assinatura_id', $assinatura->id)->where('referencia_cobranca', $assinatura->fatura_id)->exists()) {
            return null;
        }

        $masterKey = config('services.asaas.key');
        if (!$masterKey) {
            return null;
        }

        return $this->emitir(
            apiKey: $masterKey,
            corpo: ['payment' => $assinatura->fatura_id, 'externalReference' => "LKY-ASSINATURA-{$assinatura->id}-{$assinatura->fatura_id}"] + $this->fiscalDaPlataforma(),
            valor: (float) $assinatura->valor_mensal,
            descricao: 'Assinatura Lokyva ' . strtoupper(str_replace('-', ' ', $assinatura->nome_plano)),
            observacoes: 'Assinatura de plano da plataforma Lokyva.',
            dados: [
                'assinatura_id' => $assinatura->id,
                'usuario_id' => $user->id,
                'tipo' => self::ASSINATURA,
                'referencia_cobranca' => $assinatura->fatura_id,
            ],
        );
    }

    // ------------------------------------------------------------------ ciclo de vida

    /** Nova tentativa manual — botão "Tentar novamente" na tela de notas fiscais. */
    public function tentarNovamente(NotaFiscal $nota): NotaFiscal
    {
        $nota->delete();

        $nova = match (true) {
            $nota->tipo === self::ASSINATURA => ($a = Assinatura::find($nota->assinatura_id)) && ($u = User::find($nota->usuario_id))
                ? $this->emitirParaAssinatura($a, $u) : null,
            $nota->tipo === self::COMISSAO && $nota->cobranca_parcela_id => ($p = CobrancaParcela::find($nota->cobranca_parcela_id))
                ? $this->emitirComissaoDaParcela($p) : null,
            $nota->tipo === self::COMISSAO => $nota->pagamento ? $this->emitirComissaoDoPagamento($nota->pagamento) : null,
            default => $nota->pagamento ? $this->emitirVendaDoPagamento($nota->pagamento) : null,
        };

        return $nova ?? $nota;
    }

    /** Estorno total: cancela no Asaas as notas de venda e de comissão daquele pagamento. */
    public function cancelarNotasDoPagamento(Pagamento $pagamento, string $motivo = 'Pagamento estornado ao cliente.'): int
    {
        return $this->cancelar(NotaFiscal::where('pagamento_id', $pagamento->id)->get(), $motivo);
    }

    public function cancelarNotasDaParcela(CobrancaParcela $parcela, string $motivo = 'Parcela estornada ao cliente.'): int
    {
        return $this->cancelar(NotaFiscal::where('cobranca_parcela_id', $parcela->id)->get(), $motivo);
    }

    private function cancelar($notas, string $motivo): int
    {
        $canceladas = 0;
        foreach ($notas as $nota) {
            if ($nota->status === 'CANCELADA') {
                continue;
            }

            // Nunca chegou ao Asaas (erro ou falta de configuração): só encerra, para não ser reemitida.
            if (!$nota->asaas_invoice_id) {
                $nota->update(['status' => 'CANCELADA', 'mensagem_erro' => $motivo]);
                $canceladas++;
                continue;
            }

            try {
                $r = Http::withHeaders(['access_token' => $this->chaveDa($nota)])
                    ->timeout(15)
                    ->post(config('services.asaas.url') . "/invoices/{$nota->asaas_invoice_id}/cancel");

                if ($r->successful()) {
                    // O Asaas pode responder "cancelando" (a prefeitura confirma depois, via sincronização).
                    $status = $this->mapearStatus($r->json('status'));
                    $nota->update(['status' => $status === 'SINCRONIZADA' ? 'SINCRONIZADA' : 'CANCELADA', 'mensagem_erro' => $motivo]);
                    $canceladas++;
                } else {
                    $nota->update(['mensagem_erro' => 'Estorno feito, mas a nota não foi cancelada: ' . ($r->json('errors.0.description') ?? 'erro no Asaas') . '. Cancele manualmente.']);
                }
            } catch (\Throwable $e) {
                Log::warning('Falha ao cancelar nota fiscal: ' . $e->getMessage(), ['nota' => $nota->id]);
                $nota->update(['mensagem_erro' => 'Estorno feito, mas a nota não foi cancelada (falha de comunicação). Cancele manualmente.']);
            }
        }

        return $canceladas;
    }

    /** Aplica os dados de uma nota vindos do Asaas (webhook INVOICE_* ou sincronização). */
    public function atualizarPeloAsaas(array $invoice): ?NotaFiscal
    {
        $nota = !empty($invoice['id']) ? NotaFiscal::where('asaas_invoice_id', $invoice['id'])->first() : null;
        if (!$nota) {
            return null;
        }

        $antes = $nota->status;
        $status = $this->mapearStatus($invoice['status'] ?? null);

        $nota->update(array_filter([
            'status' => $status,
            'numero' => $invoice['number'] ?? null,
            'pdf_url' => $invoice['pdfUrl'] ?? null,
            'xml_url' => $invoice['xmlUrl'] ?? null,
            'mensagem_erro' => $status === 'ERRO' ? ($invoice['statusDescription'] ?? 'A prefeitura recusou a nota.') : null,
            'emitida_em' => $status === 'AUTORIZADA' && !$nota->emitida_em ? now() : null,
        ], fn ($v) => $v !== null));

        if ($status === 'AUTORIZADA' && $antes !== 'AUTORIZADA') {
            $this->notificarPorEmail($nota->fresh());
        }

        return $nota;
    }

    /** Consulta no Asaas as notas ainda em andamento (sem webhook de nota configurado, é isto que as atualiza). */
    public function sincronizarPendentes(int $limite = 100): int
    {
        $notas = NotaFiscal::whereNotNull('asaas_invoice_id')
            ->whereIn('status', ['AGENDADA', 'SINCRONIZADA'])
            ->where('created_at', '>=', now()->subDays(60))
            ->orderBy('updated_at')
            ->limit($limite)
            ->get();

        $atualizadas = 0;
        foreach ($notas as $nota) {
            try {
                $r = Http::withHeaders(['access_token' => $this->chaveDa($nota)])
                    ->timeout(15)
                    ->get(config('services.asaas.url') . "/invoices/{$nota->asaas_invoice_id}");
                if ($r->successful() && $this->atualizarPeloAsaas($r->json() ?? [])) {
                    $atualizadas++;
                }
            } catch (\Throwable $e) {
                Log::warning('Falha ao sincronizar nota fiscal: ' . $e->getMessage(), ['nota' => $nota->id]);
            }
        }

        return $atualizadas;
    }

    // ------------------------------------------------------------------ regras

    /** Nota de venda automática: benefício do plano Sócio Premium (mensal ou anual). */
    public function elegivel(Provider $provider): bool
    {
        $user = $provider->user;

        return $user
            && $user->isPremium()
            && in_array($user->plano_assinatura, ['premium-socio', 'premium-socio-anual'], true);
    }

    public function temConfiguracaoFiscal(Provider $provider): bool
    {
        return (bool) ($provider->nfse_servico_id || ($provider->nfse_servico_codigo && $provider->nfse_servico_nome));
    }

    private function comissaoAtiva(): bool
    {
        return (bool) config('notas_fiscais.comissao_ativa', true);
    }

    private function jaExiste(array $origem, string $tipo): bool
    {
        return NotaFiscal::where($origem)->where('tipo', $tipo)->exists();
    }

    // ------------------------------------------------------------------ Asaas

    /** Chamada ao Asaas + gravação do resultado (sucesso ou falha graciosa). */
    private function emitir(string $apiKey, array $corpo, float $valor, string $descricao, string $observacoes, array $dados): NotaFiscal
    {
        try {
            $response = Http::withHeaders(['access_token' => $apiKey])
                ->timeout(20)
                ->post(config('services.asaas.url') . '/invoices', $corpo + [
                    'serviceDescription' => $descricao,
                    'observations' => $observacoes,
                    'value' => round($valor, 2),
                    'deductions' => 0,
                    'effectiveDate' => now()->toDateString(),
                ]);

            if ($response->successful()) {
                $r = $response->json();
                $status = $this->mapearStatus($r['status'] ?? null);

                $nota = NotaFiscal::create($dados + [
                    'asaas_invoice_id' => $r['id'] ?? null,
                    'numero' => $r['number'] ?? null,
                    'status' => $status,
                    'valor' => round($valor, 2),
                    'descricao_servico' => $descricao,
                    'pdf_url' => $r['pdfUrl'] ?? null,
                    'xml_url' => $r['xmlUrl'] ?? null,
                    'emitida_em' => $status === 'AUTORIZADA' ? now() : null,
                ]);

                if ($status === 'AUTORIZADA') {
                    $this->notificarPorEmail($nota);
                }

                return $nota;
            }

            $erro = $response->json('errors.0.description') ?? $response->body();
            Log::warning('Falha ao emitir nota fiscal via Asaas', ['dados' => $dados, 'erro' => $erro]);

            return $this->registrarFalha($dados, $valor, $descricao, $this->pareceFaltaDeConfiguracao($erro) ? 'NAO_CONFIGURADO' : 'ERRO', $erro);
        } catch (\Throwable $e) {
            Log::error('Erro inesperado ao emitir nota fiscal: ' . $e->getMessage());

            return $this->registrarFalha($dados, $valor, $descricao, 'ERRO', 'Falha de comunicação com o emissor de notas fiscais.');
        }
    }

    private function registrarFalha(array $dados, float $valor, string $descricao, string $status, string $mensagem): NotaFiscal
    {
        return NotaFiscal::create($dados + [
            'status' => $status,
            'valor' => round($valor, 2),
            'descricao_servico' => $descricao,
            'mensagem_erro' => mb_substr($mensagem, 0, 1000),
        ]);
    }

    /** O cliente da venda precisa existir na subconta do sócio: a nota é emitida por ela. */
    private function clienteNaSubconta(Provider $provider, User $cliente): array
    {
        $documento = preg_replace('/\D/', '', (string) $cliente->cpf_cnpj);
        if (strlen($documento) < 11) {
            return ['erro' => 'O cliente não tem CPF/CNPJ no cadastro, então a nota não pode ser emitida.'];
        }

        return $this->garantirCliente(
            "nfse.subconta.{$provider->id}.cliente.{$documento}",
            $provider->asaas_api_key,
            $documento,
            ['name' => $cliente->name, 'email' => $cliente->email, 'cpfCnpj' => $documento, 'notificationDisabled' => true],
        );
    }

    /** O sócio (pelo CNPJ/CPF da carteira) como tomador na conta principal da Lokyva. */
    private function socioComoClienteDaPlataforma(Provider $provider): array
    {
        if ($provider->asaas_cliente_plataforma_id) {
            return ['id' => $provider->asaas_cliente_plataforma_id];
        }

        $documento = preg_replace('/\D/', '', (string) $provider->document);
        if (strlen($documento) < 11) {
            return ['erro' => 'O sócio não tem CNPJ/CPF na carteira, então a nota da comissão não pode ser emitida.'];
        }

        $r = $this->garantirCliente(null, config('services.asaas.key'), $documento, array_filter([
            'name' => $provider->name ?: $provider->user?->name,
            'email' => $provider->email ?: $provider->user?->email,
            'cpfCnpj' => $documento,
            'postalCode' => preg_replace('/\D/', '', (string) $provider->postal_code) ?: null,
            'address' => $provider->address,
            'addressNumber' => $provider->address_number,
            'province' => $provider->province,
            'notificationDisabled' => true,
        ], fn ($v) => $v !== null && $v !== ''));

        if (isset($r['id'])) {
            $provider->forceFill(['asaas_cliente_plataforma_id' => $r['id']])->save();
        }

        return $r;
    }

    /** Procura o cliente pelo documento na conta indicada; cria se não existir. */
    private function garantirCliente(?string $cacheKey, string $apiKey, string $documento, array $dados): array
    {
        if ($cacheKey && ($id = Cache::get($cacheKey))) {
            return ['id' => $id];
        }

        try {
            $http = Http::withHeaders(['access_token' => $apiKey])->timeout(15);
            $base = config('services.asaas.url');

            $id = $http->get("{$base}/customers", ['cpfCnpj' => $documento])->json('data.0.id');
            if (!$id) {
                $criado = $http->post("{$base}/customers", $dados);
                $id = $criado->json('id');
                if (!$id) {
                    return ['erro' => 'Não foi possível cadastrar o tomador da nota no Asaas: ' . ($criado->json('errors.0.description') ?? 'erro desconhecido')];
                }
            }
        } catch (\Throwable $e) {
            return ['erro' => 'Falha de comunicação ao cadastrar o tomador da nota no Asaas.'];
        }

        if ($cacheKey) {
            Cache::forever($cacheKey, $id);
        }

        return ['id' => $id];
    }

    private function fiscalDaPlataforma(): array
    {
        return $this->servicoMunicipal(config('notas_fiscais.servico_id'), config('notas_fiscais.servico_codigo'), config('notas_fiscais.servico_nome'))
            + ['taxes' => array_map(fn ($v) => is_bool($v) ? $v : (float) $v, (array) config('notas_fiscais.impostos'))];
    }

    private function fiscalDoSocio(Provider $p): array
    {
        return $this->servicoMunicipal($p->nfse_servico_id, $p->nfse_servico_codigo, $p->nfse_servico_nome) + [
            'taxes' => [
                'retainIss' => (bool) $p->nfse_retem_iss,
                'iss' => (float) $p->nfse_iss,
                'pis' => (float) $p->nfse_pis,
                'cofins' => (float) $p->nfse_cofins,
                'csll' => (float) $p->nfse_csll,
                'ir' => (float) $p->nfse_ir,
                'inss' => (float) $p->nfse_inss,
            ],
        ];
    }

    private function servicoMunicipal(?string $id, ?string $codigo, ?string $nome): array
    {
        return array_filter([
            'municipalServiceId' => $id ?: null,
            'municipalServiceCode' => $id ? null : ($codigo ?: null),
            'municipalServiceName' => $nome ?: null,
        ]);
    }

    /** Nota de venda usa a chave do sócio; comissão e assinatura, a da conta principal. */
    private function chaveDa(NotaFiscal $nota): ?string
    {
        return $nota->tipo === self::VENDA
            ? $nota->provider?->asaas_api_key
            : config('services.asaas.key');
    }

    // ------------------------------------------------------------------ apoio

    private function notificarPorEmail(NotaFiscal $nota): void
    {
        $email = $nota->usuario?->email ?? $nota->pagamento?->usuario?->email;
        if (!$email) {
            return;
        }

        try {
            Mail::to($email)->queue(new NotaFiscalEmitidaMail($nota));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enviar e-mail de nota fiscal: ' . $e->getMessage());
        }
    }

    /** Resolve o prestador (dono/sócio) de um estabelecimento — mesma lógica usada no split de pagamento. */
    private function resolverProvider(int $estabelecimentoId): ?Provider
    {
        $providerId = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $estabelecimentoId)
            ->value('providers.id');

        return $providerId ? Provider::with('user')->find($providerId) : null;
    }

    private function valorDe(Pagamento $p): float
    {
        return (float) $p->valor_total > 0 ? (float) $p->valor_total : (float) $p->valor;
    }

    private function taxaDe(Pagamento $p): float
    {
        return (float) $p->taxa_plataforma > 0 ? (float) $p->taxa_plataforma : (float) $p->taxa;
    }

    private function porcento(float $valor): string
    {
        return rtrim(rtrim(number_format($valor, 2, ',', ''), '0'), ',') . '%';
    }

    private function nomeDoQueFoiVendido(Pagamento $pagamento): string
    {
        $pagamento->loadMissing(['agendamento.servico', 'agendamento.itemAluguel', 'aluguel.item', 'pedidoEntrega.produto']);

        return $pagamento->agendamento?->servico?->nome
            ?? $pagamento->agendamento?->itemAluguel?->nome
            ?? $pagamento->aluguel?->item?->nome
            ?? $pagamento->pedidoEntrega?->produto?->nome
            ?? 'reserva';
    }

    private function descreverServico(Pagamento $pagamento): string
    {
        $nome = $this->nomeDoQueFoiVendido($pagamento);

        return 'Serviço: ' . ($nome === 'reserva' ? 'Reserva via Lokyva' : $nome);
    }

    private function mapearStatus(?string $statusAsaas): string
    {
        return match ($statusAsaas) {
            'AUTHORIZED' => 'AUTORIZADA',
            'SYNCHRONIZED', 'PROCESSING_CANCELLATION' => 'SINCRONIZADA',
            'CANCELED', 'CANCELLED' => 'CANCELADA',
            'ERROR', 'CANCELLATION_DENIED' => 'ERRO',
            default => 'AGENDADA',
        };
    }

    private function pareceFaltaDeConfiguracao(?string $mensagem): bool
    {
        if (!$mensagem) return false;
        $texto = mb_strtolower($mensagem);

        return str_contains($texto, 'configuração') || str_contains($texto, 'configuracao')
            || str_contains($texto, 'município') || str_contains($texto, 'municipio')
            || str_contains($texto, 'serviço municipal') || str_contains($texto, 'servico municipal')
            || str_contains($texto, 'portal nacional') || str_contains($texto, 'nfs-e nacional') || str_contains($texto, 'emissor nacional');
    }
}
