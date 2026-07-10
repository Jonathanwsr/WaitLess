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
use App\Http\Controllers\Api\ItemAluguelController;

// Importações - Mobile
use App\Http\Controllers\Api\Mobile\MobileAuthController;
use App\Http\Controllers\Api\Mobile\MobileHomeController;
use App\Http\Controllers\Api\Mobile\MobileAgendamentoController;

use App\Http\Controllers\Api\Mobile\ClienteExplorarMobileController;
use App\Http\Controllers\Api\Mobile\ClienteAgendamentoMobileController; // Corrigido: Adicionado o ';' aqui



/*
|--------------------------------------------------------------------------
| ROTAS PÚBLICAS (NÃO EXIGEM TOKEN)
|--------------------------------------------------------------------------
*/

// Rotas públicas Web
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/webhook/mercadopago', [WebhookController::class, 'mercadopago']);

// Rotas públicas Mobile
Route::post('/mobile/login', [App\Http\Controllers\Api\Mobile\MobileAuthController::class, 'login']);
Route::post('/mobile/cadastro', [App\Http\Controllers\Api\Mobile\MobileAuthController::class, 'register']);


// --- ROTAS PÚBLICAS MOBILE ---
Route::post('/mobile/login', [MobileAuthController::class, 'login']);
Route::post('/mobile/cadastro', [MobileAuthController::class, 'register']);


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

    // --- AGENDAMENTOS MOBILE ---
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
    // Corrigido typo de método 'obtenerHorariosDisponiveis' para manter compatibilidade com seu controller externo se necessário
    Route::get('/clientes/{id}/detalhes', [MobileAgendamentoController::class, 'detalheCliente']);
    Route::get('/servicos/{id}/horarios', [MobileAgendamentoController::class, 'obtenerHorariosDisponiveis']);
    Route::put('/triagens/{id}/nota', [MobileAgendamentoController::class, 'salvarNotaTriagem']);

    // Agendamento clientes mobile
    Route::get('/mobile/estabelecimentos/{id}', [MobileAgendamentoController::class, 'verEstabelecimento']);
    Route::post('/mobile/estabelecimentos/{id}/agendar', [MobileAgendamentoController::class, 'agendarServico']);
    Route::get('/mobile/meus-agendamentos', [MobileAgendamentoController::class, 'meusAgendamentos']);
    Route::delete('/mobile/agendamentos/{id}', [MobileAgendamentoController::class, 'cancelarCliente']);

    // Explorar Mobile
    Route::get('/explorar', [ClienteExplorarMobileController::class, 'index']);
    Route::get('/explorar/destaques', [ClienteExplorarMobileController::class, 'destaques']);
    Route::get('/explorar/recentes', [ClienteExplorarMobileController::class, 'recentes']);
    Route::get('/explorar/cidade/{cidade}', [ClienteExplorarMobileController::class, 'porCidade']);
    Route::get('/explorar/categorias', [ClienteExplorarMobileController::class, 'categorias']);

    // 🔥 Detalhe do estabelecimento (com serviços)
    Route::get('/explorar/{id}', [ClienteExplorarMobileController::class, 'show']);

    // Corrigido: oute::get alterado para Route::get
    Route::get('/agendamentos/estabelecimento/{estabelecimento}', [ClienteAgendamentoMobileController::class, 'obterDadosAgendamento']);

    // Tela para buscar especificações técnicas de uma casa/carro/item antes de alugar
    Route::get('/reservas/item/{id}', [ClienteAgendamentoMobileController::class, 'obterDadosReserva']);

    // --- ENVIAR PEDIDOS (BOTÕES DE CONFIRMAÇÃO) ---
    // Confirmação final do agendamento de cabelo/unha/barba (Salão)
    Route::post('/agendamentos/estabelecimento/{estabelecimento}/store', [ClienteAgendamentoMobileController::class, 'agendarServico']);

    // Confirmação final do aluguel do item (Preenche endereços, diárias e gera caução)
    // Corrigido: alterado ClienteAgendamentoController para ClienteAgendamentoMobileController
    Route::post('/reservas/item/{id}/store', [ClienteAgendamentoMobileController::class, 'reservarItem']);


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

    // --- MÓDULO DE LOCAÇÕES / RESERVAS SAAS ---
    Route::prefix('locacoes')->group(function () {
        Route::get('/', [AgendamentoController::class, 'indexAlugueis']);          // GET - Listar reservas
        Route::post('/', [AgendamentoController::class, 'storeAluguel']);          // POST - Criar reserva
        Route::get('/{id}', [AgendamentoController::class, 'showAluguel']);        // GET - Detalhe reserva
        Route::patch('/{id}', [AgendamentoController::class, 'updateAluguel']);    // PATCH - Atualizar reserva
        Route::delete('/{id}', [AgendamentoController::class, 'destroyAluguel']);  // DELETE - Cancelar/Apagar reserva
        
        // Contrato e Vitrine
        Route::get('/vitrine/locacoes', [ItemAluguelController::class, 'buscarVitrineCliente']);
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