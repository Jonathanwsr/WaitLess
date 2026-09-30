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

    // Cliente dono da conversa
    if ((int) $user->id === (int) $conversa->usuario_id) {
        return true;
    }

    // Funcionário especificamente designado pra essa conversa
    if ($conversa->funcionario_id && $conversa->funcionario?->usuario_id && (int) $user->id === (int) $conversa->funcionario->usuario_id) {
        return true;
    }

    // Conversa sobre uma locação/aluguel: `estabelecimento_id` aqui é
    // direto o `users.id` do dono (locações não passam por um
    // Estabelecimento de verdade), então ele é liberado diretamente.
    if ($conversa->aluguel_id && (int) $user->id === (int) $conversa->estabelecimento_id) {
        return true;
    }

    // Qualquer pessoa vinculada ao estabelecimento (sócio, gerente, atendente...)
    return \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')
        ->where('usuario_id', $user->id)
        ->where('estabelecimento_id', $conversa->estabelecimento_id)
        ->exists();
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
// =====================================================================
// CANAL DE ATIVIDADE DA EQUIPE (sócio/gerente acompanham em tempo real
// o que funcionários e gerentes fazem nos agendamentos do estabelecimento)
// =====================================================================
Broadcast::channel('atividade-equipe.{estabelecimentoId}', function ($user, $estabelecimentoId) {
    if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
        return false;
    }

    return $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimentoId)->exists();
});

// =====================================================================
// CANAL DO CHAT DO GRUPO DA VIAGEM (só quem participa da viagem)
// =====================================================================
Broadcast::channel('viagem.{viagemId}', function ($user, $viagemId) {
    $viagem = \App\Models\Viagem::find($viagemId);

    return $viagem && $viagem->temMembro((int) $user->id);
});
