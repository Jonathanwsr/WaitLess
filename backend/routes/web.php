<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EstabelecimentoController;
use App\Http\Controllers\Api\AgendamentoController;
use App\Http\Controllers\Api\ClienteAgendamentoController;
use App\Http\Controllers\Api\ClienteExplorarController;
use App\Http\Controllers\Api\PagamentoController;
use App\Http\Controllers\Api\ServicoController;
use App\Http\Controllers\Api\FinanceiroController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\ProdutoController;
use App\Http\Controllers\Api\ProdutoEntregaController;
use App\Http\Controllers\Api\PedidoEntregaController;
use App\Http\Controllers\Api\OfertaPremiumController;
use App\Http\Controllers\Api\FuncionarioCatalogoController;
use App\Http\Controllers\Api\FuncionarioCarteiraController;
use App\Http\Controllers\Api\CarrinhoController;
use App\Http\Controllers\Api\FuncionarioAusenciaController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\CupomController;
use App\Http\Controllers\Api\FilaController;
use App\Http\Controllers\Api\FuncionarioAreaController;
use App\Http\Controllers\Api\AdminFinanceiroController;
use App\Http\Controllers\Api\AdminPromocaoController;
use App\Http\Controllers\Api\AdminUsuarioController;
use App\Services\MercadoPagoService;
use App\Http\Controllers\Api\FavoritoController;
use App\Http\Controllers\Api\MensagemController;
use App\Http\Controllers\Api\ExtratoProviderController;
use App\Http\Controllers\Api\AssinaturaController;
use App\Http\Middleware\CheckAdmin;
use App\Http\Controllers\Api\ClienteCupomController;
use App\Http\Controllers\Api\CarteiraController;
use App\Http\Controllers\Api\FuncionarioController;
use App\Http\Controllers\Api\ItemAluguelController;
use App\Http\Controllers\Api\AvaliacaoController;
use App\Http\Controllers\Api\ContratoController;
use App\Http\Controllers\Api\EstornoController;
use App\Http\Controllers\Api\TravelAssistantController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Rotas Públicas
|--------------------------------------------------------------------------
*/
Route::get('/', [App\Http\Controllers\WelcomeController::class, 'index'])->name('welcome');

// Vitrine pública dos parceiros premium (usada no carrossel da Welcome, sem exigir login)
Route::get('/api/vitrine-premium', [AssinaturaController::class, 'vitrinePremium'])->name('api.vitrine-premium');

// Divulgação: página pública do local (prévia bonita no WhatsApp/Instagram) e QR Code do link
Route::get('/l/{estabelecimento}', [App\Http\Controllers\DivulgacaoController::class, 'pagina'])->name('local.publico');
Route::get('/l/{estabelecimento}/qr.png', [App\Http\Controllers\DivulgacaoController::class, 'qr'])->name('local.qr');

// Páginas legais públicas (linkadas no rodapé do site e na Central de Ajuda do app mobile)
Route::get('/privacidade', fn () => Inertia::render('Legal/Privacidade'))->name('legal.privacidade');
Route::get('/termos', fn () => Inertia::render('Legal/Termos', [
    'versaoAtual' => config('termos.versao_atual'),
]))->name('legal.termos');

// Tela pública de detalhes de um serviço/aluguel (fotos, descrição e avaliações), sem exigir login
Route::get('/vitrine/{tipo}/{id}', [App\Http\Controllers\WelcomeController::class, 'detalhes'])
    ->where('tipo', 'servico|aluguel')
    ->where('id', '[0-9]+')
    ->name('vitrine.detalhe');

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


// assinaturas

Route::post('/assinaturas/nova', [App\Http\Controllers\Api\AssinaturaController::class, 'assinar'])->name('assinatura.nova');
    Route::post('/assinaturas/cancelar', [App\Http\Controllers\Api\AssinaturaController::class, 'cancelar'])->name('assinatura.cancelar');


    Route::get('/financeiro/conta', function () {
    return Inertia::render('Estabelecimentos/FinanceiroConta');
})->name('financeiro.conta');

    // Locações avulsas: sócio/proprietário aluga imóveis/veículos direto,
    // sem precisar cadastrar um Estabelecimento antes.
    Route::get('/minhas-locacoes', [App\Http\Controllers\Api\LocacaoAvulsaController::class, 'index'])->name('locacoes.avulsas.index');
    Route::post('/minhas-locacoes', [App\Http\Controllers\Api\LocacaoAvulsaController::class, 'store'])->name('locacoes.avulsas.store');
    Route::post('/minhas-locacoes/{item}', [App\Http\Controllers\Api\LocacaoAvulsaController::class, 'update'])->name('locacoes.avulsas.update');
    Route::delete('/minhas-locacoes/{item}', [App\Http\Controllers\Api\LocacaoAvulsaController::class, 'destroy'])->name('locacoes.avulsas.destroy');
    Route::post('/minhas-locacoes/reservas/{aluguel}/cancelar', [App\Http\Controllers\Api\LocacaoAvulsaController::class, 'cancelarReserva'])->name('locacoes.avulsas.reservas.cancelar');



Route::get('/api/provider', [ProviderController::class, 'show'])->name('provider.show');

    // 2. Rota POST: Salva ou atualiza o perfil (Singular!)
    Route::post('/api/provider', [ProviderController::class, 'store'])->name('provider.store');

    // troca a chave pix do provider

    Route::put('/api/provider', [ProviderController::class, 'update'])->name('provider.update');

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/relatorios/avancado', [App\Http\Controllers\Api\RelatorioAvancadoController::class, 'index'])->name('relatorios.avancado');

    //avaliaçoes

    Route::get('/avaliacoes/{id}', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexReact'])->name('avaliacoes.index');
    Route::post('/api/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'store'])->name('avaliacoes.store');

 // Rotas de Avaliações
Route::get('/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexReact'])->name('avaliacoes.geral');
Route::get('/avaliacoes/{id}', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexReact'])->name('avaliacoes.index');
Route::post('/api/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'store'])->name('avaliacoes.store');

// Rota para Cliente denunciar um comentário
Route::post('/avaliacoes/{id}/denunciar', [App\Http\Controllers\Api\AvaliacaoController::class, 'denunciar'])->name('avaliacoes.denunciar');

// Rotas exclusivas do ADMIN da plataforma (Moderação)
Route::middleware(['auth', CheckAdmin::class])->group(function () {
    Route::get('/admin/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexAdmin'])->name('admin.avaliacoes.index');

    Route::post('/admin/avaliacoes/{id}/apagar', [App\Http\Controllers\Api\AvaliacaoController::class, 'destroy'])->name('admin.avaliacoes.destroy');
    });

// Rotas de Avaliações (Anfitrião / Proprietário)
Route::get('/anfitriao/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexAnfitriao'])->name('anfitriao.avaliacoes.index');
Route::post('/anfitriao/avaliacoes/{id}/responder', [App\Http\Controllers\Api\AvaliacaoController::class, 'responder'])->name('anfitriao.avaliacoes.responder');

    Route::prefix('admin/financeiro')->middleware(['auth', CheckAdmin::class])->group(function () {
        // Tela principal para monitorar tabelas de jobs, saldos e failed_jobs
        Route::get('/painel', [AdminFinanceiroController::class, 'index'])->name('admin.financeiro.index');

        // Ação do botão de clique para forçar o PIX do proprietário na hora
        Route::post('/repassar-manual/{id}', [AdminFinanceiroController::class, 'repassarManual'])->name('admin.financeiro.repassar');

        // Ação do formulário para disparar e-mails customizados via Brevo
        Route::post('/enviar-email', [AdminFinanceiroController::class, 'enviarEmailPersonalizado'])->name('admin.financeiro.email');

        // Pagamentos da plataforma (todas as transações Asaas) e status dos robôs automáticos
        Route::get('/pagamentos', [AdminFinanceiroController::class, 'pagamentos'])->name('admin.financeiro.pagamentos');
        Route::get('/pagamentos/{id}/asaas', [AdminFinanceiroController::class, 'consultarPagamentoAsaas'])->name('admin.financeiro.pagamentos.asaas');
        Route::post('/robos/{comando}/rodar', [AdminFinanceiroController::class, 'rodarRoboAgora'])->name('admin.financeiro.robos.rodar');
    });

    Route::prefix('admin/produtos-entrega')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\AdminProdutoEntregaController::class, 'index'])->name('admin.produtos-entrega.index');
        Route::delete('/{produto}', [\App\Http\Controllers\Api\AdminProdutoEntregaController::class, 'destroy'])->name('admin.produtos-entrega.destroy');
        Route::post('/pedidos/{pedido}/disputa', [\App\Http\Controllers\Api\AdminProdutoEntregaController::class, 'decidirDisputa'])->name('admin.produtos-entrega.disputa');
    });

    Route::prefix('admin/promocoes')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [AdminPromocaoController::class, 'index'])->name('admin.promocoes.index');
        Route::get('/buscar-itens', [AdminPromocaoController::class, 'buscarItens'])->name('admin.promocoes.buscar-itens');
        Route::post('/', [AdminPromocaoController::class, 'store'])->name('admin.promocoes.store');
        Route::post('/{promocao}', [AdminPromocaoController::class, 'update'])->name('admin.promocoes.update');
        Route::patch('/{promocao}/toggle-ativo', [AdminPromocaoController::class, 'toggleAtivo'])->name('admin.promocoes.toggle-ativo');
        Route::post('/{promocao}/executar', [AdminPromocaoController::class, 'executar'])->name('admin.promocoes.executar');
        Route::delete('/{promocao}', [AdminPromocaoController::class, 'destroy'])->name('admin.promocoes.destroy');
    });

    Route::prefix('admin/usuarios')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [AdminUsuarioController::class, 'index'])->name('admin.usuarios.index');
        Route::get('/{usuario}', [AdminUsuarioController::class, 'show'])->name('admin.usuarios.show');
        Route::post('/{usuario}/liberar-plano', [AdminUsuarioController::class, 'liberarPlano'])->name('admin.usuarios.liberar-plano');
        Route::post('/{usuario}/revogar-plano', [AdminUsuarioController::class, 'revogarPlano'])->name('admin.usuarios.revogar-plano');
        Route::put('/{usuario}', [AdminUsuarioController::class, 'update'])->name('admin.usuarios.update');
        Route::delete('/{usuario}', [AdminUsuarioController::class, 'destroy'])->name('admin.usuarios.destroy');
    });

    Route::prefix('admin/repasses')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminCarteiraController::class, 'index'])->name('admin.repasses.index');
        Route::post('/{transferencia}/consultar', [App\Http\Controllers\Api\AdminCarteiraController::class, 'consultar'])->name('admin.repasses.consultar');
        Route::post('/contas/{conta}/validar', [App\Http\Controllers\Api\AdminCarteiraController::class, 'validarConta'])->name('admin.repasses.contas.validar');
    });

    Route::prefix('admin/relatorios')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminRelatorioController::class, 'index'])->name('admin.relatorios.index');
        Route::post('/custos', [App\Http\Controllers\Api\AdminRelatorioController::class, 'storeCusto'])->name('admin.relatorios.custos.store');
        Route::put('/custos/{custo}', [App\Http\Controllers\Api\AdminRelatorioController::class, 'updateCusto'])->name('admin.relatorios.custos.update');
        Route::delete('/custos/{custo}', [App\Http\Controllers\Api\AdminRelatorioController::class, 'destroyCusto'])->name('admin.relatorios.custos.destroy');
    });

    Route::prefix('admin/gamificacao')->middleware(['auth', CheckAdmin::class])->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminGamificacaoController::class, 'index'])->name('admin.gamificacao.index');
        Route::post('/sugestoes/{sugestao}/responder', [App\Http\Controllers\Api\AdminGamificacaoController::class, 'responder'])->name('admin.gamificacao.sugestoes.responder');
    });

    // Perfil
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::get('/profile/termos', [ProfileController::class, 'termos'])->name('perfil.termos');

    // Estabelecimentos
    Route::get('/estabelecimentos/create', [EstabelecimentoController::class, 'create'])->name('estabelecimentos.create');
    Route::post('/estabelecimentos', [EstabelecimentoController::class, 'store'])->name('estabelecimentos.store');
    Route::put('/estabelecimentos/{estabelecimento}', [EstabelecimentoController::class, 'update'])->name('estabelecimentos.update');
    Route::patch('/estabelecimentos/{estabelecimento}/toggle-status', [EstabelecimentoController::class, 'toggleStatus'])->name('estabelecimentos.toggle-status');
    Route::post('/estabelecimentos/{estabelecimento}/horarios', [App\Http\Controllers\Api\HorarioFuncionamentoController::class, 'store'])->name('estabelecimentos.horarios.store');
    Route::delete('/estabelecimentos/{estabelecimento}/horarios/{horario}', [App\Http\Controllers\Api\HorarioFuncionamentoController::class, 'destroy'])->name('estabelecimentos.horarios.destroy');
    Route::get('/meus-estabelecimentos', [EstabelecimentoController::class, 'index'])
        ->name('estabelecimentos.index');

        Route::middleware('auth:sanctum')->get('/estabelecimentos/proximos', [DashboardController::class, 'getNearby']);

       Route::get('/home', [DashboardController::class, 'showHome'])->name('home'); // 👈 name('home') minúsculo
       Route::get('/api/nearby', [DashboardController::class, 'getNearby'])->name('api.nearby');




Route::middleware(['auth'])->group(function () {
    // Roteiro inteligente (premium) e agenda compartilhada do grupo
    $viagens = App\Http\Controllers\Api\ViagemController::class;
    Route::get('/viagens', [$viagens, 'index'])->name('viagens.index');
    Route::get('/viagens/nova', [$viagens, 'nova'])->name('viagens.nova');
    Route::post('/viagens/roteiro/previa', [$viagens, 'previa'])->name('viagens.previa');
    Route::get('/viagens/mala/catalogo', [$viagens, 'catalogoMala'])->middleware('throttle:60,1')->name('viagens.mala.catalogo');
    Route::post('/viagens', [$viagens, 'store'])->name('viagens.store');
    Route::get('/viagens/convite/{codigo}', [$viagens, 'entrarPorCodigo'])->name('viagens.convite');
    Route::post('/viagens/convite/{codigo}', [$viagens, 'confirmarEntrada'])->name('viagens.convite.entrar');
    Route::get('/viagens/{viagem}', [$viagens, 'show'])->whereNumber('viagem')->name('viagens.show');
    Route::get('/viagens/{viagem}/painel', [$viagens, 'painel'])->name('viagens.painel');
    Route::put('/viagens/{viagem}', [$viagens, 'update'])->name('viagens.update');
    Route::delete('/viagens/{viagem}', [$viagens, 'destroy'])->name('viagens.destroy');
    Route::post('/viagens/{viagem}/regenerar', [$viagens, 'regenerar'])->name('viagens.regenerar');
    Route::post('/viagens/{viagem}/convidar', [$viagens, 'convidar'])->name('viagens.convidar');
    Route::post('/viagens/{viagem}/presenca', [$viagens, 'presencaViagem'])->name('viagens.presenca');
    Route::delete('/viagens/{viagem}/membros/{usuario}', [$viagens, 'removerMembro'])->name('viagens.membros.destroy');
    Route::post('/viagens/{viagem}/itens', [$viagens, 'itemStore'])->name('viagens.itens.store');
    Route::put('/viagens/{viagem}/itens/{item}', [$viagens, 'itemUpdate'])->name('viagens.itens.update');
    Route::delete('/viagens/{viagem}/itens/{item}', [$viagens, 'itemDestroy'])->name('viagens.itens.destroy');
    Route::post('/viagens/{viagem}/itens/{item}/presenca', [$viagens, 'presencaItem'])->name('viagens.itens.presenca');
    Route::post('/viagens/{viagem}/reservas', [$viagens, 'compartilharReserva'])->name('viagens.reservas.store');
    Route::post('/viagens/{viagem}/despesas', [$viagens, 'despesaStore'])->name('viagens.despesas.store');
    Route::delete('/viagens/{viagem}/despesas/{despesa}', [$viagens, 'despesaDestroy'])->name('viagens.despesas.destroy');
    Route::post('/viagens/{viagem}/pagamentos', [$viagens, 'pagamentoStore'])->name('viagens.pagamentos.store');
    Route::get('/viagens/{viagem}/mensagens', [$viagens, 'mensagens'])->name('viagens.mensagens.index');
    Route::post('/viagens/{viagem}/mensagens', [$viagens, 'mensagemStore'])->name('viagens.mensagens.store');
});

Route::middleware(['auth'])->group(function () {
    // Carteira do proprietário (saldo Asaas, contas de destino validadas, repasse antecipado)
    Route::get('/financeiro/carteira', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'index'])->name('carteira.asaas');
    Route::get('/api/carteira-asaas', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'painel'])->name('carteira.asaas.painel');
    Route::get('/api/carteira-asaas/historico', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'historico'])->name('carteira.asaas.historico');
    Route::post('/api/carteira-asaas/contas', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'storeConta'])->name('carteira.asaas.contas.store');
    Route::post('/api/carteira-asaas/contas/{conta}/validar', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'revalidarConta'])->name('carteira.asaas.contas.validar');
    Route::post('/api/carteira-asaas/contas/{conta}/padrao', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'definirPadrao'])->name('carteira.asaas.contas.padrao');
    Route::delete('/api/carteira-asaas/contas/{conta}', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'removerConta'])->name('carteira.asaas.contas.destroy');
    Route::post('/api/carteira-asaas/sacar', [App\Http\Controllers\Api\CarteiraProprietarioController::class, 'sacar'])->name('carteira.asaas.sacar');

    // Rota da tela do Dashboard Financeiro Completo
    Route::get('/financeiro/extrato', [ExtratoProviderController::class, 'index'])->name('provider.financeiro');

    // Rota para disparar downloads de relatórios por período em planilhas Excel (CSV)
    Route::get('/financeiro/extrato/exportar', [ExtratoProviderController::class, 'exportar'])->name('provider.financeiro.export');
});

// ========================================================
// ENTREGAS — Produtos para entrega/retirada (módulo novo, separado dos
// Produtos existentes). CRUD do sócio + pedido/pagamento/cancelamento/
// estorno/comprovante do cliente, tudo atrás de login.
// ========================================================
Route::middleware(['auth'])->group(function () {
    Route::get('/produtos-entrega', [ProdutoEntregaController::class, 'index'])->name('produtos-entrega.index');
    Route::post('/produtos-entrega', [ProdutoEntregaController::class, 'store'])->name('produtos-entrega.store');
    Route::post('/produtos-entrega/{produtoEntrega}', [ProdutoEntregaController::class, 'update'])->name('produtos-entrega.update');
    Route::patch('/produtos-entrega/{produtoEntrega}/toggle-ativo', [ProdutoEntregaController::class, 'toggleAtivo'])->name('produtos-entrega.toggle-ativo');
    Route::patch('/produtos-entrega/{produtoEntrega}/vincular-local', [ProdutoEntregaController::class, 'vincularLocal'])->name('produtos-entrega.vincular-local');
    Route::delete('/produtos-entrega/{produtoEntrega}', [ProdutoEntregaController::class, 'destroy'])->name('produtos-entrega.destroy');

    Route::get('/entregas', [PedidoEntregaController::class, 'index'])->name('entregas.index');
    Route::get('/entregas/catalogo', [PedidoEntregaController::class, 'catalogo'])->name('entregas.catalogo');
    Route::get('/entregas/produtos/{produtoEntrega}', [PedidoEntregaController::class, 'produto'])->name('entregas.produto');
    Route::post('/entregas/pedidos', [PedidoEntregaController::class, 'store'])->name('entregas.pedidos.store');
    Route::get('/entregas/meus-pedidos', [PedidoEntregaController::class, 'meusPedidos'])->name('entregas.pedidos.meus');
    Route::get('/entregas/pedidos-recebidos', [PedidoEntregaController::class, 'pedidosRecebidos'])->name('entregas.pedidos.recebidos');
    Route::get('/entregas/recompras', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'recompras'])->name('entregas.recompras');
    Route::get('/entregas/gestao', [\App\Http\Controllers\Api\EntregasGestaoController::class, 'index'])->name('entregas.gestao');
    Route::get('/entregas/painel-vendas', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'painelDeVendas'])->name('entregas.painel-vendas');
    Route::post('/entregas/pedidos/{pedido}/avaliar', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'avaliar'])->name('entregas.pedidos.avaliar');
    Route::post('/entregas/pedidos/{pedido}/posicao', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'registrarPosicao'])->name('entregas.pedidos.posicao.store');
    Route::get('/entregas/pedidos/{pedido}/posicao', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'posicao'])->name('entregas.pedidos.posicao');
    Route::get('/entregas/assinaturas', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'listarAssinaturas'])->name('entregas.assinaturas.index');
    Route::post('/entregas/assinaturas', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'criarAssinatura'])->name('entregas.assinaturas.store');
    Route::post('/entregas/assinaturas/{assinatura}/alterar', [\App\Http\Controllers\Api\EntregasRecursosController::class, 'alterarAssinatura'])->name('entregas.assinaturas.alterar');
    Route::post('/entregas/pedidos/{pedidoEntrega}/funcionario', [PedidoEntregaController::class, 'atribuirFuncionario'])->name('entregas.pedidos.funcionario');
    Route::get('/entregas/pedidos/{pedidoEntrega}', [PedidoEntregaController::class, 'show'])->name('entregas.pedidos.show');
    Route::post('/entregas/pedidos/{pedidoEntrega}/liberar', [PedidoEntregaController::class, 'liberarPagamento'])
        ->middleware('throttle:10,1')
        ->name('entregas.pedidos.liberar');
    Route::post('/avisos/{notificacao}/lido', [\App\Http\Controllers\Api\NotificacaoUsuarioController::class, 'marcarLido'])->name('avisos.lido');
    Route::post('/entregas/pedidos/{pedidoEntrega}/cancelar', [PedidoEntregaController::class, 'cancelar'])->name('entregas.pedidos.cancelar');
    Route::post('/entregas/pedidos/{pedidoEntrega}/cancelar-vendedor', [PedidoEntregaController::class, 'cancelarPeloVendedor'])->name('entregas.pedidos.cancelar-vendedor');
    Route::post('/entregas/pedidos/{pedidoEntrega}/estorno', [PedidoEntregaController::class, 'solicitarEstorno'])->name('entregas.pedidos.estorno');
    Route::get('/entregas/pedidos/{pedidoEntrega}/comprovante-pdf', [PedidoEntregaController::class, 'comprovantePDF'])->name('entregas.pedidos.comprovante');
    Route::post('/entregas/carrinho', [\App\Http\Controllers\Api\CarrinhoEntregaController::class, 'store'])->name('entregas.carrinho.store');
    Route::patch('/entregas/carrinho/{item}', [\App\Http\Controllers\Api\CarrinhoEntregaController::class, 'update'])->name('entregas.carrinho.update');
    Route::delete('/entregas/carrinho/{item}', [\App\Http\Controllers\Api\CarrinhoEntregaController::class, 'destroy'])->name('entregas.carrinho.destroy');

    // Painel de pedidos da gestão: sócio e gerente acompanham cada pedido e quem está atendendo.
    // Central de relatórios do sócio/gerente: todos os relatórios num lugar só.
    Route::get('/gestao/relatorios', fn () => \Inertia\Inertia::render('Gestao/Relatorios'))->name('gestao.relatorios');
    Route::get('/gestao/pedidos', [\App\Http\Controllers\Api\GestaoPedidosController::class, 'index'])->name('gestao.pedidos.index');
    // Histórico em PDF de serviços e reservas (dia ou mês) para sócio e gerente.
    Route::get('/gestao/historico-pdf', [\App\Http\Controllers\Api\HistoricoAtendimentosController::class, 'pdf'])->name('gestao.historico.pdf');
    Route::get('/gestao/historico-resumo', [\App\Http\Controllers\Api\HistoricoAtendimentosController::class, 'resumo'])->name('gestao.historico.resumo');
    // Comprovante de pagamento em PDF (quem pagou, quem recebeu ou admin).
    Route::get('/comprovante-pagamento', [\App\Http\Controllers\Api\ComprovantePagamentoController::class, 'pdf'])->name('pagamentos.comprovante');
    Route::get('/api/pagamentos-recebidos', [\App\Http\Controllers\Api\ComprovantePagamentoController::class, 'recebidos'])->name('pagamentos.recebidos');
    Route::get('/comprovantes-recebimento', [\App\Http\Controllers\Api\ComprovantePagamentoController::class, 'lote'])->middleware('throttle:20,1')->name('pagamentos.comprovantes.lote');
    // Flash Deals: oferta relâmpago para vagas ociosas, avisada a quem está na cidade.
    Route::get('/gestao/flash-deals', [\App\Http\Controllers\Api\FlashDealController::class, 'index'])->name('gestao.flash-deals.index');
    Route::post('/gestao/flash-deals', [\App\Http\Controllers\Api\FlashDealController::class, 'store'])->middleware('throttle:10,1')->name('gestao.flash-deals.store');
    Route::post('/gestao/flash-deals/{flashDeal}/cancelar', [\App\Http\Controllers\Api\FlashDealController::class, 'cancelar'])->name('gestao.flash-deals.cancelar');

    // Cobranças parceladas: sócio monta e acompanha; cliente aceita ou recusa.
    Route::get('/cobrancas', [\App\Http\Controllers\Api\CobrancaController::class, 'index'])->name('cobrancas.index');
    Route::get('/cobrancas/opcoes', [\App\Http\Controllers\Api\CobrancaController::class, 'opcoes'])->name('cobrancas.opcoes');
    Route::get('/cobrancas/buscar-clientes', [\App\Http\Controllers\Api\CobrancaController::class, 'buscarClientes'])->name('cobrancas.buscar-clientes');
    Route::post('/cobrancas', [\App\Http\Controllers\Api\CobrancaController::class, 'store'])->name('cobrancas.store');
    Route::post('/cobrancas/{cobranca}/cancelar', [\App\Http\Controllers\Api\CobrancaController::class, 'cancelar'])->name('cobrancas.cancelar');
    Route::get('/cobrancas/{cobranca}/comprovante-pdf', [\App\Http\Controllers\Api\CobrancaController::class, 'comprovante'])->name('cobrancas.comprovante');
    Route::post('/cobrancas/parcelas/{parcela}/baixa', [\App\Http\Controllers\Api\CobrancaController::class, 'baixa'])->name('cobrancas.parcelas.baixa');
    Route::post('/cobrancas/parcelas/{parcela}/sincronizar', [\App\Http\Controllers\Api\CobrancaController::class, 'sincronizar'])->name('cobrancas.parcelas.sincronizar');
    Route::get('/minhas-cobrancas', [\App\Http\Controllers\Api\CobrancaClienteController::class, 'index'])->name('cobrancas.minhas');
    Route::post('/minhas-cobrancas/{cobranca}/aceitar', [\App\Http\Controllers\Api\CobrancaClienteController::class, 'aceitar'])->name('cobrancas.aceitar');
    Route::post('/minhas-cobrancas/{cobranca}/recusar', [\App\Http\Controllers\Api\CobrancaClienteController::class, 'recusar'])->name('cobrancas.recusar');
    Route::get('/minhas-cobrancas/{cobranca}/comprovante-pdf', [\App\Http\Controllers\Api\CobrancaClienteController::class, 'comprovante'])->name('cobrancas.minhas.comprovante');
});


   //produtos

    // 1. Criar Produto
   // 1. Criar Produto
Route::post('/cliente/carrinho', [\App\Http\Controllers\Api\AgendamentoController::class, 'storeCarrinho'])->name('cliente.carrinho.store');
Route::post('/cliente/carrinho/produto', [\App\Http\Controllers\Api\AgendamentoController::class, 'storeProdutoCarrinho'])->name('cliente.carrinho.store_produto');
Route::delete('/cliente/carrinho/item/{item_id}', [\App\Http\Controllers\Api\AgendamentoController::class, 'removerProdutoDoCarrinho'])->name('cliente.carrinho.remover_item');

// 1. Criar Produto
Route::post('/produtos', [ProdutoController::class, 'store'])->name('produtos.store');

// 2. Editar Produto
Route::put('/produtos/{id}', [ProdutoController::class, 'update'])->name('produtos.update');

// 3. Apagar Produto de vez
Route::delete('/produtos/{id}', [ProdutoController::class, 'destroy'])->name('produtos.destroy');

// 4. Listar todos os meus produtos (Tela React/Inertia)
Route::get('/meus-produtos', [ProdutoController::class, 'meusProdutos'])->name('produtos.meus');

// 5. Listar todos os produtos de um estabelecimento (Geral)
Route::get('/estabelecimentos/{estabelecimento_id}/produtos', [ProdutoController::class, 'produtosPorEstabelecimento'])->name('produtos.estabelecimento');

// 6. Listar produtos visíveis para vincular ao cliente (MÉTODO CORRIGIDO)
Route::get('/estabelecimentos/{estabelecimento_id}/produtos/vinculo', [ProdutoController::class, 'produtosDisponiveisParaCliente'])->name('produtos.vinculo');

// 7. Listar promoções e produtos exclusivos Premium (MÉTODO CORRIGIDO)
Route::get('/estabelecimentos/{estabelecimento_id}/produtos/vinculo-premium', [ProdutoController::class, 'produtosExclusivosPremium'])->name('produtos.vinculo.premium');
Route::get('/estabelecimentos/{id}/produtos/premium', [ProdutoController::class, 'produtosExclusivosPremium'])->name('produtos.premium');

// 8. Adicionar produto a um agendamento/aluguel
Route::post('/produtos/{produto_id}/vincular', [ProdutoController::class, 'adicionarAoAgendamento'])->name('produtos.vincular');

// 9. Repor estoque
Route::patch('/produtos/{id}/estoque', [ProdutoController::class, 'adicionarEstoque'])->name('produtos.estoque.adicionar');

// 10. Vincular direto na tabela itens_aluguel
Route::post('/produtos/vincular', [ProdutoController::class, 'vincularProduto'])->name('produtos.vincular_cliente');

// Buscar produtos via JSON
Route::get('/meus-produtos/json', [ProdutoController::class, 'meusProdutosJson'])->name('produtos.meus.json');



// ========================================================
// ROTAS PÚBLICAS OU MISTAS (O Controller checa internamente)
// ========================================================

// Vitrine do Cliente na hora de agendar (Mostra tudo se for Premium, ou esconde os VIPs se for cliente comum/deslogado)
Route::get('/estabelecimentos/{id}/produtos/cliente', [ProdutoController::class, 'produtosDisponiveisParaCliente'])->name('produtos.cliente');

// Lista crua de produtos do estabelecimento (Uso geral)
Route::get('/estabelecimentos/{id}/produtos', [ProdutoController::class, 'produtosPorEstabelecimento'])->name('produtos.estabelecimento');

// estornos
Route::get('/estornos', [EstornoController::class, 'index'])->name('estornos.index');
Route::get('/pagamentos/elegiveis-estorno', [EstornoController::class, 'elegiveisEstorno']);

// Ação do Prestador
    Route::post('/api/estornos/{id}/contestar', [EstornoController::class, 'contestar']);

    // comprovante PDF do estorno
    Route::get('/estornos/{id}/comprovante', [\App\Http\Controllers\Api\EstornoController::class, 'gerarComprovante']);




    // fRotas exclusivas do Administrador
    Route::get('/api/admin/metricas', fn (\Illuminate\Http\Request $r) => response()->json(app(\App\Services\MetricasCrescimentoService::class)->gerar(max(1, (int) $r->query('dias', 30)))))
        ->middleware(CheckAdmin::class)->name('admin.metricas');
    // Sem CheckAdmin aqui, qualquer usuário autenticado (inclusive o próprio
    // cliente que pediu o estorno) conseguia aprovar/reprovar estornos de
    // QUALQUER UM — aprovar de verdade manda o dinheiro de volta pelo Asaas.
    Route::get('/api/admin/estornos', [EstornoController::class, 'adminIndex'])->middleware(CheckAdmin::class);
    Route::post('/api/admin/estornos/{id}/aprovar', [EstornoController::class, 'adminAprovar'])->middleware(CheckAdmin::class);
    Route::post('/api/admin/estornos/{id}/reprovar', [EstornoController::class, 'adminReprovar'])->middleware(CheckAdmin::class);

// Fica dentro do seu grupo de rotas logadas
Route::post('/api/estornos/{pagamento_id}/solicitar', [EstornoController::class, 'solicitar']);
    Route::get('/estornos/lista', [EstornoController::class, 'index']);

Route::prefix('api/estornos')->middleware(['auth'])->group(function () {
    // Listar as solicitações via Axios (Para alimentar a tabela no React)
    Route::get('/lista', [EstornoController::class, 'minhasSolicitacoes']);





    // Demais rotas
    Route::get('/{id}/detalhes', [EstornoController::class, 'detalhes']);
    Route::post('/solicitar/pagamento/{pagamento_id}', [EstornoController::class, 'solicitar']);
    Route::post('/{id}/contestar', [EstornoController::class, 'contestar']);
});

// Rota para Cancelamento e Estorno de Agendamentos (Pelo Cliente)
Route::post('/agendamentos/{id}/cancelar', [AgendamentoController::class, 'cancelarPeloCliente'])->name('cliente.agendamentos.cancelar');
// adiar
Route::post('/agendamentos/{id}/chamar', [App\Http\Controllers\Api\AgendamentoController::class, 'chamar'])->name('agendamentos.chamar');
Route::post('/agendamentos/{id}/adiar', [App\Http\Controllers\Api\AgendamentoController::class, 'adiar'])->name('agendamentos.adiar');


    Route::prefix('admin/estornos')->group(function () {

        // Ver todos os estornos do sistema com filtros (status, categoria, dia, mês, ano)
        // Mesma falha do outro registro desta rota: sem CheckAdmin, qualquer
        // usuário autenticado julgava (e aprovava de verdade) estorno de qualquer um.
        Route::get('/', [EstornoController::class, 'adminIndex'])->middleware(CheckAdmin::class);

        // O administrador julga que o cliente tem razão e aprova a devolução (API Asaas)
        Route::post('/{id}/aprovar', [EstornoController::class, 'adminAprovar'])->middleware(CheckAdmin::class);

        // O administrador julga que o prestador tem razão e recusa o estorno
        Route::post('/{id}/reprovar', [EstornoController::class, 'adminReprovar'])->middleware(CheckAdmin::class);

        Route::get('/estornos', [EstornoController::class, 'index'])->name('estornos.index');

        // Exemplo de como deve estar no seu routes/web.php
Route::get('/meus-estornos', [EstornoController::class, 'index'])->name('cliente.estornos');
    });

    // Estabelecimentos Menssagens

    Route::get('/mensagens', [MensagemController::class, 'index'])->name('mensagens.index');

    // Contagem de não lidas pro sino de notificação (precisa vir antes de /mensagens/{id})
    Route::get('/mensagens/nao-lidas', [MensagemController::class, 'naoLidas'])->name('mensagens.nao_lidas');

    // 2. Inicia o chat vindo do perfil do cliente e redireciona de imediato
    Route::post('/mensagens/iniciar', [MensagemController::class, 'iniciarConversa'])->name('mensagens.iniciar');

    // 3. Abre a tela focada em um ID específico (Alterado para {id} para evitar conflitos no Ziggy)
    Route::get('/mensagens/{id}', [MensagemController::class, 'show'])->name('mensagens.show');

    // 4. Salva a mensagem enviada
    Route::post('/mensagens/{id}/enviar', [MensagemController::class, 'enviarMensagem'])->name('mensagens.enviar');

    // 5. Favorita/desfavorita uma conversa (por pessoa)
    Route::post('/mensagens/{id}/favoritar', [MensagemController::class, 'favoritar'])->name('mensagens.favoritar');


    // Fila e Configurações (Aninhadas em Estabelecimentos)
   // /fila (sem id) monta a visão agregada de todos os locais do usuário e
   // redireciona pra fila do local específico quando só existe um. A rota
   // COM id tem que apontar pro show() — antes as duas apontavam pro mesmo
   // index(), que ignora silenciosamente o {estabelecimento} da URL e
   // redireciona de volta pra si mesma sempre que o usuário tem só 1 local:
   // loop infinito de redirecionamento, a Fila de Espera nunca abria pra
   // ninguém com um único estabelecimento (o caso mais comum).
Route::get('/fila', [App\Http\Controllers\Api\FilaController::class, 'index'])->name('fila.index');
Route::get('/estabelecimentos/{estabelecimento}/fila', [App\Http\Controllers\Api\FilaController::class, 'show'])->name('estabelecimentos.fila');
Route::get('/estabelecimentos/{estabelecimento}/fila/painel', [App\Http\Controllers\Api\FilaController::class, 'painel'])->name('estabelecimentos.fila.painel');
Route::get('/estabelecimentos/{estabelecimento}/fila/painel/dados', [App\Http\Controllers\Api\FilaController::class, 'painelDados'])->name('estabelecimentos.fila.painel.dados');
    Route::get('/estabelecimentos/{estabelecimento}/configuracoes', [EstabelecimentoController::class, 'configuracoes'])->name('estabelecimentos.configuracoes');

    // Notas fiscais (benefício Sócio Premium)
    Route::get('/notas-fiscais', [App\Http\Controllers\Api\NotaFiscalWebController::class, 'index'])->name('notas-fiscais.index');
    Route::post('/notas-fiscais/{notaFiscal}/tentar-novamente', [App\Http\Controllers\Api\NotaFiscalWebController::class, 'tentarNovamente'])->name('notas-fiscais.tentar-novamente');
    Route::post('/notas-fiscais/configuracao', [App\Http\Controllers\Api\NotaFiscalWebController::class, 'salvarConfiguracao'])->name('notas-fiscais.configuracao');

    // Agendamentos
    Route::put('/agendamentos/{agendamento}/status', [AgendamentoController::class, 'updateStatus'])->name('agendamentos.status.update');

    // ========================================================
    // 💎 GESTÃO DE ASSINATURAS E PLANOS
    // ========================================================
    // Visualizar o status atual da assinatura
    Route::get('/minha-assinatura/status', [AssinaturaController::class, 'status'])->name('assinatura.status');

    // Ação de assinar um novo plano (Recebe 'plano' e 'metodo' no Request)
    Route::post('/minha-assinatura/assinar', [AssinaturaController::class, 'assinar'])->name('assinaturas.assinar');

    // Ação de cancelamento seguro (Mantém benefícios até o fim do ciclo)
    Route::post('/minha-assinatura/cancelar', [AssinaturaController::class, 'cancelar'])->name('assinaturas.cancelar');
    // Cobrança em aberto da assinatura (QR code do Pix quando está perto de vencer)
    Route::get('/minha-assinatura/cobranca', [AssinaturaController::class, 'cobrancaEmAberto'])->middleware('throttle:30,1')->name('assinaturas.cobranca');

    Route::post('/minha-assinatura/mudar-plano', [AssinaturaController::class, 'mudarPlano'])->name('assinaturas.mudar_plano');

    // Atualização de dados financeiros (Ex: Endereço, travado para 1x ao mês)
    Route::put('/minha-assinatura/dados-financeiros', [AssinaturaController::class, 'atualizarDadosFinanceiros'])->name('assinaturas.dados_financeiros');

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



        Route::prefix('api')->group(function () {

    // Rota Aberta de Busca Inteligente (Aceita busca textual ou coordenadas via GET)
    // Ex de uso por busca escrita: /api/travel-assistant/search?busca=Maceió&dias=5&pessoas=2
    // Ex de uso por GPS/Coordenadas: /api/travel-assistant/search?latitude=-9.66&longitude=-35.70&raio_km=15&dias=3
    Route::get('/travel-assistant/search', [TravelAssistantController::class, 'searchDestination'])->name('api.travel.search');

    // Rotas Privadas (Necessitam de Usuário Logado para Criar Viagens e Convidar Amigos)
    Route::middleware('auth')->group(function () {

        // Listar todas as viagens do usuário (criadas por ele ou convidado)
        Route::get('/viagens', [TravelAssistantController::class, 'listarMinhasViagens'])->name('api.viagens.index');

        // Criar uma nova viagem com orçamento, destino e gastos
        Route::post('/viagens', [TravelAssistantController::class, 'criarViagem'])->name('api.viagens.store');

        Route::get('/assistente-viagem', [TravelAssistantController::class, 'searchDestination'])->name('travel-assistant.index');

        // Convidar colaborador para planejar junto por email
        Route::post('/viagens/{viagemId}/adicionar-amigo', [TravelAssistantController::class, 'adicionarMembroPorEmail'])->name('api.viagens.add-membro');
    });
     });

     // Agrupando as rotas que precisam de autenticação
   Route::get('/favoritos', [FavoritoController::class, 'index'])->name('cliente.favoritos');

Route::post('/favoritos/toggle', [FavoritoController::class, 'toggleFavorito'])->name('api.favoritos.toggle');

// comprovante PDF do agendamento
// Modifique a rota para usar o namespace da Api (caso seu controller esteja lá)
Route::get('/agendamentos/{id}/comprovante-pdf', [App\Http\Controllers\Api\AgendamentoController::class, 'gerarComprovantePDF'])
    ->name('agendamentos.comprovante')->middleware('auth');
// comprovante PDF de uma locação avulsa (Aluguel)
Route::get('/alugueis/{id}/comprovante-pdf', [App\Http\Controllers\Api\AgendamentoController::class, 'gerarComprovantePDFAluguel'])
    ->name('alugueis.comprovante')->middleware('auth');
Route::post('/rastreamento/update', [AgendamentoController::class, 'rastrearLocalizacao']);

// Rota que alimenta o Mapa do Proprietário no App Mobile
   // Rota geral, sem {id} na URL
Route::get('/proprietario/rastreamento', [AgendamentoController::class, 'rastreamentoMapaUnificado'])
    ->name('proprietario.rastreamento');
    // Rota para listar favoritos e reservas
    Route::get('/favoritos', [FavoritoController::class, 'index']);

    // Rota para favoritar/desfavoritar
    Route::post('/favoritos/toggle', [FavoritoController::class, 'toggleFavorito']);


    //Detalhes cliente
    Route::middleware(['auth'])->group(function () {
    // Rota para ver os detalhes do cliente
    Route::get('/meus-pedidos/agendamento/{id}', [AgendamentoController::class, 'detalhesAgendamento'])
    ->name('agendamentos.detalhes');
    Route::get('/meus-pedidos/aluguel/{id}', [AgendamentoController::class, 'paginaDetalhesAluguel'])
    ->name('alugueis.detalhes');
    Route::post('/triagens/{id}/salvar-nota', [AgendamentoController::class, 'salvarNotaTriagem'])->name('triagens.salvarNota');

    // Rota para criar/remarcar agendamento
    Route::post('/agendamentos/remarcar', [AgendamentoController::class, 'remarcarServico'])->name('agendamentos.remarcar');

    Route::get('/api/servicos/{id}/horarios-disponiveis', [AgendamentoController::class, 'obterHorariosDisponiveis'])->name('servicos.horarios');

  // contratos

  // Tela de Contratos do Lojista
    Route::get('/estabelecimentos/{estabelecimento}/contratos', [ContratoController::class, 'index'])
        ->name('estabelecimentos.contratos');

        // ver conta da asass
        Route::get('/provider', [ProviderController::class, 'show']);

    // Rota POST para salvar as informações enviadas (o método que você já tinha)
    Route::post('/provider', [ProviderController::class, 'store']);

    // Salvar e Editar os Textos dos Modelos
    Route::post('/estabelecimentos/{estabelecimento}/contratos/template', [ContratoController::class, 'storeTemplate'])
        ->name('contratos.templates.store');
    Route::put('/contratos/template/{id}', [ContratoController::class, 'updateTemplate'])
        ->name('contratos.templates.update');
    Route::delete('/contratos/template/{id}', [ContratoController::class, 'destroyTemplate'])
        ->name('contratos.templates.destroy');

    // Gera o contrato (PDF + Word) pra uma reserva — sem assinatura eletrônica,
    // o lojista só cria, edita o texto, baixa e manda pro cliente dele.
    Route::post('/reservas/{id}/gerar-contrato', [ContratoController::class, 'gerarContrato'])
        ->name('reservas.gerar-contrato');
    Route::post('/contratos/{id}/enviar-email', [ContratoController::class, 'enviarPorEmail'])
        ->name('contratos.enviar-email');
    Route::delete('/contratos/{id}', [ContratoController::class, 'destroyContrato'])
        ->name('contratos.gerados.destroy');


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

        // Adicione isto perto das rotas de itens (catalogo.itens...)
Route::get('/itens/{id}/detalhes', [App\Http\Controllers\Api\ItemAluguelController::class, 'show'])
    ->name('itens.detalhes');

// Reserva enviada direto da tela de detalhes do item (DetalhesItem.jsx) —
// mesma lógica de cálculo/cobrança de cliente.reservas.store, mas com o id
// do item vindo pela URL em vez do corpo da requisição.
Route::post('/itens/{id}/reservar', [App\Http\Controllers\Api\AgendamentoController::class, 'reservarItem'])
    ->name('itens.reservar');

// Valor final + opções de parcelamento no cartão, calculados no servidor.
Route::post('/itens/{id}/cotacao', [App\Http\Controllers\Api\AgendamentoController::class, 'cotarItem'])
    ->name('itens.cotacao');



    Route::get('/itens/{id}/avaliacoes', [App\Http\Controllers\Api\AvaliacaoController::class, 'indexReact'])
    ->name('avaliacoes.pagina');

    Route::post('/avaliacoes', [AvaliacaoController::class, 'store'])->name('avaliacoes.store');



});

// Rota de Webhook pública (Fora do Middleware Auth para receber respostas da D4Sign)
Route::post('/webhooks/d4sign', [AgendamentoController::class, 'webhookD4Sign'])
    ->name('webhooks.d4sign');

});





    // --- Rotas da Visão do CLIENTE ---
    // Acessar a página da loja para agendar
    // Detalhes de um serviço (fotos, horários, pagamento e pontos) antes de ir para o checkout.
    Route::get('/servicos/{servico}/detalhes', [\App\Http\Controllers\Api\ServicoDetalheController::class, 'show'])->name('cliente.servicos.show');
    Route::get('/servicos/{servico}/disponibilidade', [\App\Http\Controllers\Api\ServicoDetalheController::class, 'disponibilidade'])->middleware('throttle:60,1')->name('cliente.servicos.disponibilidade');
    Route::get('/agendar/{estabelecimento}', [ClienteAgendamentoController::class, 'show'])->name('cliente.agendar');

    // Confirmar o agendamento
    Route::post('/agendar/{estabelecimento}', [ClienteAgendamentoController::class, 'store'])->name('cliente.agendar.store');
    Route::post('/agendamento/{agendamento}/pagar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'pagarNovamente'])->name('pagamento.tentar_novamente');

    // Rotas de retorno do Mercado Pago
Route::get('/pagamento/sucesso/{agendamento}', [ClienteAgendamentoController::class, 'pagamentoSucesso'])->name('pagamento.sucesso');
Route::get('/pagamento/falha/{agendamento}', [ClienteAgendamentoController::class, 'pagamentoFalha'])->name('pagamento.falha');

// Rota principal do Dashboard financeiro
  // 1. Rota que ABRE A TELA React (Inertia)

    // 2. Rota que DEVOLVE OS DADOS JSON para o Axios
    Route::get('/meu-extrato', [FinanceiroController::class, 'dashboard'])->name('tela.financeiro.extrato');

    Route::get('/meu-extrato/exportar', [FinanceiroController::class, 'exportar'])->name('financeiro.exportar');

    // 3. Rotas dos relatórios
    Route::post('/financeiro/relatorio/semanal', [FinanceiroController::class, 'enviarRelatorioSemanal']);
    Route::post('/financeiro/relatorio/mensal', [FinanceiroController::class, 'enviarRelatorioMensal']);

Route::post('/agendamento/{id}/cancelar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'cancelar'])->name('cliente.agendamento.cancelar');


// rotas do dashboard cliente
// (rota GET /dashboard já registrada, protegida por auth+verified, lá em cima)

    Route::post('/agendamento/{agendamento}/pagar', [App\Http\Controllers\Api\ClienteAgendamentoController::class, 'pagarNovamente'])->name('pagamento.tentar_novamente');

Route::post('/pagamento/processar', [App\Http\Controllers\Api\PagamentoController::class, 'processar'])->name('pagamento.processar');
Route::get('/pagamento/status', [ClienteAgendamentoController::class, 'callbackMercadoPago'])->name('pagamento.callback');

    // explorar estabelecimentos
    Route::get('/explorar', [ClienteExplorarController::class, 'index'])->name('cliente.explorar');
    Route::get('/explorar/estados', [ClienteExplorarController::class, 'estados'])->name('explorar.estados');

    // 2. Rota para exibir as avaliações de um Item específico a partir do Explorar
    Route::get('/explorar/{id}/avaliacoes', [ClienteExplorarController::class, 'mostrarAvaliacoes'])->name('explorar.avaliacoes');

    // 3. Rota para permitir que o cliente Denuncie um comentário diretamente (Pode coexistir com a rota do AvaliacaoController)
    Route::post('/explorar/avaliacoes/{id}/denunciar', [ClienteExplorarController::class, 'denunciar'])->name('explorar.denunciar');

    Route::post('/agendamentos/{agendamento}/finalizar', [AgendamentoController::class, 'finalizarComCodigo'])->name('agendamentos.finalizar');

    // Serviços
    Route::post('/estabelecimentos/servicos', [ServicoController::class, 'store'])->name('servicos.store');
    Route::put('/servicos/{servico}', [ServicoController::class, 'update'])->name('servicos.update');
    Route::delete('/servicos/{id}', [ServicoController::class, 'destroy'])->name('servicos.destroy');

    // Ofertas exclusivas para clientes Premium (serviços, reservas e produtos com desconto/pontos)
    Route::get('/ofertas-premium', [OfertaPremiumController::class, 'index'])->name('cliente.ofertas_premium');

    // Promoções e campanhas administradas pela Lokyva (pontos, ofertas por plano)
    Route::get('/promocoes', [App\Http\Controllers\Api\ClientePromocaoController::class, 'index'])->name('cliente.promocoes');


    // Funcionários
    Route::post('/estabelecimentos/{estabelecimento}/funcionarios', [FuncionarioController::class, 'store'])->name('funcionarios.store');
    Route::put('/funcionarios/{funcionario}', [FuncionarioController::class, 'update'])->name('funcionarios.update');

    Route::delete('/funcionarios/{funcionario}', [FuncionarioController::class, 'destroy'])->name('funcionarios.destroy');

    // Convite de sócio (co-proprietário) — exclusivo do plano Sócio Premium.
    Route::post('/estabelecimentos/{estabelecimento}/socios', [FuncionarioController::class, 'storeSocio'])->name('socios.store');

  Route::get('/funcionarios/{funcionario}/edit', [FuncionarioController::class, 'edit'])->name('funcionarios.edit');

  // Rota para ver os detalhes do cliente com seus agendamentos

  Route::get('/clientes/{id}/detalhes', [ClienteController::class, 'detalhes']);


    // Tela da Fila do Estabelecimento
Route::match(['get', 'post'], '/estabelecimentos/{estabelecimento}/agenda-equipe', [App\Http\Controllers\Api\FilaController::class, 'agendaFuncionarios'])->name('estabelecimentos.agenda-equipe');
// Adicione esta linha dentro do seu grupo de rotas autenticadas em routes/web.php
Route::get('/clientes/{id}/detalhes', [App\Http\Controllers\Api\ClienteController::class, 'detalhes'])
    ->name('clientes.detalhes');
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

     Route::get('/admin/dashboard-geral', [AdminFinanceiroController::class, 'obterDadosGeraisAdmin']);

     // Configurações (Aninhadas em Estabelecimentos)
     // Obs: a rota de fila nested aqui foi removida por duplicar o nome
     // 'estabelecimentos.fila' já registrado em FilaController::index (linha ~450) —
     // as duas tinham a mesma URI e o mesmo nome apontando pra controllers
     // diferentes; a daqui nunca era alcançada (Laravel casa a primeira rota
     // registrada), então EstabelecimentoController::fila() ficava morto.
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
    Route::get('/tutoriais', [App\Http\Controllers\Api\EstabelecimentoController::class, 'tutoriais'])->name('tutoriais.dono');
    Route::get('/minha-vitrine', [App\Http\Controllers\Api\EstabelecimentoController::class, 'vitrine'])->name('vitrine.dono');

    // ROTAS DA CARTEIRA E GAMIFICAÇÃO DO CLIENTE
    Route::get('/minha-carteira', [CarteiraController::class, 'index'])->name('cliente.carteira');
    Route::get('/meus-pontos', [\App\Http\Controllers\Api\MeusPontosController::class, 'index'])->name('cliente.pontos');
    Route::post('/minha-carteira/assinar-plus', [CarteiraController::class, 'assinarPlus'])->name('cliente.assinatura.plus');
     Route::post('/minha-carteira/resgatar/{cupom}', [App\Http\Controllers\Api\CarteiraController::class, 'resgatarCupom'])->name('cliente.resgatar.cupom');

   Route::get('/carteira', [CarteiraController::class, 'index'])->name('carteira.index');
     Route::post('/financeiro/funcionario/fechar-dia', [CarteiraController::class, 'fecharDia'])->name('funcionario.fechar_dia');
    Route::post('/financeiro/proprietario/sacar', [CarteiraController::class, 'solicitarSaque'])->name('proprietario.sacar');
    Route::post('/financeiro/cliente/resgatar/{cupom}', [CarteiraController::class, 'resgatarCupom'])->name('cliente.resgatar');




     // Rota para abrir a tela de Recompensas/Sugestões
Route::get('/cliente/recompensas', [ClienteCupomController::class, 'recompensas'])->name('cliente.mensagens');

// Rota POST que o React vai chamar quando o cliente clicar em "Resgatar"
Route::post('/cliente/cupons/{id}/resgatar', [ClienteCupomController::class, 'resgatar'])->name('cliente.resgatar.cupom');

// Valida (sem consumir) um código de cupom digitado no checkout de reserva/aluguel.
Route::post('/cupons/validar', [ClienteCupomController::class, 'validar'])->name('cupons.validar');

     Route::middleware(['auth', CheckAdmin::class])->group(function () {

    // Listagem de todas as assinaturas ativas/canceladas/pendentes da plataforma
    Route::get('/admin/assinaturas', [AssinaturaController::class, 'adminIndex'])
        ->name('admin.assinaturas.index');

    // Ações forçadas do Admin (Cancelar Imediatamente, Travar, Marcar como Pago)
    Route::post('/admin/assinaturas/{id}/acao', [AssinaturaController::class, 'adminAcao'])
        ->name('admin.assinaturas.acao');

    // Status real da assinatura direto na Asaas (sob demanda)
    Route::get('/admin/assinaturas/{id}/asaas', [AssinaturaController::class, 'adminConsultarAsaas'])
        ->name('admin.assinaturas.asaas');

    // Auditoria de agendamentos: status, pagamento, local, quem fez/finalizou e estornos
    Route::get('/admin/agendamentos', [App\Http\Controllers\Api\AdminAgendamentoController::class, 'index'])
        ->name('admin.agendamentos.index');
    Route::get('/admin/agendamentos/{id}', [App\Http\Controllers\Api\AdminAgendamentoController::class, 'show'])
        ->name('admin.agendamentos.show');
    });



require __DIR__.'/auth.php';
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/entregas/painel-de-vendas', fn () => \Inertia\Inertia::render('Estabelecimentos/PainelVendasEntregas'))->name('entregas.painel-vendas.page');
    Route::get('/entregas/minhas-assinaturas', fn () => \Inertia\Inertia::render('Entregas/Assinaturas'))->name('entregas.assinaturas.page');
});

// Conferência pública do código de autenticação dos comprovantes de pagamento.
Route::get('/comprovantes/verificar', [\App\Http\Controllers\Api\ComprovantePagamentoController::class, 'verificar'])->middleware('throttle:30,1')->name('comprovantes.verificar');

// Contrato da reserva para o cliente: dados/texto (logado) e o arquivo por link assinado e temporário.
Route::middleware('auth')->get('/contratos/{contrato}/ver', [\App\Http\Controllers\Api\ContratoArquivoController::class, 'mostrar'])
    ->whereNumber('contrato')->name('contratos.ver');
Route::middleware(['auth', 'throttle:10,1'])->post('/contratos/{contrato}/aceitar', [\App\Http\Controllers\Api\ContratoArquivoController::class, 'aceitar'])
    ->whereNumber('contrato')->name('contratos.aceitar');
Route::middleware(['signed', 'throttle:30,1'])->get('/contratos/{contrato}/arquivo/{formato}', [\App\Http\Controllers\Api\ContratoArquivoController::class, 'arquivo'])
    ->whereNumber('contrato')->name('contratos.arquivo');

// ---------------------------------------------------------------------------------------------
// Planejamento de Viagem: Guia do Local e Roteiros (dia a dia). Páginas + JSON do próprio site.
// ---------------------------------------------------------------------------------------------
Route::middleware(['auth'])->group(function () {
    $roteiros = App\Http\Controllers\Api\RoteiroController::class;
    Route::get('/viagens/guia', [$roteiros, 'paginaGuia'])->name('viagens.guia');
    Route::get('/viagens/roteiros', [$roteiros, 'paginaRoteiros'])->name('viagens.roteiros');
    Route::get('/viagens/roteiros/novo', [$roteiros, 'paginaNovo'])->name('viagens.roteiros.novo');
    Route::get('/viagens/roteiros/{roteiro}/editar', [$roteiros, 'paginaEditar'])->whereNumber('roteiro')->name('viagens.roteiros.editar');

    Route::prefix('viagens/api')->name('viagens.api.')->group(fn () => App\Http\Controllers\Api\RoteiroController::rotas());
});

// Roteiro compartilhado por link: somente leitura, sem login.
Route::middleware('throttle:60,1')->group(function () {
    Route::get('/roteiro/{token}', [App\Http\Controllers\Api\RoteiroController::class, 'paginaCompartilhado'])->name('roteiro.compartilhado');
    Route::get('/roteiro/{token}/pdf', [App\Http\Controllers\Api\RoteiroController::class, 'compartilhadoPdf'])->name('roteiro.compartilhado.pdf');
});

// Ofertas Exclusivas via Mensagem: cupom + comunicado para quem favoritou o local.
Route::middleware('auth')->group(function () {
    Route::get('/estabelecimentos/{estabelecimento}/ofertas-favoritos', [App\Http\Controllers\Api\OfertaFavoritosController::class, 'painel'])->name('ofertas-favoritos.painel');
    Route::post('/estabelecimentos/{estabelecimento}/ofertas-favoritos', [App\Http\Controllers\Api\OfertaFavoritosController::class, 'enviar'])->middleware('throttle:10,1')->name('ofertas-favoritos.enviar');
});

// Adicionais (produtos) que o cliente pode escolher ao agendar um serviço ou reservar.
Route::middleware('throttle:60,1')->get('/produtos/adicionais', [App\Http\Controllers\Api\ProdutoController::class, 'adicionais'])->name('produtos.adicionais');
Route::middleware('auth')->get('/produtos/adicionais-vendidos', [App\Http\Controllers\Api\ProdutoController::class, 'adicionaisVendidos'])->name('produtos.adicionais-vendidos');

// Pagamento da assinatura: forma padrão, faturas reais do Asaas, Pix/boleto e troca de cartão.
Route::middleware('auth')->prefix('minha-assinatura')->name('assinatura.pagamento.')->group(fn () => App\Http\Controllers\Api\AssinaturaPagamentoController::rotas());
