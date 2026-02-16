<?php


use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\EstabelecimentoController;
use App\Http\Controllers\Api\ServicoController;
use App\Http\Controllers\Api\FuncionarioController;
use App\Http\Controllers\Api\AgendamentoController;
use App\Http\Controllers\Api\AvaliacaoController;
use App\Http\Controllers\Api\PagamentoController;
use App\Http\Controllers\Api\DescontoController;
use App\Http\Controllers\Api\RegraPontuacaoController;
use App\Http\Controllers\Api\HistoricoPontoController;
use App\Http\Controllers\Api\TriagemController;
use App\Http\Controllers\Api\RespostaTriagemController;
use App\Http\Controllers\Api\ContaPagamentoEstabelecimentoController;
use App\Http\Controllers\Api\GamificacaoController;

 // Rotas públicas (não exigem autenticação)
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

 // Rotas protegidas (exigem autenticação via Sanctum)
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/user', function (Request $request) {
        return response()->json($request->user());
    });

    Route::post('/logout', [AuthController::class, 'logout']);


    // Rotas protegidas (exigem que o usuário esteja logado via Sanctum no mobile ou sessão no React)
Route::middleware('auth:sanctum')->group(function () {
    
    // Gera: GET /estabelecimentos, POST /estabelecimentos, GET /estabelecimentos/{id}, PUT/PATCH /estabelecimentos/{id}, DELETE /estabelecimentos/{id}
    Route::apiResource('estabelecimentos', EstabelecimentoController::class);
    
    // Gera: GET /servicos, POST /servicos, GET /servicos/{id}, PUT/PATCH /servicos/{id}, DELETE /servicos/{id}
    Route::apiResource('servicos', ServicoController::class);

});

Route::apiResource('funcionarios', FuncionarioController::class);
Route::apiResource('agendamentos', AgendamentoController::class);
Route::apiResource('avaliacoes', AvaliacaoController::class);

// Rotas da Parte 3 (Financeiro e Gamificação)
Route::apiResource('pagamentos', PagamentoController::class);
Route::apiResource('descontos', DescontoController::class);
Route::apiResource('regras-pontuacao', RegraPontuacaoController::class);
Route::apiResource('historico-pontos', HistoricoPontoController::class);


// Rotas da Parte 4 (Operacional Avançado)
Route::apiResource('triagens', TriagemController::class);
Route::apiResource('respostas-triagem', RespostaTriagemController::class);
Route::apiResource('contas-bancarias', ContaPagamentoEstabelecimentoController::class);
Route::apiResource('gamificacoes', GamificacaoController::class);

});
