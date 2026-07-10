<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;


Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');


// Vai rodar o seu robô financeiro todos os dias à 01:00 da manhã
Schedule::command('financeiro:processar-diario')->dailyAt('01:00');
