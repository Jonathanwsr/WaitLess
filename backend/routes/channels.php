<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Conversa;
use App\Models\Agendamento;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Aqui você pode registrar todas as callbacks de autorização para os canais
| de transmissão (WebSockets) da sua aplicação. 
|
*/

// =====================================================================
// 1. CANAL PADRÃO DO USUÁRIO (Notificações Globais)
// =====================================================================
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// =====================================================================
// 2. CANAL DO CHAT (Suporte / Mensagens)
// =====================================================================
Broadcast::channel('conversa.{conversaId}', function ($user, $conversaId) {
    $conversa = Conversa::find($conversaId);
    
    if (!$conversa) {
        return false;
    }

    // Autoriza se for o cliente que iniciou a conversa ou o dono do estabelecimento
    return $user->id === $conversa->usuario_id || $user->id === $conversa->estabelecimento->user_id;
});

// =====================================================================
// 3. CANAL DE RASTREAMENTO GPS (Mapa do Cliente a Caminho)
// =====================================================================
Broadcast::channel('rastreamento.{agendamentoId}', function ($user, $agendamentoId) {
    
    $agendamento = Agendamento::find($agendamentoId);

    if (!$agendamento) {
        return false;
    }

    // 3.1. Se for o próprio cliente mandando o sinal, ele está autorizado
    if ($user->id === $agendamento->usuario_id) {
        return true;
    }

    // 3.2. Autorização para o Gerente/Sócio/Admin do Estabelecimento
    if (in_array($user->papel, ['admin', 'socio', 'gerente'])) {
        // Verifica se o usuário que quer ver o mapa realmente gerencia o local deste agendamento
        // Assumindo que seu User model tem o relacionamento estabelecimentos() configurado.
        return $user->estabelecimentos()->where('estabelecimentos.id', $agendamento->estabelecimento_id)->exists();
    }

    // Se não for nem o dono do agendamento nem o gerente do local, barra o acesso.
    return false;
});