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

// Acompanha transferências da carteira Asaas (não há webhook de transferência) e refaz validações pendentes.
Schedule::command('carteira:sincronizar')->everyTenMinutes()->withoutOverlapping();

// Gamificação: bônus mensal automático de pontos por plano premium (todo dia 1, de madrugada).
Schedule::command('gamificacao:bonus-mensal')->monthlyOn(1, '03:00');

Schedule::command('entregas:lembretes-recompra')->dailyAt('10:00');
Schedule::command('fila:avisar-vez')->everyFiveMinutes();
Schedule::command('entregas:processar-assinaturas')->dailyAt('06:00');

// Venda cruzada de viagem: oferta de veículo 2 dias antes do check-in da hospedagem.
Schedule::command('viagem:ofertas-cruzadas')->everyFifteenMinutes()->withoutOverlapping();

// Flash Deals: devolve o preço original assim que a oferta relâmpago vence.
Schedule::command('flash-deals:encerrar')->everyMinute()->withoutOverlapping();

// Notas fiscais: acompanha a autorização na prefeitura (status, número, PDF/XML) e avisa por e-mail.
Schedule::command('notas:sincronizar')->everyThirtyMinutes()->withoutOverlapping();

// Assinatura cancelada: ao fim do ciclo pago, a conta volta para o plano Grátis.
Schedule::command('assinaturas:voltar-gratuito')->dailyAt('00:30');

// Carteiras que ficaram aguardando o Asaas liberar novas subcontas: tenta abrir sozinho.
Schedule::command('carteira:abrir-pendentes')->hourly()->withoutOverlapping();
Schedule::command('locacoes:geocodificar --limite=200')->dailyAt('03:30')->withoutOverlapping();

// Backup diário do PostgreSQL (mantém os 7 mais recentes em storage/app/private/backups).
Schedule::command('backup:banco')->dailyAt('02:15')->withoutOverlapping();

// Lembretes de véspera (push + e-mail) para agendamentos e reservas das próximas 24h.
Schedule::command('lembretes:enviar')->hourly()->withoutOverlapping();
