<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

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
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();