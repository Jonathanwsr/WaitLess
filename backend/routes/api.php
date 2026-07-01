<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Importações - Web
use App\Http\Controllers\Api\AuthController;
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
use App\Http\Controllers\Api\WebhookController;

// Importações - Mobile
use App\Http\Controllers\Api\Mobile\MobileAuthController;
use App\Http\Controllers\Api\Mobile\MobileHomeController;

/*
|--------------------------------------------------------------------------
| ROTAS PÚBLICAS (NÃO EXIGEM TOKEN)
|--------------------------------------------------------------------------
*/

// Rotas públicas Web
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/webhook/mercadopago', [WebhookController::class, 'mercadopago']);

// Rotas públicas Mobile (Login e Cadastro foram movidos para cá!)
// --- ROTAS PÚBLICAS MOBILE (Coloque isso solto no topo do arquivo) ---
Route::post('/mobile/login', [App\Http\Controllers\Api\Mobile\MobileAuthController::class, 'login']);
Route::post('/mobile/cadastro', [App\Http\Controllers\Api\Mobile\MobileAuthController::class, 'register']);


/*
|--------------------------------------------------------------------------
| ROTAS PROTEGIDAS (EXIGEM ESTAR LOGADO COM TOKEN SANCTUM)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // --- DADOS DO USUÁRIO & LOGOUT ---
    Route::get('/user', function (Request $request) {
        return response()->json($request->user());
    });
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/mobile/logout', [MobileAuthController::class, 'logout']);

    // --- HOME MOBILE (Atualizar Endereço e Lojas) ---
    Route::get('/estabelecimentos/proximos', [MobileHomeController::class, 'getEstabelecimentosProximos']);
    Route::post('/user/update-address', [MobileHomeController::class, 'updateAddress']);
    // Rotas protegidas (o app precisa enviar o Token gerado no login)

    Route::post('/mobile/logout', [MobileAuthController::class, 'logout']);



    Route::get('/agendamentos', [MobileAgendamentoController::class, 'index']);
    Route::put('/agendamentos/{agendamento}/status', [MobileAgendamentoController::class, 'updateStatus']);
    Route::put('/agendamentos/{agendamento}/chamar', [MobileAgendamentoController::class, 'chamar']);
    Route::put('/agendamentos/{agendamento}/adiar', [MobileAgendamentoController::class, 'adiar']);
    Route::put('/agendamentos/{agendamento}/pular', [MobileAgendamentoController::class, 'pularProximo']);
    Route::post('/agendamentos/{id}/finalizar', [MobileAgendamentoController::class, 'finalizarComCodigo']);
    Route::put('/agendamentos/{agendamento}/funcionario', [MobileAgendamentoController::class, 'updateFuncionario']);
    Route::post('/agendamentos/{id}/avaliar', [MobileAgendamentoController::class, 'avaliar']);
    Route::post('/agendamentos/remarcar', [MobileAgendamentoController::class, 'remarcarServico']);

    // 👉 CLIENTES E TRIAGEM
    Route::get('/clientes/{id}/detalhes', [MobileAgendamentoController::class, 'detalheCliente']);
    Route::get('/servicos/{id}/horarios', [MobileAgendamentoController::class, 'obtenerHorariosDisponiveis']);
    Route::put('/triagens/{id}/nota', [MobileAgendamentoController::class, 'salvarNotaTriagem']);

    // 👉 ALUGUÉIS E CONTRATOS SAAS (D4SIGN)
    Route::get('/alugueis', [MobileAgendamentoController::class, 'indexAlugueis']);
    Route::post('/alugueis', [MobileAgendamentoController::class, 'storeAluguel']);
    Route::get('/alugueis/{id}', [MobileAgendamentoController::class, 'showAluguel']);
    Route::put('/alugueis/{id}', [MobileAgendamentoController::class, 'updateAluguel']);
    Route::delete('/alugueis/{id}', [MobileAgendamentoController::class, 'destroyAluguel']);
    Route::post('/alugueis/{id}/contrato', [MobileAgendamentoController::class, 'generarEEnviarContrato']);

    Route::post('/mobile/d4sign/webhook', [MobileAgendamentoController::class, 'webhookD4Sign']);


    // --- RESOURCES PRINCIPAIS ---
    Route::apiResource('estabelecimentos', EstabelecimentoController::class);
    Route::apiResource('servicos', ServicoController::class);
    Route::apiResource('funcionarios', FuncionarioController::class);
    Route::apiResource('agendamentos', AgendamentoController::class);
    Route::apiResource('avaliacoes', AvaliacaoController::class);

    // --- CATÁLOGO DE ITENS ---
    Route::prefix('catalogo/itens')->group(function () {
        Route::get('/', [ServicoController::class, 'indexItens']);
        Route::post('/', [ServicoController::class, 'storeItem']);
        Route::get('/{id}', [ServicoController::class, 'showItem']);
        Route::post('/{id}/update', [ServicoController::class, 'updateItem']);
        Route::delete('/{id}', [ServicoController::class, 'destroyItem']);
    });

    // --- MÓDULO DE LOCAÇÕES ---
    Route::prefix('locacoes')->group(function () {
        Route::get('/', [AgendamentoController::class, 'indexAlugueis']);
        Route::post('/', [AgendamentoController::class, 'storeAluguel']);
        Route::get('/{id}', [AgendamentoController::class, 'showAluguel']);
        Route::patch('/{id}', [AgendamentoController::class, 'updateAluguel']);
        Route::delete('/{id}', [AgendamentoController::class, 'destroyAluguel']);
        Route::post('/{id}/gerar-contrato', [AgendamentoController::class, 'gerarEEnviarContrato']);
    });

    // --- FINANCEIRO E GAMIFICAÇÃO ---
    Route::apiResource('pagamentos', PagamentoController::class);
    Route::apiResource('descontos', DescontoController::class);
    Route::apiResource('regras-pontuacao', RegraPontuacaoController::class);
    Route::apiResource('historico-pontos', HistoricoPontoController::class);

    // --- OPERACIONAL AVANÇADO ---
    Route::apiResource('triagens', TriagemController::class);
    Route::apiResource('respostas-triagem', RespostaTriagemController::class);
    Route::apiResource('contas-bancarias', ContaPagamentoEstabelecimentoController::class);
    Route::apiResource('gamificacoes', GamificacaoController::class);

});
