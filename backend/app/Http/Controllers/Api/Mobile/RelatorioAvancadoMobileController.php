<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Services\RelatorioAvancadoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Versão mobile (JSON) do relatório avançado do sócio — mesmo conteúdo da
 * página web Relatorios/Avancado.jsx, via App\Services\RelatorioAvancadoService.
 */
class RelatorioAvancadoMobileController extends Controller
{
    public function __construct(private RelatorioAvancadoService $service)
    {
    }

    public function index(Request $request)
    {
        return response()->json($this->service->montar(Auth::user()));
    }
}
