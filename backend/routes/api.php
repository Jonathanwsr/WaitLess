<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;

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
use App\Http\Controllers\Api\ContaPagamentoEstabelecimentoController;
use App\Http\Controllers\Api\GamificacaoController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\Api\ItemAluguelController;



// Importações - Mobile
use App\Http\Controllers\Api\Mobile\TravelAssistantController;
use App\Http\Controllers\Api\Mobile\CarteiraMobileController;
use App\Http\Controllers\Api\Mobile\CarrinhoMobileController;
use App\Http\Controllers\Api\Mobile\Proprietario\ProviderMobileController;
use App\Http\Controllers\Api\Mobile\Proprietario\CriarServicosReservasController;
use App\Http\Controllers\Api\Mobile\Proprietario\ConfiguracoesMobileController;
use App\Http\Controllers\Api\Mobile\Proprietario\EstabelecimentoController as MobileEstabelecimentoController;
use App\Http\Controllers\Api\Mobile\MobileAuthController;
use App\Http\Controllers\Api\Mobile\MobileHomeController;
use App\Http\Controllers\Api\Mobile\MobileAgendamentoController;
use App\Http\Controllers\Api\Mobile\EstabelecimentoCatalogoMobileController;
use App\Http\Controllers\Api\Mobile\FavoritoMobileController;
use App\Http\Controllers\Api\Mobile\ClienteExplorarMobileController;
use App\Http\Controllers\Api\Mobile\AdminUsuarioMobileController;
use App\Http\Middleware\CheckAdmin;
use App\Http\Controllers\Api\Mobile\ClienteAgendamentoMobileController;
use App\Http\Controllers\Api\Mobile\AnfitriaoMobileController;
use App\Http\Controllers\Api\Mobile\CatalogoMobileController;
use App\Http\Controllers\Api\Mobile\PagamentoMobileController; // IMPORTAÇÃO QUE FALTAVA
use App\Http\Controllers\Api\Mobile\EstornoMobileController;
use App\Http\Controllers\Api\Mobile\Proprietario\DashboardController as ProprietarioDashboard;
use App\Http\Controllers\Api\Mobile\Proprietario\FuncionarioMobileController as FuncionarioMobileController;
use App\Http\Controllers\Api\Mobile\MensagemMobileController;
use App\Http\Controllers\Api\Mobile\AssinaturaMobileController;


/*
|--------------------------------------------------------------------------
| ROTAS PÚBLICAS (NÃO EXIGEM TOKEN)
|--------------------------------------------------------------------------
*/

// Rotas públicas Web
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');


    // Rota para o Webhook do Asaas (POST)
// Recebe os webhooks do Asaas apontando diretamente para o PagamentoController
Route::post('/webhook/asaas', [PagamentoController::class, 'webhookAsaas']);

// Taxas da plataforma (o app mostra estes números nas telas de explicação; a fonte é config/taxas.php)
Route::get('/mobile/taxas', fn () => response()->json([
    'plataforma_percentual' => \App\Support\Taxas::percentual(),
    'parte_do_local_percentual' => \App\Support\Taxas::parteDoLocalPercentual(),
    'cancelamento_tardio_percentual' => \App\Support\Taxas::cancelamentoTardioPercentual(),
]));

// Rotas públicas Mobile
Route::post('/mobile/login', [MobileAuthController::class, 'login'])->middleware('throttle:login');
Route::post('/mobile/register', [MobileAuthController::class, 'register'])->name('mobile.register')->middleware('throttle:register');
Route::post('/mobile/cadastro', [MobileAuthController::class, 'register'])->middleware('throttle:register'); // Alias de compatibilidade
Route::post('/mobile/senha/solicitar', [MobileAuthController::class, 'solicitarCodigoSenha'])->middleware('throttle:senha');
Route::post('/mobile/senha/redefinir', [MobileAuthController::class, 'redefinirSenha'])->middleware('throttle:senha');

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
    Route::put('/mobile/me', [MobileAuthController::class, 'atualizarPerfil']);
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

    // Categorias de serviço (fonte única, também usada nos filtros do Explorar do cliente).
    Route::get('/categorias-servicos', fn () => response()->json(\App\Support\Categorias::servicos()));

    // 1. Estabelecimentos
    Route::post('/estabelecimentos', [ConfiguracoesMobileController::class, 'storeEstabelecimento']);
    Route::post('/estabelecimentos/{estabelecimento}', [ConfiguracoesMobileController::class, 'updateEstabelecimento']);
    Route::patch('/estabelecimentos/{estabelecimento}/toggle-status', [ConfiguracoesMobileController::class, 'toggleStatusEstabelecimento']);

    // 2. Funcionários
    Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [ConfiguracoesMobileController::class, 'storeFuncionario']);
    Route::put('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'updateFuncionario']);
    Route::delete('/funcionarios/{funcionario}', [ConfiguracoesMobileController::class, 'destroyFuncionario']);
    Route::post('/estabelecimentos/{estabelecimento}/socios', [ConfiguracoesMobileController::class, 'storeSocio']);

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
    Route::get('/pagamentos/{agendamento}/resumo', [PagamentoMobileController::class, 'resumoPagamento']);
    Route::post('/pagamentos/{id}/pagar-novamente', [PagamentoMobileController::class, 'pagarNovamente']);

    // --- ESTORNOS MOBILE ---
    Route::get('/estornos', [EstornoMobileController::class, 'minhasSolicitacoes']);
    Route::get('/estornos/elegiveis', [EstornoMobileController::class, 'elegiveis']);
    Route::get('/estornos/{id}/detalhes', [EstornoMobileController::class, 'detalhes']);
    Route::get('/estornos/{id}/comprovante-pdf', [EstornoMobileController::class, 'comprovantePDF']);
    Route::post('/estornos/solicitar/{pagamento_id}', [EstornoMobileController::class, 'solicitar']);

    // --- ANFITRIÃO / PROPRIETÁRIO ---
    Route::put('/anfitriao/perfil', [AnfitriaoMobileController::class, 'updatePerfil']);

    // --- CLIENTES E TRIAGEM ---
    Route::get('/clientes/{id}/detalhes', [MobileAgendamentoController::class, 'detalheCliente']);
    Route::get('/equipe/agenda-produtividade', [FuncionarioMobileController::class, 'agenda']);
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
    Route::get('/explorar/ofertas-premium', [ClienteExplorarMobileController::class, 'ofertasPremium']);
    Route::get('/explorar/areas', [ClienteExplorarMobileController::class, 'areas']);
    Route::get('/explorar/estados', [ClienteExplorarMobileController::class, 'estados']);
    Route::get('/explorar/{id}', [ClienteExplorarMobileController::class, 'show']);

    // Alias sob o prefixo /mobile: a tela Explorar do app (app/(tabs)/explorar.tsx)
    // monta suas chamadas como `${cleanBaseUrl}/mobile/explorar...`, que sem este
    // alias não batia com nenhuma rota registrada (sempre respondia 404).
    Route::prefix('mobile')->group(function () {
        Route::get('/explorar', [ClienteExplorarMobileController::class, 'index']);
        Route::get('/explorar/destaques', [ClienteExplorarMobileController::class, 'destaques']);
        Route::get('/explorar/recentes', [ClienteExplorarMobileController::class, 'recentes']);
        Route::get('/explorar/cidade/{cidade}', [ClienteExplorarMobileController::class, 'porCidade']);
        Route::get('/explorar/categorias', [ClienteExplorarMobileController::class, 'categorias']);
        Route::get('/explorar/ofertas-premium', [ClienteExplorarMobileController::class, 'ofertasPremium']);
        Route::get('/explorar/areas', [ClienteExplorarMobileController::class, 'areas']);
        Route::get('/explorar/estados', [ClienteExplorarMobileController::class, 'estados']);
    Route::get('/explorar/{id}', [ClienteExplorarMobileController::class, 'show']);
        Route::get('/promocoes', [App\Http\Controllers\Api\Mobile\ClientePromocaoMobileController::class, 'index']);
        Route::get('/meus-pontos', [MobileHomeController::class, 'getHistoricoPontos']);
        Route::get('/minhas-avaliacoes', [MobileHomeController::class, 'minhasAvaliacoes']);
        Route::post('/cupons/validar', [App\Http\Controllers\Api\Mobile\ClienteCupomMobileController::class, 'validar']);
        Route::get('/lista-espera', [App\Http\Controllers\Api\Mobile\ListaEsperaMobileController::class, 'index']);
        Route::post('/lista-espera', [App\Http\Controllers\Api\Mobile\ListaEsperaMobileController::class, 'store']);
        Route::delete('/lista-espera/{id}', [App\Http\Controllers\Api\Mobile\ListaEsperaMobileController::class, 'destroy'])->whereNumber('id');
        Route::get('/indicacao', [App\Http\Controllers\Api\Mobile\IndicacaoMobileController::class, 'resumo']);
        Route::post('/indicacao/aplicar', [App\Http\Controllers\Api\Mobile\IndicacaoMobileController::class, 'aplicar']);
        Route::get('/cupons/recomendados', [App\Http\Controllers\Api\Mobile\ClienteCupomMobileController::class, 'recomendados']);
        Route::post('/cupons/{id}/resgatar', [App\Http\Controllers\Api\Mobile\ClienteCupomMobileController::class, 'resgatar'])->whereNumber('id');
        Route::post('/pagamentos/parcelamento', [PagamentoMobileController::class, 'parcelamento']);

        // --- GAMIFICAÇÃO: check-in diário e sugestões ---
        Route::get('/gamificacao/resumo', [App\Http\Controllers\Api\Mobile\GamificacaoMobileController::class, 'resumo']);
        Route::post('/gamificacao/checkin', [App\Http\Controllers\Api\Mobile\GamificacaoMobileController::class, 'checkin']);
        Route::post('/gamificacao/sugestoes', [App\Http\Controllers\Api\Mobile\GamificacaoMobileController::class, 'enviarSugestao']);
        Route::get('/gamificacao/sugestoes', [App\Http\Controllers\Api\Mobile\GamificacaoMobileController::class, 'minhasSugestoes']);

        // --- ÁREA ADMIN (só papel 'admin') ---
        Route::middleware(CheckAdmin::class)->prefix('admin')->group(function () {
            Route::get('/usuarios', [AdminUsuarioMobileController::class, 'index']);
            Route::post('/usuarios/{usuario}/liberar-plano', [AdminUsuarioMobileController::class, 'liberarPlano']);
            Route::post('/usuarios/{usuario}/revogar-plano', [AdminUsuarioMobileController::class, 'revogarPlano']);
        });
    });


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

    // Alias usado pela tela de Configurações do app (ConfiguracoesMobile.tsx chama /itens-aluguel)
    Route::post('/itens-aluguel', [CriarServicosReservasController::class, 'storeItem']);
    Route::post('/itens-aluguel/{id}', [CriarServicosReservasController::class, 'updateItem']);

    // Carrega os dados de UM estabelecimento específico para a tela de Configurações
    // (ConfiguracoesMobile.tsx chama /mobile/configuracoes/{id})
    Route::get('/mobile/configuracoes/{id}', [ConfiguracoesMobileController::class, 'mostrarPorEstabelecimento']);

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

        // --- MENSAGENS / CHAT (equivalente mobile de MensagemController) ---
        Route::get('/mensagens', [MensagemMobileController::class, 'index']);
        Route::get('/mensagens/nao-lidas', [MensagemMobileController::class, 'naoLidas']);
        Route::get('/mensagens/{id}', [MensagemMobileController::class, 'show']);
        Route::post('/mensagens/{id}/enviar', [MensagemMobileController::class, 'enviar']);
        Route::post('/mensagens/iniciar', [MensagemMobileController::class, 'iniciar']);
        Route::get('/catalogo/servicos/{id}', [CatalogoMobileController::class, 'detalhesServico']);
   Route::get('/catalogo/estabelecimentos/{id}', [AnfitriaoMobileController::class, 'getPerfil']);

   Route::get('/estabelecimentos/{id}/catalogo', [CatalogoMobileController::class, 'perfilEstabelecimento']);

    // Rota para ver os detalhes de um serviço específico
    Route::get('/servicos/{id}', [CatalogoMobileController::class, 'detalhesServico']);

    // Rotas para o fluxo de Fila em Tempo Real
// Aliases sob /mobile: gestão da fila pelo sócio/funcionário (listar do dia,
// chamar/adiar/pular/finalizar) só existia sem o prefixo — a tela de fila do
// app nunca teria conseguido chamar nenhuma dessas ações.
Route::get('/agendamentos', [MobileAgendamentoController::class, 'index']);
Route::get('/agendamentos/{id}', [MobileAgendamentoController::class, 'show'])->whereNumber('id');
// Locação do cliente: detalhes e cancelamento (o app abre app/agendamentos/detalhes?tipo=aluguel).
Route::get('/alugueis/{id}', [MobileAgendamentoController::class, 'showAluguelMobile'])->whereNumber('id');
Route::delete('/alugueis/{id}/cancelar', [App\Http\Controllers\Api\AgendamentoController::class, 'destroyAluguel'])->whereNumber('id');
Route::put('/agendamentos/{agendamento}/status', [MobileAgendamentoController::class, 'updateStatus']);
Route::put('/agendamentos/{agendamento}/chamar', [MobileAgendamentoController::class, 'chamar']);
Route::put('/agendamentos/{agendamento}/adiar', [MobileAgendamentoController::class, 'adiar']);
Route::put('/agendamentos/{agendamento}/pular', [MobileAgendamentoController::class, 'pularProximo']);
Route::put('/agendamentos/{agendamento}/funcionario', [MobileAgendamentoController::class, 'updateFuncionario']);
// Alias sob /mobile: finalizar com PIN, histórico do cliente e o quadro de
// produtividade da equipe só existiam sem o prefixo — as telas do funcionário
// no app (Painel-funcioanario.tsx, DetalheCliente.tsx) nunca conseguiriam chamá-los.
Route::post('/agendamentos/{id}/finalizar', [MobileAgendamentoController::class, 'finalizarComCodigo']);
Route::get('/clientes/{id}/detalhes', [MobileAgendamentoController::class, 'detalheCliente']);
Route::get('/equipe/agenda-produtividade', [FuncionarioMobileController::class, 'agenda']);
Route::get('/agendamentos/{id}/fila', [MobileAgendamentoController::class, 'statusFila']);
Route::post('/agendamentos/{id}/sair-fila', [MobileAgendamentoController::class, 'sairDaFila']);
Route::get('/agendamentos/{id}/comprovante-pdf', [MobileAgendamentoController::class, 'comprovantePDF']);
Route::get('/agendamentos/{id}/checkout', [App\Http\Controllers\Api\Mobile\PagamentoMobileController::class, 'detalhesCheckout']);

// Aliases sob /mobile: EXPO_PUBLIC_API_URL já inclui "/mobile", então rotas de
// pagamento/estorno registradas só sem o prefixo (mesmo problema já corrigido
// em /checkout/misto) nunca eram alcançadas pelo app.
Route::post('/pagamento/processar', [PagamentoMobileController::class, 'processar']);
Route::get('/pagamentos/{agendamento}/resumo', [PagamentoMobileController::class, 'resumoPagamento']);
Route::post('/pagamentos/{id}/pagar-novamente', [PagamentoMobileController::class, 'pagarNovamente']);
Route::get('/estornos', [EstornoMobileController::class, 'minhasSolicitacoes']);
Route::get('/estornos/elegiveis', [EstornoMobileController::class, 'elegiveis']);
Route::get('/estornos/{id}/detalhes', [EstornoMobileController::class, 'detalhes']);
Route::get('/estornos/{id}/comprovante-pdf', [EstornoMobileController::class, 'comprovantePDF']);
Route::post('/estornos/solicitar/{pagamento_id}', [EstornoMobileController::class, 'solicitar']);
// Alias sob /mobile: a tela EstabelecimentoDetalhes.tsx chama '/mobile/checkout/misto',
// mas a rota original só existia sem o prefixo (POST /checkout/misto), então o
// checkout do app estava batendo em 404. Mantemos a rota antiga por segurança.
Route::post('/checkout/misto', [MobileAgendamentoController::class, 'checkoutMisto']);
// Mesmo problema: EstabelecimentoDetalhes.tsx busca horários livres em
// '/mobile/horarios-disponiveis/{id}', mas a rota só existia sem o prefixo —
// a lista de horários disponíveis nunca carregava (falhava em silêncio).
Route::get('/horarios-disponiveis/{id}', [MobileAgendamentoController::class, 'obtenerHorariosDisponiveis']);
// Mesmo problema: a aba Reservas chamava estas 4 rotas com o prefixo /mobile,
// mas elas só existiam sem prefixo — o formulário nunca conseguia carregar
// nem enviar nada.
Route::get('/agendamentos/estabelecimento/{estabelecimento}', [ClienteAgendamentoMobileController::class, 'obterDadosAgendamento']);
Route::get('/reservas/item/{id}', [ClienteAgendamentoMobileController::class, 'obterDadosReserva']);
Route::post('/agendamentos/estabelecimento/{estabelecimento}/store', [ClienteAgendamentoMobileController::class, 'agendarServico']);
Route::post('/reservas/item/{id}/store', [ClienteAgendamentoMobileController::class, 'reservarItem']);
        Route::get('/estabelecimentos/{id}', [MobileAgendamentoController::class, 'verEstabelecimento']);
        Route::post('/estabelecimentos/{id}/agendar', [MobileAgendamentoController::class, 'agendarServico']);
        Route::get('/meus-agendamentos', [MobileAgendamentoController::class, 'meusAgendamentos']);
        Route::delete('/agendamentos/{id}', [MobileAgendamentoController::class, 'cancelarCliente']);
        Route::get('/estabelecimentos/{id}/catalogo', [EstabelecimentoCatalogoMobileController::class, 'show']);
        Route::get('/estabelecimentos/{id}/produtos', [EstabelecimentoCatalogoMobileController::class, 'listarProdutos']);
        Route::post('/pedidos/sacola', [EstabelecimentoCatalogoMobileController::class, 'criarPedidoSacola']);


        Route::middleware('auth:sanctum')->prefix('proprietario')->group(function () { // <-- Corrigido aqui de 'mobile/proprietario' para 'proprietario'

    Route::get('/dashboard', [ProprietarioDashboard::class, 'index']); // <-- ROTA DO DASHBOARD MOVIDA PARA CÁ

    // Gestão do sócio: financeiro, estornos, avaliações e clientes
    Route::get('/financeiro', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'financeiro']);
    Route::get('/estornos', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'estornos']);
    Route::post('/estornos/{id}/contestar', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'contestarEstorno']);
    Route::get('/avaliacoes', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'avaliacoes']);
    Route::post('/avaliacoes/{id}/responder', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'responderAvaliacao']);
    Route::get('/clientes', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'clientes']);
    Route::post('/reservas-manuais', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'reservaManual']);
    Route::get('/vitrine', [App\Http\Controllers\Api\Mobile\Proprietario\GestaoMobileController::class, 'vitrine']);

    // Divulgação: link, QR Code e mensagem pronta de cada local e serviço
    Route::get('/divulgacao', fn (\Illuminate\Http\Request $r) => response()->json(['locais' => \App\Http\Controllers\DivulgacaoController::dadosDoProprietario($r->user())]));

    // Carteira: contas de destino, saque antecipado e histórico de repasses (mesma regra do site)
    Route::get('/carteira', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'painel']);
    Route::post('/carteira/contas', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'storeConta']);
    Route::post('/carteira/contas/{conta}/validar', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'revalidarConta']);
    Route::post('/carteira/contas/{conta}/padrao', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'definirPadrao']);
    Route::delete('/carteira/contas/{conta}', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'removerConta']);
    Route::post('/carteira/sacar', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'sacar']);

    // Contratos (recurso Premium)
    Route::get('/contratos', [App\Http\Controllers\Api\Mobile\Proprietario\ContratoMobileController::class, 'index']);
    Route::post('/contratos/modelos', [App\Http\Controllers\Api\Mobile\Proprietario\ContratoMobileController::class, 'salvarModelo']);
    Route::delete('/contratos/modelos/{id}', [App\Http\Controllers\Api\Mobile\Proprietario\ContratoMobileController::class, 'removerModelo']);
    Route::post('/contratos/gerar/{aluguelId}', [App\Http\Controllers\Api\Mobile\Proprietario\ContratoMobileController::class, 'gerar']);
    Route::post('/contratos/{id}/enviar-email', [App\Http\Controllers\Api\Mobile\Proprietario\ContratoMobileController::class, 'enviarPorEmail']);

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
    Route::post('/estabelecimentos/{estabelecimento}/socios', [ConfiguracoesMobileController::class, 'storeSocio']);

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

    // ==========================================
    // 4b. LOCAÇÕES AVULSAS (sem Estabelecimento — dono aluga direto)
    // ==========================================
    Route::get('/locacoes-avulsas', [App\Http\Controllers\Api\Mobile\Proprietario\LocacaoAvulsaMobileController::class, 'index']);
    Route::post('/locacoes-avulsas', [App\Http\Controllers\Api\Mobile\Proprietario\LocacaoAvulsaMobileController::class, 'store']);
    Route::post('/locacoes-avulsas/{item}', [App\Http\Controllers\Api\Mobile\Proprietario\LocacaoAvulsaMobileController::class, 'update']);
    Route::delete('/locacoes-avulsas/{item}', [App\Http\Controllers\Api\Mobile\Proprietario\LocacaoAvulsaMobileController::class, 'destroy']);
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

// --- ASSINATURA / PLANO (equivalente mobile de Cliente/StatusAssinatura.jsx) ---
// Controller próprio do mobile: reaproveita apenas o PlanoService (catálogo de
// planos/preços) para não divergir do web, mas nunca chama o controller web.
Route::get('/assinatura/status', [AssinaturaMobileController::class, 'status']);
Route::post('/assinatura/assinar', [AssinaturaMobileController::class, 'assinar']);
Route::post('/assinatura/mudar-plano', [AssinaturaMobileController::class, 'mudarPlano']);
Route::post('/assinatura/cancelar', [AssinaturaMobileController::class, 'cancelar']);
Route::put('/assinatura/dados-financeiros', [AssinaturaMobileController::class, 'atualizarDadosFinanceiros']);

// --- RASTREAMENTO EM TEMPO REAL (equivalente mobile do mapa Uber-style do web) ---
// Cliente envia sua posição enquanto está a caminho do estabelecimento.
Route::post('/rastreamento/atualizar', [MobileAgendamentoController::class, 'rastrearLocalizacao']);
// Sócio/gerente busca a lista de agendamentos de hoje para escolher quem rastrear.
Route::get('/proprietario/rastreamento', [ProprietarioDashboard::class, 'rastreamento']);


    });

// Autenticação de canais privados do Reverb via token Sanctum (o /broadcasting/auth
// padrão do Laravel só reconhece sessão web; este é o equivalente para o app mobile).
Broadcast::routes(['prefix' => 'mobile', 'middleware' => ['auth:sanctum']]);

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
    Route::get('/viagens/{id}', [TravelAssistantController::class, 'mostrarViagem'])->name('mobile.travel.viagens.show');
    Route::put('/viagens/{id}', [TravelAssistantController::class, 'atualizarViagem'])->name('mobile.travel.viagens.update');
    Route::delete('/viagens/{id}', [TravelAssistantController::class, 'excluirViagem'])->name('mobile.travel.viagens.destroy');
    Route::post('/viagens/{viagemId}/membros', [TravelAssistantController::class, 'adicionarMembroPorEmail'])->name('mobile.travel.viagens.membros.store');

    // Gastos planejados de uma viagem (armazenados no JSON gastos_planejados)
    Route::post('/viagens/{viagemId}/gastos', [TravelAssistantController::class, 'adicionarGasto'])->name('mobile.travel.viagens.gastos.store');
    Route::put('/viagens/{viagemId}/gastos/{gastoId}', [TravelAssistantController::class, 'atualizarGasto'])->name('mobile.travel.viagens.gastos.update');
    Route::delete('/viagens/{viagemId}/gastos/{gastoId}', [TravelAssistantController::class, 'removerGasto'])->name('mobile.travel.viagens.gastos.destroy');

});

    // Sininho do app: notificações de estorno
    Route::middleware(['auth:sanctum'])->prefix('mobile/notificacoes')->group(function () {
        $c = App\Http\Controllers\Api\Mobile\NotificacaoMobileController::class;
        Route::get('/', [$c, 'index']);
        Route::get('/contagem', [$c, 'contagem']);
        Route::post('/lidas', [$c, 'marcarTodasLidas']);
        Route::post('/{id}/lida', [$c, 'marcarLida']);
    });

    // Triagem no app (cliente responde ao reservar; dono/equipe analisa)
    Route::middleware(['auth:sanctum'])->prefix('mobile/triagens')->group(function () {
        $c = App\Http\Controllers\Api\TriagemController::class;
        Route::get('/perguntas', [$c, 'perguntas']);
        Route::get('/', [$c, 'index']);
        Route::get('/{id}', [$c, 'show']);
        Route::put('/{id}', [$c, 'update']);
    });

    // Roteiro inteligente (premium) e agenda compartilhada do grupo — mesma lógica do web
    Route::middleware(['auth:sanctum'])->prefix('mobile/viagens')->name('mobile.viagens.')->group(function () {
        $c = App\Http\Controllers\Api\ViagemController::class;
        Route::get('/', [$c, 'lista'])->name('index');
        Route::post('/', [$c, 'store'])->name('store');
        Route::post('/roteiro/previa', [$c, 'previa'])->name('previa');
        Route::get('/convite/{codigo}', [$c, 'conviteInfo'])->name('convite');
        Route::post('/convite/{codigo}', [$c, 'confirmarEntrada'])->name('convite.entrar');
        Route::get('/{viagem}', [$c, 'painel'])->whereNumber('viagem')->name('show');
        Route::put('/{viagem}', [$c, 'update'])->name('update');
        Route::delete('/{viagem}', [$c, 'destroy'])->name('destroy');
        Route::post('/{viagem}/regenerar', [$c, 'regenerar'])->name('regenerar');
        Route::post('/{viagem}/convidar', [$c, 'convidar'])->name('convidar');
        Route::post('/{viagem}/presenca', [$c, 'presencaViagem'])->name('presenca');
        Route::delete('/{viagem}/membros/{usuario}', [$c, 'removerMembro'])->name('membros.destroy');
        Route::post('/{viagem}/itens', [$c, 'itemStore'])->name('itens.store');
        Route::put('/{viagem}/itens/{item}', [$c, 'itemUpdate'])->name('itens.update');
        Route::delete('/{viagem}/itens/{item}', [$c, 'itemDestroy'])->name('itens.destroy');
        Route::post('/{viagem}/itens/{item}/presenca', [$c, 'presencaItem'])->name('itens.presenca');
        Route::post('/{viagem}/reservas', [$c, 'compartilharReserva'])->name('reservas.store');
        Route::post('/{viagem}/despesas', [$c, 'despesaStore'])->name('despesas.store');
        Route::delete('/{viagem}/despesas/{despesa}', [$c, 'despesaDestroy'])->name('despesas.destroy');
        Route::post('/{viagem}/pagamentos', [$c, 'pagamentoStore'])->name('pagamentos.store');
        Route::get('/{viagem}/mensagens', [$c, 'mensagens'])->name('mensagens.index');
        Route::post('/{viagem}/mensagens', [$c, 'mensagemStore'])->name('mensagens.store');
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
    // Route::apiResource('pagamentos', ...) foi removida daqui: PagamentoController só
    // tem processar()/webhookAsaas() — o apiResource gerava index/store/show/update/destroy
    // pra métodos que não existem, quebrando com erro 500 se alguém batesse nessas rotas.
    Route::apiResource('descontos', DescontoController::class);
    Route::apiResource('regras-pontuacao', RegraPontuacaoController::class);
    Route::apiResource('historico-pontos', HistoricoPontoController::class);

    // --- OPERACIONAL AVANÇADO ---
    // Triagem: ficha antes da reserva/atendimento. Só cliente e responsável enxergam (ver TriagemController).
    Route::get('/triagens/perguntas', [TriagemController::class, 'perguntas']);
    Route::get('/triagens', [TriagemController::class, 'index']);
    Route::get('/triagens/{id}', [TriagemController::class, 'show']);
    Route::put('/triagens/{id}', [TriagemController::class, 'update']);
    Route::apiResource('contas-bancarias', ContaPagamentoEstabelecimentoController::class);
    Route::apiResource('gamificacoes', GamificacaoController::class);



});