<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Oferta enviada por mensagem para quem favoritou o local (histórico e limite diário). */
class OfertaFavoritos extends Model
{
    protected $table = 'ofertas_favoritos';

    protected $fillable = ['estabelecimento_id', 'enviada_por', 'cupom_id', 'titulo', 'mensagem', 'destinatarios'];

    public function cupom(): BelongsTo
    {
        return $this->belongsTo(Cupom::class);
    }

    public function remetente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'enviada_por');
    }
}
