<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Services\Carteira\AsaasErro;
use App\Services\Carteira\CarteiraService;
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

    public function handle(CarteiraService $carteira)
    {
        $transferencia = $carteira->repasseSemanal((int) $this->providerId);

        if (!$transferencia) {
            return; // sem saldo ou sem destino de repasse
        }

        if ($transferencia->status === 'falhou') {
            // Erro nos dados (chave inválida, conta em análise...): repetir não adianta, o usuário é avisado.
            if (!in_array($transferencia->erro_codigo, AsaasErro::RETENTAVEIS, true)) {
                $this->failed(new Exception($transferencia->erro_detalhe ?: 'Repasse recusado.'));
                return;
            }
            throw new Exception("Repasse #{$transferencia->id} falhou: {$transferencia->erro_codigo}");
        }

        DB::table('extrato_providers')->insert([
            'provider_id'      => $transferencia->provider_id,
            'usuario_id'       => null,
            'origem_type'      => 'App\Models\Provider',
            'origem_id'        => $transferencia->provider_id,
            'tipo'             => 'repasse',
            'valor_bruto'      => $transferencia->valor_bruto,
            'taxa_plataforma'  => 0,
            'valor_liquido'    => $transferencia->valor_bruto * -1,
            'descricao'        => 'Repasse semanal enviado para sua conta bancária via PIX',
            'status'           => 'liberado',
            'codigo_transacao' => 'TRANSFER_' . $transferencia->id,
            'metodo_pagamento' => 'pix',
            'created_at'       => now(),
        ]);
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