<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EstabelecimentoController;
use App\Http\Controllers\Api\AgendamentoController;
use App\Http\Controllers\Api\ClienteAgendamentoController;
use App\Http\Controllers\Api\ClienteExplorarController;
use App\Http\Controllers\Api\PagamentoController;
use App\Http\Controllers\Api\ServicoController;
use App\Http\Controllers\Api\FuncionarioCatalogoController;
use App\Http\Controllers\Api\FuncionarioCarteiraController;
use App\Http\Controllers\Api\CarrinhoController;
use App\Http\Controllers\Api\FuncionarioAusenciaController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\CupomController;
use App\Http\Controllers\Api\FilaController;
use App\Http\Controllers\Api\FuncionarioAreaController;
use App\Services\MercadoPagoService; 
use App\Http\Controllers\Api\MensagemController; 
use App\Http\Controllers\Api\AssinaturaController;
use App\Http\Middleware\CheckAdmin;
use App\Http\Controllers\Api\ClienteCupomController;
use App\Http\Controllers\Api\CarteiraController;
use App\Http\Controllers\Api\FuncionarioController;
use App\Http\Controllers\Api\ItemAluguelController;
use App\Http\Controllers\Api\ContratoController;
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


// funcionário - área de trabalho
 Route::get('/meu-painel', [App\Http\Controllers\Api\FuncionarioAreaController::class, 'index'])->name('funcionario.dashboard');
 Route::patch('/meu-painel/chamar/{id}', [App\Http\Controllers\Api\FuncionarioAreaController::class, 'chamarProximo'])->name('funcionario.chamar');
Route::patch('/meu-painel/cancelar/{id}', [App\Http\Controllers\Api\FuncionarioAreaController::class, 'cancelarEstornar'])->name('funcionario.cancelar');
Route::post('/meu-painel/pausa/{id}', [App\Http\Controllers\Api\FuncionarioAreaController::class, 'togglePausa'])->name('funcionario.pausa');
Route::patch('/meu-painel/pular/{id}', [App\Http\Controllers\Api\FuncionarioAreaController::class, 'pularCliente'])->name('funcionario.pular');

Route::get('/meu-painel/ausencias', [App\Http\Controllers\Api\FuncionarioAusenciaController::class, 'index'])->name('funcionario.ausencias');
Route::post('/meu-painel/ausencias', [App\Http\Controllers\Api\FuncionarioAusenciaController::class, 'store'])->name('funcionario.ausencias.store');
Route::delete('/meu-painel/ausencias/{id}', [App\Http\Controllers\Api\FuncionarioAusenciaController::class, 'destroy'])->name('funcionario.ausencias.destroy');
// Rota para o Gerente Aprovar ou Recusar folgas de funcionários
Route::patch('/equipe/ausencias/{id}/decidir', [App\Http\Controllers\Api\FuncionarioController::class, 'decidirAusencia'])->name('admin.ausencias.decidir');

Route::get('/meu-painel/catalogo', [App\Http\Controllers\Api\FuncionarioCatalogoController::class, 'index'])->name('funcionario.catalogo');

Route::get('/meu-painel/producao', [App\Http\Controllers\Api\FuncionarioCarteiraController::class, 'index'])->name('funcionario.carteira');
Route::post('/meu-painel/producao/fechar-dia', [App\Http\Controllers\Api\FuncionarioCarteiraController::class, 'fecharDia'])->name('funcionario.fechar_dia');
// assminaturas 

Route::post('/assinaturas/nova', [App\Http\Controllers\Api\AssinaturaController::class, 'assinar'])->name('assinatura.nova');
    Route::post('/assinaturas/cancelar', [App\Http\Controllers\Api\AssinaturaController::class, 'cancelar'])->name('assinatura.cancelar'); 


    Route::get('/financeiro/conta', function () {
    return inertia('FinanceiroConta'); 
})->name('financeiro.conta');
    
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
    Route::get('/meus-estabelecimentos', [EstabelecimentoController::class, 'index'])
        ->name('estabelecimentos.index');

        Route::middleware('auth:sanctum')->get('/estabelecimentos/proximos', [DashboardController::class, 'getNearby']);
        // routes/web.php
       Route::get('/home', [DashboardController::class, 'showHome'])->name('home'); // 👈 name('home') minúsculo

    // Estabelecimentos Menssagens

    Route::get('/mensagens', [MensagemController::class, 'index'])->name('mensagens.index');
    
    // 2. Inicia o chat vindo do perfil do cliente e redireciona de imediato
    Route::post('/mensagens/iniciar', [MensagemController::class, 'iniciarConversa'])->name('mensagens.iniciar');
    
    // 3. Abre a tela focada em um ID específico (Alterado para {id} para evitar conflitos no Ziggy)
    Route::get('/mensagens/{id}', [MensagemController::class, 'show'])->name('mensagens.show');
    
    // 4. Salva a mensagem enviada
    Route::post('/mensagens/{id}/enviar', [MensagemController::class, 'enviarMensagem'])->name('mensagens.enviar');
    
    
    // Fila e Configurações (Aninhadas em Estabelecimentos)
   // Ambas as rotas agora chamam o método index do AgendamentoController
Route::get('/fila', [AgendamentoController::class, 'index'])->name('fila.index');
Route::get('/estabelecimentos/{estabelecimento}/fila', [AgendamentoController::class, 'index'])->name('estabelecimentos.fila');
    Route::get('/estabelecimentos/{estabelecimento}/configuracoes', [EstabelecimentoController::class, 'configuracoes'])->name('estabelecimentos.configuracoes');

    // Agendamentos
    Route::put('/agendamentos/{agendamento}/status', [AgendamentoController::class, 'updateStatus'])->name('agendamentos.status.update');


    //RESERVAS
// Criar novo item de locação
    Route::post('/catalogo/itens', [ItemAluguelController::class, 'store'])
        ->name('catalogo.itens.store');

    // Atualizar item existente (Usamos POST por causa do upload das imagens)
    Route::post('/catalogo/itens/{id}', [ItemAluguelController::class, 'update'])
        ->name('catalogo.itens.update');

    // Deletar item
    Route::delete('/catalogo/itens/{id}', [ItemAluguelController::class, 'destroy'])
        ->name('catalogo.itens.destroy');


        Route::get('/api/catalogo/itens', [ItemAluguelController::class, 'index'])
        ->name('api.catalogo.itens');

    // 2. Rota para salvar um novo item
    Route::post('/catalogo/itens', [ItemAluguelController::class, 'store'])
        ->name('catalogo.itens.store');

    // 3. Rota para editar um item existente 
    // (Atenção: Usamos POST em vez de PUT porque envios com ficheiros/imagens no Inertia/Laravel funcionam melhor via POST)
    Route::post('/catalogo/itens/{id}', [ItemAluguelController::class, 'update'])
        ->name('catalogo.itens.update');

    // 4. Rota para apagar um item
    Route::delete('/catalogo/itens/{id}', [ItemAluguelController::class, 'destroy'])
        ->name('catalogo.itens.destroy');


    //Detalhes cliente 
    Route::middleware(['auth'])->group(function () {
    // Rota para ver os detalhes do cliente
    Route::get('/meus-pedidos/agendamento/{id}', [AgendamentoController::class, 'detalhesAgendamento'])
    ->name('agendamentos.detalhes');
    Route::post('/triagens/{id}/salvar-nota', [AgendamentoController::class, 'salvarNotaTriagem'])->name('triagens.salvarNota');
    
    // Rota para criar/remarcar agendamento
    Route::post('/agendamentos/remarcar', [AgendamentoController::class, 'remarcarServico'])->name('agendamentos.remarcar');

    Route::get('/api/servicos/{id}/horarios-disponiveis', [AgendamentoController::class, 'obterHorariosDisponiveis'])->name('servicos.horarios');

  // contratos

  // Tela de Contratos do Lojista
    Route::get('/estabelecimentos/{estabelecimento}/contratos', [ContratoController::class, 'index'])
        ->name('estabelecimentos.contratos');

    // Salvar e Editar os Textos dos Modelos
    Route::post('/estabelecimentos/{estabelecimento}/contratos/template', [ContratoController::class, 'storeTemplate'])
        ->name('contratos.templates.store');
    Route::put('/contratos/template/{id}', [ContratoController::class, 'updateTemplate'])
        ->name('contratos.templates.update');

    // Rota para o cliente ou sistema gerar o contrato via Assinafy
    Route::post('/reservas/{id}/gerar-assinafy', [ContratoController::class, 'gerarEEnviarAssinafy'])
        ->name('reservas.gerar-assinafy');

        Route::post('/webhooks/assinafy', [ContratoController::class, 'webhookAssinafy'])
    ->name('webhooks.assinafy')->withoutMiddleware([\App\Http\Middleware\VerifyCsrfToken::class]);
    

    // Rota para buscar os detalhes de uma Reserva (Aluguel)
    Route::get('/agendamentos/{id}/detalhes', [AgendamentoController::class, 'detalhesAgendamento']);
    Route::get('/alugueis/{id}/detalhes', [AgendamentoController::class, 'detalhesReservaAluguel']);


    Route::get('/minhas-reservas', [AgendamentoController::class, 'indexAlugueis'])
        ->name('cliente.reservas.index');

    // Criação de uma nova reserva/locação com cálculo dinâmico de taxas e pontos
    Route::post('/minhas-reservas/contratar', [AgendamentoController::class, 'storeAluguel'])
        ->name('cliente.reservas.store');

    // Altera datas de uma reserva que ainda não foi paga
    Route::put('/minhas-reservas/alterar/{id}', [AgendamentoController::class, 'updateAluguel'])
        ->name('cliente.reservas.update');

    // Cancela/Apaga uma reserva antes do uso
    Route::delete('/minhas-reservas/cancelar/{id}', [AgendamentoController::class, 'destroyAluguel'])
        ->name('cliente.reservas.destroy');

    // Visualiza os detalhes completos e contratos de uma reserva específica
    Route::get('/minhas-reservas/detalhes/{id}', [AgendamentoController::class, 'showAluguel'])
        ->name('cliente.reservas.show');

    // Dispara o fluxo de assinatura digital D4Sign
    Route::post('/minhas-reservas/gerar-contrato/{id}', [AgendamentoController::class, 'generarEEnviarContrato'])
        ->name('cliente.reservas.contrato');

});

// Rota de Webhook pública (Fora do Middleware Auth para receber respostas da D4Sign)
Route::post('/webhooks/d4sign', [AgendamentoController::class, 'webhookD4Sign'])
    ->name('webhooks.d4sign');

});





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

  Route::get('/funcionarios/{funcionario}/edit', [FuncionarioController::class, 'edit'])->name('funcionarios.edit');
   
   
    // Tela da Fila do Estabelecimento
Route::match(['get', 'post'], '/estabelecimentos/{estabelecimento}/agenda-equipe', [App\Http\Controllers\Api\FilaController::class, 'agendaFuncionarios'])->name('estabelecimentos.agenda-equipe');
 //equipe global (visão do dono/gerente)
Route::get('/minha-equipe', [App\Http\Controllers\Api\FilaController::class, 'equipeGlobal'])->name('equipe.global');
// Rota para atribuir TODOS os clientes em espera a um funcionário específico
Route::post('/estabelecimentos/{estabelecimento}/atribuir-todos', [App\Http\Controllers\Api\AgendamentoController::class, 'atribuirTodosEspera'])->name('estabelecimentos.atribuir-todos');

// agenda dos funcionários (visão do dono/gerente)
Route::get('/estabelecimentos/{estabelecimento}/agenda-equipe', [App\Http\Controllers\Api\FilaController::class, 'agendaFuncionarios'])->name('estabelecimentos.agenda-equipe');
    
    // Ações na Fila (Botões do dono estabelecimento ou admin/socio)
    Route::patch('/agendamentos/{agendamento}/status', [AgendamentoController::class, 'updateStatus'])->name('agendamentos.update-status');
    Route::patch('/agendamentos/{agendamento}/funcionario', [AgendamentoController::class, 'updateFuncionario'])->name('agendamentos.update-funcionario');

    Route::post('/cliente/agendamentos/{id}/avaliar', [App\Http\Controllers\Api\ClienteCupomController::class, 'avaliar'])->name('cliente.agendamento.avaliar');

     Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [FuncionarioController::class, 'store'])->name('funcionarios.store');
    Route::put('/funcionarios/{funcionario}', [FuncionarioController::class, 'update'])->name('funcionarios.update');
    Route::delete('/funcionarios/{funcionario}', [FuncionarioController::class, 'destroy'])->name('funcionarios.destroy');
     Route::get('/funcionarios', [FuncionarioController::class, 'index'])->name('funcionarios.index');

     // Fila e Configurações (Aninhadas em Estabelecimentos)
    Route::get('/estabelecimentos/{estabelecimento}/fila', [EstabelecimentoController::class, 'fila'])->name('estabelecimentos.fila');
    Route::get('/estabelecimentos/{estabelecimento}/configuracoes', [EstabelecimentoController::class, 'configuracoes'])->name('estabelecimentos.configuracoes');
    
    //  Página da Loja (Visão do Dono/Gerente)
    Route::get('/estabelecimentos/{estabelecimento}/loja', [EstabelecimentoController::class, 'loja'])->name('estabelecimentos.loja');

    // --- Rotas do Carrinho ---
    Route::get('/carrinho', [App\Http\Controllers\Api\CarrinhoController::class, 'index'])->name('cliente.carrinho');
    Route::post('/carrinho/adicionar', [App\Http\Controllers\Api\CarrinhoController::class, 'store'])->name('cliente.carrinho.store');
    Route::put('/carrinho/{id}', [App\Http\Controllers\Api\CarrinhoController::class, 'update'])->name('cliente.carrinho.update');
    Route::patch('/carrinho/{id}', [App\Http\Controllers\Api\CarrinhoController::class, 'updatePatch'])->name('cliente.carrinho.patch');
    Route::delete('/carrinho/{id}', [App\Http\Controllers\Api\CarrinhoController::class, 'destroy'])->name('cliente.carrinho.destroy');

    
    
    // ROTAS DE CUPONS / GAMIFICAÇÃO
    Route::post('/estabelecimentos/{estabelecimento}/cupons', [CupomController::class, 'store'])->name('cupons.store');
    Route::put('/cupons/{cupom}', [CupomController::class, 'update'])->name('cupons.update');
    Route::delete('/cupons/{cupom}', [CupomController::class, 'destroy'])->name('cupons.destroy');
    Route::get('/estabelecimentos/{estabelecimento}/marketing', [App\Http\Controllers\Api\EstabelecimentoController::class, 'cupons'])->name('estabelecimentos.cupons');

    // ROTAS DA CARTEIRA E GAMIFICAÇÃO DO CLIENTE
    Route::get('/minha-carteira', [CarteiraController::class, 'index'])->name('cliente.carteira');
    Route::post('/minha-carteira/assinar-plus', [CarteiraController::class, 'assinarPlus'])->name('cliente.assinatura.plus');
     Route::post('/minha-carteira/resgatar/{cupom}', [App\Http\Controllers\Api\CarteiraController::class, 'resgatarCupom'])->name('cliente.resgatar.cupom');

     // Rota para abrir a tela de Mensagens/Sugestões
Route::get('/cliente/mensagens', [ClienteCupomController::class, 'mensagens'])->name('cliente.mensagens');

// Rota POST que o React vai chamar quando o cliente clicar em "Resgatar"
Route::post('/cliente/cupons/{id}/resgatar', [ClienteCupomController::class, 'resgatar'])->name('cliente.resgatar.cupom');

     Route::middleware(['auth', CheckAdmin::class])->group(function () {
    
    Route::get('/admin/assinaturas', [AssinaturaController::class, 'adminIndex'])
        ->name('admin.assinaturas.index');
        
    Route::post('/admin/assinaturas/{id}/cancelar', [AssinaturaController::class, 'adminCancelar'])
        ->name('admin.assinaturas.cancelar');
    });

  

require __DIR__.'/auth.php';