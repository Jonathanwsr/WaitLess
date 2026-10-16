<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mensagem extends Model
{
    // Define explicitamente o nome correto da tabela no banco de dados
    protected $table = 'mensagens';

    protected $guarded = [];

    protected $casts = [
        'lida_em' => 'datetime',
    ];

    public function conversa()
    {
        return $this->belongsTo(Conversa::class);
    }

    /** Ofertas exclusivas enviadas a quem favoritou o local. */
    public function cupom()
    {
        return $this->belongsTo(Cupom::class);
    }

    public function oferta()
    {
        return $this->belongsTo(OfertaFavoritos::class, 'oferta_id');
    }
}