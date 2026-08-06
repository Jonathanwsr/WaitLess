<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;


Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Roda o comando de estornos automáticos (e processamento diário) todas as madrugadas às 01:00h
Schedule::command('financeiro:processar-diario')->dailyAt('01:00');

// 👉 NOVO: Roda o repasse PIX para a conta bancária dos lojistas toda segunda-feira às 05:00h da manhã
Schedule::command('financeiro:repassar-semanal')->weeklyOn(1, '05:00');

Schedule::command('estornos:processar-vencidos')->hourly();