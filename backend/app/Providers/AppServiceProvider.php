<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        \App\Models\Agendamento::observe(\App\Observers\AgendamentoObserver::class);

        // App em português: mensagens de validação, datas por extenso ("21 de setembro") e "há 5 minutos".
        // Definido aqui para não depender do APP_LOCALE de cada ambiente; o que faltar cai no inglês.
        app()->setLocale('pt_BR');
        \Illuminate\Support\Carbon::setLocale('pt_BR');

        // Limite geral da API (app mobile + front): generoso o bastante para
        // uso normal (ex: a fila do funcionário atualiza sozinha a cada 30s),
        // mas evita que um app travado em loop ou muitos usuários simultâneos
        // derrubem o servidor. Por usuário logado quando houver token, senão por IP.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        // Limite mais rígido só para tentativas de login (web e mobile),
        // protegendo contra força bruta/credential stuffing sem atrapalhar
        // o uso normal do app.
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(8)->by(strtolower((string) $request->input('email')) . '|' . $request->ip());
        });

        // Cadastro faz chamadas reais à API do Asaas e envia e-mail a cada
        // tentativa — sem limite, um script automatizado conseguia gerar
        // contas em massa e gastar as chamadas do gateway de pagamento.
        // Recuperação de senha: manda e-mail e aceita tentativas de código, então é limitada por e-mail e por IP.
        RateLimiter::for('senha', function (Request $request) {
            return [
                Limit::perMinute(5)->by(strtolower((string) $request->input('email')) . '|' . $request->ip()),
                Limit::perHour(30)->by($request->ip()),
            ];
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(6)->by($request->ip());
        });
    }
}
