<?php

namespace App\Services\Carteira;

use App\Models\Provider;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Abertura da carteira (subconta Asaas) quando o Asaas ainda não libera novas subcontas
 * (código baas_trial_limit_child_account_creation_reached: a conta principal da Lokyva precisa
 * concluir a homologação regulatória). Em vez de o sócio perder o cadastro, os dados ficam salvos
 * como "aguardando liberação" e o comando carteira:abrir-pendentes tenta de novo sozinho.
 */
class AberturaCarteiraService
{
    public const STATUS_AGUARDANDO = 'AGUARDANDO_LIBERACAO';
    public const CODIGO_LIMITE = 'baas_trial_limit_child_account_creation_reached';

    public const MENSAGEM_AGUARDANDO = 'Recebemos os seus dados. O nosso parceiro de pagamentos está liberando novas carteiras e a sua será aberta automaticamente assim que ele liberar — você recebe um e-mail quando estiver ativa. Enquanto isso, use a Lokyva normalmente com pagamento no local.';

    /** Pedido de abertura que o sócio já deixou registrado e ainda não foi aberto. */
    public function pendenteDe(int $userId): ?Provider
    {
        return Provider::where('user_id', $userId)->whereNull('asaas_wallet_id')->where('asaas_status', self::STATUS_AGUARDANDO)->first();
    }

    /** Guarda os dados da carteira para abrir depois (sem walletId: não libera pagamento online ainda). */
    public function salvarPendente(User $user, array $dados): Provider
    {
        $provider = $this->pendenteDe($user->id) ?? new Provider(['user_id' => $user->id]);
        $provider->fill($dados + ['asaas_wallet_id' => null, 'asaas_api_key' => null]);
        $provider->asaas_status = self::STATUS_AGUARDANDO;
        $provider->save();

        return $provider;
    }

    /** Tenta abrir as carteiras que estão aguardando liberação. Devolve quantas abriram. */
    public function tentarPendentes(int $limite = 50): int
    {
        $abertas = 0;

        Provider::whereNull('asaas_wallet_id')
            ->where('asaas_status', self::STATUS_AGUARDANDO)
            ->orderBy('updated_at')
            ->limit($limite)
            ->get()
            ->each(function (Provider $p) use (&$abertas) {
                if ($this->tentarAbrir($p)) {
                    $abertas++;
                }
            });

        return $abertas;
    }

    public function tentarAbrir(Provider $p): bool
    {
        $payload = array_filter([
            'name' => $p->name,
            'email' => $p->email,
            'cpfCnpj' => $p->document,
            'birthDate' => $p->birth_date ? date('Y-m-d', strtotime((string) $p->birth_date)) : null,
            'incomeValue' => $p->income_value !== null ? (float) $p->income_value : null,
            'mobilePhone' => $p->mobile_phone,
            'postalCode' => $p->postal_code,
            'address' => $p->address,
            'addressNumber' => $p->address_number,
            'complement' => $p->complement,
            'province' => $p->province,
            'companyType' => $p->person_type === 'JURIDICA' ? $p->company_type : null,
        ], fn ($v) => $v !== null && $v !== '');

        try {
            $r = Http::withoutRedirecting()->timeout(20)
                ->withHeaders(['access_token' => config('services.asaas.key'), 'Accept' => 'application/json'])
                ->post(config('services.asaas.url') . '/accounts', $payload);
        } catch (\Throwable $e) {
            Log::warning('Carteira pendente: falha de comunicação com o Asaas', ['provider' => $p->id, 'erro' => $e->getMessage()]);
            $p->touch();
            return false;
        }

        $json = $r->json() ?? [];
        if ($r->successful() && !empty($json['walletId'])) {
            $p->forceFill([
                'asaas_wallet_id' => $json['walletId'],
                'asaas_api_key' => $json['apiKey'] ?? null,
                'asaas_status' => $json['status'] ?? 'PENDING',
            ])->save();

            try {
                Mail::to($p->email)->queue(new \App\Mail\NotificacaoTexto(
                    'Sua carteira Lokyva foi ativada',
                    "Olá, {$p->name}!\n\nA sua carteira digital Lokyva foi aberta e já pode receber os pagamentos online das suas vendas.\n\nEquipe Lokyva."
                ));
            } catch (\Throwable $e) {
                Log::warning('Carteira aberta, mas o e-mail de aviso falhou: ' . $e->getMessage());
            }

            return true;
        }

        $codigo = $json['errors'][0]['code'] ?? $json['code'] ?? null;
        if ($codigo === self::CODIGO_LIMITE) {
            $p->touch(); // segue aguardando a liberação do Asaas
            return false;
        }

        // Outro motivo (dado recusado, e-mail/CPF já usados...): para de tentar e deixa registrado.
        $p->forceFill(['asaas_status' => 'ERRO_ABERTURA'])->save();
        Log::error('Carteira pendente recusada pelo Asaas', ['provider' => $p->id, 'resposta' => $json]);

        return false;
    }
}
