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
use App\Http\Controllers\Api\Mobile\TravelAssistantController;
use App\Http\Controllers\Api\Mobile\CarteiraMobileController;
use App\Http\Controllers\Api\Proprietario\ProviderMobileController;
use App\Http\Controllers\Api\Mobile\Proprietario\CriarServicosReservasController;
use App\Http\Controllers\Api\Mobile\Proprietario\EstabelecimentoController as MobileEstabelecimentoController;
use App\Http\Controllers\Api\Mobile\AssinaturaMobileController;
use App\Http\Controllers\Api\Mobile\MobileAuthController;
use App\Http\Controllers\Api\Mobile\MobileHomeController;
use App\Http\Controllers\Api\Mobile\MobileAgendamentoController;
use App\Http\Controllers\Api\Mobile\EstabelecimentoCatalogoMobileController;
use App\Http\Controllers\Api\Mobile\FavoritoMobileController;
use App\Http\Controllers\Api\Mobile\ClienteExplorarMobileController;
use App\Http\Controllers\Api\Mobile\ClienteAgendamentoMobileController;
use App\Http\Controllers\Api\Mobile\AnfitriaoMobileController;
use App\Http\Controllers\Api\Mobile\CatalogoMobileController;
use App\Http\Controllers\Api\Mobile\PagamentoMobileController; // IMPORTAÇÃO QUE FALTAVA
use App\Http\Controllers\Api\Mobile\Proprietario\DashboardController as ProprietarioDashboard;
use App\Http\Controllers\Api\Mobile\Proprietario\FuncionarioMobileController as FuncionarioMobileController;


/*
|--------------------------------------------------------------------------
| ROTAS PÚBLICAS (NÃO EXIGEM TOKEN)
|--------------------------------------------------------------------------
*/

// Rotas públicas Web
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);


    // Rota para o Webhook do Asaas (POST)
// Recebe os webhooks do Asaas apontando diretamente para o PagamentoController
Route::post('/webhook/asaas', [PagamentoController::class, 'webhookAsaas']);

// Rotas públicas Mobile
Route::post('/mobile/login', [MobileAuthController::class, 'login']);
Route::post('/mobile/register', [MobileAuthController::class, 'register'])->name('mobile.register');
Route::post('/mobile/cadastro', [MobileAuthController::class, 'register']); // Alias de compatibilidade

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
    Route::get('/mobile/me', [MobileAuthController::class, 'me']);
    Route::post('/mobile/logout', [MobileAuthController::class, 'logout']);

    // --- HOME MOBILE (Atualizar Endereço e Lojas) ---
    Route::get('/estabelecimentos/proximos', [MobileHomeController::class, 'getEstabelecimentosProximos']);
    Route::post('/user/update-address', [MobileHomeController::class, 'updateAddress']);
    Route::get('/meus-pontos', [MobileHomeController::class, 'getHistoricoPontos']);
    Route::get('/servicos', [MobileHomeController::class, 'getServicos']);
    Route::get('/minhas-reservas', [MobileHomeController::class, 'getReservas']);


    Route::middleware('auth:sanctum')->prefix('v1/mobile')->group(function () {

    // Dashboard e Dados Gerais
    Route::get('/configuracoes', [ConfiguracoesMobileController::class, 'index']);

    // 1. Estabelecimentos
    Route::post('/estabelecimentos', [ConfiguracoesMobileController::class, 'storeEstabelecimento']);
    Route::post('/estabelecimentos/{estabelecimento}', [ConfiguracoesMobileController::class, 'updateEstabelecimento']);
    Route::patch('/estabelecimentos/{estabelecimento}/toggle-status', [ConfiguracoesMobileController::class, 'toggleStatusEstabelecimento']);

    // 2. Funcionários
    Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [ConfiguracoesMobileController::class, 'storeFuncionario']);
    Route::put('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'updateFuncionario']);
    Route::delete('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'destroyFuncionario']);

    // 3. Serviços
    Route::post('/servicos', [ConfiguracoesMobileController::class, 'storeServico']);
    Route::put('/servicos/{servico}', [ConfiguracoesMobileController::class, 'updateServico']);
    Route::delete('/servicos/{servico}', [ConfiguracoesMobileController::class, 'destroyServico']);

    // 4. Itens de Aluguel
    Route::get('/itens-aluguel', [ConfiguracoesMobileController::class, 'indexItensAluguel']);
    Route::post('/itens-aluguel', [ConfiguracoesMobileController::class, 'storeItemAluguel']);
    Route::post('/itens-aluguel/{item}', [ConfiguracoesMobileController::class, 'updateItemAluguel']); // POST utilizado devido ao envio de imagens no multipart/form-data
    Route::delete('/itens-aluguel/{item}', [ConfiguracoesMobileController::class, 'destroyItemAluguel']);

    // 5. Aluguéis e Reservas
    Route::get('/alugueis', [ConfiguracoesMobileController::class, 'indexAlugueis']);
    Route::post('/alugueis', [ConfiguracoesMobileController::class, 'storeAluguel']);
    Route::get('/alugueis/{aluguel}', [ConfiguracoesMobileController::class, 'showAluguel']);
    Route::put('/alugueis/{aluguel}', [ConfiguracoesMobileController::class, 'updateAluguel']);
    Route::delete('/alugueis/{aluguel}', [ConfiguracoesMobileController::class, 'destroyAluguel']);
});

    // --- AGENDAMENTOS MOBILE ---
    Route::get('/agendamentos', [MobileAgendamentoController::class, 'index']);
    Route::get('/agendamentos/meus', [MobileAgendamentoController::class, 'meusAgendamentos']); 
    Route::get('/agendamentos/{id}', [MobileAgendamentoController::class, 'show']);
    Route::put('/agendamentos/{agendamento}/status', [MobileAgendamentoController::class, 'updateStatus']);
    Route::put('/agendamentos/{agendamento}/chamar', [MobileAgendamentoController::class, 'chamar']);
    Route::put('/agendamentos/{agendamento}/adiar', [MobileAgendamentoController::class, 'adiar']);
    Route::put('/agendamentos/{agendamento}/pular', [MobileAgendamentoController::class, 'pularProximo']);
    Route::post('/agendamentos/{id}/finalizar', [MobileAgendamentoController::class, 'finalizarComCodigo']);
    Route::put('/agendamentos/{agendamento}/funcionario', [MobileAgendamentoController::class, 'updateFuncionario']);
    Route::post('/agendamentos/{id}/avaliar', [MobileAgendamentoController::class, 'avaliar']);
    Route::post('/agendamentos/remarcar', [MobileAgendamentoController::class, 'remarcarServico']);
    Route::delete('/agendamentos/{id}/cancelar', [MobileAgendamentoController::class, 'cancelarCliente']);
    Route::post('/agendar/{estabelecimento}', [MobileAgendamentoController::class, 'agendarServico']);

    // --- CHECKOUT E PAGAMENTOS MOBILE ---
    Route::post('/pagamento/processar', [PagamentoMobileController::class, 'processar']);

    // --- ANFITRIÃO / PROPRIETÁRIO ---
    Route::put('/anfitriao/perfil', [AnfitriaoMobileController::class, 'updatePerfil']);

    // --- CLIENTES E TRIAGEM ---
    Route::get('/clientes/{id}/detalhes', [MobileAgendamentoController::class, 'detalheCliente']);
    Route::get('/servicos/{id}/horarios', [MobileAgendamentoController::class, 'obtenerHorariosDisponiveis']);
    Route::put('/triagens/{id}/nota', [MobileAgendamentoController::class, 'salvarNotaTriagem']);
    Route::post('/checkout/misto', [App\Http\Controllers\Api\Mobile\MobileAgendamentoController::class, 'checkoutMisto']);

    Route::get('/catalogo/servicos', [App\Http\Controllers\Api\Mobile\MobileAgendamentoController::class, 'listarServicosCatalogo']);
        Route::get('/alugueis/itens', [App\Http\Controllers\Api\Mobile\MobileAgendamentoController::class, 'listarItensAluguelCatalogo']);
        
        // Rota de horários
        Route::get('/horarios-disponiveis/{id}', [App\Http\Controllers\Api\Mobile\MobileAgendamentoController::class, 'obtenerHorariosDisponiveis']);

    // --- EXPLORAR MOBILE ---
    Route::get('/explorar', [ClienteExplorarMobileController::class, 'index']);
    Route::get('/explorar/destaques', [ClienteExplorarMobileController::class, 'destaques']);
    Route::get('/explorar/recentes', [ClienteExplorarMobileController::class, 'recentes']);
    Route::get('/explorar/cidade/{cidade}', [ClienteExplorarMobileController::class, 'porCidade']);
    Route::get('/explorar/categorias', [ClienteExplorarMobileController::class, 'categorias']);
    Route::get('/explorar/{id}', [ClienteExplorarMobileController::class, 'show']);


    Route::post('/servicos', [CriarServicosReservasController::class, 'storeServico']);
    Route::post('/servicos/{id}', [CriarServicosReservasController::class, 'updateServico']); // Usando POST com _method=PUT se for enviar arquivos via FormData
    Route::delete('/servicos/{id}', [CriarServicosReservasController::class, 'destroyServico']);


    // ============================================
    // ROTAS DE RESERVAS / ITENS DE ALUGUEL
    // ============================================
    Route::get('/reservas-itens', [CriarServicosReservasController::class, 'indexItens']);
    Route::get('/reservas-itens/{id}', [CriarServicosReservasController::class, 'showItem']);
    Route::post('/reservas-itens', [CriarServicosReservasController::class, 'storeItem']);
    Route::post('/reservas-itens/{id}', [CriarServicosReservasController::class, 'updateItem']); // Usando POST com _method=PUT para upload de imagens no mobile
    Route::delete('/reservas-itens/{id}', [CriarServicosReservasController::class, 'destroyItem']);

    Route::get('/v1/funcionarios', [FuncionarioMobileController::class, 'index']);
    Route::post('/v1/funcionarios', [FuncionarioMobileController::class, 'store']);
    Route::get('/v1/funcionarios/{id}', [FuncionarioMobileController::class, 'show']);
    Route::put('/v1/funcionarios/{id}', [FuncionarioMobileController::class, 'update']);
    Route::delete('/v1/funcionarios/{id}', [FuncionarioMobileController::class, 'destroy']);

  

Route::middleware('auth:sanctum')->group(function () {
    
    // Rota para o App Mobile buscar os estabelecimentos do usuário logado (Dropdown/Select)
    Route::get('/mobile/estabelecimentos', [ProviderMobileController::class, 'getEstabelecimentos']);

    // Rotas de perfil financeiro/provedor para mobile
    Route::get('/mobile/provider', [ProviderMobileController::class, 'show']);
    Route::post('/mobile/provider', [ProviderMobileController::class, 'store']);
    Route::put('/mobile/provider', [ProviderMobileController::class, 'update']);

});
    
    // Decisão de Folgas / Ausências
    Route::post('/v1/ausencias/{id}/decidir', [FuncionarioMobileController::class, 'decidirAusencia']);

    Route::get('/agendamentos/estabelecimento/{estabelecimento}', [ClienteAgendamentoMobileController::class, 'obterDadosAgendamento']);
    Route::get('/reservas/item/{id}', [ClienteAgendamentoMobileController::class, 'obterDadosReserva']);
    Route::post('/agendamentos/estabelecimento/{estabelecimento}/store', [ClienteAgendamentoMobileController::class, 'agendarServico']);
    Route::post('/reservas/item/{id}/store', [ClienteAgendamentoMobileController::class, 'reservarItem']);

    // --- ROTAS PREFIXADAS /MOBILE ---
    Route::prefix('mobile')->group(function () {
        Route::get('/favoritos', [FavoritoMobileController::class, 'index']);
        Route::post('/favoritos/toggle', [FavoritoMobileController::class, 'toggleFavorito']);
        Route::get('/catalogo/servicos/{id}', [CatalogoMobileController::class, 'detalhesServico']);
   Route::get('/catalogo/estabelecimentos/{id}', [AnfitriaoMobileController::class, 'getPerfil']);

   Route::get('/estabelecimentos/{id}/catalogo', [CatalogoMobileController::class, 'perfilEstabelecimento']);
    
    // Rota para ver os detalhes de um serviço específico
    Route::get('/servicos/{id}', [CatalogoMobileController::class, 'detalhesServico']);

    // Rotas para o fluxo de Fila em Tempo Real
Route::get('/agendamentos/{id}/fila', [MobileAgendamentoController::class, 'statusFila']);
Route::post('/agendamentos/{id}/sair-fila', [MobileAgendamentoController::class, 'sairDaFila']);
Route::get('/agendamentos/{id}/checkout', [App\Http\Controllers\Api\Mobile\PagamentoMobileController::class, 'detalhesCheckout']);
        Route::get('/estabelecimentos/{id}', [MobileAgendamentoController::class, 'verEstabelecimento']);
        Route::post('/estabelecimentos/{id}/agendar', [MobileAgendamentoController::class, 'agendarServico']);
        Route::get('/meus-agendamentos', [MobileAgendamentoController::class, 'meusAgendamentos']);
        Route::delete('/agendamentos/{id}', [MobileAgendamentoController::class, 'cancelarCliente']);
        Route::get('/estabelecimentos/{id}/catalogo', [EstabelecimentoCatalogoMobileController::class, 'show']);
        Route::post('/pedidos/sacola', [EstabelecimentoCatalogoMobileController::class, 'criarPedidoSacola']);


        Route::middleware('auth:sanctum')->prefix('proprietario')->group(function () { // <-- Corrigido aqui de 'mobile/proprietario' para 'proprietario'
    
    Route::get('/dashboard', [ProprietarioDashboard::class, 'index']); // <-- ROTA DO DASHBOARD MOVIDA PARA CÁ
    
    Route::post('/estabelecimentos', [MobileEstabelecimentoController::class, 'store']);
    Route::delete('/estabelecimentos/{id}', [MobileEstabelecimentoController::class, 'destroy']);

    Route::post('/estabelecimentos/{id}/update', [MobileEstabelecimentoController::class, 'update']);
    
    Route::delete('/estabelecimentos/{id}', [MobileEstabelecimentoController::class, 'destroy']);
    Route::patch('/estabelecimentos/{id}/status', [MobileEstabelecimentoController::class, 'toggleStatus']);




    // Rota para buscar todos os dados de configurações (Mobile Carregamento Inicial)
    Route::get('/configuracoes', [ConfiguracoesMobileController::class, 'index']);

    // ==========================================
    // 1. ESTABELECIMENTO (PERFIL)
    // ==========================================
    Route::put('/estabelecimentos/{estabelecimento}', [ConfiguracoesMobileController::class, 'updateEstabelecimento']);
    Route::patch('/estabelecimentos/{estabelecimento}/toggle-status', [ConfiguracoesMobileController::class, 'toggleStatusEstabelecimento']);

    // ==========================================
    // 2. FUNCIONÁRIOS (EQUIPE)
    // ==========================================
    Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [ConfiguracoesMobileController::class, 'storeFuncionario']);
    Route::put('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'updateFuncionario']);
    Route::delete('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'destroyFuncionario']);

    // ==========================================
    // 3. SERVIÇOS (CATÁLOGO)
    // ==========================================
    Route::post('/servicos', [ConfiguracoesMobileController::class, 'storeServico']);
    
    Route::put('/servicos/{servico}', [ConfiguracoesMobileController::class, 'updateServico']);
    Route::delete('/servicos/{servico}', [ConfiguracoesMobileController::class, 'destroyServico']);

    // ==========================================
    // 4. RESERVAS / LOCAÇÕES (SAAS MÓDULO)
    // ==========================================
    // Rota GET que você usa no React via fetch('/api/catalogo/itens')
    Route::get('/catalogo/itens', [ConfiguracoesMobileController::class, 'indexItensAluguel']); 
    Route::post('/itens-aluguel', [ConfiguracoesMobileController::class, 'storeItemAluguel']);
    Route::put('/itens-aluguel/{item}', [ConfiguracoesMobileController::class, 'updateItemAluguel']);
    Route::delete('/itens-aluguel/{item}', [ConfiguracoesMobileController::class, 'destroyItemAluguel']);
});




        Route::post('/save-push-token', function (\Illuminate\Http\Request $request) {
    $request->validate(['token' => 'required|string']);
    $user = \Illuminate\Support\Facades\Auth::user();
    $user->update(['expo_push_token' => $request->token]);
    return response()->json(['status' => 'success']);
});

        Route::get('/minha-carteira', [CarteiraMobileController::class, 'index']);
Route::post('/minha-carteira/saque', [CarteiraMobileController::class, 'solicitarSaque']);
Route::post('/minha-carteira/fechar-dia', [CarteiraMobileController::class, 'fecharDia']);
Route::post('/minha-carteira/assinar-plus', [CarteiraMobileController::class, 'assinarPlus']);
Route::post('/minha-carteira/resgatar/{id}', [CarteiraMobileController::class, 'resgatarCupom']);

// --- CARRINHO / SACOLA ---
    Route::get('/carrinho', [CarrinhoMobileController::class, 'index']);
    Route::post('/carrinho', [CarrinhoMobileController::class, 'store']);
    Route::put('/carrinho/{id}', [CarrinhoMobileController::class, 'update']);
    Route::delete('/carrinho/{id}', [CarrinhoMobileController::class, 'destroy']);

    Route::post('/carrinho/checkout', [CarrinhoMobileController::class, 'gerarCheckout']);

Route::post('/assinaturas/assinar', [AssinaturaMobileController::class, 'assinar']);
Route::post('/assinaturas/cancelar', [AssinaturaMobileController::class, 'cancelar']);
Route::put('/assinaturas/dados-financeiros', [AssinaturaMobileController::class, 'atualizarDadosFinanceiros']);

Route::get('/assinaturas/status', [AssinaturaMobileController::class, 'status']);


    });

    // --- ALUGUÉIS E LOCAÇÕES ---
    Route::get('/alugueis', [MobileAgendamentoController::class, 'indexAlugueis']);
    Route::post('/alugueis', [MobileAgendamentoController::class, 'storeAluguel']);
    Route::get('/alugueis/{id}', [MobileAgendamentoController::class, 'showAluguelMobile']);
    Route::put('/alugueis/{id}', [MobileAgendamentoController::class, 'updateAluguel']);
    Route::delete('/alugueis/{id}', [MobileAgendamentoController::class, 'destroyAluguel']);
    Route::delete('/alugueis/{id}/cancelar', [MobileAgendamentoController::class, 'destroyAluguel']);
    Route::post('/alugueis/{id}/contrato', [MobileAgendamentoController::class, 'generarEEnviarContrato']);
    Route::post('/mobile/d4sign/webhook', [MobileAgendamentoController::class, 'webhookD4Sign']);

    // --- RESOURCES PRINCIPAIS ---
    Route::apiResource('estabelecimentos', EstabelecimentoController::class)->names('api.estabelecimentos');

    // --- CATÁLOGO DE ITENS ---
    Route::prefix('catalogo/itens')->group(function () {
        Route::get('/', [ServicoController::class, 'indexItens']);
        Route::post('/', [ServicoController::class, 'storeItem']);
        Route::get('/{id}', [ServicoController::class, 'showItem']);
        Route::post('/{id}/update', [ServicoController::class, 'updateItem']);
        Route::delete('/{id}', [ServicoController::class, 'destroyItem']);
    });

    Route::middleware(['auth:sanctum'])->prefix('mobile/travel-assistant')->group(function () {
    
    // Busca e renderização Inertia da tela
    Route::get('/search', [TravelAssistantController::class, 'searchDestination'])->name('mobile.travel.search');
    
    // Detalhes de um local/ponto turístico específico
    Route::get('/place-details', [TravelAssistantController::class, 'getPlaceDetails'])->name('mobile.travel.place-details');
    
    // Gerenciamento de Viagens
    Route::get('/viagens', [TravelAssistantController::class, 'listarMinhasViagens'])->name('mobile.travel.viagens.index');
    Route::post('/viagens', [TravelAssistantController::class, 'criarViagem'])->name('mobile.travel.viagens.store');
    Route::post('/viagens/{viagemId}/membros', [TravelAssistantController::class, 'adicionarMembroPorEmail'])->name('mobile.travel.viagens.membros.store');

});

    // --- MÓDULO DE LOCAÇÕES / RESERVAS SAAS ---
    Route::prefix('locacoes')->group(function () {
        Route::get('/', [AgendamentoController::class, 'indexAlugueis']);
        Route::post('/', [AgendamentoController::class, 'storeAluguel']);
        Route::get('/{id}', [AgendamentoController::class, 'showAluguel']);
        Route::patch('/{id}', [AgendamentoController::class, 'updateAluguel']);
        Route::delete('/{id}', [AgendamentoController::class, 'destroyAluguel']);
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