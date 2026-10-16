<?php

return [
    /*
     * Alerta de erros: quando o sistema dá erro 500, manda um e-mail curto para este endereço
     * (o mesmo erro só é avisado uma vez a cada X minutos, para não lotar a caixa).
     * Deixe vazio para desligar.
     */
    'alerta_erros_email' => env('ALERTA_ERROS_EMAIL'),
    'alerta_erros_intervalo_minutos' => (int) env('ALERTA_ERROS_INTERVALO', 30),
    'alerta_erros_maximo_por_hora' => (int) env('ALERTA_ERROS_MAX_HORA', 20),

    /*
     * Backup diário do PostgreSQL (comando backup:banco). Os arquivos ficam em storage/app/private/backups
     * (disco privado) e só os N mais recentes são mantidos.
     */
    'backup' => [
        'pg_dump' => env('PG_DUMP_BIN', 'pg_dump'),
        'manter' => (int) env('BACKUP_MANTER', 7),
        'disco' => env('BACKUP_DISCO', 'local'),
        'pasta' => 'backups',
        // Disco extra (ex.: s3) para guardar uma cópia fora do servidor. Vazio = só local.
        'copia_externa' => env('BACKUP_DISCO_EXTERNO'),
    ],
];
