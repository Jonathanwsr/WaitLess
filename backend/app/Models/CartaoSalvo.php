<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CartaoSalvo extends Model
{
    protected $table = 'cartoes_salvos';

    protected $fillable = ['user_id', 'token', 'bandeira', 'ultimos_digitos', 'nome_titular', 'padrao'];

    protected $casts = [
        'padrao' => 'boolean',
    ];

    // Nunca expor o token do gateway para o front-end.
    protected $hidden = ['token'];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
