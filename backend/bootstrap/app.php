<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Inertia\Inertia;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {

        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->trustProxies(at: '*');

        $middleware->validateCsrfTokens(except: [
            'api/providers',
        ]);

        // Protege a API (usada pelo app mobile e pelo front) contra picos de
        // requisições simultâneas — sem isso não havia NENHUM rate limit,
        // então muitos usuários batendo na API ao mesmo tempo (ex: a fila do
        // funcionário atualizando sozinha a cada 30s em vários aparelhos)
        // podia sobrecarregar o servidor sem qualquer proteção.
        $middleware->throttleApi();

    })
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('financeiro:processar-diario')->dailyAt('01:00');
        $schedule->command('financeiro:relatorio-semanal')->weeklyOn(1, '07:00');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // API/JSON: resposta padronizada, em português e sem vazar detalhes internos.
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (\App\Support\RespostaDeErro::deveResponderJson($request)) {
                return \App\Support\RespostaDeErro::montar($e, $request);
            }

            return null;
        });

        $exceptions->respond(function (Response $response, \Throwable $exception, Request $request) {
            // A API (usada pelo app mobile) sempre espera JSON — nunca troca
            // a resposta por uma página HTML/Inertia aqui, só o site.
            if ($request->is('api/*')) {
                return $response;
            }

            if ($response->getStatusCode() === 419) {
                return back()->with([
                    'message' => 'A página expirou. Tente novamente.',
                ]);
            }

            $statusComPaginaAmigavel = [400, 401, 403, 404, 429, 500, 503];

            if (in_array($response->getStatusCode(), $statusComPaginaAmigavel, true)) {
                // Mensagem própria só nos 403 (ex.: recurso Premium); nos demais o texto padrão da tela é mais seguro.
                $mensagem = null;
                if ($response->getStatusCode() === 403) {
                    $texto = trim($exception->getMessage());
                    $mensagem = ($texto !== '' && !in_array($texto, ['Forbidden', 'This action is unauthorized.'], true)) ? $texto : null;
                }

                return Inertia::render('Error', [
                    'status' => $response->getStatusCode(),
                    'mensagem' => $mensagem,
                    'premium' => $exception instanceof \App\Exceptions\PremiumRequiredException,
                ])
                    ->toResponse($request)
                    ->setStatusCode($response->getStatusCode());
            }

            return $response;
        });
    })->create();