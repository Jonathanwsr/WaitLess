<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Services\PagamentoService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Exception;

class RealizarRepassePixJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $providerId;
    public $tries = 10;
    public $backoff = 300;

    public function __construct($providerId)
    {
        $this->providerId = $providerId;
    }

    public function handle(PagamentoService $pagamentoService)
    {
        $provider = DB::table('providers')->where('id', $this->providerId)->first();

        if (!$provider || $provider->saldo <= 0) {
            return;
        }

        $sucesso = $pagamentoService->repassarSaldoPixProvedor($provider->id);

        if ($sucesso) {
            DB::table('extrato_providers')->insert([
                'provider_id'      => $provider->id,
                'usuario_id'       => null, 
                'origem_type'      => 'App\Models\Provider',
                'origem_id'        => $provider->id,
                'tipo'             => 'repasse',
                'valor_bruto'      => $provider->saldo,
                'taxa_plataforma'  => 0,
                'valor_liquido'    => $provider->saldo * -1, 
                'descricao'        => 'Repasse semanal enviado para sua conta bancária via PIX',
                'status'           => 'liberado',
                'codigo_transacao' => 'TRANSFER_'.uniqid(),
                'metodo_pagamento' => 'pix',
                'created_at'       => now()
            ]);
        } else {
            throw new Exception("O Asaas recusou a transferência para o Provider ID: {$provider->id}");
        }
    }

    public function failed(Exception $exception)
    {
        $providerInfo = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->where('providers.id', $this->providerId)
            ->select('users.email', 'users.name', 'providers.pix_key') 
            ->first();

        if ($providerInfo && $providerInfo->email) {
            $mensagem = "Olá, {$providerInfo->name}!\n\n"
                      . "Tentamos realizar o repasse automático do seu saldo para a sua chave PIX ({$providerInfo->pix_key}) várias vezes hoje, mas a transferência foi rejeitada pelo banco.\n\n" // 👉 CORRIGIDO AQUI
                      . "Por favor, acesse o painel da sua conta e corrija os seus dados de recebimento PIX. O saldo continuará protegido na sua carteira até a correção.";

            Mail::raw($mensagem, function ($mail) use ($providerInfo) {
                $mail->to($providerInfo->email)
                     ->subject('Erro no seu Repasse PIX - Ação Necessária');
            });
        }
    }
}