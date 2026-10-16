<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

'asaas' => [
        'url' => env('ASAAS_URL', 'https://sandbox.asaas.com/api/v3'),
        'key' => env('ASAAS_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
    ],
    
    // Moderação de imagens (Hive AI). Desligada por padrão: a estrutura fica pronta para o futuro.
    // Para ligar: HIVE_MODERACAO_ATIVA=true e HIVE_API_KEY no .env.
    'hive' => [
        'ativo' => (bool) env('HIVE_MODERACAO_ATIVA', false),
        'key' => env('HIVE_API_KEY'),
    ],

    'imagekit' => [
        'public_key' => env('IMAGEKIT_PUBLIC_KEY'),
        'private_key' => env('IMAGEKIT_PRIVATE_KEY'),
        'url_endpoint' => env('IMAGEKIT_URL_ENDPOINT'),
    ],

    // Endereço → coordenadas (Guia do Local, roteiros e busca por proximidade).
    'mapbox' => [
        'token' => env('MAPBOX_ACCESS_TOKEN'),
        'geocodificar' => env('MAPBOX_GEOCODIFICAR', true),
    ],

    // APIs públicas da Wikimedia (Guia do Local): identificação exigida pela política de uso.
    'wikimedia' => [
        'user_agent' => env('WIKIMEDIA_USER_AGENT', 'LOKYVA/1.0 (TCC UNIFACOL; jonathan.rocha@unifacol.edu.br)'),
        'timeout' => (int) env('WIKIMEDIA_TIMEOUT', 5),
    ],

];
