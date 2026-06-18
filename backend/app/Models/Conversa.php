<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversa extends Model
{
    protected $guarded = [];

    public function usuario() {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento() {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }

    public function mensagens() {
        return $this->hasMany(Mensagem::class);
    }

    
    public function ultimaMensagem() {
        return $this->hasOne(Mensagem::class)->latestOfMany();
    }
}
