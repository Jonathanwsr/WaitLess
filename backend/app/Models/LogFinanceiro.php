<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LogFinanceiro extends Model
{
    protected $table = 'log_financeiro';

    protected $guarded = ['id'];

    protected $casts = [
        'valor' => 'decimal:2',
        'saldo_anterior' => 'decimal:2',
        'saldo_atual' => 'decimal:2',
        'json_asaas' => 'array', // Converte o JSON do banco direto para Array no PHP
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function prestador()
    {
        return $this->belongsTo(User::class, 'prestador_id');
    }

    public function estorno()
    {
        return $this->belongsTo(Estorno::class);
    }

    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class);
    }
}