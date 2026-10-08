<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RelatorioAvancadoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class RelatorioAvancadoController extends Controller
{
    public function __construct(private RelatorioAvancadoService $service)
    {
    }

    public function index(Request $request)
    {
        return Inertia::render('Relatorios/Avancado', $this->service->montar(Auth::user()));
    }
}
