<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\ClientePromocaoController;
use Illuminate\Http\Request;

class ClientePromocaoMobileController extends Controller
{
    /**
     * Espelha ClientePromocaoController::index — mesma regra de elegibilidade
     * (vigência, público-alvo, plano necessário), reaproveitada via o método
     * estático compartilhado, só que devolvendo JSON em vez de Inertia.
     */
    public function index(Request $request)
    {
        return response()->json([
            'promocoes' => ClientePromocaoController::montarLista($request->user()),
        ]);
    }
}
