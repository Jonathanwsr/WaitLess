<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Assinatura;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use App\Mail\BemVindoAssinaturaMail;

class WebhookController extends Controller
{
    public function mercadopago(Request $request)
    {
        
        Log::info('Webhook Mercado Pago Recebido:', $request->all());

      
        if ($request->type === 'subscription_preapproval') {
            $assinaturaMpId = $request->data['id'];

         
            $assinatura = Assinatura::where('gateway_assinatura_id', $assinaturaMpId)->first();

            if ($assinatura && $assinatura->status === 'pendente') {
               
                $assinatura->update([
                    'status' => 'ativa',
                    'data_inicio' => now(),
                    'data_vencimento' => now()->addMonth()
                ]);

                
                $user = $assinatura->user;
                $user->update([
                    'plano_assinatura' => $assinatura->nome_plano,
                    'plano_expira_em' => now()->addMonth()
                ]);

               
                Mail::to($user->email)->send(new BemVindoAssinaturaMail($user, $assinatura->nome_plano));

                Log::info("Assinatura {$assinatura->id} ATIVADA com sucesso via Webhook.");
            }
        }

       
        return response()->json(['status' => 'sucesso'], 200);
    }
}