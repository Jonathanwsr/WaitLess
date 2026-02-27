<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Carrinho extends Model
{
    use HasFactory;

    protected $table = 'carrinhos'; 

    protected $fillable = [
        'user_id',
        'servico_id',
        'estabelecimento_id',
        'quantidade'
    ];

    
    public function servico()
    {
        return $this->belongsTo(Servico::class, 'servico_id');
    }

   
    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }

    
    public function usuario()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}