<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assinatura;
use App\Services\MercadoPagoAssinaturaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AssinaturaController extends Controller
{
    protected $mpService;

    // Catálogo oficial de preços e planos
    const PLANOS = [
        'plus'         => ['valor' => 9.90,  'tipo' => 'cliente'],
        'basico'       => ['valor' => 20.00, 'tipo' => 'estabelecimento'],
        'profissional' => ['valor' => 49.90, 'tipo' => 'estabelecimento'],
        'premium'      => ['valor' => 99.90, 'tipo' => 'estabelecimento'],
    ];

    public function __construct(MercadoPagoAssinaturaService $mpService)
    {
        $this->mpService = $mpService;
    }

   
    public function assinar(Request $request)
    {
        $request->validate([
            'plano' => 'required|string|in:' . implode(',', array_keys(self::PLANOS))
        ]);

        $user = Auth::user();
        $planoEscolhido = $request->plano;
        $detalhesPlano = self::PLANOS[$planoEscolhido];

      
        $assinaturaAtiva = $user->assinaturas()
            ->where('status', 'ativa')
            ->where('nome_plano', $planoEscolhido)
            ->first();

        if ($assinaturaAtiva) {
            return redirect()->back()->with('warning', 'Você já possui este plano ativo!');
        }

      
        $assinatura = Assinatura::create([
            'user_id' => $user->id,
            'nome_plano' => $planoEscolhido,
            'tipo_publico' => $detalhesPlano['tipo'],
            'valor_mensal' => $detalhesPlano['valor'],
            'status' => 'pendente'
        ]);

        try {
          
            $linkPagamento = $this->mpService->criarLinkAssinatura($assinatura, $user);

            return Inertia::location($linkPagamento);

        } catch (\Exception $e) {
           
            $assinatura->delete();
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}