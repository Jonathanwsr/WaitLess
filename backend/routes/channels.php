<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Conversa;


Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Canal Privado da Conversa (O que criamos agora)
Broadcast::channel('conversa.{conversaId}', function ($user, $conversaId) {
    $conversa = Conversa::find($conversaId);
    
    if (!$conversa) {
        return false;
    }

    
    return $user->id === $conversa->usuario_id || $user->id === $conversa->estabelecimento->user_id;
});