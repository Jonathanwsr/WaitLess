<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EstabelecimentoController;
use App\Http\Controllers\Api\AgendamentoController;
use App\Http\Controllers\Api\ClienteAgendamentoController;
use App\Http\Controllers\Api\ClienteExplorarController;
use App\Http\Controllers\Api\PagamentoController;
use App\Http\Controllers\Api\ServicoController;

use App\Services\MercadoPagoService; 
use App\Http\Controllers\Api\FuncionarioController;
use Illuminate\Foundation\Application; 
use Illuminate\Support\Facades\Route;  
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Rotas Públicas
|--------------------------------------------------------------------------
*/
Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
    ]);
});

/*
|--------------------------------------------------------------------------
| Grupo de Rotas Autenticadas
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified'])->group(function () {
    
    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Perfil
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Estabelecimentos
    Route::get('/estabelecimentos/create', [EstabelecimentoController::class, 'create'])->name('estabelecimentos.create');
    Route::post('/estabelecimentos', [EstabelecimentoController::class, 'store'])->name('estabelecimentos.store');
    Route::put('/estabelecimentos/{estabelecimento}', [EstabelecimentoController::class, 'update'])->name('estabelecimentos.update');
    Route::patch('/estabelecimentos/{estabelecimento}/toggle-status', [EstabelecimentoController::class, 'toggleStatus'])->name('estabelecimentos.toggle-status');
    
    // Fila e Configurações (Aninhadas em Estabelecimentos)
    Route::get('/estabelecimentos/{estabelecimento}/fila', [EstabelecimentoController::class, 'fila'])->name('estabelecimentos.fila');
    Route::get('/estabelecimentos/{estabelecimento}/configuracoes', [EstabelecimentoController::class, 'configuracoes'])->name('estabelecimentos.configuracoes');

    // Agendamentos
    Route::put('/agendamentos/{agendamento}/status', [AgendamentoController::class, 'updateStatus'])->name('agendamentos.status.update');

    // --- Rotas da Visão do CLIENTE ---
    // Acessar a página da loja para agendar
    Route::get('/agendar/{estabelecimento}', [ClienteAgendamentoController::class, 'show'])->name('cliente.agendar');
    
    // Confirmar o agendamento
    Route::post('/agendar/{estabelecimento}', [ClienteAgendamentoController::class, 'store'])->name('cliente.agendar.store');
    Route::post('/agendamento/{agendamento}/pagar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'pagarNovamente'])->name('pagamento.tentar_novamente');

    // Rotas de retorno do Mercado Pago
Route::get('/pagamento/sucesso/{agendamento}', [ClienteAgendamentoController::class, 'pagamentoSucesso'])->name('pagamento.sucesso');
Route::get('/pagamento/falha/{agendamento}', [ClienteAgendamentoController::class, 'pagamentoFalha'])->name('pagamento.falha');
  
Route::post('/agendamento/{id}/cancelar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'cancelar'])->name('cliente.agendamento.cancelar');


// rotas do dashboard cliente
    Route::get('/dashboard', [App\Http\Controllers\Api\DashboardController::class, 'index'])->name('dashboard');

    Route::post('/agendamento/{agendamento}/pagar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'pagarNovamente'])->name('pagamento.tentar_novamente');

Route::post('/pagamento/processar', [App\Http\Controllers\Api\PagamentoController::class, 'processar'])->name('pagamento.processar');
Route::get('/pagamento/status', [ClienteAgendamentoController::class, 'callbackMercadoPago'])->name('pagamento.callback');

    // explorar estabelecimentos
    Route::get('/explorar', [ClienteExplorarController::class, 'index'])->name('cliente.explorar');
    Route::post('/agendamentos/{agendamento}/finalizar', [AgendamentoController::class, 'finalizarComCodigo'])->name('agendamentos.finalizar');

    // Serviços
    Route::post('/estabelecimentos/servicos', [ServicoController::class, 'store'])->name('servicos.store');
    Route::put('/servicos/{servico}', [ServicoController::class, 'update'])->name('servicos.update');
    Route::delete('/servicos/{id}', [ServicoController::class, 'destroy'])->name('servicos.destroy');
    

    // Funcionários
    Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [FuncionarioController::class, 'store'])->name('funcionarios.store');
    Route::put('/funcionarios/{funcionario}', [FuncionarioController::class, 'update'])->name('funcionarios.update');
    Route::delete('/funcionarios/{funcionario}', [FuncionarioController::class, 'destroy'])->name('funcionarios.destroy');

   
   
   
    // Tela da Fila do Estabelecimento
    Route::get('/estabelecimentos/{estabelecimento}/fila', [EstabelecimentoController::class, 'fila'])->name('estabelecimentos.fila');
    
    // Ações na Fila (Botões do dono estabelecimento ou admin/socio)
    Route::patch('/agendamentos/{agendamento}/status', [AgendamentoController::class, 'updateStatus'])->name('agendamentos.update-status');
    Route::patch('/agendamentos/{agendamento}/funcionario', [AgendamentoController::class, 'updateFuncionario'])->name('agendamentos.update-funcionario');

});

require __DIR__.'/auth.php';