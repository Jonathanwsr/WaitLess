<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class Agendamento extends Model
{

    protected $guarded = ['id'];


    protected $casts = [
        'status_pagamento' => 'string',
    ];

    /**
     * Registra automaticamente toda mudança de status em historico_agendamentos,
     * não importa qual método/controller (web, mobile ou os robôs agendados)
     * tenha feito a alteração — isso dá ao admin um log de auditoria completo
     * sem precisar instrumentar cada ponto do código que chama ->update().
     */
    protected static function booted(): void
    {
        static::updated(function (Agendamento $agendamento) {
            if (! $agendamento->wasChanged('status')) {
                return;
            }

            $usuario = Auth::user();

            HistoricoAgendamento::create([
                'agendamento_id' => $agendamento->id,
                'status_anterior' => $agendamento->getOriginal('status'),
                'status_novo' => $agendamento->status,
                'alterado_por_id' => $usuario?->id,
                'alterado_por_nome' => $usuario?->name ?? 'Sistema (robô automático)',
                'created_at' => now(),
            ]);
        });
    }

    public function finalizadoPor()
    {
        return $this->belongsTo(User::class, 'finalizado_por');
    }

    public function historico()
    {
        return $this->hasMany(HistoricoAgendamento::class)->orderByDesc('created_at');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function servico()
    {
        return $this->belongsTo(Servico::class);
    }

    public function funcionario()
    {
        return $this->belongsTo(Funcionario::class);
    }

 
    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class, 'pagamento_id');
    }

function itemAluguel()
{
    return $this->belongsTo(ItemAluguel::class);
}

public function produtos()
{
  
    return $this->hasMany(Produto::class, 'agendamento_id');
}

}